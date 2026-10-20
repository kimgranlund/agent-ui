---
id: T-0380
title: "A poker hand settled through the data model only offers no Deal again (round 12 cluster M)"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
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

## Acceptance criteria
- `npx vitest run packages/agent-ui/a2ui/src/catalog/personas/croupier/poker-deal-again.test.ts` exits 0: the r12 :52 hold'em and :77 stud repair rounds (fixture `__fixtures__/r12-poker-showdown-data-only.json`, copied unedited from the archive) fire DEAL_AGAIN_MISSING; the same showdown with the moves replaced by Deal again passes every croupier check; a hand still in play, a settled hand with no live move, and disabled moves stay quiet.
- `npx vitest run packages/agent-ui/a2ui/src/catalog/personas/croupier` exits 0 (the blackjack CardTable DEAL_AGAIN_MISSING cases unchanged).
- `npm run check` exits 0.

## Outcome

2026-10-20 · lane: full L2 · verdict: pass · verifier: verifier-L3 (fable) · base: 4d5a18d43fe1
- Changed: see commits
- Commits: none
- Check: 1 `npx vitest run packages/agent-ui/a2ui/src/catalog/personas/croupier/poker-deal-again.test.ts` ex...: pass
- Check: 2 `npx vitest run packages/agent-ui/a2ui/src/catalog/personas/croupier` exits 0 (blackjack CardTabl...: pass
- Check: 3 `npm run check` exits 0: pass
- Follow-up: note: packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts:1357... -> notes.md
