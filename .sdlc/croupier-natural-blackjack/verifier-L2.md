<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
pass

## Criteria
- 1. A player natural with Hit/Stand/Double buttons gives one finding, and the repaired surface gives none: pass. Evidence: `npx vitest run packages/agent-ui/a2ui/src/catalog/personas/croupier` gave 5 files and 42 tests passed. The new describe block (checks.test.ts:169) covers the screenshot hand (A♠ K♥, 7♣ up, face-down dealer card, three move buttons) and its repair. In a throwaway worktree with the pre-change `checks.ts` (from `HEAD^`), 5 of the 23 tests in checks.test.ts went red, including "fails the screenshot with one finding naming the move buttons and the face-down hole card". So the check can fail.
- 2. A three-card 21 and a two-card 20 give no natural finding: pass. Evidence: checks.test.ts:252 "stays green for a 21 reached with three cards, a two-card 20, and a soft 17, each with all three moves" passes. The ace-and-nine and two-aces cases and the unresolved-hand "indeterminate" case are in the same block. The code is at checks.ts `isNatural`, which needs exactly 2 cards, one ace and one ten-value card.
- 3. The persona prompt or seed carries the natural rule, mirrors regenerated, gates green: pass. Evidence:
  - The commit adds the rule to the croupier preset `surfaceStyle`, the `round-loop` seed content and the blackjack GAMES_RULES entry.
  - `seedVersion` goes 6 to 7 in `agent-admin-presets.ts`, and the manifest `seedVersion` and `seedDigest` are updated to match.
  - `agent-model.md` and `producer-order-and-yield.md` were updated.
  - `npm run check` exited 0, and its tail shows the keyless test-kit selftest green.
  - `npm test` exited 0: 689 files passed, 2 skipped, 14404 tests passed, 7 skipped.
  - The diff adds no em dashes (0 added lines contain `—`).

## Out of scope changes
None. Of the 8 files in the commit, `hands.fixture.ts` and the two docs reference edits are in scope. The fixture holds the test hands, and both docs mirror the new check (stale-record repair).

## For the next attempt
None.
