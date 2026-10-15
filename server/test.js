import assert from 'node:assert';
import { dueStatuses, dueRemaining, rollForward, addPlanCycle, ledger, csv } from './src/services/billingService.js';

const utc = (s) => new Date(`${s}T00:00:00.000Z`);

// payment allocation: oldest due first, partials and advances
const dues = [{ amount: 100 }, { amount: 100 }];
assert.deepEqual(dueStatuses(dues, 0), ['unpaid', 'unpaid']);
assert.deepEqual(dueStatuses(dues, 100), ['paid', 'unpaid']);
assert.deepEqual(dueStatuses(dues, 150), ['paid', 'partial']);
assert.deepEqual(dueStatuses(dues, 250), ['paid', 'paid']); // overpaid = advance
assert.deepEqual(dueStatuses([], 500), []);
assert.deepEqual(dueRemaining(dues, 150), [0, 50]);
assert.deepEqual(dueRemaining(dues, 0), [100, 100]);
assert.deepEqual(dueRemaining(dues, 999), [0, 0]);

// cycle roll: catches up multiple missed cycles, no-op when period is current
const periods = rollForward(utc('2026-01-01'), 30, utc('2026-02-15'));
assert.equal(periods.length, 2);
assert.deepEqual(periods[0], { periodStart: utc('2026-01-01'), periodEnd: utc('2026-02-01') });
assert.deepEqual(periods[1].periodEnd, utc('2026-03-01'));
assert.equal(rollForward(utc('2026-01-01'), 30, utc('2025-12-31')).length, 0);

// month-end: clamp to the short month, then snap back to the anchor day (no Jan 31 → Mar 3)
assert.deepEqual(addPlanCycle(utc('2026-01-31'), 30), utc('2026-02-28'));
assert.deepEqual(addPlanCycle(utc('2028-01-31'), 30), utc('2028-02-29')); // leap year
const monthEnd = rollForward(utc('2026-01-31'), 30, utc('2026-04-15'), 31).map((p) => p.periodEnd);
assert.deepEqual(monthEnd, [utc('2026-02-28'), utc('2026-03-31'), utc('2026-04-30')]);
assert.deepEqual(addPlanCycle(utc('2026-11-30'), 90), utc('2027-02-28')); // quarterly across a year
assert.deepEqual(addPlanCycle(utc('2028-02-29'), 365), utc('2029-02-28')); // yearly from leap day

// day-count cycles stay plain day counts
assert.deepEqual(addPlanCycle(utc('2026-01-01'), 7), utc('2026-01-08'));
assert.deepEqual(addPlanCycle(utc('2026-02-25'), 15), utc('2026-03-12'));

// ledger: oldest first, running balance, same-day due before the payment that clears it
const rows = ledger(
  [{ _id: 'd1', dueDate: utc('2026-01-01'), amount: 1000 }, { _id: 'd2', dueDate: utc('2026-02-01'), amount: 1000 }],
  [{ _id: 'p1', date: utc('2026-02-01'), amount: 1500, mode: 'upi' }, { _id: 'p0', date: utc('2026-01-05'), amount: 400 }],
);
assert.deepEqual(rows.map((r) => r.id), ['d1', 'p0', 'd2', 'p1']);
assert.deepEqual(rows.map((r) => r.balance), [1000, 600, 1600, 100]);
assert.deepEqual(ledger([], []), []);

// csv: quoting, escaped quotes, null-safe
assert.equal(csv([['a', 'b"c'], [1, null]]), '"a","b""c"\r\n"1",""');

console.log('all checks passed');
