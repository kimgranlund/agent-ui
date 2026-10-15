<!-- role=verifier level=L1 model=sonnet effort=medium -->
## Verdict
fail

## Criteria
- Ten rewrites within 90 chars, no parentheses: fail. The work is not part of this run. All ten new strings are already in `selection.json` at HEAD (`grep -c` returned 1 for each of the eight I checked, and the Toolbar and Card strings are at lines 1021 and 217). They landed in commit 7d3ac733 (#1830), which is an ancestor of the base `bf61b003`. `git diff bf61b003` is empty and `git status` shows only untracked `.sdlc/`. I did not measure string lengths because there is nothing from this run to measure.
- `selection-guidance.test.ts` green, `prompt-drift` budget leg green, `npm run check` and a2ui tests exit 0: fail. I did not run them. There is no builder diff to gate.
- Recapture diff touches only the changed clauses: fail. This run produced no recapture. The existing 7d3ac733 changed `prompt-equivalence.baseline.json` by 8 lines, but that is not this run's work.
- Builder claims: none to check, because `builder-*.md` does not exist in the artifacts dir.

## Out of scope changes
None.

## For the next attempt
Do not rebuild. T-0007 appears already done by #1830 (GH #1815 item 3).
- Close T-0007 as already landed, citing 7d3ac733.
- If you want a real check, rerun the gates against HEAD: `selection-guidance.test.ts`, the `prompt-drift` budget leg, `npm run check`, and the a2ui tests.
- If more work remains, it is the runner-ups (Badge to Text, Column to Row) and the ADR-0232 follow-up bullets at about lines 89, 94 and 120. The ADR diff in 7d3ac733 is only 2 lines, so check whether those bullets were fully updated.
