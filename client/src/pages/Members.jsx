import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api, rupees, waLink, remindMsg, download, can, ADD } from '../api.js';
import { useBiz } from '../App.jsx';
import { words } from '../wording.js';
import BulkRemind, { owingMessage, renewalMessage } from '../BulkRemind.jsx';
import MoveRoom, { RoomHistory } from '../MoveRoom.jsx';
import {
  formatINR,
  formatRupees,
  getRenewalThreshold,
  getPlanColor,
  getPlanPillClass,
  getMonthlyDelta,
} from '../data/gymData.js';
import {
  Avatar, Empty, Field, PlusIcon, SearchIcon, XIcon,
  ChevronIcon, UsersIcon, UserIcon, PhoneIcon, CreditCardIcon, RupeeIcon,
  CalendarIcon, BedIcon, BuildingIcon, LayersIcon, TagIcon, DoorIcon, WhatsAppIcon, CheckIcon, AlertIcon,
  AlertCircleIcon, CheckCircleIcon, SendIcon, EditIcon, TrashIcon,
  CopyIcon, ClockIcon, CalendarClockIcon, SlidersHorizontalIcon, FilterIcon, ChevronDownIcon, DownloadIcon,
} from '../ui.jsx';

// the Sort menu; header clicks can pick the other directions, which still get a name
const SORT_OPTIONS = [['late_desc', 'Most late first'], ['balance_desc', 'Most owed first'], ['renewal_asc', 'Expiring soonest'], ['joined_desc', 'Newest joined']];
const SORT_LABELS = {
  ...Object.fromEntries(SORT_OPTIONS),
  late_asc: 'Least late first', balance_asc: 'Least owed first', renewal_desc: 'Expiring latest',
  joined_asc: 'Oldest joined', visit_desc: 'Away longest', visit_asc: 'Visited recently',
};

export default function Members() {
  const biz = useBiz();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [adding, setAdding] = useState(false);
  const [picking, setPicking] = useState(false); // "Record payment": choose who paid
  const [addToRoom, setAddToRoom] = useState(null); // ?room=<id> (a free bed on the Rooms board)
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(() => searchParams.get('filter') || 'all'); // a key of inTab below: the status dropdown
  const [planFilter, setPlanFilter] = useState('all');
  const [renewalFilter, setRenewalFilter] = useState(() => searchParams.get('renewal') || searchParams.get('renewalFilter') || 'all'); // 'all' | '7d' | '15d' | '30d' | 'overdue'
  const [groupFilter, setGroupFilter] = useState('all');
  const [floorFilter, setFloorFilter] = useState('all'); // hostels: a floor of the chosen building
  const [roomFilter, setRoomFilter] = useState('all');
  const [sortBy, setSortBy] = useState(() => searchParams.get('sortBy') || searchParams.get('sort') || 'late_desc'); // 'renewal_asc' | 'joined_desc' | 'name_asc' | 'balance_desc'

  // a member opens on their own page; stopPropagation keeps a nested click from opening it twice
  const navigate = useNavigate();
  const openMember = (id, e) => { e?.stopPropagation(); navigate(`/members/${id}`); };
  const [collectModal, setCollectModal] = useState(null);
  const [reminderModal, setReminderModal] = useState(null);
  const [bulk, setBulk] = useState(null); // "Remind all": { title, people }

  useEffect(() => {
    const f = searchParams.get('filter');
    if (f) setFilter(f);
    const s = searchParams.get('sortBy') || searchParams.get('sort');
    if (s) setSortBy(s);
    const r = searchParams.get('renewal') || searchParams.get('renewalFilter');
    if (r) setRenewalFilter(r);
    // ?add=1 (from the home screen's Add Member) opens the add form once
    if (searchParams.get('add')) {
      setAdding(true);
      setAddToRoom(searchParams.get('room'));
      setSearchParams((p) => { p.delete('add'); p.delete('room'); return p; }, { replace: true });
    }
  }, [searchParams]);

  const { data: members } = useQuery({
    queryKey: ['members', biz._id],
    queryFn: () => api(`/businesses/${biz._id}/members`),
  });

  const { data: plans } = useQuery({
    queryKey: ['plans', biz._id],
    queryFn: () => api(`/businesses/${biz._id}/plans`),
  });

  const { data: groups } = useQuery({
    queryKey: ['groups', biz._id],
    queryFn: () => api(`/businesses/${biz._id}/groups`),
  });

  const { data: rooms } = useQuery({
    queryKey: ['rooms', biz._id],
    queryFn: () => api(`/businesses/${biz._id}/rooms`),
    enabled: biz.type === 'hostel',
  });

  const now = new Date();
  const attendanceOn = biz.attendanceEnabled !== false;
  const DAY = 1000 * 60 * 60 * 24;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysUntil = (d) => Math.ceil((new Date(d) - now) / DAY);
  const isPaused = (m) => m.subscription?.status === 'paused';
  // days since the member was last marked present (or since joining, if never); null when attendance is off
  const daysAway = (m) => {
    if (!attendanceOn || m.lastVisit === undefined) return null;
    const since = m.lastVisit ? new Date(`${m.lastVisit}T00:00:00`) : new Date(m.joinDate);
    return Math.max(0, Math.floor((startOfToday - since) / DAY));
  };
  // days since the oldest unpaid fee fell due (0 when nothing is overdue)
  const daysLate = (m) => (m.balance > 0 && m.owingSince
    ? Math.max(0, Math.floor((startOfToday - new Date(new Date(m.owingSince).toDateString())) / DAY))
    : 0);
  const live = (m) => m.status === 'active' && !isPaused(m);
  const renewIn = (m, from, to) => {
    if (!live(m) || !m.nextRenewal) return false;
    const d = daysUntil(m.nextRenewal);
    return d >= from && d <= to;
  };
  // which members each status (the dropdown, the summary cards and ?filter=) shows
  const inTab = {
    all: (m) => m.status !== 'left',
    expired: (m) => live(m) && daysLate(m) > 0, // plan ended and the fee is still unpaid
    owing: (m) => m.status === 'active' && m.balance > 0,
    today: (m) => renewIn(m, 0, 0),
    e3: (m) => renewIn(m, 1, 3),
    e7: (m) => renewIn(m, 4, 7),
    e30: (m) => renewIn(m, 8, 30),
    away30: (m) => live(m) && (daysAway(m) ?? 0) >= 30,
    never: (m) => attendanceOn && live(m) && m.lastVisit === null,
    new: (m) => {
      const j = new Date(m.joinDate);
      return m.status !== 'left' && j.getMonth() === now.getMonth() && j.getFullYear() === now.getFullYear();
    },
    soon: (m) => {
      if (m.status !== 'active' || isPaused(m) || !m.nextRenewal) return false;
      const d = daysUntil(m.nextRenewal);
      return d >= 0 && d <= 7;
    },
    away: (m) => m.status === 'active' && !isPaused(m) && (daysAway(m) ?? 0) >= 7,
    clear: (m) => m.status === 'active' && m.balance <= 0,
    paused: (m) => m.status === 'active' && isPaused(m),
    renewing: (m) => {
      if (m.status !== 'active' || !m.nextRenewal) return false;
      const d = daysUntil(m.nextRenewal);
      return d >= 0 && d <= 30;
    },
    left: (m) => m.status === 'left',
  };
  const filterCounts = Object.fromEntries(Object.entries(inTab).map(([k, fn]) => [k, (members || []).filter(fn).length]));
  const sumOf = (fn, field) => (members || []).filter(fn).reduce((s, m) => s + (m[field] || 0), 0);
  const [selected, setSelected] = useState(() => new Set());
  const toggleSelected = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  // header clicks: a second click on the same column flips the direction
  const sortOn = (col, firstDir) => setSortBy((cur) => (cur === `${col}_${firstDir}` ? `${col}_${firstDir === 'asc' ? 'desc' : 'asc'}` : `${col}_${firstDir}`));

  const isFilterActive = Boolean(
    q || filter !== 'all' || planFilter !== 'all' || renewalFilter !== 'all' ||
    groupFilter !== 'all' || floorFilter !== 'all' || roomFilter !== 'all'
  );
  const clearAdvanced = () => {
    setFilter('all'); setPlanFilter('all'); setRenewalFilter('all');
    setGroupFilter('all'); setFloorFilter('all'); setRoomFilter('all');
    setSelected(new Set());
  };
  const resetAllFilters = () => { setQ(''); clearAdvanced(); };

  // hostels: building → floor → room, each list narrowed by the one before it
  const roomById = useMemo(() => new Map((rooms || []).map((r) => [r._id, r])), [rooms]);
  const filterBuilding = (groups || []).find((g) => g._id === groupFilter);
  const filterFloors = filterBuilding?.floors || [];
  const filterRooms = sortRooms(
    (rooms || []).filter((r) =>
      (groupFilter === 'all' || String(r.groupId?._id || r.groupId) === groupFilter) &&
      (floorFilter === 'all' || r.floorId === floorFilter)),
    groups || []
  );
  const chooseBuilding = (id) => { setGroupFilter(id); setFloorFilter('all'); setRoomFilter('all'); };
  const chooseFloor = (id) => { setFloorFilter(id); setRoomFilter('all'); };

  const planMatch = (m, p) => (m.planName || m.planId?.name || '').toLowerCase() === p.toLowerCase();
  const roomOf = (m) => roomById.get(m.roomId?._id || m.roomId);
  const groupOf = (m) => { const room = roomOf(m); return room ? String(room.groupId?._id || room.groupId) : String(m.groupId?._id || m.groupId || ''); };
  // skip: leave one dropdown out (to count that dropdown's options)
  const passes = (m, skip) => {
    const query = q.trim().toLowerCase();
    if (query) {
      const matchName = (m.name || '').toLowerCase().includes(query);
      const matchPhone = (m.phone || '').includes(query);
      const matchPlan = (m.planName || m.planId?.name || '').toLowerCase().includes(query);
      const matchRoom = String(m.roomId?.roomNo || '').toLowerCase() === query.replace(/^room\s*/, '');
      if (!matchName && !matchPhone && !matchPlan && !matchRoom) return false;
    }
    if (skip !== 'status' && !(inTab[filter] || inTab.all)(m)) return false;
    if (skip !== 'plan' && planFilter !== 'all' && !planMatch(m, planFilter)) return false;
    if (skip !== 'group' && groupFilter !== 'all' && groupOf(m) !== groupFilter) return false;
    if (skip !== 'group' && floorFilter !== 'all' && roomOf(m)?.floorId !== floorFilter) return false;
    if (skip !== 'group' && roomFilter !== 'all' && roomOf(m)?._id !== roomFilter) return false;
    if (renewalFilter !== 'all') { // only from links like ?renewal=7d
      if (!m.nextRenewal) return false;
      const diff = daysUntil(m.nextRenewal);
      if (renewalFilter === '7d' && (diff < 0 || diff > 7)) return false;
      if (renewalFilter === '15d' && (diff < 0 || diff > 15)) return false;
      if (renewalFilter === '30d' && (diff < 0 || diff > 30)) return false;
      if (renewalFilter === 'overdue' && diff >= 0) return false;
    }
    return true;
  };

  const filtered = useMemo(() => (members || [])
    .filter((m) => passes(m))
    .sort((a, b) => {
      const [col, dir] = sortBy.split('_');
      const sign = dir === 'desc' ? -1 : 1;
      if (col === 'renewal') {
        if (!a.nextRenewal) return 1; // no date always last
        if (!b.nextRenewal) return -1;
        return (new Date(a.nextRenewal) - new Date(b.nextRenewal)) * sign;
      }
      if (col === 'joined') return (new Date(a.joinDate) - new Date(b.joinDate)) * sign;
      if (col === 'balance') return ((a.balance || 0) - (b.balance || 0)) * sign;
      if (col === 'late') return (daysLate(a) - daysLate(b)) * sign || ((a.balance || 0) - (b.balance || 0)) * sign;
      if (col === 'visit') return ((daysAway(a) ?? -1) - (daysAway(b) ?? -1)) * sign;
      return 0;
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [members, q, filter, planFilter, renewalFilter, groupFilter, floorFilter, roomFilter, roomById, sortBy]);

  const hasRooms = Boolean(rooms && rooms.length > 0);

  if (!members) {
    return (
      <div aria-hidden="true">
        <div className="compact-stat-grid" style={{ marginBottom: 16 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="card skeleton" style={{ minHeight: 90 }} />
          ))}
        </div>
        <div className="card skeleton" style={{ minHeight: 340 }} />
      </div>
    );
  }

  const W = words(biz.type);
  const shortDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const owingTotal = sumOf(inTab.owing, 'balance');
  const soonTotal = sumOf(inTab.soon, 'planAmount');
  const maxLate = Math.max(0, ...(members || []).filter(inTab.owing).map(daysLate));

  // ---- status: one word + detail, used by the Status column, the phone cards and the row action ----
  const statusOf = (m) => {
    if (m.status === 'left') return { key: 'left', label: 'Left', tone: 'grey', sub: m.leftAt ? `left ${shortDate(m.leftAt)}` : 'no longer coming' };
    if (isPaused(m)) return { key: 'paused', label: 'Paused', tone: 'grey', sub: 'no fees while paused' };
    if (m.balance > 0) {
      const late = daysLate(m);
      return late > 0
        ? { key: 'late', label: 'Expired', tone: 'red', sub: `${plural(late, 'day')} late${m.unpaidCycles > 1 ? ` · ${m.unpaidCycles} fees` : ''}` }
        : { key: 'due', label: 'Due today', tone: 'orange', sub: `${rupees(m.balance)} due` };
    }
    if (m.nextRenewal) {
      const d = daysUntil(m.nextRenewal);
      if (d >= 0 && d <= 7) return { key: 'soon', label: 'Expiring', tone: 'amber', sub: d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days` };
      return { key: 'ok', label: 'Active', tone: 'green', sub: d > 0 ? `renews in ${d} days` : 'renewal due' };
    }
    return { key: 'ok', label: 'Active', tone: 'green', sub: '' };
  };
  const visitInfo = (m) => {
    const d = daysAway(m);
    if (d === null) return null;
    const text = !m.lastVisit ? 'No visits yet' : d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`;
    return { text, away: d >= 7 };
  };
  const placeOf = (m) => {
    if (m.roomId) return roomLabel((rooms || []).find((r) => r._id === (m.roomId._id || m.roomId)) || m.roomId, groups || []);
    return m.groupId?.name || '';
  };
  const lastPaidText = (m) => (m.lastPaidAt ? `Last paid ${shortDate(m.lastPaidAt)}${m.lastPaidMode ? ` · ${m.lastPaidMode.toUpperCase() === 'UPI' ? 'UPI' : m.lastPaidMode[0].toUpperCase() + m.lastPaidMode.slice(1)}` : ''}` : 'No payments yet');
  const missYouMsg = (m) => `Hi ${m.name}, we haven't seen you at ${biz.name} for a few days. Hope all is well. See you soon!`;
  const collect = (m) => setCollectModal({ member: m, balance: m.balance > 0 ? m.balance : m.planAmount });
  const remind = (m) => setReminderModal({ member: m, balance: m.balance, nextRenewalDate: m.nextRenewal ? new Date(m.nextRenewal) : null });
  // the one button a row needs: collect what's owed, remind before expiry, call someone who stopped coming
  const ctaFor = (m, st, visit) => {
    if (st.key === 'late' || st.key === 'due') return <button type="button" className="mx-paid" onClick={() => collect(m)}>Collect</button>;
    if (st.key === 'soon') return <button type="button" className="mx-ghost" onClick={() => remind(m)}>Remind</button>;
    if (st.key === 'ok' && visit?.away && m.phone) return <a className="mx-ghost" href={`tel:${m.phone}`}><PhoneIcon size={14} /> Call</a>;
    return null;
  };
  const waFor = (m, st, visit) => {
    if (!m.phone || m.status === 'left') return null;
    if (st.key === 'late' || st.key === 'due') return waLink(m.phone, owingMessage(biz, m));
    if (st.key === 'soon') return waLink(m.phone, renewalMessage(biz, m));
    if (visit?.away) return waLink(m.phone, missYouMsg(m));
    return waLink(m.phone, `Hi ${m.name}, `);
  };

  // labels for statuses reached from links or summary cards (?filter=e7 etc.)
  const STATUS_LABELS = {
    all: `All ${W.member}s`, expired: 'Expired', owing: 'Owe money', today: 'Expiring today', e3: 'Expiring in 1–3 days', e7: 'Expiring in 4–7 days',
    e30: 'Expiring in 8–30 days', away: 'Not coming 7+ days', away30: 'Not coming 30+ days', never: 'Never came', clear: 'Paid up',
    paused: 'Paused', left: 'Left', new: 'Joined this month', soon: 'Expiring this week', renewing: 'Renewing in 30 days',
  };
  const countWhere = (skip, fn) => (members || []).filter((m) => passes(m, skip) && fn(m)).length;
  // status tabs, like "Follow up today" on Collect
  const TABS = [
    { id: 'all', label: 'All', dot: '#94A3B8', hint: `Everyone active, most urgent first` },
    { id: 'owing', label: 'Expired', dot: '#DC2626', hint: 'Plan ended and the fee is still unpaid' },
    { id: 'soon', label: 'Expiring', dot: '#D97706', hint: 'Plan ends in the next 7 days' },
    attendanceOn && { id: 'away', label: 'Not coming', dot: '#7C3AED', hint: 'Away 7+ days: a quick call keeps them coming' },
    { id: 'clear', label: 'Paid up', dot: '#16A34A', hint: 'Nothing due right now' },
    (filterCounts.paused > 0 || filter === 'paused') && { id: 'paused', label: 'Paused', dot: '#64748B', hint: 'No fees while paused; the days are added back' },
    (filterCounts.left > 0 || filter === 'left') && { id: 'left', label: 'Left', dot: '#64748B', hint: 'No longer coming; their history is kept' },
  ].filter(Boolean).map((t) => ({ ...t, count: countWhere('status', inTab[t.id]) }));
  const tabHit = TABS.find((t) => t.id === filter);
  const pickTab = (id) => { setFilter(id); setSelected(new Set()); };

  // the same small icon cards as Collect; each opens its tab
  const cards = [
    { id: 'owing', icon: RupeeIcon, tone: 'red', label: 'Owe money', value: rupees(owingTotal), note: filterCounts.owing ? `${filterCounts.owing}${maxLate > 0 ? ` · up to ${maxLate}d late` : ''}` : 'nobody', valueTone: filterCounts.owing ? 'red' : '' },
    { id: 'soon', icon: CalendarClockIcon, tone: 'amber', label: 'Expiring this week', value: rupees(soonTotal), note: plural(filterCounts.soon, W.member) },
    attendanceOn && { id: 'away', icon: AlertIcon, tone: 'violet', label: 'Not coming', value: String(filterCounts.away), note: 'away 7+ days' },
    { id: 'all', icon: CheckIcon, tone: 'green', label: `Active ${W.member}s`, value: String(filterCounts.all), note: filterCounts.new ? `+${filterCounts.new} this month` : 'this month' },
  ].filter(Boolean);

  const planOptions = [
    { value: 'all', label: 'All plans', count: countWhere('plan', () => true) },
    ...(plans || []).map((p) => ({ value: p.name, label: `${p.name} · ${rupees(p.amount)}`, count: countWhere('plan', (m) => planMatch(m, p.name)) })),
  ];
  const groupOptions = [
    { value: 'all', label: `All ${W.groups.toLowerCase()}`, count: countWhere('group', () => true) },
    ...(groups || []).map((g) => ({ value: g._id, label: g.name, count: countWhere('group', (m) => groupOf(m) === g._id) })),
  ];
  const activeChips = [
    !tabHit && { key: 'status', label: STATUS_LABELS[filter] || filter, clear: () => setFilter('all') },
    planFilter !== 'all' && { key: 'plan', label: planFilter, clear: () => setPlanFilter('all') },
    groupFilter !== 'all' && { key: 'group', label: filterBuilding?.name || W.group, clear: () => chooseBuilding('all') },
    floorFilter !== 'all' && { key: 'floor', label: filterFloors.find((x) => x._id === floorFilter)?.name || 'Floor', clear: () => chooseFloor('all') },
    roomFilter !== 'all' && { key: 'room', label: `Room ${roomById.get(roomFilter)?.roomNo || ''}`, clear: () => setRoomFilter('all') },
    renewalFilter !== 'all' && { key: 'renew', label: renewalFilter === 'overdue' ? 'Renewal date passed' : `Renews within ${renewalFilter.replace('d', '')} days`, clear: () => setRenewalFilter('all') },
  ].filter(Boolean);

  const chosen = filtered.filter((m) => selected.has(m._id));
  const allChosen = filtered.length > 0 && chosen.length === filtered.length;
  const remindChosen = () => setBulk({
    id: Date.now(),
    title: 'you picked',
    people: chosen.map((m) => ({
      _id: m._id, name: m.name, phone: m.phone,
      note: m.balance > 0 ? `${rupees(m.balance)} due` : m.nextRenewal ? `renews ${shortDate(m.nextRenewal)}` : '',
      message: m.balance > 0 ? owingMessage(biz, m) : renewalMessage(biz, m),
    })),
  });
  const remindAllOwing = () => {
    const owing = (members || []).filter(inTab.owing).sort((a, b) => b.balance - a.balance);
    setBulk({ id: Date.now(), title: 'who owe', people: owing.map((m) => ({ _id: m._id, name: m.name, phone: m.phone, note: `${rupees(m.balance)} due`, message: owingMessage(biz, m) })) });
  };
  const SortHead = ({ col, first, children, align }) => {
    const on = sortBy.startsWith(`${col}_`);
    const dir = on ? sortBy.split('_')[1] : null;
    return (
      <th scope="col" aria-sort={on ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} style={align ? { textAlign: align } : undefined}>
        <button type="button" className={`mx-sort ${on ? 'on' : ''}`} onClick={() => sortOn(col, first)}>
          {children}{on && <span aria-hidden="true">{dir === 'asc' ? ' ↑' : ' ↓'}</span>}
        </button>
      </th>
    );
  };
  const openRow = (e, id) => { if (!e.target.closest('a, button, input, label, select')) openMember(id, e); };
  const title = W.member === 'member' ? 'Members' : `${W.member[0].toUpperCase()}${W.member.slice(1)}s`;
  const subtitle = [
    plural(filterCounts.all, `active ${W.member}`),
    filterCounts.new > 0 && `${filterCounts.new} joined this month`,
  ].filter(Boolean).join(' · ');
  const actions = [
    { key: 'member', label: `Add ${W.member}`, short: W.member[0].toUpperCase() + W.member.slice(1), icon: PlusIcon, primary: true, onClick: () => setAdding(true) },
    { key: 'pay', label: 'Record payment', short: 'Payment', icon: RupeeIcon, onClick: () => setPicking(true) },
    { key: 'remind', label: 'Remind all who owe', short: 'Remind', icon: WhatsAppIcon, onClick: remindAllOwing, disabled: !filterCounts.owing },
    { key: 'export', label: 'Export', short: 'Export', icon: DownloadIcon, onClick: () => download(`/businesses/${biz._id}/export/balances.csv`, `${biz.name}-${title.toLowerCase()}.csv`) },
  ].filter((a) => can(biz, ADD) || !['member', 'pay'].includes(a.key)); // see-only staff

  return (
    <>
      {/* header and quick actions, laid out like Collect */}
      <div className="page-header home-header db-head">
        <div className="page-title-wrap">
          <p className="db-date">{subtitle}</p>
          <h1 className="db-hello">{title}</h1>
        </div>
        <nav className="db-quick" aria-label="Quick actions">
          {actions.map((a) => (
            <button key={a.key} type="button" className={`db-quick-btn ${a.primary ? 'pri' : ''} q-${a.key}`} onClick={a.onClick} disabled={a.disabled}>
              <span className="db-quick-icon"><a.icon size={15} /></span>
              <span className="db-quick-long">{a.label}</span>
              <span className="db-quick-short">{a.short}</span>
            </button>
          ))}
        </nav>
      </div>

      <AnimatePresence>
        {picking && (
          <PickMember
            members={(members || []).filter((m) => m.status === 'active')}
            word={W.member}
            onClose={() => setPicking(false)}
            onPick={(m) => { setPicking(false); collect(m); }}
          />
        )}
      </AnimatePresence>

      {members.length > 0 && (
        <section className="db-today mx2-cards" aria-label="At a glance">
          {cards.map((c) => (
            <button key={c.id} type="button" className={`db-today-card mx2-card-btn ${filter === c.id ? 'on' : ''}`} aria-pressed={filter === c.id} onClick={() => pickTab(c.id)}>
              <span className={`db-today-icon ${c.tone}`}><c.icon size={17} /></span>
              <span className="db-today-text">
                <span className="db-label">{c.label}</span>
                <b className={c.valueTone || ''}>{c.value}</b>
              </span>
              <span className="db-today-note">{c.note}</span>
            </button>
          ))}
        </section>
      )}

      <AnimatePresence>
        {adding && (
          <AddMemberModal biz={biz} plans={plans || []} groups={groups || []} rooms={rooms || []} roomId={addToRoom}
            onClose={() => { setAdding(false); setAddToRoom(null); }} />
        )}
      </AnimatePresence>

      {!members.length && !adding && (
        <Empty
          icon={UsersIcon}
          title={`No ${W.member}s yet`}
          hint={`Add your first ${W.member} to start tracking fees and payments.`}
          action={
            <button className="btn" onClick={() => setAdding(true)}>
              <PlusIcon size={15} /> Add first {W.member}
            </button>
          }
        />
      )}

      {members.length > 0 && (
        <section className="mx-list mx2" aria-label={`${W.member} list`}>
          {/* status tabs */}
          <div className="db-tabs mx2-tabs" role="tablist" aria-label={`Show ${W.member}s`}>
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={filter === t.id} aria-controls="mx2-list"
                className={`db-tab ${filter === t.id ? 'on' : ''}`} onClick={() => pickTab(t.id)}>
                <i className="db-dot" style={{ background: t.dot }} aria-hidden="true" />
                {t.label}
                <span className="db-tab-count">{t.count}</span>
              </button>
            ))}
          </div>

          <div className="mx-toolbar">
            <div className="mx-toolbar-top">
              <label className="mx-search">
                <SearchIcon size={15} />
                <span className="sr-only">Search {W.member}s</span>
                <input type="search" placeholder="Search by name, phone or plan" value={q} onChange={(e) => setQ(e.target.value)} />
                {q && (
                  <button type="button" className="mx-icon-btn" onClick={() => setQ('')} aria-label="Clear search"><XIcon size={14} /></button>
                )}
              </label>
              {(plans || []).length > 0 && (
                <Menu label="Plan" prefix="Plan:" valueLabel={planFilter === 'all' ? 'All' : planFilter} active={planFilter !== 'all'}
                  options={planOptions} value={planFilter} onPick={setPlanFilter} />
              )}
              {(groups || []).length > 0 && (
                <Menu label={W.group} prefix={`${W.group}:`} valueLabel={groupFilter === 'all' ? 'All' : filterBuilding?.name} active={groupFilter !== 'all'}
                  options={groupOptions} value={groupFilter} onPick={chooseBuilding} />
              )}
              {filterFloors.length > 0 && (
                <Menu label="Floor" prefix="Floor:" valueLabel={floorFilter === 'all' ? 'All' : filterFloors.find((x) => x._id === floorFilter)?.name} active={floorFilter !== 'all'}
                  options={[{ value: 'all', label: 'All floors' }, ...filterFloors.map((x) => ({ value: x._id, label: x.name }))]} value={floorFilter} onPick={chooseFloor} />
              )}
              {hasRooms && filterRooms.length > 0 && (
                <Menu label="Room" prefix="Room:" valueLabel={roomFilter === 'all' ? 'All' : roomById.get(roomFilter)?.roomNo || ''} active={roomFilter !== 'all'}
                  options={[{ value: 'all', label: 'All rooms' }, ...filterRooms.map((r) => ({ value: r._id, label: `Room ${r.roomNo}`, count: `${r.occupied}/${r.capacity}` }))]} value={roomFilter} onPick={setRoomFilter} />
              )}
              <Menu className="mx-menu-sort" label="Sort by" prefix="Sort:" valueLabel={SORT_LABELS[sortBy] || 'Custom'}
                options={SORT_OPTIONS.map(([value, label]) => ({ value, label }))} value={sortBy} onPick={setSortBy} align="right" />
            </div>
            <p className="mx2-hint">{tabHit ? tabHit.hint : STATUS_LABELS[filter]}</p>

            {activeChips.length > 0 && (
              <div className="mx-chips" aria-label="Active filters">
                <span className="mx-chips-count">{filtered.length} shown ·</span>
                {activeChips.map((c) => (
                  <button key={c.key} type="button" className="mx-chip" onClick={c.clear} aria-label={`Remove filter: ${c.label}`}>
                    {c.label} <XIcon size={12} />
                  </button>
                ))}
                <button type="button" className="mx-link mx-chips-clear" onClick={clearAdvanced}>Clear all</button>
              </div>
            )}
          </div>

          <div id="mx2-list" role="tabpanel">
            {filtered.length === 0 ? (
              <div className="mx-empty">
                <p>{q ? `Nobody matches “${q}”.` : filter === 'owing' ? 'Nobody owes money. Everyone is paid up.' : filter === 'away' ? `Every ${W.member} came in this week.` : filter === 'soon' ? 'No plans expire this week.' : 'Nobody here with these filters.'}</p>
                {isFilterActive && <button type="button" className="mx-link" onClick={() => { resetAllFilters(); setSelected(new Set()); }}>Show all {W.member}s</button>}
              </div>
            ) : (
              <>
                {/* wide screens: a table */}
                <div className="mx-table-wrap">
                  <table className="mx-table mx2-table">
                    <thead>
                      <tr>
                        <th scope="col" className="mx-check">
                          <input type="checkbox" aria-label={`Select all ${filtered.length} shown`} checked={allChosen}
                            onChange={() => setSelected(allChosen ? new Set() : new Set(filtered.map((m) => m._id)))} />
                        </th>
                        <th scope="col"><span className="mx-th">{W.member}</span></th>
                        <SortHead col="late" first="desc">Status</SortHead>
                        <th scope="col"><span className="mx-th">{hasRooms ? 'Plan & room' : `Plan & ${W.group.toLowerCase()}`}</span></th>
                        {attendanceOn && <SortHead col="visit" first="desc">Last visit</SortHead>}
                        <SortHead col="balance" first="desc" align="right">Balance</SortHead>
                        <th scope="col" style={{ textAlign: 'right' }}><span className="mx-th">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((m) => {
                        const st = statusOf(m);
                        const visit = visitInfo(m);
                        const owes = m.balance > 0;
                        const wa = waFor(m, st, visit);
                        return (
                          <tr key={m._id} className={selected.has(m._id) ? 'chosen' : ''} onClick={(e) => openRow(e, m._id)}>
                            <td className="mx-check">
                              <input type="checkbox" aria-label={`Select ${m.name}`} checked={selected.has(m._id)} onChange={() => toggleSelected(m._id)} />
                            </td>
                            <td>
                              <Link to={`/members/${m._id}`} className="mx-person">
                                <Avatar name={m.name} />
                                <span>
                                  <span className="mx-name">{m.name}</span>
                                  <span className="mx-meta">{m.phone || 'No phone'}</span>
                                </span>
                              </Link>
                            </td>
                            <td>
                              <span className={`mx2-pill ${st.tone}`}><i aria-hidden="true" />{st.label}</span>
                              {st.sub && <span className="mx-meta">{st.sub}</span>}
                            </td>
                            <td>
                              <span className="mx-strong">{m.planName || '—'}</span>
                              {placeOf(m) && <span className="mx-meta">{placeOf(m)}</span>}
                            </td>
                            {attendanceOn && (
                              <td>
                                {visit ? <span className={`mx-visit ${visit.away ? 'amber' : ''}`}><span className="mx-dot" />{visit.text}</span> : <span className="mx-meta">—</span>}
                              </td>
                            )}
                            <td style={{ textAlign: 'right' }}>
                              <span className={`mx-balance ${owes ? 'red' : 'green'}`}>{owes ? rupees(m.balance) : m.balance < 0 ? `+${rupees(-m.balance)}` : 'Paid up'}</span>
                              <span className="mx-meta">{lastPaidText(m)}</span>
                            </td>
                            <td>
                              <span className="mx-actions">
                                {wa && (
                                  <a className="mx-wa" href={wa} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${m.name}`} title="WhatsApp">
                                    <WhatsAppIcon size={15} />
                                  </a>
                                )}
                                {ctaFor(m, st, visit)}
                                <Link to={`/members/${m._id}`} className="mx-open" aria-label={`Open ${m.name}`}><ChevronIcon size={16} /></Link>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* phones: cards with the same columns as labelled fields */}
                <div className="mx2-cardhead">
                  <label>
                    <input type="checkbox" checked={allChosen} onChange={() => setSelected(allChosen ? new Set() : new Set(filtered.map((m) => m._id)))} />
                    {plural(filtered.length, W.member)}
                  </label>
                  {filter === 'owing' && filterCounts.owing > 1 && (
                    <button type="button" className="mx-wa-text" onClick={remindAllOwing}>Remind all</button>
                  )}
                </div>
                <ul className="mx-cards mx2-cardlist">
                  {filtered.map((m) => {
                    const st = statusOf(m);
                    const visit = visitInfo(m);
                    const owes = m.balance > 0;
                    const wa = waFor(m, st, visit);
                    const cta = ctaFor(m, st, visit);
                    return (
                      <li key={m._id} className={`mx-card mx2-card ${selected.has(m._id) ? 'chosen' : ''}`}>
                        <div className="mx2-card-top">
                          <input type="checkbox" aria-label={`Select ${m.name}`} checked={selected.has(m._id)} onChange={() => toggleSelected(m._id)} />
                          <Link to={`/members/${m._id}`} className="mx2-card-who">
                            <Avatar name={m.name} />
                            <span>
                              <span className="mx-name">{m.name}</span>
                              <span className="mx-meta">{m.phone || 'No phone'}</span>
                            </span>
                          </Link>
                          <span className="mx2-card-status">
                            <span className={`mx2-pill ${st.tone}`}><i aria-hidden="true" />{st.label}</span>
                            {st.sub && <span className="mx-meta">{st.sub}</span>}
                          </span>
                        </div>
                        <dl className="mx2-fields">
                          <div><dt>{hasRooms ? 'Plan & room' : `Plan & ${W.group.toLowerCase()}`}</dt><dd>{m.planName || '—'}{placeOf(m) && <span>{placeOf(m)}</span>}</dd></div>
                          {attendanceOn && <div><dt>Last visit</dt><dd className={visit?.away ? 'amber' : ''}>{visit ? visit.text : '—'}</dd></div>}
                          <div className="right"><dt>Balance</dt><dd className={owes ? 'red' : 'green'}><b>{owes ? rupees(m.balance) : m.balance < 0 ? `+${rupees(-m.balance)}` : 'Paid up'}</b></dd></div>
                        </dl>
                        <div className="mx2-card-actions">
                          {wa && <a className="mx2-wa" href={wa} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${m.name}`}><WhatsAppIcon size={16} /></a>}
                          {cta}
                          <Link to={`/members/${m._id}`} className={`mx2-open ${cta ? '' : 'wide'}`} aria-label={`Open ${m.name}`}>{cta ? <ChevronIcon size={16} /> : 'Open'}</Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>

          <div className="mx-foot">
            <span>Showing {filtered.length} of {filter === 'left' ? filterCounts.left : filterCounts.all}</span>
            {filter !== 'left' && filterCounts.left > 0 && !TABS.some((t) => t.id === 'left') && (
              <button type="button" className="mx-link" onClick={() => pickTab('left')}>Show {W.member}s who left ({filterCounts.left})</button>
            )}
          </div>
        </section>
      )}

      {/* selection: a floating bar, like the design */}
      {chosen.length > 0 && (
        <div className="mx2-bulk" role="status">
          <b>{chosen.length} selected</b>
          {chosen.some((m) => m.balance > 0) && <span className="mx2-bulk-due">{rupees(chosen.reduce((s, m) => s + Math.max(0, m.balance), 0))} due</span>}
          <button type="button" className="mx2-bulk-go" onClick={remindChosen}><WhatsAppIcon size={14} /> Remind on WhatsApp</button>
          <button type="button" className="mx2-bulk-x" onClick={() => setSelected(new Set())} aria-label="Clear selection"><XIcon size={13} /></button>
        </div>
      )}

      <AnimatePresence>
        {bulk && <BulkRemind key={bulk.id} title={bulk.title} people={bulk.people} onClose={() => setBulk(null)} />}
      </AnimatePresence>

      {/* Collect Payment Modal */}
      <AnimatePresence>
        {collectModal && (
          <CollectPaymentModal
            member={collectModal.member}
            balance={collectModal.balance}
            plan={null}
            onClose={() => setCollectModal(null)}
            onSuccess={() => {
              qc.invalidateQueries();
              setCollectModal(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Reminder Modal */}
      <AnimatePresence>
        {reminderModal && (
          <ReminderModal
            biz={biz}
            member={reminderModal.member}
            balance={reminderModal.balance}
            nextRenewalDate={reminderModal.nextRenewalDate}
            onClose={() => setReminderModal(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// PROFILE SLIDE-OVER SHEET COMPONENT
export function MemberProfileSheet({ biz, memberId, plans, rooms = [], groups = [], onClose, highlightReminder = false }) {
  const qc = useQueryClient();
  const [activeModal, setActiveModal] = useState(null); // 'collect' | 'reminder' | 'edit' | 'delete'
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['member', memberId],
    queryFn: () => api(`/members/${memberId}`),
    enabled: Boolean(memberId && !isDeleting),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const deleteMember = useMutation({
    mutationFn: () => {
      setIsDeleting(true);
      return api(`/members/${memberId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      onClose();
      qc.removeQueries({ queryKey: ['member', memberId], exact: true });
      qc.invalidateQueries({ queryKey: ['members', biz._id] });
      qc.invalidateQueries({ queryKey: ['dashboard', biz._id] });
    },
    onError: () => {
      setIsDeleting(false);
    },
  });

  if (isError) {
    return (
      <div className="sheet-overlay" onClick={onClose}>
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="sheet-panel"
          onClick={(e) => e.stopPropagation()}>
          <div className="sheet-header">
            <div className="sheet-title">Member Not Found</div>
            <button type="button" className="icon-btn" onClick={onClose} style={{ color: '#FFFFFF' }}>
              <XIcon size={14} />
            </button>
          </div>
          <div className="sheet-body" style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>
            This member may have been removed or no longer exists.
          </div>
        </motion.div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="sheet-overlay" onClick={onClose}>
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="sheet-panel"
          onClick={(e) => e.stopPropagation()}>
          <div className="sheet-header">
            <div className="sheet-title">Loading profile…</div>
          </div>
          <div className="sheet-body">
            <div className="card skeleton" style={{ minHeight: 80 }} />
            <div className="card skeleton" style={{ minHeight: 180 }} />
          </div>
        </motion.div>
      </div>
    );
  }

  const { member, dues = [], payments = [], balance = 0, subscription } = data;
  const plan = subscription?.planId;
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const nextRenewalDate = subscription?.periodEnd ? new Date(subscription.periodEnd) : null;
  const joinDate = new Date(member.joinDate);

  // Generate monthly ledger records from joined date onwards
  const ledgerMonths = [];
  const now = new Date();
  const joinMonthIdx = joinDate.getFullYear() * 12 + joinDate.getMonth();
  const currentMonthIdx = now.getFullYear() * 12 + now.getMonth();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let idx = currentMonthIdx; idx >= joinMonthIdx; idx--) {
    const y = Math.floor(idx / 12);
    const m = idx % 12;
    const mStart = new Date(y, m, 1);
    const mEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);

    const paidInM = payments
      .filter((p) => new Date(p.date) >= mStart && new Date(p.date) <= mEnd)
      .reduce((s, p) => s + p.amount, 0);

    const duesInM = dues.filter((d) => new Date(d.dueDate) >= mStart && new Date(d.dueDate) <= mEnd);
    const unpaidInM = duesInM.filter((d) => d.status !== 'paid').reduce((s, d) => s + d.amount, 0);

    let status = 'paid';
    let label = `₹${paidInM.toLocaleString('en-IN')}`;
    if (unpaidInM > 0) {
      const isPast = duesInM.some((d) => new Date(d.dueDate) < now && d.status !== 'paid');
      status = isPast ? 'overdue' : 'due';
      label = `Due ₹${unpaidInM.toLocaleString('en-IN')}`;
    } else if (paidInM === 0) {
      status = 'none';
      label = '—';
    }

    ledgerMonths.push({
      key: `${y}-${m}`,
      monthName: `${monthNames[m]} ${y}`,
      paid: paidInM,
      due: unpaidInM,
      status,
      label,
    });
  }

  const handleDelete = () => {
    setActiveModal('delete');
  };

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
        className="sheet-panel"
        onClick={(e) => e.stopPropagation()}>
        {/* SECTION 1 — Dark Header (#0F172A) */}
        <div className="sheet-header">
          <div className="sheet-header-top">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="sheet-avatar">
                {member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="sheet-title">{member.name}</h2>
                <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>
                  Joined {joinDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
                <Link to={`/members/${member._id}`} onClick={onClose}
                  style={{ display: 'inline-block', marginTop: 4, fontSize: 12, fontWeight: 600, color: '#C4B8FF', textDecoration: 'none' }}>
                  Open full profile →
                </Link>
              </div>
            </div>

            <div className="row" style={{ gap: 6 }}>
              <button
                type="button"
                className="icon-btn"
                title="Edit member"
                style={{ color: '#94A3B8', borderColor: 'rgba(255,255,255,0.15)' }}
                onClick={() => setActiveModal('edit')}>
                <EditIcon size={14} />
              </button>

              <button
                type="button"
                className="icon-btn"
                title="Delete member"
                style={{ color: '#EF4444', borderColor: 'rgba(255,255,255,0.15)' }}
                onClick={handleDelete}>
                <TrashIcon size={14} />
              </button>

              <button
                type="button"
                className="icon-btn"
                title="Close"
                style={{ color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.15)' }}
                onClick={onClose}>
                <XIcon size={14} />
              </button>
            </div>
          </div>

          <div className="sheet-header-badges">
            <span className="badge blue" style={{ fontSize: 11 }}>
              {plan?.name || 'Standard Plan'}
            </span>
            {member.roomId && rooms.some((r) => r._id === member.roomId) && (
              <span className="badge gray" style={{ fontSize: 11 }}>
                <BedIcon size={11} /> {roomLabel(rooms.find((r) => r._id === member.roomId), groups)}
              </span>
            )}
            {balance > 0 ? (
              <span className="badge red" style={{ fontSize: 11 }}>
                <span className="badge-dot" /> Overdue ₹{balance.toLocaleString('en-IN')}
              </span>
            ) : member.status === 'left' ? (
              <span className="badge gray" style={{ fontSize: 11 }}>Left</span>
            ) : (
              <span className="badge green" style={{ fontSize: 11 }}>
                <span className="badge-dot" /> Paid Up
              </span>
            )}
          </div>
        </div>

        {/* Sheet Content Body */}
        <div className="sheet-body">
          {/* SECTION 2 — Stats Row (3 Mini Cards) */}
          <div className="sheet-stats-row">
            <div className="sheet-stat-card">
              <span className="sheet-stat-label">Total Paid</span>
              <span className="sheet-stat-value" style={{ color: 'var(--green)' }}>
                {rupees(totalPaid)}
              </span>
            </div>

            <div className="sheet-stat-card">
              <span className="sheet-stat-label">Balance Due</span>
              <span className="sheet-stat-value" style={{ color: balance > 0 ? 'var(--red)' : 'var(--text)' }}>
                {balance > 0 ? rupees(balance) : '₹0'}
              </span>
            </div>

            <div className="sheet-stat-card">
              <span className="sheet-stat-label">Next Renewal</span>
              <span className="sheet-stat-value" style={{ fontSize: 12 }}>
                {nextRenewalDate ? nextRenewalDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '—'}
              </span>
            </div>
          </div>

          {/* SECTION 3 — Payment History Table */}
          <div>
            <div className="sheet-section-title">Payment History</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-btn)', overflow: 'hidden' }}>
              <table className="analytics-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>MONTH</th>
                    <th style={{ textAlign: 'right' }}>AMOUNT</th>
                    <th style={{ textAlign: 'right' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerMonths.map((lm) => (
                    <tr key={lm.key}>
                      <td style={{ fontWeight: 500 }}>{lm.monthName}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {lm.paid > 0 ? `₹${lm.paid.toLocaleString('en-IN')}` : lm.due > 0 ? `₹${lm.due.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {lm.status === 'paid' && (
                          <span className="badge green" style={{ fontSize: 10.5, padding: '1px 6px' }}>
                            ✓ Paid
                          </span>
                        )}
                        {lm.status === 'due' && (
                          <span className="badge amber" style={{ fontSize: 10.5, padding: '1px 6px' }}>
                            Due
                          </span>
                        )}
                        {lm.status === 'overdue' && (
                          <span className="badge red" style={{ fontSize: 10.5, padding: '1px 6px' }}>
                            Overdue
                          </span>
                        )}
                        {lm.status === 'none' && (
                          <span className="muted small">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 4 — Contact & Membership Details */}
          <div>
            <div className="sheet-section-title">Contact & plan details</div>
            <div className="sheet-contact-card">
              <div className="sheet-contact-item">
                <span className="sheet-contact-label">
                  <PhoneIcon size={14} /> Phone Number
                </span>
                <span className="sheet-contact-val">
                  {member.phone ? (
                    <a
                      href={`tel:${member.phone}`}
                      style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      +91 {member.phone}
                    </a>
                  ) : (
                    'Not provided'
                  )}
                </span>
              </div>

              <div className="sheet-contact-item">
                <span className="sheet-contact-label">
                  <CalendarIcon size={14} /> Joined Date
                </span>
                <span className="sheet-contact-val">
                  {joinDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>

              <div className="sheet-contact-item">
                <span className="sheet-contact-label">
                  <CreditCardIcon size={14} /> Current Plan
                </span>
                <span className="sheet-contact-val">
                  {plan ? `${plan.name} (${rupees(subscription?.amount ?? plan.amount)} / ${plan.cycleDays}d${subscription?.amount ? ', custom' : ''})` : 'Standard'}
                </span>
              </div>

              {rooms.length > 0 && (
                <div className="sheet-contact-item">
                  <span className="sheet-contact-label">
                    <BedIcon size={14} /> Room
                  </span>
                  <span className="sheet-contact-val">
                    {rooms.some((r) => r._id === String(member.roomId || '')) ? roomLabel(rooms.find((r) => r._id === String(member.roomId)), groups) : 'No room'}
                  </span>
                </div>
              )}
            </div>
            {member.roomMoves?.length > 0 && (
              <>
                <div className="sheet-section-title" style={{ marginTop: 14 }}>Room history</div>
                <RoomHistory moves={member.roomMoves} />
              </>
            )}
          </div>

          {/* SECTION 5 — Action Buttons (Full Width, Stacked) */}
          <div className="sheet-actions-stack">
            <button
              type="button"
              className="btn"
              style={{ width: '100%', minHeight: 36, fontSize: 13, background: 'var(--green)' }}
              onClick={() => setActiveModal('collect')}>
              <CheckIcon size={15} /> Collect Payment
            </button>

            <button
              type="button"
              className={`btn-secondary${highlightReminder ? ' pulse-reminder-btn' : ''}`}
              style={{
                width: '100%',
                minHeight: 36,
                fontSize: 13,
                ...(highlightReminder ? { borderColor: 'var(--green)', color: 'var(--green)', fontWeight: 600 } : {}),
              }}
              onClick={() => setActiveModal('reminder')}>
              <SendIcon size={14} /> Send Reminder
            </button>

            <button
              type="button"
              className="btn-secondary"
              style={{ width: '100%', minHeight: 36, fontSize: 13 }}
              onClick={() => setActiveModal('edit')}>
              <EditIcon size={14} /> Edit Member
            </button>

            {rooms.length > 0 && member.status === 'active' && (
              <button
                type="button"
                className="btn-secondary"
                style={{ width: '100%', minHeight: 36, fontSize: 13 }}
                onClick={() => setActiveModal('move')}>
                <DoorIcon size={14} /> {member.roomId ? 'Move to another room' : 'Give a room'}
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Collect Payment Modal */}
      <AnimatePresence>
        {activeModal === 'collect' && (
          <CollectPaymentModal
            member={member}
            balance={balance}
            plan={plan}
            fee={subscription?.amount ?? plan?.amount}
            onClose={() => setActiveModal(null)}
            onSuccess={() => {
              qc.invalidateQueries();
              setActiveModal(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Send Reminder Modal */}
      <AnimatePresence>
        {activeModal === 'reminder' && (
          <ReminderModal
            biz={biz}
            member={member}
            nextRenewalDate={nextRenewalDate}
            balance={balance}
            onClose={() => setActiveModal(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeModal === 'move' && (
          <MoveRoom member={member} rooms={rooms} groups={groups} currentRent={subscription?.amount ?? plan?.amount ?? null}
            onClose={() => setActiveModal(null)}
            onMoved={() => { qc.invalidateQueries(); setActiveModal(null); }} />
        )}
      </AnimatePresence>

      {/* Edit Member Modal */}
      <AnimatePresence>
        {activeModal === 'edit' && (
          <EditMemberModal
            member={member}
            plans={plans}
            currentPlanId={subscription?.planId?._id}
            onClose={() => setActiveModal(null)}
            onSuccess={() => {
              qc.invalidateQueries();
              setActiveModal(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Delete Member Confirmation Modal */}
      <AnimatePresence>
        {activeModal === 'delete' && (
          <ConfirmDeleteModal
            memberName={member.name}
            isPending={deleteMember.isPending}
            onClose={() => setActiveModal(null)}
            onConfirm={() => deleteMember.mutate()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// COLLECT PAYMENT MODAL
export function CollectPaymentModal({ member, balance, plan, fee, onClose, onSuccess }) {
  const [amount, setAmount] = useState(balance > 0 ? balance : fee || plan?.amount || 1500);
  const [mode, setMode] = useState('cash');
  const [notes, setNotes] = useState('');

  const pay = useMutation({
    mutationFn: () =>
      api(`/members/${member._id}/payments`, {
        method: 'POST',
        body: { amount: Number(amount), mode, date: new Date().toISOString(), note: notes },
      }),
    onSuccess,
  });

  const chips = [1000, 1500, 2000, 2500, 3000, 5000];

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 120 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="modal-content"
        style={{ maxWidth: 420 }}
        onClick={(e) => e.stopPropagation()}>
        <div className="form-header" style={{ marginBottom: 14 }}>
          <h3 className="form-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircleIcon size={17} style={{ color: 'var(--green)' }} />
            <span>Collect Payment — {member.name}</span>
          </h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <XIcon size={14} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); pay.mutate(); }}>
          <div className="expense-form">
            <div>
              <Field label="Amount to Collect (₹) *" icon={RupeeIcon}>
                <input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  style={{ fontSize: 16, fontWeight: 600 }}
                  autoFocus
                />
              </Field>
    
              {/* Quick preset chips, right under the amount they fill in */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {chips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className={`filter-pill ${Number(amount) === chip ? 'active' : ''}`}
                    style={{ fontSize: 11, padding: '3px 8px' }}
                    onClick={() => setAmount(chip)}>
                    ₹{chip.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Payment Method" icon={CreditCardIcon}>
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="upi">UPI / GPay / PhonePe</option>
                <option value="card">Debit / Credit Card</option>
                <option value="bank_transfer">Bank Transfer / IMPS</option>
              </select>
            </Field>

            <Field label="Notes (Optional)" icon={TagIcon}>
              <input
                type="text"
                placeholder="e.g. Received in morning session"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>

          <div className="expense-form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={pay.isPending} style={{ background: 'var(--green)' }}>
              {pay.isPending ? 'Recording…' : `Record ₹${Number(amount || 0).toLocaleString('en-IN')}`}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// REMINDER MODAL
export function ReminderModal({ biz, member, balance, nextRenewalDate, onClose }) {
  const [copied, setCopied] = useState(false);
  const expStr = nextRenewalDate ? nextRenewalDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'soon';
  const defaultMsg = balance > 0
    ? `Hi ${member.name}, ₹${balance.toLocaleString('en-IN')} is pending at ${biz.name}. Please pay at the earliest. Thank you!`
    : `Hi ${member.name}, your ${words(biz.type).plan.toLowerCase()} at ${biz.name} renews on ${expStr}. Please pay by then. Thank you!`;

  const [message, setMessage] = useState(defaultMsg);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const waUrl = member.phone
    ? `https://wa.me/91${member.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
    : null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 120 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="modal-content"
        style={{ maxWidth: 460 }}
        onClick={(e) => e.stopPropagation()}>
        <div className="form-header" style={{ marginBottom: 14 }}>
          <h3 className="form-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SendIcon size={17} style={{ color: '#F59E0B' }} />
            <span>Send Reminder — {member.name}</span>
          </h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <XIcon size={14} />
          </button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="input-label">Message Template (Editable)</label>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn-secondary" onClick={handleCopy}>
            <CopyIcon size={14} />
            {copied ? '✓ Copied' : 'Copy Text'}
          </button>

          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              className="btn wa">
              <WhatsAppIcon size={14} /> Open WhatsApp
            </a>
          ) : (
            <button disabled className="btn wa">No Phone Number</button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// EDIT MEMBER MODAL
function EditMemberModal({ member, plans, currentPlanId, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: member.name || '',
    phone: member.phone || '',
    status: member.status || 'active',
  });

  const edit = useMutation({
    mutationFn: () =>
      api(`/members/${member._id}`, {
        method: 'PATCH',
        body: form,
      }),
    onSuccess,
  });

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 120 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="modal-content"
        style={{ maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}>
        <div className="form-header" style={{ marginBottom: 14 }}>
          <h3 className="form-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EditIcon size={17} style={{ color: 'var(--primary)' }} />
            <span>Edit Member — {member.name}</span>
          </h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <XIcon size={14} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); edit.mutate(); }}>
          <Field label="Full Name *" icon={UserIcon}>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>

          <div style={{ marginTop: 12 }}>
            <Field label="Phone Number (10 digits)" icon={PhoneIcon}>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              />
            </Field>
          </div>

          <div style={{ marginTop: 12 }}>
            <Field label="Status *" icon={TagIcon}>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="left">Left</option>
              </select>
            </Field>
          </div>

          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button disabled={edit.isPending} className="btn">
              <CheckIcon size={14} />
              {edit.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// Add Member Form
// "Main building · 1st floor · Room 101" (whatever parts the room has)
export const roomLabel = (r, groups = []) => {
  const g = groups.find((x) => x._id === (r.groupId?._id || r.groupId));
  const f = g?.floors?.find((x) => x._id === r.floorId);
  return [g?.name, f?.name, `Room ${r.roomNo}`].filter(Boolean).join(' · ');
};

// building A–Z, then floors in the building's order (Ground, 1st, 2nd…), then room 2 before room 10
const sortRooms = (rooms, groups = []) => {
  const natural = (x, y) => String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' });
  const key = (r) => {
    const g = groups.find((x) => x._id === (r.groupId?._id || r.groupId));
    const floor = g?.floors?.findIndex((f) => f._id === r.floorId) ?? -1;
    return { building: g?.name ?? null, floor: floor < 0 ? 1e6 : floor, room: r.roomNo };
  };
  return [...rooms].sort((a, b) => {
    const x = key(a), y = key(b);
    const noBuilding = (x.building === null) - (y.building === null); // rooms outside a building go last
    return noBuilding || natural(x.building ?? '', y.building ?? '') || x.floor - y.floor || natural(x.room, y.room);
  });
};

// The "Add member / tenant" popup, shared by the Members page and the Rooms board
// initial: name / phone / planId to start with (e.g. from an enquiry)
export function AddMemberModal({ biz, plans, groups, rooms, roomId, initial, onClose, onAdded }) {
  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: async (form) => {
      const member = await api(`/businesses/${biz._id}/members`, { method: 'POST', body: form });
      if (form.planId) {
        await api(`/members/${member._id}/subscribe`, {
          method: 'POST',
          body: { planId: form.planId, startDate: form.startDate, amount: form.amount },
        });
      }
      return member;
    },
    onSuccess: (member) => {
      qc.invalidateQueries();
      onAdded?.(member);
      onClose();
    },
  });
  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 14 }}
        transition={{ duration: 0.2 }}
        className="modal-content"
        style={{ maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}>
        <div className="form-header" style={{ marginBottom: 16 }}>
          <div className="form-title">
            <UserIcon size={18} style={{ color: 'var(--primary)' }} />
            <span>Add new {words(biz.type).member}</span>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <XIcon size={14} />
          </button>
        </div>

        {add.error && (
          <div className="card" style={{ background: 'var(--red-soft)', border: '1px solid var(--red-border)', color: 'var(--red)', padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
            {add.error.message}
          </div>
        )}

        <AddMemberForm plans={plans} groups={groups} rooms={rooms} roomId={roomId} initial={initial}
          onClose={onClose} onSubmit={(f) => add.mutate(f)} busy={add.isPending} />
      </motion.div>
    </div>
  );
}

function AddMemberForm({ plans, groups, rooms, roomId, initial, busy, onClose, onSubmit }) {
  const w = words(useBiz().type);
  const chosenRoom = roomId && rooms.find((r) => r._id === roomId);
  const [form, setForm] = useState({
    name: initial?.name || '',
    phone: initial?.phone || '',
    planId: initial?.planId || plans[0]?._id || '',
    groupId: (chosenRoom && String(chosenRoom.groupId?._id || chosenRoom.groupId || '')) || groups[0]?._id || '',
    roomId: roomId || rooms.find((r) => r.occupied < r.capacity)?._id || '', // the bed they tapped, else the first room with space
    startDate: new Date().toISOString().slice(0, 10),
  });
  const [rent, setRent] = useState(null); // null = follow the room's or plan's price; a string once typed
  const [errors, setErrors] = useState({});

  const selectedPlan = plans.find((p) => p._id === form.planId) || plans[0];
  // what this person pays per cycle: what was typed, else the room's rent per bed, else the plan's price
  const room = rooms.find((r) => r._id === form.roomId);
  const suggested = room?.bedRent ?? selectedPlan?.amount;
  const suggestedFrom = room?.bedRent != null ? `Room ${room.roomNo}'s rent per bed` : 'the plan price';
  const rentValue = rent ?? (suggested != null ? String(suggested) : '');
  const rentNumber = Number(rentValue);
  const isCustom = selectedPlan && rentValue !== '' && rentNumber !== selectedPlan.amount;

  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setForm({ ...form, phone: val });
    if (errors.phone) setErrors({ ...errors, phone: '' });
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Full name is required';
    if (!form.phone.trim()) {
      errs.phone = 'Phone number is required';
    } else if (form.phone.length !== 10) {
      errs.phone = 'Phone must be exactly 10 digits';
    }
    if (plans.length > 0 && !form.planId) errs.planId = 'Please pick a plan';
    if (!form.startDate) errs.startDate = 'Start date is required';
    if (selectedPlan && (!Number.isInteger(rentNumber) || rentNumber < 1)) errs.rent = 'Enter the amount in whole rupees';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({ ...form, amount: isCustom ? rentNumber : null });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid two-col">
        <div>
          <Field label="Full Name *" icon={UserIcon}>
            <input
              placeholder="e.g. Rahul Sharma"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                if (errors.name) setErrors({ ...errors, name: '' });
              }}
            />
          </Field>
          {errors.name && <span className="small red-text" style={{ marginTop: 3, display: 'block' }}>{errors.name}</span>}
        </div>

        <div>
          <Field label="Mobile Phone Number (10 digits) *" icon={PhoneIcon} hint="Used for WhatsApp reminders">
            <input
              type="tel"
              inputMode="numeric"
              placeholder="9876543210"
              value={form.phone}
              onChange={handlePhoneChange}
            />
          </Field>
          {errors.phone && <span className="small red-text" style={{ marginTop: 3, display: 'block' }}>{errors.phone}</span>}
        </div>

        {plans.length > 0 && (
          <div>
            <Field label={`${w.plan} *`} icon={CreditCardIcon}>
              <select value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
                {plans.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} — {rupees(p.amount)} ({p.cycleDays} days)
                  </option>
                ))}
              </select>
            </Field>
            {errors.planId && <span className="small red-text" style={{ marginTop: 3, display: 'block' }}>{errors.planId}</span>}
          </div>
        )}

        <div>
          <Field label={`${w.start} *`} icon={CalendarIcon}>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </Field>
          {errors.startDate && <span className="small red-text" style={{ marginTop: 3, display: 'block' }}>{errors.startDate}</span>}
        </div>

        {groups.length > 0 && (
          <div>
            <Field label={w.group} icon={TagIcon}>
              <select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
                <option value="">None</option>
                {groups.map((g) => (
                  <option key={g._id} value={g._id}>{g.name}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {rooms.length > 0 && (
          <div>
            <Field label="Room Allocation" icon={BedIcon}>
              <select value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
                <option value="">No room allocated</option>
                {sortRooms(rooms, groups).map((r) => (
                  <option key={r._id} value={r._id} disabled={r.occupied >= r.capacity}>
                    {roomLabel(r, groups)} · {r.occupied}/{r.capacity} beds{r.occupied >= r.capacity ? ' (full)' : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </div>

      {selectedPlan && (
        <div className="fee-box">
          <label className="fee-box-main">
            <span className="fee-box-label">{w.fee} for this {w.member}</span>
            <span className="fee-box-input">
              <span aria-hidden="true">₹</span>
              <input type="number" min="1" step="1" inputMode="numeric" aria-label={`${w.fee} amount`}
                value={rentValue} onChange={(e) => { setRent(e.target.value); if (errors.rent) setErrors({ ...errors, rent: '' }); }} />
              <span className="muted small">/ {selectedPlan.cycleDays} days</span>
            </span>
          </label>
          <p className="fee-box-note small">
            {rent === null && room?.bedRent != null
              ? <>From {suggestedFrom}{isCustom ? ` (the plan is ${rupees(selectedPlan.amount)})` : ''}. Change it for a discount. Every bill for this {w.member} uses it.</>
              : isCustom
              ? <>Custom amount. {selectedPlan.name} is {rupees(selectedPlan.amount)}.{' '}
                  <button type="button" className="fee-box-reset" onClick={() => setRent(String(selectedPlan.amount))}>Use {rupees(selectedPlan.amount)}</button></>
              : <>From {suggestedFrom}. Change it for a discount or a different bed. Every bill for this {w.member} uses it.</>}
          </p>
          {errors.rent && <span className="small red-text">{errors.rent}</span>}
        </div>
      )}

      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button disabled={busy} className="btn">
          <CheckIcon size={15} />
          {busy ? 'Adding…' : `Add ${w.member}`}
        </button>
      </div>
    </form>
  );
}

// CONFIRM DELETE MEMBER MODAL
export function ConfirmDeleteModal({ memberName, isPending, onClose, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.18 }}
        className="modal-content"
        style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}
        onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: '#FEE2E2',
            color: '#DC2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
          }}>
          <TrashIcon size={24} />
        </div>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text)' }}>
          Remove Member?
        </h3>

        <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.5, margin: '0 0 24px 0' }}>
          Are you sure you want to remove <strong style={{ color: 'var(--text)' }}>{memberName}</strong>? This will permanently delete all associated membership history, dues, and payment records.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ flex: 1, minHeight: 38 }}
            onClick={onClose}
            disabled={isPending}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            style={{
              flex: 1,
              minHeight: 38,
              background: '#DC2626',
              borderColor: '#DC2626',
              color: '#FFFFFF',
              fontWeight: 600,
            }}
            onClick={onConfirm}
            disabled={isPending}>
            {isPending ? 'Removing…' : 'Delete Member'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// A dropdown that looks the same everywhere: a button, then a list of options with
// optional group headings, colour dots and counts. On phones the list opens as a bottom sheet.
export function Menu({ label, prefix, valueLabel, dot, active, options, value, onPick, align = 'left', wide = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    // start keyboard focus on the picked option
    const list = ref.current?.querySelector('[role="listbox"]');
    (list?.querySelector('[aria-selected="true"]') || list?.querySelector('[role="option"]'))?.focus();
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const moveFocus = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const opts = [...e.currentTarget.querySelectorAll('[role="option"]')];
    const i = opts.indexOf(document.activeElement);
    opts[(i + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length]?.focus();
  };
  const pick = (v) => { onPick(v); setOpen(false); btnRef.current?.focus(); };

  return (
    <div className={`mx-menu ${className}`} ref={ref}>
      <button
        ref={btnRef}
        type="button"
        className={`mx-menu-btn ${active ? 'set' : ''} ${open ? 'open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${valueLabel}`}
        onClick={() => setOpen(!open)}>
        <span className="mx-menu-val">
          {dot && <i className="mx-dot-c" style={{ background: dot }} aria-hidden="true" />}
          {prefix && <span className="mx-menu-prefix">{prefix}</span>}
          <span className="mx-menu-text">{valueLabel}</span>
        </span>
        <ChevronDownIcon size={15} className="mx-menu-caret" />
      </button>
      {open && (
        <>
          <div className="mx-menu-scrim" aria-hidden="true" onClick={() => setOpen(false)} />
          <div className={`mx-menu-panel ${align} ${wide ? 'wide' : ''}`} role="listbox" aria-label={label} onKeyDown={moveFocus}>
            <div className="mx-menu-title" aria-hidden="true">{label}</div>
            {options.map((o, i) => (o.head ? (
              <div key={`h${i}`} className="mx-menu-head" role="presentation">{o.head}</div>
            ) : (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`mx-menu-opt ${o.value === value ? 'on' : ''}`}
                onClick={() => pick(o.value)}>
                {o.dot !== undefined && <i className="mx-dot-c" style={{ background: o.dot || 'transparent' }} aria-hidden="true" />}
                <span className="mx-menu-opt-label">{o.label}</span>
                {o.count !== undefined
                  ? <span className="mx-menu-count">{o.count}</span>
                  : o.value === value && <CheckIcon size={15} className="mx-menu-tick" />}
              </button>
            )))}
          </div>
        </>
      )}
    </div>
  );
}

// "Who paid?" Search, then tap a name. Members who owe come first.
export function PickMember({ members, word, onClose, onPick, title = 'Who paid?' }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const list = members
    .filter((m) => !query || (m.name || '').toLowerCase().includes(query) || (m.phone || '').includes(query))
    .sort((a, b) => (b.balance > 0) - (a.balance > 0) || (a.name || '').localeCompare(b.name || ''))
    .slice(0, 30);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18 }}
        className="modal-content db-pick"
        role="dialog"
        aria-modal="true"
        aria-labelledby="db-pick-title"
        onClick={(e) => e.stopPropagation()}>
        <div className="form-header" style={{ marginBottom: 12 }}>
          <div className="form-title"><RupeeIcon size={18} style={{ color: 'var(--primary)' }} /><span id="db-pick-title">{title}</span></div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><XIcon size={14} /></button>
        </div>
        <label className="mx-search db-pick-search">
          <SearchIcon size={15} />
          <span className="sr-only">Search {word}s</span>
          <input autoFocus type="search" placeholder={`Search ${word} by name or phone`} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <ul className="db-pick-list">
          {list.map((m) => (
            <li key={m._id}>
              <button type="button" onClick={() => onPick(m)}>
                <Avatar name={m.name} />
                <span className="db-who-text">
                  <b>{m.name}</b>
                  <span>{m.planName}{m.phone ? ` · ${m.phone}` : ''}</span>
                </span>
                {m.balance > 0 ? <b className="red">{rupees(m.balance)} due</b> : <span className="db-sub">paid up</span>}
              </button>
            </li>
          ))}
          {!list.length && <li className="db-sub" style={{ padding: 16, textAlign: 'center' }}>Nobody matches “{q}”.</li>}
        </ul>
      </motion.div>
    </div>
  );
}
