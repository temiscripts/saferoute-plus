import { randomBytes } from 'node:crypto';

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function newId() {
  return randomBytes(16).toString('hex');
}

function newToken() {
  return randomBytes(24).toString('base64url');
}

export function createEngine({ db, sendSms, config, logger }) {
  const {
    ackWindowSeconds,
    deadmanCheckinIntervalSeconds,
    deadmanTickIntervalSeconds,
    ackLinkBaseUrl,
  } = config;

  const findStaleSessions = db.prepare(`
    SELECT s.id, s.user_id, s.last_checkin_at
    FROM sessions s
    LEFT JOIN escalations e ON e.session_id = s.id AND e.status = 'active'
    WHERE s.status = 'active'
      AND s.last_checkin_at < ?
      AND e.id IS NULL
  `);

  const findSessionForSos = db.prepare(`
    SELECT s.id, s.user_id, s.status FROM sessions s WHERE s.id = ?
  `);

  const findActiveEscalation = db.prepare(`
    SELECT * FROM escalations WHERE session_id = ? AND status = 'active' LIMIT 1
  `);

  const findUser = db.prepare('SELECT id, phone, name FROM users WHERE id = ?');

  const findContactsByTier = db.prepare(
    'SELECT id, name, phone, tier FROM contacts WHERE user_id = ? AND tier = ? ORDER BY created_at ASC',
  );

  const findContactsAllTiers = db.prepare(
    'SELECT id, name, phone, tier FROM contacts WHERE user_id = ? ORDER BY tier ASC, created_at ASC',
  );

  const insertEscalation = db.prepare(`
    INSERT INTO escalations (id, session_id, status, current_tier, trigger_reason, started_at)
    VALUES (?, ?, 'active', 0, ?, ?)
  `);

  const updateEscalationTier = db.prepare(`
    UPDATE escalations SET current_tier = ? WHERE id = ?
  `);

  const exhaustEscalation = db.prepare(`
    UPDATE escalations SET status = 'exhausted', resolved_at = ? WHERE id = ?
  `);

  const ackEscalation = db.prepare(`
    UPDATE escalations SET status = 'acked', resolved_at = ?, resolved_by_contact_id = ? WHERE id = ?
  `);

  const cancelEscalation = db.prepare(`
    UPDATE escalations SET status = 'cancelled', resolved_at = ? WHERE id = ? AND status = 'active'
  `);

  const insertAttempt = db.prepare(`
    INSERT INTO escalation_attempts (id, escalation_id, contact_id, tier, notified_at, ack_token)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const markAttemptAcked = db.prepare(`
    UPDATE escalation_attempts SET acked_at = ? WHERE id = ?
  `);

  const findAttemptByToken = db.prepare(`
    SELECT a.*, e.session_id, e.status AS escalation_status
    FROM escalation_attempts a
    JOIN escalations e ON e.id = a.escalation_id
    WHERE a.ack_token = ?
  `);

  const findEscalation = db.prepare('SELECT * FROM escalations WHERE id = ?');

  const setSessionStatusSos = db.prepare(
    "UPDATE sessions SET status = 'sos', sos_triggered_at = ? WHERE id = ?",
  );

  const recentLocation = db.prepare(`
    SELECT lat, lng, recorded_at FROM session_locations
    WHERE session_id = ? ORDER BY recorded_at DESC LIMIT 1
  `);

  const tierTimers = new Map();
  let deadmanInterval = null;
  let stopped = false;

  function clearTierTimer(escalationId) {
    const t = tierTimers.get(escalationId);
    if (t) {
      clearTimeout(t);
      tierTimers.delete(escalationId);
    }
  }

  async function notifyContact({ contact, escalationId, user, session, reason }) {
    const token = newToken();
    const attemptId = newId();
    insertAttempt.run(attemptId, escalationId, contact.id, contact.tier, nowSeconds(), token);

    const loc = recentLocation.get(session.id);
    const locStr = loc ? `near ${loc.lat.toFixed(4)},${loc.lng.toFixed(4)}` : 'location unknown';
    const who = user.name ?? user.phone;
    const reasonText = reason === 'deadman' ? 'missed a safety check-in' : 'triggered SOS';
    const ackUrl = `${ackLinkBaseUrl}/${token}`;
    const body = `SafeRoute+ ALERT: ${who} ${reasonText} (${locStr}). Tap to acknowledge & see live location: ${ackUrl}`;

    try {
      await sendSms(contact.phone, body);
      logger.log(`[escalation] tier-${contact.tier} notified: ${contact.name} (${contact.phone})`);
    } catch (err) {
      logger.error(`[escalation] SMS failed for ${contact.phone}:`, err.message);
    }
    return { attemptId, token };
  }

  function scheduleNextTier({ escalationId, userId, sessionId, reason, nextTier }) {
    clearTierTimer(escalationId);
    const t = setTimeout(() => {
      runTier({ escalationId, userId, sessionId, reason, tier: nextTier }).catch((err) => {
        logger.error('[escalation] tier run failed:', err);
      });
    }, ackWindowSeconds * 1000);
    tierTimers.set(escalationId, t);
  }

  async function runTier({ escalationId, userId, sessionId, reason, tier }) {
    const esc = findEscalation.get(escalationId);
    if (!esc || esc.status !== 'active') return;

    if (tier > 3) {
      exhaustEscalation.run(nowSeconds(), escalationId);
      logger.log(`[escalation] ${escalationId} exhausted — no contact acked`);
      return;
    }

    const contacts = findContactsByTier.all(userId, tier);
    if (contacts.length === 0) {
      logger.log(`[escalation] no tier-${tier} contacts, escalating`);
      updateEscalationTier.run(tier, escalationId);
      return runTier({ escalationId, userId, sessionId, reason, tier: tier + 1 });
    }

    updateEscalationTier.run(tier, escalationId);
    const user = findUser.get(userId);
    const session = { id: sessionId };

    await Promise.all(
      contacts.map((contact) => notifyContact({ contact, escalationId, user, session, reason })),
    );

    scheduleNextTier({ escalationId, userId, sessionId, reason, nextTier: tier + 1 });
  }

  async function triggerSos(sessionId, reason = 'manual_sos') {
    const session = findSessionForSos.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const existing = findActiveEscalation.get(sessionId);
    if (existing) {
      logger.log(`[escalation] session ${sessionId} already has active escalation ${existing.id}`);
      return existing;
    }

    const contacts = findContactsAllTiers.all(session.user_id);
    if (contacts.length === 0) {
      logger.warn(`[escalation] session ${sessionId} has no trusted contacts — SOS recorded but no notifications sent`);
    }

    const escalationId = newId();
    insertEscalation.run(escalationId, sessionId, reason, nowSeconds());
    setSessionStatusSos.run(nowSeconds(), sessionId);

    runTier({
      escalationId,
      userId: session.user_id,
      sessionId,
      reason,
      tier: 1,
    }).catch((err) => logger.error('[escalation] tier run failed:', err));

    return findEscalation.get(escalationId);
  }

  function acknowledge(token) {
    const attempt = findAttemptByToken.get(token);
    if (!attempt) return { ok: false, reason: 'invalid_token' };
    if (attempt.escalation_status !== 'active') {
      return { ok: false, reason: 'escalation_already_resolved', sessionId: attempt.session_id };
    }
    const now = nowSeconds();
    markAttemptAcked.run(now, attempt.id);
    ackEscalation.run(now, attempt.contact_id, attempt.escalation_id);
    clearTierTimer(attempt.escalation_id);
    logger.log(`[escalation] ${attempt.escalation_id} acked by contact ${attempt.contact_id}`);
    return { ok: true, sessionId: attempt.session_id, escalationId: attempt.escalation_id };
  }

  function cancelForSession(sessionId) {
    const esc = findActiveEscalation.get(sessionId);
    if (!esc) return false;
    cancelEscalation.run(nowSeconds(), esc.id);
    clearTierTimer(esc.id);
    return true;
  }

  function deadmanTick() {
    if (stopped) return;
    const cutoff = nowSeconds() - deadmanCheckinIntervalSeconds;
    const stale = findStaleSessions.all(cutoff);
    for (const s of stale) {
      logger.log(`[deadman] session ${s.id} missed check-in (last ${nowSeconds() - s.last_checkin_at}s ago) — triggering SOS`);
      triggerSos(s.id, 'deadman').catch((err) => logger.error('[deadman] trigger failed:', err));
    }
  }

  function start() {
    if (deadmanInterval) return;
    deadmanInterval = setInterval(deadmanTick, deadmanTickIntervalSeconds * 1000);
    logger.log(`[escalation] engine started: deadman every ${deadmanTickIntervalSeconds}s, ack window ${ackWindowSeconds}s, deadman threshold ${deadmanCheckinIntervalSeconds}s`);
  }

  function stop() {
    stopped = true;
    if (deadmanInterval) {
      clearInterval(deadmanInterval);
      deadmanInterval = null;
    }
    for (const t of tierTimers.values()) clearTimeout(t);
    tierTimers.clear();
  }

  function validateToken(token) {
    const attempt = findAttemptByToken.get(token);
    if (!attempt) return null;
    return {
      sessionId: attempt.session_id,
      escalationId: attempt.escalation_id,
      contactId: attempt.contact_id,
      escalationStatus: attempt.escalation_status,
      acked: attempt.acked_at !== null,
    };
  }

  return { start, stop, triggerSos, acknowledge, cancelForSession, validateToken };
}
