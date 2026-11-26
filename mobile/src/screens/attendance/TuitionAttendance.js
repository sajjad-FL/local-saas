import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, SafeAreaView, Alert, Linking, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { api, waLink, rupees } from '../../api/api';
import { refreshAll } from '../../api/queryClient';
import { words } from '../../constants/wording';
import Icon from '../../components/Icon';
import TopBar from '../../components/TopBar';
import { ScreenSkeleton } from '../../components/Loader';
import { ChipRow, SearchFilter } from '../../components/Compact';
import AttendanceImportModal from '../modals/AttendanceImportModal';

const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const fmt = (d, o) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', ...o });
const timeOf = (at) => new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);

// Tuition: a teacher picks a batch, then takes its roll call (same flow as the web app)
export default function TuitionAttendance({ navigation, biz }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const W = words(biz?.type);
  const canMark = (biz?.access ? biz.access.level : 3) >= 1;
  const Member = W.member[0].toUpperCase() + W.member.slice(1);

  const [day, setDay] = useState(null); // null = today
  const [batchId, setBatchId] = useState('');
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [groups, setGroups] = useState([]);
  const [data, setData] = useState(null); // everyone, this day
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    if (!biz?._id) return;
    try {
      const qs = new URLSearchParams({ ...(day && { day }) }).toString();
      const [res, g] = await Promise.all([
        api(`/businesses/${biz._id}/attendance?${qs}`),
        api(`/businesses/${biz._id}/groups`).catch(() => []),
      ]);
      setData(res);
      setGroups(Array.isArray(g) ? g : []);
    } catch (err) {
      console.warn('Attendance fetch error', err);
    }
  }, [biz, day]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = (id) => { setBatchId(id); setTab('all'); setQ(''); };
  // Android back closes the batch first
  useEffect(() => {
    if (!batchId) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setBatchId(''); return true; });
    return () => sub.remove();
  }, [batchId]);

  const onRefresh = async () => { setRefreshing(true); await refreshAll(); await load(); setRefreshing(false); };

  const mark = async (memberId, status) => {
    setData((prev) => prev && { ...prev, members: prev.members.map((m) => (m._id === memberId ? { ...m, status, method: status && 'staff', markedBy: status && 'you', at: status && new Date().toISOString() } : m)) });
    try {
      await api(`/businesses/${biz._id}/attendance`, { method: 'PUT', body: { day: data?.day, memberId, status } });
    } catch (err) {
      Alert.alert('Could not save', err.message);
      load();
    }
  };
  const markRest = async (status) => {
    setBusy(true);
    try {
      await api(`/businesses/${biz._id}/attendance/all-present`, { method: 'POST', body: { day: data?.day, groupId: batchId, status } });
      await load();
    } catch (err) {
      Alert.alert('Could not save', err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <ScreenSkeleton navigation={navigation} />;

  const { today, day: current } = data;
  const live = (data.members || []).filter((m) => !m.paused);
  const inBatch = (id) => live.filter((m) => String(m.groupId || '') === id);
  const batches = groups.map((g) => {
    const list = inBatch(g._id);
    const p = list.filter((m) => m.status === 'present').length;
    const a = list.filter((m) => m.status === 'absent').length;
    return { ...g, total: list.length, present: p, absent: a, left: list.length - p - a };
  });
  const noBatch = live.filter((m) => !groups.some((g) => g._id === String(m.groupId || '')));
  const withKids = batches.filter((b) => b.total);
  const doneCount = withKids.filter((b) => !b.left).length;
  const first = withKids.find((b) => b.left);
  const dayOptions = [0, -1, -2, -3, -4, -5, -6].map((n) => {
    const d = addDays(today, n);
    return { id: d, label: n === 0 ? 'Today' : n === -1 ? 'Yesterday' : fmt(d, { weekday: 'short', day: 'numeric' }) };
  });
  const pickDay = (d) => setDay(d === today ? null : d);
  const refresh = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} progressBackgroundColor={c.card} />;
  const bar = (p, a, total) => (
    <View style={[st.bar, { backgroundColor: c.cardSubtle }]}>
      <View style={{ width: `${total ? (p / total) * 100 : 0}%`, backgroundColor: c.success }} />
      <View style={{ width: `${total ? (a / total) * 100 : 0}%`, backgroundColor: c.danger }} />
    </View>
  );

  // ── 1. the batch list ──
  if (!batchId) {
    return (
      <SafeAreaView style={[st.safe, { backgroundColor: c.background }]}>
        <TopBar title="Attendance" navigation={navigation} />
        <ScrollView contentContainerStyle={st.scroll} refreshControl={refresh}>
          <Text style={[st.date, { color: c.textMuted }]}>
            {fmt(current, { weekday: 'long', day: 'numeric', month: 'long' })}{withKids.length ? ` · ${doneCount} of ${withKids.length} ${W.groups.toLowerCase()} done` : ''}
          </Text>
          <View style={st.headRow}>
            <Text style={[st.h1, { color: c.text }]}>Attendance</Text>
            {canMark && (
              <TouchableOpacity onPress={() => setImporting(true)} accessibilityLabel="Import from machine" style={[st.iconBtn, { borderColor: c.border, backgroundColor: c.card }]}>
                <Icon name="download-outline" size={17} color={c.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <View style={{ marginBottom: 12 }}><ChipRow options={dayOptions} value={current} onPick={pickDay} /></View>

          {canMark && first && (
            <TouchableOpacity activeOpacity={0.85} onPress={() => open(first._id)} style={[st.startBtn, { backgroundColor: c.primary }]}>
              <Icon name="checkmark" size={17} color="#fff" />
              <Text style={st.startText} numberOfLines={1}>Take {first.name}</Text>
            </TouchableOpacity>
          )}

          {!groups.length ? (
            <View style={[st.empty, { backgroundColor: c.card, borderColor: c.border }]}>
              <Icon name="layers-outline" size={28} color={c.textMuted} />
              <Text style={[st.emptyTitle, { color: c.text }]}>Create your first {W.group.toLowerCase()}</Text>
              <Text style={[st.emptySub, { color: c.textSecondary }]}>
                Attendance is taken {W.group.toLowerCase()} by {W.group.toLowerCase()}. Make one like “Class 10 · 5 PM” in Setup, put {W.member}s in it, then take the roll here.
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Setup')} style={[st.startBtn, { backgroundColor: c.primary, marginTop: 12, marginBottom: 0, alignSelf: 'stretch' }]}>
                <Text style={st.startText}>Open Setup</Text>
              </TouchableOpacity>
            </View>
          ) : (
            batches.map((b) => {
              const state = !b.total ? 'none' : !b.left ? 'done' : b.present + b.absent ? 'part' : 'todo';
              const edge = { done: c.success, part: c.primary, todo: c.warning, none: c.border }[state];
              const tag = {
                done: { text: '✓ Done', bg: c.successSoft, ink: c.successDark },
                part: { text: `${b.left} left`, bg: c.primarySoft, ink: c.primaryDark },
                todo: { text: 'Not taken', bg: c.warningSoft, ink: c.warningDark },
                none: { text: `No ${W.member}s`, bg: c.cardSubtle, ink: c.textMuted },
              }[state];
              return (
                <TouchableOpacity key={b._id} activeOpacity={0.8} onPress={() => open(b._id)} accessibilityLabel={`${b.name}, ${tag.text}`}
                  style={[st.batch, { backgroundColor: c.card, borderColor: c.border, borderLeftColor: edge, opacity: state === 'none' ? 0.75 : 1 }]}>
                  <View style={st.batchTop}>
                    <Text style={[st.batchName, { color: c.text }]} numberOfLines={1}>{b.name}</Text>
                    <View style={[st.tag, { backgroundColor: tag.bg }]}><Text style={[st.tagText, { color: tag.ink }]}>{tag.text}</Text></View>
                  </View>
                  <Text style={[st.batchSub, { color: c.textMuted }]}>
                    {b.total ? `${b.total} ${W.member}${b.total === 1 ? '' : 's'}` : `Add ${W.member}s to this ${W.group.toLowerCase()} first`}
                    {b.present + b.absent > 0 && <Text style={{ color: c.moneyGreen, fontWeight: '600' }}>{` · ${b.present} present`}</Text>}
                    {b.absent > 0 && <Text style={{ color: c.moneyRed, fontWeight: '600' }}>{` · ${b.absent} absent`}</Text>}
                  </Text>
                  {bar(b.present, b.absent, b.total)}
                  <Text style={[st.batchGo, { color: c.primary }]}>
                    {state === 'done' ? 'View or change ›' : state === 'part' ? 'Continue ›' : state === 'todo' ? 'Take attendance ›' : 'Open ›'}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}

          {noBatch.length > 0 && groups.length > 0 && (
            <View style={[st.note, { backgroundColor: c.warningSoft }]}>
              <Icon name="alert-circle-outline" size={16} color={c.warningDark} />
              <Text style={[st.noteText, { color: c.textSecondary }]}>
                {noBatch.length} {W.member}{noBatch.length === 1 ? ' has' : 's have'} no {W.group.toLowerCase()} and {noBatch.length === 1 ? 'is' : 'are'} not listed here. Pick a {W.group.toLowerCase()} for them from the web app’s {Member}s page.
              </Text>
            </View>
          )}
        </ScrollView>
        <AttendanceImportModal visible={importing} biz={biz} onClose={() => setImporting(false)} onImported={load} />
      </SafeAreaView>
    );
  }

  // ── 2. the roll call for one batch ──
  const batch = groups.find((g) => g._id === batchId);
  const members = inBatch(batchId);
  const present = members.filter((m) => m.status === 'present');
  const absent = members.filter((m) => m.status === 'absent');
  const left = members.filter((m) => !m.status);
  const marked = present.length + absent.length;
  const done = members.length > 0 && !left.length;
  const next = batches.find((b) => b._id !== batchId && b.left > 0);
  const query = q.trim().toLowerCase();
  const rows = (tab === 'all' ? members : tab === 'left' ? left : tab === 'in' ? present : absent)
    .filter((m) => !query || `${m.name} ${m.phone || ''}`.toLowerCase().includes(query));
  const lastText = (m) => {
    if (!m.lastPresent) {
      const d = daysBetween(m.joinDay || current, current);
      return { text: d > 0 ? `Not seen since joining · ${d} day${d === 1 ? '' : 's'}` : 'Joined today', red: d >= 7 };
    }
    const d = daysBetween(m.lastPresent, current);
    return { text: d === 1 ? 'Last came yesterday' : d >= 7 ? `${d} days away` : `Last came ${d} days ago`, red: d >= 7 };
  };
  const tellParent = (m) => Linking.openURL(waLink(m.phone, `Hi, ${m.name.split(' ')[0]} was absent from ${batch?.name || 'class'} at ${biz.name} on ${fmt(current, { day: 'numeric', month: 'short' })}. Please let us know if all is well.`));

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: c.background }]}>
      <TopBar title="Attendance" navigation={navigation} />
      <ScrollView contentContainerStyle={st.scroll} refreshControl={refresh} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => setBatchId('')} style={st.back} accessibilityLabel={`All ${W.groups.toLowerCase()}`}>
          <Icon name="chevron-back" size={16} color={c.primary} />
          <Text style={[st.backText, { color: c.primary }]}>All {W.groups.toLowerCase()}</Text>
        </TouchableOpacity>
        <Text style={[st.date, { color: c.textMuted }]}>{fmt(current, { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        <Text style={[st.h1, { color: c.text }]} numberOfLines={2}>{batch?.name || W.group}</Text>
        <View style={{ marginBottom: 12 }}><ChipRow options={dayOptions} value={current} onPick={pickDay} small /></View>

        <View style={[st.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={st.progress}>
            <Text style={[st.progTitle, { color: c.text }]}>{marked} of {members.length} marked</Text>
            <Text style={[st.batchSub, { color: c.textMuted }]}>
              <Text style={{ color: c.moneyGreen, fontWeight: '600' }}>{present.length} present</Text>
              {' · '}
              <Text style={{ color: c.moneyRed, fontWeight: '600' }}>{absent.length} absent</Text>
              {left.length ? ` · ${left.length} left` : ''}
            </Text>
            {bar(present.length, absent.length, members.length)}
            {canMark && left.length > 0 && (
              <View style={st.restRow}>
                <TouchableOpacity disabled={busy} onPress={() => markRest('present')} style={[st.restBtn, { backgroundColor: c.primary, opacity: busy ? 0.6 : 1 }]}>
                  <Icon name="checkmark" size={15} color="#fff" />
                  <Text style={st.restTextPri}>{marked ? `Rest present (${left.length})` : `All present (${left.length})`}</Text>
                </TouchableOpacity>
                {marked > 0 && (
                  <TouchableOpacity disabled={busy} onPress={() => markRest('absent')} style={[st.restBtn, { borderWidth: 1, borderColor: c.border, backgroundColor: c.card, opacity: busy ? 0.6 : 1 }]}>
                    <Icon name="close" size={15} color={c.textSecondary} />
                    <Text style={[st.restText, { color: c.text }]}>Rest absent</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {done && (
            <View style={[st.done, { backgroundColor: c.successSoft }]}>
              <Text style={[st.doneText, { color: c.successDark }]}>✓ Done · {present.length} present, {absent.length} absent</Text>
              <TouchableOpacity onPress={() => (next ? open(next._id) : setBatchId(''))} style={[st.doneBtn, { backgroundColor: next ? c.primary : c.card, borderColor: c.border }]}>
                <Text style={{ color: next ? '#fff' : c.text, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
                  {next ? `Next: ${next.name} ›` : `All ${W.groups.toLowerCase()}`}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={st.cardPad}>
            <ChipRow small value={tab} onPick={setTab} options={[
              { id: 'all', label: 'Everyone', count: members.length },
              { id: 'left', label: 'Not marked', count: left.length },
              { id: 'in', label: 'Present', count: present.length },
              { id: 'out', label: 'Absent', count: absent.length },
            ]} />
            {members.length > 8 && <View style={{ marginTop: 10 }}><SearchFilter value={q} onChange={setQ} placeholder={`Search a ${W.member}`} /></View>}
          </View>

          {!members.length && <Text style={[st.emptyRow, { color: c.textMuted }]}>No {W.member}s in this {W.group.toLowerCase()} yet. Add them from the {Member}s tab.</Text>}
          {members.length > 0 && !rows.length && (
            <Text style={[st.emptyRow, { color: c.textMuted }]}>{query ? `Nobody matches “${q}”.` : tab === 'left' ? 'Everyone is marked.' : 'Nobody here.'}</Text>
          )}
          {rows.map((m, i) => {
            const last = lastText(m);
            const tint = m.status === 'present' ? c.successSoft : m.status === 'absent' ? c.dangerSoft : 'transparent';
            return (
              <View key={m._id} style={[st.row, { borderTopColor: c.border, backgroundColor: tint }]}>
                <Text style={[st.no, { color: c.textMuted }]}>{i + 1}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[st.name, { color: c.text }]} numberOfLines={1}>
                    {m.name}{m.due > 0 ? <Text style={{ color: c.moneyRed, fontSize: 11.5, fontWeight: '600' }}>{`  owes ${rupees(m.due)}`}</Text> : null}
                  </Text>
                  <Text style={[st.sub, { color: !m.status && last.red ? c.moneyRed : c.textMuted }]} numberOfLines={1}>
                    {m.status
                      ? `${m.status === 'present' ? 'Present' : 'Absent'} · ${timeOf(m.at)}${m.markedBy && m.markedBy !== 'you' ? ` · by ${m.markedBy}` : ''}`
                      : last.text}
                  </Text>
                </View>
                {m.status === 'absent' && m.phone ? (
                  <TouchableOpacity onPress={() => tellParent(m)} accessibilityLabel={`Tell ${m.name}'s parent on WhatsApp`} style={[st.wa, { borderColor: c.success }]}>
                    <Icon name="logo-whatsapp" size={17} color={c.moneyGreen} />
                  </TouchableOpacity>
                ) : null}
                {canMark && (
                  <View style={[st.pa, { borderColor: c.border }]}>
                    <TouchableOpacity accessibilityLabel={`${m.name} present`} accessibilityState={{ selected: m.status === 'present' }}
                      onPress={() => mark(m._id, m.status === 'present' ? null : 'present')}
                      style={[st.paBtn, m.status === 'present' && { backgroundColor: c.success }]}>
                      <Text style={[st.paText, { color: m.status === 'present' ? '#fff' : c.textMuted }]}>P</Text>
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityLabel={`${m.name} absent`} accessibilityState={{ selected: m.status === 'absent' }}
                      onPress={() => mark(m._id, m.status === 'absent' ? null : 'absent')}
                      style={[st.paBtn, { borderLeftWidth: 1, borderLeftColor: c.border }, m.status === 'absent' && { backgroundColor: c.danger }]}>
                      <Text style={[st.paText, { color: m.status === 'absent' ? '#fff' : c.textMuted }]}>A</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  date: { fontSize: 13, marginBottom: 2 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontSize: 24, fontWeight: '700', letterSpacing: -0.3, marginBottom: 10 },
  iconBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 12, marginBottom: 12, paddingHorizontal: 14 },
  startText: { color: '#fff', fontSize: 15, fontWeight: '700', flexShrink: 1 },
  batch: { borderWidth: 1, borderLeftWidth: 4, borderRadius: 14, padding: 14, marginBottom: 10, gap: 8 },
  batchTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  batchName: { fontSize: 15, fontWeight: '700', flex: 1 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagText: { fontSize: 11.5, fontWeight: '700' },
  batchSub: { fontSize: 13 },
  batchGo: { fontSize: 13, fontWeight: '700' },
  bar: { flexDirection: 'row', height: 6, borderRadius: 99, overflow: 'hidden' },
  empty: { borderWidth: 1, borderRadius: 14, padding: 22, alignItems: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 8 },
  emptySub: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  note: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, marginTop: 4 },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 4 },
  backText: { fontSize: 13, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  cardPad: { paddingHorizontal: 12, paddingVertical: 10 },
  progress: { padding: 14, gap: 6 },
  progTitle: { fontSize: 15, fontWeight: '700' },
  restRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  restBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 10 },
  restTextPri: { color: '#fff', fontWeight: '700', fontSize: 13 },
  restText: { fontWeight: '700', fontSize: 13 },
  done: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, paddingVertical: 10, flexWrap: 'wrap' },
  doneText: { fontSize: 13.5, fontWeight: '700' },
  doneBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 36, justifyContent: 'center', maxWidth: '100%' },
  emptyRow: { padding: 16, textAlign: 'center', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  no: { width: 20, textAlign: 'right', fontSize: 12, fontWeight: '600' },
  name: { fontSize: 14.5, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2 },
  wa: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pa: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  paBtn: { width: 46, height: 40, alignItems: 'center', justifyContent: 'center' },
  paText: { fontSize: 15, fontWeight: '800' },
});
