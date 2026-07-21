DELETE FROM users WHERE email LIKE '%@test.local';
INSERT INTO users (id, email, name, avatar, role, created_at)
VALUES ('test-user-001', 'admin@test.local', 'Test Admin', '', 'Admin', '2026-01-01T00:00:00.000Z');

-- Delete children before parents (assignments.person_id has no ON DELETE CASCADE)
DELETE FROM assignments WHERE id LIKE 'test-%';
DELETE FROM fights WHERE id LIKE 'test-%';
DELETE FROM events WHERE id LIKE 'test-%';
DELETE FROM persons WHERE id LIKE 'test-%';
DELETE FROM fight_requirement_defaults WHERE role_id = 'test-role-001';
DELETE FROM person_roles WHERE name = 'Bokser';

INSERT INTO person_roles (id, name, created_at)
VALUES ('test-role-001', 'Bokser', '2026-01-01T00:00:00.000Z');

INSERT INTO fight_requirement_defaults (id, role_id, count) VALUES ('test-frd-001', 'test-role-001', 2);

-- Fixtures for personnel-schedule-view integration tests
INSERT INTO persons (id, name, email, phone, role, is_active, created_at)
VALUES ('test-personel-001', 'Test Personel', 'test-personel@test.local', '123456789', 'Bokser', 1, '2026-01-01T00:00:00.000Z');

INSERT INTO events (id, name, date, venue, status, created_at)
VALUES
  ('test-event-personel-pub', 'Personel Published Event', '2026-08-01', 'Warszawa', 'published', '2026-01-01T00:00:00.000Z'),
  ('test-event-personel-draft', 'Personel Draft Event', '2026-08-02', 'Warszawa', 'draft', '2026-01-01T00:00:00.000Z'),
  ('test-event-personel-other', 'Personel Unassigned Event', '2026-08-03', 'Warszawa', 'published', '2026-01-01T00:00:00.000Z');

INSERT INTO fights (id, event_id, order_number, created_at)
VALUES ('test-fight-personel-001', 'test-event-personel-pub', 1, '2026-01-01T00:00:00.000Z');

INSERT INTO assignments (id, person_id, type, fight_id, event_id, role, created_at)
VALUES
  ('test-assign-personel-evt', 'test-personel-001', 'event', NULL, 'test-event-personel-pub', 'Ratownik', '2026-01-01T00:00:00.000Z'),
  ('test-assign-personel-fight', 'test-personel-001', 'fight', 'test-fight-personel-001', NULL, 'Sędzia', '2026-01-01T00:00:00.000Z'),
  ('test-assign-personel-draft', 'test-personel-001', 'event', NULL, 'test-event-personel-draft', 'Ratownik', '2026-01-01T00:00:00.000Z');
