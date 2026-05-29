---
change_id: auth-scaffold
phase_count: 2
---

## Overview

Add route-protection middleware and a typed `role` field to the user session for the RingAbell boxing event management system. OAuth login via `nuxt-auth-utils` already works; this change closes the remaining auth-scaffold gap before feature work begins.

## Current State Analysis

- `nuxt-auth-utils` is installed and configured in `nuxt.config.ts`.
- Google OAuth flow works end-to-end; `server/routes/auth/google.get.ts` calls `setUserSession` with `email`, `name`, and `avatar`.
- `app/app.vue` calls `useUserSession()` and renders login/logout UI.
- No route protection exists — all routes are accessible without authentication.
- `UserSession` has no `role` field; TypeScript does not know about roles.

## Desired End State

- `UserSession.user.role` is typed as `'Admin' | 'Manager' | 'Personel'` across the entire Nuxt app (client and server).
- Every new Google login session carries `role: 'Personel'` by default.
- A global Nuxt middleware redirects unauthenticated visitors away from every route except `/` and `/auth/*`.
- `npm run build` passes with no TypeScript errors after both phases.

## What We're NOT Doing

- **No Mongoose/DB** — user persistence is F-02; roles come from session only for now.
- **No `/login` page** — `app.vue` already handles the login UI surface.
- **No role-based access control** — this change is authentication-only (is the user logged in?); authorization (what can they do?) is a later concern.
- **No server middleware for API routes** — no API routes exist yet; they will get their own guard when created.

## Implementation Approach

Phase 1 establishes the type contract so that every subsequent file in the project can reference `role` without casting. The OAuth handler is updated in the same phase to ensure the session shape matches the type from the moment the type exists. Phase 2 adds the global middleware that enforces the authentication boundary — a single client-side guard is sufficient given the current absence of API routes.

### Critical Implementation Details

The `nuxt-auth-utils` module exposes its types via the virtual module `'#auth-utils'`, not `'nuxt-auth-utils'`. The type augmentation must use:

```ts
declare module '#auth-utils' { … }
```

Using `'nuxt-auth-utils'` will silently produce a parallel, unused declaration and the build will still pass — but `useUserSession()` will not reflect the added fields.

---

## Phase 1: Session type + OAuth handler update

### Changes Required

**`app/types/auth.d.ts`** (new file)
- Intent: Augment the `User` interface from `#auth-utils` to add all user fields including `role`.
- Contract: `declare module '#auth-utils'` block augmenting `interface User` (the dedicated extension point — `UserSession.user` is typed as `User`). Declare all four fields: `email: string`, `name: string`, `avatar: string`, `role: 'Admin' | 'Manager' | 'Personel'`.

**`server/routes/auth/google.get.ts`** (update)
- Intent: Set `role: 'Personel'` on every new session created via Google OAuth.
- Contract: Add `role: 'Personel'` to the `user` object passed to `setUserSession(event, { user: { … } })`.

### Success Criteria

#### Automated

- `npm run build` completes with no TypeScript errors.

#### Manual

- Log in via Google; inspect the session (browser devtools → Application → Cookies, or `wrangler pages deployment tail`) and confirm `role: 'Personel'` is present in the session payload.

---

## Phase 2: Route protection middleware

### Changes Required

**`app/middleware/auth.global.ts`** (new file)
- Intent: Redirect unauthenticated users to `/` before any protected route renders.
- Contract: Global Nuxt route middleware (`defineNuxtRouteMiddleware`). Skip when `to.path === '/'` or `to.path.startsWith('/auth/')`. If `loggedIn` (from `useUserSession()`) is falsy, call `navigateTo('/')` and return. Otherwise let navigation proceed.

### Success Criteria

#### Automated

- `npm run build` completes with no TypeScript errors after middleware is added.

#### Manual

- While **not** logged in, navigate directly to `/admin` → browser lands on `/`.
- While **logged in**, navigate to `/admin` (or any other protected route) → no redirect occurs.

---

## Testing Strategy

No automated test runner is configured for this project yet. Verification relies on:

1. `npm run build` as a TypeScript gate after each phase.
2. Manual browser smoke tests against the running dev server (`npm run dev`) or the Cloudflare Pages preview deployment.
3. `wrangler pages deployment tail` for inspecting live session payloads if browser devtools are insufficient.

---

## References

- `nuxt-auth-utils` type augmentation docs: https://github.com/atinux/nuxt-auth-utils#session-types
- Nuxt route middleware docs: https://nuxt.com/docs/guide/directory-structure/middleware
- `context/foundation/roadmap.md` §F-01

---

## Progress

### Phase 1: Session type + OAuth handler update

#### Automated
- [x] 1.1 npm run build passes — no TypeScript errors

#### Manual
- [x] 1.2 Session contains role: 'Personel' after Google login

### Phase 2: Route protection middleware

#### Automated
- [ ] 2.1 npm run build passes after middleware added

#### Manual
- [ ] 2.2 Unauthenticated /admin → redirected to /
- [ ] 2.3 Authenticated user — no redirect on protected routes
