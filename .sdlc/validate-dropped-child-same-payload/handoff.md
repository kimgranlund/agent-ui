---
id: T-0226
title: "validate.ts keeps a child that the same payload drops when it resends a seeded container"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
When one payload resends a seeded container without a child, validate.ts treats that child and its subtree as gone, as the renderer does (T-0220's component-merge.ts), so server and client agree within a single payload too.

## Context
Found by lane 2 (T-0220, fix/producer-renderer-leaks): the cross-turn seed and semantic views now replay batches like the renderer, but validate.ts still keeps the dropped child inside one payload. The T-0184 repro does not hit it.

## Done when
- A test with one payload that seeds a container then resends it without a child fails before and passes after, with a real-renderer agreement check.
- npm run check plus the touched a2ui tests exit 0.
