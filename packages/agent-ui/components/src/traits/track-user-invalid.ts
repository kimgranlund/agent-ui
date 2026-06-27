// track-user-invalid.ts — the user-invalid TIMING controller (ADR-0014 clause 2c, G4).
//
// A form control must NOT flash `aria-invalid` / `:state(user-invalid)` on first paint — the danger
// treatment surfaces only AFTER the user has interacted (the first blur or change). This controller owns
// that TIMING: it watches the host for the first interaction and flips a reactive `interacted` cell true,
// exposing it so the CONTROL gates the danger state. The control APPLIES the AX/custom state via its
// protected `internals` (a controller cannot reach `host.internals` — the same `tabbable`/`ariaDisabled`
// split ADR-0010 forced); this supplies the TIMING, never the application.
//
// Stateless trait vs stateful controller (plan §7 'traits + controllers'): `tabbable`/`press-activation`
// are stateless traits; this OWNS a signal, so it is a CONTROLLER — same `(host, opts) => …` seam, but its
// return carries the `interacted` signal (+ the composed `userInvalid()` convenience) alongside `release()`.
//
// Lifetime (mirrors `press-activation`): the blur/change listeners ride `host.listen` → the connection
// `AbortSignal`, so they auto-remove on disconnect — zero residue, and re-armed on reconnect when
// `connected()` re-runs the controller. `release()` is an idempotent early-teardown guard the handlers
// check; like `press-activation` it stops the BEHAVIOUR (the listeners themselves die with the connection).
//
// Layering: `traits → reactive` (the `signal`/`ReadonlySignal` cell) and `traits → dom` (the host type) are
// both DOWNWARD imports (reactive L0 ← dom L1 ← traits L2), allowed by the import-layering trip-wire — the
// signal-OWNING controller needs the kernel that the stateless `tabbable`/`press-activation` traits do not.

import { signal } from '../reactive/index.ts'
import type { ReadonlySignal } from '../reactive/index.ts'
import type { UIElement } from '../dom/index.ts'

export interface TrackUserInvalidOptions {
  /** True ⇒ the control is currently invalid. Read lazily by `userInvalid()`, never to drive the timing. */
  invalid: () => boolean
}

export interface TrackUserInvalidController {
  /**
   * The TIMING signal: false until the first blur/change on the host, then true. The control reads this
   * (directly or via `userInvalid()`) to gate the user-invalid treatment. Read-only to consumers.
   */
  readonly interacted: ReadonlySignal<boolean>
  /**
   * The composed gate: `interacted.value && invalid()`. The control's apply effect reads this and reflects
   * it onto `internals` (`states.add/delete('user-invalid')` + the editor `aria-invalid`). Reading it inside
   * an effect tracks `interacted` (always) and `invalid`'s deps (only once interacted — `&&` short-circuits,
   * so validity is untracked until the user has interacted, which is the whole point).
   */
  userInvalid: () => boolean
  /**
   * Clear the touched state back to its first-paint suppression: flips `interacted` to false so the
   * user-invalid treatment is gated off again until the next blur/change. The control calls this from its
   * `formReset()` so a form reset does not leave a required-empty field showing `:state(user-invalid)` (native
   * parity). Idempotent (a no-op when already false — an Object.is-equal set); does not touch the listeners.
   */
  reset: () => void
  /** Idempotent early teardown: stops the behaviour. Otherwise the listeners die with the connection. */
  release: () => void
}

/**
 * Track first-interaction TIMING for a form control's user-invalid treatment. Invoke from the control's
 * `connected()` (where the connection scope + `AbortSignal` are live). Returns the `interacted` signal +
 * the composed `userInvalid()` gate + an idempotent `release()`; the listeners auto-remove on disconnect
 * and re-arm on reconnect.
 */
export function trackUserInvalid(host: UIElement, opts: TrackUserInvalidOptions): TrackUserInvalidController {
  let released = false
  const interacted = signal(false)

  const onInteract = (): void => {
    if (released) return
    interacted.value = true // first interaction flips it; later sets are Object.is no-ops (idempotent)
  }

  // `blur` does NOT bubble, so a host listener captures it — the capture phase reaches the host before a
  // focusable descendant (e.g. the text-field editor part), catching its blur. `change` bubbles (native +
  // the control's host-emitted `change`), so it needs no capture.
  host.listen(host, 'blur', onInteract, { capture: true })
  host.listen(host, 'change', onInteract)

  return {
    interacted,
    userInvalid: () => interacted.value && opts.invalid(),
    reset: () => {
      interacted.value = false // back to first-paint suppression; equal-set is an Object.is no-op (idempotent)
    },
    release: () => {
      released = true
    },
  }
}
