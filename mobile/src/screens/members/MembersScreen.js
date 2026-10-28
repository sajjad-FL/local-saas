import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Linking,
  Alert,
} from 'react-native';
import { useBiz } from '../../context/BizContext';
import { useTheme } from '../../context/ThemeContext';
import { api, rupees, formatDate, waLink, remindMsg } from '../../api/api';
import { words } from '../../constants/wording';
import { getPlanPillClass } from '../../constants/gymData';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import Avatar from '../../components/Avatar';
import { tint } from '../../constants/theme';
import TopBar from '../../components/TopBar';

// Modals
import AddMemberModal from '../modals/AddMemberModal';
import AddExpenseModal from '../modals/AddExpenseModal';
import RecordPaymentModal from '../modals/RecordPaymentModal';
import SendReminderModal from '../modals/SendReminderModal';
import BulkRemindModal from '../modals/BulkRemindModal';
import MoveRoomModal from '../modals/MoveRoomModal';

function ChoiceRow({ label, value, options, onChange, theme }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 10.5, fontWeight: '700', letterSpacing: 0.5, color: theme.colors.textMuted }}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {options.map(([v, text]) => {
          const active = value === v;
          return (
            <TouchableOpacity
              key={v}
              onPress={() => onChange(v)}
              style={{
                paddingHorizontal: 12,
                height: 32,
                borderRadius: 99,
                borderWidth: 1,
                justifyContent: 'center',
                backgroundColor: active ? theme.colors.primarySoft : theme.colors.cardSubtle,
                borderColor: active ? theme.colors.primary : theme.colors.border,
              }}>
              <Text style={{ fontSize: 12.5, fontWeight: active ? '700' : '500', color: active ? theme.colors.primaryDark : theme.colors.textSecondary }}>
                {text}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function MembersScreen({ navigation, route }) {
  const { biz } = useBiz();
  const { theme, isDark } = useTheme();
  const w = words(biz?.type);

  const initialFilter = route?.params?.filter || 'all';
  const initialSort = route?.params?.sortBy || 'renewal_asc';

  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [groups, setGroups] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState(initialFilter); // 'all' | 'owing' | 'clear' | 'renewing' | 'left'
  const [planFilter, setPlanFilter] = useState('all');
  const [renewalFilter, setRenewalFilter] = useState('all'); // 'all' | '7d' | '15d' | '30d' | 'overdue'
  const [groupFilter, setGroupFilter] = useState('all');
  const [floorFilter, setFloorFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [sortBy, setSortBy] = useState(initialSort);
  const [showFilterPills, setShowFilterPills] = useState(false);

  // Modals
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [recordPaymentMember, setRecordPaymentMember] = useState(null);
  const [reminderMember, setReminderMember] = useState(null);
  const [moveRoomMember, setMoveRoomMember] = useState(null);
  const [bulkRemindData, setBulkRemindData] = useState(null); // { title, people }

  useEffect(() => {
    if (route?.params?.filter) {
      setActiveTab(route.params.filter);
    }
    if (route?.params?.sortBy) {
      setSortBy(route.params.sortBy);
    }
  }, [route?.params]);

  const fetchMembers = useCallback(async () => {
    if (!biz?._id) return;
    try {
      const promises = [
        api(`/businesses/${biz._id}/members`),
        api(`/businesses/${biz._id}/plans`),
        api(`/businesses/${biz._id}/groups`),
      ];
      if (biz?.type === 'hostel') {
        promises.push(api(`/businesses/${biz._id}/rooms`).catch(() => []));
      }
      const [m, p, g, r] = await Promise.all(promises);
      setMembers(Array.isArray(m) ? m : []);
      setPlans(Array.isArray(p) ? p : []);
      setGroups(Array.isArray(g) ? g : []);
      if (r) setRooms(Array.isArray(r) ? r : []);
    } catch (err) {
      console.warn('Error fetching members', err);
    } finally {
      setLoading(false);
    }
  }, [biz?._id, biz?.type]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMembers();
    setRefreshing(false);
  };

  const now = new Date();

  // Upcoming renewals (within next 30 days)
  const upcomingRenewals = useMemo(() => {
    return members
      .filter((m) => {
        if (m.status !== 'active' || !m.nextRenewal) return false;
        const diffDays = Math.ceil((new Date(m.nextRenewal) - now) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 30;
      })
      .sort((a, b) => new Date(a.nextRenewal) - new Date(b.nextRenewal));
  }, [members, now]);

  const totalOwingAmount = useMemo(() => {
    return members
      .filter((m) => m.status === 'active' && m.balance > 0)
      .reduce((sum, m) => sum + m.balance, 0);
  }, [members]);

  const filterCounts = useMemo(() => {
    return {
      all: members.length,
      owing: members.filter((m) => m.status === 'active' && m.balance > 0).length,
      clear: members.filter((m) => m.status === 'active' && m.balance <= 0).length,
      renewing: upcomingRenewals.length,
      left: members.filter((m) => m.status === 'left').length,
    };
  }, [members, upcomingRenewals]);

  const roomById = useMemo(() => new Map(rooms.map((r) => [r._id, r])), [rooms]);

  const isFilterActive = Boolean(
    search ||
    planFilter !== 'all' ||
    renewalFilter !== 'all' ||
    groupFilter !== 'all' ||
    floorFilter !== 'all' ||
    roomFilter !== 'all' ||
    sortBy !== 'renewal_asc'
  );

  // the Filters button shows how many are set (search has its own box)
  const advancedFilterCount = [planFilter, renewalFilter, groupFilter, floorFilter, roomFilter].filter((v) => v !== 'all').length
    + (sortBy !== 'renewal_asc' ? 1 : 0);
  // building → floor → room: each list narrowed by the one before it
  const filterBuilding = groups.find((g) => g._id === groupFilter);
  const filterFloors = filterBuilding?.floors || [];
  const filterRooms = rooms
    .filter((r) =>
      (groupFilter === 'all' || String(r.groupId?._id || r.groupId) === groupFilter) &&
      (floorFilter === 'all' || r.floorId === floorFilter))
    .sort((a, b) => String(a.roomNo).localeCompare(String(b.roomNo), undefined, { numeric: true }));

  const resetAllFilters = () => {
    setSearch('');
    setPlanFilter('all');
    setRenewalFilter('all');
    setGroupFilter('all');
    setFloorFilter('all');
    setRoomFilter('all');
    setSortBy('renewal_asc');
  };

  // Filtered members list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const currTime = new Date();

    return members
      .filter((m) => {
        // Search
        if (q) {
          const matchName = (m.name || '').toLowerCase().includes(q);
          const matchPhone = (m.phone || '').includes(q);
          const matchPlan = (m.planName || '').toLowerCase().includes(q);
          const room = roomById.get(m.roomId?._id || m.roomId);
          const matchRoom = room ? String(room.roomNo).toLowerCase().includes(q.replace(/^room\s*/, '')) : false;
          if (!matchName && !matchPhone && !matchPlan && !matchRoom) return false;
        }

        // Primary status tab filter
        if (activeTab === 'owing') {
          if (m.status !== 'active' || m.balance <= 0) return false;
        } else if (activeTab === 'clear') {
          if (m.status !== 'active' || m.balance > 0) return false;
        } else if (activeTab === 'renewing') {
          if (m.status !== 'active' || !m.nextRenewal) return false;
          const diff = Math.ceil((new Date(m.nextRenewal) - currTime) / (1000 * 60 * 60 * 24));
          if (diff < 0 || diff > 30) return false;
        } else if (activeTab === 'left') {
          if (m.status !== 'left') return false;
        }

        // Plan filter
        if (planFilter !== 'all') {
          const pName = (m.planName || '').toLowerCase();
          if (!pName.includes(planFilter.toLowerCase())) return false;
        }

        // Group / Building filter
        const room = roomById.get(m.roomId?._id || m.roomId);
        if (groupFilter !== 'all') {
          const gId = room ? String(room.groupId?._id || room.groupId) : String(m.groupId?._id || m.groupId || '');
          if (gId !== groupFilter) return false;
        }
        if (floorFilter !== 'all' && room?.floorId !== floorFilter) return false;
        if (roomFilter !== 'all' && String(room?._id) !== roomFilter) return false;

        // Renewal filter
        if (renewalFilter !== 'all') {
          if (!m.nextRenewal) return false;
          const diff = Math.ceil((new Date(m.nextRenewal) - currTime) / (1000 * 60 * 60 * 24));
          if (renewalFilter === 'overdue' && diff >= 0) return false;
          if (renewalFilter === '7d' && (diff < 0 || diff > 7)) return false;
          if (renewalFilter === '15d' && (diff < 0 || diff > 15)) return false;
          if (renewalFilter === '30d' && (diff < 0 || diff > 30)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'renewal_asc') {
          if (!a.nextRenewal) return 1;
          if (!b.nextRenewal) return -1;
          return new Date(a.nextRenewal) - new Date(b.nextRenewal);
        }
        if (sortBy === 'joined_desc') {
          return new Date(b.joinDate || b.createdAt) - new Date(a.joinDate || a.createdAt);
        }
        if (sortBy === 'name_asc') {
          return (a.name || '').localeCompare(b.name || '');
        }
        if (sortBy === 'balance_desc') {
          return (b.balance || 0) - (a.balance || 0);
        }
        return 0;
      });
  }, [members, search, activeTab, planFilter, renewalFilter, groupFilter, floorFilter, roomFilter, roomById, sortBy]);

  // Renewal total sum in 30 days
  const renewingTotalAmount = useMemo(() => {
    return upcomingRenewals.reduce((sum, m) => sum + (m.planAmount || 0), 0);
  }, [upcomingRenewals]);

  const getPillStyle = (planName) => {
    const pill = getPlanPillClass(planName);
    return {
      bg: isDark ? `${pill.color}22` : pill.bg,
      border: isDark ? `${pill.color}44` : pill.border,
      text: pill.text,
    };
  };

  const roomLabel = (r) => {
    if (!r) return '';
    const b = groups.find((g) => g._id === (r.groupId?._id || r.groupId));
    const fl = b?.floors?.find((f) => f._id === r.floorId);
    return [b?.name, fl?.name, `Room ${r.roomNo}`].filter(Boolean).join(' · ');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* TopBar with Hostel Brand & Theme switch */}
      <TopBar navigation={navigation} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }>
        {/* Page Header: title + Expense / Add (same as the web on phones) */}
        <View style={styles.headRow}>
          <Text style={[styles.headTitle, { color: theme.colors.text }]}>{w.member === 'tenant' ? 'Members' : 'Members'}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.headBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              onPress={() => setAddExpenseOpen(true)}>
              <Text style={[styles.headBtnText, { color: theme.colors.text }]}>₹  Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.headBtn, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}
              onPress={() => setAddMemberOpen(true)}>
              <Icon name="add" size={16} color="#FFFFFF" />
              <Text style={[styles.headBtnText, { color: '#FFFFFF' }]}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Four tabs: All / Owing / Paid / Renewing, each in its own colour */}
        <View style={styles.tabRow}>
          {[
            { key: 'all', label: 'All', value: String(filterCounts.all), tone: '#3B82F6', valueColor: theme.colors.text },
            { key: 'owing', label: 'Owing', value: rupees(totalOwingAmount), tone: totalOwingAmount > 0 ? '#EF4444' : '#10B981', valueColor: totalOwingAmount > 0 ? theme.colors.danger : theme.colors.text },
            { key: 'clear', label: 'Paid', value: String(filterCounts.clear), tone: '#10B981', valueColor: theme.colors.primary },
            { key: 'renewing', label: 'Renewing', value: String(upcomingRenewals.length), tone: '#F59E0B', valueColor: theme.colors.warningDark },
          ].map((t) => {
            const active = activeTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setActiveTab(t.key)}
                style={[
                  styles.tabTile,
                  {
                    backgroundColor: tint(t.tone, theme.isDark ? 0.12 : 0.07, theme.colors.card),
                    borderColor: active ? t.tone : tint(t.tone, 0.3, theme.colors.card),
                    borderWidth: active ? 1.5 : 1,
                  },
                ]}>
                <Text style={[styles.tabTileLabel, { color: theme.colors.textMuted }]} numberOfLines={1}>{t.label}</Text>
                <Text style={[styles.tabTileValue, { color: t.valueColor }]} numberOfLines={1} adjustsFontSizeToFit>{t.value}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Toolbar: search + Filters; the filters open as labelled rows */}
        <View style={[styles.toolbarCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={[styles.searchBox, { flex: 1, backgroundColor: theme.colors.inputBg, borderColor: theme.colors.inputBorder }]}>
              <Icon name="search-outline" size={16} color={theme.colors.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search members"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.searchInput, { color: theme.colors.text }]}
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Icon name="close-circle" size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={() => setShowFilterPills(!showFilterPills)}
              style={[
                styles.filtersBtn,
                {
                  backgroundColor: showFilterPills ? theme.colors.primarySoft : theme.colors.card,
                  borderColor: showFilterPills ? theme.colors.primary : theme.colors.border,
                },
              ]}>
              <Icon name="options-outline" size={15} color={showFilterPills ? theme.colors.primary : theme.colors.text} />
              <Text style={[styles.filtersBtnText, { color: showFilterPills ? theme.colors.primary : theme.colors.text }]}>
                Filters{advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ''}
              </Text>
            </TouchableOpacity>
          </View>

          {showFilterPills && (
            <View style={styles.filterPanel}>
              <ChoiceRow label="PLAN" value={planFilter} onChange={setPlanFilter} theme={theme}
                options={[['all', 'All plans'], ...plans.map((pl) => [pl.name, pl.name])]} />
              <ChoiceRow label="RENEWS" value={renewalFilter} onChange={setRenewalFilter} theme={theme}
                options={[['all', 'Any time'], ['7d', '≤ 7 days'], ['15d', '≤ 15 days'], ['30d', '≤ 30 days'], ['overdue', 'Overdue']]} />
              <ChoiceRow label="SORT BY" value={sortBy} onChange={setSortBy} theme={theme}
                options={[['renewal_asc', 'Renewal: soonest'], ['joined_desc', 'Newest joined'], ['name_asc', 'Name A → Z'], ['balance_desc', 'Highest balance']]} />
              {groups.length > 0 && (
                <ChoiceRow label={(w.group || 'Group').toUpperCase()} value={groupFilter} theme={theme}
                  onChange={(v) => { setGroupFilter(v); setFloorFilter('all'); setRoomFilter('all'); }}
                  options={[['all', `All ${(w.groups || 'groups').toLowerCase()}`], ...groups.map((g) => [g._id, g.name])]} />
              )}
              {filterFloors.length > 0 && (
                <ChoiceRow label="FLOOR" value={floorFilter} theme={theme}
                  onChange={(v) => { setFloorFilter(v); setRoomFilter('all'); }}
                  options={[['all', 'All floors'], ...filterFloors.map((f) => [f._id, f.name])]} />
              )}
              {filterRooms.length > 0 && (
                <ChoiceRow label="ROOM" value={roomFilter} onChange={setRoomFilter} theme={theme}
                  options={[['all', 'All rooms'], ...filterRooms.map((r) => [String(r._id), `Room ${r.roomNo} (${r.occupied || 0}/${r.capacity})`])]} />
              )}
              <View style={styles.filterPanelFoot}>
                {isFilterActive ? (
                  <TouchableOpacity onPress={resetAllFilters} style={styles.resetBtn}>
                    <Icon name="close" size={13} color={theme.colors.danger} />
                    <Text style={[styles.resetBtnText, { color: theme.colors.danger }]}>Reset filters</Text>
                  </TouchableOpacity>
                ) : <View />}
                <TouchableOpacity onPress={() => setShowFilterPills(false)} style={[styles.doneBtn, { backgroundColor: theme.colors.primary }]}>
                  <Icon name="checkmark" size={14} color="#FFFFFF" />
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.resultsBar}>
            <Text style={[styles.resultsCount, { color: theme.colors.textSecondary }]}>
              Showing <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{filtered.length}</Text> of{' '}
              <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{activeTab === 'renewing' ? upcomingRenewals.length : members.length}</Text>{' '}
              {activeTab === 'renewing' ? 'renewals' : 'members'}
            </Text>

            {filterCounts.owing > 0 && activeTab !== 'renewing' && (
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.remindAllBtn, { backgroundColor: theme.colors.warningSoft, borderColor: theme.colors.warningBorder }]}
                onPress={() => {
                  const owing = members.filter((m) => m.status === 'active' && m.balance > 0);
                  setBulkRemindData({
                    title: 'who owe',
                    people: owing.map((m) => ({
                      _id: m._id,
                      name: m.name,
                      phone: m.phone,
                      balance: m.balance,
                      message: remindMsg(biz, m, m.balance),
                    })),
                  });
                }}>
                <Icon name="paper-plane-outline" size={12} color={theme.colors.warningDark} />
                <Text style={[styles.remindAllBtnText, { color: theme.colors.warningDark }]}>Remind all who owe ({filterCounts.owing})</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ============================================================ */}
        {/* RENEWING TAB VIEW: Upcoming Renewals with Days Countdown */}
        {/* ============================================================ */}
        {activeTab === 'renewing' ? (
          <View style={styles.listSection}>
            <View style={styles.renewingHeader}>
              <View>
                <Text style={[styles.renewingTitle, { color: theme.colors.text }]}>Renewing in Next 30 Days</Text>
                <Text style={[styles.renewingSub, { color: theme.colors.textSecondary }]}>
                  {filtered.length} member{filtered.length === 1 ? '' : 's'} up for renewal
                </Text>
              </View>

              {filtered.length > 0 && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.remindAllBtn}
                  onPress={() => {
                    setBulkRemindData({
                      title: 'upcoming renewals',
                      people: filtered.map((m) => ({
                        _id: m._id,
                        name: m.name,
                        phone: m.phone,
                        balance: m.balance,
                        message: `Hi ${m.name}, your ${biz?.name || 'membership'} plan renews on ${formatDate(m.nextRenewal)} (${rupees(m.planAmount || 0)}). Please pay by then. Thank you!`,
                      })),
                    });
                  }}>
                  <Icon name="logo-whatsapp" size={13} color="#FFFFFF" />
                  <Text style={styles.remindAllBtnText}>Remind all ({filtered.length})</Text>
                </TouchableOpacity>
              )}
            </View>

            {filtered.map((m) => {
              const pEnd = new Date(m.nextRenewal);
              const diffDays = Math.ceil((pEnd - new Date()) / (1000 * 60 * 60 * 24));
              const daysLabel = diffDays <= 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : `in ${diffDays} days`;
              const badgeVariant = diffDays <= 1 ? 'danger' : diffDays <= 7 ? 'warning' : 'success';
              const pill = getPillStyle(m.planName);

              return (
                <Card key={m._id} style={styles.memberCard}>
                  {/* Row 1: Header */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('MemberDetail', { id: m._id })}
                    style={styles.memberRowTop}>
                    <View style={styles.avatarWrap}>
                      <Text style={styles.avatarInitials}>{(m.name || '?')[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.memberName, { color: theme.colors.text }]}>{m.name}</Text>
                      <Text style={[styles.memberPhone, { color: theme.colors.textSecondary }]}>
                        {m.phone || 'No phone'}
                      </Text>
                    </View>
                    <Badge label={daysLabel} variant={badgeVariant} size="sm" />
                  </TouchableOpacity>

                  {/* Row 2: Plan & Date */}
                  <View style={[styles.memberRowDetails, { borderTopColor: theme.colors.borderSubtle }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={[styles.renewalDateText, { color: theme.colors.textSecondary }]}>
                        Renews {formatDate(pEnd)}
                      </Text>
                      {m.planName && (
                        <View style={[styles.planPillBadge, { backgroundColor: pill.bg, borderColor: pill.border }]}>
                          <Text style={[styles.planPillText, { color: pill.text }]}>{m.planName}</Text>
                        </View>
                      )}
                    </View>

                    {m.phone && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={styles.btnWhatsapp}
                        onPress={() => {
                          const msg = `Hi ${m.name}, your ${biz?.name || 'membership'} plan renews on ${formatDate(pEnd)} (${rupees(m.planAmount || 0)}). Please pay by then. Thank you!`;
                          Linking.openURL(waLink(m.phone, msg));
                        }}>
                        <Icon name="logo-whatsapp" size={13} color="#FFFFFF" />
                        <Text style={styles.btnWhatsappText}>Remind</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </Card>
              );
            })}

            {filtered.length === 0 && (
              <View style={[styles.emptyCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🎉</Text>
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No renewals in next 30 days</Text>
                <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                  All active member subscriptions are paid and up-to-date.
                </Text>
              </View>
            )}
          </View>
        ) : (
          /* ============================================================ */
          /* STANDARD MEMBERS LIST VIEW (Mobile Layout matching Web CSS) */
          /* ============================================================ */
          <View style={styles.listSection}>
            {/* one card, a row per member (same as the web on phones) */}
            {filtered.length > 0 && (
            <View style={[styles.memberList, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            {filtered.map((m, i) => {
              const planName = m.planName || m.planId?.name;
              const pill = getPillStyle(planName);
              const room = roomById.get(m.roomId?._id || m.roomId);
              const roomText = room ? roomLabel(room) : null;
              const pEnd = m.nextRenewal ? new Date(m.nextRenewal) : null;
              const diffDays = pEnd ? Math.ceil((pEnd - new Date()) / (1000 * 60 * 60 * 24)) : null;
              const isOverdue = m.balance > 0 || (diffDays !== null && diffDays < 0);
              const isSoon = !isOverdue && diffDays !== null && diffDays >= 0 && diffDays <= 7;
              const renewColor = isOverdue ? theme.colors.danger : isSoon ? theme.colors.warningDark : theme.colors.textMuted;

              return (
                <TouchableOpacity
                  key={m._id}
                  activeOpacity={0.75}
                  onPress={() => navigation.navigate('MemberDetail', { id: m._id })}
                  style={[styles.memberRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.border }]}>
                  {/* name, phone, status */}
                  <View style={styles.memberRowTop}>
                    <Avatar name={m.name} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.memberName, { color: theme.colors.text }]} numberOfLines={1}>{m.name}</Text>
                      <Text style={[styles.memberPhone, { color: theme.colors.textMuted }]}>{m.phone || 'No phone'}</Text>
                    </View>
                    {m.status === 'left' ? (
                      <View style={[styles.statusBadge, { backgroundColor: 'rgba(148, 163, 184, 0.16)' }]}>
                        <Text style={[styles.statusBadgeText, { color: '#94A3B8' }]}>Left</Text>
                      </View>
                    ) : (
                      <View style={[styles.statusBadge, { backgroundColor: m.balance > 0 ? theme.colors.dangerSoft : theme.colors.successSoft }]}>
                        <View style={[styles.statusDot, { backgroundColor: m.balance > 0 ? '#EF4444' : '#10B981' }]} />
                        <Text style={[styles.statusBadgeText, { color: m.balance > 0 ? theme.colors.danger : theme.colors.successDark }]}>
                          {m.balance > 0 ? 'Overdue' : 'Paid Up'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* plan and room; what they owe on the right */}
                  <View style={styles.memberRowMid}>
                    <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                      {planName ? (
                        <View style={[styles.planPillBadge, { backgroundColor: pill.bg, borderColor: pill.border, alignSelf: 'flex-start' }]}>
                          <Text style={[styles.planPillText, { color: pill.text }]}>{planName}</Text>
                        </View>
                      ) : null}
                      {roomText ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Icon name="bed-outline" size={13} color={theme.colors.primary} />
                          <Text style={[styles.memberRoomText, { color: theme.colors.textMuted }]} numberOfLines={1}>{roomText}</Text>
                        </View>
                      ) : null}
                    </View>
                    {m.balance > 0 ? (
                      <Text style={[styles.balanceAmount, { color: theme.colors.danger }]}>{rupees(m.balance)} Due</Text>
                    ) : null}
                  </View>

                  {pEnd ? (
                    <Text style={[styles.renewText, { color: theme.colors.textMuted }]}>
                      Renews <Text style={{ color: renewColor, fontWeight: isOverdue || isSoon ? '700' : '400' }}>{formatDate(pEnd)}</Text>
                    </Text>
                  ) : (
                    <Text style={[styles.renewText, { color: theme.colors.textMuted }]}>Renews —</Text>
                  )}

                  {/* one action at most: collect what's owed, or a nudge before renewal */}
                  {m.balance > 0 ? (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[styles.rowAction, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}
                      onPress={() => setRecordPaymentMember(m)}>
                      <Icon name="checkmark" size={14} color="#FFFFFF" />
                      <Text style={[styles.rowActionText, { color: '#FFFFFF' }]}>Collect {rupees(m.balance)}</Text>
                    </TouchableOpacity>
                  ) : isSoon && m.phone ? (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[styles.rowAction, { backgroundColor: theme.colors.warningSoft, borderColor: theme.colors.warningBorder }]}
                      onPress={() => setReminderMember(m)}>
                      <Icon name="paper-plane-outline" size={13} color={theme.colors.warningDark} />
                      <Text style={[styles.rowActionText, { color: theme.colors.warningDark }]}>Send reminder</Text>
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
              );
            })}
            </View>
            )}

            {filtered.length === 0 && (
              <View style={[styles.emptyCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Icon name="people-outline" size={48} color={theme.colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                  {activeTab === 'owing'
                    ? 'No Unpaid Dues'
                    : activeTab === 'clear'
                    ? 'No Paid Up Members'
                    : activeTab === 'renewing'
                    ? 'No renewals in next 30 days'
                    : 'No matching members'}
                </Text>
                <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                  {search
                    ? `Nobody matches “${search}”.`
                    : activeTab === 'owing'
                    ? 'Everyone has paid. All dues cleared!'
                    : 'Try adjusting your search query or filter.'}
                </Text>
                {isFilterActive && (
                  <TouchableOpacity onPress={resetAllFilters} style={[styles.btnSecondary, { marginTop: 12 }]}>
                    <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Clear all filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      <AddMemberModal
        visible={addMemberOpen}
        biz={biz}
        onClose={() => setAddMemberOpen(false)}
        onMemberAdded={fetchMembers}
      />

      <AddExpenseModal
        visible={addExpenseOpen}
        biz={biz}
        onClose={() => setAddExpenseOpen(false)}
        onSaved={fetchMembers}
      />

      <RecordPaymentModal
        visible={Boolean(recordPaymentMember)}
        member={recordPaymentMember}
        biz={biz}
        onClose={() => setRecordPaymentMember(null)}
        onPaymentRecorded={fetchMembers}
      />

      <SendReminderModal
        visible={Boolean(reminderMember)}
        member={reminderMember}
        biz={biz}
        onClose={() => setReminderMember(null)}
      />

      <MoveRoomModal
        visible={Boolean(moveRoomMember)}
        member={moveRoomMember}
        biz={biz}
        currentRent={moveRoomMember?.planAmount}
        onClose={() => setMoveRoomMember(null)}
        onMoved={fetchMembers}
      />

      <BulkRemindModal
        visible={Boolean(bulkRemindData)}
        title={bulkRemindData?.title || ''}
        people={bulkRemindData?.people || []}
        biz={biz}
        onClose={() => setBulkRemindData(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 10,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  pageTitleSub: {
    fontSize: 16,
    fontWeight: '500',
  },
  pageSubtitle: {
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 17,
  },
  pageActions: {
    flexDirection: 'row',
    gap: 8,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    minWidth: '47%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  kpiActive: {
    shadowColor: '#10B981',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiActiveDanger: {
    shadowColor: '#EF4444',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiActiveWarning: {
    shadowColor: '#F59E0B',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  kpiIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  kpiValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  kpiVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  kpiBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  kpiBadgeText: {
    fontSize: 10,
  },
  toolbarCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  filterPillsRow: {
    marginTop: 10,
  },
  filterPillsScroll: {
    gap: 6,
    alignItems: 'center',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 9999,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  resultsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  resultsCount: {
    fontSize: 11.5,
  },
  remindAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  remindAllBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  headBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  headBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  tabTile: {
    flex: 1,
    minHeight: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  tabTileLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  tabTileValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  filtersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  filtersBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  filterPanel: {
    gap: 12,
    marginTop: 12,
  },
  filterPanelFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 22,
    borderRadius: 8,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  listSection: {
    gap: 10,
  },
  renewingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  renewingTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  renewingSub: {
    fontSize: 12,
    marginTop: 1,
  },
  memberCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  memberList: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  memberRow: {
    paddingVertical: 14,
    gap: 8,
  },
  memberRowMid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberRoomText: {
    fontSize: 12.5,
    flexShrink: 1,
  },
  renewText: {
    fontSize: 13,
  },
  rowAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
  },
  rowActionText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  memberRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#8B5CF6',
    fontSize: 14,
    fontWeight: '700',
  },
  memberName: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  memberPhone: {
    fontSize: 11.5,
    marginTop: 1,
  },
  balanceAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  memberRowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  planPillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  planPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  roomPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  roomPillText: {
    fontSize: 11,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  memberRowRenewal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  renewalLabelText: {
    fontSize: 11.5,
  },
  memberRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  btnCollect: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 6,
  },
  btnCollectText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  btnSecondarySmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
  },
  btnSecondarySmallText: {
    fontSize: 12,
    fontWeight: '600',
  },
  btnIconAction: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnWhatsapp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B981',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  btnWhatsappText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  renewalDateText: {
    fontSize: 12,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
});
