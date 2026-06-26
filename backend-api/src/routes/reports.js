import { Router } from 'express';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  postReport,
  getReports,
  createReportSchema,
  listReportsSchema,
} from '../controllers/reportsController.js';

export const reportsRouter = Router();
reportsRouter.post('/', validateBody(createReportSchema), postReport);
reportsRouter.get('/', validateQuery(listReportsSchema), getReports);
