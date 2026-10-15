<!-- role=builder level=L3 model=opus effort=high -->
## Status
done

## Changes
- `packages/agent-ui/a2ui/src/catalog/personas/croupier/catalog.json`: added the `CardTable` row after `PlayingCard`. It declares `"children": "ChildList"` and nine bindable props. Each hand is an array of `{rank, suit, faceDown}` items using the PlayingCard enums, with rank and suit required.
- `packages/agent-ui/a2ui/src/catalog/personas/croupier/selection.json`: added the `CardTable` entry as specified. Also added a `notFor` edge from `PlayingCard` to `CardTable` ("a whole table with both hands and the moves"); see Notes.
- `packages/agent-ui/a2ui/src/catalog/personas/croupier/factories.ts`: added `cardTableFactory` and registered it as `CardTable`.
  - `tag` is `ui-card`; `uses` lists `ui-badge`, `ui-playing-card` and `ui-text`.
  - It keeps a WeakMap of parts: head (title and status badge), two zones (label row and felt), and the readout.
  - Hands reuse the i-th card for item i at size `sm`. Parts hide through `style.display`, and all styling is inline.
  - Rewrote the file header.
- `packages/agent-ui/a2ui/src/catalog/personas/croupier/index.ts`: rewrote the header to name PlayingCard plus the CardTable composite.
- `packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts`: added the CardTable arm.
  - Each CardTable gives one hand container per `<p>Hand` prop. An absolute `{path}` or a literal list counts; a relative path, a function call or an absent prop counts as indeterminate.
  - New `HAND_BINDING` finding.
  - The table's `<p>Total` props are readouts labelled `<id>.<p>Total`, skipped when bound to `/<p>Total` or `/<p>/total`.
  - `HAND_COUNT` on a CardTable tells the model to bind `<p>Hand` to the listed path.
  - Header comment updated.
- `packages/agent-ui/a2ui/src/catalog/personas/croupier/card-table.test.ts` (new): six jsdom tests through the real renderer.
- `packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.test.ts`: new describe `croupier hand check: the CardTable arm (ADR-0243)` with 7 tests. These are the 6 specified cases plus one HAND_COUNT message case.
- `packages/agent-ui/a2ui/src/catalog/personas/croupier/recorded-replay.test.ts`: new describe `a CardTable deal against the recorded 27-component deal`.
- `packages/agent-ui/a2ui/src/catalog/personas/croupier/factories.test.ts`: new `cardTableFactory` describe covering tag and uses, the unknown-prop no-op, and no value mark.
- `packages/agent-ui/a2ui/src/catalog/personas/croupier/index.test.ts`: AC2 now expects `['PlayingCard', 'CardTable']`, and the no-collision test covers both types.
- `packages/agent-ui/a2ui/src/examples/persona-exemplars.ts`: added `personaCroupierCardTableSeed` and `personaBasicCroupierCardTableSeed` (surface `card-table`), appended after the two croupier hand seeds. The header list now includes CardTable.
- `packages/agent-ui/a2ui/src/agent/selection-guidance.unit.test.ts`: the croupier key list gains `CardTable`.
- `packages/agent-ui/a2ui/src/registry/registry-wiring.test.ts`: `base.types.length + 2`, `personaOnlyTypes` is `['CardTable', 'PlayingCard']`, and the test title names CardTable.
- `site/lib/capability-registry.test.ts`: `personaOnlyTypes` is `['CardTable', 'PlayingCard']`.
- Generated files:
  - `packages/agent-ui/a2ui/src/agent/assets.gen.ts`, from `node scripts/generate-agent-assets.mjs`.
  - `packages/agent-ui/a2ui/src/registry/selection-projection.gen.ts`, `site/capability-registry.json` and `site/public/capability-registry.json`, from `npm run generate:registry`.
  - `site/lib/agent-manifest/croupier.manifest.json`, from the `AGENT_MANIFEST_WRITE=1` writer.
  - `dogfood-fleet.gen.ts` was rewritten with no byte change.

## Checks
- `redck.py record` before the first edit: exit 0, 5 pre-edit red controls recorded.
- (red) catalog.json python assert: exit 0.
- (red) selection.json python assert: exit 0. Rerun after the selection.json fix: exit 0.
- (red) test -f plus the two grep -qF lines: exit 0.
- (red) `npx vitest run --project packages .../croupier -t CardTable` with the grep: exit 0 (20 passed, 43 skipped). Rerun after the tsc fix: exit 0.
- (red) manifest, selection-projection and the two capability-registry greps: exit 0. Rerun after regenerating: exit 0.
- (guard) `npx vitest run --project packages .../croupier`: exit 0, 63 passed. Rerun after the tsc fix: exit 0, 63 passed.
- (guard) the long packages list (selection-guidance.unit, asset-source, agent-assets-freshness, registry, ... examples):
  - First run: exit 1, 2 failed.
    - `selection-guidance.test.ts > croupier: its sidecar is a bijection with the fragment and reciprocal inside it`: "CardTable -> PlayingCard has no PlayingCard -> CardTable edge".
    - `registry-wiring.test.ts > the croupier view holds every default type plus PlayingCard and CardTable...`: got `['CardTable','PlayingCard']`, expected `['PlayingCard','CardTable']`.
  - Fixed both (see Notes), reran the three generators, then reran: exit 0, 20 files, 852 passed.
- (guard) `npx vitest run --project site` over agent-manifest.test.ts, lib/capability-registry.test.ts and pages/capability-registry.test.ts: exit 0, 31 passed.
- (guard) `npx vitest run --project tools .../registry/generate.test.ts && node scripts/generate-agent-assets.mjs --check`: exit 0.
- No em dash in added lines: exit 0.
- Scope check: exit 0, nothing outside the allowed list.
- `npx tsc` (not named by a criterion; the first leg of `npm run check`):
  - First run: exit 2, three TS4104/TS2345 errors. The readonly seed `messages` were assigned to the mutable `A2uiOutput`, in `card-table.test.ts:33` and `recorded-replay.test.ts:71,76`.
  - Fixed by typing the params as `readonly A2uiServerMessage[]` and spreading `[...seed.messages]`. Rerun: exit 0.
- `npm run eval:agent-behavior -- selftest` (rides `check:scripts`; run because of the new sidecar edge): exit 0, 16 turns, 0 mismatches, pins ok.

## Notes
- Deviation (a): `PlayingCard` gained a fourth `notFor` edge, `{"type": "CardTable", "why": "a whole table with both hands and the moves"}`.
  - Handoff item 2 specified only the CardTable entry, but the guard `catalog/selection-guidance.test.ts` requires reciprocity inside a fragment and was red without this edge.
  - PlayingCard is now at the `NOT_FOR_MAX` cap of 4.
  - `tools/agent-eval` derives one case per `notFor` edge, so it gains a PlayingCard-to-CardTable case. Its keyless selftest is green; the pinned `fixtures/persona-cases.json` was left untouched as the handoff says.
- Deviation (b): `personaOnlyTypes` is emitted sorted. So handoff item 8's "with CardTable" landed as `['CardTable', 'PlayingCard']` in both `registry-wiring.test.ts` and `site/lib/capability-registry.test.ts`.
- The status badge reads only `status` and `statusIntent`. The `card-table.test.ts` repaint test binds both to the data model in a cloned seed, because the shipped seed sets them as literals ("Your move", "info").
- Basic seed button variants are Hit `primary`, Stand `default`, Double `default`, mapping agent-ui's solid/soft onto the Basic enum `default | primary | borderless`.
- The agent-ui seed message order is createSurface, updateComponents, then one updateDataModel.
- Not done, as the handoff says: no prompt baseline recapture, no `seedVersion` bump (step 2), `examples/index.ts` untouched, and no commit.
