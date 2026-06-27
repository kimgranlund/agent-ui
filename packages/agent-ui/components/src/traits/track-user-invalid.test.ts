import { describe, it, expect } from 'vitest'
import { inspect } from '../reactive/index.ts'
import { UIElement } from '../dom/index.ts'
import { trackUserInvalid, type TrackUserInvalidController } from './track-user-invalid.ts'

// Phase-1 — the trackUserInvalid TIMING controller (ADR-0014 clause 2c, G4). `interacted` is false until the
// first blur/change, then true; the consumer composes `userInvalid = interacted.value && invalid()` and the
// CONTROL applies the AX/custom state (a controller cannot reach the protected `internals`). Listeners ride
// `host.listen` → the connection AbortSignal (zero residue on disconnect, re-armed on reconnect); `release()`
// is idempotent early teardown. Named probes: interacted-timing · userinvalid-gate · capture-descendant ·
// idempotent · reset · release · zero-residue · re-arm · negative-control.

// A throwaway host that installs the controller in `connected()` and an `applied` effect that mirrors the
// control's apply step — reading `userInvalid()` so a scope-owned effect SUBSCRIBES to `interacted` (the
// residue probe inspects that subscription). `invalidFlag` is a plain field standing in for the control's
// `validity()` — read lazily by `invalid`, only consulted once `interacted` is true (the `&&` short-circuit).
class InvalidEl extends UIElement {
  controller: TrackUserInvalidController | null = null
  invalidFlag = false
  applied = false
  protected connected(): void {
    const c = trackUserInvalid(this, { invalid: () => this.invalidFlag })
    this.controller = c
    // Scope-owned apply effect: re-runs when `interacted` flips, reads the composed gate (the control would
    // reflect this onto internals; here it just records the value + provides a subscriber for the residue probe).
    this.effect(() => {
      this.applied = c.userInvalid()
    })
  }
}
customElements.define('ui-invalid-probe', InvalidEl)

// A bare host that does NOT install the controller — the negative control proving the tracking is the
// trait's, not a free/native effect of blur/change.
class BareEl extends UIElement {}
customElements.define('ui-invalid-bare', BareEl)

const blur = (target: EventTarget): void => void target.dispatchEvent(new Event('blur')) // blur does not bubble
const change = (target: EventTarget): void => void target.dispatchEvent(new Event('change', { bubbles: true }))

describe('trackUserInvalid — first-interaction timing (ADR-0014 §2c)', () => {
  it('interacted-timing: false until the first blur, then true; change also flips it', () => {
    const el = new InvalidEl()
    document.body.append(el)
    expect(el.controller!.interacted.value).toBe(false) // suppressed before any interaction

    blur(el)
    expect(el.controller!.interacted.value).toBe(true) // first blur flips it (synchronous signal write)
    el.remove()

    const el2 = new InvalidEl()
    document.body.append(el2)
    expect(el2.controller!.interacted.value).toBe(false)
    change(el2)
    expect(el2.controller!.interacted.value).toBe(true) // change is the other interaction trigger
    el2.remove()
  })

  it('userinvalid-gate: userInvalid stays false pre-interaction even when invalid, then tracks validity', async () => {
    const el = new InvalidEl()
    el.invalidFlag = true // invalid from the start…
    document.body.append(el)
    await el.updateComplete

    expect(el.controller!.userInvalid()).toBe(false) // …but suppressed until interaction (the timing gate)
    expect(el.applied).toBe(false) // the apply effect saw the gate closed

    blur(el)
    await el.updateComplete // the apply effect re-runs on the interacted flip (microtask-batched)
    expect(el.controller!.userInvalid()).toBe(true) // post-interaction the gate opens to validity
    expect(el.applied).toBe(true) // the control would now add :state(user-invalid) + aria-invalid

    el.invalidFlag = false
    blur(el) // re-fire to re-evaluate (invalidFlag is a plain field, not a signal — an interaction re-runs)
    await el.updateComplete
    expect(el.controller!.userInvalid()).toBe(false) // valid again ⇒ gate composes to false
    el.remove()
  })

  it('capture-descendant: a focusable child blur (non-bubbling) is caught via the capture phase', () => {
    // The text-field's focusable element is the editor CHILD; blur does not bubble, so the host listener must
    // capture it. This proves the controller works for the real consumer, not only host-level blur.
    const el = new InvalidEl()
    const child = document.createElement('div')
    el.append(child)
    document.body.append(el)
    expect(el.controller!.interacted.value).toBe(false)

    child.dispatchEvent(new Event('blur')) // bubbles:false — only the capture phase reaches the host
    expect(el.controller!.interacted.value).toBe(true)
    el.remove()
  })

  it('idempotent: repeated interactions keep interacted true and stable (no throw, no flip-back)', () => {
    const el = new InvalidEl()
    document.body.append(el)
    blur(el)
    change(el)
    blur(el) // multiple interactions
    expect(el.controller!.interacted.value).toBe(true) // stays true; the Object.is-equal sets are no-ops
    el.remove()
  })

  it('reset: flips interacted back to false (re-gating user-invalid), idempotent, then a fresh blur re-arms', () => {
    const el = new InvalidEl()
    el.invalidFlag = true // invalid throughout — only the timing gate moves
    document.body.append(el)
    const c = el.controller!

    blur(el)
    expect(c.interacted.value).toBe(true)
    expect(c.userInvalid()).toBe(true) // interacted && invalid → the danger treatment is on

    c.reset()
    expect(c.interacted.value).toBe(false) // back to first-paint suppression
    expect(c.userInvalid()).toBe(false) // gated off again even though invalid is still true
    c.reset() // idempotent — safe twice, equal-set is a no-op
    expect(c.interacted.value).toBe(false)

    blur(el) // a fresh interaction re-arms the timing after the reset
    expect(c.interacted.value).toBe(true)
    expect(c.userInvalid()).toBe(true)
    el.remove()
  })

  it('release: idempotent and stops tracking (released handlers no-op)', () => {
    const el = new InvalidEl()
    document.body.append(el)
    const c = el.controller!

    c.release()
    c.release() // idempotent — safe twice, no throw

    blur(el)
    change(el)
    expect(c.interacted.value).toBe(false) // released ⇒ further interactions are ignored
    el.remove()
  })

  it('zero-residue: disconnect removes the listeners and leaves interacted with zero subscribers', () => {
    const el = new InvalidEl()
    document.body.append(el)
    const c = el.controller!
    expect(inspect(c.interacted).subscribers).toBeGreaterThanOrEqual(1) // anti-vacuous: the apply effect subscribed

    el.remove() // disconnect → scope disposed (effect dies) + AbortSignal aborted (listeners removed)
    expect(inspect(c.interacted).subscribers).toBe(0) // the scope-owned subscriber is gone → no leftover graph edge

    blur(el) // the removed blur listener must not fire
    change(el)
    expect(c.interacted.value).toBe(false) // zero residue: a post-disconnect interaction does not flip it
  })

  it('re-arm: reconnect installs a fresh controller that tracks again from false', () => {
    const el = new InvalidEl()
    document.body.append(el)
    blur(el)
    expect(el.controller!.interacted.value).toBe(true)

    el.remove() // disconnect
    document.body.append(el) // reconnect → connected() re-runs → a FRESH controller + listeners
    expect(el.controller!.interacted.value).toBe(false) // a new interacted cell, back to the suppressed state

    change(el)
    expect(el.controller!.interacted.value).toBe(true) // re-armed: the fresh listeners track again
    el.remove()
  })

  it('negative-control: tracking requires the trait, and only blur/change flip it (not any event)', () => {
    // (a) A bare host with no trait has no tracking machinery at all.
    const bare = new BareEl()
    document.body.append(bare)
    expect((bare as BareEl & { controller?: unknown }).controller).toBeUndefined()
    bare.remove()

    // (b) With the trait, an UNTRACKED event does not flip interacted — the timing is the trait's specific
    // blur/change wiring, not a free consequence of any DOM activity. Anti-vacuous: a blur THEN flips it.
    const el = new InvalidEl()
    document.body.append(el)
    el.dispatchEvent(new Event('input', { bubbles: true })) // not a tracked trigger
    el.dispatchEvent(new FocusEvent('focus')) // not a tracked trigger
    expect(el.controller!.interacted.value).toBe(false) // untracked events leave it suppressed
    blur(el)
    expect(el.controller!.interacted.value).toBe(true) // only blur/change flip it
    el.remove()
  })
})
