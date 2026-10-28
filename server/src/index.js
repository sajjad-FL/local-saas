import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { authRoutes } from './routes/authRoutes.js';
import { apiRoutes } from './routes/index.js';
import { publicRoutes } from './routes/publicRoutes.js';
import { adminRoutes } from './routes/adminRoutes.js';
import { requireAuth, requireAdmin } from './middlewares/authMiddleware.js';
import { errorHandler } from './middlewares/errorMiddleware.js';
import { rollCycles, startCron } from './services/cronService.js';
import { applyHostelAttendanceDefault } from './services/migrations.js';

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set — copy server/.env.example to server/.env');
if (process.env.JWT_SECRET === 'change-me-in-prod') {
  if (process.env.NODE_ENV === 'production') throw new Error('set a real JWT_SECRET in server/.env');
  console.warn('JWT_SECRET is the example value — fine for dev, not for production');
}

// Connect to MongoDB
await connectDB();

const app = express();
// Set TRUST_PROXY=1 when deployed behind one proxy (Render, Railway, nginx) so req.ip is the
// visitor's address; the check-in and login rate limits depend on it.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

// Standard Middlewares
app.use(cors());
app.use(express.json({ limit: '5mb' })); // biometric attendance imports can be ~1 MB a month

// Routes
// Is the server up and talking to the database? No login, no data; safe for uptime checks.
app.get('/api/test', (req, res) => {
  const db = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown';
  res.status(db === 'connected' ? 200 : 503).json({
    ok: db === 'connected',
    message: 'API is running',
    database: db,
    uptimeSeconds: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
});
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes); // member statement links, no login
app.use('/api/admin', requireAuth, requireAdmin, adminRoutes); // platform admin
app.use('/api', requireAuth, apiRoutes);

// Centralized Error Handler
app.use(errorHandler);

// Background Jobs
await rollCycles(); // Catch up on missed days at boot
await applyHostelAttendanceDefault();
startCron();

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
