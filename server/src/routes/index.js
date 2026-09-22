import { Router } from 'express';
import { businessRoutes } from './businessRoutes.js';
import { memberRoutes } from './memberRoutes.js';

export const apiRoutes = Router();

apiRoutes.use('/businesses', businessRoutes);
apiRoutes.use('/members', memberRoutes);

export default apiRoutes;

