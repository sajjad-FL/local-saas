import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  TextInput,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import * as Print from 'expo-print';
import { useBiz } from '../../context/BizContext';
import { useTheme } from '../../context/ThemeContext';
import { api, waLink, WEB_URL, rupees } from '../../api/api';
import { refreshAll } from '../../api/queryClient';
import { useFocusEffect } from '@react-navigation/native';
import { words } from '../../constants/wording';
import PickMember from '../../components/PickMember';
import Icon from '../../components/Icon';
import TopBar from '../../components/TopBar';
import { ScreenSkeleton } from '../../components/Loader';
import Avatar from '../../components/Avatar';
import QrCode, { qrSvg } from '../../components/QrCode';
import AttendanceImportModal from '../modals/AttendanceImportModal';
import TuitionAttendance from './TuitionAttendance';

const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const timeOf = (at) => new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const fmtShort = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });


// Tuition takes the roll batch by batch; everyone else keeps the daily list
export default function AttendanceScreen(props) {
  const { biz } = useBiz();
  if (biz?.type === 'tuition' && biz.attendanceEnabled !== false) return <TuitionAttendance {...props} biz={biz} />;
  return <DailyAttendance {...props} />;
}

function DailyAttendance({ navigation }) {
  const { biz, isOwner } = useBiz();
  const { theme } = useTheme();
  const c = theme.colors;
  const W = words(biz?.type);
  const isGym = biz?.type === 'gym';
  const canMark = (biz?.access ? biz.access.level : 3) >= 1;

  const [day, setDay] = useState(null); // null = today (the server decides "today")
  const [groupId, setGroupId] = useState('');
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('notin'); // 'notin' | 'in' | 'absent' | 'away'
  const [awayDays, setAwayDays] = useState(7);
  const [groups, setGroups] = useState([]);
  const [data, setData] = useState(null);
  const [away, setAway] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [picking, setPicking] = useState(false);

  const fetchAttendance = useCallback(async () => {
    if (!biz?._id || biz.attendanceEnabled === false) return;
    try {
      const qs = new URLSearchParams({ ...(day && { day }), ...(groupId && { groupId }) }).toString();
      const [res, g] = await Promise.all([
        api(`/businesses/${biz._id}/attendance?${qs}`),
        api(`/businesses/${biz._id}/groups`).catch(() => []),
      ]);
      setData(res);
      setGroups(Array.isArray(g) ? g : []);
    } catch (err) {
      console.warn('Attendance fetch error', err);
    }
  }, [biz, day, groupId]);
  const fetchAway = useCallback(async () => {
    if (!biz?._id || biz.attendanceEnabled === false) return;
    try { setAway(await api(`/businesses/${biz._id}/attendance/not-coming?days=${awayDays}`)); } catch { setAway({ members: [] }); }
  }, [biz, awayDays]);

  useFocusEffect(useCallback(() => { fetchAttendance(); fetchAway(); }, [fetchAttendance, fetchAway]));
  // gym: new QR check-ins appear without pulling to refresh
  useEffect(() => {
    if (!isGym) return undefined;
    const t = setInterval(fetchAttendance, 30000);
    return () => clearInterval(t);
  }, [isGym, fetchAttendance]);

  const onRefresh = async () => { setRefreshing(true); await refreshAll(); await Promise.all([fetchAttendance(), fetchAway()]); setRefreshing(false); };

  const handleMark = async (memberId, status) => {
    setData((prev) => prev && { ...prev, members: prev.members.map((m) => (m._id === memberId ? { ...m, status, method: status && 'staff', markedBy: status && 'you', at: status && new Date().toISOString() } : m)) });
    try {
      await api(`/businesses/${biz._id}/attendance`, { method: 'PUT', body: { day: data?.day, memberId, status } });
      fetchAway();
    } catch (err) {
      Alert.alert('Could not save', err.message);
      fetchAttendance();
    }
  };
  const markAllPresent = async () => {
    try {
      await api(`/businesses/${biz._id}/attendance/all-present`, { method: 'POST', body: { day: data?.day, groupId: groupId || undefined } });
      await fetchAttendance();
    } catch (err) {
      Alert.alert('Could not save', err.message);
    }
  };

  if (biz?.attendanceEnabled === false) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: c.background }]}>
        <TopBar navigation={navigation} />
        <View style={styles.centerBox}>
          <Icon name="calendar-outline" size={48} color={c.textMuted} />
          <Text style={[styles.disabledTitle, { color: c.text }]}>Attendance is off</Text>
          <Text style={[styles.disabledSub, { color: c.textSecondary }]}>Turn on attendance in Settings to start marking who came each day.</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (!data) return <ScreenSkeleton navigation={navigation} />;

  const today = data.today;
  const current = data.day;
  const members = data.members || [];
  const present = members.filter((m) => m.status === 'present');
  const absent = members.filter((m) => m.status === 'absent');
  const notIn = members.filter((m) => (isGym ? m.status !== 'present' : !m.status));
  const week = data.week || [];
  const avg = week.length ? Math.round(week.reduce((n, d) => n + d.present, 0) / week.length) : 0;
  const peak = Math.max(1, ...week.map((d) => d.present));
  const isToday = current === today;
  const query = q.trim().toLowerCase();
  const match = (m) => !query || `${m.name} ${m.phone || ''}`.toLowerCase().includes(query);
  const fmtLong = (d, withYear) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', ...(withYear && { year: 'numeric' }), timeZone: 'UTC' });
  const subtitle = `${fmtLong(current, !isToday)} · ${present.length} of ${members.length} ${isGym ? 'in' : 'present'}${isToday ? ' so far' : ''}`;
  const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
  const lastText = (m) => {
    if (m.paused) return { text: 'Paused', red: false };
    if (!m.lastPresent) {
      const d = daysBetween(m.joinDay || current, current);
      return { text: d > 0 ? `Not seen since joining · ${d} day${d === 1 ? '' : 's'}` : 'Joined today', red: d >= 7 };
    }
    const d = daysBetween(m.lastPresent, current);
    return { text: d === 1 ? 'Last came yesterday' : d >= 7 ? `${d} days away` : `Last came ${d} days ago`, red: d >= 7 };
  };
  const weekLabel = (d) => (d === today ? 'Today' : d === addDays(today, -1) ? 'Yesterday' : new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }));

  const tabs = [
    { id: 'notin', label: isGym ? (isToday ? 'Not in yet' : "Didn't come") : 'Not marked', dot: '#D97706', count: notIn.length },
    { id: 'in', label: isGym ? 'Checked in' : 'Present', dot: '#16A34A', count: present.length },
    !isGym && { id: 'absent', label: 'Absent', dot: '#94A3B8', count: absent.length },
    { id: 'away', label: `Not coming ${awayDays}+ days`, dot: '#DC2626', count: away ? away.members.length : '–' },
  ].filter(Boolean);
  const cards = [
    { id: 'in', label: 'In', value: `${present.length} / ${members.length}`, ink: c.moneyGreen },
    { id: 'notin', label: 'Not in', value: String(notIn.length) },
    { id: 'away', label: 'Away', value: away ? String(away.members.length) : '–', ink: away?.members.length ? c.moneyRed : undefined },
    { id: null, label: 'Avg/day', value: String(avg) },
  ];
  const rows = tab === 'notin' ? notIn : tab === 'in' ? [...present].sort((a, b) => new Date(b.at) - new Date(a.at)) : tab === 'absent' ? absent : [];
  const shownRows = rows.filter(match);
  const actions = [
    canMark && { key: 'in', label: isGym ? 'Check in' : 'Present', icon: 'checkmark', primary: true, disabled: !notIn.length, go: () => setPicking(true) },
    canMark && { key: 'import', label: 'Import', icon: 'download-outline', go: () => setImporting(true) },
  ].filter(Boolean);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: c.background }]}>
      <TopBar title="Attendance" navigation={navigation} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} progressBackgroundColor={c.card} />}>
        <Text style={[styles.date, { color: c.textMuted }]}>{subtitle}</Text>
        <Text style={[styles.h1, { color: c.text }]}>Attendance</Text>

        {/* one tap each, like the web's tiles */}
        {actions.length > 0 && (
          <View style={styles.quickRow}>
            {actions.map((a) => (
              <TouchableOpacity key={a.key} activeOpacity={0.8} disabled={a.disabled} onPress={a.go} accessibilityLabel={a.label}
                style={[styles.quick, { backgroundColor: c.card, borderColor: c.border, opacity: a.disabled ? 0.5 : 1 }]}>
                <View style={[styles.quickIcon, { backgroundColor: a.primary ? c.primary : c.primarySoft }]}>
                  <Icon name={a.icon} size={16} color={a.primary ? '#FFFFFF' : c.primaryDark} />
                </View>
                <Text style={[styles.quickText, { color: c.text }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
            {/* keep tiles the web's size: three to a row */}
            {[...Array(Math.max(0, 3 - actions.length))].map((_, i) => <View key={i} style={styles.quickGap} />)}
          </View>
        )}

        {/* the week at a glance; tap a day to open it */}
        <View style={[styles.week, { backgroundColor: c.card, borderColor: c.border }]}>
          {week.map((d) => {
            const on = d.day === current;
            return (
              <TouchableOpacity key={d.day} onPress={() => setDay(d.day === today ? null : d.day)} accessibilityState={{ selected: on }}
                accessibilityLabel={`${fmtLong(d.day)}: ${d.present} came`}
                style={[styles.wday, on && { borderColor: c.primary, borderWidth: 1.5, backgroundColor: c.primarySoft }]}>
                <Text style={[styles.wdayLabel, { color: on ? c.primaryDark : c.textMuted, fontWeight: on ? '600' : '500' }]} numberOfLines={1}>{weekLabel(d.day)}</Text>
                <View style={styles.wdayBarBox}>
                  <View style={[styles.wdayBar, { height: `${Math.max(4, (d.present / peak) * 100)}%`, backgroundColor: on ? c.primary : c.primaryBorder }]} />
                </View>
                <Text style={[styles.wdayNum, { color: c.text }]}>{d.present}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* four numbers; tap one to show that list */}
        <View style={styles.cards}>
          {cards.map((k) => {
            const on = !!k.id && tab === k.id;
            return (
              <TouchableOpacity key={k.label} disabled={!k.id} onPress={() => setTab(k.id)} activeOpacity={0.8}
                style={[styles.card, { backgroundColor: c.card, borderColor: on ? c.primary : c.border }, on && { borderWidth: 2 }]}>
                <Text style={[styles.cardLabel, { color: c.textMuted }]} numberOfLines={1}>{k.label}</Text>
                <Text style={[styles.cardValue, { color: k.ink || c.text }]} numberOfLines={1}>{k.value}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* the list: tabs, search, batch, mark all, one row each */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabs, { borderBottomColor: c.border }]}>
          {tabs.map((t) => {
            const on = tab === t.id;
            return (
              <TouchableOpacity key={t.id} onPress={() => setTab(t.id)} accessibilityRole="tab" accessibilityState={{ selected: on }}
                style={[styles.tab, { borderBottomColor: on ? c.primary : 'transparent' }]}>
                <View style={[styles.dotSmall, { backgroundColor: t.dot }]} />
                <Text style={{ fontSize: 14, fontWeight: on ? '600' : '500', color: on ? c.primaryDark : c.textMuted }}>{t.label}</Text>
                <View style={[styles.tabCount, { backgroundColor: on ? c.primary : c.cardSubtle }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: on ? '#fff' : c.textSecondary }}>{t.count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.tools}>
          {tab !== 'away' ? (
            <>
              <View style={[styles.search, { borderColor: c.border, backgroundColor: c.card }]}>
                <Icon name="search" size={15} color={c.textMuted} />
                <TextInput value={q} onChangeText={setQ} placeholder={`Search a ${W.member}`} placeholderTextColor={c.textMuted} style={[styles.searchInput, { color: c.text }]} />
              </View>
              {groups.length > 0 && (
                <View style={[styles.seg, { backgroundColor: c.cardSubtle }]}>
                  {[{ _id: '', name: 'Everyone' }, ...groups].map((g) => {
                    const on = groupId === g._id;
                    return (
                      <TouchableOpacity key={g._id || 'all'} onPress={() => setGroupId(g._id)} style={[styles.segBtn, on && { backgroundColor: c.card }]}>
                        <Text style={{ fontSize: 13, fontWeight: on ? '600' : '400', color: on ? c.text : c.textSecondary }}>{g.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {canMark && tab === 'notin' && notIn.length > 0 && (
                <TouchableOpacity onPress={markAllPresent} style={[styles.allBtn, { borderColor: c.border, backgroundColor: c.card }]}>
                  <Icon name="checkmark" size={14} color={c.text} />
                  <Text style={{ fontSize: 13.5, fontWeight: '500', color: c.text }}>Mark all {notIn.length} present</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <Text style={{ fontSize: 13, color: c.textMuted, flexBasis: '100%' }}>{`Call or message them before they quit. Paused ${W.member}s aren't listed.`}</Text>
              <View style={[styles.seg, { backgroundColor: c.cardSubtle }]}>
                {[7, 14, 30].map((d) => (
                  <TouchableOpacity key={d} onPress={() => setAwayDays(d)} style={[styles.segBtn, awayDays === d && { backgroundColor: c.card }]}>
                    <Text style={{ fontSize: 13, fontWeight: awayDays === d ? '600' : '400', color: awayDays === d ? c.text : c.textSecondary }}>{d}+ days</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>

        {tab === 'away' ? (
          <View>
            {away && !away.members.length && <Text style={[styles.empty, { color: c.textMuted }]}>Everyone has come in the last {awayDays} days.</Text>}
            {(away?.members || []).map((m) => (
              <View key={m._id} style={[styles.row, { borderTopColor: c.border }]}>
                <Avatar name={m.name} size={32} />
                <View style={styles.who}>
                  <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{m.name}</Text>
                  <Text style={[styles.meta, { color: c.moneyRed }]} numberOfLines={1}>
                    {m.lastPresent ? `Last came ${fmtShort(m.lastPresent)} · ${m.daysAway} days ago` : `Not seen since joining · ${m.daysAway} days`}
                  </Text>
                </View>
                {m.phone ? (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${m.phone}`)} accessibilityLabel={`Call ${m.name}`} style={[styles.iconBtn, { borderColor: c.border }]}>
                      <Icon name="call-outline" size={15} color={c.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => Linking.openURL(waLink(m.phone, `Hi ${m.name.split(' ')[0]}, we haven't seen you at ${biz.name} ${m.lastPresent ? `since ${fmtShort(m.lastPresent)}` : 'yet'}. Hope all is well. See you soon!`))}
                      style={[styles.waBtn, { backgroundColor: c.successSoft, borderColor: c.successBorder }]}>
                      <Icon name="logo-whatsapp" size={14} color={c.moneyGreen} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: c.moneyGreen }}>WhatsApp</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <View>
            {!members.length && <Text style={[styles.empty, { color: c.textMuted }]}>No active {W.member}s{groupId ? ' in this batch' : ''}.</Text>}
            {members.length > 0 && !shownRows.length && (
              <Text style={[styles.empty, { color: c.textMuted }]}>
                {query ? `Nobody matches “${q}”.` : tab === 'notin' ? (isGym ? 'Everyone is in. 🎉' : 'Everyone is marked.') : tab === 'in' ? 'Nobody yet.' : 'Nobody absent.'}
              </Text>
            )}
            {shownRows.map((m) => {
              const last = lastText(m);
              const info = [m.groupName, m.planName].filter(Boolean).join(' · ');
              return (
                <View key={m._id} style={[styles.row, { borderTopColor: c.border }]}>
                  <View style={styles.rowTop}>
                    <Avatar name={m.name} size={32} />
                    <View style={styles.who}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.name, { color: c.text, flexShrink: 1 }]} numberOfLines={1}>{m.name}</Text>
                        {m.due > 0 && (
                          <View style={[styles.owes, { backgroundColor: theme.isDark ? 'rgba(248,113,113,0.14)' : '#FEF1F0' }]}>
                            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.isDark ? '#F87171' : '#B42318' }}>owes {rupees(m.due)}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.meta, { color: c.textMuted }]} numberOfLines={1}>
                        {m.status === 'present'
                          ? `${timeOf(m.at)} · ${m.method === 'staff' && m.markedBy ? `marked by ${m.markedBy}` : { qr: 'scanned QR', biometric: 'machine', staff: 'by staff' }[m.method] || 'marked'}`
                          : info || 'No plan'}
                      </Text>
                    </View>
                    {canMark && (isGym ? (
                      m.status === 'present'
                        ? <TouchableOpacity onPress={() => handleMark(m._id, null)} style={[styles.gymBtn, { borderColor: c.border, backgroundColor: c.card }]}><Text style={{ fontWeight: '600', color: c.text }}>Undo</Text></TouchableOpacity>
                        : <TouchableOpacity onPress={() => handleMark(m._id, 'present')} style={[styles.gymBtn, { backgroundColor: c.primary, borderColor: c.primary }]}><Text style={{ fontWeight: '600', color: '#fff' }}>Check in</Text></TouchableOpacity>
                    ) : (
                      <View style={[styles.toggle, { borderColor: c.border }]}>
                        <TouchableOpacity accessibilityLabel={`${m.name} present`} accessibilityState={{ selected: m.status === 'present' }}
                          onPress={() => handleMark(m._id, m.status === 'present' ? null : 'present')}
                          style={[styles.toggleBtn, m.status === 'present' && { backgroundColor: c.success }]}>
                          <Icon name="checkmark" size={16} color={m.status === 'present' ? '#fff' : c.textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity accessibilityLabel={`${m.name} absent`} accessibilityState={{ selected: m.status === 'absent' }}
                          onPress={() => handleMark(m._id, m.status === 'absent' ? null : 'absent')}
                          style={[styles.toggleBtn, { borderLeftWidth: 1, borderLeftColor: c.border }, m.status === 'absent' && { backgroundColor: c.danger }]}>
                          <Icon name="close" size={16} color={m.status === 'absent' ? '#fff' : c.textMuted} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                  {m.status !== 'present' && <Text style={[styles.last, { color: last.red ? c.moneyRed : c.textMuted, fontWeight: last.red ? '500' : '400' }]}>{last.text}</Text>}
                </View>
              );
            })}
          </View>
        )}

        {isGym && isOwner && <View style={{ marginTop: 16 }}><CheckinQR biz={biz} theme={theme} /></View>}
      </ScrollView>

      <PickMember visible={picking} members={notIn.filter((m) => !m.paused).map((m) => ({ ...m, balance: m.due }))} word={W.member}
        onClose={() => setPicking(false)} onPick={(m) => { setPicking(false); handleMark(m._id, 'present'); }} />
      <AttendanceImportModal visible={importing} biz={biz} onClose={() => setImporting(false)} onImported={fetchAttendance} />
    </SafeAreaView>
  );
}

// Gym owner: the QR members scan at the entrance, a printable poster, and a reset
function CheckinQR({ biz, theme }) {
  const [token, setToken] = useState(null);
  const [open, setOpen] = useState(false); // printed once, so it stays folded and the check-ins come first
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/businesses/${biz._id}/checkin-link`, { method: 'POST' }).then((d) => setToken(d?.token || null)).catch(() => {});
  }, [biz._id]);
  const url = token ? `${WEB_URL}/c/${token}` : null;

  const printPoster = async () => {
    if (!url) return;
    const svg = await qrSvg(url);
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body{font-family:-apple-system,Roboto,sans-serif;text-align:center;padding:48px 24px;color:#0F172A}
      h1{font-size:40px;margin:0 0 8px}.sub{font-size:24px;color:#475569;margin:0 0 28px}
      .code svg{width:70%;max-width:420px;height:auto}p{font-size:18px;color:#334155;max-width:520px;margin:28px auto 0}</style></head>
      <body><h1>${biz.name.replace(/</g, '&lt;')}</h1><p class="sub">Scan to check in</p><div class="code">${svg}</div>
      <p>Open your phone camera, point it at the code, then enter your mobile number.</p></body></html>`;
    if (Platform.OS === 'web') {
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
      return;
    }
    await Print.printAsync({ html });
  };

  const reset = () => {
    Alert.alert(
      'Reset the check-in QR?',
      'Posters you already printed will stop working. Use this if the code was shared outside the gym, then print a new poster.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset QR',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const d = await api(`/businesses/${biz._id}/checkin-link`, { method: 'POST', body: { rotate: true } });
              setToken(d?.token || null);
            } catch (err) {
              Alert.alert('Error', err.message);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  if (!open) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setOpen(true)}
        style={[styles.qrFolded, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <QrCode value={url} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.memberName, { color: theme.colors.text }]}>Check-in QR</Text>
          <Text style={[styles.memberPhone, { color: theme.colors.textMuted }]}>Show, print the poster or reset it</Text>
        </View>
        <Icon name="chevron-down" size={16} color={theme.colors.textMuted} />
      </TouchableOpacity>
    );
  }
  return (
    <View style={[styles.qrCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={styles.qrCodeWrap}>
        <QrCode value={url} size={200} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 }}>
        <Icon name="calendar-outline" size={17} color={theme.colors.primary} />
        <Text style={[styles.qrTitle, { color: theme.colors.text }]}>Check-in QR</Text>
      </View>
      <Text style={[styles.summarySubText, { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 12 }]}>
        Print it and stick it at the entrance. Members scan it with their phone camera and enter their mobile number. No app needed.
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={!url}
          onPress={printPoster}
          style={[styles.qrBtn, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary, opacity: url ? 1 : 0.5 }]}>
          <Icon name="print-outline" size={15} color="#FFFFFF" />
          <Text style={[styles.qrBtnText, { color: '#FFFFFF' }]}>Print poster</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={busy}
          onPress={reset}
          style={[styles.qrBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.qrBtnText, { color: theme.colors.text }]}>Reset QR</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setOpen(false)} style={styles.undoBtn}>
          <Text style={[styles.undoText, { color: theme.colors.textMuted }]}>Hide</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  date: { fontSize: 13, marginBottom: 2 },
  h1: { fontSize: 24, fontWeight: '700', letterSpacing: -0.3, marginBottom: 10 },
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  quick: { flex: 1, height: 66, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  quickGap: { flex: 1 },
  quickIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  quickText: { fontSize: 12, fontWeight: '600' },
  week: { flexDirection: 'row', gap: 2, padding: 6, borderWidth: 1, borderRadius: 14, marginBottom: 12 },
  wday: { flex: 1, minWidth: 0, alignItems: 'center', gap: 5, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  wdayLabel: { fontSize: 10.5 },
  wdayBarBox: { height: 30, width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  wdayBar: { width: 14, borderTopLeftRadius: 5, borderTopRightRadius: 5, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  wdayNum: { fontSize: 12, fontWeight: '700' },
  cards: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  card: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 10, gap: 2 },
  cardLabel: { fontSize: 11 },
  cardValue: { fontSize: 16, fontWeight: '800' },
  tabs: { flexGrow: 0, borderBottomWidth: 1 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: 9, borderBottomWidth: 2, marginBottom: -1 },
  dotSmall: { width: 8, height: 8, borderRadius: 4 },
  tabCount: { minWidth: 22, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  tools: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingVertical: 10 },
  search: { flexBasis: '100%', height: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  seg: { flexDirection: 'row', gap: 4, padding: 3, borderRadius: 10 },
  segBtn: { height: 30, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  allBtn: { flexBasis: '100%', height: 40, borderWidth: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  empty: { textAlign: 'center', paddingVertical: 24, fontSize: 13.5 },
  row: { borderTopWidth: 1, paddingVertical: 12, paddingHorizontal: 2, gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  who: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12.5, marginTop: 1 },
  owes: { height: 20, paddingHorizontal: 7, borderRadius: 99, justifyContent: 'center' },
  last: { fontSize: 12.5, paddingLeft: 44 },
  toggle: { flexDirection: 'row', borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  toggleBtn: { height: 42, width: 44, alignItems: 'center', justifyContent: 'center' },
  gymBtn: { minWidth: 96, height: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  iconBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  waBtn: { height: 36, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    height: 36,
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
  },
  importBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 12,
  },
  attRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  attName: {
    flex: 1,
    minWidth: 0,
  },
  undoBtn: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  undoText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  subhead: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 4,
    paddingBottom: 2,
  },
  checkinBtn: {
    borderWidth: 1,
    borderRadius: 8,
    height: 34,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkinText: {
    fontSize: 13,
    fontWeight: '600',
  },
  daysRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  qrFolded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  qrCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  qrCodeWrap: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  qrTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  qrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    height: 36,
    paddingHorizontal: 12,
  },
  qrBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 40,
  },
  pageHeader: {
    marginBottom: 14,
  },
  pageTitleWrap: {
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 17,
  },
  btnPrimary: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  viewTabsWrap: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  viewTabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  viewTabBtnText: {
    fontSize: 12,
  },
  controlsCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCenter: {
    alignItems: 'center',
  },
  stepperMainLabel: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  stepperSubLabel: {
    fontSize: 11.5,
    marginTop: 1,
  },
  groupsScrollRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  groupsScroll: {
    gap: 6,
  },
  groupChip: {
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  groupChipText: {
    fontSize: 11.5,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryCount: {
    fontSize: 18,
    fontWeight: '800',
  },
  summaryCountSub: {
    fontSize: 13,
    fontWeight: '500',
  },
  summarySubText: {
    fontSize: 11.5,
    marginTop: 2,
  },
  btnMarkAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 8,
    marginTop: 12,
  },
  btnMarkAllText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 6,
    width: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 12,
  },
  listSection: {
    gap: 8,
  },
  memberAttCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  memberAttRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#8B5CF6',
    fontSize: 13,
    fontWeight: '700',
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
  },
  memberPhone: {
    fontSize: 11,
    marginTop: 1,
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  toggleBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  awayCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 44,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: 12,
  },
  awayTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  awaySub: {
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 2,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  disabledTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 10,
  },
  disabledSub: {
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});
