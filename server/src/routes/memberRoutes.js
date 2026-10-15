import { Router } from 'express';
import { resolveMemberParam } from '../middlewares/authMiddleware.js';
import {
  getMemberById,
  updateMember,
  subscribeMember,
  pauseMember,
  resumeMember,
  recordPayment,
  deletePayment,
  shareStatement,
  deleteMember,
} from '../controllers/memberController.js';

export const memberRoutes = Router();

memberRoutes.param('memberId', resolveMemberParam);

memberRoutes.get('/:memberId', getMemberById);
memberRoutes.patch('/:memberId', updateMember);
memberRoutes.delete('/:memberId', deleteMember);
memberRoutes.post('/:memberId/subscribe', subscribeMember);
memberRoutes.post('/:memberId/pause', pauseMember);
memberRoutes.post('/:memberId/resume', resumeMember);
memberRoutes.post('/:memberId/payments', recordPayment);
memberRoutes.delete('/:memberId/payments/:paymentId', deletePayment);
memberRoutes.post('/:memberId/share', shareStatement);

export default memberRoutes;

