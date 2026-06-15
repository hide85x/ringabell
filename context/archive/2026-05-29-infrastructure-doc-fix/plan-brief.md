# infrastructure-doc-fix — Plan Brief

> Full plan: `context/changes/infrastructure-doc-fix/plan.md`

## What & Why

`infrastructure.md` has 6 stale "Cloudflare Pages" references that were missed during `cloudflare-migration`. The Getting Started section was fixed then, but the upper sections (frontmatter, Recommendation, Shortlisted Platforms, Anti-Bias heading, Operational Story) still describe the old Pages setup. This creates a misleading doc that contradicts the actual deploy target.

## Starting Point

`cloudflare-migration` (impl_reviewed) updated `CLAUDE.md`, `roadmap.md`, and Getting Started in `infrastructure.md`. Six references in lines 4–75 of `infrastructure.md` were not included in that change's scope.

## Desired End State

`infrastructure.md` consistently describes Cloudflare Workers as the active deploy target. The Platform Comparison table (historical record) is untouched. The Operational Story no longer mentions Cloudflare Pages automatic preview builds (removed) and correctly points to the Workers dashboard for secrets.

## Key Decisions Made

| Decision | Choice | Why |
|---|---|---|
| Preview deploys bullet | Remove entirely | Workers has no automatic git-based preview builds; keeping a false statement is worse than the omission |
| Platform Comparison table | Leave unchanged | Historical record of evaluated candidates — "Cloudflare Pages + Workers" there is accurate |
| Scope | infrastructure.md only | CLAUDE.md and roadmap.md were already fixed in cloudflare-migration |

## Scope

**In scope:** 6 text replacements in `context/foundation/infrastructure.md` (L4, L16, L35, L47, L72–75)

**Out of scope:** Platform Comparison table, Getting Started section, body text of Anti-Bias / Pre-Mortem / Unknown Unknowns, all other files

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Fix stale references | infrastructure.md fully consistent with Workers | Wrong grep pattern misses a reference |

**Prerequisites:** None  
**Estimated effort:** ~1 session, 1 phase

## Success Criteria (Summary)

- `grep "Cloudflare Pages" infrastructure.md` returns only Platform Comparison table lines
- `grep "wrangler pages" infrastructure.md` returns no results
- Recommendation, Shortlisted, Anti-Bias heading, Operational Story all read "Cloudflare Workers"
