import { CatalogueItem, Sale, Due, Payment } from '../models/index.js';
import { recomputeDues } from '../services/billingService.js';

const KINDS = ['pt', 'service', 'product'];
const MODES = ['cash', 'upi', 'other'];

const clean = (body, partial) => {
  const out = {};
  const b = body ?? {};
  if (!partial || b.kind !== undefined) {
    if (!KINDS.includes(b.kind)) return { error: 'pick PT, service or product' };
    out.kind = b.kind;
  }
  if (!partial || b.name !== undefined) {
    const name = String(b.name || '').trim().slice(0, 60);
    if (!name) return { error: 'give it a name' };
    out.name = name;
  }
  if (!partial || b.price !== undefined) {
    const price = Number(b.price);
    if (!(price > 0)) return { error: 'price must be more than 0' };
    out.price = Math.round(price);
  }
  if (b.detail !== undefined) out.detail = String(b.detail || '').trim().slice(0, 80);
  if (b.trackStock !== undefined) out.trackStock = !!b.trackStock;
  if (b.stock !== undefined) {
    const stock = Number(b.stock);
    if (!Number.isInteger(stock) || stock < 0) return { error: 'stock must be a whole number' };
    out.stock = stock;
  }
  return { out };
};

// Items with how many sold this month
export async function getCatalogue(req, res, next) {
  try {
    const items = await CatalogueItem.find({ businessId: req.business._id, active: true }).sort('kind price name');
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const sold = await Sale.aggregate([
      { $match: { businessId: req.business._id, at: { $gte: monthStart } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.itemId', qty: { $sum: '$items.qty' } } },
    ]);
    const soldBy = new Map(sold.map((s) => [String(s._id), s.qty]));
    res.json(items.map((i) => ({ ...i.toObject(), soldThisMonth: soldBy.get(String(i._id)) || 0 })));
  } catch (err) {
    next(err);
  }
}

export async function createCatalogueItem(req, res, next) {
  try {
    const { out, error } = clean(req.body, false);
    if (error) return res.status(400).json({ error });
    if (out.kind !== 'product') { out.trackStock = false; out.stock = 0; }
    const item = await CatalogueItem.create({ ...out, businessId: req.business._id });
    res.json(item);
  } catch (err) {
    next(err);
  }
}

export async function updateCatalogueItem(req, res, next) {
  try {
    const item = await CatalogueItem.findOne({ _id: req.params.itemId, businessId: req.business._id, active: true }).catch(() => null);
    if (!item) return res.status(404).json({ error: 'item not found' });
    const { out, error } = clean(req.body, true);
    if (error) return res.status(400).json({ error });
    Object.assign(item, out);
    if (item.kind !== 'product') { item.trackStock = false; item.stock = 0; }
    await item.save();
    res.json(item);
  } catch (err) {
    next(err);
  }
}

// Removing hides it from the catalogue; past sales keep their names and prices
export async function deleteCatalogueItem(req, res, next) {
  try {
    const item = await CatalogueItem.findOneAndUpdate({ _id: req.params.itemId, businessId: req.business._id }, { active: false }).catch(() => null);
    if (!item) return res.status(404).json({ error: 'item not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// Sell items to a member: one charge for the total, and the payment too when paid on the spot
export async function sellToMember(req, res, next) {
  try {
    const { items, paidNow, mode } = req.body ?? {};
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'pick at least one item' });
    const wanted = new Map();
    for (const it of items) {
      const qty = Number(it?.qty);
      if (!Number.isInteger(qty) || qty < 1 || qty > 100) return res.status(400).json({ error: 'quantity must be 1 to 100' });
      wanted.set(String(it.itemId), (wanted.get(String(it.itemId)) || 0) + qty);
    }
    const found = await CatalogueItem.find({ _id: { $in: [...wanted.keys()] }, businessId: req.member.businessId, active: true }).catch(() => null);
    if (!found || found.length !== wanted.size) return res.status(400).json({ error: 'item not found' });
    for (const i of found) {
      if (i.trackStock && i.stock < wanted.get(String(i._id))) return res.status(400).json({ error: `only ${i.stock} ${i.name} left` });
    }
    if (paidNow && !MODES.includes(mode)) return res.status(400).json({ error: 'pick cash, UPI or card' });

    // take stock first, only where enough is left (two sales at once can't oversell)
    const taken = [];
    for (const i of found.filter((x) => x.trackStock)) {
      const q = wanted.get(String(i._id));
      const r = await CatalogueItem.updateOne({ _id: i._id, stock: { $gte: q } }, { $inc: { stock: -q } });
      if (!r.modifiedCount) {
        await Promise.all(taken.map(([id, n]) => CatalogueItem.updateOne({ _id: id }, { $inc: { stock: n } })));
        return res.status(409).json({ error: `${i.name} just ran out — check the stock` });
      }
      taken.push([i._id, q]);
    }

    const lines = found.map((i) => ({ itemId: i._id, kind: i.kind, name: i.name, price: i.price, qty: wanted.get(String(i._id)) }));
    const total = lines.reduce((n, l) => n + l.price * l.qty, 0);
    const label = lines.map((l) => (l.qty > 1 ? `${l.name} ×${l.qty}` : l.name)).join(', ').slice(0, 120);
    const now = new Date();
    const due = await Due.create({
      memberId: req.member._id, businessId: req.member.businessId, amount: total,
      dueDate: now, periodStart: now, periodEnd: now, label, kind: 'sale',
    });
    const payment = paidNow
      ? await Payment.create({ memberId: req.member._id, businessId: req.member.businessId, amount: total, date: now, mode, note: label })
      : null;
    const sale = await Sale.create({ businessId: req.member.businessId, memberId: req.member._id, items: lines, total, dueId: due._id, paymentId: payment?._id, soldBy: req.userId, at: now });
    await recomputeDues(req.member._id);
    res.json(sale);
  } catch (err) {
    next(err);
  }
}
