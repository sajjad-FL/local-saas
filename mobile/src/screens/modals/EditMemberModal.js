import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../api/api';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Icon from '../../components/Icon';

const STATUSES = [
  { key: 'active', label: 'Active' },
  { key: 'paused', label: 'Paused' },
  { key: 'left', label: 'Left' },
];

// Same as the web's Edit Member: name, phone and status
export default function EditMemberModal({ visible, member, onClose, onSaved }) {
  const { theme } = useTheme();
  const [form, setForm] = useState({ name: '', phone: '', status: 'active' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible && member) {
      setForm({ name: member.name || '', phone: member.phone || '', status: member.status || 'active' });
      setError('');
    }
  }, [visible, member]);

  const save = async () => {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api(`/members/${member._id}`, { method: 'PATCH', body: { ...form, name: form.name.trim() } });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} title={`Edit Member — ${member?.name || ''}`} position="center">
      {error ? (
        <View style={[styles.errorBox, { backgroundColor: theme.colors.dangerSoft }]}>
          <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text>
        </View>
      ) : null}

      <Input
        label="Full Name *"
        value={form.name}
        onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
        icon={<Icon name="person-outline" size={18} />}
      />
      <Input
        label="Phone Number (10 digits)"
        keyboardType="phone-pad"
        value={form.phone}
        onChangeText={(v) => setForm((f) => ({ ...f, phone: v.replace(/\D/g, '').slice(0, 10) }))}
        icon={<Icon name="call-outline" size={18} />}
      />

      <Text style={[styles.label, { color: theme.colors.text }]}>Status *</Text>
      <View style={styles.statusRow}>
        {STATUSES.map((s) => {
          const on = form.status === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              activeOpacity={0.8}
              onPress={() => setForm((f) => ({ ...f, status: s.key }))}
              style={[
                styles.statusChip,
                {
                  backgroundColor: on ? theme.colors.primarySoft : theme.colors.card,
                  borderColor: on ? theme.colors.primary : theme.colors.border,
                },
              ]}>
              <Text style={[styles.statusText, { color: on ? theme.colors.primaryDark : theme.colors.textSecondary }]}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.actionRow}>
        <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
        <Button
          title={saving ? 'Saving…' : 'Save Changes'}
          variant="primary"
          loading={saving}
          disabled={saving}
          onPress={save}
          style={{ flex: 1 }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  errorBox: { padding: 10, borderRadius: 8, marginBottom: 12 },
  errorText: { fontSize: 12.5, fontWeight: '500' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statusChip: { flex: 1, height: 38, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  statusText: { fontSize: 13, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
