import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { api, waLink, WEB_URL } from '../../api/api';
import Icon from '../../components/Icon';
import TopBar from '../../components/TopBar';
import Avatar from '../../components/Avatar';
import QrCode, { qrSvg } from '../../components/QrCode';
import AttendanceImportModal from '../modals/AttendanceImportModal';

const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const timeOf = (at) => new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const fmtShort = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const dayLabel = (day, today) => {
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
};

export default function AttendanceScreen({ navigation }) {
  const { biz, isOwner } = useBiz();
  const { theme } = useTheme();
  const [importing, setImporting] = useState(false);

  const [day, setDay] = useState(null); // null = today
  const [groupId, setGroupId] = useState('');
  const [q, setQ] = useState('');
  const [view, setView] = useState('today'); // 'today' | 'away'
  const [groups, setGroups] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isGym = biz?.type === 'gym';

  const fetchAttendance = useCallback(async () => {
    if (!biz?._id || biz.attendanceEnabled === false) return;
    try {
      const qs = new URLSearchParams({
        ...(day && { day }),
        ...(groupId && { groupId }),
      }).toString();

      const [res, g] = await Promise.all([
        api(`/businesses/${biz._id}/attendance?${qs}`),
        api(`/businesses/${biz._id}/groups`),
      ]);
      setData(res);
      setGroups(Array.isArray(g) ? g : []);
    } catch (err) {
      console.warn('Attendance fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [biz?._id, biz?.attendanceEnabled, day, groupId]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // gym: new QR check-ins appear without pulling to refresh
  useEffect(() => {
    if (!isGym || view !== 'today') return undefined;
    const t = setInterval(fetchAttendance, 30000);
    return () => clearInterval(t);
  }, [isGym, view, fetchAttendance]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAttendance();
    setRefreshing(false);
  };

  const handleMark = async (memberId, status) => {
    try {
      // Optimistic update
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          members: prev.members.map((m) =>
            m._id === memberId
              ? {
                  ...m,
                  status,
                  method: status && 'staff',
                  at: status && new Date().toISOString(),
                }
              : m
          ),
        };
      });

      await api(`/businesses/${biz._id}/attendance`, {
        method: 'PUT',
        body: { day: data?.day, memberId, status },
      });
    } catch (err) {
      Alert.alert('Error', err.message);
      fetchAttendance();
    }
  };

  const handleMarkAllPresent = async () => {
    Alert.alert('Mark All Present?', 'This will mark all remaining members as present for today.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark All',
        onPress: async () => {
          try {
            await api(`/businesses/${biz._id}/attendance/all-present`, {
              method: 'POST',
              body: { day: data?.day, groupId: groupId || undefined },
            });
            await fetchAttendance();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  if (biz?.attendanceEnabled === false) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
        <TopBar navigation={navigation} />
        <View style={styles.centerBox}>
          <Icon name="calendar-outline" size={48} color={theme.colors.textMuted} />
          <Text style={[styles.disabledTitle, { color: theme.colors.text }]}>Attendance is Disabled</Text>
          <Text style={[styles.disabledSub, { color: theme.colors.textSecondary }]}>
            Enable attendance tracking in Business Settings to start marking daily check-ins.
          </Text>
          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: theme.colors.primary, marginTop: 14 }]}
            onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.btnPrimaryText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const today = data?.today || new Date().toISOString().slice(0, 10);
  const current = data?.day || today;
  const isCurrentToday = current >= today;
  const members = data?.members || [];

  const present = members.filter((m) => m.status === 'present').length;
  const absent = members.filter((m) => m.status === 'absent').length;
  const unmarked = members.length - present - absent;
  const fillPct = members.length ? Math.round((present / members.length) * 100) : 0;

  const query = q.trim().toLowerCase();
  const found = query
    ? members.filter((m) => `${m.name} ${m.phone || ''}`.toLowerCase().includes(query))
    : members;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* Universal TopBar */}
      <TopBar navigation={navigation} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }>
        {/* Page Header */}
        <View style={styles.pageHeader}>
          <View style={styles.pageTitleWrap}>
            <Text style={[styles.pageTitle, { color: theme.colors.text }]}>Attendance</Text>
            <Text style={[styles.pageSubtitle, { color: theme.colors.textSecondary }]}>
              {isGym
                ? 'Members check in by scanning your QR code, or import from your biometric machine.'
                : 'Mark who came today. Attendance is only recorded; fees are not affected.'}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setImporting(true)}
            style={[styles.importBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Icon name="download-outline" size={15} color={theme.colors.text} />
            <Text style={[styles.importBtnText, { color: theme.colors.text }]}>Import from machine</Text>
          </TouchableOpacity>
        </View>

        {/* View Mode Tabs: By Day | Not Coming */}
        <View style={[styles.viewTabsWrap, { backgroundColor: theme.colors.cardSubtle, borderColor: theme.colors.border }]}>
          <TouchableOpacity
            onPress={() => setView('today')}
            style={[
              styles.viewTabBtn,
              view === 'today' && { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}>
            <Text
              style={[
                styles.viewTabBtnText,
                { color: view === 'today' ? theme.colors.text : theme.colors.textSecondary, fontWeight: view === 'today' ? '700' : '500' },
              ]}>
              By day
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setView('away')}
            style={[
              styles.viewTabBtn,
              view === 'away' && { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}>
            <Text
              style={[
                styles.viewTabBtnText,
                { color: view === 'away' ? theme.colors.text : theme.colors.textSecondary, fontWeight: view === 'away' ? '700' : '500' },
              ]}>
              Not coming
            </Text>
          </TouchableOpacity>
        </View>

        {view === 'away' ? (
          <NotComing biz={biz} theme={theme} navigation={navigation} />
        ) : (
          <>
            {/* Day Stepper & Group Filter Card */}
            <View style={[styles.controlsCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setDay(addDays(current, -1))}
                  style={[styles.stepperNavBtn, { backgroundColor: theme.colors.cardSubtle, borderColor: theme.colors.border }]}>
                  <Icon name="chevron-back" size={16} color={theme.colors.text} />
                </TouchableOpacity>

                <View style={styles.stepperCenter}>
                  <Text style={[styles.stepperMainLabel, { color: theme.colors.text }]}>
                    {dayLabel(current, today)}
                  </Text>
                  <Text style={[styles.stepperSubLabel, { color: theme.colors.textSecondary }]}>
                    {new Date(`${current}T00:00:00Z`).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'UTC',
                    })}
                  </Text>
                </View>

                <TouchableOpacity
                  disabled={isCurrentToday}
                  activeOpacity={0.7}
                  onPress={() => setDay(addDays(current, 1) >= today ? null : addDays(current, 1))}
                  style={[
                    styles.stepperNavBtn,
                    {
                      backgroundColor: theme.colors.cardSubtle,
                      borderColor: theme.colors.border,
                      opacity: isCurrentToday ? 0.3 : 1,
                    },
                  ]}>
                  <Icon name="chevron-forward" size={16} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              {/* Batches / Groups Filter Pills */}
              {groups.length > 0 && (
                <View style={styles.groupsScrollRow}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupsScroll}>
                    <TouchableOpacity
                      onPress={() => setGroupId('')}
                      style={[
                        styles.groupChip,
                        {
                          backgroundColor: !groupId ? theme.colors.primarySoft : theme.colors.cardSubtle,
                          borderColor: !groupId ? theme.colors.primary : theme.colors.border,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.groupChipText,
                          { color: !groupId ? theme.colors.primaryDark : theme.colors.textSecondary, fontWeight: !groupId ? '700' : '500' },
                        ]}>
                        Everyone
                      </Text>
                    </TouchableOpacity>

                    {groups.map((g) => {
                      const active = groupId === g._id;
                      return (
                        <TouchableOpacity
                          key={g._id}
                          onPress={() => setGroupId(active ? '' : g._id)}
                          style={[
                            styles.groupChip,
                            {
                              backgroundColor: active ? theme.colors.primarySoft : theme.colors.cardSubtle,
                              borderColor: active ? theme.colors.primary : theme.colors.border,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.groupChipText,
                              { color: active ? theme.colors.primaryDark : theme.colors.textSecondary, fontWeight: active ? '700' : '500' },
                            ]}>
                            {g.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Attendance Summary Card with Progress Bar */}
            <View style={[styles.summaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.summaryTopRow}>
                <View>
                  <Text style={[styles.summaryCount, { color: theme.colors.text }]}>
                    {present}{' '}
                    <Text style={[styles.summaryCountSub, { color: theme.colors.textSecondary }]}>
                      of {members.length} {isGym ? 'checked in' : 'present'}
                    </Text>
                  </Text>
                  {!isGym && (
                    <Text style={[styles.summarySubText, { color: theme.colors.textSecondary }]}>
                      {absent} absent · {unmarked} not marked
                    </Text>
                  )}
                </View>

              </View>

              {/* Progress Bar */}
              <View style={[styles.progressBarTrack, { backgroundColor: theme.colors.border }]}>
                <View style={[styles.progressBarFill, { width: `${fillPct}%`, backgroundColor: '#10B981' }]} />
              </View>

              {!isGym && unmarked > 0 && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.btnMarkAll, { backgroundColor: theme.colors.primary }]}
                  onPress={handleMarkAllPresent}>
                  <Icon name="checkmark" size={15} color="#FFFFFF" />
                  <Text style={styles.btnMarkAllText}>
                    Mark {unmarked === members.length ? 'all' : `remaining ${unmarked}`} present
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {isGym && isOwner && <CheckinQR biz={biz} theme={theme} />}

            {/* Search Input */}
            {members.length > 6 && (
              <View style={[styles.searchBox, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.inputBorder }]}>
                <Icon name="search-outline" size={16} color={theme.colors.textMuted} />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Search members"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[styles.searchInput, { color: theme.colors.text }]}
                />
                {q ? (
                  <TouchableOpacity onPress={() => setQ('')}>
                    <Icon name="close-circle" size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {/* The list: gym shows who checked in, then who hasn't; others mark present/absent */}
            <View style={[styles.listCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              {!members.length && (
                <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary, textAlign: 'left' }]}>
                  No active members{groupId ? ' in this group' : ''}.
                </Text>
              )}
              {members.length > 0 && !found.length && (
                <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary, textAlign: 'left' }]}>No member matches “{q}”.</Text>
              )}

              {isGym ? (
                <>
                  {found.filter((m) => m.status === 'present').sort((a, b) => new Date(b.at) - new Date(a.at)).map((m, i) => (
                    <View key={m._id} style={[styles.attRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.border }]}>
                      <Avatar name={m.name} />
                      <TouchableOpacity style={styles.attName} onPress={() => navigation.navigate('MemberDetail', { id: m._id })}>
                        <Text style={[styles.memberName, { color: theme.colors.text }]} numberOfLines={1}>{m.name}</Text>
                        <Text style={[styles.memberPhone, { color: theme.colors.successDark }]}>
                          ✓ {timeOf(m.at)} · {m.method === 'qr' ? 'QR' : m.method === 'biometric' ? 'machine' : 'by staff'}
                          {m.due > 0 ? <Text style={{ color: theme.colors.danger }}> · ₹{m.due.toLocaleString('en-IN')} due</Text> : null}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleMark(m._id, null)} style={styles.undoBtn}>
                        <Text style={[styles.undoText, { color: theme.colors.primary }]}>Undo</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  {found.some((m) => m.status !== 'present') && (
                    <Text style={[styles.subhead, { color: theme.colors.textMuted, borderTopColor: theme.colors.border }, !found.some((m) => m.status === 'present') && { borderTopWidth: 0, marginTop: 0 }]}>
                      Not checked in {current === today ? 'yet' : ''}
                    </Text>
                  )}
                  {found.filter((m) => m.status !== 'present').map((m) => (
                    <View key={m._id} style={styles.attRow}>
                      <Avatar name={m.name} />
                      <TouchableOpacity style={styles.attName} onPress={() => navigation.navigate('MemberDetail', { id: m._id })}>
                        <Text style={[styles.memberName, { color: theme.colors.text }]} numberOfLines={1}>{m.name}</Text>
                        {m.paused ? <Text style={[styles.memberPhone, { color: theme.colors.textMuted }]}>Paused</Text> : null}
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleMark(m._id, 'present')}
                        style={[styles.checkinBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                        <Text style={[styles.checkinText, { color: theme.colors.text }]}>Check in</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              ) : (
                found.map((m, i) => {
                  const isPresent = m.status === 'present';
                  const isAbsent = m.status === 'absent';
                  return (
                    <View key={m._id} style={[styles.attRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.border }]}>
                      <Avatar name={m.name} />
                      <TouchableOpacity style={styles.attName} onPress={() => navigation.navigate('MemberDetail', { id: m._id })}>
                        <Text style={[styles.memberName, { color: theme.colors.text }]} numberOfLines={1}>{m.name}</Text>
                        {m.paused ? <Text style={[styles.memberPhone, { color: theme.colors.textMuted }]}>Paused</Text> : null}
                      </TouchableOpacity>
                      <View style={styles.toggleContainer}>
                        <TouchableOpacity
                          accessibilityLabel={`${m.name} present`}
                          activeOpacity={0.7}
                          onPress={() => handleMark(m._id, isPresent ? null : 'present')}
                          style={[styles.toggleBtn, { borderColor: isPresent ? '#10B981' : theme.colors.border, backgroundColor: isPresent ? '#10B981' : theme.colors.card }]}>
                          <Icon name="checkmark" size={15} color={isPresent ? '#FFFFFF' : theme.colors.textSecondary} />
                          <Text style={[styles.toggleBtnText, { color: isPresent ? '#FFFFFF' : theme.colors.textSecondary }]}>Present</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          accessibilityLabel={`${m.name} absent`}
                          activeOpacity={0.7}
                          onPress={() => handleMark(m._id, isAbsent ? null : 'absent')}
                          style={[styles.toggleBtn, { borderColor: isAbsent ? '#EF4444' : theme.colors.border, backgroundColor: isAbsent ? '#EF4444' : theme.colors.card }]}>
                          <Icon name="close" size={15} color={isAbsent ? '#FFFFFF' : theme.colors.textSecondary} />
                          <Text style={[styles.toggleBtnText, { color: isAbsent ? '#FFFFFF' : theme.colors.textSecondary }]}>Absent</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>

      <AttendanceImportModal visible={importing} biz={biz} onClose={() => setImporting(false)} onImported={fetchAttendance} />
    </SafeAreaView>
  );
}

// The call list: who hasn't come in a while, with call and WhatsApp in one tap
function NotComing({ biz, theme, navigation }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  useEffect(() => {
    let live = true;
    api(`/businesses/${biz._id}/attendance/not-coming?days=${days}`)
      .then((d) => live && setData(d))
      .catch(() => live && setData({ members: [] }));
    return () => { live = false; };
  }, [biz._id, days]);
  const firstName = (n) => n.split(' ')[0];
  const list = data?.members || [];

  return (
    <>
      <View style={[styles.summaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <Text style={[styles.summaryCount, { color: theme.colors.text }]}>
          {data ? list.length : '–'}{' '}
          <Text style={[styles.summaryCountSub, { color: theme.colors.textSecondary }]}>
            member{list.length === 1 ? '' : 's'} not seen in {days}+ days
          </Text>
        </Text>
        <Text style={[styles.summarySubText, { color: theme.colors.textSecondary }]}>
          Call or message them before they quit. Paused members aren't listed.
        </Text>
        <View style={styles.daysRow}>
          {[7, 14, 30].map((d) => {
            const on = days === d;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => setDays(d)}
                style={[styles.groupChip, { backgroundColor: on ? theme.colors.primarySoft : theme.colors.cardSubtle, borderColor: on ? theme.colors.primary : theme.colors.border }]}>
                <Text style={[styles.groupChipText, { color: on ? theme.colors.primaryDark : theme.colors.textSecondary, fontWeight: on ? '700' : '500' }]}>{d}+ days</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.listCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        {data && !list.length && (
          <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary, textAlign: 'left' }]}>
            Everyone has come in the last {days} days.
          </Text>
        )}
        {list.map((m, i) => (
          <View key={m._id} style={[styles.attRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.border }]}>
            <Avatar name={m.name} />
            <TouchableOpacity style={styles.attName} onPress={() => navigation.navigate('MemberDetail', { id: m._id })}>
              <Text style={[styles.memberName, { color: theme.colors.text }]} numberOfLines={1}>{m.name}</Text>
              <Text style={[styles.memberPhone, { color: theme.colors.danger }]}>
                {m.lastPresent ? `Last came ${fmtShort(m.lastPresent)} · ${m.daysAway} days ago` : `Not seen since joining · ${m.daysAway} days`}
              </Text>
            </TouchableOpacity>
            {m.phone ? (
              <>
                <TouchableOpacity
                  accessibilityLabel={`Call ${m.name}`}
                  onPress={() => Linking.openURL(`tel:${m.phone}`)}
                  style={[styles.iconBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                  <Icon name="call-outline" size={17} color={theme.colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel={`WhatsApp ${m.name}`}
                  onPress={() => Linking.openURL(waLink(m.phone, `Hi ${firstName(m.name)}, we haven't seen you at ${biz.name} ${m.lastPresent ? `since ${fmtShort(m.lastPresent)}` : 'yet'}. Hope all is well. See you soon!`))}
                  style={[styles.iconBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                  <Icon name="logo-whatsapp" size={18} color="#25D366" />
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        ))}
      </View>
    </>
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
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
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
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
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
