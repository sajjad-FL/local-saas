import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { downloadFile } from '../../api/download';
import { useBiz } from '../../context/BizContext';
import { useTheme } from '../../context/ThemeContext';
import { api, rupees, formatDate } from '../../api/api';
import { refreshAll } from '../../api/queryClient';
import Card from '../../components/Card';
import Icon from '../../components/Icon';
import TopBar from '../../components/TopBar';
import { ScreenSkeleton } from '../../components/Loader';
import AddExpenseModal from '../modals/AddExpenseModal';
import RecordPaymentModal from '../modals/RecordPaymentModal';
import PickMember from '../../components/PickMember';
import { words } from '../../constants/wording';
import { CompactHeader, NumberStrip, ListCard, SearchFilter, ChipRow, CompactRow, ColorKey } from '../../components/Compact';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EXPENSE_CATEGORIES = {
  rent: 'Rent',
  salary: 'Salaries',
  electricity: 'Electricity',
  water: 'Water',
  internet: 'Internet / phone',
  maintenance: 'Repairs & maint.',
  equipment: 'Equipment',
  groceries: 'Groceries / food',
  marketing: 'Marketing',
  other: 'Other',
};

const dayEnd = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const CAT_ICON = { rent: '⌂', salary: '☺', electricity: 'ϟ', water: '≈', internet: '◎', maintenance: '⚙', equipment: '⚙', groceries: '◍', marketing: '✦', other: '•' };
const fmtDay = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function periodRange(kind, step, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (kind === 'month') {
    const from = new Date(y, m + step, 1);
    const to = dayEnd(new Date(y, m + step + 1, 0));
    return {
      from,
      to,
      label: `${MONTHS[from.getMonth()]} ${from.getFullYear()}`,
      subLabel: `${fmtDay(from)} – ${fmtDay(to)}`,
    };
  }
  if (kind === 'quarter') {
    const from = new Date(y, m - (m % 3) + step * 3, 1);
    const to = dayEnd(new Date(from.getFullYear(), from.getMonth() + 3, 0));
    return {
      from,
      to,
      label: `${MONTHS[from.getMonth()]}–${MONTHS[to.getMonth()]} ${to.getFullYear()}`,
      subLabel: `${fmtDay(from)} – ${fmtDay(to)}`,
    };
  }
  if (kind === 'year') {
    const fyStart = (m >= 3 ? y : y - 1) + step;
    const from = new Date(fyStart, 3, 1);
    const to = dayEnd(new Date(fyStart + 1, 2, 31));
    return {
      from,
      to,
      label: `FY ${fyStart}–${String(fyStart + 1).slice(-2)}`,
      subLabel: `${fmtDay(from)} – ${fmtDay(to)}`,
    };
  }
  // Custom: current month up to today
  const from = new Date(y, m, 1);
  const to = dayEnd(now);
  return {
    from,
    to,
    label: 'Custom',
    subLabel: `${fmtDay(from)} – ${fmtDay(to)}`,
  };
}

export default function ReportsScreen({ navigation }) {
  const { biz, isOwner } = useBiz();
  const { theme } = useTheme();

  const [kind, setKind] = useState('month'); // 'month' | 'quarter' | 'year' | 'custom'
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState('breakdown'); // 'breakdown' | 'expenses' | 'members'
  const [report, setReport] = useState(null);
  const [loaded, setLoaded] = useState(false); // the first fetch has finished
  const [dashboardData, setDashboardData] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  // Who paid: quick chips, plus plan and sort in the filter panel
  const [whoShow, setWhoShow] = useState('all');
  const [whoPlan, setWhoPlan] = useState('all');
  const [whoSort, setWhoSort] = useState('owed');
  const [whoFilters, setWhoFilters] = useState(false);
  const [picking, setPicking] = useState(false); // + Payment: choose who paid
  const [paying, setPaying] = useState(null);

  const range = periodRange(kind, step);

  const fetchReports = useCallback(async () => {
    if (!biz?._id) return;
    try {
      const fromStr = range.from.toISOString();
      const toStr = range.to.toISOString();
      const tz = new Date().getTimezoneOffset();

      const [rep, dash, exp] = await Promise.all([
        api(`/businesses/${biz._id}/report?from=${fromStr}&to=${toStr}&tz=${tz}`),
        api(`/businesses/${biz._id}/dashboard`),
        api(`/businesses/${biz._id}/expenses?from=${fromStr}&to=${toStr}`),
      ]);
      setReport(rep);
      setDashboardData(dash);
      setExpenses(Array.isArray(exp) ? exp : []);
    } catch (err) {
      console.warn('Reports fetch error:', err);
    } finally {
      setLoaded(true);
    }
  }, [biz?._id, range.from, range.to]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAll(); // pull-to-refresh always asks the server
    await fetchReports();
    setRefreshing(false);
  };

  const handleExport = async (type) => {
    setExporting(true);
    try {
      if (!biz?._id) return;
      let endpoint = '';
      let filename = '';
      const bName = biz?.name || 'export';
      if (type === 'payments') {
        endpoint = 'export/payments.csv';
        filename = `${bName}_payments.csv`;
      } else if (type === 'dues') {
        endpoint = 'export/dues.csv';
        filename = `${bName}_unpaid_dues.csv`;
      } else if (type === 'balances') {
        endpoint = 'export/balances.csv';
        filename = `${bName}_balances.csv`;
      } else {
        endpoint = 'export/backup.json';
        filename = `${bName}_backup.json`;
      }

      await downloadFile(`/businesses/${biz._id}/${endpoint}`, filename);
      setDownloadModalOpen(false);
    } catch (err) {
      Alert.alert('Export Failed', err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteExpense = (expId) => {
    Alert.alert('Delete Expense', 'Are you sure you want to remove this expense entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/businesses/${biz._id}/expenses/${expId}`, { method: 'DELETE' });
            fetchReports();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const received = report?.received ?? 0;
  const spent = report?.expenses ?? 0;
  const profit = report?.profit ?? 0;
  const pending = report?.pending ?? 0;


  const byCat = Object.entries(report?.byCategory || {});
  // month by month: up to today, from the first month with anything in it (as the web)
  const nowD = new Date();
  const thisMonth = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}`;
  const upToNow = (report?.months || []).filter((m) => m.key <= thisMonth);
  const firstActive = upToNow.findIndex((m) => m.received || m.expenses || m.pending);
  const pastMonths = firstActive < 0 ? upToNow : upToNow.slice(firstActive);
  const amt = (v) => (v ? rupees(Math.abs(v)) : '—');
  const monthLabel = (key) => { const [yy, mm] = key.split('-'); return `${MONTHS[Number(mm) - 1]} ${yy}`; };

  // what each member still owes = their unpaid months (the server sends months, not a balance)
  const memberBreakdown = (dashboardData?.memberPaymentBreakdown || []).map((m) => ({
    ...m,
    balance: m.balance ?? (m.months || []).filter((x) => x.status === 'due' || x.status === 'overdue').reduce((t, x) => t + (x.amount || 0), 0),
  }));
  const monthName = Object.fromEntries((dashboardData?.activeMonthsList || []).map((x) => [x.key, x.label]));
  const qLower = search.trim().toLowerCase();
  const searchedMembers = memberBreakdown.filter((m) => !qLower || m.name.toLowerCase().includes(qLower) || (m.phone || '').includes(qLower));
  const WHO_SHOW = { all: () => true, owe: (m) => m.balance > 0, paid: (m) => !(m.balance > 0) };
  const whoPlans = [...new Set(memberBreakdown.map((m) => m.planName).filter(Boolean))];
  const whoFiltersOn = (whoPlan !== 'all' ? 1 : 0) + (whoSort !== 'owed' ? 1 : 0);
  const filteredMembers = searchedMembers
    .filter(WHO_SHOW[whoShow])
    .filter((m) => whoPlan === 'all' || m.planName === whoPlan)
    .sort(whoSort === 'owed' ? (a, b) => (b.balance || 0) - (a.balance || 0) || (b.totalPaid || 0) - (a.totalPaid || 0)
      : whoSort === 'paid' ? (a, b) => (b.totalPaid || 0) - (a.totalPaid || 0)
      : (a, b) => a.name.localeCompare(b.name));

  if (!loaded) return <ScreenSkeleton navigation={navigation} kind="reports" />;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* TopBar with Brand and Theme Toggle */}
      <TopBar title="Money" navigation={navigation} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary} colors={[theme.colors.primary]} progressBackgroundColor={theme.colors.card}
          />
        }>
        {/* 1. title, ⋯ (expense, downloads), one main button — same as the web on phones */}
        <CompactHeader
          title="Money"
          menu={[
            { icon: 'wallet-outline', label: 'Add expense', go: () => setAddExpenseOpen(true) },
            { icon: 'document-text-outline', label: 'Download all payments', go: () => handleExport('payments') },
            { icon: 'alert-circle-outline', label: 'Download unpaid dues', go: () => handleExport('dues') },
            { icon: 'list-outline', label: 'Download balances', go: () => handleExport('balances') },
            { icon: 'cloud-download-outline', label: 'Download a backup', go: () => handleExport('backup') },
          ]}
          mainLabel="Payment"
          onMain={() => setPicking(true)}
        />

        {/* 2. the period in one row: ‹ Nov 2026 › and M Q Y … */}
        <View style={styles.periodRow}>
          <TouchableOpacity accessibilityLabel="Earlier" onPress={() => setStep((x) => x - 1)} style={[styles.stepBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Icon name="chevron-back" size={16} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.periodLabel, { color: theme.colors.text }]} numberOfLines={1}>{range.label}</Text>
          <TouchableOpacity accessibilityLabel="Later" disabled={step >= 0} onPress={() => setStep((x) => x + 1)} style={[styles.stepBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, opacity: step >= 0 ? 0.35 : 1 }]}>
            <Icon name="chevron-forward" size={16} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={[styles.seg, { backgroundColor: theme.colors.cardSubtle, borderColor: theme.colors.border }]}>
            {[['month', 'M', 'Month'], ['quarter', 'Q', 'Quarter'], ['year', 'Y', 'Year'], ['custom', '…', 'This month to today']].map(([k, short, name]) => {
              const on = kind === k;
              return (
                <TouchableOpacity key={k} accessibilityLabel={name} accessibilityState={{ selected: on }} onPress={() => { setKind(k); setStep(0); }}
                  style={[styles.segBtn, on && { backgroundColor: theme.colors.card, shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 }]}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: on ? theme.colors.text : theme.colors.textMuted }}>{short}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 3. the four numbers in one slim strip */}
        <NumberStrip items={[
          { label: 'Received', value: rupees(received), ink: received ? theme.colors.moneyGreen : undefined },
          { label: 'Spent', value: rupees(spent), ink: spent ? theme.colors.moneyRed : undefined },
          { label: profit < 0 ? 'Loss' : 'Profit', value: `${profit < 0 ? '−' : ''}${rupees(Math.abs(profit))}`, ink: profit < 0 ? theme.colors.moneyRed : undefined },
          { label: 'Still to collect', value: rupees(pending), ink: pending ? theme.colors.moneyRed : theme.colors.moneyGreen },
        ]} />

        {/* 4. tabs */}
        <View style={[styles.underTabs, { borderBottomColor: theme.colors.border }]}>
          {[['breakdown', 'Overview', 0], ['expenses', 'Expenses', expenses.length], ['members', 'Who paid', memberBreakdown.length]].map(([k, label, n]) => {
            const on = tab === k;
            return (
              <TouchableOpacity key={k} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setTab(k)}
                style={[styles.underTab, { borderBottomColor: on ? theme.colors.primary : 'transparent' }]}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: on ? theme.colors.primaryDark : theme.colors.textMuted }}>{label}</Text>
                {n > 0 ? (
                  <View style={[styles.tabCount, { backgroundColor: on ? theme.colors.primary : theme.colors.cardSubtle }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: on ? '#fff' : theme.colors.textMuted }}>{n}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* TAB 1: OVERVIEW — the same two cards as the web on a phone */}
        {tab === 'breakdown' && (
          <>
            <View style={[styles.box, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <Text style={[styles.boxTitle, { color: theme.colors.text }]}>Month by month</Text>
              {pastMonths.length === 0 || !pastMonths.some((m) => m.received || m.expenses || m.pending) ? (
                <Text style={[styles.boxEmpty, { color: theme.colors.textMuted }]}>Nothing received, spent or owed in this period yet.</Text>
              ) : pastMonths.map((m, i) => {
                const big = Math.max(1, m.received || 0, m.expenses || 0);
                const loss = m.profit < 0;
                return (
                  <View key={m.key} style={[styles.mrow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 10 }]}>
                    <View style={styles.mrowTop}>
                      <Text style={[styles.mrowMonth, { color: theme.colors.text }]}>{monthLabel(m.key)}</Text>
                      <Text style={[styles.mrowMonth, { color: loss ? theme.colors.moneyRed : theme.colors.text }]}>
                        {loss ? '−' : ''}{amt(m.profit)} <Text style={{ fontWeight: '400', color: theme.colors.textMuted }}>{loss ? 'loss' : 'profit'}</Text>
                      </Text>
                    </View>
                    <View style={[styles.track, { backgroundColor: theme.colors.cardSubtle }]}>
                      <View style={{ width: `${((m.received || 0) / big) * 100}%`, backgroundColor: '#16A34A' }} />
                      <View style={{ width: `${((m.expenses || 0) / big) * 100}%`, backgroundColor: '#EF4444' }} />
                    </View>
                    <View style={styles.mrowTop}>
                      <Text style={[styles.mrowSub, { color: theme.colors.moneyGreen }]}>In {amt(m.received)}</Text>
                      <Text style={[styles.mrowSub, { color: theme.colors.moneyRed }]}>Out {amt(m.expenses)}</Text>
                      <Text style={[styles.mrowSub, { color: theme.colors.moneyAmber }]}>Owed {amt(m.pending)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={[styles.box, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.boxHead}>
                <Text style={[styles.boxTitle, { color: theme.colors.text }]}>Where money went</Text>
                <TouchableOpacity onPress={() => setAddExpenseOpen(true)} style={styles.boxLink} hitSlop={8}>
                  <Icon name="add" size={14} color={theme.colors.primaryDark} />
                  <Text style={[styles.boxLinkText, { color: theme.colors.primaryDark }]}>Add expense</Text>
                </TouchableOpacity>
              </View>
              {byCat.some(([, v]) => v) ? (
                <View style={{ gap: 10 }}>
                  {byCat.filter(([, v]) => v).sort((x, y) => y[1] - x[1]).map(([k, v]) => (
                    <View key={k} style={styles.cat}>
                      <View style={[styles.catIcon, { backgroundColor: theme.isDark ? 'rgba(248,113,113,0.14)' : '#FEF1F0' }]}>
                        <Text style={{ color: theme.colors.moneyRed, fontSize: 14 }}>{CAT_ICON[k] || '•'}</Text>
                      </View>
                      <Text style={[styles.catName, { color: theme.colors.text }]}>{EXPENSE_CATEGORIES[k] || k}</Text>
                      <Text style={[styles.catAmt, { color: theme.colors.moneyRed }]}>−{rupees(v)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.boxEmpty, { color: theme.colors.textMuted }]}>No expenses in this period. Add rent, salaries and bills to see your real profit.</Text>
              )}
            </View>
          </>
        )}

        {/* TAB 2: EXPENSES */}
        {tab === 'expenses' && (
          <Card style={styles.detailCard}>
            <Text style={[styles.breakdownHeader, { color: theme.colors.text }]}>
              Expenses ({expenses.length})
            </Text>
            {expenses.length > 0 ? (
              <View style={{ marginTop: 8, gap: 10 }}>
                {expenses.map((e) => (
                  <View
                    key={e._id}
                    style={[styles.expenseRow, { borderBottomColor: theme.colors.borderSubtle }]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.expenseTitle, { color: theme.colors.text }]}>
                        {e.label || EXPENSE_CATEGORIES[e.category] || e.category}
                      </Text>
                      <Text style={[styles.expenseMeta, { color: theme.colors.textMuted }]}>
                        {formatDate(e.date)} {e.note ? `· ${e.note}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.expenseAmount, { color: '#EF4444' }]}>
                      −{rupees(e.amount)}
                    </Text>
                    {isOwner && (
                      <TouchableOpacity
                        onPress={() => handleDeleteExpense(e._id)}
                        style={styles.trashBtn}>
                        <Icon name="trash-outline" size={15} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.emptyNote, { color: theme.colors.textMuted }]}>
                No expenses recorded in this period. Tap + Expense at the top to add one.
              </Text>
            )}
          </Card>
        )}

        {/* TAB 3: WHO PAID — search + filter, chips, one line per member */}
        {tab === 'members' && (
          <ListCard>
            <SearchFilter value={search} onChange={setSearch} placeholder="Search name" filterOn={whoFiltersOn} onFilter={() => setWhoFilters((o) => !o)} />
            {whoFilters && (
              <View style={[styles.filterPanel, { backgroundColor: theme.colors.cardSubtle }]}>
                {whoPlans.length > 1 && (
                  <>
                    <Text style={[styles.filterLabel, { color: theme.colors.textMuted }]}>PLAN</Text>
                    <ChipRow small value={whoPlan} onPick={setWhoPlan} options={[{ id: 'all', label: 'All plans' }, ...whoPlans.map((p) => ({ id: p, label: p }))]} />
                  </>
                )}
                <Text style={[styles.filterLabel, { color: theme.colors.textMuted }]}>SORT</Text>
                <ChipRow small value={whoSort} onPick={setWhoSort} options={[{ id: 'owed', label: 'Most owed first' }, { id: 'paid', label: 'Most paid first' }, { id: 'name', label: 'Name A–Z' }]} />
              </View>
            )}
            <ChipRow value={whoShow} onPick={setWhoShow} options={[
              { id: 'all', label: 'All', count: searchedMembers.length },
              { id: 'owe', label: 'Owe', count: searchedMembers.filter(WHO_SHOW.owe).length },
              { id: 'paid', label: 'Paid up', count: searchedMembers.filter(WHO_SHOW.paid).length },
            ]} />
            <View>
              {filteredMembers.map((m, i) => {
                const owes = m.balance > 0;
                return (
                  <CompactRow
                    key={m._id}
                    last={i === filteredMembers.length - 1}
                    title={m.name}
                    onPress={() => navigation.navigate('MemberDetail', { id: m._id })}
                    tags={(m.months || []).filter((x) => x.status !== 'not_joined').map((x) => {
                      const st = { paid: 'paid', overdue: 'late', due: 'due' }[x.status] || 'none';
                      return { text: `${st === 'paid' ? '✓ ' : ''}${String(monthName[x.key] || x.key || '').split(' ')[0]}`, tone: st };
                    })}
                    sub={m.planName}
                    amount={rupees(owes ? m.balance : m.totalPaid || 0)}
                    amountInk={owes ? theme.colors.moneyRed : theme.colors.moneyGreen}
                    amountSub={owes ? 'owes' : 'paid'}
                    button={owes
                      ? { label: 'Collect', primary: true, onPress: () => navigation.navigate('MemberDetail', { id: m._id }) }
                      : { label: 'Open', onPress: () => navigation.navigate('MemberDetail', { id: m._id }) }}
                  />
                );
              })}
              {filteredMembers.length === 0 && (
                <Text style={[styles.emptyNote, { color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 16 }]}>
                  {search ? `No members match "${search}".` : 'Nobody here.'}
                </Text>
              )}
            </View>
            {filteredMembers.length > 0 && <ColorKey items={[['Paid', 'paid'], ['Late', 'late'], ['Due', 'due']]} />}
          </ListCard>
        )}
      </ScrollView>

      <PickMember visible={picking} members={(dashboardData?.membersTable || []).filter((m) => m.status === 'active')} word={words(biz?.type).member}
        onClose={() => setPicking(false)} onPick={(m) => { setPicking(false); setPaying(m); }} />
      <RecordPaymentModal visible={Boolean(paying)} member={paying} biz={biz} onClose={() => setPaying(null)} onPaymentRecorded={fetchReports} />

      {/* Add Expense Modal */}
      <AddExpenseModal
        visible={addExpenseOpen}
        biz={biz}
        onClose={() => setAddExpenseOpen(false)}
        onSaved={fetchReports}
      />

      {/* Download Choice Modal */}
      <Modal
        visible={downloadModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDownloadModalOpen(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setDownloadModalOpen(false)}>
          <View style={[styles.downloadModalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.downloadModalTitle, { color: theme.colors.text }]}>Download Data</Text>

            <TouchableOpacity
              style={styles.downloadOption}
              onPress={() => handleExport('payments')}>
              <Icon name="document-text-outline" size={17} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.downloadOptionTitle, { color: theme.colors.text }]}>
                  All Payments (CSV)
                </Text>
                <Text style={[styles.downloadOptionSub, { color: theme.colors.textMuted }]}>
                  Record of all collections and dates
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.downloadOption}
              onPress={() => handleExport('dues')}>
              <Icon name="alert-circle-outline" size={17} color="#EF4444" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.downloadOptionTitle, { color: theme.colors.text }]}>
                  Unpaid Dues (CSV)
                </Text>
                <Text style={[styles.downloadOptionSub, { color: theme.colors.textMuted }]}>
                  List of members with pending balances
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.downloadOption}
              onPress={() => handleExport('balances')}>
              <Icon name="list-outline" size={17} color={theme.colors.text} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.downloadOptionTitle, { color: theme.colors.text }]}>
                  Member Balances (CSV)
                </Text>
                <Text style={[styles.downloadOptionSub, { color: theme.colors.textMuted }]}>
                  Complete ledger of current standings
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.downloadOption}
              onPress={() => handleExport('backup')}>
              <Icon name="cloud-download-outline" size={17} color="#8B5CF6" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.downloadOptionTitle, { color: theme.colors.text }]}>
                  Workspace Backup (JSON)
                </Text>
                <Text style={[styles.downloadOptionSub, { color: theme.colors.textMuted }]}>
                  Full snapshot of members, plans & settings
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12, gap: 12 },
  boxHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  boxTitle: { fontSize: 15, fontWeight: '700' },
  boxEmpty: { fontSize: 13.5, lineHeight: 20 },
  boxLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  boxLinkText: { fontSize: 13, fontWeight: '600' },
  mrow: { gap: 6 },
  mrowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  mrowMonth: { fontSize: 13.5, fontWeight: '600' },
  mrowSub: { fontSize: 12 },
  track: { flexDirection: 'row', height: 8, borderRadius: 99, overflow: 'hidden' },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  catName: { flex: 1, fontSize: 13.5 },
  catAmt: { fontSize: 13.5, fontWeight: '700' },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  periodLabel: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700' },
  seg: { flexDirection: 'row', padding: 3, borderRadius: 10, borderWidth: 1, gap: 2 },
  segBtn: { height: 28, minWidth: 28, paddingHorizontal: 8, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  underTabs: { flexDirection: 'row', gap: 18, borderBottomWidth: 1, marginBottom: 12, paddingHorizontal: 2 },
  underTab: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 2, marginBottom: -1 },
  tabCount: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  filterPanel: { borderRadius: 10, padding: 10, gap: 6 },
  filterLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.4 },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 36,
  },
  headerWrap: {
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnAddExpense: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAddExpenseText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
  },
  btnDownload: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnDownloadText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  periodCard: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  periodTabsWrap: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCenter: {
    alignItems: 'center',
  },
  stepperLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  stepperSubLabel: {
    fontSize: 11.5,
    marginTop: 2,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  kpiHalfCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    marginBottom: 0,
  },
  kpiFullCard: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  kpiLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  kpiVal: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 3,
  },
  kpiValLarge: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 3,
  },
  kpiSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  changeText: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 4,
  },
  detailTabsWrap: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  detailTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: 6,
  },
  detailTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  breakdownHeader: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barLabel: {
    fontSize: 13,
    width: 65,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  barVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyNote: {
    fontSize: 12.5,
    marginVertical: 6,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  expenseTitle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  expenseMeta: {
    fontSize: 11.5,
    marginTop: 1,
  },
  expenseAmount: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  trashBtn: {
    padding: 6,
    marginLeft: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    marginTop: 4,
    marginBottom: 8,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  memberName: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  memberPhone: {
    fontSize: 11.5,
    marginTop: 1,
  },
  memberBal: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  downloadModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  downloadModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  downloadOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  downloadOptionTitle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  downloadOptionSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
});
