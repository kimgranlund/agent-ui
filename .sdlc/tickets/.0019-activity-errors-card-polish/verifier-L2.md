<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
fail

## Criteria
- 1. Repaired turn shows a retry marker and reachable codes: pass. The new browser test "a repaired turn keeps a painted, warning-toned N retries chip" passes on HEAD (conversation shard 136 passed, exit 0). At `d7004800` with the new test file copied in, that test fails in chromium and webkit, so it bites. It asserts the header chip text, a warning ink different from the meta ink, and `SCHEMA` on the validate row after expanding.
- 2. A live failed round shows its codes: pass, with limited evidence. The diff shows the old summary was "Round 1 failed, retrying in round N" with no codes. HEAD adds `TurnProgress.codes` and the `liveCodes` summary, plus tests in `a2ui-activity.test.ts`, `produce-loop.test.ts` and `meta-line.test.ts`. `npm test` exits 0 (689 files passed, 14388 tests passed). I did not run those jsdom tests at base.
- 3. Expanded strip header is not overlapped (browser test): fail. The test "expanded mid-run ... never paint over the pinned header row" passes on HEAD. It also passes at `d7004800` (the base run had only the retry-chip test failing), so the guard cannot go red. The commit has no CSS or layout change for Do 2. No artifact says whether the overlap was reproduced or why none was needed, so the user's reported defect is unaddressed and unproven.
- 4. Card sub-parts render with padding, root cause stated: fail. The "a streamed Card paints its regions inset" browser test also passes at base, so it is not red-then-green. No padding or Card fix is in the commit. The artifacts dir has no `builder-*.md` and no report stating a root cause, so the criterion's "root cause stated in the final report" has no evidence.
- 5. Croupier teaching puts badges in the CardHeader trailing slot, baseline recaptured, gates green: pass. The `game-table-chrome.md` and `game-hud.md` mini-skills now say status Badge with slot "trailing" directly in the CardHeader. `prompt-equivalence.baseline.json` and `assets.gen.ts` are updated in the commit. `npm run check` exit 0 and `npm test` exit 0 (which includes the freshness and equivalence tests).

## Out of scope changes
None. All 26 changed files trace to the four Dos. `site/public/llms-full.txt`, `theme-provider-built.css` and `dogfood-assets.ts` are generated or derived outputs.

## For the next attempt
- Do 2: reproduce the overlap where the user saw it, in the agent-admin Test Chat with the site CSS and the real `ui-conversation` host, not only the standalone `mountConversation`. Fix the layout, then show the guard red on `d7004800` and green on HEAD. If it truly cannot be reproduced, say so with evidence and replace the non-biting guard with one that can fail.
- Do 3: find the root cause of the flush Card regions and unindented activity text in the real chat surface. Candidates are a missing sub-tag style, ADR-0233 per-control entry or shared-styles loading, and the Croupier fragment. Fix it where it belongs, with a test red at base. If the standalone chat surface is correct, test the actual failing context.
- Write the root cause in a `builder-*.md` in the artifacts dir; criterion 4 requires it.
- Criteria 1, 2 and 5 held on this run. Re-check only 3 and 4.
