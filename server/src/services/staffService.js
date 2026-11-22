import { Business, Staff, User } from '../models/index.js';

export const LEVELS = ['See only', 'Add', 'Add & edit', 'Full'];

// Staff added before access levels existed live only in Business.staffIds.
// Give each of them a Staff row at "Add & edit": what they could do before, minus nothing new
// (deleting payments and expenses was owner-only then). The owner can raise it on the Staff page.
export async function importLegacyStaff(ownerId) {
  const businesses = await Business.find({ ownerId }, 'staffIds');
  const rows = await Staff.find({ ownerId }, 'userId');
  const known = new Set(rows.filter((r) => r.userId).map((r) => String(r.userId)));
  const missing = new Map(); // userId -> [businessId]
  for (const b of businesses) {
    for (const uid of b.staffIds || []) {
      if (known.has(String(uid))) continue;
      if (!missing.has(String(uid))) missing.set(String(uid), []);
      missing.get(String(uid)).push(b._id);
    }
  }
  if (!missing.size) return;
  const users = await User.find({ _id: { $in: [...missing.keys()] } }, 'name phone');
  for (const u of users) {
    await Staff.updateOne(
      { ownerId, phone: cleanPhone(u.phone) },
      { $setOnInsert: { name: u.name, userId: u._id, level: 2, allOutlets: false, businessIds: missing.get(String(u._id)) } },
      { upsert: true },
    );
  }
}

// Make every outlet's staffIds match the owner's Staff rows. Call importLegacyStaff before
// changing rows, not here: after a removal the person is still in staffIds and would come back.
export async function syncStaff(ownerId) {
  const [businesses, rows] = await Promise.all([Business.find({ ownerId }, '_id'), Staff.find({ ownerId, userId: { $ne: null } })]);
  await Promise.all(businesses.map((b) => {
    const ids = rows.filter((r) => r.allOutlets || r.businessIds.some((x) => x.equals(b._id))).map((r) => r.userId);
    return Business.updateOne({ _id: b._id }, { $set: { staffIds: ids } });
  }));
}

// Someone was invited before they had an account: link the invite once they sign up or sign in.
export async function linkStaffInvites(user) {
  const rows = await Staff.find({ phone: cleanPhone(user.phone), userId: null });
  if (!rows.length) return;
  await Staff.updateMany({ _id: { $in: rows.map((r) => r._id) } }, { $set: { userId: user._id } });
  await Promise.all([...new Set(rows.map((r) => String(r.ownerId)))].map(async (o) => { await importLegacyStaff(o); await syncStaff(o); }));
}

// What the signed-in person may do in this business: owners do everything (level 3 + owner).
export async function accessFor(business, userId) {
  if (business.ownerId.equals(userId)) return { owner: true, level: 3 };
  const row = await Staff.findOne({ ownerId: business.ownerId, userId }, 'level');
  return { owner: false, level: row ? row.level : 2 }; // no row = staff from before levels
}

// The level a request needs. Reading is open to every staff member; adding needs "Add";
// changing needs "Add & edit"; deleting needs "Full". A few POSTs are really edits.
export function levelNeeded(method, path) {
  const p = path.split('?')[0];
  if (method === 'GET' || method === 'HEAD') return /\/export\/backup\.json$/.test(p) ? 3 : 0;
  if (method === 'DELETE') return 3;
  if (method === 'PATCH') return /\/enquiries\//.test(p) ? 1 : 2; // following up an enquiry is daily work
  // POST / PUT
  if (/\/members\/[^/]+\/(move|pause|resume)$/.test(p)) return 2;
  if (/\/(groups|plans|rooms)(\/[^/]+\/floors)?$/.test(p)) return 2; // setup
  if (/\/checkin-link$/.test(p)) return 2;
  if (/\/members\/[^/]+\/share$/.test(p)) return 0;
  return 1;
}

export const cleanPhone = (v) => String(v || '').replace(/\D/g, '').slice(-10);
// accounts may hold the number with or without +91
export const phoneVariants = (p) => [p, '91' + p, '+91' + p, '+91 ' + p];
