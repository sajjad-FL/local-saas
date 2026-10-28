import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  Linking,
} from 'react-native';
import { useBiz } from '../../context/BizContext';
import { useTheme } from '../../context/ThemeContext';
import { api, rupees, waLink, remindMsg, formatDate } from '../../api/api';
import { words } from '../../constants/wording';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import TopBar from '../../components/TopBar';
import Avatar from '../../components/Avatar';
import { tint } from '../../constants/theme';

// Modals
import AddMemberModal from '../modals/AddMemberModal';
import AddExpenseModal from '../modals/AddExpenseModal';
import RecordPaymentModal from '../modals/RecordPaymentModal';
import BulkRemindModal from '../modals/BulkRemindModal';

const DAY = 86400000;
const daysSince = (d) => Math.max(0, Math.floor((Date.now() - new Date(d)) / DAY));
const daysUntil = (d) => Math.ceil((new Date(d) - Date.now()) / DAY);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
const shortDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const PAY_MODE = { cash: 'Cash', upi: 'UPI', card: 'Card', bank_transfer: 'Bank transfer', bank: 'Bank transfer' };


const roomLabel = (r, groupList = []) => {
  const g = groupList.find((x) => x._id === (r.groupId?._id || r.groupId));
  const f = g?.floors?.find((x) => x._id === r.floorId);
  return [g?.name, f?.name, `Room ${r.roomNo}`].filter(Boolean).join(' · ');
};

export default function DashboardScreen({ navigation }) {
  const { biz, currentBizId } = useBiz();
  const { theme } = useTheme();

  const [dashboardData, setDashboardData] = useState(null);
  const [monthReport, setMonthReport] = useState(null);
  const [attendanceToday, setAttendanceToday] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [recordPaymentMember, setRecordPaymentMember] = useState(null);
  const [bulkRemindOpen, setBulkRemindOpen] = useState(false);

  const isHostel = biz?.type === 'hostel';
  const w = words(biz?.type);

  const fetchDashboardData = useCallback(async () => {
    if (!currentBizId) return;
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
      const tz = now.getTimezoneOffset();

      const promises = [
        api(`/businesses/${currentBizId}/dashboard`),
        api(`/businesses/${currentBizId}/report?from=${from}&to=${to}&tz=${tz}`),
      ];

      if (biz?.attendanceEnabled !== false) {
        promises.push(api(`/businesses/${currentBizId}/attendance`));
      } else {
        promises.push(Promise.resolve(null));
      }

      if (biz?.type === 'hostel') {
        promises.push(api(`/businesses/${currentBizId}/rooms`));
        promises.push(api(`/businesses/${currentBizId}/groups`));
      } else {
        promises.push(Promise.resolve([]));
        promises.push(Promise.resolve([]));
      }

      const [dash, report, att, r, g] = await Promise.all(promises);
      setDashboardData(dash);
      setMonthReport(report);
      setAttendanceToday(att);
      setRooms(Array.isArray(r) ? r : []);
      setGroups(Array.isArray(g) ? g : []);
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentBizId, biz?.type, biz?.attendanceEnabled]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  if (!biz) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerBox}>
          <Text style={{ color: theme.colors.textSecondary }}>No workspace selected</Text>
        </View>
      </SafeAreaView>
    );
  }

  const pending = dashboardData?.pending || [];
  const pendingTotal = dashboardData?.pendingTotal || 0;
  const activeMembers = dashboardData?.activeMembers || 0;
  const membersTable = dashboardData?.membersTable || [];

  const now = new Date();
  const monthName = now.toLocaleDateString('en-IN', { month: 'long' });
  const todayFormatted = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const received = monthReport?.received ?? 0;
  const spent = monthReport?.expenses ?? 0;
  const profit = monthReport?.profit ?? 0;
  const collectedPct =
    received + pendingTotal > 0
      ? Math.round((received / (received + pendingTotal)) * 100)
      : 100;

  // Hostel beds calculation matching web DashboardHome.jsx
  const totalBeds = rooms.reduce((s, r) => s + r.capacity, 0);
  const filledBeds = rooms.reduce((s, r) => s + Math.min(r.occupied || 0, r.capacity), 0);
  const freeRooms = rooms
    .filter((r) => (r.occupied || 0) < r.capacity)
    .sort(
      (a, b) =>
        b.capacity - (b.occupied || 0) - (a.capacity - (a.occupied || 0)) ||
        natural(a.roomNo, b.roomNo)
    );

  // Renewing soon matching web DashboardHome.jsx
  const upcoming = membersTable
    .filter(
      (m) =>
        m.status === 'active' &&
        m.balance <= 0 &&
        m.nextRenewal &&
        daysUntil(m.nextRenewal) >= 0
    )
    .sort((a, b) => new Date(a.nextRenewal) - new Date(b.nextRenewal));
  const renewingSoon = upcoming.filter((m) => daysUntil(m.nextRenewal) <= 14).slice(0, 6);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* TopBar with Brand + Sun/Moon theme toggle */}
      <TopBar title="Dashboard" navigation={navigation} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }>
        {/* TODAY HEADER & QUICK ACTIONS */}
        <View style={styles.todayHeader}>
          <Text style={[styles.todayTitle, { color: theme.colors.text }]}>Today</Text>
          <Text style={[styles.todayDate, { color: theme.colors.textMuted }]}>
            {todayFormatted}
          </Text>

          <View style={styles.todayActions}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.btnActionSecondary,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
              onPress={() => setAddExpenseOpen(true)}>
              <Text style={[styles.btnActionSecondaryText, { color: theme.colors.text }]}>
                ₹  Add expense
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.btnActionPrimary, { backgroundColor: '#10B981' }]}
              onPress={() => setAddMemberOpen(true)}>
              <Text style={styles.btnActionPrimaryText}>
                + Add {w.member ? w.member.toLowerCase() : 'member'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 1. THE MONTH IN FOUR NUMBERS (.dash-kpis); each opens the detail */}
        <View style={styles.kpiGrid}>
          {[
            {
              key: 'collect',
              tone: pendingTotal > 0 ? '#EF4444' : '#10B981',
              label: 'TO COLLECT',
              value: rupees(pendingTotal),
              valueColor: pendingTotal > 0 ? theme.colors.danger : theme.colors.text,
              sub: pendingTotal > 0 ? `${plural(pending.length, w.member)} owe` : 'Everyone has paid',
              go: () => navigation.navigate('Members', { filter: 'owing' }),
            },
            {
              key: 'collected',
              tone: '#3B82F6',
              label: `COLLECTED · ${monthName.toUpperCase()}`,
              value: rupees(received),
              bar: collectedPct,
              sub: `${collectedPct}% of this month's fees`,
              go: () => navigation.navigate('Reports'),
            },
            {
              key: 'spent',
              tone: '#F59E0B',
              label: `SPENT · ${monthName.toUpperCase()}`,
              value: rupees(spent),
              sub: spent ? 'rent, salaries, bills' : 'no expenses yet',
              go: () => navigation.navigate('Reports', { view: 'expenses' }),
            },
            {
              key: 'profit',
              tone: profit < 0 ? '#EF4444' : '#8B5CF6',
              label: `${profit < 0 ? 'LOSS' : 'PROFIT'} · ${monthName.toUpperCase()}`,
              value: `${profit < 0 ? '−' : ''}${rupees(Math.abs(profit))}`,
              valueColor: profit < 0 ? theme.colors.danger : theme.colors.text,
              sub: 'received minus spent',
              go: () => navigation.navigate('Reports'),
            },
          ].map((k) => (
            <TouchableOpacity
              key={k.key}
              activeOpacity={0.8}
              onPress={k.go}
              style={[
                styles.kpiCard,
                {
                  backgroundColor: tint(k.tone, theme.isDark ? 0.1 : 0.06, theme.colors.card),
                  borderColor: tint(k.tone, theme.isDark ? 0.3 : 0.28, theme.colors.card),
                  borderTopColor: k.tone,
                },
              ]}>
              <Text style={[styles.kpiLabel, { color: theme.colors.textMuted }]} numberOfLines={1}>
                {k.label}
              </Text>
              <Text style={[styles.kpiValue, { color: k.valueColor || theme.colors.text }]} numberOfLines={1}>
                {k.value}
              </Text>
              {k.bar !== undefined && (
                <View style={[styles.kpiTrack, { backgroundColor: theme.colors.border }]}>
                  <View style={[styles.kpiFill, { width: `${k.bar}%`, backgroundColor: k.tone }]} />
                </View>
              )}
              <Text style={[styles.kpiSub, { color: theme.colors.textMuted }]}>{k.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 2. WHO OWES, or a short all-clear line */}
        {pending.length > 0 ? (
          <Card
            style={[
              styles.sectionCard,
              {
                backgroundColor: tint('#EF4444', theme.isDark ? 0.07 : 0.035, theme.colors.card),
                borderColor: tint('#EF4444', 0.2, theme.colors.card),
              },
            ]}>
            <View style={styles.sectionHead}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Needs payment</Text>
                <View style={[styles.countPill, { backgroundColor: theme.colors.dangerSoft }]}>
                  <Text style={[styles.countPillText, { color: theme.colors.danger }]}>{pending.length}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {pending.length > 1 && (
                  <TouchableOpacity
                    onPress={() => setBulkRemindOpen(true)}
                    style={[styles.remindAllBtn, { backgroundColor: theme.colors.warningSoft, borderColor: theme.colors.warningBorder }]}>
                    <Icon name="logo-whatsapp" size={13} color={theme.colors.warningDark} />
                    <Text style={[styles.remindAllText, { color: theme.colors.warningDark }]}>Remind all</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => navigation.navigate('Members', { filter: 'owing' })}>
                  <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>
                    {pending.length > 6 ? `See all ${pending.length}` : 'Open list'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ marginTop: 4 }}>
              {pending.slice(0, 6).map((m, i) => {
                const late = m.dueSince ? daysSince(m.dueSince) : 0;
                const room = isHostel && rooms.find((r) => r._id === String(m.roomId?._id || m.roomId || ''));
                return (
                  <View
                    key={m._id}
                    style={[styles.oweRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.border }]}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('MemberDetail', { id: m._id })}
                      style={styles.personInfo}>
                      <Avatar name={m.name} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.personName, { color: theme.colors.text }]} numberOfLines={1}>
                          {m.name}
                        </Text>
                        {room ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Icon name="bed-outline" size={12} color={theme.colors.primary} />
                            <Text style={[styles.personSub, { color: theme.colors.textMuted }]} numberOfLines={1}>
                              {roomLabel(room, groups)}
                            </Text>
                          </View>
                        ) : (
                          <Text style={[styles.personSub, { color: theme.colors.textMuted }]}>{m.phone || 'No phone'}</Text>
                        )}
                      </View>
                    </TouchableOpacity>

                    <View style={styles.oweBottom}>
                      <View>
                        <Text style={[styles.dueAmount, { color: theme.colors.danger }]}>{rupees(m.balance)}</Text>
                        <Text style={[styles.dueLateText, { color: late > 0 ? theme.colors.danger : theme.colors.textMuted }]}>
                          {late > 0 ? `${plural(late, 'day')} late` : 'due today'}
                        </Text>
                      </View>
                      <View style={styles.actionBtns}>
                        {m.phone ? (
                          <TouchableOpacity
                            accessibilityLabel={`Send WhatsApp reminder to ${m.name}`}
                            onPress={() => Linking.openURL(waLink(m.phone, remindMsg(biz, m, m.balance)))}
                            style={[styles.waBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                            <Icon name="logo-whatsapp" size={17} color="#25D366" />
                          </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity onPress={() => setRecordPaymentMember(m)} style={styles.collectBtn}>
                          <Icon name="checkmark" size={14} color="#FFFFFF" />
                          <Text style={styles.collectText}>Collect</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        ) : (
          <View
            style={[
              styles.clearLine,
              { backgroundColor: tint('#10B981', 0.1, theme.colors.card), borderColor: tint('#10B981', 0.3, theme.colors.card) },
            ]}>
            <Icon name="checkmark-circle-outline" size={18} color="#10B981" />
            <Text style={[styles.clearText, { color: theme.colors.textSecondary }]}>
              <Text style={{ fontWeight: '700', color: theme.colors.text }}>All fees are paid.</Text> Nobody owes anything right now.
            </Text>
          </View>
        )}

        {/* 2b. RECENT PAYMENTS */}
        <Card
          style={[
            styles.sectionCard,
            {
              backgroundColor: tint('#10B981', theme.isDark ? 0.06 : 0.03, theme.colors.card),
              borderColor: tint('#10B981', 0.2, theme.colors.card),
            },
          ]}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent payments</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Reports')}>
              <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>Reports</Text>
            </TouchableOpacity>
          </View>
          {(dashboardData?.recentPayments || []).length ? (
            (dashboardData.recentPayments || []).map((p, i) => (
              <TouchableOpacity
                key={p._id}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('MemberDetail', { id: p.memberId })}
                style={[styles.payRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.border }]}>
                <Avatar name={p.name} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.personName, { color: theme.colors.text }]} numberOfLines={1}>{p.name}</Text>
                  <Text style={[styles.personSub, { color: theme.colors.textMuted }]}>
                    {shortDate(p.date)} · {PAY_MODE[p.mode] || 'Cash'}
                  </Text>
                </View>
                <Text style={styles.payAmount}>+{rupees(p.amount)}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={[styles.emptySectionText, { color: theme.colors.textMuted, marginTop: 8 }]}>
              No payments yet. They'll show up here as you collect them.
            </Text>
          )}
        </Card>

        {/* 3. BEDS (Hostel) OR ACTIVE MEMBERS (Gym/Mess/Tuition) */}
        {isHostel && totalBeds > 0 ? (
          <Card
            style={[
              styles.sectionCard,
              {
                backgroundColor: tint('#8B5CF6', theme.isDark ? 0.08 : 0.04, theme.colors.card),
                borderColor: tint('#8B5CF6', 0.22, theme.colors.card),
              },
            ]}
            onPress={() => navigation.navigate('RoomsTab')}>
            <View style={styles.sectionHead}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Beds</Text>
              <Icon name="chevron-forward" size={15} color={theme.colors.textMuted} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 8, gap: 4 }}>
              <Text style={[styles.bedsCountNumber, { color: theme.colors.text }]}>
                {filledBeds}
              </Text>
              <Text style={[styles.bedsCountLabel, { color: theme.colors.textMuted }]}>
                of {plural(totalBeds, 'bed')} filled
              </Text>
            </View>

            {/* Purple Occupancy Bar */}
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: theme.colors.cardSubtle, marginTop: 10, marginBottom: 14 },
              ]}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${totalBeds > 0 ? Math.round((filledBeds / totalBeds) * 100) : 0}%`,
                    backgroundColor: '#8B5CF6',
                  },
                ]}
              />
            </View>

            {freeRooms.length > 0 ? (
              <View>
                {freeRooms.slice(0, 4).map((r) => (
                  <View key={r._id} style={styles.freeRoomRow}>
                    <Text
                      style={[styles.freeRoomName, { color: theme.colors.text }]}
                      numberOfLines={1}>
                      {roomLabel(r, groups)}
                    </Text>
                    <Text style={[styles.freeBedsBadge, { color: '#10B981' }]}>
                      {plural(r.capacity - (r.occupied || 0), 'free bed')}
                    </Text>
                  </View>
                ))}
                {freeRooms.length > 4 && (
                  <Text style={[styles.moreRoomsText, { color: theme.colors.text }]}>
                    +{freeRooms.length - 4} more rooms with space
                  </Text>
                )}
              </View>
            ) : (
              <Text style={[styles.emptySectionText, { color: theme.colors.textMuted }]}>
                Every bed is taken.
              </Text>
            )}
          </Card>
        ) : (
          <Card style={styles.sectionCard} onPress={() => navigation.navigate('Members')}>
            <View style={styles.sectionHead}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                  Active {w.members}
                </Text>
              </View>
              <Icon name="chevron-forward" size={15} color={theme.colors.textMuted} />
            </View>
            <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginTop: 8 }}>
              <Text style={{ fontWeight: '700', fontSize: 18, color: theme.colors.text }}>
                {activeMembers}
              </Text>{' '}
              currently enrolled
            </Text>
          </Card>
        )}

        {/* 4. RENEWING SOON */}
        <Card
          style={[
            styles.sectionCard,
            {
              backgroundColor: tint('#F59E0B', theme.isDark ? 0.07 : 0.04, theme.colors.card),
              borderColor: tint('#F59E0B', 0.22, theme.colors.card),
            },
          ]}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Renewing soon</Text>
          </View>

          {renewingSoon.length > 0 ? (
            <View style={{ marginTop: 8 }}>
              {renewingSoon.map((m) => {
                const days = daysUntil(m.nextRenewal);
                return (
                  <View
                    key={m._id}
                    style={[styles.rowItem, { borderBottomColor: theme.colors.border }]}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('MemberDetail', { id: m._id })}
                      style={styles.personInfo}>
                      <Avatar name={m.name} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.personName, { color: theme.colors.text }]} numberOfLines={1}>
                          {m.name}
                        </Text>
                        <Text style={[styles.personSub, { color: theme.colors.textMuted }]}>
                          {rupees(m.planAmount)} on {shortDate(m.nextRenewal)} · in {days} days
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {m.phone && (
                      <TouchableOpacity
                        onPress={() => {
                          const msg = `Hi ${m.name}, your ${biz?.name || 'membership'} plan renews on ${shortDate(m.nextRenewal)} (${rupees(m.planAmount)}). Thank you!`;
                          Linking.openURL(waLink(m.phone, msg));
                        }}
                        style={[styles.waBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card, marginLeft: 8 }]}>
                        <Icon name="logo-whatsapp" size={17} color="#25D366" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.renewingEmptyText, { color: theme.colors.textMuted }]}>
              Nobody renews in the next 2 weeks.
              {upcoming[0] && (
                <>
                  {' '}Next:{' '}
                  <Text style={{ fontWeight: '700', color: theme.colors.text }}>
                    {upcoming[0].name}
                  </Text>{' '}
                  on {shortDate(upcoming[0].nextRenewal)}.
                </>
              )}
            </Text>
          )}
        </Card>

        {/* 5. ATTENDANCE TODAY (if enabled) */}
        {biz?.attendanceEnabled !== false && attendanceToday && attendanceToday.counts?.total > 0 && (
          <Card style={styles.sectionCard} onPress={() => navigation.navigate('AttendanceTab')}>
            <View style={styles.sectionHead}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Attendance today</Text>
              </View>
              <Icon name="chevron-forward" size={15} color={theme.colors.textMuted} />
            </View>

            <Text style={{ fontSize: 13, color: theme.colors.textMuted, marginTop: 8 }}>
              <Text style={{ fontWeight: '700', fontSize: 18, color: theme.colors.text }}>
                {attendanceToday.counts?.present || 0}
              </Text>{' '}
              of {attendanceToday.counts?.total || 0} {biz?.type === 'gym' ? 'checked in' : 'present'}
            </Text>
          </Card>
        )}
      </ScrollView>

      {/* Modals */}
      <AddMemberModal
        visible={addMemberOpen}
        biz={biz}
        onClose={() => setAddMemberOpen(false)}
        onMemberAdded={fetchDashboardData}
      />

      <AddExpenseModal
        visible={addExpenseOpen}
        biz={biz}
        onClose={() => setAddExpenseOpen(false)}
        onSaved={fetchDashboardData}
      />

      <RecordPaymentModal
        visible={Boolean(recordPaymentMember)}
        member={recordPaymentMember}
        biz={biz}
        onClose={() => setRecordPaymentMember(null)}
        onPaymentRecorded={fetchDashboardData}
      />

      <BulkRemindModal
        visible={bulkRemindOpen}
        title="who owe"
        people={pending}
        biz={biz}
        onClose={() => setBulkRemindOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 36,
  },
  todayHeader: {
    marginBottom: 16,
  },
  todayTitle: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  todayDate: {
    fontSize: 13.5,
    marginTop: 2,
    marginBottom: 12,
  },
  todayActions: {
    flexDirection: 'row',
    gap: 10,
  },
  btnActionSecondary: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActionSecondaryText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  btnActionPrimary: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
  },
  heroCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  heroMain: {
    marginBottom: 16,
  },
  heroLabel: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '700',
    marginTop: 2,
  },
  heroAmountSmall: {
    fontSize: 21,
    fontWeight: '800',
    marginTop: 8,
  },
  heroSub: {
    fontSize: 13.5,
    marginTop: 3,
  },
  progressWrap: {
    marginTop: 14,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12.5,
    marginTop: 7,
    fontWeight: '400',
  },
  monthCard: {
    borderTopWidth: 1,
    paddingTop: 16,
  },
  monthCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  monthMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthMetric: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 12,
    marginBottom: 3,
  },
  metricVal: {
    fontSize: 19,
    fontWeight: '800',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  kpiCard: {
    flexBasis: '47%',
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderTopWidth: 3,
    gap: 4,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  kpiValue: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  kpiTrack: {
    height: 5,
    borderRadius: 99,
    overflow: 'hidden',
    marginVertical: 2,
  },
  kpiFill: {
    height: '100%',
    borderRadius: 99,
  },
  kpiSub: {
    fontSize: 12.5,
  },
  countPill: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  remindAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
  },
  remindAllText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  oweRow: {
    paddingVertical: 12,
    gap: 8,
  },
  oweBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 42,
  },
  waBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#10B981',
  },
  collectText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  clearLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  clearText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  payAmount: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '700',
  },
  sectionCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  seeAllText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  bedsCountNumber: {
    fontSize: 26,
    fontWeight: '800',
  },
  bedsCountLabel: {
    fontSize: 13.5,
  },
  freeRoomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },
  freeRoomName: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  freeBedsBadge: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  moreRoomsText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  emptySectionText: {
    fontSize: 13,
    marginTop: 8,
  },
  renewingEmptyText: {
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 8,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  personInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  personName: {
    fontSize: 14,
    fontWeight: '600',
  },
  personSub: {
    fontSize: 12,
    marginTop: 1,
  },
  dueCol: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  dueAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  dueLateText: {
    fontSize: 11,
    marginTop: 1,
  },
  actionBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
