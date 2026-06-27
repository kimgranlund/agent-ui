// press-activation.ts — the Space/Enter → click trait (plan §7). A light-DOM custom element does NOT
// inherit the native button's keyboard activation, so a control opts in by calling this from `connected()`.
//
// Semantics (native-button parity):
//  · Space — `preventDefault` on keydown (stop the page from scrolling), activate on key UP.
//  · Enter — activate on keydown.
//  · activation = `host.click()` (fires a native-parity click).
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
    else if (e.key === 'Enter') host.click() // Enter activates on keydown
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
