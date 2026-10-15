import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../context/ThemeContext';
import { api, rupees, receiptMsg, waLink } from '../../api/api';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Icon from '../../components/Icon';

const PAYMENT_MODES = [
  { id: 'cash', label: 'Cash', icon: 'cash-outline' },
  { id: 'upi', label: 'UPI', icon: 'phone-portrait-outline' },
  { id: 'card', label: 'Card', icon: 'card-outline' },
  { id: 'transfer', label: 'Bank Transfer', icon: 'business-outline' },
];

export default function RecordPaymentModal({
  visible,
  member,
  biz,
  onClose,
  onPaymentRecorded,
}) {
  const { theme } = useTheme();
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('cash');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recordedData, setRecordedData] = useState(null); // { payment, balance, statementUrl }

  useEffect(() => {
    if (visible && member) {
      const bal = Number(member.balance || 0);
      setAmount(bal > 0 ? String(bal) : '');
      setMode('cash');
      setNote('');
      setError('');
      setRecordedData(null);
    }
  }, [visible, member]);

  const handleSubmit = async () => {
    const num = Number(amount);
    if (!num || num <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payment = await api(`/members/${member._id}/payments`, {
        method: 'POST',
        body: {
          amount: num,
          mode,
          note: note.trim() || undefined,
        },
      });

      // Fetch updated member data and statement token for receipt
      let statementUrl = null;
      try {
        const share = await api(`/members/${member._id}/share`, { method: 'POST' });
        if (share?.token) {
          statementUrl = `https://app.example.com/s/${share.token}`;
        }
      } catch {
        // ignore
      }

      const newBalance = Math.max(0, (member.balance || 0) - num);
      setRecordedData({ payment, balance: newBalance, statementUrl });

      if (onPaymentRecorded) {
        onPaymentRecorded(payment);
      }
    } catch (err) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReceipt = () => {
    if (!recordedData || !member.phone) return;
    const msg = receiptMsg(biz, member, recordedData.payment, recordedData.balance, recordedData.statementUrl);
    Linking.openURL(waLink(member.phone, msg)).catch(() => {
      Alert.alert('Could not open WhatsApp', 'Make sure WhatsApp is installed.');
    });
  };

  const handleCopyReceipt = async () => {
    if (!recordedData) return;
    const msg = receiptMsg(biz, member, recordedData.payment, recordedData.balance, recordedData.statementUrl);
    await Clipboard.setStringAsync(msg);
    Alert.alert('Copied', 'Receipt message copied to clipboard!');
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={recordedData ? 'Payment Recorded!' : 'Collect Payment'}
      subtitle={member ? `Member: ${member.name} (${member.phone || 'No phone'})` : ''}>
      {recordedData ? (
        <View style={styles.successContainer}>
          <View style={[styles.successIconWrap, { backgroundColor: theme.colors.successSoft }]}>
            <Icon name="checkmark-circle" size={48} color={theme.colors.success} />
          </View>

          <Text style={[styles.successTitle, { color: theme.colors.text }]}>
            {rupees(recordedData.payment.amount)} Recorded Successfully
          </Text>
          <Text style={[styles.successSub, { color: theme.colors.textSecondary }]}>
            Mode: {recordedData.payment.mode.toUpperCase()} · Remaining Balance: {rupees(recordedData.balance)}
          </Text>

          {member?.phone ? (
            <View style={{ width: '100%', gap: 8, marginTop: 16 }}>
              <Button
                title="Send WhatsApp Receipt"
                variant="whatsapp"
                icon={<Icon name="logo-whatsapp" size={18} color="#FFFFFF" />}
                onPress={handleSendReceipt}
              />
              <Button
                title="Copy Receipt Message"
                variant="outline"
                icon={<Icon name="copy-outline" size={16} color={theme.colors.text} />}
                onPress={handleCopyReceipt}
              />
            </View>
          ) : null}

          <Button
            title="Done"
            variant="secondary"
            style={{ width: '100%', marginTop: 10 }}
            onPress={onClose}
          />
        </View>
      ) : (
        <View>
          {/* Outstanding Balance Banner */}
          {member?.balance > 0 && (
            <View style={[styles.balanceBanner, { backgroundColor: theme.colors.dangerSoft }]}>
              <Text style={[styles.balanceBannerLabel, { color: theme.colors.dangerDark }]}>
                Current Outstanding Balance:
              </Text>
              <Text style={[styles.balanceBannerAmt, { color: theme.colors.dangerDark }]}>
                {rupees(member.balance)}
              </Text>
            </View>
          )}

          {error ? (
            <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text>
          ) : null}

          <Input
            label="Payment Amount (₹) *"
            value={amount}
            onChangeText={setAmount}
            placeholder="e.g. 1500"
            keyboardType="numeric"
            icon={<Icon name="cash-outline" size={18} />}
          />

          {/* Mode Selector */}
          <Text style={[styles.modeLabel, { color: theme.colors.text }]}>Payment Mode</Text>
          <View style={styles.modeGrid}>
            {PAYMENT_MODES.map((m) => {
              const selected = mode === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  activeOpacity={0.7}
                  onPress={() => setMode(m.id)}
                  style={[
                    styles.modeCard,
                    {
                      backgroundColor: selected ? theme.colors.primarySoft : theme.colors.cardSubtle,
                      borderColor: selected ? theme.colors.primary : theme.colors.borderSubtle,
                    },
                  ]}>
                  <Icon
                    name={m.icon}
                    size={18}
                    color={selected ? theme.colors.primary : theme.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.modeCardText,
                      {
                        color: selected ? theme.colors.primaryDark : theme.colors.textSecondary,
                        fontWeight: selected ? '700' : '500',
                      },
                    ]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Input
            label="Note / Reference (Optional)"
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Paid via PhonePe / cash handed at desk"
            icon={<Icon name="document-text-outline" size={18} />}
          />

          <Button
            title="Record Payment"
            variant="primary"
            loading={loading}
            onPress={handleSubmit}
            style={{ marginTop: 8 }}
          />
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  balanceBanner: {
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  balanceBannerLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  balanceBannerAmt: {
    fontSize: 14,
    fontWeight: '700',
  },
  modeLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    width: '48%',
  },
  modeCardText: {
    fontSize: 12.5,
  },
  errorText: {
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '500',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  successIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  successSub: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
});

