<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Stale Session Revalidation

- **Plan**: context/changes/stale-session-revalidation/plan.md
- **Scope**: Phase 1-3 (full plan)
- **Date**: 2026-08-11
- **Verdict**: REJECTED at review time → all findings triaged, 6/7 FIXED (deployed `c5e65ec`, F1 verified live on prod), 1 SKIPPED (F6, not worth it at current scale)
- **Findings**: 1 critical, 4 warnings, 2 observations

## Verdicts (at review time, before fixes)

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — sessionHooks 'fetch' rzuca 401 dla każdej anonimowej sesji

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: server/plugins/session.ts:2-6
- **Detail**: `Object.keys(session).length > 0` w `session.get.js` nuxt-auth-utils jest zawsze `true` (h3 zawsze przypisuje `session.id` nawet dla gościa), więc hook `'fetch'` odpala się dla KAŻDEJ sesji, nie tylko zalogowanej. `isSessionValid` zwraca `false` gdy `session.user` nie istnieje — hook rzuca 401. POTWIERDZONE NA PRODUKCJI: `curl https://ringabell.lukasz-pelc.workers.dev/api/_auth/session` (bez cookie) zwraca 401 "Session is no longer valid" zamiast oczekiwanego `200 {}`. Każdy anonimowy odwiedzający dostaje błąd na automatycznym fetchu sesji.
- **Fix**: Dodać `if (!session.user) return` na początku hooka — walidować tylko sesje, które faktycznie deklarują zalogowanego użytkownika.
- **Decision**: FIXED — early return gdy !session.user, deployed+verified na produkcji (c5e65ec)

### F2 — Client interceptor łapie każde 401, nie tylko z guardowanych endpointów

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: app/plugins/session-guard.client.ts:5
- **Detail**: Globalny `$fetch` interceptor robi `clear()`+`navigateTo('/')` na KAŻDYM 401 w aplikacji, nie tylko na tych z rewalidacji sesji. `/api/auth/login` zwraca 401 przy złym hasle — dziś niewidoczne (already on `/`), ale kruche na przyszłość.
- **Fix A ⭐ Recommended**: Zawęź interceptor do ścieżek `/api/admin`, `/api/manager`, `/api/personel` (guardowane prefiksy).
  - Strength: Precyzyjnie celuje w guardy, zero szansy na kolizję z przyszłymi biznesowymi 401.
  - Tradeoff: Trzeba pamiętać o dodaniu prefiksu przy nowych guardowanych obszarach.
  - Confidence: HIGH — prefiksy już są konwencją całego routingu API w tym projekcie.
  - Blind spot: Żaden — sprawdzone że wszystkie 31 guardowanych endpointów już żyją pod tymi 3 prefiksami.
- **Fix B**: Dedykowany kod błędu (np. custom header albo `data.code === 'SESSION_INVALID'`) zwracany tylko przez `requireValidSession`/hook, interceptor filtruje po nim.
  - Strength: Odporne nawet gdyby guardowany endpoint kiedyś żył pod innym prefiksem.
  - Tradeoff: Więcej zmian (trzeba dodać kod błędu w 2 miejscach: guard + hook).
  - Confidence: MEDIUM — nie sprawdzone jak `createError` propaguje custom `data` przez `$fetch` na kliencie w tym stacku.
  - Blind spot: Nie zweryfikowano czy Nitro/H3 przekazuje `data` z `createError` do klienta bez dodatkowej konfiguracji.
- **Decision**: FIXED via Fix A — zawężono interceptor do prefiksów /api/admin|manager|personel (c5e65ec)

### F3 — Retry w isSessionValid maskuje błędy logiczne bez logowania

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: server/utils/session-guard.ts:15-27
- **Detail**: Catch łapie wszystkie wyjątki (nie tylko przejściowe D1) i nic nie loguje przed `return false`. Realny błąd logiczny wygląda identycznie jak "user usunięty" — masowe wylogowanie bez śladu diagnostycznego, zwłaszcza że Sentry nie jest jeszcze podłączone.
- **Fix**: Dodać `console.error` w obu blokach catch przed `return false`.
- **Decision**: FIXED — console.error w obu catch (c5e65ec)

### F4 — sessionHooks nie czyści cookie przed 401, requireValidSession czyści

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: server/plugins/session.ts:4
- **Detail**: `requireValidSession` woła `clearUserSession` przed 401 (session-guard.ts:34), ale hook w `session.ts` nie — asymetria między dwoma ścieżkami reagującymi na to samo zdarzenie.
- **Fix**: Dodać `await clearUserSession(event)` w hooku przed `throw createError(...)`, dla symetrii z `requireValidSession`.
- **Decision**: FIXED — clearUserSession przed 401 w hooku (c5e65ec)

### F5 — Test "role change" nie czyści swojego throwaway usera na końcu

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: server/api/admin/users/users.session-revalidation.integration.test.ts:60-80
- **Detail**: Test "delete" czyści się przez samą naturę testu (usuwa konto). Test "role change" nie usuwa swojego throwaway konta na końcu — self-cleaning działa tylko przy NASTĘPNYM przebiegu tego pliku, nie w ramach jednego przebiegu.
- **Fix**: Dodać explicit `DELETE` na koniec testu "role change" (albo w `afterAll`) dla `test-revalidation-rolechange@test.local`.
- **Decision**: FIXED — explicit DELETE na końcu testu role change (c5e65ec)

### F6 — LOWER(email) nie może użyć istniejącego plain indexu

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: server/utils/session-guard.ts:6
- **Detail**: `idx_users_email` jest plain indexem na `email`, nie na wyrażeniu — `WHERE LOWER(email)=LOWER(?)` robi full table scan. Nieistotne przy dzisiejszej skali (5 kont), potencjalnie istotne przy dużym wzroście.
- **Fix**: `CREATE INDEX idx_users_email_lower ON users(LOWER(email))` — tylko jeśli tabela users kiedyś istotnie wzrośnie.
- **Decision**: SKIPPED — nieistotne przy dzisiejszej skali (5 kont)

### F7 — Retry logic nie był częścią formalnego Contract w planie

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/stale-session-revalidation/plan.md:63
- **Detail**: Retry (20ms + 1 ponowienie) dodany podczas implementacji Phase 1 jako reakcja na SQLITE_BUSY w testach, udokumentowany tylko w Progress note 1.3, nie w formalnym tekście "Contract" sekcji Phase 1.
- **Fix**: Dopisać wzmiankę o retry do Contract w treści planu, dla zgodności dokumentacji z kodem.
- **Decision**: FIXED — Contract w plan.md zaktualizowany o retry logic (c5e65ec)
