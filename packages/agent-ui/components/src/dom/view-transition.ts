// view-transition.ts — the fleet's ONE View Transitions seam (GH #740, ADR-0183): wrap a DOM mutation in
// `document.startViewTransition` when (and only when) the caller opted in, the API exists, and the user
// has not asked for reduced motion. Progressive enhancement by construction — on every other path the
// mutation runs synchronously, byte-identical to before this helper existed (no polyfill, no errors,
// no timing change).
//
// Lives in `dom/` (not shared/, not a trait) because every opted-in surface sits above components on the
// DAG (`components ← {router, a2ui, code} ← app`) and below it nothing swaps DOM — this is the single
// home all four ADR-0183 surfaces can import without a layering violation.
//
// THE ONE SEMANTIC CAVEAT, stated here because it is the only sharp edge: on the TRANSITION path the
// browser snapshots first and runs `mutate` asynchronously (typically next frame). A caller whose swap
// carries a staleness guard (the router outlet's last-navigation-wins token) MUST re-check that guard
// INSIDE `mutate`, not before the call — the fallback path's synchronous timing is not a contract the
// transition path keeps. Rapid successive calls are safe: the platform skips the previous transition
// when a new one starts (per spec), so the LAST mutate always lands.

/** `true` iff a transition would actually run for an opted-in caller right now — the exact gate
 *  `withViewTransition` applies, exported so a probe/test can assert WHICH path executed without
 *  duplicating the detection. lib.dom types `startViewTransition` as always-present; runtime reality
 *  (jsdom, Firefox) disagrees, so the `typeof` check is the truth here, not the type. */
export function viewTransitionAvailable(): boolean {
  const supported = typeof document.startViewTransition === 'function'
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  return supported && !reduced
}

/**
 * Run `mutate` — inside `document.startViewTransition` when `enabled` and the platform allows it
 * (`viewTransitionAvailable`), synchronously otherwise. The return is deliberately `void`, not the
 * platform's `ViewTransition` object: exposing it would make the OPT-OUT path's shape diverge from the
 * opt-in path's, and no fleet consumer needs the finished/ready promises today (a future consumer that
 * does earns a widening, not a workaround).
 */
export function withViewTransition(mutate: () => void, enabled: boolean): void {
  if (!enabled || !viewTransitionAvailable()) {
    mutate()
    return
  }
  const transition = document.startViewTransition(mutate)
  // Rapid successive calls are the DESIGNED coalescing path (each new call skips the one in flight —
  // the file-header caveat), and a skipped transition REJECTS its `ready` promise with AbortError
  // ("Transition was skipped" / "Old view transition aborted by new view transition") — routine noise
  // here, never a caller-visible failure (found live: GH #742's re-render bursts). Only `ready` is
  // silenced: `finished`/`updateCallbackDone` stay untouched, so a mutate that genuinely THROWS keeps
  // surfacing as an unhandled rejection instead of being swallowed by the seam.
  // Optional-chained: the REAL API always returns a ViewTransition, but the fleet's jsdom tests stub
  // `startViewTransition` with bare callback-recorders (no ready promise) — the seam stays stub-tolerant.
  ;(transition as { ready?: Promise<unknown> } | undefined)?.ready?.catch(() => {})
}
