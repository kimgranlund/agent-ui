---
id: T-0387
title: "Croupier greet OptionDeck renders as a one-character-wide column with no cards"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-20
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The Croupier's greet OptionDeck in agent-admin Test Chat renders its game cards at full width, and the heading reads on one line. A test that failed before the fix passes after it.

## Repro
1. agent-admin, persona The Croupier, Test Chat (live model; Kim 2026-10-20, dark theme, wide viewport).
2. Open the chat so the greeting turn renders.

## Expected
The heading "What are we playing?" and subheading "Bankroll: 985 chips" on single lines, above a grid of game cards plus a Surprise me card (the approved playful look, T-0193).

## Actual
See `report.png` in this folder. The greet surface is a wide dark box, but the deck content sits in a column about one character wide: the heading wraps after every 1 or 2 letters ("W / h / at / ar / e ..."), the subheading wraps the same way, and no option cards are visible. The model's prose then tells the user to "pick one from the game list above", which shows nothing usable.

## Context
OptionDeck shipped in T-0193 (#2178). The Croupier greeting adopted it in step 4 (actionName "pick_game", one option per enabled game-rules resource, allowRandom). The visual goldens and the dogfood lint passed on the demo page and the catalog preview, but neither covered it inside agent-admin's chat bubble or canvas.
Guesses, not verified: (a) the deck host gets a zero or min-content inline size inside the chat surface (it is a grid or flex item without `min-width: 0` or a width, or the auto-fit grid resolves to zero tracks), so text wraps per character; (b) the options did not render at all (the codec dropped them, for example because the model sent fields the codec rejects, or a bound `options` the check skips), and the empty grid collapses. Find which one with a replay or a real-engine test of the greet payload inside the chat host. The live trace for this turn may be in agent-admin's trace store or recoverable with `npm run chat:probe -- --from-trace last`.

## Constraints
Fix the cause in the control or the host, not in the persona prompt. Add a browser test that mounts the deck inside the chat surface (or the same container contract) and asserts a sane heading width and visible option cards. Run the whole dogfood render lint.
