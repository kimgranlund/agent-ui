// tabbable.ts — the focusability trait (ADR-0010). A light-DOM custom element inherits NONE of a native
// button's focus behaviour, so an interactive control opts into tab participation by calling this from
// `connected()`.
//
// Semantics (native-button parity):
//  · enabled  — `host.tabIndex = 0` ⇒ keyboard-focusable (role=button parity; lets the focus ring show).
//  · disabled — `removeAttribute('tabindex')` ⇒ out of the tab order, matching native `<button disabled>`.
//  · reactive — the rule runs in a scope-owned `host.effect`, so toggling the `disabled` signal re-applies it.
//
// Where `press-activation` only GUARDS at event time (no reactivity), `tabbable` must ACTIVELY change a DOM
// attribute when `disabled` toggles — hence an effect, not listeners. Both are scope/abort-owned + leak-free:
// the effect is created under the host's connection scope, so it dies on disconnect and re-installs on
// reconnect (`connected()` re-runs). `release()` is an idempotent early-teardown escape hatch.
//
// `traits → dom` is the one allowed cross-layer direction (reactive ← dom ← traits); the host type only.

import type { UIElement } from '../dom/index.ts'

export interface TabbableOptions {
  /** True ⇒ the control is disabled and leaves the tab order. Read reactively inside the effect. */
  disabled: () => boolean
}

/**
 * Make a `UIElement` keyboard-focusable (`tabindex=0`) while enabled and remove it from the tab order while
 * disabled, native-button style. Invoke from the control's `connected()` (where the connection scope is
 * live). Returns `release()` for early teardown (idempotent); otherwise the effect is disposed when the host
 * disconnects.
 */
export function tabbable(host: UIElement, opts: TabbableOptions): () => void {
  let released = false

  const dispose = host.effect(() => {
    if (released) return
    if (opts.disabled()) host.removeAttribute('tabindex') // disabled → out of the tab order (native parity)
    else host.tabIndex = 0 // enabled → focusable, role=button parity
  })

  return () => {
    if (released) return
    released = true
    dispose()
  }
}
