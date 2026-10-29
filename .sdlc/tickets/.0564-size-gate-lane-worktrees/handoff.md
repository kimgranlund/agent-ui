---
id: T-0564
title: "measure-size gives the same answer in a lane worktree as on main"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2
depends: [T-0529]
created: 2026-10-29
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
`node scripts/measure-size.mjs` reports the same sizes in a lane worktree that links node_modules from the main checkout as it does on main, so the size gate gives no false red in lanes.

## Intent
- Do: reproduce the false OVER (app, code/markdown, code/editor) in a lane worktree built with the symlink recipe; find why the bundle measurement differs (likely module resolution through the symlinked `node_modules/@agent-ui/*` or a different dependency copy); fix measure-size or the lane link recipe so both agree; add a test or selftest that fails on the old behaviour.
- Non-goals: changing any budget.
- Done when: in a fresh lane worktree made with the recipe, `node scripts/measure-size.mjs` exits 0 and prints the same numbers as the main checkout; `npm run check` exits 0.

## Context
T-0529's verifier (PR 2362) saw, in a throwaway worktree with a symlinked node_modules, measure-size report app, code/markdown and code/editor OVER, while the wave tree reported them within budget. The lane recipe (seat-map Dispatch laws, and `~/.claude` scratchpad `openlane.sh`) symlinks each top-level `node_modules/*` from the main checkout and links `node_modules/@agent-ui/<pkg>` to the lane's own `packages/agent-ui/<pkg>`.

## Constraints
No em dashes. No paid runs. Starts after PR 2362 merges.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- In this lane (per-entry node_modules links to the main checkout), `node scripts/measure-size.mjs` exits 0 and its output is byte-identical to the same command on the main checkout at the base sha (before the fix the app rows differed by 1 B and 17 B from module-order drift).
- `node scripts/measure-size.mjs selftest` exits 0, and exits 1 when `layoutLocalPlugin` is dropped from `bundleOf` (fixture dep linked outside its root leaks realpath ids).
- `check:scripts` runs `node scripts/measure-size.mjs selftest` ahead of the measurement; no budget value changes.
- `npm run check` exits 0.

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 0d03f6fe4c64
- Changed: measure-size reports the same sizes in a lane worktree as on main, with a selftest in check:scripts
- Commits: none
- Check: 1 In the lane, measure-size exits 0 and is byte-identical to main at the base sha: pass
- Check: 2 selftest exits 0 and exits 1 when layoutLocalPlugin is dropped from bundleOf: pass
- Check: 3 check:scripts runs `measure-size.mjs selftest` ahead of the measurement, no budget change: pass
- Check: 4 `npm run check` exits 0: pass
