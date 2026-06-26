import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import {
  postRequestOtp,
  postVerifyOtp,
  getMe,
  requestOtpSchema,
  verifyOtpSchema,
} from '../controllers/authController.js';

export const authRouter = Router();
authRouter.post('/request-otp', validateBody(requestOtpSchema), postRequestOtp);
authRouter.post('/verify-otp', validateBody(verifyOtpSchema), postVerifyOtp);
authRouter.get('/me', requireAuth, getMe);
