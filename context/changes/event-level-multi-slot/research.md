---
date: 2026-08-13T09:36:15Z
researcher: Claude
git_commit: 9b4004077ce42acd148ae530175cf86ca3f0d241
branch: master
repository: ringabell
topic: "Event-level OBSŁUGA GALI UI nie wspiera count > 1 z event_requirement_defaults"
tags: [research, codebase, manager-events, event-requirements, multi-slot]
status: complete
last_updated: 2026-08-13
last_updated_by: Claude
---

# Research: Event-level OBSŁUGA GALI UI nie wspiera count > 1

**Date**: 2026-08-13T09:36:15Z
**Researcher**: Claude
**Git Commit**: 9b4004077ce42acd148ae530175cf86ca3f0d241
**Branch**: master
**Repository**: ringabell

## Research Question

`app/pages/manager/events.vue`: sekcja OBSŁUGA GALI (event-level requirements, wprowadzone w zmianie `event-level-requirements-dictionary`) renderuje jeden dropdown na rolę bez uwzględnienia `req.count`, mimo że `event_requirement_defaults` pozwala Adminowi ustawić `count > 1` dla dowolnej roli na poziomie gali. Poziom walki (`fight_requirements`) ma pełne wsparcie multi-slot. Jaki jest pełny zakres problemu — czy to tylko UI, czy też backend/walidacja, i czy są inne miejsca w kodzie zależne od założenia "1 osoba per rola na poziomie gali"?

## Summary

**Bug jest w 100% izolowany do frontendu (`app/pages/manager/events.vue`).** Backend (schema, walidacja publikacji, endpointy odczytu dla Managera i Personelu) poprawnie obsługuje wiele przypisań tej samej roli na poziomie gali od momentu wdrożenia migracji `0004_event_requirement_defaults.sql`. Jedyna rzecz, która nie działa, to edycja — Manager nie ma w UI możliwości przypisania drugiej osoby do roli, dla której Admin ustawił `count > 1` w słowniku event-level.

Skutek: jeśli Admin ustawi np. Ratownik=2 w Admin → Słowniki → MIN. NA GALĘ, żadna nowo utworzona gala nigdy nie przejdzie walidacji publikacji (`eventMissingRoles()` zawsze zgłasza brakującą rolę, bo UI pozwala wypełnić tylko 1 z 2 wymaganych miejsc) — funkcjonalna blokada, nie tylko brak wygody.

## Detailed Findings

### Frontend — `app/pages/manager/events.vue` (root cause)

- `getEventSlotPersonId(role: string)` (linia 238-240) — `eventAssignments.find(a => a.role === role)` — zwraca TYLKO pierwsze przypisanie danej roli, nie ma parametru `slotIndex`.
- `handleEventSlotChange(role: string, newPersonId: string)` (linia 219-232) — analogicznie, `eventAssignments.find(a => a.role === role)` do ustalenia które przypisanie zastąpić/usunąć — brak `slotIndex`.
- Template, sekcja "OBSŁUGA GALI" (linia 522-545) — `v-for="req in eventDetail.eventRequirements"` renderuje **jeden** `<select>` na rolę, niezależnie od `req.count`. Brak wewnętrznego `v-for="slotIdx in req.count"`.

Dla porównania, poziom walki ma pełne wsparcie multi-slot:
- `getFightSlotPersonId(fight, role, slotIndex)` (linia 234-236) — `.filter(a => a.role === role)[slotIndex]`.
- `handleFightSlotChange(fight, role, slotIndex, newPersonId)` (linia 205-217) — analogicznie przez `.filter(...)[slotIndex]`.
- Template (linia 490-509) — `v-for="req in fight.requirements"` → wewnątrz `v-for="slotIdx in req.count"` → osobny `<select>` per slot, z `getFightSlotPersonId(fight, req.role, slotIdx - 1)`.

`eventMissingRoles()` (linia 251-259, dodana w `event-level-requirements-dictionary` fazie 3) jest zaimplementowana **poprawnie** — liczy `eventDetail.value.eventAssignments.filter(a => a.role === req.role).length` i porównuje z `req.count`. To ta funkcja poprawnie zgłasza rolę jako brakującą, gdy UI nie potrafi wypełnić więcej niż 1 slot — czyli walidacja "widzi" problem poprawnie, ale UI nie daje sposobu go naprawić.

### Backend — walidacja publikacji

`server/api/manager/events/[id]/publish.post.ts:56-70` (generyczna pętla dodana w fazie 3 tej samej zmiany):
```sql
SELECT COUNT(*) AS count FROM assignments WHERE event_id = ? AND type = 'event' AND role = ?
```
— poprawnie liczy WSZYSTKIE przypisania danej roli, porównuje z `req.count` ze słownika. Brak bugu — to działa dla `count` dowolnej wielkości.

### Backend — odczyt danych

- `server/api/manager/events/[id].get.ts:51-59` — `SELECT ... FROM assignments WHERE type = 'event' AND event_id = ?` — zwraca WSZYSTKIE wiersze, żadnego `LIMIT`/`.first()`. Poprawne.
- `server/api/personel/events/[id].get.ts` i `server/api/personel/events/index.get.ts` — agregują przez `GROUP_CONCAT(DISTINCT ...)` do budowy listy nazw ról na potrzeby widoku Personelu (badge z rolami, nie identyfikatory przypisań) — to zamierzone, nie jest bugiem powiązanym z tym problemem.

### Backend — zapis (assignments API)

`server/api/manager/assignments/index.post.ts` / `[id].delete.ts` — operują na id konkretnego wiersza `assignments`, bez założenia jedyności per rola/event. Brak schema-level unique constraint blokującego wiele wierszy `type='event'` o tej samej `role`+`event_id` (`migrations/0001_init.sql:44-52` — `assignments` nie ma żadnego UNIQUE na `(event_id, role)`). DB w pełni wspiera multi-slot już teraz.

### Nie jest częścią bugu

`app/pages/admin/dictionaries.vue` i `server/api/admin/dictionaries/event-requirements/*` operują na `event_requirement_defaults` — to jest słownik (jeden wiersz per rola, `UNIQUE INDEX` na `role_id`), nie przypisania per-gala. `.find()`/singleton tam jest poprawny i nie ma nic wspólnego z tym bugiem.

### Pokrycie testami

Żaden istniejący test integracyjny nie sprawdza dwóch przypisań `type='event'` tej samej roli dla tej samej gali:
- `server/api/manager/assignments/assignments.boxer-conflict.integration.test.ts` — tylko `type='fight'`.
- `server/api/manager/events/events.publish-guard.integration.test.ts` (rozszerzony w fazie 4 `event-level-requirements-dictionary`) — nowy test dynamicznie wypełnia TYLKO wymagania walki, nie event-level, i sprawdza wyłącznie brak (nie obsadzenie count>1) na poziomie gali.

## Code References

- `app/pages/manager/events.vue:219-232` — `handleEventSlotChange`, brak `slotIndex`
- `app/pages/manager/events.vue:238-240` — `getEventSlotPersonId`, `.find()` zamiast `.filter()[slotIndex]`
- `app/pages/manager/events.vue:251-259` — `eventMissingRoles()`, poprawnie liczy wielość
- `app/pages/manager/events.vue:522-545` — template OBSŁUGA GALI, jeden `<select>` per rola
- `app/pages/manager/events.vue:205-217,234-236,490-509` — wzorzec multi-slot poziomu walki do skopiowania 1:1
- `server/api/manager/events/[id]/publish.post.ts:56-70` — generyczna walidacja, poprawnie obsługuje count>1
- `server/api/manager/events/[id].get.ts:51-59` — odczyt eventAssignments, poprawny
- `migrations/0001_init.sql:44-52` — schema `assignments`, brak UNIQUE blokującego multi-slot

## Architecture Insights

Wzorzec fight-level (`req.count` → `v-for="slotIdx in req.count"` → `getFightSlotPersonId(fight, role, slotIndex)`/`handleFightSlotChange(fight, role, slotIndex, personId)`) jest gotowym, sprawdzonym wzorcem do skopiowania 1:1 na poziom gali. Jedyna różnica: event-level nie ma odpowiednika `availableForFightSlot` (wykluczenie osoby już przypisanej do innego slotu tej samej roli) — trzeba by dodać analogiczną funkcję `availableForEventSlot(role, slotIndex)`, żeby uniknąć przypisania tej samej osoby do dwóch slotów Ratownika na tej samej gali.

## Historical Context (from prior changes)

- `context/changes/event-level-requirements-dictionary/plan.md:162` — Contract fazy 3 explicit scoped event-level UI na single-select ("dzisiejsze zachowanie" = zawsze count=1 dla Ratownik/Konferansjer w migracji seed), nie przewidując że słownik pozwala Adminowi na count>1. To jest gap w tamtym planie, nie w implementacji względem Contract — implementacja jest zgodna z Contractem, ale Contract nie pokrył tego przypadku.
- `context/changes/event-level-requirements-dictionary/plan.md` Progress 3.4-3.6 — manualna weryfikacja API potwierdziła dziedziczenie i walidację, ale NIE testowała scenariusza count>1 na poziomie gali (nie było to w scope Contractu).

## Open Questions

- Czy dodać `availableForEventSlot()` analogiczny do `availableForFightSlot()` (wykluczenie duplikatu osoby w dwóch slotach tej samej roli na gali) — rekomendowane dla symetrii, ale nie blokuje podstawowej naprawy.
- Czy dodać test integracyjny na dwa przypisania `type='event'` tej samej roli (backend już to wspiera, ale brak regresyjnego pokrycia).
