# CLAUDE.md

**Node version**: requires Node >= 20. Use `nvm use 20` before running commands — Node 16 breaks nuxi at startup.

## Commands

See `@README.md` for setup. Key scripts: `npm run dev` (port 3000), `npm run build`, `npm run preview`.

## Project context

RingAbell — boxing event management system. Three roles with strict access control:

- **Admin** — manages users, roles, and dictionaries (role types, per-fight requirements)
- **Manager** — creates events, fights, assigns personnel, publishes events (triggers emails)
- **Personel** — read-only view of their own schedule

Business rules and domain logic: `@context/foundation/prd.md`
Stack decisions: `@context/foundation/tech-stack.md`

## Stack

MongoDB via native `mongodb` driver (installed, see `server/utils/db.ts`). Auth via `nuxt-auth-utils` (OAuth social login only, no passwords stored). Deploy target: Cloudflare Workers.

## Date handling

Always use `formatDate()` and `nowUtc()` from `@utils/date.ts`. Never use `new Date().toISOString()` or manual date formatting directly in code.

## Git workflow

Never run `git push` — the user handles all pushes manually.

## Cloudflare access boundary

Deploy target: Cloudflare Workers (not Pages). Deploy command: `wrangler deploy` (reads `wrangler.toml` from project root after `npm run build`).

Agent may run: `wrangler whoami`, `wrangler deployment list`, `wrangler tail`, `wrangler secret list`, `wrangler deploy` (staging/preview only).

Never run without explicit user approval: deleting a project, rotating secrets, changing DNS, any `wrangler delete` or destructive operation. User performs these manually in the Cloudflare dashboard.

## Known gaps (to add)

- No test runner configured yet
- `package.json` name is still `"bootstrap-scaffold"` — rename to `"ringabell"`

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 3, Lesson 4 (E2E Tests)

**For E2E tests, use the `/10x-e2e` skill.** It is the single source of truth
for the workflow — risk → seed test + rules → generate → review against the five
anti-patterns → re-prompt → verify. The skill's `references/` carry the full
rules, anti-patterns, seed pattern, and prompt-template.

A few hard rules that hold even before you invoke the skill:

- **Locators:** `getByRole` / `getByLabel` / `getByText` first; `getByTestId`
  only when accessibility attributes are ambiguous. Never CSS selectors, XPath,
  or DOM structure.
- **Never `page.waitForTimeout()`.** Wait for state: `toBeVisible()`,
  `waitForURL()`, `waitForResponse()`.
- **Test independence + cleanup.** Each test runs standalone — its own setup,
  action, assertion, and cleanup; unique ids (timestamp suffix) so parallel runs
  and re-runs don't collide.

Two boundaries to keep straight:

- **DOM (snapshot) is the default.** Vision (`--caps=vision`) is a supplement for
  visual-only risks (layout, z-index, animation); for pixel regression prefer
  deterministic tools (`toMatchSnapshot`, Argos, Lost Pixel). VLM model
  selection/cost is a debugging topic (Lesson 5), not testing.
- **Healer helps on selectors, harms on logic.** A changed selector → healer
  re-finds it (route through PR review). A changed business behavior → healer
  masks the bug; that failing-test-to-fix case is Lesson 5.

<!-- END @przeprogramowani/10x-cli -->
