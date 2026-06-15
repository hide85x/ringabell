---
change_id: data-scaffold
phase_count: 3
---

## Overview

Install the native MongoDB driver, connect to Atlas, define TypeScript model interfaces for all five domain collections, and verify the connection via a `/healthz` endpoint. This is F-02 from the roadmap and is the prerequisite for every subsequent feature slice that reads or writes data.

## Current State Analysis

- `nuxt-auth-utils` is installed; Google OAuth and route protection from F-01 (auth-scaffold) are fully implemented.
- `nuxt.config.ts` has `modules: ['nuxt-auth-utils']` and `nitro: { preset: 'cloudflare-pages' }`.
- `wrangler.toml` has `name = "ringabell"`, `compatibility_date = "2026-05-25"`, `pages_build_output_dir = "dist"` — no `compatibility_flags` yet.
- `package.json` has no `mongodb` dependency.
- `server/` contains only `server/routes/auth/google.get.ts`.
- `app/types/auth.d.ts` declares the `User` interface with `role`.
- No database connection, no model files, no `/healthz` endpoint.

## Desired End State

- `mongodb` npm package is installed and available.
- `wrangler.toml` includes `compatibility_flags = ["nodejs_compat_v2"]` so the driver can use `node:net` and `node:tls` inside the Workers runtime.
- `nuxt.config.ts` exposes `runtimeConfig.mongodbUri` (private, server-only).
- `server/utils/db.ts` exports a `getDb()` singleton that connects to Atlas.
- Five model interface files exist under `server/models/`, each exporting a typed interface and a collection name constant.
- `GET /healthz` returns `{ status: 'ok', db: 'connected', timestamp: '...' }` when Atlas is reachable.
- `npm run build` passes with no TypeScript errors after all three phases.

## What We're NOT Doing

- **No Mongoose** — incompatible with Cloudflare Workers V8 isolates; native `mongodb` driver is used instead.
- **No Zod / runtime validation** — TypeScript interfaces only; validation comes with API endpoints in S-01+.
- **No indexes** — add in S-01 when query patterns are known.
- **No migrations** — schema-less MongoDB; fields are added as needed.
- **No seeding / fixtures** — not needed for connection scaffolding.

## Implementation Approach

Phase 1 puts the driver in place and wires up the connection singleton. Phase 2 defines the TypeScript shape of every domain collection so all subsequent route handlers have a type-safe contract to work against. Phase 3 exposes a lightweight health endpoint that exercises the real Atlas connection, providing a fast feedback loop during development and a smoke test after every deploy.

### Critical Implementation Details

1. **`nodejs_compat_v2` is required** in `wrangler.toml`. Without it, the MongoDB driver cannot resolve `node:net` or `node:tls` inside the Workers runtime, and the connection fails silently. This flag must be present before the first `wrangler deploy`.

2. **`BoxingEvent` not `Event`** — the name `Event` collides with the browser's global `Event` type in a Nuxt project. The model interface and its collection constant must use `BoxingEvent` / `EVENTS_COLLECTION`.

3. **`getDb()` config pattern** — `useRuntimeConfig()` is not available at module initialisation time in `server/utils/`. The function must accept an optional config parameter and fall back to `process.env.MONGODB_URI`. Calling code (route handlers) passes `useRuntimeConfig(event)` when available; the health endpoint demonstrates this pattern.

---

## Phase 1: Driver installation + Atlas connection

### Changes Required

- **Install `mongodb` npm package** — run `npm install mongodb`. No other driver is needed.

- **`wrangler.toml`** (update)
  - Add `compatibility_flags = ["nodejs_compat_v2"]` so `node:net` and `node:tls` are available inside the Workers runtime.

- **`nuxt.config.ts`** (update)
  - Add `runtimeConfig: { mongodbUri: '' }`. Private (server-only). `getDb()` reads the URI via `config?.mongodbUri || process.env.MONGODB_URI`; `MONGODB_URI` in `.env` feeds the `process.env` fallback path. (Nuxt's own runtimeConfig auto-mapping requires a `NUXT_` prefix — `NUXT_MONGODB_URI` — not used here.)

- **`server/utils/db.ts`** (new)
  - Export async `getDb(config?: { mongodbUri?: string }): Promise<Db>`.
  - Singleton pattern: one `MongoClient` is reused across requests; store the client and resolved db in module-level variables.
  - URI resolution: `config?.mongodbUri || process.env.MONGODB_URI`. Throw a descriptive error if neither is set.
  - Client options: `{ maxPoolSize: 1, serverSelectionTimeoutMS: 5000 }`.
  - Database name: parse from the URI path, or default to `'ringabell'`.

- **`.env.example`** — already has `MONGODB_URI=mongodb+srv://...` from F-00 scaffold. No change needed.

- **`CLAUDE.md`** (update)
  - Line 14: change "MongoDB via mongoose — **not yet installed**, add post-scaffold" → "MongoDB via native `mongodb` driver".
  - Line 3: change "Deploy target: Vercel" → "Deploy target: Cloudflare Pages".
  - "Known gaps" section: remove "MongoDB/mongoose not yet installed" and "nuxt-auth-utils not yet installed" (both are now resolved).

### Success Criteria

#### Automated

- `npm run build` passes — `mongodb` is in `node_modules`, `wrangler.toml` is valid, `nuxt.config.ts` compiles cleanly.

#### Manual

- `npm run dev` starts without errors in the terminal.
- `MONGODB_URI` is set in `.env` with a valid Atlas connection string. The connection will be fully exercised in Phase 3 via `/healthz`.
- `CLAUDE.md` updated — no references to Mongoose or Vercel remain.

---

## Phase 2: TypeScript model interfaces

### Changes Required

- **`server/models/user.ts`** (new)
  - Export interface `User`: `_id?: ObjectId, email: string, name: string, avatar: string, role: 'Admin' | 'Manager' | 'Personel', createdAt: Date`.
  - Export `USERS_COLLECTION = 'users'` as a `const`.

- **`server/models/person.ts`** (new)
  - Export interface `Person`: `_id?: ObjectId, name: string, email?: string, phone?: string, roles: string[], isActive: boolean, createdAt: Date`.
  - Export `PERSONS_COLLECTION = 'persons'` as a `const`.

- **`server/models/event.ts`** (new)
  - Export interface `BoxingEvent`: `_id?: ObjectId, name: string, date: Date, venue: string, status: 'draft' | 'published' | 'cancelled', createdAt: Date, updatedAt: Date`.
  - Export `EVENTS_COLLECTION = 'events'` as a `const`.
  - Note: the name `BoxingEvent` (not `Event`) is intentional — `Event` collides with the DOM global.

- **`server/models/fight.ts`** (new)
  - Export interface `Fight`: `_id?: ObjectId, eventId: ObjectId, orderNumber: number, requirements: Array<{ role: string, count: number }>, createdAt: Date`.
  - Export `FIGHTS_COLLECTION = 'fights'` as a `const`.

- **`server/models/assignment.ts`** (new)
  - Export interface `Assignment`: `_id?: ObjectId, personId: ObjectId, type: 'fight' | 'event', fightId?: ObjectId, eventId?: ObjectId, role: string, createdAt: Date`.
  - Export `ASSIGNMENTS_COLLECTION = 'assignments'` as a `const`.

Note: `createdAt` and `updatedAt` fields should be populated using `nowUtc()` from `utils/date.ts` in actual write operations, not hardcoded in the interface definition.

### Success Criteria

#### Automated

- `npm run build` passes — all five model files compile without TypeScript errors.

#### Manual

- Review each interface: verify field names, types, and optional markers match the spec above.
- Confirm each file exports its collection constant.

---

## Phase 3: /healthz endpoint

### Changes Required

- **`server/routes/healthz.get.ts`** (new)
  - Export a Nitro event handler (`defineEventHandler`).
  - Retrieve runtime config: `const config = useRuntimeConfig(event)`.
  - Call `getDb({ mongodbUri: config.mongodbUri })` inside a `try/catch`.
  - On success: run `await db.command({ ping: 1 })`, return `{ status: 'ok', db: 'connected', timestamp: new Date().toISOString() }` with HTTP 200.
  - On failure: return `{ status: 'error', db: 'disconnected', error: String(err) }` with HTTP 503 via `setResponseStatus(event, 503)`.

### Success Criteria

#### Automated

- `npm run build` passes after the endpoint file is added.

#### Manual

- With `npm run dev` running and a valid `MONGODB_URI` in `.env`: `curl http://localhost:3000/healthz` returns `{"status":"ok","db":"connected","timestamp":"..."}`.
- Deploy to Cloudflare Pages preview; `curl https://<preview>.pages.dev/healthz` returns the same response.

---

## Testing Strategy

No automated test runner is configured for this project yet. Verification relies on:

1. `npm run build` as a TypeScript compilation gate after each phase.
2. Manual `curl` or browser smoke tests against `npm run dev` (localhost:3000).
3. Cloudflare Pages preview deploy + `curl` against the preview URL for the final end-to-end check.
4. `wrangler pages deployment tail` for inspecting live logs if the preview endpoint returns an unexpected error.

---

## References

- MongoDB Node.js driver docs: https://www.mongodb.com/docs/drivers/node/current/
- Cloudflare Workers `nodejs_compat_v2` flag: https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- Nuxt `runtimeConfig` docs: https://nuxt.com/docs/guide/going-further/runtime-config
- `context/foundation/roadmap.md` §F-02
- `context/foundation/lessons.md` — `nowUtc()` rule

---

## Progress

### Phase 1: Driver installation + Atlas connection

#### Automated
- [x] 1.1 `npm run build` passes — `mongodb` in `node_modules`, `wrangler.toml` valid, `nuxt.config.ts` compiles cleanly — 5b1deb2

#### Manual
- [x] 1.2 `npm run dev` starts without errors — 5b1deb2
- [x] 1.3 `MONGODB_URI` is set in `.env`; Phase 3 healthz verifies the connection end-to-end — 5b1deb2
- [x] 1.4 `CLAUDE.md` updated — no references to Mongoose or Vercel remain — 5b1deb2

### Phase 2: TypeScript model interfaces

#### Automated
- [x] 2.1 `npm run build` passes — all five model files compile without TypeScript errors — d14860b

#### Manual
- [x] 2.2 Each interface has correct fields and optional markers — d14860b
- [x] 2.3 Each file exports its collection name constant — d14860b

### Phase 3: /healthz endpoint

#### Automated
- [x] 3.1 `npm run build` passes after endpoint file is added — b5396b1

#### Manual
- [x] 3.2 `curl http://localhost:3000/healthz` → `{"status":"ok","db":"connected","timestamp":"..."}` (dev server) — b5396b1
- [x] 3.3 `curl https://<preview>.pages.dev/healthz` → BLOCKED: MongoDB SCRAM-SHA-1 requires node:crypto which Nitro/unenv polyfills incorrectly on Cloudflare Pages M0. Infrastructure blocker — tracked as separate change `cloudflare-migration`. — b5396b1
