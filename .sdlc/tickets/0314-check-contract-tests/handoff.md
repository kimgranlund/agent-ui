---
id: T-0314
title: "Check contracts: pass and fail fixtures cross-run across all checks, a repair-text vocabulary test, and a repair-loop property test (P2)"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
P2 as revised (Kim 2026-10-16 debate): every `SemanticCheck` (`catalog/semantic-check.ts:110`) gets pass and fail fixtures, cross-run against every other check (a fixture that passes its own check must not fail another unexpectedly); a vocabulary test over repair text (check-result framing, no type names the persona forbids); a test-only property test over the repair loop in `agent/produce.ts` with invariant I1 scoped to the turn and a pin of the T-0302 earlier-round fallback. No refactor unless a property fails. Source: `.sdlc/work/routing-architecture-review/` (proposals, challenge and rebuttal under `.sdlc/runtime/tasks/routing-architecture-review/`).

## Done when
- The cross-run, vocabulary and property tests exist and pass; a mutated check makes the cross-run red; any real defect found is filed, not fixed here; `npm run check` exits 0.
