import { Router } from 'express';
import { resolveBizParam } from '../middlewares/authMiddleware.js';
import {
  getBusinesses,
  createBusiness,
  updateBusiness,
  deleteBusiness,
  clearBusinessData,
  getStaff,
  addStaff,
  removeStaff,
} from '../controllers/businessController.js';
import { getGroups, createGroup } from '../controllers/groupController.js';
import { getPlans, createPlan } from '../controllers/planController.js';
import { getRooms, createRoom } from '../controllers/roomController.js';
import { getMembers, createMember } from '../controllers/memberController.js';
import { getDashboardData } from '../controllers/dashboardController.js';
import { exportPaymentsCsv, exportBalancesCsv, exportDuesCsv, exportBackupJson } from '../controllers/exportController.js';

export const businessRoutes = Router();

businessRoutes.param('bizId', resolveBizParam);

// Businesses
businessRoutes.get('/', getBusinesses);
businessRoutes.post('/', createBusiness);
businessRoutes.patch('/:bizId', updateBusiness);
businessRoutes.delete('/:bizId', deleteBusiness);
businessRoutes.post('/:bizId/clear-data', clearBusinessData);

// Staff
businessRoutes.get('/:bizId/staff', getStaff);
businessRoutes.post('/:bizId/staff', addStaff);
businessRoutes.delete('/:bizId/staff/:userId', removeStaff);

// Groups
businessRoutes.get('/:bizId/groups', getGroups);
businessRoutes.post('/:bizId/groups', createGroup);

// Plans
businessRoutes.get('/:bizId/plans', getPlans);
businessRoutes.post('/:bizId/plans', createPlan);

// Rooms
businessRoutes.get('/:bizId/rooms', getRooms);
businessRoutes.post('/:bizId/rooms', createRoom);

// Members (collection level)
businessRoutes.get('/:bizId/members', getMembers);
businessRoutes.post('/:bizId/members', createMember);

// Dashboard
businessRoutes.get('/:bizId/dashboard', getDashboardData);

// CSV Exports
businessRoutes.get('/:bizId/export/payments.csv', exportPaymentsCsv);
businessRoutes.get('/:bizId/export/balances.csv', exportBalancesCsv);
businessRoutes.get('/:bizId/export/dues.csv', exportDuesCsv);
businessRoutes.get('/:bizId/export/backup.json', exportBackupJson);

export default businessRoutes;

