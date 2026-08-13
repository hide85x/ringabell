ALTER TABLE fight_requirement_defaults ADD COLUMN has_corner INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fight_requirements ADD COLUMN has_corner INTEGER NOT NULL DEFAULT 0;
ALTER TABLE assignments ADD COLUMN corner TEXT;
