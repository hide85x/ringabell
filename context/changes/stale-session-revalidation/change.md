---
change_id: stale-session-revalidation
title: Guardy nie unieważniają sesji po usunięciu konta lub zmianie roli
status: implementing
created: 2026-07-28
updated: 2026-07-28
archived_at: null
---

## Notes

guardy (requireAdmin/requireManager/requirePersonel) ufają tylko roli zapisanej w sesji przy logowaniu i nigdy nie sprawdzają ponownie tabeli users — usunięcie konta albo zmiana roli nie unieważnia już aktywnej sesji dopóki użytkownik sam się nie wyloguje
