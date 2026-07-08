import { describe, it, expect } from 'vitest'
import { UISliderElement } from './slider.ts'
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

// S1 jsdom probes — ui-slider (decomp S1 · ADR-0042 · ADR-0041 · range-element.lld.md).
//
// jsdom reality (verified at base, range-element.test.ts): ElementInternals form-association surface
// (setFormValue/setValidity) is ABSENT in jsdom; CustomStateSet is absent. The base tests cover the
// full RNG-C1..C5 contract; this suite verifies the LEAF contract — the slider-specific wiring:
// tabbable + valueDrag (LLD-C4), the descriptor trip-wire, and C10 zero-residue (inspect() proof +
// valueDrag pointer-listeners released + release() idempotent).

// ── jsdom stub — form-association surface absent in jsdom ───────────────────────────────────────────

function stubFormAssoc(internals: ElementInternals): void {
  const i = internals as unknown as Record<string, unknown>
  if (typeof i['setFormValue'] !== 'function') {
    i['setFormValue'] = (): void => {}
    i['setValidity'] = (): void => {}
  }
}

// ── probe subclass — exposes the protected seams needed by the C10 and trip-wire probes ───────────

class ProbeSlider extends UISliderElement {
  /** Inspectable probe signal; co-subscribed to the connection-scope form effect via formValue().
   *  When the scope disposes on disconnect, the form effect loses all subscribers → this signal
   *  drops to 0 subscribers (the C10 zero-residue proof via inspect()). */
  readonly valueSig = signal(0)

  protected override formValue(): FormValue {
    void this.valueSig.value // subscribe valueSig via the scope-owned form effect
    return super.formValue()
  }

  /** Re-expose the protected internals so probes can read ariaValueNow/Min/Max/role/states. */
  get probeInternals(): ElementInternals {
    return this.internals
  }

  /** Re-expose the protected _releaseDrag so the C10 test can call it for idempotency. */
  get releaseDragProbe(): (() => void) {
    return this._releaseDrag
  }
}
if (!customElements.get('ui-slider-probe')) customElements.define('ui-slider-probe', ProbeSlider)

function make(): ProbeSlider {
  const el = new ProbeSlider()
  stubFormAssoc(el.probeInternals) // stub BEFORE connect — form effects run synchronously on connect
  return el
}

/** Stub setPointerCapture + getBoundingClientRect on the slider for JSDOM pointer-event tests.
 *  JSDOM does not implement pointer capture; this prevents throws when valueDrag calls it.
 *  The rect has left=0, width=200 so clientX=N maps to ratio N/200. */
function stubPointer(el: ProbeSlider): void {
  const RECT = { left: 0, right: 200, width: 200, top: 0, bottom: 20, height: 20, x: 0, y: 0, toJSON: (): Record<string, unknown> => ({}) } as DOMRect
  el.getBoundingClientRect = (): DOMRect => RECT
  el.setPointerCapture = (_id: number): void => {}
  el.releasePointerCapture = (_id: number): void => {}
}

const ptr = (type: string, x: number, id = 1): PointerEvent =>
  new PointerEvent(type, { clientX: x, pointerId: id, bubbles: true, cancelable: true })

// ── upgrade + typed prop surface ──────────────────────────────────────────────────────────────────

describe('UISliderElement — upgrade + typed props', () => {
  it('upgrades to the class; props default to value=0 min=0 max=100 step=1 size=md disabled=false', () => {
    const el = document.createElement('ui-slider') as UISliderElement
    expect(el).toBeInstanceOf(UISliderElement)
    expect(el.value).toBe(0)
    expect(el.min).toBe(0)
    expect(el.max).toBe(100)
    expect(el.step).toBe(1)
    expect(el.size).toBe('md')
    expect(el.disabled).toBe(false)
    expect(el.required).toBe(false)
  })

  it('self-defines as ui-slider, guarded against double-define', () => {
    expect(customElements.get('ui-slider')).toBe(UISliderElement)
    expect(() => {
      if (!customElements.get('ui-slider')) customElements.define('ui-slider', UISliderElement)
    }).not.toThrow()
  })

  it('size is a literal union — compile-time narrowing (negative control — the biting @ts-expect-error)', () => {
    const fn = (): void => {
      const el = new UISliderElement()
      el.size = 'sm'
      el.size = 'md'
      el.size = 'lg'
      // @ts-expect-error — 'xl' is not a valid size member
      el.size = 'xl'
      // @ts-expect-error — a bare string is wider than the literal union
      el.size = 'x' as string
    }
    expect(typeof fn).toBe('function') // never invoked; the type errors above are the assertion
  })

  it('role is declared on the class (confirmatory; base applies internals.role)', () => {
    expect(UISliderElement.role).toBe('slider')
  })
})

// ── ARIA role (LLD-C2) ────────────────────────────────────────────────────────────────────────────

describe('UISliderElement — ARIA role (LLD-C2)', () => {
  it('internals.role is "slider"; no host role/aria-* attribute (FACE — ARIA via internals only)', () => {
    const el = make()
    document.body.append(el)
    expect(el.probeInternals.role).toBe('slider')
    expect(el.getAttribute('role')).toBeNull()
    for (const attr of Array.from(el.attributes)) expect(attr.name.startsWith('aria-')).toBe(false)
    el.remove()
  })

  it('ariaValueNow/Min/Max reflect value/min/max on connect', () => {
    const el = make()
    el.min = 10
    el.max = 90
    el.value = 50
    document.body.append(el)
    expect(el.probeInternals.ariaValueNow).toBe('50')
    expect(el.probeInternals.ariaValueMin).toBe('10')
    expect(el.probeInternals.ariaValueMax).toBe('90')
    el.remove()
  })
})

// ── value clamp + snap (LLD-C1, inherited from base — verified at leaf level) ───────────────────────

describe('UISliderElement — value clamp + snap (LLD-C1)', () => {
  it('value above max is clamped to max on connect', () => {
    const el = make()
    el.value = 150
    document.body.append(el)
    expect(el.value).toBe(100)
    el.remove()
  })

  it('value below min is clamped to min', () => {
    const el = make()
    el.value = -5
    document.body.append(el)
    expect(el.value).toBe(0)
    el.remove()
  })

  it('value snaps to nearest step', () => {
    const el = make()
    el.step = 10
    el.value = 73 // nearest step = 70
    document.body.append(el)
    expect(el.value).toBe(70)
    el.remove()
  })

  it('End key sets value to max exactly (ADR-0041 cl.3 — max always reachable)', () => {
    const el = make()
    el.min = 0
    el.max = 95
    el.step = 10
    el.value = 0
    document.body.append(el)
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }))
    expect(el.value).toBe(95)
    el.remove()
  })
})

// ── keyboard step (LLD-C3, inherited from base — verified at leaf level) ─────────────────────────

describe('UISliderElement — keyboard step (LLD-C3)', () => {
  const key = (el: Element, k: string): void => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
  }

  it('ArrowRight increments by step', () => {
    const el = make()
    el.value = 50
    el.step = 5
    document.body.append(el)
    key(el, 'ArrowRight')
    expect(el.value).toBe(55)
    el.remove()
  })

  it('ArrowLeft decrements by step', () => {
    const el = make()
    el.value = 50
    el.step = 5
    document.body.append(el)
    key(el, 'ArrowLeft')
    expect(el.value).toBe(45)
    el.remove()
  })

  it('PageUp increments by largeStep (10×step)', () => {
    const el = make()
    el.value = 20
    el.step = 2
    document.body.append(el)
    key(el, 'PageUp')
    expect(el.value).toBe(40)
    el.remove()
  })

  it('Home sets value to min', () => {
    const el = make()
    el.min = 10
    el.max = 90
    el.value = 55
    document.body.append(el)
    key(el, 'Home')
    expect(el.value).toBe(10)
    el.remove()
  })

  it('keyboard emits input on each step', () => {
    const el = make()
    el.value = 50
    document.body.append(el)
    let inputCount = 0
    el.addEventListener('input', () => { inputCount++ })
    key(el, 'ArrowRight')
    expect(inputCount).toBe(1)
    el.remove()
  })

  it('disabled host ignores keyboard input', () => {
    const el = make()
    el.value = 50
    el.disabled = true
    document.body.append(el)
    key(el, 'ArrowRight')
    expect(el.value).toBe(50) // unchanged
    el.remove()
  })
})

// ── tabbable (keyboard focusability) ─────────────────────────────────────────────────────────────

describe('UISliderElement — tabbable trait', () => {
  it('tabindex=0 on connect (focusable by default)', () => {
    const el = make()
    document.body.append(el)
    expect(el.getAttribute('tabindex')).toBe('0')
    el.remove()
  })

  it('disabled removes the host from the tab order (async — tabbable effect is reactive)', async () => {
    const el = make()
    document.body.append(el)
    expect(el.getAttribute('tabindex')).toBe('0')
    el.disabled = true
    await el.updateComplete
    expect(el.hasAttribute('tabindex')).toBe(false)
    el.remove()
  })
})

// ── valueDrag wiring (LLD-C4) — pointer drag moves the value ─────────────────────────────────────

describe('UISliderElement — valueDrag wiring (LLD-C4)', () => {
  it('pointerdown at 0% → value = min (0); move to 50% → value = 50', () => {
    const el = make()
    el.min = 0
    el.max = 100
    el.step = 0 // continuous
    document.body.append(el)
    stubPointer(el)

    el.dispatchEvent(ptr('pointerdown', 0)) // clientX=0, ratio=0/200=0 → value=0
    expect(el.value).toBe(0)

    el.dispatchEvent(ptr('pointermove', 100)) // clientX=100, ratio=100/200=0.5 → value=50
    expect(el.value).toBe(50)

    el.dispatchEvent(ptr('pointerup', 100))
    el.remove()
  })

  it('pointerdown snaps value to step', () => {
    const el = make()
    el.min = 0
    el.max = 100
    el.step = 10
    document.body.append(el)
    stubPointer(el) // rect: left=0, width=200

    // clientX=73: ratio=73/200=0.365, raw=36.5 → Math.round(3.65)*10=40
    el.dispatchEvent(ptr('pointerdown', 73))
    expect(el.value).toBe(40)

    el.dispatchEvent(ptr('pointerup', 73))
    el.remove()
  })

  it('drag emits input on value change', () => {
    const el = make()
    el.step = 0 // continuous
    document.body.append(el)
    stubPointer(el)

    let inputCount = 0
    el.addEventListener('input', () => { inputCount++ })

    el.dispatchEvent(ptr('pointerdown', 0))   // value=0 (no change from default — no input)
    el.dispatchEvent(ptr('pointermove', 100)) // value=50 → input
    expect(inputCount).toBe(1)

    el.dispatchEvent(ptr('pointerup', 100))
    el.remove()
  })

  it('after disconnect, pointerdown does NOT change value (listeners released)', () => {
    const el = make()
    el.step = 0
    document.body.append(el)
    stubPointer(el)

    el.remove() // disconnect → connection AbortSignal aborts → host.listen listener removed

    const before = el.value
    el.dispatchEvent(ptr('pointerdown', 100)) // listener is gone — no-op
    expect(el.value).toBe(before)
  })
})

// ── size prop ─────────────────────────────────────────────────────────────────────────────────────

describe('UISliderElement — size prop', () => {
  it('size reflects JS-set value to the attribute (the CSS [size] hook)', () => {
    const el = make()
    document.body.append(el)
    el.size = 'sm'
    expect(el.getAttribute('size')).toBe('sm')
    el.size = 'lg'
    expect(el.getAttribute('size')).toBe('lg')
    el.size = 'md'
    expect(el.getAttribute('size')).toBe('md')
    el.remove()
  })
})

// ── C10 zero-residue (inspect + pointer listeners released + release() idempotent) ────────────────

describe('UISliderElement — C10 zero-residue (inspect)', () => {
  it('slider-c10-inspect: value probe signal has 0 subscribers before connect, ≥1 after, 0 after disconnect, 1 after reconnect', () => {
    const el = make()

    // Before connect: no scope → no form effect → 0 subscribers on the probe signal.
    expect(inspect(el.valueSig).subscribers).toBe(0)

    document.body.append(el)
    // After connect: scope-owned form effect reads formValue() → subscribes valueSig.
    expect(inspect(el.valueSig).subscribers).toBeGreaterThanOrEqual(1)

    el.remove()
    // After disconnect: scope.dispose() tears every effect → 0 subscribers (zero residue).
    expect(inspect(el.valueSig).subscribers).toBe(0)

    document.body.append(el) // reconnect → connected() re-runs → fresh scope → re-subscribes once
    expect(inspect(el.valueSig).subscribers).toBe(1) // exactly one, not stacked from the old scope
    el.remove()
  })

  it('slider-c10-release: _releaseDrag() is idempotent (calling it twice does not throw)', () => {
    const el = make()
    document.body.append(el)

    const release = el.releaseDragProbe
    expect(() => {
      release()  // first call: sets released=true inside valueDrag
      release()  // second call: released already true — no throw (idempotent)
    }).not.toThrow()

    el.remove()
  })

  it('slider-c10-stacking: reconnect wires exactly one set of listeners (not stacked)', () => {
    const el = make()
    el.step = 0
    document.body.append(el)
    stubPointer(el)

    // While connected: drag changes value
    el.dispatchEvent(ptr('pointerdown', 100)) // ratio=0.5 → value=50
    expect(el.value).toBe(50)
    el.value = 0 // reset

    el.remove()
    document.body.append(el) // reconnect — stubPointer must be re-applied (connected() re-runs)
    stubPointer(el)

    // ONE drag should produce ONE value update, not doubled (no stacked listeners)
    let inputCount = 0
    el.addEventListener('input', () => { inputCount++ })
    el.dispatchEvent(ptr('pointerdown', 100)) // ratio=0.5 → value=50; exactly 1 input
    expect(el.value).toBe(50)
    // input count: the initial pointerdown triggers onValue(50); if stacked, onValue would fire twice
    // and the value might stay 50 (Object.is blocks second write) but onValue would call twice —
    // however, since Object.is catches duplicates, we verify the value changed to exactly 50 exactly once.
    expect(inputCount).toBe(1)

    el.remove()
  })
})

// ── descriptor trip-wire (contract↔props) ────────────────────────────────────────────────────────
//
// Two layers: (a) STRUCTURAL — validateComponentDescriptor reports ZERO failures.
//             (b) CONTRACT↔PROPS — compareDescriptorToProps finds ZERO drift with UISliderElement.props.

const SLIDER_DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/slider`
const md = readFileSync(`${SLIDER_DIR}/slider.md`, 'utf8') as string
const { fence } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
// Attribute names in the order declared in slider.md frontmatter (anti-vacuous anchor).
const ATTR_NAMES = ['value', 'min', 'max', 'step', 'size', 'name', 'disabled', 'required']

describe('slider.md descriptor — structural validity (s10 part a)', () => {
  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-slider, extends=UIRangeElement, tier=indicator, face.formAssociated=true', () => {
    expect(/^tag:\s*ui-slider\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIRangeElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*indicator\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*true/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    // anti-vacuous: all 8 attribute names parse before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('slider.md descriptor — contract↔props trip-wire (s10 part b)', () => {
  it('attributes[] is a faithful bijection with UISliderElement.props (0 drift)', () => {
    // anti-vacuous: all 8 attribute names parse before the trip-wire is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UISliderElement.props)).toEqual([])
  })

  it('a drifted reflect FAILS the trip-wire (negative control — BITING NC)', () => {
    // Flip reflect=false on 'min' → descriptor disagrees with live prop (reflect=true)
    const flipReflect = parsed.attributes.map((a) => (a.name === 'min' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UISliderElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.min.reflect' }),
    )
  })

  it('a drifted default FAILS the trip-wire (negative control — BITING NC)', () => {
    // Change max default to '0' → descriptor disagrees with live prop default='100'
    const flipDefault = parsed.attributes.map((a) => (a.name === 'max' ? { ...a, default: '0' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UISliderElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.max.default' }),
    )
  })

  it('a removed attribute FAILS the trip-wire (negative control — bijection from live)', () => {
    // Drop 'step' from descriptor → live prop 'step' has no descriptor row → DRIFT_MISSING
    const dropStep = parsed.attributes.filter((a) => a.name !== 'step')
    expect(compareDescriptorToProps(dropStep, UISliderElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.step' }),
    )
  })

  it('an added attribute FAILS the trip-wire (negative control — bijection from descriptor)', () => {
    // Add a 'bogus' attribute with no live prop → DRIFT_EXTRA
    const addBogus = [
      ...parsed.attributes,
      { name: 'bogus', type: 'string' as const, default: '', reflect: false },
    ]
    expect(compareDescriptorToProps(addBogus, UISliderElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
