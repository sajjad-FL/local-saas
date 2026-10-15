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
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useBiz } from '../../context/BizContext';
import { useTheme } from '../../context/ThemeContext';
import { api, rupees, getApiBaseUrl } from '../../api/api';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Icon from '../../components/Icon';

export default function ReportsScreen({ navigation }) {
  const { biz } = useBiz();
  const { theme } = useTheme();

  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchReports = useCallback(async () => {
    if (!biz?._id) return;
    try {
      const res = await api(`/businesses/${biz._id}/dashboard`);
      setData(res);
    } catch (err) {
      console.warn('Reports error', err);
    }
  }, [biz?._id]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReports();
    setRefreshing(false);
  };

  const handleExport = async (type = 'payments') => {
    setExporting(true);
    try {
      const baseUrl = await getApiBaseUrl();
      const endpoint = type === 'payments' ? 'export/payments.csv' : type === 'balances' ? 'export/balances.csv' : 'export/backup.json';
      const ext = type === 'backup' ? 'json' : 'csv';
      const fileUri = `${FileSystem.documentDirectory}${biz.name.replace(/\s+/g, '_')}_${type}.${ext}`;

      const res = await api(`/businesses/${biz._id}/${endpoint}`);
      const content = typeof res === 'string' ? res : JSON.stringify(res, null, 2);

      await FileSystem.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('File Saved', `Export saved to: ${fileUri}`);
      }
    } catch (err) {
      Alert.alert('Export Failed', err.message || 'Could not export file');
    } finally {
      setExporting(false);
    }
  };

  if (!data) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerBox}>
          <Text style={{ color: theme.colors.textSecondary }}>Loading reports & analytics…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const {
    revenueTrend = [],
    openedMonthName,
    openedYear,
    memberPaymentBreakdown = [],
  } = data;

  const filteredMonths = revenueTrend.filter(
    (r) => r.isAfterOpening || r.collected > 0 || r.pending > 0
  );

  const totalCollections = filteredMonths.reduce((s, t) => s + (t.collected || 0), 0);
  const totalPending = filteredMonths.reduce((s, t) => s + (t.pending || 0), 0);
  const totalOverall = totalCollections + totalPending;
  const overallEfficiency = totalOverall > 0 ? Math.round((totalCollections / totalOverall) * 100) : 100;

  const qLower = search.trim().toLowerCase();
  const filteredBreakdown = memberPaymentBreakdown.filter((m) => {
    if (!qLower) return true;
    return m.name.toLowerCase().includes(qLower) || (m.phone || '').includes(qLower);
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.headerBar, { borderBottomColor: theme.colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Reports & Audit</Text>
          <Text style={[styles.headerSub, { color: theme.colors.textSecondary }]}>
            Financial audits, collection efficiency & exports
          </Text>
        </View>

        <Button
          title="Export CSV"
          variant="outline"
          size="sm"
          loading={exporting}
          icon={<Icon name="download-outline" size={14} color={theme.colors.text} />}
          onPress={() => handleExport('payments')}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }>
        {/* KPI Grid (3 Cards) */}
        <View style={styles.kpiRow}>
          <Card style={styles.kpiCard}>
            <Text style={[styles.kpiLabel, { color: theme.colors.textSecondary }]}>
              TOTAL COLLECTED
            </Text>
            <Text style={[styles.kpiValue, { color: theme.colors.primary }]}>
              {rupees(totalCollections)}
            </Text>
            <Text style={[styles.kpiSub, { color: theme.colors.textMuted }]}>
              All-time earnings
            </Text>
          </Card>

          <Card style={styles.kpiCard}>
            <Text style={[styles.kpiLabel, { color: theme.colors.textSecondary }]}>
              TOTAL PENDING
            </Text>
            <Text
              style={[
                styles.kpiValue,
                { color: totalPending > 0 ? theme.colors.danger : theme.colors.primary },
              ]}>
              {rupees(totalPending)}
            </Text>
            <Text style={[styles.kpiSub, { color: theme.colors.textMuted }]}>
              Unpaid dues
            </Text>
          </Card>

          <Card style={styles.kpiCard}>
            <Text style={[styles.kpiLabel, { color: theme.colors.textSecondary }]}>
              EFFICIENCY
            </Text>
            <Text style={[styles.kpiValue, { color: theme.colors.text }]}>
              {overallEfficiency}%
            </Text>
            <Text style={[styles.kpiSub, { color: theme.colors.textMuted }]}>
              Collection rate
            </Text>
          </Card>
        </View>

        {/* Operating Since Info */}
        {openedMonthName && (
          <View style={[styles.operatingBanner, { backgroundColor: theme.colors.cardSubtle }]}>
            <Icon name="business-outline" size={16} color={theme.colors.primary} />
            <Text style={[styles.operatingText, { color: theme.colors.text }]}>
              Operating since <Text style={{ fontWeight: '700' }}>{openedMonthName} {openedYear}</Text>
            </Text>
          </View>
        )}

        {/* Monthly Performance Breakdown */}
        <Card style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Monthly Collection Audit
          </Text>
          <Text style={[styles.sectionSub, { color: theme.colors.textSecondary }]}>
            Month-by-month billing and recovery rate
          </Text>

          <View style={{ marginTop: 10, gap: 10 }}>
            {filteredMonths.map((m, idx) => {
              const billed = (m.collected || 0) + (m.pending || 0);
              const rate = billed > 0 ? Math.round(((m.collected || 0) / billed) * 100) : 100;
              return (
                <View
                  key={idx}
                  style={[
                    styles.auditMonthItem,
                    { borderBottomColor: theme.colors.borderSubtle },
                  ]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.auditMonthName, { color: theme.colors.text }]}>
                      {m.month}
                    </Text>
                    <Text style={[styles.auditMonthMeta, { color: theme.colors.textMuted }]}>
                      Collected: {rupees(m.collected)} · Pending: {rupees(m.pending)}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Badge
                      label={`${rate}% Recovered`}
                      variant={rate >= 80 ? 'success' : rate >= 50 ? 'warning' : 'danger'}
                      size="sm"
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Member Payment Breakdown */}
        <Card style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Member Payment Summary
          </Text>
          <Text style={[styles.sectionSub, { color: theme.colors.textSecondary }]}>
            Detailed dues vs collections per member
          </Text>

          {/* Search */}
          <View
            style={[
              styles.searchBox,
              {
                backgroundColor: theme.colors.inputBg,
                borderColor: theme.colors.inputBorder,
                marginTop: 10,
                marginBottom: 10,
              },
            ]}>
            <Icon name="search-outline" size={16} color={theme.colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search member name or phone…"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.searchInput, { color: theme.colors.text }]}
            />
          </View>

          <View style={{ gap: 8 }}>
            {filteredBreakdown.map((m) => {
              const isOwing = (m.pendingBalance || 0) > 0;
              return (
                <TouchableOpacity
                  key={m.id}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('MemberDetail', { id: m.id })}
                  style={[
                    styles.memberRow,
                    { borderBottomColor: theme.colors.borderSubtle },
                  ]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memberName, { color: theme.colors.text }]}>
                      {m.name}
                    </Text>
                    <Text style={[styles.memberPhone, { color: theme.colors.textSecondary }]}>
                      {m.phone || 'No phone'} · Paid: {rupees(m.totalPaid)}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={[
                        styles.memberBal,
                        { color: isOwing ? theme.colors.danger : theme.colors.successDark },
                      ]}>
                      {isOwing ? `${rupees(m.pendingBalance)} Due` : 'Cleared'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {filteredBreakdown.length === 0 && (
              <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                No member records found.
              </Text>
            )}
          </View>
        </Card>

        {/* Export Buttons Section */}
        <View style={styles.exportSection}>
          <Text style={[styles.exportSectionTitle, { color: theme.colors.text }]}>
            Data Exports & Backups
          </Text>
          <View style={{ gap: 8, marginTop: 8 }}>
            <Button
              title="Export All Payments (CSV)"
              variant="outline"
              icon={<Icon name="document-text-outline" size={16} color={theme.colors.text} />}
              loading={exporting}
              onPress={() => handleExport('payments')}
            />
            <Button
              title="Export Member Balances (CSV)"
              variant="outline"
              icon={<Icon name="list-outline" size={16} color={theme.colors.text} />}
              loading={exporting}
              onPress={() => handleExport('balances')}
            />
            <Button
              title="Full Workspace Backup (JSON)"
              variant="secondary"
              icon={<Icon name="cloud-download-outline" size={16} color={theme.colors.text} />}
              loading={exporting}
              onPress={() => handleExport('backup')}
            />
          </View>
        </View>
      </ScrollView>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  kpiCard: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    marginBottom: 0,
  },
  kpiLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '800',
    marginVertical: 4,
  },
  kpiSub: {
    fontSize: 10,
  },
  operatingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  operatingText: {
    fontSize: 12,
  },
  sectionCard: {
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  auditMonthItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  auditMonthName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  auditMonthMeta: {
    fontSize: 11.5,
    marginTop: 2,
  },
  searchBox: {
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
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  memberName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  memberPhone: {
    fontSize: 11.5,
    marginTop: 1,
  },
  memberBal: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 14,
    fontSize: 12.5,
  },
  exportSection: {
    marginTop: 8,
  },
  exportSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
});

