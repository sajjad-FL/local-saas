import { Group, Room, Member } from '../models/index.js';

export async function getGroups(req, res, next) {
  try {
    const groups = await Group.find({ businessId: req.business._id }).sort('name');
    res.json(groups);
  } catch (err) {
    next(err);
  }
}

export async function createGroup(req, res, next) {
  try {
    const name = String(req.body?.name ?? '').trim();
    if (!name) return res.status(400).json({ error: 'give it a name' });
    const group = await Group.create({ businessId: req.business._id, name });
    res.json(group);
  } catch (err) {
    next(err);
  }
}

export async function renameGroup(req, res, next) {
  try {
    const name = String(req.body?.name ?? '').trim().slice(0, 60);
    if (!name) return res.status(400).json({ error: 'give it a name' });
    const group = await Group.findOneAndUpdate({ _id: req.params.groupId, businessId: req.business._id }, { name }, { new: true });
    if (!group) return res.status(404).json({ error: 'not found' });
    res.json(group);
  } catch (err) {
    next(err);
  }
}

// only when nothing is in it: no rooms, no active members
export async function deleteGroup(req, res, next) {
  try {
    const group = await Group.findOne({ _id: req.params.groupId, businessId: req.business._id });
    if (!group) return res.status(404).json({ error: 'not found' });
    if (await Room.exists({ groupId: group._id })) return res.status(400).json({ error: `${group.name} still has rooms. Delete them first.` });
    if (await Member.exists({ groupId: group._id, status: 'active' })) return res.status(400).json({ error: `${group.name} still has members in it.` });
    await group.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// Hostel floors live inside their building
export async function addFloor(req, res, next) {
  try {
    const group = await Group.findOne({ _id: req.params.groupId, businessId: req.business._id });
    if (!group) return res.status(404).json({ error: 'building not found' });
    const name = String(req.body?.name ?? '').trim().slice(0, 40);
    if (!name) return res.status(400).json({ error: 'give the floor a name' });
    const same = group.floors.find((f) => f.name.toLowerCase() === name.toLowerCase());
    if (same) return res.status(400).json({ error: `${group.name} already has a floor called ${same.name}` });
    group.floors.push({ name });
    await group.save();
    res.json(group);
  } catch (err) {
    next(err);
  }
}

export async function renameFloor(req, res, next) {
  try {
    const group = await Group.findOne({ _id: req.params.groupId, businessId: req.business._id });
    const floor = group?.floors.id(req.params.floorId);
    if (!floor) return res.status(404).json({ error: 'floor not found' });
    const name = String(req.body?.name ?? '').trim().slice(0, 40);
    if (!name) return res.status(400).json({ error: 'give the floor a name' });
    const same = group.floors.find((f) => !f._id.equals(floor._id) && f.name.toLowerCase() === name.toLowerCase());
    if (same) return res.status(400).json({ error: `${group.name} already has a floor called ${same.name}` });
    floor.name = name;
    await group.save();
    res.json(group);
  } catch (err) {
    next(err);
  }
}

export async function deleteFloor(req, res, next) {
  try {
    const group = await Group.findOne({ _id: req.params.groupId, businessId: req.business._id });
    const floor = group?.floors.id(req.params.floorId);
    if (!floor) return res.status(404).json({ error: 'floor not found' });
    if (await Room.exists({ floorId: floor._id })) return res.status(400).json({ error: `${floor.name} still has rooms. Delete them first.` });
    floor.deleteOne();
    await group.save();
    res.json(group);
  } catch (err) {
    next(err);
  }
}
