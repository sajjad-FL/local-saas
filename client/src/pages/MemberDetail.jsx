import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api, waLink, rupees, remindMsg, userId } from '../api.js';
import { useBiz } from '../App.jsx';
import {
  Avatar, Field, Rise, WhatsAppIcon, PauseIcon, PlayIcon,
  RupeeIcon, CalendarIcon, CheckIcon, CreditCardIcon, UsersIcon,
  PhoneIcon, TagIcon, ChevronIcon, ClockIcon, AlertIcon,
  ConfirmDialog, CheckCircleIcon, TrashIcon, LinkIcon, BuildingIcon,
} from '../ui.jsx';

export default function MemberDetail() {
  const { id } = useParams();
  const biz = useBiz();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('cash');
  const [confirmModal, setConfirmModal] = useState(null); // { type: 'pause' | 'resume' | 'leave' | 'reverse' }
  const [lastPayment, setLastPayment] = useState(null); // for the "send receipt" prompt after recording

  const { data, isLoading, isError } = useQuery({
    queryKey: ['member', id],
    queryFn: () => api(`/members/${id}`),
    enabled: !!id,
    retry: false,
  });

  // statement link token (created on first view); links below are plain hrefs so popup blockers don't interfere
  const { data: share } = useQuery({
    queryKey: ['share', id],
    queryFn: () => api(`/members/${id}/share`, { method: 'POST' }),
    enabled: !!id,
    staleTime: Infinity,
  });
  const rotateShare = useMutation({
    mutationFn: () => api(`/members/${id}/share`, { method: 'POST', body: { rotate: true } }),
    onSuccess: (data) => qc.setQueryData(['share', id], data),
  });
  const statementUrl = share?.token && `${location.origin}/s/${share.token}`;

  const pay = useMutation({
    mutationFn: () => api(`/members/${id}/payments`, { method: 'POST', body: { amount: Number(amount), mode } }),
    onSuccess: (payment) => {
      setLastPayment(payment);
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

  const reversePayment = useMutation({
    mutationFn: (paymentId) => api(`/members/${id}/payments/${paymentId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries(),
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
  const isOwner = biz.ownerId === userId();

  // oldest first to compute the balance after each entry (same-day due before its payment), then newest on top
  let running = 0;
  const ledger = [
    ...dues.map((d) => ({ ...d, kind: 'due', when: d.dueDate })),
    ...payments.map((p) => ({ ...p, kind: 'payment', when: p.date })),
  ]
    .sort((a, b) => new Date(a.when) - new Date(b.when) || (a.kind === 'due' ? -1 : 1))
    .map((item) => ({ ...item, balanceAfter: running += item.kind === 'due' ? item.amount : -item.amount }))
    .reverse();

  const receiptMsg = lastPayment &&
    `Hi ${member.name}, received ${rupees(lastPayment.amount)} (${(lastPayment.mode || 'cash').toUpperCase()}) on ` +
    `${new Date(lastPayment.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} for ${biz.name}. ` +
    (balance > 0 ? `Balance due: ${rupees(balance)}.` : balance < 0 ? `Advance: ${rupees(-balance)}.` : 'You are all paid up.') +
    ' Thank you!' + (statementUrl ? ` Statement: ${statementUrl}` : '');

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
            <div className="row" style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {member.phone && balance > 0 && (
                  <motion.a
                    className="btn wa"
                    target="_blank"
                    rel="noreferrer"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{ minHeight: 30, padding: '4px 10px', fontSize: 11.5 }}
                    href={waLink(member.phone, remindMsg(biz, member.name, balance) + (statementUrl ? ` See your statement: ${statementUrl}` : ''))}>
                    <WhatsAppIcon size={14} /> Send WhatsApp Reminder
                  </motion.a>
                )}
                {statementUrl && (
                  <a
                    className="btn btn-secondary"
                    target="_blank"
                    rel="noreferrer"
                    style={{ minHeight: 30, padding: '4px 10px', fontSize: 11.5 }}
                    title="A read-only page with every due and payment. No app or login needed."
                    href={member.phone
                      ? waLink(member.phone, `Hi ${member.name}, here is your account statement from ${biz.name}: ${statementUrl}`)
                      : statementUrl}>
                    <LinkIcon size={13} /> Share Statement
                  </a>
                )}
                {statementUrl && (
                  <button
                    type="button"
                    className="btn-link small muted"
                    title="Stop the current link working and issue a new one"
                    disabled={rotateShare.isPending}
                    onClick={() => rotateShare.mutate()}>
                    Reset link
                  </button>
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
                    style={{ minHeight: 30, padding: '4px 10px', fontSize: 11.5, whiteSpace: 'nowrap' }}
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
              {lastPayment && member.phone && (
                <div className="row" style={{ marginTop: 10, gap: 8, alignItems: 'center' }}>
                  <CheckCircleIcon size={15} style={{ color: 'var(--green)' }} />
                  <span className="small grow">Recorded {rupees(lastPayment.amount)}.</span>
                  <a className="btn wa" target="_blank" rel="noreferrer"
                    style={{ minHeight: 30, padding: '4px 10px', fontSize: 11.5 }}
                    href={waLink(member.phone, receiptMsg)}
                    onClick={() => setLastPayment(null)}>
                    <WhatsAppIcon size={14} /> Send Receipt
                  </a>
                </div>
              )}
            </div>
          </Rise>
        )}
      </div>

      {biz.type === 'hostel' && <DepositNotice member={member} />}

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

                  <div style={{ textAlign: 'right', marginLeft: 12 }}>
                    <span className={`amount ${item.kind === 'payment' ? 'green-text' : 'red-text'}`} style={{ fontSize: 14 }}>
                      {item.kind === 'payment' ? '+' : '-'}{rupees(item.amount)}
                    </span>
                    <div className="ledger-balance">Bal {rupees(item.balanceAfter)}</div>
                  </div>
                  {isOwner && item.kind === 'payment' && (
                    <button
                      type="button"
                      className="icon-btn"
                      title="Reverse this payment"
                      aria-label={`Reverse payment of ${rupees(item.amount)}`}
                      onClick={() => setConfirmModal({ type: 'reverse', payment: item })}>
                      <TrashIcon size={14} />
                    </button>
                  )}
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
        isOpen={confirmModal?.type === 'reverse'}
        onClose={() => setConfirmModal(null)}
        onConfirm={() => {
          reversePayment.mutate(confirmModal.payment._id);
          setConfirmModal(null);
        }}
        title={`Reverse payment of ${rupees(confirmModal?.payment?.amount)}?`}
        message="Use this for a payment entered by mistake. It is removed from the ledger and the member's balance goes back up by this amount."
        confirmText="Reverse Payment"
        danger
        icon={TrashIcon}
        busy={reversePayment.isPending}
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

// Hostel: security deposit and notice date. Both show on the member's statement link,
// so the tenant sees exactly what the owner recorded and when.
function DepositNotice({ member }) {
  const qc = useQueryClient();
  const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
  const [form, setForm] = useState({
    amount: member.deposit?.amount ?? '',
    refundedAmount: member.deposit?.refundedAmount ?? '',
    refundedOn: day(member.deposit?.refundedOn),
    noticeGivenOn: day(member.noticeGivenOn),
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = useMutation({
    mutationFn: () => api(`/members/${member._id}`, {
      method: 'PATCH',
      body: {
        deposit: {
          amount: form.amount === '' ? undefined : Number(form.amount),
          refundedAmount: form.refundedAmount === '' ? undefined : Number(form.refundedAmount),
          refundedOn: form.refundedOn || undefined,
        },
        noticeGivenOn: form.noticeGivenOn || null,
      },
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member', member._id] }),
  });

  return (
    <Rise i={2}>
      <form className="analytics-card" style={{ marginBottom: 18 }} onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="card-header-row" style={{ marginBottom: 12 }}>
          <div>
            <h3 className="analytics-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <BuildingIcon size={17} style={{ color: 'var(--primary)' }} />
              Deposit & Notice
            </h3>
            <span className="analytics-card-subtitle">Shown on the tenant's statement link, so both sides see the same record</span>
          </div>
        </div>
        <div className="form-grid two-col" style={{ marginBottom: 12 }}>
          <Field label="Security deposit held (₹)" icon={RupeeIcon}>
            <input type="number" min="0" inputMode="decimal" value={form.amount} onChange={set('amount')} />
          </Field>
          <Field label="Notice given on" icon={CalendarIcon}>
            <input type="date" value={form.noticeGivenOn} onChange={set('noticeGivenOn')} />
          </Field>
          <Field label="Deposit refunded (₹)" icon={RupeeIcon}>
            <input type="number" min="0" inputMode="decimal" value={form.refundedAmount} onChange={set('refundedAmount')} />
          </Field>
          <Field label="Refunded on" icon={CalendarIcon}>
            <input type="date" value={form.refundedOn} onChange={set('refundedOn')} />
          </Field>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          {save.isSuccess && <span className="small green-text">Saved</span>}
          {save.error && <span className="small red-text" role="alert">{save.error.message}</span>}
          <button disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Rise>
  );
}
