import { z } from 'zod';
import { db } from '../db/sqlite.js';
import { normalizePhone } from '../utils/phone.js';
import { newId, nowSeconds } from '../utils/ids.js';
import { requestOtp, verifyOtp } from '../services/otpService.js';
import { signUserToken } from '../services/tokenService.js';
import { HttpError } from '../middleware/errorHandler.js';

export const requestOtpSchema = z.object({
  phone: z.string().min(7),
});

export const verifyOtpSchema = z.object({
  phone: z.string().min(7),
  code: z.string().min(4).max(10),
  name: z.string().min(1).max(80).optional(),
});

const findUserByPhone = db.prepare('SELECT * FROM users WHERE phone = ?');
const insertUser = db.prepare(
  'INSERT INTO users (id, phone, name, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)',
);
const updateLogin = db.prepare('UPDATE users SET last_login_at = ?, name = COALESCE(?, name) WHERE id = ?');

export async function postRequestOtp(req, res, next) {
  try {
    const phone = normalizePhone(req.body.phone);
    if (!phone) throw new HttpError(400, 'invalid_phone', 'Could not parse phone number');
    const { expiresAt } = await requestOtp(phone);
    res.json({ ok: true, phone, expiresAt });
  } catch (err) {
    next(err);
  }
}

export async function postVerifyOtp(req, res, next) {
  try {
    const phone = normalizePhone(req.body.phone);
    if (!phone) throw new HttpError(400, 'invalid_phone', 'Could not parse phone number');

    const result = await verifyOtp(phone, req.body.code);
    if (!result.ok) throw new HttpError(401, result.reason, 'OTP verification failed');

    const now = nowSeconds();
    let user = findUserByPhone.get(phone);
    if (!user) {
      const id = newId();
      insertUser.run(id, phone, req.body.name ?? null, now, now);
      user = findUserByPhone.get(phone);
    } else {
      updateLogin.run(now, req.body.name ?? null, user.id);
      user = findUserByPhone.get(phone);
    }

    const token = signUserToken(user);
    res.json({
      ok: true,
      token,
      user: { id: user.id, phone: user.phone, name: user.name },
    });
  } catch (err) {
    next(err);
  }
}

export function getMe(req, res) {
  res.json({ user: req.user });
}
