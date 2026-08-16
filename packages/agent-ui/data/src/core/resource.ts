// core/resource.ts — SPEC-R3: `resource()`, a signal-backed read state machine with SWR, dedup,
// prefix invalidation, abort, and an opt-in `live` subscription leg. Headless (no DOM global) —
// SPEC-R3 AC6's gate.

import { signal, type ReadonlySignal } from '@agent-ui/components'
import type { DataSource, ResourceSource, SourceContext } from './data-source.ts'
import { asDataSource } from './data-source.ts'
import { type Store, defaultStore } from './cache.ts'
import { type DataError, missingCapabilityError, normalizeError } from './error.ts'

export type ResourceStatus = 'idle' | 'loading' | 'success' | 'error'

// Deliberately non-generic (never `ResourceOptions<T>`): none of its fields reference the
// resource's value type, and `store` is deliberately the untyped `Store` (T=unknown) since the
// SPEC's own example shares ONE store instance across differently-typed resource()/mutation()/
// paginated() calls — the store's own generic can't be pinned to any one consumer's value type.
export interface ResourceOptions {
  store?: Store
  /** Milliseconds a cached value stays fresh before a subscribe-time revalidate is skipped. Default 0 (always revalidate). */
  staleMs?: number
  /** With `true` and `source.subscribe`, each yielded value commits to the store and wakes `data` (SPEC-R3 e). */
  live?: boolean
  enabled?: ReadonlySignal<boolean> | boolean
}

export interface Resource<T> {
  readonly status: ReadonlySignal<ResourceStatus>
  readonly data: ReadonlySignal<T | undefined>
  readonly error: ReadonlySignal<DataError | undefined>
  readonly updatedAt: ReadonlySignal<number | undefined>
  readonly pending: ReadonlySignal<boolean>
  refetch(): Promise<void>
  dispose(): void
}

// ── dedup registry: concurrent resources on the same (store, key) share ONE in-flight read (SPEC-R3 b) ──
interface InFlight<T> {
  promise: Promise<T>
  controller: AbortController
  refCount: number
}
const inflightByStore = new WeakMap<Store<unknown>, Map<string, InFlight<unknown>>>()

function inflightMapFor(store: Store<unknown>): Map<string, InFlight<unknown>> {
  let m = inflightByStore.get(store)
  if (!m) {
    m = new Map()
    inflightByStore.set(store, m)
  }
  return m
}

function isEnabled(opt: ReadonlySignal<boolean> | boolean | undefined): boolean {
  if (opt === undefined) return true
  return typeof opt === 'boolean' ? opt : opt.value
}

export function resource<T>(key: string, src: ResourceSource<T>, opts: ResourceOptions = {}): Resource<T> {
  const store = (opts.store ?? defaultStore) as Store<T>
  const source: DataSource<T> = asDataSource(src)
  const staleMs = opts.staleMs ?? 0

  const statusSig = signal<ResourceStatus>('idle')
  const dataSig = signal<T | undefined>(undefined)
  const errorSig = signal<DataError | undefined>(undefined)
  const updatedAtSig = signal<number | undefined>(undefined)
  const pendingSig = signal(false)

  let disposed = false
  let ownController: AbortController | undefined
  let liveDone = false
  let unsubscribeStore: (() => void) | undefined

  // SWR: a value already in the store is served synchronously (SPEC-R3 a).
  const seed = store.get(key)
  if (seed !== undefined) {
    dataSig.value = seed
    statusSig.value = 'success'
  }

  const seenAt = new Map<string, number>() // key -> last successful updatedAt, for staleMs

  async function runRead(): Promise<void> {
    if (!isEnabled(opts.enabled)) return
    if (!source.read) {
      errorSig.value = missingCapabilityError('read')
      statusSig.value = 'error'
      return
    }
    const now = Date.now()
    const last = seenAt.get(key)
    if (last !== undefined && staleMs > 0 && now - last < staleMs && statusSig.value === 'success') {
      return // fresh enough — SWR skips a redundant revalidate
    }

    const inflightMap = inflightMapFor(store as Store<unknown>)
    let entry = inflightMap.get(key) as InFlight<T> | undefined
    let joined = true
    if (!entry) {
      joined = false
      const controller = new AbortController()
      ownController = controller
      const ctx: SourceContext = { signal: controller.signal }
      const promise = source.read(key, ctx).finally(() => {
        if (inflightMap.get(key) === (entry as unknown as InFlight<unknown>)) inflightMap.delete(key)
      })
      entry = { promise, controller, refCount: 0 }
      inflightMap.set(key, entry as unknown as InFlight<unknown>)
    } else {
      ownController = entry.controller
    }
    entry.refCount++

    statusSig.value = statusSig.value === 'idle' ? 'loading' : statusSig.value
    pendingSig.value = true
    try {
      const value = await entry.promise
      if (disposed) return
      if (entry.controller.signal.aborted) return // superseded — the later refetch owns the result
      store.commit(key, value)
      dataSig.value = value
      statusSig.value = 'success'
      errorSig.value = undefined
      updatedAtSig.value = Date.now()
      seenAt.set(key, updatedAtSig.value)
    } catch (e) {
      if (disposed || entry.controller.signal.aborted) return
      errorSig.value = normalizeError(e) // SWR: stale `data` is KEPT on error
      statusSig.value = 'error'
    } finally {
      entry.refCount--
      if (!disposed) pendingSig.value = false
      void joined
    }
  }

  async function startLive(): Promise<void> {
    if (!opts.live || !source.subscribe) return
    const controller = new AbortController()
    const ctx: SourceContext = { signal: controller.signal }
    try {
      for await (const value of source.subscribe(key, ctx)) {
        if (disposed || liveDone) break
        store.commit(key, value)
        dataSig.value = value
        statusSig.value = 'success'
        updatedAtSig.value = Date.now()
      }
    } catch (e) {
      if (!disposed && !liveDone) {
        errorSig.value = normalizeError(e)
        statusSig.value = 'error'
      }
    }
  }

  unsubscribeStore = store.subscribe(key, (reason) => {
    if (reason === 'invalidate') {
      // invalidation wakes an active resource — refetch through the normal read path.
      void runRead()
    } else {
      // an external commit (an optimistic write, a rollback, paginated()'s own page-list commit)
      // is MIRRORED, never re-fetched — re-fetching here would clobber the just-written value.
      const v = store.get(key)
      if (v !== undefined && !Object.is(v, dataSig.peek())) {
        dataSig.value = v
        statusSig.value = 'success'
        updatedAtSig.value = Date.now()
      }
    }
  })

  void runRead()
  if (opts.live) void startLive()

  return {
    status: statusSig,
    data: dataSig,
    error: errorSig,
    updatedAt: updatedAtSig,
    pending: pendingSig,
    async refetch() {
      if (ownController && !ownController.signal.aborted) {
        ownController.abort() // AC5: earlier aborts, later wins
        // Orphan the dedup entry unconditionally: a real fetch rejects on abort (its `.finally`
        // clears the registry naturally), but a source that ignores `signal` would otherwise leave
        // a permanently-pending entry that a fresh refetch would wrongly rejoin.
        const inflightMap = inflightMapFor(store as Store<unknown>)
        if (inflightMap.get(key)?.controller === ownController) inflightMap.delete(key)
      }
      seenAt.delete(key)
      await runRead()
    },
    dispose() {
      if (disposed) return
      disposed = true
      liveDone = true
      if (ownController) ownController.abort()
      unsubscribeStore?.()
    },
  }
}
