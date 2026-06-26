import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const backendRoot = path.resolve(here, '..', '..');

dotenv.config({ path: path.join(backendRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env') });

function required(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function int(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`Env var ${name} must be an integer`);
  return n;
}

export const env = {
  port: int('PORT', 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  databasePath: path.isAbsolute(process.env.DATABASE_PATH ?? '')
    ? process.env.DATABASE_PATH
    : path.join(backendRoot, process.env.DATABASE_PATH ?? './data/saferoute.sqlite'),

  jwtSecret: required('JWT_SECRET', 'dev-only-insecure-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',

  otpLength: int('OTP_LENGTH', 6),
  otpTtlSeconds: int('OTP_TTL_SECONDS', 300),
  otpMaxAttempts: int('OTP_MAX_ATTEMPTS', 5),

  smsProvider: (process.env.SMS_PROVIDER ?? 'console').toLowerCase(),
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    from: process.env.TWILIO_FROM_NUMBER ?? '',
  },
  africasTalking: {
    username: process.env.AFRICASTALKING_USERNAME ?? '',
    apiKey: process.env.AFRICASTALKING_API_KEY ?? '',
    from: process.env.AFRICASTALKING_FROM ?? '',
  },
  termii: {
    apiKey: process.env.TERMII_API_KEY ?? '',
    from: process.env.TERMII_FROM ?? '',
  },

  mapsProvider: (process.env.MAPS_PROVIDER ?? 'osrm').toLowerCase(),
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
  osrmBaseUrl: process.env.OSRM_BASE_URL ?? 'https://router.project-osrm.org',

  escalationAckWindowSeconds: int('ESCALATION_ACK_WINDOW_SECONDS', 60),
  deadmanCheckinIntervalSeconds: int('DEADMAN_CHECKIN_INTERVAL_SECONDS', 120),

  corsOrigin: process.env.CORS_ORIGIN ?? '*',
};
