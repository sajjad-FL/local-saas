import { useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, waLink, rupees, remindMsg, can, ADD, EDIT, DELETE } from '../api.js';
import { useBiz } from '../App.jsx';
import { confirmAction } from '../confirm.jsx';
import { AnimatePresence } from 'framer-motion';
import SellModal from '../SellModal.jsx';
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
  // the open tab lives in the URL (?tab=payments) so Back and shared links keep it
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'overview';
  const setTab = (t) => setParams((p) => { if (t === 'overview') p.delete('tab'); else p.set('tab', t); return p; }, { replace: true });

  const [selling, setSelling] = useState(false);
  const { data: catalogue } = useQuery({ queryKey: ['catalogue', biz._id], queryFn: () => api(`/businesses/${biz._id}/catalogue`) });
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
  const canAdd = can(biz, ADD), canEdit = can(biz, EDIT), canDelete = can(biz, DELETE);

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

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const isActive = member.status === 'active';
  const isPaused = subscription?.status === 'paused';
  const planText = subscription?.planId
    ? `${subscription.planId.name} · ${rupees(subscription.amount ?? subscription.planId.amount)}${subscription.amount ? ' (custom)' : ''}`
    : 'No active plan';
  const dueDate = subscription?.periodEnd ? new Date(subscription.periodEnd) : null;
  const dueLate = dueDate && dueDate <= new Date();
  // payments clear the oldest fees first: the first fee not covered is what they've owed since
  let paidLeft = totalPaid;
  const owingSince = balance > 0 ? [...dues]
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .find((d) => { if (paidLeft >= d.amount) { paidLeft -= d.amount; return false; } paidLeft = 0; return new Date(d.dueDate) <= new Date(); })?.dueDate : null;
  const today0 = new Date(new Date().toDateString());
  const daysLate = owingSince ? Math.max(0, Math.floor((today0 - new Date(new Date(owingSince).toDateString())) / 86400000)) : 0;
  const showAttendance = biz.attendanceEnabled !== false;
  const isHostel = biz.type === 'hostel';
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'payments', label: 'Payments', count: ledger.length },
    showAttendance && { id: 'attendance', label: 'Attendance' },
    isHostel && { id: 'deposit', label: 'Deposit & notice' },
  ].filter(Boolean);
  const current = tabs.some((t) => t.id === tab) ? tab : 'overview';
  const openPayments = () => {
    setTab('payments');
    setTimeout(() => document.getElementById('md-pay-amount')?.focus(), 50);
  };

  const ledgerList = (items) => (
    <ul className="md-ledger">
      {items.map((item) => (
        <li key={item._id} className="md-ledger-row">
          <span className={`md-ledger-icon ${item.kind}`}>
            {item.kind === 'payment' ? <RupeeIcon size={15} /> : <CreditCardIcon size={15} />}
          </span>
          <span className="md-ledger-what">
            <b>{item.kind === 'payment' ? 'Payment received' : item.label || 'Fee due'}</b>
            <span>{fmtDate(item.when)}{item.mode ? ` · ${item.mode === 'upi' ? 'UPI' : item.mode[0].toUpperCase() + item.mode.slice(1)}` : ''}</span>
          </span>
          <span className="md-ledger-amt">
            <b className={item.kind === 'payment' ? 'green' : 'red'}>{item.kind === 'payment' ? '+' : '−'}{rupees(item.amount)}</b>
            <span>Balance {rupees(item.balanceAfter)}</span>
          </span>
          {canDelete && item.kind === 'payment' ? (
            <button
              type="button"
              className="md-icon-btn"
              title="Reverse this payment"
              aria-label={`Reverse payment of ${rupees(item.amount)}`}
              onClick={() => setConfirmModal({ type: 'reverse', payment: item })}>
              <TrashIcon size={14} />
            </button>
          ) : <span className="md-icon-spacer" />}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <Link to="/members" className="back-pill">
        <ChevronIcon size={13} style={{ transform: 'rotate(180deg)' }} />
        <span>Members</span>
      </Link>

      {/* Summary: who, what they owe, and the two things you do most */}
      <section className="md-head">
        <div className="md-who">
          <Avatar name={member.name} lg />
          <div className="md-who-text">
            <h1>
              {member.name}
              {member.status === 'left' && <span className="badge gray">Left</span>}
              {isPaused && <span className="badge orange">Paused</span>}
            </h1>
            <p>
              {member.phone ? <a href={`tel:${member.phone}`}>{member.phone}</a> : 'No phone'}
              <span aria-hidden="true"> · </span>{planText}
            </p>
          </div>
        </div>

        <div className="md-balance">
          <span className="md-balance-label">{balance > 0 ? 'Owes' : balance < 0 ? 'Advance' : 'Balance'}</span>
          <span className={`md-balance-big ${balance > 0 ? 'red' : 'green'}`}>{balance === 0 ? 'Paid up' : rupees(Math.abs(balance))}</span>
          {owingSince ? (
            <span className="md-balance-sub red">
              {daysLate > 0 ? `${daysLate} day${daysLate === 1 ? '' : 's'} late` : 'Due today'} · since {fmtDate(owingSince)}
            </span>
          ) : dueDate && isActive && !isPaused && (
            <span className={`md-balance-sub ${dueLate ? 'red' : ''}`}>Next due {fmtDate(dueDate)}</span>
          )}
        </div>

        <div className="md-head-actions">
          {isActive && canAdd && (
            <button type="button" className="btn md-primary" onClick={openPayments}>
              <CheckIcon size={15} /> Record payment
            </button>
          )}
          {isActive && canAdd && biz.salesEnabled !== false && catalogue?.length > 0 && (
            <button type="button" className="btn-secondary md-sell" onClick={() => setSelling(true)}>
              <TagIcon size={15} /> Sell
            </button>
          )}
          {member.phone && balance > 0 && (
            <a
              className="btn wa md-wa"
              target="_blank"
              rel="noreferrer"
              href={waLink(member.phone, remindMsg(biz, member.name, balance) + (statementUrl ? ` See your statement: ${statementUrl}` : ''))}>
              <WhatsAppIcon size={15} /> Remind
            </a>
          )}
          {statementUrl && (
            <a
              className="btn-secondary md-share"
              target="_blank"
              rel="noreferrer"
              title="A read-only page with every due and payment. No app or login needed."
              href={member.phone
                ? waLink(member.phone, `Hi ${member.name}, here is your account statement from ${biz.name}: ${statementUrl}`)
                : statementUrl}>
              <LinkIcon size={14} /> Share statement
            </a>
          )}
        </div>
      </section>

      {/* Tabs */}
      <div className="md-tabs" role="tablist" aria-label="Member details">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`md-tab-${t.id}`}
            aria-selected={current === t.id}
            aria-controls={`md-panel-${t.id}`}
            className={`md-tab ${current === t.id ? 'on' : ''}`}
            onClick={() => setTab(t.id)}>
            {t.label}
            {t.count > 0 && <span className="md-tab-count">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="md-panel" role="tabpanel" id={`md-panel-${current}`} aria-labelledby={`md-tab-${current}`}>
        {current === 'overview' && (
          <div className="md-overview">
            <section className="analytics-card md-card">
              <h2 className="md-card-title">Details</h2>
              <dl className="md-facts">
                <div><dt>Phone</dt><dd>{member.phone ? <a href={`tel:${member.phone}`}>{member.phone}</a> : '—'}</dd></div>
                <div><dt>Plan</dt><dd>{planText}</dd></div>
                {owingSince && <div><dt>Unpaid since</dt><dd className="red">{fmtDate(owingSince)}{daysLate > 0 ? ` (${daysLate} days)` : ''}</dd></div>}
                <div><dt>Next renewal</dt><dd>{dueDate ? fmtDate(dueDate) : '—'}</dd></div>
                <div><dt>Joined</dt><dd>{fmtDate(member.joinDate)}</dd></div>
                <div><dt>Total paid</dt><dd className="green">{rupees(totalPaid)}</dd></div>
                <div><dt>Member ID</dt><dd className="mono">{member._id.slice(-6).toUpperCase()}</dd></div>
              </dl>
            </section>

            <section className="analytics-card md-card">
              <div className="md-card-head">
                <h2 className="md-card-title">Recent activity</h2>
                {ledger.length > 3 && <button type="button" className="md-link" onClick={() => setTab('payments')}>See all {ledger.length}</button>}
              </div>
              {ledger.length ? ledgerList(ledger.slice(0, 3)) : <p className="md-empty">No fees or payments yet.</p>}
            </section>

            {(statementUrl || isActive) && (
              <section className="analytics-card md-card md-manage">
                <h2 className="md-card-title">Manage</h2>
                {statementUrl && (
                  <div className="md-manage-row">
                    <span>
                      <b>Statement link</b>
                      <span>A read-only page with every due and payment, no login needed.</span>
                    </span>
                    <button
                      type="button"
                      className="btn-secondary md-small"
                      disabled={rotateShare.isPending}
                      onClick={async () => {
                        if (await confirmAction({
                          title: 'Reset the statement link?',
                          message: `The link already sent to ${member.name} will stop working. Send them the new one after this.`,
                          confirmText: 'Reset link', danger: true,
                        })) rotateShare.mutate();
                      }}>
                      Reset link
                    </button>
                  </div>
                )}
                {subscription && isActive && canEdit && (
                  <div className="md-manage-row">
                    <span>
                      <b>{isPaused ? 'Paused' : 'Pause membership'}</b>
                      <span>{isPaused ? 'No fees while paused. Resuming adds the paused days to the due date.' : 'Stops fees for a while, for example when they go home.'}</span>
                    </span>
                    <button
                      type="button"
                      className="btn-secondary md-small"
                      disabled={pauseResume.isPending}
                      onClick={() => setConfirmModal({ type: isPaused ? 'resume' : 'pause' })}>
                      {isPaused ? <><PlayIcon size={13} /> Resume</> : <><PauseIcon size={13} /> Pause</>}
                    </button>
                  </div>
                )}
                {isActive && canEdit && (
                  <div className="md-manage-row">
                    <span>
                      <b>Mark as left</b>
                      <span>No more fees are added. Their payment history is kept.</span>
                    </span>
                    <button
                      type="button"
                      className="btn-secondary md-small md-danger"
                      disabled={markLeft.isPending}
                      onClick={() => setConfirmModal({ type: 'leave' })}>
                      Mark as left
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {current === 'payments' && (
          <div className="md-payments">
            {isActive && canAdd && (
              <section className="analytics-card md-card">
                <form onSubmit={(e) => { e.preventDefault(); pay.mutate(); }}>
                  <h2 className="md-card-title">Record a payment</h2>
                  <div className="md-chips">
                    {balance > 0 && (
                      <button type="button" className="chip md-chip-main" onClick={() => setAmount(String(balance))}>
                        Full {rupees(balance)}
                      </button>
                    )}
                    {[1000, 1500, 2000, 3000, 5000].map((quick) => (
                      <button key={quick} type="button" className="chip" onClick={() => setAmount(String(quick))}>
                        {rupees(quick)}
                      </button>
                    ))}
                  </div>
                  <div className="form-grid two-col" style={{ marginBottom: 14 }}>
                    <Field label="Amount (₹)" icon={RupeeIcon}>
                      <input
                        id="md-pay-amount"
                        type="number"
                        inputMode="decimal"
                        min="1"
                        placeholder="e.g. 1500"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </Field>
                    <Field label="Paid by" icon={CreditCardIcon}>
                      <select value={mode} onChange={(e) => setMode(e.target.value)}>
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="other">Bank transfer or card</option>
                      </select>
                    </Field>
                  </div>
                  <button disabled={pay.isPending || !amount} style={{ width: '100%', justifyContent: 'center' }}>
                    <CheckIcon size={15} /> {pay.isPending ? 'Saving…' : amount ? `Save ${rupees(Number(amount))} payment` : 'Save payment'}
                  </button>
                </form>
                {pay.error && <p className="error" role="alert">{pay.error.message}</p>}
                {lastPayment && member.phone && (
                  <div className="md-receipt">
                    <CheckCircleIcon size={15} />
                    <span>Saved {rupees(lastPayment.amount)}.</span>
                    <a className="btn wa md-small" target="_blank" rel="noreferrer"
                      href={waLink(member.phone, receiptMsg)}
                      onClick={() => setLastPayment(null)}>
                      <WhatsAppIcon size={14} /> Send receipt
                    </a>
                  </div>
                )}
              </section>
            )}

            <section className="analytics-card md-card">
              <h2 className="md-card-title">History <span className="md-muted">· newest first</span></h2>
              {ledger.length ? ledgerList(ledger) : <p className="md-empty">No fees or payments yet. Fees appear here as each cycle is billed.</p>}
            </section>
          </div>
        )}

        {current === 'attendance' && showAttendance && (
          <MemberAttendance memberId={member._id} isGym={biz.type === 'gym'} machineId={member.biometricId} />
        )}

        {current === 'deposit' && isHostel && <DepositNotice member={member} />}
      </div>

      {/* Confirmation Modals */}
      <AnimatePresence>
        {selling && <SellModal biz={biz} member={{ ...member, balance }} onClose={() => setSelling(false)} />}
      </AnimatePresence>
      <ConfirmDialog
        isOpen={confirmModal?.type === 'pause'}
        onClose={() => setConfirmModal(null)}
        onConfirm={() => {
          setConfirmModal(null);
          pauseResume.mutate('pause');
        }}
        title={`Pause subscription for ${member.name}?`}
        message="No new fees while paused. The paused days are added to the next due date when you resume."
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
        message="Billing starts again from today, with the paused days added to the due date."
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
        message="No more fees will be added for them. Their payment history is kept."
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
    <Rise i={0}>
      <form className="analytics-card" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="card-header-row" style={{ marginBottom: 12 }}>
          <div>
            <h3 className="analytics-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <BuildingIcon size={17} style={{ color: 'var(--primary)' }} />
              Deposit & Notice
            </h3>
            <span className="analytics-card-subtitle">Shown on the tenant's statement link, so both sides see the same record</span>
          </div>
        </div>
        <div className="form-grid two-col deposit-grid" style={{ marginBottom: 12 }}>
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

// Last 30 days as a strip of dots: present, absent or not marked
function MemberAttendance({ memberId, isGym, machineId }) {
  const { data } = useQuery({
    queryKey: ['member-attendance', memberId],
    queryFn: () => api(`/members/${memberId}/attendance`),
  });
  if (!data) return null;
  const byDay = new Map(data.records.map((r) => [r.day, r.status]));
  const days = [];
  for (let d = new Date(`${data.from}T00:00:00Z`); d.toISOString().slice(0, 10) <= data.to; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  const fmt = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const label = { present: isGym ? 'Came in' : 'Present', absent: 'Absent' };

  return (
    <Rise i={0}>
      <div className="analytics-card">
        <div className="card-header-row" style={{ marginBottom: 10 }}>
          <div>
            <h3 className="analytics-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <CalendarIcon size={17} style={{ color: 'var(--primary)' }} />
              Attendance · last 30 days
            </h3>
            <span className="analytics-card-subtitle">
              {isGym ? `${data.present} visit${data.present === 1 ? '' : 's'}` : `Present ${data.present} · Absent ${data.absent}`}
              {data.lastPresent ? ` · last ${isGym ? 'visit' : 'present'} ${fmt(data.lastPresent)}` : ' · no attendance yet'}
              {machineId && ` · machine ID ${machineId}`}
            </span>
          </div>
        </div>
        <div className="att-strip" role="img" aria-label={`${data.present} present, ${data.absent} absent in the last 30 days`}>
          {days.map((day) => {
            const st = byDay.get(day);
            return <span key={day} className={`att-dot ${st || ''}`} title={`${fmt(day)}: ${st ? label[st] : 'Not marked'}`} />;
          })}
        </div>
        <div className="att-strip-legend muted small">
          <span>{fmt(data.from)}</span>
          <span><i className="att-dot present" /> {label.present} <i className="att-dot absent" /> Absent <i className="att-dot" /> Not marked</span>
          <span>Today</span>
        </div>
      </div>
    </Rise>
  );
}
