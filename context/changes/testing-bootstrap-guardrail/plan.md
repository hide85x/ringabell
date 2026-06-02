# Testing Bootstrap Guardrail — Implementation Plan

## Overview

Bootstrap Vitest with `@cloudflare/vitest-pool-workers` Workers runtime isolation. This is Phase 1a of the `test-plan.md` Phase 1 rollout: install the test runner, configure it for the Workers V8 environment, and write one smoke test to prove the setup works. Guardrail tests for Risk #1 and #2 are explicitly out of scope — they require S-04/S-05 to implement the validation functions and publish endpoint first.

## Current State Analysis

No test runner is configured. `package.json` has no `devDependencies` section and no `test` script. No `*.test.ts` or `*.spec.ts` files exist anywhere in `server/`, `app/`, or `utils/`. The D1 schema and TypeScript models exist, but the business logic functions (`validateRosterCompleteness`, `detectDateConflicts`) that the guardrail tests will target have not been implemented yet.

`wrangler.toml` is present at the project root with `[[d1_databases]]` binding (`DB`) — this is the file vitest-pool-workers uses to configure the test environment.

`utils/date.ts` exports two pure functions (`formatDate`, `nowUtc`) using dayjs with UTC plugin — suitable as a smoke test target because they have no I/O dependencies.

## Desired End State

After this plan: `npm run test` exits 0, two tests in `utils/date.test.ts` pass in a Workers V8 isolate, `test-plan.md §6.1` documents the pattern. The CI quality gate "unit + integration" (§5) can be wired after this plan ships.

### Key Discoveries:

- `package.json` has `"type": "module"` and no `devDependencies` — `vitest`, `@cloudflare/vitest-pool-workers`, and peer dep `wrangler` must all be added to `devDependencies`
- `wrangler.toml` is at project root — the pool-workers config will reference it directly; D1 `DB` binding is available in the test environment by default (unused in Phase 1a)
- `utils/date.ts` uses only `dayjs` (pure ESM, no Node.js APIs) — safe to run in Workers V8 isolate
- Guardrail business logic (`validateRosterCompleteness`, `detectDateConflicts`) does not exist — Phase 1b requires S-04 to implement and extract these as testable pure functions

## What We're NOT Doing

- Writing guardrail unit tests for `validateRosterCompleteness` or `detectDateConflicts` — these functions don't exist yet; Phase 1b follows S-04
- Writing integration tests for the publish endpoint — S-05 must ship the endpoint first (Phase 1c)
- Adding `@nuxt/test-utils` or `nitro-test-utils` — these belong to Phase 2 RBAC integration tests
- Configuring CI/CD pipeline — wiring CI is Phase 4 of the test rollout
- Stubbing or pre-writing validation function signatures — avoids creating files that will drift before S-04 resolves open architectural questions

## Implementation Approach

Two files to create (`vitest.config.ts`, `utils/date.test.ts`), one file to modify (`package.json`), two documents to update (`test-plan.md §6.1` and Phase 1 status row, `change.md` status). The pool-workers config reads the existing `wrangler.toml` — no new bindings or infrastructure needed.

## Critical Implementation Details

**`defineWorkersConfig` vs `defineConfig`**: `@cloudflare/vitest-pool-workers` exports its own config helper — `defineWorkersConfig` from `@cloudflare/vitest-pool-workers/config`. Using plain `defineConfig` from `vitest/config` will not wire the pool correctly. This is the only non-obvious API call in Phase 1.

**Version compatibility**: `@cloudflare/vitest-pool-workers` has strict peer dependency constraints on the `vitest` version. Check the package's release notes before installing to pick a compatible vitest range — do not install latest vitest independently and assume it matches.

---

## Phase 1: Vitest Install & Runtime Config

### Overview

Install Vitest and `@cloudflare/vitest-pool-workers` as devDependencies, create `vitest.config.ts` wired to the existing `wrangler.toml`. After this phase, the test runner is configured and can execute tests in the Workers V8 isolate.

### Changes Required:

#### 1. Package installation

**File**: `package.json`

**Intent**: Add `vitest`, `@cloudflare/vitest-pool-workers`, and `wrangler` to `devDependencies`, and add `"test"` and `"test:watch"` scripts.

**Contract**: `devDependencies` gains three entries: `"vitest"`, `"@cloudflare/vitest-pool-workers"`, `"wrangler"`. Scripts gain `"test": "vitest run"` and `"test:watch": "vitest"`. Use versions compatible per the `@cloudflare/vitest-pool-workers` peer dependency matrix at install time.

#### 2. Vitest config

**File**: `vitest.config.ts` (create at project root)

**Intent**: Configure Vitest to run tests inside a Workers V8 isolate using the existing `wrangler.toml` bindings. This ensures tests run in the same environment as production.

**Contract**: Use `defineWorkersConfig` from `@cloudflare/vitest-pool-workers/config`, not `defineConfig` from `vitest/config`. Set `poolOptions.workers.wrangler.configPath` to `'./wrangler.toml'`.

```ts
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
      },
    },
  },
})
```

### Success Criteria:

#### Automated Verification:

- `npm install` completes without errors
- `npx vitest run --reporter=verbose` exits 0 with "No test files found" (runner configured, no tests yet)
- `npm run typecheck` passes — vitest types don't break existing TS

#### Manual Verification:

- `npm run test` outputs "No test files found" without an error exit code — runner is wired

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Smoke Test + CI Wiring + Cookbook

### Overview

Write one smoke test on `utils/date.ts` to prove the Workers V8 runner picks up and executes a real business-critical utility. Fill `test-plan.md §6.1` with the concrete pattern. Advance Phase 1 rollout status in `test-plan.md §3`.

### Changes Required:

#### 1. Smoke test file

**File**: `utils/date.test.ts` (create, co-located with `utils/date.ts`)

**Intent**: Prove the test runner executes in Workers V8 by testing two pure functions from the date utility module. Covering `formatDate` with a fixed input and `nowUtc` for ISO string format gives confidence the dayjs/UTC setup works in the Workers runtime.

**Contract**: Two `it()` blocks: `formatDate('2026-01-15T10:30:00Z')` must return `'2026-01-15 10:30'` (the default `'YYYY-MM-DD HH:mm'` format); `nowUtc()` must match the regex `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/`.

#### 2. Cookbook update — §6.1

**File**: `context/foundation/test-plan.md` — section `### 6.1 Dodawanie unit testu`

**Intent**: Replace the `TBD — see §3 Phase 1` placeholder with the concrete pattern so any future contributor (human or AI agent) knows how to add a unit test in this project.

**Contract**: Document file naming convention (`*.test.ts` co-located with source), the `defineWorkersConfig` import path, run command (`npm run test`), and reference `utils/date.test.ts` as the canonical example. One-paragraph format.

#### 3. Phase 1 rollout status advance

**File**: `context/foundation/test-plan.md` — `## 3. Phased Rollout` row 1

**Intent**: Reflect that Phase 1 is now being implemented (not just change opened).

**Contract**: Change the `Status` cell of row 1 from `change opened` to `implementing`.

### Success Criteria:

#### Automated Verification:

- `npm run test` exits 0 with 2 tests passing
- `npm run typecheck` passes
- `grep "6.1" context/foundation/test-plan.md | grep -v TBD` returns output — §6.1 is no longer a placeholder

#### Manual Verification:

- `npm run test` output confirms Workers runtime (shows `[workers pool]` or pool-workers pool name), not Node.js runner
- Intentionally break `formatDate` return value — test turns red, confirming the assertion is real
- `test-plan.md §6.1` reads as an actionable, copy-paste-ready pattern

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- `formatDate('2026-01-15T10:30:00Z')` → `'2026-01-15 10:30'` (fixed UTC timestamp, no flakiness)
- `nowUtc()` → ISO 8601 string matching `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/`

### Integration Tests:

Blocked — written alongside S-04/S-05:
- Phase 1b (S-04 dependency): unit tests for `validateRosterCompleteness(fights, fightRequirements, assignments)` and `detectDateConflicts(eventDate, assignments, events)` once these pure functions are extracted during S-04 implementation
- Phase 1c (S-05 dependency): HTTP-level integration tests for `POST /api/events/:id/publish` once S-05 ships the endpoint

### Manual Testing Steps:

1. Run `npm run test` — verify output shows "2 passed" and Workers pool runtime, not Node.js
2. Break `formatDate` return format string — verify test turns red (assertion is live)
3. Restore change and run `npm run typecheck` — verify no type errors

## Migration Notes

No schema changes. No D1 migrations. The `wrangler.toml` bindings (D1 `DB`) are available in the test environment by default but unused in Phase 1a.

## Open Architectural Questions for S-04 (Phase 1b prerequisites)

These questions from research must be resolved in S-04 planning before guardrail unit tests can be written:

1. **Event-level requirements storage**: How are per-gala requirements (ratownik, konferansjer) stored — hardcoded in publish logic, flagged in `fight_requirement_defaults`, or new `event_requirements` table?
2. **`fight_requirements` population**: Copied from `fight_requirement_defaults` at fight creation (point-in-time snapshot) or read from defaults at validation time (live)?
3. **Manager guard scope**: Does the publish endpoint accept `role === 'Manager'` only, or `role IN ('Manager', 'Admin')`?
4. **Date comparison precision**: Is `events.date` a full datetime string or date-only? If full datetime, the conflict check must compare only the date portion.

## References

- Research: `context/changes/testing-bootstrap-guardrail/research.md`
- Test strategy: `context/foundation/test-plan.md` §3 Phase 1, §4, §5
- Date utility under test: `utils/date.ts`
- D1 / Workers config: `wrangler.toml`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Vitest Install & Runtime Config

#### Automated

- [x] 1.1 `npm install` completes without errors — 499f22f
- [x] 1.2 `npx vitest run --reporter=verbose` exits 0 with "No test files found" — 499f22f
- [x] 1.3 `npm run typecheck` passes — 499f22f

#### Manual

- [x] 1.4 `npm run test` outputs "No test files found" without error exit code — 499f22f

### Phase 2: Smoke Test + CI Wiring + Cookbook

#### Automated

- [x] 2.1 `npm run test` exits 0 with 2 tests passing
- [x] 2.2 `npm run typecheck` passes
- [x] 2.3 §6.1 is no longer a TBD placeholder

#### Manual

- [x] 2.4 `npm run test` output confirms Workers runtime, not Node.js
- [x] 2.5 Breaking `formatDate` return turns test red
- [x] 2.6 `test-plan.md §6.1` reads as actionable, copy-paste-ready pattern
