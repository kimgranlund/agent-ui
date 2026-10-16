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
sdlc-lite 0.24.0 (merged in #2039) moved lanes out of the repo. `vitest.config.ts:34` and `vitest.browser.config.ts` cap workers at 4 only when cwd contains `/.claude/worktrees/` (Kim's 2026-08-20 ruling after the load-108 postmortem), so every lane now runs vitest at the full default: the N x cores thread explosion the cap exists to stop. `scripts/reap-worktrees.mjs` and `reap-branches.mjs` also look only under `.claude/worktrees/` (`reap-scratch-clones.mjs` scans tmp and scratchpad roots, not lane roots; only its header comment named the old root).

## Done when
- A cwd under `<repo>.worktrees/` (and still `.claude/worktrees/`) gets the 4-worker cap in both vitest configs; a test or a small node check proves both paths and the primary checkout.
- `reap-worktrees` and `reap-branches` list lanes under the new root in dry-run mode; all three reap selftests (with `reap-scratch-clones`) exit 0.
- `npm run check` exits 0.

## Plan fix (conductor, 2026-10-16)
Verifier try 2 failed only criterion 2 as a plan defect: `reap-scratch-clones` never scanned a lane root, so "the three reap scripts list lanes" was vacuous for it. Criterion 2 now names the two lane-keyed scripts and keeps all three selftests. No build change.
