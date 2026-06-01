CREATE TABLE person_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE fight_requirement_defaults (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES person_roles(id) ON DELETE CASCADE,
  count INTEGER NOT NULL CHECK(count > 0)
);

CREATE UNIQUE INDEX idx_fight_req_defaults_role ON fight_requirement_defaults(role_id);
