---
id: T-0027
title: "Lazy catalog bodies, slices 1+2: ADR-0241 and the registry/loader seam (design.md, Option B)"
type: chore
status: done
size: M
priority: P3
depends: []
created: 2026-10-07
router: .sdlc/AGENTS.md
---

## Goal
Implement Slices 1 and 2 of `.sdlc/tickets/.0026-size-budget-split-design/design.md` (T-0026, Option B: lazy catalog bodies behind an eager manifest; default catalog stays sync). Kim chose Option B only on 2026-10-07. Worktree and branch made by the conductor.

## Intent
- Do: slices 1 (ADR-0241 as accepted, ratified by Kim 2026-10-07 per the standing grant, with the four append-only pointers) and 2 (registry and loader seam, wired nowhere, behavior-neutral). The design names every file per slice (section 7); follow its rules (section 5.2), gates (5.3) and renderer contract notes (5.4).
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

2026-10-07: Merged in #1850
