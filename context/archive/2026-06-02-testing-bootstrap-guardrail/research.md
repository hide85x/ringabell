---
date: 2026-06-02T00:00:00+00:00
researcher: claude-sonnet-4-6
git_commit: a4655d1f0abc131b78fb2ac8f9896cc89c476834
branch: test-plan
repository: ringabell
topic: "Phase 1 rollout grounding — Risk #1 (missing role blocks publication) and Risk #2 (date conflict blocks publication)"
tags: [research, testing, guardrail, publication, validation, vitest]
status: complete
last_updated: 2026-06-02
last_updated_by: claude-sonnet-4-6
---

# Research: Phase 1 rollout — Risk #1 and Risk #2 grounding

**Date**: 2026-06-02
**Researcher**: claude-sonnet-4-6
**Git Commit**: a4655d1f0abc131b78fb2ac8f9896cc89c476834
**Branch**: test-plan
**Repository**: ringabell

---

## Research Question

Ground Phase 1 of `context/foundation/test-plan.md` for Risk #1 (missing required role per fight/event blocks publication) and Risk #2 (date conflict blocks publication). For each risk: locate the real failure path in code, quote relevant lines, verify or correct the response guidance, find existing tests, identify the cheapest test layer, and flag speculative evidence.

---

## Summary

**The single most important finding: neither guardrail exists in the codebase today.**

`server/api/` contains only `admin/` and `auth/`. There is no event-management API, no fight-management API, no assignment API, and — critically — no publication endpoint. The guardrail logic described in Risks #1 and #2 belongs to roadmap slices **S-04** (`event-and-fight-management`, status: `proposed`) and **S-05** (`event-publish-and-email`, status: `proposed`), neither of which has been started.

The D1 schema supports the query patterns the guardrails will need (tables exist, indices are in place), but the application-level code that enforces those constraints at publish time is completely absent.

Consequence for Phase 1 scope:

- The **bootstrap** task (install Vitest, configure `@cloudflare/vitest-pool-workers`) can land immediately.
- The **integration-test layer** ("server route, HTTP-level block") described in the test plan **cannot be written yet** — the publish endpoint doesn't exist.
- The **unit-test layer** (pure validation functions) CAN be written as soon as the validation logic is extracted during S-04/S-05 implementation.

The test plan's "Likely cheapest layer: Integration (server route)" is the correct final target. It is not the right first deliverable for Phase 1.

---

## Detailed Findings

### Existing test infrastructure

No test runner is configured in `package.json`. No test files exist anywhere in `server/`, `app/`, or `utils/` (only third-party files in `node_modules/`).

[package.json](package.json:1) — `scripts` has only `build`, `dev`, `generate`, `preview`, `postinstall`. No `test` script. No `vitest`, `jest`, `@nuxt/test-utils`, or `@cloudflare/vitest-pool-workers` in `dependencies` or `devDependencies`.

---

### Risk #1 — Missing required role blocks publication

#### The failure path (grounded)

Publication would flow through a future `server/api/events/[id]/publish.post.ts` endpoint. To enforce the guardrail, that handler would need to:

1. Load all fights for the event from `fights` (via `event_id`).
2. For each fight, load its requirements from `fight_requirements` (`fight_id → role, count`).
3. For each fight, count actual assignments from `assignments` where `fight_id = <id>` grouped by `role`.
4. Compare: if any `COUNT(assignments) < fight_requirements.count` → return 4xx, block.
5. For event-level requirements (ratownik, konferansjer): count `assignments` where `type = 'event'` and `event_id = <id>` grouped by `role`; compare with event-level required minimums (stored where exactly — see open question below).
6. If any check fails → 4xx with a structured error listing which role/fight is unmet.

**None of step 1–6 exists in server code today.**

#### D1 schema — what supports the future guardrail

[migrations/0001_init.sql:22-52](migrations/0001_init.sql) defines the relevant tables:

```sql
-- per-fight required roles:
CREATE TABLE fight_requirements (
  id TEXT PRIMARY KEY,
  fight_id TEXT NOT NULL REFERENCES fights(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  count INTEGER NOT NULL
);

-- actual assignments (fight-level and event-level):
CREATE TABLE assignments (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES persons(id),
  type TEXT NOT NULL CHECK(type IN ('fight', 'event')),
  fight_id REFERENCES fights(id),
  event_id REFERENCES events(id),
  role TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_assignments_event_id ON assignments(event_id);
```

[migrations/0002_dictionaries.sql](migrations/0002_dictionaries.sql) adds the global template:

```sql
CREATE TABLE fight_requirement_defaults (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES person_roles(id) ON DELETE CASCADE,
  count INTEGER NOT NULL CHECK(count > 0)
);
```

The schema supports the validation query. There is no DB-level constraint that enforces completeness — it will be application-level logic.

#### Open schema question: event-level requirements (ratownik, konferansjer)

PRD §Business Logic states: *"Per gala: cała gala wymaga co najmniej 1 ratownika i 1 konferansjera"*. The D1 schema has no `event_requirements` table — only `fight_requirements` (per-fight) and `fight_requirement_defaults` (global template for fights). It is not yet decided whether event-level requirements will be hardcoded in the publish logic, stored in a separate table, or filtered from `fight_requirement_defaults` by a special flag. **This must be resolved during S-04 planning before tests can be written.**

#### PRD specification (grounded)

[context/foundation/prd.md §Guardrails]: "Gala nie może zostać stworzona jeśli którakolwiek walka nie ma wypełnionych wymaganych ról."

[context/foundation/prd.md §Business Logic]: "Per walka: każda walka wymaga dokładnie 2 bokserów, 1 sędziego ringowego, 3 sędziów punktowych i 1 lekarza ringowego — brak któregokolwiek to ostrzeżenie widoczne dla managera podczas planowania. Per gala: cała gala wymaga co najmniej 1 ratownika i 1 konferansjera — bez nich publikacja jest zablokowana."

The distinction warning-vs-block is explicit:
- During planning/assignment → **WARNING**, saving is allowed (FR-009: "system ostrzega… ale pozwala zapisać").
- At publication time → **HARD BLOCK** for both per-fight and per-event deficiencies.

#### Response guidance — verdict

The challenge is **correct and necessary**: "nie zakładaj że ostrzeżenie = blokada". PRD explicitly distinguishes the two states. The failure mode to test is specifically the publication-time block, not the planning-time warning.

The "avoid: happy-path only" anti-pattern is real — a test that only verifies a fully-staffed event publishes successfully tells us nothing about the guardrail.

The **cheapest layer** designation ("Integration (server route)") is the correct final target but requires S-05 to exist. The cheapest layer reachable in Phase 1 today is:

> **Unit test of a pure validation function** — e.g. `validateRosterCompleteness(fights, fightRequirements, assignments)` returns `null | ValidationError[]`. This function can be extracted as a standalone module during S-04 implementation, independent of the HTTP layer.

#### Hot-spot assessment — `server/models` (13 commits/30d)

**Misleading as a Risk #1 anchor.** The churn in `server/models` is entirely from the `mongodb-to-d1` change: all five model files were rewritten from `ObjectId` / Mongoose shapes to plain TypeScript interfaces with D1-compatible string IDs. The files now contain only interface definitions — no validation logic, no query logic. Future guardrail logic will live in the publish endpoint handler, not in model files.

[server/models/event.ts](server/models/event.ts): 9-line interface only — `id`, `name`, `date`, `venue`, `status: 'draft' | 'published' | 'cancelled'`, `createdAt`. No methods.

[server/models/fight.ts](server/models/fight.ts): 7-line interface with `requirements: Array<{ role: string; count: number }>`. No validation.

[server/models/assignment.ts](server/models/assignment.ts): 9-line interface. No validation.

---

### Risk #2 — Date conflict blocks publication

#### The failure path (grounded)

Same publication endpoint (S-05). For date conflict checking:

1. Load all assignments for the event being published (all persons assigned to any fight or event-level slot).
2. Load the event's `date`.
3. For each `person_id`, query `assignments JOIN events ON events.id = assignments.event_id WHERE events.date = <event_date> AND assignments.event_id != <current_event_id>`.
4. If any row is returned → that person has a conflict → block publication.

**None of this exists in server code today.**

#### D1 schema — what supports the query

```sql
-- assignments.event_id indexed:
CREATE INDEX idx_assignments_event_id ON assignments(event_id);
CREATE INDEX idx_assignments_person_id ON assignments(person_id);

-- events.date is TEXT NOT NULL (ISO string via nowUtc()):
CREATE TABLE events (
  date TEXT NOT NULL,
  ...
);
```

No unique constraint or CHECK constraint in D1 enforces "one person per date". This is intentional per PRD FR-009: at assignment time the system warns but allows saving. Only at publish time is it a hard block. The absence of a DB-level constraint is correct design — the application enforces it at the right moment.

#### PRD specification (grounded)

[context/foundation/prd.md §Guardrails]: "Ta sama osoba nie może być przypisana do dwóch różnych gal w tej samej dacie."

[context/foundation/prd.md §Business Logic]: "Konflikt dat: ta sama osoba nie może być przypisana do dwóch gal w tym samym dniu. System wykrywa to w momencie przypisania i wyświetla ostrzeżenie — manager może je zignorować (elastyczność), ale nie może opublikować gali z aktywnym konfliktem."

[context/foundation/prd.md FR-009]: "Manager może przypisywać personel do walk — system ostrzega przy konflikcie dat lub błędnej roli, **ale pozwala zapisać**."

The two moments are unambiguous:
- Assignment time → warning, allow save.
- Publication time → hard block.

#### Response guidance — verdict

The challenge is **correct and necessary**: "nie zakładaj że wyświetlenie ostrzeżenia == blokada publikacji". This is the exact failure mode described in the PRD.

The anti-pattern to avoid ("testowanie tylko ostrzeżenia przy przypisaniu bez testu blokady przy publikacji") is real. A test that only verifies the warning appears at assignment time would miss the actual block entirely.

The "avoid" formulation is accurate, but worth sharpening: the real anti-pattern is testing that the assignment API does NOT return an error (because it shouldn't) and concluding the conflict is handled. The test must go further and prove the publish endpoint does return an error.

The **cheapest layer** ("Integration (server route)") has the same timing constraint as Risk #1 — the publish route doesn't exist yet.

Reachable in Phase 1:

> **Unit test of a pure conflict-detection function** — e.g. `detectDateConflicts(eventDate: string, assignments: Assignment[], events: BoxingEvent[])` returns `null | ConflictError[]`. Extractable during S-04 implementation.

#### Granularity — "same day" means same ISO date string

PRD says "ta sama data". Events store `date` as `TEXT NOT NULL` in D1 (ISO format from `nowUtc()`). Conflict granularity is a full calendar day — two events on `2026-07-15` conflict regardless of time. The comparison will be a string prefix match or full string equality on the date portion. This should be documented in the unit test spec so the implementation is unambiguous.

#### Hot-spot assessment — `server/utils` (10 commits/30d)

**Misleading as a Risk #2 anchor.** The churn in `server/utils` is from two sources: `db.ts` rewritten three times (MongoDB singleton → D1 helper), and `admin-guard.ts` added. No conflict detection logic exists or was planned in `server/utils`. The future conflict check will live in the publish route handler (or a helper called by it), not in `server/utils`.

[server/utils/db.ts](server/utils/db.ts): 7-line D1 binding helper only.

[server/utils/admin-guard.ts](server/utils/admin-guard.ts): 7-line role check for admin-only endpoints.

#### Hot-spot assessment — `server/api/admin/users` (8 commits/30d)

Irrelevant to Risk #2. Churn is from the user-management feature (admin CRUD). No connection to date conflict checking.

---

## Code References

- [server/models/event.ts](server/models/event.ts) — `BoxingEvent` interface; `status: 'draft' | 'published' | 'cancelled'` — the field that the publish endpoint will set
- [server/models/fight.ts](server/models/fight.ts) — `Fight` interface with `requirements` array
- [server/models/assignment.ts](server/models/assignment.ts) — `Assignment` interface; `type: 'fight' | 'event'` determines which level (per-fight vs per-event) an assignment applies to
- [server/utils/db.ts](server/utils/db.ts) — `getD1(event)` helper; future publish handler will call this
- [server/utils/admin-guard.ts](server/utils/admin-guard.ts) — `requireAdmin(event)` pattern; publish endpoint will need a parallel `requireManager(event)` guard
- [migrations/0001_init.sql](migrations/0001_init.sql) — full schema; `fight_requirements`, `assignments` are the tables the guardrail queries will target
- [migrations/0002_dictionaries.sql](migrations/0002_dictionaries.sql) — `fight_requirement_defaults` (global template); relevance to event-level requirements TBD
- [context/foundation/prd.md](context/foundation/prd.md) §Guardrails, §Business Logic, FR-009, FR-011 — specification for both risks

---

## Architecture Insights

**Two-moment validation pattern (PRD-mandated):**
- Moment 1 (assignment time, S-04): warn, allow save — client-side check is sufficient; the server assignment endpoint does NOT need to block.
- Moment 2 (publication time, S-05): hard block — server-side check is mandatory; client warnings are advisory only.

**Publication endpoint shape (anticipated, S-05):**
```
POST /api/events/:id/publish
→ check Manager role (requireManager guard, analogous to requireAdmin)
→ load event, validate status === 'draft'
→ validateRosterCompleteness(event, fights, fightRequirements, assignments)
→ detectDateConflicts(event, assignments)
→ if any error → 422 with structured error body
→ UPDATE events SET status = 'published' WHERE id = ?
→ trigger email dispatch
```

The validation functions are pure (no I/O needed) once the data is loaded. This makes them unit-testable independently of D1 and the HTTP layer.

**No event-level requirements table yet.** PRD requires a per-gala check (ratownik, konferansjer). This is not modelled separately in the D1 schema. The plan for S-04 must decide: hardcode the event-level role names, add a flag to `fight_requirement_defaults`, or create a new `event_requirements` table. This architectural decision affects both the guardrail implementation and the test design for Risk #1.

---

## Historical Context (from prior changes)

- [context/changes/mongodb-to-d1/plan.md](context/changes/mongodb-to-d1/plan.md) — explains why `server/models` has 13 commits/30d: all models were rewritten for D1. The churn is infrastructural, not domain-logic. Hot-spot evidence is explained away.
- [context/changes/data-scaffold/plan.md](context/changes/data-scaffold/plan.md) — original MongoDB scaffold. Confirms that `fight.requirements` was always a denormalized array at the model level, now stored in a separate `fight_requirements` table.
- [context/changes/admin-dictionaries/plan.md](context/changes/admin-dictionaries/plan.md) — adds `fight_requirement_defaults` as the global template for per-fight requirements. S-04 will need to decide how `fight_requirements` is populated: copied from defaults at event-creation time, or read from defaults at validation time.

---

## Open Questions

1. **Event-level requirements storage**: How will the per-gala requirements (ratownik, konferansjer) be stored? Hardcoded in publish logic, flagged in `fight_requirement_defaults`, or new `event_requirements` table? Must be resolved in S-04 plan before integration tests can be specced.

2. **`fight_requirements` population strategy**: Are they copied from `fight_requirement_defaults` when a fight is created (point-in-time snapshot, allows per-fight customisation) or read from `fight_requirement_defaults` at validation time (always reflects current admin config)? Affects what the validation unit test needs to provide as input.

3. **Manager guard**: The publish endpoint needs a `requireManager` (or `requireManagerOrAdmin`) guard analogous to `server/utils/admin-guard.ts:requireAdmin`. Does it check `role === 'Manager'` only, or `role IN ('Manager', 'Admin')`? PRD says Manager publishes — Admin access to the action is not specified.

4. **Date comparison precision**: `events.date` is stored as ISO TEXT via `nowUtc()`. Is it full datetime (`2026-07-15T18:00:00.000Z`) or date-only (`2026-07-15`)? If full datetime, the conflict check needs to compare only the date portion. Affects the unit test fixture design.

---

## Phase 1 scope correction

The test plan names Phase 1 as "Bootstrap + guardrail walidacji" with cheapest layer "Integration (server route)". Based on current codebase state:

| Sub-task | Can land in Phase 1? | Blocker |
|---|---|---|
| Install Vitest + `@cloudflare/vitest-pool-workers` | **Yes** | None |
| Configure `vitest.config.ts` for Workers runtime | **Yes** | None |
| Write first smoke test (e.g. pure util function) | **Yes** | None |
| Unit test `validateRosterCompleteness()` | **Yes — but function doesn't exist yet** | S-04 must implement the function first |
| Unit test `detectDateConflicts()` | **Yes — but function doesn't exist yet** | S-04 must implement the function first |
| Integration test of publish endpoint (HTTP-level block) | **No** | S-05 must ship the endpoint first |

Recommended Phase 1 deliverable split:

- **Phase 1a (bootstrap only)**: Install Vitest, configure for Workers runtime, write one smoke-level test (e.g. `validateRosterCompleteness` with hard-coded stub inputs, or a trivial pure-function test). Proves the runner works.
- **Phase 1b (guardrail unit tests)**: Written alongside S-04/S-05 implementation, immediately after the validation functions are extracted into testable units. These tests are the cheap layer before the integration tests.
- **Phase 1c (integration tests)**: Written after S-05 ships the publish endpoint. These are the "server route" tests the test plan describes.

The plan document does not need to be updated — the phasing above is an implementation detail. But the `/10x-plan` for Phase 1 must scope to 1a only, and the plan must note that 1b/1c follow S-04/S-05.
