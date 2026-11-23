import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Alert,
  Switch,
} from 'react-native';
import { useBiz } from '../../context/BizContext';
import { useTheme } from '../../context/ThemeContext';
import { api, rupees } from '../../api/api';
import { tint } from '../../constants/theme';
import TopBar from '../../components/TopBar';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import Avatar from '../../components/Avatar';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import { ScreenSkeleton, Skeleton } from '../../components/Loader';
import SellModal, { Choice } from '../modals/SellModal';

// Same as the web Sales page (client/src/pages/Sales.jsx + SalesView/CatalogueTab in Setup.jsx).
const KINDS = {
  pt: { label: 'PT packs', add: 'Add PT pack', example: 'e.g. 12 sessions', detail: 'e.g. 12 sessions, use within 45 days', icon: 'barbell-outline', gymOnly: true },
  service: { label: 'Services', add: 'Add service', example: 'e.g. Diet plan', detail: 'e.g. one-time consultation', icon: 'sparkles-outline' },
  product: { label: 'Products', add: 'Add product', example: 'e.g. Whey protein 1 kg', detail: 'e.g. chocolate flavour', icon: 'pricetag-outline' },
};
const SALE_PERIODS = [
  ['month', 'This month', () => { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth(), 1), n]; }],
  ['last', 'Last month', () => { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth() - 1, 1), new Date(n.getFullYear(), n.getMonth(), 0, 23, 59, 59, 999)]; }],
  ['year', 'This year', () => { const n = new Date(); return [new Date(n.getFullYear(), 0, 1), n]; }],
  ['all', 'All time', () => [null, new Date()]],
];
const MODE_NAME = { cash: 'Cash', upi: 'UPI', other: 'Card / bank' };
const whenText = (at) => {
  const d = new Date(at); const now = new Date();
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
  if (d.toDateString() === new Date(now - 86400000).toDateString()) return `Yesterday ${time}`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(d.getFullYear() !== now.getFullYear() && { year: 'numeric' }) });
};
const linesText = (items) => items.map((l) => (l.qty > 1 ? `${l.name} ×${l.qty}` : l.name)).join(', ');
const level = (biz) => (biz?.access ? biz.access.level : 3); // 1 add · 2 edit · 3 delete

export default function SalesScreen({ navigation }) {
  const { biz } = useBiz();
  const { theme } = useTheme();
  const c = theme.colors;
  const kinds = ['product', 'pt', 'service'].filter((k) => !KINDS[k].gymOnly || biz?.type === 'gym');
  const [view, setView] = useState('sales');
  const [catalogue, setCatalogue] = useState(null);
  const [sales, setSales] = useState(null);
  const [salesError, setSalesError] = useState(null);
  const [period, setPeriod] = useState('month');
  const [part, setPart] = useState('history');
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [selling, setSelling] = useState(null); // {} or { start }
  const [editing, setEditing] = useState(null); // {} new, or the item
  const [refreshing, setRefreshing] = useState(false);

  const loadCatalogue = useCallback(async () => {
    if (!biz?._id) return;
    try { const x = await api(`/businesses/${biz._id}/catalogue`); setCatalogue(Array.isArray(x) ? x : []); } catch { setCatalogue([]); }
  }, [biz?._id]);
  const loadSales = useCallback(async () => {
    if (!biz?._id) return;
    const [from, to] = SALE_PERIODS.find((p) => p[0] === period)[2]();
    try {
      setSales(await api(`/businesses/${biz._id}/sales?${from ? `from=${from.toISOString()}&` : ''}to=${to.toISOString()}`));
      setSalesError(null);
    } catch (e) { setSalesError(e); }
  }, [biz?._id, period]);
  useEffect(() => { loadCatalogue(); }, [loadCatalogue]);
  useEffect(() => { loadSales(); }, [loadSales]);
  const reload = () => { loadCatalogue(); loadSales(); };
  const onRefresh = async () => { setRefreshing(true); await Promise.all([loadCatalogue(), loadSales()]); setRefreshing(false); };

  if (biz?.salesEnabled === false) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
        <TopBar title="Sales" navigation={navigation} />
        <View style={{ padding: 16 }}>
          <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
            <View style={[styles.emptyIcon, { backgroundColor: c.primarySoft }]}><Icon name="pricetag-outline" size={24} color={c.primary} /></View>
            <Text style={[styles.emptyTitle, { color: c.text }]}>Selling is turned off</Text>
            <Text style={[styles.emptyText, { color: c.textMuted }]}>Turn on “Sell products & services” in Settings to sell PT packs, services and products. Past sales are kept.</Text>
            <Button title="Open Settings" onPress={() => navigation.navigate('Main', { screen: 'Settings' })} />
          </Card>
        </View>
      </SafeAreaView>
    );
  }
  if (!catalogue) return <ScreenSkeleton navigation={navigation} />;

  const t = sales?.totals;
  const monthName = new Date().toLocaleDateString('en-IN', { month: 'long' });
  const tabs = [
    { id: 'sales', label: 'Sales', count: t?.count },
    ...kinds.map((k) => ({ id: k, label: KINDS[k].label, count: catalogue.filter((i) => i.kind === k).length })),
  ];

  const askUndo = (x) => {
    Alert.alert(
      `Undo this ${rupees(x.total)} sale?`,
      `${linesText(x.items)} to ${x.memberName}. The charge${x.paid ? ' and its payment are' : ' is'} removed and any stock goes back.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Undo sale', style: 'destructive', onPress: async () => {
          try { await api(`/members/${x.memberId}/sales/${x._id}`, { method: 'DELETE' }); reload(); }
          catch (e) { Alert.alert('Could not undo', e.message); }
        } },
      ],
    );
  };

  const renderSales = () => {
    if (salesError) return <Text style={[styles.none, { color: c.danger }]}>{salesError.status === 404 ? 'Sales need the latest server update.' : salesError.message}</Text>;
    if (!sales) return <View style={{ gap: 8 }}><Skeleton height={90} /><Skeleton height={200} /></View>;
    const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
    const change = t.prevRevenue != null ? pct(t.revenue, t.prevRevenue) : null;
    const cards = [
      { icon: 'pricetag-outline', hex: '#D97706', label: 'Items sold', value: String(t.qty), note: `in ${t.count} sale${t.count === 1 ? '' : 's'}` },
      { icon: 'card-outline', hex: '#16A34A', ink: c.successDark, label: 'Revenue', value: rupees(t.revenue), note: change == null ? '—' : `${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}% vs before` },
      { icon: 'pulse-outline', hex: '#64748B', label: 'Cost', value: t.cost == null ? '—' : rupees(t.cost), note: t.cost == null ? 'add cost prices' : 'from cost prices' },
      { icon: 'sparkles-outline', hex: '#7C3AED', ink: c.purpleDark, label: 'Profit', value: t.profit == null ? '—' : rupees(t.profit), note: t.profit == null ? 'needs cost prices' : `${Math.round((t.profit / t.profitOn) * 100)}% margin` },
      { icon: 'alert-circle-outline', hex: '#DC2626', ink: t.unpaid ? c.dangerDark : c.text, label: 'Not paid yet', value: rupees(t.unpaid), note: t.unpaid ? 'sold onto dues' : 'all sales paid' },
    ];
    const query = q.trim().toLowerCase();
    const list = sales.sales.filter((x) => !query || x.memberName.toLowerCase().includes(query) || linesText(x.items).toLowerCase().includes(query));
    const shown = showAll ? list : list.slice(0, 12);
    return (
      <>
        <View style={styles.wrap}>
          {SALE_PERIODS.map(([id, label]) => <Choice key={id} on={period === id} label={label} onPress={() => { setPeriod(id); setShowAll(false); }} />)}
        </View>
        <View style={styles.cardGrid}>
          {cards.map((k) => (
            <View key={k.label} style={[styles.kpi, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={[styles.kpiIcon, { backgroundColor: tint(k.hex, theme.isDark ? 0.2 : 0.1, c.card) }]}><Icon name={k.icon} size={15} color={k.hex} /></View>
              <Text style={[styles.kpiLabel, { color: c.textMuted }]}>{k.label}</Text>
              <Text style={[styles.kpiValue, { color: k.ink || c.text }]} numberOfLines={1} adjustsFontSizeToFit>{k.value}</Text>
              <Text style={[styles.kpiNote, { color: c.textSubtle }]} numberOfLines={1}>{k.note}</Text>
            </View>
          ))}
        </View>

        {!sales.sales.length ? (
          <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
            <Text style={[styles.emptyTitle, { color: c.text }]}>No sales {period === 'all' ? 'yet' : 'in this period'}</Text>
            <Text style={[styles.emptyText, { color: c.textMuted, marginBottom: 0 }]}>Sell from here, the Dashboard or a member’s page. Every sale shows up here with what it earned.</Text>
          </Card>
        ) : (
          <Card style={{ padding: 12 }}>
            <View style={[styles.wrap, { marginBottom: 10 }]}>
              <Choice on={part === 'history'} label={`Sales history · ${sales.sales.length}`} onPress={() => setPart('history')} />
              <Choice on={part === 'items'} label={`By item · ${sales.byItem.length}`} onPress={() => setPart('items')} />
            </View>
            {part === 'items' ? (
              sales.byItem.map((i) => (
                <View key={String(i.itemId)} style={[styles.saleRow, { borderTopColor: c.borderSubtle }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: c.text }]}>{i.name}{i.removed ? ' (removed)' : ''}</Text>
                    <Text style={[styles.meta, { color: c.textMuted }]}>
                      {i.qty} sold{i.profit != null ? ` · profit ${i.profit < 0 ? '−' : ''}${rupees(Math.abs(i.profit))}` : ''}{i.stock != null ? ` · ${i.stock === 0 ? 'out' : `${i.stock} left`}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.amt, { color: c.text }]}>{rupees(i.revenue)}</Text>
                </View>
              ))
            ) : (
              <>
                <View style={[styles.search, { backgroundColor: c.inputBg, borderColor: c.inputBorder }]}>
                  <Icon name="search" size={15} color={c.textMuted} />
                  <TextInput value={q} onChangeText={setQ} placeholder="Member or item" placeholderTextColor={c.textMuted} style={[styles.searchInput, { color: c.text }]} />
                </View>
                {shown.map((x) => {
                  const owed = !x.paid && x.stillOwed;
                  return (
                    <View key={x._id} style={[styles.saleRow, { borderTopColor: c.borderSubtle }]}>
                      <TouchableOpacity style={styles.saleWho} onPress={() => navigation.navigate('MemberDetail', { id: x.memberId })}>
                        <Avatar name={x.memberName} size={32} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{x.memberName}</Text>
                          <Text style={[styles.meta, { color: c.textMuted }]} numberOfLines={1}>{linesText(x.items)}</Text>
                          <Text style={[styles.meta, { color: owed ? c.dangerDark : c.successDark }]} numberOfLines={1}>
                            {x.paid ? `Paid · ${MODE_NAME[x.mode] || 'Paid'}` : x.stillOwed ? (x.stillOwed < x.total ? `${rupees(x.stillOwed)} owed` : 'On dues') : 'Paid later'}
                            <Text style={{ color: c.textMuted }}>{`  ·  ${whenText(x.at)}${x.soldBy ? ` · by ${x.soldBy}` : ''}`}</Text>
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <Text style={[styles.amt, { color: c.text }]}>{rupees(x.total)}</Text>
                      {level(biz) >= 3 ? (
                        <TouchableOpacity onPress={() => askUndo(x)} accessibilityLabel={`Undo sale to ${x.memberName}`} style={styles.undo}>
                          <Icon name="close" size={16} color={c.textMuted} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                })}
                {list.length > shown.length && <Button title={`Show all ${list.length}`} variant="ghost" onPress={() => setShowAll(true)} />}
                {!list.length && <Text style={[styles.none, { color: c.textMuted }]}>Nothing matches “{q}”.</Text>}
              </>
            )}
          </Card>
        )}
      </>
    );
  };

  const renderCatalogue = (kind) => {
    const K = KINDS[kind];
    const list = catalogue.filter((i) => i.kind === kind);
    return (
      <>
        {list.map((i) => (
          <Card key={i._id} style={{ padding: 12 }}>
            <View style={styles.itemTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: c.text }]}>{i.name}</Text>
                <Text style={[styles.meta, { color: c.textMuted }]}>
                  {[i.detail, kind === 'product' && (i.trackStock ? `${i.stock} in stock` : !i.detail && 'no stock tracking')].filter(Boolean).join(' · ') || 'charged once'}
                </Text>
              </View>
              {level(biz) >= 2 ? (
                <TouchableOpacity onPress={() => setEditing(i)} accessibilityLabel={`Edit ${i.name}`} style={[styles.round, { borderColor: c.border }]}>
                  <Icon name="create-outline" size={15} color={c.text} />
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={[styles.price, { color: c.text }]}>{rupees(i.price)}<Text style={[styles.meta, { color: c.textMuted }]}> {kind === 'product' ? 'each' : 'once'}</Text></Text>
            <View style={styles.itemFoot}>
              <Text style={[styles.meta, { color: c.textMuted, flex: 1 }]}>{i.soldThisMonth ? `Sold ${i.soldThisMonth} this month` : 'Not sold this month'}</Text>
              {i.trackStock && i.stock <= 2 ? <Text style={[styles.meta, { color: c.warningDark, fontWeight: '700' }]}>{i.stock === 0 ? 'Out of stock' : `Only ${i.stock} left`}</Text> : null}
              {level(biz) >= 1 && !(i.trackStock && i.stock === 0) ? (
                <TouchableOpacity onPress={() => setSelling({ start: i._id })}><Text style={{ color: c.primary, fontWeight: '700', fontSize: 13 }}>Sell ›</Text></TouchableOpacity>
              ) : null}
            </View>
          </Card>
        ))}
        {level(biz) >= 2 ? (
          <TouchableOpacity onPress={() => setEditing({})} style={[styles.newItem, { borderColor: c.border }]}>
            <Icon name="add" size={20} color={c.primary} />
            <Text style={{ fontWeight: '700', color: c.text }}>{K.add}</Text>
            <Text style={[styles.meta, { color: c.textMuted }]}>{K.example}</Text>
          </TouchableOpacity>
        ) : !list.length ? (
          <Text style={[styles.none, { color: c.textMuted }]}>Nothing here yet. Ask the owner to add {K.label.toLowerCase()}.</Text>
        ) : null}
      </>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
      <TopBar title="Sales" navigation={navigation} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} progressBackgroundColor={c.card} />}>
        <Text style={[styles.sub, { color: c.textMuted }]}>
          {t && period === 'month' ? `${monthName} · ${rupees(t.revenue)} sold${t.unpaid ? ` · ${rupees(t.unpaid)} not paid yet` : ''}` : 'Products, PT packs and services'}
        </Text>
        <View style={styles.titleRow}>
          <Text style={[styles.h1, { color: c.text }]}>Sales</Text>
          {level(biz) >= 1 ? (
            <Button title="Sell" size="sm" disabled={!catalogue.length} icon={<Icon name="pricetag-outline" size={15} color="#fff" />} onPress={() => setSelling({})} />
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs.map((tb) => {
            const on = view === tb.id;
            return (
              <TouchableOpacity key={tb.id} onPress={() => setView(tb.id)} style={[styles.tab, { backgroundColor: on ? c.primarySoft : c.card, borderColor: on ? c.primary : c.border }]}>
                <Text style={{ fontSize: 13, fontWeight: on ? '700' : '500', color: on ? c.primaryDark : c.textSecondary }}>{tb.label}</Text>
                {tb.count > 0 ? <Text style={{ fontSize: 11.5, color: c.textMuted }}>{tb.count}</Text> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {view === 'sales' ? renderSales() : renderCatalogue(view)}
      </ScrollView>

      {selling && (
        <SellModal
          visible
          biz={biz}
          start={selling.start}
          onClose={() => setSelling(null)}
          onSold={reload}
          onOpenCatalogue={() => setView(kinds[0])}
        />
      )}
      {editing && (
        <ItemModal
          biz={biz}
          kind={editing.kind || view}
          item={editing._id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); loadCatalogue(); }}
          onDelete={level(biz) >= 3 && editing._id ? () => {
            const i = editing;
            Alert.alert(`Remove ${i.name}?`, 'It leaves the catalogue. Past sales keep their name and price.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: async () => {
                try { await api(`/businesses/${biz._id}/catalogue/${i._id}`, { method: 'DELETE' }); setEditing(null); loadCatalogue(); }
                catch (e) { Alert.alert('Could not remove', e.message); }
              } },
            ]);
          } : null}
        />
      )}
    </SafeAreaView>
  );
}

// Add or edit one catalogue item
function ItemModal({ biz, kind, item, onClose, onSaved, onDelete }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const K = KINDS[kind] || KINDS.product;
  const [form, setForm] = useState({
    name: item?.name || '',
    price: item ? String(item.price) : '',
    cost: item?.cost != null ? String(item.cost) : '',
    detail: item?.detail || '',
    trackStock: item?.trackStock || false,
    stock: item ? String(item.stock ?? 0) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const price = Number(form.price);
  const cost = Number(form.cost);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const body = {
        kind, name: form.name.trim(), price, cost: form.cost === '' ? null : cost, detail: form.detail,
        trackStock: kind === 'product' && form.trackStock,
        stock: kind === 'product' && form.trackStock ? Number(form.stock || 0) : 0,
      };
      if (item) await api(`/businesses/${biz._id}/catalogue/${item._id}`, { method: 'PATCH', body });
      else await api(`/businesses/${biz._id}/catalogue`, { method: 'POST', body });
      onSaved();
    } catch (e) {
      setError(e.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible onClose={onClose} title={item ? `Edit ${item.name}` : K.add} maxHeight="92%">
      {error ? <Text style={{ color: c.danger, marginBottom: 10 }}>{error}</Text> : null}
      <Input label="Name *" value={form.name} onChangeText={set('name')} placeholder={K.example.replace('e.g. ', '')} autoCapitalize="words" />
      <Input label={kind === 'product' ? 'Price each (₹) *' : 'Price (₹) *'} value={form.price} onChangeText={set('price')} keyboardType="numeric" />
      <Input
        label={kind === 'product' ? 'Cost price each (₹, optional)' : 'Cost to you (₹, optional)'}
        value={form.cost}
        onChangeText={set('cost')}
        keyboardType="numeric"
        placeholder="What you pay for it, to see profit"
        hint={form.cost !== '' && price > 0 ? `Profit ${price - cost < 0 ? '−' : ''}${rupees(Math.abs(price - cost))} ${kind === 'product' ? 'each' : 'per sale'} (${Math.round(((price - cost) / price) * 100)}% margin)` : undefined}
      />
      <Input label="Details (optional)" value={form.detail} onChangeText={set('detail')} placeholder={K.detail} autoCapitalize="sentences" />
      {kind === 'product' && (
        <>
          <View style={[styles.switchRow, { borderColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600', color: c.text }}>Keep count of stock</Text>
              <Text style={[styles.meta, { color: c.textMuted }]}>Each sale takes one off, and you’ll see when it’s running low</Text>
            </View>
            <Switch value={form.trackStock} onValueChange={set('trackStock')} trackColor={{ true: c.primary }} />
          </View>
          {form.trackStock && <Input label="In stock now" value={form.stock} onChangeText={set('stock')} keyboardType="numeric" />}
        </>
      )}
      <Text style={[styles.meta, { color: c.textMuted, marginBottom: 12 }]}>
        {kind === 'pt' ? 'Charged once when sold. Session counting is not tracked yet.' : 'Charged once when sold, on the member’s account.'}
      </Text>
      <View style={styles.modalActions}>
        {onDelete ? (
          <TouchableOpacity onPress={onDelete} style={[styles.round, { borderColor: c.dangerBorder }]} accessibilityLabel="Remove from catalogue">
            <Icon name="trash-outline" size={16} color={c.dangerDark} />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }} />
        <Button title="Cancel" variant="secondary" onPress={onClose} />
        <Button title={item ? 'Save' : 'Add'} loading={saving} disabled={!form.name.trim() || !(price > 0)} onPress={save} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  sub: { fontSize: 12.5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, marginBottom: 12 },
  h1: { fontSize: 24, fontWeight: '700' },
  tabs: { gap: 6, paddingVertical: 2, marginBottom: 12 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  kpi: { width: '48.8%', borderWidth: 1, borderRadius: 12, padding: 12 },
  kpiIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  kpiLabel: { fontSize: 12, fontWeight: '500' },
  kpiValue: { fontSize: 19, fontWeight: '700', marginTop: 2 },
  kpiNote: { fontSize: 11.5, marginTop: 2 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 40, marginBottom: 4 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  saleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderTopWidth: 1 },
  saleWho: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 1 },
  amt: { fontSize: 14, fontWeight: '700' },
  undo: { padding: 6 },
  none: { textAlign: 'center', paddingVertical: 20, fontSize: 13 },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  price: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  itemFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  newItem: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, padding: 16, alignItems: 'center', gap: 4, marginBottom: 12 },
  round: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 14 },
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emptyIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 16 },
});
