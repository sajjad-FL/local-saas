import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { authRoutes } from './routes/authRoutes.js';
import { apiRoutes } from './routes/index.js';
import { requireAuth } from './middlewares/authMiddleware.js';
import { errorHandler } from './middlewares/errorMiddleware.js';
import { rollCycles, startCron } from './services/cronService.js';

// Connect to MongoDB
await connectDB();

const app = express();

// Standard Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', requireAuth, apiRoutes);

// Centralized Error Handler
app.use(errorHandler);

// Background Jobs
await rollCycles(); // Catch up on missed days at boot
startCron();

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
