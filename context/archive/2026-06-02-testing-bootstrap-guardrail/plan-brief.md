# Testing Bootstrap Guardrail — Plan Brief

> Full plan: `context/changes/testing-bootstrap-guardrail/plan.md`
> Research: `context/changes/testing-bootstrap-guardrail/research.md`

## What & Why

Bootstrap Vitest with `@cloudflare/vitest-pool-workers` to establish a test runner that executes in the Workers V8 runtime. This is Phase 1a of the test rollout (`test-plan.md §3 Phase 1`): without a working test runner, the guardrail tests for Risk #1 and #2 cannot be written, and the §5 quality gate "unit + integration" cannot be wired to CI.

## Starting Point

No test runner is configured today — `package.json` has no `devDependencies`, no `test` script, and zero test files exist in the codebase. The business logic functions the guardrail tests will target (`validateRosterCompleteness`, `detectDateConflicts`) also do not exist yet — they belong to S-04/S-05, both `proposed`.

## Desired End State

`npm run test` exits 0 with 2 passing tests in a Workers V8 isolate (not Node.js runner). `test-plan.md §6.1` documents the concrete unit test pattern. Future contributors and AI agents know exactly how to add a new test to this project.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| Test harness | Vitest + @cloudflare/vitest-pool-workers | Workers V8 isolate from day 1 avoids reconfiguration when integration tests arrive |
| Smoke test target | utils/date.ts (formatDate, nowUtc) | Pure functions, no I/O, exist today — real business signal with zero stubs |
| Phase 1a scope | Bootstrap only, S-04 deps documented | Guardrail functions don't exist; tight scope prevents premature contracts that drift |
| Cookbook timing | §6.1 filled in Phase 2 of this plan | Unblocks future contributors immediately after bootstrap completes |

## Scope

**In scope:**
- `vitest`, `@cloudflare/vitest-pool-workers`, `wrangler` added to `devDependencies`
- `vitest.config.ts` at project root using `defineWorkersConfig`, wired to `wrangler.toml`
- `utils/date.test.ts` — 2 assertions on `formatDate` and `nowUtc`
- `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`
- `test-plan.md §6.1` filled with concrete pattern + Phase 1 status → `implementing`

**Out of scope:**
- Guardrail unit tests (`validateRosterCompleteness`, `detectDateConflicts`) — blocked by S-04
- Integration tests for publish endpoint — blocked by S-05
- `@nuxt/test-utils`, `nitro-test-utils` — Phase 2 RBAC tests
- CI/CD pipeline wiring — Phase 4 of test rollout
- Stub/skeleton validation function files

## Architecture / Approach

Two files to create (`vitest.config.ts`, `utils/date.test.ts`), one file to modify (`package.json`), two documents to update (`test-plan.md`, `change.md`). The pool-workers config reads the existing `wrangler.toml` — no new bindings or infrastructure needed. The critical non-obvious detail is `defineWorkersConfig` (from `@cloudflare/vitest-pool-workers/config`) vs plain `defineConfig` — using the wrong one won't wire the Workers pool.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Vitest Install & Config | Runner installed, Workers pool configured, typecheck passes | vitest-pool-workers peer dep version matrix |
| 2. Smoke Test + Cookbook | 2 tests passing in Workers runtime, §6.1 filled | dayjs ESM compatibility in Workers V8 isolate |

**Prerequisites:** `wrangler.toml` at project root (exists), Node >= 20 (CLAUDE.md)
**Estimated effort:** ~1 session, 2 phases

## Open Risks & Assumptions

- `@cloudflare/vitest-pool-workers` has strict peer constraints on `vitest` version — check release notes before installing
- dayjs UTC plugin assumed compatible with Workers V8 isolate (pure ESM, no Node APIs) — smoke test will catch any incompatibility immediately
- S-04 open questions (event-level requirements storage, fight_requirements population, manager guard scope, date precision) must be resolved before Phase 1b guardrail tests can be written

## Success Criteria (Summary)

- `npm run test` exits 0, output confirms Workers runtime (not Node.js), 2 tests passing
- `test-plan.md §6.1` is no longer TBD — has actionable, copy-paste-ready pattern
- Phase 1 change folder reaches `complete` status
