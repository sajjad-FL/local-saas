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


// Fix a plan's name, price or cycle. Bills already made keep their amount;
// the next bills for everyone on this plan use the new price and cycle.
export async function updatePlan(req, res, next) {
  try {
    const plan = await Plan.findOne({ _id: req.params.planId, businessId: req.business._id }).catch(() => null);
    if (!plan) return res.status(404).json({ error: 'plan not found' });
    const { name, amount, cycleDays } = req.body ?? {};
    if (name !== undefined) {
      const clean = String(name).trim().slice(0, 60);
      if (!clean) return res.status(400).json({ error: "the plan name can't be empty" });
      plan.name = clean;
    }
    if (amount !== undefined) {
      if (!(Number(amount) > 0)) return res.status(400).json({ error: 'amount must be positive' });
      plan.amount = Number(amount);
    }
    if (cycleDays !== undefined) {
      const days = Number(cycleDays);
      if (!Number.isInteger(days) || days < 1 || days > 366) return res.status(400).json({ error: 'pick a billing cycle' });
      plan.cycleDays = days;
    }
    await plan.save();
    res.json(plan);
  } catch (err) {
    next(err);
  }
}
