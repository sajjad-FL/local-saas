import { Payment, Member, Due, Plan, Group, Room, Subscription } from '../models/index.js';
import { memberBalances, csv } from '../services/billingService.js';

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

