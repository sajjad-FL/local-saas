import { Router } from 'express';
import { businessRoutes } from './businessRoutes.js';
import { memberRoutes } from './memberRoutes.js';
import { User } from '../models/index.js';

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

apiRoutes.use('/businesses', businessRoutes);
apiRoutes.use('/members', memberRoutes);

export default apiRoutes;

