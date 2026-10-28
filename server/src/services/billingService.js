import crypto from 'node:crypto';
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

// Pure billing logic: what is still owed on each due after allocating totalPaid oldest first.
export function dueRemaining(dues, totalPaid) {
  let left = totalPaid;
  return dues.map((d) => {
    const covered = Math.min(left, d.amount);
    left -= covered;
    return d.amount - covered;
  });
}

// What is still owed on each due (id -> amount), with every member's payments covering their
// oldest dues first. A partly paid due owes only its unpaid part.
export function remainingByDue(dues, payments) {
  const paidBy = new Map();
  for (const p of payments) paidBy.set(String(p.memberId), (paidBy.get(String(p.memberId)) || 0) + p.amount);
  const duesBy = new Map();
  for (const d of [...dues].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))) {
    const id = String(d.memberId);
    if (!duesBy.has(id)) duesBy.set(id, []);
    duesBy.get(id).push(d);
  }
  const out = new Map();
  for (const [id, list] of duesBy) {
    dueRemaining(list, paidBy.get(id) || 0).forEach((r, i) => out.set(String(list[i]._id), r));
  }
  return out;
}

// Pure helper: months in a plan cycle, or 0 when the cycle is a plain day count
export function cycleMonths(cycleDays) {
  if (cycleDays === 30 || cycleDays === 31) return 1;
  if (cycleDays === 90 || cycleDays === 91) return 3;
  if (cycleDays === 180 || cycleDays === 182) return 6;
  if (cycleDays === 360 || cycleDays === 365) return 12;
  if (cycleDays % 30 === 0) return cycleDays / 30;
  return 0;
}

// Pure helper: add one plan cycle. Monthly cycles land on anchorDay (the day the
// member started), clamped to the month's last day — so Jan 31 → Feb 28 → Mar 31,
// never Jan 31 → Mar 3. UTC throughout so results don't depend on server timezone.
export function addPlanCycle(date, cycleDays, anchorDay = new Date(date).getUTCDate()) {
  const d = new Date(date);
  const months = cycleMonths(cycleDays);
  if (!months) {
    d.setUTCDate(d.getUTCDate() + cycleDays);
    return d;
  }
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  d.setUTCFullYear(y, m, Math.min(anchorDay, lastDay));
  return d;
}

// Pure billing logic: calculate billing periods to append so a subscription's periodEnd lands in the future.
export function rollForward(periodEnd, cycleDays, now, anchorDay) {
  const periods = [];
  let end = new Date(periodEnd);
  while (end <= now) {
    const periodStart = new Date(end);
    end = addPlanCycle(end, cycleDays, anchorDay);
    periods.push({ periodStart, periodEnd: end });
  }
  return periods;
}

// Create the dues for these periods; upsert so an existing cycle is left alone, never billed twice.
export async function createDues(sub, member, amount, periods) {
  await Promise.all(periods.map((p) => Due.updateOne(
    { subscriptionId: sub._id, periodStart: p.periodStart },
    { $setOnInsert: { memberId: member._id, businessId: member.businessId, amount, periodEnd: p.periodEnd, dueDate: p.periodStart } },
    { upsert: true },
  )));
}

// Pure: dues and payments merged oldest-first with the balance after each entry.
// On the same day a due is listed before the payment that clears it.
export function ledger(dues, payments) {
  const rows = [
    ...dues.map((d) => ({ kind: 'due', id: String(d._id), date: d.dueDate, amount: d.amount, periodEnd: d.periodEnd })),
    ...payments.map((p) => ({ kind: 'payment', id: String(p._id), date: p.date, amount: p.amount, mode: p.mode })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date) || (a.kind === 'due' ? -1 : 1));
  let balance = 0;
  for (const r of rows) r.balance = balance += r.kind === 'due' ? r.amount : -r.amount;
  return rows;
}

// A document's secret-link token (field), created on first use
export async function ensureToken(doc, Model, field) {
  if (!doc[field]) {
    doc[field] = crypto.randomBytes(18).toString('base64url');
    await Model.updateOne({ _id: doc._id }, { [field]: doc[field] });
  }
  return doc[field];
}

// The member's statement token, created on first use
export const ensureShareToken = (member) => ensureToken(member, Member, 'shareToken');

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

