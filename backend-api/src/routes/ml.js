import { Router } from 'express';
import multer from 'multer';
import { predictVoice, predictMotion, getClusters } from '../controllers/mlController.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const mlRouter = Router();

mlRouter.post('/voice',   upload.single('audio'), predictVoice);
mlRouter.post('/motion',  predictMotion);
mlRouter.get('/clusters', getClusters);
