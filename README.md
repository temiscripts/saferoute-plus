# SafeRoute Plus

**A continuous safety and wellness companion for Nigerian women.**

Built for the **HER Hackathon** by NITHUB, University of Lagos — Track: Women's Safety & Health.
Submission deadline: 28 June 2026 · Demo Day: 30 June 2026

🌐 **Live app:** https://saferoute-plus.netlify.app
🔧 **API:** https://saferoute-plus.onrender.com

---

## What it does

SafeRoute Plus is a full-stack mobile-first web app that combines **community reporting**, **real-time trip protection**, and **ML-powered risk intelligence** to help women in Lagos navigate safely.

### Core features

**Community safety map**
Women report incidents anonymously — harassment, stalking, assaults, unsafe areas — by category and severity. Reports are pinned to a live Leaflet map with colour-coded risk zones (critical / high / moderate / low). Filter by incident type. No account required to report.

**SOS & deadman timer**
When a user starts a trip, a deadman timer begins. The app checks in automatically every 60 seconds. If check-ins stop for 2 minutes (phone snatched, no signal, incapacitated), SOS fires automatically. Users can also tap SOS manually at any time. The escalation engine texts trusted contacts in tier order (tier 1 → tier 2 → tier 3) with the user's last known GPS location and an acknowledge link. The first contact to respond stops the escalation.

**Trusted contacts**
Users add emergency contacts (name + phone number) assigned to escalation tiers. Managed through the `/contacts` page. Without at least one contact, SOS alerts have nobody to notify.

**Pattern intelligence dashboard**
Aggregated insights from all community reports: time-of-day risk windows, location hotspots, incident type breakdowns, and month-on-month trends. Visualised as progress-bar cards across four tabs (Time patterns / Location clusters / Incident types / Monthly trends).

**Post-incident check-in**
After a session ends or SOS is resolved, users are prompted to check in on their wellbeing. Four mood options. If distressed, Nigerian support resources are surfaced (WARIF, police emergency line, etc.).

**ML voice distress detection**
A trained SVM classifier (RAVDESS dataset, F1 = 0.97) identifies distress from audio — intended for future integration with the mobile client to trigger SOS hands-free.

**ML motion anomaly detection**
A trained Random Forest model (synthetic 3-axis accelerometer data, F1 = 1.00 synthetic) detects fall/struggle patterns — intended for background motion monitoring via device sensors.

**ML report clustering**
DBSCAN spatial clustering over community reports with severity weighting. Surfaces hotspot clusters with risk scores, risk levels, and severity breakdowns. Designed to augment or replace the pattern aggregation endpoint once enough real data exists.

---

## Tech stack

### Backend (`/backend-api`)
- **Runtime:** Node.js 20, ES modules
- **Framework:** Express 4
- **Database:** SQLite via better-sqlite3 (schema: users, OTP codes, contacts, reports, sessions, session locations, escalations, post-incident check-ins)
- **Auth:** Phone OTP → JWT (bcryptjs, jsonwebtoken). OTPs logged to Google Sheets via Apps Script webhook.
- **Validation:** Zod schemas on all incoming request bodies
- **SMS:** Provider-agnostic service layer (console / Twilio / Africa's Talking / Termii). Currently in console mode — OTP and SOS SMS print to server terminal and log to Google Sheets.
- **Maps / routing:** OSRM (free, keyless) for route scoring; Google Maps API supported via env var
- **Geocoding:** Nominatim (OpenStreetMap) for reverse geocoding — no API key required

### Escalation engine (`/escalation-engine`)
- In-process Node.js module, dependency-injected into the backend server
- Deadman ticker (configurable interval, default 10 s)
- Tiered SMS escalation with configurable ack window (default 30 s per tier)
- Server-Sent Events (SSE) for real-time location streaming to the ack page

### Web app (`/web-app`)
- **Framework:** React 18 + TypeScript
- **Bundler:** Vite 5
- **Routing:** React Router 6
- **Maps:** Leaflet + react-leaflet
- **Design:** Custom CSS design token system (`tokens.css`) — lavender colour scheme (`--lav-50` through `--lav-900`), no external UI library
- **Auth guard:** `RequireAuth` component + JWT stored in localStorage

### ML modules (local — not deployed)
- **Voice distress:** scikit-learn SVM + CalibratedClassifierCV, trained on RAVDESS parquet (`xbgoose/ravdess`, 336 samples), F1 = 0.97
- **Motion anomaly:** scikit-learn Random Forest, trained on synthetic 3-phase fall data (3000 windows), F1 = 1.00 synthetic
- **Report clustering:** DBSCAN with combined distance matrix (spatial + temporal + category + severity), scikit-learn

### Deployment
- **Backend:** Render (Node web service, `render.yaml` included — auto-seeds reports on cold start)
- **Frontend:** Netlify (`netlify.toml` included, SPA redirect via `_redirects`)

---

## Screens

| Route | Description | Auth? |
|---|---|---|
| `/onboarding` | Phone OTP sign-in / sign-up | No |
| `/home` | Hero, stats bar, map preview, feature overview | No |
| `/map` | Full safety map with risk alerts and filters | No |
| `/report` | Anonymous incident submission form | No |
| `/dashboard` | Stats cards, recent incidents, category chart | Yes |
| `/patterns` | Pattern details — 4-tab breakdown with insights | No |
| `/contacts` | Add / remove trusted emergency contacts | Yes |
| `/session/active` | Deadman timer, I'm OK check-in, manual SOS | Yes |
| `/post-incident` | Wellbeing check-in after session ends | Yes |
| `/ack/:token` | SMS recipient ack page with live location map | No |

---

## Project structure

```
saferoute-plus/
├── backend-api/          Node/Express REST API + escalation engine
│   ├── src/
│   │   ├── controllers/  Request handlers (auth, reports, patterns, contacts, sessions…)
│   │   ├── db/           SQLite schema, migrations, auto-seed
│   │   ├── middleware/   Auth (JWT), validation (Zod), error handler
│   │   ├── routes/       Express routers
│   │   ├── services/     SMS, OTP, token signing, escalation gateway
│   │   └── utils/        ID generation, phone normalisation, time helpers
│   └── .env              Secrets (never committed — see .env.example)
├── escalation-engine/    Deadman + tiered SOS module (injected into backend)
├── web-app/              React + TypeScript frontend
│   ├── src/
│   │   ├── api/          Typed fetch wrappers (auth, reports, patterns, contacts, sessions)
│   │   ├── components/   Layout, MapView, DeadmanBar, AlertStrip, StatsDashboard…
│   │   ├── hooks/        useAuth, useGeolocation
│   │   ├── pages/        One file per screen
│   │   └── styles/       tokens.css, global.css
│   └── public/           _redirects (Netlify SPA routing)
├── voice-distress-model/ Python ML — audio distress classifier
├── motion-anomaly-model/ Python ML — accelerometer anomaly detector
├── report-clustering/    Python ML — DBSCAN spatial clustering with severity weights
├── seed-data/            40 Lagos incident reports + seed script
├── render.yaml           Render deployment config (backend)
└── netlify.toml          Netlify deployment config (frontend)
```

---

## Local setup

**Prerequisites:** Node.js ≥ 20, Python ≥ 3.9 (ML modules only)

```bash
# 1. Backend
cd backend-api
cp ../.env.example .env        # fill in JWT_SECRET at minimum
npm install
node src/server.js             # starts on :4000, auto-creates DB and seeds reports

# 2. Frontend (new terminal)
cd web-app
npm install
npm run dev                    # starts on :5173

# 3. Seed reports (optional — server auto-seeds on cold start)
node seed-data/seed.js
```

OTPs print to the backend terminal (SMS_PROVIDER=console) **and** appear in the team Google Sheet.

---

## Deployment

**Backend → Render**
- Connect the GitHub repo at render.com → New Web Service
- Root directory: `backend-api`
- Build command: `npm install`
- Start command: `node src/server.js`
- All env vars are pre-configured in `render.yaml` (JWT_SECRET is auto-generated)
- After deploy, add `ACK_LINK_BASE_URL=https://<netlify-url>/ack` and `CORS_ORIGIN=https://<netlify-url>` in Render dashboard

**Frontend → Netlify**
- Connect the GitHub repo at netlify.com → New site
- Build settings are pre-configured in `netlify.toml`
- Add environment variable: `VITE_API_BASE_URL=https://<render-url>`

---

## Team

| Name | Role |
|---|---|
| [temiscripts](https://github.com/temiscripts) | Backend, frontend, escalation engine, seed data |
| Onose Braimah(https://github.com/Ono-se) | ML — voice distress model, motion anomaly model |
| Chinonye Ibeakanma | ML — report clustering |
| Olamide Ade-Olunusi | UI/UX design |

---

## Hackathon context

**Event:** HER Hackathon by NITHUB, University of Lagos
**Track:** Women's Safety & Health
**Problem:** Women in Lagos face daily safety risks with limited tools for real-time help or community awareness. Existing apps don't combine passive monitoring, community intelligence, and ML risk detection in one place designed for the Nigerian context.
**Solution:** SafeRoute Plus — always-on safety companion with a community-driven safety map, automatic SOS escalation, and ML-powered pattern recognition tailored to Lagos geography.
