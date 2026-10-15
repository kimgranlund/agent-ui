<!-- role=builder level=L3 model=opus effort=high -->
## Status
done

## Changes
- `packages/agent-ui/a2ui/tools/agent-eval/cases.ts`: `RESPONSE_TYPE_EXPECTS`, `ResponseTypeExpect`, `ResponseTypeCase`, `parseResponseTypeCase` (rejects non-literal `expect`, empty strings, a session that is not one `user` then one `assistant` string turn), `loadResponseTypeCases`.
- `packages/agent-ui/a2ui/tools/agent-eval/fixtures/response-type-cases.json` (new): 43 cases, 23 text, 12 surface, 8 both, 5 with a session in the `<note>\n<jsonl>` shape, all on `agent-ui`.
- `packages/agent-ui/a2ui/tools/agent-eval/observe.ts`: optional `session`; `hasText`, `hasSurface`, `firstLineMs`, `usage` on `TurnObservation` (halt: false, false, timed or null, null).
- `packages/agent-ui/a2ui/tools/agent-eval/score.ts`: `'response-type'` check, `scoreResponseType`, `responseTypeRates`.
- `packages/agent-ui/a2ui/tools/agent-eval/legs.ts`: `runLeg` threads `session` and takes a detail suffix; `runResponseTypeLeg` (timing suffix, rates line).
- `packages/agent-ui/a2ui/tools/agent-eval/eval-agent-behavior.ts`: header and help say `selection|persona|response-type`; `FIXTURE_FILES` gains the set; selftest loads it; `ScriptedTurn` exported with the `response-type` leg; `runLive --leg response-type` (key check first, `--only`, `timing: true`).
- `packages/agent-ui/a2ui/tools/agent-eval/fixtures/scripted-turns.json`: five turns appended, the seven existing objects byte-unchanged.
- `packages/agent-ui/a2ui/tools/agent-eval/fixtures/pins.json`: pins `response-type-cases.json`, re-pins `scripted-turns.json`.
- `packages/agent-ui/a2ui/tools/agent-eval/cases.test.ts`, `legs.test.ts`, `eval-agent-behavior.test.ts`: the three new describes.
- `CLAUDE.md` line 20: `-- live --leg selection|persona|response-type`.
- `.claude/docs/spec/response-type-selection.spec.md`: v0.2; RTS-R3 `TEXT_JSONL_IGNORED` sentence; RTS-R6 `detectUserOverride(input: TurnInput)` and `ProduceOptions.responsePreference` threading, lexicon wins; RTS-R7 `ProduceOptions.prefers`, advisory only, persona `prefers` setting sent as the `prefers` request field.
- `.claude/docs/lld/response-type-selection.lld.md`: v0.2; `produce.ts` row, hosts row, section 3 item 1 `buildSystemPromptSections(..., prefers)`.

## Checks
- red record: `redck.py record .../step-1/handoff.md` before the first edit, exit 0 ("recorded 7 pre-edit control(s) red").
- (red) fixture composition python: exit 0.
- (red) selftest lists `scripted PASS` for the five new turns: exit 0 (selftest 12 turns, 0 mismatches, pins ok).
- (red) `vitest cases.test.ts -t "response-type labelled set"`: exit 0.
- (red) `vitest legs.test.ts -t "response-type leg"`: exit 0 (5 passed, 7 skipped).
- (red) `vitest eval-agent-behavior.test.ts -t "seeded wrong choice"`: exit 0.
- (red) no-key live arm `env -i ... live --leg response-type --repo-root .../fixtures`: exit 2, names `ANTHROPIC_API_KEY`, no "leg must be"; criterion exit 0.
- (red) `CLAUDE.md` and `--help` grep: exit 0.
- (red) SPEC/LLD python check: exit 0.
- (guard) `npx vitest run --project tools packages/agent-ui/a2ui/tools/agent-eval/`: exit 0, 4 files, 24 tests passed.
- (guard) `doc_lint.py` on both docs: exit 0.
- (guard) `npm run check`: exit 0.
- (guard) scope loop with `SDLC_BASE_SHA=00dcba9c`: exit 0.
- Task Notes em-dash check (step 9 filter over `git diff 00dcba9c` plus untracked, excluding `.sdlc`, `.worktrees`, `site/public`): exit 0, no lines printed.

## Notes
- Committed as `8e87dad6` ("T-0060: step 1 ...") on `feat/response-type-selection`, WIP commits squashed into it. Not pushed.
- `SDLC_BASE_SHA` and `SDLC_TMP_WORKTREES` were empty in the shell; I exported the base sha inline for the scope guard. No throwaway worktree was needed.
- redck recorded 7 controls, not 8. The fixture-composition criterion is the one missing; it was red at base anyway because the file did not exist.
- `textDelta` is read from the raw JSON in `observe.ts` because `readMetaLine` does not carry the arm until step 4. Step 8 can switch it to the envelope field.
- Before writing the fixture, I checked the session threading: a note plus a `t1`-only update ships with the seeded session and halts `IDGRAPH main:root-missing` without it. The `<jsonl>` part of every labelled session validates on `agent-ui`.
- The scripted provider emits no usage, so the selftest rates line reads `over 0 of N turns`. The live arm gets the real counts.
- One LLD edit goes past the handoff's list. Section 3 item 1 used to say "the effective preference is the override, else `opts.responsePreference`, else `auto`", which made `responsePreference` the fallback hint. That contradicts the split, so it now reads "the effective override is the lexicon match, else `opts.responsePreference` (`'auto'` means none)".
- `results.py validate --role builder` fails on this file only because it has no header line, and the brief named none. With `<!-- role=builder level=L3 model=opus effort=high -->` prepended to a scratch copy, validate exits 0.
