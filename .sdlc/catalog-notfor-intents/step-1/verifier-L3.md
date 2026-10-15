<!-- role=verifier level=L3 model=fable effort=xhigh -->
## Verdict
pass

## Criteria
- `npx vitest run --project packages .../catalog/selection-guidance.test.ts .../agent/selection-guidance.unit.test.ts`: pass. Evidence: exit 0, `Test Files 2 passed (2)`, `Tests 75 passed (75)` (second run, exit captured directly). Red seen: in the throwaway worktree at `$SDLC_BASE_SHA` with the built files copied in and `Badge` deleted from `default/selection.json` on disk, exit 1, 7 failed, including `the guidance keys are a bijection with the catalog components` and `every edge is reciprocal`; with `personas/ghost/selection.json` planted, exit 1, `every selection.json under src/catalog/ is default, a2ui-basic, or a shipped persona` failed.
- `for k in ...; do grep -qF "NEGATIVE CONTROL: $k" ...selection-guidance.test.ts || exit 1; done`: pass. Evidence: exit 0; the five names sit at test lines 189, 196, 201, 208, 216. Red seen: at base the loop broke at `missing entry` (file absent).
- python bijection + pin check: pass. Evidence: `[]`, exit 0. Red seen: with `Badge` deleted on disk in the worktree, `['default']`, AssertionError, exit 1.
- python caps + rules check: pass. Evidence: `98 []`, exit 0. Red seen: with `;` planted in an a2ui-basic `Icon` intent, `98 ['Icon']`, exit 1.
- python reciprocity check: pass. Evidence: `164 []`, exit 0. Red seen: after deleting `Badge`, `162 [('Text', 'Badge'), ('Toast', 'Badge')]`, exit 1.
- python banned-vocabulary check: pass. Evidence: `[]`, exit 0. Red seen: with `reconcile` planted in a `why`, `[('a2ui-basic', 'reconcile')]`, exit 1. Cross-check against `live-agent/system-prompt-grammar.test.ts` leak legs (lines 95, 143, 285, 330, 568, 633, 671, 714, 907, 961, 999): every regex term is in the criterion's list; prompt-level phrases at lines 78, 951, 952 (`beyond the catalog`, `CardFooter with`, `one greet per session`) grep to zero hits in the sidecars.
- node budget check: pass. Evidence: `{ used: 8277, budget: 8600, ceiling: 9570 }`, exit 0. Formula verified: min(9570, ceil(8277/100)*100 + 300) = 8600, matching `selection-guidance.ts:239`; doc comment lines 230-238 record measured 8 277, ceiling 9 570, date 2026-10-04. Red seen: base worktree `ERR_MODULE_NOT_FOUND` exit 1; with the constant lowered to `8_000` in the worktree copy, `{ used: 8277, budget: 8000, ceiling: 9570 }`, exit 1.
- node CAP / derived-union / unknown-id check: pass. Evidence: `{ code: 'SelectionGuidanceError:SELECTION_GUIDANCE_CAP', derived: true, unknown: 0 }`, exit 0. Red seen: at base `ERR_MODULE_NOT_FOUND`, exit 1.
- node clause-shape + UNRESOLVED check: pass. Evidence: `{"full":" · use: a; b · not for: Text (w)","bare":" · use: a","code":"SELECTION_GUIDANCE_UNRESOLVED"}`, exit 0. Red seen: at base `ERR_MODULE_NOT_FOUND`, exit 1.
- `grep -qF "'src/agent/selection-guidance.ts'" gates.test.ts && npx vitest run ... gates.test.ts`: pass. Evidence: exit 0, `Tests 5 passed (5)`; diff adds the entry at `NODE_ALLOWED` plus a "FIFTH Node-only call site" comment and the leg-3 header mention. Red seen: in the worktree with the base `gates.test.ts` and the loader present, exit 1, `× NODE-FENCE: node:* imports appear ONLY in the prompt/asset-loading modules`; the grep alone exits 1 at base.
- (guard) em-dash python check: pass. Evidence: `1 8 []`, exit 0. Red seen: with an em dash planted in the worktree's `fixture-demo/selection.json`, `['packages/.../personas/fixture-demo/selection.json']`, exit 1.
- (guard) file allowlist `test -z ...`: pass. Evidence: exit 0, run before any worktree existed. Red seen: with a stray `src/agent/stray.ts` in the worktree, exit 1.

Do-level checks beyond the criteria, all run on the built tree:
- Key order equals `catalog.json` `components` order in all five sidecars (`list(sel['types']) == list(cat['components'])` True x5); each file is byte-identical to `json.dumps(doc, indent=2, ensure_ascii=False) + '\n'`; root key order is pin then `types`.
- Reciprocal pairs carry distinct `why` text per direction: 0 identical pairs across default and a2ui-basic.
- No authored string of 20+ chars appears verbatim in `src/agent/prompts/mini-skills/*.md` (0 hits over 278 strings); no whole-sentence match.
- Pin mismatch throws at module load: with croupier's `personaId` set to `dealer` in the worktree, plain-Node import threw `SelectionGuidanceError SELECTION_GUIDANCE_MALFORMED ... must pin personaId`.
- Spec §5.2 / `choosing.ts` `GROUPS` pairs present as edges in `default/selection.json`: Stat/Sparkline, Sparkline/LineChart, BarChart/Table, Text/Code, Switch/Checkbox, RadioGroup/Select, ComboBox/Select, ComboBox/TextField, Calendar/TextField, Popover/Tooltip, Popover/Menu, Popover/Modal, Gauge/PieChart, Gauge/Stat, ColumnChart/BarChart, Row/Column, Column/List, List/Grid.
- Neighbor sweeps: `npm run check` exit 0; `npx vitest run --project packages packages/agent-ui/a2ui` exit 0, `109 passed | 1 skipped` files, `2682 passed | 1 skipped` tests. Plain-Node `import('./packages/agent-ui/a2ui/src/agent/index.ts')` exit 0 (44 exports, loader not yet exported, as the Do states).
- Loader `PERSONA_IDS` vs `SHIPPED_PERSONA_CATALOG_MANIFESTS`: `manifests.ts:15` lists exactly fixture-demo, concierge, croupier. Extra loader id direction: observed red via the orphan leg above (and `readPinned` line 170 throws on a missing file). Missing loader id direction: `selection-guidance.test.ts:168` `missingEntries` on the derived catalog, since `selectionGuidanceFor` line 205 returns base only for an unknown persona; code-read, not observed.

Steelman pass on draft fails, all dropped:
- Budget doc comment is a JSDoc block rather than dogfood's dated `//` lines. Rebuttal: the Do asks that it record measured, ceiling and date with no em dash; lines 230-238 carry all three and the em-dash guard is green. Dropped.
- §5.2's four-way Stat/Sparkline/BarChart/Table rule is not encoded as all six pairs (Stat-BarChart, Stat-Table absent). Rebuttal: the Do says take pairs from §5.2, not encode every pair, and the 4-edge reciprocal cap cannot hold a full K4 plus each type's other pairs; each of the four carries at least two group edges. Dropped.
- Average clause is 103.5 chars against "about 100". Rebuttal: the number is a guide to the ceiling, and the observed run shows used 8277 under budget 8600 under ceiling 9570. Dropped.

## Out of scope changes
None. `git status` shows only the eight allowlisted paths plus `.sdlc/`; `.sdlc/` is the run's artifact dir and both guards exclude it via `:(exclude).sdlc`, and the allowlist guard exit 0 proves nothing else is untracked or modified. `gates.test.ts` header-comment lines 10-14 changed alongside the `NODE_ALLOWED` entry: diff read, the same contract dependent the Do names. `renderSelectionClause` accepts `undefined` and returns `''` (lines 215-216): a widening that the Do's "never throws for a missing entry" allows, and criterion 9 passes all three required shapes. `/tmp/selgen` is outside the tree; the allowlist guard confirms no repo file.

## For the next attempt
None.
