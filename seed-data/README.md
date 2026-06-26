# seed-data

Realistic-looking sample data used across modules for the demo.

**Owner:** Project lead.
**Status:** placeholder — content to be added.

## Planned contents

- `reports.json` — anonymous incident reports around Lagos (UNILAG + surrounding areas), varied categories and times
- `contacts.json` — sample trusted contacts (tier 1/2/3)
- `routes.json` — sample origin/destination pairs for route-scoring demo
- `voice-clips/` — short sample wavs for live voice-distress demo triggers
- `motion-traces/` — short accelerometer CSVs for live motion-anomaly demo triggers

All names, phone numbers, and personal details in this folder are fake.

## Why this is its own folder

Demo data is referenced by multiple modules (backend, ML inference scripts, mobile app) so it doesn't belong inside any one of them.
