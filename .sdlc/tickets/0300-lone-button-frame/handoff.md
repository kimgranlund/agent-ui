---
id: T-0300
title: "A settled table frames Deal again alone in a Card: a LONE_BUTTON_FRAME check"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A Card holding only one button is caught and repaired on every game table, not only the game pick (T-0172 rule).

## Context
Round 6 cluster E (`.sdlc/evals/rounds/2026-10-15-r6-matrix/report.md`, P3): Sonnet Omaha :234 leaves actionsFooter holding only dealBtn inside its own Card. Opus on identical framing has no lone frame (:420). Cause (b) guidance gap; render-lint caught it only outside the producer.

## Done when
- A semantic-check test on the :234 payload fires LONE_BUTTON_FRAME; a valid table does not; red at the base.
- The catalog check tests, `site/pages/agent-admin-presets.test.ts` and `npm run check` exit 0.
