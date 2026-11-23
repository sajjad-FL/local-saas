import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { api, rupees } from '../../api/api';
import { words } from '../../constants/wording';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import Avatar from '../../components/Avatar';
import { Skeleton } from '../../components/Loader';

// Same as the web's SellModal (client/src/SellModal.jsx).
export const KIND_LABEL = { pt: 'PT packs', service: 'Services', product: 'Products' };
const MODES = [['cash', 'Cash'], ['upi', 'UPI'], ['other', 'Card / bank']];

// a choice pill
export function Choice({ on, label, onPress }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, { backgroundColor: on ? c.primarySoft : c.cardSubtle, borderColor: on ? c.primary : c.border }]}>
      <Text style={{ fontSize: 12.5, color: on ? c.primaryDark : c.textSecondary, fontWeight: on ? '700' : '500' }}>{label}</Text>
    </TouchableOpacity>
  );
}

// Sell catalogue items to a member. Without a member it asks who first.
// start: an item id to put in the basket straight away
export default function SellModal({ visible, biz, member: givenMember = null, start = null, onClose, onSold, onOpenCatalogue }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const W = words(biz?.type);
  const [member, setMember] = useState(givenMember);
  const [items, setItems] = useState(null);
  const [members, setMembers] = useState([]);
  const [q, setQ] = useState('');
  const [qty, setQty] = useState(() => (start ? { [start]: 1 } : {}));
  const [kind, setKind] = useState(null);
  const [paidNow, setPaidNow] = useState(true);
  const [mode, setMode] = useState('cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible || !biz?._id) return undefined;
    let live = true;
    api(`/businesses/${biz._id}/catalogue`).then((x) => live && setItems(Array.isArray(x) ? x : [])).catch((e) => live && setError(e.message));
    if (!givenMember) api(`/businesses/${biz._id}/members`).then((x) => live && setMembers(Array.isArray(x) ? x : [])).catch(() => {});
    return () => { live = false; };
  }, [visible, biz?._id, givenMember]);

  const list = items || [];
  const kinds = ['product', 'pt', 'service'].filter((k) => list.some((i) => i.kind === k));
  const curKind = kind || (start && list.find((i) => i._id === start)?.kind) || kinds[0];
  const picked = list.filter((i) => qty[i._id] > 0);
  const total = picked.reduce((n, i) => n + i.price * qty[i._id], 0);
  const change = (i, d) => setQty((x) => {
    const max = i.trackStock ? i.stock : 100;
    return { ...x, [i._id]: Math.max(0, Math.min(max, (x[i._id] || 0) + d)) };
  });

  const sell = async () => {
    setSaving(true);
    setError('');
    try {
      await api(`/members/${member._id}/sell`, {
        method: 'POST',
        body: { items: picked.map((i) => ({ itemId: i._id, qty: qty[i._id] })), paidNow, mode: paidNow ? mode : undefined },
      });
      onSold?.();
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save the sale');
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  // first: who is buying
  if (!member) {
    const query = q.trim().toLowerCase();
    const who = members
      .filter((m) => m.status === 'active')
      .filter((m) => !query || (m.name || '').toLowerCase().includes(query) || (m.phone || '').includes(query))
      .slice(0, 40);
    return (
      <Modal visible onClose={onClose} title="Sell to who?" subtitle={`Pick the ${W.member}`} maxHeight="88%">
        <View style={[styles.search, { backgroundColor: c.inputBg, borderColor: c.inputBorder }]}>
          <Icon name="search" size={16} color={c.textMuted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Name or phone" placeholderTextColor={c.textMuted} style={[styles.searchInput, { color: c.text }]} />
        </View>
        {who.map((m) => (
          <TouchableOpacity key={m._id} onPress={() => setMember(m)} style={[styles.whoRow, { borderBottomColor: c.borderSubtle }]}>
            <Avatar name={m.name} size={32} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.whoName, { color: c.text }]}>{m.name}</Text>
              <Text style={[styles.dim, { color: c.textMuted }]}>{m.phone || 'No phone'}{m.balance > 0 ? ` · owes ${rupees(m.balance)}` : ''}</Text>
            </View>
            <Icon name="chevron-forward" size={16} color={c.textMuted} />
          </TouchableOpacity>
        ))}
        {!who.length && <Text style={[styles.empty, { color: c.textMuted }]}>{query ? `Nobody matches “${q}”.` : `No active ${W.member}s yet.`}</Text>}
      </Modal>
    );
  }

  return (
    <Modal visible onClose={onClose} title={`Sell to ${member.name}`} maxHeight="92%">
      {!items ? (
        <View style={{ gap: 8 }}><Skeleton height={56} /><Skeleton height={56} /><Skeleton height={56} /></View>
      ) : !list.length ? (
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          <Text style={[styles.empty, { color: c.textMuted }]}>Nothing to sell yet. Add your PT packs, services and products first.</Text>
          {onOpenCatalogue ? <Button title="Add to the catalogue" onPress={() => { onClose(); onOpenCatalogue(); }} /> : null}
        </View>
      ) : (
        <>
          {!givenMember && (
            <TouchableOpacity onPress={() => setMember(null)} style={[styles.who, { borderColor: c.border, backgroundColor: c.cardSubtle }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.whoName, { color: c.text }]}>{member.name}</Text>
                <Text style={[styles.dim, { color: c.textMuted }]}>{member.phone || 'No phone'}{member.balance > 0 ? ` · already owes ${rupees(member.balance)}` : ''}</Text>
              </View>
              <Text style={{ color: c.primary, fontWeight: '600', fontSize: 13 }}>Change</Text>
            </TouchableOpacity>
          )}
          {kinds.length > 1 && (
            <View style={styles.wrap}>
              {kinds.map((k) => {
                const n = list.filter((i) => i.kind === k && qty[i._id]).length;
                return <Choice key={k} on={curKind === k} label={`${KIND_LABEL[k]}${n ? ` · ${n}` : ''}`} onPress={() => setKind(k)} />;
              })}
            </View>
          )}

          {list.filter((i) => i.kind === curKind).map((i) => {
            const n = qty[i._id] || 0;
            const out = i.trackStock && i.stock === 0;
            return (
              <View key={i._id} style={[styles.item, { borderColor: n ? c.primary : c.border, backgroundColor: n ? c.primarySoft : c.card, opacity: out ? 0.55 : 1 }]}>
                <TouchableOpacity style={{ flex: 1 }} disabled={out} onPress={() => change(i, 1)}>
                  <Text style={[styles.itemName, { color: c.text }]}>{i.name}</Text>
                  <Text style={[styles.dim, { color: c.textMuted }]}>
                    {rupees(i.price)}{i.detail ? ` · ${i.detail}` : ''}{i.trackStock ? ` · ${out ? 'out of stock' : `${i.stock} left`}` : ''}
                  </Text>
                </TouchableOpacity>
                {n > 0 ? (
                  <View style={styles.qty}>
                    <TouchableOpacity accessibilityLabel={`One less ${i.name}`} onPress={() => change(i, -1)} style={[styles.qtyBtn, { borderColor: c.border, backgroundColor: c.card }]}>
                      <Text style={[styles.qtyText, { color: c.text }]}>−</Text>
                    </TouchableOpacity>
                    <Text style={[styles.qtyN, { color: c.text }]}>{n}</Text>
                    <TouchableOpacity accessibilityLabel={`One more ${i.name}`} disabled={i.trackStock && n >= i.stock} onPress={() => change(i, 1)} style={[styles.qtyBtn, { borderColor: c.border, backgroundColor: c.card }]}>
                      <Text style={[styles.qtyText, { color: c.text }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Button title="Add" size="sm" variant="secondary" disabled={out} onPress={() => change(i, 1)} />
                )}
              </View>
            );
          })}

          <View style={[styles.total, { borderColor: c.border }]}>
            <Text style={[styles.dim, { color: c.textMuted, flex: 1 }]} numberOfLines={2}>
              {picked.length ? picked.map((i) => (qty[i._id] > 1 ? `${i.name} ×${qty[i._id]}` : i.name)).join(', ') : 'Tap items to add them'}
            </Text>
            <Text style={[styles.totalAmt, { color: c.text }]}>{rupees(total)}</Text>
          </View>

          <View style={styles.payRow}>
            {[[true, 'Paid now', 'Records the payment too'], [false, 'Add to their dues', 'They pay later with their fees']].map(([v, t, s]) => (
              <TouchableOpacity key={t} onPress={() => setPaidNow(v)} style={[styles.pay, { borderColor: paidNow === v ? c.primary : c.border, backgroundColor: paidNow === v ? c.primarySoft : c.card }]}>
                <Text style={{ fontWeight: '700', fontSize: 13, color: paidNow === v ? c.primaryDark : c.text }}>{t}</Text>
                <Text style={[styles.dim, { color: c.textMuted }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {paidNow && (
            <View style={styles.wrap}>
              {MODES.map(([v, l]) => <Choice key={v} on={mode === v} label={l} onPress={() => setMode(v)} />)}
            </View>
          )}
          {error ? <Text style={{ color: c.danger, marginBottom: 8 }}>{error}</Text> : null}
          <Button
            size="lg"
            loading={saving}
            disabled={!total}
            onPress={sell}
            title={!total ? 'Pick something to sell' : paidNow ? `Sell · ${rupees(total)} received` : `Add ${rupees(total)} to ${member.name.split(' ')[0]}’s dues`}
          />
        </>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 42, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  whoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  whoName: { fontSize: 14, fontWeight: '600' },
  dim: { fontSize: 12, marginTop: 1 },
  empty: { textAlign: 'center', fontSize: 13, paddingVertical: 16, lineHeight: 19 },
  who: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: { paddingHorizontal: 12, height: 32, borderRadius: 99, borderWidth: 1, justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  itemName: { fontSize: 14, fontWeight: '600' },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 18, fontWeight: '600', lineHeight: 20 },
  qtyN: { fontSize: 15, fontWeight: '700', minWidth: 16, textAlign: 'center' },
  total: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, paddingTop: 12, marginTop: 4, marginBottom: 12 },
  totalAmt: { fontSize: 20, fontWeight: '700' },
  payRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  pay: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 10 },
});
