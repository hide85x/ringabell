-- Ratownik/Konferansjer move from the event-level dictionary (removed below)
-- to the same fight-level dictionary every other role already uses.
INSERT INTO fight_requirement_defaults (id, role_id, count)
SELECT lower(hex(randomblob(16))), id, 1 FROM person_roles WHERE name = 'Ratownik'
AND NOT EXISTS (
  SELECT 1 FROM fight_requirement_defaults WHERE role_id = (SELECT id FROM person_roles WHERE name = 'Ratownik')
);

INSERT INTO fight_requirement_defaults (id, role_id, count)
SELECT lower(hex(randomblob(16))), id, 1 FROM person_roles WHERE name = 'Konferansjer'
AND NOT EXISTS (
  SELECT 1 FROM fight_requirement_defaults WHERE role_id = (SELECT id FROM person_roles WHERE name = 'Konferansjer')
);

-- Backfill every existing fight so pre-migration draft fights keep the same
-- publish validation they had under the event-level rule.
INSERT INTO fight_requirements (id, fight_id, role, count)
SELECT lower(hex(randomblob(16))), f.id, 'Ratownik', 1
FROM fights f
WHERE NOT EXISTS (
  SELECT 1 FROM fight_requirements fr WHERE fr.fight_id = f.id AND fr.role = 'Ratownik'
);

INSERT INTO fight_requirements (id, fight_id, role, count)
SELECT lower(hex(randomblob(16))), f.id, 'Konferansjer', 1
FROM fights f
WHERE NOT EXISTS (
  SELECT 1 FROM fight_requirements fr WHERE fr.fight_id = f.id AND fr.role = 'Konferansjer'
);

DROP TABLE event_requirement_defaults;
DROP TABLE event_requirements;
