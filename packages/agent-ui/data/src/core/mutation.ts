// core/mutation.ts — SPEC-R5: `mutation()`, a signal-backed write with declared cache effects
// (invalidate-on-settle, optimistic snapshot/rollback per-run, per-key).

import { signal, type ReadonlySignal } from '@agent-ui/components'
import type { SourceContext } from './data-source.ts'
import { type Store, defaultStore } from './cache.ts'
import { type DataError, normalizeError } from './error.ts'

export type MutationStatus = 'idle' | 'pending' | 'success' | 'error'

export interface MutationEffects<Input, R> {
  store?: Store
  /** Keys (or a function of input+result) invalidated on settle — success OR error (SPEC-R5). */
  invalidate?: readonly string[] | ((input: Input, result: R | undefined) => readonly string[])
  /** Runs synchronously BEFORE `fn`, against a fresh snapshot — for local-patch UI feedback (SPEC-R5). */
  optimistic?: (input: Input, store: Store) => void
}

export interface Mutation<Input, R> {
  readonly status: ReadonlySignal<MutationStatus>
  readonly error: ReadonlySignal<DataError | undefined>
  readonly data: ReadonlySignal<R | undefined>
  run(input: Input): Promise<R | undefined>
  dispose(): void
}

export function mutation<Input, R>(
  fn: (input: Input, ctx: SourceContext) => Promise<R>,
  effects: MutationEffects<Input, R> = {},
): Mutation<Input, R> {
  const store = effects.store ?? defaultStore
  const statusSig = signal<MutationStatus>('idle')
  const errorSig = signal<DataError | undefined>(undefined)
  const dataSig = signal<R | undefined>(undefined)
  let disposed = false
  const inFlight = new Set<AbortController>() // every live run's signal — dispose() aborts them all

  function resolveInvalidateKeys(input: Input, result: R | undefined): readonly string[] {
    if (!effects.invalidate) return []
    return typeof effects.invalidate === 'function' ? effects.invalidate(input, result) : effects.invalidate
  }

  async function run(input: Input): Promise<R | undefined> {
    if (disposed) return undefined
    statusSig.value = 'pending'
    errorSig.value = undefined

    // Per-run, PER-KEY rollback (SPEC-R5 AC4): record only the keys THIS run's optimistic write
    // touches, and only their prior values — never a whole-store snapshot, which would also catch
    // (and wrongly roll back) an unrelated concurrent run's own optimistic write to a different key.
    const touched = new Map<string, unknown>()
    if (effects.optimistic) {
      const recordingStore: Store = {
        ...store,
        commit(key, value) {
          if (!touched.has(key)) touched.set(key, store.get(key))
          store.commit(key, value)
        },
      }
      effects.optimistic(input, recordingStore)
    }

    const controller = new AbortController()
    inFlight.add(controller)
    const ctx: SourceContext = { signal: controller.signal }
    try {
      const result = await fn(input, ctx)
      if (disposed) return result
      dataSig.value = result
      statusSig.value = 'success'
      for (const key of resolveInvalidateKeys(input, result)) store.invalidate(key)
      return result
    } catch (e) {
      for (const [key, priorValue] of touched) store.commit(key, priorValue) // restores ONLY this run's touched keys
      const derr = normalizeError(e)
      if (!disposed) {
        errorSig.value = derr
        statusSig.value = 'error'
      }
      for (const key of resolveInvalidateKeys(input, undefined)) store.invalidate(key)
      return undefined
    } finally {
      inFlight.delete(controller)
    }
  }

  return {
    status: statusSig,
    error: errorSig,
    data: dataSig,
    run,
    dispose() {
      if (disposed) return
      disposed = true
      for (const c of inFlight) c.abort() // the SourceContext.signal every in-flight fn received fires (SPEC-R3 d's posture)
      inFlight.clear()
    },
  }
}
