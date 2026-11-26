import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Alert,
  Switch,
} from 'react-native';
import { useBiz } from '../../context/BizContext';
import { useTheme } from '../../context/ThemeContext';
import { api, rupees } from '../../api/api';
import TopBar from '../../components/TopBar';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import { ScreenSkeleton, Skeleton } from '../../components/Loader';
import SellModal from '../modals/SellModal';
import { CompactHeader, NumberStrip, ListCard, SearchFilter, ChipRow, CompactRow } from '../../components/Compact';
import { downloadFile } from '../../api/download';

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
  const [show, setShow] = useState('all'); // 'all' | 'unpaid' | 'items'
  const [kindF, setKindF] = useState('all');
  const [modeF, setModeF] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  const tabs = [
    { id: 'sales', label: 'Sales', count: t?.count },
    ...kinds.map((k) => ({ id: k, label: KINDS[k].label, count: catalogue.filter((i) => i.kind === k).length })),
  ];

  const downloadCsv = async () => {
    const [from, to] = SALE_PERIODS.find((p) => p[0] === period)[2]();
    try { await downloadFile(`/businesses/${biz._id}/export/sales.csv?${from ? `from=${from.toISOString()}&` : ''}to=${to.toISOString()}`, `${biz.name}-sales.csv`); }
    catch (e) { Alert.alert('Download failed', e.message); }
  };

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
    if (!sales) return <View style={{ gap: 8 }}><Skeleton height={60} /><Skeleton height={200} /></View>;
    const query = q.trim().toLowerCase();
    const owing = (x) => !x.paid && x.stillOwed > 0;
    const searched = sales.sales.filter((x) => !query || x.memberName.toLowerCase().includes(query) || linesText(x.items).toLowerCase().includes(query));
    const base = searched.filter((x) => (kindF === 'all' || x.items.some((l) => l.kind === kindF)) && (modeF === 'all' || (modeF === 'dues' ? !x.paid : x.mode === modeF)));
    const list = show === 'unpaid' ? base.filter(owing) : base;
    const shown = showAll ? list : list.slice(0, 12);
    const items = sales.byItem.filter((i) => kindF === 'all' || i.kind === kindF);
    const kindsSold = [...new Set(sales.byItem.map((i) => i.kind))];
    const filtersOn = (kindF !== 'all' ? 1 : 0) + (modeF !== 'all' ? 1 : 0);
    const KIND_SHORT = { pt: 'PT pack', service: 'Service', product: 'Product' };
    const tagFor = (x) => (x.paid
      ? { text: `Paid · ${MODE_NAME[x.mode] || 'Paid'}`, tone: 'paid' }
      : x.stillOwed ? { text: x.stillOwed < x.total ? `${rupees(x.stillOwed)} owed` : 'On dues', tone: 'due' } : { text: 'Paid later', tone: 'paid' });
    return (
      <>
        {/* period: one segmented row */}
        <View style={[styles.seg, { backgroundColor: c.cardSubtle }]}>
          {SALE_PERIODS.map(([id, label]) => {
            const on = period === id;
            return (
              <TouchableOpacity key={id} onPress={() => { setPeriod(id); setShowAll(false); }} accessibilityState={{ selected: on }}
                style={[styles.segBtn, on && { backgroundColor: c.card, shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 }]}>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: on ? c.text : c.textSecondary }} numberOfLines={1}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* the four numbers in one slim strip */}
        <NumberStrip items={[
          { label: 'Revenue', value: rupees(t.revenue), ink: c.moneyGreen },
          { label: 'Cost', value: t.cost == null ? '—' : rupees(t.cost) },
          { label: 'Profit', value: t.profit == null ? '—' : rupees(t.profit), ink: c.primaryDark },
          { label: 'Not paid', value: rupees(t.unpaid), ink: t.unpaid ? c.moneyRed : undefined },
        ]} />

        {!sales.sales.length ? (
          <ListCard style={{ alignItems: 'center', paddingVertical: 28 }}>
            <Text style={[styles.emptyTitle, { color: c.text }]}>No sales {period === 'all' ? 'yet' : 'in this period'}</Text>
            <Text style={[styles.emptyText, { color: c.textMuted, marginBottom: 0 }]}>Sell from here, the Dashboard or a member’s page. Every sale shows up here with what it earned.</Text>
          </ListCard>
        ) : (
          <ListCard>
            <SearchFilter value={q} onChange={setQ} placeholder="Member or item" filterOn={filtersOn} onFilter={() => setFiltersOpen((o) => !o)} />
            {filtersOpen && (
              <View style={[styles.filterPanel, { backgroundColor: c.cardSubtle }]}>
                {kindsSold.length > 1 && (
                  <>
                    <Text style={[styles.filterLabel, { color: c.textMuted }]}>TYPE</Text>
                    <ChipRow small value={kindF} onPick={setKindF} options={[{ id: 'all', label: 'Everything' }, ...kindsSold.map((k) => ({ id: k, label: KINDS[k]?.label || k }))]} />
                  </>
                )}
                <Text style={[styles.filterLabel, { color: c.textMuted }]}>PAID BY</Text>
                <ChipRow small value={modeF} onPick={setModeF} options={[{ id: 'all', label: 'Any' }, { id: 'cash', label: 'Cash' }, { id: 'upi', label: 'UPI' }, { id: 'other', label: 'Card / bank' }, { id: 'dues', label: 'Put on dues' }]} />
              </View>
            )}
            <ChipRow value={show} onPick={(v) => { setShow(v); setShowAll(false); }} options={[
              { id: 'all', label: 'All', count: base.length },
              { id: 'unpaid', label: 'Not paid', count: base.filter(owing).length },
              { id: 'items', label: 'By item', count: items.length },
            ]} />
            <View>
              {show === 'items' ? items.map((i, n) => (
                <CompactRow
                  key={String(i.itemId)}
                  last={n === items.length - 1}
                  title={i.name}
                  tags={[
                    { text: KIND_SHORT[i.kind] || i.kind, tone: 'none' },
                    i.stock != null && { text: i.stock === 0 ? 'Out of stock' : `${i.stock} left`, tone: i.stock === 0 ? 'late' : i.stock <= 2 ? 'due' : 'paid' },
                  ]}
                  sub={`${i.qty} sold${i.removed ? ' · removed' : ''}`}
                  amount={rupees(i.revenue)}
                  amountSub={i.profit == null ? 'no cost price' : `${i.profit < 0 ? '−' : ''}${rupees(Math.abs(i.profit))} profit`}
                />
              )) : shown.map((x, n) => (
                <CompactRow
                  key={x._id}
                  last={n === shown.length - 1}
                  title={x.memberName}
                  onPress={() => navigation.navigate('MemberDetail', { id: x.memberId })}
                  tags={[tagFor(x)]}
                  sub={linesText(x.items)}
                  amount={rupees(x.total)}
                  amountInk={owing(x) ? c.warning : undefined}
                  amountSub={whenText(x.at)}
                  right={level(biz) >= 3 ? (
                    <TouchableOpacity onPress={() => askUndo(x)} accessibilityLabel={`Undo sale to ${x.memberName}`} style={[styles.undo, { borderColor: c.border, backgroundColor: c.card }]}>
                      <Icon name="close" size={14} color={c.textMuted} />
                    </TouchableOpacity>
                  ) : null}
                />
              ))}
              {show !== 'items' && !list.length && (
                <Text style={[styles.none, { color: c.textMuted }]}>{q ? `Nothing matches “${q}”.` : show === 'unpaid' ? 'Every sale is paid.' : 'No sales match.'}</Text>
              )}
            </View>
            <View style={styles.foot}>
              {show !== 'items' ? <Text style={{ fontSize: 12.5, color: c.textMuted }}>{shown.length} of {list.length}</Text> : null}
              {show !== 'items' && list.length > shown.length ? (
                <TouchableOpacity onPress={() => setShowAll(true)}><Text style={[styles.footLink, { color: c.primaryDark }]}>Show all</Text></TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={downloadCsv} style={[styles.footCsv]}>
                <Icon name="download-outline" size={13} color={c.primaryDark} />
                <Text style={[styles.footLink, { color: c.primaryDark }]}>CSV</Text>
              </TouchableOpacity>
            </View>
          </ListCard>
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
        {/* title, ⋯ (add items), + Sell — same as the web on a phone */}
        <CompactHeader
          title="Sales"
          menu={level(biz) >= 2 ? kinds.map((k) => ({ icon: KINDS[k].icon, label: KINDS[k].add, go: () => { setView(k); setEditing({ kind: k }); } })) : []}
          mainLabel="Sell"
          onMain={level(biz) >= 1 && catalogue.length ? () => setSelling({}) : null}
        />

        {/* Sales · Products · Services, underlined like Money's tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabs, { borderBottomColor: c.border }]}>
          {tabs.map((tb) => {
            const on = view === tb.id;
            return (
              <TouchableOpacity key={tb.id} onPress={() => setView(tb.id)} accessibilityRole="tab" accessibilityState={{ selected: on }}
                style={[styles.tab, { borderBottomColor: on ? c.primary : 'transparent' }]}>
                <Text style={{ fontSize: 14, fontWeight: on ? '600' : '500', color: on ? c.primaryDark : c.textMuted }}>{tb.label}</Text>
                {tb.count > 0 ? (
                  <View style={[styles.tabCount, { backgroundColor: on ? c.primary : c.cardSubtle }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: on ? '#fff' : c.textSecondary }}>{tb.count}</Text>
                  </View>
                ) : null}
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
  seg: { flexDirection: 'row', padding: 3, gap: 2, borderRadius: 10, marginBottom: 10 },
  segBtn: { flex: 1, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filterPanel: { borderRadius: 10, padding: 10, gap: 6 },
  filterLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.4 },
  tabCount: { minWidth: 20, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10 },
  footLink: { fontSize: 13, fontWeight: '600' },
  footCsv: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 },
  safe: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  sub: { fontSize: 12.5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, marginBottom: 12 },
  h1: { fontSize: 24, fontWeight: '700' },
  tabs: { flexGrow: 0, borderBottomWidth: 1, marginBottom: 12 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 11, borderBottomWidth: 2, marginBottom: -1 },
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
  undo: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
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
