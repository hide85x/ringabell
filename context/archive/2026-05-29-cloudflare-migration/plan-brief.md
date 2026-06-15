# Cloudflare Migration — Plan Brief

> Full plan: `context/changes/cloudflare-migration/plan.md`

## What & Why

Switch the Nitro preset from `cloudflare-pages` to `cloudflare-module` so MongoDB Atlas SCRAM-SHA-1 authentication works on the Cloudflare Workers runtime. The `cloudflare-pages` preset routes code through `unenv`, which replaces `require('crypto')` with an incomplete browser stub — MongoDB auth fails silently at the TLS handshake. Workers with `nodejs_compat` has real `node:crypto`.

## Starting Point

data-scaffold (F-02) is fully implemented and works locally. Phase 3.3 of that change is blocked with: *"MongoDB SCRAM-SHA-1 requires node:crypto which Nitro/unenv polyfills incorrectly on Cloudflare Pages."* Three config files need to change; no models, routes, or business logic are touched.

## Desired End State

`wrangler deploy` succeeds and `GET /healthz` on the Workers URL returns `{"status":"ok","db":"connected"}`. The app stack (Nuxt + nuxt-auth-utils + MongoDB Atlas) runs on Workers V8 isolates exactly as the roadmap assumed from the start.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Wrangler config strategy | Manual `wrangler.toml` update | Explicit, human-readable, no generated files | Plan |
| Pages project fate | Keep it, deploy Workers separately | Zero risk; Pages URL stays as fallback | Plan |
| `checkServerIdentity` scope | Always in `getDb()`, unconditional | Simpler code path; safe with Atlas TLS | Plan |
| mongo-optional-stubs aliases | Keep unchanged | Bundler still needs them regardless of preset | Plan |
| Compatibility flag | `nodejs_compat` (drop `_v2`) | Equivalent with `compatibility_date >= 2024-09-23`; canonical form | Plan |

## Scope

**In scope:** `nuxt.config.ts`, `wrangler.toml`, `server/utils/db.ts`, `CLAUDE.md`

**Out of scope:** models, routes, auth, environment variable management, CI/CD, deleting Pages project

## Architecture / Approach

Nitro preset controls how the server bundle is compiled and which runtime polyfills are applied. Switching `cloudflare-pages` → `cloudflare-module` tells Nitro to target Workers V8 directly instead of routing through `unenv`. The `wrangler.toml` is rewritten from a Pages config to a Workers config (adds `main` entry point + `[assets]` binding). One TLS option is added to MongoClient.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Config changes + build | All code changes land; `npm run build` passes | Build could fail if wrangler.toml is malformed or stubs miss a dep |
| 2. Workers deploy + smoke test | `wrangler deploy` succeeds; `/healthz` returns `ok` on live Workers | `MONGODB_URI` secret must be set in Workers dashboard before test |

**Prerequisites:** `MONGODB_URI` set as a secret in Cloudflare Workers dashboard (Workers & Pages → ringabell → Settings → Variables). `NUXT_SESSION_PASSWORD` must also be present (from auth-scaffold).

**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- Workers free tier CPU limit is 30ms — acceptable for healthz ping, flagged in roadmap for complex S-04 queries
- If `wrangler deploy` creates a new Workers service instead of updating an existing one, the URL will be `ringabell.<account>.workers.dev` — expected

## Success Criteria (Summary)

- `npm run build` passes locally after config changes
- `wrangler deploy` exits 0 and outputs a Workers URL
- `curl https://ringabell.<account>.workers.dev/healthz` → `{"status":"ok","db":"connected","timestamp":"..."}`
