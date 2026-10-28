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
import { getGroups, createGroup, renameGroup, deleteGroup, addFloor, renameFloor, deleteFloor } from '../controllers/groupController.js';
import { getPlans, createPlan } from '../controllers/planController.js';
import { getRooms, createRoom, updateRoom, deleteRoom } from '../controllers/roomController.js';
import { getMembers, createMember } from '../controllers/memberController.js';
import { getDashboardData } from '../controllers/dashboardController.js';
import { getReport } from '../controllers/reportController.js';
import { getAttendanceDay, markAttendance, markAllPresent, checkinLink, importAttendance, getNotComing } from '../controllers/attendanceController.js';
import { getExpenses, createExpense, deleteExpense } from '../controllers/expenseController.js';
import { exportPaymentsCsv, exportBalancesCsv, exportDuesCsv, exportExpensesCsv, exportBackupJson } from '../controllers/exportController.js';

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
businessRoutes.patch('/:bizId/groups/:groupId', renameGroup);
businessRoutes.delete('/:bizId/groups/:groupId', deleteGroup);
businessRoutes.post('/:bizId/groups/:groupId/floors', addFloor); // hostel floors
businessRoutes.patch('/:bizId/groups/:groupId/floors/:floorId', renameFloor);
businessRoutes.delete('/:bizId/groups/:groupId/floors/:floorId', deleteFloor);

// Plans
businessRoutes.get('/:bizId/plans', getPlans);
businessRoutes.post('/:bizId/plans', createPlan);

// Rooms
businessRoutes.get('/:bizId/rooms', getRooms);
businessRoutes.post('/:bizId/rooms', createRoom);
businessRoutes.patch('/:bizId/rooms/:roomId', updateRoom);
businessRoutes.delete('/:bizId/rooms/:roomId', deleteRoom);

// Members (collection level)
businessRoutes.get('/:bizId/members', getMembers);
businessRoutes.post('/:bizId/members', createMember);

// Dashboard
businessRoutes.get('/:bizId/dashboard', getDashboardData);

// Attendance (staff marking) and the gym check-in QR
businessRoutes.get('/:bizId/attendance', getAttendanceDay);
businessRoutes.put('/:bizId/attendance', markAttendance);
businessRoutes.post('/:bizId/attendance/all-present', markAllPresent);
businessRoutes.post('/:bizId/checkin-link', checkinLink);
businessRoutes.post('/:bizId/attendance/import', importAttendance); // biometric machine export
businessRoutes.get('/:bizId/attendance/not-coming', getNotComing);

// Money report (any period) and expenses
businessRoutes.get('/:bizId/report', getReport);
businessRoutes.get('/:bizId/expenses', getExpenses);
businessRoutes.post('/:bizId/expenses', createExpense);
businessRoutes.delete('/:bizId/expenses/:expenseId', deleteExpense);

// CSV Exports
businessRoutes.get('/:bizId/export/payments.csv', exportPaymentsCsv);
businessRoutes.get('/:bizId/export/balances.csv', exportBalancesCsv);
businessRoutes.get('/:bizId/export/dues.csv', exportDuesCsv);
businessRoutes.get('/:bizId/export/expenses.csv', exportExpensesCsv);
businessRoutes.get('/:bizId/export/backup.json', exportBackupJson);

export default businessRoutes;

