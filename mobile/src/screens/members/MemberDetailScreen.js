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
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useBiz } from '../../context/BizContext';
import { useTheme } from '../../context/ThemeContext';
import { api, rupees, formatDate, waLink, remindMsg, receiptMsg } from '../../api/api';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Icon from '../../components/Icon';

// Modals
import RecordPaymentModal from '../modals/RecordPaymentModal';
import SendReminderModal from '../modals/SendReminderModal';

export default function MemberDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { biz, isOwner } = useBiz();
  const { theme } = useTheme();

  const [data, setData] = useState(null);
  const [shareToken, setShareToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [sendReminderOpen, setSendReminderOpen] = useState(false);

  const fetchMember = useCallback(async () => {
    if (!id) return;
    try {
      const [res, share] = await Promise.all([
        api(`/members/${id}`),
        api(`/members/${id}/share`, { method: 'POST' }),
      ]);
      setData(res);
      setShareToken(share?.token || null);
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

  if (loading || !data) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerBox}>
          <Text style={{ color: theme.colors.textSecondary }}>Loading member profile…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { member, dues = [], payments = [], balance = 0, subscription } = data;
  const isOwing = balance > 0;
  const isPaused = subscription?.status === 'paused';
  const isLeft = member.status === 'left';

  // Build Chronological Ledger with running balance
  const ledgerRows = [
    ...dues.map((d) => ({
      kind: 'due',
      id: String(d._id),
      date: d.dueDate,
      amount: d.amount,
      periodEnd: d.periodEnd,
    })),
    ...payments.map((p) => ({
      kind: 'payment',
      id: String(p._id),
      date: p.date,
      amount: p.amount,
      mode: p.mode,
      note: p.note,
    })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date) || (a.kind === 'due' ? -1 : 1));

  let running = 0;
  for (const r of ledgerRows) {
    r.balance = running += r.kind === 'due' ? r.amount : -r.amount;
  }
  const reversedLedger = [...ledgerRows].reverse();

  // Actions
  const handlePauseResume = async () => {
    const action = isPaused ? 'resume' : 'pause';
    const confirmTitle = isPaused ? 'Resume Membership?' : 'Pause Membership?';
    const confirmDesc = isPaused
      ? 'Resuming will extend the subscription period by the paused duration.'
      : 'Pausing will freeze renewals while the member is away.';

    Alert.alert(confirmTitle, confirmDesc, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: isPaused ? 'Resume' : 'Pause',
        style: isPaused ? 'default' : 'destructive',
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
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const handleRotateShare = async () => {
    Alert.alert(
      'Rotate Statement Link?',
      'The current public statement link will stop working, and a new secure token will be generated.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rotate Link',
          onPress: async () => {
            try {
              const res = await api(`/members/${id}/share`, { method: 'POST', body: { rotate: true } });
              setShareToken(res.token);
              Alert.alert('Rotated', 'New statement link has been created.');
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const handleCopyStatementLink = async () => {
    if (!shareToken) return;
    const url = `https://app.example.com/s/${shareToken}`;
    await Clipboard.setStringAsync(url);
    Alert.alert('Copied', 'Statement link copied to clipboard!');
  };

  const handleDeletePayment = (paymentId) => {
    if (!isOwner) {
      Alert.alert('Permission Denied', 'Only the workspace owner can delete or reverse recorded payments.');
      return;
    }
    Alert.alert(
      'Reverse Payment?',
      'This payment will be permanently deleted and the member dues/balance will be automatically recomputed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Payment',
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

  const handleDeleteMember = () => {
    Alert.alert(
      'Delete Member?',
      'This will permanently delete this member and all associated dues, payments, and subscriptions.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* Top Header */}
      <View style={[styles.navHeader, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: theme.colors.text }]} numberOfLines={1}>
          {member.name}
        </Text>
        <TouchableOpacity onPress={handleDeleteMember} style={styles.deleteBtn}>
          <Icon name="trash-outline" size={19} color={theme.colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }>
        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View
              style={[
                styles.profileAvatar,
                {
                  backgroundColor: isLeft
                    ? theme.colors.cardSubtle
                    : isOwing
                    ? '#FEE2E2'
                    : '#D1FAE5',
                },
              ]}>
              <Text
                style={[
                  styles.profileAvatarText,
                  {
                    color: isLeft
                      ? theme.colors.textMuted
                      : isOwing
                      ? '#991B1B'
                      : '#065F46',
                  },
                ]}>
                {(member.name || 'M')[0].toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.profileName, { color: theme.colors.text }]}>
                  {member.name}
                </Text>
                {isLeft && <Badge label="Left" variant="gray" size="sm" />}
                {isPaused && <Badge label="Paused" variant="warning" size="sm" />}
              </View>

              <Text style={[styles.profilePhone, { color: theme.colors.textSecondary }]}>
                {member.phone || 'No phone recorded'}
              </Text>
              <Text style={[styles.profileJoined, { color: theme.colors.textMuted }]}>
                Joined: {formatDate(member.joinDate || member.createdAt)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Balance & Quick Actions Banner */}
        <Card
          style={[
            styles.balanceCard,
            {
              backgroundColor: isOwing ? theme.colors.dangerSoft : theme.colors.primaryLight,
              borderColor: isOwing ? '#FECACA' : '#A7F3D0',
            },
          ]}>
          <View style={styles.balanceRow}>
            <View>
              <Text
                style={[
                  styles.balanceLabel,
                  { color: isOwing ? theme.colors.dangerDark : theme.colors.primaryDark },
                ]}>
                {isOwing ? 'PENDING BALANCE' : balance < 0 ? 'PAID IN ADVANCE' : 'ALL PAID UP'}
              </Text>
              <Text
                style={[
                  styles.balanceAmount,
                  { color: isOwing ? theme.colors.dangerDark : theme.colors.primaryDark },
                ]}>
                {isOwing ? rupees(balance) : balance < 0 ? rupees(-balance) : '₹0'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              {isOwing && (
                <Button
                  title="Remind"
                  variant="whatsapp"
                  size="sm"
                  icon={<Icon name="logo-whatsapp" size={14} color="#FFFFFF" />}
                  onPress={() => setSendReminderOpen(true)}
                />
              )}
              <Button
                title="Collect"
                variant="primary"
                size="sm"
                icon={<Icon name="cash-outline" size={14} color="#FFFFFF" />}
                onPress={() => setRecordPaymentOpen(true)}
              />
            </View>
          </View>
        </Card>

        {/* Subscription & Plan Card */}
        {subscription?.planId ? (
          <Card style={styles.subCard}>
            <View style={styles.subCardHeader}>
              <View>
                <Text style={[styles.subCardTitle, { color: theme.colors.text }]}>
                  {subscription.planId.name}
                </Text>
                <Text style={[styles.subCardPrice, { color: theme.colors.primary }]}>
                  {rupees(subscription.planId.amount)} · {subscription.planId.cycleDays} days recurring
                </Text>
              </View>
              <Badge
                label={subscription.status.toUpperCase()}
                variant={isPaused ? 'warning' : 'success'}
              />
            </View>

            <View style={[styles.subPeriodBox, { backgroundColor: theme.colors.cardSubtle }]}>
              <View style={styles.periodCol}>
                <Text style={[styles.periodColLabel, { color: theme.colors.textMuted }]}>
                  CURRENT PERIOD START
                </Text>
                <Text style={[styles.periodColVal, { color: theme.colors.text }]}>
                  {formatDate(subscription.periodStart)}
                </Text>
              </View>
              <View style={styles.periodCol}>
                <Text style={[styles.periodColLabel, { color: theme.colors.textMuted }]}>
                  PERIOD END / RENEWAL
                </Text>
                <Text style={[styles.periodColVal, { color: theme.colors.text }]}>
                  {formatDate(subscription.periodEnd)}
                </Text>
              </View>
            </View>

            <View style={styles.subActionRow}>
              <Button
                title={isPaused ? 'Resume Plan' : 'Pause Plan'}
                variant="outline"
                size="sm"
                icon={<Icon name={isPaused ? 'play' : 'pause'} size={14} color={theme.colors.text} />}
                onPress={handlePauseResume}
              />
              {!isLeft && (
                <Button
                  title="Mark as Left"
                  variant="outline"
                  size="sm"
                  textStyle={{ color: theme.colors.danger }}
                  onPress={handleMarkLeft}
                />
              )}
            </View>
          </Card>
        ) : null}

        {/* Public Statement Link Sharing */}
        <Card style={styles.statementCard}>
          <View style={styles.statementHead}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statementTitle, { color: theme.colors.text }]}>
                Verified Member Statement Link
              </Text>
              <Text style={[styles.statementSub, { color: theme.colors.textSecondary }]}>
                Zero-friction web link. Member can check live ledger and pay via direct UPI without app or login.
              </Text>
            </View>
            <Icon name="link-outline" size={24} color={theme.colors.primary} />
          </View>

          <View style={styles.statementBtnRow}>
            <Button
              title="Copy Link"
              variant="outline"
              size="sm"
              icon={<Icon name="copy-outline" size={14} color={theme.colors.text} />}
              onPress={handleCopyStatementLink}
            />
            <Button
              title="View Statement"
              variant="secondary"
              size="sm"
              icon={<Icon name="eye-outline" size={14} color={theme.colors.text} />}
              onPress={() => navigation.navigate('Statement', { token: shareToken })}
            />
            <Button
              title="Rotate Link"
              variant="ghost"
              size="sm"
              textStyle={{ fontSize: 11.5 }}
              onPress={handleRotateShare}
            />
          </View>
        </Card>

        {/* Financial Ledger Section */}
        <View style={styles.ledgerHeaderRow}>
          <Text style={[styles.ledgerTitle, { color: theme.colors.text }]}>Financial Ledger</Text>
          <Text style={[styles.ledgerSub, { color: theme.colors.textSecondary }]}>
            {reversedLedger.length} total entries (Oldest first balance calculation)
          </Text>
        </View>

        <Card style={styles.ledgerCard}>
          {reversedLedger.map((row) => {
            const isDue = row.kind === 'due';
            return (
              <View
                key={row.id}
                style={[
                  styles.ledgerRow,
                  { borderBottomColor: theme.colors.borderSubtle },
                ]}>
                <View style={styles.ledgerRowLeft}>
                  <View
                    style={[
                      styles.ledgerIconWrap,
                      { backgroundColor: isDue ? theme.colors.dangerSoft : theme.colors.primaryLight },
                    ]}>
                    <Icon
                      name={isDue ? 'document-text-outline' : 'checkmark-done'}
                      size={15}
                      color={isDue ? theme.colors.danger : theme.colors.primaryDark}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.ledgerRowTitle, { color: theme.colors.text }]}>
                      {isDue
                        ? `Membership Fee`
                        : `Payment Received (${(row.mode || 'cash').toUpperCase()})`}
                    </Text>
                    <Text style={[styles.ledgerRowDate, { color: theme.colors.textMuted }]}>
                      {formatDate(row.date)} {row.note ? `· ${row.note}` : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.ledgerRowRight}>
                  <Text
                    style={[
                      styles.ledgerRowAmount,
                      { color: isDue ? theme.colors.danger : theme.colors.primary },
                    ]}>
                    {isDue ? `+${rupees(row.amount)}` : `−${rupees(row.amount)}`}
                  </Text>
                  <Text style={[styles.ledgerRowBalance, { color: theme.colors.textSecondary }]}>
                    Bal: {rupees(row.balance)}
                  </Text>
                </View>

                {/* Owner reverse payment action */}
                {!isDue && isOwner && (
                  <TouchableOpacity
                    onPress={() => handleDeletePayment(row.id)}
                    style={styles.reversePaymentBtn}>
                    <Icon name="close" size={14} color={theme.colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          {reversedLedger.length === 0 && (
            <Text style={[styles.emptyLedgerText, { color: theme.colors.textMuted }]}>
              No dues or payments recorded yet.
            </Text>
          )}
        </Card>
      </ScrollView>

      {/* Modals */}
      <RecordPaymentModal
        visible={recordPaymentOpen}
        member={member}
        biz={biz}
        onClose={() => setRecordPaymentOpen(false)}
        onPaymentRecorded={fetchMember}
      />

      <SendReminderModal
        visible={sendReminderOpen}
        member={member}
        biz={biz}
        onClose={() => setSendReminderOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    paddingRight: 12,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
  },
  deleteBtn: {
    padding: 6,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    padding: 14,
    marginBottom: 10,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
  },
  profilePhone: {
    fontSize: 13,
    marginTop: 2,
  },
  profileJoined: {
    fontSize: 11.5,
    marginTop: 2,
  },
  balanceCard: {
    padding: 14,
    marginBottom: 10,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  balanceAmount: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  subCard: {
    padding: 14,
    marginBottom: 10,
  },
  subCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  subCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  subCardPrice: {
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  subPeriodBox: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  periodCol: {
    flex: 1,
  },
  periodColLabel: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  periodColVal: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  subActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statementCard: {
    padding: 14,
    marginBottom: 14,
  },
  statementHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statementTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  statementSub: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  statementBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ledgerHeaderRow: {
    marginTop: 6,
    marginBottom: 8,
  },
  ledgerTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  ledgerSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  ledgerCard: {
    padding: 10,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  ledgerRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  ledgerIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ledgerRowTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  ledgerRowDate: {
    fontSize: 11,
    marginTop: 2,
  },
  ledgerRowRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  ledgerRowAmount: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  ledgerRowBalance: {
    fontSize: 10.5,
    marginTop: 1,
  },
  reversePaymentBtn: {
    padding: 6,
    marginLeft: 6,
  },
  emptyLedgerText: {
    textAlign: 'center',
    paddingVertical: 16,
    fontSize: 12.5,
  },
});

