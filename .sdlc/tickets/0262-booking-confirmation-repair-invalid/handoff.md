---
id: T-0262
title: "BookingConfirmation repair asks for bound rows the schema rejects and keeps the hand-built Card around it"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The BookingConfirmation repair produces a valid, unwrapped BookingConfirmation: its instruction matches the catalog schema (`rows` is a literal array of `{label, path}`, not a bound path) and tells the model to replace the hand-built Card, not nest inside it.

## Repro
1. `npx vitest run scripts/e2e-admin/probe/replays/concierge-sonnet-confirmation-rows.test.mjs scripts/e2e-admin/probe/replays/concierge-opus-nested-confirmation.test.mjs` (both pin today's behavior).
2. Read `.sdlc/evals/rounds/2026-10-15-r3-routing/``traces/2026-10-15.jsonl` lines 151, 207, 212, 247 (CATALOG after the repair) and 286 (nested Card).

## Expected
After BOOKING_CONFIRMATION_MISSING, the next round ships one BookingConfirmation with literal `rows`, at the root or replacing the Card, and the turn has no SEMANTIC_UNCORRECTED.

## Actual
In round 3, BOOKING_CONFIRMATION_MISSING fired on 9 turns, and only 2 were saved. On 7 turns, the model bound `"rows": {"path": "/booking/rows"}`, got `CATALOG: at root.rows`, and shipped a Card and Badge uncorrected (Sonnet 6, Haiku 1). On Opus (:286), the repair wrapped BookingConfirmation in the old Card, and the probe's render-lint failed nested-card on turns 3 and 4 of `long-concierge-booking-opus-1`.

## Context
The repair text is in `packages/agent-ui/a2ui/src/catalog/composite-moments.ts:58` ("with its title and summary rows bound to the booking"). The catalog row is `BookingConfirmation.properties.rows` in `personas/concierge/catalog.json`. Guess: the word "bound" invites a path, and "drop the hand-built rows" says nothing about the Card. Found by T-0261 (round 3 report, Check rates). Related: T-0266.
