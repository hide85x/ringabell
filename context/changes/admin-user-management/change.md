---
change_id: admin-user-management
title: Admin manages user accounts and assigns system roles
status: implemented
created: 2026-05-29
updated: 2026-05-31
archived_at: null
---

## Notes

Admin zarządza kontami użytkowników i przypisuje role systemowe

## Nieprzetestowane ręcznie

- PATCH /api/admin/users/:id z nieprawidłową rolą → 400 (2.4) — nie testowane, weryfikacja przez UI w Phase 3
- DELETE /api/admin/users/:id (2.5) — nie testowane, weryfikacja przez UI w Phase 3 (tylko jeden user w systemie)
