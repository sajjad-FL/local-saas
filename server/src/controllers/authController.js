import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { signToken } from '../middlewares/authMiddleware.js';

export async function register(req, res, next) {
  try {
    const { name, phone, password } = req.body ?? {};
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

// The signed-in person's own details. Changing the phone (it's how you sign in) needs the
// current password, and so does setting a new password.
export async function updateProfile(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    const { name, phone, currentPassword } = req.body ?? {};
    if (name !== undefined) {
      const clean = String(name).trim().slice(0, 60);
      if (!clean) return res.status(400).json({ error: 'your name can\'t be empty' });
      user.name = clean;
    }
    if (phone !== undefined && String(phone).trim() !== user.phone) {
      const clean = String(phone).replace(/\D/g, '');
      if (clean.length !== 10) return res.status(400).json({ error: 'phone must be 10 digits' });
      if (!(await bcrypt.compare(currentPassword || '', user.passwordHash))) {
        return res.status(400).json({ error: 'current password is wrong' });
      }
      if (await User.exists({ phone: clean, _id: { $ne: user._id } })) {
        return res.status(409).json({ error: 'another account already uses that phone' });
      }
      user.phone = clean;
    }
    await user.save();
    res.json({ _id: user._id, name: user.name, phone: user.phone, role: user.role || 'user' });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    const { currentPassword, newPassword } = req.body ?? {};
    if (!(await bcrypt.compare(currentPassword || '', user.passwordHash))) {
      return res.status(400).json({ error: 'current password is wrong' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'new password needs at least 6 characters' });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { phone, password } = req.body ?? {};
    const user = await User.findOne({ phone });
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
      return res.status(401).json({ error: 'invalid phone or password' });
    }
    res.json({ token: signToken(user) });
  } catch (err) {
    next(err);
  }
}

