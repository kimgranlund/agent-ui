<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
pass

## Criteria
Step 1 (base ff5271ad, ticket start; both WIP commits cc021553 and b9bc9e3c checked; tree clean outside .sdlc):
- s1#1 catalog.json CardTable row (children ChildList, nine bindable props, enums match PlayingCard): pass. Evidence: the python assert exits 0.
- s1#2 selection.json CardTable sidecar: pass. Evidence: python assert exits 0.
- s1#3 test files and describe titles exist: pass. Evidence: `test -f` plus both `grep -qF` exit 0.
- s1#4 `vitest run croupier -t CardTable` reports at least one pass: pass. Evidence: 20 passed, 43 skipped, exit 0. Red-ness: in a throwaway HEAD worktree I broke the factory (`c.faceDown = false`) and the check arm (removed the HAND_BINDING condition). 5 CardTable tests failed (card-table.test.ts x2, checks.test.ts x3), so the tests bite. Worktree removed.
- s1#5 croupier folder guard: pass. Evidence: 6 files, 63 tests passed.
- s1#6 long packages guard list (selection-guidance, asset-source, freshness, registry, semantic-check, builtin-controls, persona-catalogs, testkit matrix, prompt-drift, examples ...): pass. Evidence: 20 files, 852 tests passed.
- s1#7 site guard (agent-manifest, capability-registry x2): pass. Evidence: run together with agent-admin-presets.test.ts, 4 files, 48 tests passed.
- s1#8 tools registry generate.test.ts and `generate-agent-assets.mjs --check`: pass. Evidence: 10 tests passed, check exit 0.
- s1#9 CardTable in croupier.manifest.json, selection-projection.gen.ts and both capability-registry.json copies: pass. Evidence: exit 0.
- s1#10 no em dash in added lines: pass. Evidence: criterion command exit 0, and a whole-diff `ff5271ad..HEAD` grep for U+2014 in added lines counts 0.
- s1#11 scope: pass. Evidence: `git diff --name-only ff5271ad cc021553` filtered by the step-1 allowlist is empty.

Step 2 (base cc021553):
- s2#1 (red) `If the catalog has CardTable` in both mini-skills and the new describe title: pass. Evidence: the greps exit 0.
- s2#2 (guard) mini-skills, prompt-equivalence and prompt-budget tests: pass. Evidence: 3 files, 143 tests passed. This covers the K6 budget and the 800 character body cap.
- s2#3 (red) the baseline moved only in `miniSkills`: pass. Evidence: the python check exits 0. The diff shows only the `card-layout` and `game-table-chrome` bodies changed, matching the handoff text.
- s2#4 (red) croupier `seedVersion` is base + 1: pass. Evidence: exit 0 (7 to 8, with the comment head required by the handoff).
- s2#5 (red) CardTable in both preset skills: pass. Evidence: both awk/grep pipelines exit 0.
- s2#6 (guard) agent-manifest and agent-admin-presets tests: pass. Evidence: part of the 48-test site run above.
- s2#7 (guard) registry generate.test.ts and `generate-agent-assets.mjs --check`: pass. Evidence: as s1#8.
- s2#8 (guard) `npm run check`: pass. Evidence: exit 0 (tsc, check:site, check:tools, check:scripts selftests green). The builder's first run hit a `reap-scratch-clones` count flake that did not recur.
- s2#9 (guard) `npm test`: pass. Evidence: exit 0, 720 files passed and 2 skipped, 14986 tests passed and 7 skipped.
- s2#10 no em dash in added lines: pass. Evidence: criterion command exit 0.
- s2#11 scope: pass. Evidence: `git diff --name-only cc021553 HEAD` lists only assets.gen.ts, the two mini-skills, mini-skills.test.ts, the baseline, croupier.manifest.json and agent-admin-presets.ts, all in the allowlist.

Conductor-requested checks:
- Real createRenderer jsdom probe (my own throwaway test, deleted afterwards), run on both the agent-ui and the a2ui-basic CardTable seeds:
  - No renderer error messages.
  - Dealer cards render as `[faceDown false, true]` (hole card face down); the player has 2 cards.
  - Both hands are bound to `/dealerHand` and `/playerHand`.
  - Root children are `head, zone, zone, readout, ui-button x3`, so the Buttons land after the readout.
  - Text reads `Dealer Total 9 ... You Total 17 ... Bankroll 1,000 · Bet 50 Hit Stand Double`.
  - Each Button click produced exactly one client message, an `action` named `hit`, `stand` and `double` respectively, with `sourceComponentId` set.
  - CardTable declares no wire `action` prop. The Buttons are ordinary ChildList children, so the ProductCard `mapsTo 'action'` stripping does not apply.
- Hand check arm on the agent-ui seed (`croupierHandConsistency` through `semanticSurfaceViews`):
  - The clean deal gives `[]`.
  - A literal dealerHand gives HAND_BINDING.
  - playerHand bound to `/hand` gives HAND_BINDING, HAND_COUNT and HAND_TOTAL.
  - A `/playerTotal` that disagrees with the hand gives HAND_TOTAL.
  - A literal dealerTotal 12 gives HAND_TOTAL.
  - HAND_COUNT on a mismatched pointer is also covered by the builder's test.
- K6 on this tree, from the T-0065 probe: the default agent-ui turn is unchanged at 44,392 chars (text 43,749 + tool 643, bound 46,430). The derived `agent-ui--croupier` turn with the real CardTable row is 45,310 (+918 over default, of which 143 is the derived-id line). The post-R1 re-measure is pending, since T-0072 is not in this tree.
- seedVersion 7 to 8 hand edit to croupier.manifest.json: judged acceptable. The step-2 builder note and the manifest writer's own contract say a seedVersion bump stays a human edit to the manifest. The `seed-version` drift leg in agent-manifest.test.ts passes. The handoff's claim in step 5 that the writer moves it was wrong, and the builder reported that.
- Teaching lives in the card-layout and game-table-chrome mini-skills and the croupier preset skills. The mini-skill baseline and the generated assets are consistent (freshness and equivalence tests pass).

## Out of scope changes
None. The step-1 deviation, a fourth `notFor` edge from PlayingCard to CardTable in selection.json, is inside the croupier folder and was required by the `selection-guidance.test.ts` reciprocity guard. PlayingCard is now at the NOT_FOR_MAX cap of 4.

## For the next attempt
None. Pending, not a fail: after the rebase over T-0072 (R1), re-run K6 and regenerate or recapture the shared generated files. On a conflict, take either side and regenerate, never hand-merge. Bump the croupier `seedVersion` one past R1's if R1 bumps it. Minor: the readout part is a `div` where the handoff said ui-text; no criterion covers it and the render text is correct.
