import { User, Business, Member, Due, Payment, Subscription, Plan, Group, Room, Reminder, Expense, Attendance } from '../models/index.js';
import { mine } from '../middlewares/authMiddleware.js';
import { memberBalances } from '../services/billingService.js';
import { Staff } from '../models/index.js';
import { accessFor, syncStaff, importLegacyStaff, cleanPhone } from '../services/staffService.js';

export async function getBusinesses(req, res, next) {
  try {
    const businesses = await Business.find(mine(req.userId));
    res.json(await Promise.all(businesses.map(async (b) => ({ ...b.toObject(), access: await accessFor(b, req.userId) }))));
  } catch (err) {
    next(err);
  }
}

const TYPES = ['gym', 'hostel', 'mess', 'tuition'];

export async function createBusiness(req, res, next) {
  try {
    const { type, copyFrom } = req.body;
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!TYPES.includes(type)) return res.status(400).json({ error: 'pick a business type' });
    // copying setup is only allowed from a business this user owns
    let source = null;
    if (copyFrom) {
      source = await Business.findOne({ _id: copyFrom, ownerId: req.userId }).catch(() => null);
      if (!source) return res.status(404).json({ error: 'business to copy from not found' });
    }
    // hostels rarely take daily attendance: off until the owner turns it on in Settings
    const business = await Business.create({ ownerId: req.userId, name, type, attendanceEnabled: type !== 'hostel' });
    if (source) {
      // plans and batches only — members and money are never copied
      const [plans, groups] = await Promise.all([Plan.find({ businessId: source._id }), Group.find({ businessId: source._id })]);
      await Promise.all([
        plans.length && Plan.insertMany(plans.map((p) => ({ businessId: business._id, name: p.name, amount: p.amount, cycleDays: p.cycleDays }))),
        groups.length && Group.insertMany(groups.map((g) => ({ businessId: business._id, name: g.name, floors: g.floors.map((fl) => ({ name: fl.name })) }))),
      ]);
    }
    await importLegacyStaff(req.userId);
    await syncStaff(req.userId);
    res.json(business);
  } catch (err) {
    next(err);
  }
}

// Outlets page: one row per business this user can open, with its headline numbers
export async function getBusinessSummary(req, res, next) {
  try {
    const businesses = await Business.find(mine(req.userId));
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const rows = await Promise.all(businesses.map(async (b) => {
      const [members, bal, paid] = await Promise.all([
        Member.find({ businessId: b._id, status: 'active' }, '_id'),
        memberBalances(b._id),
        Payment.aggregate([{ $match: { businessId: b._id, date: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      ]);
      const active = new Set(members.map((m) => String(m._id)));
      let toCollect = 0;
      for (const [id, v] of bal) if (active.has(id) && v > 0) toCollect += v;
      return {
        _id: b._id, name: b.name, type: b.type, status: b.status,
        isOwner: b.ownerId.equals(req.userId),
        staffCount: (b.staffIds || []).length,
        active: active.size,
        toCollect,
        collectedThisMonth: paid[0]?.total || 0,
      };
    }));
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// owner only — staff must not be able to redirect payments or manage staff
export async function updateBusiness(req, res, next) {
  try {
    if (!req.business.ownerId.equals(req.userId)) {
      return res.status(403).json({ error: 'owner only' });
    }
    const { name, upiId, notifications, reminderEveryDays, attendanceEnabled } = req.body;
    if (name !== undefined) req.business.name = name;
    if (typeof attendanceEnabled === 'boolean') Object.assign(req.business, { attendanceEnabled, attendanceChosen: true });
    if (upiId !== undefined) req.business.upiId = upiId;
    if (reminderEveryDays !== undefined) req.business.reminderEveryDays = reminderEveryDays;
    if (notifications !== undefined) {
      req.business.notifications = { ...req.business.notifications?.toObject(), ...notifications };
    }
    await req.business.save();
    res.json(req.business);
  } catch (err) {
    next(err);
  }
}

export async function clearBusinessData(req, res, next) {
  try {
    if (!req.business.ownerId.equals(req.userId)) {
      return res.status(403).json({ error: 'owner only' });
    }
    const members = await Member.find({ businessId: req.business._id });
    const memberIds = members.map((m) => m._id);
    await Promise.all([
      Payment.deleteMany({ memberId: { $in: memberIds } }),
      Due.deleteMany({ memberId: { $in: memberIds } }),
      Subscription.deleteMany({ memberId: { $in: memberIds } }),
      Member.deleteMany({ businessId: req.business._id }),
      Reminder.deleteMany({ businessId: req.business._id }),
      Expense.deleteMany({ businessId: req.business._id }),
      Attendance.deleteMany({ businessId: req.business._id }),
    ]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function deleteBusiness(req, res, next) {
  try {
    if (!req.business.ownerId.equals(req.userId)) {
      return res.status(403).json({ error: 'owner only' });
    }
    const bizId = req.business._id;
    const members = await Member.find({ businessId: bizId });
    const memberIds = members.map((m) => m._id);
    await Promise.all([
      Payment.deleteMany({ memberId: { $in: memberIds } }),
      Due.deleteMany({ memberId: { $in: memberIds } }),
      Subscription.deleteMany({ memberId: { $in: memberIds } }),
      Member.deleteMany({ businessId: bizId }),
      Plan.deleteMany({ businessId: bizId }),
      Group.deleteMany({ businessId: bizId }),
      Room.deleteMany({ businessId: bizId }),
      Reminder.deleteMany({ businessId: bizId }),
      Expense.deleteMany({ businessId: bizId }),
      Attendance.deleteMany({ businessId: bizId }),
      Business.deleteOne({ _id: bizId }),
    ]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// staff management (owner only)
export async function getStaff(req, res, next) {
  try {
    if (!req.business.ownerId.equals(req.userId)) {
      return res.status(403).json({ error: 'owner only' });
    }
    await req.business.populate('staffIds', 'name phone');
    res.json(req.business.staffIds);
  } catch (err) {
    next(err);
  }
}

export async function addStaff(req, res, next) {
  try {
    if (!req.business.ownerId.equals(req.userId)) {
      return res.status(403).json({ error: 'owner only' });
    }
    const user = await User.findOne({ phone: req.body.phone });
    if (!user) {
      return res.status(404).json({ error: 'no account with that phone — ask them to register first' });
    }
    if (user._id.equals(req.userId)) {
      return res.status(400).json({ error: 'you are already the owner' });
    }
    await importLegacyStaff(req.userId); // brings older staff into Staff rows first
    await Staff.updateOne(
      { ownerId: req.userId, phone: cleanPhone(user.phone) },
      { $set: { userId: user._id }, $setOnInsert: { name: user.name, level: 2, allOutlets: false }, $addToSet: { businessIds: req.business._id } },
      { upsert: true },
    );
    await syncStaff(req.userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function removeStaff(req, res, next) {
  try {
    if (!req.business.ownerId.equals(req.userId)) {
      return res.status(403).json({ error: 'owner only' });
    }
    await importLegacyStaff(req.userId);
    const row = await Staff.findOne({ ownerId: req.userId, userId: req.params.userId });
    if (row) {
      if (row.allOutlets) {
        const all = await Business.find({ ownerId: req.userId }, '_id');
        row.allOutlets = false;
        row.businessIds = all.map((b) => b._id);
      }
      row.businessIds = row.businessIds.filter((b) => !b.equals(req.business._id));
      if (row.businessIds.length) await row.save(); else await row.deleteOne();
    }
    await syncStaff(req.userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

