import { z } from 'zod';
import { db } from '../db/sqlite.js';
import { newId, nowSeconds } from '../utils/ids.js';
import { HttpError } from '../middleware/errorHandler.js';

export const startSessionSchema = z.object({
  destinationLat: z.coerce.number().gte(-90).lte(90).optional(),
  destinationLng: z.coerce.number().gte(-180).lte(180).optional(),
});

export const checkinSchema = z.object({
  lat: z.coerce.number().gte(-90).lte(90).optional(),
  lng: z.coerce.number().gte(-180).lte(180).optional(),
});

export const sosSchema = z.object({
  lat: z.coerce.number().gte(-90).lte(90).optional(),
  lng: z.coerce.number().gte(-180).lte(180).optional(),
});

const insertSession = db.prepare(`
  INSERT INTO sessions (id, user_id, status, started_at, last_checkin_at, destination_lat, destination_lng)
  VALUES (?, ?, 'active', ?, ?, ?, ?)
`);
const findSession = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?');
const updateCheckin = db.prepare('UPDATE sessions SET last_checkin_at = ? WHERE id = ?');
const endSessionStmt = db.prepare("UPDATE sessions SET status = 'ended', ended_at = ? WHERE id = ?");
const triggerSosStmt = db.prepare("UPDATE sessions SET status = 'sos', sos_triggered_at = ? WHERE id = ?");
const insertLocation = db.prepare(
  'INSERT INTO session_locations (id, session_id, lat, lng, recorded_at) VALUES (?, ?, ?, ?, ?)',
);
const recentLocations = db.prepare(
  'SELECT lat, lng, recorded_at FROM session_locations WHERE session_id = ? ORDER BY recorded_at DESC LIMIT ?',
);

export function postSession(req, res) {
  const id = newId();
  const now = nowSeconds();
  insertSession.run(
    id,
    req.user.id,
    now,
    now,
    req.body.destinationLat ?? null,
    req.body.destinationLng ?? null,
  );
  res.status(201).json({ session: { id, status: 'active', startedAt: now } });
}

export function postCheckin(req, res, next) {
  try {
    const session = findSession.get(req.params.id, req.user.id);
    if (!session) throw new HttpError(404, 'not_found', 'Session not found');
    if (session.status === 'ended') throw new HttpError(409, 'ended', 'Session already ended');

    const now = nowSeconds();
    updateCheckin.run(now, session.id);
    if (req.body.lat !== undefined && req.body.lng !== undefined) {
      insertLocation.run(newId(), session.id, req.body.lat, req.body.lng, now);
    }
    res.json({ ok: true, lastCheckinAt: now });
  } catch (err) {
    next(err);
  }
}

export function postSos(req, res, next) {
  try {
    const session = findSession.get(req.params.id, req.user.id);
    if (!session) throw new HttpError(404, 'not_found', 'Session not found');
    if (session.status === 'ended') throw new HttpError(409, 'ended', 'Session already ended');

    const now = nowSeconds();
    triggerSosStmt.run(now, session.id);
    if (req.body.lat !== undefined && req.body.lng !== undefined) {
      insertLocation.run(newId(), session.id, req.body.lat, req.body.lng, now);
    }
    res.json({ ok: true, status: 'sos', sosTriggeredAt: now });
  } catch (err) {
    next(err);
  }
}

export function postEnd(req, res, next) {
  try {
    const session = findSession.get(req.params.id, req.user.id);
    if (!session) throw new HttpError(404, 'not_found', 'Session not found');
    endSessionStmt.run(nowSeconds(), session.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export function getSession(req, res, next) {
  try {
    const session = findSession.get(req.params.id, req.user.id);
    if (!session) throw new HttpError(404, 'not_found', 'Session not found');
    const locations = recentLocations.all(session.id, 50);
    res.json({ session, locations });
  } catch (err) {
    next(err);
  }
}
