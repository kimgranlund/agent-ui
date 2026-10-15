<!-- role=builder level=L3 model=opus effort=high -->
## Status
done

## Changes
- `packages/agent-ui/a2ui/src/agent/system-prompt.ts`: `catalogInventory` computes `selectionGuidanceFor(catalog)` once. After each line's closing `)` it appends `renderSelectionClause(guidance[id], catalog)`, but only when `Object.hasOwn(guidance, id)`. Adds an `ADR-0232 (proposed)` bullet to the ADR index header and imports from `./selection-guidance.ts`. The `buildSystemPrompt` signature is unchanged.
- `packages/agent-ui/a2ui/src/agent/index.ts`: adds `export * from './selection-guidance.ts'` and mentions it in the header (surface list and NODE-FIRST sentence).
- `packages/agent-ui/a2ui/src/agent/gates.test.ts`: the root-barrel identity list gains `'selectionGuidanceFor'` and `'loadSelectionGuidance'`. Step 1's `NODE_ALLOWED` edit is still there.
- `packages/agent-ui/a2ui/src/live-agent/prompt-drift.test.ts`: new `sectionBody` helper, which `sectionIds` now uses. A new describe block has 4 legs:
  - every default line ends with its clause
  - the `planted-no-sidecar` catalog composes no ` · use: ` and no ` · not for: `
  - the summed default clause length is at most `SELECTION_GUIDANCE_CHAR_BUDGET`
  - in the croupier derived catalog, the `PlayingCard` and `Badge` lines carry their clauses
- `packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json`: recaptured, +4/-4 lines, all four composed keys moved.
- `packages/agent-ui/a2ui/tools/agent/worker/fs-shim-content.ts`: the five `selection.json` sidecars come in as JSON imports. `FILES` gets 5 entries keyed `/packages/agent-ui/a2ui/src/catalog/<dir>/selection.json`, valued `JSON.stringify(<import>)`. Header comment updated. `DIRS` is untouched.
- `packages/agent-ui/a2ui/tools/agent/worker/fs-shim.test.ts`:
  - the top-level prompt parity leg now only counts keys under `${PROMPTS_KEY_PREFIX}/`
  - `aliasedModules` gains `src/agent/selection-guidance.ts`
  - a new leg checks that the on-disk `src/catalog/**/selection.json` set equals the `FILES` keys ending in `/selection.json`, and that each value parses deep-equal to its disk file
- `packages/agent-ui/a2ui/tools/agent/worker/fs-shim.ts`: header comment names the new reader. Nothing else changed.
- Step 1's eight untracked files (the loader, its unit test, the coverage gate, five sidecars) are in the tree and unchanged.

## Checks
- Recapture: `RECAPTURE_BASELINE=1 npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/recapture-baseline.test.ts`: exit 0, 1 test passed. The baseline diff is +4/-4.
- Criterion 1, node inventory check for `default` and `a2ui-basic`: exit 0, `0 []`.
- Criterion 2, python baseline key check: exit 0, `['blueSky', 'default', 'defaultExplicit', 'specific']`.
- Criterion 3, greps plus 7 prompt-gate test files: exit 0, 7 files, 162 tests passed.
- Criterion 4, grep plus `npx vitest run --project tools .../fs-shim.test.ts`: exit 0, 15 tests passed.
- Criterion 5, python check that every on-disk sidecar is imported in `fs-shim-content.ts`: exit 0, `5 []`.
- (guard) no `selection.json` import under `a2ui/src`, `app/src` or `site`: exit 0.
- (guard) em-dash check:
  - First run: exit 1. My added comments in `system-prompt.ts`, `prompt-drift.test.ts`, `fs-shim-content.ts` and `fs-shim.test.ts` had em dashes.
  - Fix: replaced `ADR-0232 (proposed) — ` with `ADR-0232 (proposed): ` in those four files.
  - Rerun: exit 0, `8 8 []`.
- (guard) file allowlist `test -z ...`: exit 0.
- Criteria 1 to 5 and the allowlist and import guards were all rerun on the final tree after the em-dash fix, and all exited 0.
- `npm run check`: exit 0.
- `npx vitest run --project packages packages/agent-ui/a2ui`: exit 0, 109 files passed and 1 skipped; 2686 tests passed and 1 skipped.
- `npx vitest run --project tools packages/agent-ui/a2ui/tools`: exit 0, 24 files, 365 tests.
- `npx vitest run site/lib/admin-live-runner.test.ts`: exit 0, 41 tests.

## Notes
- The new ADR index bullet in `system-prompt.ts` reads `ADR-0232 (proposed): ...` while the sibling bullets use ` — `. That is deliberate: the em-dash guard rejects new em dashes.
- The handoff said `fs-shim.ts` "may" get a header mention, and it did. The file is inside the allowlist regex `fs-shim(-content|\.test)?\.ts`.
- `renderSelectionClause` already returns `''` for `undefined`, so the `Object.hasOwn` guard is extra safety. Either way, a type with no entry keeps today's bytes. The planted-ghost and type-shapes legs stay green.
- The Worker runtime is not proven on this host, as the handoff says. The proof is structural: the `FILES`-vs-disk deep-equal leg and the aliased-module leg. `fs-shim-content-drift.test.ts` is untouched, as the handoff intends.
- This is not a merge step, so nothing was committed.
