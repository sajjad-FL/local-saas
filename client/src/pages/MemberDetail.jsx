import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api, waLink, rupees, remindMsg } from '../api.js';
import { useBiz } from '../App.jsx';
import {
  Avatar, Field, Rise, WhatsAppIcon, PauseIcon, PlayIcon,
  RupeeIcon, CalendarIcon, CheckIcon, CreditCardIcon, UsersIcon,
  PhoneIcon, TagIcon, ChevronIcon, ClockIcon, AlertIcon,
  ConfirmDialog, CheckCircleIcon,
} from '../ui.jsx';

export default function MemberDetail() {
  const { id } = useParams();
  const biz = useBiz();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('cash');
  const [confirmModal, setConfirmModal] = useState(null); // { type: 'pause' | 'resume' | 'leave' }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['member', id],
    queryFn: () => api(`/members/${id}`),
    enabled: !!id,
    retry: false,
  });

  const pay = useMutation({
    mutationFn: () => api(`/members/${id}/payments`, { method: 'POST', body: { amount: Number(amount), mode } }),
    onSuccess: () => {
      setAmount('');
      qc.invalidateQueries();
    },
  });

  const markLeft = useMutation({
    mutationFn: () => api(`/members/${id}`, { method: 'PATCH', body: { status: 'left' } }),
    onSuccess: () => {
      qc.invalidateQueries();
      navigate('/members');
    },
  });

  const pauseResume = useMutation({
    mutationFn: (action) => api(`/members/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries(),
  });

  if (isError) {
    return (
      <div className="analytics-card" style={{ padding: 48, textAlign: 'center' }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Member Not Found</h2>
        <p className="muted" style={{ marginBottom: 20 }}>
          This member record may have been removed or does not exist.
        </p>
        <Link to="/members" className="btn">
          Back to Members Directory
        </Link>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div aria-hidden="true">
        <div className="card skeleton" style={{ minHeight: 180, marginBottom: 16 }} />
        <div className="card skeleton" style={{ minHeight: 220 }} />
      </div>
    );
  }
  const { member, balance, subscription, payments = [], dues = [] } = data;

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  const ledger = [
    ...dues.map((d) => ({ ...d, kind: 'due', when: d.dueDate })),
    ...payments.map((p) => ({ ...p, kind: 'payment', when: p.date })),
  ].sort((a, b) => new Date(b.when) - new Date(a.when));

  return (
    <>
      <Link to="/members" className="back-pill">
        <ChevronIcon size={13} style={{ transform: 'rotate(180deg)' }} />
        Back to Members Directory
      </Link>

      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-title-wrap">
          <h1 className="page-title">
            {member.name}
          </h1>
          <p className="page-subtitle">
            Member profile details, subscription plan cycles, and financial ledger history.
          </p>
        </div>
      </div>

      {/* 2-Column Responsive Layout on Desktop */}
      <div className="settings-grid" style={{ marginBottom: 18 }}>
        {/* Left Column: Member Profile Card */}
        <Rise i={0}>
          <div className="analytics-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="profile-top-bar" style={{ paddingBottom: 12 }}>
                <div className="profile-avatar-wrap">
                  <Avatar name={member.name} lg />
                  <div className="profile-name-block">
                    <h2>
                      {member.name}
                      {member.status === 'left' && <span className="badge gray" style={{ fontSize: 11 }}>Left</span>}
                    </h2>
                    <div className="muted small" style={{ marginTop: 2 }}>
                      Member ID: <span style={{ fontFamily: 'monospace' }}>{member._id.slice(-6).toUpperCase()}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span className={`badge ${balance > 0 ? 'red' : 'green'}`} style={{ fontSize: 12, padding: '4px 10px' }}>
                    <span className="badge-dot pulse-dot" />
                    {balance > 0 ? `Unpaid ${rupees(balance)}` : balance < 0 ? `Advance ${rupees(-balance)}` : 'Paid Up (₹0 Due)'}
                  </span>
                  {subscription?.status === 'paused' && <span className="badge orange">Paused</span>}
                </div>
              </div>

              {/* Key-Value Info Cards Grid */}
              <div className="profile-meta-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', margin: '12px 0' }}>
                <div className="meta-item">
                  <div className="meta-label">
                    <PhoneIcon size={12} style={{ color: 'var(--primary)' }} /> Mobile Phone
                  </div>
                  <div className="meta-value">
                    {member.phone ? (
                      <a href={`tel:${member.phone}`} style={{ color: 'var(--primary)' }}>
                        {member.phone}
                      </a>
                    ) : (
                      <span className="muted">Not registered</span>
                    )}
                  </div>
                </div>

                <div className="meta-item">
                  <div className="meta-label">
                    <CreditCardIcon size={12} style={{ color: 'var(--primary)' }} /> Current Plan
                  </div>
                  <div className="meta-value">
                    {subscription?.planId ? (
                      <span>{subscription.planId.name} ({rupees(subscription.planId.amount)})</span>
                    ) : (
                      <span className="muted">No active plan</span>
                    )}
                  </div>
                </div>

                <div className="meta-item">
                  <div className="meta-label">
                    <RupeeIcon size={12} style={{ color: 'var(--green)' }} /> Total Paid
                  </div>
                  <div className="meta-value green-text" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {rupees(totalPaid)}
                  </div>
                </div>

                <div className="meta-item">
                  <div className="meta-label">
                    <CalendarIcon size={12} style={{ color: 'var(--primary)' }} /> Joined On
                  </div>
                  <div className="meta-value">
                    {new Date(member.joinDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>

                <div className="meta-item">
                  <div className="meta-label">
                    <ClockIcon size={12} style={{ color: 'var(--primary)' }} /> Next Due Date
                  </div>
                  <div className="meta-value">
                    {subscription?.periodEnd ? (
                      <span className={new Date(subscription.periodEnd) <= new Date() ? 'red-text' : ''}>
                        {new Date(subscription.periodEnd).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Toolbar */}
            <div className="row" style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)', justifyContent: 'space-between' }}>
              <div>
                {member.phone && balance > 0 && (
                  <motion.a
                    className="btn wa"
                    target="_blank"
                    rel="noreferrer"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{ minHeight: 30, padding: '4px 10px', fontSize: 11.5 }}
                    href={waLink(member.phone, remindMsg(biz, member.name, balance))}>
                    <WhatsAppIcon size={14} /> Send WhatsApp Reminder
                  </motion.a>
                )}
              </div>

              <div className="row" style={{ gap: 6 }}>
                {subscription && member.status === 'active' && (
                  subscription.status === 'paused' ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ minHeight: 30, padding: '4px 10px', fontSize: 11.5 }}
                      disabled={pauseResume.isPending}
                      onClick={() => setConfirmModal({ type: 'resume' })}>
                      <PlayIcon size={13} /> Resume
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ minHeight: 30, padding: '4px 10px', fontSize: 11.5 }}
                      disabled={pauseResume.isPending}
                      onClick={() => setConfirmModal({ type: 'pause' })}>
                      <PauseIcon size={13} /> Pause
                    </button>
                  )
                )}
                {member.status === 'active' && (
                  <button
                    type="button"
                    className="btn-secondary red-text"
                    style={{ minHeight: 30, padding: '4px 10px', fontSize: 11.5 }}
                    disabled={markLeft.isPending}
                    onClick={() => setConfirmModal({ type: 'leave' })}>
                    Mark as Left
                  </button>
                )}
              </div>
            </div>
          </div>
        </Rise>

        {/* Right Column: Record Payment Form */}
        {member.status === 'active' && (
          <Rise i={1}>
            <div className="analytics-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <form onSubmit={(e) => { e.preventDefault(); pay.mutate(); }}>
                <div className="card-header-row" style={{ marginBottom: 12 }}>
                  <div>
                    <h3 className="analytics-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <RupeeIcon size={17} style={{ color: 'var(--green)' }} />
                      Record Payment Received
                    </h3>
                    <span className="analytics-card-subtitle">
                      Record a membership payment received in cash, UPI, or card
                    </span>
                  </div>
                </div>

                {/* Quick Amount Chips (Starting from 1000) */}
                <div className="chips-row" style={{ marginBottom: 12 }}>
                  <span className="small muted" style={{ alignSelf: 'center', marginRight: 2, fontWeight: 600 }}>Quick fill:</span>
                  {balance > 0 && (
                    <button
                      type="button"
                      className="chip"
                      style={{ background: 'var(--primary-soft)', color: 'var(--primary)', borderColor: 'var(--primary-border)' }}
                      onClick={() => setAmount(String(balance))}>
                      Clear {rupees(balance)}
                    </button>
                  )}
                  {[1000, 1500, 2000, 2500, 3000, 5000].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      className="chip"
                      onClick={() => setAmount(String(quick))}>
                      +{rupees(quick)}
                    </button>
                  ))}
                </div>

                <div className="form-grid two-col" style={{ marginBottom: 14 }}>
                  <Field label="Payment Amount (₹) *" icon={RupeeIcon}>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="1"
                      placeholder="e.g. 1500"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </Field>

                  <Field label="Payment Mode *" icon={CreditCardIcon}>
                    <select value={mode} onChange={(e) => setMode(e.target.value)}>
                      <option value="cash">💵 Cash Received</option>
                      <option value="upi">⚡ Direct UPI / QR Scan</option>
                      <option value="other">🏦 Bank Transfer / Card</option>
                    </select>
                  </Field>
                </div>

                <div className="row" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
                  <button disabled={pay.isPending || !amount} style={{ width: '100%', justifyContent: 'center' }}>
                    <CheckIcon size={15} />
                    {pay.isPending ? 'Recording Payment…' : 'Record Payment'}
                  </button>
                </div>
              </form>
              {pay.error && <p className="error" role="alert">{pay.error.message}</p>}
            </div>
          </Rise>
        )}
      </div>

      {/* Transaction Ledger Timeline */}
      <Rise i={2}>
        <div className="analytics-card">
          <div className="card-header-row" style={{ marginBottom: 14 }}>
            <div>
              <h3 className="analytics-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <ClockIcon size={17} style={{ color: 'var(--primary)' }} />
                Transaction Ledger ({ledger.length})
              </h3>
              <span className="analytics-card-subtitle">
                Chronological timeline of billed subscription cycles and recorded payments
              </span>
            </div>
          </div>

          <div className="timeline">
            {ledger.map((item) => (
              <div key={item._id} className="timeline-item">
                <span className={`timeline-dot ${item.kind}`} />
                <div className="card row" style={{ alignItems: 'center', margin: '4px 0', padding: '10px 14px' }}>
                  <span className={`tx-icon ${item.kind === 'payment' ? 'in' : 'due'}`} style={{ width: 32, height: 32 }}>
                    {item.kind === 'payment' ? <RupeeIcon size={15} /> : <CreditCardIcon size={15} />}
                  </span>

                  <div className="grow">
                    <b style={{ fontSize: 13.5 }}>
                      {item.kind === 'payment' ? 'Payment Received' : `Fee Due — ${item.reason || 'Membership Cycle'}`}
                    </b>
                    <div className="muted small">
                      {new Date(item.when).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                      {item.mode && ` · Mode: ${item.mode.toUpperCase()}`}
                    </div>
                  </div>

                  <span className={`amount ${item.kind === 'payment' ? 'green-text' : 'red-text'}`} style={{ fontSize: 14 }}>
                    {item.kind === 'payment' ? '+' : '-'}{rupees(item.amount)}
                  </span>
                </div>
              </div>
            ))}

            {!ledger.length && (
              <div className="empty" style={{ padding: '24px 12px' }}>
                <b>No transactions recorded yet</b>
                <span>Subscription renewals and member payments will appear here in chronological order.</span>
              </div>
            )}
          </div>
        </div>
      </Rise>

      {/* Confirmation Modals */}
      <ConfirmDialog
        isOpen={confirmModal?.type === 'pause'}
        onClose={() => setConfirmModal(null)}
        onConfirm={() => {
          setConfirmModal(null);
          pauseResume.mutate('pause');
        }}
        title={`Pause subscription for ${member.name}?`}
        message="Pausing the subscription temporarily freezes membership check-ins. Paused days will automatically extend the renewal due date."
        confirmText="Pause Subscription"
        icon={PauseIcon}
        busy={pauseResume.isPending}
      />

      <ConfirmDialog
        isOpen={confirmModal?.type === 'resume'}
        onClose={() => setConfirmModal(null)}
        onConfirm={() => {
          setConfirmModal(null);
          pauseResume.mutate('resume');
        }}
        title={`Resume subscription for ${member.name}?`}
        message="Daily workout check-ins and regular membership billing will reactivate immediately."
        confirmText="Resume Subscription"
        icon={PlayIcon}
        busy={pauseResume.isPending}
      />

      <ConfirmDialog
        isOpen={confirmModal?.type === 'leave'}
        onClose={() => setConfirmModal(null)}
        onConfirm={() => {
          setConfirmModal(null);
          markLeft.mutate();
        }}
        title={`Mark ${member.name} as Left?`}
        message="This will deactivate their membership and stop upcoming subscription renewals. Their past payment ledger will remain preserved for your records."
        confirmText="Mark as Left"
        danger
        icon={AlertIcon}
        busy={markLeft.isPending}
      />
    </>
  );
}
