---
id: T-0350
title: "A settled card table ships with no way forward (no Deal again), and no check names it"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
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
Kim 2026-10-17: run the debate (Opus proposal, then a different-family challenge), then Kim rules; build only after. The proposal decides whether a deterministic check plus repair (sibling of T-0346 SHOWDOWN_UNSETTLED) is enough or persona wording must change too; for any wording, the exact text change (file:line, old and new) and a keyless replay plan.
