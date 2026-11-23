import { Business, Staff, User } from '../models/index.js';
import { syncStaff, importLegacyStaff, cleanPhone, phoneVariants } from '../services/staffService.js';

// Staff page: everyone the signed-in owner has given access to, across all their outlets.
// Every call is scoped to ownerId = the signed-in user, so one owner never sees another's staff.

const shape = (r) => ({
  _id: r._id, name: r.name, phone: r.phone, level: r.level, allOutlets: r.allOutlets,
  businessIds: r.businessIds, joined: !!r.userId, createdAt: r.createdAt,
});

// checks the body and returns the fields to save, or an error message
async function clean(req, partial) {
  const out = {};
  const b = req.body ?? {};
  if (!partial || b.phone !== undefined) {
    const phone = cleanPhone(b.phone);
    if (phone.length !== 10) return { error: 'enter a 10-digit mobile number' };
    out.phone = phone;
  }
  if (b.name !== undefined) out.name = String(b.name).trim().slice(0, 60);
  if (!partial || b.level !== undefined) {
    const level = Number(b.level);
    if (![0, 1, 2, 3].includes(level)) return { error: 'pick what they can do' };
    out.level = level;
  }
  if (!partial || b.allOutlets !== undefined || b.businessIds !== undefined) {
    out.allOutlets = !!b.allOutlets;
    const ids = out.allOutlets ? [] : [...new Set((Array.isArray(b.businessIds) ? b.businessIds : []).map(String))];
    if (!out.allOutlets) {
      if (!ids.length) return { error: 'pick at least one outlet' };
      const owned = await Business.countDocuments({ _id: { $in: ids }, ownerId: req.userId }).catch(() => -1);
      if (owned !== ids.length) return { error: 'outlet not found' };
    }
    out.businessIds = ids;
  }
  return { out };
}

export async function listStaff(req, res, next) {
  try {
    await importLegacyStaff(req.userId); // staff added before access levels
    await syncStaff(req.userId);
    const rows = await Staff.find({ ownerId: req.userId }).sort('createdAt');
    res.json(rows.map(shape));
  } catch (err) {
    next(err);
  }
}

export async function addStaffMember(req, res, next) {
  try {
    if (!(await Business.exists({ ownerId: req.userId }))) return res.status(403).json({ error: 'only outlet owners can add staff' });
    const { out, error } = await clean(req, false);
    await importLegacyStaff(req.userId);
    if (error) return res.status(400).json({ error });
    const me = await User.findById(req.userId, 'phone');
    if (cleanPhone(me?.phone) === out.phone) return res.status(400).json({ error: "that's your own number — you already have full access" });
    if (await Staff.exists({ ownerId: req.userId, phone: out.phone })) return res.status(409).json({ error: 'this number is already on your staff — change their access instead' });
    const user = await User.findOne({ phone: { $in: phoneVariants(out.phone) } }, 'name');
    const row = await Staff.create({ ...out, ownerId: req.userId, userId: user?._id, name: out.name || user?.name || '' });
    await syncStaff(req.userId);
    res.json(shape(row));
  } catch (err) {
    next(err);
  }
}

export async function updateStaffMember(req, res, next) {
  try {
    await importLegacyStaff(req.userId);
    const row = await Staff.findOne({ _id: req.params.staffId, ownerId: req.userId }).catch(() => null);
    if (!row) return res.status(404).json({ error: 'staff member not found' });
    const { out, error } = await clean(req, true);
    if (error) return res.status(400).json({ error });
    if (out.phone && out.phone !== row.phone) return res.status(400).json({ error: "the number can't be changed — remove them and add the new number" });
    delete out.phone;
    Object.assign(row, out);
    await row.save();
    await syncStaff(req.userId);
    res.json(shape(row));
  } catch (err) {
    next(err);
  }
}

export async function removeStaffMember(req, res, next) {
  try {
    await importLegacyStaff(req.userId);
    const row = await Staff.findOneAndDelete({ _id: req.params.staffId, ownerId: req.userId }).catch(() => null);
    if (!row) return res.status(404).json({ error: 'staff member not found' });
    await syncStaff(req.userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
