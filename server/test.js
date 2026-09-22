import assert from 'node:assert';
import { dueStatuses, rollForward, csv } from './src/services/billingService.js';

// payment allocation: oldest due first, partials and advances
const dues = [{ amount: 100 }, { amount: 100 }];
assert.deepEqual(dueStatuses(dues, 0), ['unpaid', 'unpaid']);
assert.deepEqual(dueStatuses(dues, 100), ['paid', 'unpaid']);
assert.deepEqual(dueStatuses(dues, 150), ['paid', 'partial']);
assert.deepEqual(dueStatuses(dues, 250), ['paid', 'paid']); // overpaid = advance
assert.deepEqual(dueStatuses([], 500), []);

// cycle roll: catches up multiple missed cycles, no-op when period is current
const periods = rollForward(new Date('2026-01-01'), 30, new Date('2026-02-15'));
assert.equal(periods.length, 2);
assert.deepEqual(periods[0], { periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31') });
assert.deepEqual(periods[1].periodEnd, new Date('2026-03-02'));
assert.equal(rollForward(new Date('2026-01-01'), 30, new Date('2025-12-31')).length, 0);

// csv: quoting, escaped quotes, null-safe
assert.equal(csv([['a', 'b"c'], [1, null]]), '"a","b""c"\r\n"1",""');

console.log('all checks passed');
