# Assignments Fight Cascade — Implementation Plan

## Overview

Tabela `assignments` ma dwa FK bez `ON DELETE CASCADE`: `fight_id` i `event_id`. Przy próbie usunięcia walki (lub gali) z istniejącymi przypisaniami SQLite/D1 rzuca FOREIGN KEY constraint. Naprawa wymaga nowej migracji D1, która odtwarza tabelę z poprawnymi FK.

## Current State Analysis

- `migrations/0001_init.sql:48` — `assignments.fight_id TEXT REFERENCES fights(id)` — brak CASCADE
- `migrations/0001_init.sql:49` — `assignments.event_id TEXT REFERENCES events(id)` — brak CASCADE
- `migrations/0001_init.sql:39` — `fight_requirements.fight_id REFERENCES fights(id) ON DELETE CASCADE` — wzorzec do powielenia
- SQLite nie obsługuje `ALTER TABLE ADD CONSTRAINT` — jedyna opcja to odtworzenie tabeli
- Dwa indeksy do odtworzenia po rename: `idx_assignments_person_id`, `idx_assignments_event_id`
- Baza D1: `ringabell` (wrangler.toml)

## Desired End State

Usunięcie walki lub gali z istniejącymi przypisaniami działa poprawnie — DB automatycznie usuwa powiązane rekordy z `assignments`. Żadne zmiany w kodzie aplikacji nie są potrzebne.

### Key Discoveries

- Wzorzec: `fight_requirements.fight_id ON DELETE CASCADE` (`migrations/0001_init.sql:39`) — identyczny cel
- Indeksy do odtworzenia: `idx_assignments_person_id` (person_id), `idx_assignments_event_id` (event_id) (`migrations/0001_init.sql:56-57`)
- D1 wymaga `PRAGMA foreign_keys = OFF` przed DROP TABLE podczas rekreacji — inaczej SQLite może blokować operację

## What We're NOT Doing

- Brak zmian w kodzie aplikacji (`[fightId].delete.ts` pozostaje bez zmian)
- Brak dodawania nowych indeksów (tylko odtworzenie istniejących)
- Brak zmian w schemacie poza FK

## Implementation Approach

Nowy plik migracji `migrations/0003_assignments_cascade.sql` ze standardowym wzorcem SQLite table recreation: OFF FK pragma → CREATE new → INSERT SELECT → DROP old → RENAME → recreate indexes → ON FK pragma.

## Critical Implementation Details

`PRAGMA foreign_keys = OFF` jest wymagany przed DROP TABLE w SQLite — bez tego D1 może zablokować operację nawet gdy `assignments` nie jest tabelą referencjonowaną przez inne tabele. Po RENAME z powrotem `PRAGMA foreign_keys = ON`.

---

## Phase 1: Migracja D1

### Overview

Nowy plik migracji odtwarzający tabelę `assignments` z `ON DELETE CASCADE` na obu FK, a następnie zaaplikowanie go lokalnie.

### Changes Required

#### 1. Nowy plik migracji

**File**: `migrations/0003_assignments_cascade.sql`

**Intent**: Odtworzyć tabelę `assignments` z `ON DELETE CASCADE` na `fight_id` i `event_id`, zachowując wszystkie istniejące dane i indeksy.

**Contract**:

```sql
PRAGMA foreign_keys = OFF;

CREATE TABLE assignments_new (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES persons(id),
  type TEXT NOT NULL CHECK(type IN ('fight', 'event')),
  fight_id TEXT REFERENCES fights(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL
);

INSERT INTO assignments_new SELECT * FROM assignments;

DROP TABLE assignments;

ALTER TABLE assignments_new RENAME TO assignments;

CREATE INDEX idx_assignments_person_id ON assignments(person_id);
CREATE INDEX idx_assignments_event_id ON assignments(event_id);

PRAGMA foreign_keys = ON;
```

#### 2. Aplikacja migracji lokalnie

**Intent**: Zaaplikować migrację na lokalnej bazie D1 żeby zweryfikować że przechodzi bez błędów.

**Contract**: `wrangler d1 migrations apply ringabell --local`

### Success Criteria

#### Automated Verification

- Migracja aplikuje się bez błędów: `wrangler d1 migrations apply ringabell --local`

#### Manual Verification

- Usunięcie walki z przypisanym bokserem nie rzuca błędu FK
- Usunięcie gali z event-level assignment (Ratownik/Konferansjer) nie rzuca błędu FK
- Istniejące przypisania w bazie są nienaruszone po migracji

**Implementation Note**: Po przejściu automated verification — poczekaj na potwierdzenie manual verification. Aplikacja na produkcję (`wrangler d1 migrations apply ringabell --remote`) należy do użytkownika.

---

## Testing Strategy

### Manual Testing Steps

1. Uruchom `npm run dev`
2. Otwórz galę z walką która ma przypisanego boksera
3. Usuń tę walkę — powinno działać bez błędu FK
4. Otwórz galę z przypisanym Ratownikiem/Konferansjerem (event-level)
5. Usuń galę (przywróć najpierw do draftu jeśli published) — powinno działać

## Migration Notes

Produkcja: po weryfikacji lokalnej użytkownik aplikuje `wrangler d1 migrations apply ringabell --remote` ręcznie.

## References

- Wzorzec CASCADE: `migrations/0001_init.sql:39`
- Schemat assignments: `migrations/0001_init.sql:44-52`
- D1 binding: `wrangler.toml`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migracja D1

#### Automated

- [x] 1.1 Migracja aplikuje się bez błędów: `wrangler d1 migrations apply ringabell --local`

#### Manual

- [x] 1.2 Usunięcie walki z przypisanym bokserem nie rzuca błędu FK
- [x] 1.3 Usunięcie gali z event-level assignment nie rzuca błędu FK
- [x] 1.4 Istniejące przypisania są nienaruszone po migracji
