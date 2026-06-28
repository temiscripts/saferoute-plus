import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './sqlite.js';
import { nowSeconds } from '../utils/ids.js';

const here = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(here, '../../../seed-data/reports.json');

const insertReport = db.prepare(`
  INSERT OR IGNORE INTO reports (id, lat, lng, description, category, severity, occurred_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

export function seedIfEmpty() {
  const { n } = db.prepare('SELECT COUNT(*) as n FROM reports').get();
  if (n > 0) return;
  if (!existsSync(SEED_PATH)) {
    console.log('[auto-seed] seed file not found, skipping');
    return;
  }

  const reports = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
  const now = nowSeconds();

  db.transaction(() => {
    for (const r of reports) {
      const created_at = now - r.days_ago * 86400;
      const d = new Date(created_at * 1000);
      d.setHours(0, 0, 0, 0);
      const occurred_at = Math.floor(d.getTime() / 1000) + r.hour * 3600;
      insertReport.run(r.id, r.lat, r.lng, r.description, r.category, r.severity ?? null, occurred_at, created_at);
    }
  })();

  console.log(`[auto-seed] seeded ${reports.length} reports`);
}
