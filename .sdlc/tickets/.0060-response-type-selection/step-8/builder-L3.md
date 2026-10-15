<!-- role=builder level=L3 model=opus effort=high -->
## Status
done

## Changes
- packages/agent-ui/a2ui/tools/agent-eval/scripted.ts: rounds accept `string | { tool, input, then }`; a tool round calls `req.executeTool` once when present (rejection swallowed), then yields `then`.
- packages/agent-ui/a2ui/tools/agent-eval/observe.ts: the provider wrapper wraps `req.executeTool` only when present; new `toolCalled`; `attemptedTypes` folds in each captured `render_surface` `jsonl`; `outcome` is `eventual-text` when trace `failureCodes` include `SURFACE_DEGRADED`; `RepairOutcome` widened.
- packages/agent-ui/a2ui/tools/agent-eval/score.ts: `repairOutcome` returns `Exclude<RepairOutcome, 'eventual-text'>` so `testkit/producer-leg.ts` stays type-clean and untouched; header names eventual-text.
- packages/agent-ui/a2ui/tools/agent-eval/legs.ts: repair counts and the summary line gain `eventual-text=`.
- packages/agent-ui/a2ui/tools/agent-eval/eval-agent-behavior.ts: `parseScriptedTurns` accepts tool-round objects (`ScriptedRound`); `expect.outcome` doc names eventual-text.
- packages/agent-ui/a2ui/tools/agent-eval/fixtures/scripted-turns.json: appended `response-type-tool-clean`, `response-type-degrade`, `response-type-text-override`, `response-type-tool-session`.
- packages/agent-ui/a2ui/tools/agent-eval/fixtures/pins.json: re-pinned `scripted-turns.json`.
- packages/agent-ui/a2ui/tools/agent-eval/legs.test.ts: `describe('tool path')` (5 tests); local `Turn.rounds` widened.
- packages/agent-ui/a2ui/tools/testkit/scenarios/response-type-text.scenario.json: new.
- packages/agent-ui/a2ui/tools/testkit/scenarios/response-type-surface.scenario.json: new.
- packages/agent-ui/a2ui/tools/testkit/scenarios/response-type-override.scenario.json: new.

Commits on feat/response-type-selection (not pushed): c3d76369 (agent-eval half), cd0c43d0 (kit scenarios), 0e18b708 (degrade fixture holds three literal tool rounds, re-pinned).

## Checks
- `redck.py record` before the first edit: exit 0, 4 pre-edit controls red, recorded in red-checkpoint.jsonl.
- (red) agent-eval selftest loop over the four ids: rc 0. Full selftest: 16 turns, 0 mismatches, pins ok (rerun after 0e18b708, same result). Degrade line: `got outcome eventual-text, rounds 3, failureCodes [CATALOG,SURFACE_DEGRADED]`.
- (red) `kit.ts run` loop over text/surface/override: rc 0 (each prints `skip: needs DOM` then `green (DOM-free legs only ...)`).
- (red) jsdom `scenarios.test.ts -t response-type-{text,surface,override}` loop: rc 0, each `Tests 1 passed | 10 skipped (11)`.
- (red) `legs.test.ts -t "tool path"`: rc 0, `Tests 5 passed | 12 skipped (17)`.
- (guard) `npx vitest run --project tools .../agent-eval/ .../testkit/ --maxWorkers=4`: rc 0, 6 files, 37 tests passed.
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/testkit --maxWorkers=4`: rc 0, 21 files, 628 tests passed.
- (guard) `kit.ts selftest`: rc 0.
- (guard) scope loop with `SDLC_BASE_SHA=abe53183...` inlined: rc 0, nothing out of scope.
- Extra: `npx tsc --noEmit -p .`: rc 0. `npm run check`: rc 0. Em-dash grep over the diff: none.

## Notes
- Negative control, override scenario (K5 bite): set the intent to "what does the Pro plan cost" (no override phrase), ran `npx vitest run --project packages packages/agent-ui/a2ui/src/testkit/scenarios.test.ts -t "response-type-override"`: `Tests 1 failed | 10 skipped (11)` with finding `"code": "TREE_MISMATCH", "detail": "* on main: expected 0 matches, got 1", "path": "$.turns[0].expect.tree[0]"`. Restored with `git checkout --`; `git diff --exit-code` on the file rc 0 (byte-identical to commit cd0c43d0).
- Second control, surface scenario: set its intent to "just tell me what plan I am on" (tool withheld, payload never captured): the jsdom filter reds with `TREE_MISMATCH`. Restored the same way, `git diff --exit-code` rc 0.
- The agent-eval override turn also discriminates inside `legs.test.ts`: the same rounds with prompt "what does the Pro plan cost" exit 1 with `response-type: false-surface, expected text` and `toolCalled: true`.
- Kit scenarios list no `render_surface` under `respond.tools` and carry no `expect.tools`: the capture executor is produce()'s own, and the kit's `scripted.calls` never sees it.
- `response-type-tool-session` without its session degrades (`eventual-text`, `[IDGRAPH, SURFACE_DEGRADED]`, missed-surface), not a halt, since a capture round with text degrades at the bound; the legs test asserts that.
- The lexicon loose end and the small nits in the task Notes were not touched.
