import { CatalogueItem, Sale, Due, Payment, Member, User } from '../models/index.js';
import { recomputeDues, remainingByDue, csv } from '../services/billingService.js';

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
  if (b.cost !== undefined) {
    if (b.cost === null || b.cost === '') out.cost = undefined;
    else {
      const cost = Number(b.cost);
      if (!(cost >= 0)) return { error: 'cost price must be 0 or more' };
      out.cost = Math.round(cost);
    }
  }
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

    const lines = found.map((i) => ({ itemId: i._id, kind: i.kind, name: i.name, price: i.price, cost: i.cost ?? undefined, qty: wanted.get(String(i._id)) }));
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

// Sales for a period: totals, by item, and every sale (member, items, paid or on dues)
async function salesFor(business, from, to) {
  const match = { businessId: business._id, at: { $gte: from, $lte: to } };
  const sales = await Sale.find(match).sort('-at');
  const memberIds = [...new Set(sales.map((x) => String(x.memberId)))];
  const [members, sellers, dues, payments, items] = await Promise.all([
    Member.find({ _id: { $in: memberIds } }, 'name phone'),
    User.find({ _id: { $in: [...new Set(sales.map((x) => String(x.soldBy)).filter(Boolean))] } }, 'name'),
    Due.find({ memberId: { $in: memberIds } }).sort('dueDate'),
    Payment.find({ memberId: { $in: memberIds } }),
    CatalogueItem.find({ businessId: business._id }),
  ]);
  const memberBy = new Map(members.map((m) => [String(m._id), m]));
  const sellerBy = new Map(sellers.map((u) => [String(u._id), u.name]));
  const owed = remainingByDue(dues, payments);
  const payBy = new Map(payments.map((p) => [String(p._id), p]));
  const itemBy = new Map(items.map((i) => [String(i._id), i]));

  const rows = sales.map((x) => {
    const pay = x.paymentId ? payBy.get(String(x.paymentId)) : null;
    const stillOwed = x.paymentId ? 0 : Math.max(0, owed.get(String(x.dueId)) ?? 0);
    const m = memberBy.get(String(x.memberId));
    return {
      _id: x._id, at: x.at, memberId: x.memberId, memberName: m?.name || 'Removed member', memberPhone: m?.phone || null,
      items: x.items, total: x.total,
      paid: !!x.paymentId, mode: pay?.mode || null, onDues: !x.paymentId, stillOwed,
      soldBy: x.soldBy ? sellerBy.get(String(x.soldBy)) || null : null,
    };
  });

  const byItem = new Map();
  let qty = 0; let revenue = 0; let cost = 0; let costKnownRevenue = 0;
  for (const x of sales) {
    for (const l of x.items) {
      const k = String(l.itemId);
      const row = byItem.get(k) || { itemId: l.itemId, name: l.name, kind: l.kind, qty: 0, revenue: 0, cost: 0, costKnown: true };
      row.qty += l.qty; row.revenue += l.price * l.qty;
      if (l.cost == null) row.costKnown = false; else row.cost += l.cost * l.qty;
      byItem.set(k, row);
      qty += l.qty; revenue += l.price * l.qty;
      if (l.cost != null) { cost += l.cost * l.qty; costKnownRevenue += l.price * l.qty; }
    }
  }
  const items2 = [...byItem.values()].map((r) => {
    const live = itemBy.get(String(r.itemId));
    return { ...r, profit: r.costKnown ? r.revenue - r.cost : null, stock: live?.trackStock ? live.stock : null, removed: !live?.active };
  }).sort((a, b) => b.revenue - a.revenue);

  return {
    sales: rows,
    byItem: items2,
    totals: {
      count: sales.length, qty, revenue,
      cost: costKnownRevenue ? cost : null,
      profit: costKnownRevenue ? costKnownRevenue - cost : null, // only over items that have a cost price
      profitOn: costKnownRevenue, // the revenue the profit figure covers
      unpaid: rows.reduce((n, r) => n + r.stillOwed, 0),
    },
  };
}

const range = (req) => {
  const to = req.query.to ? new Date(req.query.to) : new Date();
  const from = req.query.from ? new Date(req.query.from) : new Date(0);
  return isNaN(from) || isNaN(to) ? null : { from, to };
};

export async function getSales(req, res, next) {
  try {
    const r = range(req);
    if (!r) return res.status(400).json({ error: 'bad dates' });
    const result = await salesFor(req.business, r.from, r.to);
    // the same length of time just before, for "vs last" on revenue
    if (req.query.from) {
      const len = r.to - r.from;
      const prev = await Sale.aggregate([
        { $match: { businessId: req.business._id, at: { $gte: new Date(r.from - len - 1), $lt: r.from } } },
        { $group: { _id: null, revenue: { $sum: '$total' } } },
      ]);
      result.totals.prevRevenue = prev[0]?.revenue || 0;
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function exportSalesCsv(req, res, next) {
  try {
    const r = range(req) || { from: new Date(0), to: new Date() };
    const { sales } = await salesFor(req.business, r.from, r.to);
    const rows = [['Date', 'Member', 'Phone', 'Items', 'Total', 'Paid', 'Mode', 'Still owed', 'Sold by']];
    for (const x of sales) {
      rows.push([x.at.toISOString().slice(0, 10), x.memberName, x.memberPhone, x.items.map((l) => (l.qty > 1 ? `${l.name} x${l.qty}` : l.name)).join('; '),
        x.total, x.paid ? 'yes' : 'on dues', x.mode || '', x.stillOwed, x.soldBy || '']);
    }
    res.type('text/csv').attachment('sales.csv').send(csv(rows));
  } catch (err) {
    next(err);
  }
}

// Undo a sale made by mistake: the charge and its payment go, the stock comes back
export async function undoSale(req, res, next) {
  try {
    const sale = await Sale.findOne({ _id: req.params.saleId, memberId: req.member._id }).catch(() => null);
    if (!sale) return res.status(404).json({ error: 'sale not found' });
    await Promise.all([
      sale.dueId && Due.deleteOne({ _id: sale.dueId }),
      sale.paymentId && Payment.deleteOne({ _id: sale.paymentId }),
      ...sale.items.map((l) => CatalogueItem.updateOne({ _id: l.itemId, trackStock: true }, { $inc: { stock: l.qty } })),
    ]);
    await sale.deleteOne();
    await recomputeDues(req.member._id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
