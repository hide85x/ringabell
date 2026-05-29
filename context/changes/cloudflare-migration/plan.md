---
change_id: cloudflare-migration
phase_count: 2
---

# Cloudflare Migration — Pages → Workers

## Overview

Switch the Nitro preset from `cloudflare-pages` to `cloudflare-module` so that MongoDB Atlas can authenticate via SCRAM-SHA-1 on the Cloudflare Workers runtime. The `cloudflare-pages` preset runs Nitro through `unenv`, which replaces `require('crypto')` with an incomplete browser stub — breaking MongoDB auth. The `cloudflare-module` preset targets Workers V8 isolates directly, where `nodejs_compat` provides real `node:crypto`.

## Current State Analysis

- `nuxt.config.ts`: `nitro.preset = 'cloudflare-pages'`, 7 mongo-optional-stubs aliases, `runtimeConfig.mongodbUri`
- `wrangler.toml`: `compatibility_flags = ["nodejs_compat_v2"]`, `pages_build_output_dir = "dist"` — Pages-specific, must be replaced
- `server/utils/db.ts`: MongoClient without TLS options — Workers requires `checkServerIdentity: () => undefined` to bypass hostname verification inside V8 isolates
- `/healthz` works locally but returns `MongoRuntimeError: Node.js crypto module is required for SCRAM-SHA-1` on Pages deploy

## Desired End State

- `nuxt.config.ts` uses `preset: 'cloudflare-module'`; aliases unchanged
- `wrangler.toml` is a valid Workers config (`main`, `[assets]`, `nodejs_compat`)
- `server/utils/db.ts` passes `checkServerIdentity: () => undefined` in MongoClient TLS options
- `CLAUDE.md` Cloudflare section reflects Workers deploy commands
- `wrangler deploy` succeeds; `GET /healthz` on the Workers URL returns `{status:"ok", db:"connected"}`

## What We're NOT Doing

- **No new features** — this is infrastructure plumbing only
- **No changes to model files** — schema is correct from data-scaffold
- **Not deleting Pages project** — ringabell-foe.pages.dev stays, Workers deploys to separate URL
- **Not adding CI/CD** — manual deploy per CLAUDE.md boundary
- **No Mongoose / Zod** — out of scope per data-scaffold decisions

## Implementation Approach

Phase 1 swaps the three config files that caused the failure, then verifies with `npm run build`. Phase 2 deploys to Workers and smoke-tests the `/healthz` endpoint against a live Atlas connection.

## Critical Implementation Details

**`nodejs_compat` equals `nodejs_compat_v2` when `compatibility_date >= 2024-09-23`** — Cloudflare merged them in November 2024. Our current date (`2026-05-25`) is well past that threshold. Use the canonical `nodejs_compat` flag; `nodejs_compat_v2` is a vestigial alias.

**`checkServerIdentity: () => undefined` is required for Atlas on Workers** — Workers TLS stack does not expose the hostname verification hook the Node.js `tls` module normally provides. Without this option, the MongoClient throws a TLS hostname check error even though the connection is otherwise valid. Setting it unconditionally (not just for Workers) is safe — Atlas uses TLS anyway and we're not weakening auth, only skipping the hostname re-check inside the already-TLS-terminated tunnel.

**mongo-optional-stubs aliases must stay** — kerberos, snappy, etc. are optional MongoDB driver dependencies that aren't installed. The Nitro bundler throws at build time if it can't resolve them regardless of preset. The alias routes them to an empty stub that satisfies the bundler.

---

## Phase 1: Config changes + build verification

### Changes Required

#### 1. `nuxt.config.ts`

**File**: `nuxt.config.ts`

**Intent**: Change the Nitro preset from `cloudflare-pages` to `cloudflare-module`. Everything else (mongo-optional-stubs aliases, runtimeConfig) stays unchanged.

**Contract**: Change exactly one value — `preset: 'cloudflare-pages'` → `preset: 'cloudflare-module'`.

#### 2. `wrangler.toml`

**File**: `wrangler.toml`

**Intent**: Replace the Pages-specific config with a Workers config. Workers needs `main` (entry point) and an `[assets]` table (static file binding). Remove `pages_build_output_dir`.

**Contract**:
```toml
name = "ringabell"
main = ".output/server/index.mjs"
compatibility_date = "2026-05-25"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = ".output/public/"
binding = "ASSETS"
```

#### 3. `server/utils/db.ts`

**File**: `server/utils/db.ts`

**Intent**: Add Workers-required TLS options to MongoClient so Atlas SCRAM-SHA-1 auth can complete inside the Workers V8 isolate.

**Contract**: Extend the MongoClient options object with:
```ts
tls: true,
checkServerIdentity: () => undefined,
```
alongside the existing `maxPoolSize` and `serverSelectionTimeoutMS`.

#### 4. `CLAUDE.md`

**File**: `CLAUDE.md`

**Intent**: Update the Cloudflare access boundary section — Pages-specific commands no longer apply; Workers deployment uses `wrangler deploy`.

**Contract**: In the "Cloudflare access boundary" section, replace the allowed commands list. Remove `wrangler pages deployment list`, `wrangler pages deployment tail`, `wrangler pages secret list`. Add `wrangler deployment list`, `wrangler tail`, `wrangler secret list`. Keep `wrangler whoami` and `wrangler deploy` (staging/preview only).

### Success Criteria

#### Automated Verification

- `npm run build` completes without TypeScript errors or missing-module errors

#### Manual Verification

- `npm run dev` starts without errors in the terminal
- No references to `cloudflare-pages` remain in `nuxt.config.ts`
- `wrangler.toml` has `main`, `[assets]`, and `nodejs_compat` flag

---

## Phase 2: Workers deploy + healthz smoke test

### Changes Required

No code changes in this phase. This phase is deployment and end-to-end verification only.

**Deploy command** (user runs):
```bash
npm run build
wrangler deploy
```

`wrangler deploy` reads `wrangler.toml` from the project root. The `main` field points to `.output/server/index.mjs` which is produced by the Phase 1 build.

**Environment variable**: `MONGODB_URI` must be set in the Cloudflare Workers dashboard (Workers & Pages → ringabell → Settings → Variables and Secrets) before the smoke test. `NUXT_SESSION_PASSWORD` must also be present (set during auth-scaffold).

### Success Criteria

#### Automated Verification

- `wrangler deploy` exits 0; outputs a Workers URL in the form `https://ringabell.<account>.workers.dev`

#### Manual Verification

- `curl https://ringabell.<account>.workers.dev/healthz` returns `{"status":"ok","db":"connected","timestamp":"..."}`
- `curl https://ringabell.<account>.workers.dev/healthz` does NOT return `MongoRuntimeError` or `crypto module required`

---

## Testing Strategy

No automated test runner is configured yet. Verification relies on:

1. `npm run build` as a TypeScript compilation + bundler gate after Phase 1
2. Manual `curl` against the Workers URL for Phase 2
3. `wrangler tail` for live log inspection if Phase 2 healthz returns an unexpected error

## References

- Cloudflare Workers `nodejs_compat` flag: https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- Nitro `cloudflare-module` preset: https://nitro.build/deploy/providers/cloudflare
- `context/changes/data-scaffold/plan.md` — Phase 3.3 BLOCKED item this change resolves

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Config changes + build verification

#### Automated

- [x] 1.1 `npm run build` passes without TypeScript errors or missing-module errors

#### Manual

- [x] 1.2 `npm run dev` starts without errors
- [x] 1.3 `nuxt.config.ts` uses `cloudflare-module`; `wrangler.toml` has `main`, `[assets]`, `nodejs_compat`; `db.ts` has `checkServerIdentity`

### Phase 2: Workers deploy + healthz smoke test

#### Automated

- [ ] 2.1 `wrangler deploy` exits 0 and outputs a Workers URL

#### Manual

- [ ] 2.2 `curl https://ringabell.<account>.workers.dev/healthz` returns `{"status":"ok","db":"connected",...}`
