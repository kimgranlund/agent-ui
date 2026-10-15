<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
pass

## Criteria
- Node inventory check (default and a2ui-basic: every line starts `- Id (props: ` and ends with its rendered clause): pass. Evidence: ran it on the built tree, printed `0 []`, exit 0. At `$SDLC_BASE_SHA` in a throwaway worktree `selection-guidance.ts` is absent and the import fails, so the check goes red there.
- Baseline key check (only blueSky, default, defaultExplicit, specific moved; key set unchanged): pass. Evidence: python run printed `['blueSky', 'default', 'defaultExplicit', 'specific']`, exit 0.
- Greps plus the 7 prompt-gate test files: pass. Evidence: both greps matched; vitest `--project packages` showed 7 files and 162 tests passed. I read the new `prompt-drift.test.ts` legs and they match the Do: each default line ends with its clause, `planted-no-sidecar` has no ` · use: `, `SELECTION_GUIDANCE_CHAR_BUDGET` is imported by name and asserted `<=` with total `> 0`, and croupier `PlayingCard` and `Badge` carry their clauses.
- `fs-shim.test.ts` grep plus vitest: pass. Evidence: the grep matched; vitest `--project tools` showed 15 passed. I read the diff: the prompts-prefix restriction, the `selection-guidance.ts` entry in `aliasedModules`, and the new leg that checks the on-disk `selection.json` set equals the `FILES` keys and that each value deep-equals its disk file. The new leg asserts `real.length > 0` and uses `toEqual` on sorted key lists, so removing a `FILES` entry fails it.
- Every on-disk sidecar is imported in `fs-shim-content.ts`: pass. Evidence: python run printed `5 []`, exit 0. The `FILES` entries are keyed `/packages/agent-ui/a2ui/src/catalog/<dir>/selection.json`, with values `JSON.stringify(<import>)`.
- (guard) no `selection.json` import under a2ui/src, app/src or site: pass. Evidence: the `! git grep` command exited 0.
- (guard) no new em dashes: pass. Evidence: python run printed `8 8 []`, exit 0.
- (guard) changed-file allowlist: pass. Evidence: the `test -z` command exited 0, so no file outside the allowlist changed.

## Out of scope changes
None. The 8 modified files and 8 untracked files all fall inside the allowlist. The untracked files are step 1's loader, its tests and the five sidecars. `git status` shows `.sdlc/` untracked, and the guards exclude it. The `gates.test.ts` diff also carries step 1's `NODE_ALLOWED` addition, and `gates.test.ts` is in the allowlist. I read `fs-shim.ts`, `index.ts` and `system-prompt.ts` in the diff and found only header comments, the barrel export, and the clause wiring the Do asks for.

## For the next attempt
None
