---
project: RingAbell
researched_at: 2026-05-25
recommended_platform: Cloudflare Pages + Workers
runner_up: Render
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Nuxt 4 (Vue 3 + Nitro)
  runtime: Cloudflare Workers (V8 isolates, not Node.js)
  database: MongoDB Atlas (external, via TCP sockets)
---

## Recommendation

**Deploy on Cloudflare Pages + Workers.**

Nuxt/Nitro ships an official Cloudflare adapter (GA) with zero-config wrangler integration. At MVP scale the free tier covers 100k requests/day with no cold-start penalty, `wrangler` CLI is fully agent-operable, and Cloudflare publishes `llms.txt` + per-product markdown — the best agent-readable doc surface of any candidate. MongoDB Atlas is supported via TCP sockets (GA, March 2026); email delivery requires a Workers-compatible SDK (Resend or MailChannels) instead of nodemailer. The decision to remove the persistent-connections requirement (`has_realtime: false`) unlocked Cloudflare as viable; without that change, Railway (native Node.js) would have been the call.

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent docs | Stable API | MCP | Notes |
|---|---|---|---|---|---|---|
| **Cloudflare** | **Pass** | **Pass** | **Pass** | **Pass** | **Pass** | V8 isolates, not Node.js |
| Railway | Pass | Pass | Pass | Pass | Pass | Native Node.js, $5/mies, EU Hobby = US region only |
| Render | Partial | Pass | Partial | Pass | Pass | Free 750h/mies, MongoDB external |
| Fly.io | Pass | Partial | Partial | Pass | Pass | No free tier, no managed MongoDB |
| ~~Vercel~~ | — | — | — | — | — | Eliminated: no WebSocket (pre-decision) |
| ~~Netlify~~ | — | — | — | — | — | Eliminated: no persistent connections (pre-decision) |

> Note: Vercel and Netlify were eliminated during the interview phase (persistent connections = Yes). After the user confirmed `has_realtime: false`, they remained out of scope — Cloudflare was already cross-checked and accepted.

### Shortlisted Platforms

#### 1. Cloudflare Pages + Workers (Recommended)

Official Nitro adapter (GA), `wrangler` covers deploy/rollback/log tail from CLI, free tier (100k req/day), `llms.txt` and per-product markdown published, official MCP server with OAuth — the best agent-friendly surface. MongoDB Atlas works via TCP sockets (GA March 2026). Email: Resend or MailChannels Workers integration required (nodemailer incompatible with V8 isolates).

#### 2. Render

Native Node.js (persistent processes, mongoose/nuxt-auth-utils work out of the box), free tier 750h/month, official Nitro preset support, MCP server GA. Loses to Cloudflare on docs quality and CLI completeness; MongoDB is external-only (no co-location option). Good fallback if CPU limits on Workers become a problem.

#### 3. Railway

Native Node.js, $5/month Hobby, Docker MongoDB template (closest to co-location), MCP GA, llms.txt. Loses to Cloudflare on cost (no free tier), and to both on agent-readable docs. The EU region is only available on Pro ($20/seat) — a real concern for a Polish user base on Hobby plan.

## Anti-Bias Cross-Check: Cloudflare Pages + Workers

### Devil's Advocate — Weaknesses

1. **V8 isolates ≠ Node.js** — Nitro runs on Workers runtime, not Node.js. CPU time limit: 10ms free / 30ms paid per request. Complex Nuxt SSR pages with multiple MongoDB queries can hit this ceiling, triggering error 1102.
2. **nodemailer incompatible** — PR requirement (email on event publish) cannot use nodemailer. Must use Resend, MailChannels, or another fetch-based email API. This is a non-obvious adapter change not visible in standard Nuxt docs.
3. **MongoDB Atlas requires WARP IP whitelisting** — Cloudflare WARP IP ranges are dynamic. Atlas must either allow `0.0.0.0/0` (security risk) or the WARP range must be updated when Cloudflare changes it. No static IP option on Workers.
4. **nuxt-auth-utils Web Crypto compatibility** — nuxt-auth-utils relies on Node.js crypto and session APIs. Cloudflare Workers expose Web Crypto API instead. Compatibility must be verified before relying on it for OAuth social login.
5. **`wrangler dev` diverges from production** — local Workers runtime does not fully match production V8 isolates. Subtle bugs (module resolution, native bindings) may appear only on deploy.

### Pre-Mortem — How This Could Fail

*September 2026. RingAbell has been on Cloudflare for four months. The "STWÓRZ GALĘ" button works locally but crashes in production with a 1102 timeout error.*

The failure path: event publication triggers a server route that loops through all assigned personnel, queries MongoDB Atlas for each, and dispatches email via a third-party HTTP call. The total CPU time for a 12-fight event (roughly 60+ personnel) exceeds the 30ms Workers paid limit. The local `wrangler dev` environment never reproduced this because it runs without the CPU cap. Additionally, MongoDB WARP whitelisting broke silently two weeks in — Cloudflare rotated ranges, Atlas started rejecting connections, and the only signal was a 500 in wrangler tail. nuxt-auth-utils initially worked but after an npm update the session signing used a Node.js Buffer API unavailable in V8 isolates, breaking OAuth for all users. Three unplanned weeks of debugging.

### Unknown Unknowns

- **Email delivery on Workers**: nodemailer fails silently or throws on Workers. Use Resend SDK (fetch-based, Workers-compatible) or Cloudflare MailChannels integration (free, but requires domain verification). This must be resolved before the email feature is implemented.
- **nuxt-auth-utils Workers compatibility**: verify against the pinned version before first auth deploy. The library uses `h3` and `uncrypto` which are Workers-compatible, but session storage defaults (cookie vs. database) must be checked.
- **CPU limit monitoring**: enable `wrangler tail --format pretty` in CI to catch 1102 errors early. Consider moving batch operations (email dispatch) to a Cloudflare Queue Worker to stay within per-request CPU limits.
- **WARP IP range management**: add Cloudflare WARP IP range checking to a periodic health check. Use MongoDB Atlas network peering or private endpoint as a longer-term fix.

## Operational Story

- **Preview deploys**: every `git push` to a non-main branch creates a preview URL via Cloudflare Pages automatic builds. Preview URLs are public by default — protect with Cloudflare Access (Zero Trust) if event data is sensitive. Fork PRs from external contributors do not get preview builds.
- **Secrets**: env vars and API tokens (MongoDB Atlas URI, OAuth client secret, email API key) live in Cloudflare Pages → Settings → Environment variables. Production secrets are never in `wrangler.toml` committed to the repo. Rotation: update in Pages dashboard, then redeploy.
- **Rollback**: `wrangler rollback <deployment-id>` restores a previous deployment in ~30 seconds. Database schema changes (if any) do not auto-rollback — handle separately. Pages deployments list: `wrangler pages deployment list`.
- **Approval**: agent may run `wrangler deploy` (staging/preview), `wrangler tail` (log read), `wrangler pages deployment list`. Deleting a project, rotating the primary API token, or changing DNS records are human-only panel operations.
- **Logs**: `wrangler tail --format pretty` streams live request logs. Filter errors: `wrangler tail --status error`. Retention: 7 days on paid plan, 1 day on free.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| CPU 1102 timeout on batch email dispatch | Devil's advocate | M | H | Move email loop to Cloudflare Queue Worker; process one email per queue message |
| nodemailer incompatibility breaks email feature | Devil's advocate | H | H | Replace nodemailer with Resend SDK before first email feature implementation |
| nuxt-auth-utils incompatibility with Web Crypto | Devil's advocate | M | H | Pin version; smoke-test OAuth login in CI on every dependency update |
| MongoDB Atlas connection broken by WARP IP rotation | Pre-mortem | M | H | Add `/healthz` route that pings Atlas; alert on 503; document WARP range update procedure |
| `wrangler dev` diverges from production | Unknown unknowns | M | M | Run integration tests against a staging Workers deployment, not just local dev |
| 100k req/day free tier spike on event day | Unknown unknowns | L | M | Monitor daily usage; upgrade to paid ($5/mies) before first large event |

## Getting Started

1. **Install wrangler**: `npm install -g wrangler` (requires Node >= 18; use `nvm use 20`)
2. **Authenticate**: `npx wrangler login` — opens browser OAuth with Cloudflare account
3. **Verify Nuxt Cloudflare adapter**: confirm `nitro.preset` in `nuxt.config.ts` is set to `'cloudflare-module'`
4. **Add `wrangler.toml`**: create at repo root with `name = "ringabell"`, `main = ".output/server/index.mjs"`, `compatibility_date = "2026-05-25"`, `compatibility_flags = ["nodejs_compat"]`, and `[assets]` section with `directory = ".output/public/"` and `binding = "ASSETS"`
5. **First deploy**: `npm run build && npx wrangler deploy`
6. **Wire env vars**: add `MONGODB_URI`, OAuth client secret, and email API key in Cloudflare dashboard → Workers & Pages → ringabell → Settings → Variables and Secrets

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (GitHub Actions auto-deploy deferred to next milestone)
- Production-scale architecture (multi-region, HA, DR)
- Cloudflare Durable Objects (not needed — `has_realtime: false`)
