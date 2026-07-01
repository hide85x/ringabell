---
change_id: event-and-fight-management
title: Event and fight management
status: planned
created: 2026-06-24
updated: 2026-06-24
---

# S-04: Event and Fight Management — Implementation Plan

## Overview

Manager can create boxing events (gale), add fights to them, assign personnel to each fight and to the event itself, and publish the event once the roster is complete. Live validation warns about missing roles and date conflicts; publication is blocked until all issues are resolved.

## Current State Analysis

- Schema fully in place: `events`, `fights`, `fight_requirements`, `assignments` tables exist in `migrations/0001_init.sql`
- `fight_requirement_defaults` in `migrations/0002_dictionaries.sql` — Admin-managed defaults (role_id FK, count)
- `requireManager` guard exists at `server/utils/manager-guard.ts`
- `persons` CRUD and `person_roles` list endpoints exist (S-03) — reused for assignment dropdowns
- No event/fight/assignment API endpoints exist yet
- No Manager UI page for events exists yet

### Key Discoveries

- `fight_requirements.role` is TEXT (role name), while `fight_requirement_defaults.role_id` is FK — copying defaults to requirements requires a JOIN: `SELECT pr.name, frd.count FROM fight_requirement_defaults frd JOIN person_roles pr ON pr.id = frd.role_id`
- `assignments.type` is CHECK(`fight` | `event`) — fight assignments use `fight_id`, event assignments use `event_id`
- Cascade deletes already defined: fights cascade from events; fight_requirements and (implicitly) fight-type assignments cascade from fights
- `events.status` CHECK is already `draft | published | cancelled` — no migration needed
- No `event_requirement_defaults` table exists — per-event requirements (Ratownik, Konferansjer) are hardcoded in the publish guard; these role names must match what Admin seeded in `person_roles`

## Desired End State

Manager navigates to `/manager/events`, sees a list of events with their statuses, creates new events, opens an event modal to add fights and assign personnel. Each fight shows inline warnings when required roles are unfilled. Once all requirements are met, the publish button becomes active and triggers server-side validation before status changes to `published`.

### Verification

- `GET /api/manager/events` returns list of all events
- `POST /api/manager/events` creates a draft event
- `POST /api/manager/events/:id/publish` returns 422 with error list when validation fails; 200 when valid
- `/manager/events` page loads, Manager can create event → add fights → assign persons → publish

## What We're NOT Doing

- No email sending (S-05)
- No per-fight customisation of requirements (auto-copy from defaults only)
- No reactivation of cancelled events
- No assignment history tracking beyond current state
- No pagination on events list (small scale per PRD)
- No per-fight order_number editing via UI (auto-incremented on create)

## Implementation Approach

Three phases: API for events CRUD + publish guard → API for fights + assignments + event detail endpoint → UI single page with modals. Each phase has integration tests before UI so API is verified independently.

## Critical Implementation Details

**Hardcoded role names in publish guard**: The per-event check (ratownik + konferansjer) uses hardcoded Polish role names `'Ratownik'` and `'Konferansjer'`. These must match exactly what Admin has in `person_roles`. Document this assumption; if Admin renames these roles, the guard breaks silently.

**fight_requirement_defaults JOIN**: When creating a fight, copy defaults via: `SELECT pr.name AS role, frd.count FROM fight_requirement_defaults frd JOIN person_roles pr ON pr.id = frd.role_id`. If defaults table is empty (no roles defined in S-02), the fight is created with no requirements — publish guard per-fight check passes vacuously.

**GET event detail assembles from 5–7 D1 queries**: D1 does not support lateral joins or complex CTEs reliably. The `GET /api/manager/events/:id` handler runs separate `.all()` queries and assembles the result in JS. Order: event → fights → requirements → fight assignments → event assignments → available persons → conflicting person IDs.

**Event editing allowed when published**: PATCH `/api/manager/events/:id` accepts changes to `name`, `date`, `venue` regardless of status (draft or published). Cancelled events are blocked (409). S-05 will re-send emails when date/venue changes on a published event.

---

## Phase 1: Events CRUD API

### Overview

Six server endpoints covering the full event lifecycle: list, create, get detail, edit, delete (draft only), publish (with validation guard), cancel. RBAC and publish-guard integration tests.

### Changes Required

#### 1. GET /api/manager/events

**File**: `server/api/manager/events/index.get.ts`

**Intent**: Return all events ordered by date DESC. Includes fight count per event (for list display).

**Contract**: Requires `requireManager`. Query: `SELECT e.id, e.name, e.date, e.venue, e.status, e.created_at AS createdAt, COUNT(f.id) AS fightCount FROM events e LEFT JOIN fights f ON f.event_id = e.id GROUP BY e.id ORDER BY e.date DESC`. Returns array.

#### 2. POST /api/manager/events

**File**: `server/api/manager/events/index.post.ts`

**Intent**: Create a new event in `draft` status.

**Contract**: Requires `requireManager`. Required body fields: `name` (non-empty string), `date` (non-empty, ISO date `YYYY-MM-DD`), `venue` (non-empty). Inserts with `status='draft'`, `nowUtc()`. Returns `{ ok: true, id }` (201).

#### 3. GET /api/manager/events/:id

**File**: `server/api/manager/events/[id].get.ts`

**Intent**: Return full event detail for the modal — event + fights with their requirements and assignments + event-level assignments + available persons + conflicting person IDs.

**Contract**: Requires `requireManager`. Runs queries in sequence (D1 limitation — no lateral joins):
1. Event by id → 404 if missing
2. Fights for event ordered by `order_number ASC`
3. `fight_requirements` for those fight IDs (if any fights)
4. Fight assignments joined with `persons.name` for those fight IDs
5. Event assignments (`type='event'`, `event_id=?`) joined with `persons.name`
6. All active persons (`is_active=1`) for dropdowns
7. Conflicting person IDs: persons assigned to another non-cancelled event on the same date

Return shape (assembled in JS):
```typescript
{
  id, name, date, venue, status, createdAt,
  fights: [{ id, orderNumber, requirements: [{role, count}], assignments: [{id, personId, personName, role}] }],
  eventAssignments: [{ id, personId, personName, role }],
  availablePersons: [{ id, name, role }],
  conflictingPersonIds: string[]
}
```

#### 4. PATCH /api/manager/events/:id

**File**: `server/api/manager/events/[id].patch.ts`

**Intent**: Edit event name, date, or venue. Allowed for `draft` and `published` status; returns 409 for `cancelled`.

**Contract**: Requires `requireManager`. Dynamic SET clause (same pattern as `[id].patch.ts` in personnel). Accepted fields: `name`, `date`, `venue`. Fetch current status first; throw 409 if `cancelled`. Returns `{ ok: true }`, 404 if not found.

#### 5. DELETE /api/manager/events/:id

**File**: `server/api/manager/events/[id].delete.ts`

**Intent**: Hard-delete event. Only allowed in `draft` status; returns 409 otherwise. Schema cascade handles fights, fight_requirements, and fight-type assignments automatically.

**Contract**: Requires `requireManager`. Fetch status first; throw 409 if not `draft`. `DELETE FROM events WHERE id = ?`. Returns `{ ok: true }`, 404 if not found.

#### 6. POST /api/manager/events/:id/publish

**File**: `server/api/manager/events/[id]/publish.post.ts`

**Intent**: Publish event after server-side validation. Returns 422 with `{ errors: string[] }` if any check fails.

**Contract**: Requires `requireManager`. Validation sequence:
1. Event exists and is `draft` (409 if already published/cancelled)
2. At least 1 fight exists
3. For each fight: `COUNT(assignments) by role >= fight_requirements.count` for that role
4. Event has ≥1 assignment with `role='Ratownik'` and `type='event'`
5. Event has ≥1 assignment with `role='Konferansjer'` and `type='event'`
6. No person in this event's assignments also assigned to a non-cancelled event on the same date

On success: `UPDATE events SET status='published' WHERE id=?`, return `{ ok: true }`.
On failure: `throw createError({ statusCode: 422, data: { errors: string[] } })`.

#### 7. POST /api/manager/events/:id/cancel

**File**: `server/api/manager/events/[id]/cancel.post.ts`

**Intent**: Cancel event (draft or published → cancelled). Does not delete data.

**Contract**: Requires `requireManager`. Fetch event; 404 if missing, 409 if already cancelled. `UPDATE events SET status='cancelled' WHERE id=?`. Returns `{ ok: true }`.

#### 8. Integration tests

**File**: `server/api/manager/events/events.rbac.integration.test.ts`

**Intent**: Verify RBAC on events endpoints — 401 unauthenticated, 403 Personel, 200 Manager, 200 Admin.

**File**: `server/api/manager/events/events.publish-guard.integration.test.ts`

**Intent**: Verify publish guard rejects invalid states. Test cases (all via worker.fetch API calls to set up state):
- Publish event with no fights → 422
- Publish event with fight but no assignments → 422 (missing roles per fight)
- Publish event with complete fights but missing Ratownik → 422
- Publish event with complete fights + Ratownik but missing Konferansjer → 422

Also add to `test/fixtures/seed.sql`:
- `DELETE FROM assignments WHERE id LIKE 'test-%';`
- `DELETE FROM fights WHERE id LIKE 'test-%';`
- `DELETE FROM events WHERE id LIKE 'test-%';`
- `DELETE FROM fight_requirement_defaults WHERE role_id = 'test-role-001';`
- `INSERT INTO fight_requirement_defaults (id, role_id, count) VALUES ('test-frd-001', 'test-role-001', 2);`

### Success Criteria

#### Automated Verification

- `npm run test:integration` passes — RBAC and publish-guard tests green
- TypeScript build passes: `npm run build`

#### Manual Verification

- `GET /api/manager/events` returns `[]` for fresh local DB
- `POST /api/manager/events` with `{ name, date, venue }` returns 201 `{ ok: true, id }`
- `POST /api/manager/events/:id/publish` on empty event returns 422

**Implementation Note**: Pause after Phase 1 automated verification passes; confirm manual checks before Phase 2.

---

## Phase 2: Fights & Assignments API

### Overview

Fight creation (with auto-copy of requirements from defaults), fight deletion (cascade), person assignment to fight or event, assignment removal, and the full event detail GET endpoint.

### Changes Required

#### 1. POST /api/manager/events/:id/fights

**File**: `server/api/manager/events/[id]/fights/index.post.ts`

**Intent**: Add a fight to a draft event. Auto-copies `fight_requirement_defaults` into `fight_requirements` for the new fight.

**Contract**: Requires `requireManager`. Fetch event; 404 if missing, 409 if not `draft`. `order_number` = `COUNT(existing fights) + 1`. Insert fight with `nowUtc()`. Then copy requirements:
```sql
SELECT pr.name AS role, frd.count
FROM fight_requirement_defaults frd
JOIN person_roles pr ON pr.id = frd.role_id
```
Insert one row into `fight_requirements` per result row. Returns `{ ok: true, id }` (201).

#### 2. DELETE /api/manager/events/:id/fights/:fightId

**File**: `server/api/manager/events/[id]/fights/[fightId].delete.ts`

**Intent**: Remove a fight from a draft event. Schema cascade deletes `fight_requirements` and fight-type `assignments` automatically.

**Contract**: Requires `requireManager`. Verify fight belongs to event (join check); 404 if not found. 409 if event is not `draft`. `DELETE FROM fights WHERE id = ?`. Returns `{ ok: true }`.

#### 3. POST /api/manager/assignments

**File**: `server/api/manager/assignments/index.post.ts`

**Intent**: Assign a person to a fight (type=`fight`) or to the event (type=`event`).

**Contract**: Requires `requireManager`. Required body: `personId`, `role`, `type` (`fight` | `event`), plus `fightId` if type=`fight` or `eventId` if type=`event`. Validate: person exists and is active; if type=`fight`, fight exists; if type=`event`, event exists. Insert with `nowUtc()`. Returns `{ ok: true, id }` (201).

No uniqueness constraint enforced at API level — duplicate assignments are allowed (UI prevents them via slot logic).

#### 4. DELETE /api/manager/assignments/:id

**File**: `server/api/manager/assignments/[id].delete.ts`

**Intent**: Remove a person assignment (unassign from fight or event).

**Contract**: Requires `requireManager`. `DELETE FROM assignments WHERE id = ?`. Returns `{ ok: true }`, 404 if not found.

### Success Criteria

#### Automated Verification

- `npm run test:integration` still passes (no regressions)
- TypeScript build passes: `npm run build`

#### Manual Verification

- `POST /api/manager/events/:id/fights` on a draft event creates a fight; `GET /api/manager/events/:id` shows the fight with its requirements
- `POST /api/manager/assignments` assigns a person; response `{ ok: true, id }`
- `DELETE /api/manager/assignments/:id` removes assignment; subsequent GET no longer shows it
- `DELETE /api/manager/events/:id/fights/:fightId` removes fight and its requirements

**Implementation Note**: Pause after Phase 2 automated verification passes; confirm manual checks before Phase 3.

---

## Phase 3: Events UI

### Overview

Single page `/manager/events` with table of events and two modal layers: "add event" modal (simple form) and "event detail" modal (fights + assignments + validation + publish/cancel).

### Changes Required

#### 1. Route middleware

**File**: `app/middleware/manager.ts`

**Intent**: Already exists from S-03 — no change needed.

#### 2. Events list page

**File**: `app/pages/manager/events.vue`

**Intent**: Full events management page. Mirrors `personnel.vue` structure but with nested event detail modal.

**Contract**:

```
definePageMeta({ middleware: 'manager' })
useFetch('/api/manager/events') → EventListItem[]
useFetch('/api/manager/dictionaries/roles') → for role display
```

**Add event modal** (button: `+ DODAJ GALĘ`):
- `name` text input (required)
- `date` date input (required, type="date")
- `venue` text input (required)
- Submit → POST `/api/manager/events` → refresh list

**Events table columns**: NAZWA, DATA, MIEJSCE, STATUS (badge: SZKIC / OPUBLIKOWANA / ANULOWANA), WALKI (count), [OTWÓRZ]

**Event detail modal** (opens on OTWÓRZ click):
- Fetches `GET /api/manager/events/:id` on open
- Header: event name + status badge + edit fields (name/date/venue, PATCH on save)
- **Fights section**: list of fights, each showing:
  - Fight number (`#1`, `#2`, …)
  - Per-role assignment rows: for each requirement slot, a `<select>` of available persons filtered by role. Pre-filled if already assigned. On change: DELETE old assignment (if any) + POST new assignment.
  - Inline validation badge: red "BRAKUJE: [role names]" if any slot unfilled; green "OK" if all filled.
- **Obsługa gali section** (event-level):
  - Ratownik: `<select>` of persons with role='Ratownik'
  - Konferansjer: `<select>` of persons with role='Konferansjer'
  - Same DELETE+POST pattern on change.
- **Footer**: 
  - If draft: `STWÓRZ GALĘ` button (POST publish, disabled if any validation error exists), `ANULUJ GALĘ` button
  - If published: `ANULUJ GALĘ` button, read-only status badge
  - If cancelled: read-only status badge only
- **Add fight**: `+ DODAJ WALKĘ` button → POST fights endpoint → refresh detail
- **Remove fight**: `USUŃ` button per fight → DELETE fights endpoint → refresh detail (only in draft)

**Conflict indicator**: persons in `conflictingPersonIds` show "(KONFLIKT)" suffix in dropdown options.

**Validation state** (computed client-side, no extra API call):
- Per fight: count filled slots per role vs requirements → show inline warning
- Per event: check Ratownik and Konferansjer event assignments present
- `canPublish = allFightsValid && hasRatownik && hasKonferansjer && noConflicts`
- `STWÓRZ GALĘ` disabled when `!canPublish`

#### 3. AdminNav link

**File**: `app/components/AdminNav.vue`

**Intent**: Add GALE nav link alongside USERS, DICTIONARIES, PERSONEL so Admin can navigate to events page.

**Contract**: Add `<a href="/manager/events" class="nav-link" :class="{ active: route.path.startsWith('/manager/events') }">GALE</a>` to the nav-links div.

#### 4. ManagerNav link

**File**: `app/components/ManagerNav.vue`

**Intent**: Add GALE nav link for Manager users.

**Contract**: Add GALE link before PERSONEL in the nav-links block (visible to both Admin and Manager — not inside the `v-if="isAdmin"` block).

#### 5. index.vue shortcut

**File**: `app/pages/index.vue`

**Intent**: Add "ZARZĄDZAJ GALAMI →" link next to the existing personnel link.

**Contract**: Add `<a v-if="user?.role === 'Admin' || user?.role === 'Manager'" href="/manager/events" class="btn-manager">ZARZĄDZAJ GALAMI →</a>` after the existing personnel link.

### Success Criteria

#### Automated Verification

- `npm run build` passes (no TypeScript errors, no ESLint errors)

#### Manual Verification

- 3.M1 `/manager/events` loads, table shows events (empty on fresh DB is OK)
- 3.M2 Add event → appears in table with status SZKIC
- 3.M3 Open event → add fight → fight appears with assignment dropdowns
- 3.M4 Assign persons to all required fight slots → per-fight validation turns green
- 3.M5 Assign Ratownik and Konferansjer to event → `STWÓRZ GALĘ` button activates
- 3.M6 Click `STWÓRZ GALĘ` → status changes to OPUBLIKOWANA
- 3.M7 `ANULUJ GALĘ` on published event → status changes to ANULOWANA
- 3.M8 Try to publish event with missing roles → button disabled (client) or 422 (if bypassed)

**Implementation Note**: Pause after Phase 3 automated verification passes; confirm manual checks before epilogue commit.

---

## Testing Strategy

### Integration Tests

- `events.rbac.integration.test.ts`: 401/403/200/200 on `GET /api/manager/events`
- `events.publish-guard.integration.test.ts`: 422 for each invalid publish state (no fights, missing fight roles, missing Ratownik, missing Konferansjer)

### Manual Testing Steps

1. Create event, verify draft status
2. Add 2 fights, verify requirements auto-copied
3. Assign all persons, verify validation badges turn green
4. Publish, verify status change
5. Try editing date on published event — should succeed
6. Cancel published event, verify status

## References

- PRD: `context/foundation/prd.md` — FR-006 through FR-012
- Schema: `migrations/0001_init.sql`, `migrations/0002_dictionaries.sql`
- Personnel pattern: `server/api/manager/personnel/` — follow identical patterns
- UI pattern: `app/pages/manager/personnel.vue` — base structure for events page
- S-05 note: re-send email when published event date/venue changes (decided 2026-06-24)

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Events CRUD API

#### Automated

- [x] 1.1 GET /api/manager/events — list all events
- [x] 1.2 POST /api/manager/events — create draft event
- [x] 1.3 GET /api/manager/events/:id — full detail (fights + assignments + persons + conflicts)
- [x] 1.4 PATCH /api/manager/events/:id — edit name/date/venue (draft + published)
- [x] 1.5 DELETE /api/manager/events/:id — delete draft only
- [x] 1.6 POST /api/manager/events/:id/publish — guard + status change
- [x] 1.7 POST /api/manager/events/:id/cancel — status change
- [x] 1.8 RBAC integration test
- [x] 1.9 Publish-guard integration tests
- [x] 1.10 Update test/fixtures/seed.sql (events/fights/assignments cleanup + fight_requirement_defaults seed)

#### Manual

- [x] 1.M1 GET /api/manager/events returns [] on fresh DB
- [x] 1.M2 POST + publish 422 on empty event verified

### Phase 2: Fights & Assignments API

#### Automated

- [x] 2.1 POST /api/manager/events/:id/fights — create fight + auto-copy requirements
- [x] 2.2 DELETE /api/manager/events/:id/fights/:fightId — delete fight (cascade)
- [x] 2.3 POST /api/manager/assignments — assign person to fight or event
- [x] 2.4 DELETE /api/manager/assignments/:id — remove assignment

#### Manual

- [x] 2.M1 Create fight → GET event detail shows fight with requirements
- [x] 2.M2 Assign person → GET shows assignment; DELETE → gone

### Phase 3: Events UI

#### Automated

- [x] 3.1 Create app/pages/manager/events.vue
- [x] 3.2 Add GALE link to AdminNav.vue and ManagerNav.vue
- [x] 3.3 Add ZARZĄDZAJ GALAMI link to index.vue
- [x] 3.4 npm run build passes

#### Manual

- [x] 3.M1 /manager/events loads, table visible
- [x] 3.M2 Add event → appears in table
- [x] 3.M3 Open event → add fight → assignment dropdowns shown
- [x] 3.M4 Assign all fight slots → inline validation green
- [x] 3.M5 Assign Ratownik + Konferansjer → STWÓRZ GALĘ activates
- [x] 3.M6 Publish → status OPUBLIKOWANA
- [x] 3.M7 Cancel published event → status ANULOWANA
- [x] 3.M8 Publish guard bypass test (422 from server)
