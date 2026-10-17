---
id: T-0329
title: "Haiku blackjack openings back on the CardTable after the T-0323 wording (round 9 cluster B)"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Haiku blackjack openings render a CardTable in round 1 at round 8's rate or better, with poker unchanged.

## Intent
- Do: the fix in Context, one cause.
- Non-goals: other round 9 clusters.
- Done when: Measure on 10 Haiku samples of "Blackjack, please." with old and new text; the T-0323 poker tests stay green; prompt baseline recaptured by the deliberate flow. `npm run check` plus the touched folders' tests exit 0.

## Context
Kim 2026-10-17: debate a wording fix (Opus proposal, a different-family challenge), then Kim rules; only then build. Changed text: prompts/mini-skills/game-table-chrome.md:7, card-layout.md:6, site/pages/agent-admin-presets.ts:219-243. Round 9: 5 of 7 Haiku openings were an ask Card with a Slider (round 8: 1 of 7). report .sdlc/evals/rounds/2026-10-17-r9-matrix/report.md cluster B.

## Constraints
Poker stays on the Card frame (T-0323 ruling).
