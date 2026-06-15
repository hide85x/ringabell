# RBAC and API Input Validation — Plan Brief

> Full plan: `context/changes/rbac-api-validation/plan.md`
> Research: `context/changes/rbac-api-validation/research.md`

## What & Why

Write integration tests for Phase 2 of the test rollout: Risk #3 (RBAC guard — Manager/Personel can't access admin endpoints) and Risk #4 (server-side input validation — invalid role/email returns 4xx, not 200). Two endpoints were explicitly flagged as untested in the prior `admin-user-management` change.

## Starting Point

One unit test exists (`utils/date.test.ts`, cloudflarePool, Workers V8). No integration test infrastructure. `admin-guard.ts` and all 12 admin endpoints are implemented and deployed; they've never been covered by automated tests.

## Desired End State

`npm run test` runs fast unit tests (no build). `npm run test:integration` builds the app, seeds D1, starts a local Wrangler worker via `unstable_dev`, and runs 5 tests: 3 RBAC (no session → 401, Manager → 403, Admin → 200) + 2 validation (PATCH invalid role → 400, POST invalid email → 400). Cookbook §6.2, §6.3, §6.4 filled.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| HTTP transport | `unstable_dev` (real HTTP) | Tests full request pipeline including routing and session deserialization | Plan |
| Session creation | test-session endpoint (gated by `NUXT_TEST_MODE=1`) | Avoids seeding password hashes while using the real `setUserSession` path | Plan |
| D1 isolation | `wrangler d1 execute --local + seed.sql` per run | Idempotent, reversible, no shared mutable state between runs | Plan |
| RBAC scope | 1 representative endpoint (GET /api/admin/users) | All 12 admin endpoints share the same `requireAdmin()` function | Research |
| Validation scope | Only explicitly untested (PATCH role + POST email) | Directly closes the documented gap from admin-user-management change | Research |
| Vitest config | `projects` array (two pools in one config) | `poolMatchGlobs` doesn't accept `PoolRunnerInitializer`; inline projects do | Plan |

## Scope

**In scope:** vitest workspace config, test-session endpoint, D1 seed, integration test helpers, 5 integration tests, cookbook §6.2/§6.3/§6.4

**Out of scope:** all 12 RBAC endpoints (1 is sufficient), dictionary endpoint validation, Manager CRUD endpoints (don't exist yet), Zod migration, CI wiring (Phase 4)

## Architecture / Approach

Two vitest pools in one `vitest.config.ts` using the `projects` array: `cloudflarePool` runs `*.test.ts` in Workers V8 (fast, no build), `forks` pool runs `*.integration.test.ts` via Node.js. Integration tests start `unstable_dev` in `beforeAll`, call `POST /test-session` to get role-specific session cookies, then make HTTP fetch calls asserting status codes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Vitest workspace config | Two-pool config + scripts | `cloudflarePool` may not work in inline project config |
| 2. Test-session endpoint | Session factory gated by `NUXT_TEST_MODE` | Env var access pattern in Workers (must use cloudflare.env, not process.env) |
| 3. D1 seed + test helpers | `startWorker()`, `getSession()`, `seed.sql` | `unstable_dev` persistence config alignment with `.wrangler/state/v3/d1/` |
| 4. 5 integration tests + cookbook | Tests passing, §6.2–6.4 filled, Phase 2 complete | `unstable_dev` build requirement; beforeAll 60s timeout |

**Prerequisites:** Nuxt app builds cleanly (`npm run build`); `wrangler` CLI available; local D1 state directory exists (created by prior `wrangler dev` or migration run)

## Open Risks & Assumptions

- `projects` inline config with `cloudflarePool` is assumed to work in vitest 4.x — fallback to two separate config files if not
- `unstable_dev` local D1 persistence must pick up `.wrangler/state/v3/d1/` — needs verification at implementation time
- `NUXT_SESSION_PASSWORD` min-length is 32 chars (iron-webcrypto) — test value must meet this

## Success Criteria (Summary)

- `npm run test:integration` exits 0 with 5 tests passing
- `npm run test` exits 0 with 2 unit tests (no regression)
- `test-plan.md §6.2, §6.3, §6.4` are copy-paste-ready patterns
