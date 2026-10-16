---
id: T-0288
title: "Code still keyed to .claude/worktrees: lanes in ../agent-ui.worktrees run vitest uncapped; reap scripts miss them"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Every repo check keyed to the lane location recognizes sdlc-lite 0.24's worktree root (`../agent-ui.worktrees/`, `wtroot.py root`) as well as the old `.claude/worktrees/`.

## Context
sdlc-lite 0.24.0 (merged in #2039) moved lanes out of the repo. `vitest.config.ts:34` and `vitest.browser.config.ts` cap workers at 4 only when cwd contains `/.claude/worktrees/` (Kim's 2026-08-20 ruling after the load-108 postmortem), so every lane now runs vitest at the full default: the N x cores thread explosion the cap exists to stop. `scripts/reap-worktrees.mjs`, `reap-branches.mjs` and `reap-scratch-clones.mjs` also look only under `.claude/worktrees/`.

## Done when
- A cwd under `<repo>.worktrees/` (and still `.claude/worktrees/`) gets the 4-worker cap in both vitest configs; a test or a small node check proves both paths and the primary checkout.
- The three reap scripts list lanes under the new root in dry-run mode; their tests exit 0.
- `npm run check` exits 0.
