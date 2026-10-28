import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { api, rupees } from '../../api/api';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Icon from '../../components/Icon';

export const EXPENSE_CATEGORIES = [
  { id: 'rent', label: 'Rent', icon: 'business-outline' },
  { id: 'salary', label: 'Salaries', icon: 'people-outline' },
  { id: 'electricity', label: 'Electricity', icon: 'flash-outline' },
  { id: 'water', label: 'Water', icon: 'water-outline' },
  { id: 'internet', label: 'Internet / Phone', icon: 'wifi-outline' },
  { id: 'maintenance', label: 'Maintenance', icon: 'construct-outline' },
  { id: 'equipment', label: 'Equipment', icon: 'barbell-outline' },
  { id: 'groceries', label: 'Groceries / Food', icon: 'restaurant-outline' },
  { id: 'marketing', label: 'Marketing', icon: 'megaphone-outline' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
];

export default function AddExpenseModal({ visible, biz, onClose, onSaved }) {
  const { theme } = useTheme();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('electricity');
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const num = Number(amount);
    if (!num || num <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (category === 'other' && !label.trim()) {
      setError('Please specify what the expense was for');
      return;
    }

    if (!biz?._id) {
      setError('Workspace is not loaded');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const expense = await api(`/businesses/${biz._id}/expenses`, {
        method: 'POST',
        body: {
          amount: num,
          category,
          label: category === 'other' ? label.trim() : undefined,
          date,
          note: note.trim() || undefined,
        },
      });
      setAmount('');
      setLabel('');
      setNote('');
      if (onSaved) onSaved(expense);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record expense');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Add Business Expense"
      subtitle={`Record spending for ${biz?.name || 'Workspace'}`}>
      <View>
        {error ? (
          <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text>
        ) : null}

        <Input
          label="Amount (₹) *"
          value={amount}
          onChangeText={setAmount}
          placeholder="e.g. 3500"
          keyboardType="numeric"
          icon={<Icon name="cash-outline" size={18} />}
        />

        {/* Category Picker */}
        <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Category</Text>
        <View style={styles.catGrid}>
          {EXPENSE_CATEGORIES.map((c) => {
            const sel = category === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                activeOpacity={0.7}
                onPress={() => setCategory(c.id)}
                style={[
                  styles.catChip,
                  {
                    backgroundColor: sel ? theme.colors.primarySoft : theme.colors.cardSubtle,
                    borderColor: sel ? theme.colors.primary : theme.colors.borderSubtle,
                  },
                ]}>
                <Icon
                  name={c.icon}
                  size={14}
                  color={sel ? theme.colors.primaryDark : theme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.catChipText,
                    {
                      color: sel ? theme.colors.primaryDark : theme.colors.textSecondary,
                      fontWeight: sel ? '700' : '500',
                    },
                  ]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {category === 'other' && (
          <Input
            label="What was it for? *"
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. Office stationery, generator fuel"
          />
        )}

        <Input
          label="Date (YYYY-MM-DD)"
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          icon={<Icon name="calendar-outline" size={18} />}
        />

        <Input
          label="Notes / Vendor (Optional)"
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Paid to electrician, cash receipt #12"
          icon={<Icon name="document-text-outline" size={18} />}
        />

        <Button
          title="Save Expense"
          variant="primary"
          loading={loading}
          onPress={handleSubmit}
          style={{ marginTop: 8 }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  errorText: {
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '500',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  catChipText: {
    fontSize: 12,
  },
});

