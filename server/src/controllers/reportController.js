import { Payment, Due, Expense } from '../models/index.js';
import { remainingByDue, memberBalances } from '../services/billingService.js';
import { summarizePeriod } from '../services/reportService.js';

// Money report for any period: received, expenses, profit/loss, pending, month by month,
// plus the same numbers for the period just before it, for comparison.
// Query: from, to (ISO dates, set by the browser in the owner's timezone), tz (getTimezoneOffset()).
export async function getReport(req, res, next) {
  try {
    const from = new Date(req.query.from);
    const to = new Date(req.query.to);
    const tzOffset = Number(req.query.tz) || 0;
    if (isNaN(from) || isNaN(to) || from > to) {
      return res.status(400).json({ error: 'from and to must be valid dates, from before to' });
    }

    const businessId = req.business._id;
    const [payments, dues, expenses, balances] = await Promise.all([
      Payment.find({ businessId }),
      Due.find({ businessId }),
      Expense.find({ businessId }),
      memberBalances(businessId),
    ]);
    const owed = remainingByDue(dues, payments);
    const remaining = (due) => owed.get(String(due._id)) || 0;

    // the period of the same length just before this one
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - (to.getTime() - from.getTime()));

    const current = summarizePeriod({ payments, expenses, dues, remaining, from, to, tzOffset });
    const previous = summarizePeriod({ payments, expenses, dues, remaining, from: prevFrom, to: prevTo, tzOffset });

    res.json({
      from,
      to,
      ...current,
      pendingNow: [...balances.values()].reduce((s, b) => s + Math.max(0, b), 0),
      previous: { from: prevFrom, to: prevTo, received: previous.received, expenses: previous.expenses, profit: previous.profit },
    });
  } catch (err) {
    next(err);
  }
}
