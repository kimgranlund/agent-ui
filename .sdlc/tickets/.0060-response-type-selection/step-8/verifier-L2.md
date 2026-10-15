<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
pass

## Criteria
- (red) selftest loop over the four new ids: pass. Evidence: selftest rc 0; `scripted PASS` lines for `response-type-tool-clean`, `response-type-degrade` (`got outcome eventual-text, rounds 3, failureCodes [CATALOG,SURFACE_DEGRADED]`), `response-type-text-override`, `response-type-tool-session`; summary `16 turn(s), 0 mismatch(es); pins ok`. Pre-edit red control is recorded in `red-checkpoint.jsonl`; no `process-deviations.md`.
- (red) `kit.ts run` for text, surface and override: pass. Evidence: rc 0 for each, printing `skip: needs DOM` then `green (DOM-free legs only ...)`. This leg is DOM-free only, so the jsdom criterion below carries the proof.
- (red) jsdom `scenarios.test.ts -t response-type-{text,surface,override}`: pass. Evidence: rc 0 each, `Tests 1 passed | 10 skipped (11)` each.
- (red) `legs.test.ts -t "tool path"`: pass. Evidence: rc 0, `Tests 5 passed | 12 skipped (17)`.
- (guard) agent-eval and testkit tools tests: pass. Evidence: 6 files, 37 tests, rc 0.
- (guard) `src/testkit` jsdom tests: pass. Evidence: 21 files, 628 tests, rc 0.
- (guard) `kit.ts selftest`: pass. Evidence: rc 0.
- (guard) scope loop against `abe53183`: pass. Evidence: rc 0, no out-of-scope file. `git status` outside `.sdlc` is clean.

## Discrimination (reproduced in a throwaway worktree at HEAD)
Each seeded defect was reverted with `git checkout -- packages` before the next, and the worktree is removed.
- Override ignored (dropped `&& override !== 'text'` from the offered-tools condition in `produce.ts`):
  - jsdom `response-type-override` goes red with `TREE_MISMATCH`, `* on main: expected 0 matches, got 1`.
  - Selftest `response-type-text-override` goes red: `expected exit 0 got exit 1`.
  - `legs.test.ts` "text override withholds the tool" goes red.
- Text scenario (a text-only round no longer ships, via `if (false && restLines.length === 0 ...`):
  - jsdom `response-type-text` goes red with `PRODUCE_MISMATCH`, `outcome: expected first-pass, got halt; rounds: expected 1, got 3`.
  - Selftest `response-type-text-clean` goes red.
- Surface scenario (capture assignment disabled in `captureTool`):
  - jsdom `response-type-surface` goes red with `TREE_MISMATCH`, `expected at least one match, got 0`.
  - Selftest `tool-clean`, `degrade` and `tool-session` go red.
  - All 5 "tool path" tests go red.
- Degrade turn:
  - Dropping `SURFACE_DEGRADED` in `produce.ts` reds the selftest degrade turn (`got outcome eventual ... failureCodes [CATALOG]`) and 2 "tool path" tests.
  - Making `observe.ts` never report `eventual-text` also reds the selftest degrade turn and 2 "tool path" tests.
- Persona leg: dropping the `jsonl` read for `attemptedTypes` in `observe.ts` reds the "attemptedTypes reads the captured render_surface jsonl" test. The selftest stays green there, so only that unit test covers it.
- Limit: the override scenario stays green when capture is ignored, since nothing mounts either way. It bites on the override defect, as the brief asked.
- Step 1 legacy path: `live --leg response-type` parses (no key gives rc 2, `aborting, not faking a result`), and `--leg bogus` is rejected. Selftest is green with the pre-existing legacy turns. `pins.json` changed only for `scripted-turns.json`.

## Out of scope changes
None. `score.ts` changed (the `repairOutcome` return type narrowed so `producer-leg.ts` stays untouched). It sits under `tools/agent-eval/`, so it is within scope.

## For the next attempt
None.
