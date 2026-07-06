# Personnel Schedule View — Plan Brief

> Full plan: `context/changes/personnel-schedule-view/plan.md`

## What & Why

Zalogowany personel nie ma gdzie zobaczyć swoich gal — brak stron i endpointów dla roli `Personel`. Budujemy read-only widok `/personel/schedule`: lista opublikowanych gal z przypisaniami + panel szczegółów per gala.

## Starting Point

Aplikacja ma kompletną warstwę S-04 (gale, walki, przypisania). Dane są w bazie — tabela `assignments` łączy osoby z galami. Brak czegokolwiek po stronie frontendu i API dla roli `Personel`; middleware `manager.ts` aktywnie blokuje ten ruch.

## Desired End State

Personel loguje się → przycisk "MOJE GALE →" na stronie głównej → lista opublikowanych gal z datą, miejscem i rolą → kliknięcie gali pokazuje szczegóły (role event-level + konkretne walki). Puste konto → czytelny empty state.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| User↔Person link | Email match | Brak `user_id` FK w persons, email dostępny z OAuth sesji | Plan |
| Statusy gal | Tylko published | Draft to niezatwierdzona obsada — nie informujemy personelu przedwcześnie | Plan |
| Historia | Wszystkie (past + upcoming) | Personel potrzebuje też archiwum przeszłych gal | Plan |
| Layout | Lista + detail panel | Pełna informacja w jednym widoku, wzorzec z manager/events.vue | Plan |
| Brak Person record | Empty state | Brak rekordu = brak gal; nie rzucamy błędu, tylko komunikat | Plan |
| Nawigacja | Nowy PersonelNav | Izolacja od Manager/Admin nav; wzorzec z ManagerNav.vue | Plan |
| Testy | RBAC + integration | Spójne z wzorcami testów już w projekcie | Plan |

## Scope

**In scope:**
- `GET /api/personel/events` — lista gal personelu (email match, tylko published)
- `GET /api/personel/events/[id]` — szczegóły gali (event roles + fight assignments)
- `app/pages/personel/schedule.vue` — widok listy + detali
- `app/middleware/personel.ts` — guard dla `/personel/*`
- Patch `index.vue` — przycisk "MOJE GALE →" dla Personel
- `PersonelNav.vue` — nawigacja
- RBAC + integration testy

**Out of scope:**
- S-05 emaile (osobny slice)
- Auto-redirect po logowaniu
- Filtrowanie/wyszukiwanie gal
- Edycja przypisań (read-only)

## Architecture / Approach

Nowa gałąź API `server/api/personel/events/` z dedykowanym guardem `personel-guard.ts`. Klucz powiązania: `persons.email = session.user.email`. SQL używa GROUP_CONCAT dla ról żeby uniknąć N+1 queries. Frontend: Nuxt page z `definePageMeta({ middleware: 'personel' })`, `useFetch` dla listy, `$fetch` dla detalu — wzorzec 1:1 z `manager/events.vue`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. API Layer | Guard + 2 endpointy z SQL email-match | GROUP_CONCAT SQL może nie zadziałać w D1 — fallback: 2 osobne queries |
| 2. Frontend | Middleware + nav + strona + patch index.vue | Styl PersonelNav musi pasować do istniejącej palety |
| 3. Tests | RBAC + integration | Seed data musi mieć Person z emailem pasującym do test usera |

**Prerequisites:** S-04 done (gale i przypisania w bazie) ✓  
**Estimated effort:** ~1-2 sesje, 3 fazy

## Open Risks & Assumptions

- `GROUP_CONCAT(DISTINCT ...)` — dostępne w D1 (SQLite 3.38+); jeśli nie — zastąpić dwoma oddzielnymi queries
- Email w `persons` musi być identyczny z emailem Google OAuth — wrażliwe na literówki (akceptowalne na MVP)
- Seed test data wymaga Person + User + published event + assignment z tym samym emailem

## Success Criteria (Summary)

- Personel może zalogować się i zobaczyć listę swoich opublikowanych gal
- Manager/Admin nie mogą wejść na `/personel/schedule`
- Testy RBAC i integration przechodzą
