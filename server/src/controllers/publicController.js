import { Member, Business, Due, Payment } from '../models/index.js';
import { ledger } from '../services/billingService.js';

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
