import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Alert,
  Modal,
} from 'react-native';
import { downloadFile } from '../../api/download';
import { useBiz } from '../../context/BizContext';
import { useTheme } from '../../context/ThemeContext';
import { api, rupees, formatDate } from '../../api/api';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import TopBar from '../../components/TopBar';
import { tinted } from '../../constants/theme';
import AddExpenseModal from '../modals/AddExpenseModal';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MODES = { cash: 'Cash', upi: 'UPI', other: 'Bank / card' };
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

const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayEnd = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
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

const prevLabel = {
  month: 'last month',
  quarter: 'last quarter',
  year: 'last year',
  custom: 'previous period',
};

function Change({ now = 0, before = 0, kind = 'month', goodWhenUp = true }) {
  if (!before && !now) return null;
  const diff = (now || 0) - (before || 0);
  if (!diff) {
    return (
      <Text style={[styles.changeText, { color: '#94A3B8' }]}>
        Same as {prevLabel[kind]}
      </Text>
    );
  }
  const good = goodWhenUp ? diff > 0 : diff < 0;
  return (
    <Text style={[styles.changeText, { color: good ? '#10B981' : '#EF4444' }]}>
      {diff > 0 ? '▲' : '▼'} {rupees(Math.abs(diff))} vs {prevLabel[kind]}
    </Text>
  );
}

export default function ReportsScreen({ navigation }) {
  const { biz, isOwner } = useBiz();
  const { theme } = useTheme();

  const [kind, setKind] = useState('month'); // 'month' | 'quarter' | 'year' | 'custom'
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState('breakdown'); // 'breakdown' | 'expenses' | 'members'
  const [report, setReport] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);

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
    }
  }, [biz?._id, range.from, range.to]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const onRefresh = async () => {
    setRefreshing(true);
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
  const billed = report?.billed ?? 0;
  const paymentCount = report?.paymentCount ?? 0;
  const prev = report?.previous || {};

  // Splits for breakdown card
  const byMode = Object.entries(report?.byMode || {});
  const totalMode = byMode.reduce((s, [, v]) => s + v, 0);

  const byCat = Object.entries(report?.byCategory || {});
  const totalCat = byCat.reduce((s, [, v]) => s + v, 0);

  const memberBreakdown = dashboardData?.memberPaymentBreakdown || [];
  const qLower = search.trim().toLowerCase();
  const filteredMembers = memberBreakdown.filter((m) => {
    if (!qLower) return true;
    return m.name.toLowerCase().includes(qLower) || (m.phone || '').includes(qLower);
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* TopBar with Brand and Theme Toggle */}
      <TopBar title="Reports" navigation={navigation} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }>
        {/* PAGE TITLE & ACTION BUTTONS */}
        <View style={styles.headerWrap}>
          <Text style={[styles.pageTitle, { color: theme.colors.text }]}>Reports</Text>

          <View style={styles.actionRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.btnAddExpense, { backgroundColor: '#10B981' }]}
              onPress={() => setAddExpenseOpen(true)}>
              <Text style={styles.btnAddExpenseText}>+ Add expense</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.btnDownload,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
              onPress={() => setDownloadModalOpen(true)}>
              <Icon name="download-outline" size={15} color={theme.colors.text} />
              <Text style={[styles.btnDownloadText, { color: theme.colors.text }]}>
                Download
              </Text>
              <Icon name="chevron-down" size={13} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* PERIOD PICKER CARD */}
        <Card style={styles.periodCard}>
          {/* Segmented Control */}
          <View style={[styles.periodTabsWrap, { backgroundColor: theme.colors.cardSubtle }]}>
            {[
              ['month', 'Month'],
              ['quarter', 'Quarter'],
              ['year', 'Year'],
              ['custom', 'Custom'],
            ].map(([k, label]) => {
              const active = kind === k;
              return (
                <TouchableOpacity
                  key={k}
                  activeOpacity={0.7}
                  onPress={() => {
                    setKind(k);
                    setStep(0);
                  }}
                  style={[
                    styles.periodTab,
                    active && { backgroundColor: theme.colors.card },
                  ]}>
                  <Text
                    style={[
                      styles.periodTabText,
                      { color: active ? theme.colors.text : theme.colors.textMuted },
                    ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Stepper Navigation Row */}
          <View style={styles.stepperRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setStep((s) => s - 1)}
              style={[styles.stepBtn, { backgroundColor: theme.colors.cardSubtle }]}>
              <Icon name="chevron-back" size={16} color={theme.colors.text} />
            </TouchableOpacity>

            <View style={styles.stepperCenter}>
              <Text style={[styles.stepperLabel, { color: theme.colors.text }]}>
                {range.label}
              </Text>
              <Text style={[styles.stepperSubLabel, { color: theme.colors.textMuted }]}>
                {range.subLabel}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              disabled={step >= 0}
              onPress={() => setStep((s) => s + 1)}
              style={[
                styles.stepBtn,
                { backgroundColor: theme.colors.cardSubtle, opacity: step >= 0 ? 0.3 : 1 },
              ]}>
              <Icon name="chevron-forward" size={16} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        </Card>

        {/* THE 4 FINANCIAL KPI CARDS */}
        {/* Row 1: Received & Spent (Side by side) */}
        <View style={styles.kpiRow}>
          {/* Received */}
          <Card style={[styles.kpiHalfCard, tinted(theme, '#10B981')]}>
            <Text style={[styles.kpiLabel, { color: theme.colors.textMuted }]}>Received</Text>
            <Text style={[styles.kpiVal, { color: received ? theme.colors.primary : theme.colors.text }]}>
              {rupees(received)}
            </Text>
            <Text style={[styles.kpiSub, { color: theme.colors.textMuted }]}>
              from {paymentCount} payment{paymentCount === 1 ? '' : 's'}
            </Text>
            <Change now={received} before={prev.received} kind={kind} goodWhenUp={true} />
          </Card>

          {/* Spent */}
          <Card style={[styles.kpiHalfCard, tinted(theme, '#EF4444')]}>
            <Text style={[styles.kpiLabel, { color: theme.colors.textMuted }]}>Spent</Text>
            <Text style={[styles.kpiVal, { color: spent ? theme.colors.danger : theme.colors.text }]}>
              {rupees(spent)}
            </Text>
            <Text style={[styles.kpiSub, { color: theme.colors.textMuted }]}>
              {expenses.length ? `on ${expenses.length} expense${expenses.length === 1 ? '' : 's'}` : 'no expenses'}
            </Text>
            <Change now={spent} before={prev.expenses} kind={kind} goodWhenUp={false} />
          </Card>
        </View>

        {/* Row 2: Profit (Full width) */}
        <Card style={[styles.kpiFullCard, tinted(theme, profit < 0 ? '#EF4444' : '#10B981'), { borderLeftWidth: 3, borderLeftColor: profit < 0 ? '#EF4444' : '#10B981' }]}>
          <Text style={[styles.kpiLabel, { color: theme.colors.textMuted }]}>{profit < 0 ? 'Loss' : 'Profit'}</Text>
          <Text
            style={[
              styles.kpiValLarge,
              { color: profit < 0 ? '#EF4444' : '#10B981' },
            ]}>
            {profit < 0 ? '−' : ''}{rupees(Math.abs(profit))}
          </Text>
          <Text style={[styles.kpiSub, { color: theme.colors.textMuted }]}>
            received minus spent
          </Text>
          <Change now={profit} before={prev.profit} kind={kind} goodWhenUp={true} />
        </Card>

        {/* Row 3: Still to collect (Full width) */}
        <Card style={[styles.kpiFullCard, tinted(theme, '#F59E0B')]}>
          <Text style={[styles.kpiLabel, { color: theme.colors.textMuted }]}>Still to collect</Text>
          <Text style={[styles.kpiValLarge, { color: pending ? theme.colors.warningDark : theme.colors.text }]}>
            {rupees(pending)}
          </Text>
          <Text style={[styles.kpiSub, { color: theme.colors.textMuted }]}>
            {billed > 0
              ? `of ${rupees(billed)} in fees for this period`
              : 'no fees fell in this period'}
          </Text>
        </Card>

        {/* DETAIL TABS SWITCHER */}
        <View style={[styles.detailTabsWrap, { backgroundColor: theme.colors.cardSubtle }]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setTab('breakdown')}
            style={[
              styles.detailTab,
              tab === 'breakdown' && { backgroundColor: theme.colors.card },
            ]}>
            <Icon
              name="bar-chart-outline"
              size={14}
              color={tab === 'breakdown' ? theme.colors.primary : theme.colors.textMuted}
            />
            <Text
              style={[
                styles.detailTabText,
                { color: tab === 'breakdown' ? theme.colors.text : theme.colors.textMuted },
              ]}>
              Breakdown
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setTab('expenses')}
            style={[
              styles.detailTab,
              tab === 'expenses' && { backgroundColor: theme.colors.card },
            ]}>
            <Text
              style={[
                styles.detailTabText,
                { color: tab === 'expenses' ? theme.colors.text : theme.colors.textMuted },
              ]}>
              ₹  Expenses ({expenses.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setTab('members')}
            style={[
              styles.detailTab,
              tab === 'members' && { backgroundColor: theme.colors.card },
            ]}>
            <Icon
              name="people-outline"
              size={14}
              color={tab === 'members' ? theme.colors.primary : theme.colors.textMuted}
            />
            <Text
              style={[
                styles.detailTabText,
                { color: tab === 'members' ? theme.colors.text : theme.colors.textMuted },
              ]}>
              Who paid
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: BREAKDOWN */}
        {tab === 'breakdown' && (
          <Card style={styles.detailCard}>
            {/* How members paid */}
            <Text style={[styles.breakdownHeader, { color: theme.colors.text }]}>
              How members paid
            </Text>
            {byMode.length > 0 ? (
              <View style={{ gap: 10, marginBottom: 20 }}>
                {byMode.map(([modeKey, amt]) => {
                  const pct = totalMode > 0 ? Math.max(3, Math.round((amt / totalMode) * 100)) : 0;
                  return (
                    <View key={modeKey} style={styles.barRow}>
                      <Text style={[styles.barLabel, { color: theme.colors.text }]} numberOfLines={1}>
                        {MODES[modeKey] || modeKey}
                      </Text>
                      <View style={[styles.barTrack, { backgroundColor: theme.colors.cardSubtle }]}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${pct}%`, backgroundColor: '#10B981' },
                          ]}
                        />
                      </View>
                      <Text style={[styles.barVal, { color: theme.colors.text }]}>
                        {rupees(amt)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={[styles.emptyNote, { color: theme.colors.textMuted }]}>
                No payments received in this period.
              </Text>
            )}

            {/* Where money went */}
            <Text style={[styles.breakdownHeader, { color: theme.colors.text, marginTop: 4 }]}>
              Where money went
            </Text>
            {byCat.length > 0 ? (
              <View style={{ gap: 10 }}>
                {byCat.map(([catKey, amt]) => {
                  const pct = totalCat > 0 ? Math.max(3, Math.round((amt / totalCat) * 100)) : 0;
                  return (
                    <View key={catKey} style={styles.barRow}>
                      <Text style={[styles.barLabel, { color: theme.colors.text }]} numberOfLines={1}>
                        {EXPENSE_CATEGORIES[catKey] || catKey}
                      </Text>
                      <View style={[styles.barTrack, { backgroundColor: theme.colors.cardSubtle }]}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${pct}%`, backgroundColor: '#EF4444' },
                          ]}
                        />
                      </View>
                      <Text style={[styles.barVal, { color: theme.colors.text }]}>
                        {rupees(amt)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={[styles.emptyNote, { color: theme.colors.textMuted }]}>
                No expenses recorded in this period.
              </Text>
            )}
          </Card>
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
                No expenses recorded in this period. Tap "+ Add expense" above to add one.
              </Text>
            )}
          </Card>
        )}

        {/* TAB 3: WHO PAID */}
        {tab === 'members' && (
          <Card style={styles.detailCard}>
            <Text style={[styles.breakdownHeader, { color: theme.colors.text }]}>
              Who paid each month
            </Text>
            <View style={[styles.searchBox, { backgroundColor: theme.colors.cardSubtle, borderColor: theme.colors.border }]}>
              <Icon name="search-outline" size={16} color={theme.colors.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search member…"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.searchInput, { color: theme.colors.text }]}
              />
            </View>

            {filteredMembers.length > 0 ? (
              <View style={{ gap: 8, marginTop: 10 }}>
                {filteredMembers.map((m) => (
                  <TouchableOpacity
                    key={m._id}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('MemberDetail', { id: m._id })}
                    style={[styles.memberRow, { borderBottomColor: theme.colors.borderSubtle }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.memberName, { color: theme.colors.text }]}>{m.name}</Text>
                      <Text style={[styles.memberPhone, { color: theme.colors.textMuted }]}>
                        {m.phone || 'No phone'}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.memberBal,
                        { color: (m.balance || 0) <= 0 ? '#10B981' : '#EF4444' },
                      ]}>
                      {(m.balance || 0) <= 0 ? 'Clear' : `${rupees(m.balance)} due`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={[styles.emptyNote, { color: theme.colors.textMuted }]}>
                No members found matching "{search}".
              </Text>
            )}
          </Card>
        )}
      </ScrollView>

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
    width: 36,
    height: 36,
    borderRadius: 8,
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
