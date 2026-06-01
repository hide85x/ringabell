---
change_id: data-scaffold
---

## What & Why

Atlas is provisioned but the app has no database connection. This change installs the native MongoDB driver, wires up a connection singleton, defines TypeScript interfaces for every domain collection, and exposes a `/healthz` endpoint that proves Atlas is reachable. It closes F-02 and unblocks every subsequent feature slice that reads or writes data.

## Starting Point

Auth works end-to-end (F-01 complete). `package.json` has no `mongodb` dependency, `wrangler.toml` has no `compatibility_flags`, and `nuxt.config.ts` has no `runtimeConfig`. No model files or DB utilities exist.

## Desired End State

MongoDB is connected, five model interfaces are defined, and `GET /healthz` returns `{"status":"ok","db":"connected","timestamp":"..."}` both locally and on Cloudflare Pages preview.

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Driver | Native `mongodb` npm package | Mongoose uses features incompatible with Cloudflare Workers V8 isolates |
| Validation | TypeScript interfaces only | Runtime Zod validation ships with API endpoints in S-01+; not needed for scaffolding |
| Connection pattern | `getDb(config?)` singleton; falls back to `process.env.MONGODB_URI` | `useRuntimeConfig()` is unavailable at module init time in `server/utils/`; callers pass config from event handlers |
| Model naming | `BoxingEvent` (not `Event`) | `Event` collides with the browser DOM global in the Nuxt type environment |

## Scope

**In:** `npm install mongodb`, update `wrangler.toml` + `nuxt.config.ts` + `.env.example`, `server/utils/db.ts` (new), five `server/models/*.ts` files (new), `server/routes/healthz.get.ts` (new).

**Out:** Mongoose, Zod validation, indexes, migrations, seeding, role-management UI, any S-01 API routes.

## Architecture / Approach

The native `mongodb` driver is a thin wrapper over the wire protocol and works inside Workers without Node.js built-ins — with one exception: it still needs `node:net` and `node:tls`, which requires the `nodejs_compat_v2` compatibility flag in `wrangler.toml`. The connection singleton keeps `maxPoolSize: 1` because Workers spawn fresh isolates on each cold start; a larger pool would be wasted. Model files are pure TypeScript interfaces with no runtime overhead — they exist solely to give route handlers a typed contract for documents read from and written to Atlas.

## Phases at a Glance

| Phase | Files touched | Gate |
|---|---|---|
| 1 — Driver + Atlas connection | `package.json` (npm install), `wrangler.toml`, `nuxt.config.ts`, `server/utils/db.ts` (new), `.env.example` | `npm run build` + dev server starts |
| 2 — Model interfaces | `server/models/user.ts`, `person.ts`, `event.ts`, `fight.ts`, `assignment.ts` (all new) | `npm run build` — all five compile |
| 3 — /healthz endpoint | `server/routes/healthz.get.ts` (new) | `npm run build` + `curl` on dev + `curl` on Pages preview |

## Open Risks & Assumptions

- **`MONGODB_URI` on Cloudflare Pages** — the environment variable must be added manually in the Cloudflare dashboard (Pages → Settings → Environment variables). It is not read from `.env` on deployed Workers.
- **Workers cold start** — each new isolate pays the Atlas connection cost on first request. `serverSelectionTimeoutMS: 5000` limits the worst case but expect ~200–500 ms on cold starts.
- **Atlas IP allowlist** — the Atlas project must allow connections from `0.0.0.0/0` (all IPs) because Cloudflare Workers egress IPs are not fixed. If the allowlist is restricted, the connection will time out silently.

## Success Criteria Summary

| # | Type | Criterion |
|---|---|---|
| 1.1 | Automated | `npm run build` passes after Phase 1 |
| 1.2 | Manual | `npm run dev` starts without errors |
| 1.3 | Manual | `MONGODB_URI` visible as private runtime config |
| 2.1 | Automated | `npm run build` passes after Phase 2 — all five models compile |
| 2.2 | Manual | Each interface has correct fields; collection constant exported |
| 3.1 | Automated | `npm run build` passes after Phase 3 |
| 3.2 | Manual | `curl http://localhost:3000/healthz` → `{"status":"ok","db":"connected","timestamp":"..."}` |
| 3.3 | Manual | `curl https://<preview>.pages.dev/healthz` → same response |
