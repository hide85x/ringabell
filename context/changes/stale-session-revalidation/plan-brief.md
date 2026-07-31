# Stale Session Revalidation — Plan Brief

> Full plan: `context/changes/stale-session-revalidation/plan.md`
> Research: `context/changes/stale-session-revalidation/research.md`

## What & Why

Będąc zalogowanym jako Admin, można usunąć samo siebie (albo mieć zmienioną rolę przez innego Admina) i dalej działać ze starymi uprawnieniami dopóki się nie wylogujesz ręcznie — sesja nigdy nie jest rewalidowana względem bazy. To był świadomy trade-off z początku projektu ("acceptable until F-02"), nigdy niedomknięty mimo zidentyfikowanego ryzyka w test-plan.md.

## Starting Point

Trzy guardy (`requireAdmin`/`requireManager`/`requirePersonel`) chronią 31 endpointów, wszystkie sprawdzają wyłącznie rolę zamrożoną w sesji przy logowaniu, zero zapytań do D1. Sesja jest dziś efektywnie bezterminowa (brak `maxAge`). `nuxt-auth-utils` nie ma server-side store — sealed cookie only.

## Desired End State

Każdy guardowany request rewaliduje sesję względem `users` (po emailu, case-insensitive) — usunięte konto lub zmieniona rola odrzuca kolejne żądanie (401 + wyczyszczona sesja), zamiast czekać na wylogowanie. Sesja dodatkowo wygasa po 24h. UI po stronie klienta reaguje na 401 przekierowaniem, a stan po SSR/odświeżeniu jest spójny z tą samą regułą.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Klucz rewalidacji | Email (`LOWER()`), nie `id` | Sesja już ma email; zero zmian w 3 miejscach logowania; spójne z case-insensitive fixem z tej samej sesji roboczej | Plan |
| Zachowanie przy błędzie D1 | Fail-closed (401) | Niepewny stan = brak dostępu, bezpieczniejsze dla RBAC niż fail-open | Plan |
| Niezgodność roli | Zawsze pełne wylogowanie (401), bez cichej synchronizacji | Prostsze, audytowalne, ten sam kod co "user usunięty" | Plan |
| Testy istniejącego zestawu | Dosiać 4 rekordy `users` w `seed.sql` | 36 istniejących testów używa fałszywych emaili bez rekordu w DB — bez fixture'ów wszystkie dostałyby 401 | Plan |
| Nowe testy rewalidacji | Jednorazowe konta tworzone w teście, nie modyfikacja współdzielonych fixture'ów | `maxForks: 1` — usunięcie/zmiana współdzielonego test-user zepsułaby inne pliki testowe w tym samym przebiegu | Plan |
| `maxAge` | Tak, 24h | Tania druga warstwa obrony niezależna od rewalidacji per-request | Plan |
| Client UX | Pasywnie — 401 → globalny interceptor → redirect | Prostsze niż proaktywny refetch sesji przy każdej nawigacji, wystarczające | Plan |
| `sessionHooks.fetch` | Tak, w tym samym planie | Reużywa tę samą funkcję co guardy, zero dodatkowej logiki D1 | Plan |
| Weryfikacja wydajności | Manualnie przez `wrangler tail` po wdrożeniu | Lokalny miniflare nie odzwierciedla realnego limitu CPU produkcyjnego Workera | Plan |

## Scope

**In scope:**
- Wspólna funkcja rewalidacji (`server/utils/session-guard.ts`) używana przez wszystkie 3 guardy
- `maxAge: 24h` w konfiguracji sesji
- Fixture'y testowe dla istniejącego zestawu + nowe dedykowane testy rewalidacji
- Client-side 401 interceptor + `sessionHooks.hook('fetch', ...)` dla spójności SSR/UI

**Out of scope:**
- Dodanie `id` do sesji
- Server-side store (KV/rejestr sesji) — D1 wystarcza
- Proaktywny refetch sesji przy każdej nawigacji klienta
- Automatyczny test mierzący CPU/latency

## Architecture / Approach

Jedna funkcja `isSessionValid(session, event)` (SELECT do D1 + porównanie roli) opakowana w `requireValidSession(event)` dla guardów. Ta sama funkcja reużyta w `sessionHooks.hook('fetch', ...)` (Nitro plugin) dla spójności UI. Zero duplikacji logiki D1 między dwoma miejscami integracji.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Rdzeń rewalidacji | Wspólna funkcja + 3 guardy + maxAge + fixture'y testowe | Fixture'y muszą pokryć WSZYSTKIE domyślne emaile z test-session.post.ts, inaczej masowa regresja testów |
| 2. Klient/SSR | 401 interceptor + sessionHooks | Brak — czysto addytywne, nie zmienia logiki bezpieczeństwa |
| 3. Testy dedykowane | Dowód end-to-end na jednorazowych kontach | Test musi NIE dotykać współdzielonych fixture'ów (test pollution) |

**Prerequisites:** Brak — bazuje na już istniejącej tabeli `users` i guardach
**Estimated effort:** ~1-2 sesje, 3 fazy

## Open Risks & Assumptions

- Koszt dodatkowego `SELECT` do D1 per request nigdy niemierzony w tym repo — weryfikacja manualna po wdrożeniu (Phase 3), nie blokuje implementacji
- Zakładamy że `session.user.email` zawsze jest ustawiony poprawnie przy tworzeniu sesji (potwierdzone we wszystkich 3 miejscach logowania)

## Success Criteria (Summary)

- Usunięcie lub zmiana roli konta w trakcie aktywnej sesji odrzuca kolejne żądanie (401), zamiast czekać na ręczne wylogowanie
- Cały istniejący zestaw testów (36) nadal przechodzi, plus nowe testy dowodzące rewalidacji
- UI reaguje na unieważnioną sesję przekierowaniem, nie zostawia użytkownika w niespójnym stanie
