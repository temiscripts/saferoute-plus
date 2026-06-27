import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './sqlite.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');

db.exec(schema);
console.log('migrate: schema applied');

try {
  db.exec("ALTER TABLE reports ADD COLUMN severity TEXT CHECK (severity IN ('critical', 'high', 'moderate'))");
  console.log('migrate: added severity column to reports');
} catch (_) {
  // column already exists — safe to ignore
}
