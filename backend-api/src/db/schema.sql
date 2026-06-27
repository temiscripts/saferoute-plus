CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  tier INTEGER NOT NULL CHECK (tier IN (1, 2, 3)),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  severity TEXT CHECK (severity IN ('critical', 'high', 'moderate')),
  occurred_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_location ON reports(lat, lng);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active', 'sos', 'ended')),
  started_at INTEGER NOT NULL,
  last_checkin_at INTEGER NOT NULL,
  ended_at INTEGER,
  sos_triggered_at INTEGER,
  destination_lat REAL,
  destination_lng REAL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

CREATE TABLE IF NOT EXISTS session_locations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  recorded_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_locations_session ON session_locations(session_id);

CREATE TABLE IF NOT EXISTS escalations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active', 'acked', 'exhausted', 'cancelled')),
  current_tier INTEGER NOT NULL DEFAULT 0,
  trigger_reason TEXT NOT NULL CHECK (trigger_reason IN ('manual_sos', 'deadman')),
  started_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolved_by_contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_escalations_session ON escalations(session_id);
CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status);

CREATE TABLE IF NOT EXISTS escalation_attempts (
  id TEXT PRIMARY KEY,
  escalation_id TEXT NOT NULL REFERENCES escalations(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tier INTEGER NOT NULL,
  notified_at INTEGER NOT NULL,
  acked_at INTEGER,
  ack_token TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_attempts_escalation ON escalation_attempts(escalation_id);
CREATE INDEX IF NOT EXISTS idx_attempts_token ON escalation_attempts(ack_token);

CREATE TABLE IF NOT EXISTS post_incident_checkins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mood TEXT NOT NULL,
  notes TEXT,
  needs_support INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_checkins_user ON post_incident_checkins(user_id);
