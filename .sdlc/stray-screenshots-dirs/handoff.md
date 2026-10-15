---
id: T-0228
title: "Browser-test __screenshots__ folders break selection.test and the merge queue"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
A failed browser test's `__screenshots__` folder never fails an unrelated gate: `registry/selection.test.ts` (sidecar scan) ignores folders that are not catalogs, `__screenshots__` is git-ignored repo-wide, and the merge queue removes them before its affected-test run.

## Context
Hit three times on 2026-10-15 (PRs 1991, 1997 and a lane run): vitest browser writes `__screenshots__` beside the failing test, and the sidecar scan in `packages/agent-ui/a2ui/src/registry/selection.test.ts` reads every folder under `catalog/personas/` as a persona.

## Done when
- A test plants a `__screenshots__` folder under catalog/personas and selection.test.ts still passes; it failed before.
- `npm run check` plus the touched tests exit 0.
