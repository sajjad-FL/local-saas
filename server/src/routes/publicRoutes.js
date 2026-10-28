import { Router } from 'express';
import { getStatement, getCheckin, postCheckin } from '../controllers/publicController.js';
import { rateLimit } from '../middlewares/rateLimit.js';

export const publicRoutes = Router();

// Only failed check-ins count, so members checking in never use it up. Members often share the
// gym's Wi-Fi (one IP), so the limit is generous for typos but still makes guessing numbers slow.
const limitCheckins = rateLimit({ max: 20, windowMs: 10 * 60000, failuresOnly: true, message: 'too many tries — please ask the front desk' });

publicRoutes.get('/statement/:token', getStatement);
publicRoutes.get('/checkin/:token', getCheckin);
publicRoutes.post('/checkin/:token', limitCheckins, postCheckin);

export default publicRoutes;
