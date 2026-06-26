import { Router } from 'express';
import { getPatterns } from '../controllers/patternsController.js';

export const patternsRouter = Router();
patternsRouter.get('/', getPatterns);
