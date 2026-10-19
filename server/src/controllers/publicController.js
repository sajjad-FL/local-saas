import { Member, Business, Due, Payment, Attendance } from '../models/index.js';
import { ledger } from '../services/billingService.js';
import { localDay, phoneKey } from '../services/attendanceService.js';

// Read-only member statement, reached by the secret link the owner shares. No login:
// only what the member already knows about themselves, never phone numbers or other members.
export async function getStatement(req, res, next) {
  try {
    const member = req.params.token && await Member.findOne({ shareToken: req.params.token });
    if (!member) return res.status(404).json({ error: 'this statement link is invalid or was revoked' });
    const [biz, dues, payments] = await Promise.all([
      Business.findById(member.businessId),
      Due.find({ memberId: member._id }),
      Payment.find({ memberId: member._id }),
    ]);
    if (biz.status === 'suspended') return res.status(404).json({ error: 'this statement is not available right now' });
    const rows = ledger(dues, payments);
    res.json({
      business: { name: biz.name, type: biz.type, upiId: biz.upiId },
      member: { name: member.name, status: member.status, joinDate: member.joinDate, deposit: member.deposit, noticeGivenOn: member.noticeGivenOn },
      ledger: rows,
      balance: rows.at(-1)?.balance || 0,
      generatedAt: new Date(),
    });
  } catch (err) {
    next(err);
  }
}

// Gym check-in QR: the page shows only the gym's name
export async function getCheckin(req, res, next) {
  try {
    const biz = req.params.token && await Business.findOne({ checkinToken: req.params.token });
    if (!biz) return res.status(404).json({ error: 'this check-in code is no longer valid' });
    if (biz.attendanceEnabled === false || biz.status === 'suspended') return res.status(404).json({ error: 'check-in is turned off at the moment' });
    res.json({ business: { name: biz.name, type: biz.type } });
  } catch (err) {
    next(err);
  }
}

// A member checks in with their phone number. Replies with a first name and time only,
// never balances or plans, so typing random numbers reveals nothing.
export async function postCheckin(req, res, next) {
  try {
    const biz = req.params.token && await Business.findOne({ checkinToken: req.params.token });
    if (!biz) return res.status(404).json({ error: 'this check-in code is no longer valid' });
    if (biz.attendanceEnabled === false || biz.status === 'suspended') return res.status(404).json({ error: 'check-in is turned off at the moment' });
    const key = phoneKey(req.body?.phone);
    if (key.length !== 10) return res.status(400).json({ error: 'enter your 10-digit mobile number' });

    const members = await Member.find({ businessId: biz._id, status: 'active', phone: { $nin: [null, ''] } });
    const matches = members.filter((m) => phoneKey(m.phone) === key);
    if (!matches.length) return res.status(404).json({ error: "we couldn't find that number — please ask the front desk" });
    // family members often share one number: let them pick (first names only, to whoever has the number)
    const member = matches.length === 1 ? matches[0] : matches.find((m) => String(m._id) === String(req.body?.memberId));
    if (!member) {
      return res.json({ choose: matches.map((m) => ({ id: m._id, name: m.name.split(' ')[0] })) });
    }

    const day = localDay(new Date(), biz.timezone || 'Asia/Kolkata');
    const existing = await Attendance.findOne({ memberId: member._id, day });
    const record = existing?.status === 'present'
      ? existing
      : await Attendance.findOneAndUpdate(
        { memberId: member._id, day },
        { businessId: biz._id, status: 'present', method: 'qr', at: new Date(), $unset: { markedBy: 1 } },
        { upsert: true, new: true },
      );
    res.json({ name: member.name.split(' ')[0], business: biz.name, at: record.at, already: existing?.status === 'present' });
  } catch (err) {
    next(err);
  }
}
