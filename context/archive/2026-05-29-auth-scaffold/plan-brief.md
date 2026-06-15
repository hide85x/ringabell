---
change_id: auth-scaffold
---

## What & Why

Google OAuth login works but the app has no route protection and no typed `role` field on the session. This change closes the auth-scaffold gap (F-01) so that all subsequent features can assume an authenticated user with a known role before they are built.

## Starting Point

`nuxt-auth-utils` is installed; Google OAuth sets `email`, `name`, and `avatar` in the session. No middleware exists and `UserSession` carries no `role`.

## Desired End State

Every route except `/` and `/auth/*` requires authentication — unauthenticated visitors are redirected to `/`. The session's `user` object is typed with `role: 'Admin' | 'Manager' | 'Personel'` and Google logins default to `'Personel'`.

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Role source | Default `'Personel'` set in OAuth handler | DB/role-management UI is F-02; session is sufficient for now |
| Protected routes | Everything except `/` and `/auth/*` | Public landing + OAuth callback must remain open |
| Redirect target | `/` | Login UI lives in `app.vue`; no separate `/login` page |
| Type declaration | `app/types/auth.d.ts` via `declare module '#auth-utils'` | Correct virtual module name; `'nuxt-auth-utils'` would not augment `useUserSession()` |

## Scope

**In:** `app/types/auth.d.ts` (new), update `server/routes/auth/google.get.ts`, `app/middleware/auth.global.ts` (new).

**Out:** DB persistence, role-based access control, server API middleware, `/login` page, test runner setup.

## Architecture / Approach

The type declaration is introduced first so the entire codebase can reference `role` in a type-safe way from the moment the OAuth handler is updated. The global route middleware in Phase 2 is a single client-side guard — sufficient while there are no API routes. Both phases use `npm run build` as the automated gate since no test runner is configured yet.

## Phases at a Glance

| Phase | Files touched | Gate |
|---|---|---|
| 1 — Session type + OAuth update | `app/types/auth.d.ts` (new), `server/routes/auth/google.get.ts` | `npm run build` + manual session inspect |
| 2 — Route protection middleware | `app/middleware/auth.global.ts` (new) | `npm run build` + manual redirect smoke test |

## Open Risks & Assumptions

- **Client-side only guard** — the middleware runs in the browser; direct API calls bypass it. Acceptable now (no API routes exist); will need server middleware when F-02 API routes are added.
- **No persistent role storage** — `role` lives only in the session cookie. A user's role cannot be changed without clearing the session. Acceptable until F-02 (role management UI + DB).
- **Single OAuth provider** — assumes Google is the only login path; a second provider would also need `role: 'Personel'` added to its handler.

## Success Criteria Summary

| # | Type | Criterion |
|---|---|---|
| 1.1 | Automated | `npm run build` passes after Phase 1 — no TypeScript errors |
| 1.2 | Manual | Session payload contains `role: 'Personel'` after Google login |
| 2.1 | Automated | `npm run build` passes after Phase 2 |
| 2.2 | Manual | Unauthenticated visit to `/admin` → redirected to `/` |
| 2.3 | Manual | Authenticated user navigates to `/admin` → no redirect |
