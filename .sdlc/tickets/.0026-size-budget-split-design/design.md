# T-0026 Design: load catalog bodies by catalog id, lazily (GH #1811)

Spike output. No source edits. Every gz figure below was measured on main@e3d03679 with the harness in
`measure/` (see section 3); raw output is saved beside it.

## 0. Answer first

- The gate is not red. `npm run size` exits 0. The app row measures 71,231 B gz marginal against
  `APP_MARGINAL_BUDGET = 72,027`: 796 B of headroom (1.1%).
- Catalog-specific code and data is still 14,970 B gz (21%) of that eager bundle, shipped to every
  consumer of the app barrel whether or not it renders a surface of that catalog.
- Recommendation: build one mechanism, a records table with an eager manifest plus a memoized `ensure`,
  and apply it first to the non-default catalogs (a2ui-basic under both ids, the three persona sets).
  Measured eager change: -5,017 B gz (71,231 to 66,214), default path stays synchronous, six test files change.
- The same mechanism applied to the default catalog too measures -14,064 B gz (to 57,167). It is a
  one-record follow-up, but it makes the default path asynchronous (26 test files and 13 non-test callers
  construct a renderer), so it goes to Kim as a ruling, not into the first wave.
- ADR needed: ADR-0241 (next free number; 0240 exists), drafted by its own slice.

## 1. Premise check

The handoff and GH #1811 both describe a red gate with a budget "raised as a stopgap". That is stale.

| Claim in the handoff / issue | State on main@e3d03679 |
|---|---|
| App marginal budget was raised as a stopgap | It was re-based DOWN, 106,559 to 72,027, on 2026-10-05 (`scripts/measure-size.mjs:760-766`) |
| ADR-0197 cl.5 exception "marked final" is the blocker | Closed. The structural fix landed as GH #1814 / PR #1824 (ADR-0233): catalog factories stopped importing the 87-control fleet |
| `npm run size` is red at base | Exit 0; app row 71,231 vs 72,027 (`measure/stubs.out.txt` line 1, the harness reproduces it exactly) |
| The default `catalog.json` is the cause | It is in the eager bundle (3,099 B gz) but was never the dominant cost. The 106,987 figure was the fleet imports (~47 KB gz) |

What still stands, and is the real motivation:

1. ADR-0197 cl.5 closes upward re-bases of this row. The next feature wave has 796 B to land in.
2. Everything a catalog needs (documents, factory tables, per-catalog function impls, persona packages,
   the compose step, the 82-record control registry) is imported statically by `renderer.ts`, so a
   host that renders one catalog pays for all of them. Measured at 14,970 B gz (section 2).

## 2. Current import graph, app entry to `catalog.json`

```
packages/agent-ui/app/src/index.ts:29            export { UISurfaceHostElement } from controls/surface-host/surface-host.ts
  (conversation.ts:103 side-effect-imports surface-host.ts, so index.ts:30 reaches it too)
controls/surface-host/surface-host.ts:71         import { createRenderer } from '@agent-ui/a2ui'      (public barrel only, the deep-import guard at surface-host.ts:24)
  surface-host.ts:172                            this.#host = createRenderer()   inside connected(): one renderer PER host instance
packages/agent-ui/a2ui/src/index.ts:5            export * from './renderer/index.ts'
  renderer/index.ts:5                            export { createRenderer } from './renderer.ts'
renderer/renderer.ts:96-103                      8 static imports (below)
  :96  catalog/default/index.ts:21               import catalogDoc from './catalog.json'            44,070 B raw, 80 types, 5 functions
  :97  catalog/default/factories.ts              defaultFactories (111 KB source; imports no control since ADR-0233)
  :98  catalog/a2ui-basic/index.ts:18            import catalogDoc from './catalog.json'            11,168 B raw, 14 types
       (:29 builds a SECOND Catalog from the same doc under the canonical-URI id, ADR-0169 cl.13)
  :99-100 catalog/a2ui-basic/{factories,functions}.ts
  :101 catalog/compose.ts                        composePersonaCatalogs
  :102 catalog/personas/index.ts                 3 persona packages; each manifest.ts imports its own catalog.json (10-11)
  :103 catalog/controls.ts                       builtinControls: registry.gen.ts (82 lazy thunks) + loader
renderer.ts:224,230,231,237 (constructor)        register(default) · register(a2ui-basic) · register(canonical) · composePersonaCatalogs
```

What rides eager, measured by leave-one-out (replace the body with a stub, re-bundle the app entry,
subtract). Individual rows are not additive because gzip shares a dictionary; the combined rows are the
gate-relevant figures.

| Body | Eager B gz |
|---|---|
| default `catalog.json` | 3,099 |
| a2ui-basic `catalog.json` | 889 |
| 3 persona fragments | 312 |
| all 5 documents together | 4,794 |
| default factories | 1,885 |
| a2ui-basic factories + functions | 2,473 |
| persona packages (indices, factories, croupier checks, manifests) | 1,450 |
| compose.ts | 732 |
| control registry + loader (`controls.ts`) | ~3,406 (P0 -14,970 minus the C stub -11,564, section 4) |
| everything catalog-specific, removed together (row P0) | 14,970 |

Two facts the design leans on, both measured:

- The a2ui `.` barrel's `export * from './catalog/index.ts'` does not hold the bodies in the eager
  closure. With only `renderer.ts` edited to drop its imports, the surviving catalog modules in the app
  eager closure are `naming, catalog, variant, functions, conformance, registry` (`loadCatalog`, the name check, the
  variant resolver, the function table, conformance and the registry; no bodies). `surface-host.ts` keeps importing from the public barrel; no subpath is needed.
- The control registry is part of the catalog cost. `builtinControls` is imported by the same file, so
  moving the default body behind a record carries `registry.gen.ts` with it (shared lazy chunk, 2,648 B gz).

## 3. Method and independence proof

`measure/lib.mjs` copies the app leg of `scripts/measure-size.mjs`: Rolldown, ESM, minified, eager set =
entry chunks plus their transitive static `imports`, gzip level 9, marginal = eager gz minus the gz of the
components `.` barrel. It adds one thing, a `load` hook that swaps a module's source, so a body can be
removed or a renderer variant tried with no repo edit.

`measure/stubs.mjs` row E0 prints 71231, the number `npm run size` prints for the app row on this tree
(`measure/size-app-rows.out.txt`: marginal 71231 B gz, within budget 72027). The harness and the repo gate
agree to the byte, which is why the deltas below can be trusted as gate deltas.

Two kinds of number appear:

- Stub rows (`stubs.mjs`): a body is replaced with an empty stand-in and nothing is added back. Upper
  bounds for an option's saving.
- Prototype rows (`prototype.mjs`): `renderer.ts` is patched in memory to drop the catalog imports and
  instead hold the real records table (ids, the `functions` defs as eager manifest, submit-gate tags,
  `import()` thunks) and a memoized `ensureCatalog`. Bodies stay byte-identical. These are the
  closest thing to the real eager closure without writing the change. Not included in them: the
  renderer-side queue trigger (section 5.4), estimated at +300 to 500 B gz (about 40 lines).

## 4. Options

All deltas are eager B gz against 71,231. "Marginal" is the app row value.

| | Scope | Eager delta | App marginal | Kind |
|---|---|---|---|---|
| A | catalog documents lazy, factories eager | -4,794 | 66,437 | stub (upper bound) |
| B | default eager and sync; a2ui-basic (2 ids) + 3 personas + compose lazy | **-5,017** | **66,214** | prototype |
| B stub | same scope, nothing added back | -5,798 | 65,433 | stub |
| B stub, manifest kept | same scope, keeping a2ui-basic `functions` defs | -5,590 | 65,641 | stub |
| C | every built-in body lazy, default included | **-14,064** | **57,167** | prototype |
| C stub | same scope, nothing added back | -11,564 | 59,667 | stub |
| C stub, manifest kept | same scope, keeping both `functions` defs | -11,268 | 59,963 | stub |
| P0 | renderer drops its catalog imports, no replacement | -14,970 | 56,261 | ceiling, not buildable |
| D | whole renderer lazy at `ui-surface-host` | -26,695 | 44,536 | stub; different ticket (section 9) |

The C stub saves less than the C prototype because the stub leaves `controls.ts` (the 82-record control
registry) in the renderer, while the prototype moves it into the lazy default body. P0 minus the C prototype
is the cost of the records, manifest and `ensure` (906 B gz).

Lazy chunks Rolldown cuts for the C prototype, standalone gz (what a host fetches on first use):

| Chunk | gz | Fetched when |
|---|---|---|
| default body (doc + index) | 3,442 | first surface on `agent-ui` |
| shared: default factories + `controls.ts` + registry | 2,648 | first surface on any built-in catalog |
| a2ui-basic body (doc, factories, functions, canonical alias) | 4,544 | first surface on `a2ui-basic` or its URI |
| persona packages + compose | 2,809 (+119 stub chunk) | first surface on any `<base>--<persona>` id |

Total over-the-wire effect, C prototype: eager -14,064, lazy +15,779. A host that loads every catalog pays
+1,715 B gz more than today (lost shared dictionary, chunk framing). A host that renders only default
surfaces pays 3,442 + 2,648 = 6,090 B gz lazily against 14,064 B gz saved, a net 7,974 B gz saved. For B the
default-only host nets -5,017. Lazy by id is a total-bytes win for any host that does not use every
catalog, not only a gate win.

### Option A, why it is dominated

A saves about what B saves (stub -4,794 against B's stub -5,590) but pays C's contract cost, because the
default document is one of the lazy ones: the default path goes asynchronous for a third of C's saving.
It cannot be cheaper than the records mechanism either: `Registry.register` validates the document against
the factory table (`CATALOG_FACTORY_MISSING`, `registry.ts:46-53`), so registration still has to wait for the
document, and every `entry.catalog` read needs it present (`widget.ts:123,161`, `functions.ts:160`,
`binding.ts:124`, `renderer.ts:393,607`, `call-function.ts:50`). Making documents lazy while factories stay
eager is the records mechanism with the wrong scope.

### Option B vs C

Same mechanism; they differ by one record. C also moves the default path off the synchronous route.

| | B | C |
|---|---|---|
| Eager delta | -5,017 | -14,064 |
| Default `agent-ui` path | synchronous, unchanged | first render waits for a 6.1 KB gz chunk (preloaded at renderer construction) |
| Tests that must `await` readiness | 6 (listed in Slice 4) | 26 renderer-constructing test files (the 62 that only import catalog data statically are unaffected) |
| Non-test callers to update | 0 | 13: `site/lib/{ask-registry,a2ui-gallery,component-preview}.ts`, `site/pages/{a2ui-list,a2ui-stream,a2ui-form,devtools-harness,a2a-artifact-feed,a2ui-live,a2ui-canvas,a2ui-patterns}.ts`, `a2ui/tools/agent/structural-transcript.ts`, `a2ui/tools/testkit/mount.ts` |
| `ui-surface-host` | untouched | `connected()` kicks `preload('agent-ui')` |
| Headroom vs today's 72,027 budget | 5,813 B | 14,860 B |

## 5. Recommended design

### 5.1 Shape

A catalog record is what `Registry.register` already takes, split into an eager manifest and a lazy body:

```ts
// catalog/records.ts (new): an explicit list, like personas/index.ts. No generator.
interface CatalogRecord {
  readonly id: string                                          // the registry key; the a2ui-basic canonical URI is its own record
  readonly functions: Readonly<Record<string, FunctionDef>>    // eager copy of catalog.functions (415 B gz for both built-ins)
  readonly submitGate: readonly string[]                       // eager tags the ADR-0054 selector needs before the body loads
  readonly load: () => Promise<CatalogBody>                    // import() of the UNCHANGED body module
}
interface CatalogBody { catalog: unknown; factories: Record<string, WidgetFactory | VariantDispatch>; functions?: ...; controls?: ControlLoader }
```

`CatalogBody` is exactly `register()`'s argument list, so the registry's FACTORY_MISSING gate still runs,
now at load. Derived persona ids (`<base>--<persona>`, six of them) are records whose `load` awaits both
base bodies and the persona package, then runs the existing `composePersonaCatalogs` unchanged.

This mirrors ADR-0233's control registry (`ControlRecord`, `createControlLoader`, deferred apply) with one
deliberate difference: no generator. The control registry has 82 descriptor-derived entries and a `uses`
graph; this set is three bases, one alias and three personas. The `personas/index.ts:3` precedent (a static,
explicit list, never a glob) applies. A bijection test replaces a drift gate (5.3).

### 5.2 Rules

1. The body load is memoized module-wide; registration into a registry is per renderer. Each
   `ui-surface-host` builds its own `createRenderer()` (`surface-host.ts:172`), so a module-global
   "already registered" flag would leave the second renderer empty. Cache the promise of `load()`, not
   the act of registering.
2. A rejected load is dropped from the memo so the next call retries (ADR-0197 cl.3, the
   `loadAgentAdmin()` precedent).
3. `createSurface` on a known-but-unloaded id creates the surface and tree synchronously (their deps read
   the registry at apply time, `renderer.ts:377-394`) and kicks `ensure` immediately, so the chunk
   fetch overlaps the model's time to first token. `updateComponents` and `finalize` queue behind it using
   the ADR-0233 queue; `updateDataModel` follows the existing rule (queued once a queue exists).
4. An id that is neither registered nor a known record is still `CATALOG_UNKNOWN`, synchronously.
5. A failed load emits exactly one `CATALOG_LOAD` per surface (new internal code beside `CONTROL_LOAD`,
   `protocol.ts:37`, same wire mapping as the other surface-scoped codes, `protocol.ts:96`). What the queued
   messages do next (drain into the existing unknown-type CATALOG path, or drop) is slice 3's decision.
6. `callFunction` (`call-function.ts:49-52`) scans `registry.supportedCatalogIds()` and reads each
   `entry.catalog.functions`. Its most-restrictive-wins, order-independent `clientOnly` verdict (SPEC-R14,
   ADR-0034) must not depend on which bodies happen to be loaded, so the scan reads `record.functions` for
   unloaded ids. That is why the manifest carries function defs (308 B gz measured). Only the declaration
   scan needs the manifest: the impl comes from the shared, eager `catalogFunctions` table
   (`call-function.ts:84`, ADR-0034 fork 2), not from the per-catalog override tables (`a2uiBasicFunctions`)
   that live in the lazy bodies and are read by binding evaluation (`functions.ts:160`) once a surface exists.
7. `submitGateSelector()` unions `record.submitGate` with loaded factories' tags. Only `ui-form-provider`
   (default) and concierge's BookingForm tag carry the mark (`personas/concierge/factories.ts:243`), and a
   persona's own gate is minted by its own factory, so only host-authored gate ancestors need the eager tag.
8. Persona composition errors (`CatalogComposeError`, SPEC-R2 AC3/AC6) move from construction time to load
   time for shipped personas. The guarantee is kept by a test that composes every shipped persona against
   the real bodies in CI, so a collision cannot ship; project-registered personas still throw synchronously.

### 5.3 Gates

- Manifest bijection (new, `catalog/records.test.ts`): record ids equal the shipped catalog folders,
  the canonical-URI alias and the persona x base ids; `record.functions` deep-equals each loaded body's
  `catalog.functions`; `record.submitGate` equals the tags of the body's `submitGate` factories.
- Bundle shape (new, `app/src/catalog-lazy.bundle.test.ts`, the `pdf-identity.bundle.test.ts` /
  `agent-admin-lazy.bundle.test.ts` shape): a real Rolldown build of the app barrel; no body module id is
  in the eager closure and each body sits in a non-eager chunk. This is also the `INEFFECTIVE_DYNAMIC_IMPORT`
  trip-wire: a single static import of a body from an eager module silently undoes the split.
- Size row: `APP_MARGINAL_BUDGET` re-based DOWN to the measured figure plus 2,048 B (the ADR-0233
  precedent, ordinary under cl.5), and the app section's informational lazy line gains the catalog chunks.

### 5.4 What changes in the renderer contract

Changes: `#onCreateSurface` (known-unloaded ids), `#onUpdateComponents` and `#drainControls` (a leading
catalog gate before the control gate), `dispose()` (drop pending catalog queues), `Registry`
(`registerLazy`, `knows`, `supportedCatalogIds` union, `submitGateSelector` union), `CatalogRegistry`
(new members optional so the stub at `interpolate.ts:98-103` stays valid or gets them), `protocol.ts`
(`CATALOG_LOAD`), SPEC-R9 AC4.

Unchanged: `register(catalog, factories, functions?, controls?)` and its last-wins semantics (the two-tier
project-catalog seam), the wire protocol, `Catalog` and `WidgetFactory` types, every static export of
`defaultCatalog`, `a2uiBasicCatalog`, `SHIPPED_PERSONA_CATALOGS` from the barrel (tools, corpus, site and
the agent toolkit keep importing them), `surface-host.ts` and `conversation.ts` (under B), and ADR-0233's
control loader.

`no-barrels` (ADR-0233): not touched and not worsened. No new `export *`; `records.ts` is an explicit list
inside one package; the components barrel rule concerns `@agent-ui/components`. The first measured fact in
section 2 is the evidence the a2ui `.` barrel stays inert.

### 5.5 Verified unaffected: `agent-admin-schema.ts`

It imports `derivedCatalogId, derivedCatalogIdsFor, SHIPPED_PERSONA_CATALOGS` from the barrel
(`agent-admin-schema.ts:26`). With the persona bodies behind a record, Rolldown cuts them into their own
shared lazy chunk (`personas-*.js`, 2,809 B gz) that both the persona record and the lazy agent-admin arm
import. `measure/prototype.out.txt` prints the agent-admin chunk before and after and whether it holds
persona modules itself: it does not (33,616 B gz before, 33,642 after, and after it imports the separate
persona chunk), so a persona surface does not fetch the agent-admin arm. No change
to this file is needed. The barrel keeps exporting `SHIPPED_PERSONA_CATALOGS`, which is why.

## 6. Recommendation

Take B now, C on a ruling.

- B buys 5.8 KB of headroom (796 B to 5,813 B at today's budget; set the new budget from the measured
  figure) for a contained blast radius: the default path, `surface-host.ts`, the site and the tools stay
  synchronous and untouched, and 6 test files change.
- The mechanism is the whole cost. Once it exists, C is a record flip plus the sync-path churn, measured at
  a further -9,047 B gz (66,214 to 57,167). It should be Kim's call because it changes when the default
  path renders, and the ADR should record the trigger (for example "flip when headroom falls under N B").
- Neither option is needed to turn the gate green. They buy headroom and stop shipping a2ui-basic and the
  persona sets to hosts that never render them.

## 7. Decomposition

Order: 1 (ratify) then 2, 3, 4 in sequence; 5 rides with 4; 6 only after a ruling. Sizes use the
repo's S/M scale. Each slice names the files it touches.

### Slice 1 (S, docs): ADR-0241, lazy catalog bodies behind an eager manifest

Proposed by this spike, ratified by Kim before slice 2 builds. Docs-only gate: `doc_lint` + `npm run check`,
plus the sitemap regeneration and `site/lib/sitemap.test.ts` (process.md section 1, the 2026-08-30 carve-out, since an ADR title is added).
Files:
- `.claude/docs/adr/0241-lazy-catalog-bodies-behind-an-eager-manifest.md` (new)
- `.claude/docs/adr/0169-a2ui-basic-catalog-upstream-interop.md` (append-only pointer on cl.2, "registers on every renderer host")
- `.claude/docs/adr/0172-persona-catalog-composition-intake.md` (append-only pointer on cl.2, constructor-time derive)
- `.claude/docs/adr/0233-per-control-entries-and-generated-control-registry.md` (append-only pointer on cl.5, the deferred-apply queue)
- `.claude/docs/adr/0197-app-barrel-agent-admin-lazy-split.md` (append-only pointer on cl.5, the downward re-base)

### Slice 2 (S): registry and loader seam, wired nowhere

Adds the lazy-record API behind optional members so no caller changes. Behavior-neutral.
Files:
- `packages/agent-ui/a2ui/src/catalog/types.ts` (`LazyCatalogRecord`, optional `knows`/`ensure` on `CatalogRegistry`)
- `packages/agent-ui/a2ui/src/catalog/registry.ts` (`registerLazy`, `supportedCatalogIds` and `submitGateSelector` unions)
- `packages/agent-ui/a2ui/src/catalog/registry.test.ts`
- `packages/agent-ui/a2ui/src/catalog/loader.ts` (new: memoized body load, retry on reject, per-registry register)
- `packages/agent-ui/a2ui/src/catalog/loader.test.ts` (new)
- `packages/agent-ui/a2ui/src/renderer/interpolate.ts` (the stub `CatalogRegistry` at lines 98-103)

### Slice 3 (M): renderer deferred apply for lazy catalogs

Proves the mechanism with a test-double lazy catalog before any built-in moves, in the shape of
`control-loading.test.ts`.
Files:
- `packages/agent-ui/a2ui/src/renderer/renderer.ts` (`#onCreateSurface`, `#onUpdateComponents`, `#drainControls`, `dispose`)
- `packages/agent-ui/a2ui/src/renderer/call-function.ts` (scan `record.functions` for unloaded ids)
- `packages/agent-ui/a2ui/src/protocol.ts` (`CATALOG_LOAD`, wire-mapping comment at line 96)
- `packages/agent-ui/a2ui/src/renderer/catalog-loading.test.ts` (new; analog of `control-loading.test.ts`)
- `packages/agent-ui/a2ui/src/renderer/catalog-loading.browser.test.ts` (new; analog of `control-loading.browser.test.ts`)
- `.claude/docs/spec/a2ui-runtime.spec.md` (SPEC-R9 AC4 and the §5.2 error-code table, written with the build per ADR-0233 precedent)

### Slice 4 (M): move a2ui-basic and the persona sets behind records; re-base the budget; add the bundle gate

Lands as one PR with the size re-base so the gate tightens in the same change.
Files:
- `packages/agent-ui/a2ui/src/catalog/records.ts` (new: explicit list, manifest, thunks)
- `packages/agent-ui/a2ui/src/catalog/records.test.ts` (new: the bijection gate, 5.3)
- `packages/agent-ui/a2ui/src/renderer/renderer.ts` (constructor lines 224-237: default stays, the rest becomes `registerLazy`)
- `packages/agent-ui/a2ui/src/renderer/renderer.test.ts`
- `packages/agent-ui/a2ui/src/renderer/builtin-controls.test.ts`
- `packages/agent-ui/a2ui/src/renderer/renderer-persona-catalogs.test.ts`
- `packages/agent-ui/a2ui/src/catalog/a2ui-basic/upstream-fixtures.test.ts`
- `packages/agent-ui/a2ui/src/examples/examples.test.ts`
- `packages/agent-ui/a2ui/src/catalog/personas/concierge/concierge.browser.test.ts`
- `packages/agent-ui/app/src/catalog-lazy.bundle.test.ts` (new; shape of `pdf-identity.bundle.test.ts`)
- `scripts/measure-size.mjs` (`APP_MARGINAL_BUDGET` down to measured + 2,048 B, ledger comment, lazy-catalog informational line)

### Slice 5 (S, docs): repair the records that named the old timing

Stale context is a defect; rides with slice 4. Docs-only gate.
Files:
- `.claude/docs/spec/persona-catalog-composition.spec.md` (SPEC-R2 and its ACs: constructor-time derive becomes load-time for shipped personas)
- `.claude/docs/lld/a2ui-renderer.lld.md` (the renderer host and capabilities components)
- `.claude/docs/lld/a2ui-catalog.lld.md` (the registry component)
- `packages/agent-ui/a2ui/README.md`

### Slice 6 (M, only after Kim's ruling on C): make the default catalog lazy

Splits into three children when taken: the record flip (renderer and size), the 13 non-test callers, the 26 test files.
Files:
- `packages/agent-ui/a2ui/src/catalog/records.ts` (new in slice 4, edited here)
- `packages/agent-ui/a2ui/src/renderer/renderer.ts`
- `packages/agent-ui/app/src/controls/surface-host/surface-host.ts` (kick `preload('agent-ui')` in `connected()`, line 172)
- `site/lib/ask-registry.ts`
- `site/lib/a2ui-gallery.ts`
- `site/lib/component-preview.ts`
- `site/pages/a2ui-list.ts`
- `site/pages/a2ui-stream.ts`
- `site/pages/a2ui-form.ts`
- `site/pages/devtools-harness.ts`
- `site/pages/a2a-artifact-feed.ts`
- `site/pages/a2ui-live.ts`
- `site/pages/a2ui-canvas.ts`
- `site/pages/a2ui-patterns.ts`
- `packages/agent-ui/a2ui/tools/agent/structural-transcript.ts`
- `packages/agent-ui/a2ui/tools/testkit/mount.ts`
- `scripts/measure-size.mjs`

## 8. The ADR

ADR-0241 (number to be confirmed against the log when the slice starts). Proposed text, not drafted here:

- Decides: catalog bodies load by catalog id behind an eager manifest; the manifest carries ids,
  `functions` defs and submit-gate tags; the renderer defers `updateComponents` behind a catalog gate the
  way ADR-0233 cl.5 defers it behind a control gate.
- Amends ADR-0169 cl.2 (a2ui-basic still registers on every renderer host, by id, not by bytes),
  extends ADR-0233 cl.5 (a second gate in the deferred-apply queue) and relates ADR-0172 cl.2 (persona
  derive moves to load time for shipped sets) and ADR-0197 cl.5 (the row re-bases downward).
- Records the option C trigger so a later flip is a measured ruling, not a new design.
- Open question for Kim: whether project catalogs get a public `registerLazy`. Recommended no, until a
  consumer asks; `register` is unchanged.

## 9. Rejected alternatives

| Alternative | Why not |
|---|---|
| Raise the budget | Non-goal; ADR-0197 cl.5 closes it |
| A: lazy documents only | Dominated (section 4): B's saving at C's contract cost, a third of C's saving |
| Fetch `catalog.json` at runtime from a static URL | Breaks the module graph and the ESM-CDN story (the ADR-0233 rejection of the same shape), adds an untyped integrity seam, and saves only 4.8 KB |
| Deep-import the renderer in `surface-host.ts` to dodge the barrel | Unneeded (P0 shows the barrel is inert) and SPEC-R2 AC4 pins that file to the public barrel |
| A generator for the catalog registry | n=7 records does not earn a generator and a drift gate; explicit list plus bijection test |
| Pre-merge derived persona documents at build time | Six derived docs repeat the 44 KB default document; strictly more bytes |
| D: lazy renderer in `ui-surface-host` (-26,695) | Different ticket. `surface-host.ts:172` creates the renderer synchronously in `connected()` and `ingest`, `onClientMessage`, `dispose` assume it exists (lines 243, 327, 337, 426); it is a public-control timing change that needs its own ADR in the ADR-0197 mold. Measured here so Kim can weigh it; it does not split catalog data from the renderer |

## 10. Not measured, and risks

- The renderer-side queue code (slice 3) is estimated at +300 to 500 B gz, not measured. Re-measure after
  slice 3 before slice 4 sets the budget.
- Wall-clock cost of the first lazy fetch is not measured. The design hides it by kicking `ensure` at
  `createSurface`; for C it would also kick at renderer construction.
- Construction cost per renderer is not measured. Every `ui-surface-host` builds a renderer that today
  registers 3 catalogs and composes 6 derived ones (`loadCatalog` over each). B removes 8 of those 9
  from construction; likely a real CPU win for chat threads with many surfaces, but unmeasured.
- jsdom tests that ingest immediately and assert synchronously break for any lazy id. The sync fast path
  holds once a body is loaded, so slice 3 should give tests an `await host.preload(id)`.
- Rolldown/Vite chunk naming and a shared `controls-*.js` chunk are as observed in these builds; the
  bundle gate in slice 4 is what keeps them from regressing.
