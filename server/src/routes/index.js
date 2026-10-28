import { Router } from 'express';
import { businessRoutes } from './businessRoutes.js';
import { memberRoutes } from './memberRoutes.js';
import { User } from '../models/index.js';
import { updateProfile, changePassword } from '../controllers/authController.js';
import { rateLimit } from '../middlewares/rateLimit.js';

export const apiRoutes = Router();

// who's signed in: lets the app show the admin area, and where to send people when a business is paused
apiRoutes.get('/me', async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('name phone role');
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    res.json({ _id: user._id, name: user.name, phone: user.phone, role: user.role || 'user', supportPhone: process.env.SUPPORT_PHONE || null });
  } catch (err) {
    next(err);
  }
});

// wrong current passwords count towards a limit, so the password can't be guessed from a signed-in tab
const limitPasswordChecks = rateLimit({ max: 10, windowMs: 15 * 60000, failuresOnly: true, message: 'too many wrong passwords — try again in 15 minutes' });
apiRoutes.patch('/me', limitPasswordChecks, updateProfile);
apiRoutes.post('/me/password', limitPasswordChecks, changePassword);

apiRoutes.use('/businesses', businessRoutes);
apiRoutes.use('/members', memberRoutes);

export default apiRoutes;

