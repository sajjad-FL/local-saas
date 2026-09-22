import { Plan } from '../models/index.js';

export async function getPlans(req, res, next) {
  try {
    const plans = await Plan.find({ businessId: req.business._id }).sort('name');
    res.json(plans);
  } catch (err) {
    next(err);
  }
}

export async function createPlan(req, res, next) {
  try {
    const { name, amount, cycleDays } = req.body;
    if (!(amount > 0)) {
      return res.status(400).json({ error: 'amount must be positive' });
    }
    const plan = await Plan.create({
      businessId: req.business._id,
      name,
      amount,
      cycleDays: cycleDays || 30,
    });
    res.json(plan);
  } catch (err) {
    next(err);
  }
}

