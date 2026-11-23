import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { api, rupees, can, DELETE } from '../api.js';
import { ChevronIcon, PlusIcon, TrashIcon, RupeeIcon, CalendarIcon, XIcon, TagIcon, EditIcon, Field, ConfirmDialog } from '../ui.jsx';

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
const CAT_ICON = { rent: '⌂', salary: '☺', electricity: 'ϟ', water: '≈', internet: '◎', maintenance: '⚙', equipment: '⚙', groceries: '◍', marketing: '✦', other: '•' };
const pct = (now, before) => (before ? Math.round(((now - before) / Math.abs(before)) * 100) : null);

// "▲ 12% vs last month" chip; good is green, bad is red
function trendChip(now, before, kind, goodWhenUp = true) {
  if (!before && !now) return null;
  const p = pct(now, before);
  if (p === null) return now ? { text: `New vs ${prevLabel[kind]}`, tone: goodWhenUp ? 'green' : 'red' } : null;
  if (!p) return { text: `Same as ${prevLabel[kind]}`, tone: 'grey' };
  const good = goodWhenUp ? p > 0 : p < 0;
  return { text: `${p > 0 ? '▲' : '▼'} ${Math.abs(p)}% vs ${prevLabel[kind]}`, tone: good ? 'green' : 'red' };
}

function Split({ rows, labels, tone, empty }) {
  const total = rows.reduce((s, [, v]) => s + v, 0);
  if (!total) return <p className="mr-empty">{empty}</p>;
  return (
    <div className="mr-split">
      {rows.sort((a, b) => b[1] - a[1]).map(([k, v], i) => (
        <div key={k} className="mr-split-row">
          <span className="mr-split-top"><span>{labels[k] || k} <span className="mr-dim">· {Math.round((v / total) * 100)}%</span></span><b>{rupees(v)}</b></span>
          <span className="mr-track"><i className={`${tone} t${i}`} style={{ width: `${Math.max(2, (v / total) * 100)}%` }} /></span>
        </div>
      ))}
    </div>
  );
}

// Profit & loss for a chosen period, plus the expenses that go into it.
// header(r, range): the page draws its title and quick actions with this period's numbers
// adding / setAdding: "Add expense" lives in the page header
// tab / setTab: 'breakdown' | 'expenses' | 'members' (the last drawn by Reports, below this)
export default function MoneyReport({ biz, header, adding: addingProp, setAdding: setAddingProp, tab = 'breakdown', setTab, whoCount }) {
  const qc = useQueryClient();
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
  const isCurrent = kind !== 'custom' && step === 0;
  const r = report || {};
  const profit = r.profit || 0;
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  // a year view stops at today and starts at the first month with any activity
  const upToNow = (r.months || []).filter((m) => m.key <= thisMonth);
  const firstActive = upToNow.findIndex((m) => m.received || m.expenses || m.pending);
  const pastMonths = firstActive < 0 ? upToNow : upToNow.slice(firstActive);
  const amt = (v) => (v ? rupees(Math.abs(v)) : '—');
  const monthName = (key) => { const [yy, mm] = key.split('-'); return `${MONTHS[Number(mm) - 1]} ${yy}`; };
  const peak = Math.max(1, ...pastMonths.map((m) => Math.max(m.received || 0, m.expenses || 0, m.pending || 0)));
  const collectedPct = r.billed ? Math.round(((r.billed - (r.pending || 0)) / r.billed) * 100) : null;

  const cards = [
    {
      key: 'in', label: 'Received', value: rupees(r.received), tone: 'green', ink: r.received ? 'green' : '', icon: '↓',
      note: `from ${r.paymentCount || 0} payment${r.paymentCount === 1 ? '' : 's'}`,
      chip: r.previous && trendChip(r.received || 0, r.previous.received || 0, kind),
    },
    {
      key: 'out', label: 'Spent', value: rupees(r.expenses), tone: 'red', ink: '', icon: '↑',
      note: expenses.length ? `${expenses.length} expense${expenses.length === 1 ? '' : 's'}` : 'no expenses added',
      chip: r.previous && r.expenses > 0 && trendChip(r.expenses || 0, r.previous.expenses || 0, kind, false),
    },
    {
      key: 'profit', label: profit < 0 ? 'Loss' : 'Profit', value: `${profit < 0 ? '−' : ''}${rupees(Math.abs(profit))}`, tone: 'violet', ink: profit < 0 ? 'red' : '', icon: '₹',
      note: 'received minus spent',
      chip: profit < 0 ? { text: 'Spent more than came in', tone: 'red' } : r.received > 0 ? { text: `${Math.round((profit / r.received) * 100)}% margin`, tone: 'violet' } : null,
    },
    {
      key: 'owe', label: 'Still to collect', value: rupees(r.pending), tone: 'amber', ink: r.pending ? 'red' : 'green', icon: '!',
      note: r.billed ? `of ${rupees(r.billed)} in fees` : 'no fees fell in this period',
      chip: collectedPct !== null ? { text: `${collectedPct}% collected`, tone: collectedPct === 100 ? 'green' : 'amber' } : null,
    },
  ];

  const tabs = [
    ['breakdown', 'Overview', null],
    ['expenses', 'Expenses', expenses.length],
    ['members', 'Who paid', whoCount],
  ];

  return (
    <section className="money-report mr" aria-label="Profit and loss">
      {header?.(r, { ...range, isCurrent, valid })}

      {/* period: one quiet row */}
      <div className="mr-period">
        <div className="mr-seg" role="tablist" aria-label="Report period">
          {[['month', 'Month'], ['quarter', 'Quarter'], ['year', 'Year'], ['custom', 'Custom']].map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k}
              className={kind === k ? 'on' : ''} onClick={() => { setKind(k); setStep(0); }}>
              {label}
            </button>
          ))}
        </div>
        {kind === 'custom' ? (
          <div className="mr-custom">
            <label><span>From</span><input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></label>
            <label><span>To</span><input type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></label>
          </div>
        ) : (
          <div className="mr-stepper">
            <button type="button" className="mr-step" aria-label="Previous period" onClick={() => setStep(step - 1)}>
              <ChevronIcon size={16} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <span className="mr-range"><b>{range.label}</b><span>{fmtDay(range.from)} – {fmtDay(range.to)}</span></span>
            <button type="button" className="mr-step" aria-label="Next period" disabled={step >= 0} onClick={() => setStep(step + 1)}>
              <ChevronIcon size={16} />
            </button>
          </div>
        )}
      </div>

      {!valid ? (
        <p className="error">Pick a start date on or before the end date.</p>
      ) : (
        <>
          {/* the four numbers, Collect icon-card style */}
          <div className={`mr-cards ${isLoading ? 'loading' : ''}`}>
            {cards.map((c) => (
              <div key={c.key} className={`mr-card mr-card-${c.key}`}>
                <span className="mr-card-main">
                  <span className={`db-today-icon ${c.tone}`} aria-hidden="true">{c.icon}</span>
                  <span className="mr-card-text">
                    <span className="db-label">{c.label}</span>
                    <b className={c.ink}>{c.value}</b>
                  </span>
                </span>
                <span className="mr-card-foot">
                  <span>{c.note}</span>
                  {c.chip && <span className={`mr-chip ${c.chip.tone}`}>{c.chip.text}</span>}
                </span>
              </div>
            ))}
          </div>
          {isFuture && <p className="mr-empty">This period hasn't started yet.</p>}

          {setTab && (
            <div className="db-tabs mr-tabs" role="tablist" aria-label="Report details">
              {tabs.map(([key, label, count]) => (
                <button key={key} type="button" role="tab" aria-selected={tab === key} className={`db-tab ${tab === key ? 'on' : ''}`} onClick={() => setTab(key)}>
                  {label}
                  {count > 0 && <span className="db-tab-count">{count}</span>}
                </button>
              ))}
            </div>
          )}

          {tab === 'breakdown' && (
            <div className="mr-overview">
              <section className="mr-box mr-months">
                <div className="mr-box-head">
                  <h3>Month by month</h3>
                  <span className="mr-legend"><span><i className="in" />Received</span><span><i className="out" />Spent</span><span><i className="owe" />Still owed</span></span>
                </div>
                {pastMonths.length === 0 || !(pastMonths.some((m) => m.received || m.expenses || m.pending)) ? (
                  <p className="mr-empty">Nothing received, spent or owed in this period yet.</p>
                ) : (
                  <>
                    <div className="mr-chart" style={{ gridTemplateColumns: `repeat(${pastMonths.length}, minmax(0, 1fr))` }} aria-hidden="true">
                      {pastMonths.map((m) => (
                        <div key={m.key} className="mr-chart-col">
                          <span className="mr-chart-bars">
                            <i className="in" style={{ height: `${((m.received || 0) / peak) * 100}%` }} />
                            <i className="out" style={{ height: `${((m.expenses || 0) / peak) * 100}%` }} />
                            <i className="owe" style={{ height: `${((m.pending || 0) / peak) * 100}%` }} />
                          </span>
                          <span className="mr-chart-label">{MONTHS[Number(m.key.split('-')[1]) - 1]}</span>
                        </div>
                      ))}
                    </div>
                    <table className="mr-table">
                      <thead><tr><th>Month</th><th>Received</th><th>Spent</th><th>Profit</th><th>Still owed</th></tr></thead>
                      <tbody>
                        {pastMonths.map((m) => (
                          <tr key={m.key}>
                            <td>{monthName(m.key)}</td>
                            <td className={m.received ? 'green' : 'dim'}>{amt(m.received)}</td>
                            <td className={m.expenses ? 'red' : 'dim'}>{amt(m.expenses)}</td>
                            <td className={m.profit < 0 ? 'red strong' : m.profit ? 'strong' : 'dim'}>{m.profit < 0 ? '−' : ''}{amt(m.profit)}</td>
                            <td className={m.pending ? 'amber' : 'dim'}>{amt(m.pending)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {/* phones: one short line per month */}
                    <div className="mr-mlist">
                      {pastMonths.map((m) => {
                        const big = Math.max(1, m.received || 0, m.expenses || 0);
                        return (
                          <div key={m.key} className="mr-mrow">
                            <span className="mr-mrow-top"><b>{monthName(m.key)}</b><b className={m.profit < 0 ? 'red' : ''}>{m.profit < 0 ? '−' : ''}{amt(m.profit)} <span className="mr-dim">{m.profit < 0 ? 'loss' : 'profit'}</span></b></span>
                            <span className="mr-track two"><i className="in" style={{ width: `${((m.received || 0) / big) * 100}%` }} /><i className="out" style={{ width: `${((m.expenses || 0) / big) * 100}%` }} /></span>
                            <span className="mr-mrow-sub"><span className="green">In {amt(m.received)}</span><span className="red">Out {amt(m.expenses)}</span><span className="amber">Owed {amt(m.pending)}</span></span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>

              <div className="mr-side">
                <section className="mr-box">
                  <div className="mr-box-head"><h3>How members paid</h3></div>
                  <Split rows={Object.entries(r.byMode || {})} labels={MODES} tone="mode" empty="No payments in this period yet." />
                </section>
                <section className="mr-box">
                  <div className="mr-box-head">
                    <h3>Where money went</h3>
                    <button type="button" className="mr-link" onClick={() => setAdding(true)}><PlusIcon size={13} /> Add expense</button>
                  </div>
                  {Object.values(r.byCategory || {}).some(Boolean) ? (
                    <div className="mr-cats">
                      {Object.entries(r.byCategory).filter(([, v]) => v).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                        <div key={k} className="mr-cat"><span className="mr-cat-icon" aria-hidden="true">{CAT_ICON[k] || '•'}</span><span className="grow">{EXPENSE_CATEGORIES[k] || k}</span><b>−{rupees(v)}</b></div>
                      ))}
                    </div>
                  ) : <p className="mr-empty">No expenses in this period. Add rent, salaries and bills to see your real profit.</p>}
                </section>
              </div>
            </div>
          )}

          {tab === 'expenses' && (
            <section className="mr-box mr-expenses">
              <div className="mr-box-head">
                <h3>Expenses <span className="mr-dim">· rent, salaries, bills paid in this period</span></h3>
                <button type="button" className="mr-link" onClick={() => setAdding(true)}><PlusIcon size={13} /> Add expense</button>
              </div>
              {expenses.length ? (
                <div className="mr-exp-list">
                  {expenses.map((e) => (
                    <div key={e._id} className="mr-exp">
                      <span className="mr-cat-icon" aria-hidden="true">{CAT_ICON[e.category] || '•'}</span>
                      <span className="grow mr-exp-text">
                        <b>{e.category === 'other' && e.label ? e.label : EXPENSE_CATEGORIES[e.category] || e.category}</b>
                        <span>{fmtDay(e.date)}{e.note ? ` · ${e.note}` : ''}</span>
                      </span>
                      <b className="red">−{rupees(e.amount)}</b>
                      {can(biz, DELETE) && (
                        <button type="button" className="mr-del" aria-label={`Delete ${e.category} expense of ${rupees(e.amount)}`} onClick={() => setDeleting(e)}>
                          <TrashIcon size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mr-empty">No expenses recorded in this period.</p>
              )}
            </section>
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
