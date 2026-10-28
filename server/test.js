import assert from 'node:assert';
import { dueStatuses, dueRemaining, rollForward, addPlanCycle, ledger, csv } from './src/services/billingService.js';
import { summarizePeriod, monthsBetween } from './src/services/reportService.js';
import { localDay, addDays, phoneKey, summarize as summarizeAttendance, isDay, detectColumns, findHeaderRow, parseWallTime, wallToUtc, buildPunches, firstPunchPerDay } from './src/services/attendanceService.js';

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

// money report: received − expenses = profit; pending is what's still unpaid of the period's fees
{
  const IST = -330; // getTimezoneOffset() in India
  const from = new Date('2026-09-30T18:30:00Z'); // 1 Oct 00:00 IST
  const to = new Date('2026-11-30T18:29:59Z');   // 30 Nov 23:59 IST
  const r = summarizePeriod({
    payments: [
      { amount: 1500, date: new Date('2026-10-05T10:00:00Z'), mode: 'upi' },
      { amount: 500, date: new Date('2026-10-31T19:00:00Z'), mode: 'cash' }, // 1 Nov 00:30 IST: November
      { amount: 999, date: new Date('2026-09-15T10:00:00Z'), mode: 'cash' }, // before the period
    ],
    expenses: [
      { amount: 3000, date: new Date('2026-10-01T05:00:00Z'), category: 'rent' },
      { amount: 200, date: new Date('2026-11-10T05:00:00Z') },
      { amount: 700, date: new Date('2026-11-11T05:00:00Z'), category: 'other', label: 'Generator diesel' },
    ],
    dues: [{ _id: 'a', amount: 1500, dueDate: new Date('2026-10-01T00:00:00Z') }, { _id: 'b', amount: 1500, dueDate: new Date('2026-11-01T00:00:00Z') }],
    remaining: (d) => (d._id === 'b' ? 1000 : 0),
    from, to, tzOffset: IST,
  });
  assert.equal(r.received, 2000);
  assert.equal(r.expenses, 3900);
  assert.equal(r.profit, -1900); // a loss
  assert.equal(r.billed, 3000);
  assert.equal(r.pending, 1000);
  assert.deepEqual(r.byMode, { upi: 1500, cash: 500 });
  assert.deepEqual(r.byCategory, { rent: 3000, other: 200, 'Generator diesel': 700 });
  assert.deepEqual(r.months, [
    { key: '2026-10', received: 1500, expenses: 3000, profit: -1500, pending: 0 },
    { key: '2026-11', received: 500, expenses: 900, profit: -400, pending: 1000 },
  ]);
  assert.deepEqual(monthsBetween(new Date('2026-11-15T00:00:00Z'), new Date('2027-02-01T00:00:00Z')), ['2026-11', '2026-12', '2027-01', '2027-02']);
}

// attendance: days in the business's timezone, phone matching, counts
assert.equal(localDay(new Date('2026-10-15T19:00:00Z'), 'Asia/Kolkata'), '2026-10-16'); // 00:30 IST next day
assert.equal(localDay(new Date('2026-10-15T18:00:00Z'), 'Asia/Kolkata'), '2026-10-15'); // 23:30 IST
assert.equal(addDays('2026-10-01', -1), '2026-09-30');
assert.equal(addDays('2028-02-28', 1), '2028-02-29');
assert.equal(phoneKey('+91 98765-43210'), '9876543210');
assert.equal(phoneKey('09876543210'), '9876543210');
assert.equal(phoneKey(null), '');
assert.ok(isDay('2026-10-16') && !isDay('2026-13-01') && !isDay('16-10-2026') && !isDay(undefined));
assert.deepEqual(
  summarizeAttendance([
    { day: '2026-10-01', status: 'present' }, { day: '2026-10-02', status: 'absent' },
    { day: '2026-10-05', status: 'present' }, { day: '2026-09-30', status: 'present' },
  ], '2026-10-01', '2026-10-31'),
  { present: 2, absent: 1, marked: 3, lastPresent: '2026-10-05' },
);

// biometric exports: column detection across eSSL / ZKTeco layouts, Indian dates, first punch a day
{
  // eSSL-style log with title rows above the table
  const essl = [
    ['KK Fitness'], ['Attendance Logs 01/10/2026 - 16/10/2026'], [],
    ['Sr No', 'Employee Code', 'Employee Name', 'Log Date Time', 'Direction'],
    ['1', '17', 'Sajjad', '16/10/2026 06:42:10', 'in'],
    ['2', '17', 'Sajjad', '16/10/2026 07:55:00', 'out'],
    ['3', '4', 'Ravi Kumar', '15/10/2026 05:58 PM', 'in'],
    ['4', '', '', '', ''],
    ['5', '9', 'Bad Row', 'not a date', 'in'],
  ];
  const h = findHeaderRow(essl);
  assert.equal(h, 3);
  const cols = detectColumns(essl[h]);
  assert.deepEqual([cols.id, cols.name, cols.datetime], [1, 2, 3]);
  const { punches, skipped } = buildPunches(essl.slice(h + 1), cols, 'Asia/Kolkata');
  assert.equal(punches.length, 3);
  assert.equal(skipped, 1); // the unreadable date; the blank row isn't counted
  assert.equal(punches[0].day, '2026-10-16');
  assert.equal(punches[0].at.toISOString(), '2026-10-16T01:12:10.000Z'); // 06:42 IST
  assert.equal(punches[2].at.toISOString(), '2026-10-15T12:28:00.000Z'); // 5:58 PM IST
  const first = firstPunchPerDay(punches);
  assert.equal(first.length, 2);
  assert.equal(first.find((p) => p.machineId === '17').at.toISOString(), '2026-10-16T01:12:10.000Z');

  // ZKTeco-style daily summary: separate Date and In Time; an empty In Time means no punch
  const zk = [['AC-No.', 'Name', 'Date', 'In Time', 'Out Time'], ['4', 'Ravi', '2026-10-14', '18:05', '19:30'], ['4', 'Ravi', '2026-10-15', '', '']];
  const zc = detectColumns(zk[0]);
  assert.deepEqual([zc.id, zc.date, zc.time, zc.datetime], [0, 2, 3, -1]);
  const zp = buildPunches(zk.slice(1), zc, 'Asia/Kolkata');
  assert.equal(zp.punches.length, 1);
  assert.equal(zp.skipped, 0); // a day with no punch isn't an error
  assert.equal(zp.punches[0].day, '2026-10-14');

  // date formats
  assert.deepEqual(parseWallTime('16-Oct-2026 6:42 am'), { day: '2026-10-16', hh: 6, mm: 42, ss: 0 });
  assert.deepEqual(parseWallTime('2026/10/16 12:05:09 AM'), { day: '2026-10-16', hh: 0, mm: 5, ss: 9 });
  assert.deepEqual(parseWallTime('05.11.26 21:00'), { day: '2026-11-05', hh: 21, mm: 0, ss: 0 }); // day first
  assert.equal(parseWallTime('31/02/2026 10:00'), null); // no such day
  assert.equal(parseWallTime('16/10/2026'), null); // a date without a time isn't a punch
  assert.equal(wallToUtc({ day: '2026-10-16', hh: 0, mm: 30, ss: 0 }, 'Asia/Kolkata').toISOString(), '2026-10-15T19:00:00.000Z');
  // separate columns: a Date cell that also shows 00:00 must not turn the punch into midnight
  const sep = buildPunches([['7', '16/10/2026 00:00', '06:42']], { id: 0, name: -1, datetime: -1, date: 1, time: 2 }, 'Asia/Kolkata');
  assert.equal(sep.punches[0].at.toISOString(), '2026-10-16T01:12:00.000Z');
}

// csv: quoting, escaped quotes, null-safe
assert.equal(csv([['a', 'b"c'], [1, null]]), '"a","b""c"\r\n"1",""');

console.log('all checks passed');
