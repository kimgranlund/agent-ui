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
// component set (parity with corpus admission, N6) and emits only its id-graph verdict.
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
import type { CreateWidget, ItemScope } from './types.ts'
import type { Scope } from '@agent-ui/components'
import { Registry } from '../catalog/registry.ts'
import type { WidgetFactory } from '../catalog/types.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { defaultFactories } from '../catalog/default/factories.ts'
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
}

/**
 * The renderer host public surface (renderer SPEC §5.3, adapted: `ingest` takes a raw JSONL line so the
 * transport hands lines straight through). The wave-4 canvas consumes exactly this.
 */
export interface RendererHost {
  /** Register an additional catalog + its factory table (two-tier, SPEC-R6/N1; delegates to the registry). */
  register(catalog: unknown, factories: Record<string, WidgetFactory>): void
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
  readonly #listeners = new Set<ClientMessageListener>()
  readonly #actions: ActionDispatcher
  readonly #createWidget: CreateWidget
  readonly #widgetDeps: WidgetDeps
  readonly #emitError: (error: A2uiError) => void
  readonly #handlers: DispatchHandlers
  readonly #defaultVersion: string
  #mountEl: HTMLElement | undefined
  #disposed = false

  constructor(options: RendererOptions) {
    this.#defaultVersion = options.defaultVersion ?? 'v1.0'

    // Per-runtime registry, default catalog pre-registered so `catalogId:'agent-ui'` resolves out of the
    // box (two-tier: a project registers more via `register`, SPEC-R6/N1).
    this.#registry.register(defaultCatalog, defaultFactories)

    let seq = 0
    this.#actions = new ActionDispatcher({
      newId: options.newId ?? (() => `a2ui-action-${++seq}`),
      now: options.now ?? (() => new Date().toISOString()),
      emitClient: (message) => this.#emit(message),
      warn: options.warn,
    })

    // The internal error sink: applies toWireError at the single client→server chokepoint (ADR-0031
    // clause 1/2) so every outbound error carries the v1.0 two-code wire shape. Internal callers
    // (functions.ts / checks.ts) still receive and emit `A2uiError` (the 8-code internal taxonomy)
    // unchanged — the map is applied HERE, not at the emit sites.
    this.#emitError = (error) => this.#emitInternalError(this.#versionFor(error.surfaceId), error)
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

  register(catalog: unknown, factories: Record<string, WidgetFactory>): void {
    this.#registry.register(catalog, factories)
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

    const surface = this.#store.create({
      id: body.surfaceId,
      catalogId: body.catalogId,
      version,
      // v0.9.x carries `theme` where v1.0 carries `surfaceProperties` (SPEC-R13 AC1); prefer the v1.0 field.
      surfaceProperties: body.surfaceProperties ?? body.theme,
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
          const factory = this.#registry.get(surface.catalogId)?.factories[node.component]
          factory?.applyProp(el, prop, value)
        },
        componentDefOf: (node, surface) => this.#registry.get(surface.catalogId)?.catalog?.components?.[node.component],
        onError: (error) => this.#onTreeError(surface.id, error),
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

    // Run the SHARED validator on the COMPLETE component set (parity, N6). Emit only its id-graph
    // verdict: CATALOG/POINTER are render-time concerns already surfaced by the widget resolver, and the
    // finalize-only id-graph judgments (missing `root`, dangling) are what this stage exists to catch.
    const complete: A2uiServerMessage = {
      version: surface.version,
      updateComponents: { surfaceId: id, components: [...surface.components.values()] },
    }
    for (const failure of validateA2ui(complete, entry.catalog).failures) {
      if (failure.code !== 'IDGRAPH') continue
      this.#emitInternalError(surface.version, {
        code: 'IDGRAPH',
        surfaceId: id,
        path: failure.path,
        message: `id-graph violation: ${failure.path}`,
      })
    }
  }

  /** Append a surface's rendered root under the mount, once, after it first mounts on a valid `root`. */
  #attachRoot(surfaceId: string, tree: SurfaceTree): void {
    if (this.#mountEl === undefined || this.#attached.has(surfaceId)) return
    const root = tree.rootElement
    if (root === undefined) return
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
  }

  /**
   * The single outbound client→server error chokepoint (ADR-0031 clause 1). Applies `toWireError`
   * to map the 8-code internal `A2uiError` to the v1.0 two-code `A2uiWireError` before emitting.
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

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Read the `version` off a parsed server message, falling back when a malformed-but-parsed line lacks it. */
function versionOf(message: A2uiServerMessage, fallback: string): string {
  const v = (message as { version?: unknown }).version
  return typeof v === 'string' ? v : fallback
}

/**
 * Interpret a Button's `action` prop value into the action-emission inputs. The CANONICAL inbound
 * shape is `{ action, context?, wantResponse?, submit? }` (ADR-0011 + the ADR-0054 `submit` extension,
 * pinned in the catalog SPEC §5.1/§5.2 + `catalog/default/catalog.json`): `action` is the action NAME,
 * `context`/`wantResponse` are surfaced straight off the canonical object, and `submit:true` is a
 * CLIENT-consumed flag `#wireAction` reads to gate the click — it is NEVER part of the emitted wire
 * message (ADR-0054 clause 1; the outbound `A2uiAction` shape is untouched). Two fallbacks are
 * RETAINED as documented Postel's-law tolerance — not silent guesses: `name` is accepted as a synonym
 * for the name key, and a bare string is taken as the action name (carrying no
 * `context`/`wantResponse`/`submit`). Canonical `action` wins when both keys are present.
 */
function readActionSpec(
  spec: unknown,
): { name: string; wantResponse?: boolean; context?: Record<string, unknown>; submit?: boolean } {
  // Tolerance: a bare string is the action name (no context/wantResponse/submit to surface).
  if (typeof spec === 'string') return { name: spec }
  if (isObject(spec)) {
    // Canonical `action` (ADR-0011); `name` is the tolerated synonym, taken only when `action` is absent.
    const name = typeof spec.action === 'string' ? spec.action : typeof spec.name === 'string' ? spec.name : ''
    const out: { name: string; wantResponse?: boolean; context?: Record<string, unknown>; submit?: boolean } = { name }
    // `context`/`wantResponse`/`submit` surface from the canonical object (also honored on the `name`-synonym shape).
    // `wantResponse` is captured whenever the author wrote it as a real boolean — `true` OR `false` — never
    // just `=== true`: ADR-0088 §3 routes on the DISTINCTION between "explicitly false" (opt-out) and "never
    // authored" (stays `undefined` here, through `emitAction`'s own preserving assignment, to the wire).
    if (typeof spec.wantResponse === 'boolean') out.wantResponse = spec.wantResponse
    if (isObject(spec.context)) out.context = spec.context
    if (spec.submit === true) out.submit = true
    return out
  }
  return { name: '' }
}

/** A shallow copy of `node` with the given prop names removed (the action-typed props the host re-wires). */
function withoutProps(node: A2uiComponent, props: Map<string, unknown>): A2uiComponent {
  const out: A2uiComponent = { ...node }
  for (const prop of props.keys()) delete out[prop]
  return out
}
