import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User, Business, Member, Payment, AdminLog } from '../models/index.js';

// Platform admin: sees every business and owner, pauses and resumes service, resets passwords.
// Every change is written to AdminLog.

const monthStart = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); };
const createdAt = (doc) => doc._id.getTimestamp();
const log = (req, action, fields) => AdminLog.create({ adminId: req.userId, action, ...fields });
const cleanReason = (r) => String(r ?? '').trim().slice(0, 200);

// Per-business numbers, computed once for the whole list
async function businessNumbers(ids) {
  const since = monthStart();
  const [members, monthPay, lastPay] = await Promise.all([
    Member.aggregate([{ $match: { businessId: { $in: ids }, status: 'active' } }, { $group: { _id: '$businessId', n: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { businessId: { $in: ids }, date: { $gte: since } } }, { $group: { _id: '$businessId', total: { $sum: '$amount' } } }]),
    Payment.aggregate([{ $match: { businessId: { $in: ids } } }, { $group: { _id: '$businessId', last: { $max: '$date' } } }]),
  ]);
  const by = (rows, key) => new Map(rows.map((r) => [String(r._id), r[key]]));
  return { members: by(members, 'n'), month: by(monthPay, 'total'), last: by(lastPay, 'last') };
}

const businessRow = (b, nums) => ({
  _id: b._id,
  name: b.name,
  type: b.type,
  status: b.status || 'active',
  suspendedAt: b.suspendedAt || null,
  suspendedReason: b.suspendedReason || null,
  owner: b.ownerId ? { _id: b.ownerId._id, name: b.ownerId.name, phone: b.ownerId.phone } : null,
  staffCount: b.staffIds?.length || 0,
  activeMembers: nums.members.get(String(b._id)) || 0,
  receivedThisMonth: nums.month.get(String(b._id)) || 0,
  lastPayment: nums.last.get(String(b._id)) || null,
  createdAt: createdAt(b),
});

export async function getStats(req, res, next) {
  try {
    const thirtyDaysAgo = mongoose.Types.ObjectId.createFromTime(Math.floor(Date.now() / 1000) - 30 * 86400);
    const [byStatus, byType, owners, users, members, month, newBiz] = await Promise.all([
      Business.aggregate([{ $group: { _id: { $ifNull: ['$status', 'active'] }, n: { $sum: 1 } } }]),
      Business.aggregate([{ $group: { _id: '$type', n: { $sum: 1 } } }]),
      Business.distinct('ownerId'),
      User.countDocuments(),
      Member.countDocuments({ status: 'active' }),
      Payment.aggregate([{ $match: { date: { $gte: monthStart() } } }, { $group: { _id: null, total: { $sum: '$amount' }, n: { $sum: 1 } } }]),
      Business.countDocuments({ _id: { $gte: thirtyDaysAgo } }),
    ]);
    const status = Object.fromEntries(byStatus.map((s) => [s._id, s.n]));
    res.json({
      businesses: (status.active || 0) + (status.suspended || 0),
      active: status.active || 0,
      suspended: status.suspended || 0,
      byType: Object.fromEntries(byType.map((t) => [t._id, t.n])),
      owners: owners.length,
      users,
      activeMembers: members,
      receivedThisMonth: month[0]?.total || 0,
      paymentsThisMonth: month[0]?.n || 0,
      newBusinesses30d: newBiz,
    });
  } catch (err) {
    next(err);
  }
}

// ?q= name / owner name / owner phone, ?status=active|suspended, ?type=gym|...
export async function listBusinesses(req, res, next) {
  try {
    const filter = {};
    if (req.query.status === 'suspended') filter.status = 'suspended';
    if (req.query.status === 'active') filter.status = { $ne: 'suspended' };
    if (req.query.type) filter.type = req.query.type;
    let list = await Business.find(filter).populate('ownerId', 'name phone').sort({ _id: -1 });
    const q = String(req.query.q || '').trim().toLowerCase();
    if (q) list = list.filter((b) => [b.name, b.ownerId?.name, b.ownerId?.phone].some((v) => String(v || '').toLowerCase().includes(q)));
    const nums = await businessNumbers(list.map((b) => b._id));
    res.json(list.map((b) => businessRow(b, nums)));
  } catch (err) {
    next(err);
  }
}

export async function getBusinessDetail(req, res, next) {
  try {
    const b = await Business.findById(req.params.id).populate('ownerId', 'name phone').populate('staffIds', 'name phone');
    if (!b) return res.status(404).json({ error: 'business not found' });
    const [nums, members, paid, logs] = await Promise.all([
      businessNumbers([b._id]),
      Member.countDocuments({ businessId: b._id }),
      Payment.aggregate([{ $match: { businessId: b._id } }, { $group: { _id: null, total: { $sum: '$amount' }, n: { $sum: 1 } } }]),
      AdminLog.find({ $or: [{ businessId: b._id }, { userId: b.ownerId?._id }] }).sort('-at').limit(30).populate('adminId', 'name phone'),
    ]);
    res.json({
      ...businessRow(b, nums),
      adminNote: b.adminNote || '',
      upiId: b.upiId || null,
      staff: (b.staffIds || []).map((s) => ({ _id: s._id, name: s.name, phone: s.phone })),
      totalMembers: members,
      receivedAllTime: paid[0]?.total || 0,
      paymentsAllTime: paid[0]?.n || 0,
      log: logs.map((l) => ({ _id: l._id, action: l.action, detail: l.detail, at: l.at, admin: l.adminId?.name || l.adminId?.phone })),
    });
  } catch (err) {
    next(err);
  }
}

export async function suspendBusiness(req, res, next) {
  try {
    const reason = cleanReason(req.body?.reason);
    if (reason.length < 3) return res.status(400).json({ error: 'give a reason: the owner will see it' });
    const b = await Business.findById(req.params.id);
    if (!b) return res.status(404).json({ error: 'business not found' });
    if (b.status === 'suspended') return res.status(400).json({ error: 'already paused' });
    Object.assign(b, { status: 'suspended', suspendedAt: new Date(), suspendedReason: reason });
    await b.save();
    await log(req, 'suspend_business', { businessId: b._id, userId: b.ownerId, detail: reason });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function resumeBusiness(req, res, next) {
  try {
    const b = await Business.findById(req.params.id);
    if (!b) return res.status(404).json({ error: 'business not found' });
    if (b.status !== 'suspended') return res.status(400).json({ error: 'not paused' });
    b.status = 'active';
    b.suspendedAt = undefined;
    b.suspendedReason = undefined;
    await b.save();
    await log(req, 'resume_business', { businessId: b._id, userId: b.ownerId });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// a private note only admins see (e.g. "paid till Dec by bank transfer")
export async function noteBusiness(req, res, next) {
  try {
    const note = String(req.body?.note ?? '').slice(0, 1000);
    const b = await Business.findByIdAndUpdate(req.params.id, { adminNote: note }, { new: true });
    if (!b) return res.status(404).json({ error: 'business not found' });
    await log(req, 'note_business', { businessId: b._id, detail: note.slice(0, 200) });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// Every account, with what it owns; staff-only accounts own nothing
export async function listOwners(req, res, next) {
  try {
    const [users, owned] = await Promise.all([
      User.find().select('name phone role').sort({ _id: -1 }),
      Business.aggregate([{ $group: {
        _id: '$ownerId',
        businesses: { $sum: 1 },
        suspended: { $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] } },
        names: { $push: '$name' },
      } }]),
    ]);
    const byOwner = new Map(owned.map((o) => [String(o._id), o]));
    const q = String(req.query.q || '').trim().toLowerCase();
    res.json(users
      .map((u) => {
        const o = byOwner.get(String(u._id));
        return {
          _id: u._id, name: u.name, phone: u.phone, role: u.role || 'user', joinedAt: createdAt(u),
          businesses: o?.businesses || 0, suspended: o?.suspended || 0, businessNames: o?.names || [],
        };
      })
      .filter((u) => !q || [u.name, u.phone, ...u.businessNames].some((v) => String(v || '').toLowerCase().includes(q))));
  } catch (err) {
    next(err);
  }
}

// Pause or resume every business an owner has, in one go
export async function suspendOwner(req, res, next) {
  try {
    const reason = cleanReason(req.body?.reason);
    if (reason.length < 3) return res.status(400).json({ error: 'give a reason: the owner will see it' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'owner not found' });
    if (user.role === 'admin') return res.status(400).json({ error: "admins can't be paused" });
    const r = await Business.updateMany({ ownerId: user._id, status: { $ne: 'suspended' } },
      { status: 'suspended', suspendedAt: new Date(), suspendedReason: reason });
    await log(req, 'suspend_owner', { userId: user._id, detail: `${reason} (${r.modifiedCount} business${r.modifiedCount === 1 ? '' : 'es'})` });
    res.json({ ok: true, paused: r.modifiedCount });
  } catch (err) {
    next(err);
  }
}

export async function resumeOwner(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'owner not found' });
    const r = await Business.updateMany({ ownerId: user._id, status: 'suspended' },
      { status: 'active', $unset: { suspendedAt: 1, suspendedReason: 1 } });
    await log(req, 'resume_owner', { userId: user._id, detail: `${r.modifiedCount} business${r.modifiedCount === 1 ? '' : 'es'}` });
    res.json({ ok: true, resumed: r.modifiedCount });
  } catch (err) {
    next(err);
  }
}

// There's no self-service reset, so support does it: a one-time password shown to the admin once
export async function resetPassword(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'account not found' });
    if (user.role === 'admin') return res.status(400).json({ error: "admin passwords can't be reset here" });
    const temp = crypto.randomBytes(6).toString('base64url').replace(/[-_]/g, 'x').slice(0, 8);
    user.passwordHash = await bcrypt.hash(temp, 10);
    await user.save();
    await log(req, 'reset_password', { userId: user._id });
    res.json({ tempPassword: temp });
  } catch (err) {
    next(err);
  }
}

export async function getLog(req, res, next) {
  try {
    const logs = await AdminLog.find().sort('-at').limit(200)
      .populate('adminId', 'name phone').populate('businessId', 'name').populate('userId', 'name phone');
    res.json(logs.map((l) => ({
      _id: l._id, action: l.action, detail: l.detail, at: l.at,
      admin: l.adminId?.name || l.adminId?.phone,
      business: l.businessId?.name || null,
      owner: l.userId ? (l.userId.name || l.userId.phone) : null,
    })));
  } catch (err) {
    next(err);
  }
}
