import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { signToken } from '../middlewares/authMiddleware.js';

export async function register(req, res, next) {
  try {
    const { name, phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'phone and password required' });
    }
    if (await User.findOne({ phone })) {
      return res.status(409).json({ error: 'phone already registered' });
    }
    const user = await User.create({
      name,
      phone,
      passwordHash: await bcrypt.hash(password, 10),
    });
    res.json({ token: signToken(user) });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone });
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
      return res.status(401).json({ error: 'invalid phone or password' });
    }
    res.json({ token: signToken(user) });
  } catch (err) {
    next(err);
  }
}

