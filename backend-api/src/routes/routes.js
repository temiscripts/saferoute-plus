import { Router } from 'express';
import { validateQuery } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import {
  getScoredRoutes,
  getGeocode,
  scoreQuerySchema,
  geocodeQuerySchema,
} from '../controllers/routesController.js';

export const routesRouter = Router();
routesRouter.use(requireAuth);
routesRouter.get('/score', validateQuery(scoreQuerySchema), getScoredRoutes);
routesRouter.get('/geocode', validateQuery(geocodeQuerySchema), getGeocode);
