import { Router } from 'express';

export function createEscalationRouter({ engine, db }) {
  const router = Router();

  const sessionState = db.prepare(`
    SELECT s.id, s.status, s.started_at, s.sos_triggered_at, s.ended_at,
           u.name AS user_name
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
  `);

  const recentLocations = db.prepare(`
    SELECT lat, lng, recorded_at FROM session_locations
    WHERE session_id = ? AND recorded_at > ?
    ORDER BY recorded_at ASC
  `);

  router.get('/state/:token', (req, res) => {
    const info = engine.validateToken(req.params.token);
    if (!info) return res.status(404).json({ error: { code: 'invalid_token' } });
    const session = sessionState.get(info.sessionId);
    res.json({
      session,
      escalation: { id: info.escalationId, status: info.escalationStatus, alreadyAcked: info.acked },
    });
  });

  router.post('/ack/:token', (req, res) => {
    const result = engine.acknowledge(req.params.token);
    if (!result.ok) return res.status(400).json({ error: { code: result.reason, sessionId: result.sessionId } });
    res.json({ ok: true, sessionId: result.sessionId, escalationId: result.escalationId });
  });

  router.get('/stream/:token', (req, res) => {
    const info = engine.validateToken(req.params.token);
    if (!info) return res.status(404).json({ error: { code: 'invalid_token' } });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let lastSeen = 0;
    const send = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const session = sessionState.get(info.sessionId);
    send('snapshot', { session, escalationId: info.escalationId });

    const initialLocs = recentLocations.all(info.sessionId, 0);
    for (const loc of initialLocs) {
      send('location', loc);
      if (loc.recorded_at > lastSeen) lastSeen = loc.recorded_at;
    }

    const tick = setInterval(() => {
      const newLocs = recentLocations.all(info.sessionId, lastSeen);
      for (const loc of newLocs) {
        send('location', loc);
        if (loc.recorded_at > lastSeen) lastSeen = loc.recorded_at;
      }
      const snap = sessionState.get(info.sessionId);
      if (snap && (snap.status === 'ended' || snap.ended_at)) {
        send('session_ended', snap);
        clearInterval(tick);
        res.end();
      }
    }, 2000);

    const heartbeat = setInterval(() => res.write(':\n\n'), 15000);

    req.on('close', () => {
      clearInterval(tick);
      clearInterval(heartbeat);
    });
  });

  return router;
}
