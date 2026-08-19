import { describe, it, expect } from 'vitest'
import { UIRatingElement } from './rating.ts'
import type { FormValue } from '../../dom/index.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// rating.test.ts — ui-rating jsdom probes (ADR-0216; GH #1395; range-element.lld.md).
//
// jsdom reality (verified at base, range-element.test.ts): ElementInternals form-association surface
// (setFormValue/setValidity) is ABSENT in jsdom; CustomStateSet is absent. `ownsValueModel()` is
// overridden to `false` on UIRatingElement (readonly needs a write-path gate the base has no hook for),
// so this suite verifies the LEAF's own re-implementation of the normaliser/ARIA-value/geometry/keyboard/
// focus-blur wiring — not the base's copy (which never runs for this control).

// ── jsdom stub — form-association surface absent in jsdom ───────────────────────────────────────────

function stubFormAssoc(internals: ElementInternals): void {
  const i = internals as unknown as Record<string, unknown>
  if (typeof i['setFormValue'] !== 'function') {
    i['setFormValue'] = (): void => {}
    i['setValidity'] = (): void => {}
  }
}

// ── probe subclass — exposes the protected seams needed by the trip-wire + drag probes ─────────────

class ProbeRating extends UIRatingElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
  get releaseDragProbe(): () => void {
    return this._releaseDrag
  }
}
if (!customElements.get('ui-rating-probe')) customElements.define('ui-rating-probe', ProbeRating)

function make(): ProbeRating {
  const el = new ProbeRating()
  stubFormAssoc(el.probeInternals) // stub BEFORE connect — form effects run synchronously on connect
  return el
}

/** The interactive track is `[data-part='stars']` (`.stars`) — valueDrag's `track()` target. */
function stars(el: Element): HTMLElement {
  return el.querySelector('.stars') as HTMLElement
}

/** Stub setPointerCapture + getBoundingClientRect on `.stars` for JSDOM pointer-event tests. The rect
 *  has left=0, width=200 so clientX=N maps to ratio N/200 (the slider.test.ts stubPointer precedent). */
function stubPointer(el: ProbeRating): void {
  const RECT = { left: 0, right: 200, width: 200, top: 0, bottom: 20, height: 20, x: 0, y: 0, toJSON: (): Record<string, unknown> => ({}) } as DOMRect
  const s = stars(el)
  s.getBoundingClientRect = (): DOMRect => RECT
  s.setPointerCapture = (_id: number): void => {}
  s.releasePointerCapture = (_id: number): void => {}
}

/** Dispatch a pointer event ON `.stars` (bubbles to the host, where valueDrag's listener lives). */
const ptr = (el: ProbeRating, type: string, x: number, id = 1): PointerEvent => {
  const event = new PointerEvent(type, { clientX: x, pointerId: id, bubbles: true, cancelable: true })
  stars(el).dispatchEvent(event)
  return event
}

const key = (el: Element, k: string): void => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
}

// ── upgrade + typed prop surface ──────────────────────────────────────────────────────────────────

describe('UIRatingElement — upgrade + typed props', () => {
  it('upgrades to the class; props default to value=0 min=0 max=5 step=1 size=md disabled=false readonly=false', () => {
    const el = document.createElement('ui-rating') as UIRatingElement
    expect(el).toBeInstanceOf(UIRatingElement)
    expect(el.value).toBe(0)
    expect(el.min).toBe(0)
    expect(el.max).toBe(5) // ADR-0216 cl.2 — re-defaults the base's 100
    expect(el.step).toBe(1)
    expect(el.size).toBe('md')
    expect(el.disabled).toBe(false)
    expect(el.required).toBe(false)
    expect(el.readonly).toBe(false) // ADR-0216 cl.5 — input-parity default
  })

  it('self-defines as ui-rating, guarded against double-define', () => {
    expect(customElements.get('ui-rating')).toBe(UIRatingElement)
    expect(() => {
      if (!customElements.get('ui-rating')) customElements.define('ui-rating', UIRatingElement)
    }).not.toThrow()
  })

  it('size is a literal union — compile-time narrowing (negative control — the biting @ts-expect-error)', () => {
    const fn = (): void => {
      const el = new UIRatingElement()
      el.size = 'sm'
      el.size = 'md'
      el.size = 'lg'
      // @ts-expect-error — 'xl' is not a valid size member
      el.size = 'xl'
    }
    expect(typeof fn).toBe('function') // never invoked; the type errors above are the assertion
  })

  it('role is declared on the class (confirmatory; base applies internals.role)', () => {
    expect(UIRatingElement.role).toBe('slider')
  })
})

// ── ARIA role + value* (own re-implementation — ownsValueModel()=false) ─────────────────────────────

describe('UIRatingElement — ARIA role + value*', () => {
  it('internals.role is "slider"; no host role/aria-* attribute (FACE — ARIA via internals only)', () => {
    const el = make()
    document.body.append(el)
    expect(el.probeInternals.role).toBe('slider')
    expect(el.getAttribute('role')).toBeNull()
    for (const attr of Array.from(el.attributes)) expect(attr.name.startsWith('aria-')).toBe(false)
    el.remove()
  })

  it('ariaValueNow/Min/Max/Text reflect value/min/max on connect ("N out of max")', () => {
    const el = make()
    el.max = 5
    el.value = 4.3
    document.body.append(el)
    expect(el.probeInternals.ariaValueNow).toBe('4.3')
    expect(el.probeInternals.ariaValueMin).toBe('0')
    expect(el.probeInternals.ariaValueMax).toBe('5')
    expect(el.probeInternals.ariaValueText).toBe('4.3 out of 5')
    el.remove()
  })

  it('ariaReadOnly is null by default, "true" while readonly (ADR-0216 cl.4)', async () => {
    const el = make()
    document.body.append(el)
    expect(el.probeInternals.ariaReadOnly).toBeNull()
    el.readonly = true
    await el.updateComplete
    expect(el.probeInternals.ariaReadOnly).toBe('true')
    el.remove()
  })
})

// ── value clamp + snap (own re-implementation) ───────────────────────────────────────────────────

describe('UIRatingElement — value clamp + snap', () => {
  it('value above max is clamped to max on connect', () => {
    const el = make()
    el.value = 50
    document.body.append(el)
    expect(el.value).toBe(5)
    el.remove()
  })

  it('value below min is clamped to min', () => {
    const el = make()
    el.value = -5
    document.body.append(el)
    expect(el.value).toBe(0)
    el.remove()
  })

  it('a keyboard WRITE snaps the next value to step (ADR-0216 cl.2 — the write path quantizes)', () => {
    const el = make()
    el.step = 0.5
    el.value = 3.3 // an assigned display value — untouched by the bounds-only effect (see test below)
    document.body.append(el)
    key(el, 'ArrowRight') // 3.3 + 0.5 = 3.8 → snap to nearest 0.5-multiple = 4
    expect(el.value).toBe(4)
    el.remove()
  })

  it('display value is NOT rounded to step — a bound fraction (4.3) paints as-is (ADR-0216 cl.2)', () => {
    const el = make()
    el.step = 1
    el.value = 4.3
    document.body.append(el)
    expect(el.value).toBe(4.3) // step governs the WRITE path only, never a bound display value
    el.remove()
  })

  it('End key sets value to max exactly', () => {
    const el = make()
    el.max = 5
    el.step = 2
    el.value = 0
    document.body.append(el)
    key(el, 'End')
    expect(el.value).toBe(5)
    el.remove()
  })
})

// ── keyboard step (own re-implementation, gated by readonly too) ────────────────────────────────

describe('UIRatingElement — keyboard step', () => {
  it('ArrowRight increments by step', () => {
    const el = make()
    el.value = 2
    el.step = 1
    document.body.append(el)
    key(el, 'ArrowRight')
    expect(el.value).toBe(3)
    el.remove()
  })

  it('ArrowLeft decrements by step', () => {
    const el = make()
    el.value = 2
    el.step = 1
    document.body.append(el)
    key(el, 'ArrowLeft')
    expect(el.value).toBe(1)
    el.remove()
  })

  it('PageUp increments by largeStep (10×step)', () => {
    const el = make()
    el.max = 100
    el.value = 20
    el.step = 2
    document.body.append(el)
    key(el, 'PageUp')
    expect(el.value).toBe(40)
    el.remove()
  })

  it('Home sets value to min', () => {
    const el = make()
    el.value = 3
    document.body.append(el)
    key(el, 'Home')
    expect(el.value).toBe(0)
    el.remove()
  })

  it('keyboard emits input on each step', () => {
    const el = make()
    el.value = 2
    document.body.append(el)
    let inputCount = 0
    el.addEventListener('input', () => { inputCount++ })
    key(el, 'ArrowRight')
    expect(inputCount).toBe(1)
    el.remove()
  })

  it('disabled host ignores keyboard input', () => {
    const el = make()
    el.value = 2
    el.disabled = true
    document.body.append(el)
    key(el, 'ArrowRight')
    expect(el.value).toBe(2) // unchanged
    el.remove()
  })

  it('ADR-0216 cl.4 — readonly host ignores keyboard input (the write path, not just an announcement)', () => {
    const el = make()
    el.value = 2
    el.readonly = true
    document.body.append(el)
    let inputCount = 0
    el.addEventListener('input', () => { inputCount++ })
    key(el, 'ArrowRight')
    expect(el.value).toBe(2) // unchanged
    expect(inputCount).toBe(0)
    el.remove()
  })
})

// ── tabbable — readonly must NOT remove focusability (unlike disabled) ──────────────────────────

describe('UIRatingElement — tabbable trait', () => {
  it('tabindex=0 on connect (focusable by default)', () => {
    const el = make()
    document.body.append(el)
    expect(el.getAttribute('tabindex')).toBe('0')
    el.remove()
  })

  it('disabled removes the host from the tab order (async — tabbable effect is reactive)', async () => {
    const el = make()
    document.body.append(el)
    el.disabled = true
    await el.updateComplete
    expect(el.hasAttribute('tabindex')).toBe(false)
    el.remove()
  })

  it('ADR-0216 — readonly does NOT remove the host from the tab order (the text-field/textarea precedent)', async () => {
    const el = make()
    document.body.append(el)
    el.readonly = true
    await el.updateComplete
    expect(el.getAttribute('tabindex')).toBe('0')
    el.remove()
  })
})

// ── pointer pick (valueDrag wiring, own onValue gate) ────────────────────────────────────────────

describe('UIRatingElement — pointer pick (valueDrag wiring)', () => {
  it('pointerdown at 0% → value = min (0); move to 50% → value snaps toward mid-scale', () => {
    const el = make()
    el.max = 5
    el.step = 0 // continuous for this probe
    document.body.append(el)
    stubPointer(el)

    ptr(el, 'pointerdown', 0) // ratio=0 → value=0
    expect(el.value).toBe(0)

    ptr(el, 'pointermove', 100) // ratio=100/200=0.5 → value=2.5
    expect(el.value).toBe(2.5)

    ptr(el, 'pointerup', 100)
    el.remove()
  })

  it('pointerdown snaps value to step', () => {
    const el = make()
    el.max = 5
    el.step = 1
    document.body.append(el)
    stubPointer(el) // rect: left=0, width=200

    // clientX=140: ratio=0.7, raw=3.5 → nearest whole step = 4 (Math.round(3.5)=4)
    ptr(el, 'pointerdown', 140)
    expect(el.value).toBe(4)

    ptr(el, 'pointerup', 140)
    el.remove()
  })

  it('drag emits input on value change', () => {
    const el = make()
    el.step = 0
    document.body.append(el)
    stubPointer(el)

    let inputCount = 0
    el.addEventListener('input', () => { inputCount++ })

    ptr(el, 'pointerdown', 0)   // value=0 — no change from default, no input
    ptr(el, 'pointermove', 100) // value=2.5 → input
    expect(inputCount).toBe(1)

    ptr(el, 'pointerup', 100)
    el.remove()
  })

  it('ADR-0216 cl.4 — readonly host ignores pointer pick (onValue no-ops)', () => {
    const el = make()
    el.value = 1
    el.readonly = true
    el.step = 0
    document.body.append(el)
    stubPointer(el)

    ptr(el, 'pointerdown', 100) // would be 2.5 if writable
    expect(el.value).toBe(1) // unchanged
    ptr(el, 'pointerup', 100)
    el.remove()
  })

  it('disabled host ignores pointer pick (onValue no-ops)', () => {
    const el = make()
    el.value = 1
    el.disabled = true
    el.step = 0
    document.body.append(el)
    stubPointer(el)

    ptr(el, 'pointerdown', 100)
    expect(el.value).toBe(1) // unchanged
    ptr(el, 'pointerup', 100)
    el.remove()
  })

  it('after disconnect, pointerdown does NOT change value (listeners released)', () => {
    const el = make()
    el.step = 0
    document.body.append(el)
    stubPointer(el)

    el.remove() // disconnect → connection AbortSignal aborts → host.listen listener removed

    const before = el.value
    ptr(el, 'pointerdown', 100) // listener is gone — no-op
    expect(el.value).toBe(before)
  })
})

// ── Fork-T1/D1 probe (ADR-0216 cl.6, PR #1363's discipline) — `change` fires AFTER `value` commits ──

describe('UIRatingElement — change-after-value-commit probe (Fork-T1/D1, ADR-0216 cl.6)', () => {
  it('a listener reading `el.value` inside "change" observes the ALREADY-MOVED value, not a stale one', () => {
    const el = make()
    el.value = 2
    document.body.append(el)

    el.dispatchEvent(new FocusEvent('focus'))
    key(el, 'ArrowRight') // value: 2 → 3 (input fires here, synchronously ahead of change)

    let sawDuringChange: number | null | undefined
    el.addEventListener('change', () => {
      sawDuringChange = el.value // must already read 3 — the commit has already happened
    })
    el.dispatchEvent(new FocusEvent('blur'))

    expect(sawDuringChange).toBe(3) // NOT the stale pre-move value (2) — proves value-before-change ordering
    expect(el.value).toBe(3)
    el.remove()
  })

  it('no net movement between focus and blur emits no change', () => {
    const el = make()
    el.value = 2
    document.body.append(el)
    let changeCount = 0
    el.addEventListener('change', () => { changeCount++ })
    el.dispatchEvent(new FocusEvent('focus'))
    el.dispatchEvent(new FocusEvent('blur'))
    expect(changeCount).toBe(0)
    el.remove()
  })
})

// ── label prop ────────────────────────────────────────────────────────────────────────────────────

describe('UIRatingElement — label prop', () => {
  it('default empty — no visible label part, no internals.ariaLabel', () => {
    const el = make()
    document.body.append(el)
    const label = el.querySelector('[data-part="label"]') as HTMLElement
    expect(label.hidden).toBe(true)
    expect(el.probeInternals.ariaLabel).toBeNull()
    el.remove()
  })

  it('non-empty label — visible, aria-hidden part + internals.ariaLabel set', () => {
    const el = make()
    el.label = 'Rate this'
    document.body.append(el)
    const label = el.querySelector('[data-part="label"]') as HTMLElement
    expect(label.hidden).toBe(false)
    expect(label.getAttribute('aria-hidden')).toBe('true')
    expect(label.textContent).toBe('Rate this')
    expect(el.probeInternals.ariaLabel).toBe('Rate this')
    el.remove()
  })

  it('reflects to the label attribute', () => {
    const el = make()
    document.body.append(el)
    el.label = 'Quality'
    expect(el.getAttribute('label')).toBe('Quality')
    el.remove()
  })
})

// ── layout prop ───────────────────────────────────────────────────────────────────────────────────

describe('UIRatingElement — layout prop', () => {
  it('defaults to standard', () => {
    const el = make()
    expect(el.layout).toBe('standard')
  })

  it('reflects JS-set value to the [layout] attribute (the CSS grid-template hook)', () => {
    const el = make()
    document.body.append(el)
    el.layout = 'inline'
    expect(el.getAttribute('layout')).toBe('inline')
    el.remove()
  })
})

// ── star mark structure (ADR-0216 cl.3) ─────────────────────────────────────────────────────────

describe('UIRatingElement — owned star mark (ADR-0216 cl.3)', () => {
  it('renders max stars in both the base and fill rows, no icons-pack element', () => {
    const el = make()
    el.max = 5
    document.body.append(el)
    const base = el.querySelector('.stars-base') as HTMLElement
    const fill = el.querySelector('.stars-fill') as HTMLElement
    expect(base.querySelectorAll('svg').length).toBe(5)
    expect(fill.querySelectorAll('svg').length).toBe(5)
    // every star is an owned inline <svg>, not a <ui-icon> (ADR-0216 cl.3 — no icons-pack dependency)
    expect(el.querySelectorAll('ui-icon').length).toBe(0)
    el.remove()
  })

  it('changing max rebuilds the star rows to the new count', async () => {
    const el = make()
    el.max = 5
    document.body.append(el)
    el.max = 10
    await el.updateComplete
    const base = el.querySelector('.stars-base') as HTMLElement
    expect(base.querySelectorAll('svg').length).toBe(10)
    el.remove()
  })

  it('the fill row is clipped by --value-pct (the geometry seam), never the base row', () => {
    const el = make()
    el.max = 5
    el.value = 2.5
    document.body.append(el)
    expect(el.style.getPropertyValue('--value-pct')).toBe('50')
    el.remove()
  })
})

// ── form participation ────────────────────────────────────────────────────────────────────────────

describe('UIRatingElement — form participation', () => {
  it('formValue serialises the normalised value as a string', () => {
    class ProbeFormValue extends ProbeRating {
      formValueSeam(): FormValue {
        return (this as unknown as { formValue(): FormValue }).formValue.call(this)
      }
    }
    if (!customElements.get('ui-rating-form-probe')) customElements.define('ui-rating-form-probe', ProbeFormValue)
    const el = new ProbeFormValue()
    stubFormAssoc(el.probeInternals)
    el.value = 3.5
    document.body.append(el)
    expect(el.formValueSeam()).toBe('3.5')
    el.remove()
  })
})

// ── descriptor trip-wire (contract↔props) ────────────────────────────────────────────────────────

const RATING_DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/rating`
const md = readFileSync(`${RATING_DIR}/rating.md`, 'utf8') as string
const { fence } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
// Attribute names in the order declared in rating.md frontmatter (anti-vacuous anchor).
const ATTR_NAMES = ['value', 'min', 'max', 'step', 'size', 'name', 'disabled', 'required', 'readonly', 'label', 'layout']

describe('rating.md descriptor — structural validity', () => {
  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-rating, extends=UIRangeElement, tier=indicator, face.formAssociated=true', () => {
    expect(/^tag:\s*ui-rating\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIRangeElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*indicator\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*true/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    // anti-vacuous: all 11 attribute names parse before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('rating.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with UIRatingElement.props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UIRatingElement.props)).toEqual([])
  })

  it('a drifted reflect FAILS the trip-wire (negative control — BITING NC)', () => {
    const flipReflect = parsed.attributes.map((a) => (a.name === 'readonly' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UIRatingElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.readonly.reflect' }),
    )
  })

  it('a drifted default FAILS the trip-wire (negative control — BITING NC)', () => {
    const flipDefault = parsed.attributes.map((a) => (a.name === 'max' ? { ...a, default: '100' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIRatingElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.max.default' }),
    )
  })

  it('a removed attribute FAILS the trip-wire (negative control — bijection from live)', () => {
    const dropReadonly = parsed.attributes.filter((a) => a.name !== 'readonly')
    expect(compareDescriptorToProps(dropReadonly, UIRatingElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.readonly' }),
    )
  })

  it('an added attribute FAILS the trip-wire (negative control — bijection from descriptor)', () => {
    const addBogus = [
      ...parsed.attributes,
      { name: 'bogus', type: 'string' as const, default: '', reflect: false },
    ]
    expect(compareDescriptorToProps(addBogus, UIRatingElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
