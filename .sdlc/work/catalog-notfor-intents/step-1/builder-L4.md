<!-- role=builder level=L4 model=opus effort=xhigh -->
## Status
done

## Changes
- `packages/agent-ui/a2ui/src/agent/selection-guidance.ts` (new): Node-only loader. Exports `SelectionEdge`, `SelectionEntry`, `SelectionGuidance`, `SelectionGuidanceErrorCode`, `SelectionGuidanceError`, `loadSelectionGuidance`, `selectionGuidanceFor`, `renderSelectionClause` and `SELECTION_GUIDANCE_CHAR_BUDGET = 8_600`. It reads the five sidecars at module load and checks their pins.
- `packages/agent-ui/a2ui/src/agent/selection-guidance.unit.test.ts` (new): loader contract tests on inline fixtures.
- `packages/agent-ui/a2ui/src/catalog/selection-guidance.test.ts` (new): the coverage gate (load, bijection, render, reciprocity, persona compose, orphans) plus the 5 required negative controls and 2 extra ones.
- `packages/agent-ui/a2ui/src/catalog/default/selection.json` (new): 80 types, 144 edges (72 reciprocal pairs).
- `packages/agent-ui/a2ui/src/catalog/a2ui-basic/selection.json` (new): 14 types, 20 edges (10 reciprocal pairs).
- `packages/agent-ui/a2ui/src/catalog/personas/concierge/selection.json` (new): BookingForm and BookingConfirmation, reciprocal, plus BookingForm to TextField.
- `packages/agent-ui/a2ui/src/catalog/personas/croupier/selection.json` (new): PlayingCard to Card.
- `packages/agent-ui/a2ui/src/catalog/personas/fixture-demo/selection.json` (new): FixtureBanner to Text.
- `packages/agent-ui/a2ui/src/agent/gates.test.ts`: `NODE_ALLOWED` gains `'src/agent/selection-guidance.ts'`, with a comment naming it the fifth Node-only call site. The leg-3 header comment also names it now.

## Checks
- `npx vitest run --project packages .../catalog/selection-guidance.test.ts .../agent/selection-guidance.unit.test.ts`: exit 0, 2 files, 75 tests.
- NEGATIVE CONTROL grep loop over the five names: exit 0.
- python bijection and pin check: exit 0, `[]`.
- python caps and rules check: exit 0, 98 entries, no bad entries.
- python reciprocity check: exit 0, 164 edges, no defects.
- python banned-vocabulary check: exit 0, no hits.
- node budget check: exit 0, `{ used: 8277, budget: 8600, ceiling: 9570 }`.
- node CAP, derived-union and unknown-id check: exit 0.
- node clause shape and UNRESOLVED check: exit 0.
- grep `NODE_ALLOWED` plus `npx vitest run --project packages .../agent/gates.test.ts`: exit 0, 5 tests.
- (guard) em-dash python check: exit 0 on the final tree. The first run exited 1 (see Notes); fixed and rerun.
- (guard) file allowlist `test -z ...`: exit 0.
- `npm run check`: exit 0 on the final code. The first run exited 2 on TS18048 (`m.targetCatalogs` possibly undefined); fixed and rerun. After a later doc-comment-only edit, `npx tsc -p . --noEmit` exited 0.
- `npx vitest run --project packages packages/agent-ui/a2ui`: exit 0, 109 files passed and 1 skipped, 2682 tests passed and 1 skipped.
- Plain-Node `import('./packages/agent-ui/a2ui/src/agent/index.ts')` via `--experimental-strip-types`: exit 0, so the agent barrel still resolves (the loader is not exported from it yet).
- After the final doc-comment edit, I reran the em-dash guard, the three test files (80 tests) and tsc: all exit 0.

## Notes
- `renderSelectionClause` takes `SelectionEntry | undefined` and returns `''` for `undefined`. That is how "never throws for a missing entry" works. Step 2's `catalogInventory` can pass `sg[id]` directly, and a catalog with no sidecar composes byte-identically.
- Budget: measured 8 277 chars; ceiling 9 570 (`baseline.default` at 38ed6721); value min(9570, 8300 + 300) = 8 600. Nothing enforces the budget yet. The doc comment says the `prompt-drift.test.ts` leg added by the inventory wiring will enforce it.
- No test asserts directly that the loader's hard-coded persona list (`PERSONA_IDS`, not exported) equals `SHIPPED_PERSONA_CATALOG_MANIFESTS`. Two legs cover it instead:
  - A loader id with no shipped manifest fails at module load (no sidecar on disk) or in the orphan leg.
  - A manifest missing from the loader fails the per-manifest compose leg (`missingEntries` on the derived catalog).
- `PersonaCatalogManifest.targetCatalogs` is optional. The gate copies `compose.ts` `targetsFor`: absent or empty means `['agent-ui']`. All three shipped manifests set `['agent-ui', 'a2ui-basic']`.
- The Write tool turned `\u2014` escapes into literal em dashes, which tripped the em-dash guard on the first run. I re-escaped them in `selection-guidance.ts` (the `EM_DASH` constant) and in the unit test fixtures, so those are escape sequences in source on purpose. Middle dots stay literal, as in `system-prompt.ts`.
- Authoring:
  - Persona edges target only Card, Text and TextField, which are in both bases, or a reciprocal same-fragment type.
  - Composite sub-types (Option, Tab, TabPanel, CardHeader/Content/Footer, MenuItem, Radio, ChoiceCard, Segment, SplitPane, TimelineItem, SwiperItem, DrillPanel) have one intent and no edges.
  - A substring check against `prompts/mini-skills/*.md` found no copied sentence.
- Scratch generator `/tmp/selgen` is outside the repo and still exists, because the cleanup `rm` was denied.
