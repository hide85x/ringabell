CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK(role IN ('Admin', 'Manager', 'Personel')),
  password_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE persons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  venue TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft', 'published', 'cancelled')),
  created_at TEXT NOT NULL
);

CREATE TABLE fights (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  order_number INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE fight_requirements (
  id TEXT PRIMARY KEY,
  fight_id TEXT NOT NULL REFERENCES fights(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  count INTEGER NOT NULL
);

CREATE TABLE assignments (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES persons(id),
  type TEXT NOT NULL CHECK(type IN ('fight', 'event')),
  fight_id TEXT REFERENCES fights(id),
  event_id TEXT REFERENCES events(id),
  role TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_fights_event_id ON fights(event_id);
CREATE INDEX idx_assignments_person_id ON assignments(person_id);
CREATE INDEX idx_assignments_event_id ON assignments(event_id);
