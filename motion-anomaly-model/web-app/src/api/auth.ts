import { api } from './client';

export type User = { id: string; phone: string; name: string | null };

export function requestOtp(phone: string) {
  return api<{ ok: true; phone: string; expiresAt: number }>(
    'POST',
    '/auth/request-otp',
    { body: { phone }, auth: false },
  );
}

export function verifyOtp(phone: string, code: string, name?: string) {
  return api<{ ok: true; token: string; user: User }>(
    'POST',
    '/auth/verify-otp',
    { body: { phone, code, name }, auth: false },
  );
}

export function getMe() {
  return api<{ user: User }>('GET', '/auth/me');
}
