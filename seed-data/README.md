# seed-data

Realistic-looking demo data for SafeRoute+, set in Lagos (UNILAG, Yaba, Oshodi, Surulere, Victoria Island, and surrounding areas).

**Owner:** Project lead.

## Contents

| File | What it is |
|---|---|
| `reports.json` | 40 anonymous incident reports with Lagos coordinates, categories, descriptions, and relative timestamps |
| `routes.json` | 6 sample origin/destination pairs for the route-scoring demo |
| `seed.js` | Node.js script that inserts the JSON reports into the SQLite database |

All names, phone numbers, and personal details are fictional.

## How to seed the database

```bash
# 1. Make sure the backend-api is installed
cd backend-api && npm install && cd ..

# 2. Start the backend once to create the database (Ctrl-C after it starts)
cd backend-api && npm start
# (Ctrl-C)

# 3. Run the seed script from the repo root
node seed-data/seed.js

# or, with a custom DB path:
DATABASE_PATH=./backend-api/data/saferoute.db node seed-data/seed.js
```

Running the script multiple times is safe — `INSERT OR IGNORE` skips rows that already exist.

## Data distribution

The 40 reports are designed to produce meaningful output in the patterns dashboard:

- **Hotspot clusters**: 4–5 reports near UNILAG gate, 4 near Yaba bus stop, 3 near Oshodi overhead bridge
- **Time of day**: ~15 evening (5–9pm), ~12 night (9pm–5am), ~8 afternoon, ~5 morning — patterns page will show a clear evening/night peak
- **Categories**: Harassment (11) and catcalling (8) are most common; unsafe_area (6), attempted_robbery (3), stalking (3), assault (2), sexual_assault (2), other (1)
- **Spread**: Reports span the past 156 days, giving the monthly trend chart at least 5 months of data

## What to add (project lead)

- `voice-clips/` — short WAV files (calm + distressed) for the live voice-distress demo trigger
- `motion-traces/` — short accelerometer CSV files (normal + fall) for the motion-anomaly demo trigger
- Optionally: a `contacts.json` with sample trusted contacts (requires a seeded user account first)
