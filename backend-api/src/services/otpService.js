import bcrypt from 'bcryptjs';
import { db } from '../db/sqlite.js';
import { env } from '../config/env.js';
import { newId, newOtp, nowSeconds } from '../utils/ids.js';
import { sendSms } from './smsService.js';

const insertOtp = db.prepare(`
  INSERT INTO otp_codes (id, phone, code_hash, expires_at, attempts, created_at)
  VALUES (?, ?, ?, ?, 0, ?)
`);

const findActiveOtp = db.prepare(`
  SELECT * FROM otp_codes
  WHERE phone = ? AND consumed_at IS NULL AND expires_at > ?
  ORDER BY created_at DESC
  LIMIT 1
`);

const incrementAttempts = db.prepare(`
  UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?
`);

const consumeOtp = db.prepare(`
  UPDATE otp_codes SET consumed_at = ? WHERE id = ?
`);

const invalidateActive = db.prepare(`
  UPDATE otp_codes SET consumed_at = ?
  WHERE phone = ? AND consumed_at IS NULL
`);

async function logOtpToSheets(phone, code, expiresAt) {
  const url = process.env.SHEETS_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        code,
        time: new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
        expires: new Date(expiresAt * 1000).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
      }),
    });
  } catch {
    // non-critical — don't block auth flow
  }
}

export async function requestOtp(phone) {
  const now = nowSeconds();
  invalidateActive.run(now, phone);

  const code = newOtp(env.otpLength);
  const codeHash = await bcrypt.hash(code, 10);
  const id = newId();
  const expiresAt = now + env.otpTtlSeconds;
  insertOtp.run(id, phone, codeHash, expiresAt, now);

  const body = `Your SafeHer code is ${code}. It expires in ${Math.round(env.otpTtlSeconds / 60)} minutes.`;
  await sendSms(phone, body);
  logOtpToSheets(phone, code, expiresAt); // fire-and-forget

  return { id, expiresAt };
}

export async function verifyOtp(phone, code) {
  const now = nowSeconds();
  const row = findActiveOtp.get(phone, now);
  if (!row) return { ok: false, reason: 'no_active_code' };

  if (row.attempts >= env.otpMaxAttempts) {
    return { ok: false, reason: 'too_many_attempts' };
  }

  const match = await bcrypt.compare(code, row.code_hash);
  if (!match) {
    incrementAttempts.run(row.id);
    return { ok: false, reason: 'invalid_code' };
  }

  consumeOtp.run(now, row.id);
  return { ok: true };
}
