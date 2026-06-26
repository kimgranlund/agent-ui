// graph.ts — the producer/consumer half of the reactivity kernel.
//
// Push possible-staleness, pull values, cut on equality (version-verified at both
// computeds AND effects). Eager invalidation, lazy recomputation. Ownership scopes
// make disposal provable: after scope.dispose(), no producer holds a reference to
// any node created inside it. Its only import is the scheduler half, pulling exactly
// { schedule, dequeue }.

import { schedule, dequeue } from './scheduler.ts'

const UNSET = Symbol('unset')

/**
 * Thrown when a computed is read during its own recomputation — a reactive cycle.
 * Without this guard a WARM cycle serves a stale value silently: the re-entrant
 * refresh sees the sources the outer run just cleared, verification concludes
 * "unchanged", and the stale value is returned with no error.
 */
export class CycleError extends Error {}

// ── public value-surface types ───────────────────────────────────────────────

/** A reactive value you can read (tracked) and peek (untracked) but not write. */
export interface ReadonlySignal<T> {
  readonly value: T
  peek(): T
}

/** A writable reactive cell. */
export interface Signal<T> extends ReadonlySignal<T> {
  value: T
}

/** Ownership container: every computed/effect created inside dies with it. */
export interface Scope {
  run<R>(fn: () => R): R
  dispose(): void
}

/** A read-only, graph-inert snapshot of a node (the public face of the internals). */
export type NodeSnapshot =
  | Readonly<{ kind: 'signal'; value: unknown; version: number; subscribers: number }>
  | Readonly<{
      kind: 'computed'
      value: unknown
      version: number
      subscribers: number
      sources: number
      dirty: boolean
      failed: boolean
      disposed: boolean
    }>

// ── internal producer/consumer protocol (never exported from the barrel) ──────
// A computed reading another node's subscriber set / version cannot use `#private`
// (no cross-class access). The protocol is modeled as these interfaces, backed by
// plain fields; everything outside the protocol stays `#private`.

interface Producer {
  readonly subs: Set<Consumer>
  version: number
  refresh?(): void // computeds pull fresh; signals have no refresh
}

interface Consumer {
  track(src: Producer): void
  markStale(): void
}

interface Disposable {
  dispose(): void
}

let activeConsumer: Consumer | null = null
let activeOwner: ScopeImpl | null = null

/** Read without subscribing the current consumer. */
export function untracked<T>(fn: () => T): T {
  const prev = activeConsumer
  activeConsumer = null
  try {
    return fn()
  } finally {
    activeConsumer = prev
  }
}

/**
 * Create reactive nodes OUTSIDE any ownership scope — the mirror of `untracked`.
 * Module-singleton machinery created lazily on first touch must not be adopted by
 * whichever component scope happened to trigger that first touch, or the component's
 * disconnect freezes the singleton.
 */
export function unowned<T>(fn: () => T): T {
  const prev = activeOwner
  activeOwner = null
  try {
    return fn()
  } finally {
    activeOwner = prev
  }
}

// ── producers / consumers ─────────────────────────────────────────────────────

class SignalNode<T> implements Producer {
  readonly subs = new Set<Consumer>()
  version = 0
  #value: T
  constructor(v: T) {
    this.#value = v
  }
  get value(): T {
    activeConsumer?.track(this)
    return this.#value
  }
  set value(next: T) {
    if (Object.is(next, this.#value)) return
    this.#value = next
    this.version++
    for (const c of [...this.subs]) c.markStale()
  }
  peek(): T {
    return this.#value
  }
  snapshot(): NodeSnapshot {
    return Object.freeze({ kind: 'signal' as const, value: this.#value, version: this.version, subscribers: this.subs.size })
  }
}

class ComputedNode<T> implements Producer, Consumer, Disposable {
  readonly subs = new Set<Consumer>()
  readonly sources = new Map<Producer, number>() // producer -> version seen
  version = 0
  #dirty = true
  #failed = false
  #disposed = false
  #running = false
  #value: T | typeof UNSET = UNSET
  #fn: () => T
  constructor(fn: () => T) {
    this.#fn = fn
    activeOwner?.add(this)
  }
  get value(): T {
    if (!this.#disposed) {
      // Settle BEFORE the consumer records our version — track-first records a
      // stale version and forces one spurious downstream recompute per change.
      this.refresh()
      activeConsumer?.track(this)
    }
    return this.#value as T
  }
  peek(): T {
    if (!this.#disposed) this.refresh()
    return this.#value as T
  }
  track(src: Producer): void {
    this.sources.set(src, src.version)
    src.subs.add(this)
  }
  markStale(): void {
    if (this.#dirty || this.#disposed) return
    this.#dirty = true
    for (const c of [...this.subs]) c.markStale() // propagate possible-staleness
  }
  refresh(): void {
    if (this.#running) throw new CycleError('reactive cycle: computed re-entered during its own recomputation')
    if (!this.#dirty || this.#disposed) return
    this.#running = true
    try {
      this.#refreshInner()
    } finally {
      this.#running = false
    }
  }
  #refreshInner(): void {
    // `#dirty` clears only on a SUCCESSFUL path. A throwing computed stays stale and
    // retries on the next read — it never silently serves a stale value after an error.
    if (this.#value !== UNSET && !this.#failed) {
      // Verification: recompute only if some source's VALUE changed. Skipped after a
      // failure — the failed run partially re-tracked sources at their CURRENT versions,
      // so verification would wrongly conclude "unchanged" and serve the stale value.
      let changed = false
      for (const [src, seen] of this.sources) {
        src.refresh?.() // pull nested computeds fresh first (may throw → still dirty)
        if (src.version !== seen) {
          changed = true
          break
        }
      }
      if (!changed) {
        this.#dirty = false // sources were noisy, values unchanged
        return
      }
    }
    for (const src of this.sources.keys()) src.subs.delete(this)
    this.sources.clear()
    const prev = activeConsumer
    activeConsumer = this
    let next: T
    try {
      next = this.#fn()
    } catch (err) {
      this.#failed = true // poison verification: the retry must recompute
      throw err
    } finally {
      activeConsumer = prev
    }
    this.#failed = false
    this.#dirty = false
    if (!Object.is(next, this.#value)) {
      this.#value = next
      this.version++ // equality cutoff: no bump → downstream never wakes
    }
  }
  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    for (const src of this.sources.keys()) src.subs.delete(this)
    this.sources.clear()
    this.subs.clear()
  }
  snapshot(): NodeSnapshot {
    return Object.freeze({
      kind: 'computed' as const,
      value: this.#value === UNSET ? undefined : this.#value,
      version: this.version,
      subscribers: this.subs.size,
      sources: this.sources.size,
      dirty: this.#dirty,
      failed: this.#failed,
      disposed: this.#disposed,
    })
  }
}

class EffectNode implements Consumer, Disposable {
  readonly sources = new Map<Producer, number>()
  #disposed = false
  #failed = false
  #cleanup: (() => void) | undefined = undefined
  #fn: () => void | (() => void)
  constructor(fn: () => void | (() => void)) {
    this.#fn = fn
    activeOwner?.add(this)
  }
  track(src: Producer): void {
    this.sources.set(src, src.version)
    src.subs.add(this)
  }
  markStale(): void {
    if (!this.#disposed) schedule(this)
  }
  run(): void {
    if (this.#disposed) return
    if (this.sources.size && !this.#failed) {
      // Same verification as Computed: a scheduled effect whose sources verify
      // unchanged skips its body — the equality cutoff reaches effects.
      let changed = false
      for (const [src, seen] of this.sources) {
        src.refresh?.()
        if (src.version !== seen) {
          changed = true
          break
        }
      }
      if (!changed) return
    }
    this.#cleanup?.()
    this.#cleanup = undefined // a throwing body must not leave a consumed cleanup re-callable
    for (const src of this.sources.keys()) src.subs.delete(this)
    this.sources.clear()
    const prev = activeConsumer
    activeConsumer = this
    try {
      const r = this.#fn()
      this.#cleanup = typeof r === 'function' ? r : undefined
      this.#failed = false
    } catch (err) {
      this.#failed = true
      throw err
    } finally {
      activeConsumer = prev
    }
  }
  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    dequeue(this) // the dispose-while-queued seam
    this.#cleanup?.()
    this.#cleanup = undefined
    for (const src of this.sources.keys()) src.subs.delete(this)
    this.sources.clear()
  }
}

// ── ownership ─────────────────────────────────────────────────────────────────

class ScopeImpl implements Scope {
  readonly #nodes = new Set<Disposable>()
  add(node: Disposable): void {
    this.#nodes.add(node)
  }
  run<R>(fn: () => R): R {
    const prev = activeOwner
    activeOwner = this
    try {
      return fn()
    } finally {
      activeOwner = prev
    }
  }
  dispose(): void {
    for (const n of this.#nodes) n.dispose()
    this.#nodes.clear()
  }
}

// ── factories ───────────────────────────────────────────────────────────────

/** A writable reactive cell. */
export const signal = <T>(initial: T): Signal<T> => new SignalNode(initial)

/** A derived value: recomputed lazily, cut on equality. */
export const computed = <T>(fn: () => T): ReadonlySignal<T> => new ComputedNode(fn)

/**
 * Runs synchronously once, then re-runs batched + deduped on dependency change.
 * Returns a dispose function.
 */
export function effect(fn: () => void | (() => void)): () => void {
  const e = new EffectNode(fn)
  e.run()
  return () => e.dispose()
}

/** A flat ownership scope: every computed/effect created inside dies with it. */
export function createScope(): Scope {
  return new ScopeImpl()
}

/**
 * Read-only introspection of a graph node. PURE and graph-inert: it reads cached
 * private state directly, so it NEVER subscribes, refreshes, or bumps a version —
 * safe to call from anywhere, including inside a tracking context. It reports what
 * the node CURRENTLY holds; it does not force a stale computed to evaluate.
 */
export function inspect(node: ReadonlySignal<unknown>): NodeSnapshot {
  if (node instanceof SignalNode) return node.snapshot()
  if (node instanceof ComputedNode) return node.snapshot()
  throw new TypeError('inspect: not a reactive node (expected a signal or computed)')
}
