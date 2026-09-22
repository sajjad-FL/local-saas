import jwt from 'jsonwebtoken';
import { Business, Member } from '../models/index.js';

export const signToken = (user) =>
  jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

export function requireAuth(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    req.userId = jwt.verify(token, process.env.JWT_SECRET).userId;
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

// Ownership filter: business is owned by user or user is in staffIds
export const mine = (userId) => ({ $or: [{ ownerId: userId }, { staffIds: userId }] });

// Route param resolver for :bizId
export async function resolveBizParam(req, res, next, id) {
  try {
    const biz = await Business.findOne({ _id: id, ...mine(req.userId) });
    if (!biz) return res.status(404).json({ error: 'business not found' });
    req.business = biz;
    next();
  } catch (err) {
    next(err);
  }
}

// Route param resolver for :memberId
export async function resolveMemberParam(req, res, next, id) {
  try {
    const member = await Member.findById(id);
    const biz = member && await Business.findOne({ _id: member.businessId, ...mine(req.userId) });
    if (!biz) return res.status(404).json({ error: 'member not found' });
    req.member = member;
    next();
  } catch (err) {
    next(err);
  }
}

