import { Payment, Member, Due, Plan, Group, Room, Subscription, Expense, Attendance } from '../models/index.js';
import { memberBalances, dueRemaining, csv } from '../services/billingService.js';

export async function exportPaymentsCsv(req, res, next) {
  try {
    const pays = await Payment.find({ businessId: req.business._id })
      .populate('memberId', 'name')
      .sort('-date');

    const csvContent = csv([
      ['Date', 'Member', 'Amount', 'Mode', 'Note'],
      ...pays.map((p) => [
        p.date.toISOString().slice(0, 10),
        p.memberId?.name,
        p.amount,
        p.mode,
        p.note,
      ]),
    ]);

    res.type('text/csv').attachment('payments.csv').send(csvContent);
  } catch (err) {
    next(err);
  }
}

// Every due not yet fully paid, oldest first, with what is still owed on it
export async function exportDuesCsv(req, res, next) {
  try {
    const businessId = req.business._id;
    const [members, dues, paid] = await Promise.all([
      Member.find({ businessId }),
      Due.find({ businessId }).sort('dueDate'),
      Payment.aggregate([{ $match: { businessId } }, { $group: { _id: '$memberId', total: { $sum: '$amount' } } }]),
    ]);
    const memberById = new Map(members.map((m) => [String(m._id), m]));
    const paidBy = new Map(paid.map((p) => [String(p._id), p.total]));
    const duesBy = new Map();
    for (const d of dues) {
      const id = String(d.memberId);
      if (!duesBy.has(id)) duesBy.set(id, []);
      duesBy.get(id).push(d);
    }
    const day = (d) => d.toISOString().slice(0, 10);
    const rows = [];
    for (const [memberId, list] of duesBy) {
      const m = memberById.get(memberId);
      if (!m) continue;
      dueRemaining(list, paidBy.get(memberId) || 0).forEach((remaining, i) => {
        if (remaining <= 0) return;
        const d = list[i];
        rows.push([d.dueDate, m.name, m.phone, d.kind === 'sale' ? `Sale: ${d.label}` : `${day(d.periodStart)} to ${day(d.periodEnd)}`, d.amount, d.amount - remaining, remaining,
          Math.max(0, Math.floor((Date.now() - d.dueDate) / 86400000)), m.status]);
      });
    }
    rows.sort((a, b) => a[0] - b[0]);
    const csvContent = csv([
      ['Due Date', 'Member', 'Phone', 'Period', 'Amount', 'Paid', 'Remaining', 'Days Overdue', 'Member Status'],
      ...rows.map(([dueDate, ...rest]) => [day(dueDate), ...rest]),
    ]);
    res.type('text/csv').attachment('dues.csv').send(csvContent);
  } catch (err) {
    next(err);
  }
}

// owner only — everything needed to rebuild the business elsewhere; your data is never locked in
export async function exportBackupJson(req, res, next) {
  try {
    if (!req.business.ownerId.equals(req.userId)) {
      return res.status(403).json({ error: 'owner only' });
    }
    const businessId = req.business._id;
    const members = await Member.find({ businessId }).select('-shareToken');
    const [plans, groups, rooms, dues, payments, subscriptions, expenses, attendance] = await Promise.all([
      Plan.find({ businessId }), Group.find({ businessId }), Room.find({ businessId }),
      Due.find({ businessId }), Payment.find({ businessId }),
      Subscription.find({ memberId: { $in: members.map((m) => m._id) } }),
      Expense.find({ businessId }),
      Attendance.find({ businessId }),
    ]);
    const { name, type, upiId, reminderEveryDays } = req.business;
    res.attachment('backup.json').json({
      exportedAt: new Date(), business: { name, type, upiId, reminderEveryDays },
      plans, groups, rooms, members, subscriptions, dues, payments, expenses, attendance,
    });
  } catch (err) {
    next(err);
  }
}

export async function exportExpensesCsv(req, res, next) {
  try {
    const expenses = await Expense.find({ businessId: req.business._id }).sort('-date');
    const csvContent = csv([
      ['Date', 'Category', 'Amount', 'Note'],
      ...expenses.map((e) => [e.date.toISOString().slice(0, 10), e.category === 'other' && e.label ? e.label : e.category, e.amount, e.note]),
    ]);
    res.type('text/csv').attachment('expenses.csv').send(csvContent);
  } catch (err) {
    next(err);
  }
}

// The full member list, one row each: who they are, their plan and fee, what they have paid,
// what they owe and since when, and when they last came. Columns that don't apply to this
// kind of business (rooms outside a hostel, batches when there are none) are left out.
export async function exportBalancesCsv(req, res, next) {
  try {
    const biz = req.business;
    const businessId = biz._id;
    const tz = biz.timezone || 'Asia/Kolkata';
    const members = await Member.find({ businessId }).populate('groupId', 'name').populate('roomId', 'roomNo').sort('name');
    const ids = members.map((m) => m._id);
    const [subs, dues, payments, lastSeen, groupCount] = await Promise.all([
      Subscription.find({ memberId: { $in: ids }, status: { $in: ['active', 'paused'] } }).populate('planId', 'name amount cycleDays'),
      Due.find({ businessId }).sort('dueDate'),
      Payment.find({ businessId }).sort('date'),
      biz.attendanceEnabled === false ? [] : Attendance.aggregate([
        { $match: { businessId, status: 'present' } },
        { $group: { _id: '$memberId', last: { $max: '$day' } } },
      ]),
      Group.countDocuments({ businessId }),
    ]);

    const subBy = new Map(subs.map((s) => [String(s.memberId), s]));
    const lastBy = new Map(lastSeen.map((l) => [String(l._id), l.last]));
    const group = (list, key) => {
      const out = new Map();
      for (const x of list) { const k = String(x[key]); if (!out.has(k)) out.set(k, []); out.get(k).push(x); }
      return out;
    };
    const duesBy = group(dues, 'memberId');
    const paysBy = group(payments, 'memberId');
    const day = (d) => (d ? new Date(d).toLocaleDateString('en-CA', { timeZone: tz }) : ''); // YYYY-MM-DD, sorts and opens in Excel
    const today = day(new Date());
    const daysSince = (d) => Math.max(0, Math.round((new Date(`${today}T00:00:00Z`) - new Date(`${day(d)}T00:00:00Z`)) / 86400000));

    const isHostel = biz.type === 'hostel';
    const groupWord = { gym: 'Batch', tuition: 'Batch', mess: 'Group', hostel: 'Building' }[biz.type] || 'Group';
    const showGroup = groupCount > 0;
    const showAttendance = biz.attendanceEnabled !== false;

    const header = [
      'Name', 'Phone',
      ...(showGroup ? [groupWord] : []),
      ...(isHostel ? ['Room'] : []),
      'Plan', 'Fee (₹)', 'Every (days)', 'Joined', 'Status',
      'Next due on', 'Total billed (₹)', 'Total paid (₹)', 'Owes now (₹)', 'Advance (₹)', 'Unpaid since', 'Days overdue',
      'Last paid on', 'Last payment (₹)',
      ...(showAttendance ? ['Last came on'] : []),
    ];
    const rows = members.map((m) => {
      const id = String(m._id);
      const sub = subBy.get(id);
      const plan = sub?.planId;
      const myDues = duesBy.get(id) || [];
      const myPays = paysBy.get(id) || [];
      const billed = myDues.reduce((n, d) => n + d.amount, 0);
      const paid = myPays.reduce((n, p) => n + p.amount, 0);
      const owes = billed - paid;
      const left = dueRemaining(myDues, paid);
      const oldest = myDues.find((d, i) => left[i] > 0);
      const lastPay = myPays[myPays.length - 1];
      const status = m.status === 'left' ? 'Left' : sub?.status === 'paused' ? 'Paused' : !sub ? 'Active, no plan' : 'Active';
      const overdue = oldest && new Date(oldest.dueDate) <= new Date() ? daysSince(oldest.dueDate) : '';
      return [
        m.name, m.phone,
        ...(showGroup ? [m.groupId?.name] : []),
        ...(isHostel ? [m.roomId?.roomNo] : []),
        plan?.name, sub ? (sub.amount ?? plan?.amount) : '', plan?.cycleDays, day(m.joinDate), status,
        m.status === 'active' && sub?.status === 'active' ? day(sub.periodEnd) : '',
        billed, paid, Math.max(0, owes), Math.max(0, -owes), oldest ? day(oldest.dueDate) : '', overdue,
        lastPay ? day(lastPay.date) : '', lastPay ? lastPay.amount : '',
        ...(showAttendance ? [lastBy.get(id) || ''] : []),
      ];
    });
    // people who owe come first (most overdue on top), then everyone else by name
    rows.sort((a, b) => {
      const o = header.indexOf('Days overdue');
      return (Number(b[o]) || -1) - (Number(a[o]) || -1) || String(a[0]).localeCompare(String(b[0]));
    });

    // the BOM makes Excel read ₹ and Indian names correctly
    res.type('text/csv; charset=utf-8').attachment('members.csv').send('﻿' + csv([header, ...rows]));
  } catch (err) {
    next(err);
  }
}
