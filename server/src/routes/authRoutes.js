import { Router } from 'express';
import { register, login } from '../controllers/authController.js';

export const authRoutes = Router();

// in-memory limiter: 10 attempts per IP per 15 min, enough to stop password guessing
const attempts = new Map();
function limitAttempts(req, res, next) {
  const now = Date.now();
  const hits = (attempts.get(req.ip) || []).filter((t) => now - t < 15 * 60000);
  if (hits.length >= 10) return res.status(429).json({ error: 'too many attempts — try again in 15 minutes' });
  attempts.set(req.ip, [...hits, now]);
  next();
}

authRoutes.post('/register', limitAttempts, register);
authRoutes.post('/login', limitAttempts, login);

export default authRoutes;

