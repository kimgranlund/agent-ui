<!-- role=builder level=L3 model=opus effort=high -->
## Status
done

## Changes
- `packages/agent-ui/a2ui/tools/agent-eval/cases.ts` (new): `deriveSelectionCases`, `personaFragmentTypes`, `loadCaseCatalog` (cached per id), `loadPersonaCases`, `parsePersonaCase`, and `personaIds` (scans the persona dir).
- `packages/agent-ui/a2ui/tools/agent-eval/observe.ts` (new): `observeTurn` runs the real `produce()` with `maxRounds: 3` through a provider wrapper that counts calls and captures each round's text. Also exports `attemptedTypesOf`.
- `packages/agent-ui/a2ui/tools/agent-eval/score.ts` (new): pure scorer with `scoreNegative`, `scoreConcept`, `scorePersona`, `foreignTypesFor` and `repairOutcome`.
- `packages/agent-ui/a2ui/tools/agent-eval/legs.ts` (new): `runSelectionLeg` and `runPersonaLeg`. Each line carries `repair= rounds= failureCodes=`, followed by a summary line with counts.
- `packages/agent-ui/a2ui/tools/agent-eval/scripted.ts` (new): `scriptedProvider(rounds)`.
- `packages/agent-ui/a2ui/tools/agent-eval/pins.ts` (new): `verifyPins(dir)` hashes raw bytes with sha256 and skips dotfiles.
- `packages/agent-ui/a2ui/tools/agent-eval/eval-agent-behavior.ts` (new): CLI entry with `runCli`, `selftest` and `live`, behind the `argv[1]` guard.
- `packages/agent-ui/a2ui/tools/agent-eval/fixtures/scripted-turns.json` (new): the 7 required turns.
- `packages/agent-ui/a2ui/tools/agent-eval/fixtures/persona-cases.json` (new): the 3 acceptance cases, verbatim from the handoff.
- `packages/agent-ui/a2ui/tools/agent-eval/fixtures/pins.json` (new): sha256 pins for both fixtures.
- `packages/agent-ui/a2ui/tools/agent-eval/cases.test.ts` (new): the bijection test.
- `packages/agent-ui/a2ui/tools/agent-eval/legs.test.ts` (new): selection, repair and persona tests, with stubs loaded from the pinned fixture by turn id.
- `packages/agent-ui/a2ui/tools/agent-eval/eval-agent-behavior.test.ts` (new): no-key subprocess, no-adapter-construction and scripted-label tests.
- `packages/agent-ui/a2ui/tools/agent-eval/wiring.test.ts` (new): the two pin tests and the gate-wiring test.
- `package.json`: added the `eval:agent-behavior` key and appended the selftest to the end of `check:scripts`. No other key changed.
- `vitest.config.ts`: one explicit include line, `'packages/agent-ui/a2ui/tools/agent-eval/*.test.ts',`, with a GH #1810 comment.

## Checks
- AC1, vitest JSON title check for the 8 behavior titles: rc 0.
- AC2, vitest JSON title check for the 6 harness titles: rc 0.
- AC3, `node --experimental-strip-types .../eval-agent-behavior.ts selftest`: rc 0, 7 of 7 scripted turns PASS, pins ok.
- AC4, temp copy of the fixtures, one byte appended to `scripted-turns.json`: rc0 = 0 before the edit, rc1 = 1 after.
- AC5, `env -u ANTHROPIC_API_KEY ... live --leg selection --repo-root <tmp>`: rc 2. Stderr names `ANTHROPIC_API_KEY`.
- AC6, the key-name grep finds only `eval-agent-behavior.ts` among non-test files: rc 0.
- AC7, `package.json` diff against `SDLC_BASE_SHA` (only `check:scripts` and `eval:agent-behavior` changed, dependencies unchanged): rc 0.
- Guards G1 to G4 (no file writes in non-test modules, no app or devtools imports, no em dashes, no files touched outside scope): all rc 0.
- `npx vitest run --project tools packages/agent-ui/a2ui/tools/agent-eval/`: 4 files, 14 tests passed, rc 0.
- `npm run check:tools`: rc 0.
- `npx vitest run packages/agent-ui/a2ui/src/layering.test.ts packages/agent-ui/a2ui/tools/corpus-genui/wiring.test.ts` (contract dependents): 21 passed, rc 0.
- Scorer mutation checks, each restored afterwards:
  - `scoreNegative` forced to `false`: selftest rc 1 (`selection-forbidden-code` FAIL), and the legs test failed.
  - `scorePersona` push disabled: selftest rc 1 (`persona-quant-playing-card` FAIL), and the legs test failed.
- Not run (step 2's whole-suite gates): the full `npm run check:scripts`, `npm run check` and `npm test`.

## Notes
- **Mutation fix.** The first mutation run showed the selftest's `names` check passing vacuously. The case id (`agent-ui:Text->Code`) and the `failureCodes=` suffix both contain "Code". The check now matches the type as a whole word, and only in the findings text between `FAIL <id> ` and ` repair=`. After the fix, both mutations go red.
- **Persona leg also scores concept.** Handoff section 3 only says that attempting a foreign type fails. `runPersonaLeg` also fails a case when `expectType` is present and was not emitted, as `persona-cases.json` implies. A case with no `expectType` (the Quant) is scored on foreign types only.
- **Repair-turn case shape.** Repair turns carry `{ "catalogId": "agent-ui", "prompt": "a submit button" }` inline.
- **Selftest exit code depends on the kind of fixture edit.** It parses fixtures before checking pins, as section 7 orders. A byte edit to a fixture exits 1 (proved by AC4). An edit that breaks the JSON or the expected shape exits 2.
- **A throwing turn becomes a FAIL line.** If a scripted turn throws, the selftest prints a `scripted FAIL ... error:` line instead of crashing. In the live leg, a provider error on one case becomes a FAIL line naming the error, and the leg exits 1.
- **Close-regex probe.** No scripted or persona fixture prompt matches `isExplicitClose`. One derived live selection prompt does: `concierge:BookingConfirmation->BookingForm` uses "confirm a completed booking", A's first intent verbatim as the spec requires. On a note-only live reply, that case could get a FLOW_END correction round that inflates its `rounds`. The scripted selftest is unaffected.
- **Mutation copies.** The two mutation runs backed up `score.ts` to `/tmp` and restored it. No other files were left outside the step's scope.
