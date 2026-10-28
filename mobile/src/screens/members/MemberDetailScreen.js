import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import TopBar from '../../components/TopBar';
import Avatar from '../../components/Avatar';
import { tint, tinted } from '../../constants/theme';

// Modals
import MoveRoomModal from '../modals/MoveRoomModal';
import EditMemberModal from '../modals/EditMemberModal';

export default function MemberDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { biz, isOwner } = useBiz();
  const { theme, isDark } = useTheme();

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
          <Text style={{ color: theme.colors.textSecondary }}>Loading member profile…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { member, dues = [], payments = [], balance = 0, subscription } = data;
  const isOwing = balance > 0;
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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* TopBar */}
      <TopBar navigation={navigation} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }>
        {/* Back to the list, same pill as the web; edit and delete on the right */}
        <View style={styles.topRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          style={[styles.backPill, { backgroundColor: tint(theme.colors.primary, 0.08, theme.colors.card), borderColor: tint(theme.colors.primary, 0.35, theme.colors.card) }]}>
          <Icon name="chevron-back" size={13} color={theme.colors.primary} />
          <Text style={[styles.backPillText, { color: theme.colors.primary }]}>Members</Text>
        </TouchableOpacity>
          <View style={styles.topIcons}>
            <TouchableOpacity
              accessibilityLabel="Edit member"
              activeOpacity={0.7}
              onPress={() => setEditOpen(true)}
              style={[styles.iconBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
              <Icon name="create-outline" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Delete member"
              activeOpacity={0.7}
              onPress={handleDelete}
              style={[styles.iconBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
              <Icon name="trash-outline" size={16} color={theme.colors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Member Profile Card */}
        <View style={[styles.profileCard, tinted(theme, theme.colors.primary, 0.6)]}>
          <View style={styles.profileTopRow}>
            <Avatar name={member.name} size={34} />
            <Text style={[styles.profileName, { color: theme.colors.text }]} numberOfLines={1}>{member.name}</Text>

            <View style={[styles.balanceBadge, { backgroundColor: balance > 0 ? theme.colors.dangerSoft : theme.colors.successSoft }]}>
              <View style={[styles.badgeDot, { backgroundColor: balance > 0 ? '#EF4444' : '#10B981' }]} />
              <Text style={[styles.balanceBadgeText, { color: balance > 0 ? theme.colors.danger : theme.colors.successDark }]}>
                {balance > 0
                  ? `Unpaid ${rupees(balance)}`
                  : balance < 0
                  ? `Advance ${rupees(-balance)}`
                  : 'Paid Up'}
              </Text>
            </View>
          </View>

          {/* Details, each box in its own colour like the web */}
          <View style={styles.metaGrid}>
            <MetaBox theme={theme} color="#10B981" icon="call-outline" label="Mobile Phone">
              {member.phone ? (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${member.phone}`)}>
                  <Text style={[styles.metaValue, { color: theme.colors.primary }]}>{member.phone}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={[styles.metaValue, { color: theme.colors.textMuted }]}>Not added</Text>
              )}
            </MetaBox>

            <MetaBox theme={theme} color="#3B82F6" icon="card-outline" label="Current Plan">
              <Text style={[styles.metaValue, { color: theme.colors.text }]}>
                {subscription?.planId
                  ? `${subscription.planId.name} (${rupees(subscription.amount ?? subscription.planId.amount)}${subscription.amount ? ', custom' : ''})`
                  : 'No plan'}
              </Text>
            </MetaBox>

            <MetaBox theme={theme} color="#8B5CF6" icon="cash-outline" label="Total Paid">
              <Text style={[styles.metaValue, { color: theme.colors.text }]}>{rupees(totalPaid)}</Text>
            </MetaBox>

            <MetaBox theme={theme} color="#F59E0B" icon="calendar-outline" label="Joined On">
              <Text style={[styles.metaValue, { color: theme.colors.text }]}>
                {member.joinDate ? formatDate(member.joinDate) : '—'}
              </Text>
            </MetaBox>

            {subscription?.periodEnd ? (
              <MetaBox theme={theme} color="#EC4899" icon="time-outline" label={isPaused ? 'Paused' : 'Next Due Date'}>
                <Text style={[styles.metaValue, { color: theme.colors.text }]}>
                  {isPaused ? 'Renewals on hold' : formatDate(subscription.periodEnd)}
                </Text>
              </MetaBox>
            ) : null}
            {/* keeps an odd last box half width */}
            <View style={styles.metaSpacer} />
          </View>

          {member.roomMoves?.length > 0 && (
            <View style={styles.historyBox}>
              <Text style={[styles.historyTitle, { color: theme.colors.textMuted }]}>ROOM HISTORY</Text>
              {[...member.roomMoves].reverse().map((mv, i) => (
                <View key={i} style={styles.historyRow}>
                  <Icon name="bed-outline" size={13} color={theme.colors.primary} style={{ marginTop: 2 }} />
                  <Text style={[styles.historyText, { color: theme.colors.text }]}>
                    <Text style={{ fontWeight: '700' }}>{shortLabel(mv.fromLabel) || 'No room'} → {shortLabel(mv.toLabel)}</Text>
                    <Text style={{ color: theme.colors.textMuted }}> on {formatDate(mv.on)}</Text>
                    {mv.rentBefore != null && mv.rentAfter != null && mv.rentBefore !== mv.rentAfter ? (
                      <Text style={{ color: theme.colors.textMuted }}> · rent {rupees(mv.rentBefore)} → {rupees(mv.rentAfter)}</Text>
                    ) : null}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Actions */}
          <View style={[styles.actionToolbar, { borderTopColor: theme.colors.border }]}>
            {member.phone && balance > 0 && (
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.btnWhatsapp}
                onPress={() => {
                  const msg = remindMsg(biz, member, balance, statementUrl);
                  Linking.openURL(waLink(member.phone, msg));
                }}>
                <Icon name="logo-whatsapp" size={15} color="#FFFFFF" />
                <Text style={styles.btnWhatsappText}>Send WhatsApp Reminder</Text>
              </TouchableOpacity>
            )}

            {statementUrl && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.btnOutlineAction, { flex: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                  onPress={handleShareStatement}>
                  <Icon name="link-outline" size={14} color={theme.colors.text} />
                  <Text style={[styles.btnOutlineActionText, { color: theme.colors.text }]}>Share Statement</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} onPress={handleResetLink} style={styles.resetLink}>
                  <Text style={[styles.resetLinkText, { color: theme.colors.textMuted }]}>Reset link</Text>
                </TouchableOpacity>
              </View>
            )}

            {member.status === 'active' && (
              <View style={styles.actionRow}>
                {biz?.type === 'hostel' && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.btnOutlineAction, { flex: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                    onPress={() => setMoveRoomOpen(true)}>
                    <Icon name="swap-horizontal" size={14} color={theme.colors.text} />
                    <Text style={[styles.btnOutlineActionText, { color: theme.colors.text }]}>Move</Text>
                  </TouchableOpacity>
                )}
                {subscription && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.btnOutlineAction, { flex: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                    onPress={handlePauseResume}>
                    <Icon name={isPaused ? 'play' : 'pause'} size={13} color={theme.colors.text} />
                    <Text style={[styles.btnOutlineActionText, { color: theme.colors.text }]}>
                      {isPaused ? 'Resume' : 'Pause'}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.btnOutlineAction, { flex: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                  onPress={handleMarkLeft}>
                  <Text style={[styles.btnOutlineActionText, { color: theme.colors.danger }]}>Mark as Left</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Record Payment Card */}
        {member.status === 'active' && (
          <View style={[styles.recordPayCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.cardHead}>
              <View style={[styles.cardHeadIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.14)' }]}>
                <Icon name="cash-outline" size={16} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardHeadTitle, { color: theme.colors.text }]}>
                  Record Payment Received
                </Text>
                <Text style={[styles.cardHeadSub, { color: theme.colors.textSecondary }]}>
                  Record a payment received in cash, UPI or card
                </Text>
              </View>
            </View>

            {/* Quick Fill Chips */}
            <View style={styles.quickChipsRow}>
              <Text style={[styles.quickChipsLabel, { color: theme.colors.textSecondary }]}>Quick fill:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickChipsScroll}>
                {balance > 0 && (
                  <TouchableOpacity
                    onPress={() => setAmount(String(balance))}
                    style={[styles.quickChip, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary }]}>
                    <Text style={[styles.quickChipText, { color: theme.colors.primaryDark, fontWeight: '700' }]}>
                      Clear {rupees(balance)}
                    </Text>
                  </TouchableOpacity>
                )}
                {[1000, 1500, 2000, 2500, 3000, 5000].map((amtVal) => (
                  <TouchableOpacity
                    key={amtVal}
                    onPress={() => setAmount(String(amtVal))}
                    style={[styles.quickChip, { backgroundColor: theme.colors.cardSubtle, borderColor: theme.colors.border }]}>
                    <Text style={[styles.quickChipText, { color: theme.colors.text }]}>
                      +{rupees(amtVal)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Form Inputs */}
            <View style={styles.payFormRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Amount (₹) *</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="e.g. 1500"
                  keyboardType="numeric"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[styles.payInput, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.inputBorder, color: theme.colors.text }]}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Payment Mode *</Text>
                <View style={styles.modePills}>
                  {['cash', 'upi', 'other'].map((m) => {
                    const active = mode === m;
                    const label = m === 'cash' ? '💵 Cash' : m === 'upi' ? '⚡ UPI' : '🏦 Card';
                    return (
                      <TouchableOpacity
                        key={m}
                        onPress={() => setMode(m)}
                        style={[
                          styles.modePill,
                          {
                            backgroundColor: active ? theme.colors.primarySoft : theme.colors.cardSubtle,
                            borderColor: active ? theme.colors.primary : theme.colors.border,
                          },
                        ]}>
                        <Text style={[styles.modePillText, { color: active ? theme.colors.primaryDark : theme.colors.textSecondary, fontWeight: active ? '700' : '500' }]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={payLoading || !amount}
              style={[
                styles.btnRecordPayment,
                { backgroundColor: theme.colors.primary, opacity: !amount || payLoading ? 0.6 : 1 },
              ]}
              onPress={handleRecordPayment}>
              <Icon name="checkmark-sharp" size={15} color="#FFFFFF" />
              <Text style={styles.btnRecordPaymentText}>
                {payLoading ? 'Recording Payment…' : 'Record Payment'}
              </Text>
            </TouchableOpacity>

            {lastPayment && member.phone && (
              <View style={[styles.receiptBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: '#10B981' }]}>
                <Icon name="checkmark-circle" size={16} color="#10B981" />
                <Text style={[styles.receiptText, { color: theme.colors.text }]}>
                  Recorded {rupees(lastPayment.amount)}.
                </Text>
                <TouchableOpacity
                  style={styles.btnSendReceipt}
                  onPress={() => {
                    const msg = `Hi ${member.name}, received ${rupees(lastPayment.amount)} (${(lastPayment.mode || 'cash').toUpperCase()}) on ${formatDate(lastPayment.date)} for ${biz?.name || 'us'}. Thank you!`;
                    Linking.openURL(waLink(member.phone, msg));
                    setLastPayment(null);
                  }}>
                  <Icon name="logo-whatsapp" size={13} color="#FFFFFF" />
                  <Text style={styles.btnSendReceiptText}>Send Receipt</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {biz?.type === 'hostel' && <DepositNotice key={member._id} member={member} theme={theme} onSaved={fetchMember} />}

        {biz?.attendanceEnabled !== false && (
          <MemberAttendance memberId={member._id} isGym={biz?.type === 'gym'} machineId={member.biometricId} theme={theme} />
        )}

        {/* Transaction Ledger Timeline */}
        <View style={[styles.ledgerCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.cardHead}>
            <View style={[styles.cardHeadIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.14)' }]}>
              <Icon name="time-outline" size={16} color="#3B82F6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardHeadTitle, { color: theme.colors.text }]}>
                Transaction Ledger ({ledger.length})
              </Text>
              <Text style={[styles.cardHeadSub, { color: theme.colors.textSecondary }]}>
                Chronological timeline of billed subscription cycles and payments
              </Text>
            </View>
          </View>

          <View style={styles.timelineList}>
            {ledger.map((item) => {
              const isPayment = item.kind === 'payment';
              return (
                <View
                  key={item._id}
                  style={[
                    styles.ledgerRow,
                    { backgroundColor: theme.colors.cardSubtle, borderColor: theme.colors.border },
                  ]}>
                  {/* Icon */}
                  <View
                    style={[
                      styles.ledgerIconWrap,
                      {
                        backgroundColor: isPayment
                          ? 'rgba(16, 185, 129, 0.14)'
                          : 'rgba(239, 68, 68, 0.14)',
                      },
                    ]}>
                    <Icon
                      name={isPayment ? 'arrow-down' : 'card-outline'}
                      size={15}
                      color={isPayment ? '#10B981' : '#EF4444'}
                    />
                  </View>

                  {/* Title & Date */}
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.ledgerTitle, { color: theme.colors.text }]}>
                      {isPayment ? 'Payment Received' : 'Fee Due'}
                    </Text>
                    <Text style={[styles.ledgerSub, { color: theme.colors.textSecondary }]}>
                      {formatDate(item.when)}
                      {item.mode ? ` · Mode: ${item.mode.toUpperCase()}` : ''}
                    </Text>
                  </View>

                  {/* Amount & Running Balance */}
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={[
                        styles.ledgerAmount,
                        { color: isPayment ? '#10B981' : '#EF4444' },
                      ]}>
                      {isPayment ? '+' : '-'}{rupees(item.amount)}
                    </Text>
                    <Text style={[styles.ledgerBalance, { color: theme.colors.textSecondary }]}>
                      Bal {rupees(item.balanceAfter)}
                    </Text>
                  </View>

                  {/* Reverse Payment Button (Owner only) */}
                  {isOwner && isPayment && (
                    <TouchableOpacity
                      onPress={() => handleReversePayment(item._id, item.amount)}
                      style={[styles.btnTrash, { borderColor: theme.colors.border }]}>
                      <Icon name="trash-outline" size={13} color={theme.colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            {ledger.length === 0 && (
              <View style={styles.emptyLedger}>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                  No transaction ledger entries recorded yet.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <EditMemberModal visible={editOpen} member={member} onClose={() => setEditOpen(false)} onSaved={fetchMember} />

      {/* Move Room Modal */}
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

// One coloured detail box (phone, plan, paid...)
function MetaBox({ theme, color, icon, label, children }) {
  return (
    <View style={[styles.metaItem, tinted(theme, color, 1.6)]}>
      <View style={styles.metaLabelRow}>
        <Icon name={icon} size={13} color={color} />
        <Text style={[styles.metaLabel, { color: theme.colors.textMuted }]}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

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
