---
change_id: unify-personnel-dictionary
title: Usunąć event-level dictionary — Ratownik/Konferansjer wracają do jednego wspólnego słownika (per walka)
status: implemented
created: 2026-08-13
updated: 2026-08-13
archived_at: null
---

## Notes

wywalamy event-level dictionary (event_requirement_defaults/event_requirements, kolumna MIN. NA GALĘ, sekcja OBSŁUGA GALI) — Ratownik i Konferansjer mają być skonfigurowane w tym samym jednym słowniku co reszta personelu (fight_requirement_defaults, MIN. NA WALKĘ), przypisywane per walka, bez żadnego specjalnego traktowania na poziomie gali.

Kontekst: `event-level-requirements-dictionary` (ten sam dzień, wcześniej w tej samej sesji) wprowadził drugi, równoległy słownik na poziomie gali. Powstały z tego dwa problemy: (1) UI na poziomie gali nie wspiera count>1 — patrz `context/changes/event-level-multi-slot/research.md`, (2) dwie kolumny w Admin → Słowniki tworzą ryzyko pomyłki (łatwo wpisać wartość w złą kolumnę). Decyzja: nie naprawiać tych dwóch problemów, tylko usunąć całą koncepcję event-level i wrócić do jednego słownika. Żadna z tabel/migracji z `event-level-requirements-dictionary` nie trafiła jeszcze na produkcję (tylko lokalnie) — bezpieczne do wycofania bez ryzyka dla prod.
