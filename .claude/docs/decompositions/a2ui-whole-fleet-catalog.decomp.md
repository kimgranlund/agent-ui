# Decomposition — A2UI whole-fleet catalog coverage (ADR-0087)

> Status: **proposed** (planner design seat) · 2026-07-06 · Owning docs: **ADR-0087** ·
> `a2ui-catalog.spec.md` SPEC-N2 / SPEC-R3 AC3 / §5.2.1 · `a2ui-catalog.lld.md` LLD-C4/C5.
> Manifest (coverage-gated): [`a2ui-whole-fleet-catalog.decomp.json`](./a2ui-whole-fleet-catalog.decomp.json)
> — `coverage_check.py` clean (13 nodes · 49 actions · plan mode, exit 0).
> Build seat: **`a2ui-builder`** — one WAVE per dispatch, sequential (each wave edits the shared
> `catalog.json` + `factories.ts` + the `index.test.ts` allowlist, so waves do NOT parallelize).
> **All four forks below RESOLVED (Kim, 2026-07-06) — see §0. ADR-0087's `Status` is still `proposed`;**
> **ratification lands at the wave-gate close, not from the fork answers alone. Build may proceed on the**
> **resolved forks; the a2ui-builder still needs the coordinator/host to dispatch each wave.**

## 0. What this closes

Today the default catalog declares **19 types** (13 primary + 6 composite sub-types); the fleet is **25
descriptors**. Four shipped controls are uncatalogued AND undispositioned (`ui-icon`/`ui-menu`/`ui-popover`/
`ui-tooltip` — the live SPEC-N2 violation); six more are deferred (ADR-0053: radio-group/radio/slider/
slider-multi/calendar/combo-box); two are non-catalog (ADR-0016: list/grid). ADR-0087 flips the policy to
whole-fleet and replaces the CI-silent hand-frozen coverage list with a fleet-derived gate. This doc is the
ordered build.

### Ratification forks (from ADR-0087 — ALL FOUR RESOLVED, Kim 2026-07-06)

- **Fork A — list/grid become catalog types? RESOLVED: INCLUDE**, "as long as these have specific guidelines
  of where and how to use" — `List`/`Grid`, superseding ADR-0016's non-catalog exclusion. Kim's condition is a
  build requirement, not a taste note: Wave C's §5.2 rows must carry prompt-facing guidance distinguishing
  `Row`/`Column` (deliberate heterogeneous arrangement) vs `List` (homogeneous itemized collection, `role=list`)
  vs `Grid` (responsive auto-fit reflow) — see ADR-0087 Decision/Fork A and the SPEC §5.2.1 callout for the
  exact prose to carry forward. Wave C is NOT done on a green gate alone if this prose is missing.
- **Fork B — radio-group shape. RESOLVED: INCLUDE** one `RadioGroup` type + `Radio` child sub-type
  (Select/Option mirror). Sub-question stays live as a builder-verify item (not re-opened): the group `value`
  two-way seam (accessor+event) — verify against `radio-group.ts`.
- **Fork C — slider vs slider-multi. RESOLVED: two types (option c1)** — `SliderMulti` binds `valueLo`/`valueHi`
  **one-way** (the ADR-0019 seam is one two-way `value` per component); c2 (fold into `Slider`) and c3 (defer)
  are no longer live.
- **Fork D — overlay family. RESOLVED: INCLUDE menu/popover/tooltip — all three, no exceptions.** Kim's "yes"
  explicitly closes the one hedge this ADR flagged (`Tooltip` as a defensibly app-side candidate) — Tooltip IS
  catalogued. Sub-questions (d1) `MenuItem` sanctioned primitive; (d2) `Popover`/`Tooltip` trigger/content
  child model remain builder-resolved implementation details, not re-opened forks.

---

## 1. The fleet-derived coverage gate (Wave 0 / PREP — `default/index.test.ts` rewrite)

**Problem being fixed:** `index.test.ts` asserts `Object.keys(defaultCatalog.components).sort()` against a
**hand-frozen 19-name array**. A shipped-but-uncatalogued control passes CI silently — the drift the gate
exists to catch is invisible to it.

**Design (mirror `components/src/descriptor/site-coverage.test.ts`):**

1. **Derive** the expected primary-type set from the descriptor glob — walk
   `packages/agent-ui/components/src/controls/*/*.md`, read each `tag:` scalar, map `ui-{kebab}` → PascalCase:
   ```ts
   const pascal = (tag: string): string =>
     tag.slice('ui-'.length).split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join('')
   // ui-text-field → TextField · ui-form-provider → FormProvider · ui-radio-group → RadioGroup
   // ui-slider-multi → SliderMulti · ui-combo-box → ComboBox · ui-icon → Icon
   ```
   Use the components package's `splitFrontmatter`/`parseDescriptor` if a test-only import across the package
   is acceptable, else a minimal `tag:`-line scan (the site-coverage `walk` + `readFileSync` pattern). The
   glob is the SAME source of truth `site-coverage.test.ts` already trusts (SPEC-N2).
2. **Subtract** the exclusion allowlist (a `Map<string, string>` of type → reason, seeded below).
3. **Assert** the remainder ⊆ `catalog.components` AND ⊆ `defaultFactories` — the forward direction (a shipped
   control lacking a catalog type/factory and not allowlisted FAILS). Composite sub-types (`Option`/`Tab`/
   `TabPanel`/`CardHeader`/`CardContent`/`CardFooter`, + new `MenuItem`/`Radio`) are parent-declared, NOT in
   the fleet glob, so they never enter the expected set — exempt by construction.
4. **Anti-vacuous:** assert the derived set is non-empty and contains `Button` + `TextField` (a broken scan
   cannot pass silently — the site-coverage precedent).
5. **Negative control (bites):** a pure predicate
   `typesMissingCatalog(expected, catalogKeys, allowlist): string[]` returns the uncovered set; assert
   `typesMissingCatalog(['ZzFake'], new Set(), new Map()) === ['ZzFake']` and
   `typesMissingCatalog(['Button'], catalogKeys, new Map()) === []`.

**Seed allowlist (drains as waves land — Image/Video are NOT here: no `ui-image`/`ui-video` descriptor exists,
so they never enter the derived set):**
```ts
const EXCLUSION_ALLOWLIST = new Map<string, string>([
  ['Icon', 'ADR-0087 Wave A — draining'],
  ['Menu', 'ADR-0087 Wave A — draining'],
  ['Popover', 'ADR-0087 Wave A — draining'],
  ['Tooltip', 'ADR-0087 Wave A — draining'],
  ['RadioGroup', 'ADR-0087 Wave B — draining (closes ADR-0053 deferral)'],
  ['Radio', 'ADR-0087 Wave B — draining (RadioGroup child sub-type)'],
  ['Slider', 'ADR-0087 Wave B — draining (closes ADR-0053 deferral)'],
  ['SliderMulti', 'ADR-0087 Wave B — draining (Fork C: one-way dual-value)'],
  ['Calendar', 'ADR-0087 Wave B — draining (closes ADR-0053 deferral)'],
  ['ComboBox', 'ADR-0087 Wave B — draining (closes ADR-0053 deferral)'],
  ['List', 'ADR-0087 Wave C — draining (Fork A RESOLVED INCLUDE, Kim 2026-07-06)'],
  ['Grid', 'ADR-0087 Wave C — draining (Fork A RESOLVED INCLUDE, Kim 2026-07-06)'],
])
```

**Sequencing recommendation — SEED-AND-DRAIN (land the gate FIRST, not last).** The fleet-derived gate goes
RED the instant it lands if the rows don't exist. The recommended path (the `site-coverage.test.ts`
`KNOWN_UNDOCUMENTED` precedent): land the gate as Wave 0 with the allowlist seeded FULL (green day one), and
each wave **deletes its types from the allowlist in the same commit that adds the rows** — so catalog↔fleet
drift is CI-visible throughout the build, and each wave's coverage move is a gated, visible step. The rejected
alternative (land the gate LAST) leaves drift CI-silent for the whole build. Wave D then only deletes the
residual frozen assertions and reconciles the final allowlist.

**Keep** the existing `index.test.ts` describe blocks (`loads + exposes`, the G9 container declarations, the
conformance blocks, the ADR-0053 form-family block). **Delete** only the frozen `.toEqual([...19...])`
assertion — the derived gate replaces it.

**Wave 0 acceptance:** `npm test -- catalog/default/index.test.ts` green — derive/subtract/assert/anti-vacuous/
negative-control all pass with the seeded allowlist; `npm run check` green (no type break). No `catalog.json`/
`factories.ts` change in this wave (gate only).

---

## 2. Node shapes + per-type build detail

Each new type: (i) the `catalog.json` component entry, (ii) the `factories.ts` binding, (iii) node shape /
composite adjacency, (iv) conformance + security-allowlist note, (v) the allowlist drain, (vi) the SPEC §5.2
row + LLD-C4/C5 note. **Verify every prop against the control's `.md` descriptor + `.ts` `static props`
before writing the row** (the descriptor is the contract; ADR-0053 fork F2 is the naming-law precedent — a
bindable catalog prop is named by the control's own prop).

### Wave A — the undispositioned four (closes the live SPEC-N2 violation)

**A1 · `Icon` → `ui-icon`** (display leaf, the `Text` precedent). Bespoke factory (`name`/`label` are
non-identity where needed — `name` re-resolves the glyph, `label` sets the accessible name via the control's
accessor).
```jsonc
"Icon": { "properties": {
  "name":  { "type": { "type": "string" }, "bindable": true, "mapsTo": "name" },
  "label": { "type": { "type": "string" }, "bindable": true, "mapsTo": "label" } } }
```
Factory: `accessorFactory('ui-icon')` — both `name`/`label` are reflecting prop accessors (verify: `icon.ts`
`static props` = name/label, both prop-settable). No `value`, no children (leaf). Not an input.

**A2 · `Menu` → `ui-menu`** + **`MenuItem`** sanctioned primitive (Fork D/d1, the Option precedent).
```jsonc
"Menu": { "properties": {
  "open":      { "type": { "type": "boolean" }, "bindable": true, "mapsTo": "open" },
  "placement": { "type": { "type": "string", "enum": ["bottom-start","bottom-end","top-start","top-end","left-start","left-end","right-start","right-end"] }, "mapsTo": "placement" } },
  "value": { "prop": "open", "event": "toggle" }, "children": "ChildList" },
"MenuItem": { "properties": {
  "value": { "type": { "type": "string" }, "mapsTo": "value" },
  "label": { "type": { "type": "string" }, "bindable": true, "mapsTo": "textContent" } } }
```
Factory: `Menu` = `accessorFactory('ui-menu', { prop:'open', event:'toggle' })`. `MenuItem` = the Option-shape
bespoke primitive (`data-value` attr + `label` → textContent) — `ui-menu` reads `[role=menuitem]` children's
`data-value`/textContent (verify against `menu.ts` item resolution: `value` = `data-value` attr). **Builder
note:** wire the item `value` → `data-value` attribute (not a plain `value` attr) — the menu's `select` event
reads `data-value`. The menu `select`→action wiring is a renderer concern, out of this catalog scope.

**A3 · `Popover` → `ui-popover`** (Fork D/d2 — trigger/content model).
```jsonc
"Popover": { "properties": {
  "open":      { "type": { "type": "boolean" }, "bindable": true, "mapsTo": "open" },
  "placement": { "type": { "type": "string", "enum": [ /* 8 OverlayPlacement values */ ] }, "mapsTo": "placement" } },
  "value": { "prop": "open", "event": "toggle" }, "children": "ChildList" }
```
Factory: `accessorFactory('ui-popover', { prop:'open', event:'toggle' })`. **Fork D/d2 (builder resolves):**
`ui-popover` uses a named `trigger` light-DOM slot + default content, which the flat A2UI child model does not
express. Options: (a) a `PopoverTrigger`/`PopoverContent` sub-type pair (the CardHeader/CardContent regions
precedent — clean, explicit); (b) positional `ChildList` (child[0] = trigger). **Recommend (a)** — named
regions match the control's slot model and avoid a fragile positional convention. If (a), add the two sub-types
(they are parent-declared, gate-exempt like CardHeader).

**A4 · `Tooltip` → `ui-tooltip`** (as Popover + `delay`).
```jsonc
"Tooltip": { "properties": {
  "open":      { "type": { "type": "boolean" }, "bindable": true, "mapsTo": "open" },
  "placement": { "type": { "type": "string", "enum": [ /* 8 */ ] }, "mapsTo": "placement" },
  "delay":     { "type": { "type": "number" }, "mapsTo": "delay" } },
  "value": { "prop": "open", "event": "toggle" }, "children": "ChildList" }
```
Factory: `accessorFactory('ui-tooltip', { prop:'open', event:'toggle' })`. Same trigger/content resolution as
Popover. **The one defensible app-side candidate:** if the trigger-binding proves un-idiomatic in the payload
model, Tooltip is the control ADR-0087 flags as allowlist-able — surface that to Kim rather than force it.

### Wave B — the deferred form/range/date family (closes the ADR-0053 §5.2 deferral)

**B1 · `RadioGroup` → `ui-radio-group`** + **`Radio`** child sub-type (Fork B, Select/Option adjacency).
```jsonc
"RadioGroup": { "properties": {
  "value":       { "type": { "type": "string" }, "bindable": true, "mapsTo": "value" },
  "name":        { "type": { "type": "string" }, "mapsTo": "name" },
  "disabled":    { "type": { "type": "boolean" }, "bindable": true, "mapsTo": "disabled" },
  "required":    { "type": { "type": "boolean" }, "mapsTo": "required" },
  "variant":     { "type": { "type": "string", "enum": ["default","segmented"] }, "mapsTo": "variant" },
  "orientation": { "type": { "type": "string", "enum": ["horizontal","vertical"] }, "mapsTo": "orientation" } },
  "value": { "prop": "value", "event": "change" }, "children": "ChildList" },
"Radio": { "properties": {
  "value":   { "type": { "type": "string" }, "mapsTo": "value" },
  "label":   { "type": { "type": "string" }, "bindable": true, "mapsTo": "textContent" },
  "checked": { "type": { "type": "boolean" }, "bindable": true, "mapsTo": "checked" } } }
```
**Fork B sub-question (builder VERIFIES against `radio-group.ts` before finalizing the `value` mark):** does
`UIRadioGroupElement` expose a `value` accessor (the selected radio's value) + emit a `change`/`select` commit
event? If yes → `value:{prop:'value',event:'change'}` as above (the Select precedent). If the value is
children-driven with a different event name, match it. `Radio` factory = the Option-shape bespoke primitive
(`value` attr + `label` textContent + `checked`); `RadioGroup` = `accessorFactory('ui-radio-group', {…})`.
`variant`/`orientation` are the ADR-0086 props (include so segmented radio-groups are agent-emittable).

**B2 · `Slider` → `ui-slider`** (Fork C — single value).
```jsonc
"Slider": { "properties": {
  "value":    { "type": { "type": "number" }, "bindable": true, "mapsTo": "value" },
  "min":      { "type": { "type": "number" }, "mapsTo": "min" },
  "max":      { "type": { "type": "number" }, "mapsTo": "max" },
  "step":     { "type": { "type": "number" }, "mapsTo": "step" },
  "name":     { "type": { "type": "string" }, "mapsTo": "name" },
  "disabled": { "type": { "type": "boolean" }, "bindable": true, "mapsTo": "disabled" },
  "required": { "type": { "type": "boolean" }, "mapsTo": "required" } },
  "value": { "prop": "value", "event": "change" } }
```
Factory: `accessorFactory('ui-slider', { prop:'value', event:'change' })`. **Verify** the commit event name
against `slider.ts` (fleet vocab = `change`; sliders emit `input` during drag + `change` on commit — bind the
committed `change`).

**B3 · `SliderMulti` → `ui-slider-multi`** (Fork C — dual value, the seam limitation).
```jsonc
"SliderMulti": { "properties": {
  "min":      { "type": { "type": "number" }, "mapsTo": "min" },
  "max":      { "type": { "type": "number" }, "mapsTo": "max" },
  "step":     { "type": { "type": "number" }, "mapsTo": "step" },
  "valueLo":  { "type": { "type": "number" }, "bindable": true, "mapsTo": "valueLo" },
  "valueHi":  { "type": { "type": "number" }, "bindable": true, "mapsTo": "valueHi" },
  "name":     { "type": { "type": "string" }, "mapsTo": "name" },
  "disabled": { "type": { "type": "boolean" }, "bindable": true, "mapsTo": "disabled" } } }
```
**Fork C limitation (the reason this is a fork, not a formality):** the ADR-0019 two-way seam allows ONE
`value:{prop,event}` mark per component; `SliderMulti` has TWO committed values. So it declares NO
`value:{prop,event}` mark — `valueLo`/`valueHi` are bindable ONE-WAY (`{path}` reads; agent sets literals or a
data-path, but the control's user-drag does not write back through the current seam). Factory:
`accessorFactory('ui-slider-multi')` (no `value` arg). **Alternatives Kim may pick:** (c2) fold into a
parameterized `Slider` (rejected as awkward — value shape differs); (c3) keep `SliderMulti` on the allowlist
with the reason `"dual-value two-way needs a seam extension"`. If (c3), B3 is a no-op and `SliderMulti` stays
listed.

**B4 · `Calendar` → `ui-calendar`** (straightforward — the descriptor already declares the two-way bind).
```jsonc
"Calendar": { "properties": {
  "value":    { "type": { "type": "string" }, "bindable": true, "mapsTo": "value" },
  "min":      { "type": { "type": "string" }, "mapsTo": "min" },
  "max":      { "type": { "type": "string" }, "mapsTo": "max" },
  "name":     { "type": { "type": "string" }, "mapsTo": "name" },
  "required": { "type": { "type": "boolean" }, "mapsTo": "required" },
  "disabled": { "type": { "type": "boolean" }, "bindable": true, "mapsTo": "disabled" } },
  "value": { "prop": "value", "event": "change" } }
```
Factory: `accessorFactory('ui-calendar', { prop:'value', event:'change' })`. `value` is an ISO date string
(`''` = no date). Verified against `calendar.md`: `value:{prop:'value',event:'change'}` is the descriptor's
own declared two-way bind.

**B5 · `ComboBox` → `ui-combo-box`** + reuse `Option` children (Fork D/combobox).
```jsonc
"ComboBox": { "properties": {
  "value":       { "type": { "type": "string" }, "bindable": true, "mapsTo": "value" },
  "label":       { "type": { "type": "string" }, "bindable": true, "mapsTo": "label" },
  "placeholder": { "type": { "type": "string" }, "mapsTo": "placeholder" },
  "strict":      { "type": { "type": "boolean" }, "mapsTo": "strict" },
  "name":        { "type": { "type": "string" }, "mapsTo": "name" },
  "disabled":    { "type": { "type": "boolean" }, "bindable": true, "mapsTo": "disabled" } },
  "value": { "prop": "value", "event": "change" }, "children": "ChildList" }
```
**Fork D/combobox (builder resolves the two-way slot):** `combo-box.md` carries BOTH a committed `value` and a
disclosure `open`. The one `value:{prop,event}` slot should bind `value` (the FORM value — the point of a
combo-box), committed on `change` — NOT `open`. **Note the descriptor discrepancy:** `combo-box.md`'s comment
says "the catalog declares `value:{prop:'open',event:'toggle'}`" (copied from the overlay family) — that
comment predates catalog inclusion and should be corrected to `value:{prop:'value',event:'change'}` OR the
builder confirms which the seam binds. `ComboBox` reuses the existing `Option` primitive for its children
(same as `Select`). Factory: `accessorFactory('ui-combo-box', { prop:'value', event:'change' })`.

### Wave C — list/grid (Fork A RESOLVED INCLUDE, Kim 2026-07-06)

**Build requirement, not optional polish:** each §5.2 row below MUST carry the Kim-required usage guidance
(Row/Column vs List vs Grid — verbatim source: ADR-0087 Decision/Fork A + SPEC §5.2.1's callout) in its Notes
column. A bare type declaration with no guidance does not satisfy Fork A's condition.

**C1 · `List` → `ui-list`** — a `Column` specialization carrying `role=list`.
```jsonc
"List": { "properties": {
  "elevation":  { /* -3..3 enum */ "mapsTo": "elevation" }, "brightness": { /* -3..3 */ "mapsTo": "brightness" },
  "align":   { "type": { "type": "string", "enum": ["start","center","end","stretch","baseline"] }, "mapsTo": "align" },
  "justify": { "type": { "type": "string", "enum": ["start","center","end","between","around","evenly"] }, "mapsTo": "justify" },
  "gap":     { "type": { "type": "string", "enum": ["none","xs","sm","md","lg","xl","2xl"] }, "mapsTo": "gap" },
  "wrap":    { "type": { "type": "boolean" }, "mapsTo": "wrap" } },
  "children": "ChildList" }
```
Factory: `accessorFactory('ui-list')` (the `Row`/`Column` pattern — surface + flex grammar 1:1). Supersedes
ADR-0016's List exclusion (set ADR-0016 `Superseded by` at ratification). **§5.2 row Notes MUST state:** use
`List` (not `Column`) for a homogeneous, itemized collection where list semantics matter to assistive tech
(search results, a feed, a to-do list) — `List` carries `role=list` for free.

**C2 · `Grid` → `ui-grid`** — the auto-fit track model.
```jsonc
"Grid": { "properties": {
  "elevation": { /* -3..3 */ "mapsTo": "elevation" }, "brightness": { /* -3..3 */ "mapsTo": "brightness" },
  "gap": { "type": { "type": "string", "enum": ["none","xs","sm","md","lg","xl","2xl"] }, "mapsTo": "gap" },
  "min": { "type": { "type": "string" }, "mapsTo": "min" } },
  "children": "ChildList" }
```
Factory: `accessorFactory('ui-grid')`. `min` = the `minmax()` track floor (a CSS `<length>` string). **§5.2
row Notes MUST state:** use `Grid` when the column count should reflow responsively with available width (an
image/card gallery, a dashboard of tiles); prefer `Row`/`Column` (with `wrap`) for an author-controlled,
non-reflowing arrangement.

### Wave D — drain + flip the gate

Delete the residual frozen assertions; reconcile the allowlist to EXACTLY the fork-deferred residue — **now
confirmed EMPTY** (all four forks resolved INCLUDE, Kim 2026-07-06) except the documentary-only `Image`/`Video`
rows (no shipped control, never code-derived — see SPEC §5.2.1). The gate now bites on any non-residue shipped
control. Final coherence pass on SPEC §5.2 + §5.2.1 + LLD-C4/C5 (no stale frozen list, no orphan row).

---

## 3. Which existing tests update (per wave)

| File | Change | When |
|---|---|---|
| `catalog/default/index.test.ts` | **Rewrite** — delete the frozen `.toEqual([...19...])`; add the fleet-derive/subtract/assert/anti-vacuous/negative-control gate + the seeded `EXCLUSION_ALLOWLIST`. Drain the allowlist per wave. Add a per-type conformance block (valid payload 0-`CATALOG` + a negative-control unknown-prop) as each type lands — the ADR-0053 form-family block is the template. | Wave 0 (gate); each wave (drain + conformance block) |
| `catalog/default/factories.test.ts` | The table-parity test (`Object.keys(defaultFactories) === Object.keys(defaultCatalog.components)`) is fleet-agnostic — it auto-covers new types (asserts the bijection + the reverse "no extra"). ADD a per-type factory unit (e.g. Icon sets `name`/`label`; MenuItem sets `data-value`/textContent) mirroring the existing Button/TextField/Select blocks. | each wave |
| `catalog/conformance.test.ts` | No change required if per-type conformance cases live in `index.test.ts` (the established precedent). Optionally add cross-type cases here. | optional |
| `catalog/naming.test.ts` | **No change** — it is a `validName` unit test, not a catalog-type enumeration. New PascalCase names (Icon/Menu/MenuItem/Popover/Tooltip/RadioGroup/Radio/Slider/SliderMulti/Calendar/ComboBox/List/Grid) are all valid UAX-31 and are validated at `loadCatalog` import automatically (an invalid name would throw `CATALOG_NAME_INVALID` at import, failing every test that imports `defaultCatalog`). | — |
| `a2ui-catalog.spec.md` §5.2 / §5.2.1 | Add the shipped row; remove the drained type from the §5.2.1 allowlist table. | each wave |
| `a2ui-catalog.lld.md` LLD-C4/C5 | Extend the LLD-C5 factory list note + the §5.2 experimental→shipped precedent per wave (the G9 `s11` note is the template). | each wave |
| `catalog/default/index.ts` (module header comment) | Update the coverage-comment (currently "`ui-list`/`ui-grid` are NOT catalog types") to the whole-fleet policy. | Wave 0 or the relevant wave |

**Conformance / security-allowlist implication (every new type):** a new catalog type widens the SPEC-R9
security allowlist — the renderer will now render that type where it previously emitted `CATALOG`. The
conformance validator (`conformance.ts`, LLD-C6) verdicts PRESENT props (unknown / type-mismatch), so each
new type's negative control is an unknown-prop or type-mismatch case (the Modal negative-control precedent).
No `conformance.ts` code change — it is type-driven off the loaded catalog.

---

## 4. Per-wave acceptance criteria + test plan

**Every wave** ends on `npm run check && npm test` green (jsdom) AND the catalog-touching browser legs green
where the control has interaction (the component-reviewer DoD — jsdom-green ≠ done for interactive controls).

| Wave | Acceptance | Test plan |
|---|---|---|
| **0 · gate** | `npm test -- catalog/default/index.test.ts` green with the seeded allowlist; the negative control proves the gate bites; `npm run check` green. No catalog/factory change. | derive returns ≥ the 13 catalogued + 12 allowlisted names; anti-vacuous (Button/TextField present); `typesMissingCatalog` NC returns the synthetic uncovered set. |
| **A · icon/menu/popover/tooltip** | each type validates a realistic payload 0-`CATALOG` via `validateA2ui`; a negative control (unknown prop) fails `CATALOG`; `registry.register(defaultCatalog, defaultFactories)` clean (0 `CATALOG_FACTORY_MISSING`); the four drained from the allowlist; SPEC §5.2 rows added. | Icon leaf payload; Menu+MenuItem list; Popover/Tooltip with the resolved trigger/content model; factory units set the mapped props; the parity test stays green. |
| **B · radio/slider/slider-multi/calendar/combo-box** | RadioGroup+Radio round-trips the selected value via the verified commit event; Slider round-trips a numeric value on `change`; SliderMulti one-way binds `valueLo`/`valueHi` (the seam limitation documented); Calendar round-trips the ISO value; ComboBox round-trips the committed value via the resolved slot; all drained (or SliderMulti retained per fork). | a full coordinated payload (the ADR-0053 form-family test is the template) exercising every new row; two-way round-trip cases via the input controller; negative controls per type. |
| **C · list/grid** (Fork A RESOLVED INCLUDE) | List/Grid validate surface+grammar payloads 0-`CATALOG`; drained; SPEC §5.2 rows added **with the Kim-required usage guidance** (Row/Column vs List vs Grid); ADR-0016 List/Grid exclusion superseded (back-link set). | a List(align/gap)+ChildList payload; a Grid(gap/min)+ChildList payload; NC unknown-prop; SPEC row Notes non-empty and names the Row/Column/List/Grid distinction. |
| **D · drain + flip** | the allowlist == the fork-deferred residue (each with a reason + citation) or empty; the frozen key-list is gone; the gate fails on any non-residue shipped control; SPEC/LLD coherence pass clean. | run the full `catalog` suite + `npm run check`; a temporary synthetic "shipped but uncatalogued" descriptor makes the gate RED (proving end-state bite), then removed. |

---

## 5. Dependency order (the manifest DAG)

`Wave 0 (gate, seeded allowlist)` → each type wave (`A`, `B`, `C`) drains its slice of the allowlist →
`Wave D` reconciles the residue + flips the gate. Waves A/B/C are functionally independent of each other (Wave
B doesn't need Wave A's rows) but SHARE `catalog.json` + `factories.ts` + the `index.test.ts` allowlist, so
they run as **serial `a2ui-builder` dispatches** in Kim's ratified order — never parallel (shared-file
integration). Wave C is skipped entirely if Fork A objects. See the manifest edges: `n_gate → {type leaves} →
n_drain`.
