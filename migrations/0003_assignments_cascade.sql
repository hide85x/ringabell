PRAGMA foreign_keys = OFF;

CREATE TABLE assignments_new (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES persons(id),
  type TEXT NOT NULL CHECK(type IN ('fight', 'event')),
  fight_id TEXT REFERENCES fights(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL
);

INSERT INTO assignments_new SELECT * FROM assignments;

DROP TABLE assignments;

ALTER TABLE assignments_new RENAME TO assignments;

CREATE INDEX idx_assignments_person_id ON assignments(person_id);
CREATE INDEX idx_assignments_event_id ON assignments(event_id);

PRAGMA foreign_keys = ON;
