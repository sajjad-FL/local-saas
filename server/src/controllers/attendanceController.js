import { Attendance, Member, Subscription, Business } from '../models/index.js';
import { localDay, addDays, isDay, summarize, detectColumns, findHeaderRow, buildPunches, firstPunchPerDay } from '../services/attendanceService.js';
import { ensureToken, memberBalances } from '../services/billingService.js';

const todayFor = (biz) => localDay(new Date(), biz.timezone || 'Asia/Kolkata');
// switched off in Settings: nothing can be marked or read until it's back on (records are kept)
const turnedOff = (biz, res) => biz.attendanceEnabled === false && res.status(403).json({ error: 'attendance is turned off in Settings' });

// Active members (optionally one group) for a day, with how each is marked
export async function getAttendanceDay(req, res, next) {
  try {
    if (turnedOff(req.business, res)) return;
    const today = todayFor(req.business);
    const day = req.query.day || today;
    if (!isDay(day)) return res.status(400).json({ error: 'day must be YYYY-MM-DD' });
    const filter = { businessId: req.business._id, status: 'active' };
    if (req.query.groupId) filter.groupId = req.query.groupId;

    const members = await Member.find(filter).sort('name');
    const ids = members.map((m) => m._id);
    const [records, paused, balances] = await Promise.all([
      Attendance.find({ memberId: { $in: ids }, day }),
      Subscription.find({ memberId: { $in: ids }, status: 'paused' }).distinct('memberId'),
      memberBalances(req.business._id),
    ]);
    const byMember = new Map(records.map((r) => [String(r.memberId), r]));
    const pausedSet = new Set(paused.map(String));

    const rows = members.map((m) => {
      const r = byMember.get(String(m._id));
      return {
        _id: m._id, name: m.name, phone: m.phone, groupId: m.groupId,
        paused: pausedSet.has(String(m._id)),
        status: r?.status || null, method: r?.method || null, at: r?.at || null,
        due: Math.max(0, balances.get(String(m._id)) || 0),
      };
    });
    const present = rows.filter((r) => r.status === 'present').length;
    const absent = rows.filter((r) => r.status === 'absent').length;
    res.json({ day, today, members: rows, counts: { present, absent, unmarked: rows.length - present - absent, total: rows.length } });
  } catch (err) {
    next(err);
  }
}

// Mark one member present/absent for a day; status null clears it
export async function markAttendance(req, res, next) {
  try {
    if (turnedOff(req.business, res)) return;
    const { day, memberId, status } = req.body ?? {};
    if (!isDay(day)) return res.status(400).json({ error: 'day must be YYYY-MM-DD' });
    if (day > todayFor(req.business)) return res.status(400).json({ error: "can't mark attendance for a future day" });
    if (status !== null && !['present', 'absent'].includes(status)) return res.status(400).json({ error: 'status must be present, absent or null' });
    const member = await Member.findOne({ _id: memberId, businessId: req.business._id });
    if (!member) return res.status(404).json({ error: 'member not found' });

    if (status === null) {
      await Attendance.deleteOne({ memberId: member._id, day });
      return res.json({ ok: true, status: null });
    }
    const record = await Attendance.findOneAndUpdate(
      { memberId: member._id, day },
      { businessId: req.business._id, status, method: 'staff', markedBy: req.userId, at: new Date() },
      { upsert: true, new: true },
    );
    res.json(record);
  } catch (err) {
    next(err);
  }
}

// "Mark all present": fills in everyone not yet marked; explicit absences are kept
export async function markAllPresent(req, res, next) {
  try {
    if (turnedOff(req.business, res)) return;
    const { day, groupId } = req.body ?? {};
    if (!isDay(day)) return res.status(400).json({ error: 'day must be YYYY-MM-DD' });
    if (day > todayFor(req.business)) return res.status(400).json({ error: "can't mark attendance for a future day" });
    const filter = { businessId: req.business._id, status: 'active' };
    if (groupId) filter.groupId = groupId;
    const members = await Member.find(filter).select('_id');
    const paused = new Set((await Subscription.find({ memberId: { $in: members.map((m) => m._id) }, status: 'paused' }).distinct('memberId')).map(String));
    const ops = members.filter((m) => !paused.has(String(m._id))).map((m) => ({
      updateOne: {
        filter: { memberId: m._id, day },
        update: { $setOnInsert: { businessId: req.business._id, status: 'present', method: 'staff', markedBy: req.userId, at: new Date() } },
        upsert: true,
      },
    }));
    const result = ops.length ? await Attendance.bulkWrite(ops) : { upsertedCount: 0 };
    res.json({ ok: true, marked: result.upsertedCount });
  } catch (err) {
    next(err);
  }
}

// owner only: the secret in the gym's check-in QR; rotate: true makes old posters stop working
export async function checkinLink(req, res, next) {
  try {
    if (!req.business.ownerId.equals(req.userId)) return res.status(403).json({ error: 'owner only' });
    if (turnedOff(req.business, res)) return;
    if (req.body?.rotate) req.business.checkinToken = undefined;
    res.json({ token: await ensureToken(req.business, Business, 'checkinToken') });
  } catch (err) {
    next(err);
  }
}

// A member's attendance over a range (default: the last 30 days)
export async function getMemberAttendance(req, res, next) {
  try {
    const biz = await Business.findById(req.member.businessId);
    if (turnedOff(biz, res)) return;
    const today = todayFor(biz);
    const to = isDay(req.query.to) ? req.query.to : today;
    const from = isDay(req.query.from) ? req.query.from : addDays(to, -29);
    const records = await Attendance.find({ memberId: req.member._id, day: { $gte: from, $lte: to } }).sort('day');
    const last = await Attendance.findOne({ memberId: req.member._id, status: 'present' }).sort('-day');
    res.json({
      from, to, today,
      records: records.map((r) => ({ day: r.day, status: r.status, method: r.method, at: r.at })),
      ...summarize(records, from, to),
      lastPresent: last?.day || null,
    });
  } catch (err) {
    next(err);
  }
}

// Import a biometric machine's export. The browser reads the file into rows; the server finds
// the columns, reads the times and matches machine IDs to members (member.biometricId).
// dryRun: true returns a preview (who matched, who didn't) without writing anything.
// links: { machineId: memberId } saves new machine-ID-to-member links first.
export async function importAttendance(req, res, next) {
  try {
    if (turnedOff(req.business, res)) return;
    const { rows, columns, links = {}, dryRun = false } = req.body ?? {};
    if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'the file looks empty' });
    if (rows.length > 60000) return res.status(400).json({ error: 'file too large: export a shorter date range (up to 60,000 rows)' });

    const headerRow = findHeaderRow(rows);
    const cols = columns || (headerRow >= 0 ? detectColumns(rows[headerRow]) : null);
    if (!cols || cols.id < 0 || (cols.datetime < 0 && cols.date < 0)) {
      return res.status(400).json({ error: "couldn't find the ID and date columns", header: rows.slice(0, 15) });
    }
    const tz = req.business.timezone || 'Asia/Kolkata';
    const today = todayFor(req.business);
    const { punches, skipped } = buildPunches(rows.slice(headerRow + 1), cols, tz);
    const usable = punches.filter((p) => p.day <= today);

    const members = await Member.find({ businessId: req.business._id }).select('name biometricId status');
    const byId = new Map(members.map((m) => [String(m._id), m]));
    // links typed in the preview win over stored ones; a member keeps one machine ID
    const linkFor = new Map(members.filter((m) => m.biometricId).map((m) => [m.biometricId, m]));
    for (const [machineId, memberId] of Object.entries(links)) {
      const m = byId.get(String(memberId));
      if (m) linkFor.set(String(machineId), m);
    }

    // one entry per machine ID, with a name-based suggestion for unlinked ones
    const people = new Map();
    for (const p of usable) {
      const e = people.get(p.machineId) || { machineId: p.machineId, name: p.name, punches: 0, days: new Set() };
      e.punches++; e.days.add(p.day);
      if (!e.name && p.name) e.name = p.name;
      people.set(p.machineId, e);
    }
    const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
    const list = [...people.values()].map((e) => {
      const linked = linkFor.get(e.machineId);
      const suggestion = !linked && e.name && members.find((m) => norm(m.name) === norm(e.name));
      return {
        machineId: e.machineId, name: e.name, punches: e.punches, days: e.days.size,
        memberId: linked ? String(linked._id) : null,
        memberName: linked?.name || null,
        suggestedMemberId: suggestion ? String(suggestion._id) : null,
      };
    }).sort((a, b) => (a.memberId ? 1 : 0) - (b.memberId ? 1 : 0) || a.machineId.localeCompare(b.machineId, undefined, { numeric: true }));
    const days = usable.map((p) => p.day).sort();
    const summary = {
      headerRow, columns: cols, header: headerRow >= 0 ? rows[headerRow] : null,
      punches: usable.length, future: punches.length - usable.length, skipped,
      from: days[0] || null, to: days.at(-1) || null, people: list,
    };
    if (dryRun) return res.json(summary);

    // save the new links (a machine ID belongs to one member)
    for (const [machineId, memberId] of Object.entries(links)) {
      if (!byId.has(String(memberId))) continue;
      await Member.updateMany({ businessId: req.business._id, biometricId: String(machineId), _id: { $ne: memberId } }, { $unset: { biometricId: 1 } });
      await Member.updateOne({ _id: memberId }, { biometricId: String(machineId) });
    }

    // first punch a day = present. A staff "absent" is overwritten (the machine saw them);
    // an earlier check-in time is kept; the method stays as first recorded.
    const ops = firstPunchPerDay(usable.filter((p) => linkFor.has(p.machineId))).map((p) => ({
      updateOne: {
        filter: { memberId: linkFor.get(p.machineId)._id, day: p.day },
        update: [{
          $set: {
            businessId: req.business._id,
            method: { $cond: [{ $eq: ['$status', 'present'] }, '$method', 'biometric'] },
            at: { $cond: [{ $and: [{ $eq: ['$status', 'present'] }, { $lt: ['$at', p.at] }] }, '$at', p.at] },
            status: 'present',
          },
        }],
        upsert: true,
      },
    }));
    const result = ops.length ? await Attendance.bulkWrite(ops, { ordered: false }) : { upsertedCount: 0, modifiedCount: 0 };
    res.json({
      ...summary,
      added: result.upsertedCount,
      updated: result.modifiedCount,
      membersMatched: new Set(usable.filter((p) => linkFor.has(p.machineId)).map((p) => p.machineId)).size,
      notLinked: list.filter((e) => !linkFor.has(e.machineId)).length,
    });
  } catch (err) {
    next(err);
  }
}

// The call list: active, unpaused members with no attendance in the last `days` days.
// Members who joined within that window aren't listed yet.
export async function getNotComing(req, res, next) {
  try {
    if (turnedOff(req.business, res)) return;
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
    const tz = req.business.timezone || 'Asia/Kolkata';
    const today = todayFor(req.business);
    const cutoff = addDays(today, -days);

    const members = await Member.find({ businessId: req.business._id, status: 'active' }).select('name phone joinDate groupId');
    const ids = members.map((m) => m._id);
    const [paused, last] = await Promise.all([
      Subscription.find({ memberId: { $in: ids }, status: 'paused' }).distinct('memberId'),
      Attendance.aggregate([
        { $match: { memberId: { $in: ids }, status: 'present' } },
        { $group: { _id: '$memberId', last: { $max: '$day' } } },
      ]),
    ]);
    const pausedSet = new Set(paused.map(String));
    const lastBy = new Map(last.map((l) => [String(l._id), l.last]));
    const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);

    const list = members
      .filter((m) => !pausedSet.has(String(m._id)))
      .map((m) => {
        const lastDay = lastBy.get(String(m._id)) || null;
        const since = lastDay || localDay(m.joinDate, tz);
        return { _id: m._id, name: m.name, phone: m.phone, groupId: m.groupId, lastPresent: lastDay, since, daysAway: daysBetween(since, today) };
      })
      .filter((m) => m.since <= cutoff)
      .sort((a, b) => b.daysAway - a.daysAway);
    res.json({ days, today, members: list });
  } catch (err) {
    next(err);
  }
}
