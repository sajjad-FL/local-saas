import { Router } from 'express';
import { register, login } from '../controllers/authController.js';
import { rateLimit } from '../middlewares/rateLimit.js';

export const authRoutes = Router();

// Login: 10 wrong passwords per IP per 15 min stops guessing; successful logins don't count,
// so staff sharing one office Wi-Fi never lock each other out.
const limitLogins = rateLimit({ max: 10, windowMs: 15 * 60000, failuresOnly: true, message: 'too many wrong passwords — try again in 15 minutes' });
// Registration: 10 accounts per IP per 15 min
const limitSignups = rateLimit({ max: 10, windowMs: 15 * 60000, message: 'too many attempts — try again in 15 minutes' });

authRoutes.post('/register', limitSignups, register);
authRoutes.post('/login', limitLogins, login);

export default authRoutes;

