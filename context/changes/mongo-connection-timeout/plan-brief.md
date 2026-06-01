# mongo-connection-timeout — Plan Brief

> Full plan: `context/changes/mongo-connection-timeout/plan.md`

## What & Why

`serverSelectionTimeoutMS` w MongoDB driver nie przerywa wiszącej operacji TCP na V8 isolates — Worker dostaje error 1101 ("hung") zamiast normalnego timeout error. Fix: `Promise.race` z natywnym `setTimeout` (Workers-safe) wokół `connect()` i `db.command({ ping: 1 })`.

## Starting Point

`server/utils/db.ts` używa `serverSelectionTimeoutMS: 5000` w opcjach MongoClient. Na Node.js działa. Na Workers V8 — nie przerywa wiszącej operacji sieciowej. `/healthz` intermittently zwraca error 1101 w produkcji.

## Desired End State

`GET /healthz` zawsze odpowiada w maks ~4.1s — sukces lub 503 z komunikatem o timeout. Żadnego error 1101.

## Key Decisions Made

| Decision | Choice | Why |
|---|---|---|
| Timeout mechanizm | Promise.race + setTimeout | setTimeout jest natywnym Workers API — niezawodny na V8 |
| Wartość timeout | 4000ms | Daje Atlasowi czas na odpowiedź, margines do 30s Workers wall-clock |
| Scope ochrony | connect() + db.command (ping) | Oba punkty wejścia mogą wisieć: cold start i stale connection |

## Scope

**In scope:** `server/utils/db.ts` (connect), `server/routes/healthz.get.ts` (ping)

**Out of scope:** Retry logic, inne route handlers, modele

## Architecture / Approach

Dwie chirurgiczne zmiany w istniejących plikach. Żadnych nowych plików. Wzorzec: `Promise.race([operation(), new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), 4000))])`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Add Promise.race timeout | /healthz zawsze odpowiada w <4.1s | Brak — wzorzec jest weryfikowany w produkcji |

**Prerequisites:** Działający deploy na Workers (`npx wrangler deploy` po `npm run build`)
**Estimated effort:** ~1 sesja, 1 faza

## Success Criteria (Summary)

- `npm run build` przechodzi
- `/healthz` nigdy nie rzuca error 1101
- `/healthz` zwraca 503 w <4.1s gdy Atlas niedostępny
