# Boxer Fight Conflict — Plan Brief

> Full plan: `context/changes/boxer-fight-conflict/plan.md`

## What & Why

Bokser nie powinien walczyć więcej niż raz na tej samej gali — to podstawowa reguła biznesowa boksu. Aktualna implementacja nie egzekwuje tej reguły: ta sama osoba może zostać przypisana jako Bokser do walki #1 i walki #2 tej samej gali.

## Starting Point

Funkcja `availableForFightSlot` w `app/pages/manager/events.vue:337-344` filtruje duplikaty tylko w obrębie jednej walki. Konflikt między galami jest obsługiwany przez `conflictingPersonIds` z backendu, ale brak analogicznego mechanizmu dla bokserów w tej samej gali.

## Desired End State

Bokser przypisany do walki #1 znika z dropdownu walki #2. Pozostałe role (sędzia, lekarz, itd.) nie są ograniczone — mogą obsługiwać wiele walk. Zmiana jest czysto frontendowa.

## Key Decisions Made

| Decision | Choice | Why (1 zdanie) |
|---|---|---|
| Zakres | Tylko frontend | Dane wszystkich walk są już w pamięci; brak potrzeby API call |
| Backend guard | Brak | Jednokrotna operacja managera, ochrona UI wystarcza dla MVP |
| Stare dane | Nie blokują publikacji | Nie psujemy istniejących gal w drafcie |
| UX | Ukryj z listy | Spójne z istniejącym wzorcem `takenIds` w tej samej walce |

## Scope

**In scope:** Blokada wyboru tego samego boksera w dwóch walkach tej samej gali w UI

**Out of scope:** Walidacja API, zmiana `canPublish`, wykrywanie istniejących duplikatów w DB

## Architecture / Approach

Jedna zmiana w `availableForFightSlot`: dla `role === 'Bokser'` zbieramy ID bokserów z pozostałych walk (`eventDetail.value.fights` filtrowane po `fight.id !== currentFight.id`) i dodajemy do `takenIds`. Zero nowych queries — dane już są w pamięci komponentu.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Frontend fix + testy | Bokser ukryty w dropdownie drugiej walki | Brak — zmiana trywialna |

**Prerequisites:** Brak  
**Estimated effort:** ~1 sesja

## Open Risks & Assumptions

- Zakłada że `role === 'Bokser'` to jedyna rola z ograniczeniem "raz na galę" — jeśli inne role będą miały to samo ograniczenie w przyszłości, wzorzec trzeba uogólnić

## Success Criteria (Summary)

- Bokser przypisany do walki #1 nie pojawia się w dropdownie walki #2
- Bokser nieprzypisany widoczny we wszystkich dropdownach
- `npm run build` bez błędów TypeScript
