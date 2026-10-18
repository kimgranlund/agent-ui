---
id: T-0350
title: "A settled card table ships with no way forward (no Deal again), and no check names it"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A croupier turn that settles a hand on a new table always offers a way forward (a Deal again or New hand action on that table), and a check names the turn that does not.

## Repro
1. Round 10 `:101` (croupier pontoon, scripted, archive `.sdlc/evals/rounds/2026-10-17-r10-targeted/`). After T-0347's skip, the next scripted step is "Deal again".

## Expected
The settled pontoon natural on `table-2` carries its own Deal again (or equivalent) action, and the scripted click lands on it.

## Actual
The settled natural shipped only a data-model update on `table-2` with no Deal again button, so the click hit `table-1`'s old history button and failed `click-target` (T-0347 solo and verifier, 2026-10-17).

## Context
Found by T-0347 (closed); the verifier ruled it an agent or check gap, not a scenario defect. Guess: the croupier settle rules do not require a forward action on a settled table, and no check reads for one (the SHOWDOWN_UNSETTLED check from T-0346 is the sibling to extend). Any persona wording change goes through the debate rule.

## Constraints
The failing test lands before or with the fix, never after. The keyless replay `croupier-pontoon-natural-skip.json` stays green.

## Debate
Kim ruled 2026-10-17 after the Opus proposal and the Fable challenge (runtime `architect-L1.md`, `plan-reviewer-L1.md`): ship Part A only (DEAL_AGAIN_MISSING in `croupierBetControls`, its positive and negative tests, the offline replay pin on `croupier-pontoon-natural-skip.json`); hold Part B (no wording change to the NATURAL_ACTIONS tail at checks.ts:370) until a live natural shows the misread recurs with Part A in play. No persona or model-read wording changes beyond the new check's own message.

## Acceptance criteria
verifier: L3
- `npx vitest run packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.test.ts` exits 0: the :101 shipped round 2 gives exactly `[['DEAL_AGAIN_MISSING','table-2:root']]`, as do a bound-to-literal settle, an orphaned Deal again, and a neighbour table whose phase is unbound or that names poker; the round-1 Deal again, the r10 :38 and r9 :190 shapes, a Deal again answer opening a betting table, a forward on another touched surface, a table settled in an earlier turn, both settled seeds and a poker surface give none. A forward is only a press `actionApplied` treats as a new round (`isNewRound`). The repair asks for the settled updateDataModel with the components, and names a rejected answer only when `round` is above 0.
- `npx vitest run scripts/e2e-admin/probe/replays/croupier-natural-skip.test.mjs` exits 0: the offline replay of `croupier-pontoon-natural-skip.json` fails no probe check and turn 5's `failureCodes` equal `['DEAL_AGAIN_MISSING','SEMANTIC_UNCORRECTED']`.
- `npx vitest run packages/agent-ui/a2ui/src/live-agent/check-contracts.test.ts` exits 0, with a DEAL_AGAIN_MISSING probe under croupier-bet-controls.
- `npm run check` exits 0.
- No change under `site/agent-content/personas/croupier/` and none to the NATURAL_ACTIONS message.
