import { describe, it, expect } from 'vitest'
import { UISliderMultiElement } from './slider-multi.ts'
import { signal, inspect } from '../../reactive/index.ts'
import type { FormValue } from '../../dom/index.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// S2 jsdom probes — ui-slider-multi (decomp S2 · ADR-0042 · ADR-0041).
//
// Tests: value model (clamp/snap/lo≤hi invariant), ARIA on thumb elements, keyboard step per-thumb,
// nearer-thumb selection, formValue() pair, descriptor trip-wire (contract↔props bijection + biting NCs),
// zero-residue (connect→disconnect behavioral), valueDrag cleanup idempotency.
//
// jsdom reality: setFormValue/setValidity are absent in jsdom — stubbed before connect.
// setPointerCapture is absent on jsdom elements — stubbed per-rail for pointer tests.
// getBoundingClientRect returns all zeros — mocked per-rail for nearer-thumb test.
// The thumb elements are light-DOM children created in connected(); probe them via querySelector.

// ── jsdom stub — form-association surface (setFormValue/setValidity absent in jsdom) ───────────────

function stubFormAssoc(internals: ElementInternals): void {
  const i = internals as unknown as Record<string, unknown>
  if (typeof i['setFormValue'] !== 'function') {
    i['setFormValue'] = (): void => {}
    i['setValidity'] = (): void => {}
  }
}

// ── probe subclass — re-exposes the protected seams for test assertions ─────────────────────────

type ReleaseBinding = (() => void) | null

class ProbeSliderMulti extends UISliderMultiElement {
  /** Inspectable probe signal; co-subscribed to the connection-scope form effect via formValue().
   *  When the scope disposes on disconnect, the form effect loses all subscribers → this signal
   *  drops to 0 subscribers (the C10 zero-residue proof via inspect()). */
  readonly loSig = signal(0)

  protected override formValue(): FormValue {
    void this.loSig.value  // subscribe loSig via the scope-owned form effect
    return super.formValue()
  }

  /** Re-expose the protected `internals` seam for assertions on role/ARIA. */
  get probeInternals(): ElementInternals { return this.internalsSeam }
  /** Lo valueDrag cleanup function (null before first connect). */
  get probeLoBinding(): ReleaseBinding { return this.loBinding }
  /** Hi valueDrag cleanup function (null before first connect). */
  get probeHiBinding(): ReleaseBinding { return this.hiBinding }
  /** Call formValue() — the pair submitted to the owning form. */
  callFormValue(): unknown { return this.formValueSeam() }

  /** The lo thumb element (set during connected() light-DOM build). */
  get loThumb(): HTMLElement | null { return this.querySelector<HTMLElement>('.thumb[data-thumb="lo"]') }
  /** The hi thumb element (set during connected() light-DOM build). */
  get hiThumb(): HTMLElement | null { return this.querySelector<HTMLElement>('.thumb[data-thumb="hi"]') }
  /** The rail element (set during connected() light-DOM build). */
  get railEl(): HTMLElement | null { return this.querySelector<HTMLElement>('.rail') }
}
customElements.define('ui-slider-multi-probe', ProbeSliderMulti)

/** Make a fresh probe, stub its internals, and return it (NOT yet connected). */
function make(): ProbeSliderMulti {
  const el = new ProbeSliderMulti()
  stubFormAssoc(el.probeInternals)
  return el
}

/** Dispatch a keydown on a specific target element. */
const dispatchKey = (target: EventTarget, key: string): void => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

// ── upgrade + typed prop surface ──────────────────────────────────────────────────────────────────

describe('UISliderMultiElement — upgrade + typed props', () => {
  it('upgrades to the class; props default to min=0 max=100 step=1 size=md valueLo=0 valueHi=100', () => {
    const el = document.createElement('ui-slider-multi') as UISliderMultiElement
    expect(el).toBeInstanceOf(UISliderMultiElement)
    expect(el.min).toBe(0)
    expect(el.max).toBe(100)
    expect(el.step).toBe(1)
    expect(el.size).toBe('md')
    expect(el.valueLo).toBe(0)
    expect(el.valueHi).toBe(100)
    expect(el.disabled).toBe(false)
    expect(el.required).toBe(false)
    expect(el.name).toBe('')
  })

  it('size is a literal union — compile-time narrowing (negative control)', () => {
    const fn = (): void => {
      const el = new UISliderMultiElement()
      el.size = 'sm'
      el.size = 'lg'
      // @ts-expect-error — 'xl' is not a size member
      el.size = 'xl'
      // @ts-expect-error — a bare string is wider than the union
      el.size = 'x' as string
    }
    expect(typeof fn).toBe('function') // never invoked; the type errors are the assertion
  })

  it('self-defines as ui-slider-multi, guarded against double-define', () => {
    expect(customElements.get('ui-slider-multi')).toBe(UISliderMultiElement)
    expect(() => {
      if (!customElements.get('ui-slider-multi')) customElements.define('ui-slider-multi', UISliderMultiElement)
    }).not.toThrow()
  })
})

// ── ARIA (LLD-C2) ────────────────────────────────────────────────────────────────────────────────

describe('UISliderMultiElement — ARIA (LLD-C2)', () => {
  it('host internals.role is "group" (composite control — never a host attribute)', () => {
    const el = make()
    document.body.append(el)
    expect(el.probeInternals.role).toBe('group')
    expect(el.getAttribute('role')).toBeNull()
    for (const attr of Array.from(el.attributes)) expect(attr.name.startsWith('aria-')).toBe(false)
    el.remove()
  })

  it('lo thumb has role=slider, aria-valuenow=0, aria-valuemin=0, aria-valuemax=100 on connect', () => {
    const el = make()
    document.body.append(el)
    const lo = el.loThumb!
    expect(lo.getAttribute('role')).toBe('slider')
    expect(lo.getAttribute('aria-valuenow')).toBe('0')
    expect(lo.getAttribute('aria-valuemin')).toBe('0')
    expect(lo.getAttribute('aria-valuemax')).toBe('100') // max constrained to current hi (100)
    el.remove()
  })

  it('hi thumb has role=slider, aria-valuenow=100, aria-valuemin=0, aria-valuemax=100 on connect', () => {
    const el = make()
    document.body.append(el)
    const hi = el.hiThumb!
    expect(hi.getAttribute('role')).toBe('slider')
    expect(hi.getAttribute('aria-valuenow')).toBe('100')
    expect(hi.getAttribute('aria-valuemin')).toBe('0') // min constrained to current lo (0)
    expect(hi.getAttribute('aria-valuemax')).toBe('100')
    el.remove()
  })

  it('aria-valuenow updates reactively when valueLo changes', async () => {
    const el = make()
    document.body.append(el)
    el.valueLo = 30
    await el.updateComplete
    expect(el.loThumb!.getAttribute('aria-valuenow')).toBe('30')
    // lo thumb aria-valuemax is constrained to current hi (100, unchanged)
    expect(el.loThumb!.getAttribute('aria-valuemax')).toBe('100')
    el.remove()
  })

  it('lo thumb aria-valuemax tracks valueHi (constrained range max)', async () => {
    const el = make()
    document.body.append(el)
    el.valueHi = 70
    await el.updateComplete
    expect(el.loThumb!.getAttribute('aria-valuemax')).toBe('70') // lo max = current hi
    expect(el.hiThumb!.getAttribute('aria-valuemin')).toBe('0')  // hi min = current lo (still 0)
    el.remove()
  })
})

// ── value model — clamp + snap (LLD-C1) ──────────────────────────────────────────────────────────

describe('UISliderMultiElement — value model (LLD-C1)', () => {
  it('valueLo round-trips: set and get', () => {
    const el = make()
    document.body.append(el)
    el.valueLo = 25
    expect(el.valueLo).toBe(25)
    el.remove()
  })

  it('valueHi round-trips: set and get', () => {
    const el = make()
    document.body.append(el)
    el.valueHi = 75
    expect(el.valueHi).toBe(75)
    el.remove()
  })

  it('valueLo reflects to/from the attribute (HTML attribute name is value-lo, kebab)', () => {
    const el = make()
    document.body.append(el)
    el.valueLo = 40
    expect(el.getAttribute('value-lo')).toBe('40')  // reflected to the kebab-case attribute
    el.setAttribute('value-lo', '60')               // attribute write round-trips back to the prop
    expect(el.valueLo).toBe(60)
    el.remove()
  })

  it('valueLo above max is clamped to max on connect', () => {
    const el = make()
    el.valueLo = 200 // above max=100
    document.body.append(el)
    expect(el.valueLo).toBe(100) // clamped to max
    el.remove()
  })

  it('valueHi below min is clamped to min on connect', () => {
    const el = make()
    el.valueHi = -10 // below min=0
    document.body.append(el)
    expect(el.valueHi).toBe(0) // clamped to min
    el.remove()
  })

  it('lo ≤ hi invariant: setting valueLo > valueHi clamps valueLo to valueHi', async () => {
    const el = make()
    el.valueLo = 0
    el.valueHi = 50
    document.body.append(el)
    el.valueLo = 80 // above hi=50
    await el.updateComplete
    expect(el.valueLo).toBe(50) // clamped to hi
    el.remove()
  })

  it('lo ≤ hi invariant: setting valueHi < valueLo clamps valueHi to valueLo', async () => {
    const el = make()
    el.valueLo = 40
    el.valueHi = 80
    document.body.append(el)
    el.valueHi = 20 // below lo=40
    await el.updateComplete
    expect(el.valueHi).toBe(40) // clamped to lo
    el.remove()
  })

  it('step snap: valueLo snaps to nearest step', () => {
    const el = make()
    el.step = 10
    el.valueLo = 73 // nearest step = 70
    document.body.append(el)
    expect(el.valueLo).toBe(70)
    el.remove()
  })

  it('step snap: valueHi snaps to nearest step', () => {
    const el = make()
    el.step = 10
    el.valueHi = 95 // max is always reachable exactly (End rule) but 95 doesn't divide; nearest step = 100
    document.body.append(el)
    expect(el.valueHi).toBe(100) // max exact via End rule
    el.remove()
  })

  it('step ≤ 0 → continuous: both values are clamped only', () => {
    const el = make()
    el.step = 0
    el.valueLo = 33.7
    el.valueHi = 66.3
    document.body.append(el)
    expect(el.valueLo).toBe(33.7)
    expect(el.valueHi).toBe(66.3)
    el.remove()
  })

  it('min > max → degenerate range: both values pinned to min', () => {
    const el = make()
    el.min = 80
    el.max = 20 // degenerate
    el.valueLo = 50
    el.valueHi = 60
    document.body.append(el)
    expect(el.valueLo).toBe(80) // pinned to min
    expect(el.valueHi).toBe(80) // pinned to min
    el.remove()
  })
})

// ── keyboard step (LLD-C3) ────────────────────────────────────────────────────────────────────────

describe('UISliderMultiElement — keyboard step (LLD-C3)', () => {
  it('ArrowRight on lo thumb increments lo by step', () => {
    const el = make()
    el.valueLo = 50
    el.step = 5
    document.body.append(el)
    dispatchKey(el.loThumb!, 'ArrowRight')
    expect(el.valueLo).toBe(55)
    el.remove()
  })

  it('ArrowLeft on lo thumb decrements lo by step', () => {
    const el = make()
    el.valueLo = 50
    el.step = 5
    document.body.append(el)
    dispatchKey(el.loThumb!, 'ArrowLeft')
    expect(el.valueLo).toBe(45)
    el.remove()
  })

  it('ArrowRight on hi thumb increments hi by step', () => {
    const el = make()
    el.valueHi = 60
    el.step = 5
    document.body.append(el)
    dispatchKey(el.hiThumb!, 'ArrowRight')
    expect(el.valueHi).toBe(65)
    el.remove()
  })

  it('ArrowLeft on hi thumb decrements hi by step', () => {
    const el = make()
    el.valueHi = 60
    el.step = 5
    document.body.append(el)
    dispatchKey(el.hiThumb!, 'ArrowLeft')
    expect(el.valueHi).toBe(55)
    el.remove()
  })

  it('PageUp on lo thumb increments by 10×step', () => {
    const el = make()
    el.valueLo = 20
    el.step = 2
    document.body.append(el)
    dispatchKey(el.loThumb!, 'PageUp')
    expect(el.valueLo).toBe(40) // 20 + 20
    el.remove()
  })

  it('PageDown on hi thumb decrements by 10×step', () => {
    const el = make()
    el.valueHi = 80
    el.step = 2
    document.body.append(el)
    dispatchKey(el.hiThumb!, 'PageDown')
    expect(el.valueHi).toBe(60) // 80 − 20
    el.remove()
  })

  it('Home on lo thumb → min', () => {
    const el = make()
    el.min = 10
    el.valueLo = 50
    document.body.append(el)
    dispatchKey(el.loThumb!, 'Home')
    expect(el.valueLo).toBe(10)
    el.remove()
  })

  it('End on hi thumb → max', () => {
    const el = make()
    el.max = 95
    el.step = 10
    el.valueHi = 50
    document.body.append(el)
    dispatchKey(el.hiThumb!, 'End')
    expect(el.valueHi).toBe(95) // max exactly — the End rule
    el.remove()
  })

  it('End on lo thumb → current hi (lo cannot exceed hi)', () => {
    const el = make()
    el.valueLo = 20
    el.valueHi = 60
    document.body.append(el)
    dispatchKey(el.loThumb!, 'End')
    expect(el.valueLo).toBe(60) // clamps at hi, not max (100)
    el.remove()
  })

  it('Home on hi thumb → current lo (hi cannot go below lo)', () => {
    const el = make()
    el.valueLo = 30
    el.valueHi = 80
    document.body.append(el)
    dispatchKey(el.hiThumb!, 'Home')
    expect(el.valueHi).toBe(30) // clamps at lo, not min (0)
    el.remove()
  })

  it('lo ≤ hi keyboard invariant: ArrowRight on lo at hi boundary clamps at hi', () => {
    const el = make()
    el.valueLo = 50
    el.valueHi = 50 // lo already at hi
    document.body.append(el)
    dispatchKey(el.loThumb!, 'ArrowRight')
    expect(el.valueLo).toBe(50) // clamped at hi — cannot cross
    el.remove()
  })

  it('lo ≤ hi keyboard invariant: ArrowLeft on hi at lo boundary clamps at lo', () => {
    const el = make()
    el.valueLo = 50
    el.valueHi = 50 // hi already at lo
    document.body.append(el)
    dispatchKey(el.hiThumb!, 'ArrowLeft')
    expect(el.valueHi).toBe(50) // clamped at lo — cannot cross
    el.remove()
  })

  it('keyboard emits input on step change (lo thumb)', () => {
    const el = make()
    el.valueLo = 40
    document.body.append(el)
    let count = 0
    el.addEventListener('input', () => { count++ })
    dispatchKey(el.loThumb!, 'ArrowRight')
    expect(count).toBe(1)
    el.remove()
  })

  it('keyboard emits no input when lo is already at hi and ArrowRight is pressed', () => {
    const el = make()
    el.valueLo = 50
    el.valueHi = 50
    document.body.append(el)
    let count = 0
    el.addEventListener('input', () => { count++ })
    dispatchKey(el.loThumb!, 'ArrowRight') // no-op at boundary
    expect(count).toBe(0)
    el.remove()
  })

  it('disabled host ignores keyboard on lo thumb', () => {
    const el = make()
    el.valueLo = 50
    el.disabled = true
    document.body.append(el)
    dispatchKey(el.loThumb!, 'ArrowRight')
    expect(el.valueLo).toBe(50) // unchanged
    el.remove()
  })

  it('disabled host ignores keyboard on hi thumb', () => {
    const el = make()
    el.valueHi = 50
    el.disabled = true
    document.body.append(el)
    dispatchKey(el.hiThumb!, 'ArrowLeft')
    expect(el.valueHi).toBe(50) // unchanged
    el.remove()
  })
})

// ── nearer-thumb selection ────────────────────────────────────────────────────────────────────────

describe('UISliderMultiElement — nearer-thumb selection', () => {
  it('pointerdown closer to lo thumb activates the lo binding (lo value updates)', () => {
    const el = make()
    el.valueLo = 0
    el.valueHi = 100
    document.body.append(el)

    const rail = el.railEl!
    // Stub setPointerCapture and getBoundingClientRect on the rail
    ;(rail as unknown as Record<string, unknown>)['setPointerCapture'] = (): void => {}
    Object.defineProperty(rail, 'getBoundingClientRect', {
      value: (): DOMRect => ({ left: 0, right: 100, width: 100, top: 0, bottom: 10, height: 10, x: 0, y: 0, toJSON: (): unknown => ({}) } as DOMRect),
      configurable: true,
    })

    // clientX=10: ratio=0.10; lo at 0% (distLo=0.10), hi at 100% (distHi=0.90) → lo is nearer
    const valueLoBefore = el.valueLo
    const valueHiBefore = el.valueHi
    rail.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, pointerId: 1, bubbles: true }))

    // Lo binding fires onValue(10) → valueLo = Math.min(10, 100) = 10
    expect(el.valueLo).toBe(10)
    expect(el.valueHi).toBe(valueHiBefore) // hi unchanged
    expect(el.valueLo).not.toBe(valueLoBefore)
    el.remove()
  })

  it('pointerdown closer to hi thumb activates the hi binding (hi value updates)', () => {
    const el = make()
    el.valueLo = 0
    el.valueHi = 100
    document.body.append(el)

    const rail = el.railEl!
    ;(rail as unknown as Record<string, unknown>)['setPointerCapture'] = (): void => {}
    Object.defineProperty(rail, 'getBoundingClientRect', {
      value: (): DOMRect => ({ left: 0, right: 100, width: 100, top: 0, bottom: 10, height: 10, x: 0, y: 0, toJSON: (): unknown => ({}) } as DOMRect),
      configurable: true,
    })

    // clientX=85: ratio=0.85; lo at 0% (distLo=0.85), hi at 100% (distHi=0.15) → hi is nearer
    const valueLoBeforeHi = el.valueLo
    rail.dispatchEvent(new PointerEvent('pointerdown', { clientX: 85, pointerId: 1, bubbles: true }))

    // Hi binding fires onValue(85) → valueHi = Math.max(85, 0) = 85
    expect(el.valueHi).toBe(85)
    expect(el.valueLo).toBe(valueLoBeforeHi) // lo unchanged
    el.remove()
  })

  it('equidistant: lo is preferred (lo ≤ hi thumbs can be separated by dragging lo)', () => {
    const el = make()
    el.valueLo = 50
    el.valueHi = 50  // both at 50 (same position)
    document.body.append(el)

    const rail = el.railEl!
    ;(rail as unknown as Record<string, unknown>)['setPointerCapture'] = (): void => {}
    Object.defineProperty(rail, 'getBoundingClientRect', {
      value: (): DOMRect => ({ left: 0, right: 100, width: 100, top: 0, bottom: 10, height: 10, x: 0, y: 0, toJSON: (): unknown => ({}) } as DOMRect),
      configurable: true,
    })

    // clientX=50: ratio=0.50; lo at 50% (distLo=0), hi at 50% (distHi=0) → equidistant → lo preferred
    rail.dispatchEvent(new PointerEvent('pointerdown', { clientX: 50, pointerId: 1, bubbles: true }))
    // Lo binding fires onValue(50) → valueLo = Math.min(50, 50) = 50 (unchanged)
    // Note: the value did not CHANGE here, but lo was SELECTED (not hi)
    // To verify lo was selected: press a lower value (25) and check lo moved, not hi
    Object.defineProperty(rail, 'getBoundingClientRect', {
      value: (): DOMRect => ({ left: 0, right: 100, width: 100, top: 0, bottom: 10, height: 10, x: 0, y: 0, toJSON: (): unknown => ({}) } as DOMRect),
      configurable: true,
    })
    rail.dispatchEvent(new PointerEvent('pointerdown', { clientX: 25, pointerId: 2, bubbles: true }))
    // At clientX=25: lo at 50% (distLo=0.25), hi at 50% (distHi=0.25) → equidistant → lo preferred
    // lo binding: onValue(25) → valueLo = Math.min(25, 50) = 25 ✓ (lo moved, hi stayed at 50)
    expect(el.valueLo).toBe(25)
    expect(el.valueHi).toBe(50)
    el.remove()
  })
})

// ── formValue() — the [lo, hi] pair ───────────────────────────────────────────────────────────────

describe('UISliderMultiElement — formValue() pair (LLD-C1)', () => {
  it('formValue returns FormData with two entries (lo, hi)', () => {
    const el = make()
    document.body.append(el)
    const fd = el.callFormValue()
    expect(fd).toBeInstanceOf(FormData)
    const entries = [...(fd as FormData).entries()]
    expect(entries).toHaveLength(2)
    expect(entries[0][1]).toBe('0')   // lo = 0 (default)
    expect(entries[1][1]).toBe('100') // hi = 100 (default)
    el.remove()
  })

  it('formValue reflects updated valueLo and valueHi', () => {
    const el = make()
    document.body.append(el)
    el.valueLo = 25
    el.valueHi = 75
    const fd = el.callFormValue()
    const entries = [...(fd as FormData).entries()]
    expect(entries[0][1]).toBe('25')
    expect(entries[1][1]).toBe('75')
    el.remove()
  })
})

// ── geometry seam — --value-pct-lo / --value-pct-hi ─────────────────────────────────────────────

describe('UISliderMultiElement — geometry seam (LLD-C5)', () => {
  it('--value-pct-lo is 0 at lo=0 (min), --value-pct-hi is 100 at hi=100 (max)', () => {
    const el = make()
    document.body.append(el)
    expect(el.style.getPropertyValue('--value-pct-lo')).toBe('0')
    expect(el.style.getPropertyValue('--value-pct-hi')).toBe('100')
    el.remove()
  })

  it('--value-pct-lo and --value-pct-hi update reactively', async () => {
    const el = make()
    document.body.append(el)
    el.valueLo = 25
    el.valueHi = 75
    await el.updateComplete
    expect(el.style.getPropertyValue('--value-pct-lo')).toBe('25')
    expect(el.style.getPropertyValue('--value-pct-hi')).toBe('75')
    el.remove()
  })
})

// ── disabled state ────────────────────────────────────────────────────────────────────────────────

describe('UISliderMultiElement — disabled state', () => {
  it('disabled reflects to [disabled] attribute', () => {
    const el = make()
    document.body.append(el)
    el.disabled = true
    expect(el.hasAttribute('disabled')).toBe(true)
    el.disabled = false
    expect(el.hasAttribute('disabled')).toBe(false)
    el.remove()
  })

  it('disabled removes both thumbs from the tab order', async () => {
    const el = make()
    document.body.append(el)
    expect(el.loThumb!.getAttribute('tabindex')).toBe('0')
    expect(el.hiThumb!.getAttribute('tabindex')).toBe('0')
    el.disabled = true
    await el.updateComplete
    expect(el.loThumb!.getAttribute('tabindex')).toBe('-1')
    expect(el.hiThumb!.getAttribute('tabindex')).toBe('-1')
    el.remove()
  })
})

// ── zero residue (connect / disconnect) — C10 ────────────────────────────────────────────────────

describe('UISliderMultiElement — zero residue (C10)', () => {
  it('signal zero-residue: loSig has 0 subscribers before connect, ≥1 after, 0 after disconnect, 1 after reconnect', () => {
    const el = make()

    // Before connect: no scope → no form effect → 0 subscribers on the probe signal.
    expect(inspect(el.loSig).subscribers).toBe(0)

    document.body.append(el)
    // After connect: scope-owned form effect reads formValue() → subscribes loSig.
    expect(inspect(el.loSig).subscribers).toBeGreaterThanOrEqual(1)

    el.remove()
    // After disconnect: scope.dispose() tears every effect → 0 subscribers (zero residue).
    expect(inspect(el.loSig).subscribers).toBe(0)

    document.body.append(el) // reconnect → connected() re-runs → fresh scope → re-subscribes once
    expect(inspect(el.loSig).subscribers).toBe(1) // exactly one, not stacked from the old scope
    el.remove()
  })

  it('disconnect removes keyboard listeners; reconnect re-arms exactly once (not stacked)', () => {
    const el = make()
    document.body.append(el)
    dispatchKey(el.loThumb!, 'ArrowRight')
    expect(el.valueLo).toBe(1) // listener live while connected (0 + 1 step)

    el.remove() // disconnect → AbortController aborts → listeners removed
    el.valueLo = 0 // reset
    dispatchKey(el.loThumb!, 'ArrowRight')
    expect(el.valueLo).toBe(0) // listeners gone — no change

    document.body.append(el) // reconnect → connected() re-runs → single fresh set of listeners
    dispatchKey(el.loThumb!, 'ArrowRight')
    expect(el.valueLo).toBe(1) // exactly one step — not two (no stacked listeners)
    el.remove()
  })

  it('valueDrag cleanup functions are set after connect and null after disconnect (idempotent release)', () => {
    const el = make()
    document.body.append(el)

    // After connect, cleanup functions are available
    expect(el.probeLoBinding).not.toBeNull()
    expect(el.probeHiBinding).not.toBeNull()

    // Store references before disconnect
    const loRelease = el.probeLoBinding!
    const hiRelease = el.probeHiBinding!

    el.remove() // disconnect → disconnected() calls both release functions + sets to null

    // After disconnect, the stored references are the released closures (idempotent double-call safe)
    expect(() => { loRelease(); loRelease() }).not.toThrow() // idempotent — sets released=true twice, no throw
    expect(() => { hiRelease(); hiRelease() }).not.toThrow()

    // The probe fields are null after disconnect
    expect(el.probeLoBinding).toBeNull()
    expect(el.probeHiBinding).toBeNull()

    // Reconnect re-arms with fresh cleanup functions
    document.body.append(el)
    expect(el.probeLoBinding).not.toBeNull()
    expect(el.probeHiBinding).not.toBeNull()
    el.remove()
  })

  it('ARIA effects re-run on reconnect with current values', async () => {
    const el = make()
    el.valueLo = 20
    el.valueHi = 80
    document.body.append(el)
    expect(el.loThumb!.getAttribute('aria-valuenow')).toBe('20')

    el.remove()
    document.body.append(el) // reconnect → effects reinstall + run synchronously
    expect(el.loThumb!.getAttribute('aria-valuenow')).toBe('20') // re-applied from live signal value
    el.remove()
  })
})

// ── descriptor trip-wire (contract↔props) ────────────────────────────────────────────────────────
//
// Two layers: (a) STRUCTURAL — validateComponentDescriptor reports ZERO failures.
//             (b) CONTRACT↔PROPS — compareDescriptorToProps finds ZERO drift with UISliderMultiElement.props.

const SM_DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/slider-multi`
const md = readFileSync(`${SM_DIR}/slider-multi.md`, 'utf8') as string
const { fence } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
// Attribute names in descriptor order — used as anti-vacuous anchor for the trip-wire.
// 'value' is present because sliderMultiProps spreads UIRangeElement.props (which carries the base's
// single-value seam); slider-multi never activates that seam (no super.connected()), but the prop exists
// in the static shape and the contract↔props bijection therefore requires a matching descriptor entry.
const ATTR_NAMES = ['min', 'max', 'step', 'value', 'size', 'name', 'disabled', 'required', 'valueLo', 'valueHi']

describe('slider-multi.md descriptor — structural validity (s10 part a)', () => {
  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-slider-multi, extends=UIRangeElement, tier=range, face.formAssociated=true', () => {
    expect(/^tag:\s*ui-slider-multi\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIRangeElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*range\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*true/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    // anti-vacuous: all 10 attribute names parse before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('slider-multi.md descriptor — contract↔props trip-wire (s10 part b)', () => {
  it('attributes[] is a faithful bijection with UISliderMultiElement.props (0 drift)', () => {
    // anti-vacuous: all 9 attribute names parse before the trip-wire is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UISliderMultiElement.props)).toEqual([])
  })

  it('a drifted reflect FAILS the trip-wire (negative control — biting NC)', () => {
    const flipReflect = parsed.attributes.map((a) =>
      a.name === 'valueLo' ? { ...a, reflect: false } : { ...a }
    )
    expect(compareDescriptorToProps(flipReflect, UISliderMultiElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.valueLo.reflect' }),
    )
  })

  it('a drifted default FAILS the trip-wire (negative control — biting NC)', () => {
    const flipDefault = parsed.attributes.map((a) =>
      a.name === 'valueHi' ? { ...a, default: '50' } : { ...a }
    )
    expect(compareDescriptorToProps(flipDefault, UISliderMultiElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.valueHi.default' }),
    )
  })

  it('a removed attribute FAILS the trip-wire (DRIFT_MISSING — bijection guard)', () => {
    const dropValueLo = parsed.attributes.filter((a) => a.name !== 'valueLo')
    expect(compareDescriptorToProps(dropValueLo, UISliderMultiElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.valueLo' }),
    )
  })

  it('an added attribute FAILS the trip-wire (DRIFT_EXTRA — bijection guard)', () => {
    const addBogus = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UISliderMultiElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
