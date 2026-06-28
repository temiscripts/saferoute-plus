# escalation-engine

SOS trigger logic + no-hardware deadman switch + tiered contact escalation + live location streaming for SafeRoute+.

**Owner:** Project lead.
**Status:** baseline complete, smoke-tested.

## How it plugs into `/backend-api`

This module is *not* a separate server. It's a Node package that `/backend-api/src/server.js` imports and boots in-process. Same SQLite DB, same SMS service — nothing is duplicated.

- DB: injected by backend-api (`better-sqlite3` handle)
- SMS: injected by backend-api (`sendSms` function from `smsService`)
- HTTP: the engine returns an Express `Router` that backend-api mounts at `/escalation/*`

Single process; one `npm run dev` boots everything.

## Tables it uses (defined in `backend-api/src/db/schema.sql`)

- `sessions`, `session_locations`, `contacts`, `users` — read-only from the engine's perspective (the backend owns the writes)
- `escalations` — created and updated by the engine
- `escalation_attempts` — one row per contact notified, with an opaque `ack_token` used as the contact's bearer credential for the ack + stream endpoints

## Behavior

### Deadman switch
- Every `DEADMAN_TICK_INTERVAL_SECONDS` (default 10s), the engine scans `sessions WHERE status='active' AND last_checkin_at < now - DEADMAN_CHECKIN_INTERVAL_SECONDS`.
- For each stale session, it triggers SOS with `reason='deadman'`.
- A session with an already-active escalation is skipped — no double-firing.

### Manual SOS
- `POST /sessions/:id/sos` on the backend now calls the engine. Same escalation pipeline as the deadman path. Reason: `'manual_sos'`.

### Tiered escalation
- On SOS, the engine notifies tier-1 contacts (all of them, in parallel) via SMS. Each contact gets a unique `ack_token` in the URL.
- If `ESCALATION_ACK_WINDOW_SECONDS` elapses (default 30s) with no ack → tier-2. Then tier-3.
- An empty tier is skipped immediately (no waiting on a tier with no contacts).
- All three tiers tried, no ack → escalation status becomes `exhausted`.

### Acknowledge
- `POST /escalation/ack/:token` — contact taps the link in their SMS, a tiny page in `/web-app` hits this endpoint. The first ack wins: escalation becomes `acked`, tier timer is cancelled, no further contacts notified.

### Live location stream
- `GET /escalation/stream/:token` — Server-Sent Events. Emits:
  - `snapshot` once on connect (session metadata + escalation id)
  - `location` for each new row in `session_locations` (initial backfill, then live)
  - `session_ended` when the session is ended (and closes the stream)
- Uses the same `ack_token` as bearer auth — no separate login flow for contacts.

### Session end
- `POST /sessions/:id/end` cancels any in-flight escalation (status → `cancelled`), in case the user is fine and stops the session manually.

## Config (env vars, all read from the root `.env`)

| Var | Default | Purpose |
| --- | --- | --- |
| `ESCALATION_ACK_WINDOW_SECONDS` | 30 | How long to wait per tier before escalating |
| `DEADMAN_CHECKIN_INTERVAL_SECONDS` | 120 | A session is "stale" if no check-in in this many seconds |
| `DEADMAN_TICK_INTERVAL_SECONDS` | 10 | How often the deadman ticker scans |
| `ACK_LINK_BASE_URL` | `http://localhost:5173/ack` | Prefix for the URL in the SMS; web-app handles the page |

## Run

The engine has no standalone entry point — it boots inside `backend-api`:

```bash
cd backend-api
npm install
npm run migrate
npm run dev
```

You'll see `[escalation] engine started: deadman every 10s, ack window 30s, deadman threshold 120s` in the console.

## Known limitations

- One process, in-memory tier timers. If the server restarts mid-escalation, in-flight timers are lost (the DB row stays `active` but no further tiers will fire). Acceptable for a hackathon demo; for production, persist next-tier-due-at and resume on boot.
- SMS provider failures are logged but don't currently retry. A real prod system would queue + retry.
- SSE keeps a DB-poll loop at 2s. Cheap on SQLite, fine for the demo; swap for a pub/sub or `sqlite UPDATE` hook for higher concurrency.

## Demo Day talking point

"The deadman switch is the trust layer — even if she can't reach her phone, the *absence* of a check-in is itself the signal, and the engine escalates contact by contact until someone answers. Every contact gets a tap-to-acknowledge link and a live location feed. No hardware. No app install for the contact. Just an SMS and a browser."
