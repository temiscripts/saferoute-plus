import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import {
  postSession,
  postCheckin,
  postSos,
  postEnd,
  getSession,
  startSessionSchema,
  checkinSchema,
  sosSchema,
} from '../controllers/sessionsController.js';

export const sessionsRouter = Router();
sessionsRouter.use(requireAuth);
sessionsRouter.post('/', validateBody(startSessionSchema), postSession);
sessionsRouter.get('/:id', getSession);
sessionsRouter.post('/:id/checkin', validateBody(checkinSchema), postCheckin);
sessionsRouter.post('/:id/sos', validateBody(sosSchema), postSos);
sessionsRouter.post('/:id/end', postEnd);
