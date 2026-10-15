---
id: T-0245
title: "Domain seeds for CardTable, BookingForm and BoardGrid (battleship, word) that pass corpus review"
type: feature        # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
branch: feat/domain-seeds
worktree: .claude/worktrees/wave-ds
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Four corpus seeds pass the a2ui-review-agent at score 3 or higher, so T-0240 can admit them into per-persona shards: a Croupier CardTable round, a Concierge BookingForm, a Lexicographer word BoardGrid and an Admiral battleship BoardGrid.

## Context
T-0240's lane ran the corpus review on the three existing candidates; all scored 2 (D1). Verdicts were saved from wave-le `.sdlc/runtime/tasks/domain-exemplars/review-verdicts.json`.
- `frontier-board-grid-guesses`: caption Text where a GameHud belongs, misses marked with a circle where the rules use a cross, the hidden answer never in `/secret` (T-0230), an impossible CRANE row.
- `persona-croupier-card-table`: `/phase` never bound; bankroll 1000 where it should read 950 after a 50 bet.
- `persona-concierge-booking`: guest choices never reach the agent (no `sendDataModel`, no action context); a confirmation renders before submit.
- No battleship seed exists; Admiral ("Fire at B3") needs one.

## Constraints
Author through the a2ui-payload-authoring seat and its validate loop; a2ui-review-agent grades (generator is not critic). Hidden state lives in `/secret`. Seeds only: no corpus plumbing (that is T-0240).

## Done when
- Each of the four seeds validates against its persona catalog and scores 3 or higher from a2ui-review-agent, verdicts saved beside the handoff.
- `npm run check` exit 0.
