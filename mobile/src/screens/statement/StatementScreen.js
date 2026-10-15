import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  SafeAreaView,
  Alert,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../../context/ThemeContext';
import { rupees, formatDate, getApiBaseUrl } from '../../api/api';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Icon from '../../components/Icon';

export default function StatementScreen({ route, navigation }) {
  const { token } = route.params || {};
  const { theme } = useTheme();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      if (!token) {
        setError('Statement token missing');
        setLoading(false);
        return;
      }
      try {
        const baseUrl = await getApiBaseUrl();
        const res = await fetch(`${baseUrl}/public/statement/${token}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Could not load statement');
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerBox}>
          <Text style={{ color: theme.colors.textSecondary }}>Loading statement…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerBox}>
          <Icon name="alert-circle-outline" size={48} color={theme.colors.danger} />
          <Text style={[styles.errTitle, { color: theme.colors.text }]}>Statement Unavailable</Text>
          <Text style={[styles.errSub, { color: theme.colors.textSecondary }]}>
            {error || 'This statement link is invalid or has been revoked.'}
          </Text>
          <Button
            title="Go Back"
            variant="outline"
            style={{ marginTop: 16 }}
            onPress={() => navigation.goBack()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const { business, member, ledger = [], balance = 0, generatedAt } = data;
  const isOwing = balance > 0;
  const upiLink = business.upiId && isOwing
    ? `upi://pay?pa=${encodeURIComponent(business.upiId)}&pn=${encodeURIComponent(business.name)}&am=${balance}&cu=INR`
    : null;

  const handlePayUpi = () => {
    if (!upiLink) return;
    Linking.openURL(upiLink).catch(() => {
      Alert.alert(
        'UPI App Not Found',
        `Please ensure a UPI payment app (GPay, PhonePe, Paytm, BHIM) is installed on your device to pay directly to ${business.upiId}.`
      );
    });
  };

  const handleShareStatement = async () => {
    try {
      const text = `Member Statement for ${member.name} (${business.name})\nBalance: ${rupees(balance)}\nGenerated on: ${formatDate(generatedAt)}`;
      const fileUri = `${FileSystem.documentDirectory}statement_${member.name.replace(/\s+/g, '_')}.txt`;
      await FileSystem.writeAsStringAsync(fileUri, text);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Statement', text);
      }
    } catch (err) {
      console.warn('Share error', err);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.headerBar, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerBiz, { color: theme.colors.textSecondary }]}>{business.name}</Text>
          <Text style={[styles.headerName, { color: theme.colors.text }]}>{member.name}</Text>
        </View>
        <TouchableOpacity onPress={handleShareStatement} style={styles.shareBtn}>
          <Icon name="share-outline" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Balance Card */}
        <Card
          style={[
            styles.balanceCard,
            {
              backgroundColor: isOwing ? theme.colors.dangerSoft : theme.colors.primaryLight,
              borderColor: isOwing ? '#FECACA' : '#A7F3D0',
            },
          ]}>
          <Text
            style={[
              styles.balanceLabel,
              { color: isOwing ? theme.colors.dangerDark : theme.colors.primaryDark },
            ]}>
            {isOwing ? 'AMOUNT DUE' : balance < 0 ? 'PAID IN ADVANCE' : 'BALANCE'}
          </Text>
          <Text
            style={[
              styles.balanceAmt,
              { color: isOwing ? theme.colors.dangerDark : theme.colors.primaryDark },
            ]}>
            {isOwing ? rupees(balance) : balance < 0 ? rupees(-balance) : 'All Paid Up'}
          </Text>

          {upiLink && (
            <Button
              title={`Pay ${rupees(balance)} via UPI`}
              variant="primary"
              size="lg"
              icon={<Icon name="flash-outline" size={18} color="#FFFFFF" />}
              onPress={handlePayUpi}
              style={{ marginTop: 14 }}
            />
          )}

          {upiLink && (
            <Text style={[styles.upiHint, { color: theme.colors.textSecondary }]}>
              Opens PhonePe, GPay, Paytm or BHIM. Paid directly to {business.name} with zero gateway fees.
            </Text>
          )}
        </Card>

        {/* Security deposit & notice info (if any) */}
        {(member.deposit?.amount > 0 || member.noticeGivenOn) && (
          <Card style={styles.depositCard}>
            {member.deposit?.amount > 0 && (
              <View style={styles.depositRow}>
                <View>
                  <Text style={[styles.depLabel, { color: theme.colors.textSecondary }]}>
                    Security Deposit Held
                  </Text>
                  <Text style={[styles.depVal, { color: theme.colors.text }]}>
                    {rupees(member.deposit.amount)}
                  </Text>
                </View>
                <Text style={[styles.depStatus, { color: theme.colors.primaryDark }]}>
                  {member.deposit.refundedOn ? `Refunded on ${formatDate(member.deposit.refundedOn)}` : 'Held by Owner'}
                </Text>
              </View>
            )}

            {member.noticeGivenOn && (
              <View style={[styles.depositRow, { borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle, marginTop: 8, paddingTop: 8 }]}>
                <Text style={[styles.depLabel, { color: theme.colors.textSecondary }]}>
                  Notice Given Date
                </Text>
                <Text style={[styles.depVal, { color: theme.colors.text }]}>
                  {formatDate(member.noticeGivenOn)}
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* Verified Ledger */}
        <View style={styles.ledgerHead}>
          <Text style={[styles.ledgerHeadTitle, { color: theme.colors.text }]}>
            Verified Transaction Ledger
          </Text>
          <Text style={[styles.ledgerHeadSub, { color: theme.colors.textSecondary }]}>
            Updated as of {formatDate(generatedAt)}
          </Text>
        </View>

        <Card style={styles.ledgerCard}>
          {[...ledger].reverse().map((r) => {
            const isDue = r.kind === 'due';
            return (
              <View
                key={r.id}
                style={[
                  styles.ledgerItem,
                  { borderBottomColor: theme.colors.borderSubtle },
                ]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ledgerItemDate, { color: theme.colors.textMuted }]}>
                    {formatDate(r.date)}
                  </Text>
                  <Text style={[styles.ledgerItemEntry, { color: theme.colors.text }]}>
                    {isDue
                      ? `Fee for ${formatDate(r.date)} – ${formatDate(r.periodEnd)}`
                      : `Payment Received${r.mode ? ` (${r.mode.toUpperCase()})` : ''}`}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={[
                      styles.ledgerItemAmount,
                      { color: isDue ? theme.colors.danger : theme.colors.primary },
                    ]}>
                    {isDue ? `+${rupees(r.amount)}` : `−${rupees(r.amount)}`}
                  </Text>
                  <Text style={[styles.ledgerItemBalance, { color: theme.colors.textSecondary }]}>
                    Bal: {rupees(r.balance)}
                  </Text>
                </View>
              </View>
            );
          })}

          {ledger.length === 0 && (
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              No billing entries recorded yet.
            </Text>
          )}
        </Card>

        <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>
          Read-only verified statement shared by {business.name}. Have a question? Reply directly to the owner on WhatsApp.
        </Text>
      </ScrollView>
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
    padding: 24,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    paddingRight: 12,
  },
  headerBiz: {
    fontSize: 11,
    fontWeight: '600',
  },
  headerName: {
    fontSize: 16,
    fontWeight: '800',
  },
  shareBtn: {
    padding: 6,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  balanceCard: {
    padding: 18,
    marginBottom: 12,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  balanceAmt: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
  },
  upiHint: {
    fontSize: 11.5,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 16,
  },
  depositCard: {
    padding: 14,
    marginBottom: 12,
  },
  depositRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  depLabel: {
    fontSize: 11.5,
  },
  depVal: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  depStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  ledgerHead: {
    marginTop: 6,
    marginBottom: 8,
  },
  ledgerHeadTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  ledgerHeadSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  ledgerCard: {
    padding: 10,
  },
  ledgerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  ledgerItemDate: {
    fontSize: 11,
  },
  ledgerItemEntry: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  ledgerItemAmount: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  ledgerItemBalance: {
    fontSize: 10.5,
    marginTop: 1,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 14,
    fontSize: 12,
  },
  footerText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
  errTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  errSub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
});

