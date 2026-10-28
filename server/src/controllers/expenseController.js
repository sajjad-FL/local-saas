import { Expense, EXPENSE_CATEGORIES } from '../models/Expense.js';

export async function getExpenses(req, res, next) {
  try {
    const { from, to } = req.query;
    const date = {};
    if (from) date.$gte = new Date(from);
    if (to) date.$lte = new Date(to);
    const expenses = await Expense.find({ businessId: req.business._id, ...(from || to ? { date } : {}) }).sort('-date');
    res.json(expenses);
  } catch (err) {
    next(err);
  }
}

// owner and staff can record what was spent
export async function createExpense(req, res, next) {
  try {
    const { amount, category, date, note, label } = req.body ?? {};
    if (!(Number(amount) > 0)) return res.status(400).json({ error: 'amount must be positive' });
    if (category && !EXPENSE_CATEGORIES.includes(category)) return res.status(400).json({ error: 'unknown category' });
    const customLabel = category === 'other' ? String(label ?? '').trim().slice(0, 40) : '';
    if (category === 'other' && !customLabel) return res.status(400).json({ error: 'say what the expense was for' });
    const expense = await Expense.create({
      businessId: req.business._id,
      amount: Number(amount),
      category: category || 'other',
      label: customLabel || undefined,
      date: date || Date.now(),
      note,
      createdBy: req.userId,
    });
    res.json(expense);
  } catch (err) {
    next(err);
  }
}

// owner only, like payment reversal: staff can't make spending disappear
export async function deleteExpense(req, res, next) {
  try {
    if (!req.business.ownerId.equals(req.userId)) {
      return res.status(403).json({ error: 'owner only' });
    }
    const expense = await Expense.findOneAndDelete({ _id: req.params.expenseId, businessId: req.business._id });
    if (!expense) return res.status(404).json({ error: 'expense not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
