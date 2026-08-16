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

// GH #958 (ADR-0183 cl.4) — THE NAMED-MORPH CONVENTION. cl.4 shipped no fleet-default
// `view-transition-name`s (a consumer's own vocabulary, layered on top of the cross-fade this seam
// already provides); this is that vocabulary's first documented, proven scheme — still opt-in, still
// consumer/surface-decided, never a default any control applies on its own.
//
// SCHEME: `ui-vt-{surface}-{token}` — `surface` names the OWNING surface (a control's own tag-ish slug,
// e.g. `super-shell-segment`), `token` names the PERSISTENT IDENTITY within it (a slot name, a stable id
// — never an array index, which is not identity). `viewTransitionName` sanitizes both into one valid CSS
// custom-ident so a caller never hand-rolls the escaping.
//
// PAIRING LAW (why ONE name, not one per element): the platform pairs an "old" snapshot and a "new"
// snapshot that carry the SAME `view-transition-name` and animates between their rects — but a single
// flat snapshot may contain that name on AT MOST ONE painted (not `display:none`) element, or the
// transition throws. The trick a caller must know: give EVERY element that can occupy one visual "role"
// the SAME name (e.g. every segment in a segmented pane, only one ever visible at a time via CSS) —
// the browser then morphs whichever one was visible before into whichever one is visible after, even
// though they are different DOM nodes, because visibility (not presence) is what the snapshot sees.
// The flip side of that law: the token must be unique per DOCUMENT, not per surface INSTANCE — a surface
// that can be mounted more than once on a page (a shell, an outlet) folds an instance discriminator
// (its authored `id`, else a per-document counter) into the token, or two instances paint the same
// name in one snapshot and the platform aborts the whole transition (`ui-super-shell` does exactly this).
//
// OPT-IN, BYTE-IDENTICAL WHEN OFF (same law as `withViewTransition`): a caller applies a name ONLY when
// its own opt-in prop is set — never unconditionally — so a build with the opt-in off never touches
// `style.viewTransitionName` at all, not even to clear it. `setViewTransitionName` codifies that guard.

/** Builds one scoped `view-transition-name` value: `ui-vt-{surface}-{token}`, every character outside
 *  `[a-zA-Z0-9-]` in either part replaced with `-` (CSS custom-ident is otherwise unconstrained, but
 *  callers pass slot/id strings that may carry other characters — this keeps the result always valid,
 *  never a caller-visible `DOMException` from an untrusted token). The `ui-vt-` prefix scopes every
 *  fleet-convention name into one collision-free namespace, distinct from a consumer's own names.
 *  CAVEAT — the sanitizer is lossy on purpose: `a b`, `a-b` and `a_b` all collapse to `a-b`, so two
 *  tokens that differ only in such characters (or a `surface`/`token` pair whose boundary is ambiguous,
 *  `foo`+`bar-x` vs `foo-bar`+`x`) yield ONE name. Callers own token distinctness at the identity grain
 *  they care about (slot names, ids, instance counters — already `[a-zA-Z0-9-]` in the fleet). */
export function viewTransitionName(surface: string, token: string): string {
  const clean = (s: string): string => s.replace(/[^a-zA-Z0-9-]/g, '-')
  return `ui-vt-${clean(surface)}-${clean(token)}`
}

/** Applies (`enabled`) or leaves untouched (`!enabled`) a `view-transition-name` on `el.style` — the
 *  named-morph counterpart to `withViewTransition`'s own enabled-gate. Deliberately NEVER clears the
 *  property on the disabled path: a caller's own opt-in prop is compose-time/one-shot (the same timing
 *  as the surfaces that use it today), so "disabled" means "never called," not "called then undone" —
 *  matching `withViewTransition`'s byte-identical-when-off law without adding a mutation neither path
 *  needs. */
export function setViewTransitionName(el: HTMLElement, name: string, enabled: boolean): void {
  if (!enabled) return
  el.style.viewTransitionName = name
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
