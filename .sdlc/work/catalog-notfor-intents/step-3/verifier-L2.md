<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
pass

## Criteria
- C1 (ADR greps): pass. The ADR file exists with `# ADR-0232 ` and the exact `proposed` status line. All seven keys are present: `selection.json`, `SELECTION_GUIDANCE_CHAR_BUDGET`, `ADR-0071`, `ADR-0097`, `ADR-0169`, `ADR-0173` and `a2ui-basic`. The loop printed "C1 ok". The check bites because the file is untracked, so at base it does not exist and the greps would fail.
- C2 (adr-index plus site tests): pass. `"name": "ADR-0232"` is in `site/public/adr-index.json`. `npx vitest run --project site site/lib/sitemap.test.ts site/lib/adr.test.ts` passed 2 files and 57 tests.
- C3 (`selection.json` in the five twin docs): pass. The loop over the SPEC, LLD, catalog SPEC, agent-model and `choosing.ts` printed no MISS.
- C4 (rubric D7 row and `D1–D7`): pass. The D7 row grep matched. All three files contain `D1–D7` and none contain `D1–D6`. `git grep 'D1–D6'` now hits only unrelated PRD and element-rubric references.
- C5 (`selection.json` in the seven skills and two agents): pass. The loop printed no MISS.
- (guard) `npm run check`: pass. Exit 0, ending with "selftest: all green".
- (guard) a2ui vitest project: pass. Exit 0, 109 files passed (1 skipped), 2686 tests passed (1 skipped).
- (guard) tools vitest project: pass. Exit 0, 25 files and 367 tests passed.
- (guard) em-dash python check: pass. It printed `26 9 []` and exited 0. The ADR carries only its H1 em dash.
- (guard) scope allowlist `test -z`: pass. Exit 0, so no changed file falls outside the allowlist. I did not run the gates at base, because none failed.

## Out of scope changes
None. Steps 1 and 2 files (the `selection-guidance` code, sidecars, `fs-shim` files, baseline, `gates.test.ts`, `prompt-drift.test.ts`) are all allowlisted. The builder's extra edits are all in allowlisted files:
- the SPEC-R6 AC7 traceability row
- the rubric's "three" changed to "four" artifacts
- the Path-table row in `a2ui-payload-authoring`
- the prompt-equivalence and recapture rows in `catalog-pipeline.md`

ADR-0071's body is untouched; it does not appear in `git status`.

Spot checks on the builder's claims:
- The ADR carries the budget numbers it should. The measured 8 277 chars, the ceiling of 9 570 and the budget of 8 600 appear in ADR lines 75-76.
- The token cost reads +8 277 chars, 24.5% of the 33 750-char base `default`.
- The descriptor-home alternative gives both reasons (no descriptor for `a2ui-basic` or persona types, and ADR-0173 cl.5 keeps catalog content hand-curated).
- SPEC-R6 AC7 exists in the live-agent SPEC.

I did not re-run the `size` gate or `doc_lint`, since the handoff excludes both.

## For the next attempt
None.
