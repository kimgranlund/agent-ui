# ADR-0169 — The second catalog IS upstream A2UI Basic: `a2ui-basic` registers beside the default on every renderer, fleet-factory mappings with a recorded 18-type partition, per-catalog function implementations, and catalog selection threaded end-to-end

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-08-04
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-04 |
> | **Proposed by** | planner (design seat — the GH [#413](https://github.com/kimgranlund/agent-ui/issues/413) intake; Kim's 2026-08-04 ruling quoted in Context) |
> | **Ratified by** | *(pending — Kim, at the record PR; `ratify ADR-0169` per ADR-0149)* |
> | **Repairs** | **On ratification+build:** `a2ui-catalog.spec.md` — the two-tier registration section (SPEC-R6 gains a second FIRST-PARTY catalog registered by the package itself, not only the project seam) · the `value`-mark schema (the ADR-0161 slots section gains the optional `readProp` field, Decision cl.7) · a NEW section for the `a2ui-basic` partition + its coverage gate (the ADR-0087 SPEC-N2 pattern applied to an UPSTREAM-pinned set). `a2ui-live-agent.spec.md`/`.lld.md` — the produce/proxy/worker contracts gain the request-`catalogId` selection + the createSurface authority stamp (Decision cl.3/4). `agent-admin.md` §surface-catalog — the picker's "ONE option today" wording retires (Decision cl.6). `catalog/default/factories.ts:4`'s "no Basic-catalog adapter (SPEC-R8)" header note stays TRUE and gains this ADR's pointer: the default catalog still binds directly; Basic is a SECOND catalog, never an adapter layer inside the default. |
> | **Supersedes / Superseded by** | **Amends** [ADR-0019](./0019-pull-renderer-lld-c8-two-way-binding.md)/[ADR-0161](./0161-catalog-multi-slot-two-way-value-marks.md) — the `ValueSlot` contract gains an optional `readProp` (cl.7): `prop` keeps naming the WIRE side of the round-trip, `readProp` (absent ⇒ `prop`, byte-identical to today) names the DOM property read on commit — exactly the widening input.ts's own closing law calls for ("repair `a2ui-catalog` and re-derive, do not improvise"). **Extends** [ADR-0087](./0087-a2ui-whole-fleet-catalog-scope-policy.md) — the gate-encoded include-or-recorded-exclusion discipline, reapplied to the 18-type UPSTREAM Basic set (cl.9); the default catalog's whole-fleet scope is untouched. **Relates** [ADR-0097](./0097-a2ui-feed-embedded-asks.md) — its rejection of a second catalog id as a subset/policy VIEW of the default STANDS and is NOT contradicted here (see Context §Non-collision). · [ADR-0053](./0053-a2ui-form-family-catalog-rows.md) (the `ChoicePicker`→`Select` rename + the F2 control-prop naming law this ADR's `readProp` finally reconciles with Basic's wire naming) · [ADR-0061](./0061-corpus-shared-healer-contract.md) (heal's closed form-only repair list is UNTOUCHED — the cl.4 authority stamp is a producer-layer step, not a heal arm) · [ADR-0034](./0034-a2ui-server-initiated-function-invocation.md) (the shared impl table gains a per-catalog override seam, cl.8) · [ADR-0027](./0027-a2ui-v1-dynamicstring-interpolation.md)/[ADR-0028](./0028-a2ui-v1-function-expression-grammar.md) (the engine that makes `formatString` a one-line impl) · [ADR-0119](./0119-code-prose-family-v1-scope.md) (catalog-invisible `@agent-ui/code` — why Basic `Text` does NOT render markdown) · [ADR-0137](./0137-a2ui-agent-producer-toolkit-export.md) (the shell law the proxy/worker threading respects) · **Resolves GH #413** (M-B goals.md box 4). |

## Context

Kim's ruling (2026-08-04, GH #413, verbatim): *"The second catalog IS the upstream A2UI Basic Catalog —
Google's spec's own core component set (v0.9.1 guide, 18 components + client-side functions), implemented
as a real registered catalog (`a2ui-basic`) whose factories map onto existing fleet `ui-*` controls.
Interop-anchored... NOT a subset/policy view of the default (ADR-0097's rejection stands)."*

The upstream authority for this record is the fetched v0.9.1 Basic Catalog implementation guide
(§1 Components — Text, Image, Icon, Video, AudioPlayer, Row, Column, List, Card, Tabs, Divider, Modal,
Button, TextField, CheckBox, ChoicePicker, Slider, DateTimeInput; §2 Client-Side Functions —
formatString, required, regex, length, numeric, email, formatNumber, formatCurrency, formatDate,
pluralize, openUrl, and, or, not; §3 leaf-margin spacing; §4 color/contrast guidance). Facts not in that
guide are NOT invented here (the ADR-0063 lesson) — they are flagged `⚑` and gated (see §Open forks).

Verified in-tree facts the design stands on:

- **The registry is already multi-catalog and unused for a second catalog.** `a2ui/src/catalog/registry.ts`
  — `Registry.#catalogs = Map<string, CatalogEntry>` keyed by `catalogId`; `register(catalog, factories)`
  (`:39`) throws `RegistryError(FACTORY_MISSING)` for any declared type without a factory (SPEC-R7 AC1) —
  a type EXCLUDED from `a2ui-basic`'s `catalog.json` is simply never declared, so exclusion enforcement is
  free; `supportedCatalogIds()` and `submitGateSelector()` already aggregate across all entries.
- **The renderer already has the dual-registration seam.** `renderer/renderer.ts:129/149` — one
  `Registry` per host, `defaultCatalog`+`defaultFactories` pre-registered in the constructor; a public
  `register()` passthrough (`:195`) exists.
- **The producer is parameterized except one literal.** `agent/system-prompt.ts` derives the component
  (`catalogInventory`, `:177`) and function (`functionsInventory`, `:188`) inventories from the PASSED
  catalog at call time, and interpolates `catalog.catalogId` into the heading (`:298`) — the byte-pinned
  half is only the hand-authored GRAMMAR text. `produce.ts:42-46` takes `deps.catalog`. BUT
  `produce.ts:81` pins `const CATALOG_ID = 'agent-ui'`, consumed at `:282` (`queryOf` → the corpus
  `RetrieveQuery.catalogId`) independent of `deps.catalog` — a live mis-stamp for any second catalog.
  And `prompts/grammar.md:57` — byte-pinned — teaches the wire example `"catalogId":"agent-ui"`, which a
  compliant model will copy onto a Basic turn.
- **Both server call sites load ONE catalog at boot and ignore any request `catalogId`.**
  `tools/agent/dev-proxy-plugin.ts:44/95/198-202` (fs-read of the default `catalog.json`, passed as
  `deps.catalog`); `tools/agent/worker/index.ts:32/63/215` (static import, same). Neither reads a
  `catalogId` off the POST body.
- **The admin seam is stubbed and waiting.** `app/src/controls/agent-admin/agent-admin-schema.ts` —
  `A2UI_CATALOG_OPTIONS` (one entry), `DEFAULT_A2UI_CATALOG_ID = 'agent-ui'`, fail-closed
  `sanitizeCatalog()`, and `AdminSurfaceTurnRequest.catalogId?` whose doc already says "a future
  multi-catalog runner threads it into the producer's catalog choice". `agent-admin.ts:1034` sends the
  sanitized id on every surface request — but `site/lib/admin-live-runner.ts` (`:97-120`) does NOT
  forward it onto the POST body today.
- **The two-way seam's naming law is the one real type-level obstacle.** `renderer/input.ts:39-44`
  (verbatim): *"`slot.prop` names BOTH sides of the round-trip by contract: the A2UI node prop that
  carries the bind (`node[prop]` → the `{path}` writeback target) and the DOM value property read off the
  control on commit (`el[prop]`)"* — and its own closing law: a commit shape this cannot express *"is a
  catalog SPEC gap — repair `a2ui-catalog` and re-derive, do not improvise here."* Basic's `CheckBox`
  binds a boolean **`value`**; `ui-checkbox.value` is already the submitted STRING and the boolean is
  `checked` (the very collision ADR-0053 F2 dodged by renaming in the DEFAULT catalog — a dodge
  unavailable here, because Basic's wire names are the interop contract).
- **Function impl lookup is global, not per-catalog.** `renderer/functions.ts:170-181` resolves a
  declared catalog function through the ONE shared `catalogFunctions` table (`catalog/functions.ts:87`,
  the `{valid, message?}` dialect) — its own comment names "a future plugin seam" as the extension path.
  Basic's validators return BOOLEANS (so they compose under `and`/`or`/`not`); the shared table cannot
  serve both dialects under the same names.

### Non-collision with ADR-0097

ADR-0097 rejected minting a second catalog **id** for what was really a **policy view of the same
default catalog** (the feed sub-catalog): one component authority, one prompt, one corpus — a second id
there would fragment all three for nothing, so the partition was gate-encoded instead. That rejection
**stands and is not touched**. `a2ui-basic` is the opposite case: a **genuinely distinct component set
with its own upstream-specified semantics, props, and wire dialect** (Google's Basic Catalog, pinned to
the v0.9.1 guide) — `Button.variant` is `default|primary|borderless` (not `solid|soft|ghost`),
`CheckBox` binds `value` (not `checked`), `TextField.variant` is `shortText|longText|number|obscured`
(not the fleet `type` enum). No filter over the default catalog can express that dialect; a second
catalog document is the ONLY faithful shape, and interop with upstream-conformant producers/streams is
the whole point. A future reader seeing "second catalog id" should read THIS section, not flag a
contradiction.

## Decision

### 1 · Package home — `src/catalog/a2ui-basic/`, mirroring `default/`'s shape

New files under `packages/agent-ui/a2ui/src/catalog/a2ui-basic/`:

| File | Contract |
|---|---|
| `catalog.json` | `{ "catalogId": "a2ui-basic", "protocolVersion": "v1.0", "components": { …13 included types, cl.9… }, "functions": { …13 included functions, cl.11, all `"callableFrom": "clientOnly"`… } }` — validated by the same `loadCatalog` gate at import |
| `index.ts` | `export const a2uiBasicCatalog: Catalog = loadCatalog(catalogDoc)` (the `default/index.ts` twin) |
| `factories.ts` | `export const a2uiBasicFactories: Record<string, WidgetFactory>` — one factory per declared type (cl.9); REUSED default factories are imported from `../default/factories.ts` (their `@agent-ui/components` barrel import already self-defines every tag) |
| `functions.ts` | `export const a2uiBasicFunctions: Record<string, (args: Record<string, unknown>) => unknown>` — the Basic-dialect pure impls (cl.11); zero imports beyond platform globals (`Intl` is a platform global, not a dependency) |
| `index.test.ts` | the 18-type partition coverage gate (cl.12) |
| `factories.test.ts` | per-factory mapping tests (the `default/factories.test.ts` pattern) |

Barrel: `src/catalog/index.ts` adds
`export { a2uiBasicCatalog } from './a2ui-basic/index.ts'` ·
`export { a2uiBasicFactories } from './a2ui-basic/factories.ts'` ·
`export { a2uiBasicFunctions } from './a2ui-basic/functions.ts'`.

### 2 · Registration — BOTH catalogs pre-register in the `Renderer` constructor

`renderer/renderer.ts` constructor, immediately after the existing line `:149`:

```ts
this.#registry.register(defaultCatalog, defaultFactories)
this.#registry.register(a2uiBasicCatalog, a2uiBasicFactories, a2uiBasicFunctions) // ADR-0169
```

Every `createRenderer()` host — `surface-host.ts:68`, `a2ui-live`, `ask-registry`, `component-preview`,
the gallery pages — becomes Basic-capable with ZERO call-site edits, and `supportedCatalogIds()`
advertises `['agent-ui', 'a2ui-basic']` everywhere. This is the "always both available" requirement made
structural: a wire line stamped `catalogId:"a2ui-basic"` resolves on ANY renderer in the fleet, never
only on a specially-bootstrapped one. Rebuild-the-renderer-per-catalogId is REJECTED (it would serialize
catalog switching through renderer teardown and break mixed-catalog sessions); registering only in the
admin-surface bootstrap is REJECTED (interop is a property of the PACKAGE, not a demo of one page — a
Basic stream replayed on `a2ui-live` or in `component-preview` must render too). Marginal cost is the
`catalog.json` bytes + one small factories/functions module — the controls themselves are already in
every bundle via `defaultFactories`. The `register()` public seam for project catalogs is unchanged
(same two-tier law, SPEC-R6/N1). Renderer/registry tests that assert one supported id update in the same
change.

### 3 · Server-side selection — both hosts hold BOTH catalogs, keyed by the request's `catalogId`

One shared fail-closed helper in `tools/agent/chat-validation.ts` (the GH #108 anti-fork home — both
transports import it, zero deps; generic so no `Catalog` import is needed):

```ts
/** ADR-0169 — fail-closed catalog selection: a non-string/unknown id degrades to the fallback,
 *  never a 400/500 and never a mixed catalog+prompt (the sanitizeCatalog discipline, server-side). */
export function selectCatalog<C>(catalogs: ReadonlyMap<string, C>, value: unknown, fallback: C): C {
  return (typeof value === 'string' ? catalogs.get(value) : undefined) ?? fallback
}
```

**`dev-proxy-plugin.ts`:** add `const BASIC_CATALOG_PATH =
`${ROOT}/packages/agent-ui/a2ui/src/catalog/a2ui-basic/catalog.json``; in `configureServer` load both
(`loadCatalog` each) into `const catalogs = new Map([[catalog.catalogId, catalog], [basicCatalog.catalogId,
basicCatalog]])`. The produce POST branch (`:168`) destructures an additional `catalogId?: unknown` from
the body and builds `deps` with `catalog: selectCatalog(catalogs, catalogId, catalog)`.

**`worker/index.ts`:** add `import basicCatalogRaw from '../../../src/catalog/a2ui-basic/catalog.json'`,
`const basicCatalog: Catalog = loadCatalog(basicCatalogRaw)`, the same `catalogs` map at module scope;
`handleProduce` (`:169`) destructures `catalogId?: unknown` and builds `deps` via the same
`selectCatalog`.

The selected catalog reaches BOTH the prompt (`buildSystemPrompt(deps.catalog, …)`) and the validator
(`produce()`'s internal `validateA2ui(messages, deps.catalog)`) through the one existing `deps.catalog`
seam — no second threading path. The `/chat` prose branch is untouched (no catalog involved).

### 4 · The `produce.ts` fixes — delete the pinned literal, stamp the authoritative id

1. **Delete `produce.ts:81`** (`const CATALOG_ID = 'agent-ui'`). `queryOf` (`:281-283`) becomes
   catalog-aware — signature `queryOf(input: TurnInput, k: number, catalogId: string)`, called with
   `deps.catalog.catalogId`; the returned `RetrieveQuery.catalogId` now names the REQUEST's catalog.
   Stated consequence: `corpus/retrieve.ts:55` filters strictly on `meta.catalogId`, and no
   `a2ui-basic` exemplar shard exists — Basic turns retrieve ZERO exemplars and `fewShot` degrades to
   `''` (its designed empty arm). That is the honest state: default-dialect exemplars would few-shot the
   WRONG prop vocabulary. Seeding a Basic exemplar shard is a named follow-up, not this wave.
2. **The createSurface authority stamp.** In the round loop, after `heal()` returns `messages` and
   BEFORE `validateA2ui` runs: for every message `m` with a `createSurface` body, set
   `m.createSurface.catalogId = deps.catalog.catalogId` (unconditional overwrite, idempotent). The
   server-selected catalog is authoritative over the model-authored id — the exact SPEC-R12 posture
   `opts.model` already takes over `input.model`. This is NOT a heal arm: ADR-0061's closed, form-only
   repair list is untouched; the stamp is a producer-layer authority step, and it is what keeps the
   byte-pinned `grammar.md:57` example (`"catalogId":"agent-ui"`) harmless on a Basic turn — the wire
   the client renders always carries the id whose catalog validated it.
3. **One conditioned teaching line** in `system-prompt.ts` — appended to the DERIVED inventory half
   (never the byte-pinned grammar), only when `catalog.catalogId !== 'agent-ui'`, directly under the
   `## Available components` heading:
   `Every createSurface this turn MUST carry "catalogId":"a2ui-basic" — the grammar example's "agent-ui" is a different catalog's id.`
   (interpolating `catalog.catalogId`). The condition preserves the standing zero-regression law: the
   default-catalog composition stays byte-identical, so `prompt-equivalence`/`prompt-drift` baselines do
   not move; a new test asserts the line composes for `a2uiBasicCatalog`.

### 5 · Client threading — the runner forwards what the schema already carries

`site/lib/admin-live-runner.ts` — the produce POST body (`:97-120`) gains
`...(req.catalogId !== undefined ? { catalogId: req.catalogId } : {})` (the `effort` absent-⇒-omit-key
precedent; byte-identical body when absent). `agent-admin.ts:1034` already populates
`req.catalogId = sanitizeCatalog(store)` — zero component edits.

### 6 · The admin picker's second entry — host-ruled label, verbatim

`agent-admin-schema.ts`:

```ts
export const A2UI_CATALOG_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'agent-ui', label: 'Default (agent-ui)' },
  { id: 'a2ui-basic', label: 'A2UI Basic (upstream v0.9.1)' },
]
```

`sanitizeCatalog`, the picker build (`agent-admin.ts:567-580`), and persistence all pick the new entry up
with zero further edits — the seam was built for exactly this.

### 7 · The `ValueSlot` widening — `readProp` splits the DOM-read side (amends ADR-0019/0161)

`catalog/catalog.ts`:

```ts
export interface ValueSlot {
  prop: string      // the WIRE side: the A2UI node prop carrying the {path} bind (writeback target) — unchanged
  event: string     // the commit event — unchanged
  readProp?: string // ADR-0169: the DOM property read off the control on commit; absent ⇒ prop (byte-identical)
}
```

`renderer/input.ts` — the single change: the commit read becomes
`el[slot.readProp ?? slot.prop]` (the binding lookup, `scopedPointer` writeback, per-slot listeners, and
teardown are all untouched — they key off `slot.prop`, the wire side, as before).
`catalog.ts`'s `isValueSlot`/`validateValueMark` additionally accept an optional string `readProp`
(reject a non-string). Every existing slot omits the field ⇒ every existing catalog and factory behaves
byte-identically. Exactly one consumer this wave: Basic `CheckBox` (cl.9 table). Data→control direction
needs no widening — it already routes through the factory's bespoke `applyProp`.

### 8 · Per-catalog function implementations (amends the ADR-0034 shared-table seam)

`catalog/types.ts`: `CatalogEntry` gains `functions?: Record<string, (args: Record<string, unknown>) => unknown>`.
`Registry.register` gains an optional third parameter and stores it:

```ts
register(catalog: unknown, factories: Record<string, WidgetFactory>,
         functions?: Record<string, (args: Record<string, unknown>) => unknown>): void
```

`renderer/functions.ts` `evaluateCatalog` — the impl lookup becomes
`const impl = entry.functions?.[name] ?? catalogFunctions[name]` (entry is already in scope from the
existing existence gate). The renderer passthrough `register()` forwards the third argument. Absent
`functions` ⇒ byte-identical behavior (the default catalog registers none and keeps riding the shared
table — ADR-0034's fork-2 contract stands). This is the "future plugin seam" `evaluateCatalog`'s own
comment reserved, landed as per-catalog rather than global-mutation so the two dialects (`{valid,message}`
vs Basic's booleans) can share names without colliding. `renderer/call-function.ts` is unaffected: every
Basic function is `clientOnly`, so the server-invoke path never reaches them.

### 9 · The 18-type partition (the ADR-0087 discipline, upstream-pinned)

**Mapping table — the literal content `catalog.json`/`factories.ts` are built from.** "REUSE x" means
import that exported factory from `../default/factories.ts` verbatim; "bespoke" means a new factory in
`a2ui-basic/factories.ts` per the shape note. `⚑` marks a guide-inferred wire name (see §Open forks —
confirm before `catalog.json` lands; everything else in the row is ruled now).

| # | Upstream type | Verdict | Target | Declared props (Basic wire) | Children | Two-way `value` mark | Factory shape |
|---|---|---|---|---|---|---|---|
| 1 | `Text` | INCLUDE | `ui-text` | `text`⚑ (string, bindable), `variant` (`h1\|h2\|h3\|h4\|h5\|caption\|body`) | — | — | REUSE `textFactory` (the wire enum is byte-identical to the default catalog's; `TEXT_VARIANT_TABLE` fan-out applies as-is). Markdown is NOT parsed: `ui-markdown` lives in `@agent-ui/code`, catalog-invisible by construction (ADR-0119) — the guide's own sanctioned fallback ("gracefully fallback to rendering the raw text") is the ruled v1 behavior. |
| 2 | `Image` | INCLUDE | `<img>` (sanctioned non-`ui-*` primitive — the `Option`/`MenuItem` SPEC-R3 AC1 precedent) | `url`⚑ (string, bindable, `format: 'safe-href'` — the `Text.href` validator arm), `fit` (string), `variant` (`icon\|avatar\|smallFeature\|mediumFeature\|largeFeature\|header`) | — | — | bespoke: `url`→`src` attribute; `fit`→`el.style.objectFit`; `variant`→ the literal inline-style table below. No `ui-image` control exists (verified: `default/index.ts:17` — "no ui-image/ui-video descriptor exists"); a future `ui-image` control supersedes this primitive by a follow-up row edit. |
| 3 | `Icon` | INCLUDE | `ui-icon` | `name` (string, bindable) | — | — | bespoke: camelCase→kebab-case normalization (`accountCircle`→`account-circle`) then `el.glyph = normalized` (the default `iconFactory`'s `name`→`glyph` mapping plus the normalization step). Unresolvable names degrade per `ui-icon`'s own missing-glyph behavior — risk row R2. |
| 4 | `Video` | **EXCLUDE** | — | — | — | — | exclusion table row E1 |
| 5 | `AudioPlayer` | **EXCLUDE** | — | — | — | — | exclusion table row E2 |
| 6 | `Row` | INCLUDE | `ui-row` | `justify` (`start\|center\|end\|spaceBetween`), `align` (`start\|center\|end`) | `ChildList` | — | bespoke: `justify` through the literal map `{start→start, center→center, end→end, spaceBetween→between}` (fleet token verified: `catalog.json:128`); `align` passes 1:1 (fleet union includes all three, `container.ts:50`). |
| 7 | `Column` | INCLUDE | `ui-column` | same as Row | `ChildList` | — | same bespoke shape as Row (one shared helper). |
| 8 | `List` | INCLUDE | `ui-list` | `direction` (`vertical\|horizontal`) | `ChildList` | — | bespoke: `direction:'horizontal'` ⇒ `el.style.flexDirection='row'; el.style.overflowX='auto'`; `'vertical'`/absent ⇒ clear both (the control's own column CSS governs). `role=list` semantics ride the control (ADR-0016 cl.3). Risk row R3. |
| 9 | `Card` | INCLUDE | `ui-card` | *(none v1)* | `child`⚑ (single — the guide: "accepts exactly **one** child") | — | REUSE `cardFactory`. |
| 10 | `Tabs` | **DEFER** | — | — | — | — | exclusion table row E3 |
| 11 | `Divider` | INCLUDE | `div[role=separator]` (sanctioned primitive) | `axis` (`horizontal\|vertical`) | — | — | bespoke: `create()` builds `div` + `role=separator`; `axis`→`aria-orientation` attribute + inline hairline styles — horizontal: `blockSize:'1px'; inlineSize:'100%'`; vertical: `inlineSize:'1px'; alignSelf:'stretch'`; both: `backgroundColor:'var(--md-sys-color-outline-variant)'`. |
| 12 | `Modal` | **DEFER** | — | — | — | — | exclusion table row E4 |
| 13 | `Button` | INCLUDE | `ui-button` | `variant` (`default\|primary\|borderless`), `action` (the default catalog `Button.action` PropDef copied VERBATIM — same object schema, handled by the action controller, never `applyProp`'d) | `child`⚑ (single — the guide: "must render its `child` component inside the button") | — | bespoke: `variant` through the literal map `{primary→solid, default→soft, borderless→ghost}` set on `el.variant`; no `label` prop (the child IS the content, appended by the generic tree walk into the host-as-grid light DOM, button ADR-0006). |
| 14 | `TextField` | INCLUDE | `ui-text-field` | `value` (string, bindable), `label`⚑ (string, bindable), `variant` (`shortText\|longText\|number\|obscured`) | — | `{ prop: 'value', event: 'change' }` | bespoke: `variant` through the literal map `{shortText→'text', number→'number', obscured→'password', longText→'text'}` set on `el.type` (fleet enum verified, `catalog.json:45`); `longText` DEGRADES to single-line — risk row R4 (one factory maps one tag; `ui-textarea` cannot be conditionally created). `value`/`label` are 1:1 accessors. |
| 15 | `CheckBox` | INCLUDE | `ui-checkbox` | `value` (boolean, bindable), `label`⚑ (string) | — | `{ prop: 'value', event: 'change', readProp: 'checked' }` — the FIRST `readProp` consumer (cl.7) | bespoke: `label`→`textContent` (the `indicatorFactory` non-identity shape); `value`→`el.checked` (`mapsTo: 'checked'`); every other prop `setProp`. Commit: input.ts reads `el.checked` and writes it back to the `value` bind's path — Basic's boolean round-trip, honest. |
| 16 | `ChoicePicker` | **DEFER** | — | — | — | — | exclusion table row E5 |
| 17 | `Slider` | INCLUDE | `ui-slider` | `value` (number, bindable), `min` (number), `max` (number) | — | `{ prop: 'value', event: 'change' }` | REUSE `sliderFactory` (all three are 1:1 reflecting accessors; the verified blur/commit `change` contract stands). |
| 18 | `DateTimeInput` | INCLUDE | `ui-text-field` | `value` (string, ISO 8601, bindable), `enableDate` (boolean), `enableTime` (boolean) | — | `{ prop: 'value', event: 'change' }` | bespoke: the two flags land as `data-enable-date`/`data-enable-time` attributes on apply (order-independent), and each apply recomputes `el.type` from the pair via the literal table `{(T,F)→'date', (F,T)→'time', (T,T)→'date', (F,F)→'date'}` (fleet `type` enum has `date`/`time`, no combined form — the `(T,T)` arm DEGRADES to date-only, risk row R5). |

`Image` variant → inline-style literal table (dims are the guide's own suggestions, §1 Image):

| variant | inline styles set by `applyProp` |
|---|---|
| `icon` | `inlineSize:'24px'; blockSize:'24px'` |
| `avatar` | `inlineSize:'40px'; blockSize:'40px'; borderRadius:'50%'; objectFit:'cover'` |
| `smallFeature` | `inlineSize:'100px'; blockSize:'100px'` |
| `mediumFeature` *(default)* | `inlineSize:'100%'; maxInlineSize:'300px'` |
| `largeFeature` | `inlineSize:'100%'; maxBlockSize:'400px'` |
| `header` | `inlineSize:'100%'; blockSize:'200px'; objectFit:'cover'` |

(an explicit `fit` prop wins over a variant's `objectFit` — both arms read/write `el.style.objectFit`,
last-writer-wins is acceptable because `fit` is the specific instruction; the factory applies `variant`
before `fit` when both are present in one apply pass is NOT guaranteed by the renderer, so the `fit` arm
re-asserts on every apply — the `Text.href`/`variant` order-independence precedent.)

No factory in `a2ui-basic` carries `submitGate` — upstream Basic has no FormProvider concept; the
`Button.action` dispatch is the commit vehicle (`collectContext` reads committed two-way binds off the
data model as today).

### 10 · The exclusion table (recorded, never silent — the ADR-0087 two-arm law)

| # | Upstream type | Ruling | Reason (verified) | Named follow-up |
|---|---|---|---|---|
| E1 | `Video` | EXCLUDE v1 | No fleet control (`controls/` has no video folder; `default/index.ts:17` records the same absence for the default catalog). A bare `<video controls>` primitive was considered and REJECTED: media playback (codec/poster/a11y/captions surface) is a real component contract, not a two-line primitive — Kim's own named exclusion candidate in #413. | a `ui-video` control earns the row; until then an emitted `Video` fails `CATALOG` at validate (the allowlist working as designed). |
| E2 | `AudioPlayer` | EXCLUDE v1 | Same shape as E1 (no `ui-audio*` control; Kim's named candidate). | same as E1. |
| E3 | `Tabs` | DEFER | Two verified gaps: (a) `ui-tabs` pairs `UITabElement` strip children with `UITabPanelElement` siblings by DOM order (`tabs.ts:72-89`) — Basic's dialect delivers `titles` + ARBITRARY content children, which the generic tree walk appends unwrapped, so they never enter the panel pairing (all panels render stacked, tab switching inert); a factory cannot wrap children (it only `create`s + `applyProp`s) and factory-side reparenting collides with the reconciler's relocated-survivor handling (the TKT-0031 class). (b) The exact upstream wire schema (is it `titles` + index-aligned `children`, or per-tab objects?) is not in the fetched guide. | EITHER a `ui-tabs` widening (adopt a non-`UITab`/`UITabPanel` child as a panel) OR a renderer child-transform seam — its own intake; plus the upstream-schema confirmation (§Open forks F2). |
| E4 | `Modal` | DEFER | Three verified gaps: (a) our children grammar is a SINGLE structural key (`catalog.ts:25/127` — `child \| children \| ChildList`); Basic Modal needs a named trigger/content PAIR. (b) `ui-modal` is `open`-prop-driven with no trigger-entry-point mechanism (`modal.ts` props: `open`/`persistent` only). (c) The upstream wire keys for the pair are not in the fetched guide. | a children-grammar widening (named child slots) + upstream-schema confirmation (F2); `ui-popover`'s positional trigger convention is the nearest in-fleet analogue if Kim prefers a pragmatic mapping — a fork for the follow-up intake, not silently chosen here. |
| E5 | `ChoicePicker` | DEFER | Three verified gaps: (a) Basic binds an ARRAY of selected strings — no fleet control commits a string-array selection (`ui-select`/`ui-combo-box` are single-`value`; ADR-0053 deliberately renamed the planned ChoicePicker to single-select `Select`); the `ValueSlot` seam has no value-transform to marshal array↔string honestly, and silently dropping multi-select is exactly the dishonest coverage this table exists to prevent. (b) Options arrive as a PROP (the guide filters "option labels"), not as `Option` children — synthesis-from-prop has the same factory-cannot-build-children gap as E3. (c) Exact upstream wire schema (options key/shape, `value` key) not in the fetched guide. | the follow-up intake owns: a multi-select commit shape (control or seam), options-from-prop synthesis, and the schema confirmation (F2). |

Score: 13 of 18 INCLUDE, 5 recorded EXCLUDE/DEFER — every row reasoned, none silent.

### 11 · The client-side functions table (14 upstream functions across 13 rows, guide §2)

All included functions are declared `clientOnly` in `a2ui-basic/catalog.json` and implemented in
`a2ui-basic/functions.ts`, registered per-catalog (cl.8) so their BOOLEAN dialect never collides with the
shared table's `{valid, message?}` dialect under the same names.

| # | Function | Ruling | Implementation note |
|---|---|---|---|
| 1 | `formatString` | needs-a-small-addition | The impl is literally `(args) => args.value` — the heavy lifting ALREADY EXISTS: `renderer/functions.ts` `evaluate()` resolves every arg through `resolveValue` (`:104-108`), which routes a template string through `interpolate` (`:79-80`, ADR-0027) whose `${…}` / `fn(argName: value)` grammar (`fn-expr.ts`, ADR-0028) matches upstream's own `formatString` syntax including escaped `\${` — so by the time the impl runs, `args.value` is the fully interpolated string. Builder verifies the escape ride-through with a test. |
| 2 | `required` | needs-a-small-addition | Basic-dialect BOOLEAN: `true` iff not `null`/`undefined`/`''`/empty array (the empty-array arm is NEW vs `catalog/functions.ts:35`, whose `{valid}` impl otherwise carries the logic to adapt). |
| 3 | `regex` | needs-a-small-addition | boolean dialect of `catalog/functions.ts:60` (`new RegExp(args.pattern).test(args.value)`; malformed pattern ⇒ `false`, never a throw). |
| 4 | `length` | needs-a-small-addition | NEW: string length `>= args.min` (if present) and `<= args.max` (if present) ⇒ boolean. |
| 5 | `numeric` | needs-a-small-addition | NEW: `Number(args.value)`; NaN ⇒ `false`; else range check as `length`. |
| 6 | `email` | needs-a-small-addition | boolean dialect; upstream's suggested regex is byte-identical to `catalog/functions.ts:50`'s (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`). |
| 7 | `formatNumber` | needs-a-small-addition | `Intl.NumberFormat` (platform global, zero-dep): `decimals` ⇒ both min/max fraction digits; `useGrouping: args.grouping !== false`. |
| 8 | `formatCurrency` | needs-a-small-addition | `Intl.NumberFormat` with `{style:'currency', currency: args.currency}`; invalid code ⇒ return `String(args.value)` (never a throw — the evaluator's fault-isolation posture). |
| 9 | `formatDate` | needs-a-small-addition | zero-dep closed TR35 token SUBSET (no date library — the package law): the literal token table `yyyy · yy · MM · M · dd · d · HH · H · mm · m · ss · s`; any other character passes through verbatim. A pattern outside the subset degrades gracefully (unknown tokens emit as-is). The subset is CLOSED — widening it is a follow-up edit to this table, not an ad-hoc addition. |
| 10 | `pluralize` | needs-a-small-addition | `Intl.PluralRules` (platform global): resolve the category for `args.value`, return `args[category] ?? args.other ?? ''`. |
| 11 | `openUrl` | **EXCLUDE v1** | Side-effecting: our catalog functions run inside reactive binding-eval effects (`widget.ts` bound-prop effects) — a side effect there re-fires on every re-evaluation (an open-URL storm), and the renderer has NO client-side action-invocation surface (actions route to the producer, ADR-0011/0031). Declaring it and letting calls emit `FUNCTION` errors is worse than not declaring it (the registry's absence gate reports it cleanly). Follow-up: a client action-function seam; any future impl MUST carry upstream's mandatory security constraints verbatim (resolve-then-allowlist `https:`/`http:` only, `noopener,noreferrer`). |
| 12 | `and` | needs-a-small-addition | `(args) => Array.isArray(args.values) && args.values.every((v) => v === true)`. |
| 13 | `or` / `not` | needs-a-small-addition | `or`: `.some((v) => v === true)` over `args.values`; `not`: `args.value !== true` — strict boolean dialect, matching upstream's "strict boolean negation". |

(14 upstream names; row 13 carries the final two — 13 implemented, 1 excluded.)

### 12 · The partition coverage gate (`a2ui-basic/index.test.ts`)

The ADR-0087 discipline, upstream-pinned instead of fleet-derived:

```ts
const UPSTREAM_BASIC_TYPES = ['Text','Image','Icon','Video','AudioPlayer','Row','Column','List','Card',
  'Tabs','Divider','Modal','Button','TextField','CheckBox','ChoicePicker','Slider','DateTimeInput'] as const // 18, v0.9.1 §1
const BASIC_EXCLUSIONS: Record<string, string> = {
  Video: 'ADR-0169 E1 — no fleet media control', AudioPlayer: 'ADR-0169 E2 — no fleet media control',
  Tabs: 'ADR-0169 E3 — panel-pairing gap + unverified wire schema',
  Modal: 'ADR-0169 E4 — named-slot children grammar gap + unverified wire schema',
  ChoicePicker: 'ADR-0169 E5 — array-valued selection gap + unverified wire schema',
}
```

Assertions: (1) every one of the 18 is EITHER a `a2uiBasicCatalog.components` key OR a
`BASIC_EXCLUSIONS` key, never both, never neither; (2) the catalog declares NO type outside the 18
(interop purity — `a2ui-basic` never grows fleet-only types; those belong to `agent-ui`); (3) the 13
included function names are declared and the excluded `openUrl` is not; (4) `register(a2uiBasicCatalog,
a2uiBasicFactories, a2uiBasicFunctions)` succeeds (the registry's own FACTORY_MISSING gate then enforces factory coverage
forever). Draining an exclusion row = a follow-up ADR/row edit, exactly the ADR-0087 allowlist law.

## Consequences

- Every renderer in the fleet resolves both catalogs; `supportedCatalogIds()` reads
  `['agent-ui','a2ui-basic']` — tests pinning the singleton list update in this wave.
- A Basic turn composes its inventory/prompt from `a2uiBasicCatalog`, validates against it, and ships
  wire lines stamped `catalogId:"a2ui-basic"` (the cl.4 authority stamp) — an invalid/unknown request
  `catalogId` silently degrades to the default catalog end-to-end (`sanitizeCatalog` client-side,
  `selectCatalog` server-side), never a 500, never a mixed catalog+prompt.
- Basic turns retrieve zero corpus exemplars until a Basic shard is seeded (named follow-up) — accepted:
  no exemplars beats wrong-dialect exemplars.
- Risks, recorded: **R1** `Image`/`Divider` put presentation in factory inline styles (a first — the
  primitives have no control CSS to lean on; a future `ui-image` control retires R1). **R2** upstream
  Material icon names may not exist in the installed pack — degrade is `ui-icon`'s own missing-glyph
  behavior; an alias table is a follow-up. **R3** `List` horizontal mode leans on inline flex overrides
  of `ui-list`'s column CSS. **R4** `TextField.variant:'longText'` degrades to single-line. **R5**
  `DateTimeInput` with both flags degrades to date-only. Each is a stated dialect degradation, none
  silent.
- The five DEFER/EXCLUDE rows fail validation loudly (`CATALOG` at the emitting node) — upstream streams
  using them do not render silently wrong, they report.
- Non-goals: no Basic corpus shard (follow-up); no markdown in `Text` (ADR-0119 stands); no
  `openUrl`/action-function seam; no change to the default catalog, its factories, or the shared
  function table's dialect; no per-catalog picker UI beyond the second option (the create/pick-from-library
  affordances stay parked per Kim's 2026-07-19 ruling).

## Open forks (gate the named rows only — everything else builds now)

- **F1 (`⚑` names):** five wire identifiers are guide-INFERRED, not guide-stated: `Text.text`,
  `Image.url`, `TextField.label`, `CheckBox.label`, and the single-child key for `Button`/`Card`
  (`child`). Confirm against the upstream machine schema (or Kim rules the inferred defaults) before
  `catalog.json` lands — ADR-0063's law: never invent an external contract.
- **F2 (deferred trio):** the exact upstream wire schemas for `Tabs`/`Modal`/`ChoicePicker` are needed
  before any of E3/E4/E5 can be drained — fetch-and-pin, own intake.
