---
date: 2026-06-02T12:07:13Z
researcher: Claude Sonnet 4.6
git_commit: eb83c3e
branch: test-plan
repository: boxing-promoter
topic: "RBAC middleware and server-side input validation — Phase 2 test grounding"
tags: [research, rbac, middleware, validation, admin-guard, integration-tests]
status: complete
last_updated: 2026-06-02
last_updated_by: Claude Sonnet 4.6
---

# Research: RBAC Middleware and Server-Side Input Validation

**Date**: 2026-06-02T12:07:13Z
**Researcher**: Claude Sonnet 4.6
**Git Commit**: eb83c3e
**Branch**: test-plan
**Repository**: boxing-promoter

## Research Question

Ground Phase 2 of the test rollout (Risks #3 and #4) in the live codebase. Map exactly:
- how the RBAC middleware works, where it's applied, and what sessions look like
- what server-side input validation exists and which endpoints were explicitly marked untested

## Summary

**Risk #3 (RBAC)**: All 12 existing admin endpoints are protected by `requireAdmin()` — a 7-line per-route guard at `server/utils/admin-guard.ts`. There is no global server middleware; coverage depends on every new admin route calling the guard explicitly. The guard reads role from the session cookie (set once at auth time, no per-request DB lookup). 401 if no session; 403 if session exists but `role !== 'Admin'`. Integration tests can target any single admin endpoint (e.g. `GET /api/admin/users`) to cover the guard — all routes share identical logic.

**Risk #4 (input validation)**: All 8 admin endpoints that accept a body have manual inline validation (`readBody` + whitelist checks + `createError({ statusCode: 400/409 })`). No Zod — project decision from `data-scaffold`. Two endpoints were explicitly marked untested in `admin-user-management`: `PATCH /api/admin/users/:id` with invalid role → 400, and `DELETE /api/admin/users/:id`.

**Non-admin API routes**: None exist yet. Events, fights, assignments, and the publish endpoint are planned for S-03–S-05. Phase 2 tests target only the current admin surface.

## Detailed Findings

### RBAC Guard — `server/utils/admin-guard.ts`

Full implementation (7 lines):

```typescript
export async function requireAdmin(event: H3Event) {
  const session = await requireUserSession(event)   // line 2 — throws 401 if no session
  if (session.user.role !== 'Admin') {              // line 3 — strict string comparison
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return session
}
```

- `server/utils/admin-guard.ts:2` — `requireUserSession(event)` from `nuxt-auth-utils`; throws **401** automatically if no valid session cookie exists
- `server/utils/admin-guard.ts:3` — role comparison is strict string equality: only `'Admin'` passes; `'Manager'` and `'Personel'` both produce **403**
- Role is **not re-checked against DB per request** — it lives in the encrypted session cookie, set once at login

### Session Shape

Defined at `app/types/auth.d.ts:1-8`:

```typescript
declare module '#auth-utils' {
  interface User {
    email: string
    name: string
    avatar: string
    role: 'Admin' | 'Manager' | 'Personel'
  }
}
```

Session is populated at auth time:
- `server/api/auth/login.post.ts:22` — `setUserSession(event, { user: { email, name, avatar, role } })`
- `server/routes/auth/google.get.ts:17` — same shape via OAuth callback

Role is fetched from `users.role` DB column exactly once (at login/OAuth), then stored in the cookie for the session lifetime.

### Middleware Wiring — Per-Route, Not Global

**No `server/middleware/` directory exists.** The guard is imported and called as the first line of each protected handler.

All 12 admin endpoints call `requireAdmin(event)` at line 2 or 4:

| Endpoint | File | Guard line |
|---|---|---|
| GET /api/admin/users | `server/api/admin/users/index.get.ts:2` | 2 |
| POST /api/admin/users | `server/api/admin/users/index.post.ts:6` | 6 |
| PATCH /api/admin/users/:id | `server/api/admin/users/[id].patch.ts:4` | 4 |
| DELETE /api/admin/users/:id | `server/api/admin/users/[id].delete.ts:2` | 2 |
| GET /api/admin/dictionaries/roles | `server/api/admin/dictionaries/roles/index.get.ts:2` | 2 |
| POST /api/admin/dictionaries/roles | `server/api/admin/dictionaries/roles/index.post.ts:4` | 4 |
| PATCH /api/admin/dictionaries/roles/:id | `server/api/admin/dictionaries/roles/[id].patch.ts:2` | 2 |
| DELETE /api/admin/dictionaries/roles/:id | `server/api/admin/dictionaries/roles/[id].delete.ts:2` | 2 |
| GET /api/admin/dictionaries/requirements | `server/api/admin/dictionaries/requirements/index.get.ts:2` | 2 |
| POST /api/admin/dictionaries/requirements | `server/api/admin/dictionaries/requirements/index.post.ts:2` | 2 |
| PATCH /api/admin/dictionaries/requirements/:id | `server/api/admin/dictionaries/requirements/[id].patch.ts:2` | 2 |
| DELETE /api/admin/dictionaries/requirements/:id | `server/api/admin/dictionaries/requirements/[id].delete.ts:2` | 2 |

**Architectural risk**: since there is no global middleware, any new admin route that forgets `requireAdmin()` is silently unprotected. Tests must cover this pattern going forward.

### Role Values (exact strings, case-sensitive)

Defined in `app/types/auth.d.ts:6` and `server/models/user.ts:6`:

```
'Admin'    — admin-guard passes
'Manager'  — admin-guard fails (403)
'Personel' — admin-guard fails (403); note: single 'l', not 'Personnel'
```

### Input Validation — Full Inventory

All admin endpoints with a request body use the same inline pattern:

```typescript
const { field } = await readBody<{ field: string }>(event)
if (!field || !VALID_VALUES.includes(field)) {
  throw createError({ statusCode: 400, statusMessage: '...' })
}
```

**No Zod** — project decision from `data-scaffold` plan.md:33: "TypeScript interfaces only; runtime Zod validation ships with API endpoints in S-01+." Never shipped; manual validation became the de-facto standard.

Validation coverage by endpoint:

| Endpoint | Validates | Returns on failure |
|---|---|---|
| POST /api/admin/users | email format (`@`), role in VALID_ROLES, duplicate email | 400, 400, 409 |
| PATCH /api/admin/users/:id | role in VALID_ROLES | 400 |
| POST /api/admin/dictionaries/roles | name non-empty (trim), duplicate name | 400, 409 |
| PATCH /api/admin/dictionaries/roles/:id | name non-empty (trim), duplicate (excl. self) | 400, 409 |
| DELETE /api/admin/dictionaries/roles/:id | role not in use (DB check) | 409 |
| POST /api/admin/dictionaries/requirements | roleId present, count positive integer, role exists, no duplicate | 400, 400, 404, 409 |
| PATCH /api/admin/dictionaries/requirements/:id | count positive integer | 400 |

GET and DELETE-by-id endpoints have no body to validate; they check for 404 (not found) on the path param.

### Explicitly Untested Endpoints (from admin-user-management)

`context/changes/admin-user-management/change.md:14-17` documents two endpoints never manually tested:

1. **`PATCH /api/admin/users/:id` with invalid role** → expected 400 — skipped, "weryfikacja przez UI w Phase 3"
2. **`DELETE /api/admin/users/:id`** → expected 200/404 — skipped, "tylko jeden user w systemie"

These are the highest-priority targets for Phase 2 input validation tests.

### Public / Auth Endpoints (no admin guard, expected)

| Endpoint | Auth | Validation |
|---|---|---|
| POST /api/auth/login | None (public) | email + password presence, 400; invalid credentials → 401 |
| GET /auth/google | OAuth handler | DB whitelist check; unknown email → redirect `/?error=unauthorized` |
| GET /healthz | None | DB connectivity; failure → 503 |

## Code References

- `server/utils/admin-guard.ts:1-7` — full guard implementation
- `app/types/auth.d.ts:1-8` — session User type with role union
- `server/api/auth/login.post.ts:22` — `setUserSession` call (role stored in cookie)
- `server/routes/auth/google.get.ts:17` — OAuth `setUserSession` call
- `server/api/admin/users/index.post.ts:3` — `VALID_ROLES` array definition
- `server/api/admin/users/[id].patch.ts:1-9` — PATCH with role validation (untested path)
- `server/api/admin/dictionaries/requirements/index.post.ts:5-9` — count validation pattern
- `server/models/user.ts:6` — role type in User model

## Architecture Insights

**Guard pattern**: `requireAdmin(event)` is always the first `await` in a protected handler. This makes it trivially mockable for integration tests — any request that reaches line 2+ of the handler logic has already passed the guard.

**Session is frozen at auth time**: the role in the session cookie is the role at login. If an Admin demotes their own account to Manager, existing sessions still see `'Admin'` until re-login. This is by design (no per-request DB lookup) and means integration tests need only a valid session cookie with the right role string — no DB state required for the guard itself.

**Validation is always synchronous before async DB ops**: all handlers validate the body at lines 5–10 before any `env.DB.prepare()` call. This means a 400 response on invalid input never touches the database.

**No Zod, no shared schema objects**: each endpoint defines its own `VALID_ROLES` or validates inline. This means validation coverage is per-endpoint and must be tested per-endpoint — there is no single schema to test once.

## Historical Context (from prior changes)

- `context/changes/admin-user-management/plan.md:60-61` — `admin-guard.ts` designed and introduced; explicit note that a parallel `requireManager()` guard will be needed for S-05 publish endpoint
- `context/changes/admin-user-management/change.md:14-17` — two endpoints marked untested; Phase 2 is the designated fix point
- `context/changes/auth-scaffold/plan.md:29-30` — decision: no global server middleware for API routes; per-endpoint guards only
- `context/changes/data-scaffold/plan.md:33` — no Zod; TypeScript + manual validation is the project standard
- `context/changes/testing-bootstrap-guardrail/research.md:272` — open question on `requireManager` scope (S-05 dependency, out of scope for Phase 2)

## Open Questions

1. **`requireManager` scope (S-05)**: When the publish endpoint ships, should the guard check `role === 'Manager'` only, or `role IN ('Manager', 'Admin')`? Not resolvable until S-05 planning. Out of scope for Phase 2 tests.

2. **Session creation in tests**: Integration tests against admin endpoints need a way to produce a valid `nuxt-auth-utils` session cookie without going through the login flow. Options: (a) call `POST /api/auth/login` with a seeded DB user, (b) use `unstable_dev` with a test-time session setter if `nuxt-auth-utils` exposes one, (c) mock the session at the H3 event level. Plan must resolve this before writing tests.

3. **Test transport**: `@cloudflare/vitest-pool-workers` runs in V8 isolate — HTTP-level tests require either `unstable_dev` (Miniflare) or a `nitro-test-utils` fetch wrapper. Plan must pick one and document it as `§6.3` cookbook pattern.
