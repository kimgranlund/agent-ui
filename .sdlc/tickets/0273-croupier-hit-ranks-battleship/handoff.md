---
id: T-0273
title: "On a Croupier 'Hit' turn the Battleship board ranks second among the exemplars"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
On a Croupier move turn, no BoardGrid exemplar is in the top 3, as T-0253 requires.

## Repro
Read `.sdlc/evals/rounds/2026-10-15-r3-routing/traces/2026-10-15.jsonl` lines 42, 43 and 55 (`trace.exemplarIds`). For a keyless check, run `retrieve` on `agent-ui--croupier` for "Hit me again." and "Hit.".

## Expected
`domain-croupier-card-table-round`, then non-board exemplars.

## Actual
`domain-croupier-card-table-round, domain-admiral-battleship-board, ...` on "Hit me until I bust.", "Hit me again." and "Hit." (Haiku runs, but retrieval does not depend on the model). The other 155 Croupier turns hold no board.

## Context
`packages/agent-ui/a2ui/src/corpus/retrieve-presets.test.ts` pins only "Deal again". Guess: "hit" is Battleship vocabulary, and the T-0253 family rule does not demote another game's board below non-game exemplars. Found by T-0261.
