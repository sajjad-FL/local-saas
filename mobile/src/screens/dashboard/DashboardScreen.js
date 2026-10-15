import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { useBiz } from '../../context/BizContext';
import { useTheme } from '../../context/ThemeContext';
import { api, rupees } from '../../api/api';
import { COLORS } from '../../constants/theme';
import { getPlanColor, getRenewalThreshold } from '../../constants/gymData';
import StatTile from '../../components/StatTile';
import MemberCard from '../../components/MemberCard';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Icon from '../../components/Icon';

// Modals
import AddMemberModal from '../modals/AddMemberModal';
import RecordPaymentModal from '../modals/RecordPaymentModal';
import SendReminderModal from '../modals/SendReminderModal';
import FeeBreakdownModal from '../modals/FeeBreakdownModal';
import CreateBusinessModal from '../modals/CreateBusinessModal';

export default function DashboardScreen({ navigation }) {
  const { biz, businesses, switchBiz } = useBiz();
  const { theme } = useTheme();

  const [data, setData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('6M'); // '3M' | '6M' | '1Y'
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'overdue' | 'due_soon'

  // Modals state
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [recordPaymentMember, setRecordPaymentMember] = useState(null);
  const [reminderMember, setReminderMember] = useState(null);
  const [feeBreakdownOpen, setFeeBreakdownOpen] = useState(false);
  const [createBizOpen, setCreateBizOpen] = useState(false);
  const [bizPickerOpen, setBizPickerOpen] = useState(false);

  const fetchDashboard = useCallback(async () => {
    if (!biz?._id) return;
    try {
      const [dash, p] = await Promise.all([
        api(`/businesses/${biz._id}/dashboard`),
        api(`/businesses/${biz._id}/plans`),
      ]);
      setData(dash);
      setPlans(Array.isArray(p) ? p : []);
    } catch (err) {
      console.warn('Dashboard fetch error', err);
    }
  }, [biz?._id]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  };

  if (!biz) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
        <View style={styles.emptyContainer}>
          <Icon name="business-outline" size={48} color={theme.colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Workspace Found</Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
            Create your first workspace to start managing members and tracking payments.
          </Text>
          <Button
            title="Create Workspace"
            variant="primary"
            onPress={() => setCreateBizOpen(true)}
            style={{ marginTop: 16 }}
          />
          <CreateBusinessModal
            visible={createBizOpen}
            onClose={() => setCreateBizOpen(false)}
            onCreated={fetchDashboard}
          />
        </View>
      </SafeAreaView>
    );
  }

  const typeConfig = COLORS.biz[biz.type] || COLORS.biz.gym;
  const metrics = data?.metrics || {
    activeMembers: { value: 0, newThisMonth: 0, deltaText: '0 registered' },
    monthlyRevenue: { value: 0, deltaText: 'Collected this month', diff: 0, sparkline: [0, 0, 0] },
    membersOwing: { value: 0, deltaText: 'All dues clear' },
    totalOutstanding: { value: 0, deltaText: 'No pending dues' },
    arpu: { value: 0, deltaText: 'Per member / month', diff: 0, planFeeBreakdown: [] },
    nextRenewal: { value: 'None', deltaText: 'No upcoming renewals', daysLeft: null },
  };

  const revenueTrend = data?.revenueTrend || [];
  const planDistribution = data?.planDistribution || [];
  const membersTable = data?.membersTable || [];

  // Filtered revenue months for chart
  const filteredMonths = (() => {
    const withData = revenueTrend.filter((t) => t.hasActivity || t.isCurrentMonth || t.collected > 0 || t.pending > 0);
    const base = withData.length > 0 ? withData : revenueTrend.filter((t) => t.collected > 0 || t.isCurrentMonth);
    if (period === '3M') return base.slice(-3);
    if (period === '6M') return base.length <= 6 ? base : base.slice(-6);
    if (period === '1Y') return base.slice(-12);
    return base;
  })();

  // Filtered members directory list
  const searchLower = search.trim().toLowerCase();
  const filteredMembers = membersTable.filter((m) => {
    const matchesSearch =
      !searchLower ||
      m.name.toLowerCase().includes(searchLower) ||
      (m.phone || '').includes(searchLower);
    if (!matchesSearch) return false;
    if (filter === 'active') return m.status === 'active';
    if (filter === 'overdue') return m.statusBadge === 'overdue';
    if (filter === 'due_soon') return m.statusBadge === 'due_soon';
    return true;
  });

  const renewalThreshold = getRenewalThreshold(metrics.nextRenewal?.daysLeft);
  const maxCollectedInTrend = Math.max(...filteredMonths.map((m) => Math.max(m.collected || 0, m.pending || 0)), 1);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setBizPickerOpen(!bizPickerOpen)}
          style={styles.bizHeaderTitleWrap}>
          <View style={[styles.bizBadgeIcon, { backgroundColor: typeConfig.soft }]}>
            <Icon name={typeConfig.icon} size={18} color={typeConfig.accent} />
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[styles.bizTitle, { color: theme.colors.text }]} numberOfLines={1}>
                {biz.name}
              </Text>
              {businesses.length > 1 && (
                <Icon name="chevron-down" size={14} color={theme.colors.textSecondary} />
              )}
            </View>
            <Text style={[styles.bizSubBadge, { color: typeConfig.accent }]}>
              {typeConfig.badge}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Quick Action Button */}
        <Button
          title="Add Member"
          variant="primary"
          size="sm"
          icon={<Icon name="add" size={16} color="#FFFFFF" />}
          onPress={() => setAddMemberOpen(true)}
        />
      </View>

      {/* Switch Business Dropdown Bar (if open) */}
      {bizPickerOpen && businesses.length > 1 && (
        <View style={[styles.bizPickerContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.bizPickerLabel, { color: theme.colors.textSecondary }]}>
            SWITCH WORKSPACE
          </Text>
          {businesses.map((b) => {
            const isCur = b._id === biz._id;
            const bConfig = COLORS.biz[b.type] || COLORS.biz.gym;
            return (
              <TouchableOpacity
                key={b._id}
                onPress={() => {
                  switchBiz(b._id);
                  setBizPickerOpen(false);
                }}
                style={[
                  styles.bizPickerItem,
                  {
                    backgroundColor: isCur ? theme.colors.cardSubtle : 'transparent',
                  },
                ]}>
                <View style={[styles.bizPickerIcon, { backgroundColor: bConfig.soft }]}>
                  <Icon name={bConfig.icon} size={16} color={bConfig.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bizPickerItemName, { color: theme.colors.text }]}>
                    {b.name}
                  </Text>
                  <Text style={[styles.bizPickerItemType, { color: theme.colors.textSecondary }]}>
                    {bConfig.label}
                  </Text>
                </View>
                {isCur && <Icon name="checkmark" size={18} color={theme.colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }>
        {/* SECTION 1: 6 KPI TILES (Matching Web Client) */}
        <View style={styles.kpiGrid}>
          {/* Tile 1: Active Members */}
          <StatTile
            label="ACTIVE MEMBERS"
            value={metrics.activeMembers.value}
            icon={<Icon name="people" size={16} color="#1E40AF" />}
            iconBg="#DBEAFE"
            deltaText={metrics.activeMembers.newThisMonth > 0 ? `+${metrics.activeMembers.newThisMonth} registered` : null}
            deltaType="success"
            onPress={() => navigation.navigate('Members')}
          />

          {/* Tile 2: Collected This Month */}
          <StatTile
            label={metrics.monthlyRevenue.label || 'COLLECTED THIS MONTH'}
            value={metrics.monthlyRevenue.value}
            prefix="₹"
            icon={<Icon name="cash-outline" size={16} color="#065F46" />}
            iconBg="#D1FAE5"
            sparkline={metrics.monthlyRevenue.sparkline || [0, 0, 0]}
            deltaText={metrics.monthlyRevenue.deltaText}
            deltaType={metrics.monthlyRevenue.diff >= 0 ? 'success' : 'danger'}
            onPress={() => navigation.navigate('Reports')}
          />

          {/* Tile 3: Dues Pending */}
          <StatTile
            label="DUES PENDING"
            value={metrics.membersOwing.value}
            icon={<Icon name={metrics.membersOwing.value === 0 ? 'checkmark-circle' : 'alert-circle'} size={16} color={metrics.membersOwing.value === 0 ? '#065F46' : '#991B1B'} />}
            iconBg={metrics.membersOwing.value === 0 ? '#D1FAE5' : '#FEE2E2'}
            deltaText={metrics.membersOwing.deltaText}
            deltaType={metrics.membersOwing.value === 0 ? 'success' : 'danger'}
            borderColor={metrics.membersOwing.value === 0 ? '#6EE7B7' : '#FCA5A5'}
            onPress={() => navigation.navigate('Members', { filter: 'owing' })}
          />

          {/* Tile 4: Outstanding Balance */}
          <StatTile
            label="OUTSTANDING"
            value={metrics.totalOutstanding.value}
            prefix="₹"
            icon={<Icon name="time-outline" size={16} color="#92400E" />}
            iconBg="#FEF3C7"
            deltaText={metrics.totalOutstanding.deltaText}
            deltaType={metrics.totalOutstanding.value > 0 ? 'danger' : 'neutral'}
            onPress={() => navigation.navigate('Reports')}
          />

          {/* Tile 5: Avg Member Fee */}
          <StatTile
            label="AVG MEMBER FEE"
            value={metrics.arpu.value}
            prefix="₹"
            suffix="/mo"
            icon={<Icon name="trending-up" size={16} color="#6D28D9" />}
            iconBg="#EDE9FE"
            deltaText="Tap for plan breakdown"
            deltaType="neutral"
            onPress={() => setFeeBreakdownOpen(true)}
          />

          {/* Tile 6: Next Renewal */}
          <StatTile
            label="NEXT RENEWAL"
            value={metrics.nextRenewal.value}
            icon={<Icon name="calendar-outline" size={16} color={renewalThreshold.textColor} />}
            iconBg={renewalThreshold.bgSoft}
            deltaText={metrics.nextRenewal.deltaText}
            deltaType={renewalThreshold.color === 'red' ? 'danger' : renewalThreshold.color === 'amber' ? 'warning' : 'success'}
            borderColor={renewalThreshold.borderColor}
            onPress={() => navigation.navigate('Members', { sortBy: 'renewal_asc' })}
          />
        </View>

        {/* SECTION 2: MONTHLY EARNINGS BREAKDOWN */}
        <Card style={styles.chartCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Monthly Earnings</Text>
              <Text style={[styles.cardSub, { color: theme.colors.textSecondary }]}>
                Collected vs. Pending Dues
              </Text>
            </View>

            {/* Period Tabs: 3M | 6M | 1Y */}
            <View style={[styles.periodTabs, { backgroundColor: theme.colors.cardSubtle }]}>
              {['3M', '6M', '1Y'].map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPeriod(p)}
                  style={[
                    styles.periodTabBtn,
                    period === p && { backgroundColor: theme.colors.card, shadowOpacity: 0.1 },
                  ]}>
                  <Text
                    style={[
                      styles.periodTabText,
                      { color: period === p ? theme.colors.text : theme.colors.textMuted },
                    ]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Native Bar Chart / Progress Visualizer */}
          <View style={styles.chartList}>
            {filteredMonths.map((m, idx) => {
              const collected = m.collected || 0;
              const pending = m.pending || 0;
              const total = collected + pending;
              const colPct = total > 0 ? Math.round((collected / total) * 100) : 100;

              return (
                <View key={idx} style={styles.monthRow}>
                  <View style={styles.monthLabelCol}>
                    <Text style={[styles.monthName, { color: theme.colors.text }]}>{m.month}</Text>
                    {m.isCurrentMonth && (
                      <Badge label="Current" variant="info" size="sm" style={{ marginTop: 2 }} />
                    )}
                  </View>

                  <View style={styles.monthBarCol}>
                    <View style={[styles.stackedBarTrack, { backgroundColor: theme.colors.cardSubtle }]}>
                      {collected > 0 && (
                        <View
                          style={[
                            styles.stackedBarCol,
                            {
                              flex: collected,
                              backgroundColor: theme.colors.primary,
                              borderTopLeftRadius: 4,
                              borderBottomLeftRadius: 4,
                            },
                          ]}
                        />
                      )}
                      {pending > 0 && (
                        <View
                          style={[
                            styles.stackedBarPend,
                            {
                              flex: pending,
                              backgroundColor: theme.colors.danger,
                              borderTopRightRadius: 4,
                              borderBottomRightRadius: 4,
                            },
                          ]}
                        />
                      )}
                    </View>

                    <View style={styles.monthStatRow}>
                      <Text style={[styles.monthStatCollected, { color: theme.colors.primaryDark }]}>
                        Collected: {rupees(collected)}
                      </Text>
                      {pending > 0 ? (
                        <Text style={[styles.monthStatPending, { color: theme.colors.danger }]}>
                          Pending: {rupees(pending)}
                        </Text>
                      ) : (
                        <Text style={[styles.monthStatPending, { color: theme.colors.successDark }]}>
                          100% Cleared
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}

            {filteredMonths.length === 0 && (
              <Text style={[styles.emptySectionText, { color: theme.colors.textMuted }]}>
                No monthly earnings recorded yet.
              </Text>
            )}
          </View>
        </Card>

        {/* SECTION 3: MEMBERS BY PLAN DISTRIBUTION */}
        {planDistribution.length > 0 && (
          <Card style={styles.chartCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Members by Plan</Text>
                <Text style={[styles.cardSub, { color: theme.colors.textSecondary }]}>
                  Active membership package distribution
                </Text>
              </View>
              <Badge label={`${metrics.activeMembers.value} Active`} variant="info" size="sm" />
            </View>

            <View style={styles.planList}>
              {planDistribution.map((p, idx) => {
                const color = getPlanColor(p.name, idx);
                return (
                  <View key={p.name} style={styles.planItem}>
                    <View style={styles.planItemTop}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={[styles.planDot, { backgroundColor: color }]} />
                        <Text style={[styles.planItemName, { color: theme.colors.text }]}>
                          {p.name}
                        </Text>
                      </View>
                      <Text style={[styles.planItemCount, { color: theme.colors.textSecondary }]}>
                        {p.count} member{p.count > 1 ? 's' : ''} ({p.pctRevenue || 0}% rev)
                      </Text>
                    </View>

                    {/* Progress track */}
                    <View style={[styles.planProgressTrack, { backgroundColor: theme.colors.cardSubtle }]}>
                      <View
                        style={[
                          styles.planProgressBar,
                          {
                            width: `${Math.min(100, p.pctMembers || Math.round((p.count / (metrics.activeMembers.value || 1)) * 100))}%`,
                            backgroundColor: color,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {/* SECTION 4: MEMBERS DIRECTORY PREVIEW */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Members Directory</Text>
            <Text style={[styles.sectionSub, { color: theme.colors.textSecondary }]}>
              Recent member subscriptions & renewals
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Members')}>
            <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 13 }}>
              View All ({membersTable.length}) →
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick search and filter chips */}
        <View style={styles.searchBarWrap}>
          <View
            style={[
              styles.searchInputBox,
              {
                backgroundColor: theme.colors.inputBg,
                borderColor: theme.colors.inputBorder,
              },
            ]}>
            <Icon name="search-outline" size={16} color={theme.colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search name or phone…"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.searchInput, { color: theme.colors.text }]}
            />
          </View>
        </View>

        <View style={styles.filterChipRow}>
          {[
            { id: 'all', label: `All (${membersTable.length})` },
            { id: 'active', label: 'Active' },
            { id: 'overdue', label: 'Overdue' },
            { id: 'due_soon', label: 'Due Soon' },
          ].map((c) => {
            const active = filter === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => setFilter(c.id)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? theme.colors.primarySoft : theme.colors.cardSubtle,
                    borderColor: active ? theme.colors.primary : theme.colors.borderSubtle,
                  },
                ]}>
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: active ? theme.colors.primaryDark : theme.colors.textSecondary,
                      fontWeight: active ? '700' : '500',
                    },
                  ]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Members Cards List */}
        <View style={{ marginTop: 8 }}>
          {filteredMembers.slice(0, 10).map((m) => (
            <MemberCard
              key={m._id}
              member={m}
              biz={biz}
              onPress={() => navigation.navigate('MemberDetail', { id: m._id })}
              onCollect={(mem) => setRecordPaymentMember(mem)}
              onRemind={(mem) => setReminderMember(mem)}
            />
          ))}

          {filteredMembers.length === 0 && (
            <View style={styles.emptyCardBox}>
              <Text style={[styles.emptyCardText, { color: theme.colors.textMuted }]}>
                No members found matching your search.
              </Text>
            </View>
          )}

          {filteredMembers.length > 10 && (
            <Button
              title={`View Remaining ${filteredMembers.length - 10} Members`}
              variant="outline"
              style={{ marginTop: 6, marginBottom: 16 }}
              onPress={() => navigation.navigate('Members')}
            />
          )}
        </View>
      </ScrollView>

      {/* MODALS */}
      <AddMemberModal
        visible={addMemberOpen}
        biz={biz}
        onClose={() => setAddMemberOpen(false)}
        onMemberAdded={fetchDashboard}
      />

      <RecordPaymentModal
        visible={Boolean(recordPaymentMember)}
        member={recordPaymentMember}
        biz={biz}
        onClose={() => setRecordPaymentMember(null)}
        onPaymentRecorded={fetchDashboard}
      />

      <SendReminderModal
        visible={Boolean(reminderMember)}
        member={reminderMember}
        biz={biz}
        onClose={() => setReminderMember(null)}
      />

      <FeeBreakdownModal
        visible={feeBreakdownOpen}
        plans={metrics.arpu.planFeeBreakdown || []}
        avgFee={metrics.arpu.value}
        onClose={() => setFeeBreakdownOpen(false)}
      />

      <CreateBusinessModal
        visible={createBizOpen}
        onClose={() => setCreateBizOpen(false)}
        onCreated={fetchDashboard}
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
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  bizHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  bizBadgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bizTitle: {
    fontSize: 15,
    fontWeight: '800',
    maxWidth: 180,
  },
  bizSubBadge: {
    fontSize: 11,
    fontWeight: '700',
  },
  bizPickerContainer: {
    borderBottomWidth: 1,
    padding: 12,
  },
  bizPickerLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  bizPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    gap: 10,
    marginBottom: 4,
  },
  bizPickerIcon: {
    width: 30,
    height: 30,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bizPickerItemName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  bizPickerItemType: {
    fontSize: 11,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  chartCard: {
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  periodTabs: {
    flexDirection: 'row',
    borderRadius: 6,
    padding: 2,
  },
  periodTabBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  periodTabText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chartList: {
    gap: 12,
    marginTop: 4,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monthLabelCol: {
    width: 65,
  },
  monthName: {
    fontSize: 12,
    fontWeight: '700',
  },
  monthBarCol: {
    flex: 1,
  },
  stackedBarTrack: {
    height: 12,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 4,
  },
  stackedBarCol: {
    height: '100%',
  },
  stackedBarPend: {
    height: '100%',
  },
  monthStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthStatCollected: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  monthStatPending: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  emptySectionText: {
    textAlign: 'center',
    paddingVertical: 16,
    fontSize: 12,
  },
  planList: {
    gap: 10,
    marginTop: 4,
  },
  planItem: {
    gap: 4,
  },
  planItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  planItemName: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  planItemCount: {
    fontSize: 11.5,
  },
  planProgressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  planProgressBar: {
    height: '100%',
    borderRadius: 3,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 10,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  sectionSub: {
    fontSize: 12,
    marginTop: 1,
  },
  searchBarWrap: {
    marginBottom: 8,
  },
  searchInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  filterChip: {
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  filterChipText: {
    fontSize: 11.5,
  },
  emptyCardBox: {
    padding: 24,
    alignItems: 'center',
  },
  emptyCardText: {
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});

