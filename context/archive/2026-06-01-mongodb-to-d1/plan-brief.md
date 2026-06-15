# MongoDB → Cloudflare D1 — Plan Brief

> Full plan: `context/changes/mongodb-to-d1/plan.md`

## What & Why

Każda operacja na MongoDB Atlas powoduje 5-6s opóźnienie lub Worker hang (Exception Thrown) z powodu CPU limitu 10ms na Cloudflare Workers free plan. TCP cold start do Atlas jest fundamentalnie niekompatybilny z serverless free tier. Cloudflare D1 (SQLite) jest natywne dla Workers — zero cold start, zero TCP.

## Starting Point

Projekt używa native MongoDB driver z connection pooling i TLS stubs. Baza na produkcji jest pusta. Nuxt.config.ts ma 7 MongoDB alias stubów. Wrangler.toml nie ma D1 binding.

## Desired End State

Login przez Google i credentials działa < 2s. Brak Exception Thrown w wrangler tail. `/healthz` pinguje D1. Cały kod MongoDB usunięty z projektu.

## Key Decisions Made

| Decision | Choice | Why |
|---|---|---|
| Query layer | Raw SQL (D1 API) | Zero zależności, spójne z CF docs |
| ID generation | crypto.randomUUID() | Natywne API Workers, zero deps |
| Migracja danych | Brak | Baza jest pusta |
| Schema apply | wrangler d1 migrations apply | Wbudowany toolchain, wersjonowanie |
| D1 access pattern | Helper getD1(event) | Jedna nazwa bindingu, łatwy do zmiany |
| MongoDB cleanup | Pełny | package.json, nuxt.config.ts, stubs |
| Fight requirements | Tabela fight_requirements + JOIN | SQLite nie ma tablic, JOIN serialize do array |
| Healthz | SELECT 1 | Najprostszy ping D1 |

## Scope

**In scope:** schema SQL, wrangler.toml D1 binding, getD1 helper, 5 modeli, 6 handlerów, healthz, usunięcie MongoDB

**Out of scope:** migracja danych, ORM, zmiana API shape, zmiana auth flow, S-02/S-03

## Architecture / Approach

Zamiast `MongoClient.connect()` (TCP, cold start) → `event.context.cloudflare.env.DB` (D1, in-process). Helper `getD1(event)` opakowuje dostęp do bindingu. Handlery używają `db.prepare(sql).bind(...).first()/.all()/.run()`. Schema w `migrations/0001_init.sql` aplikowana przez `wrangler d1 migrations apply`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Infrastructure | Schema SQL, wrangler.toml, usuniecie MongoDB | Build może się nie skompilować bez mongodb |
| 2. DB Layer | getD1 helper, typy modeli bez ObjectId | TypeScript errors w handlerach przed fazą 3 |
| 3. API Routes | 6 handlerów na D1 SQL | Fight requirements JOIN — złożone query |
| 4. Deploy | D1 na prod, deploy, smoke test | database_id musi być uzupełniony ręcznie |

**Prerequisites:** `nvm use 20`, dostęp do Cloudflare (wrangler zalogowany)
**Estimated effort:** ~1 sesja, 4 fazy

## Open Risks & Assumptions

- `event.context.cloudflare.env.DB` dostępne tylko przez `wrangler dev`, nie `nuxt dev` — lokalne testowanie wymaga wrangler
- `@cloudflare/workers-types` może nie być w devDependencies — sprawdzić przed fazą 2
- `wrangler.toml [[migrations]]` syntax dla D1 różni się od Durable Objects — zweryfikować przed deploy

## Success Criteria

- Login przez Google < 2s na produkcji, brak Exception Thrown w wrangler tail
- `curl /healthz` zwraca `{status: 'ok', db: 'connected'}`
- `npm run build` przechodzi bez żadnego importu z `mongodb`
