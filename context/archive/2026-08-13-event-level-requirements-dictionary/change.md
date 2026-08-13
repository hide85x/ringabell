---
change_id: event-level-requirements-dictionary
title: Role wymagane na poziomie gali powinny być konfigurowalne przez słownik
status: archived
created: 2026-08-13
updated: 2026-08-13
archived_at: 2026-08-13T12:46:07Z
---

## Notes

event-level-requirements-dictionary role wymagane na poziomie gali (dziś zahardkodowane Ratownik+Konferansjer w app/pages/manager/events.vue i server/api/manager/events/[id]/publish.post.ts) powinny być konfigurowalne przez słownik, symetrycznie do fight_requirement_defaults — jeśli rola nie ma wpisu z minimalną liczbą, nie jest wymagana na poziomie gali

**Superseded**: po wdrożeniu okazało się, że dwa równoległe słowniki (fight-level + event-level) tworzą realny bug (UI nie wspiera count>1 na poziomie gali, patrz `context/changes/event-level-multi-slot/`) i ryzyko pomyłki Admina (dwie kolumny obok siebie). Decyzja: wycofać event-level dictionary całkowicie, wrócić do jednego wspólnego słownika — patrz `context/changes/unify-personnel-dictionary/`. Ta zmiana (Fazy 1-4, commity af79ebc/d846a9a/9b40040) nigdy nie trafiła na produkcję.
