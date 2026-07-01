---
date: 2026-06-18T20:00:00Z
researcher: Claude Sonnet 4.6
git_commit: 5a12f47289231a263da5ab8a869a33f795968c1f
branch: personnel-management
repository: boxing-promoter
topic: "S-03 Personnel management — CRUD for persons, soft-delete, role assignment"
tags: [research, personnel, person, crud, manager, d1, rbac]
status: complete
last_updated: 2026-06-18
last_updated_by: Claude Sonnet 4.6
---

# Research: S-03 Personnel Management

**Date**: 2026-06-18
**Branch**: personnel-management
**Git Commit**: 5a12f47

## Research Question

What exists in the codebase for the `persons` table, what CRUD patterns should S-03 follow, and what gaps need to be filled to implement FR-004 and FR-005?

## Summary

The `persons` D1 table and TypeScript model already exist from the data-scaffold (F-02). No API endpoints exist yet. The CRUD pattern from S-01/S-02 is clear and consistent — manual validation, `getD1()`, `createError()`, file-per-verb routing. The only missing infrastructure piece is a **Manager-level auth guard** (only `requireAdmin` exists today). The `persons.role` column stores a single role name as TEXT — this needs design clarification before planning (see Open Questions).

## Detailed Findings

### Person model and D1 schema

**TypeScript interface** — [server/models/person.ts](server/models/person.ts):
```typescript
export interface Person {
  id?: string
  name: string
  email?: string
  phone?: string
  role: string       // single role name, TEXT
  isActive: boolean  // mapped from is_active INTEGER
  createdAt: string
}
```

**D1 table** — `migrations/0001_init.sql`:
```sql
CREATE TABLE persons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
```

**PersonRole dictionary** — `migrations/0002_dictionaries.sql`:
```sql
CREATE TABLE person_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
```

`persons.role` stores the role **name** as plain TEXT — not a FK to `person_roles.id`. The dictionaries DELETE handler already handles this: checks `SELECT id FROM persons WHERE role = ?` before deleting a role.

### Existing API coverage

**No endpoints for `persons` table exist.** The table was created in F-02 but left empty — S-03 is where all CRUD lands.

Only existing reference to `persons` table: `server/api/admin/dictionaries/roles/[id].delete.ts` — checks if a role is in use before deletion.

### CRUD pattern to follow (from S-01/S-02)

**File layout** (Nuxt 3 file-based routing):
```
server/api/manager/personnel/
  index.get.ts      → GET  /api/manager/personnel
  index.post.ts     → POST /api/manager/personnel
  [id].patch.ts     → PATCH /api/manager/personnel/:id
  [id].delete.ts    → DELETE /api/manager/personnel/:id  (soft-delete)
```

**Handler skeleton** (from S-01 pattern):
```typescript
import { nowUtc } from '~~/utils/date'

export default defineEventHandler(async (event) => {
  await requireManager(event)              // new guard — see below
  const db = getD1(event)
  // ... validate input with createError({ statusCode: 400, ... })
  // ... query D1 with db.prepare('...').bind(...).run()
  // ... return { ok: true } or { ok: true, id }
})
```

**Key helpers** (all auto-imported):
- `getD1(event)` — `server/utils/db.ts:3`
- `requireAdmin(event)` — `server/utils/admin-guard.ts:3` (Admin pattern to copy for Manager)
- `readBody<T>(event)`, `getRouterParam(event, 'id')`, `createError()`, `setResponseStatus()` — H3 auto-imports
- `nowUtc()` — `utils/date.ts` (must use, per lessons.md)
- `crypto.randomUUID()` — for new record IDs

**Validation style**: manual `if` checks, no Zod. Match existing pattern.

**Response shapes**:
- GET list → `return results` (raw array)
- POST → `setResponseStatus(event, 201); return { ok: true, id }`
- PATCH / soft-delete → `return { ok: true }`
- Not found → `throw createError({ statusCode: 404, ... })` (check `result.meta.changes === 0`)

### RBAC gap: no Manager guard

`server/utils/admin-guard.ts` exports only `requireAdmin`. There is **no `requireManager`** or generic role guard.

S-03 routes belong to Manager role (FR-004). Need to create:

```typescript
// server/utils/manager-guard.ts
export async function requireManager(event: H3Event) {
  const session = await requireUserSession(event)
  if (!['Admin', 'Manager'].includes(session.user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return session
}
```

Note: Admin should also be able to access Manager routes (superuser pattern consistent with PRD Access Control).

### Role: single vs. multiple

Current schema: `persons.role TEXT NOT NULL` — one role per person.

PRD FR-005: "Manager może przypisywać **kategorie ról** do osoby (bokser, sędzia, lekarz itp.)" — uses plural "kategorie".

PRD Business Logic: "Per walka: każda walka wymaga dokładnie 2 bokserów, 1 sędziego ringowego..." — assignment validation uses role type per fight slot.

**Risk**: if a person can have multiple roles (e.g., sędzia + lekarz), the current single-column schema is insufficient and a junction table `person_role_assignments(person_id, role_id)` would be needed. This needs clarification before writing the plan.

## Code References

- `server/models/person.ts` — Person interface
- `server/models/personRole.ts` — PersonRole interface
- `migrations/0001_init.sql` — persons table DDL
- `migrations/0002_dictionaries.sql` — person_roles + fight_requirement_defaults DDL
- `server/utils/db.ts:3` — getD1 helper
- `server/utils/admin-guard.ts:3` — requireAdmin pattern to copy
- `server/api/admin/users/index.get.ts` — GET list pattern
- `server/api/admin/users/index.post.ts` — POST create pattern
- `server/api/admin/users/[id].patch.ts` — PATCH update pattern
- `server/api/admin/users/[id].delete.ts` — DELETE pattern
- `server/api/admin/dictionaries/roles/[id].delete.ts` — referential integrity check pattern

## Architecture Insights

1. **No abstraction layer** — validation and queries live directly in route handlers. Follow the same pattern for S-03.
2. **Soft-delete via `is_active`** — column already exists in schema. PATCH `is_active = 0` is the deactivation path; no separate DELETE needed. The `[id].delete.ts` file can implement soft-delete (set `is_active = 0`) rather than hard DELETE.
3. **Manager route namespace** — currently all API routes are under `/api/admin/`. S-03 should live under `/api/manager/personnel/` to reflect role ownership and match PRD Access Control.
4. **`persons.role` references `person_roles.name`** — not a FK. The dictionaries handler protects against orphaned roles by checking `persons` before deleting a role. This is acceptable but means role renames would not cascade.

## Open Questions

1. **Single vs. multiple roles per person**: Does a person have one role or can they have multiple? PRD says "kategorie ról" (plural) in FR-005. If multiple → junction table needed, schema migration required. If single → current schema sufficient. **This decision must be made before writing plan.md.**

2. **Route placement**: `/api/manager/personnel/` or `/api/admin/personnel/`? PRD says Manager manages personnel (FR-004). Admin manages users and dictionaries. Manager namespace seems correct.

3. **Deactivation vs hard DELETE**: PRD FR-004 explicitly says "dezaktywacja" (soft-delete). No hard DELETE needed. The `[id].delete.ts` file should implement `UPDATE persons SET is_active = 0`.
