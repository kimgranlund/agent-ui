# ADR-0169 — The second catalog IS upstream A2UI Basic: `a2ui-basic` registers beside the default on every renderer, schema-derived fleet-factory mappings with a recorded 18-type partition, per-catalog function implementations, and catalog selection threaded end-to-end

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-08-04
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-04 |
> | **Proposed by** | planner (design seat — the GH [#413](https://github.com/kimgranlund/agent-ui/issues/413) intake; Kim's 2026-08-04 ruling quoted in Context; rev.2 re-derived against the fetched upstream machine schema after doc-checker review) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-04, via the [`ratify ADR-0169` utterance](https://github.com/kimgranlund/agent-ui/pull/430#issuecomment-5176193857) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | **On ratification+build:** `a2ui-catalog.spec.md` — the two-tier registration section (SPEC-R6 gains a second FIRST-PARTY catalog registered by the package itself, not only the project seam) · the `value`-mark schema (the ADR-0161 slots section gains the optional `readProp` + closed `marshal` fields, Decision cl.7) · a NEW section for the `a2ui-basic` partition + its coverage gate (the ADR-0087 SPEC-N2 pattern applied to an UPSTREAM-pinned set). `a2ui-live-agent.spec.md`/`.lld.md` — the produce/proxy/worker contracts gain the request-`catalogId` selection + the createSurface authority stamp (Decision cl.3/4). `agent-admin.md` §surface-catalog — the picker's "ONE option today" wording retires (Decision cl.6). `catalog/default/factories.ts:4`'s "no Basic-catalog adapter (SPEC-R8)" header note stays TRUE and gains this ADR's pointer: the default catalog still binds directly; Basic is a SECOND catalog, never an adapter layer inside the default. `icons/src/phosphor/icons.gen.ts` — the ADR-0066 vendored subset regenerates to carry the cl.9 Icon table's glyphs. |
> | **Supersedes / Superseded by** | **Amends** [ADR-0019](./0019-pull-renderer-lld-c8-two-way-binding.md)/[ADR-0161](./0161-catalog-multi-slot-two-way-value-marks.md) — the `ValueSlot` contract gains optional `readProp` + closed `marshal` (cl.7): `prop` keeps naming the WIRE side of the round-trip; the additions (absent ⇒ byte-identical to today) name the DOM property read on commit and a closed commit-value marshal — exactly the widening input.ts's own closing law calls for ("repair `a2ui-catalog` and re-derive, do not improvise"). **Amends** [ADR-0011](./0011-canonical-action-prop-shape.md) — `readActionSpec` (renderer.ts:497) gains a THIRD documented Postel arm, upstream's `{event:{name,context}}` Action shape (cl.10); the canonical outbound `A2uiAction` wire is untouched. **Extends** [ADR-0087](./0087-a2ui-whole-fleet-catalog-scope-policy.md) — the gate-encoded include-or-recorded-exclusion discipline, reapplied to the 18-type UPSTREAM Basic set (cl.9), now down to VARIANT/prop-arm granularity (cl.12). **Relates** [ADR-0097](./0097-a2ui-feed-embedded-asks.md) — its rejection of a second catalog id as a subset/policy VIEW of the default STANDS and is NOT contradicted here (see Context §Non-collision) · [ADR-0029](./0029-a2ui-v1-checks-inline-validation.md) (upstream's `Checkable`/`CheckRule` mixin rides the SHIPPED checks controller unchanged — cl.11a) · [ADR-0053](./0053-a2ui-form-family-catalog-rows.md) (the `ChoicePicker`→`Select` rename history + the F2 control-prop naming law this ADR's `readProp` finally reconciles with Basic's wire naming) · [ADR-0061](./0061-corpus-shared-healer-contract.md) (heal's closed form-only repair list is UNTOUCHED — the cl.4 authority stamp is a producer-layer step, not a heal arm) · [ADR-0034](./0034-a2ui-server-initiated-function-invocation.md) (the shared impl table gains a per-catalog override seam, cl.8) · [ADR-0027](./0027-a2ui-v1-dynamicstring-interpolation.md)/[ADR-0028](./0028-a2ui-v1-function-expression-grammar.md) (the engine that makes `formatString` a one-line impl — the schema's own formatString text describes the SAME `${…}`/named-arg/`\${` grammar) · [ADR-0066](./0066-phosphor-default-pack-buildtime-vendoring.md) (the vendored-subset pipeline the Icon table regenerates through) · [ADR-0119](./0119-code-prose-family-v1-scope.md) (catalog-invisible `@agent-ui/code` — why Basic `Text` does NOT render markdown) · [ADR-0137](./0137-a2ui-agent-producer-toolkit-export.md) (the shell law the proxy/worker threading respects) · **Resolves GH #413** (M-B goals.md box 4). |

## Context

Kim's ruling (2026-08-04, GH #413, verbatim): *"The second catalog IS the upstream A2UI Basic Catalog —
Google's spec's own core component set (v0.9.1 guide, 18 components + client-side functions), implemented
as a real registered catalog (`a2ui-basic`) whose factories map onto existing fleet `ui-*` controls.
Interop-anchored... NOT a subset/policy view of the default (ADR-0097's rejection stands)."*

**Upstream authority (pinned).** Ground truth for every wire property name, enum, required-ness, and
children shape is the fetched MACHINE schema — it supersedes the prose implementation guide wherever the
two differ:

- `/Users/kimba/.claude/jobs/f3d6d8ad/tmp/upstream-basic-catalog.json` — the literal JSON Schema,
  `$id: https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json` (fetched 2026-08-04): 18
  `components`, 14 `functions`, `$defs` `CatalogComponentCommon` (`weight`), `theme`, `anyComponent`/
  `anyFunction`.
- `/Users/kimba/.claude/jobs/f3d6d8ad/tmp/upstream-common-types.json` — the referenced `$defs`:
  `ComponentCommon` (`id` required + optional `accessibility {label, description}`), `ChildList`
  (static id array OR `{componentId, path}` template — structurally OUR ADR-0024 shape), `DataBinding`,
  the `Dynamic*` unions, `FunctionCall` (`{call, args?, returnType?}`), `CheckRule`
  (`{condition: DynamicBoolean, message}`), `Checkable` (`{checks?: CheckRule[]}`), `Action`
  (oneOf `{event:{name, context?}}` | `{functionCall}`).
- `/Users/kimba/.claude/jobs/f3d6d8ad/tmp/upstream-example-{00_interactive-button,00_simple-login-form,05_product-card}.json`
  — three canonical upstream payloads (flat adjacency lists byte-compatible with our protocol's tree
  shape; `version: "v0.9"` envelopes; `createSurface.catalogId` = the canonical URI; Button.action in
  the `{event:{…}}` form) — the cl.1 conformance fixtures.

The prose guide (`upstream-basic-catalog-v0.9.1.md`, same job dir) remains authority for RENDERING
guidance only (§3 leaf-margin spacing, §4 color/contrast).

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
  unavailable here, because Basic's wire names are the interop contract). Basic's `ChoicePicker` commits
  a STRING-LIST where the control commits a string — the same seam, one marshal further.
- **Function impl lookup is global, not per-catalog.** `renderer/functions.ts:170-181` resolves a
  declared catalog function through the ONE shared `catalogFunctions` table (`catalog/functions.ts:87`,
  the `{valid, message?}` dialect) — its own comment names "a future plugin seam" as the extension path.
  Basic's functions return BOOLEANS (`returnType: const "boolean"` in the schema, so they compose under
  `and`/`or`/`not`); the shared table cannot serve both dialects under the same names.
- **The checks seam already exists and matches upstream's mixin byte-for-byte.** `renderer/checks.ts`
  (ADR-0029) evaluates per-component `checks` arrays and its CONDITION wire shape —
  `{condition: {call, args}, message}` — is exactly upstream `CheckRule`'s FunctionCall arm; dispatch
  drives `setCustomValidity` on `UIFormElement`s and `disabled`-gating on Button. And
  `catalog/conformance.ts:34` already RESERVES `checks` ("any node may legally carry `checks` without a
  CATALOG unknown-property failure").
- **The action reader is a single Postel chokepoint.** `renderer/renderer.ts:497` `readActionSpec` —
  canonical `{action, context?, wantResponse?, submit?}` (ADR-0011) plus two documented tolerance arms
  (`name` synonym; bare string). Upstream's `{event:{name, context}}` arm is NOT accepted today.
- **The icon pack is a 32-glyph vendored subset.** `icons/src/phosphor/icons.gen.ts` (ADR-0066
  build-time vendoring) currently carries 32 kebab-case Phosphor glyphs — upstream's Icon `name` is a
  CLOSED 59-identifier enum, so an honest mapping needs the subset regenerated (cl.9 Icon row).

### Non-collision with ADR-0097

ADR-0097 rejected minting a second catalog **id** for what was really a **policy view of the same
default catalog** (the feed sub-catalog): one component authority, one prompt, one corpus — a second id
there would fragment all three for nothing, so the partition was gate-encoded instead. That rejection
**stands and is not touched**. `a2ui-basic` is the opposite case: a **genuinely distinct component set
with its own upstream-specified semantics, props, and wire dialect** (Google's Basic Catalog, pinned to
the fetched machine schema) — `Button.variant` is `default|primary|borderless` (not `solid|soft|ghost`),
`CheckBox` binds a required boolean `value` (not `checked`), `Button.action` is
`{event:{name,context}}` (not ADR-0011's `{action,…}`). No filter over the default catalog can express
that dialect; a second catalog document is the ONLY faithful shape, and interop with upstream-conformant
producers/streams is the whole point. A future reader seeing "second catalog id" should read THIS
section, not flag a contradiction.

## Decision

### 1 · Package home — `src/catalog/a2ui-basic/`, mirroring `default/`'s shape

New files under `packages/agent-ui/a2ui/src/catalog/a2ui-basic/`:

| File | Contract |
|---|---|
| `catalog.json` | `{ "catalogId": "a2ui-basic", "protocolVersion": "v1.0", "components": { …14 included types, cl.9… }, "functions": { …13 included functions, cl.11, all `"callableFrom": "clientOnly"`… } }` — validated by the same `loadCatalog` gate at import. Every included type ALSO declares the two schema-wide common props (cl.9a): `weight` (number) and `accessibility` (object). |
| `index.ts` | `export const a2uiBasicCatalog: Catalog = loadCatalog(catalogDoc)` (the `default/index.ts` twin) + `export const A2UI_BASIC_CANONICAL_URI = 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json'` and `export const a2uiBasicCatalogCanonical: Catalog = loadCatalog({...catalogDoc, catalogId: A2UI_BASIC_CANONICAL_URI})` (cl.13 — the inbound alias entry; same components/functions bytes, only the id differs). Header comment records source URI + fetch date + this ADR (cl.13 provenance). |
| `factories.ts` | `export const a2uiBasicFactories: Record<string, WidgetFactory>` — one factory per declared type (cl.9); REUSED default factories are imported from `../default/factories.ts` and wrapped by `withBasicCommon` (cl.9a); the `@agent-ui/components` barrel import already self-defines every tag |
| `functions.ts` | `export const a2uiBasicFunctions: Record<string, (args: Record<string, unknown>) => unknown>` — the Basic-dialect pure impls (cl.11); zero imports beyond platform globals (`Intl` is a platform global, not a dependency) |
| `index.test.ts` | the 18-type partition coverage gate (cl.14) |
| `factories.test.ts` | per-factory mapping tests (the `default/factories.test.ts` pattern), incl. the Icon-table resolution gate (cl.9 Icon row) |
| `upstream-fixtures.test.ts` | the three pinned upstream examples validated (`validateA2ui` against `a2uiBasicCatalog`) and rendered — the "interop-anchored" claim made TESTABLE, not asserted. The fixture harness rewrites each message's `version: "v0.9"` envelope field to our pinned `v1.0` (a FRAMING translation, recorded here; every component-tree byte stays verbatim) and exercises `createSurface.catalogId` in BOTH the short-id and canonical-URI forms (cl.13). |

Barrel: `src/catalog/index.ts` adds
`export { a2uiBasicCatalog, a2uiBasicCatalogCanonical, A2UI_BASIC_CANONICAL_URI } from './a2ui-basic/index.ts'` ·
`export { a2uiBasicFactories } from './a2ui-basic/factories.ts'` ·
`export { a2uiBasicFunctions } from './a2ui-basic/functions.ts'`.

### 2 · Registration — BOTH catalogs pre-register in the `Renderer` constructor

`renderer/renderer.ts` constructor, immediately after the existing line `:149`:

```ts
this.#registry.register(defaultCatalog, defaultFactories)
this.#registry.register(a2uiBasicCatalog, a2uiBasicFactories, a2uiBasicFunctions)          // ADR-0169
this.#registry.register(a2uiBasicCatalogCanonical, a2uiBasicFactories, a2uiBasicFunctions) // cl.13 inbound alias
```

Every `createRenderer()` host — `surface-host.ts:68`, `a2ui-live`, `ask-registry`, `component-preview`,
the gallery pages — becomes Basic-capable with ZERO call-site edits, and `supportedCatalogIds()`
advertises the short id + the canonical URI everywhere. This is the "always both available" requirement
made structural: a wire line stamped with either Basic id resolves on ANY renderer in the fleet, never
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
seam — no second threading path. The `/chat` prose branch is untouched (no catalog involved). The
producer path always keys the SHORT id (`a2ui-basic` — cl.13); the canonical-URI alias is a
renderer-inbound affordance only.

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
with zero further edits — the seam was built for exactly this. The picker offers the SHORT id only (the
canonical-URI alias is never a picker option — cl.13).

### 7 · The `ValueSlot` widening — `readProp` + closed `marshal` (amends ADR-0019/0161)

`catalog/catalog.ts`:

```ts
export interface ValueSlot {
  prop: string      // the WIRE side: the A2UI node prop carrying the {path} bind (writeback target) — unchanged
  event: string     // the commit event — unchanged
  readProp?: string // ADR-0169: the DOM property read off the control on commit; absent ⇒ prop (byte-identical)
  marshal?: 'singletonStringList' // ADR-0169: closed commit-value marshal; absent ⇒ raw (byte-identical)
}
```

`renderer/input.ts` — the commit read becomes:

```ts
const raw = (el as Record<string, unknown>)[slot.readProp ?? slot.prop]
const committed = slot.marshal === 'singletonStringList' ? (raw === '' || raw == null ? [] : [String(raw)]) : raw
```

(the binding lookup, `scopedPointer` writeback, per-slot listeners, and teardown are all untouched —
they key off `slot.prop`, the wire side, as before). `marshal` is a CLOSED literal enum so
`catalog.json` stays plain JSON — never a function; widening the enum is a future amendment to this
clause, not an ad-hoc addition. `catalog.ts`'s `isValueSlot`/`validateValueMark` additionally accept the
two optional fields (reject a non-string `readProp` / a value outside the `marshal` enum). Every
existing slot omits both ⇒ every existing catalog and factory behaves byte-identically. Consumers this
wave: `CheckBox` (`readProp`) and `ChoicePicker` (`marshal`) — cl.9b table. Data→control direction needs
no widening — it already routes through each bespoke factory's `applyProp`.

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
vs Basic's schema-pinned booleans) can share names without colliding. Upstream `FunctionCall` carries an
extra `returnType` field — `evaluate()` reads only `call`/`args`, so it is tolerated by construction
(recorded, not accidental). `renderer/call-function.ts` is unaffected: every Basic function is
`clientOnly`, so the server-invoke path never reaches them.

### 9 · The 18-type partition (the ADR-0087 discipline, machine-schema-derived)

**Provenance:** every wire name, enum, and required-ness cell below is read from the pinned
`upstream-basic-catalog.json` / `upstream-common-types.json` (2026-08-04) — the rev.1 `⚑` inferred-name
markers are CLOSED, all five confirmed verbatim (`Text.text`, `Image.url`, `TextField.label`,
`CheckBox.label`, `Button.child`/`Card.child`).

#### 9a · Schema-wide common props — the `withBasicCommon` factory decorator

Upstream composes EVERY component from `ComponentCommon` (+ `CatalogComponentCommon`): optional
`accessibility {label?, description?}` and optional `weight` (flex-grow, meaningful only under
Row/Column). Neither is a RESERVED key in our conformance, so every included type DECLARES both in
`catalog.json` (`weight`: number; `accessibility`: object), and one shared decorator in
`a2ui-basic/factories.ts` applies them uniformly:

```ts
function withBasicCommon(base: WidgetFactory): WidgetFactory {
  return {
    ...base,
    applyProp: (el, prop, value) => {
      if (prop === 'weight') { el.style.flexGrow = value == null ? '' : String(value); return }
      if (prop === 'accessibility') {
        const a = (value ?? {}) as { label?: unknown; description?: unknown }
        if (typeof a.label === 'string') el.setAttribute('aria-label', a.label)
        if (typeof a.description === 'string') el.setAttribute('aria-description', a.description)
        return
      }
      base.applyProp(el, prop, value)
    },
  }
}
```

Every factory in `a2uiBasicFactories` (reused or bespoke) is wrapped. The host `aria-label`/
`aria-description` attributes are CONSUMER-side platform usage — the fleet's "ARIA via
`ElementInternals`, never host attributes" law governs what a COMPONENT sets on itself, and AOM
precedence (content attribute wins over internals default) is the correct authority order for an
agent-authored explicit label. Recorded degrade: a `DataBinding`/function nested INSIDE the
`accessibility` object is not resolved v1 (our binding resolution operates on top-level prop values);
literal strings only — risk row R7.

**Required-ness (global note):** the schema marks per-type required props (® in the table below). Our
`PropDef` grammar and conformance have NO required-prop mechanism — v1 is deliberately PERMISSIVE-IN (a
non-conformant inbound tree missing a required prop renders with defaults rather than erroring), and our
own producer may under-emit required props without a validator failure (an interop-OUT gap). A
`PropDef.required` marker + conformance enforcement is a named follow-up, not this wave.

#### 9b · The mapping table

"REUSE x" = import that default factory and wrap with `withBasicCommon`; "bespoke" = new factory in
`a2ui-basic/factories.ts` per the shape note (also wrapped).

| # | Upstream type | Verdict | Target | Declared props (schema-verified; ® = upstream-required) | Children | Two-way `value` mark | Factory shape |
|---|---|---|---|---|---|---|---|
| 1 | `Text` | INCLUDE | `ui-text` | `text`® (DynamicString), `variant` (`h1\|h2\|h3\|h4\|h5\|caption\|body`, default `body`) | — | — | REUSE `textFactory` (the wire enum is byte-identical to the default catalog's; `TEXT_VARIANT_TABLE` fan-out applies as-is). Markdown is NOT parsed: `ui-markdown` lives in `@agent-ui/code`, catalog-invisible by construction (ADR-0119) — raw text is the guide's own sanctioned fallback, and the schema's `text` description itself steers toward dedicated components over markdown. |
| 2 | `Image` | INCLUDE | `<img>` (sanctioned non-`ui-*` primitive — the `Option`/`MenuItem` SPEC-R3 AC1 precedent) | `url`® (DynamicString, `format: 'safe-href'` — the `Text.href` validator arm), `description` (DynamicString — a11y alt text), `fit` (`contain\|cover\|fill\|none\|scaleDown`, default `fill`), `variant` (`icon\|avatar\|smallFeature\|mediumFeature\|largeFeature\|header`, default `mediumFeature`) | — | — | bespoke: `url`→`src` attribute; `description`→`alt` attribute; `fit`→`el.style.objectFit` through the literal map `{scaleDown→'scale-down', else pass-through}`; `variant`→ the inline-style dims table below. No `ui-image` control exists (verified: `default/index.ts:17`); a future `ui-image` control retires this primitive by a follow-up row edit. |
| 3 | `Icon` | INCLUDE (string + binding arms) | `ui-icon` | `name`® — schema `oneOf`: CLOSED 59-identifier enum \| `{svgPath}` object \| DataBinding. Declared as a bindable string with the 59-value enum; the `{svgPath}` arm is EXCLUDED (exclusion table E5) | — | — | bespoke: `name` → `ICON_NAME_TABLE[name]` → `el.glyph` (the literal 59-row table below); an unmapped/unknown value degrades to `ui-icon`'s own missing-glyph behavior. Requires the ADR-0066 vendored phosphor subset REGENERATED to carry the table's glyphs (`icons.gen.ts` holds 32 today); `factories.test.ts` gates every table value against the registered pack at build — an entry the pipeline cannot supply falls back to the row's recorded fallback and joins `ICON_NAME_GAPS`. |
| 4 | `Video` | **EXCLUDE** | — | (schema: `url`®) | — | — | exclusion table E1 |
| 5 | `AudioPlayer` | **EXCLUDE** | — | (schema: `url`®, `description`) | — | — | exclusion table E2 |
| 6 | `Row` | INCLUDE | `ui-row` | `justify` (`start\|center\|end\|spaceBetween\|spaceAround\|spaceEvenly\|stretch`, default `start`), `align` (`start\|center\|end\|stretch`, default `stretch`) | `ChildList`® (upstream `ChildList` = static id array OR `{componentId, path}` template — structurally our ADR-0024 shape, handled by the generic tree walk) | — | bespoke: `justify` through the literal map `{spaceBetween→between, spaceAround→around, spaceEvenly→evenly, stretch→start, else 1:1}` (fleet tokens verified `container.ts:52`; `justify-content: stretch` behaves as `flex-start` in flexbox, so `stretch→start` is behavior-identical, not a guess); `align` 1:1 (fleet union `container.ts:50` covers all four). |
| 7 | `Column` | INCLUDE | `ui-column` | same as Row (schema enums identical) | `ChildList`® | — | same bespoke shape as Row (one shared helper). |
| 8 | `List` | INCLUDE | `ui-list` | `direction` (`vertical\|horizontal`, default `vertical`), `align` (`start\|center\|end\|stretch`, default `stretch`) | `ChildList`® | — | bespoke: `direction:'horizontal'` ⇒ `el.style.flexDirection='row'; el.style.overflowX='auto'`; `'vertical'`/absent ⇒ clear both (the control's own column CSS governs); `align` is a 1:1 accessor (`ui-list` flexProps). `role=list` semantics ride the control (ADR-0016 cl.3). Risk row R3. |
| 9 | `Card` | INCLUDE | `ui-card` | *(none beyond common)* | `child`® (single ComponentId — confirmed by schema `required: [component, child]`) | — | REUSE `cardFactory` (wrapped). |
| 10 | `Tabs` | **DEFER** | — | (schema, now KNOWN: `tabs`® — array of `{title®: DynamicString, child®: ComponentId}`, `minItems: 1`) | — | — | exclusion table E3 |
| 11 | `Divider` | INCLUDE | `div[role=separator]` (sanctioned primitive) | `axis` (`horizontal\|vertical`, default `horizontal`) | — | — | bespoke: `create()` builds `div` + `role=separator`; `axis`→`aria-orientation` attribute + inline hairline styles — horizontal: `blockSize:'1px'; inlineSize:'100%'`; vertical: `inlineSize:'1px'; alignSelf:'stretch'`; both: `backgroundColor:'var(--md-sys-color-outline-variant)'`. |
| 12 | `Modal` | **DEFER** | — | (schema, now KNOWN: `trigger`® + `content`® — BOTH ComponentId references, `required: [component, trigger, content]`) | — | — | exclusion table E4 |
| 13 | `Button` | INCLUDE | `ui-button` | `variant` (`default\|primary\|borderless`, default `default`), `action`® (upstream `Action` — cl.10) | `child`® (single ComponentId — schema `required: [component, child, action]`; the schema's own prose: label rides a `Text` child) | — | bespoke: `variant` through the literal map `{primary→solid, default→soft, borderless→ghost}` set on `el.variant`; `action` never routes through `applyProp` (the action controller owns it, cl.10); no `label` prop (the child IS the content, appended by the generic tree walk into the host-as-grid light DOM, button ADR-0006). Carries `Checkable` (cl.11a — ADR-0029's Button `disabled`-gating arm applies as shipped). |
| 14 | `TextField` | INCLUDE | `ui-text-field` | `label`® (DynamicString), `value` (DynamicString — NOT upstream-required), `variant` (`shortText\|longText\|number\|obscured`, default `shortText`), `validationRegexp` (string — DECLARED but v1-inert, recorded: no fleet pattern-validation prop; folding it into the ADR-0029 checks controller as a synthesized regex rule is the named follow-up, the `Attachment.href` declared-then-lands precedent) | — | `{ prop: 'value', event: 'change' }` | bespoke: `label`→`el.label` (real visible-label accessor); `variant` through the literal map `{shortText→'text', number→'number', obscured→'password', longText→'text'}` set on `el.type` (fleet enum verified `catalog.json:45`); `longText` DEGRADES to single-line — risk row R4. Carries `Checkable` (setCustomValidity arm). |
| 15 | `CheckBox` | INCLUDE | `ui-checkbox` | `label`® (DynamicString), `value`® (DynamicBoolean) | — | `{ prop: 'value', event: 'change', readProp: 'checked' }` — the first `readProp` consumer (cl.7) | bespoke: `label`→`textContent` (the `indicatorFactory` non-identity shape); `value`→`el.checked` (`mapsTo: 'checked'`); every other prop `setProp`. Commit: input.ts reads `el.checked` and writes it back to the `value` bind's path — Basic's boolean round-trip, honest. Carries `Checkable`. |
| 16 | `ChoicePicker` | **PARTIAL INCLUDE** (host-ruled 2026-08-04) | `ui-select` | `label` (DynamicString → `aria-label`, the Slider discipline), `variant` — declared with the NARROWED enum `['mutuallyExclusive']` (the schema's default; the gate encoding of the excluded `multipleSelection` variant, exclusion table E6), `options`® (array of `{label®, value®}`), `value`® (DynamicStringList), `displayStyle` (`checkbox\|chips`, default `checkbox` — BOTH render as the dropdown, the guide's own "dropdown wrapper preferred"; `chips` presentation degrades, recorded), `filterable` (boolean — declared, v1-inert, recorded) | — (options are a PROP, not children — no catalog children key, so factory-synthesized rows never meet the reconciler) | `{ prop: 'value', event: 'select', marshal: 'singletonStringList' }` — the first `marshal` consumer (cl.7) | bespoke: `options` apply reconciles control-owned `div[role=option]` children (value attr + label text — the `Option` primitive shape; `ui-select` adopts them via its TKT-0026 MutationObserver); `value` apply marshals array→string (`el.value = arr[0] ?? ''`); commit marshals string→singleton array (cl.7). |
| 17 | `Slider` | INCLUDE | `ui-slider` | `label` (DynamicString → `aria-label` host attribute — `ui-slider` has NO label accessor; a11y name preserved, VISIBLE label degrades, recorded R6), `min` (number, default 0), `max`® (number — upstream-required, no default), `value`® (DynamicNumber) | — | `{ prop: 'value', event: 'change' }` | bespoke thin wrapper over the default `sliderFactory` mapping (`value`/`min`/`max` are 1:1 reflecting accessors; the verified blur/commit `change` contract stands) + the `label`→`aria-label` arm. Carries `Checkable`. |
| 18 | `DateTimeInput` | INCLUDE | `ui-text-field` | `value`® (DynamicString, ISO 8601), `enableDate` (boolean, default false), `enableTime` (boolean, default false), `min`/`max` (DynamicString, ISO 8601 — map 1:1 onto `ui-text-field`'s string `min`/`max` accessors, `catalog.json:49-50`), `label` (DynamicString → `el.label`) | — | `{ prop: 'value', event: 'change' }` | bespoke: the two flags land as `data-enable-date`/`data-enable-time` attributes on apply (order-independent), each apply recomputing `el.type` from the pair via the literal table `{(T,F)→'date', (F,T)→'time', (T,T)→'date', (F,F)→'date'}` (fleet `type` enum has `date`/`time`, no combined form — the `(T,T)` arm DEGRADES to date-only, risk row R5). Carries `Checkable`. |

Score: **14 of 18 types INCLUDE** (one at variant granularity) · 4 types + 1 variant + 2 prop-arms
recorded EXCLUDE/DEFER (cl.12) — every row reasoned, none silent.

`Image` variant → inline-style literal table (dims are the guide's §1 suggestions; an explicit `fit`
wins over a variant's `objectFit` — apply-order-independent, both arms re-assert, the `Text.href` precedent):

| variant | inline styles set by `applyProp` |
|---|---|
| `icon` | `inlineSize:'24px'; blockSize:'24px'` |
| `avatar` | `inlineSize:'40px'; blockSize:'40px'; borderRadius:'50%'; objectFit:'cover'` |
| `smallFeature` | `inlineSize:'100px'; blockSize:'100px'` |
| `mediumFeature` *(default)* | `inlineSize:'100%'; maxInlineSize:'300px'` |
| `largeFeature` | `inlineSize:'100%'; maxBlockSize:'400px'` |
| `header` | `inlineSize:'100%'; blockSize:'200px'; objectFit:'cover'` |

`Icon` — `ICON_NAME_TABLE` (all 59 schema-enum identifiers → phosphor glyph names; `(have)` = already in
`icons.gen.ts`'s 32, everything else joins the ADR-0066 regeneration; `(verify)` = the pipeline confirms
the glyph exists in Phosphor or applies the stated fallback and records the gap):

| upstream → glyph | upstream → glyph | upstream → glyph | upstream → glyph |
|---|---|---|---|
| accountCircle → user-circle | add → plus (have) | arrowBack → arrow-left | arrowForward → arrow-right (have) |
| attachFile → paperclip | calendarToday → calendar-blank (have) | call → phone | camera → camera |
| check → check (have) | close → x (have) | delete → trash | download → download-simple |
| edit → pencil-simple | event → calendar-check | error → x-circle (have) | fastForward → fast-forward |
| favorite → heart | favoriteOff → heart-break (verify; fallback heart) | folder → folder | help → question |
| home → house | info → info | locationOn → map-pin | lock → lock-simple |
| lockOpen → lock-simple-open | mail → envelope-simple | menu → list (have) | moreVert → dots-three-vertical |
| moreHoriz → dots-three (have) | notificationsOff → bell-slash | notifications → bell | pause → pause |
| payment → credit-card | person → user (have) | phone → phone | photo → image |
| play → play | print → printer | refresh → arrow-clockwise | rewind → rewind |
| search → magnifying-glass (have) | send → paper-plane-right | settings → gear | share → share-network |
| shoppingCart → shopping-cart | skipNext → skip-forward | skipPrevious → skip-back | star → star |
| starHalf → star-half | starOff → star (approximation, recorded — no slashed star in Phosphor core; verify) | stop → stop | upload → upload-simple |
| visibility → eye (have) | visibilityOff → eye-slash (have) | volumeDown → speaker-low | volumeMute → speaker-slash |
| volumeOff → speaker-none (verify; fallback speaker-slash) | volumeUp → speaker-high | warning → warning (have) | |

No factory in `a2ui-basic` carries `submitGate` — upstream Basic has no FormProvider concept; the
`Button.action` dispatch is the commit vehicle (`collectContext` reads committed two-way binds off the
data model as today).

### 10 · The upstream `Action` shape — a third Postel arm at the one chokepoint (amends ADR-0011)

Upstream `Action` (common_types.json) is `oneOf`:
`{event: {name®, context?}}` (server dispatch) | `{functionCall: FunctionCall}` (client-side execution).
Our canonical ADR-0011 shape is `{action, context?, wantResponse?, submit?}` — so rev.1's "PropDef
copied verbatim" was WRONG and is retracted. Ruling:

- `a2ui-basic/catalog.json` declares `Button.action` with the UPSTREAM object schema (the `event` arm).
- `readActionSpec` (`renderer/renderer.ts:497`) — the single wire-read chokepoint — gains a THIRD
  documented tolerance arm: an object with `event` normalizes as
  `{name: event.name, context: event.context}` (no `wantResponse`/`submit` — upstream has neither; both
  stay `undefined`, preserving the ADR-0088 §3 distinction). The canonical `{action,…}` shape and the
  two existing arms are byte-untouched; the outbound `A2uiAction` wire message is unchanged. Verified
  live in the pinned `upstream-example-00_interactive-button.json` (`action: {event: {name:
  "button_clicked", context: {}}}`).
- The `{functionCall}` arm is EXCLUDED v1 (exclusion table E7) — it is the same missing surface as
  `openUrl` (cl.11's one excluded function, which upstream invokes precisely through this arm): our
  renderer has NO client-side action-execution path (actions route to the producer, ADR-0011/0031), and
  a side-effecting call has no safe home in the reactive binding-eval layer. One coherent exclusion
  family — "client-executed actions" — with one named follow-up seam. A payload using the arm fails the
  declared `event`-arm object schema at conformance: loud, never silently inert.

### 11 · The client-side functions table (14 upstream functions across 13 rows, schema `functions` block)

All included functions are declared `clientOnly` in `a2ui-basic/catalog.json` and implemented in
`a2ui-basic/functions.ts`, registered per-catalog (cl.8) so their BOOLEAN dialect (schema-pinned:
`returnType: const "boolean"` on every validator) never collides with the shared table's
`{valid, message?}` dialect under the same names.

| # | Function | Ruling | Implementation note (args per schema) |
|---|---|---|---|
| 1 | `formatString` | needs-a-small-addition | The impl is literally `(args) => args.value` — the heavy lifting ALREADY EXISTS: `renderer/functions.ts` `evaluate()` resolves every arg through `resolveValue` (`:104-108`), which routes a template string through `interpolate` (`:79-80`, ADR-0027) whose `${…}` / named-arg `fn(argName: value)` / escaped `\${` grammar (`fn-expr.ts`, ADR-0028) matches the schema's own formatString description verbatim (upstream-basic-catalog.json:965). Builder verifies the escape ride-through with a test. |
| 2 | `required` | needs-a-small-addition | args `{value®}`. Basic-dialect BOOLEAN: `true` iff not `null`/`undefined`/`''`/empty array (the empty-array arm is NEW vs `catalog/functions.ts:35`, whose `{valid}` impl otherwise carries the logic to adapt). |
| 3 | `regex` | needs-a-small-addition | args `{value®, pattern®}`. boolean dialect of `catalog/functions.ts:60` (`new RegExp(pattern).test(value)`; malformed pattern ⇒ `false`, never a throw). |
| 4 | `length` | needs-a-small-addition | args `{value®, min?, max?}` (schema: at least one of min/max). String length range check ⇒ boolean. |
| 5 | `numeric` | needs-a-small-addition | args `{value®, min?, max?}` (at least one bound). `Number(value)`; NaN ⇒ `false`; else range check. |
| 6 | `email` | needs-a-small-addition | args `{value®}`. boolean dialect; the regex is byte-identical to `catalog/functions.ts:50`'s (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`). |
| 7 | `formatNumber` | needs-a-small-addition | args `{value®, decimals?, grouping?}`. `Intl.NumberFormat` (platform global, zero-dep): `decimals` ⇒ both min/max fraction digits; `useGrouping: grouping !== false`. |
| 8 | `formatCurrency` | needs-a-small-addition | args `{value®, currency®, decimals?, grouping?}`. `Intl.NumberFormat` `{style:'currency', currency}`; invalid code ⇒ `String(value)` (never a throw — the evaluator's fault-isolation posture). |
| 9 | `formatDate` | needs-a-small-addition | args `{value®, format®}`. Zero-dep implementation of the schema's OWN closed token reference (upstream-basic-catalog.json:1073): `yy yyyy · M MM MMM MMMM · d dd E EEEE · h hh (12h, with a) · H HH · mm · ss · a` — numeric tokens by field math, name tokens (`MMM`/`MMMM`/`E`/`EEEE`) and `a` via `Intl.DateTimeFormat` part lookup (platform global); characters outside the token list pass through verbatim. The list is CLOSED — widening it amends this row. |
| 10 | `pluralize` | needs-a-small-addition | args `{value®, other®, zero?, one?, two?, few?, many?}`. `Intl.PluralRules`: resolve the category, return `args[category] ?? args.other`. |
| 11 | `openUrl` | **EXCLUDE v1** | args `{url®}`, `returnType: void`. Side-effecting: our catalog functions run inside reactive binding-eval effects — a side effect there re-fires on every re-evaluation (an open-URL storm) — and upstream invokes it through `Action.functionCall`, the arm cl.10/E7 excludes; one coherent "client-executed actions" family, one named follow-up seam. Any future impl MUST carry upstream's mandatory security constraints verbatim (resolve-then-allowlist `https:`/`http:` only, `noopener,noreferrer`). |
| 12 | `and` | needs-a-small-addition | args `{values®}` (`minItems: 2` per schema). `Array.isArray(values) && values.length >= 2 && values.every((v) => v === true)`. |
| 13 | `or` / `not` | needs-a-small-addition | `or`: args `{values®}` (`minItems: 2`) — `.some((v) => v === true)`; `not`: args `{value®}` — `value !== true` (strict boolean dialect). |

(14 upstream names; row 13 carries the final two — 13 implemented, 1 excluded.)

#### 11a · The `Checkable` mixin — covered BY CONSTRUCTION (ADR-0029, zero new code)

The schema mixes `Checkable {checks?: CheckRule[]}` into Button, TextField, CheckBox, ChoicePicker,
Slider, and DateTimeInput; `CheckRule` is `{condition: DynamicBoolean, message®}`. This maps onto the
SHIPPED ADR-0029 checks controller with **zero new code**:

- `checks` is already a RESERVED renderer-layer key on ANY node (`catalog/conformance.ts:34`) — no
  `catalog.json` declaration needed, no CATALOG failure possible.
- Upstream's `CheckRule` with a FunctionCall condition is BYTE-SHAPED as ADR-0029's CONDITION wire arm
  (`checks.ts:6-9`: `{condition: {call, args}, message}`) — the normalised `Check` type consumes it
  directly; the extra `returnType` key inside the call is tolerated (cl.8).
- Target dispatch covers all six carriers as shipped: TextField/CheckBox/ChoicePicker(→`ui-select`)/
  Slider/DateTimeInput(→`ui-text-field`) are `UIFormElement`s (`setCustomValidity` arm); Button is the
  `disabled`-gating arm (`checks.ts` target-dispatch doc).
- Recorded degrade: a `CheckRule.condition` that is a LITERAL boolean or bare `{path}` (the two
  non-FunctionCall arms of `DynamicBoolean`) is skipped by `readCheck`'s tolerant reader (returns
  `null`, non-fatal). Named follow-up: a small `readCheck` widening normalizing those two arms; not
  this wave.

`TextField.validationRegexp` (the schema's second validation mechanism) is DECLARED but v1-inert (cl.9b
row 14) — its enforcement folds into this same checks controller as a synthesized `regex` rule in the
named follow-up.

### 12 · The exclusion table (recorded, never silent — the ADR-0087 two-arm law, down to variant/prop-arm granularity)

| # | Excluded thing | Granularity | Ruling | Reason (verified) | Named follow-up |
|---|---|---|---|---|---|
| E1 | `Video` | type | EXCLUDE v1 | No fleet control (`controls/` has no video folder; `default/index.ts:17` records the same absence for the default catalog). A bare `<video controls>` primitive was considered and REJECTED: media playback (codec/poster/a11y/captions surface) is a real component contract, not a two-line primitive — Kim's own named exclusion candidate in #413, and M-B excludes new components. | a `ui-video` control earns the row; until then an emitted `Video` fails `CATALOG` at validate (the allowlist working as designed). |
| E2 | `AudioPlayer` | type | EXCLUDE v1 | Same shape as E1 (no `ui-audio*` control; Kim's named candidate). | same as E1. |
| E3 | `Tabs` | type | DEFER | Wire schema now KNOWN (`tabs`®: array of `{title®: DynamicString, child®: ComponentId}`, `minItems: 1` — upstream-basic-catalog.json:406-428). The blocker is ARCHITECTURAL, not schema uncertainty: the items carry COMPONENT REFERENCES inside a prop value — our tree walk resolves references only through the structural `child`/`children` keys, so the referenced panels would never mount, and `ui-tabs` pairs `UITabElement` strip children with `UITabPanelElement` siblings by DOM order (`tabs.ts:72-89`) with no arm for foreign children; a factory can neither mount references nor wrap children (it only `create`s + `applyProp`s). | a reference-typed-prop mount seam (or a `ui-tabs` foreign-child adoption widening) — its own intake. |
| E4 | `Modal` | type | DEFER | Wire schema now KNOWN (`trigger`® + `content`®, BOTH ComponentId references — upstream-basic-catalog.json:447-456; the named-pair concern is confirmed, not speculative). Two architectural gaps: our children grammar is a SINGLE structural key (`catalog.ts:25/127` — `child \| children \| ChildList`), with no named-slot pair; and `ui-modal` is `open`-prop-driven with no trigger-entry-point mechanism (`modal.ts` props: `open`/`persistent` only). | a named-slot children-grammar widening + a trigger-entry mechanism ruling (`ui-popover`'s positional trigger is the nearest in-fleet analogue) — its own intake. |
| E5 | `Icon.name` `{svgPath}` arm | prop-arm | EXCLUDE v1 | Our `PropDef` type grammar cannot express a string-or-object union, and `ui-icon` renders REGISTERED glyphs — it has no arbitrary-path-data API. An emitted `{svgPath}` fails the declared string/enum type check ⇒ CATALOG failure, loud. | a `ui-icon` path-data arm (or a registry-side ephemeral glyph) — follow-up if upstream corpora actually use it. |
| E6 | `ChoicePicker.variant: multipleSelection` | variant (host-ruled 2026-08-04: partial-include permitted, multi-select excluded) | EXCLUDE v1 | No honest existing-control mapping for a multi-select commit (`ui-select`/`ui-combo-box` are single-`value`; M-B excludes new components), and silently rendering a multi-select as single-select would corrupt the `value` array contract. GATE-ENCODED by declaring the `variant` enum as `['mutuallyExclusive']` only (cl.9b row 16): an upstream payload declaring `multipleSelection` fails the enum conformance check — recorded, loud, never wrong-rendered. | a multi-select control or commit shape — its own intake; draining E6 = widening the declared enum + the factory. |
| E7 | `Action` `{functionCall}` arm | prop-arm | EXCLUDE v1 | No client-side action-execution surface exists (actions route to the producer, ADR-0011/0031); the arm is upstream's vehicle for `openUrl` (cl.11 row 11) — one coherent exclusion family. **Excluded at RENDER time, not validate time** (build-verified 2026-08-04): `matchesSchemaType` checks only a PropDef's top-level `type` — deliberately, fleet-wide, so ADR-0011's Postel tolerance arms pass un-narrowed — so a `{functionCall}` action VALIDATES but `readActionSpec` has no arm for it and the click dispatches nothing. Gate-encoding E7 at conformance (a narrow rule keyed on `mapsTo:'action'`, scoped off the other catalogs' Postel arms) is a named follow-up: GH #429. | the client action-function seam (shared with openUrl) + the E7 conformance gate (GH #429). |

### 13 · `catalogId` — local short id, canonical-URI alias inbound

The upstream document's canonical id IS a URI:
`https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json` (schema `catalogId`, line 6; the
pinned interactive-button example stamps exactly this in `createSurface`). Our registry/picker/corpus
keys want a short stable id. Ruling — both, honestly partitioned:

- **`a2ui-basic`** is the LOCAL id: our `catalog.json`'s `catalogId`, the registry's primary key, the
  picker option id, the corpus/retrieval key, and the cl.4 outbound authority stamp on OUR produced
  streams.
- **The canonical URI registers as an INBOUND ALIAS** (cl.1/cl.2 — `a2uiBasicCatalogCanonical`, same
  components/factories/functions bytes, only the id differs): an upstream-authored stream whose
  `createSurface.catalogId` is the canonical URI resolves and renders on any fleet renderer with zero
  translation. The alias is never a picker option and never an outbound stamp.
- The relationship is RECORDED in `a2ui-basic/index.ts`'s header comment (source URI + fetch date +
  this ADR), so nobody reads our document as byte-claiming to BE the upstream file.
- **Ratification note for Kim (a one-constant switch, not a fork):** if OUR produced Basic streams
  should stamp the canonical URI instead of `a2ui-basic` for consumption by non-fleet upstream clients,
  the cl.4 stamp + picker-to-producer threading flips to the URI in one place. The short id is the
  recommended default (internal consumers, corpus keys, and the picker all prefer a stable short key);
  flipping it later is additive, not breaking, because the renderer resolves both ids either way.

### 14 · The partition coverage gate (`a2ui-basic/index.test.ts`)

The ADR-0087 discipline, machine-schema-pinned:

```ts
const UPSTREAM_BASIC_TYPES = ['Text','Image','Icon','Video','AudioPlayer','Row','Column','List','Card',
  'Tabs','Divider','Modal','Button','TextField','CheckBox','ChoicePicker','Slider','DateTimeInput'] as const // 18, schema `components`
const BASIC_TYPE_EXCLUSIONS: Record<string, string> = {
  Video: 'ADR-0169 E1 — no fleet media control', AudioPlayer: 'ADR-0169 E2 — no fleet media control',
  Tabs: 'ADR-0169 E3 — reference-typed prop items; no mount seam',
  Modal: 'ADR-0169 E4 — named-slot children pair; no grammar/mechanism',
}
```

Assertions: (1) every one of the 18 is EITHER a `a2uiBasicCatalog.components` key OR a
`BASIC_TYPE_EXCLUSIONS` key, never both, never neither; (2) the catalog declares NO type outside the 18
(interop purity — `a2ui-basic` never grows fleet-only types; those belong to `agent-ui`); (3) the 13
included function names are declared, the excluded `openUrl` is not, and every declared function is
`clientOnly`; (4) the sub-type-granularity gates hold: `ChoicePicker.variant`'s declared enum is exactly
`['mutuallyExclusive']` (E6) and `Icon.name`'s declared type is the string enum (E5); (5)
`register(a2uiBasicCatalog, a2uiBasicFactories, a2uiBasicFunctions)` succeeds (the registry's own
FACTORY_MISSING gate then enforces factory coverage forever), and the canonical alias registers beside
it. Draining any exclusion row = a follow-up ADR/row edit, exactly the ADR-0087 allowlist law.
`upstream-fixtures.test.ts` (cl.1) is the companion conformance gate: the three pinned upstream payloads
validate and render.

## Consequences

- Every renderer in the fleet resolves the default catalog + both Basic ids;
  `supportedCatalogIds()` grows accordingly — tests pinning the singleton list update in this wave.
- A Basic turn composes its inventory/prompt from `a2uiBasicCatalog`, validates against it, and ships
  wire lines stamped `catalogId:"a2ui-basic"` (the cl.4 authority stamp) — an invalid/unknown request
  `catalogId` silently degrades to the default catalog end-to-end (`sanitizeCatalog` client-side,
  `selectCatalog` server-side), never a 500, never a mixed catalog+prompt.
- Basic turns retrieve zero corpus exemplars until a Basic shard is seeded (named follow-up) — accepted:
  no exemplars beats wrong-dialect exemplars.
- The ADR-0066 phosphor vendored subset regenerates (32 → ~85 glyphs, the cl.9 Icon table) — a
  build-time pipeline run, no new runtime dependency; bundle grows by the added path data only.
- Risks, recorded: **R1** `Image`/`Divider` put presentation in factory inline styles (a first — the
  primitives have no control CSS to lean on; a future `ui-image` control retires R1). **R2** three Icon
  table entries are marked `(verify)` — the regeneration pipeline confirms or applies the recorded
  fallback + gap entry; `starOff` is a recorded approximation either way. **R3** `List` horizontal mode
  leans on inline flex overrides of `ui-list`'s column CSS. **R4** `TextField.variant:'longText'`
  degrades to single-line. **R5** `DateTimeInput` with both flags degrades to date-only. **R6**
  `Slider.label`/`ChoicePicker.label` are a11y-only (`aria-label`) — no visible label control-side.
  **R7** `accessibility` objects honor LITERAL strings only v1 (nested bindings unresolved);
  `validationRegexp`, `filterable`, and `displayStyle:'chips'` are declared-but-degraded v1;
  `CheckRule` literal/`{path}` condition arms are skipped by the tolerant reader. Each is a stated
  dialect degradation with a named follow-up, none silent.
- Required-ness (cl.9a global note): v1 is permissive-in / unenforced-out — a `PropDef.required`
  conformance mechanism is a named follow-up.
- The four DEFER/EXCLUDE types and the E5/E6 arms fail validation loudly (`CATALOG`/enum at the
  emitting node) — upstream streams using them do not render silently wrong, they report. E7 is the
  one exception: excluded at render time only (see its table row — validate-time gate is GH #429),
  so a `{functionCall}` action renders its Button but the click dispatches nothing.
- Non-goals: no Basic corpus shard (follow-up); no markdown in `Text` (ADR-0119 stands); no client
  action-function seam (`openUrl`/`Action.functionCall`, one family, one follow-up); no `theme` support
  (the schema's surface-level `$defs.theme` is a createSurface-adjacent concern outside this catalog
  wave); no change to the default catalog, its factories, or the shared function table's dialect; no
  per-catalog picker UI beyond the second option (the create/pick-from-library affordances stay parked
  per Kim's 2026-07-19 ruling).

## Open forks

- **F1 — CLOSED (rev.2).** The five rev.1 guide-inferred wire names are all CONFIRMED verbatim against
  the pinned machine schema (`upstream-basic-catalog.json`, fetched 2026-08-04): `Text.text`,
  `Image.url`, `TextField.label`, `CheckBox.label`, `Button.child`/`Card.child`.
- **F2 — CLOSED (rev.2).** The Tabs/Modal/ChoicePicker wire schemas are fetched and pinned; Tabs/Modal
  remain DEFERRED on the now-precisely-stated ARCHITECTURAL gaps (E3/E4), and ChoicePicker resolved to
  the host-ruled partial include (cl.9b row 16 / E6).
- **No hard forks remain open.** One soft ratification note rides cl.13 (outbound stamp: short id vs
  canonical URI — recommended default encoded, one-constant switch if Kim prefers the URI).
