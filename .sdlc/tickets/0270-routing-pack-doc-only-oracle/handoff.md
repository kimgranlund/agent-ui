---
id: T-0270
title: "Routing pack doc-only oracle expects property-knowledge-base loaded full, but T-0231 serves those facts in the persona section"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
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

## Acceptance criteria
- `npx vitest run scripts/e2e-admin/probe/scenarios/routing.test.mjs scripts/e2e-admin/probe/scenarios/round3.test.mjs` exits 0; its T-0270 case judges the doc-only oracle against the routing round 3 recorded and finds no miss.
- `node --experimental-strip-types scripts/e2e-admin/probe/scenarios/routing.ts | diff - scripts/e2e-admin/probe/scenarios/routing-pack.sh` exits 0.

## Lane bundle
This solo lane delivers these tickets in order, one commit each:
- .sdlc/tickets/0270-routing-pack-doc-only-oracle/handoff.md
- .sdlc/tickets/0271-probe-click-target-misleading/handoff.md
- .sdlc/tickets/0272-stud-scenario-fixed-limit/handoff.md
