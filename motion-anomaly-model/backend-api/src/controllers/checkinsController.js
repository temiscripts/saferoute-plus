import { z } from 'zod';
import { db } from '../db/sqlite.js';
import { newId, nowSeconds } from '../utils/ids.js';

export const checkinSchema = z.object({
  mood: z.enum(['safe', 'shaken', 'distressed', 'in_danger']),
  notes: z.string().max(2000).optional(),
  needsSupport: z.boolean().optional(),
});

const insertCheckin = db.prepare(
  'INSERT INTO post_incident_checkins (id, user_id, mood, notes, needs_support, created_at) VALUES (?, ?, ?, ?, ?, ?)',
);
const listCheckins = db.prepare(
  'SELECT id, mood, notes, needs_support, created_at FROM post_incident_checkins WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
);

export function postPostIncidentCheckin(req, res) {
  const id = newId();
  const now = nowSeconds();
  const needsSupport = req.body.needsSupport
    || req.body.mood === 'distressed'
    || req.body.mood === 'in_danger';
  insertCheckin.run(id, req.user.id, req.body.mood, req.body.notes ?? null, needsSupport ? 1 : 0, now);
  res.status(201).json({ id, needsSupport, createdAt: now });
}

export function getMyCheckins(req, res) {
  res.json({ checkins: listCheckins.all(req.user.id) });
}
