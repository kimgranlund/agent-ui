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
Four corpus seeds pass the a2ui-review-agent at score 4 or higher, so T-0240 can admit them into per-persona shards: a Croupier CardTable round, a Concierge BookingForm, a Lexicographer word BoardGrid and an Admiral battleship BoardGrid.

## Context
T-0240's lane ran the corpus review on the three existing candidates; all scored 2 (D1). Verdicts were saved from wave-le `.sdlc/runtime/tasks/domain-exemplars/review-verdicts.json`.
- `frontier-board-grid-guesses`: caption Text where a GameHud belongs, misses marked with a circle where the rules use a cross, the hidden answer never in `/secret` (T-0230), an impossible CRANE row.
- `persona-croupier-card-table`: `/phase` never bound; bankroll 1000 where it should read 950 after a 50 bet.
- `persona-concierge-booking`: guest choices never reach the agent (no `sendDataModel`, no action context); a confirmation renders before submit.
- No battleship seed exists; Admiral ("Fire at B3") needs one.

## Constraints
Author through the a2ui-payload-authoring seat and its validate loop; a2ui-review-agent grades (generator is not critic). Hidden state lives in `/secret`. Seeds only: no corpus plumbing (that is T-0240).

## Done when
- Each of the four seeds validates against its persona catalog and scores 4 or higher (the rubric admission bar) from a2ui-review-agent, verdicts saved beside the handoff.
- `npm run check` exit 0.

## Acceptance criteria
- `npx vitest run --project packages packages/agent-ui/a2ui/src/examples/domain-seeds.test.ts` exits 0: each of the four seeds in `packages/agent-ui/a2ui/src/examples/domain-seeds.ts` validates against its own catalog (persona seeds against the composed `agent-ui--croupier` / `agent-ui--concierge` document), renders with an empty error channel, and passes the live semantic checks (persona, hidden-state, composite-moment).
- `python3 -c "import json,sys; v=json.load(open('.sdlc/domain-seeds/review-verdicts.json'))['verdicts']; sys.exit(0 if len(v)==4 and all(r['qualityScore']>=4 for r in v.values()) else 1)"` exits 0: the a2ui-review-agent VerdictsFile scores all four seeds 4 or higher.
- `npm run check` exits 0.
