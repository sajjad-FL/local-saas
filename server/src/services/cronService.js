import cron from 'node-cron';
import { Business, Member, Reminder, Subscription, Due } from '../models/index.js';
import { rollForward, recomputeDues, memberBalances } from './billingService.js';

// For every active subscription whose period has ended, create the next due(s)
// and advance the period. Safe to run any number of times.
export async function rollCycles(now = new Date()) {
  const subs = await Subscription.find({ status: 'active', periodEnd: { $lte: now } })
    .populate('planId memberId');
  for (const sub of subs) {
    if (!sub.memberId || sub.memberId.status !== 'active' || !sub.planId) continue;
    const periods = rollForward(sub.periodEnd, sub.planId.cycleDays, now);
    for (const p of periods) {
      await Due.create({
        memberId: sub.memberId._id,
        businessId: sub.memberId.businessId,
        subscriptionId: sub._id,
        amount: sub.planId.amount,
        ...p,
        dueDate: p.periodStart,
      });
    }
    Object.assign(sub, periods.at(-1));
    await sub.save();
    await recomputeDues(sub.memberId._id); // advance payments cover new dues
  }
  if (subs.length) console.log(`rolled ${subs.length} subscription(s)`);
}

// WhatsApp reminder text template
const remindText = (biz, name, balance) =>
  `Hi ${name}, your payment of ₹${balance} for ${biz.name} is pending. Please pay at the earliest. Thank you!` +
  (biz.upiId ? ` Pay via UPI: upi://pay?pa=${biz.upiId}&pn=${encodeURIComponent(biz.name)}&am=${balance}&cu=INR` : '');

// Meta Cloud API WhatsApp sender
async function sendWhatsApp(phone, text) {
  let to = (phone || '').replace(/\D/g, '');
  if (to.length === 10) to = '91' + to; // assumes India phone numbers; configurable for multi-country
  const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
  });
  if (!res.ok) throw new Error(`whatsapp ${res.status}: ${await res.text()}`);
}

// Every member owing money gets one reminder, at most once per 3 days.
export async function sendReminders(now = new Date()) {
  for (const biz of await Business.find()) {
    const [bal, members, recent] = await Promise.all([
      memberBalances(biz._id),
      Member.find({ businessId: biz._id, status: 'active', phone: { $nin: [null, ''] } }),
      Reminder.find({ businessId: biz._id, sentAt: { $gte: new Date(now - 3 * 86400000) } }),
    ]);
    const reminded = new Set(recent.map((r) => String(r.memberId)));
    for (const m of members) {
      const balance = bal.get(String(m._id)) || 0;
      if (balance <= 0 || reminded.has(String(m._id))) continue;
      try {
        await sendWhatsApp(m.phone, remindText(biz, m.name, balance));
        await Reminder.create({ memberId: m._id, businessId: biz._id, amount: balance });
      } catch (err) {
        console.error(`reminder to ${m.name} failed: ${err.message}`);
      }
    }
  }
}

export function startCron() {
  cron.schedule('0 1 * * *', () => rollCycles().catch(console.error));
  if (process.env.WA_TOKEN && process.env.WA_PHONE_ID)
    cron.schedule('0 10 * * *', () => sendReminders().catch(console.error));
  else
    console.log('auto-reminders off — set WA_TOKEN + WA_PHONE_ID to enable');
}

