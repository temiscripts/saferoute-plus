#!/usr/bin/env node
// Run from the repo root:
//   node seed-data/seed.js
// or with a custom DB path:
//   DATABASE_PATH=./my.db node seed-data/seed.js
//
// Requires backend-api dependencies to be installed first:
//   cd backend-api && npm install

const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DATABASE_PATH
  || path.join(__dirname, '../backend-api/data/saferoute.sqlite');

if (!fs.existsSync(DB_PATH)) {
  console.error(`Database not found at ${DB_PATH}`);
  console.error('Start the backend-api server once first so it creates the database.');
  process.exit(1);
}

const Database = require('../backend-api/node_modules/better-sqlite3');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const reports = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'reports.json'), 'utf8')
);

const insertReport = db.prepare(`
  INSERT OR IGNORE INTO reports (id, lat, lng, description, category, occurred_at, created_at)
  VALUES (@id, @lat, @lng, @description, @category, @occurred_at, @created_at)
`);

const now = Math.floor(Date.now() / 1000);

const insertAll = db.transaction(() => {
  let inserted = 0;
  for (const r of reports) {
    const created_at = now - r.days_ago * 86400;
    const occurred_at = created_at - (3600 - r.hour * 150);
    const result = insertReport.run({
      id: r.id,
      lat: r.lat,
      lng: r.lng,
      description: r.description,
      category: r.category,
      occurred_at,
      created_at,
    });
    if (result.changes > 0) inserted++;
  }
  return inserted;
});

const inserted = insertAll();
console.log(`Seeded ${inserted} reports (${reports.length - inserted} already existed).`);

db.close();
