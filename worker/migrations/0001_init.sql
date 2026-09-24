CREATE TABLE IF NOT EXISTS bookings (
  id         TEXT PRIMARY KEY,
  code       TEXT NOT NULL,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  email      TEXT NOT NULL,
  party      INTEGER NOT NULL,
  kids       INTEGER NOT NULL DEFAULT 0,
  date       TEXT NOT NULL,
  time       TEXT NOT NULL,
  notes      TEXT,
  status     TEXT NOT NULL DEFAULT 'confirmed',
  ip_hash    TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings (date, time, status);
CREATE INDEX IF NOT EXISTS idx_bookings_ip   ON bookings (ip_hash, created_at);
