import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api, rupees, waLink, remindMsg } from '../api.js';
import { useBiz } from '../App.jsx';
import {
  formatINR,
  formatRupees,
  getRenewalThreshold,
  getPlanColor,
  getPlanPillClass,
  getMonthlyDelta,
} from '../data/gymData.js';
import {
  Avatar, Empty, Field, Rise, CountUp, PlusIcon, SearchIcon, XIcon,
  ChevronIcon, UsersIcon, UserIcon, PhoneIcon, CreditCardIcon, RupeeIcon,
  CalendarIcon, BedIcon, TagIcon, WhatsAppIcon, CheckIcon, AlertIcon,
  AlertCircleIcon, CheckCircleIcon, SendIcon, EditIcon, TrashIcon,
  CopyIcon, ClockIcon, CalendarClockIcon, SlidersHorizontalIcon, FilterIcon,
} from '../ui.jsx';

export default function Members() {
  const biz = useBiz();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();

  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(() => searchParams.get('filter') || 'all'); // 'all' | 'owing' | 'soon' | 'clear' | 'left'
  const [planFilter, setPlanFilter] = useState('all');
  const [renewalFilter, setRenewalFilter] = useState(() => searchParams.get('renewal') || searchParams.get('renewalFilter') || 'all'); // 'all' | '7d' | '15d' | '30d' | 'overdue'
  const [groupFilter, setGroupFilter] = useState('all');
  const [sortBy, setSortBy] = useState(() => searchParams.get('sortBy') || searchParams.get('sort') || 'renewal_asc'); // 'renewal_asc' | 'joined_desc' | 'name_asc' | 'balance_desc'

  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [collectModal, setCollectModal] = useState(null);
  const [reminderModal, setReminderModal] = useState(null);

  useEffect(() => {
    const f = searchParams.get('filter');
    if (f) setFilter(f);
    const s = searchParams.get('sortBy') || searchParams.get('sort');
    if (s) setSortBy(s);
    const r = searchParams.get('renewal') || searchParams.get('renewalFilter');
    if (r) setRenewalFilter(r);
  }, [searchParams]);

  const { data: members } = useQuery({
    queryKey: ['members', biz._id],
    queryFn: () => api(`/businesses/${biz._id}/members`),
  });

  const { data: plans } = useQuery({
    queryKey: ['plans', biz._id],
    queryFn: () => api(`/businesses/${biz._id}/plans`),
  });

  const { data: groups } = useQuery({
    queryKey: ['groups', biz._id],
    queryFn: () => api(`/businesses/${biz._id}/groups`),
  });

  const { data: rooms } = useQuery({
    queryKey: ['rooms', biz._id],
    queryFn: () => api(`/businesses/${biz._id}/rooms`),
    enabled: biz.type === 'hostel',
  });

  const add = useMutation({
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
      setAdding(false);
    },
  });

  const now = new Date();
  const filterCounts = {
    all: (members || []).length,
    owing: (members || []).filter((m) => m.status === 'active' && m.balance > 0).length,
    soon: (members || []).filter((m) => {
      if (m.status !== 'active' || !m.nextRenewal) return false;
      const diff = Math.ceil((new Date(m.nextRenewal) - now) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 7;
    }).length,
    clear: (members || []).filter((m) => m.status === 'active' && m.balance <= 0).length,
    left: (members || []).filter((m) => m.status === 'left').length,
  };

  const isFilterActive = Boolean(
    q ||
    filter !== 'all' ||
    planFilter !== 'all' ||
    renewalFilter !== 'all' ||
    groupFilter !== 'all' ||
    sortBy !== 'renewal_asc'
  );

  const resetAllFilters = () => {
    setQ('');
    setFilter('all');
    setPlanFilter('all');
    setRenewalFilter('all');
    setGroupFilter('all');
    setSortBy('renewal_asc');
  };

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const currTime = new Date();

    return (members || [])
      .filter((m) => {
        // Search by name, phone, or plan
        if (query) {
          const matchName = (m.name || '').toLowerCase().includes(query);
          const matchPhone = (m.phone || '').includes(query);
          const matchPlan = (m.planName || m.planId?.name || '').toLowerCase().includes(query);
          if (!matchName && !matchPhone && !matchPlan) return false;
        }

        // Primary status tab filter
        if (filter === 'owing') {
          if (m.status !== 'active' || m.balance <= 0) return false;
        } else if (filter === 'soon') {
          if (m.status !== 'active' || !m.nextRenewal) return false;
          const diff = Math.ceil((new Date(m.nextRenewal) - currTime) / (1000 * 60 * 60 * 24));
          if (diff < 0 || diff > 7) return false;
        } else if (filter === 'clear') {
          if (m.status !== 'active' || m.balance > 0) return false;
        } else if (filter === 'left') {
          if (m.status !== 'left') return false;
        }

        // Plan filter
        if (planFilter !== 'all') {
          const pName = (m.planName || m.planId?.name || '').toLowerCase();
          if (!pName.includes(planFilter.toLowerCase())) return false;
        }

        // Group / Batch filter
        if (groupFilter !== 'all') {
          const gId = m.groupId?._id || m.groupId;
          if (gId !== groupFilter) return false;
        }

        // Renewal timeframe filter
        if (renewalFilter !== 'all') {
          if (!m.nextRenewal) return false;
          const diff = Math.ceil((new Date(m.nextRenewal) - currTime) / (1000 * 60 * 60 * 24));
          if (renewalFilter === '7d' && (diff < 0 || diff > 7)) return false;
          if (renewalFilter === '15d' && (diff < 0 || diff > 15)) return false;
          if (renewalFilter === '30d' && (diff < 0 || diff > 30)) return false;
          if (renewalFilter === 'overdue' && diff >= 0) return false;
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
          return new Date(b.joinDate) - new Date(a.joinDate);
        }
        if (sortBy === 'name_asc') {
          return (a.name || '').localeCompare(b.name || '');
        }
        if (sortBy === 'balance_desc') {
          return (b.balance || 0) - (a.balance || 0);
        }
        return 0;
      });
  }, [members, q, filter, planFilter, renewalFilter, groupFilter, sortBy]);

  const totalOwingAmount = (members || [])
    .filter((m) => m.status === 'active' && m.balance > 0)
    .reduce((sum, m) => sum + m.balance, 0);

  // FIX 3: Calculate members renewing in next 30 days
  const upcomingRenewals = (members || [])
    .filter((m) => {
      if (m.status !== 'active' || !m.nextRenewal) return false;
      const diffDays = Math.ceil((new Date(m.nextRenewal) - now) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 30;
    })
    .sort((a, b) => new Date(a.nextRenewal) - new Date(b.nextRenewal));

  const getPlanPillClass = (name) => {
    const n = (name || '').toLowerCase();
    if (n.includes('month') && !n.includes('3') && !n.includes('6') && !n.includes('12')) return 'blue';
    if (n.includes('3 month') || n.includes('quarter')) return 'green';
    if (n.includes('6 month') || n.includes('half')) return 'amber';
    return 'purple';
  };

  const hasRooms = Boolean(rooms && rooms.length > 0);

  if (!members) {
    return (
      <div aria-hidden="true">
        <div className="compact-stat-grid" style={{ marginBottom: 16 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="card skeleton" style={{ minHeight: 90 }} />
          ))}
        </div>
        <div className="card skeleton" style={{ minHeight: 340 }} />
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-wrap">
          <h1 className="page-title">
            Members Directory
          </h1>
          {/* FIX 4: Updated subtitle without room allocations */}
          <p className="page-subtitle">
            Manage your active members, subscriptions, renewal dates, and balance dues.
          </p>
        </div>
        <div className="page-actions">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setAdding(true)}
            className="btn">
            <PlusIcon size={15} /> Add New Member
          </motion.button>
        </div>
      </div>

      {/* 3-Column Compact KPI Stats Grid */}
      <div className="compact-stat-grid">
        {/* Tile 1 — Total Members */}
        <Rise i={0}>
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`compact-stat-card ${filter === 'all' ? 'active' : ''}`}
            title="Click to view all members"
            onClick={() => setFilter('all')}>
            <span className="compact-stat-icon blue"><UsersIcon size={16} /></span>
            <div className="compact-stat-content">
              <span className="compact-stat-label">TOTAL MEMBERS</span>
              <div className="compact-stat-val-row">
                <span className="compact-stat-val">
                  <CountUp value={filterCounts.all} duration={0.8} />
                </span>
                <span className="compact-stat-badge">registered</span>
              </div>
            </div>
          </motion.div>
        </Rise>

        {/* Tile 2 — Unpaid Dues */}
        <Rise i={1}>
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`compact-stat-card ${filter === 'owing' ? 'active' : ''}`}
            title="Click to view unpaid members"
            onClick={() => setFilter('owing')}>
            <span className={`compact-stat-icon ${totalOwingAmount > 0 ? 'red' : 'green'}`}>
              {totalOwingAmount > 0 ? <AlertIcon size={16} /> : <CheckCircleIcon size={16} />}
            </span>
            <div className="compact-stat-content">
              <span className="compact-stat-label">UNPAID DUES</span>
              <div className="compact-stat-val-row">
                <span className="compact-stat-val" style={{ color: totalOwingAmount > 0 ? 'var(--red)' : undefined }}>
                  <CountUp value={totalOwingAmount} duration={0.8} prefix="₹" />
                </span>
                <span className={`compact-stat-badge ${totalOwingAmount > 0 ? 'danger' : 'success'}`}>
                  {totalOwingAmount > 0 ? `${filterCounts.owing} pending` : '✓ All dues cleared'}
                </span>
              </div>
            </div>
          </motion.div>
        </Rise>

        {/* Tile 3 — Paid Up */}
        <Rise i={2}>
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`compact-stat-card ${filter === 'clear' ? 'active' : ''}`}
            title="Click to view paid-up members"
            onClick={() => setFilter('clear')}>
            <span className="compact-stat-icon green"><CheckIcon size={16} /></span>
            <div className="compact-stat-content">
              <span className="compact-stat-label">PAID UP</span>
              <div className="compact-stat-val-row">
                <span className="compact-stat-val" style={{ color: 'var(--green)' }}>
                  <CountUp value={filterCounts.clear} duration={0.8} />
                </span>
                <span className="compact-stat-badge success">all fees cleared</span>
              </div>
            </div>
          </motion.div>
        </Rise>
      </div>

      {/* Add Member Modal Dialog */}
      <AnimatePresence>
        {adding && (
          <div className="modal-overlay" onClick={() => setAdding(false)}>
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
                  <span>Register New Member</span>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setAdding(false)}>
                  <XIcon size={14} />
                </button>
              </div>

              {add.error && (
                <div className="card" style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
                  {add.error.message}
                </div>
              )}

              <AddMemberForm
                plans={plans || []}
                groups={groups || []}
                rooms={rooms || []}
                onClose={() => setAdding(false)}
                onSubmit={(f) => add.mutate(f)}
                busy={add.isPending}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Filter & Search Toolbar */}
      {members.length > 0 && (
        <div className="members-toolbar-card">
          <div className="filters-left-group">
            {/* Search Input on the Left */}
            <div className="search-input-wrap members-search" style={{ width: 250, minWidth: 180 }}>
              <SearchIcon size={14} className="search-icon" />
              <input
                type="search"
                placeholder="Search name, phone, plan…"
                aria-label="Search members"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ height: 32, fontSize: 12 }}
              />
              {q && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setQ('')}
                  aria-label="Clear search">
                  <XIcon size={13} />
                </button>
              )}
            </div>

            {/* Plan Filter Dropdown */}
            <div className="filter-select-item" title="Filter by membership plan">
              <CreditCardIcon size={13} className="filter-select-icon" />
              <select
                className="filter-select-input"
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}>
                <option value="all">All Plans</option>
                {(plans || []).map((p) => (
                  <option key={p._id} value={p.name}>
                    {p.name} ({rupees(p.amount)})
                  </option>
                ))}
              </select>
            </div>

            {/* Renewal Window Filter Dropdown */}
            <div className="filter-select-item" title="Filter by renewal timeframe">
              <CalendarClockIcon size={13} className="filter-select-icon" />
              <select
                className="filter-select-input"
                value={renewalFilter}
                onChange={(e) => setRenewalFilter(e.target.value)}>
                <option value="all">All Renewal Dates</option>
                <option value="7d">Renewing in ≤ 7 days</option>
                <option value="15d">Renewing in ≤ 15 days</option>
                <option value="30d">Renewing in ≤ 30 days</option>
                <option value="overdue">Overdue Renewals</option>
              </select>
            </div>

            {/* Sort By Dropdown */}
            <div className="filter-select-item" title="Sort members table">
              <SlidersHorizontalIcon size={13} className="filter-select-icon" />
              <select
                className="filter-select-input"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}>
                <option value="renewal_asc">Renewal: Soonest first</option>
                <option value="joined_desc">Joined: Newest first</option>
                <option value="name_asc">Name: A → Z</option>
                <option value="balance_desc">Balance: Highest first</option>
              </select>
            </div>

            {/* Group / Batch Filter (if business has groups) */}
            {(groups || []).length > 0 && (
              <div className="filter-select-item" title="Filter by group/batch">
                <TagIcon size={13} className="filter-select-icon" />
                <select
                  className="filter-select-input"
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}>
                  <option value="all">All Groups</option>
                  {groups.map((g) => (
                    <option key={g._id} value={g._id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Reset All Filters Button */}
            {isFilterActive && (
              <button
                type="button"
                className="filter-reset-btn"
                onClick={resetAllFilters}
                title="Clear all active filters and search">
                <XIcon size={12} /> Reset filters
              </button>
            )}
          </div>

          {/* Results count text on the Right */}
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            Showing <b style={{ color: 'var(--text)' }}>{filtered.length}</b> of <b style={{ color: 'var(--text)' }}>{members.length}</b> members
          </div>
        </div>
      )}

      {!members.length && !adding && (
        <Empty
          icon={UsersIcon}
          title="No members registered yet"
          hint="Add your first member to start managing memberships and tracking payments."
          action={
            <button className="btn" onClick={() => setAdding(true)}>
              <PlusIcon size={15} /> Add First Member
            </button>
          }
        />
      )}

      {members.length > 0 && !filtered.length && (
        <Empty
          icon={filter === 'owing' ? CheckCircleIcon : filter === 'clear' ? CheckIcon : SearchIcon}
          title={
            filter === 'owing'
              ? 'No Unpaid Dues'
              : filter === 'clear'
              ? 'No Paid Up Members'
              : filter === 'left'
              ? 'No Inactive Members'
              : 'No matching members'
          }
          hint={
            q
              ? `Nobody matches search query “${q}”.`
              : filter === 'owing'
              ? 'All active members have cleared their membership fees. No pending balances.'
              : filter === 'clear'
              ? 'No members currently have a zero balance.'
              : filter === 'left'
              ? 'No members have left yet.'
              : 'No members found in this filter category.'
          }
          action={
            isFilterActive ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={resetAllFilters}>
                View All Members ({filterCounts.all})
              </button>
            ) : null
          }
        />
      )}

      {/* Modern Data Table for Members */}
      {filtered.length > 0 && (
        <div className="analytics-card" style={{ padding: '0 16px 10px', marginBottom: 16 }}>
          <div className="analytics-table-wrap">
            <table className="analytics-table members-table">
              <thead>
                <tr>
                  <th>MEMBER</th>
                  <th>{hasRooms ? 'PLAN / ROOM' : 'PLAN'}</th>
                  <th>JOINED</th>
                  <th>NEXT RENEWAL</th>
                  <th style={{ textAlign: 'right' }}>BALANCE</th>
                  <th style={{ textAlign: 'right' }}>STATUS</th>
                  <th style={{ textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, idx) => {
                  const planName = m.planName || m.planId?.name || (m.roomId ? `Room ${m.roomId.roomNo}` : 'Standard Plan');
                  const pEnd = m.nextRenewal ? new Date(m.nextRenewal) : null;
                  const diffDays = pEnd ? Math.ceil((pEnd - new Date()) / (1000 * 60 * 60 * 24)) : null;
                  const isOverdue = m.balance > 0 || (diffDays !== null && diffDays < 0);
                  const isSoon = !isOverdue && diffDays !== null && diffDays >= 0 && diffDays <= 7;

                  return (
                    <motion.tr
                      key={m._id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.03 }}>
                      <td>
                        {/* FIX 1: Clicking avatar or name opens MemberProfileSheet */}
                        <div
                          className="table-member-cell"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSelectedMemberId(m._id)}>
                          <Avatar name={m.name} />
                          <div>
                            <div className="table-member-name">{m.name}</div>
                            <div className="table-member-phone">{m.phone || 'No phone'}</div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className={`table-plan-pill ${getPlanPillClass(planName)}`}>
                          {planName}
                        </span>
                      </td>

                      <td className="small muted">
                        {new Date(m.joinDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>

                      <td>
                        {pEnd ? (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: isSoon || isOverdue ? 600 : 400,
                              color: isOverdue ? 'var(--red)' : isSoon ? 'var(--amber)' : 'var(--text-3)',
                            }}>
                            {pEnd.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        ) : (
                          <span className="muted small">—</span>
                        )}
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {m.balance > 0 ? (
                          <span style={{ color: 'var(--red)' }}>₹{m.balance.toLocaleString('en-IN')} Due</span>
                        ) : (
                          <span style={{ color: 'var(--green)' }}>₹0 Due</span>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        {m.balance > 0 ? (
                          <span className="badge red badge-pulse-once">
                            <span className="badge-dot" /> Overdue
                          </span>
                        ) : m.status === 'left' ? (
                          <span className="badge gray">Left</span>
                        ) : (
                          <span className="badge green">
                            <span className="badge-dot" /> Paid Up
                          </span>
                        )}
                      </td>

                      {/* FIX 2: Action column changes by status */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                          {isOverdue && (
                            <button
                              type="button"
                              className="btn"
                              style={{
                                background: 'var(--green)',
                                color: '#FFFFFF',
                                fontSize: 11,
                                padding: '3px 8px',
                                minHeight: 26,
                              }}
                              onClick={() => setCollectModal({ member: m, balance: m.balance > 0 ? m.balance : m.planAmount })}>
                              <CheckIcon size={11} /> Collect ₹{(m.balance > 0 ? m.balance : m.planAmount || 1500).toLocaleString('en-IN')}
                            </button>
                          )}

                          {isSoon && (
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{
                                fontSize: 11,
                                padding: '3px 8px',
                                minHeight: 26,
                                borderColor: 'var(--amber-border)',
                                color: 'var(--amber)',
                              }}
                              onClick={() =>
                                setReminderModal({
                                  member: m,
                                  balance: m.balance,
                                  nextRenewalDate: pEnd,
                                })
                              }>
                              <SendIcon size={11} /> Send reminder
                            </button>
                          )}

                          {/* FIX 1: View → opens Sheet */}
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setSelectedMemberId(m._id)}
                            style={{ minHeight: 26, padding: '3px 8px', fontSize: 11 }}>
                            View →
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FIX 3 — SECTION: Upcoming Renewals (Next 30 Days) */}
      <div className="analytics-card" style={{ marginBottom: 16 }}>
        <div className="card-header-row" style={{ marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 className="analytics-card-title">Upcoming Renewals</h3>
              <span className="badge blue" style={{ fontSize: 11 }}>Next 30 Days</span>
            </div>
            <span className="analytics-card-subtitle">
              Members due for subscription renewal in the coming month
            </span>
          </div>
        </div>

        {upcomingRenewals.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 12,
            }}>
            {upcomingRenewals.map((m) => {
              const pEnd = new Date(m.nextRenewal);
              const diffDays = Math.ceil((pEnd - new Date()) / (1000 * 60 * 60 * 24));
              const daysLabel = diffDays <= 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : `in ${diffDays} days`;
              const badgeClass = diffDays <= 1 ? 'red' : diffDays <= 7 ? 'amber' : 'green';

              return (
                <div
                  key={m._id}
                  className="renewal-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                      onClick={() => setSelectedMemberId(m._id)}>
                      <Avatar name={m.name} size={32} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{m.phone || 'No phone'}</div>
                      </div>
                    </div>
                    <span className={`badge ${badgeClass}`} style={{ fontSize: 10.5, padding: '2px 8px' }}>
                      {daysLabel}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>
                      <span>{pEnd.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</span>
                      <span className="muted" style={{ margin: '0 4px' }}>·</span>
                      <span className={`table-plan-pill ${getPlanPillClass(m.planName)}`} style={{ fontSize: 10.5, padding: '1px 6px' }}>
                        {m.planName}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="btn-secondary"
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        minHeight: 26,
                        borderColor: 'var(--amber-border)',
                        color: 'var(--amber)',
                      }}
                      onClick={() =>
                        setReminderModal({
                          member: m,
                          balance: m.balance,
                          nextRenewalDate: pEnd,
                        })
                      }>
                      <SendIcon size={11} /> Send reminder
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '28px 16px', background: 'var(--bg-subtle)', borderRadius: 8 }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>🎉</div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>No renewals in next 30 days 🎉</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              All active member subscriptions are paid and up-to-date.
            </div>
          </div>
        )}
      </div>

      {/* FIX 1: PROFILE SLIDE-OVER SHEET (420px wide) */}
      <AnimatePresence>
        {selectedMemberId && (
          <MemberProfileSheet
            biz={biz}
            memberId={selectedMemberId}
            plans={plans || []}
            onClose={() => setSelectedMemberId(null)}
          />
        )}
      </AnimatePresence>

      {/* Collect Payment Modal */}
      <AnimatePresence>
        {collectModal && (
          <CollectPaymentModal
            member={collectModal.member}
            balance={collectModal.balance}
            plan={null}
            onClose={() => setCollectModal(null)}
            onSuccess={() => {
              qc.invalidateQueries();
              setCollectModal(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Reminder Modal */}
      <AnimatePresence>
        {reminderModal && (
          <ReminderModal
            biz={biz}
            member={reminderModal.member}
            balance={reminderModal.balance}
            nextRenewalDate={reminderModal.nextRenewalDate}
            onClose={() => setReminderModal(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// PROFILE SLIDE-OVER SHEET COMPONENT
export function MemberProfileSheet({ biz, memberId, plans, onClose, highlightReminder = false }) {
  const qc = useQueryClient();
  const [activeModal, setActiveModal] = useState(null); // 'collect' | 'reminder' | 'edit' | 'delete'
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['member', memberId],
    queryFn: () => api(`/members/${memberId}`),
    enabled: Boolean(memberId && !isDeleting),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const deleteMember = useMutation({
    mutationFn: () => {
      setIsDeleting(true);
      return api(`/members/${memberId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      onClose();
      qc.removeQueries({ queryKey: ['member', memberId], exact: true });
      qc.invalidateQueries({ queryKey: ['members', biz._id] });
      qc.invalidateQueries({ queryKey: ['dashboard', biz._id] });
    },
    onError: () => {
      setIsDeleting(false);
    },
  });

  if (isError) {
    return (
      <div className="sheet-overlay" onClick={onClose}>
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="sheet-panel"
          onClick={(e) => e.stopPropagation()}>
          <div className="sheet-header">
            <div className="sheet-title">Member Not Found</div>
            <button type="button" className="icon-btn" onClick={onClose} style={{ color: '#FFFFFF' }}>
              <XIcon size={14} />
            </button>
          </div>
          <div className="sheet-body" style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>
            This member may have been removed or no longer exists.
          </div>
        </motion.div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="sheet-overlay" onClick={onClose}>
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="sheet-panel"
          onClick={(e) => e.stopPropagation()}>
          <div className="sheet-header">
            <div className="sheet-title">Loading profile…</div>
          </div>
          <div className="sheet-body">
            <div className="card skeleton" style={{ minHeight: 80 }} />
            <div className="card skeleton" style={{ minHeight: 180 }} />
          </div>
        </motion.div>
      </div>
    );
  }

  const { member, dues = [], payments = [], balance = 0, subscription } = data;
  const plan = subscription?.planId;
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const nextRenewalDate = subscription?.periodEnd ? new Date(subscription.periodEnd) : null;
  const joinDate = new Date(member.joinDate);

  // Generate monthly ledger records from joined date onwards
  const ledgerMonths = [];
  const now = new Date();
  const joinMonthIdx = joinDate.getFullYear() * 12 + joinDate.getMonth();
  const currentMonthIdx = now.getFullYear() * 12 + now.getMonth();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let idx = currentMonthIdx; idx >= joinMonthIdx; idx--) {
    const y = Math.floor(idx / 12);
    const m = idx % 12;
    const mStart = new Date(y, m, 1);
    const mEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);

    const paidInM = payments
      .filter((p) => new Date(p.date) >= mStart && new Date(p.date) <= mEnd)
      .reduce((s, p) => s + p.amount, 0);

    const duesInM = dues.filter((d) => new Date(d.dueDate) >= mStart && new Date(d.dueDate) <= mEnd);
    const unpaidInM = duesInM.filter((d) => d.status !== 'paid').reduce((s, d) => s + d.amount, 0);

    let status = 'paid';
    let label = `₹${paidInM.toLocaleString('en-IN')}`;
    if (unpaidInM > 0) {
      const isPast = duesInM.some((d) => new Date(d.dueDate) < now && d.status !== 'paid');
      status = isPast ? 'overdue' : 'due';
      label = `Due ₹${unpaidInM.toLocaleString('en-IN')}`;
    } else if (paidInM === 0) {
      status = 'none';
      label = '—';
    }

    ledgerMonths.push({
      key: `${y}-${m}`,
      monthName: `${monthNames[m]} ${y}`,
      paid: paidInM,
      due: unpaidInM,
      status,
      label,
    });
  }

  const handleDelete = () => {
    setActiveModal('delete');
  };

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
        className="sheet-panel"
        onClick={(e) => e.stopPropagation()}>
        {/* SECTION 1 — Dark Header (#0F172A) */}
        <div className="sheet-header">
          <div className="sheet-header-top">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="sheet-avatar">
                {member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="sheet-title">{member.name}</h2>
                <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>
                  Joined {joinDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>

            <div className="row" style={{ gap: 6 }}>
              <button
                type="button"
                className="icon-btn"
                title="Edit member"
                style={{ color: '#94A3B8', borderColor: 'rgba(255,255,255,0.15)' }}
                onClick={() => setActiveModal('edit')}>
                <EditIcon size={14} />
              </button>

              <button
                type="button"
                className="icon-btn"
                title="Delete member"
                style={{ color: '#EF4444', borderColor: 'rgba(255,255,255,0.15)' }}
                onClick={handleDelete}>
                <TrashIcon size={14} />
              </button>

              <button
                type="button"
                className="icon-btn"
                title="Close"
                style={{ color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.15)' }}
                onClick={onClose}>
                <XIcon size={14} />
              </button>
            </div>
          </div>

          <div className="sheet-header-badges">
            <span className="badge blue" style={{ fontSize: 11 }}>
              {plan?.name || 'Standard Plan'}
            </span>
            {balance > 0 ? (
              <span className="badge red" style={{ fontSize: 11 }}>
                <span className="badge-dot" /> Overdue ₹{balance.toLocaleString('en-IN')}
              </span>
            ) : member.status === 'left' ? (
              <span className="badge gray" style={{ fontSize: 11 }}>Left</span>
            ) : (
              <span className="badge green" style={{ fontSize: 11 }}>
                <span className="badge-dot" /> Paid Up
              </span>
            )}
          </div>
        </div>

        {/* Sheet Content Body */}
        <div className="sheet-body">
          {/* SECTION 2 — Stats Row (3 Mini Cards) */}
          <div className="sheet-stats-row">
            <div className="sheet-stat-card">
              <span className="sheet-stat-label">Total Paid</span>
              <span className="sheet-stat-value" style={{ color: 'var(--green)' }}>
                {rupees(totalPaid)}
              </span>
            </div>

            <div className="sheet-stat-card">
              <span className="sheet-stat-label">Balance Due</span>
              <span className="sheet-stat-value" style={{ color: balance > 0 ? 'var(--red)' : 'var(--text)' }}>
                {balance > 0 ? rupees(balance) : '₹0'}
              </span>
            </div>

            <div className="sheet-stat-card">
              <span className="sheet-stat-label">Next Renewal</span>
              <span className="sheet-stat-value" style={{ fontSize: 12 }}>
                {nextRenewalDate ? nextRenewalDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '—'}
              </span>
            </div>
          </div>

          {/* SECTION 3 — Payment History Table */}
          <div>
            <div className="sheet-section-title">Payment History</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-btn)', overflow: 'hidden' }}>
              <table className="analytics-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>MONTH</th>
                    <th style={{ textAlign: 'right' }}>AMOUNT</th>
                    <th style={{ textAlign: 'right' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerMonths.map((lm) => (
                    <tr key={lm.key}>
                      <td style={{ fontWeight: 500 }}>{lm.monthName}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {lm.paid > 0 ? `₹${lm.paid.toLocaleString('en-IN')}` : lm.due > 0 ? `₹${lm.due.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {lm.status === 'paid' && (
                          <span className="badge green" style={{ fontSize: 10.5, padding: '1px 6px' }}>
                            ✓ Paid
                          </span>
                        )}
                        {lm.status === 'due' && (
                          <span className="badge amber" style={{ fontSize: 10.5, padding: '1px 6px' }}>
                            Due
                          </span>
                        )}
                        {lm.status === 'overdue' && (
                          <span className="badge red" style={{ fontSize: 10.5, padding: '1px 6px' }}>
                            Overdue
                          </span>
                        )}
                        {lm.status === 'none' && (
                          <span className="muted small">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 4 — Contact & Membership Details */}
          <div>
            <div className="sheet-section-title">Contact & Membership Details</div>
            <div className="sheet-contact-card">
              <div className="sheet-contact-item">
                <span className="sheet-contact-label">
                  <PhoneIcon size={14} /> Phone Number
                </span>
                <span className="sheet-contact-val">
                  {member.phone ? (
                    <a
                      href={`tel:${member.phone}`}
                      style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      +91 {member.phone}
                    </a>
                  ) : (
                    'Not provided'
                  )}
                </span>
              </div>

              <div className="sheet-contact-item">
                <span className="sheet-contact-label">
                  <CalendarIcon size={14} /> Joined Date
                </span>
                <span className="sheet-contact-val">
                  {joinDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>

              <div className="sheet-contact-item">
                <span className="sheet-contact-label">
                  <CreditCardIcon size={14} /> Current Plan
                </span>
                <span className="sheet-contact-val">
                  {plan ? `${plan.name} (${rupees(plan.amount)} / ${plan.cycleDays}d)` : 'Standard'}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 5 — Action Buttons (Full Width, Stacked) */}
          <div className="sheet-actions-stack">
            <button
              type="button"
              className="btn"
              style={{ width: '100%', minHeight: 36, fontSize: 13, background: 'var(--green)' }}
              onClick={() => setActiveModal('collect')}>
              <CheckIcon size={15} /> Collect Payment
            </button>

            <button
              type="button"
              className={`btn-secondary${highlightReminder ? ' pulse-reminder-btn' : ''}`}
              style={{
                width: '100%',
                minHeight: 36,
                fontSize: 13,
                ...(highlightReminder ? { borderColor: 'var(--green)', color: 'var(--green)', fontWeight: 600 } : {}),
              }}
              onClick={() => setActiveModal('reminder')}>
              <SendIcon size={14} /> Send Reminder
            </button>

            <button
              type="button"
              className="btn-secondary"
              style={{ width: '100%', minHeight: 36, fontSize: 13 }}
              onClick={() => setActiveModal('edit')}>
              <EditIcon size={14} /> Edit Member
            </button>
          </div>
        </div>
      </motion.div>

      {/* Collect Payment Modal */}
      <AnimatePresence>
        {activeModal === 'collect' && (
          <CollectPaymentModal
            member={member}
            balance={balance}
            plan={plan}
            onClose={() => setActiveModal(null)}
            onSuccess={() => {
              qc.invalidateQueries();
              setActiveModal(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Send Reminder Modal */}
      <AnimatePresence>
        {activeModal === 'reminder' && (
          <SendReminderModal
            biz={biz}
            member={member}
            nextRenewalDate={nextRenewalDate}
            balance={balance}
            onClose={() => setActiveModal(null)}
          />
        )}
      </AnimatePresence>

      {/* Edit Member Modal */}
      <AnimatePresence>
        {activeModal === 'edit' && (
          <EditMemberModal
            member={member}
            plans={plans}
            currentPlanId={subscription?.planId?._id}
            onClose={() => setActiveModal(null)}
            onSuccess={() => {
              qc.invalidateQueries();
              setActiveModal(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Delete Member Confirmation Modal */}
      <AnimatePresence>
        {activeModal === 'delete' && (
          <ConfirmDeleteModal
            memberName={member.name}
            isPending={deleteMember.isPending}
            onClose={() => setActiveModal(null)}
            onConfirm={() => deleteMember.mutate()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// COLLECT PAYMENT MODAL
export function CollectPaymentModal({ member, balance, plan, onClose, onSuccess }) {
  const [amount, setAmount] = useState(balance > 0 ? balance : plan?.amount || 1500);
  const [mode, setMode] = useState('cash');
  const [notes, setNotes] = useState('');

  const pay = useMutation({
    mutationFn: () =>
      api(`/members/${member._id}/payments`, {
        method: 'POST',
        body: { amount: Number(amount), mode, date: new Date().toISOString(), notes },
      }),
    onSuccess,
  });

  const chips = [1000, 1500, 2000, 2500, 3000, 5000];

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 120 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="modal-content"
        style={{ maxWidth: 420 }}
        onClick={(e) => e.stopPropagation()}>
        <div className="form-header" style={{ marginBottom: 14 }}>
          <h3 className="form-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircleIcon size={17} style={{ color: 'var(--green)' }} />
            <span>Collect Payment — {member.name}</span>
          </h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <XIcon size={14} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); pay.mutate(); }}>
          <Field label="Amount to Collect (₹) *" icon={RupeeIcon}>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              style={{ fontSize: 16, fontWeight: 600 }}
              autoFocus
            />
          </Field>

          {/* Quick preset chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0 12px' }}>
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                className={`filter-pill ${Number(amount) === chip ? 'active' : ''}`}
                style={{ fontSize: 11, padding: '3px 8px' }}
                onClick={() => setAmount(chip)}>
                ₹{chip.toLocaleString('en-IN')}
              </button>
            ))}
          </div>

          <Field label="Payment Method" icon={CreditCardIcon}>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="upi">UPI / GPay / PhonePe</option>
              <option value="card">Debit / Credit Card</option>
              <option value="bank_transfer">Bank Transfer / IMPS</option>
            </select>
          </Field>

          <Field label="Notes (Optional)" icon={TagIcon}>
            <input
              type="text"
              placeholder="e.g. Received in morning session"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>

          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={pay.isPending} style={{ background: 'var(--green)' }}>
              {pay.isPending ? 'Recording…' : `Record ₹${Number(amount || 0).toLocaleString('en-IN')}`}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// REMINDER MODAL
export function ReminderModal({ biz, member, balance, nextRenewalDate, onClose }) {
  const [copied, setCopied] = useState(false);
  const expStr = nextRenewalDate ? nextRenewalDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'soon';
  const defaultMsg = balance > 0
    ? `Hi ${member.name}, you have an outstanding dues of ₹${balance.toLocaleString('en-IN')} at ${biz.name}. Kindly clear the balance to keep your membership active. Thank you!`
    : `Hi ${member.name}, your membership at ${biz.name} renews on ${expStr}. Renew now to keep your streak going! Reply to confirm.`;

  const [message, setMessage] = useState(defaultMsg);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const waUrl = member.phone
    ? `https://wa.me/91${member.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
    : null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 120 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="modal-content"
        style={{ maxWidth: 460 }}
        onClick={(e) => e.stopPropagation()}>
        <div className="form-header" style={{ marginBottom: 14 }}>
          <h3 className="form-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SendIcon size={17} style={{ color: '#F59E0B' }} />
            <span>Send Reminder — {member.name}</span>
          </h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <XIcon size={14} />
          </button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="input-label">Message Template (Editable)</label>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn-secondary" onClick={handleCopy}>
            <CopyIcon size={14} />
            {copied ? '✓ Copied' : 'Copy Text'}
          </button>

          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              className="btn wa">
              <WhatsAppIcon size={14} /> Open WhatsApp
            </a>
          ) : (
            <button disabled className="btn wa">No Phone Number</button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// EDIT MEMBER MODAL
function EditMemberModal({ member, plans, currentPlanId, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: member.name || '',
    phone: member.phone || '',
    status: member.status || 'active',
  });

  const edit = useMutation({
    mutationFn: () =>
      api(`/members/${member._id}`, {
        method: 'PATCH',
        body: form,
      }),
    onSuccess,
  });

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 120 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="modal-content"
        style={{ maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}>
        <div className="form-header" style={{ marginBottom: 14 }}>
          <h3 className="form-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EditIcon size={17} style={{ color: 'var(--primary)' }} />
            <span>Edit Member — {member.name}</span>
          </h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <XIcon size={14} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); edit.mutate(); }}>
          <Field label="Full Name *" icon={UserIcon}>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>

          <div style={{ marginTop: 12 }}>
            <Field label="Phone Number (10 digits)" icon={PhoneIcon}>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              />
            </Field>
          </div>

          <div style={{ marginTop: 12 }}>
            <Field label="Membership Status *" icon={TagIcon}>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="left">Left</option>
              </select>
            </Field>
          </div>

          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button disabled={edit.isPending} className="btn">
              <CheckIcon size={14} />
              {edit.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// Add Member Form
function AddMemberForm({ plans, groups, rooms, busy, onClose, onSubmit }) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    planId: plans[0]?._id || '',
    groupId: groups[0]?._id || '',
    roomId: rooms.find((r) => r.occupied < r.capacity)?._id || '', // first room with a free bed
    startDate: new Date().toISOString().slice(0, 10),
  });
  const [errors, setErrors] = useState({});

  const selectedPlan = plans.find((p) => p._id === form.planId) || plans[0];

  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setForm({ ...form, phone: val });
    if (errors.phone) setErrors({ ...errors, phone: '' });
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Full name is required';
    if (!form.phone.trim()) {
      errs.phone = 'Phone number is required';
    } else if (form.phone.length !== 10) {
      errs.phone = 'Phone must be exactly 10 digits';
    }
    if (plans.length > 0 && !form.planId) errs.planId = 'Please select a membership plan';
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

        {plans.length > 0 && (
          <div>
            <Field label="Membership Plan *" icon={CreditCardIcon}>
              <select value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
                {plans.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} — {rupees(p.amount)} ({p.cycleDays} days)
                  </option>
                ))}
              </select>
            </Field>
            {errors.planId && <span className="small red-text" style={{ marginTop: 3, display: 'block' }}>{errors.planId}</span>}
          </div>
        )}

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

        {groups.length > 0 && (
          <div>
            <Field label="Group / Batch" icon={TagIcon}>
              <select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
                <option value="">No group</option>
                {groups.map((g) => (
                  <option key={g._id} value={g._id}>{g.name}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {rooms.length > 0 && (
          <div>
            <Field label="Room Allocation" icon={BedIcon}>
              <select value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
                <option value="">No room allocated</option>
                {rooms.map((r) => (
                  <option key={r._id} value={r._id} disabled={r.occupied >= r.capacity}>
                    Room {r.roomNo} · {r.occupied}/{r.capacity} beds{r.occupied >= r.capacity ? ' (full)' : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </div>

      {selectedPlan && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-btn)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="small muted">Membership Fee</span>
          <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13.5 }}>
            {rupees(selectedPlan.amount)} <span className="small muted">/ {selectedPlan.cycleDays} days</span>
          </span>
        </div>
      )}

      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button disabled={busy} className="btn">
          <CheckIcon size={15} />
          {busy ? 'Registering…' : 'Register Member'}
        </button>
      </div>
    </form>
  );
}

// CONFIRM DELETE MEMBER MODAL
export function ConfirmDeleteModal({ memberName, isPending, onClose, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.18 }}
        className="modal-content"
        style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}
        onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: '#FEE2E2',
            color: '#DC2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
          }}>
          <TrashIcon size={24} />
        </div>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text)' }}>
          Remove Member?
        </h3>

        <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.5, margin: '0 0 24px 0' }}>
          Are you sure you want to remove <strong style={{ color: 'var(--text)' }}>{memberName}</strong>? This will permanently delete all associated membership history, dues, and payment records.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ flex: 1, minHeight: 38 }}
            onClick={onClose}
            disabled={isPending}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            style={{
              flex: 1,
              minHeight: 38,
              background: '#DC2626',
              borderColor: '#DC2626',
              color: '#FFFFFF',
              fontWeight: 600,
            }}
            onClick={onConfirm}
            disabled={isPending}>
            {isPending ? 'Removing…' : 'Delete Member'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
