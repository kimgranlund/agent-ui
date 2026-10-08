// renderer.ts — renderer host / orchestrator (renderer LLD-C13, SPEC-R1/N3/N4).
//
// THE integration seam: wires the nine wave-1 modules into one working A2UI renderer. A raw JSONL
// line goes in (`ingest`); a live `ui-*` control subtree comes out (attached under `mount`); and
// client→server messages (emitted actions, errors) come out the side (`onClientMessage`). The host
// owns the cross-module state the flat sibling modules deliberately do NOT: the per-runtime catalog
// `Registry`, the `SurfaceStore`, one `SurfaceTree` per surface, the single `ActionDispatcher`, and
// the mount point.
//
// Pipeline (per line): skip-blank → `parseLine` (LLD-C1) → on `ParseError` emit `error{PARSE}` and
// continue (N4) → `dispatch` (LLD-C2) routes the envelope to a host handler that closes over the
// store. createSurface resolves `catalogId` against the registry (unknown → `CATALOG_UNKNOWN`, no
// surface, R2 AC3); updateComponents feeds the surface's `SurfaceTree.apply` and attaches the rendered
// root under the mount; updateDataModel writes the surface data signal; deleteSurface disposes the
// surface scope (leak-free, N3); actionResponse correlates back through the `ActionDispatcher`.
//
// Validate-at-finalize (ADR-0002, LLD §8/§11). The host NEVER calls `validateA2ui` per
// `updateComponents` message — out-of-order streaming makes a missing-`root`/dangling-`child` a legal
// transient state (SPEC-R4), so a per-message id-graph check would false-positive. The tree eager-guards
// the *always*-invalid in-stream cases (2nd `root`, cycle). The finalize-only judgments (missing
// `root`, dangling) are caught by `finalize()`, which runs the shared validator on the COMPLETE
// component set (parity with corpus admission, N6). ADR-0187/GH #829: that finalize call passes
// `{ atFinalize: true }`, which extends the finalize-only judgments to a surface `createSurface`'d and
// never given ANY components — previously waved through by the validator's empty-set exemption, leaving
// a permanently-blank host with no error to show (GH #802).
//
// GH #887/#888 (SPEC-N6 validator-parity closure): finalize used to emit ONLY the id-graph verdict,
// on the stated belief that "CATALOG/POINTER are render-time concerns already surfaced by the widget
// resolver." Measured false for two real shapes: (1) `wireProps` (widget.ts) applies EVERY prop key an
// incoming node carries — it never checks the prop is catalog-DECLARED, so an unknown/mismatched
// property (e.g. a bare `label` on a component whose catalog row carries no such prop) is silently
// `applyProp`'d and never reported; (2) the binding resolver (binding.ts) has no notion of "invalid" —
// an out-of-scope relative `{path}` binding or a malformed pointer just resolves to `undefined`/a wrong
// key, silently. Both shapes ALREADY fail `validateCatalogConformance`/the POINTER stage (corpus
// admission would reject them, N6), so a payload that fails validation must not instead mount a
// visually-blank control live with zero client-visible error (the same "fail loudly, never silently"
// posture ADR-0187 already established for the emptiness case). `#finalizeSurface` below now also
// surfaces CATALOG + POINTER, de-duped against the ONE CATALOG case the widget resolver DOES already
// report live (an unknown component TYPE, SPEC-R9 AC2) via `#liveCatalogPaths`.
//
// Action wiring (the integration decision — see the build hand-back). The default catalog declares
// Button's `action` prop with `mapsTo:'action'`. The host knows the catalog, so it knows which props
// are action-typed: it STRIPS those props from the node before the base widget resolver runs (so the
// action object is never `applyProp`'d/stringified onto the DOM) and instead wires the control's
// `click` → `ActionDispatcher.emitAction` (listener owned by `surface.ac`, so it dies with the surface).
//
// Action context resolution (LLD-C9 `collectContext`, SPEC-R8 "the resolved context"; GH #1748). Each
// `context` entry is a binding value resolved at CLICK time through the SAME `resolveValue` dispatcher
// the bound props and checks use (literal as-is · `{path}` · `{call}` · `${…}` interpolation), with the
// node's `itemScope`, so inside a ChildList template a RELATIVE `{path}` resolves against the row
// (`{path}/{index}/…`) and `@index` is the row index. A literal context is emitted unchanged. Before
// GH #1748 the context was forwarded verbatim and `#wireAction` never received the `itemScope`, so every
// row of a list template dispatched the same unresolved `{path}` object.
//
// The submit-gated action (ADR-0054). An action object may carry a CLIENT-consumed `submit: true` flag
// (never on the wire — stripped by `readActionSpec`, ADR-0011's shape stays byte-identical). On such a
// flagged click, `#wireAction` resolves `el.closest(registry.submitGateSelector())` — the registry's
// derived selector over every registered catalog's `submitGate`-marked factories (two-tier). A matched
// gate's own `submit()` is the sole arbiter (`false` → no emit, the gate already ran first-invalid
// `reportValidity`; `true` → emit); no gate ancestor, or an empty selector (no `submitGate` factory
// registered anywhere), is the SAME graceful fallthrough as an unflagged Button.
//
// Deferred apply (ADR-0233). A catalog registered with a `controls` loader (`CatalogEntry.controls`) may
// name controls that are not defined yet. Parents read their children in `connected()`, so the renderer
// never creates an element before its tag is defined. On `updateComponents` for such a surface it collects
// the message's factory tags; when the surface has no queue and none is missing, it applies synchronously,
// exactly as without a loader. Otherwise the message is queued, and so is every later `updateComponents`,
// `updateDataModel` and `finalize(S)` for that surface while its queue is non-empty, until
// `controls.ensure` settles. On resolve the queue drains in order, re-checking `missing` per queued
// message. On reject (or a resolve that left a requested tag undefined) the host emits one `CONTROL_LOAD`
// for the surface and drains anyway; a node whose tag is still undefined renders through the
// `a2ui-placeholder` path (`widget.ts`). `deleteSurface` (and a re-`createSurface` of the same id) while
// pending tears down and drops the queue; `dispose()` drops every queue; a late settle is a no-op.
// `createSurface` and other surfaces are never delayed. A catalog without `controls` never queues.
//
// Deferred catalog load (ADR-0241). Only the default `agent-ui` catalog is registered at construction; a2ui-basic
// (both ids) and every shipped `<base>--<persona>` pairing are records (`catalog/records.ts`), known by id with
// their bodies behind a dynamic import. `createSurface` on a recorded, not yet loaded id creates the surface and
// its tree synchronously and starts `registry.ensure` at once, so the chunk fetch overlaps the model's time to
// first token. The surface gets a queue with a catalog gate ahead of the control gate: every `updateComponents`,
// `updateDataModel` and `finalize(S)` waits in it, in order. On resolve the queue takes the loaded entry's control
// loader and drains as above. On reject the host emits one `CATALOG_LOAD` for the surface, drops the queued
// messages and removes the surface, the end state of `CATALOG_UNKNOWN`; a later `createSurface` retries the load.
// An id neither registered nor recorded is still `CATALOG_UNKNOWN`, synchronously. Once a body is registered in
// this renderer the path is synchronous again; `preload(id)` starts the load early and lets a caller await it.
// A renderer built after any renderer loaded a body registers it at construction (the warm memo, `Registry.registerLazy`),
// so only the first renderer on a page takes the asynchronous path.
//
// The settle seam. A host that reads the mount right after `ingest`/`finalize` (`ui-surface-host`'s root stretch and
// terminal-empty verdict) must know whether the queues above still hold messages back. `RendererHost.pending` is true
// while any surface has a queue (the catalog gate or the control gate); `settled()` resolves once none is left, at the
// moment the last queue drains or is dropped (a failed load, `deleteSurface`, a re-`createSurface`, `dispose`), so the
// waiter runs after everything queued has been applied. Resolved at once when nothing is pending.

import type { ControlLoader } from '@agent-ui/components/loader'
import { dispatch } from './dispatch.ts'
import type { DispatchHandlers } from './dispatch.ts'
import { parseLine, isParseError } from './parser.ts'
import { SurfaceStore } from './surface.ts'
import type { Surface } from './surface.ts'
import { SurfaceTree } from './tree.ts'
import { create as createOnly, isControlTag, isPlaceholder, wireProps } from './widget.ts'
import type { WidgetDeps } from './widget.ts'
import { wireChecks } from './checks.ts'
import { ActionDispatcher } from './action.ts'
import { validateA2ui } from './validate.ts'
import { resolveValue as dispatchValue } from './functions.ts'
import { setPointer } from './binding.ts'
import { readActionSpec } from './wire-tolerances.ts' // GH #484 move phase — A1/A2/A3 (was local to this file)
import type { CreateWidget, ItemScope } from './types.ts'
import { untracked, type Scope } from '@agent-ui/components'
import { Registry } from '../catalog/registry.ts'
import type { WidgetFactory } from '../catalog/types.ts'
import { factoriesOf, resolveFactory } from '../catalog/variant.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { defaultFactories } from '../catalog/default/factories.ts'
import { BUILTIN_CATALOG_RECORDS } from '../catalog/records.ts'
import { builtinControls } from '../catalog/controls.ts'
import type {
  A2uiCreateSurface,
  A2uiUpdateComponents,
  A2uiUpdateDataModel,
  A2uiDeleteSurface,
  A2uiComponent,
  A2uiError,
  A2uiServerMessage,
  A2uiActionMessage,
  A2uiErrorMessage,
  A2uiFunctionResponseMessage,
} from '../protocol.ts'
import { toWireError } from '../protocol.ts'
import { handleCallFunction } from './call-function.ts'

// `A2uiErrorMessage` is now defined in `../protocol.ts` (co-located with the other wire types).
// It is re-exported here for backward compat so existing test/host imports of
// `A2uiErrorMessage` from `renderer.ts` continue to resolve.
export type { A2uiErrorMessage }

/**
 * Everything the renderer emits to the server (runtime SPEC §5.2): a triggered action, a
 * `functionResponse` (SPEC-R14 / ADR-0034 clause 1), or a structured error (ADR-0031).
 */
export type A2uiClientMessage = A2uiActionMessage | A2uiErrorMessage | A2uiFunctionResponseMessage

/** A subscriber to the client→server message stream; the returned function unsubscribes it. */
export type ClientMessageListener = (message: A2uiClientMessage) => void

/**
 * Construction options (renderer LLD-C13). The id/clock providers are injected so the action layer
 * stays deterministic under test (the scripts ban ambient `Date.now()`/`Math.random()` in logic); the
 * host supplies real ones at its edge by default, and tests pin fakes.
 */
export interface RendererOptions {
  /** Client-generated unique `actionId` provider (v1.0, SPEC-R8). Default: a per-host monotonic counter. */
  newId?: () => string
  /** ISO-8601 timestamp provider for actions. Default: `new Date().toISOString()` (the host edge). */
  now?: () => string
  /** Logger for the unknown-`actionId` drop (§9 edge). Forwarded to the `ActionDispatcher`. */
  warn?: (message: string) => void
  /** Fallback `version` for client messages with no surface context (e.g. a `PARSE` error). Default `v1.0`. */
  defaultVersion?: string
  /**
   * Reveal-order policy opt-in (GH #975, ADR-0194 — proposed, never self-ratified). Default
   * `false`/undefined: byte-identical to before this policy existed. `true`: every surface this host
   * renders reveals its STATIC component tree's siblings in DECLARED order rather than stream-arrival
   * order (`SurfaceTree`/`tree.ts`'s own doc comment carries the mechanism). Applies to every surface
   * this host creates — there is no per-`createSurface`-call override.
   */
  revealOrder?: boolean
}

/**
 * The renderer host public surface (renderer SPEC §5.3, adapted: `ingest` takes a raw JSONL line so the
 * transport hands lines straight through). The wave-4 canvas consumes exactly this.
 */
export interface RendererHost {
  /** Register an additional catalog + its factory table (two-tier, SPEC-R6/N1; delegates to the registry).
   *  `functions` (ADR-0169 cl.8) is an optional per-catalog function-impl override table, forwarded verbatim.
   *  `controls` (ADR-0233) is an optional control loader; with it, the surface defers apply until the
   *  controls a message needs are defined (module header, "Deferred apply"). */
  register(
    catalog: unknown,
    factories: Record<string, WidgetFactory>,
    functions?: Record<string, (args: Record<string, unknown>) => unknown>,
    controls?: ControlLoader,
  ): void
  /** Set the element rendered surface roots attach under; re-attaches any already-mounted roots. */
  mount(rootEl: HTMLElement): void
  /** Ingest one raw JSONL line: skip-blank → parse → dispatch (PARSE on a malformed line, N4). */
  ingest(line: string): void
  /** Ingest an already-parsed server message (the post-parse path; also used internally by `ingest`). */
  ingestMessage(message: A2uiServerMessage): void
  /** Subscribe to client→server messages (actions + errors); returns an unsubscribe (SPEC-R8/R11). */
  onClientMessage(listener: ClientMessageListener): () => void
  /**
   * Load a recorded catalog's body and register it into this renderer (ADR-0241). Resolves at once for a
   * registered id; rejects with a `CatalogLoadError` for an id that is neither registered nor recorded, or a
   * failed load (the next call retries). A surface never needs it, since `createSurface` loads on demand; it lets
   * a host start the fetch early, or a caller await the synchronous path before ingesting.
   */
  preload(catalogId: string): Promise<void>
  /**
   * `true` while any surface holds messages back behind a lazy catalog body or a control load (ADR-0233, ADR-0241), so
   * the mount does not yet show what `ingest`/`finalize` were given. `false` once every queue has drained or been dropped.
   */
  readonly pending: boolean
  /**
   * Resolves once `pending` is false: when the last queue has drained and applied its messages, or been dropped (a failed
   * load, `deleteSurface`, a re-`createSurface` of a pending id, `dispose`). Already resolved when nothing is pending. It
   * never rejects; a failed load still reports `CATALOG_LOAD`/`CONTROL_LOAD` through `onClientMessage`.
   */
  settled(): Promise<void>
  /** Run the shared validator's id-graph check on the COMPLETE component set (ADR-0002, finalize-only). */
  finalize(surfaceId?: string): void
  /** Tear everything down: dispose every surface (leak-free, N3), detach roots, drop subscribers. */
  dispose(): void
}

/** Construct a renderer host with the default `agent-ui` catalog pre-registered (renderer LLD-C13). */
export function createRenderer(options: RendererOptions = {}): RendererHost {
  return new Renderer(options)
}

class Renderer implements RendererHost {
  readonly #registry = new Registry()
  readonly #store = new SurfaceStore()
  readonly #trees = new Map<string, SurfaceTree>()
  readonly #attached = new Set<string>() // surfaceIds whose rendered root is in the mount DOM
  readonly #poisoned = new Set<string>() // surfaceIds the tree flagged with an in-stream IDGRAPH (skip at finalize)
  // GH #887/#888 — per-surface CATALOG `path`s ALREADY reported live (the widget resolver's ONE live
  // CATALOG emission site, `widget.ts#create`'s unknown-component-type branch, SPEC-R9 AC2). Finalize's
  // shared-validator re-derives the SAME finding at the SAME `path` (`conformance.ts`'s `path:
  // component.id` for that exact case) — this set is what lets `#finalizeSurface` surface every OTHER
  // CATALOG finding (an unknown/mismatched PROPERTY, never live-reported) without double-reporting this one.
  readonly #liveCatalogPaths = new Map<string, Set<string>>()
  readonly #listeners = new Set<ClientMessageListener>()
  readonly #actions: ActionDispatcher
  readonly #createWidget: CreateWidget
  readonly #widgetDeps: WidgetDeps
  readonly #emitError: (error: A2uiError) => void
  readonly #handlers: DispatchHandlers
  readonly #defaultVersion: string
  readonly #revealOrder: boolean // GH #975/ADR-0194 opt-in (default false) — threaded into every SurfaceTree
  // Deferred apply: one queue per surface waiting on its catalog body (ADR-0241) or its control loader (ADR-0233).
  readonly #queues = new Map<string, SurfaceQueue>()
  // `settled()` resolvers parked while a queue exists; released by `#releaseSettled` once none is left.
  readonly #settleWaiters: (() => void)[] = []
  #mountEl: HTMLElement | undefined
  #disposed = false

  constructor(options: RendererOptions) {
    this.#defaultVersion = options.defaultVersion ?? 'v1.0'
    this.#revealOrder = options.revealOrder ?? false

    // Per-runtime registry, default catalog pre-registered so `catalogId:'agent-ui'` resolves out of the
    // box (two-tier: a project registers more via `register`, SPEC-R6/N1). ADR-0233: the built-in catalogs
    // register `builtinControls`, so a surface defines the controls it names on demand (the factory modules
    // import none); the derived persona entries inherit it through `composeControlLoaders`.
    this.#registry.register(defaultCatalog, defaultFactories, undefined, builtinControls)
    // ADR-0241 cl.2 (amends ADR-0169 cl.2, relates ADR-0172 cl.2): the upstream A2UI Basic Catalog under its
    // short id and its inbound-only canonical-URI alias, and every shipped persona over each base it targets
    // (`<base>--<persona>`), are known on EVERY renderer host by id; each body loads the first time a surface
    // names it, and a shipped persona's compose step (reject-loud, SPEC-R2) runs at that load.
    for (const record of BUILTIN_CATALOG_RECORDS) this.#registry.registerLazy(record)

    let seq = 0
    this.#actions = new ActionDispatcher({
      newId: options.newId ?? (() => `a2ui-action-${++seq}`),
      now: options.now ?? (() => new Date().toISOString()),
      emitClient: (message) => this.#emit(message),
      warn: options.warn,
    })

    // The internal error sink: applies toWireError at the single client→server chokepoint (ADR-0031
    // clause 1/2) so every outbound error carries the v1.0 two-code wire shape. Internal callers
    // (functions.ts / checks.ts) still receive and emit `A2uiError` (the 9-code internal taxonomy)
    // unchanged — the map is applied HERE, not at the emit sites.
    //
    // GH #887/#888 — records this call's `path` into `#liveCatalogPaths` when it's a live CATALOG
    // emission (the ONE site: `widget.ts#create`'s unknown-component-type branch) so `#finalizeSurface`
    // can recognize + skip re-reporting the SAME finding when its shared-validator pass re-derives it.
    this.#emitError = (error) => {
      if (error.code === 'CATALOG' && error.surfaceId !== undefined && error.path !== undefined) {
        let paths = this.#liveCatalogPaths.get(error.surfaceId)
        if (paths === undefined) {
          paths = new Set()
          this.#liveCatalogPaths.set(error.surfaceId, paths)
        }
        paths.add(error.path)
      }
      this.#emitInternalError(this.#versionFor(error.surfaceId), error)
    }
    this.#widgetDeps = {
      registry: this.#registry,
      emitError: this.#emitError,
      // The value dispatcher (LLD-C5 + LLD-C10, ADR-0026): routes a literal, a `{path}` binding
      // (per-path memo in binding.ts — SPEC-N2 fine-grained waking), or a `{call}` function-call
      // (evaluator in functions.ts — @index, required/email/regex, recursive args) to its resolver.
      // Closed over `emitError` + registry so FUNCTION errors surface through the same sink.
      resolveValue: (value, surface, itemScope) => dispatchValue(value, surface, itemScope, this.#emitError, this.#registry),
    }
    this.#createWidget = this.#makeHostCreateWidget()

    // Handlers close over the store; each applies its slice and (where relevant) version-specific
    // semantics. Routing/version errors are `dispatch`'s concern and surface from `ingestMessage`.
    this.#handlers = {
      createSurface: (body, version) => this.#onCreateSurface(body, version),
      updateComponents: (body, version) => this.#onUpdateComponents(body, version),
      updateDataModel: (body) => this.#onUpdateDataModel(body),
      deleteSurface: (body) => this.#onDeleteSurface(body),
      actionResponse: (body) => void this.#actions.actionResponse(body),
      // LLD-C14: server-initiated function-call RPC (ADR-0034 / SPEC-R14). Envelope-level — no
      // surface context. The handler looks up the function across all registered catalogs, gates on
      // `callableFrom`, invokes via `catalogFunctions`, and emits `functionResponse` or
      // `INVALID_FUNCTION_CALL` through the shared `#emit` chokepoint (bypasses `toWireError`
      // because the error carries `functionCallId`, not `surfaceId` — ADR-0034 clause 5).
      callFunction: (body, version) => handleCallFunction(body, this.#registry, version, (msg) => this.#emit(msg)),
    }
  }

  // ── public surface ────────────────────────────────────────────────────────────

  register(
    catalog: unknown,
    factories: Record<string, WidgetFactory>,
    functions?: Record<string, (args: Record<string, unknown>) => unknown>,
    controls?: ControlLoader,
  ): void {
    this.#registry.register(catalog, factories, functions, controls)
  }

  mount(rootEl: HTMLElement): void {
    this.#mountEl = rootEl
    for (const [id, tree] of this.#trees) this.#attachRoot(id, tree)
  }

  ingest(line: string): void {
    // A blank/whitespace-only line is not a message — skip BEFORE `parseLine` so it never becomes a
    // spurious `error{PARSE}` (the line-splitter can emit trailing empties).
    if (line.trim() === '') return
    const result = parseLine(line)
    if (isParseError(result)) {
      // PARSE has no surface/version context — use the host default (LLD §9 / N4: stream continues).
      this.#emitInternalError(this.#defaultVersion, { code: 'PARSE', message: result.message })
      return
    }
    this.ingestMessage(result)
  }

  ingestMessage(message: A2uiServerMessage): void {
    const error = dispatch(message, this.#handlers)
    if (error !== undefined) this.#emitInternalError(versionOf(message, this.#defaultVersion), error)
  }

  onClientMessage(listener: ClientMessageListener): () => void {
    this.#listeners.add(listener)
    return () => void this.#listeners.delete(listener)
  }

  preload(catalogId: string): Promise<void> {
    return this.#registry.ensure(catalogId)
  }

  get pending(): boolean {
    return this.#queues.size > 0
  }

  settled(): Promise<void> {
    if (this.#queues.size === 0) return Promise.resolve()
    return new Promise((resolve) => void this.#settleWaiters.push(resolve))
  }

  /** Resolve every parked `settled()` once no queue is left. Called after each place a queue can disappear. */
  #releaseSettled(): void {
    if (this.#queues.size > 0 || this.#settleWaiters.length === 0) return
    for (const resolve of this.#settleWaiters.splice(0)) resolve()
  }

  finalize(surfaceId?: string): void {
    if (surfaceId !== undefined) {
      this.#finalizeOrQueue(surfaceId)
      return
    }
    for (const id of this.#trees.keys()) this.#finalizeOrQueue(id)
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    for (const id of [...this.#trees.keys()]) this.#teardownSurfaceDom(id)
    this.#queues.clear() // ADR-0233/0241: every pending queue dropped; a late settle sees #disposed
    this.#store.disposeAll() // disposes every surface scope + aborts every listener (N3)
    this.#listeners.clear()
    this.#mountEl = undefined
    this.#releaseSettled()
  }

  // ── dispatch handlers ───────────────────────────────────────────────────────────

  #onCreateSurface(body: A2uiCreateSurface, version: string): void {
    // Resolve catalogId against the registry — an unbound catalog is `CATALOG_UNKNOWN`, no surface (R2 AC3).
    // ADR-0241: a recorded id is bound too; its body loads behind the surface's catalog gate below.
    const loaded = this.#registry.get(body.catalogId) !== undefined
    if (!loaded && !this.#registry.knows(body.catalogId)) {
      this.#emitInternalError(version, {
        code: 'CATALOG_UNKNOWN',
        surfaceId: body.surfaceId,
        message: `unknown catalogId "${body.catalogId}"`,
      })
      return
    }

    // A re-`createSurface` with a live id replaces it; drop the prior root from the DOM first (the store
    // disposes the prior surface's scope/listeners, but DOM detach is the host's).
    this.#teardownSurfaceDom(body.surfaceId)

    // `body.theme` (v0.9.x-only, SPEC-R13) is not carried onto the surface model: no theming applier
    // (LLD-C8) consumes it yet, and v1.0 has no surface-theming field at all (SPEC-R6(b), GH #477 —
    // `surfaceProperties` dropped from the wire type; see protocol.ts's `A2uiCreateSurface` doc comment).
    const surface = this.#store.create({
      id: body.surfaceId,
      catalogId: body.catalogId,
      version,
      sendDataModel: body.sendDataModel,
    })
    this.#trees.set(
      surface.id,
      new SurfaceTree(surface, {
        createWidget: this.#createWidget,
        // RSR-C2/C6 (renderer-structural-resend.lld.md §2): the three additional entry points structural-
        // resend reconciliation needs beyond `createWidget` — mint-only (no wiring), wire-onto-an-EXISTING-
        // element, and the narrowed identity-mapped omitted-prop reset. `create`/`rewireNode` compose the
        // SAME `#create`/`#wireNode` halves `#makeHostCreateWidget` itself composes below — one wiring path.
        create: (node, surface) => this.#create(node, surface),
        rewireNode: (el, node, surface, scope, itemScope, ac) => this.#wireNode(el, node, surface, scope, itemScope, ac),
        resetProp: (el, node, surface, prop, value) => {
          // GH #545 — the same `resolveFactory` re-dispatch `widget.ts` uses, so a reset onto a
          // variant-dispatched node lands on the SAME concrete factory the node was minted/wired with.
          const factory = resolveFactory(this.#registry.get(surface.catalogId)?.factories[node.component], node)
          factory?.applyProp(el, prop, value)
        },
        componentDefOf: (node, surface) => this.#registry.get(surface.catalogId)?.catalog?.components?.[node.component],
        onError: (error) => this.#onTreeError(surface.id, error),
        revealOrder: this.#revealOrder, // GH #975/ADR-0194 — opt-in, default false
      }),
    )
    if (!loaded) this.#awaitCatalog(surface.id, body.catalogId)
    this.#releaseSettled() // a re-createSurface may have dropped a pending queue and left none in its place
  }

  #onUpdateComponents(body: A2uiUpdateComponents, version: string): void {
    const surface = this.#store.get(body.surfaceId)
    const tree = this.#trees.get(body.surfaceId)
    if (surface === undefined || tree === undefined) return // unknown/deleted surface → no-op (LLD §9)
    const message: QueuedMessage = { components: body, run: () => this.#applyComponents(body, version) }
    const queued = this.#queues.get(body.surfaceId)
    if (queued !== undefined) {
      queued.messages.push(message) // behind a pending catalog or control load, in arrival order
      return
    }
    const loader = this.#registry.get(surface.catalogId)?.controls
    // No control loader (synchronous, as before ADR-0233), or every control already defined (the sync fast path).
    if (loader === undefined || loader.missing(this.#controlTagsOf(surface.catalogId, body)).length === 0) {
      message.run()
      return
    }
    const queue: SurfaceQueue = { catalogId: surface.catalogId, loader, messages: [message] }
    this.#queues.set(body.surfaceId, queue)
    this.#drain(body.surfaceId, queue, false)
  }

  /** Apply one `updateComponents` to its surface's tree and attach the root (the sync path and the drain). */
  #applyComponents(body: A2uiUpdateComponents, version: string): void {
    const tree = this.#trees.get(body.surfaceId)
    if (tree === undefined || this.#store.get(body.surfaceId) === undefined) return
    tree.apply({ version, updateComponents: body })
    this.#attachRoot(body.surfaceId, tree)
  }

  #onUpdateDataModel(body: A2uiUpdateDataModel): void {
    const queued = this.#queues.get(body.surfaceId)
    if (queued !== undefined) {
      queued.messages.push({ run: () => this.#applyDataModel(body) }) // ADR-0233/0241: in order behind the pending load
      return
    }
    this.#applyDataModel(body)
  }

  #applyDataModel(body: A2uiUpdateDataModel): void {
    const surface = this.#store.get(body.surfaceId)
    if (surface === undefined) return
    // Whole-document replace when no path, "" or "/" (the upstream protocol's root alias for
    // updateDataModel — ADR-0099; SPEC-R5 AC2). Else an immutable, structural-sharing RFC-6901 set via
    // the binding module (LLD-C5). Sharing untouched sibling subtrees by reference is what lets the
    // per-path computeds' `Object.is` cutoff keep unrelated bindings asleep (SPEC-N2) — see binding.ts.
    // NOTE: the alias lives here, at the protocol-message layer — setPointer stays RFC-6901-pure for
    // every other pointer (deeper `""` keys, e.g. "/a/", still resolve as the empty-string child key).
    if (body.path === undefined || body.path === '' || body.path === '/') {
      surface.data.value = body.value
      return
    }
    surface.data.value = setPointer(surface.data.peek(), body.path, body.value)
  }

  #onDeleteSurface(body: A2uiDeleteSurface): void {
    this.#teardownSurfaceDom(body.surfaceId)
    this.#store.delete(body.surfaceId) // disposes scope + aborts; no-op if unknown (late message)
    this.#releaseSettled()
  }

  // ── deferred apply (ADR-0233, ADR-0241) ───────────────────────────────────────────

  /**
   * The catalog gate (ADR-0241): give the new surface `surfaceId` a queue and load `catalogId`'s body into this
   * renderer. On resolve the queue takes the loaded entry's control loader and drains through the control gate;
   * on reject the host emits one `CATALOG_LOAD`, drops the queued messages and removes the surface.
   */
  #awaitCatalog(surfaceId: string, catalogId: string): void {
    const queue: SurfaceQueue = { catalogId, loader: undefined, messages: [] }
    this.#queues.set(surfaceId, queue)
    const settle = (error: unknown): void => {
      if (this.#disposed || this.#queues.get(surfaceId) !== queue) return // late: surface gone or host disposed
      if (error === undefined) {
        queue.loader = this.#registry.get(catalogId)?.controls
        this.#drain(surfaceId, queue, false)
        return
      }
      this.#emitInternalError(this.#versionFor(surfaceId), {
        code: 'CATALOG_LOAD',
        surfaceId,
        message: error instanceof Error ? error.message : `catalog "${catalogId}" failed to load`,
      })
      this.#onDeleteSurface({ surfaceId })
    }
    this.#registry.ensure(catalogId).then(
      () => settle(undefined),
      (error: unknown) => settle(error ?? new Error(`catalog "${catalogId}" failed to load`)),
    )
  }

  /**
   * The custom-element tags the factories of `body`'s components create (every arm of a variant table):
   * each factory's `tag` plus its `uses`. A non-custom tag (`div`, `img`, a `div[role=option]` selector) is
   * never a control, so it is dropped.
   */
  #controlTagsOf(catalogId: string, body: A2uiUpdateComponents): string[] {
    const factories = this.#registry.get(catalogId)?.factories
    const tags = new Set<string>()
    if (factories === undefined || !Array.isArray(body.components)) return []
    for (const node of body.components) {
      const type = (node as { component?: unknown } | null)?.component
      if (typeof type !== 'string' || !Object.hasOwn(factories, type)) continue
      for (const factory of factoriesOf(factories[type]!)) {
        for (const tag of [factory.tag, ...(factory.uses ?? [])]) if (isControlTag(tag)) tags.add(tag)
      }
    }
    return [...tags]
  }

  /**
   * Run `queue`'s messages in order, once its catalog is loaded. A queued `updateComponents` whose tags (read at
   * drain time, since a message queued behind the catalog gate had no factories to read) are still missing starts
   * one `ensure` and stops the drain until it settles; `failed` (after a failed control load) applies everything,
   * so a still-undefined tag renders as a placeholder. Stops as soon as the queue is dropped (deleteSurface or
   * dispose from inside a message), and removes the queue once it is empty.
   */
  #drain(id: string, queue: SurfaceQueue, failed: boolean): void {
    while (this.#queues.get(id) === queue && queue.messages.length > 0) {
      const next = queue.messages[0]!
      if (!failed && next.components !== undefined && queue.loader !== undefined) {
        const missing = queue.loader.missing(this.#controlTagsOf(queue.catalogId, next.components))
        if (missing.length > 0) {
          this.#ensureControls(id, queue, queue.loader, missing)
          return
        }
      }
      queue.messages.shift()
      next.run()
    }
    if (this.#queues.get(id) === queue) {
      this.#queues.delete(id)
      this.#releaseSettled()
    }
  }

  /** Start one `ensure` for `queue`; on settle, drain (or report `CONTROL_LOAD` once and drain anyway). */
  #ensureControls(id: string, queue: SurfaceQueue, loader: ControlLoader, tags: readonly string[]): void {
    const settle = (error: unknown): void => {
      if (this.#disposed || this.#queues.get(id) !== queue) return // late: surface gone or host disposed
      const stillMissing = error === undefined ? loader.missing(tags) : tags
      if (error === undefined && stillMissing.length === 0) {
        this.#drain(id, queue, false)
        return
      }
      const reason = error instanceof Error ? `: ${error.message}` : ''
      this.#emitInternalError(this.#versionFor(id), {
        code: 'CONTROL_LOAD',
        surfaceId: id,
        message: `controls failed to load (${stillMissing.join(', ')})${reason}`,
      })
      this.#drain(id, queue, true)
    }
    let pending: Promise<void>
    try {
      pending = loader.ensure(tags)
    } catch (error) {
      pending = Promise.reject(error)
    }
    pending.then(
      () => settle(undefined),
      (error: unknown) => settle(error ?? new Error('control load rejected')),
    )
  }

  #finalizeOrQueue(id: string): void {
    const queued = this.#queues.get(id)
    if (queued !== undefined) {
      // ADR-0233/0241: finalize judges the COMPLETE component set, so it waits behind the queued messages.
      queued.messages.push({ run: () => this.#finalizeSurface(id) })
      return
    }
    this.#finalizeSurface(id)
  }

  #onTreeError(surfaceId: string, error: A2uiError): void {
    // The tree only emits IDGRAPH (2nd root / cycle), in-stream. Mark the surface so `finalize` does not
    // re-report the same id-graph defect (the always-invalid cases are the tree's, not finalize's).
    this.#poisoned.add(surfaceId)
    this.#emitInternalError(this.#versionFor(surfaceId), error)
  }

  // ── widget resolution + action wiring ─────────────────────────────────────────────

  /**
   * The host's create/wire split (RSR-C3, ADR-0128 — a pure refactor of the prior fused
   * `#makeHostCreateWidget`, zero behavior change on its own). `#create` mints ONLY the element
   * (`widget.ts`'s `create`, no action-prop stripping needed — nothing is applied yet); `#wireNode`
   * applies the base props (action-typed props stripped first, so the action object is never
   * `applyProp`'d/stringified onto the DOM), then wires the click→action trigger + the checks controller
   * onto an ALREADY-EXISTING element. `#makeHostCreateWidget` composes both for every ordinary mount path
   * (`tree.ts`'s `#mountNode`/`#mountInstance`, `list.ts`'s `appendInstance`) — byte-for-byte the prior
   * fused behavior. Structural-resend reconciliation (`tree.ts`'s `#reconcileProps`) calls `#wireNode`
   * directly, via the `rewireNode` collaborator wired into `TreeDeps` above, never `#create` again.
   */
  #create(node: A2uiComponent, surface: Surface): HTMLElement {
    return createOnly(node, surface, this.#widgetDeps)
  }

  #wireNode(el: HTMLElement, node: A2uiComponent, surface: Surface, scope: Scope, itemScope: ItemScope | undefined, ac: AbortController): void {
    // ADR-0233: a placeholder minted for a control that failed to load stays inert (no props, actions or checks).
    if (isPlaceholder(el) && this.#registry.get(surface.catalogId)?.controls !== undefined) return
    const actionProps = this.#actionPropsOf(node, surface)
    wireProps(el, actionProps.size === 0 ? node : withoutProps(node, actionProps), surface, scope, itemScope, ac, this.#widgetDeps)
    // GH #1164 (found by its superseded/revive real-engine test): a structural resend re-enters this
    // wire path for an ALREADY-WIRED element (`tree.ts`'s `#reconcileProps` → `rewireNode`), and each
    // pass used to ADD another click→action listener — N resends = N dispatches per click. Retire the
    // element's previous action listeners before wiring the new set, so re-wiring is idempotent.
    this.#actionWiring.get(el)?.abort()
    if (actionProps.size > 0) {
      const rewireAc = new AbortController()
      ac.signal.addEventListener('abort', () => rewireAc.abort(), { once: true, signal: rewireAc.signal })
      this.#actionWiring.set(el, rewireAc)
      for (const spec of actionProps.values()) this.#wireAction(el, node, surface, spec, itemScope, rewireAc)
    }
    // Wire the checks controller (ADR-0029): reads node.checks, installs one scope-owned effect that
    // evaluates each check via evaluate (LLD-C10) and drives setCustomValidity / el.disabled.
    // A no-op when node.checks is absent or empty (the common case — no overhead).
    wireChecks(el, node, surface, scope, ac, itemScope, this.#emitError, this.#registry)
  }

  #makeHostCreateWidget(): CreateWidget {
    return (node, surface, scope = surface.scope, itemScope, ac = surface.ac) => {
      const el = this.#create(node, surface)
      this.#wireNode(el, node, surface, scope, itemScope, ac)
      return el
    }
  }

  /** Per-element action-listener ownership (GH #1164): the AbortController holding an element's CURRENT
   *  click→action listeners, aborted and replaced on every `#wireNode` pass so a structural resend never
   *  stacks a second listener. WeakMap — a torn-down element is never leak-held; each controller also
   *  chains to its wiring pass's own `ac` so surface/item teardown still kills the listeners. */
  #actionWiring = new WeakMap<HTMLElement, AbortController>()

  /** The node's props whose catalog `mapsTo` is `'action'` (the click→action triggers), keyed by prop name. */
  #actionPropsOf(node: A2uiComponent, surface: Surface): Map<string, unknown> {
    const out = new Map<string, unknown>()
    const def = this.#registry.get(surface.catalogId)?.catalog.components[node.component]
    if (def === undefined) return out
    for (const [prop, pd] of Object.entries(def.properties)) {
      if (pd.mapsTo === 'action' && node[prop] !== undefined) out.set(prop, node[prop])
    }
    return out
  }

  /**
   * Wire a control's `click` to emit an A2UI action for `node`. The listener is gated on `ac`
   * (surface.ac for static nodes, the per-item AbortController for list items aborted on positional
   * removal). This is the action-side SPEC-N3 item-granular discipline: a removed list item's click
   * listener dies with the item, not at surface teardown.
   *
   * ADR-0054: a `submit:true`-flagged action additionally gates on `#submitGatePermits` before
   * emitting — an un-flagged action (the common case) is byte-for-byte the pre-ADR-0054 behavior.
   *
   * GH #1748: `itemScope` is the node's list-item scope (absent for a static node), threaded from
   * `#wireNode` exactly as `wireProps`/`wireChecks` receive it, so `#collectContext` resolves the
   * action's `context` against the row the clicked control belongs to.
   */
  #wireAction(
    el: HTMLElement,
    node: A2uiComponent,
    surface: Surface,
    spec: unknown,
    itemScope: ItemScope | undefined,
    ac: AbortController,
  ): void {
    const { name, wantResponse, context, submit } = readActionSpec(spec)
    el.addEventListener(
      'click',
      () => {
        // GH #1164 — a DISABLED control never emits: real pointers can't reach it, but a synthetic
        // `.click()` still fires this native listener; check synchronously at click time (emitAction is
        // async — a callback-time guard downstream can race a later re-enable and leak the action).
        if ((el as Partial<{ disabled: boolean }>).disabled === true) return
        if (submit === true && !this.#submitGatePermits(el)) return // gated + refused — no emit (ADR-0054)
        void this.#actions.emitAction(node, surface, {
          name,
          wantResponse,
          context: this.#collectContext(context, surface, itemScope),
        })
      },
      { signal: ac.signal },
    )
  }

  /**
   * LLD-C9 `collectContext` (SPEC-R8 AC1 "resolved context"; GH #1748). Resolves each `context` entry
   * through the host's `resolveValue` dispatcher, the SAME rule `wireProps` (bound props) and
   * `wireChecks` (check args) apply: a literal passes through as-is, a `{path}` reads the data model
   * (relative → `{itemScope.path}/{index}/…` inside a list item, absolute → root), a `{call}` evaluates
   * (`@index` = the row index), and a `${…}` string interpolates. One level, per key, exactly as
   * `evaluate` resolves a call's named args. Read at CLICK time so the context carries the CURRENT data
   * (a committed two-way bind included, LLD-C8), and `untracked` so a click dispatched from inside some
   * effect never subscribes that effect to the context's paths (the same posture as `emitAction`'s
   * `surface.data.peek()` for `sendDataModel`). `undefined` in ⇒ `undefined` out (`emitAction` defaults
   * the wire `context` to `{}`).
   */
  #collectContext(
    context: Record<string, unknown> | undefined,
    surface: Surface,
    itemScope: ItemScope | undefined,
  ): Record<string, unknown> | undefined {
    if (context === undefined) return undefined
    return untracked(() => {
      const out: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(context)) out[key] = this.#widgetDeps.resolveValue(value, surface, itemScope)
      return out
    })
  }

  /**
   * ADR-0054 gate check for a `submit:true` action click. The registry's derived selector (across ALL
   * registered catalogs, two-tier) is empty when no factory carries `submitGate` — the provable no-op
   * (never call `closest('')`, a `SyntaxError`). No matching ancestor is the same graceful fallthrough
   * as an unflagged Button (an un-nested submit Button keeps working). A matched gate's `submit()` is
   * the sole arbiter, per the structural contract (catalog SPEC §5.1) — defensively optional-chained
   * so a non-conforming gate control degrades to "permit" rather than throw.
   */
  #submitGatePermits(el: HTMLElement): boolean {
    const selector = this.#registry.submitGateSelector()
    if (selector === '') return true
    const gate = el.closest(selector)
    if (gate === null) return true
    return (gate as unknown as { submit?: () => boolean }).submit?.() ?? true
  }

  // ── finalize + emit helpers ────────────────────────────────────────────────────────

  #finalizeSurface(id: string): void {
    if (this.#poisoned.has(id)) return // the tree already reported this surface's id-graph defect in-stream
    const surface = this.#store.get(id)
    const entry = surface && this.#registry.get(surface.catalogId)
    if (!surface || !entry) return

    // Run the SHARED validator on the COMPLETE component set (parity, N6): its id-graph verdict (missing
    // `root`, dangling — the finalize-only judgments this stage exists to catch) PLUS, as of GH #887/#888,
    // its CATALOG + POINTER verdicts — see the module header for why those are no longer assumed-covered
    // by the widget resolver. CONTAINMENT stays finalize-silent for now (untouched by either issue; the
    // renderer's own live rendering never gates on it either — a follow-up, not widened here).
    //
    // ADR-0187 / GH #829 — the CLIENT half of the finalize signal. This method exists precisely to judge
    // the COMPLETE set at finalize (LLD-C11 §8), so it is the one call site whose `atFinalize` assertion
    // is definitional. Before the flag, a `createSurface`-only surface re-framed here as
    // `updateComponents { components: [] }` hit `checkIdGraph`'s empty-set early return and was waved
    // through — the empty `ui-surface-host` had no error to show, only its silent `:empty` placeholder
    // (GH #802). Now it fails `${id}:root-missing`, and because ADR-0187 REUSES the existing IDGRAPH code
    // the loop below passes it through unmodified → `VALIDATION_FAILED` on the wire, zero widening — the
    // SAME reuse-not-widen posture GH #887/#888's CATALOG/POINTER arm below follows.
    const complete: A2uiServerMessage = {
      version: surface.version,
      updateComponents: { surfaceId: id, components: [...surface.components.values()] },
    }
    for (const failure of validateA2ui(complete, entry.catalog, undefined, { atFinalize: true }).failures) {
      if (failure.code === 'IDGRAPH') {
        this.#emitInternalError(surface.version, {
          code: 'IDGRAPH',
          surfaceId: id,
          path: failure.path,
          message: `id-graph violation: ${failure.path}`,
        })
        continue
      }
      if (failure.code === 'CATALOG' || failure.code === 'POINTER') {
        // Skip a CATALOG finding at a `path` the widget resolver ALREADY reported live (the unknown-
        // component-type case, SPEC-R9 AC2) — everything else here (an unknown/mismatched PROPERTY, or
        // any POINTER finding) has NEVER been live-reported, by construction (see the module header).
        if (failure.code === 'CATALOG' && this.#liveCatalogPaths.get(id)?.has(failure.path)) continue
        this.#emitInternalError(surface.version, {
          code: failure.code,
          surfaceId: id,
          path: failure.path,
          message: `${failure.code === 'CATALOG' ? 'catalog conformance' : 'binding pointer'} violation: ${failure.path}`,
        })
      }
    }
  }

  /** Append a surface's rendered root under the mount, once, after it first mounts on a valid `root`. */
  #attachRoot(surfaceId: string, tree: SurfaceTree): void {
    if (this.#mountEl === undefined || this.#attached.has(surfaceId)) return
    const root = tree.rootElement
    if (root === undefined) return
    root.setAttribute('data-a2ui-surface', surfaceId) // per-surface DOM marker (GH #1165) — lets a host verify THIS surface's root is present
    this.#mountEl.appendChild(root)
    this.#attached.add(surfaceId)
  }

  /** Detach + forget a surface's render state (DOM root, tree, attach/poison flags). */
  #teardownSurfaceDom(id: string): void {
    const root = this.#trees.get(id)?.rootElement
    root?.parentNode?.removeChild(root)
    this.#trees.delete(id)
    this.#attached.delete(id)
    this.#poisoned.delete(id)
    this.#liveCatalogPaths.delete(id) // a fresh createSurface at this id starts with a clean de-dupe set
    this.#queues.delete(id) // ADR-0233/0241: a pending queue dies with its surface; a late settle is a no-op
  }

  /**
   * The single outbound client→server error chokepoint (ADR-0031 clause 1). Applies `toWireError`
   * to map the 9-code internal `A2uiError` to the v1.0 two-code `A2uiWireError` before emitting.
   * Internal callers (emitError, #onCreateSurface, #onTreeError, #finalizeSurface, ingest) all
   * route here — keeping the mapping in one place so no emit site produces a raw internal code on
   * the wire. The `#emit` method below is the pure mechanical broadcaster (actions use it directly).
   */
  #emitInternalError(version: string, error: A2uiError): void {
    this.#emit({ version, error: toWireError(error) })
  }

  #emit(message: A2uiClientMessage): void {
    for (const listener of [...this.#listeners]) listener(message)
  }

  #versionFor(surfaceId: string | undefined): string {
    if (surfaceId !== undefined) {
      const surface = this.#store.get(surfaceId)
      if (surface !== undefined) return surface.version
    }
    return this.#defaultVersion
  }
}

// ── module helpers ──────────────────────────────────────────────────────────────────

/** One message held behind a pending catalog or control load (ADR-0233/0241). `components` marks an `updateComponents`. */
interface QueuedMessage {
  readonly components?: A2uiUpdateComponents
  readonly run: () => void
}

/**
 * A surface's deferred-apply queue and its messages, in arrival order. `loader` is the catalog's control loader;
 * it is `undefined` while the catalog body loads (no drain runs then) and for a loaded catalog without one.
 */
interface SurfaceQueue {
  readonly catalogId: string
  loader: ControlLoader | undefined
  readonly messages: QueuedMessage[]
}

/** Read the `version` off a parsed server message, falling back when a malformed-but-parsed line lacks it. */
function versionOf(message: A2uiServerMessage, fallback: string): string {
  const v = (message as { version?: unknown }).version
  return typeof v === 'string' ? v : fallback
}

// `readActionSpec` (A1/A2/A3 — the Button action-prop Postel reader) moved to `./wire-tolerances.ts`
// (GH #484 move phase — the wire-tolerance registry `wire-tolerances.md`'s INDEX anticipated).

/** A shallow copy of `node` with the given prop names removed (the action-typed props the host re-wires). */
function withoutProps(node: A2uiComponent, props: Map<string, unknown>): A2uiComponent {
  const out: A2uiComponent = { ...node }
  for (const prop of props.keys()) delete out[prop]
  return out
}
