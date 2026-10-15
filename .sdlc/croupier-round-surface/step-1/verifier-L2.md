<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
fail

## Criteria
- Changed-file list is exactly the three expected files: pass. `git diff --name-only HEAD~1..HEAD | sort | diff - <(printf ...)` exited 0.
- `"context":{"newRound":true}` present in `agent-admin-presets.ts`: pass (grep exit 0).
- `"ONE persistent game surface"` absent: pass (exit 0).
- `seedVersion: 6, // one surface per round`: pass (exit 0).
- `a Row of the action Buttons`: pass (exit 0).
- `if (isNewRoundAction(message)) return undefined` in `agent-admin.ts`: pass (exit 0, and visible at the `#resumeTargetFor` hunk in the diff).
- (guard) `npx vitest run agent-admin.test.ts site/pages/agent-admin-presets.test.ts`: fail. Exit 1, 2 failed and 264 passed. Failing tests, both in `site/pages/agent-admin-presets.test.ts`:
  - `all fourteen surfaceStyle texts are modality-neutral`: "croupier surfaceStyle: This section names “surfaceId” (A2UI is off)".
  - `every persona’s ASSEMBLED prompt-section list is clean`: "croupier / surface-style: This section names “surfaceId”", same lint.
  - Pre-build check: in a throwaway worktree at `HEAD~1`, the same file passes 15 of 15. This is not an inherited red, and the build introduced it.
  - Cause: the new Croupier `surfaceStyle` at `agent-admin-presets.ts:159` says "FRESH surfaceId (table-1, …)". `prompt-lint.ts:73` lists `surfaceId` as a modality word, so the lint flags it. The `round-loop` skill content at line 202 also says "surfaceId". The failure is only in the surface-style section. The test checks the `AGENT_PRESETS` entries, where `round-loop` is a skill, and neither test flagged it.
- (guard) `npx vitest run agent-admin-app.test.ts persona-library-pattern.test.ts agent-roster-source.test.ts`: pass. 3 files, 77 tests passed.
- (guard) `npm run check`: pass. Exit 0, selftest all green.

## Out of scope changes
None. The diff is the three expected files. I read the `agent-admin.ts` and presets diffs. Besides the `isNewRoundAction` helper and the guard, the only other change is a comment update.

## For the next attempt
The build needs one fix. Reword the Croupier `surfaceStyle` in `site/pages/agent-admin-presets.ts:159` to drop the literal "surfaceId", for example "a FRESH surface id" or "a fresh table id (table-1, table-2, …)". Check that the lint accepts the replacement wording. The `round-loop` skill content at line 202 also says "surfaceId". It passes today, but reword it too for consistency. Then rerun `npx vitest run site/pages/agent-admin-presets.test.ts`. It must go back to 15 of 15, with `seedVersion: 6` and the `context.newRound` phrase kept so the other criteria still pass.

This is not a plan defect. The criteria are sound and the build violates the existing lint contract.
