import { randomBytes, randomInt } from 'node:crypto';

export function newId() {
  return randomBytes(16).toString('hex');
}

export function newOtp(length) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += randomInt(0, 10).toString();
  }
  return out;
}

export function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}
