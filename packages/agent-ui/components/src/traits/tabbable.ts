// tabbable.ts — the focusability trait (ADR-0010). A light-DOM custom element inherits NONE of a native
// button's focus behaviour, so an interactive control opts into tab participation by calling this from
// `connected()`.
//
// Semantics (native-button parity):
//  · enabled  — `host.tabIndex = 0` ⇒ keyboard-focusable (role=button parity; lets the focus ring show).
//  · disabled — `removeAttribute('tabindex')` ⇒ out of the tab order, matching native `<button disabled>`.
//  · reactive — the rule runs in a scope-owned `host.effect`, so toggling the `disabled` signal re-applies it.
//
// THE ROVING-MARKER CONTRACT (ADR-0121 amendment, post-toolbar): while `disabled` is false, this trait
// DEFERS the `tabIndex = 0` write whenever the host carries `ROVING_ITEM_ATTR` (`data-roving`) —
// traits/roving-focus.ts's ownership marker, stamped on every item a roving-focus host manages (see that
// module's own banner for the full ordering story: a roving PARENT's synchronous init runs before this
// trait's own `connected()`-installed effect for items connected in the same subtree, so without this
// deferral a `ui-button`/`ui-radio`/any tabbable item inside a roving host would silently reclaim a second
// tab stop the instant it connects — `ui-toolbar` → `ui-button` is what surfaced the bug; `ui-radio-group`
// → `ui-radio` carried it too, latent). The check runs on EVERY effect re-run (not just the first), so a
// later re-enable while still roving-owned correctly stays deferred (no "two tab stops" regression) —
// `disabled`/`aria-disabled` semantics are entirely UNCHANGED by this; only the tabIndex=0 WRITE yields.
// Absent the marker (every non-roving-hosted tabbable control — the overwhelming majority), this trait's
// behavior is byte-identical to the pre-ADR-0121 rule (tabbable.test.ts's own identity-style probe pins it).
//
// Where `press-activation` only GUARDS at event time (no reactivity), `tabbable` must ACTIVELY change a DOM
// attribute when `disabled` toggles — hence an effect, not listeners. Both are scope/abort-owned + leak-free:
// the effect is created under the host's connection scope, so it dies on disconnect and re-installs on
// reconnect (`connected()` re-runs). `release()` is an idempotent early-teardown escape hatch.
//
// `traits → dom` is the one allowed cross-layer direction (reactive ← dom ← traits); the host type only.
// `ROVING_ITEM_ATTR` is imported from the sibling `roving-focus.ts` trait — a same-layer (traits → traits)
// import, permitted by layering.test.ts (only an upward import is a violation).

import type { UIElement } from '../dom/index.ts'
import { ROVING_ITEM_ATTR } from './roving-focus.ts'

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
    if (opts.disabled()) {
      host.removeAttribute('tabindex') // disabled → out of the tab order (native parity)
      return
    }
    // ROVING-MARKER CONTRACT (see the file banner) — an external roving-focus host already owns this
    // item's tab-stop; yield the write rather than reclaiming a second tabindex=0.
    if (host.hasAttribute(ROVING_ITEM_ATTR)) return
    host.tabIndex = 0 // enabled, not roving-owned → focusable, role=button parity
  })

  return () => {
    if (released) return
    released = true
    dispose()
  }
}
