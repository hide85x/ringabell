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

## 10xDevs AI Toolkit - Module 2, Lesson 4

Prepare for a harder implementation stream with the **research-backed planning chain**:

```
internal research (/10x-research) + external research (exa.ai, Context7) -> /10x-plan -> /10x-implement -> success
```

The lesson focus is distinguishing internal from external research and using evidence to back planning decisions.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Internal research (lesson focus)** | |
| `/10x-research <change-id>` | You need evidence from the existing codebase — patterns, conventions, integration points, or existing implementations. Runs parallel sub-agents over the repo and writes structured findings to `research.md`. |
| **External research (lesson focus)** | |
| exa.ai | You need AI-native web search for library comparisons, best practices, or ecosystem context that the codebase cannot answer. |
| Context7 (`resolve-library-id` → `get-library-docs`) | You need live, current documentation for a specific library or framework. Resolves a library ID first, then fetches relevant doc pages. |
| **Framing spare wheel** | |
| `/10x-frame <change-id>` | The plan won't converge, the plan doesn't deliver expected results, or persistent drift keeps breaking the implementation. Use as an escape hatch on a separate problem (demonstrated on Space Explorers example), not as pre-research ritual. |
| **Planning and execution** | |
| `/10x-plan <change-id>` / `/10x-implement <change-id> phase <n>` | Use the same planning and execution chain from Lesson 2, now with upstream research evidence feeding the plan. |

### Research discipline

- Internal research (`/10x-research`) answers "what does our codebase already do?" — patterns, schemas, conventions, integration points.
- External research (exa.ai, Context7) answers "what should we do?" — library capabilities, API docs, ecosystem best practices.
- Combine both as evidence-backed input to `/10x-plan`. A plan without research evidence on a non-trivial stream is a guess.
- Agent-friendly docs (`llms.txt`, markdown-for-agents, `/md` endpoints) are a quality signal for library selection — libraries that publish agent-readable docs integrate faster.

### `/10x-frame` as spare wheel

Three triggers for reaching for `/10x-frame`:
1. The plan won't converge — research keeps opening more questions instead of narrowing to a contract.
2. The plan doesn't deliver — implementation repeatedly fails to meet success criteria.
3. Persistent drift — the implementation keeps diverging from the plan in ways that suggest the problem was mis-framed.

Demonstrated on a Space Explorers example, not the SRS path. It is an escape hatch, not a mandatory step.

### Paths used by this lesson

- `context/changes/<change-id>/research.md` - internal research output
- `context/changes/<change-id>/frame.md` - framing output when needed
- `context/changes/<change-id>/plan.md` - evidence-backed implementation contract
- `context/foundation/lessons.md` - recurring rules and pitfalls

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
