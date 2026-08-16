// pending-computed.ts — the pending-aware async primitive (GH #974, seed 1 of Kim's Solid-2.0-RC analysis:
// https://www.solidjs.com/blog/solid-2-0-rc-the-big-reveal). Solid 2.0 RC treats async as a property of the
// reactive graph itself: `isPending` + stale-content-stays-visible instead of blanking to a spinner on every
// re-fetch. This trait is the fleet's own version of that shape, wrapping ONE async-producing source (a
// Promise or an async iterator) from the TRAITS layer — the signals kernel (`reactive/graph.ts` +
// `scheduler.ts`) stays fully synchronous; nothing here touches it.
//
// Two things a naive "just await it" wrapper gets wrong, both fixed here:
//   (a) LAST-SETTLED VALUE — `value` only ever advances on a successful settle (a resolved Promise, or an
//       async iterator's yielded value). A new query starting does NOT clear it — the consumer keeps
//       rendering the previous answer while the next one is in flight, never a blank/spinner state forced by
//       this trait (a consumer that WANTS a spinner composes `pending && !value` itself).
//   (b) QUERY-SCOPED `pending` — "is a new answer to THIS question in flight", not "is anything in flight
//       anywhere". Each reactive re-run of `opts.source()` mints a new query identity (a monotonic
//       generation counter); a settle/error/yield is applied only when it belongs to the CURRENT generation.
//       Without this, a slow superseded query resolving after a newer one has already started would
//       incorrectly flip `pending` back to false (or overwrite `value` with the stale answer) for the
//       question the consumer is actually asking now.
//
// Stateless trait vs stateful controller (plan §7): this OWNS three signals, so — like `trackUserInvalid` and
// `valueCodec` — it is a CONTROLLER, not a stateless trait: same `(host, opts) => …` seam, but the return
// carries `value`/`pending`/`error` alongside an idempotent `release()`.
//
// Layering: `traits → reactive` (the `signal`/`ReadonlySignal` cell) and `traits → dom` (the host type, `.effect`)
// are both DOWNWARD imports (reactive L0 ← dom L1 ← traits L2) — the allowed direction.
//
// Query INVALIDATION has exactly one mechanism: the `generation` counter. It is bumped by (1) every effect
// re-run (a newer question) AND (2) the effect's cleanup — which runs on re-run, on host disconnect (the
// scope-owned effect is disposed with the connection scope), and on an explicit `release()`. So a settle that
// lands AFTER the host has left the DOM is a no-op too, not only one superseded by a newer query.
//
// CANCELLATION (GH #1003): `source()` receives an `AbortSignal`, one fresh `AbortController` per generation.
// The controller is aborted from the SAME cleanup closure that bumps `generation` — on a newer query
// superseding it, on host disconnect, and on an explicit `release()` — so a fetch-backed source can cancel its
// network work instead of merely having its late answer ignored. A `source()` that never reads the signal
// keeps behaving exactly as before; the trait still only APPLIES a settle when `isCurrent()` holds.
//
// Fleet stale/pending STYLING convention (a shared token/state-class, TKT-0062-shaped) is deliberately NOT
// part of this file — GH #974 requires an ADR proposal before that hook ships; this trait ships alone.

import { signal } from '../reactive/index.ts'
import type { ReadonlySignal } from '../reactive/index.ts'
import type { UIElement } from '../dom/index.ts'

/** An async source this trait knows how to follow: a one-shot Promise, or a stream of values. */
export type PendingSource<T> = Promise<T> | AsyncIterable<T>

export interface PendingComputedOptions<T> {
  /**
   * Reactively produces the CURRENT query — read inside the trait's own `host.effect`, so reading a signal
   * here (e.g. a query-param cell) makes a change to that signal start a NEW query automatically. Return
   * `null`/`undefined` for "no query right now" (clears `pending`/`error`; leaves the last-settled `value`
   * untouched — there is nothing new to blank it with). Each call is a distinct query IDENTITY regardless of
   * whether it returns a referentially-equal source object.
   *
   * Do NOT read this controller's own signals (`value`/`pending`/`error`) inside `source()`: the trait writes
   * them from inside the same tracking effect, so reading them there would subscribe the effect to its own
   * writes and re-run the query on every settle.
   *
   * `signal` is a fresh `AbortSignal`, one per generation (query identity) — pass it to a fetch-backed source
   * (e.g. `fetch(url, { signal })`) to cancel the underlying work when this query is superseded, the host
   * disconnects, or `release()` runs. A source that ignores it behaves exactly as before this signal existed.
   */
  source: (signal: AbortSignal) => PendingSource<T> | null | undefined
}

export interface PendingComputedController<T> {
  /** The last SETTLED value: a resolved Promise's value, or an async iterator's most recent yield. Stays at
   * its previous value while a new query is in flight — never blanked by this trait. `undefined` until the
   * first settle. */
  readonly value: ReadonlySignal<T | undefined>
  /** True while a query matching the CURRENT `source()` identity is in flight. Query-scoped: a superseded
   * query's own late resolve/reject/yield never touches this once a newer query has started. */
  readonly pending: ReadonlySignal<boolean>
  /** The current query's rejection, if its most recent settle failed. Cleared at the start of every new
   * query (including a `null` one) and on a successful settle. */
  readonly error: ReadonlySignal<unknown>
  /** Idempotent early teardown: stops applying any further settle/yield from any in-flight query (a
   * superseded OR the current one) to `value`/`pending`/`error`, and disposes the tracking effect. */
  release: () => void
}

function isAsyncIterable<T>(x: PendingSource<T>): x is AsyncIterable<T> {
  return typeof x === 'object' && x !== null && Symbol.asyncIterator in x
}

/**
 * Follow an async source with a last-settled `value` + query-scoped `pending` (+ `error`). Invoke from the
 * control's `connected()`, e.g.
 * `pendingComputed(this, { source: (signal) => fetch(this.queryId.value, { signal }) })`.
 * The returned signals are read-only to consumers; the tracking effect (and any in-flight iterator) is torn
 * down on disconnect (scope-owned) or by calling the returned `release()` early.
 */
export function pendingComputed<T>(host: UIElement, opts: PendingComputedOptions<T>): PendingComputedController<T> {
  let released = false
  let generation = 0
  const value = signal<T | undefined>(undefined)
  const pending = signal(false)
  const error = signal<unknown>(undefined)

  const dispose = host.effect(() => {
    const controller = new AbortController()
    const source = opts.source(controller.signal)
    const gen = ++generation // this run's query identity — a later re-run (a newer question) bumps this
    // again, so any settle/yield/error below that still checks `gen === generation` (via `isCurrent`) knows
    // whether it belongs to the question the consumer is asking RIGHT NOW.
    const isCurrent = (): boolean => !released && gen === generation

    if (source == null) {
      pending.value = false
      error.value = undefined
      // No async work started for this generation — abort immediately rather than leaving a live controller
      // whose signal never fires (a `source()` that reads `signal` before returning null/undefined still sees
      // a consistent "this query is over" once cleanup runs, since `return` below covers this branch too).
      return () => {
        generation++
        controller.abort()
      }
    }

    pending.value = true
    error.value = undefined

    if (isAsyncIterable(source)) {
      const iterator = source[Symbol.asyncIterator]()
      void (async () => {
        try {
          while (isCurrent()) {
            const step = await iterator.next()
            if (!isCurrent()) break
            if (step.done) break
            value.value = step.value // each yield IS a settle — stale content never shows past a real update
          }
        } catch (err) {
          if (isCurrent()) error.value = err
        } finally {
          if (isCurrent()) pending.value = false
        }
      })()
      // Cleanup (disconnect, a newer query starting, or an explicit release()): invalidate this query so a
      // late `next()` settling after teardown is ignored, and let the generator clean up its own resources
      // rather than leaving it running unobserved. `return()` may itself reject at teardown (a generator's
      // `finally` throwing) — swallowed, since nobody is left to observe it. Abort THIS generation's
      // controller too, so a source that plumbed `signal` into its own fetch/subscription cancels alongside
      // the iterator teardown.
      return () => {
        generation++
        controller.abort()
        Promise.resolve(iterator.return?.()).catch(() => {})
      }
    }

    source.then(
      (v) => {
        if (!isCurrent()) return // a superseded query's late resolve — never overwrite the current answer
        value.value = v
        pending.value = false
      },
      (err) => {
        if (!isCurrent()) return
        error.value = err
        pending.value = false
      },
    )
    // Cleanup (disconnect / re-run / release()): invalidate this query so a settle landing after teardown —
    // e.g. after the host has left the DOM — never writes `value`/`pending`/`error`. Abort THIS generation's
    // controller too, so a `source()` that plumbed `signal` into `fetch`/etc. cancels its network work rather
    // than merely having its late answer ignored.
    return () => {
      generation++
      controller.abort()
    }
  })

  return {
    value,
    pending,
    error,
    release: () => {
      released = true
      dispose()
    },
  }
}
