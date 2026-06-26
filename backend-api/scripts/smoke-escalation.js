import jwt from 'jsonwebtoken';
import { db } from '../src/db/sqlite.js';
import { env } from '../src/config/env.js';

const BASE = `http://localhost:${env.port}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function http(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

function seedUserAndContacts() {
  db.prepare('DELETE FROM escalation_attempts').run();
  db.prepare('DELETE FROM escalations').run();
  db.prepare('DELETE FROM session_locations').run();
  db.prepare('DELETE FROM sessions').run();
  db.prepare('DELETE FROM contacts').run();
  db.prepare('DELETE FROM users WHERE id = ?').run('u-smoke');

  const now = Math.floor(Date.now() / 1000);
  db.prepare('INSERT INTO users (id, phone, name, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)')
    .run('u-smoke', '+2348000000000', 'Smoke User', now, now);

  const tiers = [
    ['c-t1', 'Tier 1 - Mum', '+2348011111111', 1],
    ['c-t2', 'Tier 2 - Friend', '+2348022222222', 2],
    ['c-t3', 'Tier 3 - Security', '+2348033333333', 3],
  ];
  for (const [id, name, phone, tier] of tiers) {
    db.prepare('INSERT INTO contacts (id, user_id, name, phone, tier, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, 'u-smoke', name, phone, tier, now);
  }

  return jwt.sign({ sub: 'u-smoke', phone: '+2348000000000' }, env.jwtSecret, { expiresIn: '1h' });
}

function dump(label, val) {
  console.log(`\n=== ${label} ===`);
  console.log(typeof val === 'string' ? val : JSON.stringify(val, null, 2));
}

async function main() {
  const token = seedUserAndContacts();
  dump('seed', 'u-smoke + 3 contacts');

  const startResp = await http('POST', '/sessions', { token, body: {} });
  dump('start session', startResp);
  const sessionId = startResp.body.session.id;

  const ci = await http('POST', `/sessions/${sessionId}/checkin`, { token, body: { lat: 6.5244, lng: 3.3792 } });
  dump('checkin (with location)', ci);

  const sos = await http('POST', `/sessions/${sessionId}/sos`, { token, body: { lat: 6.5244, lng: 3.3792 } });
  dump('manual SOS', sos);

  await sleep(500);

  const attempts = db.prepare(`
    SELECT a.tier, a.notified_at, a.acked_at, a.ack_token, c.name, c.phone
    FROM escalation_attempts a JOIN contacts c ON c.id = a.contact_id
    ORDER BY a.notified_at
  `).all();
  dump('escalation_attempts after SOS (expect 1 row for tier-1)', attempts);

  const tier1 = attempts.find((a) => a.tier === 1);
  if (!tier1) throw new Error('No tier-1 attempt recorded');

  const ackResp = await http('POST', `/escalation/ack/${tier1.ack_token}`);
  dump('ack tier-1', ackResp);

  const finalState = db.prepare(`
    SELECT id, status, current_tier, trigger_reason, resolved_at, resolved_by_contact_id FROM escalations
  `).all();
  dump('escalation rows (expect status=acked)', finalState);

  const state = await http('GET', `/escalation/state/${tier1.ack_token}`);
  dump('GET /escalation/state/:token', state);

  console.log('\n=== smoke-escalation: PASS ===');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('SMOKE FAIL:', err);
  process.exit(1);
});
