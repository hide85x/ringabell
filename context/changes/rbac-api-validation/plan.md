# RBAC and API Input Validation — Integration Tests Implementation Plan

## Overview

Write integration tests covering Risk #3 (RBAC middleware) and Risk #4 (server-side input validation) from Phase 2 of `test-plan.md`. Tests run via `unstable_dev` (real HTTP against the built Nuxt/Workers app) in a Node.js vitest pool, with sessions created through a test-only endpoint gated by `NUXT_TEST_MODE=1`.

## Current State Analysis

No integration tests exist. `utils/date.test.ts` (unit, cloudflarePool) is the only test file. The vitest config is a single-pool setup (`cloudflarePool`). `unstable_dev` is available in `wrangler@4.96.0`.

The target endpoints are fully implemented:
- `requireAdmin()` in `server/utils/admin-guard.ts:1-7` — per-route, all 12 admin endpoints
- `PATCH /api/admin/users/:id` — validates role against `VALID_ROLES` (explicit manual check, lines 8-10), marked untested in `admin-user-management/change.md`
- `POST /api/admin/users` — validates email format + role (lines 9-14), marked untested in same change

Sessions are sealed by `nuxt-auth-utils` / `h3` using `NUXT_SESSION_PASSWORD`. No per-request DB lookup — role lives in the cookie.

D1 schema (`users` table) from `migrations/0001_init.sql`: `id, email, name, avatar, role, password_hash (nullable), created_at`.

## Desired End State

After this plan:
- `npm run test` runs unit tests (cloudflarePool, fast, no build required) — still 2 passing
- `npm run test:integration` builds the app then runs integration tests against `unstable_dev`
- 5 integration tests pass: 3 RBAC + 2 validation
- `test-plan.md §6.2, §6.3, §6.4` are filled; Phase 2 status → complete

### Key Discoveries

- `server/utils/admin-guard.ts:1-7` — 7-line guard: 401 if no session, 403 if `role !== 'Admin'`
- Session uses `h3`'s `useSession` sealed with `NUXT_SESSION_PASSWORD`; role set once at login, never re-checked against DB
- `process.env.NUXT_SESSION_PASSWORD` is read by `nuxt-auth-utils` at first session access — must be set in `unstable_dev` vars
- `PATCH /api/admin/users/[id].patch.ts` and `POST /api/admin/users/index.post.ts` are explicitly flagged as untested in `admin-user-management/change.md:14-17`
- `unstable_dev` reads `main` from `wrangler.toml` → `.output/server/index.mjs`; requires `nuxi build` first
- D1 local state at `.wrangler/state/v3/d1/` — migrations must be applied before seeding

## What We're NOT Doing

- Tests against all 12 admin endpoints — guard is shared; 1 representative endpoint is sufficient
- Manager CRUD endpoints (events, fights, assignments) — don't exist yet (S-03+)
- Personel endpoint tests — no Personel-facing API exists yet
- Zod migration — project decision (manual inline validation)
- CI wiring — Phase 4 of test-plan rollout
- Password-based login flow — test sessions bypass auth, no password seeding needed
- e2e tests — not warranted at this HTTP signal cost

## Implementation Approach

Two vitest pools in one config: `cloudflarePool` for `*.test.ts` (unit, Workers V8), `forks` pool for `*.integration.test.ts` (Node.js, `unstable_dev`). A test-only route creates session cookies without touching auth logic. D1 is seeded once per test run via `wrangler d1 execute --local`.

## Critical Implementation Details

**`projects` API, not `poolMatchGlobs`**: `cloudflarePool` returns a `PoolRunnerInitializer` — not a string pool name — so it cannot be used in `poolMatchGlobs`. Use the vitest 4.x `projects` array in `vitest.config.ts` instead, with two inline project configs. If inline projects don't support custom pool runners, fall back to `projects: ['vitest.unit.config.ts', 'vitest.integration.config.ts']` (two separate files).

**`unstable_dev` requires a built output**: `wrangler.toml` `main = ".output/server/index.mjs"`. `test:integration` must run `nuxi build` before vitest. The `unstable_dev` process is started in `beforeAll` with a 60s timeout (Miniflare startup + app init).

**`NUXT_SESSION_PASSWORD` must be ≥ 32 characters**: `iron-webcrypto` (used by `h3`'s `useSession`) enforces minimum key length. Pass it via `unstable_dev` `vars` option — not via `.dev.vars` file — so the integration test process controls the value independently of any local dev config.

**Test-session endpoint uses Cloudflare env, not `process.env`**: In Workers, vars defined in `wrangler.toml` `[vars]` and `unstable_dev` `vars` are accessible via `event.context.cloudflare.env`, not `process.env`. Guard the endpoint with `event.context.cloudflare?.env?.NUXT_TEST_MODE === '1'`.

---

## Phase 1: Vitest Workspace Config + Scripts

### Overview

Split `vitest.config.ts` into a two-project workspace: `cloudflarePool` for existing unit tests, `forks` pool for integration tests. Add integration test scripts to `package.json`.

### Changes Required:

#### 1. Vitest config

**File**: `vitest.config.ts`

**Intent**: Replace the single-pool config with a two-project workspace so unit tests continue to run in Workers V8 and integration tests run in Node.js forks pool.

**Contract**: Use the vitest 4.x `projects` array. Unit project: `include: ['**/*.test.ts']`, `exclude: ['**/*.integration.test.ts']`, `pool: cloudflarePool(...)`. Integration project: `include: ['**/*.integration.test.ts']`, `pool: 'forks'`. The `wrangler.toml` path in `cloudflarePool` stays `'./wrangler.toml'`. If vitest 4.x inline project configs do not accept a `pool` key with `PoolRunnerInitializer`, extract the unit config to `vitest.unit.config.ts` and reference it as a path string in the `projects` array.

#### 2. Package scripts

**File**: `package.json`

**Intent**: Add scripts that let unit tests run fast (no build) and integration tests chain a build step.

**Contract**: Add four scripts: `"test:unit": "vitest run --project unit"`, `"test:integration": "nuxi build && vitest run --project integration"`, `"test:all": "nuxi build && vitest run"`, `"test:watch": "vitest"`. Update `"test"` to `"vitest run --project unit"` (keeps CI gate fast; `test:all` runs the full suite).

### Success Criteria:

#### Automated Verification:

- `npm run test` exits 0 with 2 unit tests passing (unchanged from Phase 1 rollout)
- `npm run typecheck` passes

#### Manual Verification:

- `npm run test -- --reporter=verbose` shows test output tagged `[unit]` (or project name from config)
- `npm run test:integration` fails with "Cannot find module" or similar (no integration tests yet, but the command resolves and attempts to run vitest)

---

## Phase 2: Test-Session Endpoint + Env Setup

### Overview

Add a test-only server route that creates a session cookie for any role without going through the auth flow. Gate it with `NUXT_TEST_MODE=1` env var injected by `unstable_dev` at test time.

### Changes Required:

#### 1. Test-session route

**File**: `server/routes/test-session.post.ts` (create)

**Intent**: Allow integration tests to obtain a valid `nuxt-auth-utils` session cookie for any role without seeding a user with a hashed password. The endpoint is inert in production (env var absent → 404).

**Contract**: Check `(event.context.cloudflare?.env as Record<string, string> | undefined)?.NUXT_TEST_MODE === '1'`; throw `createError({ statusCode: 404 })` if not. Read `{ role }` from body; validate against `VALID_ROLES`; call `setUserSession(event, { user: { email: \`test-${role.toLowerCase()}@test.local\`, name: role, avatar: '', role } })`; return `{ ok: true }`. Status 404 if test mode off, 400 if invalid role, 200 on success.

### Success Criteria:

#### Automated Verification:

- `npm run test` still exits 0 (new file is a server route, doesn't affect unit tests)
- `npm run typecheck` passes

#### Manual Verification:

- After `npm run build && npx wrangler dev` (without `NUXT_TEST_MODE`), `curl -X POST http://localhost:8787/test-session -d '{"role":"Admin"}'` returns 404
- No new route appears in the running app for non-test users

---

## Phase 3: D1 Seed + Test Helpers

### Overview

Create a shared test helper (`test/helpers/server.ts`) that starts/stops the `unstable_dev` Worker and creates session cookies. Add a seed SQL file with one test user needed for PATCH validation test.

### Changes Required:

#### 1. D1 seed file

**File**: `test/fixtures/seed.sql` (create)

**Intent**: Seed the local D1 with the minimum data required by integration tests: one user with a known ID for the PATCH endpoint test.

**Contract**: Delete any existing `@test.local` users to ensure idempotency, then insert one Admin user:
```sql
DELETE FROM users WHERE email LIKE '%@test.local';
INSERT INTO users (id, email, name, avatar, role, created_at)
VALUES ('test-user-001', 'admin@test.local', 'Test Admin', '', 'Admin', '2026-01-01T00:00:00.000Z');
```
The ID `'test-user-001'` is the known constant used in validation tests.

#### 2. Test server helper

**File**: `test/helpers/server.ts` (create)

**Intent**: Centralize `unstable_dev` lifecycle and session cookie factory so each test file doesn't repeat boilerplate.

**Contract**: Export `startWorker(): Promise<UnstableDevWorker>` — calls `unstable_dev('.output/server/index.mjs', { experimental: { disableExperimentalWarning: true }, local: true, logLevel: 'error', vars: { NUXT_SESSION_PASSWORD: 'test-session-password-must-be-32-chars!!', NUXT_TEST_MODE: '1' } })`. Export `getSession(worker, role): Promise<string>` — POSTs to `/test-session`, extracts the `set-cookie` header value. Export `TEST_USER_ID = 'test-user-001'` constant. Import `type UnstableDevWorker` from `'wrangler'`.

#### 3. D1 seed script invocation

**File**: `package.json`

**Intent**: Add a `test:seed` script that applies D1 migrations locally and inserts seed data, so CI and local runs start from a known state.

**Contract**: Add `"test:seed": "wrangler d1 migrations apply ringabell --local && wrangler d1 execute ringabell --local --file test/fixtures/seed.sql"`. The `test:integration` script must call `test:seed` before vitest: `"test:integration": "nuxi build && npm run test:seed && vitest run --project integration"`.

### Success Criteria:

#### Automated Verification:

- `npm run test:seed` exits 0 (migrations applied, seed inserted)
- `npm run typecheck` passes — `test/helpers/server.ts` compiles without errors

#### Manual Verification:

- After `npm run test:seed`, `wrangler d1 execute ringabell --local --command "SELECT id, email, role FROM users"` returns the seeded row

---

## Phase 4: Integration Tests + Cookbook

### Overview

Write 5 integration tests (3 RBAC, 2 validation) and fill `test-plan.md §6.2, §6.3, §6.4`. Advance Phase 2 rollout status to `complete`.

### Changes Required:

#### 1. RBAC integration tests

**File**: `server/api/admin/users/users.rbac.integration.test.ts` (create)

**Intent**: Prove that `GET /api/admin/users` correctly enforces the RBAC guard — covering the three critical paths that Risk #3 requires: missing session, wrong role, correct role.

**Contract**: `describe('RBAC — GET /api/admin/users')` with `beforeAll`/`afterAll` managing `startWorker()`/`worker.stop()`. Three `it()` tests: `worker.fetch('/api/admin/users')` with no cookie → `expect(res.status).toBe(401)`; with Manager session cookie → `expect(res.status).toBe(403)`; with Admin session cookie → `expect(res.status).toBe(200)`. Session cookies obtained via `getSession(worker, role)` from the helper. `beforeAll` timeout: `60_000`.

#### 2. Validation integration tests

**File**: `server/api/admin/users/users.validation.integration.test.ts` (create)

**Intent**: Close the explicit gap from `admin-user-management/change.md:14-17` — PATCH with invalid role and POST with invalid email were never tested.

**Contract**: `describe('Input validation — /api/admin/users')` with same `beforeAll`/`afterAll` pattern. Two `it()` tests: `PATCH /api/admin/users/${TEST_USER_ID}` with Admin session + body `{ role: 'INVALID_ROLE' }` → `expect(res.status).toBe(400)`; `POST /api/admin/users` with Admin session + body `{ email: 'notanemail', role: 'Admin' }` → `expect(res.status).toBe(400)`. All requests include `Content-Type: application/json` header.

#### 3. Cookbook §6.2 update

**File**: `context/foundation/test-plan.md` — section `### 6.2 Dodawanie integration testu server route (D1)`

**Intent**: Replace the TBD placeholder with the concrete `unstable_dev` pattern.

**Contract**: Document: (1) file naming `*.integration.test.ts` co-located with route under test; (2) `startWorker()`/`stopWorker()` from `test/helpers/server.ts`; (3) D1 seeding via `npm run test:seed`; (4) run command `npm run test:integration`; (5) reference `server/api/admin/users/users.rbac.integration.test.ts` as canonical example.

#### 4. Cookbook §6.3 update

**File**: `context/foundation/test-plan.md` — section `### 6.3 Dodawanie integration testu middleware autoryzacji (rola check)`

**Intent**: Replace TBD with the RBAC HTTP pattern: test-session endpoint + session cookie + assert 403.

**Contract**: Document: (1) create session via `getSession(worker, 'Manager')` from test helper; (2) pass cookie in `Cookie` header of fetch; (3) assert status 401 (no session), 403 (wrong role), 200 (correct role); (4) reference `users.rbac.integration.test.ts`.

#### 5. Cookbook §6.4 update

**File**: `context/foundation/test-plan.md` — section `### 6.4 Dodawanie testu dla nowego endpointu API`

**Intent**: Replace TBD with the general integration test pattern for new endpoints.

**Contract**: Document: (1) prefer integration (HTTP-level via `unstable_dev`) over unit (handler import) for endpoint tests; (2) use e2e only when failure mode requires full deployed shape (auth + cookie + CDN); (3) reference `users.validation.integration.test.ts` as canonical example.

#### 6. Phase 2 rollout status advance

**File**: `context/foundation/test-plan.md` — `## 3. Phased Rollout` row 2

**Intent**: Reflect Phase 2 completion.

**Contract**: Change `Status` cell of row 2 from `not started` to `complete`; update `Change folder` cell to `context/changes/rbac-api-validation/`.

### Success Criteria:

#### Automated Verification:

- `npm run test:integration` exits 0 with 5 integration tests passing
- `npm run test` exits 0 with 2 unit tests passing (no regression)
- `npm run typecheck` passes
- `grep "TBD" context/foundation/test-plan.md | grep -E "6\.2|6\.3|6\.4"` returns no output

#### Manual Verification:

- `npm run test:integration -- --reporter=verbose` output shows `[integration]` project name and 5 tests by name
- Change one RBAC assertion (e.g. `toBe(403)` → `toBe(200)`) — test turns red; restore
- `test-plan.md §6.2`, `§6.3`, `§6.4` each read as actionable, copy-paste-ready patterns

---

## Testing Strategy

### Integration Tests:

- RBAC — 3 tests on `GET /api/admin/users`: no session → 401, Manager session → 403, Admin session → 200
- Validation — 2 tests on admin user endpoints: PATCH invalid role → 400, POST invalid email → 400

### Manual Testing Steps:

1. Run `npm run test:integration` — verify 5 pass, `[integration]` pool shown
2. Break one assertion — verify it turns red (assertions are real)
3. Run `npm run test` — verify 2 unit tests still pass (no regression)
4. Read `test-plan.md §6.3` — verify it's an actionable pattern

## References

- Research: `context/changes/rbac-api-validation/research.md`
- Guard under test: `server/utils/admin-guard.ts:1-7`
- Untested endpoints: `context/changes/admin-user-management/change.md:14-17`
- D1 schema: `migrations/0001_init.sql`
- Existing unit test pattern: `utils/date.test.ts`
- Test plan Phase 2: `context/foundation/test-plan.md §3`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Vitest Workspace Config + Scripts

#### Automated

- [x] 1.1 `npm run test` exits 0 with 2 unit tests passing (unchanged)
- [x] 1.2 `npm run typecheck` passes

#### Manual

- [x] 1.3 `npm run test -- --reporter=verbose` shows unit project label in output
- [x] 1.4 `npm run test:integration` resolves and attempts to run vitest (no integration tests yet)

### Phase 2: Test-Session Endpoint + Env Setup

#### Automated

- [ ] 2.1 `npm run test` exits 0 (new route doesn't affect unit tests)
- [ ] 2.2 `npm run typecheck` passes

#### Manual

- [ ] 2.3 `curl -X POST localhost:8787/test-session` returns 404 without `NUXT_TEST_MODE`

### Phase 3: D1 Seed + Test Helpers

#### Automated

- [ ] 3.1 `npm run test:seed` exits 0
- [ ] 3.2 `npm run typecheck` passes

#### Manual

- [ ] 3.3 `wrangler d1 execute ringabell --local --command "SELECT id, role FROM users"` shows seeded row

### Phase 4: Integration Tests + Cookbook

#### Automated

- [ ] 4.1 `npm run test:integration` exits 0 with 5 tests passing
- [ ] 4.2 `npm run test` exits 0 with 2 unit tests passing (no regression)
- [ ] 4.3 `npm run typecheck` passes
- [ ] 4.4 `grep "TBD" context/foundation/test-plan.md | grep -E "6\.2|6\.3|6\.4"` returns no output

#### Manual

- [ ] 4.5 `npm run test:integration -- --reporter=verbose` shows `[integration]` project and 5 named tests
- [ ] 4.6 Breaking one RBAC assertion turns test red
- [ ] 4.7 `test-plan.md §6.2`, `§6.3`, `§6.4` each read as actionable patterns
