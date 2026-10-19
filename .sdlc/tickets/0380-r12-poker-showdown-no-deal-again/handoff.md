---
id: T-0380
title: "A poker hand settled through the data model only offers no Deal again (round 12 cluster M)"
type: bug             # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-18
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A poker hand settled through the data model alone (a showdown repair that sends only updateDataModel) is sent back when it still offers no Deal again.

## Intent
- Do: widen `dealAgainMissing` in `packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts` beyond CardTable phases, so a poker surface whose data model reads a showdown or settled phase with Check, Bet or Fold still live and no Deal again fires DEAL_AGAIN_MISSING.
- Non-goals: blackjack CardTable flows (unchanged).
- Done when: a check test on the r12 :52 round 2 payload fires DEAL_AGAIN_MISSING; correct settled hands stay quiet; `npm run check` exits 0.

## Context
Round 12 archive `.sdlc/evals/rounds/2026-10-19-r12-targeted/` (report.md "Why it failed and how to fix it", fog report 6bae5f5b20e6a9741951dd4a). Trace lines `:n` are 1-based lines of its `traces/2026-10-19.jsonl`. Kim chose to ticket this cluster on 2026-10-19. Cluster M: `texas-holdem-haiku-1` (:52) and `seven-card-stud-haiku-1` (:77, :78): the showdown arrives in an ACTION_NOT_APPLIED repair round as `updateDataModel` only (`"phase": "Showdown"`); Check, Bet and Fold stay and the Deal again click fails. SHOWDOWN_UNSETTLED passes once the hand is face up with a result.

## Constraints
Recorded rounds are never rewritten.
