import { Due, Payment, Room, Member } from '../models/index.js';

// Pure billing logic: allocate a member's total paid across their dues, oldest first.
// Returns the status each due should have.
export function dueStatuses(dues, totalPaid) {
  let left = totalPaid;
  return dues.map((d) => {
    const status = left >= d.amount ? 'paid' : left > 0 ? 'partial' : 'unpaid';
    left = Math.max(0, left - d.amount);
    return status;
  });
}

// Pure helper: add plan cycle duration using calendar months when cycle is monthly-based
export function addPlanCycle(date, cycleDays) {
  const d = new Date(date);
  if (cycleDays === 30 || cycleDays === 31) {
    d.setMonth(d.getMonth() + 1);
  } else if (cycleDays === 90 || cycleDays === 91) {
    d.setMonth(d.getMonth() + 3);
  } else if (cycleDays === 180 || cycleDays === 182) {
    d.setMonth(d.getMonth() + 6);
  } else if (cycleDays === 365 || cycleDays === 360) {
    d.setFullYear(d.getFullYear() + 1);
  } else if (cycleDays % 30 === 0) {
    d.setMonth(d.getMonth() + Math.round(cycleDays / 30));
  } else {
    d.setDate(d.getDate() + cycleDays);
  }
  return d;
}

// Pure billing logic: calculate billing periods to append so a subscription's periodEnd lands in the future.
export function rollForward(periodEnd, cycleDays, now) {
  const periods = [];
  let end = new Date(periodEnd);
  while (end <= now) {
    const periodStart = new Date(end);
    end = addPlanCycle(end, cycleDays);
    periods.push({ periodStart, periodEnd: end });
  }
  return periods;
}

// Re-derive every due status for a member from scratch. Idempotent, predictable, correct.
export async function recomputeDues(memberId) {
  const [dues, [paid]] = await Promise.all([
    Due.find({ memberId }).sort('dueDate'),
    Payment.aggregate([{ $match: { memberId } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);
  const statuses = dueStatuses(dues, paid?.total || 0);
  await Promise.all(dues.map((d, i) =>
    d.status === statuses[i] ? null : Due.updateOne({ _id: d._id }, { status: statuses[i] })
  ));
}

// Map of memberId -> balance (dues − payments) for one business.
export async function memberBalances(businessId) {
  const byMember = { $group: { _id: '$memberId', total: { $sum: '$amount' } } };
  const [dues, pays] = await Promise.all([
    Due.aggregate([{ $match: { businessId } }, byMember]),
    Payment.aggregate([{ $match: { businessId } }, byMember]),
  ]);
  const bal = new Map(dues.map((d) => [String(d._id), d.total]));
  for (const p of pays) bal.set(String(p._id), (bal.get(String(p._id)) || 0) - p.total);
  return bal;
}

// Room capacity check: null when the room has a free bed, else an error message
export async function roomFullError(roomId, businessId, excludeMemberId) {
  const room = await Room.findById(roomId);
  if (!room || !room.businessId.equals(businessId)) return 'room not found';
  const occupied = await Member.countDocuments({ roomId, status: 'active', _id: { $ne: excludeMemberId } });
  return occupied >= room.capacity ? `room ${room.roomNo} is full` : null;
}

// Pure helper: format 2D array to CSV format with escaping
export const csv = (rows) =>
  rows.map((r) => r.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');

