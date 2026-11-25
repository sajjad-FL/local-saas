import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Linking,
  Alert,
} from 'react-native';
import { useBiz } from '../../context/BizContext';
import { useTheme } from '../../context/ThemeContext';
import { api, rupees, waLink } from '../../api/api';
import { words } from '../../constants/wording';
import { tint } from '../../constants/theme';
import TopBar from '../../components/TopBar';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import { ScreenSkeleton } from '../../components/Loader';
import AddMemberModal from '../modals/AddMemberModal';
import BulkRemindModal from '../modals/BulkRemindModal';
import { CompactHeader, NumberStrip, ListCard, SearchFilter, ChipRow, CompactRow, ColorKey } from '../../components/Compact';

// Same rules as the web Enquiries page (client/src/pages/Enquiries.jsx).
const DAY = 86400000;
const startOfDay = (d = new Date()) => new Date(new Date(d).toDateString());
const dayDiff = (d) => Math.round((startOfDay(d) - startOfDay()) / DAY); // + future, − past
const shortDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const isoDay = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const inDays = (n) => isoDay(Date.now() + n * DAY);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

const STATUS = {
  new: { label: 'New', dot: '#2563EB' },
  follow_up: { label: 'Following up', dot: '#D97706' },
  joined: { label: 'Joined', dot: '#16A34A' },
  lost: { label: 'Not interested', dot: '#64748B' },
};
const SOURCES = { walk_in: 'Walk-in', call: 'Phone call', whatsapp: 'WhatsApp', instagram: 'Instagram', referral: 'Referred by someone', other: 'Other' };
const isOpen = (e) => e.status === 'new' || e.status === 'follow_up';
const TABS = ['today', 'overdue', 'open', 'joined', 'lost'];

const VIEWS = {
  open: { tab: 'All open', dot: '#2563EB', fn: isOpen, empty: 'No open enquiries. Add one when someone asks about joining.' },
  today: { tab: 'Call today', dot: '#D97706', fn: (e) => isOpen(e) && e.followUpOn && dayDiff(e.followUpOn) === 0, empty: 'Nobody to call back today.' },
  overdue: { tab: 'Missed', dot: '#DC2626', fn: (e) => isOpen(e) && e.followUpOn && dayDiff(e.followUpOn) < 0, empty: 'No missed call-backs. Nice.' },
  joined: { tab: 'Joined', dot: '#16A34A', fn: (e) => e.status === 'joined', empty: 'Nobody has joined from an enquiry yet.' },
  lost: { tab: 'Not interested', dot: '#64748B', fn: (e) => e.status === 'lost', empty: 'Nobody marked not interested.' },
};

const followText = (e) => {
  if (!isOpen(e)) return { text: '—', tone: '' };
  if (!e.followUpOn) return { text: 'No date set', tone: '' };
  const d = dayDiff(e.followUpOn);
  if (d < 0) return { text: `Missed by ${plural(-d, 'day')}`, tone: 'red' };
  if (d === 0) return { text: 'Today', tone: 'amber' };
  if (d === 1) return { text: 'Tomorrow', tone: '' };
  return { text: `in ${d} days`, tone: '' };
};

export default function EnquiriesScreen({ navigation, route }) {
  const { biz, isOwner } = useBiz();
  const { theme } = useTheme();
  const W = words(biz?.type);
  const c = theme.colors;

  const [all, setAll] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [view, setView] = useState(null); // null: start on whatever needs doing first
  const [sourceFilter, setSourceFilter] = useState('all');
  const [editing, setEditing] = useState(null); // {} new, or the enquiry
  const [joining, setJoining] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulk, setBulk] = useState(null); // the one-by-one WhatsApp sender

  const load = useCallback(async () => {
    if (!biz?._id) return;
    try {
      const [e, p] = await Promise.all([
        api(`/businesses/${biz._id}/enquiries`),
        api(`/businesses/${biz._id}/plans`).catch(() => []),
      ]);
      setAll(Array.isArray(e) ? e : []);
      setPlans(Array.isArray(p) ? p : []);
      setLoadError(null);
    } catch (err) {
      setLoadError(err);
    }
  }, [biz?._id]);

  useEffect(() => { load(); }, [load]);
  // the Dashboard's "+ Enquiry" opens the form straight away
  useEffect(() => {
    if (route?.params?.add) {
      setEditing({});
      navigation.setParams({ add: undefined });
    }
  }, [route?.params?.add, navigation]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const patch = async (id, body) => {
    try {
      await api(`/businesses/${biz._id}/enquiries/${id}`, { method: 'PATCH', body });
      load();
    } catch (err) {
      Alert.alert('Could not save', err.message);
    }
  };
  const askDelete = (e) => {
    Alert.alert(`Delete ${e.name}'s enquiry?`, 'It is removed for good. Use "Not interested" instead to keep a record.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await api(`/businesses/${biz._id}/enquiries/${e._id}`, { method: 'DELETE' }); load(); }
          catch (err) { Alert.alert('Could not delete', err.message); }
        },
      },
    ]);
  };

  const list0 = all || [];
  const now = new Date();
  const thisMonth = (d) => { const x = new Date(d); return x.getMonth() === now.getMonth() && x.getFullYear() === now.getFullYear(); };
  const curView = view || (list0.some(VIEWS.today.fn) ? 'today' : list0.some(VIEWS.overdue.fn) ? 'overdue' : 'open');
  const passes = (e, skip) => {
    const query = q.trim().toLowerCase();
    if (query && !(e.name || '').toLowerCase().includes(query) && !(e.phone || '').includes(query)) return false;
    if (skip !== 'view' && !VIEWS[curView].fn(e)) return false;
    if (sourceFilter !== 'all' && e.source !== sourceFilter) return false;
    return true;
  };
  const rank = (e) => (isOpen(e) && e.followUpOn ? dayDiff(e.followUpOn) : 9999);
  const list = useMemo(
    () => list0.filter((e) => passes(e)).sort((a, b) => rank(a) - rank(b) || new Date(b.createdAt) - new Date(a.createdAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, q, curView, sourceFilter],
  );

  const hello = (e) => `Hi ${e.name}, thanks for asking about ${biz?.name}.${e.planId ? ` The ${e.planId.name} plan is ${rupees(e.planId.amount)}.` : ''} Would you like to come in for a visit?`;
  const count = (fn) => list0.filter(fn).length;
  const monthName = now.toLocaleDateString('en-IN', { month: 'long' });
  const monthIn = list0.filter((e) => thisMonth(e.createdAt));
  const monthJoined = monthIn.filter((e) => e.status === 'joined').length;
  const nToday = count(VIEWS.today.fn), nMissed = count(VIEWS.overdue.fn), nOpen = count(isOpen);


  if (!all && loadError) {
    const missing = loadError.status === 404;
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
        <TopBar title="Enquiries" navigation={navigation} />
        <View style={{ padding: 16 }}>
          <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
            <View style={[styles.emptyIcon, { backgroundColor: c.primarySoft }]}><Icon name="person-add-outline" size={24} color={c.primary} /></View>
            <Text style={[styles.emptyTitle, { color: c.text }]}>{missing ? 'Enquiries isn’t available on the server yet' : 'Couldn’t load enquiries'}</Text>
            <Text style={[styles.emptyText, { color: c.textMuted }]}>
              {missing ? 'This needs the latest server update. Once the server is updated, your enquiries will show up here.' : `Something went wrong: ${loadError.message}. Check your connection and try again.`}
            </Text>
            <Button title="Try again" variant="secondary" onPress={load} />
          </Card>
        </View>
      </SafeAreaView>
    );
  }
  if (!all) return <ScreenSkeleton navigation={navigation} />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
      <TopBar title="Enquiries" navigation={navigation} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} progressBackgroundColor={c.card} />}>
        {/* 1. title, ⋯, one main button — same pattern as Money and Members */}
        <CompactHeader
          title="Enquiries"
          menu={[
            nToday + nMissed > 0 && { icon: 'logo-whatsapp', label: `Message the ${nToday + nMissed} to call`, go: () => setBulk({ title: 'to call back', people: list0.filter((e) => e.phone && (VIEWS.today.fn(e) || VIEWS.overdue.fn(e))).map((e) => ({ _id: e._id, name: e.name, phone: e.phone, balance: 0, message: hello(e) })) }) },
          ]}
          mainLabel="Enquiry"
          onMain={() => setEditing({})}
        />

        {list0.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
            <View style={[styles.emptyIcon, { backgroundColor: c.primarySoft }]}><Icon name="person-add-outline" size={24} color={c.primary} /></View>
            <Text style={[styles.emptyTitle, { color: c.text }]}>No enquiries yet</Text>
            <Text style={[styles.emptyText, { color: c.textMuted }]}>
              When someone asks about joining, add them here with a date to call back. You’ll see who to call each day, and turn them into a {W.member} in one tap when they join.
            </Text>
            <Button title="Add first enquiry" onPress={() => setEditing({})} />
          </Card>
        ) : (
          <>
            {/* 2. the four numbers in one slim strip (tap one to show that list) */}
            <NumberStrip items={[
              { label: 'Call today', value: String(nToday), ink: nToday ? c.warningDark : undefined, on: curView === 'today', onPress: () => setView('today') },
              { label: 'Missed', value: String(nMissed), ink: nMissed ? c.dangerDark : undefined, on: curView === 'overdue', onPress: () => setView('overdue') },
              { label: 'Open', value: String(nOpen), on: curView === 'open', onPress: () => setView('open') },
              { label: `Joined · ${monthName.slice(0, 3)}`, value: String(monthJoined), ink: monthJoined ? c.successDark : undefined, on: curView === 'joined', onPress: () => setView('joined') },
            ]} />

            {/* 3. search + filter, chips, one line per person */}
            <ListCard>
              <SearchFilter value={q} onChange={setQ} placeholder="Search by name or phone" filterOn={sourceFilter !== 'all' ? 1 : 0} onFilter={() => setFiltersOpen((o) => !o)} />
              {filtersOpen && (
                <View style={[styles.filterPanel, { backgroundColor: c.cardSubtle }]}>
                  <Text style={[styles.filterLabel, { color: c.textMuted }]}>CAME FROM</Text>
                  <ChipRow small value={sourceFilter} onPick={setSourceFilter} options={[{ id: 'all', label: 'Anywhere' }, ...Object.entries(SOURCES).map(([id, label]) => ({ id, label }))]} />
                </View>
              )}
              <ChipRow value={curView} onPick={setView} options={TABS.map((id) => ({
                id,
                label: { today: 'Today', overdue: 'Missed', open: 'Open', joined: 'Joined', lost: 'Lost' }[id],
                count: list0.filter((e) => passes(e, 'view') && VIEWS[id].fn(e)).length,
              }))} />
              <View>
                {list.map((e, i) => {
                  const f = followText(e);
                  const st = STATUS[e.status] || STATUS.new;
                  return (
                    <CompactRow
                      key={e._id}
                      last={i === list.length - 1}
                      title={e.name}
                      onPress={() => setEditing(e)}
                      tags={[isOpen(e)
                        ? { text: f.text, tone: { red: 'late', amber: 'due' }[f.tone] || 'none' }
                        : { text: st.label, bg: tint(st.dot, theme.isDark ? 0.2 : 0.12, c.card), ink: st.dot }]}
                      sub={[e.planId?.name, SOURCES[e.source]].filter(Boolean).join(' · ') || `asked ${shortDate(e.createdAt)}`}
                      button={isOpen(e) && e.phone
                        ? { label: 'Message', icon: 'logo-whatsapp', primary: true, a11y: `WhatsApp ${e.name}`, onPress: () => Linking.openURL(waLink(e.phone, hello(e))) }
                        : e.status === 'joined' && e.memberId
                          ? { label: 'Open', onPress: () => navigation.navigate('MemberDetail', { id: e.memberId }) }
                          : { label: 'Open', onPress: () => setEditing(e) }}
                    />
                  );
                })}
                {list.length === 0 && <Text style={[styles.none, { color: c.textMuted }]}>{q ? `Nobody matches “${q}”.` : VIEWS[curView].empty}</Text>}
              </View>
              {list.length > 0 && <ColorKey items={[['Missed', 'late'], ['Call today', 'due'], ['Later', 'none']]} />}
            </ListCard>
            <Text style={[styles.foot, { color: c.textMuted }]}>Tap a name to edit, call, or mark them joined</Text>
          </>
        )}
      </ScrollView>

      {editing && (
        <EnquiryModal
          biz={biz}
          plans={plans}
          enquiry={editing._id ? editing : null}
          canDelete={isOwner || (biz?.access ? biz.access.level >= 3 : true)}
          onDelete={() => { const e = editing; setEditing(null); askDelete(e); }}
          onJoined={() => { const e = editing; setEditing(null); setJoining(e); }}
          onSaved={() => { setEditing(null); load(); }}
          onClose={() => setEditing(null)}
        />
      )}
      <AddMemberModal
        visible={!!joining}
        biz={biz}
        initial={joining ? { name: joining.name, phone: joining.phone, planId: joining.planId?._id } : null}
        onClose={() => setJoining(null)}
        onMemberAdded={(member) => { if (joining && member?._id) patch(joining._id, { status: 'joined', memberId: member._id }); }}
      />
      {bulk && <BulkRemindModal visible title={bulk.title} people={bulk.people} biz={biz} onClose={() => setBulk(null)} />}
    </SafeAreaView>
  );
}

// a choice pill and a field label
function Pill({ on, label, onPress, dot }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, { backgroundColor: on ? c.primarySoft : c.cardSubtle, borderColor: on ? c.primary : c.border }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <Text style={{ fontSize: 12.5, color: on ? c.primaryDark : c.textSecondary, fontWeight: on ? '700' : '500' }}>{label}</Text>
    </TouchableOpacity>
  );
}
function Legend({ children }) {
  const { theme } = useTheme();
  return <Text style={[styles.legend, { color: theme.colors.text }]}>{children}</Text>;
}

// Add or edit one enquiry
function EnquiryModal({ biz, plans, enquiry, canDelete, onDelete, onJoined, onSaved, onClose }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [form, setForm] = useState(() => ({
    name: enquiry?.name || '',
    phone: enquiry?.phone || '',
    planId: enquiry?.planId?._id || '',
    source: enquiry?.source || 'walk_in',
    followUpOn: enquiry ? (enquiry.followUpOn ? isoDay(enquiry.followUpOn) : '') : inDays(1),
    note: enquiry?.note || '',
    status: enquiry?.status || 'new',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const validDate = form.followUpOn && /^\d{4}-\d{2}-\d{2}$/.test(form.followUpOn) && !Number.isNaN(new Date(form.followUpOn).getTime());

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (form.followUpOn && !validDate) { setError('Call-back date should look like 2026-12-01'); return; }
    setSaving(true);
    setError('');
    try {
      const body = { ...form, planId: form.planId || null, followUpOn: form.followUpOn || null };
      if (enquiry) await api(`/businesses/${biz._id}/enquiries/${enquiry._id}`, { method: 'PATCH', body });
      else await api(`/businesses/${biz._id}/enquiries`, { method: 'POST', body });
      onSaved();
    } catch (err) {
      setError(err.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible onClose={onClose} title={enquiry ? 'Edit enquiry' : 'New enquiry'} maxHeight="92%">
      {error ? <Text style={{ color: c.danger, marginBottom: 10 }}>{error}</Text> : null}
      <Input label="Name *" value={form.name} onChangeText={set('name')} placeholder="Who asked" autoCapitalize="words" />
      <Input label="Phone" value={form.phone} onChangeText={set('phone')} placeholder="10-digit mobile" keyboardType="phone-pad" />

      <Legend>Interested in</Legend>
      <View style={styles.wrap}>
        <Pill on={!form.planId} label="Not sure yet" onPress={() => set('planId')('')} />
        {plans.map((p) => <Pill key={p._id} on={form.planId === p._id} label={`${p.name} · ${rupees(p.amount)}`} onPress={() => set('planId')(p._id)} />)}
      </View>

      <Legend>How did they find you?</Legend>
      <View style={styles.wrap}>
        {Object.entries(SOURCES).map(([v, l]) => <Pill key={v} on={form.source === v} label={l} onPress={() => set('source')(v)} />)}
      </View>

      <Legend>Call back on</Legend>
      <View style={styles.wrap}>
        {[['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7]].map(([l, n]) => (
          <Pill key={l} on={form.followUpOn === inDays(n)} label={l} onPress={() => set('followUpOn')(inDays(n))} />
        ))}
        <Pill on={!form.followUpOn} label="No date" onPress={() => set('followUpOn')('')} />
      </View>
      <Input
        value={form.followUpOn}
        onChangeText={set('followUpOn')}
        placeholder="or type a date: YYYY-MM-DD"
        hint={validDate ? `Call back ${new Date(form.followUpOn).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}` : undefined}
      />

      {enquiry && (
        <>
          <Legend>Status</Legend>
          <View style={styles.wrap}>
            {['new', 'follow_up', 'lost'].map((v) => <Pill key={v} on={form.status === v} dot={STATUS[v].dot} label={STATUS[v].label} onPress={() => set('status')(v)} />)}
            {enquiry.status === 'joined' && <Pill on dot={STATUS.joined.dot} label="Joined" onPress={() => {}} />}
          </View>
        </>
      )}

      <Input label="Note" value={form.note} onChangeText={set('note')} placeholder="e.g. wants morning batch, will come with a friend" multiline autoCapitalize="sentences" />

      <View style={styles.modalActions}>
        {enquiry && canDelete ? (
          <TouchableOpacity onPress={onDelete} style={[styles.round, { borderColor: c.dangerBorder }]} accessibilityLabel="Delete enquiry">
            <Icon name="trash-outline" size={16} color={c.dangerDark} />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }} />
        {enquiry && isOpen(enquiry) ? <Button title="They joined" variant="secondary" onPress={onJoined} /> : null}
        <Button title={enquiry ? 'Save' : 'Add enquiry'} loading={saving} disabled={!form.name.trim()} onPress={save} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  filterPanel: { borderRadius: 10, padding: 10, gap: 6 },
  filterLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.4 },
  safe: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  sub: { fontSize: 12.5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, marginBottom: 12 },
  h1: { fontSize: 24, fontWeight: '700' },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  kpi: { width: '48.8%', borderWidth: 1, borderRadius: 12, padding: 12 },
  kpiIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  kpiLabel: { fontSize: 12, fontWeight: '500' },
  kpiValue: { fontSize: 22, fontWeight: '700', marginTop: 2 },
  kpiNote: { fontSize: 11.5, marginTop: 2 },
  funnelHead: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  funnelBar: { flexDirection: 'row', gap: 3, height: 26, borderRadius: 6, overflow: 'hidden' },
  funnelSeg: { justifyContent: 'center', paddingHorizontal: 6, minWidth: 0 },
  funnelText: { fontSize: 11, fontWeight: '600' },
  funnelSum: { fontSize: 12, marginTop: 8 },
  tabs: { gap: 6, paddingVertical: 4, marginBottom: 10 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1 },
  tabText: { fontSize: 12.5 },
  tabCount: { fontSize: 11.5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 42, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 99, borderWidth: 1 },
  none: { textAlign: 'center', paddingVertical: 28, fontSize: 13.5 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 14.5, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 1 },
  follow: { fontSize: 13, fontWeight: '700' },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  pillText: { fontSize: 11.5, fontWeight: '600' },
  note: { fontSize: 12.5, marginTop: 8 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  round: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  foot: { textAlign: 'center', fontSize: 12, marginTop: 4 },
  emptyIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  legend: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
});
