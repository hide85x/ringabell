---
change_id: personnel-management
title: Personnel management
status: implemented
created: 2026-06-18
updated: 2026-06-24
---

# Plan: S-03 Personnel Management

## Problem & Goal

The `persons` table exists in D1 (F-02) but has no API endpoints or UI. A secondary issue was
discovered during research: the Admin user DELETE endpoint has no guard against deleting the last Admin.

This plan delivers:
1. A `requireManager` auth guard (Admin + Manager roles)
2. A last-Admin deletion guard in `server/api/admin/users/[id].delete.ts`
3. CRUD API for persons under `/api/manager/personnel/`
4. A Manager-accessible roles GET endpoint (needed for person create/edit UI)
5. Personnel management UI page at `/manager/personnel`

**PRD refs**: FR-004, FR-005

---

## Success Criteria

- Manager can add, edit, and deactivate persons via the UI at `/manager/personnel`
- Each person has exactly one role from the `person_roles` dictionary (no junction table)
- GET `/api/manager/personnel` returns only active persons (is_active = 1)
- PATCH can update any of: name, email, phone, role, is_active (including reactivation)
- DELETE soft-deletes (sets is_active = 0; no hard DELETE)
- Personel role → 403 on any `/api/manager/` endpoint; unauthenticated → 401
- Attempting to hard-delete the last Admin user → 409 Conflict

---

## Architecture & Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Route namespace | `/api/manager/personnel/` | Matches PRD Access Control (Manager owns persons) |
| requireManager | allows Admin + Manager | Superuser pattern consistent with PRD |
| GET list | Active only (is_active = 1) | Manager sees working roster; inactive hidden from selection dropdowns |
| PATCH scope | All fields: name, email, phone, role, is_active | Single endpoint covers edits + reactivation |
| Soft-delete endpoint | DELETE → UPDATE is_active = 0 | PRD FR-004 explicit: dezaktywacja, not hard DELETE |
| Last-Admin guard | DELETE only, not PATCH role change | Fixes reported vulnerability with minimal scope |
| roles GET for Manager | New `/api/manager/dictionaries/roles/index.get.ts` | Keeps admin CRUD namespace clean; Manager needs read-only access for person forms |
| SQL aliasing | `is_active AS isActive`, `created_at AS createdAt` | Matches pattern from admin/users GET |
| Validation | Manual if-checks, no Zod | Consistent with S-01/S-02 |
| UI pattern | Single `personnel.vue` + add/edit modals | Matches `admin/users.vue` exactly |
| UI inactive | Not shown; no reactivation in MVP UI | PATCH can do it via API; UI toggle is post-MVP |

---

## Phases

---

### Phase 1: Auth infrastructure + last-Admin fix

**Goal**: New `requireManager` server guard, Nuxt route middleware, and fix the last-Admin deletion vulnerability.

#### Files

| Action | Path |
|---|---|
| Create | `server/utils/manager-guard.ts` |
| Edit   | `server/api/admin/users/[id].delete.ts` |
| Create | `app/middleware/manager.ts` |
| Create | `server/api/manager/personnel/personnel.rbac.integration.test.ts` |

#### Implementation details

**1.1 — `server/utils/manager-guard.ts`**

```typescript
import type { H3Event } from 'h3'

export async function requireManager(event: H3Event) {
  const session = await requireUserSession(event)
  if (!['Admin', 'Manager'].includes(session.user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return session
}
```

**1.2 — Fix `server/api/admin/users/[id].delete.ts`**

Add a last-Admin guard before the DELETE. Check whether the target user has role `'Admin'`
and, if so, whether they are the only remaining Admin. Block with 409 if true.

```typescript
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  const db = getD1(event)

  // Last-Admin guard
  const target = await db
    .prepare('SELECT role FROM users WHERE id = ?')
    .bind(id)
    .first<{ role: string }>()
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }
  if (target.role === 'Admin') {
    const { count } = await db
      .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Admin'")
      .first<{ count: number }>() ?? { count: 0 }
    if (count <= 1) {
      throw createError({ statusCode: 409, statusMessage: 'Cannot delete the last Admin' })
    }
  }

  await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
  return { ok: true }
})
```

Note: The original `result.meta.changes === 0` 404 check is replaced by the explicit SELECT above.

**1.3 — `app/middleware/manager.ts`**

```typescript
export default defineNuxtRouteMiddleware(() => {
  const { user } = useUserSession()
  if (!['Admin', 'Manager'].includes(user.value?.role ?? '')) {
    return navigateTo('/')
  }
})
```

**1.4 — RBAC integration test**

File: `server/api/manager/personnel/personnel.rbac.integration.test.ts`

Use `getSession(worker, role)` from `test/helpers/server.ts`. Test four paths on `GET /api/manager/personnel`:
- No cookie → 401
- `Personel` session → 403
- `Manager` session → 200
- `Admin` session → 200

Pattern: `test-plan.md §6.3` (manager guard uses the same shape as admin guard).

#### Progress

##### Automated
- [x] 1.1 Create server/utils/manager-guard.ts — c72b9c9
- [x] 1.2 Fix server/api/admin/users/[id].delete.ts — last-Admin guard — c72b9c9
- [x] 1.3 Create app/middleware/manager.ts — c72b9c9
- [x] 1.4 RBAC integration test — personnel.rbac.integration.test.ts — c72b9c9

##### Manual
- [x] 1.M1 Verify: `npm run test:integration` passes (RBAC test)
- [x] 1.M2 Verify: admin UI can still delete a non-last Admin user normally

---

### Phase 2: Personnel CRUD API

**Goal**: Five endpoints — a Manager-accessible roles list, plus GET/POST/PATCH/DELETE for persons.

#### Files

| Action | Path |
|---|---|
| Create | `server/api/manager/dictionaries/roles/index.get.ts` |
| Create | `server/api/manager/personnel/index.get.ts` |
| Create | `server/api/manager/personnel/index.post.ts` |
| Create | `server/api/manager/personnel/[id].patch.ts` |
| Create | `server/api/manager/personnel/[id].delete.ts` |
| Create | `server/api/manager/personnel/personnel.validation.integration.test.ts` |

#### Implementation details

**2.1 — `server/api/manager/dictionaries/roles/index.get.ts`**

Read-only roles list. Uses `requireManager` (Admin can also call it). Returns `{ id, name }`.

```typescript
export default defineEventHandler(async (event) => {
  await requireManager(event)
  const db = getD1(event)
  const { results } = await db
    .prepare('SELECT id, name FROM person_roles ORDER BY name ASC')
    .all()
  return results
})
```

**2.2 — `server/api/manager/personnel/index.get.ts`**

Active persons only, ordered by name. Aliases snake_case → camelCase.

```typescript
export default defineEventHandler(async (event) => {
  await requireManager(event)
  const db = getD1(event)
  const { results } = await db
    .prepare(
      'SELECT id, name, email, phone, role, is_active AS isActive, created_at AS createdAt FROM persons WHERE is_active = 1 ORDER BY name ASC'
    )
    .all()
  return results
})
```

**2.3 — `server/api/manager/personnel/index.post.ts`**

Required fields: `name` (trimmed, non-empty), `role` (must exist in `person_roles`). Optional: `email`, `phone`.

```typescript
export default defineEventHandler(async (event) => {
  await requireManager(event)
  const body = await readBody<{ name?: string; email?: string; phone?: string; role?: string }>(event)

  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }
  if (!body?.role?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'role is required' })
  }

  const db = getD1(event)
  const roleRow = await db
    .prepare('SELECT id FROM person_roles WHERE name = ?')
    .bind(body.role)
    .first()
  if (!roleRow) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid role' })
  }

  const id = crypto.randomUUID()
  await db
    .prepare(
      'INSERT INTO persons (id, name, email, phone, role, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
    )
    .bind(id, body.name.trim(), body.email?.trim() ?? null, body.phone?.trim() ?? null, body.role, nowUtc())
    .run()

  setResponseStatus(event, 201)
  return { ok: true, id }
})
```

**2.4 — `server/api/manager/personnel/[id].patch.ts`**

Accepts any subset of `{ name, email, phone, role, is_active }`. At least one field required. Builds SET clause dynamically. Validates: `role` must exist in `person_roles` if provided; `is_active` must be `0` or `1` if provided.

```typescript
export default defineEventHandler(async (event) => {
  await requireManager(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody<{
    name?: string
    email?: string | null
    phone?: string | null
    role?: string
    is_active?: number
  }>(event)

  const db = getD1(event)
  const sets: string[] = []
  const vals: unknown[] = []

  if (body?.name !== undefined) {
    if (!body.name?.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'name cannot be empty' })
    }
    sets.push('name = ?'); vals.push(body.name.trim())
  }
  if (body?.email !== undefined) {
    sets.push('email = ?'); vals.push(body.email?.trim() ?? null)
  }
  if (body?.phone !== undefined) {
    sets.push('phone = ?'); vals.push(body.phone?.trim() ?? null)
  }
  if (body?.role !== undefined) {
    const roleRow = await db
      .prepare('SELECT id FROM person_roles WHERE name = ?')
      .bind(body.role)
      .first()
    if (!roleRow) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid role' })
    }
    sets.push('role = ?'); vals.push(body.role)
  }
  if (body?.is_active !== undefined) {
    if (body.is_active !== 0 && body.is_active !== 1) {
      throw createError({ statusCode: 400, statusMessage: 'is_active must be 0 or 1' })
    }
    sets.push('is_active = ?'); vals.push(body.is_active)
  }

  if (sets.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  vals.push(id)
  const result = await db
    .prepare(`UPDATE persons SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...vals)
    .run()

  if (result.meta.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Person not found' })
  }
  return { ok: true }
})
```

**2.5 — `server/api/manager/personnel/[id].delete.ts`**

Soft-delete only: sets `is_active = 0`.

```typescript
export default defineEventHandler(async (event) => {
  await requireManager(event)
  const id = getRouterParam(event, 'id')
  const db = getD1(event)
  const result = await db
    .prepare('UPDATE persons SET is_active = 0 WHERE id = ?')
    .bind(id)
    .run()
  if (result.meta.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Person not found' })
  }
  return { ok: true }
})
```

**2.6 — Validation integration tests**

File: `server/api/manager/personnel/personnel.validation.integration.test.ts`

Minimum test cases:
- POST missing `name` → 400
- POST missing `role` → 400
- POST `role` not in `person_roles` → 400
- PATCH non-existent id → 404
- PATCH `is_active: 2` → 400
- PATCH empty body → 400
- DELETE non-existent id → 404

#### Progress

##### Automated
- [x] 2.1 GET /api/manager/dictionaries/roles — Manager-accessible — c99fd88
- [x] 2.2 GET /api/manager/personnel — active only — c72b9c9
- [x] 2.3 POST /api/manager/personnel — create + validate — c99fd88
- [x] 2.4 PATCH /api/manager/personnel/:id — update any fields — c99fd88
- [x] 2.5 DELETE /api/manager/personnel/:id — soft-delete — c99fd88
- [x] 2.6 Validation integration tests — c99fd88

##### Manual
- [x] 2.M1 Verify: `npm run test:integration` passes (all validation tests)
- [x] 2.M2 Verify: POST a person, GET returns it, DELETE soft-deletes it, GET no longer returns it

---

### Phase 3: Personnel UI

**Goal**: Manager UI page at `/manager/personnel` — table of active persons with add/edit/deactivate modals.

#### Files

| Action | Path |
|---|---|
| Create | `app/components/ManagerNav.vue` |
| Create | `app/pages/manager/personnel.vue` |

#### Implementation details

**3.1 — `app/components/ManagerNav.vue`**

Clone of `AdminNav.vue` with Manager branding. Single nav link: `PERSONNEL → /manager/personnel`.
Reuse exact same CSS (Space Grotesk, #f20d0d red, skew transforms).

**3.2 — `app/pages/manager/personnel.vue`**

Structure mirrors `admin/users.vue`:

```
definePageMeta({ middleware: 'manager' })
useFetch('/api/manager/personnel')          → active persons list
useFetch('/api/manager/dictionaries/roles') → roles for dropdown
```

Table columns: `IMIĘ I NAZWISKO`, `ROLA`, `EMAIL`, `TELEFON`, `[EDIT]`

**Add modal** (button: `+ DODAJ OSOBĘ`):
- `name` — text input, required
- `role` — `<select>` from roles list, required
- `email` — email input, optional
- `phone` — text input, optional
- Submit → POST `/api/manager/personnel` → refresh list

**Edit modal** (EDIT button per row):
- Pre-fills all fields from selected person
- Same fields as add modal
- Footer: `ZAPISZ` (PATCH) + `DEZAKTYWUJ` button (DELETE → soft-delete)
- Confirm before DEZAKTYWUJ (`window.confirm`)

**UX**: loading/disabled states on submit buttons (same pattern as `admin/users.vue`).

#### Progress

##### Automated
- [x] 3.1 Create app/components/ManagerNav.vue
- [x] 3.2 Create app/pages/manager/personnel.vue

##### Manual
- [x] 3.M1 Visual smoke: `/manager/personnel` loads, table shows active persons
- [x] 3.M2 Add a new person → appears in table
- [x] 3.M3 Edit name/role → change persists after page reload
- [x] 3.M4 Deactivate → person disappears from table
- [x] 3.M5 Login as Personel → redirected to `/` (middleware works)
