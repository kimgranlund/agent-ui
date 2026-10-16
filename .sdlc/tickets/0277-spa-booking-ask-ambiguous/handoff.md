---
id: T-0277
title: "Round scenarios ask for 'a 60-minute massage', which T-0267's spa list makes ambiguous, so every model rightly refuses to confirm"
type: chore           # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The round scenarios' spa booking asks name one treatment, so a confirm step can be confirmed.

## Repro
`.sdlc/evals/rounds/2026-10-15-r4-fixes/`runs: `long-concierge-booking-confirm-*`, `long-concierge-booking-*`, `regress-concierge-spa-booking-*`, `routing-long-session-*`, t "Those details are right, please confirm the booking." (traces :8, :79, :115, :131, :151, :184, :187, :216).

## Expected
The ask "Book a 60-minute massage ..." names one treatment, and the confirm step ends in a BookingConfirmation.

## Actual
T-0267's spa list has two 60-minute massages (Swedish €120, deep-tissue €135). Every model pre-fills the BookingForm without a treatment and, on the confirm step, rightly refuses to book: "I can't confirm the booking yet because no treatment is selected" (Haiku :115), "Which 60-minute massage should I book?" (Sonnet :187), "the massage type is still blank" (Opus :216). 9 of 9 spa confirm turns fail `expect-turn BookingConfirmation` for this reason.

## Context
The ask lives in `scripts/e2e-admin/probe/scenarios/{routing,concierge,round3,round4}.ts`. The model behavior is correct; this is a scenario defect. Found by T-0275.

## Done when
- Every spa booking ask in the scenario generators names "Swedish massage"; the generated `live-commands.sh` files and their pinning tests are regenerated where a generator owns one, and finished round records are left unchanged.
- `npx vitest run scripts/e2e-admin/probe/scenarios` and `npm run check` exit 0.

## Lane bundle
This solo lane delivers these tickets in order, one commit each (`T-NNNN: <title>`):
- .sdlc/tickets/0277-spa-booking-ask-ambiguous/handoff.md
- .sdlc/tickets/0278-confirm-repair-forces-false-booking/handoff.md
- .sdlc/tickets/0282-surface-missing-confirm-vocabulary/handoff.md
- .sdlc/tickets/0283-stud-scenario-extra-check/handoff.md
- .sdlc/tickets/0276-natural-check-on-holdem/handoff.md
- .sdlc/tickets/0281-feed-scope-repair-drops-surface/handoff.md
