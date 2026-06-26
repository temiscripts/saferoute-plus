# web-app

Responsive browser-based web app shell for SafeRoute+. Navigation + screens that all features plug into.

**Owner:** Project lead.
**Status:** scaffolded (implementation pending).

## Why a web app, not native mobile

- Runs on any judge's phone via a URL — no install, no app-store flow, no native build pipeline.
- Modern browser Web APIs cover everything the product needs:
  - **Geolocation API** — live position + watchPosition for the active session
  - **MediaDevices.getUserMedia** — microphone for on-device voice distress inference
  - **DeviceMotionEvent / DeviceOrientationEvent** — accelerometer for motion anomaly inference
  - **Notifications + Web Push** — escalation pings
  - **Service Worker** — offline shell + background timers for the deadman switch

## Planned stack

- Vite + React + TypeScript
- React Router
- Calls `/backend-api` over HTTP/JSON
- Maps via Leaflet (OSM tiles) by default; Google Maps JS swap-in possible

## Screens (planned)

- Onboarding + phone OTP
- Map (with crowdsourced report overlay)
- Route planner ("safer route" toggle)
- Active session / SOS (with "safety pulse" idle animation)
- Trusted contacts (tier 1/2/3)
- Anonymous report submission
- Post-incident check-in

## Demo Day talking point

"It's a URL — that's the install flow. Anyone with a modern browser is already running our app. The same Web APIs that power native apps power ours."
