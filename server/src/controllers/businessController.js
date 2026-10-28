import { User, Business, Member, Due, Payment, Subscription, Plan, Group, Room, Reminder, Expense, Attendance } from '../models/index.js';
import { mine } from '../middlewares/authMiddleware.js';

export async function getBusinesses(req, res, next) {
  try {
    const businesses = await Business.find(mine(req.userId));
    res.json(businesses);
  } catch (err) {
    next(err);
  }
}

export async function createBusiness(req, res, next) {
  try {
    const { name, type } = req.body;
    // hostels rarely take daily attendance: off until the owner turns it on in Settings
    const business = await Business.create({ ownerId: req.userId, name, type, attendanceEnabled: type !== 'hostel' });
    res.json(business);
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
    await Business.updateOne({ _id: req.business._id }, { $addToSet: { staffIds: user._id } });
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
    await Business.updateOne({ _id: req.business._id }, { $pull: { staffIds: req.params.userId } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

