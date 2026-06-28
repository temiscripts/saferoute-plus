import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';

const here = path.dirname(fileURLToPath(import.meta.url));

fs.mkdirSync(path.dirname(env.databasePath), { recursive: true });

export const db = new Database(env.databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Apply schema on every startup — CREATE TABLE IF NOT EXISTS is idempotent
const schema = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');
db.exec(schema);
try {
  db.exec("ALTER TABLE reports ADD COLUMN severity TEXT CHECK (severity IN ('critical', 'high', 'moderate'))");
} catch (_) { /* column already exists */ }
