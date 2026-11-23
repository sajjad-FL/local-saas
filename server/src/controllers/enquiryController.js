import { Enquiry, Plan, Member } from '../models/index.js';
import { ENQUIRY_STATUSES, ENQUIRY_SOURCES } from '../models/Enquiry.js';

// the fields an owner or staff can set; anything else in the body is ignored
async function clean(body, businessId, partial) {
  const out = {};
  if (!partial || body.name !== undefined) {
    const name = String(body.name ?? '').trim();
    if (!name) return { error: 'name is required' };
    out.name = name.slice(0, 80);
  }
  if (body.phone !== undefined) {
    const digits = String(body.phone ?? '').replace(/\D/g, '');
    if (digits && digits.length < 10) return { error: 'phone needs 10 digits' };
    out.phone = digits || undefined;
  }
  if (body.planId !== undefined) {
    if (body.planId && !(await Plan.exists({ _id: body.planId, businessId }))) return { error: 'plan not found' };
    out.planId = body.planId || null;
  }
  if (body.source !== undefined) {
    if (!ENQUIRY_SOURCES.includes(body.source)) return { error: 'unknown source' };
    out.source = body.source;
  }
  if (body.status !== undefined) {
    if (!ENQUIRY_STATUSES.includes(body.status)) return { error: 'unknown status' };
    out.status = body.status;
  }
  if (body.followUpOn !== undefined) {
    const d = body.followUpOn ? new Date(body.followUpOn) : null;
    if (d && Number.isNaN(d.getTime())) return { error: 'bad follow-up date' };
    out.followUpOn = d;
  }
  if (body.note !== undefined) out.note = String(body.note ?? '').trim().slice(0, 500);
  if (body.memberId !== undefined) {
    if (body.memberId && !(await Member.exists({ _id: body.memberId, businessId }))) return { error: 'member not found' };
    out.memberId = body.memberId || null;
  }
  return { out };
}

export async function getEnquiries(req, res, next) {
  try {
    const list = await Enquiry.find({ businessId: req.business._id })
      .populate('planId', 'name amount')
      .sort('-createdAt')
      .limit(2000);
    res.json(list);
  } catch (err) {
    next(err);
  }
}

export async function createEnquiry(req, res, next) {
  try {
    const { out, error } = await clean(req.body ?? {}, req.business._id, false);
    if (error) return res.status(400).json({ error });
    const enquiry = await Enquiry.create({ ...out, businessId: req.business._id, createdBy: req.userId });
    res.json(await enquiry.populate('planId', 'name amount'));
  } catch (err) {
    next(err);
  }
}

export async function updateEnquiry(req, res, next) {
  try {
    const { out, error } = await clean(req.body ?? {}, req.business._id, true);
    if (error) return res.status(400).json({ error });
    const enquiry = await Enquiry.findOneAndUpdate(
      { _id: req.params.enquiryId, businessId: req.business._id },
      out,
      { new: true },
    ).populate('planId', 'name amount');
    if (!enquiry) return res.status(404).json({ error: 'enquiry not found' });
    res.json(enquiry);
  } catch (err) {
    next(err);
  }
}

// owner, or staff with Full access (checked before this runs)
export async function deleteEnquiry(req, res, next) {
  try {
    const enquiry = await Enquiry.findOneAndDelete({ _id: req.params.enquiryId, businessId: req.business._id });
    if (!enquiry) return res.status(404).json({ error: 'enquiry not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
