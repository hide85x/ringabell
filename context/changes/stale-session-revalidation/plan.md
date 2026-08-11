# Stale Session Revalidation — Implementation Plan

## Overview

Guardy `requireAdmin`/`requireManager`/`requirePersonel` ufają wyłącznie roli zapisanej w sesji przy logowaniu i nigdy nie sprawdzają ponownie tabeli `users`. Efekt: usunięcie konta albo zmiana roli nie unieważnia już aktywnej sesji — użytkownik działa ze starymi uprawnieniami dopóki się sam nie wyloguje. Dodajemy rewalidację per-request względem D1, `maxAge` jako dodatkową warstwę obrony, oraz spójne zachowanie po stronie klienta/SSR.

## Current State Analysis

- Wszystkie trzy guardy (`server/utils/admin-guard.ts`, `manager-guard.ts`, `personel-guard.ts`) mają identyczny wzorzec: `requireUserSession(event)` + porównanie stringów roli, zero zapytań do D1
- **31 endpointów** korzysta z tych guardów: 12× `requireAdmin`, 17× `requireManager`, 2× `requirePersonel`
- Sesja jest tworzona w trzech miejscach (`server/routes/auth/google.get.ts:17-24`, `server/api/auth/login.post.ts:22-29`, `server/routes/test-session.post.ts:17-24`) — `role` trafia do sesji jednorazowo, z pól `email`, `name`, `avatar`, `role` (brak `id`)
- Brak `maxAge` w konfiguracji sesji (`nuxt.config.ts`) — sesja jest dziś efektywnie bezterminowa
- `nuxt-auth-utils@0.5.29` nie ma server-side store — sealed cookie only; hook `sessionHooks.hook('fetch', ...)` istnieje, ale jest wołany tylko przez wbudowany `/api/_auth/session` (SSR/`useUserSession().fetch()`), **nie** przez `requireUserSession()` używany w guardach
- **Krytyczne dla testów**: `test-session.post.ts` tworzy sesje dla ról Admin/Manager/Personel z emailami `test-{role}@test.local`, bez odpowiadających rekordów w `users` — 36 istniejących testów integracyjnych korzysta z tego. Rewalidacja per-request bez dosianych fixture'ów złamałaby cały ten zestaw

### Key Discoveries

- To był świadomy, wielokrotnie potwierdzony trade-off, nie przeoczenie (`context/archive/2026-05-29-auth-scaffold/plan-brief.md:46`: *"Acceptable until F-02"*; `context/archive/2026-06-02-rbac-api-validation/research.md:169`: *"by design (no per-request DB lookup)"*) — pełne szczegóły w `context/changes/stale-session-revalidation/research.md`
- Case-insensitive dopasowanie email (`LOWER(email) = LOWER(?)`) było już wprowadzone w tej samej sesji roboczej dla `server/api/personel/events/*` (commit `fd7ef2a`) — rewalidacja powinna być spójna z tym wzorcem
- Wzorzec pluginu Nitro dla `sessionHooks`: `node_modules/nuxt-auth-utils/README.md:576-591` — `server/plugins/session.ts` z `defineNitroPlugin`
- `nuxt.config.ts` konfiguruje dziś tylko `auth.hash` (scrypt) — brak sekcji `runtimeConfig.session`; moduł czyta `maxAge` z `runtimeConfig.session.maxAge` (zweryfikowane w `node_modules/nuxt-auth-utils/dist/module.mjs:78-84`)

## Desired End State

- Każdy z 31 guardowanych endpointów odrzuca żądanie (401, sesja wyczyszczona) jeśli: (a) użytkownik o danym emailu już nie istnieje w `users`, (b) jego rola w `users` różni się od roli zapisanej w sesji, lub (c) samo zapytanie do D1 zawiedzie (fail-closed)
- Sesja wygasa najpóźniej po 24h (`maxAge`), niezależnie od rewalidacji per-request
- Po stronie klienta: odpowiedź 401 z dowolnego requestu czyści lokalny stan sesji i przekierowuje na `/`
- Stan sesji pokazywany w UI po SSR/odświeżeniu strony (`useUserSession()`) jest spójny z tym co wymuszają guardy — nie pokazuje "zalogowany jako X" dla unieważnionej sesji
- Cały istniejący zestaw testów integracyjnych (36 testów) nadal przechodzi, plus nowe dedykowane testy potwierdzające rewalidację

## What We're NOT Doing

- Brak dodania pola `id` do sesji — rewalidacja po `LOWER(email)`, spójnie z tym co sesja już ma
- Brak server-side store (KV/rejestr sesji) — D1 (już używane) wystarcza do zapytania per-request
- Brak proaktywnego odświeżania sesji przy każdej nawigacji klienta (`useUserSession().fetch()` w middleware) — poleganie na tym że kolejne żądanie API i tak dostanie 401
- Brak automatycznego testu mierzącego czas odpowiedzi (CPU/latency) — weryfikacja manualna przez `wrangler tail` po wdrożeniu
- Brak "cichej" synchronizacji roli w sesji przy niezgodności — każda niezgodność (usunięcie lub zmiana roli) czyści sesję i wymusza pełne ponowne logowanie, nie próbuje kontynuować z nową rolą

## Implementation Approach

Jedna wspólna funkcja rewalidująca w nowym `server/utils/session-guard.ts`, używana przez wszystkie trzy istniejące guardy (podmiana `requireUserSession` → `requireValidSession`) oraz przez nowy plugin Nitro (`sessionHooks.hook('fetch', ...)`) dla spójności UI. Trzy fazy: (1) rdzeń rewalidacji + fixture'y testowe, (2) spójność klienta/SSR, (3) dedykowane testy na jednorazowych kontach.

## Critical Implementation Details

**Jednolita reakcja na niezgodność** — zarówno "user nie istnieje" jak i "rola się różni" prowadzą do tego samego: `clearUserSession(event)` + 401. Nie ma gałęzi "po cichu zaktualizuj rolę i kontynuuj" — to celowa decyzja upraszczająca (patrz sekcja "What We're NOT Doing"), nie przeoczenie.

**Izolacja testów — nie dotykaj współdzielonych fixture'ów** — nowe testy w Phase 3 dowodzące rewalidacji (usunięcie/zmiana roli w trakcie aktywnej sesji) MUSZĄ tworzyć własne, jednorazowe konta przez `POST /api/admin/users` z unikalnym emailem (analogicznie do `users.protected-admin.integration.test.ts`), a nie modyfikować/usuwać współdzielone `test-admin@test.local`/`test-manager@test.local`/`test-personel@test.local` z `seed.sql`. Te dwa ostatnie są używane przez dziesiątki innych testów w całym zestawie (`maxForks: 1`, testy integracyjne dzielą tę samą lokalną bazę D1 przez cały przebieg `vitest run --project integration`) — usunięcie/zmiana ich roli w jednym pliku testowym zepsułaby testy w innych plikach uruchamianych później w tym samym przebiegu.

## Phase 1: Rdzeń rewalidacji + fixture'y testowe

### Overview

Wspólna funkcja rewalidująca sesję względem D1, podpięta pod wszystkie trzy guardy, plus `maxAge` i fixture'y potrzebne żeby istniejący zestaw testów przetrwał zmianę.

### Changes Required

#### 1. Wspólna funkcja rewalidacji

**File**: `server/utils/session-guard.ts`

**Intent**: Centralna, reużywalna logika sprawdzająca czy sesja nadal odpowiada rzeczywistemu stanowi w `users` — używana zarówno przez guardy API jak i (w Phase 2) przez `sessionHooks`.

**Contract**: Eksportuje dwie funkcje:
- `isSessionValid(session: UserSession, event: H3Event): Promise<boolean>` — `SELECT role FROM users WHERE LOWER(email) = LOWER(?)` po `session.user.email`; zwraca `true` tylko gdy rekord istnieje i `role` się zgadza; zwraca `false` (fail-closed) jeśli zapytanie rzuci wyjątek.
- `requireValidSession(event: H3Event): Promise<UserSession>` — woła `requireUserSession(event)`, następnie `isSessionValid`; jeśli `false` — `clearUserSession(event)` + `createError({ statusCode: 401, statusMessage: 'Session is no longer valid' })`. W przeciwnym razie zwraca sesję (ten sam kontrakt co dotychczasowe `requireUserSession`).

#### 2. Podpięcie guardów

**Files**: `server/utils/admin-guard.ts`, `server/utils/manager-guard.ts`, `server/utils/personel-guard.ts`

**Intent**: Każdy guard rewaliduje sesję przed sprawdzeniem roli, bez zmiany własnego kontraktu (sygnatura, kody błędów 403 dla złej roli bez zmian).

**Contract**: W każdym pliku podmiana `const session = await requireUserSession(event)` → `const session = await requireValidSession(event)`. Reszta logiki (porównanie roli → 403) bez zmian.

#### 3. `maxAge` sesji

**File**: `nuxt.config.ts`

**Intent**: Dodatkowa warstwa obrony — sesja wygasa najpóźniej po 24h niezależnie od rewalidacji per-request.

**Contract**: Dodaj `runtimeConfig: { session: { maxAge: 60 * 60 * 24 } }` (sekunda × godziny × 24). Nie dotyka istniejącego bloku `auth.hash`.

#### 4. Fixture'y testowe

**File**: `test/fixtures/seed.sql`

**Intent**: Dosiać rekordy `users` odpowiadające domyślnym emailom generowanym przez `test-session.post.ts`, żeby istniejący zestaw 36 testów integracyjnych nie zaczął dostawać 401 po wprowadzeniu rewalidacji.

**Contract**: Dodać po istniejącym bloku `DELETE FROM users WHERE email LIKE '%@test.local'` / `INSERT ... admin@test.local`, cztery nowe wiersze `INSERT INTO users`:
- `test-user-002`, `test-admin@test.local`, rola `Admin`
- `test-user-003`, `test-manager@test.local`, rola `Manager`
- `test-user-004`, `test-personel@test.local`, rola `Personel`
- `test-user-005`, `test-personel-empty@test.local`, rola `Personel` (używany przez istniejący test "no Person record" w `server/api/personel/events/events.integration.test.ts:28-35` — potrzebuje teraz też rekordu w `users`, mimo że celowo nie ma rekordu w `persons`)

Te wiersze są tylko odczytywane przez istniejące testy — żaden istniejący test ich nie modyfikuje/usuwa (patrz Critical Implementation Details).

### Success Criteria

#### Automated Verification

- TypeScript kompiluje się bez błędów: `npm run build`
- Lint przechodzi: `npm run lint`
- Cały istniejący zestaw testów integracyjnych nadal przechodzi (36 testów): `npm run test:integration`
- Unit testy przechodzą: `npm run test`

#### Manual Verification

- Zalogowany jako Admin, usuń własne konto przez inne okno/sesję Admina — pierwsze kolejne żądanie w oryginalnej sesji kończy się przekierowaniem/błędem, nie sukcesem
- Zmiana roli użytkownika w trakcie jego aktywnej sesji powoduje że kolejne żądanie tej sesji jest odrzucone (401), nie kontynuuje ze starą rolą

**Implementation Note**: Po ukończeniu tej fazy i przejściu automated verification — poczekaj na potwierdzenie manual verification przed przejściem do Phase 2.

---

## Phase 2: Spójność klienta i SSR

### Overview

Globalny handler 401 po stronie klienta + rejestracja `sessionHooks.hook('fetch', ...)` reużywająca `isSessionValid`, żeby stan UI po odświeżeniu strony był spójny z tym co wymuszają guardy.

### Changes Required

#### 1. Globalny handler 401 po stronie klienta

**File**: `app/plugins/session-guard.client.ts`

**Intent**: Gdy dowolne żądanie API zwróci 401 (np. bo rewalidacja odrzuciła sesję), czyścimy lokalny stan sesji i przekierowujemy na `/` zamiast zostawiać użytkownika w niespójnym stanie UI.

**Contract**: Plugin rejestruje globalną instancję `$fetch` (`$fetch.create({ onResponseError })`) — przy `response.status === 401` woła `clear()` z `useUserSession()`, następnie `navigateTo('/')`.

#### 2. `sessionHooks` dla spójności SSR/UI

**File**: `server/plugins/session.ts`

**Intent**: Wzorcowa integracja z `nuxt-auth-utils` (`node_modules/nuxt-auth-utils/README.md:576-591`) — ta sama reguła rewalidacji co w guardach, uruchamiana też przy odczycie sesji dla UI (`/api/_auth/session`, `useUserSession().fetch()`), żeby stan pokazywany po odświeżeniu strony nie pokazywał "zalogowany jako X" dla unieważnionej sesji.

**Contract**: `defineNitroPlugin(() => { sessionHooks.hook('fetch', async (session, event) => { if (!(await isSessionValid(session, event))) throw createError({ statusCode: 401, statusMessage: 'Session is no longer valid' }) }) })` — reużywa `isSessionValid` z `server/utils/session-guard.ts` (Phase 1), zero duplikacji logiki D1.

### Success Criteria

#### Automated Verification

- TypeScript kompiluje się bez błędów: `npm run build`
- Lint przechodzi: `npm run lint`

#### Manual Verification

- Po unieważnieniu sesji (usunięcie/zmiana roli) i próbie jakiejkolwiek akcji w UI — użytkownik zostaje przekierowany na `/`, nie widzi błędu w konsoli bez reakcji
- Odświeżenie strony (F5) z unieważnioną sesją nie pokazuje już starego stanu "zalogowany jako X" w `index.vue`

**Implementation Note**: Po ukończeniu tej fazy i przejściu automated verification — poczekaj na potwierdzenie manual verification przed przejściem do Phase 3.

---

## Phase 3: Dedykowane testy rewalidacji

### Overview

Nowe testy integracyjne na jednorazowych, dynamicznie tworzonych kontach potwierdzające że usunięcie/zmiana roli w trakcie aktywnej sesji rzeczywiście unieważnia tę sesję na kolejnym żądaniu — bez dotykania współdzielonych fixture'ów z Phase 1.

### Changes Required

#### 1. Testy rewalidacji sesji

**File**: `server/api/admin/users/users.session-revalidation.integration.test.ts`

**Intent**: Udowodnić end-to-end że mechanizm z Phase 1 rzeczywiście działa na żywym workerze, nie tylko w teorii — dla obu przypadków (usunięcie konta, zmiana roli).

**Contract**: Wzorzec: kopiuje strukturę `users.protected-admin.integration.test.ts` (tworzenie jednorazowego konta przez `POST /api/admin/users` z unikalnym emailem, pobranie jego `id` przez `GET /api/admin/users`). Test cases:
- Utwórz jednorazowe konto (rola `Manager`, unikalny email np. `test-revalidation-delete@test.local`). Zaloguj się jako ono (`getSession(worker, 'Manager', <email>)`). Potwierdź 200 na guardowanym endpoincie Managera. Usuń to konto przez `DELETE /api/admin/users/{id}` (sesją Admina). Powtórz to samo żądanie tą samą (niezmienioną) sesją jednorazowego konta → oczekuj 401.
- Analogicznie dla zmiany roli: utwórz jednorazowe konto (rola `Manager`), zaloguj się jako ono, potwierdź 200, zmień jego rolę przez `PATCH /api/admin/users/{id}` (na `Personel`), powtórz żądanie do endpointu Managera tą samą sesją → oczekuj 401 (nie 200 z nową rolą — patrz Critical Implementation Details, brak "cichej" synchronizacji).

### Success Criteria

#### Automated Verification

- Nowe testy przechodzą: `npm run test:integration`
- Cały zestaw (istniejące 36 + nowe) przechodzi bez regresji
- TypeScript kompiluje się bez błędów: `npm run build`

#### Manual Verification

- Po wdrożeniu na produkcję: `wrangler tail` podczas kilku żądań do guardowanego endpointu — czas odpowiedzi pozostaje w rozsądnych granicach (brak zauważalnego wzrostu opóźnienia wskazującego na przekroczenie limitu CPU Workers)
- Brak regresji w innych, niezwiązanych testach

**Implementation Note**: Po ukończeniu tej fazy i przejściu automated verification — poczekaj na potwierdzenie manual verification przed zakończeniem zmiany.

---

## Testing Strategy

### Integration Tests

- Rewalidacja: usunięcie konta w trakcie aktywnej sesji → 401 na kolejnym żądaniu
- Rewalidacja: zmiana roli w trakcie aktywnej sesji → 401 na kolejnym żądaniu (nie cicha synchronizacja)
- Regresja: cały istniejący zestaw 36 testów RBAC/walidacji nadal przechodzi z nowymi fixture'ami

### Manual Testing Steps

1. Zaloguj się jako Admin w jednej przeglądarce/oknie
2. W drugim oknie (Incognito), zaloguj się jako inny Admin i usuń konto z kroku 1
3. Wróć do pierwszego okna, spróbuj dowolnej akcji Admina → oczekuj przekierowania na `/`
4. Odśwież stronę (F5) w pierwszym oknie przed wykonaniem akcji → oczekuj że UI już nie pokazuje zalogowanego stanu
5. Powtórz analogicznie dla zmiany roli zamiast usunięcia

## Performance Considerations

Dodatkowy `SELECT` do D1 na każdy z 31 guardowanych requestów. D1 to SQLite in-process (brak TCP handshake) — inny profil kosztowy niż wcześniejsze problemy z MongoDB Atlas (`context/archive/2026-06-01-mongodb-to-d1/plan.md:5`), ale nigdy niemierzone w tym repo. Weryfikacja manualna przez `wrangler tail` po wdrożeniu (Phase 3, Manual Verification) — jeśli okaże się problemem, rozważyć cache'owanie wyniku per-request (nie per-sesja) żeby uniknąć podwójnego zapytania gdy guard i `sessionHooks.fetch` odpalają się w tym samym request-response cyklu.

## Migration Notes

Brak migracji schematu D1 — zmiana dotyczy wyłącznie logiki aplikacji i konfiguracji. `seed.sql` to fixture testowy, nie dotyczy produkcji.

## References

- Research: `context/changes/stale-session-revalidation/research.md`
- Wzorzec guard: `server/utils/admin-guard.ts`
- Wzorzec testu na jednorazowym koncie: `server/api/admin/users/users.protected-admin.integration.test.ts`
- Wzorzec pluginu `sessionHooks`: `node_modules/nuxt-auth-utils/README.md:576-591`
- Case-insensitive email pattern (spójność): `server/api/personel/events/index.get.ts` (commit `fd7ef2a`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Rdzeń rewalidacji + fixture'y testowe

#### Automated

- [x] 1.1 TypeScript kompiluje się bez błędów: `npm run build` — effb466
- [x] 1.2 Lint przechodzi: `npm run lint` — effb466
- [x] 1.3 Cały istniejący zestaw testów integracyjnych nadal przechodzi (36 testów) — zweryfikowane przez 9 niezależnych przebiegów per-plik (100% zielone każdy) z powodu wysokiego obciążenia maszyny (load avg 7.7) powodującego SQLITE_BUSY przy równoległym `npm run test:integration`; dodano retry w `isSessionValid` żeby złagodzić ten pre-existing problem test-harnessu — effb466
- [x] 1.4 Unit testy przechodzą: `npm run test` — effb466

#### Manual

- [x] 1.5 Usunięcie własnego konta Admina w trakcie aktywnej sesji odrzuca kolejne żądanie — effb466
- [x] 1.6 Zmiana roli w trakcie aktywnej sesji odrzuca kolejne żądanie — effb466

### Phase 2: Spójność klienta i SSR

#### Automated

- [x] 2.1 TypeScript kompiluje się bez błędów: `npm run build` — 164f79f
- [x] 2.2 Lint przechodzi: `npm run lint` — 164f79f

#### Manual

- [x] 2.3 Unieważniona sesja + akcja w UI → przekierowanie na `/` — 164f79f
- [x] 2.4 Odświeżenie strony (F5) z unieważnioną sesją nie pokazuje starego stanu zalogowania — 164f79f

### Phase 3: Dedykowane testy rewalidacji

#### Automated

- [x] 3.1 Nowe testy przechodzą: `npm run test:integration` — zweryfikowane per-plik (10/10 plików, 38/38 testów), plus 3x powtórzone bez re-seedowania żeby potwierdzić idempotentność nowego testu — 7e385cf
- [x] 3.2 TypeScript kompiluje się bez błędów: `npm run build` — 7e385cf

#### Manual

- [x] 3.3 `wrangler tail` po wdrożeniu — czas odpowiedzi bez zauważalnego wzrostu opóźnienia (70-210ms, głównie sieć) — 7e385cf
- [x] 3.4 Brak regresji w innych testach — 7e385cf
