<!-- role=filer level=L1 model=sonnet effort=medium -->
## Warnings
None

## PR title
T-0005: Agent-behavior evals: negative selection, repair, first-pass versus eventual, per-persona (GH #1810)

## PR body
### Summary
Adds `npm run eval:agent-behavior`, a keyless, deterministic Node CLI. It scores producer turns on concept selection, negative selection against the sidecar `notFor` edges, repair from structured validator errors, and first-pass versus eventual success. It also has a per-persona leg. A `live` leg runs a real model by hand and needs `ANTHROPIC_API_KEY`. Tracks GH #1810.

Case fixtures are protected by a committed sha256 pin file, checked by the selftest in `check:scripts` (Kim's fork 4 ruling, option (a)). The seeded-defect fixtures of the A2UI test kit (T-0011) are meant to use the same rule.

### Changes
Step 1, the harness, under `packages/agent-ui/a2ui/tools/agent-eval/`:
- `cases.ts` derives exactly one `SelectionCase` per `notFor` edge, reading sidecars through `selectionGuidanceFor`. A bijection test covers it.
- `observe.ts` runs the real `produce()` with `maxRounds: 3` through a counting provider wrapper. It reads only `rounds` and `failureCodes`, and `TurnTrace` is unchanged.
- `score.ts` is a pure scorer: `scoreNegative`, `scoreConcept`, `scorePersona`, `repairOutcome`.
- `legs.ts` holds the selection and persona legs. `scripted.ts` is a scripted provider.
- `pins.ts` verifies the pins by hashing raw bytes.
- `eval-agent-behavior.ts` is the CLI, with `selftest` and `live`. It is the only file that names the key or `anthropicProvider`.
- Fixtures: `scripted-turns.json` (7 turns), `persona-cases.json` (3 cases, including the base-catalog Quant case that must reject `PlayingCard`), and `pins.json`.
- Tests: `cases`, `legs`, `eval-agent-behavior` and `wiring`.
- `package.json`: adds the `eval:agent-behavior` script and appends the selftest to `check:scripts`. No dependency change.
- `vitest.config.ts`: one explicit include line.

Step 2, the scrub list:
- Pointer lines in `CLAUDE.md`, `AGENTS.md` and `packages/agent-ui/a2ui/AGENTS.md`.
- Pointers in the skills `a2ui-review-standards` (SKILL and grading-standards), `a2ui-catalog-rendering-review` (SKILL and catalog-pipeline), `component-testing` (test-craft), `a2ui-corpus-curation`, `a2ui-prompt-authoring` and `a2ui-build`.
- A pointer in `.claude/agents/a2ui-review-agent.md`.
- Docs: rubric `a2ui-catalog.md` gets a D7 pointer and a bump to v0.4, with the D7 row byte-identical. The live-agent SPEC goes to v0.19 and the LLD gets a fold note. The B3 LLD, the `corpus-genui/README.md` and `roadmap.md` get cross-references or a shipped line.
- Not touched: `a2ui-build-agent.md`, `a2ui-catalog.spec.md`, historical ADRs and reports.

### Verification
Step 1 verifier: pass.
- The 8 behavior tests and the 6 harness tests pass.
- Selftest: 7 of 7 scripted turns pass, pins ok.
- A one-byte edit to a fixture flips the selftest from exit 0 to exit 1.
- `live` with no key exits 2.
- Only the CLI entry names the key or adapter.
- The `package.json` diff is limited to the two script keys.
- Guards pass: no file writes in non-test modules, no `app` or `devtools` imports, no em dashes, no changes outside scope.
- Bite check: forcing `scoreNegative` to return no findings turns the selftest red (exit 1).
- `npm run check:tools` exits 0.

Step 2 verifier: pass.
- Every scrub-list file carries the `eval:agent-behavior` token.
- The D7 row is byte-identical, there are no em dashes, and the touched files stay in the allowlist.
- `npm run check` exits 0, with the selftest inside it.
- `npm test` exits 0: 627 files passed (1 skipped), 12668 tests passed (6 skipped).
- Builder-run: `claude_wiring_check.py` PASS, `harness_wiring_check.py` 29/29 reachability and 35/35 rubric modes. `doc_lint.py` exits 0 with "not a functional document" on the 5 touched docs, as the plan predicted.

### Notes
- To keep the no-em-dash guard green, one em dash in the rubric header line was rewritten to a colon.
- T-0006 and T-0009 had not landed in this tree, so no rebase was needed.
- Live-leg model scores are not claimed anywhere. Fixtures are labeled scripted.

## Changelog entry
Added `npm run eval:agent-behavior`: a keyless eval of A2UI producer behavior (concept selection, `notFor` negative selection, repair, first-pass versus eventual success, per-persona). Its selftest runs in `check:scripts`, and a manual `live` leg takes `ANTHROPIC_API_KEY`. Acceptance fixtures are protected by a committed hash pin. Skill, agent, spec, rubric and roadmap pointers updated. (GH #1810)

## Follow-ups
- note: A live selection prompt for `concierge:BookingConfirmation->BookingForm` ("confirm a completed booking") matches `isExplicitClose`. On a note-only reply it could trigger a FLOW_END correction round and inflate `rounds` in the live leg; the scripted selftest is unaffected.
- note: The Quant, Curator and Stylist persona fragments wait for the persona-manifest and registry tickets (GH #1812, GH #1807); only croupier, concierge and the base-catalog Quant case are covered now.
- note: GH #1811 (catalog data split from the renderer) may move paths the eval loads, so it needs a rebase or a path check when it lands.
