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
// The submit-gated action (ADR-0054). An action object may carry a CLIENT-consumed `submit: true` flag
// (never on the wire — stripped by `readActionSpec`, ADR-0011's shape stays byte-identical). On such a
// flagged click, `#wireAction` resolves `el.closest(registry.submitGateSelector())` — the registry's
// derived selector over every registered catalog's `submitGate`-marked factories (two-tier). A matched
// gate's own `submit()` is the sole arbiter (`false` → no emit, the gate already ran first-invalid
// `reportValidity`; `true` → emit); no gate ancestor, or an empty selector (no `submitGate` factory
// registered anywhere), is the SAME graceful fallthrough as an unflagged Button.

import { dispatch } from './dispatch.ts'
import type { DispatchHandlers } from './dispatch.ts'
import { parseLine, isParseError } from './parser.ts'
import { SurfaceStore } from './surface.ts'
import type { Surface } from './surface.ts'
import { SurfaceTree } from './tree.ts'
import { create as createOnly, wireProps } from './widget.ts'
import type { WidgetDeps } from './widget.ts'
import { wireChecks } from './checks.ts'
import { ActionDispatcher } from './action.ts'
import { validateA2ui } from './validate.ts'
import { resolveValue as dispatchValue } from './functions.ts'
import { setPointer } from './binding.ts'
import { readActionSpec } from './wire-tolerances.ts' // GH #484 move phase — A1/A2/A3 (was local to this file)
import type { CreateWidget, ItemScope } from './types.ts'
import type { Scope } from '@agent-ui/components'
import { Registry } from '../catalog/registry.ts'
import type { WidgetFactory } from '../catalog/types.ts'
import { resolveFactory } from '../catalog/variant.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { defaultFactories } from '../catalog/default/factories.ts'
import { a2uiBasicCatalog, a2uiBasicCatalogCanonical } from '../catalog/a2ui-basic/index.ts'
import { a2uiBasicFactories } from '../catalog/a2ui-basic/factories.ts'
import { a2uiBasicFunctions } from '../catalog/a2ui-basic/functions.ts'
import { composePersonaCatalogs } from '../catalog/compose.ts'
import { SHIPPED_PERSONA_CATALOGS } from '../catalog/personas/index.ts'
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
   *  `functions` (ADR-0169 cl.8) is an optional per-catalog function-impl override table, forwarded verbatim. */
  register(catalog: unknown, factories: Record<string, WidgetFactory>, functions?: Record<string, (args: Record<string, unknown>) => unknown>): void
  /** Set the element rendered surface roots attach under; re-attaches any already-mounted roots. */
  mount(rootEl: HTMLElement): void
  /** Ingest one raw JSONL line: skip-blank → parse → dispatch (PARSE on a malformed line, N4). */
  ingest(line: string): void
  /** Ingest an already-parsed server message (the post-parse path; also used internally by `ingest`). */
  ingestMessage(message: A2uiServerMessage): void
  /** Subscribe to client→server messages (actions + errors); returns an unsubscribe (SPEC-R8/R11). */
  onClientMessage(listener: ClientMessageListener): () => void
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
  #mountEl: HTMLElement | undefined
  #disposed = false

  constructor(options: RendererOptions) {
    this.#defaultVersion = options.defaultVersion ?? 'v1.0'
    this.#revealOrder = options.revealOrder ?? false

    // Per-runtime registry, default catalog pre-registered so `catalogId:'agent-ui'` resolves out of the
    // box (two-tier: a project registers more via `register`, SPEC-R6/N1).
    this.#registry.register(defaultCatalog, defaultFactories)
    // ADR-0169 cl.2 — the upstream A2UI v0.9.1 Basic Catalog registers beside the default on EVERY
    // renderer host: interop is a property of the PACKAGE, not a demo of one page. `a2uiBasicCatalog`
    // (the local short id `a2ui-basic`) and `a2uiBasicCatalogCanonical` (the same components/factories/
    // functions bytes, keyed by the upstream canonical URI — an INBOUND-ONLY alias, cl.13) share ONE
    // factory table and ONE function-impl table.
    this.#registry.register(a2uiBasicCatalog, a2uiBasicFactories, a2uiBasicFunctions)
    this.#registry.register(a2uiBasicCatalogCanonical, a2uiBasicFactories, a2uiBasicFunctions)
    // M-D (`persona-catalog-composition.spec.md` SPEC-R2, ADR-0172 cl.2) — the derive-then-register step:
    // every shipped `catalog/personas/<persona-id>/` package composes over every base its own
    // `targetCatalogs` names and registers under its derived `<base>--<persona>` id (OF1b). Strictly
    // upstream of `register()` (SPEC-N4) — reject-loud (`CatalogComposeError`) on a name collision or an
    // unregistered target-base id, synchronously, right here at construction time.
    composePersonaCatalogs(this.#registry, SHIPPED_PERSONA_CATALOGS)

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

  register(catalog: unknown, factories: Record<string, WidgetFactory>, functions?: Record<string, (args: Record<string, unknown>) => unknown>): void {
    this.#registry.register(catalog, factories, functions)
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

  finalize(surfaceId?: string): void {
    if (surfaceId !== undefined) {
      this.#finalizeSurface(surfaceId)
      return
    }
    for (const id of this.#trees.keys()) this.#finalizeSurface(id)
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    for (const id of [...this.#trees.keys()]) this.#teardownSurfaceDom(id)
    this.#store.disposeAll() // disposes every surface scope + aborts every listener (N3)
    this.#listeners.clear()
    this.#mountEl = undefined
  }

  // ── dispatch handlers ───────────────────────────────────────────────────────────

  #onCreateSurface(body: A2uiCreateSurface, version: string): void {
    // Resolve catalogId against the registry — an unbound catalog is `CATALOG_UNKNOWN`, no surface (R2 AC3).
    if (this.#registry.get(body.catalogId) === undefined) {
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
  }

  #onUpdateComponents(body: A2uiUpdateComponents, version: string): void {
    const surface = this.#store.get(body.surfaceId)
    const tree = this.#trees.get(body.surfaceId)
    if (surface === undefined || tree === undefined) return // unknown/deleted surface → no-op (LLD §9)
    tree.apply({ version, updateComponents: body })
    this.#attachRoot(body.surfaceId, tree)
  }

  #onUpdateDataModel(body: A2uiUpdateDataModel): void {
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
    const actionProps = this.#actionPropsOf(node, surface)
    wireProps(el, actionProps.size === 0 ? node : withoutProps(node, actionProps), surface, scope, itemScope, ac, this.#widgetDeps)
    for (const spec of actionProps.values()) this.#wireAction(el, node, surface, spec, ac)
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
   */
  #wireAction(el: HTMLElement, node: A2uiComponent, surface: Surface, spec: unknown, ac: AbortController): void {
    const { name, wantResponse, context, submit } = readActionSpec(spec)
    el.addEventListener(
      'click',
      () => {
        if (submit === true && !this.#submitGatePermits(el)) return // gated + refused — no emit (ADR-0054)
        void this.#actions.emitAction(node, surface, { name, wantResponse, context })
      },
      { signal: ac.signal },
    )
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
