import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import {
  postPostIncidentCheckin,
  getMyCheckins,
  checkinSchema,
} from '../controllers/checkinsController.js';

export const checkinsRouter = Router();
checkinsRouter.use(requireAuth);
checkinsRouter.post('/post-incident', validateBody(checkinSchema), postPostIncidentCheckin);
checkinsRouter.get('/post-incident', getMyCheckins);
