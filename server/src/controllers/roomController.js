import { Room, Member, Group } from '../models/index.js';

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

// '' / null → no rent set; a whole number ≥ 0 → that rent; anything else → false (refuse)
const rentOf = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 1e7 ? n : false;
};

// A room on a building's floor. The building must be this business's, the floor must be in
// that building, and a building can't have two rooms with the same number.
export async function createRoom(req, res, next) {
  try {
    const { groupId, floorId } = req.body ?? {};
    const roomNo = String(req.body?.roomNo ?? '').trim();
    const capacity = Number(req.body?.capacity);
    const bedRent = rentOf(req.body?.bedRent);
    if (bedRent === false) return res.status(400).json({ error: 'rent per bed must be a positive amount' });
    if (!roomNo) return res.status(400).json({ error: 'room number is required' });
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 30) {
      return res.status(400).json({ error: 'beds must be between 1 and 30' });
    }
    let group = null;
    if (groupId) {
      group = await Group.findOne({ _id: groupId, businessId: req.business._id });
      if (!group) return res.status(400).json({ error: 'building not found' });
    }
    if (floorId && !group?.floors.id(floorId)) return res.status(400).json({ error: 'floor not found in that building' });
    const sameNumber = await Room.exists({ businessId: req.business._id, groupId: group?._id ?? null, roomNo });
    if (sameNumber) return res.status(400).json({ error: `Room ${roomNo} already exists${group ? ` in ${group.name}` : ''}` });
    const room = await Room.create({
      businessId: req.business._id,
      groupId: group?._id,
      floorId: floorId || undefined,
      roomNo,
      capacity,
      bedRent: bedRent ?? undefined,
    });
    res.json(room);
  } catch (err) {
    next(err);
  }
}

// Change a room's number, beds, building or floor. Beds can't drop below the tenants living
// there, the number stays unique in its building, and the floor must be in that building.
export async function updateRoom(req, res, next) {
  try {
    const room = await Room.findOne({ _id: req.params.roomId, businessId: req.business._id });
    if (!room) return res.status(404).json({ error: 'room not found' });
    const body = req.body ?? {};

    const roomNo = body.roomNo !== undefined ? String(body.roomNo).trim() : room.roomNo;
    if (!roomNo) return res.status(400).json({ error: 'room number is required' });

    const capacity = body.capacity !== undefined ? Number(body.capacity) : room.capacity;
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 30) {
      return res.status(400).json({ error: 'beds must be between 1 and 30' });
    }
    const living = await Member.countDocuments({ roomId: room._id, status: 'active' });
    if (capacity < living) {
      return res.status(400).json({ error: `${living} tenant${living === 1 ? ' lives' : 's live'} in ${room.roomNo}, so it needs at least ${living} bed${living === 1 ? '' : 's'}` });
    }

    let groupId = room.groupId;
    if (body.groupId !== undefined) groupId = body.groupId || null;
    let group = null;
    if (groupId) {
      group = await Group.findOne({ _id: groupId, businessId: req.business._id });
      if (!group) return res.status(400).json({ error: 'building not found' });
    }
    // moving to another building drops the old floor unless a new one is given
    let floorId = body.floorId !== undefined ? body.floorId || null : String(groupId) === String(room.groupId) ? room.floorId : null;
    if (floorId && !group?.floors.id(floorId)) return res.status(400).json({ error: 'floor not found in that building' });

    const clash = await Room.exists({ _id: { $ne: room._id }, businessId: req.business._id, groupId: group?._id ?? null, roomNo });
    if (clash) return res.status(400).json({ error: `Room ${roomNo} already exists${group ? ` in ${group.name}` : ''}` });

    if (body.bedRent !== undefined) {
      const bedRent = rentOf(body.bedRent);
      if (bedRent === false) return res.status(400).json({ error: 'rent per bed must be a positive amount' });
      room.bedRent = bedRent ?? undefined;
    }
    Object.assign(room, { roomNo, capacity, groupId: group?._id, floorId: floorId || undefined });
    await room.save();
    res.json(room);
  } catch (err) {
    next(err);
  }
}

// Only an empty room can go; members who left keep their history without it
export async function deleteRoom(req, res, next) {
  try {
    const room = await Room.findOne({ _id: req.params.roomId, businessId: req.business._id });
    if (!room) return res.status(404).json({ error: 'room not found' });
    const living = await Member.countDocuments({ roomId: room._id, status: 'active' });
    if (living) return res.status(400).json({ error: `Room ${room.roomNo} has ${living} tenant${living === 1 ? '' : 's'}. Move them to another room first.` });
    await Member.updateMany({ roomId: room._id }, { $unset: { roomId: 1 } });
    await room.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
