# The A2UI catalog change pipeline — how a card finding becomes a fix

Consulted by `a2ui-catalog-rendering-review`'s Fix leg. Mapped 2026-08-18 from the tree (line refs
drift — re-verify a ref before citing it in a report). Grep this file for the layer or the test name
you need; the whole file is not a read.

## 1 · The five layers, in edit order

**Layer 0 — the `ui-*` control** (`packages/agent-ui/components/src/controls/<name>/`) — only when the
control's own surface must change (a prop the catalog wants to expose does not exist yet).
- `<name>.ts` `static props` (e.g. `attachment.ts:28-47`: `filename`, `mimeType{attribute:'mime-type'}`,
  `sizeBytes{attribute:'size-bytes'}`, `href`) · `<name>.md` descriptor `attributes[]` mirrors
  `static props` by name/type/default/reflect — the props ground truth (ADR-0173 cl.5) ·
  `<name>.css` · `<name>-descriptor.test.ts` (attributes↔props bijection).
- 10 CONVERTED controls (button, table, badge, avatar, progress, toggle, image, video, audio,
  disclosure — `components/src/descriptor/props-gen-driftwire.test.ts:20`) also carry
  `<name>.props.gen.ts` → `node scripts/generate-props.mjs <name>`.

**Layer 1 — the catalog row** (`packages/agent-ui/a2ui/src/catalog/default/`)
- `catalog.json` component entry shape (validated at import by `catalog.ts` `validateComponent`
  :228-262 / `validatePropDef` :306-323 / `validateValueMark` :290-304; names UAX-31, no leading `@`,
  `naming.ts:12-16`; a shape fault throws `CATALOG_MALFORMED` from `catalog.ts:176` via `loadCatalog` at `default/index.ts:25`):
  ```
  "Type": {
    "properties": { "<prop>": { "type": <JsonSchema>, "bindable"?: bool, "mapsTo": "<control prop | textContent | attr>",
                                "format"?: "safe-href", "required"?: bool, "rejectFunctionCall"?: bool } },
    "children"?: "child" | "children" | "ChildList",
    "value"?: { "prop", "event", "readProp"?, "marshal"?: "singletonStringList" } | [ ≥1 slots, DISTINCT prop ]   // ADR-0161 / ADR-0169 cl.7
  }
  ```
  plus top-level `"functions"` (`catalog.json:733-756`). Wire name ≠ control prop is legal and recorded
  in `mapsTo` (Attachment: wire `name` → `"mapsTo": "filename"`, `catalog.json:583-590`).
- **Probe BEFORE committing a two-way `value` mark** (ADR-0211): the renderer's input controller reads
  `el[slot.prop]` synchronously at the commit event, so before wiring `value:{prop,event}` run a jsdom
  probe against the REAL control proving the accessor commits BEFORE the event fires, in BOTH modes
  (uncontrolled self-mutation AND controlled prop-as-source-of-truth) — a mark that fails the probe
  writes `undefined`/stale data into the data model on every commit. Three worked instances: Toggle's
  Fork T1 (PR #1363/GH #1352 — `toggle` fires pre-commit ⇒ NO mark), Drill (ADR-0211 — no readback
  accessor exists in either mode ⇒ forward-only bindable `path`, no mark), and the wave-2
  Rating/ChoiceGroup probes (ADR-0216 cl.6 made the probe the GATE, never the prior —
  `rating.test.ts`'s Fork-T1/D1 block), joined by a third COMMITTED probe: Suggestions' ADR-0213
  `{prop:'selected',event:'select'}` mark — bubble-order reasoning alone until GH #1468 upgraded it —
  now carries its own Fork-T1/D1-shaped block in `suggestions.test.ts` proving `#onClick` commits
  `selected` BEFORE `select` fires. Commit the probe in the row's test block as the standing guard;
  a probe-failed control ships bindable-forward-only until a real readback/commit-order fix lands.
- Persona fragments `catalog/personas/{concierge,croupier,fixture-demo}/{catalog.json,factories.ts,manifest.ts}`
  merge via `compose.ts` (`CATALOG_COMPOSE_COLLISION` on a name already in the base). `catalog/a2ui-basic/`
  is the upstream-pinned catalog (SPEC-R10/N5), reusing default factories via `withBasicCommon`.
- `factories.ts` — one `WidgetFactory {tag, create, applyProp, value?, submitGate?}` (`types.ts:20-46`).
  Helpers: `accessorFactory(tag, value?, submitGate?)` (:246-255, identity `el[prop]=value`) ·
  `mappedAccessorFactory(tag, {wire: prop})` (:264-270; `attachmentFactory = mappedAccessorFactory('ui-attachment', { name: 'filename' })` :792) ·
  bespoke factories for `textContent`/attribute mappings (`buttonFactory` :119, `optionFactory` :395,
  `menuItemFactory` :440). Invariant (:231-232): a non-identity `mapsTo` never rides plain
  `accessorFactory`. Register in `defaultFactories` (:1015-1082). One type → several tags =
  `VariantDispatch {variantProp, variants, fallback}` (`types.ts:62-72`, `variant.ts:33-38`, GH #545).
- Tests: `default/index.test.ts` (fleet coverage gate + per-family conformance) ·
  `default/factories.test.ts` (parity walker :300-340 + per-factory blocks) ·
  `default/descriptor-agreement.test.ts` (catalog kind/enum == descriptor attribute named by `mapsTo`;
  exceptions only via `AGREEMENT_EXCEPTIONS`, today `Text.variant` only).

**Layer 2 — examples / corpus** (`packages/agent-ui/a2ui/src/examples/`)
- A seed module (`catalog-coverage.ts`, `catalog-frontier.ts`, …) exported from `examples/index.ts`, in
  the family array feeding `allSeeds`, AND registered in `tools/corpus/import-seeds.ts:239 SEEDS_BY_MODULE`.
- Admission: `node --experimental-strip-types packages/agent-ui/a2ui/tools/corpus/import-seeds.ts --verdicts <file> [--replace <name>]`
  → `corpus/exemplar/v1_0/agent-ui.jsonl` + archived VerdictsFile `corpus/verdicts/<date>--<slug>.json`
  (ADR-0068/0165); verdicts come from `a2ui-review-agent` vs `rubrics/a2ui-corpus.md`. Un-admitted seeds
  need a `DISPOSITION_ALLOWLIST` reason.

**Layer 3 — site preview / catalog page**
- `site/lib/component-preview.ts`: `A2UI_INITIAL` (:223, per-type seed knob values) · `SAMPLE_TREES`
  (:283, `{rootRef, extras}` sample subtree) · `sampleFor` (:580, generic "Sample content" fallback) ·
  `COMPONENT_SAMPLE_CHILDREN` (:631, component-mode, keyed by tag) · `NO_SLOT_TEXT`/`STRUCTURAL`/`SLOT_TEXT_OK`
  (:1105-1207).
- `site/lib/a2ui-catalog-tiers.ts`: `NESTED_ONLY` (:31) · `TIERS` (:35) · `TIER_OF` (:48-137, hand-kept,
  one home per browsable type) · `browsableNames()` · `seedsUsingType()` (derived from `allSeeds`).

**Layer 4 — prompt / docs / regen**
- `a2ui/src/agent/system-prompt.ts:184 catalogInventory` derives the inventory at run time (no edit) BUT
  the composed prompt is byte-pinned in `src/live-agent/prompt-equivalence.baseline.json` → recapture.
- Docs not test-gated but owed: `.claude/docs/spec/a2ui-catalog.spec.md §5.2` row table ·
  `.claude/skills/a2ui-payload-authoring/references/node-idioms.md` per-type card · the factory doc
  comment citing its ADR (rubric `a2ui-catalog.md` D6).

## 2 · Gate matrix — which omission turns which test red

| Omission | Red test |
|---|---|
| Malformed PropDef / bad name / dup value-slot prop | import throws `CatalogError` → everything importing `defaultCatalog` (`catalog.test.ts`, `naming.test.ts`) |
| Type in catalog.json with no factory, or vice versa | `default/factories.test.ts:56,76` · `registry.test.ts:75` (`CATALOG_FACTORY_MISSING`) |
| New `ui-*` control with no row and no `EXCLUSION_ALLOWLIST` entry | `default/index.test.ts:240-256` (allowlist :165-215; residue guard :259 if the row lands but the allowlist seed stays) |
| Identity-`mapsTo` prop whose accessor doesn't reflect | `factories.test.ts:300-340` walker (bespoke types are skip-listed + own block) |
| Catalog kind/enum ≠ descriptor attribute named by `mapsTo` | `descriptor-agreement.test.ts:118-137,168-227` |
| Descriptor `attributes[]` ≠ `static props` | `controls/<name>/<name>-descriptor.test.ts` |
| CONVERTED control `.md` edited, `.props.gen.ts` stale | `descriptor/props-gen-driftwire.test.ts` |
| Any control TS/CSS change without dogfood rebuild | `sandbox-frame/dogfood/dogfood-assets-freshness.test.ts` |
| Descriptor prose change without llms regen | `site/lib/llms.test.ts:35` |
| ANY catalog.json change | `live-agent/prompt-equivalence.test.ts:48-56` (byte-pinned prompts) |
| Catalog type with no example anywhere | `examples/examples.test.ts:396-415` (GH #729) |
| Seed not admitted and not in `DISPOSITION_ALLOWLIST` | `corpus/admission-coverage.test.ts` |
| Seed invalid / renders with errors | `examples.test.ts:108-127` · `site/lib/a2ui-gallery.test.ts:56` |
| Seed in `allSeeds` but not `SEEDS_BY_MODULE` | `import-seeds.ts:303-310` halts |
| Renamed/removed type leaves an `A2UI_INITIAL`/`SAMPLE_TREES` key | `site/lib/component-preview-catalog.test.ts:66-77` |
| Children-bearing type with no `SAMPLE_TREES` (renders "Sample content") | `component-preview-catalog.test.ts:96-142` (GH #978) |
| Browsable type missing/stale in `TIER_OF`; sub-part not in `NESTED_ONLY` | `site/lib/a2ui-catalog-tiers.test.ts:17-40` |
| Page structure (5 tabs, cross-links) | `site/pages/a2ui-catalog.browser.test.ts` |
| Component-mode specimen for a NEW tag | `site/lib/component-preview-fleet.browser.test.ts` |
| TS strictness | `npm run check` |

`npm test` covers every jsdom gate above; `*.browser.test.ts` need `npm run test:browser` (sharded).

## 3 · Regeneration commands (run only the ones the touched layer owes)

| Touched | Command | Gate it satisfies |
|---|---|---|
| CONVERTED control `.md` | `node scripts/generate-props.mjs <name>` | props-gen-driftwire |
| any control TS/CSS | `node scripts/build-dogfood-assets.mjs` | dogfood-assets-freshness |
| any descriptor prose | `node scripts/generate-llms-full.mjs` | llms.test |
| any `catalog.json` | `RECAPTURE_BASELINE=1 npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/recapture-baseline.test.ts` — then `git diff` the baseline: ONLY inventory lines move | prompt-equivalence |
| a seed | `node --experimental-strip-types packages/agent-ui/a2ui/tools/corpus/import-seeds.ts --verdicts <verdicts.json> [--replace <name>]` | admission-coverage |
| the card | `node scripts/screenshot-a2ui-catalog.mjs --only <Type>` (dev server up) → re-grade | rubric re-check |

`catalog.json`, `factories.ts`, `TIER_OF`, `A2UI_INITIAL`, `SAMPLE_TREES` are hand edits — nothing generates them.

## 4 · Seat ownership (from `.claude/agents/*.md`; the rubric's §6 quadrant map is the routing key)

**Executor rule (Kim ruling 2026-08-18):** the session running `a2ui-catalog-rendering-review --fix`
edits the `a2ui/` and `site/` artifacts of shapes (i)/(ii)/(iii) itself — the owner column below names
whose STANDARD the edit is held to (and who to dispatch when the fix is delegated), not a hand-off
requirement. Two boundaries stay dispatches: control SOURCE (`controls/<name>/*`) → `component-build-agent`;
corpus ADMISSION (`import-seeds --verdicts`) → `a2ui-corpus-curation` / `a2ui-review-agent` verdicts.

| Artifact | Owner seat | Method skill |
|---|---|---|
| `catalog.json`, `factories.ts`, `variant.ts`, catalog tests, `EXCLUSION_ALLOWLIST`, `AGREEMENT_EXCEPTIONS`, conformance/validator | `a2ui-build-agent` | `a2ui-build`; graded by `a2ui-review-agent` vs `rubrics/a2ui-catalog.md` |
| `controls/<name>/{ts,md,css}`, descriptor tests, `.props.gen.ts`, dogfood | `component-build-agent` | `component-build` — a2ui-build ESCALATES here, never crosses the package |
| `A2UI_INITIAL`, `SAMPLE_TREES`, `COMPONENT_SAMPLE_CHILDREN`, knob config | `example-authoring-agent` | `example-authoring`; never edits `component-preview.ts` concurrently with docs-writer |
| `TIER_OF`/`NESTED_ONLY`, page shell/cross-links | docs-writer | `site-authoring` |
| Seeds in `src/examples/` | `a2ui-payload-authoring-agent`; admission via `a2ui-corpus-curation`; verdicts by `a2ui-review-agent` | |
| Prompt baseline | `a2ui-prompt-authoring` (byte-pinning law) | |
| Second/persona catalogs | `a2ui-multi-catalog` → a2ui-build-agent for code | |

Governing records a row must satisfy: SPEC `a2ui-catalog.spec.md` (R1/R3/R7/R9, N2 fleet coverage, §5.2 +
§5.2.1) · LLD `a2ui-catalog.lld.md` (C1 loader, C3 registry, C5 factories, C6 conformance) · ADR-0087
(include-or-recorded-exclusion; row + control same wave, cl.6) · ADR-0053 (bindable prop is the CONTROL's
prop; bespoke factory for `label→textContent`; `value` = real prop + commit event) · ADR-0054 (`submitGate`
⇒ `submit()`) · ADR-0161 (multi-slot `value`) · ADR-0169 (`readProp`/`marshal`, per-catalog functions,
variants) · ADR-0173 cl.5 (descriptor = props ground truth) · ADR-0112 cl.6 (permanent chrome exclusions).

## 5 · The three fix shapes

**(i) Seed-only — the card renders empty/generic (quadrant L-only)** — standard: example-authoring
1. `site/lib/component-preview.ts`: add/extend `A2UI_INITIAL[Type]` (values are knob STRINGS —
   `sizeBytes: '428000'`, booleans `'true'`) and/or `SAMPLE_TREES[Type]`. Every key is a declared
   catalog prop (the renderer validates); mirror the corpus's own idiom for that type
   (`examples/catalog-coverage.ts`) so the card teaches what agents actually emit.
2. Gates: `component-preview-catalog.test.ts`; `npm test`. No regen.
3. Re-capture the card and re-grade A3/B4/C1.

**(ii) New prop on an existing type (quadrant R-only / L↔R)** — standard: a2ui-build (dispatch
component-build-agent if the control lacks the prop)
1. Control (if needed): `static props` + descriptor `attributes[]` (+ css); descriptor test green;
   `generate-props` if CONVERTED; `build-dogfood-assets`; `generate-llms-full`.
2. `catalog.json`: `"foo": { "type": {...}, "bindable"?, "mapsTo": "<descriptor attribute name>" }` —
   kind/enum equal to the descriptor attribute or a cited `AGREEMENT_EXCEPTIONS` row; wire ≠ control
   name → `mappedAccessorFactory`/bespoke and the mapping recorded in `mapsTo`.
3. `factories.ts`: identity → nothing; non-identity → extend the mapping/bespoke `applyProp` (+ walker
   skip-list entry + own describe block). `index.test.ts` conformance case (literal passes,
   out-of-enum fails, `{path}` iff bindable).
4. Recapture the prompt baseline. Optionally: seed showing the prop, `A2UI_INITIAL` value,
   `node-idioms.md` card, SPEC §5.2 note, factory doc comment.
5. `npm run check` + `npm test` (+ browser shards if the control changed).

**(iii) New catalog type / pattern, end to end** (order matters)
1. Control ships (`ui-x` ts/md/css/tests) — or it exists in `EXCLUSION_ALLOWLIST` as TEMPORARY: drain
   the allowlist seed in the SAME commit as the row (residue guard). Not meant to be agent-emittable →
   PERMANENT allowlist entry, stop.
2. `catalog.json` row (PascalCase(tag) == type name — the fleet gate derives it, `index.test.ts:109-133`;
   sub-parts `XItem` are parent-declared + `NESTED_ONLY`) · `factories.ts` factory + `defaultFactories`
   (+ `VariantDispatch`) · index/factories/descriptor-agreement tests.
3. Docs: SPEC §5.2 row + Notes; ADR/LLD cited in the factory doc comment; `node-idioms.md` card.
4. Recapture the prompt baseline.
5. Seed in `src/examples/` (export + `allSeeds` + `SEEDS_BY_MODULE`) → GH #729 green; admit via
   `import-seeds --verdicts` or `DISPOSITION_ALLOWLIST` reason.
6. Site: `TIER_OF[Type]` (or `NESTED_ONLY`) · `SAMPLE_TREES`/`A2UI_INITIAL` · component-mode
   `COMPONENT_SAMPLE_CHILDREN`/`STRUCTURAL`/`NO_SLOT_TEXT` for the tag · `site/<x>-doc.html` exists
   (`controls-coverage.test.ts`).
7. Regen (§3), then `npm run check`, `npm test`, `npm run test:browser`.
8. Grade: `a2ui-review-agent` vs `rubrics/a2ui-catalog.md` (D1–D3 gates ≥4 hard) + this skill for the card.

## 6 · Probe-artifact taxonomy (2026-08-18 sweep hardening — triage BEFORE filing a defect)

Five artifact classes cost the first sweep five iterations of false reds. When a probe goes red, check
these before blaming the page; each names its realized fix in `scripts/eval-a2ui-catalog.mjs`:

| Artifact class | Symptom | Realized fix |
|---|---|---|
| Minted per-instance ids | C2 byte-diff on `ui-select-listbox-13` → `-14`, `ui-cb1` → `ui-cb13` | canonical serializer: digit-normalize id-carrying attrs (`id`, `for`, `aria-*`, `style`/`anchor-name`) on BOTH sides |
| Attribute-order churn | rebuilds re-apply attrs in state order; innerHTML order differs, DOM equal | canonical serializer: sorted attributes |
| Measured-while-hidden | tabbed pages build every non-active tier's cards `display:none` — zero rects, stale measured state (aria bounds) until first visible rebuild | hidden canvas ⇒ unflagged + reveal re-measure; baseline = one no-op rebuild while visible, then settle |
| Control reflection ≠ state | a clamped/derived live value reflected to an attribute (slider `min=2` ⇒ `value="2"`) looks like state contamination | assert on KNOB STATE, not the control's own reflection; value-slot re-seed is by-design (readBack) |
| Top-layer capture | element-clipped shots miss a viewport-centered `dialog[open]`; an open top layer intercepts every later click; exact-box clips drop the last text line on pixel parity | dialog open ⇒ viewport shot; force-close + Escape + `dialog.close()` cleanup after every reveal; pad clips past the section box |

Two triage rules proved out: (1) a runner that omits a check may be faithfully implementing the RUBRIC's
own omission — check the spec before the implementation (the v0.1 §5 A3 hole); (2) "pre-existing red" is
verified against origin/main's merge-base, never against the branch's own base (the dogfood/sitemap red
was owed by the branch itself — control TS changes owe the §3 regens).
