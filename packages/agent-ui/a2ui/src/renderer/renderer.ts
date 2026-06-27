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

import { dispatch } from './dispatch.ts'
import type { DispatchHandlers } from './dispatch.ts'
import { parseLine, isParseError } from './parser.ts'
import { SurfaceStore } from './surface.ts'
import type { Surface } from './surface.ts'
import { SurfaceTree } from './tree.ts'
import { makeCreateWidget } from './widget.ts'
import { ActionDispatcher } from './action.ts'
import { validateA2ui } from './validate.ts'
import type { CreateWidget } from './types.ts'
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
} from '../protocol.ts'

/** An `error` client→server envelope (runtime SPEC §5.2) — the second `A2uiClientMessage` arm. */
export interface A2uiErrorMessage {
  version: string
  error: A2uiError
}

/** Everything the renderer emits to the server: a triggered action, or an error (runtime SPEC §5.2). */
export type A2uiClientMessage = A2uiActionMessage | A2uiErrorMessage

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

    this.#createWidget = this.#makeHostCreateWidget()

    // Handlers close over the store; each applies its slice and (where relevant) version-specific
    // semantics. Routing/version errors are `dispatch`'s concern and surface from `ingestMessage`.
    this.#handlers = {
      createSurface: (body, version) => this.#onCreateSurface(body, version),
      updateComponents: (body, version) => this.#onUpdateComponents(body, version),
      updateDataModel: (body) => this.#onUpdateDataModel(body),
      deleteSurface: (body) => this.#onDeleteSurface(body),
      actionResponse: (body) => void this.#actions.actionResponse(body),
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
      this.#emit({ version: this.#defaultVersion, error: { code: 'PARSE', message: result.message } })
      return
    }
    this.ingestMessage(result)
  }

  ingestMessage(message: A2uiServerMessage): void {
    const error = dispatch(message, this.#handlers)
    if (error !== undefined) this.#emit({ version: versionOf(message, this.#defaultVersion), error })
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
      this.#emit({
        version,
        error: { code: 'CATALOG_UNKNOWN', surfaceId: body.surfaceId, message: `unknown catalogId "${body.catalogId}"` },
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
    // Whole-document replace when no path; else an immutable RFC-6901 set. Per-path *wake granularity*
    // (SPEC-N2) is the binding slice's job (LLD-C5, not yet built) — this writes the one data signal so
    // every bound-prop effect re-resolves; correct, if coarse, until LLD-C5 memoizes per-path computeds.
    if (body.path === undefined || body.path === '') {
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
    this.#emit({ version: this.#versionFor(surfaceId), error })
  }

  // ── widget resolution + action wiring ─────────────────────────────────────────────

  /**
   * The host's `createWidget`: the base catalog resolver (LLD-C7) plus the action trigger. Action-typed
   * props are stripped before the base resolver (so the action object is never `applyProp`'d onto the
   * DOM) and re-expressed as a `click → emitAction` listener owned by the surface's `AbortController`.
   */
  #makeHostCreateWidget(): CreateWidget {
    const base = makeCreateWidget({
      registry: this.#registry,
      emitError: (error) => this.#emit({ version: this.#versionFor(error.surfaceId), error }),
      // Interim binding resolver (an absolute RFC-6901 read off the surface data signal). The full
      // per-path-computed resolver is LLD-C5 (not yet built); reading `data.value` here keeps bound
      // props live and lets the bound-prop effect track the data model.
      resolveBinding: (binding, surface) => resolvePointer(surface.data.value, binding.path),
    })

    return (node, surface) => {
      const actionProps = this.#actionPropsOf(node, surface)
      const el = base(actionProps.size === 0 ? node : withoutProps(node, actionProps), surface)
      for (const spec of actionProps.values()) this.#wireAction(el, node, surface, spec)
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

  /** Wire a control's `click` to emit an A2UI action for `node` (listener owned by `surface.ac`, N3). */
  #wireAction(el: HTMLElement, node: A2uiComponent, surface: Surface, spec: unknown): void {
    const { name, wantResponse, context } = readActionSpec(spec)
    el.addEventListener(
      'click',
      () => void this.#actions.emitAction(node, surface, { name, wantResponse, context }),
      { signal: surface.ac.signal },
    )
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
      this.#emit({
        version: surface.version,
        error: { code: 'IDGRAPH', surfaceId: id, path: failure.path, message: `id-graph violation: ${failure.path}` },
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
 * shape is `{ action, context?, wantResponse? }` (ADR-0011, pinned in the catalog SPEC §5.1/§5.2 +
 * `catalog/default/catalog.json`): `action` is the action NAME, and `context`/`wantResponse` are
 * surfaced straight off the canonical object. Two fallbacks are RETAINED as documented Postel's-law
 * tolerance — not silent guesses: `name` is accepted as a synonym for the name key, and a bare string
 * is taken as the action name (carrying no `context`/`wantResponse`). Canonical `action` wins when
 * both keys are present.
 */
function readActionSpec(spec: unknown): { name: string; wantResponse?: boolean; context?: Record<string, unknown> } {
  // Tolerance: a bare string is the action name (no context/wantResponse to surface).
  if (typeof spec === 'string') return { name: spec }
  if (isObject(spec)) {
    // Canonical `action` (ADR-0011); `name` is the tolerated synonym, taken only when `action` is absent.
    const name = typeof spec.action === 'string' ? spec.action : typeof spec.name === 'string' ? spec.name : ''
    const out: { name: string; wantResponse?: boolean; context?: Record<string, unknown> } = { name }
    // `context`/`wantResponse` surface from the canonical object (also honored on the `name`-synonym shape).
    if (spec.wantResponse === true) out.wantResponse = true
    if (isObject(spec.context)) out.context = spec.context
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

/** Decode one RFC-6901 reference token (`~1`→`/`, `~0`→`~`). */
const decodeToken = (token: string): string => token.replace(/~1/g, '/').replace(/~0/g, '~')

/**
 * Read an absolute RFC-6901 pointer off a document, or `undefined` if any step is absent (a render-time
 * placeholder, SPEC-R4 AC2 — never an error). Relative/list-scope pointers are LLD-C6's concern.
 */
function resolvePointer(doc: unknown, pointer: string): unknown {
  if (pointer === '') return doc
  if (pointer[0] !== '/') return undefined
  let cur: unknown = doc
  for (const raw of pointer.slice(1).split('/')) {
    const key = decodeToken(raw)
    if (Array.isArray(cur)) cur = cur[Number(key)]
    else if (isObject(cur)) cur = cur[key]
    else return undefined
    if (cur === undefined) return undefined
  }
  return cur
}

/** Immutably set `value` at an absolute RFC-6901 `pointer` within `doc`, materializing missing objects. */
function setPointer(doc: unknown, pointer: string, value: unknown): unknown {
  const tokens = pointer.slice(1).split('/').map(decodeToken)
  const set = (node: unknown, i: number): unknown => {
    if (i === tokens.length) return value
    const key = tokens[i]!
    if (Array.isArray(node)) {
      const copy = node.slice()
      copy[Number(key)] = set(node[Number(key)], i + 1)
      return copy
    }
    const base = isObject(node) ? node : {}
    return { ...base, [key]: set(base[key], i + 1) }
  }
  return set(doc, 0)
}
