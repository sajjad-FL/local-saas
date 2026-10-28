import { Router } from 'express';
import {
  getStats, listBusinesses, getBusinessDetail, suspendBusiness, resumeBusiness, noteBusiness,
  listOwners, suspendOwner, resumeOwner, resetPassword, getLog,
} from '../controllers/adminController.js';

// Mounted behind requireAuth + requireAdmin in index.js
export const adminRoutes = Router();

adminRoutes.get('/stats', getStats);
adminRoutes.get('/businesses', listBusinesses);
adminRoutes.get('/businesses/:id', getBusinessDetail);
adminRoutes.post('/businesses/:id/suspend', suspendBusiness);
adminRoutes.post('/businesses/:id/resume', resumeBusiness);
adminRoutes.put('/businesses/:id/note', noteBusiness);
adminRoutes.get('/owners', listOwners);
adminRoutes.post('/owners/:id/suspend', suspendOwner);
adminRoutes.post('/owners/:id/resume', resumeOwner);
adminRoutes.post('/owners/:id/reset-password', resetPassword);
adminRoutes.get('/log', getLog);

export default adminRoutes;
