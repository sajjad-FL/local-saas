import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  RefreshControl,
  SafeAreaView,
  TextInput,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useBiz } from '../../context/BizContext';
import { useTheme } from '../../context/ThemeContext';
import { api, rupees, formatDate, waLink, remindMsg, WEB_URL } from '../../api/api';
import Icon from '../../components/Icon';
import TopBar from '../../components/TopBar';
import Loader, { Spinner } from '../../components/Loader';
import Avatar from '../../components/Avatar';
import { tint, tinted } from '../../constants/theme';

// Modals
import MoveRoomModal from '../modals/MoveRoomModal';
import EditMemberModal from '../modals/EditMemberModal';
import SellModal from '../modals/SellModal';

export default function MemberDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { biz, isOwner } = useBiz();
  const { theme } = useTheme();

  const [data, setData] = useState(null);
  const [shareToken, setShareToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Record Payment form state
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('cash'); // 'cash' | 'upi' | 'other'
  const [payLoading, setPayLoading] = useState(false);
  const [lastPayment, setLastPayment] = useState(null);

  // Modals
  const [moveRoomOpen, setMoveRoomOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [tab, setTab] = useState(route?.params?.tab || 'overview'); // overview | payments | attendance | deposit

  const fetchMember = useCallback(async () => {
    if (!id) return;
    try {
      const [res, share] = await Promise.all([
        api(`/members/${id}`),
        api(`/members/${id}/share`, { method: 'POST' }).catch(() => null),
      ]);
      setData(res);
      if (share?.token) setShareToken(share.token);
    } catch (err) {
      console.warn('Error fetching member details', err);
      Alert.alert('Error', err.message || 'Could not load member');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMember();
  }, [fetchMember]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMember();
    setRefreshing(false);
  };

  const handleRecordPayment = async () => {
    const numAmt = Number(amount);
    if (!numAmt || numAmt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
      return;
    }

    setPayLoading(true);
    try {
      const p = await api(`/members/${id}/payments`, {
        method: 'POST',
        body: { amount: numAmt, mode },
      });
      setLastPayment(p);
      setAmount('');
      await fetchMember();
      Alert.alert('Payment Recorded', `Successfully recorded payment of ${rupees(numAmt)}.`);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to record payment');
    } finally {
      setPayLoading(false);
    }
  };

  const handleReversePayment = (paymentId, pAmount) => {
    Alert.alert(
      'Reverse Payment?',
      `Are you sure you want to delete and reverse the payment of ${rupees(pAmount)}? The balance will be adjusted accordingly.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reverse',
          style: 'destructive',
          onPress: async () => {
            try {
              await api(`/members/${id}/payments/${paymentId}`, { method: 'DELETE' });
              await fetchMember();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const handlePauseResume = async () => {
    const isPaused = data?.subscription?.status === 'paused';
    const action = isPaused ? 'resume' : 'pause';
    const confirmTitle = isPaused ? 'Resume Membership?' : 'Pause Membership?';
    const confirmDesc = isPaused
      ? 'Resuming will extend the subscription period by the paused duration.'
      : 'Pausing will freeze renewals while the member is away.';

    Alert.alert(confirmTitle, confirmDesc, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: isPaused ? 'Resume' : 'Pause',
        onPress: async () => {
          try {
            await api(`/members/${id}/${action}`, { method: 'POST' });
            await fetchMember();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete member?',
      `Are you sure you want to remove ${data?.member?.name}? Their payments, dues and attendance are deleted too. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api(`/members/${id}`, { method: 'DELETE' });
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const handleResetLink = () => {
    Alert.alert(
      'Reset the statement link?',
      `The link already sent to ${data?.member?.name} will stop working. Send them the new one after this.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset link',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await api(`/members/${id}/share`, { method: 'POST', body: { rotate: true } });
              if (res?.token) setShareToken(res.token);
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const handleMarkLeft = () => {
    Alert.alert(
      'Mark Member as Left?',
      'Active subscriptions will be stopped. Member history and ledger will remain intact.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Left',
          style: 'destructive',
          onPress: async () => {
            try {
              await api(`/members/${id}`, { method: 'PATCH', body: { status: 'left' } });
              await fetchMember();
              navigation.navigate('Members');
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const handleShareStatement = async () => {
    if (!statementUrl) return;
    const url = statementUrl;
    if (data?.member?.phone) {
      Linking.openURL(waLink(data.member.phone, `Hi ${data.member.name}, here is your account statement from ${biz?.name || 'us'}: ${url}`));
      return;
    }
    try {
      await Share.share({
        message: `Hi ${data?.member?.name}, here is your account statement from ${biz?.name || 'us'}: ${url}`,
        url,
      });
    } catch {
      Clipboard.setStringAsync(url);
      Alert.alert('Copied', 'Statement link copied to clipboard.');
    }
  };

  if (loading || !data) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
        <TopBar navigation={navigation} />
        <View style={styles.centerBox}>
          <Loader label="Loading member" />
        </View>
      </SafeAreaView>
    );
  }

  const { member, dues = [], payments = [], balance = 0, subscription } = data;
  const isPaused = subscription?.status === 'paused';
  const statementUrl = shareToken ? `${WEB_URL}/s/${shareToken}` : null;
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  // Chronological ledger with running balance
  const sorted = [
    ...dues.map((d) => ({ ...d, kind: 'due', when: d.dueDate })),
    ...payments.map((p) => ({ ...p, kind: 'payment', when: p.date })),
  ].sort((a, b) => new Date(a.when) - new Date(b.when) || (a.kind === 'due' ? -1 : 1));
  const ledger = sorted
    .reduce((rows, item) => {
      const prev = rows.length ? rows[rows.length - 1].balanceAfter : 0;
      rows.push({ ...item, balanceAfter: prev + (item.kind === 'due' ? item.amount : -item.amount) });
      return rows;
    }, [])
    .reverse();

  // payments clear the oldest fees first: the first fee not covered is what they've owed since
  let owingSince = null;
  if (balance > 0) {
    let paidLeft = totalPaid;
    for (const d of [...dues].sort((x, y) => new Date(x.dueDate) - new Date(y.dueDate))) {
      if (paidLeft >= d.amount) { paidLeft -= d.amount; continue; }
      if (new Date(d.dueDate) <= new Date()) owingSince = d.dueDate;
      break;
    }
  }
  const today0 = new Date(new Date().toDateString());
  const daysLate = owingSince ? Math.max(0, Math.floor((today0 - new Date(new Date(owingSince).toDateString())) / 86400000)) : 0;
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'payments', label: 'Payments', count: ledger.length },
    biz?.attendanceEnabled !== false && { id: 'attendance', label: 'Attendance' },
    biz?.type === 'hostel' && { id: 'deposit', label: 'Deposit' },
  ].filter(Boolean);
  const current = tabs.some((t) => t.id === tab) ? tab : 'overview';
  const c = theme.colors;
  const isActive = member.status === 'active';
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const planText = subscription?.planId
    ? `${subscription.planId.name} · ${rupees(subscription.amount ?? subscription.planId.amount)}${subscription.amount ? ' (custom)' : ''}`
    : 'No active plan';
  const dueDate = subscription?.periodEnd ? new Date(subscription.periodEnd) : null;
  const dueLate = dueDate && dueDate <= new Date();
  const ledgerList = (items) => items.map((item, i) => {
    const isPayment = item.kind === 'payment';
    return (
      <View key={item._id} style={[styles.lrow, i > 0 && { borderTopWidth: 1, borderTopColor: c.borderSubtle, paddingTop: 10 }]}>
        <View style={[styles.licon, { backgroundColor: isPayment ? c.successSoft : c.warningSoft }]}>
          <Icon name={isPayment ? 'cash-outline' : 'card-outline'} size={15} color={isPayment ? c.moneyGreen : c.moneyAmber} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.lwhat, { color: c.text }]} numberOfLines={1}>{isPayment ? 'Payment received' : item.label || 'Fee due'}</Text>
          <Text style={[styles.lsub, { color: c.textMuted }]}>{fmtDate(item.when)}{item.mode ? ` · ${item.mode === 'upi' ? 'UPI' : item.mode[0].toUpperCase() + item.mode.slice(1)}` : ''}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.lamt, { color: isPayment ? c.moneyGreen : c.moneyRed }]}>{isPayment ? '+' : '−'}{rupees(item.amount)}</Text>
          <Text style={[styles.lsub, { color: c.textMuted }]}>Balance {rupees(item.balanceAfter)}</Text>
        </View>
        {isOwner && isPayment ? (
          <TouchableOpacity onPress={() => handleReversePayment(item._id, item.amount)} accessibilityLabel={`Reverse payment of ${rupees(item.amount)}`} style={styles.ltrash}>
            <Icon name="trash-outline" size={14} color={c.textMuted} />
          </TouchableOpacity>
        ) : <View style={{ width: 32 }} />}
      </View>
    );
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* TopBar */}
      <TopBar navigation={navigation} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} progressBackgroundColor={theme.colors.card} />
        }>
        {/* Back to the list, same pill as the web; edit and delete on the right */}
        <View style={styles.topRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
            style={[styles.backPill, { backgroundColor: tint(c.primary, 0.08, c.card), borderColor: tint(c.primary, 0.35, c.card) }]}>
            <Icon name="chevron-back" size={13} color={c.primary} />
            <Text style={[styles.backPillText, { color: c.primary }]}>Members</Text>
          </TouchableOpacity>
          <View style={styles.topIcons}>
            <TouchableOpacity accessibilityLabel="Edit member" activeOpacity={0.7} onPress={() => setEditOpen(true)}
              style={[styles.iconBtn, { borderColor: c.border, backgroundColor: c.card }]}>
              <Icon name="create-outline" size={16} color={c.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity accessibilityLabel="Delete member" activeOpacity={0.7} onPress={handleDelete}
              style={[styles.iconBtn, { borderColor: c.border, backgroundColor: c.card }]}>
              <Icon name="trash-outline" size={16} color={c.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* who, what they owe, and the things you do most (the web's md-head) */}
        <View style={[styles.head, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.who}>
            <Avatar name={member.name} size={30} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{member.name}</Text>
                {member.status === 'left' && <View style={[styles.badge, { backgroundColor: c.cardSubtle }]}><Text style={[styles.badgeText, { color: c.textMuted }]}>Left</Text></View>}
                {isPaused && <View style={[styles.badge, { backgroundColor: c.warningSoft }]}><Text style={[styles.badgeText, { color: c.moneyAmber }]}>Paused</Text></View>}
              </View>
              <Text style={[styles.whoSub, { color: c.textMuted }]} numberOfLines={1}>
                {member.phone ? <Text style={{ color: c.textSecondary, fontWeight: '600' }} onPress={() => Linking.openURL(`tel:${member.phone}`)}>{member.phone}</Text> : 'No phone'}
                {' · '}{planText}
              </Text>
            </View>
          </View>

          <View style={[styles.balance, { borderTopColor: c.border }]}>
            <Text style={[styles.balanceLabel, { color: c.textMuted }]}>{balance > 0 ? 'OWES' : balance < 0 ? 'ADVANCE' : 'BALANCE'}</Text>
            <Text style={[styles.balanceBig, { color: balance > 0 ? c.moneyRed : c.moneyGreen }]}>{balance === 0 ? 'Paid up' : rupees(Math.abs(balance))}</Text>
            {owingSince ? (
              <Text style={[styles.balanceSub, { color: c.moneyRed }]}>
                {daysLate > 0 ? `${daysLate} day${daysLate === 1 ? '' : 's'} late` : 'Due today'} · since {fmtDate(owingSince)}
              </Text>
            ) : dueDate && isActive && !isPaused ? (
              <Text style={[styles.balanceSub, { color: dueLate ? c.moneyRed : c.textMuted }]}>Next due {fmtDate(dueDate)}</Text>
            ) : null}
          </View>

          <View style={styles.actions}>
            {isActive && (
              <TouchableOpacity activeOpacity={0.85} onPress={() => setTab('payments')} style={[styles.act, { backgroundColor: c.primary, borderColor: c.primary }]}>
                <Icon name="checkmark" size={15} color="#fff" />
                <Text style={[styles.actText, { color: '#fff' }]}>Record payment</Text>
              </TouchableOpacity>
            )}
            {isActive && biz?.salesEnabled !== false && (
              <TouchableOpacity activeOpacity={0.85} onPress={() => setSellOpen(true)} style={[styles.act, { backgroundColor: c.card, borderColor: c.border }]}>
                <Icon name="pricetag-outline" size={15} color={c.text} />
                <Text style={[styles.actText, { color: c.text }]}>Sell</Text>
              </TouchableOpacity>
            )}
            {member.phone && balance > 0 && (
              <TouchableOpacity activeOpacity={0.85} onPress={() => Linking.openURL(waLink(member.phone, remindMsg(biz, member, balance, statementUrl)))}
                style={[styles.act, { backgroundColor: '#10B981', borderColor: '#10B981' }]}>
                <Icon name="logo-whatsapp" size={15} color="#fff" />
                <Text style={[styles.actText, { color: '#fff' }]}>Remind</Text>
              </TouchableOpacity>
            )}
            {statementUrl && (
              <TouchableOpacity activeOpacity={0.85} onPress={handleShareStatement} style={[styles.act, { backgroundColor: c.card, borderColor: c.border }]}>
                <Icon name="link-outline" size={14} color={c.text} />
                <Text style={[styles.actText, { color: c.text }]}>Share statement</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* tabs, underlined like the web */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabs, { borderBottomColor: c.border }]}>
          {tabs.map((t) => {
            const on = current === t.id;
            return (
              <TouchableOpacity key={t.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setTab(t.id)}
                style={[styles.tab, { borderBottomColor: on ? c.primary : 'transparent' }]}>
                <Text style={{ fontSize: 14.5, fontWeight: '600', color: on ? c.primaryDark : c.textMuted }}>{t.label}</Text>
                {t.count > 0 ? (
                  <View style={[styles.tabCount, { backgroundColor: c.cardSubtle }]}><Text style={{ fontSize: 12, fontWeight: '700', color: c.textSecondary }}>{t.count}</Text></View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {current === 'overview' && (
          <>
            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.cardTitle, { color: c.text }]}>Details</Text>
              <View style={styles.facts}>
                {[
                  ['Phone', member.phone || '—'],
                  ['Plan', planText],
                  owingSince && ['Unpaid since', `${fmtDate(owingSince)}${daysLate > 0 ? ` (${daysLate} days)` : ''}`, c.moneyRed],
                  ['Next renewal', dueDate ? fmtDate(dueDate) : '—'],
                  ['Joined', member.joinDate ? fmtDate(member.joinDate) : '—'],
                  ['Total paid', rupees(totalPaid), c.moneyGreen],
                  ['Member ID', member._id.slice(-6).toUpperCase(), null, true],
                ].filter(Boolean).map(([k, v, ink, mono], i) => (
                  <View key={k} style={[styles.fact, i > 1 && { borderTopWidth: 1, borderTopColor: c.borderSubtle, paddingTop: 10 }]}>
                    <Text style={[styles.factKey, { color: c.textMuted }]}>{k}</Text>
                    <Text style={[styles.factVal, { color: ink || c.text }, mono && { fontFamily: 'monospace', fontSize: 13.5 }]}>{v}</Text>
                  </View>
                ))}
              </View>
              {member.roomMoves?.length > 0 && (
                <View style={[styles.historyBox, { borderTopColor: c.borderSubtle }]}>
                  <Text style={[styles.historyTitle, { color: c.textMuted }]}>ROOM HISTORY</Text>
                  {[...member.roomMoves].reverse().map((mv, i) => (
                    <View key={i} style={styles.historyRow}>
                      <Icon name="bed-outline" size={13} color={c.primary} style={{ marginTop: 2 }} />
                      <Text style={[styles.historyText, { color: c.text }]}>
                        <Text style={{ fontWeight: '700' }}>{shortLabel(mv.fromLabel) || 'No room'} → {shortLabel(mv.toLabel)}</Text>
                        <Text style={{ color: c.textMuted }}> on {formatDate(mv.on)}</Text>
                        {mv.rentBefore != null && mv.rentAfter != null && mv.rentBefore !== mv.rentAfter ? (
                          <Text style={{ color: c.textMuted }}> · rent {rupees(mv.rentBefore)} → {rupees(mv.rentAfter)}</Text>
                        ) : null}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.cardHeadRow}>
                <Text style={[styles.cardTitle, { color: c.text }]}>Recent activity</Text>
                {ledger.length > 3 && <TouchableOpacity onPress={() => setTab('payments')}><Text style={[styles.link, { color: c.primaryDark }]}>See all {ledger.length}</Text></TouchableOpacity>}
              </View>
              {ledger.length ? ledgerList(ledger.slice(0, 3)) : <Text style={[styles.empty, { color: c.textMuted }]}>No fees or payments yet.</Text>}
            </View>

            {(statementUrl || isActive) && (
              <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={[styles.cardTitle, { color: c.text }]}>Manage</Text>
                {[
                  statementUrl && { key: 'link', title: 'Statement link', sub: 'A read-only page with every due and payment, no login needed.', btn: 'Reset link', go: handleResetLink },
                  subscription && isActive && { key: 'pause', title: isPaused ? 'Paused' : 'Pause membership', sub: isPaused ? 'No fees while paused. Resuming adds the paused days to the due date.' : 'Stops fees for a while, for example when they go home.', btn: isPaused ? 'Resume' : 'Pause', icon: isPaused ? 'play' : 'pause', go: handlePauseResume },
                  isActive && biz?.type === 'hostel' && { key: 'move', title: 'Move to another bed', sub: 'Their rent changes from the move date if the new room costs more or less.', btn: 'Move', icon: 'swap-horizontal', go: () => setMoveRoomOpen(true) },
                  isActive && { key: 'left', title: 'Mark as left', sub: 'No more fees are added. Their payment history is kept.', btn: 'Mark as left', danger: true, go: handleMarkLeft },
                ].filter(Boolean).map((r, i) => (
                  <View key={r.key} style={[styles.manageRow, i > 0 && { borderTopWidth: 1, borderTopColor: c.borderSubtle, paddingTop: 12 }]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.manageTitle, { color: c.text }]}>{r.title}</Text>
                      <Text style={[styles.manageSub, { color: c.textMuted }]}>{r.sub}</Text>
                    </View>
                    <TouchableOpacity onPress={r.go} style={[styles.small, { borderColor: c.border, backgroundColor: c.card }]}>
                      {r.icon ? <Icon name={r.icon} size={12} color={c.text} /> : null}
                      <Text style={{ fontSize: 13, fontWeight: '500', color: r.danger ? c.danger : c.text }}>{r.btn}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {current === 'payments' && (
          <>
            {isActive && (
              <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={[styles.cardTitle, { color: c.text }]}>Record a payment</Text>
                <View style={styles.chips}>
                  {balance > 0 && (
                    <TouchableOpacity onPress={() => setAmount(String(balance))} style={[styles.chip, { backgroundColor: c.primarySoft, borderColor: c.primaryBorder }]}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: c.primaryDark }}>Full {rupees(balance)}</Text>
                    </TouchableOpacity>
                  )}
                  {[1000, 1500, 2000, 3000, 5000].map((v) => (
                    <TouchableOpacity key={v} onPress={() => setAmount(String(v))} style={[styles.chip, { backgroundColor: c.card, borderColor: c.border }]}>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: c.textSecondary }}>{rupees(v)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.inputLabel, { color: c.textSecondary }]}>Amount (₹)</Text>
                <TextInput value={amount} onChangeText={setAmount} placeholder="e.g. 1500" keyboardType="numeric" placeholderTextColor={c.textMuted}
                  style={[styles.payInput, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]} />
                <Text style={[styles.inputLabel, { color: c.textSecondary, marginTop: 12 }]}>Paid by</Text>
                <View style={styles.modes}>
                  {[['cash', 'Cash'], ['upi', 'UPI'], ['other', 'Bank or card']].map(([m, label]) => {
                    const on = mode === m;
                    return (
                      <TouchableOpacity key={m} onPress={() => setMode(m)} style={[styles.modeBtn, { backgroundColor: on ? c.primarySoft : c.card, borderColor: on ? c.primary : c.border }]}>
                        <Text style={{ fontSize: 13.5, fontWeight: on ? '600' : '500', color: on ? c.primaryDark : c.textSecondary }}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity activeOpacity={0.85} disabled={payLoading || !amount} onPress={handleRecordPayment}
                  style={[styles.save, { backgroundColor: c.primary, opacity: !amount || payLoading ? 0.6 : 1 }]}>
                  {payLoading ? <Spinner size={16} color="#FFFFFF" track="rgba(255, 255, 255, 0.3)" /> : <Icon name="checkmark" size={15} color="#FFFFFF" />}
                  <Text style={styles.saveText}>{payLoading ? 'Saving…' : amount ? `Save ${rupees(Number(amount))} payment` : 'Save payment'}</Text>
                </TouchableOpacity>
                {lastPayment && member.phone && (
                  <View style={[styles.receipt, { backgroundColor: c.successSoft }]}>
                    <Icon name="checkmark-circle" size={15} color={c.moneyGreen} />
                    <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '600', color: c.moneyGreen }}>Saved {rupees(lastPayment.amount)}.</Text>
                    <TouchableOpacity style={styles.receiptBtn} onPress={() => {
                      const msg = `Hi ${member.name}, received ${rupees(lastPayment.amount)} (${(lastPayment.mode || 'cash').toUpperCase()}) on ${formatDate(lastPayment.date)} for ${biz?.name || 'us'}. Thank you!`;
                      Linking.openURL(waLink(member.phone, msg));
                      setLastPayment(null);
                    }}>
                      <Icon name="logo-whatsapp" size={13} color="#FFFFFF" />
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Send receipt</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.cardTitle, { color: c.text }]}>History <Text style={{ fontSize: 13, fontWeight: '500', color: c.textMuted }}>· newest first</Text></Text>
              {ledger.length ? ledgerList(ledger) : <Text style={[styles.empty, { color: c.textMuted }]}>No fees or payments yet. Fees appear here as each cycle is billed.</Text>}
            </View>
          </>
        )}

        {current === 'deposit' && biz?.type === 'hostel' && <DepositNotice key={member._id} member={member} theme={theme} onSaved={fetchMember} />}

        {current === 'attendance' && biz?.attendanceEnabled !== false && (
          <MemberAttendance memberId={member._id} isGym={biz?.type === 'gym'} machineId={member.biometricId} theme={theme} />
        )}
      </ScrollView>

      <EditMemberModal visible={editOpen} member={member} onClose={() => setEditOpen(false)} onSaved={fetchMember} />

      {/* Move Room Modal */}
      {sellOpen && (
        <SellModal
          visible
          biz={biz}
          member={member}
          onClose={() => setSellOpen(false)}
          onSold={() => { fetchMember(); setTab('payments'); }}
          onOpenCatalogue={() => navigation.navigate('Sales')}
        />
      )}

      <MoveRoomModal
        visible={moveRoomOpen}
        member={member}
        biz={biz}
        currentRent={subscription?.amount ?? member.planAmount}
        onClose={() => setMoveRoomOpen(false)}
        onMoved={fetchMember}
      />
    </SafeAreaView>
  );
}

// keep the building, drop the floor: "MF Manjil · Room 04" (same as the web)
const shortLabel = (label) => {
  if (!label) return '';
  const parts = label.split(' · ');
  return parts.length > 2 ? `${parts[0]} · ${parts[parts.length - 1]}` : label;
};


const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

// Hostel: security deposit and notice date. Both show on the tenant's statement link.
function DepositNotice({ member, theme, onSaved }) {
  const [form, setForm] = useState({
    amount: member.deposit?.amount != null ? String(member.deposit.amount) : '',
    refundedAmount: member.deposit?.refundedAmount != null ? String(member.deposit.refundedAmount) : '',
    refundedOn: ymd(member.deposit?.refundedOn),
    noticeGivenOn: ymd(member.noticeGivenOn),
  });
  const [state, setState] = useState(null); // 'saving' | 'saved' | error text
  const set = (k) => (v) => { setForm((f) => ({ ...f, [k]: v })); setState(null); };
  const badDate = (v) => v && !/^\d{4}-\d{2}-\d{2}$/.test(v);

  const save = async () => {
    if (badDate(form.noticeGivenOn) || badDate(form.refundedOn)) {
      setState('Dates must look like 2026-10-22');
      return;
    }
    setState('saving');
    try {
      await api(`/members/${member._id}`, {
        method: 'PATCH',
        body: {
          deposit: {
            amount: form.amount === '' ? undefined : Number(form.amount),
            refundedAmount: form.refundedAmount === '' ? undefined : Number(form.refundedAmount),
            refundedOn: form.refundedOn || undefined,
          },
          noticeGivenOn: form.noticeGivenOn || null,
        },
      });
      setState('saved');
      onSaved?.();
    } catch (err) {
      setState(err.message || 'Could not save');
    }
  };

  const field = (label, icon, k, opts) => (
    <View style={styles.depositField}>
      <View style={styles.metaLabelRow}>
        <Icon name={icon} size={13} color={theme.colors.textMuted} />
        <Text style={[styles.depositLabel, { color: theme.colors.text }]} numberOfLines={1}>{label}</Text>
      </View>
      <TextInput
        value={form[k]}
        onChangeText={set(k)}
        placeholderTextColor={theme.colors.textSubtle}
        style={[styles.depositInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
        {...opts}
      />
    </View>
  );
  const money = { keyboardType: 'decimal-pad' };
  const date = { placeholder: 'YYYY-MM-DD', maxLength: 10 };

  return (
    <View style={[styles.ledgerCard, tinted(theme, theme.colors.primary, 0.6)]}>
      <View style={styles.cardHead}>
        <Icon name="business-outline" size={18} color={theme.colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardHeadTitle, { color: theme.colors.text }]}>Deposit & Notice</Text>
          <Text style={[styles.cardHeadSub, { color: theme.colors.textSecondary }]}>
            Shown on the tenant's statement link, so both sides see the same record
          </Text>
        </View>
      </View>
      <View style={styles.depositGrid}>
        {field('Deposit held (₹)', 'cash-outline', 'amount', money)}
        {field('Notice given on', 'calendar-outline', 'noticeGivenOn', date)}
        {field('Deposit refunded (₹)', 'cash-outline', 'refundedAmount', money)}
        {field('Refunded on', 'calendar-outline', 'refundedOn', date)}
      </View>
      <View style={styles.depositFoot}>
        {state === 'saved' ? <Text style={{ color: theme.colors.successDark, fontSize: 12.5 }}>Saved</Text> : null}
        {state && state !== 'saved' && state !== 'saving' ? (
          <Text style={{ color: theme.colors.danger, fontSize: 12.5, flexShrink: 1 }}>{state}</Text>
        ) : null}
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={state === 'saving'}
          onPress={save}
          style={[styles.depositSave, { backgroundColor: theme.colors.primary, opacity: state === 'saving' ? 0.6 : 1 }]}>
          <Text style={styles.depositSaveText}>{state === 'saving' ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Last 30 days as a strip of dots: present, absent or not marked
function MemberAttendance({ memberId, isGym, machineId, theme }) {
  const [att, setAtt] = useState(null);
  useEffect(() => {
    api(`/members/${memberId}/attendance`).then(setAtt).catch(() => setAtt(null));
  }, [memberId]);
  if (!att) return null;

  const byDay = new Map(att.records.map((r) => [r.day, r.status]));
  const days = [];
  for (let d = new Date(`${att.from}T00:00:00Z`); d.toISOString().slice(0, 10) <= att.to; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  const fmt = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const dotColor = { present: '#10B981', absent: '#EF4444' };
  const blank = theme.colors.border;
  const presentLabel = isGym ? 'Came in' : 'Present';

  return (
    <View style={[styles.ledgerCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={styles.cardHead}>
        <Icon name="calendar-outline" size={18} color={theme.colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardHeadTitle, { color: theme.colors.text }]}>Attendance · last 30 days</Text>
          <Text style={[styles.cardHeadSub, { color: theme.colors.textSecondary }]}>
            {isGym ? `${att.present} visit${att.present === 1 ? '' : 's'}` : `Present ${att.present} · Absent ${att.absent}`}
            {att.lastPresent ? ` · last ${isGym ? 'visit' : 'present'} ${fmt(att.lastPresent)}` : ' · no attendance yet'}
            {machineId ? ` · machine ID ${machineId}` : ''}
          </Text>
        </View>
      </View>
      <View style={styles.attStrip}>
        {days.map((day) => (
          <View key={day} style={[styles.attDot, { backgroundColor: dotColor[byDay.get(day)] || blank }]} />
        ))}
      </View>
      <View style={styles.attLegend}>
        <Text style={[styles.attLegendText, { color: theme.colors.textMuted }]}>{fmt(att.from)}</Text>
        <View style={styles.attLegendKeys}>
          <View style={[styles.attKey, { backgroundColor: dotColor.present }]} />
          <Text style={[styles.attLegendText, { color: theme.colors.textMuted }]}>{presentLabel}</Text>
          <View style={[styles.attKey, { backgroundColor: dotColor.absent }]} />
          <Text style={[styles.attLegendText, { color: theme.colors.textMuted }]}>Absent</Text>
          <View style={[styles.attKey, { backgroundColor: blank }]} />
          <Text style={[styles.attLegendText, { color: theme.colors.textMuted }]}>Not marked</Text>
        </View>
        <Text style={[styles.attLegendText, { color: theme.colors.textMuted }]}>Today</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14, gap: 14 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 22, fontWeight: '800', letterSpacing: -0.2, flexShrink: 1 },
  badge: { paddingHorizontal: 8, height: 20, borderRadius: 99, justifyContent: 'center' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  whoSub: { fontSize: 14, marginTop: 3 },
  balance: { borderTopWidth: 1, paddingTop: 12, gap: 2 },
  balanceLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  balanceBig: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  balanceSub: { fontSize: 12.5 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  act: { flexBasis: '48%', flexGrow: 1, minHeight: 40, borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12 },
  actText: { fontSize: 14, fontWeight: '600' },
  tabs: { flexGrow: 0, borderBottomWidth: 1, marginBottom: 16 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 12, borderBottomWidth: 2, marginBottom: -1 },
  tabCount: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 14 },
  cardHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  link: { fontSize: 13, fontWeight: '600' },
  empty: { textAlign: 'center', paddingVertical: 20, fontSize: 14 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20 },
  fact: { width: '46%', flexGrow: 1, paddingBottom: 10 },
  factKey: { fontSize: 12 },
  factVal: { fontSize: 14.5, fontWeight: '600', marginTop: 2 },
  lrow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 10 },
  licon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  lwhat: { fontSize: 14, fontWeight: '600' },
  lsub: { fontSize: 12 },
  lamt: { fontSize: 14.5, fontWeight: '700' },
  ltrash: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  manageRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingBottom: 12 },
  manageTitle: { fontSize: 14, fontWeight: '600' },
  manageSub: { fontSize: 13, marginTop: 1, lineHeight: 18 },
  small: { minHeight: 36, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modes: { flexDirection: 'row', gap: 6 },
  modeBtn: { flex: 1, height: 42, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  save: { height: 44, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 },
  saveText: { color: '#fff', fontSize: 14.5, fontWeight: '600' },
  receipt: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 10, borderRadius: 10 },
  receiptBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#10B981', height: 34, paddingHorizontal: 10, borderRadius: 8 },
  lateLine: { fontSize: 12.5, fontWeight: '600', marginTop: 8 },
  tabBar: { gap: 6, paddingVertical: 2, marginBottom: 12 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1 },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 40,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  topIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyBox: {
    marginTop: 12,
    gap: 6,
  },
  historyTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  historyRow: {
    flexDirection: 'row',
    gap: 6,
  },
  historyText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  backPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  profileCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeText: {
    color: '#8B5CF6',
    fontSize: 20,
    fontWeight: '800',
  },
  profileName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  profileId: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  balanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  balanceBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  metaItem: {
    flexGrow: 1,
    flexBasis: '46%',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  metaSpacer: {
    flexGrow: 1,
    flexBasis: '46%',
    height: 0,
  },
  metaLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  metaValueLink: {
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  actionToolbar: {
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  btnWhatsapp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#10B981',
    height: 38,
    borderRadius: 8,
  },
  btnWhatsappText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnOutlineAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  btnOutlineActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  resetLink: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  resetLinkText: {
    fontSize: 12.5,
    textDecorationLine: 'underline',
  },
  depositGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  depositField: {
    flexGrow: 1,
    flexBasis: '46%',
  },
  depositLabel: {
    fontSize: 12.5,
    fontWeight: '500',
    flexShrink: 1,
  },
  depositInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  depositFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  depositSave: {
    height: 38,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  attStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  attDot: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  attLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  attLegendKeys: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  attKey: {
    width: 9,
    height: 9,
    borderRadius: 3,
    marginLeft: 4,
  },
  attLegendText: {
    fontSize: 11.5,
  },
  recordPayCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardHeadIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeadTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardHeadSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  quickChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  quickChipsLabel: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  quickChipsScroll: {
    gap: 6,
  },
  quickChip: {
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  quickChipText: {
    fontSize: 11.5,
  },
  payFormRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 4,
  },
  payInput: {
    borderWidth: 1,
    borderRadius: 8,
    height: 38,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  modePills: {
    flexDirection: 'row',
    gap: 4,
  },
  modePill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  modePillText: {
    fontSize: 11,
  },
  btnRecordPayment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnRecordPaymentText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  receiptBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  receiptText: {
    fontSize: 12,
    flex: 1,
  },
  btnSendReceipt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B981',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  btnSendReceiptText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  ledgerCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  timelineList: {
    gap: 8,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  ledgerIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledgerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  ledgerSub: {
    fontSize: 11,
    marginTop: 1,
  },
  ledgerAmount: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  ledgerBalance: {
    fontSize: 10.5,
    marginTop: 1,
  },
  btnTrash: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptyLedger: {
    paddingVertical: 14,
    alignItems: 'center',
  },
});
