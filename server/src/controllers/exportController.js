import { Payment, Member, Due, Plan, Group, Room, Subscription } from '../models/index.js';
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
        rows.push([d.dueDate, m.name, m.phone, `${day(d.periodStart)} to ${day(d.periodEnd)}`, d.amount, d.amount - remaining, remaining,
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
    const [plans, groups, rooms, dues, payments, subscriptions] = await Promise.all([
      Plan.find({ businessId }), Group.find({ businessId }), Room.find({ businessId }),
      Due.find({ businessId }), Payment.find({ businessId }),
      Subscription.find({ memberId: { $in: members.map((m) => m._id) } }),
    ]);
    const { name, type, upiId, reminderEveryDays } = req.business;
    res.attachment('backup.json').json({
      exportedAt: new Date(), business: { name, type, upiId, reminderEveryDays },
      plans, groups, rooms, members, subscriptions, dues, payments,
    });
  } catch (err) {
    next(err);
  }
}

export async function exportBalancesCsv(req, res, next) {
  try {
    const [members, bal] = await Promise.all([
      Member.find({ businessId: req.business._id })
        .populate('groupId roomId', 'name roomNo')
        .sort('name'),
      memberBalances(req.business._id),
    ]);

    const csvContent = csv([
      ['Name', 'Phone', 'Group', 'Room', 'Status', 'Balance'],
      ...members.map((m) => [
        m.name,
        m.phone,
        m.groupId?.name,
        m.roomId?.roomNo,
        m.status,
        bal.get(String(m._id)) || 0,
      ]),
    ]);

    res.type('text/csv').attachment('balances.csv').send(csvContent);
  } catch (err) {
    next(err);
  }
}

