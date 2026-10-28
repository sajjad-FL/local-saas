// Pure report maths: everything here takes plain arrays, so it is unit-tested in test.js.

// Calendar month key ("2026-10") of a date as seen in the owner's timezone.
// tzOffset is what the browser's getTimezoneOffset() returns (IST = -330).
export function monthKey(date, tzOffset = 0) {
  const d = new Date(new Date(date).getTime() - tzOffset * 60000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Every month key from `from` to `to`, inclusive, in the owner's timezone
export function monthsBetween(from, to, tzOffset = 0) {
  const keys = [];
  let [y, m] = monthKey(from, tzOffset).split('-').map(Number);
  const [ey, em] = monthKey(to, tzOffset).split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
    if (++m > 12) { m = 1; y++; }
  }
  return keys;
}

const inRange = (date, from, to) => {
  const t = new Date(date).getTime();
  return t >= from.getTime() && t <= to.getTime();
};
const sumBy = (rows, keyOf) => {
  const out = {};
  for (const r of rows) {
    const k = keyOf(r) || 'other';
    out[k] = (out[k] || 0) + r.amount;
  }
  return out;
};
// an 'other' expense the owner named ("Generator diesel") is reported under that name
export const expenseKey = (e) => (e.category === 'other' && e.label ? e.label : e.category);

// Cash-basis summary of one period.
//   received: payments dated in the period
//   expenses: expenses dated in the period
//   profit:   received − expenses (negative = loss)
//   billed / pending: fees for cycles that started in the period, and what is still unpaid of them
// `remaining(due)` returns what is still owed on a due after payments are allocated.
export function summarizePeriod({ payments, expenses, dues, remaining, from, to, tzOffset = 0 }) {
  const p = payments.filter((x) => inRange(x.date, from, to));
  const e = expenses.filter((x) => inRange(x.date, from, to));
  const d = dues.filter((x) => inRange(x.dueDate, from, to));
  const received = p.reduce((s, x) => s + x.amount, 0);
  const spent = e.reduce((s, x) => s + x.amount, 0);

  const months = monthsBetween(from, to, tzOffset).map((key) => ({ key, received: 0, expenses: 0, profit: 0, pending: 0 }));
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const x of p) { const m = byKey.get(monthKey(x.date, tzOffset)); if (m) m.received += x.amount; }
  for (const x of e) { const m = byKey.get(monthKey(x.date, tzOffset)); if (m) m.expenses += x.amount; }
  for (const x of d) { const m = byKey.get(monthKey(x.dueDate, tzOffset)); if (m) m.pending += remaining(x); }
  for (const m of months) m.profit = m.received - m.expenses;

  return {
    received,
    expenses: spent,
    profit: received - spent,
    billed: d.reduce((s, x) => s + x.amount, 0),
    pending: d.reduce((s, x) => s + remaining(x), 0),
    paymentCount: p.length,
    byMode: sumBy(p, (x) => x.mode),
    byCategory: sumBy(e, expenseKey),
    months,
  };
}
