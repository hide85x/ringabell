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

MongoDB via native `mongodb` driver (installed, see `server/utils/db.ts`). Auth via `nuxt-auth-utils` (OAuth social login only, no passwords stored). Deploy target: Cloudflare Pages.

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

## 10xDevs AI Toolkit - Module 2, Lesson 3

Review AI-generated code before merge with the **implementation review chain**:

```
/10x-implement -> /10x-impl-review -> triage -> (/10x-lesson | fix | skip | disagree)
```

`/10x-impl-review` is the lesson focus. Review is a quality gate, not an instruction to fix every finding.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Code review (lesson focus)** | |
| `/10x-impl-review <change-id>` | You have implemented code and want a structured review before merge. The skill checks plan adherence, scope discipline, safety and quality, architecture, pattern consistency, and success criteria, then presents findings for triage. |
| **Recurring lesson outcome** | |
| `/10x-lesson` | A finding reveals a recurring project rule or agent failure pattern. Record it in `context/foundation/lessons.md` instead of treating it as a one-off note. |

### Triage discipline

- Severity says how bad the finding is. Impact says how much the decision matters now.
- Valid outcomes: fix now, fix differently, skip, accept as risk, record as recurring rule (`/10x-lesson`), disagree.
- Fix critical findings. Do not burn hours on low-impact observations just because the agent found them.
- Conscious skipping of low-impact findings is a valid review outcome, not negligence.
- If you disagree with a finding, record why. Wrong agent reasoning is also signal.

### Review boundaries

- This lesson reviews implemented code. It does not create the plan, execute new phases, or teach CI review.
- Testing strategy and quality gates are introduced in Module 3.
- Do not use `/10x-contract` as a triage outcome in this lesson.

### Paths used by this lesson

- `context/changes/<change-id>/plan.md` - expected implementation contract
- `context/changes/<change-id>/reviews/` - review output
- `context/foundation/lessons.md` - recurring lessons

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
