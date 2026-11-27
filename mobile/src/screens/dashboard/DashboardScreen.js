import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useBiz } from '../../context/BizContext';
import { useTheme } from '../../context/ThemeContext';
import { api, rupees, waLink, remindMsg } from '../../api/api';
import { refreshAll } from '../../api/queryClient';
import { words } from '../../constants/wording';
import Icon from '../../components/Icon';
import TopBar from '../../components/TopBar';
import { ScreenSkeleton } from '../../components/Loader';
import Avatar from '../../components/Avatar';
import { tint } from '../../constants/theme';

import AddMemberModal from '../modals/AddMemberModal';
import AddExpenseModal from '../modals/AddExpenseModal';
import RecordPaymentModal from '../modals/RecordPaymentModal';
import BulkRemindModal from '../modals/BulkRemindModal';
import SellModal from '../modals/SellModal';
import PickMember from '../../components/PickMember';

// The same home screen as the web app on a phone: quick buttons, today in three or four
// numbers, the month, who to follow up today (with a done tick), suggestions, attendance,
// beds, joined/left and the latest payments.

const DAY = 86400000;
const startOfDay = (d = new Date()) => new Date(new Date(d).toDateString());
const daysSince = (d) => Math.max(0, Math.round((startOfDay() - startOfDay(d)) / DAY));
const daysUntil = (d) => Math.round((startOfDay(d) - startOfDay()) / DAY);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
const shortDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const isoDay = (d = new Date()) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const PAY_MODE = { cash: 'Cash', upi: 'UPI', card: 'Card', other: 'Bank or card', bank_transfer: 'Bank transfer', bank: 'Bank transfer' };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');

const roomLabel = (r, groupList = []) => {
  const g = groupList.find((x) => x._id === (r.groupId?._id || r.groupId));
  const f = g?.floors?.find((x) => x._id === r.floorId);
  return [g?.name, f?.name, `Room ${r.roomNo}`].filter(Boolean).join(' · ');
};

// "done for today" ticks live on this phone and reset each day
function useDoneToday(bizId) {
  const key = `@done:${bizId}:${isoDay()}`;
  const [done, setDone] = useState(() => new Set());
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(key).then((v) => { if (alive && v) setDone(new Set(JSON.parse(v))); }).catch(() => {});
    // forget earlier days' ticks
    AsyncStorage.getAllKeys().then((keys) => {
      const old = keys.filter((k) => k.startsWith(`@done:${bizId}:`) && k !== key);
      if (old.length) AsyncStorage.multiRemove(old);
    }).catch(() => {});
    return () => { alive = false; };
  }, [key, bizId]);
  const toggle = (id) => setDone((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    AsyncStorage.setItem(key, JSON.stringify([...next])).catch(() => {});
    return next;
  });
  return [done, toggle];
}

export default function DashboardScreen({ navigation }) {
  const { biz, currentBizId } = useBiz();
  const { theme } = useTheme();
  const c = theme.colors;
  const dark = theme.isDark;

  const [data, setData] = useState(null);
  const [month, setMonth] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [notComing, setNotComing] = useState(null);
  const [enquiries, setEnquiries] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [groups, setGroups] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tab, setTab] = useState('late');
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [picking, setPicking] = useState(false); // Payment: choose who paid
  const [paying, setPaying] = useState(null);
  const [bulk, setBulk] = useState(null); // { title, people }
  const [done, toggleDone] = useDoneToday(currentBizId);

  const isHostel = biz?.type === 'hostel';
  const attendanceOn = biz?.attendanceEnabled !== false;
  const salesOn = biz?.salesEnabled !== false;
  const w = words(biz?.type);

  const load = useCallback(async () => {
    if (!currentBizId) return;
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
    const soft = (p, fallback) => p.catch(() => fallback); // optional parts never break the screen
    try {
      const [dash, report, att, away, enq, r, g, cat] = await Promise.all([
        api(`/businesses/${currentBizId}/dashboard`),
        soft(api(`/businesses/${currentBizId}/report?from=${from}&to=${to}&tz=${now.getTimezoneOffset()}`), null),
        attendanceOn ? soft(api(`/businesses/${currentBizId}/attendance`), null) : null,
        attendanceOn ? soft(api(`/businesses/${currentBizId}/attendance/not-coming?days=7`), null) : null,
        soft(api(`/businesses/${currentBizId}/enquiries`), []),
        isHostel ? soft(api(`/businesses/${currentBizId}/rooms`), []) : [],
        isHostel ? soft(api(`/businesses/${currentBizId}/groups`), []) : [],
        salesOn ? soft(api(`/businesses/${currentBizId}/catalogue`), []) : [],
      ]);
      setData(dash); setMonth(report); setAttendance(att); setNotComing(away);
      setEnquiries(Array.isArray(enq) ? enq : []);
      setRooms(Array.isArray(r) ? r : []); setGroups(Array.isArray(g) ? g : []); setCatalogue(Array.isArray(cat) ? cat : []);
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentBizId, isHostel, attendanceOn, salesOn]);

  // loads on first view and again whenever the tab comes back into view
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await refreshAll(); await load(); setRefreshing(false); };

  if (!biz) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, { backgroundColor: c.background }]}>
        <View style={styles.center}><Text style={{ color: c.textSecondary }}>No workspace selected</Text></View>
      </SafeAreaView>
    );
  }
  if (loading && !data) return <ScreenSkeleton navigation={navigation} kind="dashboard" />;

  const now = new Date();
  const todayText = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const pending = data?.pending || [];
  const pendingTotal = data?.pendingTotal || 0;
  const activeMembers = data?.activeMembers || 0;
  const membersTable = data?.membersTable || [];
  const home = data?.home || {};

  // ---- quick buttons (the web's tiles) ----
  const actions = [
    { key: 'pay', label: 'Payment', icon: 'cash-outline', primary: true, go: () => setPicking(true) },
    salesOn && catalogue.length > 0 && { key: 'sell', label: 'Sell', icon: 'pricetag-outline', go: () => setSellOpen(true) },
    { key: 'member', label: cap(w.member), icon: 'add', go: () => setAddMemberOpen(true) },
    { key: 'enq', label: 'Enquiry', icon: 'person-add-outline', go: () => navigation.navigate('Enquiries', { add: 1 }) },
    { key: 'exp', label: 'Expense', icon: 'wallet-outline', go: () => setAddExpenseOpen(true) },
  ].filter(Boolean);
  const quick = (
    <View style={styles.quickRow}>
      {actions.map((a) => (
        <TouchableOpacity key={a.key} activeOpacity={0.8} onPress={a.go} accessibilityRole="button" accessibilityLabel={a.label}
          style={[styles.quick, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={[styles.quickIcon, { backgroundColor: a.primary ? c.primary : c.primarySoft }]}>
            <Icon name={a.icon} size={16} color={a.primary ? '#FFFFFF' : c.primaryDark} />
          </View>
          <Text style={[styles.quickText, { color: c.text }]} numberOfLines={1}>{a.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (!membersTable.length) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, { backgroundColor: c.background }]}>
        <TopBar title="Dashboard" navigation={navigation} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[styles.date, { color: c.textMuted }]}>{todayText}</Text>
          {quick}
          <View style={[styles.card, styles.hero, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.heroLabel, { color: c.textMuted }]}>Welcome to {biz.name}</Text>
            <Text style={[styles.heroText, { color: c.text }]}>Add your first {w.member} to start tracking fees.</Text>
            <TouchableOpacity style={[styles.btn, { backgroundColor: c.primary, alignSelf: 'flex-start' }]} onPress={() => setAddMemberOpen(true)}>
              <Icon name="add" size={16} color="#FFFFFF" /><Text style={styles.btnText}>Add {w.member}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <AddMemberModal visible={addMemberOpen} biz={biz} onClose={() => setAddMemberOpen(false)} onMemberAdded={() => { setAddMemberOpen(false); load(); navigation.navigate('Members'); }} />
      </SafeAreaView>
    );
  }

  // ---- the month ----
  const received = month?.received ?? 0;
  const spent = month?.expenses ?? 0;
  const profit = month?.profit ?? 0;
  const billed = received + pendingTotal;
  const collectedPct = billed > 0 ? Math.round((received / billed) * 100) : 100;
  const monthName = now.toLocaleDateString('en-IN', { month: 'long' });
  const lastMonthName = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('en-IN', { month: 'long' });
  const lastMonth = home.lastMonthCollected || 0;
  const vsLast = lastMonth > 0 ? Math.round(((received - lastMonth) / lastMonth) * 100) : null;
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const pace = dayOfMonth >= 3 && received > 0 ? Math.min(billed, Math.round(((received / dayOfMonth) * daysInMonth) / 100) * 100) : null;

  // ---- today ----
  const dueToday = pending.filter((m) => m.dueSince && daysSince(m.dueSince) === 0);
  const openEnq = enquiries.filter((e) => e.status === 'new' || e.status === 'follow_up');
  const newEnqToday = enquiries.filter((e) => daysSince(e.createdAt) === 0);
  const callEnq = openEnq
    .filter((e) => !e.followUpOn || daysUntil(e.followUpOn) <= 0)
    .sort((a, b) => (a.followUpOn ? daysUntil(a.followUpOn) : 1) - (b.followUpOn ? daysUntil(b.followUpOn) : 1));
  const present = attendance?.counts?.present ?? 0;
  const total = attendance?.counts?.total ?? 0;
  const todayCards = [
    { key: 'paid', icon: 'cash-outline', tone: c.success, label: 'Collected today', value: rupees(home.today?.collected || 0), go: () => navigation.navigate('Reports') },
    attendanceOn && total > 0 && { key: 'in', icon: 'checkmark', tone: c.purple, label: biz.type === 'gym' ? 'Came in today' : 'Present today', value: `${present}`, note: `of ${total}`, go: () => navigation.navigate('Attendance') },
    { key: 'enq', icon: 'person-add-outline', tone: c.info, label: 'New enquiries', value: String(newEnqToday.length), go: () => navigation.navigate('Enquiries') },
    { key: 'due', icon: 'alert-circle-outline', tone: c.warning, label: 'Fees due today', value: rupees(dueToday.reduce((s, m) => s + m.balance, 0)), go: () => navigation.navigate('Members', { filter: 'owing' }) },
  ].filter(Boolean);

  // ---- follow up today ----
  const roomOf = (m) => rooms.find((r) => r._id === String(m.roomId?._id || m.roomId || ''));
  const late = [...pending].sort((a, b) => daysSince(b.dueSince || now) - daysSince(a.dueSince || now) || b.balance - a.balance);
  const expiring = membersTable
    .filter((m) => m.status === 'active' && m.statusBadge !== 'paused' && m.balance <= 0 && m.nextRenewal)
    .map((m) => ({ ...m, inDays: daysUntil(m.nextRenewal) }))
    .filter((m) => m.inDays >= 0 && m.inDays <= 7)
    .sort((a, b) => a.inDays - b.inDays);
  const away = notComing?.members || [];
  const TABS = [
    { id: 'late', label: 'Expired', dot: '#DC2626', list: late, hint: 'Plan ended and the fee is still unpaid' },
    { id: 'soon', label: 'Expiring', dot: '#D97706', list: expiring, hint: 'Remind them before the plan ends' },
    attendanceOn && { id: 'away', label: 'Not coming', dot: '#7C3AED', list: away, hint: 'Away 7+ days: a quick call keeps them coming' },
    { id: 'enq', label: 'Enquiries', dot: '#2563EB', list: callEnq, hint: 'People who asked about joining, due a call back' },
  ].filter(Boolean);
  const current = TABS.find((t) => t.id === tab) || TABS[0];
  const shown = current.list.slice(0, 6);
  const doneKey = (t, m) => `${t}:${m._id}`;
  const allKeys = TABS.flatMap((t) => t.list.slice(0, 6).map((m) => doneKey(t.id, m)));
  const doneCount = allKeys.filter((k) => done.has(k)).length;

  const renewMsg = (m) => `Hi ${m.name}, your ${biz.name} plan renews on ${shortDate(m.nextRenewal)}${m.planAmount ? ` (${rupees(m.planAmount)})` : ''}. Please pay on time to keep going. Thank you!`;
  const openWa = (phone, text) => Linking.openURL(waLink(phone, text));
  const call = (phone) => Linking.openURL(`tel:${phone}`);
  const remindLate = () => setBulk({ title: 'who owe', people: late.map((m) => ({ ...m, message: remindMsg(biz, m, m.balance) })) });
  const remindSoon = () => setBulk({ title: 'renewing soon', people: expiring.map((m) => ({ ...m, message: renewMsg(m) })) });

  const rowFor = (m) => {
    const open = () => navigation.navigate('MemberDetail', { id: m._id });
    if (current.id === 'late') {
      const d = m.dueSince ? daysSince(m.dueSince) : 0;
      const room = isHostel && roomOf(m);
      return { sub: `${d > 0 ? `Expired ${plural(d, 'day')} ago` : 'Due today'}${room ? ` · ${roomLabel(room, groups)}` : ''}`, tone: c.moneyRed, open, cta: { label: 'Collect', primary: true, go: () => setPaying(m) } };
    }
    if (current.id === 'soon') {
      const when = m.inDays === 0 ? 'Expires today' : m.inDays === 1 ? 'Expires tomorrow' : `Expires in ${m.inDays} days`;
      return { sub: `${when} · ${shortDate(m.nextRenewal)}`, tone: c.moneyAmber, open, cta: m.phone ? { label: 'Remind', go: () => openWa(m.phone, renewMsg(m)) } : { label: 'Open', go: open } };
    }
    if (current.id === 'away') {
      return { sub: m.lastPresent ? `Not come for ${plural(m.daysAway, 'day')}` : `Never came · joined ${plural(m.daysAway, 'day')} ago`, tone: c.purpleDark, open, cta: m.phone ? { label: 'Call', icon: 'call-outline', go: () => call(m.phone) } : { label: 'Open', go: open } };
    }
    const d = m.followUpOn ? daysUntil(m.followUpOn) : null;
    const goEnq = () => navigation.navigate('Enquiries');
    return {
      sub: d === null ? `Asked ${shortDate(m.createdAt)}${m.planId ? ` · ${m.planId.name}` : ''}` : d === 0 ? `Call back today${m.planId ? ` · ${m.planId.name}` : ''}` : `Call back missed ${plural(-d, 'day')} ago`,
      tone: d !== null && d < 0 ? c.moneyRed : c.infoDark, open: goEnq,
      cta: m.phone ? { label: 'Call', icon: 'call-outline', go: () => call(m.phone) } : { label: 'Open', go: goEnq },
    };
  };

  // ---- suggestions ----
  const longLate = late.find((m) => m.dueSince && daysSince(m.dueSince) >= 30);
  const away30 = away.filter((m) => m.daysAway >= 30);
  const missedEnq = openEnq.filter((e) => e.followUpOn && daysUntil(e.followUpOn) < 0);
  const tips = [
    expiring.length > 0 && { key: 'soon', text: `${plural(expiring.length, 'plan')} ${expiring.length === 1 ? 'expires' : 'expire'} this week (${rupees(expiring.reduce((s, m) => s + (m.planAmount || 0), 0))}). Remind them before they lapse.`, cta: expiring.some((m) => m.phone) ? { label: `Remind ${expiring.length}`, go: remindSoon } : null },
    longLate && { key: 'late', text: `${longLate.name} owes ${rupees(longLate.balance)} for ${plural(daysSince(longLate.dueSince), 'day')}. A call works better than a message.`, cta: longLate.phone ? { label: 'Call', go: () => call(longLate.phone) } : { label: 'Open', go: () => navigation.navigate('MemberDetail', { id: longLate._id }) } },
    away30.length > 0 && { key: 'away', text: `${plural(away30.length, w.member)} ${away30.length === 1 ? "hasn't" : "haven't"} come in for 30+ days. They may be about to quit.`, cta: { label: 'See who', go: () => setTab('away') } },
    missedEnq.length > 0 && { key: 'enq', text: `${missedEnq.length} ${missedEnq.length === 1 ? 'enquiry' : 'enquiries'} missed ${missedEnq.length === 1 ? 'its' : 'their'} call-back date.`, cta: { label: 'Show', go: () => setTab('enq') } },
    late.length > 1 && !longLate && { key: 'all', text: `${plural(late.length, w.member)} owe ${rupees(pendingTotal)}. One message reminds them all.`, cta: { label: 'Remind all', go: remindLate } },
  ].filter(Boolean).slice(0, 3);

  // ---- week, beds, growth, payments ----
  const week = home.week || null;
  const weekMax = Math.max(1, ...(week || []).map((d) => d.present));
  const weekAvg = week ? Math.round(week.reduce((s, d) => s + d.present, 0) / week.length) : 0;
  const dayLabel = (iso, i) => (i === 6 ? 'Today' : new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 2));
  const beds = rooms.reduce((s, r) => s + r.capacity, 0);
  const filled = rooms.reduce((s, r) => s + Math.min(r.occupied || 0, r.capacity), 0);
  const freeRooms = rooms.filter((r) => (r.occupied || 0) < r.capacity)
    .sort((a, b) => (b.capacity - (b.occupied || 0)) - (a.capacity - (a.occupied || 0)) || natural(a.roomNo, b.roomNo));
  const recent = (data?.recentPayments || []).slice(0, 4);

  const card = [styles.card, { backgroundColor: c.card, borderColor: c.border }];
  const head = (children, link, onLink) => (
    <View style={styles.headRow}>
      <Text style={[styles.h2, { color: c.text }]}>{children}</Text>
      {link ? <TouchableOpacity onPress={onLink} hitSlop={8}><Text style={[styles.link, { color: c.primary }]}>{link}</Text></TouchableOpacity> : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, { backgroundColor: c.background }]}>
      <TopBar title="Dashboard" navigation={navigation} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} progressBackgroundColor={c.card} />}>
        <Text style={[styles.date, { color: c.textMuted }]}>{todayText}</Text>

        {/* 1. one tap each */}
        {quick}

        {/* 2. today at a glance */}
        <View style={styles.todayRow}>
          {todayCards.map((t) => (
            <TouchableOpacity key={t.key} activeOpacity={0.8} onPress={t.go} style={[styles.todayCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={[styles.todayIcon, { backgroundColor: tint(t.tone, dark ? 0.18 : 0.12, c.card) }]}>
                <Icon name={t.icon} size={15} color={t.tone} />
              </View>
              <Text style={[styles.todayLabel, { color: c.textMuted }]} numberOfLines={2}>{t.label}</Text>
              <Text style={[styles.todayValue, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>
                {t.value}{t.note ? <Text style={[styles.todayNote, { color: c.textMuted }]}> {t.note}</Text> : null}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 3. the month */}
        <View style={[card, { padding: 0, overflow: 'hidden' }]}>
          <View style={{ padding: 16 }}>
            <View style={styles.headRow}>
              <Text style={[styles.label, { color: c.textMuted }]}>Collected in {monthName}</Text>
              {vsLast !== null && (
                <View style={[styles.delta, { backgroundColor: vsLast >= 0 ? c.successSoft : c.dangerSoft }]}>
                  <Text style={[styles.deltaText, { color: vsLast >= 0 ? c.moneyGreen : c.moneyRed }]}>{vsLast >= 0 ? '▲' : '▼'} {Math.abs(vsLast)}% vs {lastMonthName}</Text>
                </View>
              )}
            </View>
            <Text style={{ marginTop: 6 }}>
              <Text style={[styles.big, { color: c.text }]}>{rupees(received)}</Text>
              <Text style={[styles.bigSub, { color: c.textMuted }]}>  of {rupees(billed)} · {collectedPct}%</Text>
            </Text>
            <View style={[styles.bar, { backgroundColor: c.cardSubtle }]}>
              <View style={[styles.barFill, { width: `${Math.min(100, collectedPct)}%`, backgroundColor: c.success }]} />
            </View>
            {pace !== null && collectedPct < 100 && (
              <Text style={[styles.pace, { color: c.textMuted }]}>
                {pace >= billed ? "At this pace you'll collect everything by month end." : <>{"At this pace you'll reach "}<Text style={{ fontWeight: '700', color: c.text }}>{rupees(pace)}</Text> by {daysInMonth} {now.toLocaleDateString('en-IN', { month: 'short' })}.</>}
              </Text>
            )}
          </View>
          <View style={[styles.cells, { borderTopColor: c.border }]}>
            {[
              { key: 'owe', label: 'To collect', value: pendingTotal > 0 ? rupees(pendingTotal) : 'All paid', ink: pendingTotal > 0 ? c.moneyRed : c.moneyGreen, bg: pendingTotal > 0 ? c.dangerSoft : 'transparent', labelInk: pendingTotal > 0 ? c.moneyRed : c.textMuted, go: () => navigation.navigate('Members', { filter: 'owing' }) },
              { key: 'spent', label: 'Spent', value: rupees(spent), ink: c.text, go: () => navigation.navigate('Reports', { view: 'expenses' }) },
              { key: 'profit', label: profit < 0 ? 'Loss' : 'Profit', value: `${profit < 0 ? '−' : ''}${rupees(Math.abs(profit))}`, ink: profit < 0 ? c.moneyRed : c.moneyGreen, go: () => navigation.navigate('Reports') },
            ].map((x, i) => (
              <TouchableOpacity key={x.key} activeOpacity={0.8} onPress={x.go} style={[styles.cell, { backgroundColor: x.bg || 'transparent' }, i > 0 && { borderLeftWidth: 1, borderLeftColor: c.border }]}>
                <Text style={[styles.cellLabel, { color: x.labelInk || c.textMuted }]}>{x.label}</Text>
                <Text style={[styles.cellValue, { color: x.ink }]} numberOfLines={1}>{x.value}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 4. follow up today */}
        <View style={[card, { paddingHorizontal: 0, paddingBottom: 0 }]}>
          <View style={{ paddingHorizontal: 16 }}>
            <Text style={[styles.h1, { color: c.text }]}>Follow up today</Text>
            <Text style={[styles.hint, { color: c.textMuted }]}>{current.hint}</Text>
            {allKeys.length > 0 && (
              <View style={styles.progressRow}>
                <Text style={[styles.progressText, { color: c.textMuted }]}>{doneCount} of {allKeys.length} done</Text>
                <View style={[styles.progressTrack, { backgroundColor: c.cardSubtle }]}>
                  <View style={[styles.barFill, { width: `${Math.round((doneCount / allKeys.length) * 100)}%`, backgroundColor: c.success }]} />
                </View>
              </View>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabs, { borderBottomColor: c.border }]} contentContainerStyle={{ paddingHorizontal: 6 }}>
            {TABS.map((t) => {
              const on = current.id === t.id;
              return (
                <TouchableOpacity key={t.id} onPress={() => setTab(t.id)} accessibilityRole="tab" accessibilityState={{ selected: on }}
                  style={[styles.tab, { borderBottomColor: on ? c.primary : 'transparent' }]}>
                  <View style={[styles.dot, { backgroundColor: t.dot }]} />
                  <Text style={[styles.tabText, { color: on ? c.primaryDark : c.textMuted, fontWeight: on ? '700' : '500' }]}>{t.label}</Text>
                  <View style={[styles.tabCount, { backgroundColor: on ? c.primary : c.cardSubtle }]}>
                    <Text style={[styles.tabCountText, { color: on ? '#FFFFFF' : c.textSecondary }]}>{t.list.length}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {shown.length ? shown.map((m, i) => {
            const r = rowFor(m);
            const k = doneKey(current.id, m);
            const isDone = done.has(k);
            return (
              <View key={m._id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.borderSubtle }, isDone && { opacity: 0.55 }]}>
                <TouchableOpacity onPress={() => toggleDone(k)} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: isDone }} accessibilityLabel={`${isDone ? 'Undo' : 'Mark'} ${m.name} done for today`}
                  style={[styles.tick, { borderColor: isDone ? c.success : c.borderSolid, backgroundColor: isDone ? c.success : 'transparent' }]}>
                  {isDone && <Icon name="checkmark" size={13} color="#FFFFFF" />}
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} onPress={r.open} style={styles.who}>
                  <Avatar name={m.name} size={30} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.name, { color: c.text, textDecorationLine: isDone ? 'line-through' : 'none' }]} numberOfLines={1}>{m.name}</Text>
                    <Text style={[styles.sub, { color: r.tone }]} numberOfLines={1}>{r.sub}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={r.cta.go} style={[styles.cta, r.cta.primary ? { backgroundColor: c.primary } : { backgroundColor: c.card, borderWidth: 1, borderColor: c.border }]}>
                  {r.cta.icon ? <Icon name={r.cta.icon} size={13} color={c.text} /> : null}
                  <Text style={[styles.ctaText, { color: r.cta.primary ? '#FFFFFF' : c.text }]}>{r.cta.label}</Text>
                </TouchableOpacity>
              </View>
            );
          }) : (
            <View style={styles.empty}>
              <Icon name="checkmark-circle-outline" size={18} color={c.success} />
              <Text style={[styles.emptyText, { color: c.textMuted }]}>
                {{ late: 'Nobody owes anything right now.', soon: 'No plans expire this week.', away: `Every ${w.member} came in this week.`, enq: 'No enquiries to call back today.' }[current.id]}
              </Text>
            </View>
          )}
          <View style={[styles.foot, { borderTopColor: c.border }]}>
            <TouchableOpacity onPress={() => (current.id === 'enq' ? navigation.navigate('Enquiries') : navigation.navigate('Members', { filter: { late: 'owing', soon: 'soon', away: 'away' }[current.id] }))}>
              <Text style={[styles.link, { color: c.primary }]}>{current.list.length > shown.length ? `See all ${current.list.length} →` : 'See all →'}</Text>
            </TouchableOpacity>
            {((current.id === 'late' && late.length > 1) || (current.id === 'soon' && expiring.length > 1)) && (
              <TouchableOpacity onPress={current.id === 'late' ? remindLate : remindSoon} style={[styles.waAll, { backgroundColor: c.successSoft, borderColor: c.successBorder }]}>
                <Icon name="logo-whatsapp" size={14} color={c.moneyGreen} />
                <Text style={[styles.waAllText, { color: c.moneyGreen }]}>Remind all {current.list.length}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 5. suggestions */}
        {tips.length > 0 && (
          <View style={[styles.card, { backgroundColor: c.purpleSoft, borderColor: c.purpleBorder }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <View style={[styles.tipsBadge, { backgroundColor: c.primary }]}><Icon name="sparkles-outline" size={13} color="#FFFFFF" /></View>
              <Text style={[styles.h2, { color: c.text }]}>Suggestions</Text>
            </View>
            {tips.map((t) => (
              <View key={t.key} style={[styles.tip, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={[styles.tipText, { color: c.textSecondary }]}>{t.text}</Text>
                {t.cta && (
                  <TouchableOpacity onPress={t.cta.go} style={[styles.tipBtn, { backgroundColor: c.primarySoft }]}>
                    <Text style={[styles.tipBtnText, { color: c.primaryDark }]}>{t.cta.label}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* 6. attendance this week */}
        {attendanceOn && total > 0 && (
          <View style={card}>
            {head(biz.type === 'gym' ? 'Came in' : 'Attendance', 'Mark today →', () => navigation.navigate('Attendance'))}
            <Text style={{ marginTop: 6 }}>
              <Text style={[styles.mid, { color: c.text }]}>{present}</Text>
              <Text style={[styles.midSub, { color: c.textMuted }]}>  of {total} today{weekAvg ? ` · avg ${weekAvg} a day` : ''}</Text>
            </Text>
            {week && (
              <View style={styles.week}>
                {week.map((d, i) => (
                  <View key={d.day} style={styles.weekCol}>
                    <View style={[styles.weekBar, { height: Math.max(3, Math.round((d.present / weekMax) * 52)), backgroundColor: i === 6 ? c.primary : c.primaryBorder }]} />
                    <Text style={[styles.weekLabel, { color: i === 6 ? c.text : c.textMuted }]}>{dayLabel(d.day, i)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* 7. beds (hostels) */}
        {isHostel && beds > 0 && (
          <TouchableOpacity activeOpacity={0.85} style={card} onPress={() => navigation.navigate('Rooms')}>
            <View style={styles.headRow}>
              <Text style={[styles.h2, { color: c.text }]}>Beds filled</Text>
              <Icon name="chevron-forward" size={15} color={c.textMuted} />
            </View>
            <Text style={{ marginTop: 6 }}>
              <Text style={[styles.mid, { color: c.text }]}>{filled}</Text>
              <Text style={[styles.midSub, { color: c.textMuted }]}>  of {plural(beds, 'bed')}</Text>
            </Text>
            <View style={[styles.bar, { backgroundColor: c.cardSubtle }]}>
              <View style={[styles.barFill, { width: `${Math.round((filled / beds) * 100)}%`, backgroundColor: c.primary }]} />
            </View>
            {freeRooms.length > 0 && (
              <Text style={[styles.pace, { color: c.textMuted }]}>
                Free: {freeRooms.slice(0, 3).map((r) => roomLabel(r, groups)).join(', ')}{freeRooms.length > 3 ? ` +${freeRooms.length - 3}` : ''}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* 8. joined · left · active */}
        <View style={[card, styles.growth]}>
          {[
            { label: 'Joined', value: `+${home.joinedThisMonth ?? 0}`, ink: c.moneyGreen, go: () => navigation.navigate('Members', { filter: 'new' }) },
            { label: 'Left', value: home.leftThisMonth ? `−${home.leftThisMonth}` : '0', ink: home.leftThisMonth ? c.moneyRed : c.text, go: () => navigation.navigate('Members', { filter: 'left' }) },
            { label: 'Active now', value: String(activeMembers), ink: c.text, go: () => navigation.navigate('Members') },
          ].map((g, i) => (
            <TouchableOpacity key={g.label} activeOpacity={0.8} onPress={g.go} style={[styles.growthCell, i > 0 && { borderLeftWidth: 1, borderLeftColor: c.border }]}>
              <Text style={[styles.cellLabel, { color: c.textMuted }]}>{g.label}</Text>
              <Text style={[styles.cellValue, { color: g.ink }]}>{g.value}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 9. recent payments */}
        <View style={card}>
          {head('Recent payments', 'Money →', () => navigation.navigate('Reports'))}
          {recent.length ? recent.map((p, i) => (
            <TouchableOpacity key={p._id} activeOpacity={0.7} onPress={() => navigation.navigate('MemberDetail', { id: p.memberId })}
              style={[styles.payRow, { borderTopColor: c.borderSubtle }, i === 0 && { marginTop: 6 }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{p.name}</Text>
                <Text style={[styles.sub, { color: c.textMuted }]}>
                  {daysSince(p.date) === 0 ? 'Today' : daysSince(p.date) === 1 ? 'Yesterday' : shortDate(p.date)} · {PAY_MODE[p.mode] || 'Cash'}
                </Text>
              </View>
              <Text style={[styles.payAmt, { color: c.moneyGreen }]}>+{rupees(p.amount)}</Text>
            </TouchableOpacity>
          )) : (
            <Text style={[styles.pace, { color: c.textMuted }]}>No payments yet. They show up here as you collect them.</Text>
          )}
        </View>
      </ScrollView>

      <PickMember visible={picking} members={membersTable.filter((m) => m.status === 'active')} word={w.member}
        onClose={() => setPicking(false)} onPick={(m) => { setPicking(false); setPaying(m); }} />
      <RecordPaymentModal visible={Boolean(paying)} member={paying} biz={biz} onClose={() => setPaying(null)} onPaymentRecorded={load} />
      <AddMemberModal visible={addMemberOpen} biz={biz} onClose={() => setAddMemberOpen(false)}
        onMemberAdded={() => { setAddMemberOpen(false); load(); navigation.navigate('Members'); }} />
      <AddExpenseModal visible={addExpenseOpen} biz={biz} onClose={() => setAddExpenseOpen(false)} onSaved={load} />
      {salesOn && <SellModal visible={sellOpen} biz={biz} onClose={() => setSellOpen(false)} onSold={load} />}
      {bulk && <BulkRemindModal visible title={bulk.title} people={bulk.people} biz={biz} onClose={() => setBulk(null)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 36 },
  date: { fontSize: 13, marginBottom: 10 },

  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  quick: { flex: 1, height: 66, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  quickIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  quickText: { fontSize: 12, fontWeight: '600' },

  todayRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  todayCard: { flex: 1, minWidth: 0, borderRadius: 14, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 8, gap: 3 },
  todayIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  todayLabel: { fontSize: 11.5, lineHeight: 14 },
  todayValue: { fontSize: 15, fontWeight: '800', marginTop: 'auto', letterSpacing: -0.3 },
  todayNote: { fontSize: 11.5, fontWeight: '500' },

  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { fontSize: 13, fontWeight: '600' },
  delta: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  deltaText: { fontSize: 11.5, fontWeight: '700' },
  big: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  bigSub: { fontSize: 13 },
  bar: { height: 7, borderRadius: 99, overflow: 'hidden', marginTop: 12 },
  barFill: { height: '100%', borderRadius: 99 },
  pace: { fontSize: 12.5, marginTop: 8, lineHeight: 18 },
  cells: { flexDirection: 'row', borderTopWidth: 1 },
  cell: { flex: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 4 },
  cellLabel: { fontSize: 12.5, fontWeight: '600' },
  cellValue: { fontSize: 17, fontWeight: '800' },

  h1: { fontSize: 17, fontWeight: '700' },
  h2: { fontSize: 15.5, fontWeight: '700' },
  hint: { fontSize: 12.5, marginTop: 2 },
  link: { fontSize: 13, fontWeight: '600' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  progressText: { fontSize: 12.5 },
  progressTrack: { width: 70, height: 5, borderRadius: 99, overflow: 'hidden' },
  tabs: { flexGrow: 0, marginTop: 10, borderBottomWidth: 1 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: 10, borderBottomWidth: 2, marginBottom: -1 },
  dot: { width: 7, height: 7, borderRadius: 99 },
  tabText: { fontSize: 13.5 },
  tabCount: { minWidth: 20, height: 18, paddingHorizontal: 5, borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  tabCountText: { fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 16 },
  tick: { width: 22, height: 22, borderRadius: 99, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  who: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 14.5, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 1 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 36, paddingHorizontal: 13, borderRadius: 10 },
  ctaText: { fontSize: 13, fontWeight: '700' },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 18 },
  emptyText: { fontSize: 13.5, flex: 1 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12, minHeight: 56 },
  waAll: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  waAllText: { fontSize: 13, fontWeight: '700' },

  tipsBadge: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 8 },
  tipText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
  tipBtn: { paddingHorizontal: 11, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tipBtnText: { fontSize: 12.5, fontWeight: '700' },

  mid: { fontSize: 24, fontWeight: '800' },
  midSub: { fontSize: 13 },
  week: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 12, height: 72 },
  weekCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  weekBar: { width: '70%', borderRadius: 5 },
  weekLabel: { fontSize: 10.5 },

  growth: { flexDirection: 'row', padding: 0, overflow: 'hidden' },
  growthCell: { flex: 1, paddingVertical: 14, paddingHorizontal: 14, gap: 4 },

  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: 1 },
  payAmt: { fontSize: 14.5, fontWeight: '700' },

  hero: { gap: 8 },
  heroLabel: { fontSize: 13, fontWeight: '600' },
  heroText: { fontSize: 17, fontWeight: '700' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: 16, borderRadius: 10, marginTop: 6 },
  btnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

});
