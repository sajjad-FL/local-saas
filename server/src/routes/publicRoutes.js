import { Router } from 'express';
import { getStatement } from '../controllers/publicController.js';

export const publicRoutes = Router();

publicRoutes.get('/statement/:token', getStatement);

export default publicRoutes;
