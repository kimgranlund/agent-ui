---
id: T-0076
title: "Fix stale catalog tier counts (60/54 vs 73) on the catalog pages"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
One or two sentences: the outcome, not the method.

## Intent
- Do:
- Non-goals:
- Done when:

## Context
Decisions made, paths, links. Everything a clean-context agent needs; it sees nothing else.

## Constraints
What must not change. "None" if none.

## Closed

2026-10-12: Already fixed in T-0064 step 2 (#1888): tiers.ts now says 73, INPUT 18, PATTERN 18; the 54-item count is gone
