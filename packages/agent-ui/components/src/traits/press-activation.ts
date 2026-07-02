// press-activation.ts — the Space/Enter → click trait (plan §7). A light-DOM custom element does NOT
// inherit the native button's keyboard activation, so a control opts in by calling this from `connected()`.
//
// Semantics (native-button parity):
//  · Space — `preventDefault` on keydown (stop the page from scrolling), activate on key UP.
//  · Enter — `preventDefault` on keydown, THEN activate (bug-B fix, cross-engine e2e-caught): a real
//    `<button>` has no OTHER default action competing for Enter, so nothing ever leaks; ours activates via
//    an explicit `host.click()` inside a keydown LISTENER, which does not itself consume the keydown's
//    default action. Chromium evaluates that default action AFTER the listener returns, against WHATEVER
//    is focused AT THAT POINT — and `host.click()` can synchronously cascade into focus moving elsewhere
//    (e.g. Enter-on-submit → provider.submit() → reportValidity() refocusing an invalid sibling field)
//    before default-action time. An unconsumed Enter then lands wherever focus ended up — a contenteditable
//    editor's native default action for Enter is "insert a line break," corrupting it. WebKit does not
//    reproduce this (its default-action timing/target resolution differs), but the underlying hazard —
//    Enter's default action must not survive to chase a mid-dispatch focus change — is real in any engine;
//    consuming it explicitly, matching Space's own already-explicit `preventDefault`, closes it fleet-wide.
//  · activation = `host.click()` (fires a native-parity click) — a plain method call, NOT itself affected
//    by `preventDefault()` on the keydown (that only suppresses the BROWSER's own default reaction to the
//    key event, never an imperative call a listener makes).
//  · disabled-inert — when `opts.disabled()` is true the trait does NOTHING (no preventDefault, no click).
//
// Listeners ride `host.listen` → the host's connection `AbortSignal`, so they auto-remove on disconnect;
// `release()` is an early-teardown escape hatch (idempotent — it flips a guard the handlers check).
//
// `traits → dom` is the one allowed cross-layer direction (reactive ← dom ← traits); the host type only.

import type { UIElement } from '../dom/index.ts'

export interface PressActivationOptions {
  /** True ⇒ the control is disabled and the trait is inert. Read fresh on each key event. */
  disabled: () => boolean
}

const isSpace = (key: string): boolean => key === ' ' || key === 'Spacebar'

/**
 * Wire Space/Enter → `host.click()` on a `UIElement`, native-button style. Invoke from the control's
 * `connected()` (where the host connection is live). Returns `release()` for early teardown (idempotent);
 * otherwise the listeners auto-remove when the host disconnects.
 */
export function pressActivation(host: UIElement, opts: PressActivationOptions): () => void {
  let released = false

  host.listen(host, 'keydown', (event) => {
    if (released || opts.disabled()) return
    const e = event as KeyboardEvent
    if (isSpace(e.key)) e.preventDefault() // stop the page scrolling; activation waits for keyup
    else if (e.key === 'Enter') {
      e.preventDefault() // consume the keydown's default action (bug-B fix) — see the header note
      host.click() // Enter activates on keydown
    }
  })

  host.listen(host, 'keyup', (event) => {
    if (released || opts.disabled()) return
    const e = event as KeyboardEvent
    if (isSpace(e.key)) host.click() // Space activates on keyup
  })

  return () => {
    released = true
  }
}
