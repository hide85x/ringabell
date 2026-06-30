DELETE FROM users WHERE email LIKE '%@test.local';
INSERT INTO users (id, email, name, avatar, role, created_at)
VALUES ('test-user-001', 'admin@test.local', 'Test Admin', '', 'Admin', '2026-01-01T00:00:00.000Z');

DELETE FROM person_roles WHERE name = 'Bokser';
INSERT INTO person_roles (id, name, created_at)
VALUES ('test-role-001', 'Bokser', '2026-01-01T00:00:00.000Z');

DELETE FROM persons WHERE id LIKE 'test-%';

DELETE FROM assignments WHERE id LIKE 'test-%';
DELETE FROM fights WHERE id LIKE 'test-%';
DELETE FROM events WHERE id LIKE 'test-%';
DELETE FROM fight_requirement_defaults WHERE role_id = 'test-role-001';
INSERT INTO fight_requirement_defaults (id, role_id, count) VALUES ('test-frd-001', 'test-role-001', 2);
