---
id: T-0029
title: "Lazy catalog bodies, slices 4+5: a2ui-basic and persona sets behind records, budget re-base, record repairs (design.md, Option B)"
type: feature
status: done
size: L3
priority: P3
depends: []
created: 2026-10-07
router: .sdlc/AGENTS.md
---

## Goal
Implement Slices 3, 4 and 5 together (slice 3 alone would push the app bundle past its budget; the re-base in slice 4 must ship in the same change) of `.sdlc/tickets/.0026-size-budget-split-design/design.md` (T-0026, Option B: lazy catalog bodies behind an eager manifest; default catalog stays sync). Kim chose Option B only on 2026-10-07. Worktree and branch made by the conductor.

## Intent
- Do: slices 3 (renderer deferred apply, proven with a test-double lazy catalog first), 4 (move a2ui-basic and the persona sets behind records; default stays sync; re-base `APP_MARGINAL_BUDGET`; add the bundle gate) and 5 (repair the records that named the old timing), one PR. The design names every file per slice (section 7); follow its rules (section 5.2), gates (5.3) and renderer contract notes (5.4).
- Non-goals: Option C (default catalog lazy), Option D, any budget raise (a budget change is only the downward re-base in slice 4).
- Done when: `npm run check` and full `npm test` exit 0; `npm run size` exits 0; touched browser tests pass via `npm run test:browser` for their shard; generated files regenerated, never hand-edited; no em dashes; stale records repaired in the same change. ADR-0241 is the next free number: confirm it against `.claude/docs/adr/`, `site/public/adr-index.json`, every worktree and open PR before use; regenerate the sitemap per the 2026-08-30 carve-out.

## Context
Measurements and prototype are under `.sdlc/tickets/.0026-size-budget-split-design/` (copied into the worktree). Prior art: ADR-0233 per-control lazy loading, `control-loading.test.ts`.

## Constraints
Imports point inward only; Node fence on `src/agent/`; byte-pinned prompts must not move. Commit locally in the worktree; no push or PR without approval.

## Acceptance criteria
1. The design's slice gates for this ticket exist and are red before, green after.
2. Gates in Done when are green; the app size row stays green.

## Closed

2026-10-08: Merged in #1858
