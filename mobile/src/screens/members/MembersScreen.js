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
} from 'react-native';
import { useBiz } from '../../context/BizContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../api/api';
import MemberCard from '../../components/MemberCard';
import Button from '../../components/Button';
import Icon from '../../components/Icon';

// Modals
import AddMemberModal from '../modals/AddMemberModal';
import RecordPaymentModal from '../modals/RecordPaymentModal';
import SendReminderModal from '../modals/SendReminderModal';

export default function MembersScreen({ navigation, route }) {
  const { biz } = useBiz();
  const { theme } = useTheme();

  const initialFilter = route?.params?.filter || 'all';
  const initialSort = route?.params?.sortBy || 'renewal_asc';

  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [groups, setGroups] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Filters state
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState(initialFilter); // 'all' | 'owing' | 'soon' | 'clear' | 'left'
  const [planFilter, setPlanFilter] = useState('all');
  const [renewalFilter, setRenewalFilter] = useState('all'); // 'all' | '7d' | '15d' | '30d' | 'overdue'
  const [sortBy, setSortBy] = useState(initialSort); // 'renewal_asc' | 'joined_desc' | 'name_asc' | 'balance_desc'

  // Modals
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [recordPaymentMember, setRecordPaymentMember] = useState(null);
  const [reminderMember, setReminderMember] = useState(null);

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
      const [m, p, g] = await Promise.all([
        api(`/businesses/${biz._id}/members`),
        api(`/businesses/${biz._id}/plans`),
        api(`/businesses/${biz._id}/groups`),
      ]);
      setMembers(Array.isArray(m) ? m : []);
      setPlans(Array.isArray(p) ? p : []);
      setGroups(Array.isArray(g) ? g : []);
    } catch (err) {
      console.warn('Error fetching members', err);
    }
  }, [biz?._id]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMembers();
    setRefreshing(false);
  };

  // Counts for tabs
  const now = new Date();
  const filterCounts = useMemo(() => {
    return {
      all: members.length,
      owing: members.filter((m) => m.status === 'active' && m.balance > 0).length,
      soon: members.filter((m) => {
        if (m.status !== 'active' || !m.nextRenewal) return false;
        const diff = Math.ceil((new Date(m.nextRenewal) - now) / (1000 * 60 * 60 * 24));
        return diff >= 0 && diff <= 7;
      }).length,
      clear: members.filter((m) => m.status === 'active' && m.balance <= 0).length,
      left: members.filter((m) => m.status === 'left').length,
    };
  }, [members]);

  // Filtered and sorted members list
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
          if (!matchName && !matchPhone && !matchPlan) return false;
        }

        // Tab filter
        if (activeTab === 'owing') {
          if (m.status !== 'active' || m.balance <= 0) return false;
        } else if (activeTab === 'soon') {
          if (m.status !== 'active' || !m.nextRenewal) return false;
          const diff = Math.ceil((new Date(m.nextRenewal) - currTime) / (1000 * 60 * 60 * 24));
          if (diff < 0 || diff > 7) return false;
        } else if (activeTab === 'clear') {
          if (m.status !== 'active' || m.balance > 0) return false;
        } else if (activeTab === 'left') {
          if (m.status !== 'left') return false;
        }

        // Plan filter
        if (planFilter !== 'all') {
          const pName = (m.planName || '').toLowerCase();
          if (!pName.includes(planFilter.toLowerCase())) return false;
        }

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
  }, [members, search, activeTab, planFilter, renewalFilter, sortBy]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* Top Header */}
      <View style={[styles.headerBar, { borderBottomColor: theme.colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Members Directory</Text>
          <Text style={[styles.headerSub, { color: theme.colors.textSecondary }]}>
            {members.length} total registered members
          </Text>
        </View>

        <Button
          title="Add Member"
          variant="primary"
          size="sm"
          icon={<Icon name="add" size={16} color="#FFFFFF" />}
          onPress={() => setAddMemberOpen(true)}
        />
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: theme.colors.inputBg,
              borderColor: theme.colors.inputBorder,
            },
          ]}>
          <Icon name="search-outline" size={17} color={theme.colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by member name, phone or plan…"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.searchInput, { color: theme.colors.text }]}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon name="close-circle" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Tab Filters with Badges */}
      <View style={[styles.tabBar, { borderBottomColor: theme.colors.borderSubtle }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {[
            { id: 'all', label: 'All', count: filterCounts.all },
            { id: 'owing', label: 'Owing', count: filterCounts.owing, alert: filterCounts.owing > 0 },
            { id: 'soon', label: 'Due Soon', count: filterCounts.soon },
            { id: 'clear', label: 'All Paid', count: filterCounts.clear },
            { id: 'left', label: 'Left', count: filterCounts.left },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[
                  styles.tabItem,
                  active && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 },
                ]}>
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: active ? theme.colors.primary : theme.colors.textSecondary,
                      fontWeight: active ? '700' : '500',
                    },
                  ]}>
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.tabCountBadge,
                    {
                      backgroundColor: tab.alert
                        ? theme.colors.dangerSoft
                        : active
                        ? theme.colors.primaryLight
                        : theme.colors.cardSubtle,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.tabCountText,
                      {
                        color: tab.alert
                          ? theme.colors.dangerDark
                          : active
                          ? theme.colors.primaryDark
                          : theme.colors.textMuted,
                      },
                    ]}>
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Sub-Filters: Sort By Pills */}
      <View style={styles.sortBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortScroll}>
          <Text style={[styles.sortLabel, { color: theme.colors.textMuted }]}>SORT:</Text>
          {[
            { id: 'renewal_asc', label: 'Nearest Renewal' },
            { id: 'balance_desc', label: 'Highest Due' },
            { id: 'joined_desc', label: 'Newest Joined' },
            { id: 'name_asc', label: 'Name (A-Z)' },
          ].map((s) => {
            const sel = sortBy === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                onPress={() => setSortBy(s.id)}
                style={[
                  styles.sortPill,
                  {
                    backgroundColor: sel ? theme.colors.primarySoft : theme.colors.cardSubtle,
                    borderColor: sel ? theme.colors.primary : theme.colors.borderSubtle,
                  },
                ]}>
                <Text
                  style={[
                    styles.sortPillText,
                    {
                      color: sel ? theme.colors.primaryDark : theme.colors.textSecondary,
                      fontWeight: sel ? '700' : '500',
                    },
                  ]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Members List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }>
        {filtered.map((m) => (
          <MemberCard
            key={m._id}
            member={m}
            biz={biz}
            onPress={() => navigation.navigate('MemberDetail', { id: m._id })}
            onCollect={(mem) => setRecordPaymentMember(mem)}
            onRemind={(mem) => setReminderMember(mem)}
          />
        ))}

        {filtered.length === 0 && (
          <View style={styles.emptyContainer}>
            <Icon name="people-outline" size={48} color={theme.colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No members found</Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              {search
                ? 'Try a different search query or clear the active filter.'
                : 'No members currently match the selected criteria.'}
            </Text>
            {search ? (
              <Button
                title="Clear Search"
                variant="outline"
                size="sm"
                onPress={() => setSearch('')}
                style={{ marginTop: 12 }}
              />
            ) : null}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
  },
  tabBar: {
    borderBottomWidth: 1,
  },
  tabScroll: {
    paddingHorizontal: 16,
    gap: 16,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  tabLabel: {
    fontSize: 13,
  },
  tabCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabCountText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  sortBar: {
    paddingVertical: 8,
  },
  sortScroll: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
  },
  sortLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    marginRight: 4,
  },
  sortPill: {
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  sortPillText: {
    fontSize: 11.5,
  },
  listContent: {
    padding: 16,
    paddingTop: 6,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});

