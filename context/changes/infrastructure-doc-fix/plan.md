# infrastructure-doc-fix Implementation Plan

## Overview

Fix stale "Cloudflare Pages" references in `context/foundation/infrastructure.md` that were missed during the `cloudflare-migration` change. The file was partially updated (Getting Started section) but 6 references in the upper sections still describe the old Pages setup. Doc-only change — no code, no contracts, no schema.

## Current State Analysis

`cloudflare-migration` updated Getting Started (L89–96) and `CLAUDE.md`, but left the following stale in `infrastructure.md`:

- L4 frontmatter: `recommended_platform: Cloudflare Pages + Workers`
- L16 Recommendation heading: `Deploy on Cloudflare Pages + Workers.`
- L35 Shortlisted section: `#### 1. Cloudflare Pages + Workers (Recommended)`
- L47 Anti-Bias heading: `## Anti-Bias Cross-Check: Cloudflare Pages + Workers`
- L72 Operational Story — Preview deploys bullet (Pages-specific, not valid on Workers)
- L73 Operational Story — Secrets location: `Cloudflare Pages → Settings → Environment variables`
- L74–75 Operational Story — `wrangler pages deployment list` (×2)

## Desired End State

`infrastructure.md` contains no references to "Cloudflare Pages" except in:
- The Platform Comparison table (historical record of evaluated platforms — correct as-is)
- The Operational Story "Preview deploys" bullet — removed entirely (Workers has no automatic git-based preview builds)

All remaining text correctly describes Cloudflare Workers as the active deploy target.

### Key Discoveries

- `CLAUDE.md` and `roadmap.md` were already corrected in `cloudflare-migration` — no changes needed there
- `Getting Started` section (L89–96) was already corrected — no changes needed there
- The Anti-Bias and Pre-Mortem body text correctly describes Workers weaknesses — only the heading label is stale

## What We're NOT Doing

- Not touching the Platform Comparison table — it's a historical record of evaluated options, "Cloudflare Pages + Workers" there is accurate as the original candidate
- Not rewriting body text (Devil's Advocate, Pre-Mortem, Unknown Unknowns) — content is correct for Workers
- Not adding CI/CD or staging deploy documentation — out of scope (infrastructure.md §Out of Scope)
- Not touching any other file

## Implementation Approach

Six targeted `Edit` calls on `infrastructure.md`. No new files, no deletions of sections — only the Preview deploys bullet is removed.

---

## Phase 1: Fix stale Cloudflare Pages references in infrastructure.md

### Overview

Six text replacements in `context/foundation/infrastructure.md`. All changes are within lines 4–75. Getting Started (L89–96) and the Platform Comparison table are untouched.

### Changes Required

#### 1. Frontmatter

**File**: `context/foundation/infrastructure.md`

**Intent**: Update YAML frontmatter to reflect the active platform.

**Contract**: L4 — `recommended_platform: Cloudflare Pages + Workers` → `recommended_platform: Cloudflare Workers`

---

#### 2. Recommendation heading

**File**: `context/foundation/infrastructure.md`

**Intent**: Fix the bold heading in the Recommendation section.

**Contract**: L16 — `**Deploy on Cloudflare Pages + Workers.**` → `**Deploy on Cloudflare Workers.**`

---

#### 3. Shortlisted Platforms section title

**File**: `context/foundation/infrastructure.md`

**Intent**: Fix the H4 label for the recommended platform.

**Contract**: L35 — `#### 1. Cloudflare Pages + Workers (Recommended)` → `#### 1. Cloudflare Workers (Recommended)`

---

#### 4. Anti-Bias Cross-Check heading

**File**: `context/foundation/infrastructure.md`

**Intent**: Fix the H2 heading label — the body text is correct, only the heading is stale.

**Contract**: L47 — `## Anti-Bias Cross-Check: Cloudflare Pages + Workers` → `## Anti-Bias Cross-Check: Cloudflare Workers`

---

#### 5. Operational Story — remove Preview deploys bullet, fix Secrets, fix Rollback + Approval

**File**: `context/foundation/infrastructure.md`

**Intent**: Remove the Pages-specific Preview deploys bullet (Workers has no automatic git-based preview builds). Update Secrets location to Workers dashboard path. Replace `wrangler pages deployment list` with `wrangler deployment list` in both Rollback and Approval bullets.

**Contract**: Replace the four-bullet block (L72–75) with a three-bullet block:
- Preview deploys bullet (L72): removed entirely
- Secrets (L73): `Cloudflare Pages → Settings → Environment variables` → `Cloudflare dashboard → Workers & Pages → ringabell → Settings → Variables and Secrets`; `Pages dashboard` → `Workers dashboard`
- Rollback (L74): `Pages deployments list: \`wrangler pages deployment list\`` → `Deployments list: \`wrangler deployment list\``
- Approval (L75): `\`wrangler pages deployment list\`` → `\`wrangler deployment list\``

### Success Criteria

#### Automated Verification

- No stale "Pages" references remain in the targeted sections: `grep -n "Cloudflare Pages" context/foundation/infrastructure.md` returns only lines inside the Platform Comparison table (L22–31) and the note below it (L31)
- `grep -n "wrangler pages" context/foundation/infrastructure.md` returns no results

#### Manual Verification

- Open `infrastructure.md` and confirm Recommendation, Shortlisted Platforms, Anti-Bias, and Operational Story all read "Cloudflare Workers" / "Workers dashboard" / `wrangler deployment list`
- Confirm Getting Started section (L89–96) is unchanged

---

## References

- Upstream change: `context/changes/cloudflare-migration/plan.md`
- Impl-review finding F3: `context/changes/cloudflare-migration/reviews/impl-review.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Fix stale Cloudflare Pages references in infrastructure.md

#### Automated

- [x] 1.1 grep "Cloudflare Pages" returns only Platform Comparison table lines
- [x] 1.2 grep "wrangler pages" returns no results

#### Manual

- [x] 1.3 Recommendation, Shortlisted, Anti-Bias, Operational Story read correctly
- [x] 1.4 Getting Started section (L89–96) is unchanged
