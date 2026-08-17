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
  /** Holders still awaiting this read; the LAST one leaving aborts the shared signal (SPEC-R3 d). */
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

/** One resource's stake in one in-flight read; `left` once it stops caring about the result. */
interface Participation<T> {
  entry: InFlight<T>
  left: boolean
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
  let liveDone = false
  let unsubscribeStore: (() => void) | undefined
  const participations = new Set<Participation<T>>()

  // SPEC-R2 AC2 fail-fast: the verbs THIS resource will use must exist. `live: true` needs
  // `subscribe`; a non-live resource needs `read`; a live resource over a subscribe-only source
  // (the SPEC §5 `presence` example) needs no `read` at all — its read leg is simply skipped.
  const capabilityError: DataError | undefined =
    opts.live && !source.subscribe
      ? missingCapabilityError('subscribe')
      : !source.read && !opts.live
        ? missingCapabilityError('read')
        : undefined

  // SWR: a value already in the store is served synchronously (SPEC-R3 a).
  const seed = store.get(key)
  if (seed !== undefined) {
    dataSig.value = seed
    statusSig.value = 'success'
  }

  const seenAt = new Map<string, number>() // key -> last successful updatedAt, for staleMs

  function syncPending(): void {
    pendingSig.value = !disposed && participations.size > 0
  }

  /** This resource stops awaiting `p.entry`; the last holder out aborts the shared signal. */
  function leave(p: Participation<T>): void {
    if (p.left) return
    p.left = true
    participations.delete(p)
    p.entry.refCount--
    if (p.entry.refCount <= 0 && !p.entry.controller.signal.aborted) p.entry.controller.abort()
  }

  /** Detach `entry` from the dedup registry so a fresh read is started rather than rejoined. */
  function orphan(entry: InFlight<T>): void {
    const inflightMap = inflightMapFor(store as Store<unknown>)
    if (inflightMap.get(key) === (entry as unknown as InFlight<unknown>)) inflightMap.delete(key)
  }

  async function runRead(): Promise<void> {
    if (disposed || capabilityError || !source.read) return
    if (!isEnabled(opts.enabled)) return
    const now = Date.now()
    const last = seenAt.get(key)
    if (last !== undefined && staleMs > 0 && now - last < staleMs && statusSig.value === 'success') {
      return // fresh enough — SWR skips a redundant revalidate
    }

    const inflightMap = inflightMapFor(store as Store<unknown>)
    let entry = inflightMap.get(key) as InFlight<T> | undefined
    if (!entry) {
      const controller = new AbortController()
      const ctx: SourceContext = { signal: controller.signal }
      let created!: InFlight<T> // assigned below, before the (always-async) `.finally` can observe it
      const promise = source.read(key, ctx).finally(() => {
        if (inflightMap.get(key) === (created as unknown as InFlight<unknown>)) inflightMap.delete(key)
      })
      created = { promise, controller, refCount: 0 }
      entry = created
      inflightMap.set(key, entry as unknown as InFlight<unknown>)
    }
    const p: Participation<T> = { entry, left: false }
    participations.add(p)
    entry.refCount++

    statusSig.value = statusSig.value === 'idle' ? 'loading' : statusSig.value
    syncPending()
    try {
      const value = await entry.promise
      if (disposed || p.left) return // superseded — a later refetch (or dispose) owns the outcome
      store.commit(key, value)
      dataSig.value = value
      statusSig.value = 'success'
      errorSig.value = undefined
      updatedAtSig.value = Date.now()
      seenAt.set(key, updatedAtSig.value)
    } catch (e) {
      if (disposed || p.left) return
      errorSig.value = normalizeError(e) // SWR: stale `data` is KEPT on error
      statusSig.value = 'error'
    } finally {
      if (!p.left) {
        p.left = true
        participations.delete(p)
        entry.refCount--
      }
      syncPending()
    }
  }

  async function startLive(): Promise<void> {
    if (!opts.live || !source.subscribe || capabilityError) return
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
      // invalidation wakes an active resource — refetch through the normal read path. The staleMs
      // window is a subscribe-time SWR shortcut, never a shield against an explicit invalidate.
      seenAt.delete(key)
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

  if (capabilityError) {
    errorSig.value = capabilityError
    statusSig.value = 'error'
  } else {
    void runRead()
    if (opts.live) void startLive()
  }

  return {
    status: statusSig,
    data: dataSig,
    error: errorSig,
    updatedAt: updatedAtSig,
    pending: pendingSig,
    async refetch() {
      // AC5: the earlier read is superseded, the later result wins. Leaving aborts the shared
      // controller ONLY when this resource was its last holder (a deduped sibling still awaiting
      // it must not be stranded); either way the entry is orphaned from the registry so this
      // refetch starts a FRESH source call instead of rejoining the one it just walked away from
      // (a source that ignores `signal` would otherwise leave a permanently-pending entry behind).
      for (const p of [...participations]) {
        leave(p)
        orphan(p.entry)
      }
      seenAt.delete(key)
      const run = runRead()
      syncPending() // a read that did not start (disabled, capability error) leaves nothing pending
      await run
    },
    dispose() {
      if (disposed) return
      disposed = true
      liveDone = true
      for (const p of [...participations]) leave(p)
      unsubscribeStore?.()
      syncPending()
    },
  }
}
