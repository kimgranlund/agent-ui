p='packages/agent-ui/a2ui/src/renderer/renderer.ts'
s=open(p).read()
def rep(old,new):
    global s
    assert s.count(old)==1, old
    s=s.replace(old,new)

rep("""// registered anywhere), is the SAME graceful fallthrough as an unflagged Button.

import { dispatch } from './dispatch.ts'""","""// registered anywhere), is the SAME graceful fallthrough as an unflagged Button.
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

import type { ControlLoader } from '@agent-ui/components/loader'
import { dispatch } from './dispatch.ts'""")

rep("""import { create as createOnly, wireProps } from './widget.ts'""","""import { create as createOnly, isPlaceholder, wireProps } from './widget.ts'""")
rep("""import { resolveFactory } from '../catalog/variant.ts'""","""import { factoriesOf, resolveFactory } from '../catalog/variant.ts'""")

rep("""  /** Register an additional catalog + its factory table (two-tier, SPEC-R6/N1; delegates to the registry).
   *  `functions` (ADR-0169 cl.8) is an optional per-catalog function-impl override table, forwarded verbatim. */
  register(catalog: unknown, factories: Record<string, WidgetFactory>, functions?: Record<string, (args: Record<string, unknown>) => unknown>): void""",
"""  /** Register an additional catalog + its factory table (two-tier, SPEC-R6/N1; delegates to the registry).
   *  `functions` (ADR-0169 cl.8) is an optional per-catalog function-impl override table, forwarded verbatim.
   *  `controls` (ADR-0233) is an optional control loader; with it, the surface defers apply until the
   *  controls a message needs are defined (module header, "Deferred apply"). */
  register(
    catalog: unknown,
    factories: Record<string, WidgetFactory>,
    functions?: Record<string, (args: Record<string, unknown>) => unknown>,
    controls?: ControlLoader,
  ): void""")

rep("""  #mountEl: HTMLElement | undefined
  #disposed = false
""","""  // ADR-0233 deferred apply: one queue per surface waiting on its catalog's control loader.
  readonly #controlQueues = new Map<string, ControlQueue>()
  #mountEl: HTMLElement | undefined
  #disposed = false
""")

rep("""  register(catalog: unknown, factories: Record<string, WidgetFactory>, functions?: Record<string, (args: Record<string, unknown>) => unknown>): void {
    this.#registry.register(catalog, factories, functions)
  }""","""  register(
    catalog: unknown,
    factories: Record<string, WidgetFactory>,
    functions?: Record<string, (args: Record<string, unknown>) => unknown>,
    controls?: ControlLoader,
  ): void {
    this.#registry.register(catalog, factories, functions, controls)
  }""")

rep("""  finalize(surfaceId?: string): void {
    if (surfaceId !== undefined) {
      this.#finalizeSurface(surfaceId)
      return
    }
    for (const id of this.#trees.keys()) this.#finalizeSurface(id)
  }""","""  finalize(surfaceId?: string): void {
    if (surfaceId !== undefined) {
      this.#finalizeOrQueue(surfaceId)
      return
    }
    for (const id of this.#trees.keys()) this.#finalizeOrQueue(id)
  }""")

rep("""    for (const id of [...this.#trees.keys()]) this.#teardownSurfaceDom(id)
    this.#store.disposeAll()""","""    for (const id of [...this.#trees.keys()]) this.#teardownSurfaceDom(id)
    this.#controlQueues.clear() // ADR-0233: every pending queue dropped; a late settle sees #disposed
    this.#store.disposeAll()""")

rep("""  #onUpdateComponents(body: A2uiUpdateComponents, version: string): void {
    const surface = this.#store.get(body.surfaceId)
    const tree = this.#trees.get(body.surfaceId)
    if (surface === undefined || tree === undefined) return // unknown/deleted surface → no-op (LLD §9)
    tree.apply({ version, updateComponents: body })
    this.#attachRoot(body.surfaceId, tree)
  }

  #onUpdateDataModel(body: A2uiUpdateDataModel): void {
    const surface = this.#store.get(body.surfaceId)""","""  #onUpdateComponents(body: A2uiUpdateComponents, version: string): void {
    const surface = this.#store.get(body.surfaceId)
    const tree = this.#trees.get(body.surfaceId)
    if (surface === undefined || tree === undefined) return // unknown/deleted surface → no-op (LLD §9)
    const queued = this.#controlQueues.get(body.surfaceId)
    const loader = queued?.loader ?? this.#registry.get(surface.catalogId)?.controls
    if (loader === undefined) {
      this.#applyComponents(body, version) // no control loader: synchronous, as before ADR-0233
      return
    }
    const tags = this.#controlTagsOf(surface.catalogId, body)
    if (queued !== undefined) {
      queued.messages.push({ tags, run: () => this.#applyComponents(body, version) })
      return
    }
    if (loader.missing(tags).length === 0) {
      this.#applyComponents(body, version) // the sync fast path: every control is already defined
      return
    }
    const queue: ControlQueue = { loader, messages: [{ tags, run: () => this.#applyComponents(body, version) }] }
    this.#controlQueues.set(body.surfaceId, queue)
    this.#drainControls(body.surfaceId, queue, false)
  }

  /** Apply one `updateComponents` to its surface's tree and attach the root (the sync path and the drain). */
  #applyComponents(body: A2uiUpdateComponents, version: string): void {
    const tree = this.#trees.get(body.surfaceId)
    if (tree === undefined || this.#store.get(body.surfaceId) === undefined) return
    tree.apply({ version, updateComponents: body })
    this.#attachRoot(body.surfaceId, tree)
  }

  #onUpdateDataModel(body: A2uiUpdateDataModel): void {
    const queued = this.#controlQueues.get(body.surfaceId)
    if (queued !== undefined) {
      queued.messages.push({ run: () => this.#applyDataModel(body) }) // ADR-0233: in order behind the pending load
      return
    }
    this.#applyDataModel(body)
  }

  #applyDataModel(body: A2uiUpdateDataModel): void {
    const surface = this.#store.get(body.surfaceId)""")

rep("""  #onTreeError(surfaceId: string, error: A2uiError): void {""","""  // ── deferred apply (ADR-0233) ─────────────────────────────────────────────────────

  /** The custom-element tags the factories of `body`'s components create (every arm of a variant table). */
  #controlTagsOf(catalogId: string, body: A2uiUpdateComponents): string[] {
    const factories = this.#registry.get(catalogId)?.factories
    const tags = new Set<string>()
    if (factories === undefined || !Array.isArray(body.components)) return []
    for (const node of body.components) {
      const type = (node as { component?: unknown } | null)?.component
      if (typeof type !== 'string' || !Object.hasOwn(factories, type)) continue
      for (const factory of factoriesOf(factories[type]!)) tags.add(factory.tag)
    }
    return [...tags]
  }

  /**
   * Run `queue`'s messages in order. A queued `updateComponents` whose tags are still missing starts one
   * `ensure` and stops the drain until it settles; `failed` (after a failed load) applies everything, so a
   * still-undefined tag renders as a placeholder. Stops as soon as the queue is dropped (deleteSurface or
   * dispose from inside a message), and removes the queue once it is empty.
   */
  #drainControls(id: string, queue: ControlQueue, failed: boolean): void {
    while (this.#controlQueues.get(id) === queue && queue.messages.length > 0) {
      const next = queue.messages[0]!
      if (!failed && next.tags !== undefined) {
        const missing = queue.loader.missing(next.tags)
        if (missing.length > 0) {
          this.#ensureControls(id, queue, missing)
          return
        }
      }
      queue.messages.shift()
      next.run()
    }
    if (this.#controlQueues.get(id) === queue) this.#controlQueues.delete(id)
  }

  /** Start one `ensure` for `queue`; on settle, drain (or report `CONTROL_LOAD` once and drain anyway). */
  #ensureControls(id: string, queue: ControlQueue, tags: readonly string[]): void {
    const settle = (error: unknown): void => {
      if (this.#disposed || this.#controlQueues.get(id) !== queue) return // late: surface gone or host disposed
      const stillMissing = error === undefined ? queue.loader.missing(tags) : tags
      if (error === undefined && stillMissing.length === 0) {
        this.#drainControls(id, queue, false)
        return
      }
      const reason = error instanceof Error ? `: ${error.message}` : ''
      this.#emitInternalError(this.#versionFor(id), {
        code: 'CONTROL_LOAD',
        surfaceId: id,
        message: `controls failed to load (${stillMissing.join(', ')})${reason}`,
      })
      this.#drainControls(id, queue, true)
    }
    let pending: Promise<void>
    try {
      pending = queue.loader.ensure(tags)
    } catch (error) {
      pending = Promise.reject(error)
    }
    pending.then(
      () => settle(undefined),
      (error: unknown) => settle(error ?? new Error('control load rejected')),
    )
  }

  #finalizeOrQueue(id: string): void {
    const queued = this.#controlQueues.get(id)
    if (queued !== undefined) {
      // ADR-0233: finalize judges the COMPLETE component set, so it waits behind the queued messages.
      queued.messages.push({ run: () => this.#finalizeSurface(id) })
      return
    }
    this.#finalizeSurface(id)
  }

  #onTreeError(surfaceId: string, error: A2uiError): void {""")

rep("""  #wireNode(el: HTMLElement, node: A2uiComponent, surface: Surface, scope: Scope, itemScope: ItemScope | undefined, ac: AbortController): void {
    const actionProps""","""  #wireNode(el: HTMLElement, node: A2uiComponent, surface: Surface, scope: Scope, itemScope: ItemScope | undefined, ac: AbortController): void {
    // ADR-0233: a placeholder minted for a control that failed to load stays inert (no props, actions or checks).
    if (isPlaceholder(el) && this.#registry.get(surface.catalogId)?.controls !== undefined) return
    const actionProps""")

rep("""    this.#poisoned.delete(id)
    this.#liveCatalogPaths.delete(id) // a fresh createSurface at this id starts with a clean de-dupe set
  }""","""    this.#poisoned.delete(id)
    this.#liveCatalogPaths.delete(id) // a fresh createSurface at this id starts with a clean de-dupe set
    this.#controlQueues.delete(id) // ADR-0233: a pending queue dies with its surface; a late settle is a no-op
  }""")

rep("""// ── module helpers ──────────────────────────────────────────────────────────────────
""","""// ── module helpers ──────────────────────────────────────────────────────────────────

/** One message held behind a pending control load (ADR-0233). `tags` marks an `updateComponents`. */
interface QueuedMessage {
  readonly tags?: readonly string[]
  readonly run: () => void
}

/** A surface's deferred-apply queue: the loader it waits on and its messages, in arrival order. */
interface ControlQueue {
  readonly loader: ControlLoader
  readonly messages: QueuedMessage[]
}
""")
open(p,'w').write(s)
print('ok')
