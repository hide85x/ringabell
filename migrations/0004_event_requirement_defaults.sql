CREATE TABLE event_requirement_defaults (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES person_roles(id) ON DELETE CASCADE,
  count INTEGER NOT NULL CHECK(count > 0)
);

CREATE UNIQUE INDEX idx_event_req_defaults_role ON event_requirement_defaults(role_id);

CREATE TABLE event_requirements (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  count INTEGER NOT NULL
);

CREATE INDEX idx_event_requirements_event_id ON event_requirements(event_id);

-- Ensure the two roles this dictionary is seeded with already exist
-- (not guaranteed on a fresh/test database — only 'Bokser' is seeded there).
INSERT INTO person_roles (id, name, created_at)
SELECT lower(hex(randomblob(16))), 'Ratownik', datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM person_roles WHERE name = 'Ratownik');

INSERT INTO person_roles (id, name, created_at)
SELECT lower(hex(randomblob(16))), 'Konferansjer', datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM person_roles WHERE name = 'Konferansjer');

-- Seed the dictionary with today's behavior (1 Ratownik, 1 Konferansjer per gala)
INSERT INTO event_requirement_defaults (id, role_id, count)
SELECT lower(hex(randomblob(16))), id, 1 FROM person_roles WHERE name = 'Ratownik';

INSERT INTO event_requirement_defaults (id, role_id, count)
SELECT lower(hex(randomblob(16))), id, 1 FROM person_roles WHERE name = 'Konferansjer';

-- Backfill every existing gala (any status) so pre-migration drafts keep the
-- same publish validation they had under the old hardcoded rule.
INSERT INTO event_requirements (id, event_id, role, count)
SELECT lower(hex(randomblob(16))), e.id, d.role_name, d.count
FROM events e
CROSS JOIN (
  SELECT pr.name AS role_name, erd.count AS count
  FROM event_requirement_defaults erd
  JOIN person_roles pr ON pr.id = erd.role_id
) d;
