---
id: T-0270
title: "Routing pack doc-only oracle expects property-knowledge-base loaded full, but T-0231 serves those facts in the persona section"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The routing pack's `doc-only` scenario checks how the late check-out facts reach the turn today (the persona's House facts, T-0231), not a full `property-knowledge-base` load.

## Repro
Read `.sdlc/evals/rounds/2026-10-15-r3-routing/``runs/routing-doc-only-{haiku,sonnet}-1/report.json`: `routing-expect` t0 and t1 report "reference property-knowledge-base loaded index-only, not full".

## Expected
`routing-expect` passes when the facts are in the prompt by design.

## Actual
All 4 `routing-expect` failures in the round are this oracle. Both models answer correctly ("late check-out to 14:00, subject to availability") and correctly decline to name a fee the house facts do not hold.

## Context
`scripts/e2e-admin/probe/scenarios/routing.ts` (`KB_FULL` on `doc-only`). T-0231 put the facts in the persona section rather than loading the resource. Guess: expect `sections: ['persona']`, or add a facts oracle to RoutingExpect. Found by T-0261.
