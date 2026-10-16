---
id: T-0300
title: "A settled table frames Deal again alone in a Card: a LONE_BUTTON_FRAME check"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
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

## Acceptance criteria
1. `npx vitest run packages/agent-ui/a2ui/src/catalog/framed-choice-check.test.ts` exits 0: a `T-0300` block replays the recorded Sonnet Omaha showdown (`.sdlc/evals/rounds/2026-10-15-r6-matrix/runs/regress-croupier-omaha-sonnet-1/fixture.json` turn 4, report :234) and the check fires exactly `LONE_BUTTON_FRAME table-1:actionsCard`; the opening table (turn 0, three buttons in the footer) and a Card with a header and a Button do not fire; two lone-button Cards under one parent stay `FRAMED_CHOICE` only (red at the base: no LONE_BUTTON_FRAME code exists).
2. The check rides every catalog through the existing `framedChoiceCheck` registration (chat-validation, the probe replay host, the domain seeds), so no host list changes.
3. `npx vitest run packages/agent-ui/a2ui/src/catalog packages/agent-ui/a2ui/src/examples packages/agent-ui/a2ui/src/live-agent scripts/e2e-admin/probe` exits 0.
4. `npx vitest run --project site site/pages/agent-admin-presets.test.ts` and `npm run check` exit 0.

## Outcome

2026-10-16 · lane: full L2 · verdict: closed by reason (Merged in the round 6 game-table lane; verifier L2 pass) · verifier: none · base: none
- Changed: see commits
- Commits: none
