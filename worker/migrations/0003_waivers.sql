-- Signed participant waivers. Signatures are base64 PNG payloads (no data: prefix).
-- ip / user_agent / waiver_sha256 are kept as the e-signature audit trail.
CREATE TABLE IF NOT EXISTS waivers (
  id                    TEXT PRIMARY KEY,
  reference             TEXT NOT NULL,
  participant_name      TEXT NOT NULL,
  is_minor              INTEGER NOT NULL DEFAULT 0,
  guardian_name         TEXT,
  phone                 TEXT NOT NULL,
  email                 TEXT,
  email_copy            INTEGER NOT NULL DEFAULT 0,
  emergency_contact     TEXT NOT NULL,
  participant_signature TEXT,
  guardian_signature    TEXT,
  waiver_version        TEXT NOT NULL,
  waiver_sha256         TEXT NOT NULL,
  signed_at             INTEGER NOT NULL,
  signed_date           TEXT NOT NULL,
  ip                    TEXT,
  user_agent            TEXT,
  created_at            INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_waivers_date ON waivers (signed_date, signed_at);
CREATE INDEX IF NOT EXISTS idx_waivers_ip   ON waivers (ip, created_at);
