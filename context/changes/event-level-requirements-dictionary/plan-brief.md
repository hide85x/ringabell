# Event-Level Requirements Dictionary — Plan Brief

> Full plan: `context/changes/event-level-requirements-dictionary/plan.md`

## What & Why

Role wymagane na poziomie gali (Ratownik, Konferansjer) są dziś zahardkodowane w 4 miejscach kodu (frontend Manager, backend walidacji publikacji) — w przeciwieństwie do ról per-walkę, które są w pełni sterowane słownikiem `fight_requirement_defaults`. Chcemy symetrii: nowy słownik "wymagania per gala", żeby Admin mógł to konfigurować bez zmiany kodu.

## Starting Point

Poziom walki już działa data-driven: `fight_requirement_defaults` (słownik) → auto-copy do `fight_requirements` przy tworzeniu walki → generyczna walidacja publikacji → dynamiczny formularz Managera. Poziom gali robi to samo, tylko na sztywno wpisane w kod (`app/pages/manager/events.vue:508,246-247`, `server/api/manager/events/[id]/publish.post.ts:57,66`).

## Desired End State

Admin zarządza wymaganiami per-gala w tym samym miejscu co per-walkę (druga kolumna w `dictionaries.vue`). Nowa gala automatycznie dostaje wymagania ze słownika. Formularz Managera i walidacja publikacji są generyczne — zero literałów ról w kodzie.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Backfill istniejących gal | Seed defaults (Ratownik:1, Konferansjer:1) + backfill wszystkich gal | Bez tego stare draft-gale straciłyby walidację przy publikacji — realna regresja | Plan |
| Układ Admin UI | Druga kolumna "MIN. NA GALĘ" w tej samej tabeli | Minimalny nowy UI, spójne z istniejącym wzorcem jednej strony na rolę | Plan |
| Architektura API | Osobne pliki `event-requirements/*` (kopia 1:1) | Zero ryzyka dla działającego kodu fight-level, zgodne z filozofią projektu (unikanie premature abstraction) | Plan |
| Testy | Dodać test "brak roli event-level blokuje publikację" | Ta walidacja nigdy nie miała testu integracyjnego, nawet w wersji hardkodowanej — zamykamy dziurę przy tej okazji | Plan |
| Zero wymagań event-level | Sekcja "OBSŁUGA GALI" po prostu się nie renderuje | Ten sam wzorzec co sekcja "WALKI" u Personelu — warunkowe renderowanie, zero nowej logiki | Plan |

## Scope

**In scope:**
- Nowe tabele `event_requirement_defaults` + `event_requirements` (migracja z backfillem)
- Admin API + UI dla nowego słownika
- Auto-copy przy tworzeniu gali, dynamiczne UI Managera, generyczna walidacja publikacji (frontend + backend)
- Test zamykający wcześniej odkrytą dziurę w pokryciu

**Out of scope:**
- Zmiany w logice poziomu walki (już działa)
- Generalizacja istniejących endpointów `requirements/*`
- FK na `assignments.role`
- Dedykowane testy CRUD dla nowych endpointów Admin API (konsekwentnie z brakiem takich testów dla fight-level)

## Architecture / Approach

Kopiowanie 1:1 już istniejącego, sprawdzonego wzorca fight-level (słownik → auto-copy → generyczna walidacja → dynamiczny UI), zamieniając tylko nazwę tabeli/kontekst na event-level. Jedyna prawdziwie nowa logika to migracja z backfillem dla danych historycznych.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Schemat + migracja | Nowe tabele, seed, backfill istniejących gal | Migracja musi sama zagwarantować istnienie ról Ratownik/Konferansjer (brak w seed.sql testowym) |
| 2. Admin — słownik | API + druga kolumna w UI | Brak — czysta kopia istniejącego wzorca |
| 3. Manager — auto-copy + UI + walidacja | Dynamiczne sloty, generyczna walidacja publikacji | Trzeba zachować identyczne komunikaty błędów co dziś, żeby nie zaskoczyć użytkownika |
| 4. Test | Zamknięcie dziury w pokryciu testów | Brak |

**Prerequisites:** Brak — bazuje wyłącznie na już istniejącym schemacie `fight_requirement_defaults`/`fight_requirements` jako wzorcu
**Estimated effort:** ~1-2 sesje, 4 fazy

## Open Risks & Assumptions

- Zakładamy że `'Ratownik'` i `'Konferansjer'` to jedyne role event-level dziś potrzebne — migracja seeduje właśnie te dwie, Admin może dodać/usunąć po fakcie
- Backfill zakłada że wszystkie istniejące gale (niezależnie od statusu) powinny dostać ten sam zestaw wymagań co dziś — nie ma mechanizmu "różne wymagania dla różnych starych gal"

## Success Criteria (Summary)

- Admin może dodać/zmienić/usunąć rolę wymaganą na poziomie gali bez zmiany kodu
- Publikacja gali bez wymaganych osób blokuje z tym samym komunikatem co dziś
- Stare gale (sprzed migracji) zachowują dokładnie to samo zachowanie walidacji co przed zmianą
