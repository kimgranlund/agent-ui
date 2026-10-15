---
id: T-0258
title: "Haiku frames each starter choice in its own Card; nothing repairs or tests it"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0257]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
When a model frames each choice in its own Card (Card, CardFooter, one Button, repeated), the producer catches it in the repair loop and the turn ships a plain Row of Buttons; a keyless negative fixture keeps the real Haiku output as a failing case.

## Context
T-0257 (2026-10-15): the recorded live Haiku "hello" reply put each starter choice in its own Card, the framed-choice pattern T-0172 rules out. The probe's render lint `lone-button-frame` caught it; T-0257 hand-edited the recording so the green-path selftest passes. The T-0257 verifier noted nothing else covers the real output: no fixture is expected to fail `lone-button-frame`, and no producer check repairs it. Prose does not steer; checks do (T-0208).

## Done when
- The original recording (from git history before T-0257) is restored as a negative probe fixture that fails `lone-button-frame`, and the selftest expects that failure.
- A producer semantic check (or the composite-moment table) flags a Card whose only content is one Button, repeated as siblings, and the repair round turns it into a Row of Buttons; a keyless replay shows the repaired turn.
- scripts/e2e-admin tests, the chat-probe selftest (with `--browser`) and `npm run check` exit 0.
