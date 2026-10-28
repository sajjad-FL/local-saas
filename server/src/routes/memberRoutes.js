import { Router } from 'express';
import { resolveMemberParam } from '../middlewares/authMiddleware.js';
import {
  getMemberById,
  updateMember,
  subscribeMember,
  moveMember,
  pauseMember,
  resumeMember,
  recordPayment,
  deletePayment,
  shareStatement,
  deleteMember,
} from '../controllers/memberController.js';
import { getMemberAttendance } from '../controllers/attendanceController.js';

export const memberRoutes = Router();

memberRoutes.param('memberId', resolveMemberParam);

memberRoutes.get('/:memberId', getMemberById);
memberRoutes.patch('/:memberId', updateMember);
memberRoutes.delete('/:memberId', deleteMember);
memberRoutes.post('/:memberId/subscribe', subscribeMember);
memberRoutes.post('/:memberId/move', moveMember);
memberRoutes.post('/:memberId/pause', pauseMember);
memberRoutes.post('/:memberId/resume', resumeMember);
memberRoutes.post('/:memberId/payments', recordPayment);
memberRoutes.delete('/:memberId/payments/:paymentId', deletePayment);
memberRoutes.post('/:memberId/share', shareStatement);
memberRoutes.get('/:memberId/attendance', getMemberAttendance);

export default memberRoutes;

