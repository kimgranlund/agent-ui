---
id: T-0059
title: "Untrack the stale site/.fixture-scratch build snapshot (486 files)"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-08
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
`site/.fixture-scratch/` (486 tracked files, stale generated build output last touched in #1143) is no longer tracked and cannot be committed again.

## Intent
- Do: `git rm -r --cached` is not enough alone; `git rm -r site/.fixture-scratch`; add `site/.fixture-scratch/` to .gitignore if absent; confirm no gate, script, test or doc reads the dir as input (the three known hits are comments or an ADR note about it).
- Non-goals: the sitemap, other build dirs, ADR-0069 prose (historical).
- Done when: `npm run check` and full `npm test` (--maxWorkers=4) exit 0; `npm run build` exit 0; `git ls-files site/.fixture-scratch` is empty; no em dashes added.

## Context
Found by the T-0056 verifier: the dir still holds the old "Sonnet 5 vs Haiku 4.5" flagship label. Tests that generate into it (if any) must still pass with the dir ignored.

## Constraints
Commit locally; no push.

## Closed

2026-10-08: Merged in #1875
