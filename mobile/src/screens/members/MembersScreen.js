import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  Linking,
  Modal as RNModal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBiz } from '../../context/BizContext';
import { useTheme } from '../../context/ThemeContext';
import { api, rupees, waLink, remindMsg } from '../../api/api';
import { refreshAll } from '../../api/queryClient';
import { downloadFile } from '../../api/download';
import { words } from '../../constants/wording';
import Icon from '../../components/Icon';
import Avatar from '../../components/Avatar';
import TopBar from '../../components/TopBar';
import { ScreenSkeleton, Spinner } from '../../components/Loader';
import AddMemberModal from '../modals/AddMemberModal';
import BulkRemindModal from '../modals/BulkRemindModal';
import { CompactHeader, NumberStrip, ListCard, SearchFilter, ChipRow, CompactRow, ColorKey } from '../../components/Compact';

// The simpler list (design: "Tenants v3", same as the web app on phones).
// One button up top, the month's money in one card, four tabs that say what's in them,
// rows that lead with the room, grouped by what to do first, one bar to remind everyone,
// and a three-tap Collect sheet.
const DAY = 86400000;
const dayStart = (d = new Date()) => new Date(new Date(d).toDateString());
const daysLate = (m) => (m.balance > 0 && m.owingSince ? Math.max(0, Math.round((dayStart() - dayStart(m.owingSince)) / DAY)) : 0);
const daysUntil = (d) => Math.ceil((new Date(d) - new Date()) / DAY);
const shortDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const MODES = [['upi', 'UPI'], ['cash', 'Cash'], ['bank_transfer', 'Bank']];
const MODE_NAME = { upi: 'UPI', cash: 'Cash', bank_transfer: 'Bank', card: 'Card', other: 'Other' };
const SORTS = [['late', 'Most late first'], ['owed', 'Most owed first'], ['renew', 'Due soonest'], ['name', 'Name A → Z']];
// links from the Dashboard (?filter=owing etc.) land on the matching tab
const TAB_FROM_FILTER = { owing: 'owe', expired: 'owe', soon: 'soon', renewing: 'soon', clear: 'paid', all: 'all' };

export default function MembersScreen({ navigation, route }) {
  const { biz } = useBiz();
  const { theme } = useTheme();
  const c = theme.colors;
  const dark = theme.isDark;
  const W = words(biz?.type);
  const isHostel = biz?.type === 'hostel';
  const canAdd = (biz?.access ? biz.access.level : 3) >= 1;
  const Title = `${W.member[0].toUpperCase()}${W.member.slice(1)}s`;

  const [members, setMembers] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [groups, setGroups] = useState([]);
  const [plans, setPlans] = useState([]);
  const [collected, setCollected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [tab, setTab] = useState(TAB_FROM_FILTER[route?.params?.filter] || 'owe');
  const [chip, setChip] = useState('all');
  const [q, setQ] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [planFilter, setPlanFilter] = useState('all');
  const [sortBy, setSortBy] = useState('late');
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [sheet, setSheet] = useState(null); // { m, amt, mode }
  const [toast, setToast] = useState(null);
  const [adding, setAdding] = useState(null); // {} or { roomId }
  const [bulk, setBulk] = useState(null);

  useEffect(() => {
    const f = route?.params?.filter;
    if (f && TAB_FROM_FILTER[f]) setTab(TAB_FROM_FILTER[f]);
  }, [route?.params?.filter]);

  const load = useCallback(async () => {
    if (!biz?._id) return;
    try {
      const calls = [
        api(`/businesses/${biz._id}/members`),
        api(`/businesses/${biz._id}/groups`).catch(() => []),
        api(`/businesses/${biz._id}/plans`).catch(() => []),
        api(`/businesses/${biz._id}/dashboard`).catch(() => null),
        isHostel ? api(`/businesses/${biz._id}/rooms`).catch(() => []) : Promise.resolve([]),
      ];
      const [m, g, p, d, r] = await Promise.all(calls);
      setMembers(Array.isArray(m) ? m : []);
      setGroups(Array.isArray(g) ? g : []);
      setPlans(Array.isArray(p) ? p : []);
      setCollected(d?.collectedThisMonth ?? null);
      setRooms(Array.isArray(r) ? r : []);
    } catch (err) {
      Alert.alert('Could not load', err.message);
      setMembers((x) => x || []);
    }
  }, [biz?._id, isHostel]);

  useEffect(() => { load(); }, [load]);
  // coming back from a member's page (a payment, an edit) refreshes the list
  useEffect(() => navigation.addListener('focus', () => { load(); }), [navigation, load]);
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 8000); return () => clearTimeout(t); }, [toast]);

  const onRefresh = async () => { setRefreshing(true); await refreshAll(); await load(); setRefreshing(false); };

  // ---- who is in which tab ----
  const isPaused = (m) => m.subscription?.status === 'paused';
  const active = (m) => m.status === 'active';
  const isOwe = (m) => active(m) && m.balance > 0;
  const isSoon = (m) => active(m) && !isPaused(m) && m.balance <= 0 && m.nextRenewal && daysUntil(m.nextRenewal) >= 0 && daysUntil(m.nextRenewal) <= 7;
  const isPaid = (m) => active(m) && m.balance <= 0 && !isSoon(m) && !isPaused(m);
  const isAll = (m) => m.status !== 'left';
  const TABS = [
    { id: 'owe', label: 'Owe', fn: isOwe, ink: c.moneyRed },
    { id: 'soon', label: 'Due soon', fn: isSoon, ink: c.moneyAmber },
    { id: 'paid', label: 'Paid', fn: isPaid, ink: c.moneyGreen },
    { id: 'all', label: 'All', fn: isAll, ink: c.text },
  ];

  const roomById = useMemo(() => new Map(rooms.map((r) => [r._id, r])), [rooms]);
  const roomOf = (m) => roomById.get(m.roomId?._id || m.roomId);
  const groupOf = (m) => { const r = roomOf(m); return r ? String(r.groupId?._id || r.groupId) : String(m.groupId?._id || m.groupId || ''); };
  const floorName = (r) => groups.find((g) => g._id === String(r.groupId?._id || r.groupId))?.floors?.find((f) => f._id === r.floorId)?.name;

  // quick chips: floors when there is one building, buildings when there are several, else batches
  const oneBuilding = isHostel && groups.length === 1 ? groups[0] : null;
  const chips = oneBuilding && (oneBuilding.floors || []).length > 1
    ? oneBuilding.floors.map((f) => ({ id: `f:${f._id}`, label: f.name, test: (m) => roomOf(m)?.floorId === f._id, roomTest: (r) => r.floorId === f._id }))
    : groups.length > 1 || (!isHostel && groups.length > 0)
      ? groups.map((g) => ({ id: `g:${g._id}`, label: g.name, test: (m) => groupOf(m) === g._id, roomTest: (r) => String(r.groupId?._id || r.groupId) === g._id }))
      : [];
  const curChip = chips.find((x) => x.id === chip);

  const all = members || [];
  const query = q.trim().toLowerCase();
  const base = all.filter((m) => {
    if (curChip && !curChip.test(m)) return false;
    if (planFilter !== 'all' && (m.planName || '') !== planFilter) return false;
    if (!query) return true;
    const room = roomOf(m);
    return (m.name || '').toLowerCase().includes(query) || (m.phone || '').includes(query)
      || (m.planName || '').toLowerCase().includes(query) || (room && String(room.roomNo).toLowerCase() === query.replace(/^room\s*/, ''));
  });
  const cur = TABS.find((t) => t.id === tab);
  const sorter = {
    late: (a, b) => daysLate(b) - daysLate(a) || (b.balance || 0) - (a.balance || 0),
    owed: (a, b) => (b.balance || 0) - (a.balance || 0),
    renew: (a, b) => (a.nextRenewal ? new Date(a.nextRenewal) : Infinity) - (b.nextRenewal ? new Date(b.nextRenewal) : Infinity),
    name: (a, b) => (a.name || '').localeCompare(b.name || ''),
  }[sortBy];
  const list = base.filter(cur.fn).sort(sorter);

  const freeRooms = isHostel && tab === 'all' && !picking && !query
    ? rooms.filter((r) => (r.occupied || 0) < r.capacity).filter((r) => !curChip || curChip.roomTest(r))
      .sort((a, b) => String(a.roomNo).localeCompare(String(b.roomNo), undefined, { numeric: true }))
    : [];

  // ---- the month ----
  const owedNow = all.filter(isOwe).reduce((s, m) => s + m.balance, 0);

  // ---- reminders ----
  const renewMsg = (m) => `Hi ${m.name}, your ${W.fee.toLowerCase()} of ${rupees(m.planAmount || 0)} for ${biz?.name} is due on ${shortDate(m.nextRenewal)}. Thank you!`;
  const msgFor = (m) => (m.balance > 0 ? remindMsg(biz, m, m.balance) : renewMsg(m));
  const toPerson = (m) => ({ _id: m._id, name: m.name, phone: m.phone, balance: Math.max(0, m.balance), message: msgFor(m) });
  const chosen = all.filter((m) => picked.has(m._id));
  const owing = list.filter(isOwe);
  const soonList = list.filter(isSoon);
  let bar = null;
  if (picking) {
    if (chosen.length) bar = { title: `${chosen.length} picked`, sub: 'Each gets a WhatsApp reminder', cta: `Remind ${chosen.length}`, go: () => openBulk('you picked', chosen.map(toPerson)) };
  } else if (tab === 'soon') {
    if (soonList.length) bar = { title: `${soonList.length} due this week`, sub: 'A friendly heads-up first', cta: 'Remind all', go: () => openBulk('due this week', soonList.map(toPerson)) };
  } else if (tab !== 'paid' && owing.length) {
    bar = { title: `${owing.length} owe ${rupees(owing.reduce((s, m) => s + m.balance, 0))}`, sub: 'One by one on WhatsApp', cta: 'Remind all', go: () => openBulk('who owe', owing.map(toPerson)) };
  }

  // the sender closes (unmounts) between runs, so each run starts from the first person
  const openBulk = (title, people) => setBulk({ title, people });
  const togglePick = (id) => setPicked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const stopPicking = () => { setPicking(false); setPicked(new Set()); };

  if (!members) return <ScreenSkeleton navigation={navigation} />;

  // ---- colours ----
  const tone = {
    red: { bg: dark ? 'rgba(248,113,113,0.14)' : '#FEF1F0', ink: c.moneyRed },
    amber: { bg: dark ? 'rgba(251,191,36,0.14)' : '#FFF6E5', ink: c.moneyAmber },
    green: { bg: dark ? 'rgba(52,211,153,0.12)' : '#ECFDF3', ink: c.moneyGreen },
    grey: { bg: dark ? 'rgba(148,163,184,0.14)' : '#EEF1F6', ink: c.textMuted },
  };
  const line = dark ? 'rgba(255,255,255,0.08)' : '#E7E9F0';

  const rightSide = (m) => {
    if (m.balance > 0) {
      const late = daysLate(m);
      return { amount: rupees(m.balance), amtInk: c.moneyRed, chip: late > 0 ? `${late} day${late === 1 ? '' : 's'} late` : 'due today', chipTone: late >= 7 ? 'red' : 'amber' };
    }
    if (isSoon(m)) {
      const d = daysUntil(m.nextRenewal);
      return { amount: rupees(m.planAmount || 0), amtInk: c.text, chip: d <= 0 ? 'due today' : d === 1 ? 'due tomorrow' : `due in ${d} days`, chipTone: 'amber' };
    }
    if (isPaused(m)) return { amount: 'Paused', amtInk: c.textMuted, chip: 'no fees', chipTone: 'grey' };
    const d = m.nextRenewal ? daysUntil(m.nextRenewal) : null;
    return { amount: m.balance < 0 ? `+${rupees(-m.balance)}` : 'Paid', amtInk: c.moneyGreen, chip: d != null && d > 0 ? `next in ${d} days` : 'paid up', chipTone: 'green' };
  };
  const where = (m) => {
    const r = roomOf(m);
    if (isHostel && r) return [floorName(r), m.planName].filter(Boolean).join(' · ');
    return [m.planName, m.groupId?.name].filter(Boolean).join(' · ') || m.phone || '';
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, { backgroundColor: c.background }]}>
      <TopBar title={Title} navigation={navigation} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} progressBackgroundColor={c.card} />}>

        {/* 1. title, ⋯, one main button — same pattern as Money */}
        <CompactHeader
          title={Title}
          menu={[
            canAdd && { icon: 'cash-outline', label: 'Record a payment', go: () => { setTab('owe'); Alert.alert('Record a payment', `Tap Collect on the ${W.member} who paid.`); } },
            { icon: 'checkbox-outline', label: `Pick several ${W.members}`, go: () => { setPicking(true); setPicked(new Set()); } },
            isHostel && { icon: 'bed-outline', label: 'Rooms and beds', go: () => navigation.navigate('Rooms') },
            { icon: 'download-outline', label: 'Download the list', go: () => downloadFile(`/businesses/${biz._id}/export/balances.csv`, `${biz?.name}-${W.members}.csv`).catch((e) => Alert.alert('Could not download', e.message)) },
          ]}
          mainLabel={W.member[0].toUpperCase() + W.member.slice(1)}
          onMain={canAdd ? () => setAdding({}) : null}
        />

        {/* 2. the four numbers in one slim strip */}
        <NumberStrip items={[
          { label: 'Collected', value: collected == null ? '…' : rupees(collected), ink: c.moneyGreen },
          { label: 'To collect', value: rupees(owedNow), ink: owedNow ? c.moneyRed : undefined },
          { label: Title, value: String(all.filter(isAll).length) },
          isHostel && rooms.length > 0
            ? { label: 'Beds filled', value: `${rooms.reduce((s, r) => s + Math.min(r.occupied || 0, r.capacity), 0)}/${rooms.reduce((s, r) => s + r.capacity, 0)}` }
            : { label: 'Due soon', value: String(all.filter(isSoon).length), ink: all.some(isSoon) ? c.moneyAmber : undefined },
        ]} />

        {/* 3. search + filter, chips, one line per person */}
        <ListCard>
          <SearchFilter
            value={q}
            onChange={setQ}
            placeholder={isHostel ? 'Name, phone or room' : 'Name, phone or plan'}
            filterOn={(planFilter !== 'all' ? 1 : 0) + (sortBy !== 'late' ? 1 : 0)}
            onFilter={() => setFiltersOpen((o) => !o)}
          />
          {filtersOpen && (
            <View style={[styles.filterPanel, { backgroundColor: c.cardSubtle }]}>
              {plans.length > 0 && (
                <>
                  <Text style={[styles.groupTitle, { color: c.textMuted }]}>PLAN</Text>
                  <ChipRow small value={planFilter} onPick={setPlanFilter} options={[{ id: 'all', label: 'All plans' }, ...plans.map((p) => ({ id: p.name, label: p.name }))]} />
                </>
              )}
              <Text style={[styles.groupTitle, { color: c.textMuted }]}>SORT</Text>
              <ChipRow small value={sortBy} onPick={setSortBy} options={SORTS.map(([id, label]) => ({ id, label }))} />
            </View>
          )}
          <ChipRow value={tab} onPick={(id) => { setTab(id); setPicked(new Set()); }} options={TABS.map((t) => ({ id: t.id, label: t.label, count: base.filter(t.fn).length }))} />
          {chips.length > 0 && (
            <ChipRow small value={chip} onPick={(id) => { setChip(id); setPicked(new Set()); }}
              options={[{ id: 'all', label: oneBuilding ? 'All floors' : `All ${W.groups.split(' ')[0].toLowerCase()}` }, ...chips]} />
          )}

          {picking && (
            <View style={[styles.pickingBar, { backgroundColor: c.primarySoft }]}>
              <Text style={{ color: c.primaryDark, fontWeight: '600', fontSize: 13, flex: 1 }}>Tap {W.members} to pick them · {picked.size} picked</Text>
              <TouchableOpacity onPress={stopPicking}><Text style={{ color: c.primaryDark, fontWeight: '800', fontSize: 13.5 }}>Done</Text></TouchableOpacity>
            </View>
          )}

          <View>
            {list.map((m, i) => {
              const r = rightSide(m);
              const room = roomOf(m);
              const on = picked.has(m._id);
              const owes = m.balance > 0;
              const soon = isSoon(m);
              const late = daysLate(m);
              const tagTone = owes ? (late >= 7 ? 'late' : 'due') : soon ? 'due' : isPaused(m) ? 'none' : 'paid';
              return (
                <CompactRow
                  key={m._id}
                  last={i === list.length - 1}
                  selected={on}
                  title={m.name}
                  onPress={() => (picking ? togglePick(m._id) : navigation.navigate('MemberDetail', { id: m._id }))}
                  onLongPress={() => { setPicking(true); setPicked(new Set([m._id])); }}
                  left={picking ? (
                    <View style={[styles.box, { borderColor: on ? c.primary : '#CBD5E1', backgroundColor: on ? c.primary : 'transparent' }]}>
                      {on ? <Icon name="checkmark" size={14} color="#fff" /> : null}
                    </View>
                  ) : null}
                  tags={[
                    isHostel && room && { text: `Room ${room.roomNo}`, tone: 'none' },
                    { text: tagTone === 'paid' ? `✓ ${r.chip}` : r.chip, tone: tagTone },
                  ]}
                  sub={where(m)}
                  amount={r.amount}
                  amountInk={r.amtInk}
                  amountSub={owes ? 'owes' : soon ? 'due' : r.amtInk === c.moneyGreen ? 'paid' : ''}
                  button={picking ? null
                    : owes && canAdd && active(m) ? { label: 'Collect', primary: true, onPress: () => setSheet({ m, amt: m.balance, mode: 'upi' }) }
                    : soon && m.phone && active(m) ? { label: 'Remind', icon: 'logo-whatsapp', onPress: () => Linking.openURL(waLink(m.phone, renewMsg(m))) }
                    : { label: 'Open', onPress: () => navigation.navigate('MemberDetail', { id: m._id }) }}
                />
              );
            })}
            {!list.length && (
              <View style={{ paddingVertical: 18, alignItems: 'center', gap: 4 }}>
                <Text style={[styles.name, { color: c.text, textAlign: 'center' }]}>
                  {query ? `Nobody matches “${q}”` : { owe: 'Nobody owes money', soon: 'Nothing due this week', paid: 'Nobody has paid yet', all: `No ${W.members} here` }[tab]}
                </Text>
                <Text style={[styles.meta, { color: c.textMuted, textAlign: 'center' }]}>
                  {query ? 'Try a name, phone number or room.' : { owe: 'Everyone here is paid up.', soon: `You'll see ${W.members} here a week before their fee is due.`, paid: 'Payments you record show up here.', all: `Add a ${W.member} to get started.` }[tab]}
                </Text>
              </View>
            )}
          </View>
          {list.length > 0 && <ColorKey items={[['Paid', 'paid'], ['Week+ late', 'late'], ['Due', 'due']]} />}
        </ListCard>

        {freeRooms.length > 0 && (
          <ListCard>
            <Text style={[styles.groupTitle, { color: c.textMuted }]}>FREE BEDS · {freeRooms.reduce((s, r) => s + r.capacity - (r.occupied || 0), 0)}</Text>
            <View>
              {freeRooms.map((r, i) => {
                const free = r.capacity - (r.occupied || 0);
                return (
                  <CompactRow
                    key={r._id}
                    last={i === freeRooms.length - 1}
                    title={`Room ${r.roomNo}`}
                    tags={[{ text: `${free} bed${free === 1 ? '' : 's'} free`, tone: 'paid' }]}
                    sub={[floorName(r), r.capacity === 1 ? 'Single' : `${r.capacity} sharing`].filter(Boolean).join(' · ')}
                    amount={r.bedRent ? rupees(r.bedRent) : null}
                    amountSub={r.bedRent ? 'a month' : null}
                    button={canAdd ? { label: 'Fill bed', onPress: () => setAdding({ roomId: r._id }) } : null}
                  />
                );
              })}
            </View>
          </ListCard>
        )}

        <Text style={[styles.tip, { color: c.textMuted }]}>Tap a {W.member} to open · long-press to pick several</Text>
      </ScrollView>

      {/* 5. one bar at the bottom */}
      {bar && (
        <View style={[styles.bottom, { backgroundColor: c.card, borderColor: line }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 13.5 }} numberOfLines={1}>{bar.title}</Text>
            <Text style={{ color: c.textMuted, fontSize: 12 }} numberOfLines={1}>{bar.sub}</Text>
          </View>
          <TouchableOpacity onPress={bar.go} style={styles.remindAll}>
            <Icon name="logo-whatsapp" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{bar.cta}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* after saving a payment: say what happened, offer the receipt */}
      {toast && (
        <View style={styles.toast} accessibilityLiveRegion="polite">
          <View style={styles.toastTick}><Icon name="checkmark" size={15} color="#fff" /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{rupees(toast.amt)} from {toast.m.name}</Text>
            <Text style={{ color: '#94A3B8', fontSize: 12 }}>{toast.left > 0 ? `${rupees(toast.left)} still due` : 'Paid in full'} · {MODE_NAME[toast.mode]}</Text>
          </View>
          {toast.m.phone ? (
            <TouchableOpacity
              onPress={() => {
                Linking.openURL(waLink(toast.m.phone, `Hi ${toast.m.name}, we received ${rupees(toast.amt)} (${MODE_NAME[toast.mode]}) for ${biz?.name}. ${toast.left > 0 ? `${rupees(toast.left)} is still due.` : 'You are all paid up.'} Thank you!`));
                setToast(null);
              }}
              style={styles.toastGo}>
              <Icon name="logo-whatsapp" size={14} color="#052E16" />
              <Text style={{ color: '#052E16', fontWeight: '800', fontSize: 13 }}>Receipt</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => setToast(null)} accessibilityLabel="Close" style={{ padding: 4 }}>
            <Icon name="close" size={15} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      )}

      {sheet && (
        <CollectSheet
          sheet={sheet}
          setSheet={setSheet}
          room={roomOf(sheet.m)}
          late={daysLate(sheet.m)}
          theme={theme}
          tone={tone}
          onDone={(paid) => { setSheet(null); setToast(paid); load(); }}
        />
      )}

      <AddMemberModal
        visible={!!adding}
        biz={biz}
        initialRoomId={adding?.roomId}
        onClose={() => setAdding(null)}
        onMemberAdded={() => load()}
      />
      {bulk && <BulkRemindModal visible title={bulk.title} people={bulk.people} biz={biz} onClose={() => setBulk(null)} />}
    </SafeAreaView>
  );
}

// Collect: a bottom sheet, three taps (how much, how they paid, save)
export function CollectSheet({ sheet, setSheet, room, late, theme, tone, onDone }) {
  const c = theme.colors;
  const insets = useSafeAreaInsets(); // keep the buttons above the gesture bar
  const dark = theme.isDark;
  const { m, amt, mode } = sheet;
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const amount = custom !== '' ? Number(custom) : amt;
  const ok = amount > 0;
  const half = Math.round(m.balance / 2);
  const presets = [[m.balance, 'Full amount'], half > 0 && half !== m.balance && [half, 'Half now']].filter(Boolean);
  const field = dark ? 'rgba(255,255,255,0.12)' : '#E2E5EC';
  const busy = useRef(false);

  const save = async () => {
    if (!ok || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      await api(`/members/${m._id}/payments`, { method: 'POST', body: { amount, mode, date: new Date().toISOString() } });
      onDone({ m, amt: amount, mode, left: Math.max(0, m.balance - amount) });
    } catch (e) {
      setError(e.message || 'Could not save');
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <RNModal visible transparent statusBarTranslucent navigationBarTranslucent animationType="slide" onRequestClose={() => setSheet(null)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={styles.sheetScrim} onPress={() => setSheet(null)} />
        <View style={[styles.sheet, { backgroundColor: c.card, paddingBottom: 24 + insets.bottom }]}>
          <View style={styles.grip} />
          <View style={styles.sheetHead}>
            {room ? (
              <View style={[styles.room, { backgroundColor: tone.red.bg }]}>
                <Text style={[styles.roomLabel, { color: tone.red.ink }]}>ROOM</Text>
                <Text style={[styles.roomNo, { color: tone.red.ink }]}>{room.roomNo}</Text>
              </View>
            ) : <Avatar name={m.name} size={42} />}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '800' }} numberOfLines={1}>Collect from {m.name.split(' ')[0]}</Text>
              <Text style={{ color: c.moneyRed, fontSize: 12.5, fontWeight: '600' }}>Owes {rupees(m.balance)}{late > 0 ? ` · ${late} day${late === 1 ? '' : 's'} late` : ''}</Text>
            </View>
            <TouchableOpacity accessibilityLabel="Close" onPress={() => setSheet(null)} style={[styles.sheetX, { backgroundColor: tone.grey.bg }]}>
              <Icon name="close" size={16} color={c.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sheetLabel, { color: c.textMuted }]}>HOW MUCH</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {presets.map(([v, l]) => {
              const on = custom === '' && amt === v;
              return (
                <TouchableOpacity key={l} onPress={() => { setCustom(''); setSheet({ ...sheet, amt: v }); }}
                  style={[styles.amountBtn, { borderColor: on ? c.primary : field, backgroundColor: on ? c.primarySoft : c.card }]}>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: on ? c.primaryDark : c.text }}>{rupees(v)}</Text>
                  <Text style={{ fontSize: 11.5, color: c.textMuted }}>{l}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={[styles.custom, { borderColor: field }]}>
            <Text style={{ color: c.textMuted, fontSize: 13.5 }}>Other amount</Text>
            <TextInput value={custom} onChangeText={(t) => setCustom(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="₹" placeholderTextColor={c.textMuted}
              style={{ flex: 1, textAlign: 'right', fontSize: 16, fontWeight: '700', color: c.text, paddingVertical: 0 }} />
          </View>

          <Text style={[styles.sheetLabel, { color: c.textMuted }]}>PAID BY</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {MODES.map(([v, l]) => {
              const on = mode === v;
              return (
                <TouchableOpacity key={v} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setSheet({ ...sheet, mode: v })}
                  style={[styles.modeBtn, { borderColor: on ? c.primary : field, backgroundColor: on ? c.primarySoft : c.card }]}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: on ? c.primaryDark : c.text }}>{l}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {error ? <Text style={{ color: c.danger, marginTop: 10 }}>{error}</Text> : null}
          <TouchableOpacity disabled={!ok || saving} onPress={save} style={[styles.save, { backgroundColor: c.primary, opacity: !ok || saving ? 0.55 : 1 }]}>
            {saving ? <Spinner size={18} color="#fff" track="rgba(255,255,255,0.3)" /> : (
              <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '800' }}>{ok ? `Save ${rupees(amount)} · ${MODE_NAME[mode]}` : 'Enter an amount'}</Text>
            )}
          </TouchableOpacity>
          <Text style={{ textAlign: 'center', fontSize: 12, color: c.textMuted, marginTop: 8 }}>
            {ok && amount < m.balance ? `${rupees(m.balance - amount)} will still be due` : ok && amount > m.balance ? `${rupees(amount - m.balance)} goes in advance` : 'Clears what they owe'}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  filterPanel: { borderRadius: 10, padding: 10, gap: 6 },
  safe: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 110, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h1: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  sub: { fontSize: 12.5, fontWeight: '500', marginTop: 1 },
  more: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  addBtn: { height: 42, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  addText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  cardLabel: { fontSize: 12.5, fontWeight: '600' },
  monthNum: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2, flexWrap: 'wrap' },
  big: { fontSize: 22, fontWeight: '800' },
  bar: { height: 8, borderRadius: 99, marginTop: 8, overflow: 'hidden', flexDirection: 'row' },
  legend: { flexDirection: 'row', gap: 14, marginTop: 8, flexWrap: 'wrap' },
  legendText: { fontSize: 12 },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14 },
  tab: { flex: 1, height: 50, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tabNum: { fontSize: 16, fontWeight: '800' },
  tabLabel: { fontSize: 11.5, fontWeight: '600' },
  searchRow: { flexDirection: 'row', gap: 8 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  filterBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1, justifyContent: 'center' },
  pickingBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, gap: 8 },
  groupTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginTop: 4, marginLeft: 2 },
  row: { borderRadius: 16, padding: 12 },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  room: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  roomLabel: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.4, opacity: 0.85 },
  roomNo: { fontSize: 15, fontWeight: '800', maxWidth: 40 },
  name: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12.5, marginTop: 1 },
  metaSmall: { fontSize: 11.5, marginTop: 1 },
  amount: { fontSize: 16, fontWeight: '800' },
  statusChip: { height: 21, paddingHorizontal: 8, borderRadius: 99, justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  wa: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cta: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
  free: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed' },
  fill: { height: 38, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, justifyContent: 'center' },
  empty: { padding: 24, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed' },
  tip: { textAlign: 'center', fontSize: 12, opacity: 0.8 },
  bottom: { position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingLeft: 14, borderRadius: 18, borderWidth: 1, shadowColor: '#0F172A', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  remindAll: { height: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#16A34A', flexDirection: 'row', alignItems: 'center', gap: 6 },
  toast: { position: 'absolute', left: 12, right: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: '#0F172A', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  toastTick: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center' },
  toastGo: { height: 36, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#22C55E', flexDirection: 'row', alignItems: 'center', gap: 5 },
  menuScrim: { flex: 1, backgroundColor: 'rgba(15,23,42,0.25)', alignItems: 'flex-end', paddingTop: 120, paddingRight: 16 },
  menu: { width: 240, borderRadius: 16, borderWidth: 1, padding: 6, shadowColor: '#0F172A', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 10, borderRadius: 10 },
  menuIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sheetScrim: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 },
  grip: { width: 40, height: 4, borderRadius: 99, backgroundColor: '#D8DCE6', alignSelf: 'center', marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetX: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  sheetLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginTop: 16, marginBottom: 6 },
  amountBtn: { flex: 1, height: 58, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  custom: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, marginTop: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1 },
  modeBtn: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  save: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
});
