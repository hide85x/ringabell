# Assignments Fight Cascade — Plan Brief

> Full plan: `context/changes/assignments-fight-cascade/plan.md`

## What & Why

Usunięcie walki lub gali z przypisanym personelem rzuca FOREIGN KEY constraint — D1 blokuje DELETE bo `assignments.fight_id` i `assignments.event_id` nie mają `ON DELETE CASCADE`.

## Starting Point

`migrations/0001_init.sql` definiuje tabelę `assignments` z FK bez CASCADE. Wzorzec CASCADE istnieje w tej samej migracji dla `fight_requirements.fight_id` — po prostu nie został zastosowany do `assignments`.

## Desired End State

Usunięcie walki lub gali automatycznie kaskaduje do `assignments`. Żadne zmiany w kodzie aplikacji nie są potrzebne — DB obsługuje to samo.

## Key Decisions Made

| Decision | Choice | Why |
|---|---|---|
| Podejście | Nowa migracja D1 | Fix na poziomie DB jest trwały i nie wymaga pamiętania o kaskadzie w każdym miejscu kodu |
| Zakres FK | Oba — fight_id i event_id | Oba mają ten sam problem; koszt naprawy obu jest identyczny |

## Scope

**In scope:** Nowa migracja odtwarzająca `assignments` z `ON DELETE CASCADE` na obu FK

**Out of scope:** Zmiany w kodzie aplikacji, nowe indeksy, zmiany w innych tabelach

## Architecture / Approach

SQLite nie obsługuje `ALTER TABLE ADD CONSTRAINT`. Wzorzec: CREATE new table → INSERT SELECT → DROP old → RENAME → recreate indexes. Jeden plik migracji, zero zmian w kodzie.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Migracja D1 | assignments z poprawnym CASCADE, lokalna weryfikacja | PRAGMA foreign_keys OFF/ON wymagane wokół DROP |

**Prerequisites:** Brak  
**Estimated effort:** ~30 minut

## Open Risks & Assumptions

- Produkcja: użytkownik aplikuje migrację ręcznie (`--remote`) po lokalnej weryfikacji

## Success Criteria (Summary)

- Migracja przechodzi bez błędów lokalnie
- Usunięcie walki/gali z przypisaniami działa bez błędu FK
