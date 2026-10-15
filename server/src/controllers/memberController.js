import { Member, Plan, Subscription, Due, Payment, Reminder, Group } from '../models/index.js';
import { memberBalances, recomputeDues, rollForward, roomFullError, addPlanCycle, createDues, ensureShareToken } from '../services/billingService.js';

export async function getMembers(req, res, next) {
  try {
    const [members, bal] = await Promise.all([
      Member.find({ businessId: req.business._id }).populate('groupId roomId', 'name roomNo').sort('name'),
      memberBalances(req.business._id),
    ]);
    const memberIds = members.map((m) => m._id);
    const [subs, payments] = await Promise.all([
      Subscription.find({ memberId: { $in: memberIds } }).populate('planId').sort('-createdAt'),
      Payment.find({ memberId: { $in: memberIds } }),
    ]);

    const subMap = new Map();
    for (const s of subs) {
      if (!subMap.has(String(s.memberId)) || s.status === 'active') {
        subMap.set(String(s.memberId), s);
      }
    }

    const paidMap = new Map();
    for (const p of payments) {
      const mid = String(p.memberId);
      paidMap.set(mid, (paidMap.get(mid) || 0) + p.amount);
    }

    res.json(
      members.map((m) => {
        const s = subMap.get(String(m._id));
        return {
          ...m.toObject(),
          balance: bal.get(String(m._id)) || 0,
          planId: s?.planId,
          planName: s?.planId?.name,
          planAmount: s?.planId?.amount || 0,
          cycleDays: s?.planId?.cycleDays,
          nextRenewal: s?.periodEnd || null,
          subscription: s,
          totalPaid: paidMap.get(String(m._id)) || 0,
        };
      })
    );
  } catch (err) {
    next(err);
  }
}

export async function createMember(req, res, next) {
  try {
    const { name, phone, groupId, joinDate, roomId } = req.body;
    if (groupId && !(await Group.exists({ _id: groupId, businessId: req.business._id }))) {
      return res.status(400).json({ error: 'group not found' });
    }
    if (roomId) {
      const err = await roomFullError(roomId, req.business._id);
      if (err) return res.status(400).json({ error: err });
    }
    const member = await Member.create({
      businessId: req.business._id,
      name,
      phone,
      joinDate,
      groupId: groupId || undefined,
      roomId: roomId || undefined,
    });
    res.json(member);
  } catch (err) {
    next(err);
  }
}

export async function getMemberById(req, res, next) {
  try {
    const [dues, payments, subscription] = await Promise.all([
      Due.find({ memberId: req.member._id }).sort('-dueDate'),
      Payment.find({ memberId: req.member._id }).sort('-date'),
      Subscription.findOne({ memberId: req.member._id, status: { $in: ['active', 'paused'] } }).populate('planId'),
    ]);
    const balance = dues.reduce((s, d) => s + d.amount, 0) - payments.reduce((s, p) => s + p.amount, 0);
    res.json({ member: req.member, dues, payments, balance, subscription });
  } catch (err) {
    next(err);
  }
}

export async function updateMember(req, res, next) {
  try {
    const { name, phone, groupId, status, roomId, deposit, noticeGivenOn } = req.body;
    if (groupId && !(await Group.exists({ _id: groupId, businessId: req.member.businessId }))) {
      return res.status(400).json({ error: 'group not found' });
    }
    if (roomId) {
      const err = await roomFullError(roomId, req.member.businessId, req.member._id);
      if (err) return res.status(400).json({ error: err });
    }
    Object.assign(
      req.member,
      Object.fromEntries(
        Object.entries({ name, phone, groupId, status, roomId, deposit, noticeGivenOn }).filter(([, v]) => v !== undefined)
      )
    );
    await req.member.save();
    if (req.member.status === 'left') {
      await Subscription.updateMany({ memberId: req.member._id, status: 'active' }, { status: 'stopped' });
    }
    res.json(req.member);
  } catch (err) {
    next(err);
  }
}

export async function subscribeMember(req, res, next) {
  try {
    const plan = await Plan.findOne({ _id: req.body.planId, businessId: req.member.businessId });
    if (!plan) return res.status(404).json({ error: 'plan not found' });
    await Subscription.updateMany({ memberId: req.member._id, status: 'active' }, { status: 'stopped' });
    const periodStart = req.body.startDate ? new Date(req.body.startDate) : new Date();
    const anchorDay = periodStart.getUTCDate();
    const periodEnd = addPlanCycle(periodStart, plan.cycleDays, anchorDay);
    // backdated start: create every cycle from startDate to now, not just the first
    const periods = [{ periodStart, periodEnd }, ...rollForward(periodEnd, plan.cycleDays, new Date(), anchorDay)];
    const sub = await Subscription.create({
      memberId: req.member._id,
      planId: plan._id,
      anchorDay,
      ...periods.at(-1),
    });
    await createDues(sub, req.member, plan.amount, periods);
    await recomputeDues(req.member._id);
    res.json(sub);
  } catch (err) {
    next(err);
  }
}

export async function pauseMember(req, res, next) {
  try {
    const sub = await Subscription.findOne({ memberId: req.member._id, status: 'active' });
    if (!sub) return res.status(400).json({ error: 'no active subscription' });
    Object.assign(sub, { status: 'paused', pausedAt: new Date() });
    await sub.save();
    res.json(sub);
  } catch (err) {
    next(err);
  }
}

export async function resumeMember(req, res, next) {
  try {
    const sub = await Subscription.findOne({ memberId: req.member._id, status: 'paused' });
    if (!sub) return res.status(400).json({ error: 'no paused subscription' });
    sub.periodEnd = new Date(sub.periodEnd.getTime() + (Date.now() - sub.pausedAt));
    // the pause shifted the renewal date, so future cycles renew on the new day
    Object.assign(sub, { status: 'active', pausedAt: null, anchorDay: sub.periodEnd.getUTCDate() });
    await sub.save();
    res.json(sub);
  } catch (err) {
    next(err);
  }
}

export async function recordPayment(req, res, next) {
  try {
    const { amount, date, mode, note } = req.body;
    if (!(amount > 0)) return res.status(400).json({ error: 'amount must be positive' });
    const payment = await Payment.create({
      memberId: req.member._id,
      businessId: req.member.businessId,
      amount,
      date: date || Date.now(),
      mode: mode || 'cash',
      note,
    });
    await recomputeDues(req.member._id);
    res.json(payment);
  } catch (err) {
    next(err);
  }
}

// Statement link token; rotate: true issues a new one so the old link stops working
export async function shareStatement(req, res, next) {
  try {
    if (req.body?.rotate) req.member.shareToken = undefined;
    res.json({ token: await ensureShareToken(req.member) });
  } catch (err) {
    next(err);
  }
}

// owner only — reverses a mis-entered payment; dues are re-derived so the balance corrects itself
export async function deletePayment(req, res, next) {
  try {
    if (!req.business.ownerId.equals(req.userId)) {
      return res.status(403).json({ error: 'owner only' });
    }
    const payment = await Payment.findOneAndDelete({ _id: req.params.paymentId, memberId: req.member._id });
    if (!payment) return res.status(404).json({ error: 'payment not found' });
    await recomputeDues(req.member._id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function deleteMember(req, res, next) {
  try {
    const memberId = req.member._id;
    await Promise.all([
      Subscription.deleteMany({ memberId }),
      Due.deleteMany({ memberId }),
      Payment.deleteMany({ memberId }),
      Reminder.deleteMany({ memberId }),
      Member.findByIdAndDelete(memberId),
    ]);
    res.json({ ok: true, message: 'Member deleted successfully' });
  } catch (err) {
    next(err);
  }
}

