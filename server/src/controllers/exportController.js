import { Payment, Member } from '../models/index.js';
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

