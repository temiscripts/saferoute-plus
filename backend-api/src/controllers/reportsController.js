import { z } from 'zod';
import { db } from '../db/sqlite.js';
import { newId, nowSeconds } from '../utils/ids.js';

export const createReportSchema = z.object({
  lat: z.coerce.number().gte(-90).lte(90),
  lng: z.coerce.number().gte(-180).lte(180),
  description: z.string().min(1).max(2000),
  category: z.string().min(1).max(60).optional(),
  occurredAt: z.coerce.number().int().optional(),
});

export const listReportsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
  sinceDays: z.coerce.number().int().min(1).max(3650).optional().default(180),
});

const insertReport = db.prepare(
  'INSERT INTO reports (id, lat, lng, description, category, occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
);
const selectReports = db.prepare(
  'SELECT id, lat, lng, description, category, occurred_at, created_at FROM reports WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?',
);

export function postReport(req, res) {
  const id = newId();
  const now = nowSeconds();
  insertReport.run(
    id,
    req.body.lat,
    req.body.lng,
    req.body.description,
    req.body.category ?? null,
    req.body.occurredAt ?? null,
    now,
  );
  res.status(201).json({ id, createdAt: now });
}

export function getReports(req, res) {
  const { limit, sinceDays } = req.validatedQuery;
  const cutoff = nowSeconds() - sinceDays * 86400;
  res.json({ reports: selectReports.all(cutoff, limit) });
}
