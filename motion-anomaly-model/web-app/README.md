# web-app

Responsive browser-based web app shell for SafeRoute+.

**Owner:** Project lead.
**Stack:** Vite + React 18 + TypeScript + react-router-dom + react-leaflet (OSM tiles).

## Why a web app, not native mobile

- Runs on any judge's phone via a URL — no install, no app-store flow.
- Browser Web APIs cover everything we need:
  - Geolocation API — live position + watchPosition for the active session
  - DeviceMotionEvent — accelerometer signal for motion anomaly inference
  - MediaDevices.getUserMedia — microphone for voice distress inference
  - Notifications + Web Push — escalation pings (future)

## Run

```bash
cd web-app
cp .env.example .env
npm install
npm run dev
```

Vite dev server: `http://localhost:5173`.
The dev server proxies `/api/*` to `http://localhost:4000/*` so the same code works against the local backend without CORS gymnastics.

Backend must be running:

```bash
cd backend-api
npm run dev
```

## Design tokens

**Source of truth: `src/styles/tokens.css`** — CSS custom properties on `:root`. All components consume `var(--color-safe)`, `var(--font-display)`, etc.

`src/theme/tokens.ts` exists as a small TypeScript mirror for places that need token values as JS strings (Leaflet marker fill, dynamically-styled SVG). **Both files must stay in sync** — when changing a value, change it in `tokens.css` first, then mirror to `tokens.ts`.

Palette is the "Quiet Vigilance" direction from AGENT.md. The lavender mockup a teammate shared was NOT adopted — only the feature ideas from it (pattern details page, dashboard deltas, alert strip) were absorbed.

## Routes

| Path | Page | Auth |
| --- | --- | --- |
| `/onboarding` | Phone OTP login | public |
| `/home` | Map, SOS button, alert strip, stats dashboard | JWT |
| `/session/active` | Deadman countdown, live status, SOS | JWT |
| `/post-incident` | Emotional check-in after an event | JWT |
| `/report` | Anonymous incident submission | public |
| `/patterns` | Pattern Details — time-of-day, locations, trends, insights | public |
| `/ack/:token` | SMS-recipient landing page — ack + live location SSE | token |

## Demo Day talking point

"It's a URL — that's the install flow. Anyone with a modern browser is already running our app. Same Web APIs that power native apps power ours. And the same calm-to-urgent visual language carries from idle to active SOS in a single fluid moment."
