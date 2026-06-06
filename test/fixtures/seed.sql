DELETE FROM users WHERE email LIKE '%@test.local';
INSERT INTO users (id, email, name, avatar, role, created_at)
VALUES ('test-user-001', 'admin@test.local', 'Test Admin', '', 'Admin', '2026-01-01T00:00:00.000Z');
