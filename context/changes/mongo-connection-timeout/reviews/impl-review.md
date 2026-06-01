<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Fix MongoDB connection hang on Workers

- **Plan**: context/changes/mongo-connection-timeout/plan.md
- **Scope**: Phase 1 of 1
- **Date**: 2026-05-29
- **Verdict**: APPROVED
- **Findings**: 0 critical | 3 warnings | 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Orphaned MongoClient not closed on connect failure

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: server/utils/db.ts:25-50
- **Detail**: W IIFE — `_client` jest przypisywany przed `await Promise.race(...)`. Gdy race rzuca (connect timeout), `_client` zostaje ustawiony ale `_db` jest null. Następne wywołanie getDb() tworzy nowego MongoClient nie zamykając poprzedniego.
- **Fix**: try/catch wokół Promise.race z `await _client.close().catch(() => {})` + `_client = null` przed re-throw.
- **Decision**: FIXED

### F2 — Raw error string w odpowiedzi 503 może wyciec URI/credentials

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: server/routes/healthz.get.ts:16
- **Detail**: `error: String(err)` — MongoDB driver może zawrzeć URI z hasłem w error message. Endpoint jest publiczny.
- **Fix A ⭐ Applied**: Usunięto pole `error` z odpowiedzi — {status, db: 'disconnected'}.
- **Decision**: FIXED via Fix A

### F3 — Plan opisuje error response jako {status, error}, implementacja ma db: 'disconnected'

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: plan.md — sekcja Contract
- **Detail**: Pre-existing pole `db: 'disconnected'` nie było w planie. Zaktualizowano kontrakt.
- **Fix**: Zaktualizowano plan.md.
- **Decision**: FIXED

### F4 — Trzy kopie stałej 4000ms bez shared constant

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: db.ts:28, db.ts:38, healthz.get.ts:9
- **Detail**: connectTimeoutMS, Promise.race timeout i ping timeout używają niezależnych wartości 4000.
- **Fix**: Wyeksportuj DB_TIMEOUT_MS z db.ts.
- **Decision**: SKIPPED

### F5 — checkServerIdentity bypass nieudokumentowany jako świadomy trade-off

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: server/utils/db.ts:32
- **Detail**: Komentarz nie zaznacza że to security trade-off wymagający usunięcia poza Workers.
- **Fix**: Dodaj // SECURITY: remove if running outside Workers.
- **Decision**: SKIPPED
