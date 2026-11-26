import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Modal, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { rupees } from '../api/api';
import Icon from './Icon';
import Avatar from './Avatar';

// "Payment": search and tap who paid (most owed first); the caller then opens the payment form
export default function PickMember({ visible, members, word = 'member', onClose, onPick }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const list = (members || [])
    .filter((m) => !query || (m.name || '').toLowerCase().includes(query) || (m.phone || '').includes(query))
    .sort((a, b) => (b.balance || 0) - (a.balance || 0) || (a.name || '').localeCompare(b.name || ''));
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={s.scrim} accessibilityLabel="Close" />
      <View style={[s.sheet, { backgroundColor: c.card }]}>
        <View style={[s.grip, { backgroundColor: c.borderSolid }]} />
        <Text style={[s.title, { color: c.text }]}>Who paid?</Text>
        <View style={[s.search, { borderColor: c.border, backgroundColor: c.cardSubtle }]}>
          <Icon name="search" size={15} color={c.textMuted} />
          <TextInput value={q} onChangeText={setQ} placeholder={`Search ${word}s`} placeholderTextColor={c.textMuted} style={[s.input, { color: c.text }]} autoFocus />
        </View>
        <FlatList
          data={list}
          keyExtractor={(m) => m._id}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 420 }}
          renderItem={({ item: m, index }) => (
            <TouchableOpacity onPress={() => { setQ(''); onPick(m); }} accessibilityLabel={`${m.name} paid`}
              style={[s.row, index > 0 && { borderTopWidth: 1, borderTopColor: c.borderSubtle }]}>
              <Avatar name={m.name} size={30} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.name, { color: c.text }]} numberOfLines={1}>{m.name}</Text>
                <Text style={[s.sub, { color: c.textMuted }]} numberOfLines={1}>{m.planName || m.phone || ''}</Text>
              </View>
              {m.balance > 0
                ? <Text style={[s.amt, { color: c.moneyRed }]}>{rupees(m.balance)}</Text>
                : <Text style={[s.sub, { color: c.moneyGreen }]}>Paid</Text>}
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={[s.sub, { color: c.textMuted, textAlign: 'center', paddingVertical: 16 }]}>Nobody matches “{q}”.</Text>}
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 28 },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 99, marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginBottom: 6 },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  name: { fontSize: 14.5, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 1 },
  amt: { fontSize: 14.5, fontWeight: '700' },
});
