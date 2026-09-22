import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { api, waLink, rupees, download } from '../api.js';
import { useBiz, useTheme } from '../App.jsx';
import {
  Avatar, Empty, Rise, CountUp, Field,
  UsersIcon, AlertIcon, CheckCircleIcon, WhatsAppIcon, ChevronIcon,
  RupeeIcon, CheckIcon, PlusIcon, TrendingUpIcon,
  PieChartIcon, SendIcon, DownloadIcon, XIcon, UserIcon, PhoneIcon,
  CreditCardIcon, CalendarIcon, ClockIcon, CalendarClockIcon,
  AlertCircleIcon, UserPlusIcon, BellIcon, CopyIcon, FileSpreadsheetIcon,
} from '../ui.jsx';
import { MemberProfileSheet } from './Members.jsx';
import { formatINR, formatRupees, getPlanColor, getPlanPillClass, getRenewalThreshold } from '../data/gymData.js';

// Register Chart.js modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

function FeeBreakdownPopover({ plans = [], avgFee = 0, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 45 }}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 6, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.96 }}
        transition={{ duration: 0.15 }}
        className="kpi-popover-card"
        onClick={(e) => e.stopPropagation()}>
        <div className="kpi-popover-header">
          <span>Fee breakdown by plan</span>
          <button
            type="button"
            className="icon-btn"
            style={{ width: 20, height: 20, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close">
            <XIcon size={12} />
          </button>
        </div>
        <div className="kpi-popover-body">
          {plans.map((p, i) => (
            <div key={i} className="kpi-popover-row">
              <span className="kpi-popover-plan">{p.name}</span>
              <span className="muted">·</span>
              <span className="muted">{p.count} member{p.count > 1 ? 's' : ''}</span>
              <span className="muted">·</span>
              <span className="kpi-popover-amt">₹{(p.monthlyEq || p.amount || 0).toLocaleString('en-IN')}</span>
            </div>
          ))}
          {!plans.length && (
            <div className="muted small" style={{ textAlign: 'center', padding: '6px 0' }}>
              No active subscription plans
            </div>
          )}
        </div>
        <div className="kpi-popover-footer">
          <span>Avg across all:</span>
          <span className="kpi-popover-avg">₹{avgFee.toLocaleString('en-IN')}/mo</span>
        </div>
      </motion.div>
    </>
  );
}

export default function Dashboard() {
  const biz = useBiz();
  const { theme } = useTheme();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [period, setPeriod] = useState('6M'); // '3M' | '6M' | '1Y'
  const [tableSearch, setTableSearch] = useState('');
  const [tableFilter, setTableFilter] = useState('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [reminderModal, setReminderModal] = useState(null); // { member: object }
  const [bulkReminderOpen, setBulkReminderOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [slideOverMemberId, setSlideOverMemberId] = useState(null);

  const isDark = theme === 'dark';

  const { data } = useQuery({
    queryKey: ['dashboard', biz._id],
    queryFn: () => api(`/businesses/${biz._id}/dashboard`),
  });

  const { data: plans } = useQuery({
    queryKey: ['plans', biz._id],
    queryFn: () => api(`/businesses/${biz._id}/plans`),
  });

  const addMember = useMutation({
    mutationFn: async (form) => {
      const member = await api(`/businesses/${biz._id}/members`, { method: 'POST', body: form });
      if (form.planId) {
        await api(`/members/${member._id}/subscribe`, {
          method: 'POST',
          body: { planId: form.planId, startDate: form.startDate },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries();
      setAddModalOpen(false);
    },
  });

  const revenueTrend = data?.revenueTrend || [];

  // FIX 4: Only render bars for months with data + current month with projection
  const filteredMonths = useMemo(() => {
    const withData = revenueTrend.filter((t) => t.hasActivity || t.isCurrentMonth || t.collected > 0 || t.pending > 0);
    const base = withData.length > 0 ? withData : revenueTrend.filter((t) => t.collected > 0 || t.isCurrentMonth);
    if (period === '3M') return base.slice(-3);
    if (period === '6M') return base.length <= 6 ? base : base.slice(-6);
    if (period === '1Y') return base.slice(-12);
    return base;
  }, [revenueTrend, period]);

  if (!data) {
    return (
      <div aria-hidden="true">
        <div className="stats-kpi-grid">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card skeleton" style={{ minHeight: 114 }} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: 16, marginTop: 16 }}>
          <div className="card skeleton" style={{ minHeight: 280 }} />
          <div className="card skeleton" style={{ minHeight: 280 }} />
        </div>
      </div>
    );
  }

  const { metrics, planDistribution = [], membersTable = [], openedMonthName, openedYear } = data;

  // FIX 4: Chart bars render actual data with lighter green projected bar for current month
  const barChartData = {
    labels: filteredMonths.map((t) => t.month),
    datasets: [
      {
        label: 'Collected',
        data: filteredMonths.map((t) => (t.isProjected ? (t.projectedAmount || 6000) : t.collected)),
        borderColor: filteredMonths.map((t) => (t.isProjected ? '#10B981' : 'transparent')),
        borderWidth: filteredMonths.map((t) => (t.isProjected ? 1.5 : 0)),
        borderRadius: 6,
        borderSkipped: false,
      },
      {
        label: 'Pending Dues',
      },
    ],
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          pointStyle: 'circle',
          color: isDark ? '#94A3B8' : '#64748B',
          font: { family: "'Inter', sans-serif", size: 11.5, weight: '500' },
          padding: 14,
        },
      },
      tooltip: {
        backgroundColor: isDark ? '#1E293B' : '#0F172A',
        titleColor: '#FFFFFF',
        bodyColor: '#E2E8F0',
        padding: 10,
        cornerRadius: 6,
        callbacks: {
          label: (context) => {
            const item = filteredMonths[context.dataIndex];
            if (item && item.isProjected && context.datasetIndex === 0) {
              return ` Projected: ₹${(item.projectedAmount || context.raw || 6000).toLocaleString('en-IN')}`;
            }
            return ` ${context.dataset.label}: ₹${context.raw.toLocaleString('en-IN')}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: isDark ? '#94A3B8' : '#64748B',
          font: { family: "'Inter', sans-serif", size: 11.5, weight: '500' },
        },
      },
      y: {
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          color: isDark ? '#94A3B8' : '#64748B',
          font: { family: "'Inter', sans-serif", size: 11 },
          callback: (value) => `₹${value >= 1000 ? `${value / 1000}k` : value}`,
        },
      },
    },
  };

  const hasPlanData = (planDistribution || []).some((p) => p.count > 0);

  const donutChartData = {
    labels: hasPlanData ? planDistribution.map((p) => p.name) : ['No active members'],
    datasets: [
      {
        data: hasPlanData ? planDistribution.map((p) => p.count) : [1],
        backgroundColor: hasPlanData
          ? planDistribution.map((p, idx) => getPlanColor(p.name, idx))
          : [isDark ? '#334155' : '#E2E8F0'],
        borderColor: isDark ? '#1E293B' : '#FFFFFF',
        borderWidth: 2,
        hoverOffset: 4,
      },
    ],
  };

  const donutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: hasPlanData,
        backgroundColor: isDark ? '#1E293B' : '#0F172A',
        titleColor: '#FFFFFF',
        bodyColor: '#E2E8F0',
        padding: 10,
        cornerRadius: 6,
        callbacks: {
          label: (context) => {
            const p = planDistribution[context.dataIndex];
            if (!p) return ` ${context.label}: ${context.raw} members`;
            return ` ${p.name}: ${p.count} member${p.count > 1 ? 's' : ''} (${p.pctRevenue}% of revenue)`;
          },
        },
      },
    },
  };

  // Filtered members table
  const searchLower = tableSearch.trim().toLowerCase();
  const filteredTable = (membersTable || []).filter((m) => {
    const matchesSearch = !searchLower || m.name.toLowerCase().includes(searchLower) || (m.phone || '').includes(searchLower);
    if (!matchesSearch) return false;
    if (tableFilter === 'active') return m.status === 'active';
    if (tableFilter === 'overdue') return m.statusBadge === 'overdue';
    if (tableFilter === 'due_soon') return m.statusBadge === 'due_soon';
    return true;
  });

  // Sort active members with nextRenewal ascending to find the TRUE nearest upcoming renewal
  const activeWithRenewal = (membersTable || [])
    .filter((m) => m.status === 'active' && m.nextRenewal)
    .sort((a, b) => new Date(a.nextRenewal) - new Date(b.nextRenewal));

  const nearestMember = activeWithRenewal[0] || membersTable[0];
  const nearestDays = nearestMember?.nextRenewal
    ? Math.ceil((new Date(nearestMember.nextRenewal) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  // Accurate members due within 7 days
  const dueWithin7Days = (membersTable || []).filter((m) => {
    if (m.status !== 'active' || !m.nextRenewal) return false;
    const diffDays = Math.ceil((new Date(m.nextRenewal) - new Date()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  });

  // Sparkline data for Tile 2
  const sparklineBars = metrics.monthlyRevenue?.sparkline || [metrics.monthlyRevenue.value * 0.75, metrics.monthlyRevenue.value * 0.9, metrics.monthlyRevenue.value];
  const maxSparkline = Math.max(...sparklineBars, 1);

  const currentMonthExportName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <>
      <AnimatePresence>
        {slideOverMemberId && (
          <MemberProfileSheet
            biz={biz}
            memberId={slideOverMemberId}
            plans={plans || []}
            highlightReminder={true}
            onClose={() => setSlideOverMemberId(null)}
          />
        )}
      </AnimatePresence>

      {/* Top Header & Quick Actions Bar */}
      <div className="page-header">
        <div className="page-title-wrap">
          <h1 className="page-title">
            Dashboard
          </h1>
          <p className="page-subtitle">
            Overview of members, monthly revenue, pending dues, and upcoming renewals.
          </p>
        </div>

        {/* Quick Action Buttons on Header */}
        <div className="row" style={{ gap: 8 }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn"
            onClick={() => setAddModalOpen(true)}>
            <PlusIcon size={14} /> Add Member
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-secondary"
            onClick={() => download(`/businesses/${biz._id}/export/payments.csv`, `${biz.name}-${currentMonthExportName}-report.csv`)}>
            <DownloadIcon size={14} /> Export CSV
          </motion.button>
        </div>
      </div>

      {/* SECTION 1 — KPI ROW (6 Interactive Actionable Tiles per 10/10 Specification) */}
      <div className="stats-kpi-grid">
        {/* TILE 1 — ACTIVE MEMBERS (Click -> Go to Members) */}
        <Rise i={0}>
          <motion.div
            role="button"
            tabIndex={0}
            aria-label={`ACTIVE MEMBERS: ${metrics.activeMembers.value}. ${metrics.activeMembers.deltaText}. Click to view details.`}
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.15 }}
            className="kpi-card interactive"
            onClick={() => navigate('/members')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('/members');
              }
            }}>
            <div className="kpi-card-top">
              <span className="kpi-label">ACTIVE MEMBERS</span>
              <span className="kpi-icon-wrap" style={{ background: '#DBEAFE', color: '#1E40AF' }}>
                <UsersIcon size={16} />
              </span>
            </div>
            <div className="kpi-value-row">
              <div className="kpi-value">
                <CountUp value={metrics.activeMembers.value} duration={0.8} />
              </div>
            </div>
            {/* FIX 3: If delta === 0, hide arrow and show last joined date in muted gray */}
            <div className="kpi-delta-row">
              {(metrics.activeMembers.newThisMonth || 0) > 0 ? (
                <span className="kpi-delta-badge success">
                  <TrendingUpIcon size={11} /> +{metrics.activeMembers.newThisMonth} registered
                </span>
              ) : (
                <span className="kpi-delta-caption muted" style={{ color: 'var(--text-3)' }}>
                </span>
              )}
            </div>
          </motion.div>
        </Rise>

        {/* TILE 2 — COLLECTED THIS MONTH (Click -> Go to Reports) */}
        <Rise i={1}>
          <motion.div
            role="button"
            tabIndex={0}
            aria-label={`${metrics.monthlyRevenue.label || 'COLLECTED THIS MONTH'}: ₹${metrics.monthlyRevenue.value.toLocaleString('en-IN')}. ${metrics.monthlyRevenue.deltaText}. Click to view details.`}
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.15 }}
            className="kpi-card interactive"
            onClick={() => navigate('/reports')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('/reports');
              }
            }}>
            <div className="kpi-card-top">
              {/* FIX 2: If current month has 0 payments yet, show last completed month e.g. COLLECTED · AUG 2026 */}
              <span className="kpi-label">{metrics.monthlyRevenue.label || 'COLLECTED THIS MONTH'}</span>
              <span className="kpi-icon-wrap" style={{ background: '#D1FAE5', color: '#065F46' }}>
                <RupeeIcon size={16} />
              </span>
            </div>
            <div className="kpi-value-row">
              <div className="kpi-value">
                <CountUp value={metrics.monthlyRevenue.value} duration={0.8} prefix="₹" />
              </div>
              {/* Miniature Inline 3-Bar Sparkline */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 24, width: 36, marginLeft: 'auto' }} title="Last 3 months collections">
                {sparklineBars.map((val, i) => (
                  <span
                    key={i}
                    style={{
                      flex: 1,
                      background: '#10B981',
                      borderRadius: '2px 2px 0 0',
                      height: `${Math.max(20, Math.min(100, Math.round((val / maxSparkline) * 100)))}%`,
                      opacity: i === sparklineBars.length - 1 ? 1 : 0.4 + i * 0.25,
                    }}
                  />
                ))}
              </div>
            </div>
            {/* FIX 2 & FIX 3: Show contextual delta text in muted gray if 0 or first month */}
            <div className="kpi-delta-row">
              {metrics.monthlyRevenue.diff !== 0 && !metrics.monthlyRevenue.isLastCompleted ? (
                <span className={`kpi-delta-badge ${metrics.monthlyRevenue.diff > 0 ? 'success' : 'danger'}`}>
                  {metrics.monthlyRevenue.diff > 0 && <TrendingUpIcon size={11} />}
                  {metrics.monthlyRevenue.deltaText}
                </span>
              ) : (
                <span className="kpi-delta-caption muted" style={{ color: 'var(--text-3)' }}>
                  {metrics.monthlyRevenue.deltaText || 'First month · all collected'}
                </span>
              )}
            </div>
          </motion.div>
        </Rise>

        {/* TILE 3 — DUES PENDING (Click -> Filter table to Unpaid dues) */}
        <Rise i={2}>
          <motion.div
            role="button"
            tabIndex={0}
            aria-label={`DUES PENDING: ${metrics.membersOwing.value}. ${metrics.membersOwing.deltaText}. Click to view details.`}
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.15 }}
            className="kpi-card interactive"
            style={{
              borderColor: metrics.membersOwing.value === 0 ? '#6EE7B7' : '#FCA5A5',
            }}
            animate={metrics.membersOwing.value > 0 ? { borderColor: ['#FCA5A5', '#EF4444', '#FCA5A5'] } : {}}
            onClick={() => navigate('/members?filter=owing')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('/members?filter=owing');
              }
            }}>
            <div className="kpi-card-top">
              <span className="kpi-label">DUES PENDING</span>
              <span
                className="kpi-icon-wrap"
                style={{
                  background: metrics.membersOwing.value === 0 ? '#D1FAE5' : '#FEE2E2',
                  color: metrics.membersOwing.value === 0 ? '#065F46' : '#991B1B',
                }}>
                {metrics.membersOwing.value === 0 ? <CheckCircleIcon size={16} /> : <AlertCircleIcon size={16} />}
              </span>
            </div>
            <div className="kpi-value-row">
              <div className="kpi-value">
                <CountUp value={metrics.membersOwing.value} duration={0.8} />
              </div>
            </div>
            <div className="kpi-delta-row">
              <span className={`kpi-delta-badge ${metrics.membersOwing.value === 0 ? 'success' : 'danger'}`}>
                {metrics.membersOwing.deltaText}
              </span>
            </div>
          </motion.div>
        </Rise>

        {/* TILE 4 — OUTSTANDING BALANCE (Click -> Go to Reports) */}
        <Rise i={3}>
          <motion.div
            role="button"
            tabIndex={0}
            aria-label={`OUTSTANDING BALANCE: ₹${metrics.totalOutstanding.value.toLocaleString('en-IN')}. ${metrics.totalOutstanding.deltaText}. Click to view details.`}
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.15 }}
            className="kpi-card interactive"
            onClick={() => navigate('/reports')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('/reports');
              }
            }}>
            <div className="kpi-card-top">
              <span className="kpi-label">OUTSTANDING BALANCE</span>
              <span
                className="kpi-icon-wrap"
                style={{
                  background: metrics.totalOutstanding.value === 0 ? '#D1FAE5' : '#FEF3C7',
                  color: metrics.totalOutstanding.value === 0 ? '#065F46' : '#92400E',
                }}>
                <ClockIcon size={16} />
              </span>
            </div>
            <div className="kpi-value-row">
              <div className="kpi-value">
                <CountUp value={metrics.totalOutstanding.value} duration={0.8} prefix="₹" />
              </div>
            </div>
            <div className="kpi-delta-row">
              <span className={`kpi-delta-caption ${metrics.totalOutstanding.value === 0 ? 'muted' : 'danger'}`} style={{ color: metrics.totalOutstanding.value > 0 ? 'var(--red)' : 'var(--text-3)' }}>
                {metrics.totalOutstanding.deltaText}
              </span>
            </div>
          </motion.div>
        </Rise>

        {/* TILE 5 — AVG MEMBER FEE (Click -> Open Fee Breakdown Popover) */}
        <Rise i={4}>
          <div style={{ position: 'relative', height: '100%' }}>
            <motion.div
              role="button"
              tabIndex={0}
              aria-label={`AVG MEMBER FEE: ₹${metrics.arpu.value.toLocaleString('en-IN')}. ${metrics.arpu.deltaText}. Click to view fee breakdown.`}
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.15 }}
              className="kpi-card interactive"
              onClick={() => setPopoverOpen(!popoverOpen)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setPopoverOpen(!popoverOpen);
                }
              }}>
              <div className="kpi-card-top">
                <span className="kpi-label">AVG MEMBER FEE</span>
                <span className="kpi-icon-wrap" style={{ background: '#EDE9FE', color: '#6D28D9' }}>
                  <TrendingUpIcon size={16} />
                </span>
              </div>
              <div className="kpi-value-row">
                <div className="kpi-value">
                  <CountUp value={metrics.arpu.value} duration={0.8} prefix="₹" />
                </div>
              </div>
              {/* FIX 3: Hide arrow and show in muted gray if diff === 0 */}
              <div className="kpi-delta-row">
                {metrics.arpu.diff !== 0 ? (
                  <span className={`kpi-delta-badge ${metrics.arpu.diff > 0 ? 'success' : 'danger'}`}>
                    {metrics.arpu.diff > 0 && <TrendingUpIcon size={11} />}
                    {metrics.arpu.deltaText}
                  </span>
                ) : (
                  <span className="kpi-delta-caption muted" style={{ color: 'var(--text-3)' }}>
                    {metrics.arpu.deltaText}
                  </span>
                )}
              </div>
            </motion.div>

            {/* Anchored Popover for Tile 5 */}
            <AnimatePresence>
              {popoverOpen && (
                <FeeBreakdownPopover
                  plans={metrics.arpu.planFeeBreakdown || []}
                  avgFee={metrics.arpu.value}
                  onClose={() => setPopoverOpen(false)}
                />
              )}
            </AnimatePresence>
          </div>
        </Rise>

        {/* TILE 6 — NEXT RENEWAL (Click -> Open Member Profile Slide-Over) */}
        {/* FIX 5: Next Renewal thresholds: >14d green, <=14d amber, <=3d red + pulse */}
        <Rise i={5}>
          {(() => {
            const renewalThreshold = getRenewalThreshold(metrics.nextRenewal.daysLeft);
            return (
              <motion.div
                role="button"
                tabIndex={0}
                aria-label={`NEXT RENEWAL: ${metrics.nextRenewal.value}. ${metrics.nextRenewal.deltaText}. Click to view details.`}
                whileHover={{ scale: 1.01 }}
                transition={{ duration: 0.15 }}
                className="kpi-card interactive"
                style={{
                  borderColor: renewalThreshold.borderColor,
                }}
                animate={renewalThreshold.pulse ? { borderColor: ['#EF4444', '#FCA5A5', '#EF4444'] } : {}}
                onClick={() => {
                  if (metrics.nextRenewal.memberId) {
                    setSlideOverMemberId(metrics.nextRenewal.memberId);
                  }
                  navigate('/members?sortBy=renewal_asc');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (metrics.nextRenewal.memberId) setSlideOverMemberId(metrics.nextRenewal.memberId);
                    navigate('/members?sortBy=renewal_asc');
                  }
                }}>
                <div className="kpi-card-top">
                  <span className="kpi-label">NEXT RENEWAL</span>
                  <span
                    className="kpi-icon-wrap"
                    style={{
                      background: renewalThreshold.bgSoft,
                      color: renewalThreshold.textColor,
                    }}>
                    <CalendarClockIcon size={16} />
                  </span>
                </div>
                <div className="kpi-value-row">
                  <div
                    className="kpi-value"
                    style={{
                      fontSize: 22,
                      color: renewalThreshold.color === 'red' ? 'var(--red)' : renewalThreshold.color === 'amber' ? 'var(--amber)' : 'var(--text)',
                    }}>
                    {metrics.nextRenewal.value}
                  </div>
                </div>
                <div className="kpi-delta-row">
                  <span
                    className="kpi-delta-badge"
                    style={{
                      color: renewalThreshold.textColor,
                      background: renewalThreshold.bgSoft,
                      fontWeight: 600,
                    }}>
                    {metrics.nextRenewal.deltaText}
                  </span>
                </div>
              </motion.div>
            );
          })()}
        </Rise>
      </div>

      {/* SECTION 2 — CHARTS ROW (60/40 Split: Grouped Bar Chart + Donut Chart) */}
      <div className="analytics-charts-grid">
        {/* LEFT — Revenue Trend Grouped Bar Chart */}
        <div className="analytics-card">
          <div className="card-header-row">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h3 className="analytics-card-title">Monthly Earnings</h3>
                <span className="gym-opened-badge">
                  <span style={{ color: '#10b981' }}>●</span> Gym opened {openedMonthName} {openedYear}
                </span>
              </div>
              <span className="analytics-card-subtitle">
                Collected vs. pending — {openedMonthName} {openedYear} onwards
              </span>
            </div>

            {/* Period Tabs: [3M | 6M | 1Y] */}
            <div className="period-tabs" role="tablist">
              {['3M', '6M', '1Y'].map((p) => (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={period === p}
                  className={`period-tab-btn${period === p ? ' active' : ''}`}
                  onClick={() => setPeriod(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="chart-canvas-container" style={{ height: 250 }}>
            <Bar data={barChartData} options={barChartOptions} />
          </div>
        </div>

        {/* RIGHT — Members by Plan Donut Chart */}
        <div className="analytics-card">
          <div className="card-header-row">
            <div>
              <h3 className="analytics-card-title">Members by Plan</h3>
              <span className="analytics-card-subtitle">Active membership distribution</span>
            </div>
            <span className="badge blue" style={{ fontSize: 11 }}>
              {metrics.activeMembers.value} Active
            </span>
          </div>

          <div style={{ position: 'relative', height: 165, marginTop: 8 }}>
            <Doughnut data={donutChartData} options={donutChartOptions} />
            <div className="donut-center-stat">
              <span className="donut-stat-number">{metrics.activeMembers.value}</span>
              <span className="donut-stat-label">ACTIVE</span>
            </div>
          </div>

          <div className="donut-legend-grid">
            {planDistribution.map((p, idx) => (
              <div key={p.name} className="donut-legend-item">
                <span className="donut-legend-dot" style={{ backgroundColor: getPlanColor(p.name, idx) }} />
                <span className="donut-legend-name">{p.name} · {p.count} member{p.count > 1 ? 's' : ''} · {formatINR(p.monthlyRevenue)}/mo</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 3 — BOTTOM ROW (60/40 Split: Members Table + Quick Actions Panel) */}
      <div className="bottom-row-grid">
        {/* LEFT (60%) — Members Table */}
        <div className="analytics-card">
          <div className="card-header-row">
            <div>
              <h3 className="analytics-card-title">Members Directory</h3>
              <span className="analytics-card-subtitle">Overview of plans, renewals, and collections</span>
            </div>

            <div className="row" style={{ gap: 8 }}>
              <div className="search-input-wrap" style={{ width: 160 }}>
                <input
                  type="search"
                  placeholder="Search name/phone…"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  style={{ height: 32, fontSize: 11.5 }}
                />
              </div>

              <select
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                style={{ height: 32, width: 120, fontSize: 11.5 }}>
                <option value="all">All ({membersTable.length})</option>
                <option value="active">Active</option>
                <option value="overdue">Overdue</option>
                <option value="due_soon">Due Soon</option>
              </select>
            </div>
          </div>

          <div className="analytics-table-wrap" style={{ marginTop: 6 }}>
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>MEMBER</th>
                  <th>PLAN</th>
                  <th>JOINED</th>
                  <th>NEXT RENEWAL</th>
                  <th style={{ textAlign: 'right' }}>AMOUNT PAID</th>
                  <th style={{ textAlign: 'right' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filteredTable.map((m, idx) => {
                  const pEnd = m.nextRenewal ? new Date(m.nextRenewal) : null;
                  const isOverdue = pEnd && pEnd <= new Date();
                  const isSoon = pEnd && !isOverdue && (pEnd - new Date()) / (1000 * 60 * 60 * 24) <= 14;

                  return (
                    /* Micro-interaction 7: Member table rows fade in staggered on load */
                    <motion.tr
                      key={m._id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.03 }}>
                      <td>
                        <div
                          className="table-member-cell"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSlideOverMemberId(m._id)}>
                          <Avatar name={m.name} />
                          <div>
                            <div className="table-member-name">{m.name}</div>
                            <div className="table-member-phone">{m.phone || 'No phone'}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`table-plan-pill ${getPlanPillClass(m.planName)}`}>
                          {m.planName}
                        </span>
                      </td>
                      <td className="small muted">
                        {new Date(m.joinDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                      </td>
                      <td>
                        {pEnd ? (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: isSoon || isOverdue ? 600 : 400,
                              color: isOverdue ? 'var(--red)' : isSoon ? 'var(--amber)' : 'var(--text-3)',
                            }}>
                            {pEnd.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                          </span>
                        ) : (
                          <span className="muted small">—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {formatRupees(m.amountPaid)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {/* Micro-interaction 4: Status badges pulse once on load when Due Soon or Overdue */}
                        {m.statusBadge === 'overdue' && (
                          <span className="badge red badge-pulse-once">
                            <span className="badge-dot" /> Overdue
                          </span>
                        )}
                        {m.statusBadge === 'due_soon' && (
                          <span className="badge amber badge-pulse-once">
                            <span className="badge-dot" /> Due Soon
                          </span>
                        )}
                        {m.statusBadge === 'paid' && (
                          <span className="badge green">
                            <span className="badge-dot" /> Active
                          </span>
                        )}
                        {m.statusBadge === 'paused' && <span className="badge gray">Paused</span>}
                        {m.statusBadge === 'left' && <span className="badge gray">Left</span>}
                      </td>
                    </motion.tr>
                  );
                })}

                {!filteredTable.length && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-3)' }}>
                      No members matching filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Contextual Insight Banner Below Table */}
          {nearestMember && (
            <div className="insight-banner">
              <div className="insight-banner-text">
                <span>💡</span>
                <span>
                  {nearestDays !== null && nearestDays <= 14 ? (
                    <>
                      <b>{nearestMember.name}’s</b> membership renews in <b>{nearestDays <= 0 ? 'today' : nearestDays === 1 ? '1 day' : `${nearestDays} days`}</b>. Send a reminder to avoid a lapse.
                    </>
                  ) : (
                    <>
                      Next upcoming renewal is <b>{nearestMember.name}</b> on <b>{new Date(nearestMember.nextRenewal).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</b> ({nearestDays} days away).
                    </>
                  )}
                </span>
              </div>
              <button
                type="button"
                className="insight-banner-link"
                onClick={() => setReminderModal({ member: nearestMember })}>
                Send reminder →
              </button>
            </div>
          )}
        </div>

        {/* RIGHT (40%) — Quick Actions Panel */}
        <div className="analytics-card">
          <div className="card-header-row" style={{ marginBottom: 12 }}>
            <div>
              <h3 className="analytics-card-title">Quick actions</h3>
              <span className="analytics-card-subtitle">Common operations and notifications</span>
            </div>
          </div>

          <div className="quick-actions-panel-list">
            {/* Micro-interaction 3: Quick action cards scale to 1.01 on hover */}
            {/* Action 1: Send Renewal Reminder */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setReminderModal({ member: nearestMember || membersTable[0] })}>
              <span className="quick-action-icon-box amber">
                <SendIcon size={17} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="quick-action-title">Send renewal reminder</div>
                <div className="quick-action-sub">Draft a WhatsApp / SMS message</div>
              </div>
              <ChevronIcon size={14} style={{ color: 'var(--text-muted)' }} />
            </motion.div>

            {/* Action 2: Add New Member */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="quick-action-item"
              onClick={() => setAddModalOpen(true)}>
              <span className="quick-action-icon-box blue">
                <UserPlusIcon size={17} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="quick-action-title">Add new member</div>
                <div className="quick-action-sub">Assign plan, set renewal date</div>
              </div>
              <ChevronIcon size={14} style={{ color: 'var(--text-muted)' }} />
            </motion.div>

            {/* Action 3: Export Monthly Report */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="quick-action-item"
              onClick={() => download(`/businesses/${biz._id}/export/payments.csv`, `${biz.name}-${currentMonthExportName}-report.csv`)}>
              <span className="quick-action-icon-box green">
                <FileSpreadsheetIcon size={17} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="quick-action-title">Export monthly report</div>
                <div className="quick-action-sub">Download {currentMonthExportName} CSV</div>
              </div>
              <DownloadIcon size={14} style={{ color: 'var(--text-muted)' }} />
            </motion.div>

            {/* Action 4: Bulk Reminder */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="quick-action-item"
              onClick={() => setBulkReminderOpen(true)}>
              <span className="quick-action-icon-box purple">
                <BellIcon size={17} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="quick-action-title">Bulk reminder</div>
                <div className="quick-action-sub">
                  {dueWithin7Days.length > 0 ? `${dueWithin7Days.length} member${dueWithin7Days.length > 1 ? 's' : ''} due this week` : 'Notify all members due this week'}
                </div>
              </div>
              <ChevronIcon size={14} style={{ color: 'var(--text-muted)' }} />
            </motion.div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Add Member Modal */}
      <AnimatePresence>
        {addModalOpen && (
          <div className="modal-overlay" onClick={() => setAddModalOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 14 }}
              transition={{ duration: 0.2 }}
              className="modal-content"
              style={{ maxWidth: 560 }}
              onClick={(e) => e.stopPropagation()}>
              <div className="form-header" style={{ marginBottom: 16 }}>
                <div className="form-title">
                  <UserIcon size={18} style={{ color: 'var(--primary)' }} />
                  <span>Add New Member</span>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setAddModalOpen(false)}>
                </button>
              </div>

              <AddMemberForm
                plans={plans || []}
                busy={addMember.isPending}
                onClose={() => setAddModalOpen(false)}
                onSubmit={(form) => addMember.mutate(form)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Send Reminder Modal */}
      <AnimatePresence>
        {reminderModal && (
          <div className="modal-overlay" onClick={() => setReminderModal(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 14 }}
              transition={{ duration: 0.2 }}
              className="modal-content"
              style={{ maxWidth: 520 }}
              onClick={(e) => e.stopPropagation()}>
              <div className="form-header" style={{ marginBottom: 14 }}>
                <div className="form-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <SendIcon size={17} style={{ color: '#F59E0B' }} />
                  <span>Send Renewal Reminder</span>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setReminderModal(null)}>
                  <XIcon size={14} />
                </button>
              </div>

              <SendReminderDialog
                biz={biz}
                member={reminderModal.member}
                membersList={membersTable}
                onClose={() => setReminderModal(null)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: Bulk Reminder Modal */}
      <AnimatePresence>
        {bulkReminderOpen && (
          <div className="modal-overlay" onClick={() => setBulkReminderOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 14 }}
              transition={{ duration: 0.2 }}
              className="modal-content"
              style={{ maxWidth: 540 }}
              onClick={(e) => e.stopPropagation()}>
              <div className="form-header" style={{ marginBottom: 14 }}>
                <div className="form-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BellIcon size={17} style={{ color: '#8B5CF6' }} />
                  <span>Bulk Renewal Reminders</span>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setBulkReminderOpen(false)}>
                  <XIcon size={14} />
                </button>
              </div>

              <div style={{ marginBottom: 16 }}>
                {dueWithin7Days.length > 0 ? (
                  <>
                    <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 12px' }}>
                      Members due for renewal in the next 7 days ({dueWithin7Days.length}):
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                      {dueWithin7Days.map((m) => {
                        const d = new Date(m.nextRenewal);
                        const daysLeft = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
                        return (
                          <div key={m._id} className="card row" style={{ padding: '9px 12px', alignItems: 'center', border: '1px solid var(--border)' }}>
                            <Avatar name={m.name} />
                            <div className="grow" style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 500, fontSize: 13 }}>{m.name}</div>
                              <div className="muted small">
                                {m.phone || 'No phone'} · Due: {d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} ({daysLeft === 0 ? 'Today' : `${daysLeft}d left`})
                              </div>
                            </div>
                            {m.phone && (
                              <a
                                className="btn wa"
                                target="_blank"
                                rel="noreferrer"
                                style={{ minHeight: 28, padding: '3px 9px', fontSize: 11.5 }}
                                href={waLink(m.phone, `Hi ${m.name}, your membership at ${biz.name} expires on ${d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}. Renew now to keep your streak going! Reply to confirm.`)}>
                                <WhatsAppIcon size={13} /> Remind
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '18px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-card)', marginBottom: 14 }}>
                    <CheckCircleIcon size={28} style={{ color: 'var(--green)', margin: '0 auto 6px', display: 'block' }} />
                    <div style={{ fontWeight: 500, fontSize: 13.5 }}>All Active Members Up to Date</div>
                    <div className="muted small" style={{ marginTop: 3 }}>
                      No subscriptions are due for renewal within the next 7 days.
                    </div>
                  </div>
                )}

                {/* All upcoming active memberships */}
                {activeWithRenewal.length > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    <div className="label-caps" style={{ marginBottom: 8 }}>
                      All Upcoming Renewal Dates ({activeWithRenewal.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                      {activeWithRenewal.map((m) => {
                        const d = new Date(m.nextRenewal);
                        const daysLeft = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
                        return (
                          <div key={m._id} className="row" style={{ padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-btn)', alignItems: 'center', fontSize: 12 }}>
                            <span style={{ fontWeight: 500, flex: 1 }}>{m.name}</span>
                            <span className="muted" style={{ marginRight: 8 }}>
                              {d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} ({daysLeft}d away)
                            </span>
                            {m.phone && (
                              <a
                                className="btn-secondary"
                                target="_blank"
                                rel="noreferrer"
                                style={{ minHeight: 24, padding: '2px 7px', fontSize: 11 }}
                                href={waLink(m.phone, `Hi ${m.name}, your membership at ${biz.name} expires on ${d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}. Renew now to keep your streak going!`)}>
                                <WhatsAppIcon size={12} /> Message
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn-secondary" onClick={() => setBulkReminderOpen(false)}>
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Slide-over Profile Sheet */}
      <AnimatePresence>
        {slideOverMemberId && (
          <MemberProfileSheet
            biz={biz}
            memberId={slideOverMemberId}
            plans={plans || []}
            onClose={() => setSlideOverMemberId(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// Add Member Form with strict 10-digit validation and auto-fill Fee
function AddMemberForm({ plans, busy, onClose, onSubmit }) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    planId: plans[0]?._id || '',
    startDate: new Date().toISOString().slice(0, 10),
  });
  const [errors, setErrors] = useState({});

  const selectedPlan = plans.find((p) => p._id === form.planId) || plans[0];

  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setForm({ ...form, phone: val });
    if (errors.phone) setErrors({ ...errors, phone: '' });
  };

  const handlePlanChange = (e) => {
    setForm({ ...form, planId: e.target.value });
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Full name is required';
    if (!form.phone.trim()) {
      errs.phone = 'Phone number is required';
    } else if (form.phone.length !== 10) {
      errs.phone = 'Phone must be exactly 10 digits';
    }
    if (!form.planId) errs.planId = 'Please select a membership plan';
    if (!form.startDate) errs.startDate = 'Start date is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(form);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid two-col">
        <div>
          <Field label="Full Name *" icon={UserIcon}>
            <input
              placeholder="e.g. Rahul Sharma"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                if (errors.name) setErrors({ ...errors, name: '' });
              }}
            />
          </Field>
          {errors.name && <span className="small red-text" style={{ marginTop: 3, display: 'block' }}>{errors.name}</span>}
        </div>

        <div>
          <Field label="Mobile Phone Number (10 digits) *" icon={PhoneIcon} hint="Used for WhatsApp reminders">
            <input
              type="tel"
              inputMode="numeric"
              placeholder="9876543210"
              value={form.phone}
              onChange={handlePhoneChange}
            />
          </Field>
          {errors.phone && <span className="small red-text" style={{ marginTop: 3, display: 'block' }}>{errors.phone}</span>}
        </div>

        <div>
          <Field label="Membership Plan *" icon={CreditCardIcon}>
            <select value={form.planId} onChange={handlePlanChange}>
              {plans.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} — {rupees(p.amount)} ({p.cycleDays} days)
                </option>
              ))}
            </select>
          </Field>
          {errors.planId && <span className="small red-text" style={{ marginTop: 3, display: 'block' }}>{errors.planId}</span>}
        </div>

        <div>
          <Field label="Membership Start Date *" icon={CalendarIcon}>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </Field>
          {errors.startDate && <span className="small red-text" style={{ marginTop: 3, display: 'block' }}>{errors.startDate}</span>}
        </div>
      </div>

      {/* Auto-filled Fee Display */}
      {selectedPlan && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-btn)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="small muted">Membership Fee</span>
          <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13.5 }}>
            {rupees(selectedPlan.amount)} <span className="small muted">/ {selectedPlan.cycleDays} days</span>
          </span>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button
          disabled={busy}
          style={{ width: '100%', justifyContent: 'center', background: 'var(--primary)' }}>
          <CheckIcon size={15} />
          {busy ? 'Saving member…' : 'Save member'}
        </button>
      </div>
    </form>
  );
}

// Send Reminder Modal Component
function SendReminderDialog({ biz, member, membersList = [], onClose }) {
  const [selectedMemberId, setSelectedMemberId] = useState(member?._id || membersList[0]?._id);
  const currentMember = membersList.find((m) => m._id === selectedMemberId) || member;
  const [copied, setCopied] = useState(false);

  const expDate = currentMember?.nextRenewal
    ? new Date(currentMember.nextRenewal).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : '23 Sep 2026';

  const defaultMsg = `Hi ${currentMember?.name || 'Member'}, your membership at ${biz.name} expires on ${expDate}. Renew now to keep your streak going! Reply to confirm.`;
  const [message, setMessage] = useState(defaultMsg);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const waUrl = currentMember?.phone
    ? `https://wa.me/91${currentMember.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
    : null;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label className="input-label" style={{ marginBottom: 4, display: 'block' }}>Select Member</label>
        <select
          value={selectedMemberId}
          onChange={(e) => {
            setSelectedMemberId(e.target.value);
            const m = membersList.find((mem) => mem._id === e.target.value);
            const d = m?.nextRenewal ? new Date(m.nextRenewal).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Soon';
            setMessage(`Hi ${m?.name || 'Member'}, your membership at ${biz.name} expires on ${d}. Renew now to keep your streak going! Reply to confirm.`);
          }}
          style={{ height: 36 }}>
          {membersList.map((m) => (
            <option key={m._id} value={m._id}>
              {m.name} ({m.phone || 'No phone'}) — Due: {m.nextRenewal ? new Date(m.nextRenewal).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'No date'}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label className="input-label" style={{ marginBottom: 4, display: 'block' }}>Reminder Message (Editable)</label>
        <textarea
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{ height: 'auto', padding: 10, fontSize: 13, resize: 'vertical' }}
        />
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={handleCopy}
          style={{ minHeight: 34, fontSize: 12 }}>
          <CopyIcon size={14} />
          {copied ? '✓ Copied!' : 'Copy to clipboard'}
        </button>

        {waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="btn wa"
            style={{ minHeight: 34, fontSize: 12, padding: '6px 14px' }}>
            <WhatsAppIcon size={14} /> Open WhatsApp
          </a>
        ) : (
          <button disabled className="btn wa" style={{ minHeight: 34, fontSize: 12 }}>
            No Phone Number
          </button>
        )}
      </div>
    </div>
  );
}
