// storage-changes.ts: the one cross-tab change pump the agent-admin data sources share (the roster's
// `subscribe` legs in agent-roster-source.ts and the teams' live leg in agent-team.ts, T-0161). It rides
// the adapter's change seam (the `storage`-event seam on the localStorage tier, ADR-0193 cl.4).
import type { SourceContext } from '@agent-ui/data'
import type { StorageAdapter, StorageChange } from '@agent-ui/shared'

/** Resolves once per accepted change from ANOTHER tab, until `ctx.signal` aborts; changes that land while
 *  the consumer is busy coalesce into one wake. The adapter listener tears down in the generator's
 *  `finally`, so a consumer must drive `return()` (or abort the signal) on abandonment, as `resource()`'s
 *  own `stopLive` does; a bare-`.next()` abandoner would leak it. An adapter with no change seam yields
 *  nothing. */
export async function* adapterChanges(
  adapter: StorageAdapter,
  ctx: SourceContext,
  accept: (change: StorageChange) => boolean = () => true,
): AsyncGenerator<void> {
  if (!adapter.subscribe || ctx.signal.aborted) return
  let wake: (() => void) | undefined
  let pending = false
  const unsubscribe = adapter.subscribe((change) => {
    if (!accept(change)) return
    pending = true
    wake?.()
  })
  const aborted = new Promise<void>((resolve) => {
    ctx.signal.addEventListener('abort', () => resolve(), { once: true })
  })
  try {
    while (!ctx.signal.aborted) {
      if (!pending) await Promise.race([new Promise<void>((resolve) => (wake = resolve)), aborted])
      if (ctx.signal.aborted) return
      if (pending) {
        pending = false
        yield
      }
    }
  } finally {
    unsubscribe()
  }
}
