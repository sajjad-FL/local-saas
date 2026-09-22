import { Room, Member } from '../models/index.js';

export async function getRooms(req, res, next) {
  try {
    const [rooms, counts] = await Promise.all([
      Room.find({ businessId: req.business._id }).populate('groupId', 'name').sort('roomNo'),
      Member.aggregate([
        { $match: { businessId: req.business._id, status: 'active', roomId: { $ne: null } } },
        { $group: { _id: '$roomId', n: { $sum: 1 } } },
      ]),
    ]);
    const occ = new Map(counts.map((c) => [String(c._id), c.n]));
    res.json(rooms.map((r) => ({ ...r.toObject(), occupied: occ.get(String(r._id)) || 0 })));
  } catch (err) {
    next(err);
  }
}

export async function createRoom(req, res, next) {
  try {
    const { groupId, roomNo, capacity } = req.body;
    if (!(capacity > 0)) {
      return res.status(400).json({ error: 'capacity must be positive' });
    }
    const room = await Room.create({
      businessId: req.business._id,
      groupId: groupId || undefined,
      roomNo,
      capacity,
    });
    res.json(room);
  } catch (err) {
    next(err);
  }
}

