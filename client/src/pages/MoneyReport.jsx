import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { api, rupees, userId } from '../api.js';
import { ChevronIcon, PlusIcon, TrashIcon, RupeeIcon, CalendarIcon, XIcon, TagIcon, EditIcon, Field, ConfirmDialog, BarChartIcon, UsersIcon } from '../ui.jsx';

export const EXPENSE_CATEGORIES = {
  rent: 'Rent',
  salary: 'Salaries',
  electricity: 'Electricity',
  water: 'Water',
  internet: 'Internet / phone',
  maintenance: 'Repairs & maintenance',
  equipment: 'Equipment',
  groceries: 'Groceries / food',
  marketing: 'Marketing',
  other: 'Other',
};
const MODES = { cash: 'Cash', upi: 'UPI', other: 'Bank / card' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayEnd = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtDay = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// The period `step` units back (negative) or forward from today, in the owner's local time.
// Quarters and years follow India's financial year: Apr–Jun, Jul–Sep, Oct–Dec, Jan–Mar; Apr–Mar.
export function periodRange(kind, step, now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth();
  if (kind === 'month') {
    const from = new Date(y, m + step, 1);
    return { from, to: dayEnd(new Date(y, m + step + 1, 0)), label: `${MONTHS[from.getMonth()]} ${from.getFullYear()}` };
  }
  if (kind === 'quarter') {
    const from = new Date(y, m - (m % 3) + step * 3, 1);
    const to = dayEnd(new Date(from.getFullYear(), from.getMonth() + 3, 0));
    return { from, to, label: `${MONTHS[from.getMonth()]}–${MONTHS[to.getMonth()]} ${to.getFullYear()}` };
  }
  const fyStart = (m >= 3 ? y : y - 1) + step;
  return {
    from: new Date(fyStart, 3, 1),
    to: dayEnd(new Date(fyStart + 1, 2, 31)),
    label: `FY ${fyStart}–${String(fyStart + 1).slice(-2)}`,
  };
}

const prevLabel = { month: 'last month', quarter: 'last quarter', year: 'last year', custom: 'previous period' };

function Change({ now, before, kind, goodWhenUp = true }) {
  if (!before && !now) return null;
  const diff = now - before;
  if (!diff) return <span className="money-change">Same as {prevLabel[kind]}</span>;
  const good = goodWhenUp ? diff > 0 : diff < 0;
  return (
    <span className={`money-change ${good ? 'good' : 'bad'}`}>
      {diff > 0 ? '▲' : '▼'} {rupees(Math.abs(diff))} vs {prevLabel[kind]}
    </span>
  );
}

function Bars({ rows, labels, tone }) {
  const total = rows.reduce((s, [, v]) => s + v, 0);
  if (!total) return <p className="muted small" style={{ margin: '6px 0 0' }}>Nothing yet in this period.</p>;
  return (
    <div className="money-bars">
      {rows.sort((a, b) => b[1] - a[1]).map(([k, v]) => (
        <div key={k} className="money-bar-row">
          <span>{labels[k] || k}</span>
          <div className="money-bar"><i className={tone} style={{ width: `${Math.max(2, (v / total) * 100)}%` }} /></div>
          <b>{rupees(v)}</b>
        </div>
      ))}
    </div>
  );
}

// Profit & loss for a chosen period, plus the expenses that go into it.
// adding / setAdding: the Reports header owns the "Add expense" button
// tab / setTab: which detail shows under the cards ('breakdown' | 'expenses' | 'members', the last drawn by Reports)
export default function MoneyReport({ biz, adding: addingProp, setAdding: setAddingProp, tab = 'breakdown', setTab }) {
  const qc = useQueryClient();
  const isOwner = biz.ownerId === userId();
  const [kind, setKind] = useState('month'); // 'month' | 'quarter' | 'year' | 'custom'
  const [step, setStep] = useState(0);
  const [custom, setCustom] = useState(() => {
    const now = new Date();
    return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDay(now) };
  });
  const [addingLocal, setAddingLocal] = useState(false);
  const adding = addingProp ?? addingLocal;
  const setAdding = setAddingProp ?? setAddingLocal;
  const [deleting, setDeleting] = useState(null);

  const range = kind === 'custom'
    ? { from: dayStart(new Date(`${custom.from}T00:00`)), to: dayEnd(new Date(`${custom.to}T00:00`)), label: `${fmtDay(`${custom.from}T00:00`)} – ${fmtDay(`${custom.to}T00:00`)}` }
    : periodRange(kind, step);
  const valid = !isNaN(range.from) && !isNaN(range.to) && range.from <= range.to;
  const qs = `from=${range.from.toISOString()}&to=${valid ? range.to.toISOString() : ''}&tz=${new Date().getTimezoneOffset()}`;

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', biz._id, qs],
    queryFn: () => api(`/businesses/${biz._id}/report?${qs}`),
    enabled: valid,
    placeholderData: (prev) => prev,
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', biz._id, qs],
    queryFn: () => api(`/businesses/${biz._id}/expenses?from=${range.from.toISOString()}&to=${range.to.toISOString()}`),
    enabled: valid,
  });

  const remove = useMutation({
    mutationFn: (id) => api(`/businesses/${biz._id}/expenses/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report', biz._id] });
      qc.invalidateQueries({ queryKey: ['expenses', biz._id] });
    },
  });

  const isFuture = kind !== 'custom' && range.from > new Date();
  const r = report || {};
  const profit = r.profit || 0;
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  // a year view stops at today and starts at the first month with any activity
  const upToNow = (r.months || []).filter((m) => m.key <= thisMonth);
  const firstActive = upToNow.findIndex((m) => m.received || m.expenses || m.pending);
  const pastMonths = firstActive < 0 ? upToNow : upToNow.slice(firstActive);
  const amt = (v) => (v ? rupees(Math.abs(v)) : '—');

  return (
    <section className="money-report" aria-label="Profit and loss">
      {/* Period picker */}
      <div className="analytics-card money-period">
        <div className="money-tabs" role="tablist" aria-label="Report period">
          {[['month', 'Month'], ['quarter', 'Quarter'], ['year', 'Year'], ['custom', 'Custom']].map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k}
              className={kind === k ? 'active' : ''} onClick={() => { setKind(k); setStep(0); }}>
              {label}
            </button>
          ))}
        </div>
        {kind === 'custom' ? (
          <div className="money-custom">
            <Field label="From" icon={CalendarIcon}>
              <input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
            </Field>
            <Field label="To" icon={CalendarIcon}>
              <input type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
            </Field>
          </div>
        ) : (
          <div className="money-stepper">
            <button type="button" className="btn-secondary" aria-label="Previous period" onClick={() => setStep(step - 1)}>
              <ChevronIcon size={16} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <div className="money-stepper-label">
              <b>{range.label}</b>
              <span className="muted small">{fmtDay(range.from)} – {fmtDay(range.to)}</span>
            </div>
            <button type="button" className="btn-secondary" aria-label="Next period" disabled={step >= 0} onClick={() => setStep(step + 1)}>
              <ChevronIcon size={16} />
            </button>
          </div>
        )}
      </div>

      {!valid ? (
        <p className="error">Pick a start date on or before the end date.</p>
      ) : (
        <>
          {/* The four numbers */}
          <div className={`money-cards ${isLoading ? 'loading' : ''}`}>
            <div className="money-card">
              <span className="money-label">Received</span>
              <b className={r.received ? 'green-text' : ''}>{rupees(r.received)}</b>
              <span className="muted small">from {r.paymentCount || 0} payment{r.paymentCount === 1 ? '' : 's'}</span>
              {r.previous && <Change now={r.received} before={r.previous.received} kind={kind} />}
            </div>
            <div className="money-card">
              <span className="money-label">Spent</span>
              <b className={r.expenses ? 'red-text' : ''}>{rupees(r.expenses)}</b>
              <span className="muted small">{expenses.length ? `on ${expenses.length} expense${expenses.length === 1 ? '' : 's'}` : 'no expenses added'}</span>
              {r.previous && r.expenses > 0 && <Change now={r.expenses} before={r.previous.expenses} kind={kind} goodWhenUp={false} />}
            </div>
            <div className={`money-card wide ${profit < 0 ? 'loss' : 'profit'}`}>
              <span className="money-label">{profit < 0 ? 'Loss' : 'Profit'}</span>
              <b>{profit < 0 ? '−' : ''}{rupees(Math.abs(profit))}</b>
              <span className="muted small">received minus spent</span>
              {r.previous && <Change now={profit} before={r.previous.profit} kind={kind} />}
            </div>
            <div className="money-card wide">
              <span className="money-label">Still to collect</span>
              <b className={r.pending ? 'amber-text' : ''}>{rupees(r.pending)}</b>
              <span className="muted small">
                {r.billed ? `of ${rupees(r.billed)} in fees for this period` : 'no fees fell in this period'}
              </span>
              {r.pendingNow > r.pending && <span className="muted small">{rupees(r.pendingNow)} owed in total</span>}
            </div>
          </div>
          {isFuture && <p className="muted small">This period hasn't started yet.</p>}

          {/* the details, one tab at a time */}
          {setTab && (
            <div className="settings-tabs report-tabs" role="tablist" aria-label="Report details">
              {[
                ['breakdown', 'Breakdown', BarChartIcon],
                ['expenses', `Expenses${expenses.length ? ` (${expenses.length})` : ''}`, RupeeIcon],
                ['members', 'Who paid', UsersIcon],
              ].map(([key, label, Icon]) => (
                <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>
          )}

          {tab === 'breakdown' && !(pastMonths.length > 1) && !(r.received > 0 || r.expenses > 0) && (
            <p className="settings-note">Nothing received or spent in this period yet.</p>
          )}

          {/* Month by month (longer periods) */}
          {tab === 'breakdown' && pastMonths.length > 1 && (
            <div className="analytics-card">
              <h3 className="analytics-card-title">Month by month</h3>
              <div className="money-months">
                <div className="money-month head"><span>Month</span><span>Received</span><span>Spent</span><span>Profit</span><span>To collect</span></div>
                {pastMonths.map((m) => {
                  const [yy, mm] = m.key.split('-');
                  return (
                    <div key={m.key} className="money-month">
                      <span>{MONTHS[Number(mm) - 1]} {yy}</span>
                      <span className={m.received ? 'green-text' : 'muted'}>{amt(m.received)}</span>
                      <span className={m.expenses ? 'red-text' : 'muted'}>{amt(m.expenses)}</span>
                      <b className={m.profit < 0 ? 'red-text' : m.profit ? '' : 'muted'}>{m.profit < 0 ? '−' : ''}{amt(m.profit)}</b>
                      <span className={m.pending ? 'amber-text' : 'muted'}>{amt(m.pending)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Where money came from and went, side by side in one card */}
          {tab === 'breakdown' && (r.received > 0 || r.expenses > 0) && (
            <div className="analytics-card money-splits">
              <div>
                <h3 className="analytics-card-title">How members paid</h3>
                <Bars rows={Object.entries(r.byMode || {})} labels={MODES} tone="in" />
              </div>
              <div>
                <h3 className="analytics-card-title">Where money went</h3>
                <Bars rows={Object.entries(r.byCategory || {})} labels={EXPENSE_CATEGORIES} tone="out" />
              </div>
            </div>
          )}

          {/* Expenses */}
          {tab === 'expenses' && (
          <div className="analytics-card">
            <div className="card-header-row" style={{ marginBottom: 6 }}>
              <div>
                <h3 className="analytics-card-title">Expenses</h3>
                <span className="analytics-card-subtitle">Rent, salaries, bills: what you paid in this period</span>
              </div>
            </div>
            {expenses.length ? (
              <div className="money-expenses">
                {expenses.map((e) => (
                  <div key={e._id} className="money-expense">
                    <div className="grow" style={{ minWidth: 0 }}>
                      <b>{e.category === 'other' && e.label ? e.label : EXPENSE_CATEGORIES[e.category] || e.category}</b>
                      <span className="muted small">{fmtDay(e.date)}{e.note ? ` · ${e.note}` : ''}</span>
                    </div>
                    <b className="red-text">−{rupees(e.amount)}</b>
                    {isOwner && (
                      <button type="button" className="icon-btn" aria-label={`Delete ${e.category} expense of ${rupees(e.amount)}`}
                        onClick={() => setDeleting(e)}>
                        <TrashIcon size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted small" style={{ margin: '8px 0 4px' }}>No expenses recorded in this period. Use “Add expense” at the top.</p>
            )}
          </div>
          )}
        </>
      )}

      <AnimatePresence>
        {adding && (
          <AddExpense biz={biz} onClose={() => setAdding(false)} onSaved={() => {
            setAdding(false);
            qc.invalidateQueries({ queryKey: ['report', biz._id] });
            qc.invalidateQueries({ queryKey: ['expenses', biz._id] });
          }} />
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => { remove.mutate(deleting._id); setDeleting(null); }}
        title={`Delete this ${rupees(deleting?.amount)} expense?`}
        message="It will be removed from your expenses and profit for that period."
        confirmText="Delete Expense"
        danger
        icon={TrashIcon}
        busy={remove.isPending}
      />
    </section>
  );
}

// also opened from the home screen
export function AddExpense({ biz, onClose, onSaved }) {
  const [form, setForm] = useState({ amount: '', category: 'rent', label: '', date: isoDay(new Date()), note: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isOther = form.category === 'other';
  const ready = Number(form.amount) > 0 && (!isOther || form.label.trim());
  const save = useMutation({
    mutationFn: () => api(`/businesses/${biz._id}/expenses`, {
      method: 'POST',
      body: {
        amount: Number(form.amount),
        category: form.category,
        label: isOther ? form.label.trim() : undefined,
        note: form.note,
        // noon local time, so the date can't slip into the previous day in any timezone
        date: new Date(`${form.date}T12:00`).toISOString(),
      },
    }),
    onSuccess: onSaved,
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.form
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="modal-content"
        style={{ maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (ready) save.mutate(); }}>
        <div className="form-header" style={{ marginBottom: 18 }}>
          <h3 className="form-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RupeeIcon size={17} style={{ color: 'var(--red)' }} /> Add expense
          </h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><XIcon size={14} /></button>
        </div>

        <div className="expense-form">
          <Field label="Amount (₹) *" icon={RupeeIcon}>
            <input type="number" inputMode="decimal" min="1" required autoFocus value={form.amount} onChange={set('amount')} placeholder="e.g. 15000" />
          </Field>
          <Field label="What for *" icon={TagIcon}>
            <select value={form.category} onChange={set('category')}>
              {Object.entries(EXPENSE_CATEGORIES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </Field>
          {isOther && (
            <Field label="What was it for? *" icon={EditIcon}>
              <input required autoFocus maxLength={40} value={form.label} onChange={set('label')} placeholder="e.g. Generator diesel" />
            </Field>
          )}
          <Field label="Date *" icon={CalendarIcon}>
            <input type="date" required value={form.date} max={isoDay(new Date())} onChange={set('date')} />
          </Field>
          <Field label="Note (optional)" icon={EditIcon}>
            <input value={form.note} onChange={set('note')} placeholder="e.g. October rent, 2nd floor" />
          </Field>
        </div>

        {save.error && <p className="error" role="alert" style={{ marginTop: 12 }}>{save.error.message}</p>}
        <div className="expense-form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button disabled={save.isPending || !ready}>{save.isPending ? 'Saving…' : 'Save expense'}</button>
        </div>
      </motion.form>
    </div>
  );
}
