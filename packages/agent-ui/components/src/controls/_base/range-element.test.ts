import { describe, it, expect } from 'vitest'
import { UIRangeElement } from './range-element.ts'

// UIRangeElement jsdom probes — RNG-C1 (value model/clamp/snap), RNG-C2 (ARIA), RNG-C3 (keyboard),
// RNG-C5 (--value-pct geometry seam). NOT tested here: RNG-C4 (value-drag; pointer events only).
//
// jsdom reality: `attachInternals()` works but the form-association surface is absent
// (setFormValue/setValidity are undefined). We stub them before connect so the UIFormElement
// scope-owned effects do not throw. ARIA IDL properties (ariaValueNow etc.) ARE present in jsdom
// via ARIAMixin; we assert them directly. Focus/blur events are dispatched programmatically.

// ── form-internals stub (same pattern as form.test.ts) ──────────────────────────

function asMutable(internals: ElementInternals): Record<string, unknown> {
  return internals as unknown as Record<string, unknown>
}

function stubFormInternals(internals: ElementInternals): void {
  const i = asMutable(internals)
  i.setFormValue = (): void => {}
  i.setValidity = (): void => {}
}

// ── a minimal concrete subclass (UIRangeElement is abstract in usage; no tag to define) ──

class ProbeRange extends UIRangeElement {
  // Expose the protected seam so tests can drive focused/blurred state via the element itself.
  get internalsProbe(): ElementInternals {
    return this.internals
  }
  effectiveDisabledProbe(): boolean {
    return this.effectiveDisabled()
  }
}
customElements.define('ui-range-probe', ProbeRange)

/** Make a fresh probe, stub its internals, and optionally connect it. */
function makeRange(connect = false): ProbeRange {
  const el = new ProbeRange()
  stubFormInternals(el.internalsProbe)
  if (connect) document.body.append(el)
  return el
}

function dispatchKey(el: Element, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

// ── RNG-C1: value model — clamp + snap ──────────────────────────────────────────

describe('UIRangeElement — RNG-C1 value model', () => {
  it('default props: min=0 max=100 step=1 value=0', () => {
    const el = makeRange()
    expect(el.min).toBe(0)
    expect(el.max).toBe(100)
    expect(el.step).toBe(1)
    expect(el.value).toBe(0)
  })

  it('value is clamped to [min, max] on connect', () => {
    const el = makeRange()
    el.value = 150 // above max=100
    document.body.append(el)
    expect(el.value).toBe(100) // clamped to max
    el.remove()
  })

  it('value below min is clamped to min', () => {
    const el = makeRange()
    el.value = -10
    document.body.append(el)
    expect(el.value).toBe(0)
    el.remove()
  })

  it('value is normalised when min or max changes after connect', async () => {
    const el = makeRange()
    el.value = 80
    document.body.append(el)
    expect(el.value).toBe(80)
    el.max = 50 // value now exceeds max; normaliser effect is queued
    await el.updateComplete // drain the microtask queue
    expect(el.value).toBe(50)
    el.remove()
  })

  it('value snaps to nearest step from min', () => {
    const el = makeRange()
    el.min = 0
    el.max = 100
    el.step = 10
    el.value = 73 // nearest step = 70
    document.body.append(el)
    expect(el.value).toBe(70)
    el.remove()
  })

  it('value rounds up to nearest step when midpoint', () => {
    const el = makeRange()
    el.min = 0
    el.max = 100
    el.step = 10
    el.value = 75 // exactly 7.5 steps → rounds to 8 → 80
    document.body.append(el)
    expect(el.value).toBe(80)
    el.remove()
  })

  it('step ≤ 0 → continuous; clamp only, no snap', () => {
    const el = makeRange()
    el.min = 0
    el.max = 100
    el.step = 0 // continuous
    el.value = 37.5
    document.body.append(el)
    expect(el.value).toBe(37.5)
    el.remove()
  })

  it('min > max → zero-length range; value pinned to min', () => {
    const el = makeRange()
    el.min = 80
    el.max = 20 // degenerate
    el.value = 50
    document.body.append(el)
    expect(el.value).toBe(80) // pinned to min
    el.remove()
  })

  it('max is always reachable exactly when step does not divide (max−min)', () => {
    // min=0 max=95 step=10 → reachable: 0,10,…,90 normally; but End/clamp to max must reach 95
    const el = makeRange()
    el.min = 0
    el.max = 95
    el.step = 10
    el.value = 95 // set to exact max
    document.body.append(el)
    expect(el.value).toBe(95) // max is always reachable
    el.remove()
  })

  it('snap-down rule: value just above last step snaps down, not above max', () => {
    const el = makeRange()
    el.min = 0
    el.max = 95
    el.step = 10
    el.value = 92 // nearest step 90 (round 9.2→9 → 90), not 100
    document.body.append(el)
    expect(el.value).toBe(90)
    el.remove()
  })
})

// ── RNG-C2: ARIA ────────────────────────────────────────────────────────────────

describe('UIRangeElement — RNG-C2 ARIA', () => {
  it('sets internals.role = "slider" on connect', () => {
    const el = makeRange()
    document.body.append(el)
    expect(el.internalsProbe.role).toBe('slider')
    el.remove()
  })

  it('ariaValueNow/Min/Max reflect current value/min/max strings', () => {
    const el = makeRange()
    el.min = 10
    el.max = 90
    el.value = 50
    document.body.append(el)
    expect(el.internalsProbe.ariaValueNow).toBe('50')
    expect(el.internalsProbe.ariaValueMin).toBe('10')
    expect(el.internalsProbe.ariaValueMax).toBe('90')
    el.remove()
  })

  it('ariaValueNow updates reactively when value changes', async () => {
    const el = makeRange()
    document.body.append(el)
    el.value = 42
    await el.updateComplete
    expect(el.internalsProbe.ariaValueNow).toBe('42')
    el.remove()
  })

  it('ariaValueMin/Max update reactively when min/max change', async () => {
    const el = makeRange()
    document.body.append(el)
    el.min = 20
    el.max = 80
    await el.updateComplete
    expect(el.internalsProbe.ariaValueMin).toBe('20')
    expect(el.internalsProbe.ariaValueMax).toBe('80')
    el.remove()
  })

  it('ariaValueText reflects the valueText hook (default = String(value))', () => {
    const el = makeRange()
    el.value = 33
    document.body.append(el)
    expect(el.internalsProbe.ariaValueText).toBe('33')
    el.remove()
  })

  it('ariaValueNow reflects the normalised value (clamped), not the raw set value', async () => {
    const el = makeRange()
    document.body.append(el)
    el.value = 999 // above max=100; normaliser + ARIA effects queue
    await el.updateComplete
    expect(el.internalsProbe.ariaValueNow).toBe('100')
    el.remove()
  })
})

// ── RNG-C3: keyboard step ───────────────────────────────────────────────────────

describe('UIRangeElement — RNG-C3 keyboard', () => {
  it('ArrowRight increments by step', () => {
    const el = makeRange()
    el.value = 50
    el.step = 5
    document.body.append(el)
    dispatchKey(el, 'ArrowRight')
    expect(el.value).toBe(55)
    el.remove()
  })

  it('ArrowUp increments by step', () => {
    const el = makeRange()
    el.value = 50
    el.step = 5
    document.body.append(el)
    dispatchKey(el, 'ArrowUp')
    expect(el.value).toBe(55)
    el.remove()
  })

  it('ArrowLeft decrements by step', () => {
    const el = makeRange()
    el.value = 50
    el.step = 5
    document.body.append(el)
    dispatchKey(el, 'ArrowLeft')
    expect(el.value).toBe(45)
    el.remove()
  })

  it('ArrowDown decrements by step', () => {
    const el = makeRange()
    el.value = 50
    el.step = 5
    document.body.append(el)
    dispatchKey(el, 'ArrowDown')
    expect(el.value).toBe(45)
    el.remove()
  })

  it('PageUp increments by largeStep (10×step)', () => {
    const el = makeRange()
    el.value = 20
    el.step = 2
    document.body.append(el)
    dispatchKey(el, 'PageUp')
    expect(el.value).toBe(40) // 20 + 20
    el.remove()
  })

  it('PageDown decrements by largeStep (10×step)', () => {
    const el = makeRange()
    el.value = 60
    el.step = 2
    document.body.append(el)
    dispatchKey(el, 'PageDown')
    expect(el.value).toBe(40)
    el.remove()
  })

  it('Home sets value to min', () => {
    const el = makeRange()
    el.min = 10
    el.max = 90
    el.value = 55
    document.body.append(el)
    dispatchKey(el, 'Home')
    expect(el.value).toBe(10)
    el.remove()
  })

  it('End sets value to max exactly', () => {
    const el = makeRange()
    el.min = 0
    el.max = 95
    el.step = 10
    el.value = 0
    document.body.append(el)
    dispatchKey(el, 'End')
    expect(el.value).toBe(95) // max exactly, even though 95 is not a step multiple
    el.remove()
  })

  it('ArrowRight at max stays at max (no overshoot)', () => {
    const el = makeRange()
    el.value = 100 // at max
    document.body.append(el)
    dispatchKey(el, 'ArrowRight')
    expect(el.value).toBe(100)
    el.remove()
  })

  it('ArrowLeft at min stays at min (no undershoot)', () => {
    const el = makeRange()
    el.value = 0
    document.body.append(el)
    dispatchKey(el, 'ArrowLeft')
    expect(el.value).toBe(0)
    el.remove()
  })

  it('keyboard emits input event on each step change', () => {
    const el = makeRange()
    el.value = 50
    document.body.append(el)
    let inputCount = 0
    el.addEventListener('input', () => { inputCount++ })
    dispatchKey(el, 'ArrowRight')
    expect(inputCount).toBe(1)
    dispatchKey(el, 'ArrowLeft')
    expect(inputCount).toBe(2)
    el.remove()
  })

  it('keyboard emits no input when value does not change (at boundary)', () => {
    const el = makeRange()
    el.value = 100 // at max
    document.body.append(el)
    let inputCount = 0
    el.addEventListener('input', () => { inputCount++ })
    dispatchKey(el, 'ArrowRight') // no-op at max
    expect(inputCount).toBe(0)
    el.remove()
  })

  it('emits change on blur when value changed since focus', () => {
    const el = makeRange()
    el.value = 50
    document.body.append(el)
    let changed = 0
    el.addEventListener('change', () => { changed++ })
    el.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
    dispatchKey(el, 'ArrowRight')
    expect(changed).toBe(0) // not yet
    el.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    expect(changed).toBe(1)
    el.remove()
  })

  it('does NOT emit change on blur when value did not change', () => {
    const el = makeRange()
    el.value = 50
    document.body.append(el)
    let changed = 0
    el.addEventListener('change', () => { changed++ })
    el.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
    // no key pressed
    el.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    expect(changed).toBe(0)
    el.remove()
  })

  it('disabled host ignores keyboard input', () => {
    const el = makeRange()
    el.value = 50
    el.disabled = true
    document.body.append(el)
    dispatchKey(el, 'ArrowRight')
    expect(el.value).toBe(50) // unchanged
    el.remove()
  })
})

// ── RNG-C5: --value-pct geometry seam ───────────────────────────────────────────

describe('UIRangeElement — RNG-C5 --value-pct geometry seam', () => {
  it('--value-pct is 0 at min (value=0, min=0, max=100)', () => {
    const el = makeRange()
    el.value = 0
    document.body.append(el)
    expect(el.style.getPropertyValue('--value-pct')).toBe('0')
    el.remove()
  })

  it('--value-pct is 100 at max (value=100, min=0, max=100)', () => {
    const el = makeRange()
    el.value = 100
    document.body.append(el)
    expect(el.style.getPropertyValue('--value-pct')).toBe('100')
    el.remove()
  })

  it('--value-pct is 50 at midpoint', () => {
    const el = makeRange()
    el.value = 50
    document.body.append(el)
    expect(el.style.getPropertyValue('--value-pct')).toBe('50')
    el.remove()
  })

  it('--value-pct updates reactively when value changes', async () => {
    const el = makeRange()
    document.body.append(el)
    el.value = 25
    await el.updateComplete
    expect(el.style.getPropertyValue('--value-pct')).toBe('25')
    el.value = 75
    await el.updateComplete
    expect(el.style.getPropertyValue('--value-pct')).toBe('75')
    el.remove()
  })

  it('--value-pct is 0 in a degenerate range (min >= max)', () => {
    const el = makeRange()
    el.min = 50
    el.max = 50 // min === max
    el.value = 50
    document.body.append(el)
    expect(el.style.getPropertyValue('--value-pct')).toBe('0')
    el.remove()
  })

  it('--value-pct reflects normalised value, not raw over-max set', async () => {
    const el = makeRange()
    document.body.append(el)
    el.value = 200 // clamped to 100; normaliser + geometry effects queue
    await el.updateComplete
    expect(el.style.getPropertyValue('--value-pct')).toBe('100')
    el.remove()
  })
})
