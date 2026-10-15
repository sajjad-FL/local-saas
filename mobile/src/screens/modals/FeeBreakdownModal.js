import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { rupees } from '../../api/api';
import Modal from '../../components/Modal';

export default function FeeBreakdownModal({
  visible,
  plans = [],
  avgFee = 0,
  onClose,
}) {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Fee Breakdown by Plan"
      subtitle="Monthly equivalent fee and member distribution">
      <View style={styles.container}>
        {plans.map((p, idx) => (
          <View
            key={idx}
            style={[
              styles.row,
              {
                borderBottomColor: theme.colors.borderSubtle,
              },
            ]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.planName, { color: theme.colors.text }]}>
                {p.name}
              </Text>
              <Text style={[styles.planSub, { color: theme.colors.textSecondary }]}>
                {p.count} active member{p.count > 1 ? 's' : ''}
              </Text>
            </View>
            <Text style={[styles.planAmt, { color: theme.colors.primary }]}>
              {rupees(p.monthlyEq || p.amount || 0)}/mo
            </Text>
          </View>
        ))}

        {(!plans || plans.length === 0) && (
          <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
            No active subscription plans found.
          </Text>
        )}

        {/* Footer Summary */}
        <View
          style={[
            styles.footer,
            {
              backgroundColor: theme.colors.cardSubtle,
              borderRadius: theme.radius.md,
            },
          ]}>
          <Text style={[styles.footerLabel, { color: theme.colors.textSecondary }]}>
            Average across all active members:
          </Text>
          <Text style={[styles.footerVal, { color: theme.colors.primary }]}>
            {rupees(avgFee)}/mo
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  planName: {
    fontSize: 14,
    fontWeight: '700',
  },
  planSub: {
    fontSize: 12,
    marginTop: 2,
  },
  planAmt: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 16,
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginTop: 14,
  },
  footerLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerVal: {
    fontSize: 14,
    fontWeight: '700',
  },
});

