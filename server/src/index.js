import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { authRoutes } from './routes/authRoutes.js';
import { apiRoutes } from './routes/index.js';
import { publicRoutes } from './routes/publicRoutes.js';
import { requireAuth } from './middlewares/authMiddleware.js';
import { errorHandler } from './middlewares/errorMiddleware.js';
import { rollCycles, startCron } from './services/cronService.js';

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set — copy server/.env.example to server/.env');
if (process.env.JWT_SECRET === 'change-me-in-prod') {
  if (process.env.NODE_ENV === 'production') throw new Error('set a real JWT_SECRET in server/.env');
  console.warn('JWT_SECRET is the example value — fine for dev, not for production');
}

// Connect to MongoDB
await connectDB();

const app = express();

// Standard Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes); // member statement links, no login
app.use('/api', requireAuth, apiRoutes);

// Centralized Error Handler
app.use(errorHandler);

// Background Jobs
await rollCycles(); // Catch up on missed days at boot
startCron();

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
