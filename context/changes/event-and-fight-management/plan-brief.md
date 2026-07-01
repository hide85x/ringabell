# Event and Fight Management — Plan Brief

> Full plan: `context/changes/event-and-fight-management/plan.md`

## What & Why

Manager can create boxing events, add fights, assign personnel to fights and to the event, and publish once the roster is complete. This is S-04 — the last prerequisite before S-05 (the North Star: publish event + send emails).

## Starting Point

Schema is fully in place (`events`, `fights`, `fight_requirements`, `assignments`). S-03 delivered persons CRUD and `requireManager` guard. No event/fight API endpoints or UI exist yet.

## Desired End State

Manager opens `/manager/events`, creates a gala, adds fights (requirements auto-filled from Admin-configured defaults), assigns persons per role slot, sees inline validation, and publishes when roster is complete. Server-side publish guard enforces all business rules before status change.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Slice scope | All in one slice | No half-deployed features | Plan |
| UI structure | Single page with modals | Consistent with personnel.vue; user chose simplicity | Plan |
| Fight requirements | Auto-copy from defaults on create | No per-fight manual setup; matches PRD defaults | Plan |
| Validation display | Inline per fight | Manager sees problem exactly where it is | Plan |
| Assignment UI | Select per role slot | Clear how many slots are filled vs required | Plan |
| Editing after publish | Allowed (date/venue) | Real business need; only DELETE is blocked by PRD | Plan |
| Publish guard | Server-side (422 with error list) | UI can be bypassed; safety at API level | Plan |
| Conflict detection | Client-side from GET detail data | Zero extra round-trips; data already fetched | Plan |
| Event cancellation | PATCH status → 'cancelled' | PRD FR-007; no hard delete after publish | Plan |
| Tests | RBAC + publish-guard 422 cases | Highest business risk; CRUD is trivial code | Plan |
| S-05 note | Re-send email on date/venue change | User decision during planning session | Plan |

## Scope

**In scope:** Events CRUD (GET list, GET detail, POST, PATCH, DELETE draft), fights CRUD, assignments (fight + event level), publish guard, cancel, UI page, nav links.

**Out of scope:** Email sending (S-05), per-fight custom requirements, event reactivation, assignment history, pagination.

## Architecture / Approach

All new endpoints under `server/api/manager/events/` and `server/api/manager/assignments/`. GET `/api/manager/events/:id` runs 5–7 D1 queries and assembles full detail in JS (no lateral joins). Publish guard validates in sequence: fights exist → per-fight requirements met → Ratownik present → Konferansjer present → no date conflicts. UI is one page with modals; client-side validation mirrors server rules for instant feedback.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Events CRUD API | 7 endpoints + integration tests | Publish guard logic complexity |
| 2. Fights & Assignments API | 4 endpoints; GET detail endpoint | Multiple D1 queries assembled correctly |
| 3. Events UI | Single page, modals, inline validation | Nested modal complexity with assignments |

**Prerequisites:** S-03 done (persons + requireManager), D1 schema in place, `fight_requirement_defaults` seeded by Admin (S-02).

## Open Risks & Assumptions

- Hardcoded role names `'Ratownik'` and `'Konferansjer'` in publish guard — breaks if Admin renames these roles in dictionaries
- D1 multi-query assembly in GET detail — must handle edge case where event has 0 fights (skip queries 3-4)
- `fight_requirement_defaults` may be empty if Admin hasn't configured defaults — fights created with no requirements; publish guard per-fight check passes vacuously

## Success Criteria (Summary)

- Manager can create event → add fights → assign all roles → publish in one UI flow
- POST /api/manager/events/:id/publish returns 422 with actionable error list when roster incomplete
- All integration tests pass; `npm run build` clean
