import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signUserToken(user) {
  return jwt.sign(
    { sub: user.id, phone: user.phone },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}
