# backend-api

Core HTTP API for SafeRoute+. Owns auth (phone OTP), data persistence, anonymous reports, active sessions, and route scoring.

**Owner:** Project lead.
**Stack:** Node.js (Express) + better-sqlite3 + JWT.

## Run

```bash
cd backend-api
cp ../.env.example ./.env
npm install
npm run migrate
npm run dev
```

Server listens on `PORT` (default 4000).

## Endpoints (baseline)

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| POST | `/auth/request-otp` | Send OTP to phone | public |
| POST | `/auth/verify-otp` | Verify OTP, get JWT | public |
| GET  | `/auth/me` | Current user | JWT |
| GET/POST/DELETE | `/contacts` | Trusted contacts (tier 1/2/3) | JWT |
| POST | `/reports` | Submit anonymous incident report | public |
| GET  | `/reports` | List recent reports (for map) | public |
| POST | `/sessions` | Start active session | JWT |
| POST | `/sessions/:id/checkin` | Deadman switch check-in | JWT |
| POST | `/sessions/:id/end` | End session | JWT |
| GET  | `/sessions/:id` | Session state | JWT |
| GET  | `/routes/score` | Score candidate routes by safety | JWT |
| POST | `/checkins/post-incident` | After-phase emotional check-in | JWT |

## SMS provider

Driven by `SMS_PROVIDER` env var. `console` mode prints OTPs to stdout (dev). Supports `twilio`, `africastalking`, `termii`.

## Maps provider

Driven by `MAPS_PROVIDER`. Defaults to `osrm` (free public demo server, no key). Switch to `google` and supply `GOOGLE_MAPS_API_KEY` for production-quality routing.

## Known limitations

- SQLite file DB — fine for hackathon demo; swap to Postgres for production.
- OTPs are stored as bcrypt hashes; no rate-limit per IP yet (only per phone).
- Route scoring uses a weighted heuristic over seeded report density, not a learned model.
