import { db } from '../db/sqlite.js';
import { verifyToken } from '../services/tokenService.js';
import { HttpError } from './errorHandler.js';

const findUser = db.prepare('SELECT id, phone, name, created_at FROM users WHERE id = ?');

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'unauthorized', 'Missing bearer token'));
  }
  try {
    const payload = verifyToken(token);
    const user = findUser.get(payload.sub);
    if (!user) return next(new HttpError(401, 'unauthorized', 'User not found'));
    req.user = user;
    return next();
  } catch {
    return next(new HttpError(401, 'unauthorized', 'Invalid or expired token'));
  }
}
