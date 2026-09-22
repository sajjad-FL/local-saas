import { Group } from '../models/index.js';

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
    const group = await Group.create({ businessId: req.business._id, name: req.body.name });
    res.json(group);
  } catch (err) {
    next(err);
  }
}

