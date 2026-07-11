import { describe, it, expect, vi } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIColorPickerElement } from './color-picker.ts'
import '../slider/slider.ts'
import '../text-field/text-field.ts'
import '../swatch/swatch.ts'
import { hexToOklch } from './color.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
} from '../../descriptor/component-descriptor.ts'
import type { ParsedAttribute } from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
import type { FormValue, ValidityResult } from '../../dom/index.ts'
declare const process: { cwd(): string }

// color-picker.test.ts — jsdom probes (LLD §11): model round-trip, format switch, anatomy, form seams,
// pad ARIA (read directly off the part attributes — the tabs precedent, vitest-browser locators are blind
// to internals-only ARIA, but the pad's role rides a light-DOM PART attribute so it is readable here), 2-axis
// keyboard, disabled propagation, and the ui-swatch-not-a-div proof (SPEC-R4 AC2). Canvas pixels are never
// asserted (browser-only truth, LLD §11) — jsdom's getContext('2d') returns null (no canvas polyfill).
//
// jsdom lacks the ElementInternals form-association surface entirely (setFormValue/setValidity/validity are
// undefined) — this control composes THREE additional form-associated children (the hue/chroma/lightness
// ui-sliders + the readout ui-text-field) created INSIDE its own #ensureShell(), so a per-instance stub (the
// house convention for a single control under test) doesn't fit: the test has no handle on those children
// before they connect. Patch the SHARED PROTOTYPE once instead (the field-late-define.test.ts / a2ui
// catalog/index.test.ts precedent for exactly this "no per-instance stub hook" shape). Form-seam assertions
// read the protected formValue()/formValidity()/formReset() hooks directly via a probe subclass (the
// ProbeCalendar/ProbeTextField precedent) rather than `el.validity`/`new FormData(form)`, both of which
// depend on jsdom's absent internals machinery.
;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue ??= (): void => {}
;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity ??= (): void => {}

// A prop write AFTER connect re-runs the tracked model→surface effect on a MICROTASK (scheduler.ts), not
// synchronously — every test below either seeds state via attributes BEFORE first connect (so the FIRST,
// synchronous effect run already reflects it) or `await whenFlushed()`s after a post-connect mutation whose
// effect it inspects. Gesture-driven commits (#commit) are the one exception: they call `#paint()` directly,
// so pad-keyboard/slider-input assertions need no flush.

class ProbeColorPicker extends UIColorPickerElement {
  formValueProbe(): FormValue {
    return (this as unknown as { formValue(): FormValue }).formValue.call(this)
  }
  formValidityProbe(): ValidityResult {
    return (this as unknown as { formValidity(): ValidityResult }).formValidity.call(this)
  }
  formResetProbe(): void {
    ;(this as unknown as { formReset(): void }).formReset.call(this)
  }
}
customElements.define('ui-color-picker-probe', ProbeColorPicker)

function makePicker(attrs: Record<string, string> = {}): ProbeColorPicker {
  const el = new ProbeColorPicker()
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  document.body.append(el) // connect fires here; the shell + first effect run are synchronous
  return el
}

function pad(el: Element): HTMLElement {
  return el.querySelector('[data-part="pad"]') as HTMLElement
}
function readoutField(el: Element): HTMLElement {
  return el.querySelector('[data-part="readout"] ui-text-field') as HTMLElement
}
function swatchEl(el: Element): HTMLElement {
  return el.querySelector('[data-part="readout"] ui-swatch') as HTMLElement
}
function slider(el: Element, channel: string): HTMLElement {
  return el.querySelector(`ui-slider[data-channel="${channel}"]`) as HTMLElement
}
function channelValueText(el: Element, channel: string): string {
  return (el.querySelector(`[data-part="channel-row"][data-channel="${channel}"] [data-part="channel-value"]`) as HTMLElement).textContent ?? ''
}

describe('ui-color-picker — self-definition + idempotent shell (SPEC-R1)', () => {
  it('customElements.get resolves to a UIFormElement subclass, formAssociated true', () => {
    const ctor = customElements.get('ui-color-picker')
    expect(ctor).toBeDefined()
    expect((ctor as typeof UIColorPickerElement).formAssociated).toBe(true)
  })

  it('connect → disconnect → reconnect creates each [data-part] exactly once', () => {
    const el = makePicker()
    document.body.removeChild(el)
    document.body.append(el)

    expect(el.querySelectorAll('[data-part="pad"]')).toHaveLength(1)
    expect(el.querySelectorAll('[data-part="pad-thumb"]')).toHaveLength(1)
    expect(el.querySelectorAll('[data-part="channels"]')).toHaveLength(1)
    expect(el.querySelectorAll('[data-part="readout"]')).toHaveLength(1)
    expect(el.querySelectorAll('ui-slider')).toHaveLength(3)
    el.remove()
  })
})

describe('ui-color-picker — props (SPEC-R2)', () => {
  it('a fresh instance defaults value="" and format="hex"', () => {
    const el = document.createElement('ui-color-picker') as UIColorPickerElement
    expect(el.value).toBe('')
    expect(el.format).toBe('hex')
  })

  it('format reflects and an out-of-vocabulary attribute value falls back to hex (fail-open)', () => {
    const el = makePicker()
    el.format = 'oklch'
    expect(el.getAttribute('format')).toBe('oklch')
    el.setAttribute('format', 'bogus')
    expect(el.format).toBe('hex')
    el.remove()
  })
})

describe('ui-color-picker — value model + serialization (SPEC-R3)', () => {
  it('value="#3b82f6" (authored) parses into the model and repositions the thumb + channel sliders', () => {
    const el = makePicker({ value: '#3b82f6' })
    const expected = hexToOklch('#3b82f6')
    expect(Number(channelValueText(el, 'hue'))).toBeCloseTo(expected.H, 0)
    const thumb = el.querySelector('[data-part="pad-thumb"]') as HTMLElement
    expect(thumb.style.left).not.toBe('')
    expect(thumb.style.top).not.toBe('')
    el.remove()
  })

  it('value="oklch(0.62 0.19 260)" (authored) also parses into the model', () => {
    const el = makePicker({ value: 'oklch(0.62 0.19 260)' })
    expect(channelValueText(el, 'hue')).toBe('260')
    expect(channelValueText(el, 'chroma')).toBe('0.190')
    el.remove()
  })

  it('format=hex gamut-maps a wide-gamut model before serializing (authored)', () => {
    const el = makePicker({ value: 'oklch(0.7 0.4 30)', format: 'hex' }) // MAX_CHROMA, very likely out of sRGB gamut
    expect(el.value).toMatch(/^#[0-9a-f]{6}$/)
    el.remove()
  })

  it('format=oklch emits the authored chroma (authored, not gamut-reduced)', () => {
    const el = makePicker({ value: 'oklch(0.7 0.4 30)', format: 'oklch' })
    expect(el.value).toBe('oklch(0.70 0.400 30)')
    el.remove()
  })

  it('a format switch alone re-serializes `value` to the new syntax (SPEC-R2 AC2)', async () => {
    const el = makePicker({ value: '#3b82f6' })
    el.format = 'oklch'
    await whenFlushed()
    expect(el.value).toMatch(/^oklch\([\d.]+ [\d.]+ \d+\)$/)
    el.remove()
  })

  it('el.value = "not-a-color" leaves the prior model intact — no throw (negative control, SPEC-R3 AC4)', async () => {
    const el = makePicker({ value: '#3b82f6' })
    await whenFlushed()
    const before = channelValueText(el, 'hue')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => { el.value = 'not-a-color' }).not.toThrow()
    await whenFlushed()
    // the model (channel readouts) is unchanged — proving the guard bites, not just the happy path
    expect(channelValueText(el, 'hue')).toBe(before)
    warnSpy.mockRestore()
    el.remove()
  })
})

describe('ui-color-picker — anatomy + composition (SPEC-R4)', () => {
  it('the pad, hue/chroma/lightness sliders, the readout ui-text-field, and the ui-swatch preview are all present', () => {
    const el = makePicker()
    expect(pad(el)).not.toBeNull()
    expect(slider(el, 'hue')).not.toBeNull()
    expect(slider(el, 'chroma')).not.toBeNull()
    expect(slider(el, 'lightness')).not.toBeNull()
    expect(readoutField(el)).not.toBeNull()
    expect(swatchEl(el)).not.toBeNull()
    el.remove()
  })

  it('the preview is a REAL <ui-swatch> whose value tracks the color — no bespoke color div outside the pad (SPEC-R4 AC2)', () => {
    const el = makePicker({ value: '#3b82f6' })
    const sw = swatchEl(el)
    expect(sw.tagName.toLowerCase()).toBe('ui-swatch')
    expect((sw as unknown as { value: string }).value).toBe(el.value)
    // grep-provable: no background-painting div outside the pad/thumb
    const divs = [...el.querySelectorAll('div')].filter((d) => !d.closest('[data-part="pad"]') && d.getAttribute('data-part') !== 'pad-thumb')
    for (const d of divs) expect((d as HTMLElement).style.background).toBe('')
    el.remove()
  })

  it('[slot=presets] author content renders; its absence leaves no layout hole', () => {
    const el = document.createElement('ui-color-picker') as UIColorPickerElement
    const preset = document.createElement('div')
    preset.setAttribute('slot', 'presets')
    preset.textContent = 'preset'
    el.append(preset)
    document.body.append(el)
    expect(el.querySelector('[slot="presets"]')).not.toBeNull()
    el.remove()

    const bare = makePicker()
    expect(bare.querySelector('[slot="presets"]')).toBeNull()
    bare.remove()
  })
})

describe('ui-color-picker — the accessible spine (SPEC-R6)', () => {
  it('every channel is a real <ui-slider>', () => {
    const el = makePicker()
    for (const ch of ['hue', 'chroma', 'lightness']) {
      expect(slider(el, ch).tagName.toLowerCase()).toBe('ui-slider')
    }
    el.remove()
  })

  it('each channel carries its own aria-label naming the axis', () => {
    const el = makePicker()
    expect(slider(el, 'hue').getAttribute('aria-label')).toBe('Hue')
    expect(slider(el, 'chroma').getAttribute('aria-label')).toBe('Chroma')
    expect(slider(el, 'lightness').getAttribute('aria-label')).toBe('Lightness')
    el.remove()
  })
})

describe('ui-color-picker — the pad as a 2D-slider accelerator (SPEC-R7)', () => {
  it('the pad carries role=slider, aria-roledescription="2D slider", aria-label, and aria-valuetext', () => {
    const el = makePicker()
    const p = pad(el)
    expect(p.getAttribute('role')).toBe('slider')
    expect(p.getAttribute('aria-roledescription')).toBe('2D slider')
    expect(p.getAttribute('aria-label')).toContain('Chroma and lightness')
    expect(p.getAttribute('aria-valuetext')).toMatch(/^Chroma [\d.]+, Lightness [\d.]+$/)
    el.remove()
  })

  it('←/→ changes chroma and ↑/↓ changes lightness; each fires input+change (gesture commits are synchronous)', () => {
    const el = makePicker({ value: '#3b82f6' }) // real chroma (~0.19), not achromatic gray
    const p = pad(el)
    const events: string[] = []
    el.addEventListener('input', () => events.push('input'))
    el.addEventListener('change', () => events.push('change'))

    const chromaBefore = channelValueText(el, 'chroma')
    p.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(events).toEqual(['input', 'change'])
    expect(channelValueText(el, 'chroma')).not.toBe(chromaBefore)

    events.length = 0
    const lightnessBefore = channelValueText(el, 'lightness')
    p.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }))
    expect(events).toEqual(['input', 'change'])
    expect(channelValueText(el, 'lightness')).not.toBe(lightnessBefore)
    el.remove()
  })

  it('Home/End set chroma to min/max; PageUp/PageDown set lightness to max/min', () => {
    const el = makePicker()
    const p = pad(el)
    p.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }))
    expect(channelValueText(el, 'chroma')).toBe('0.000')
    p.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }))
    expect(channelValueText(el, 'chroma')).toBe('0.400')
    p.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true, cancelable: true }))
    expect(channelValueText(el, 'lightness')).toBe('1.00')
    p.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true }))
    expect(channelValueText(el, 'lightness')).toBe('0.00')
    el.remove()
  })

  it('an unrecognized key is ignored (no commit)', () => {
    const el = makePicker()
    const p = pad(el)
    const events: string[] = []
    el.addEventListener('change', () => events.push('change'))
    p.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }))
    expect(events).toHaveLength(0)
    el.remove()
  })
})

describe('ui-color-picker — events (SPEC-R5)', () => {
  it('the readout parse-success path fires exactly one change, no input', () => {
    const el = makePicker()
    const field = readoutField(el) as unknown as { value: string }
    const events: string[] = []
    el.addEventListener('input', () => events.push('input'))
    el.addEventListener('change', () => events.push('change'))
    field.value = '#ff0000'
    readoutField(el).dispatchEvent(new Event('change', { bubbles: true, composed: true }))
    expect(events).toEqual(['change'])
    el.remove()
  })

  it('an invalid readout entry fires no change', () => {
    const el = makePicker()
    const field = readoutField(el) as unknown as { value: string }
    const events: string[] = []
    el.addEventListener('change', () => events.push('change'))
    field.value = 'not-a-color'
    readoutField(el).dispatchEvent(new Event('change', { bubbles: true, composed: true }))
    expect(events).toHaveLength(0)
    el.remove()
  })
})

describe('ui-color-picker — form seams (SPEC-R9)', () => {
  it('formValue() is the serialized value when set and null when unset', () => {
    const el = makePicker() as ProbeColorPicker
    expect(el.formValueProbe()).toBeNull()
    el.value = '#3b82f6'
    expect(el.formValueProbe()).toBe('#3b82f6')
    el.remove()
  })

  it('required + unset ⇒ valueMissing', () => {
    const el = makePicker({ required: '' }) as ProbeColorPicker
    const result = el.formValidityProbe()
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.flags.valueMissing).toBe(true)
    el.remove()
  })

  it('an unparseable readout entry ⇒ customError', () => {
    const el = makePicker() as ProbeColorPicker
    const field = readoutField(el) as unknown as { value: string }
    field.value = 'not-a-color'
    readoutField(el).dispatchEvent(new Event('change', { bubbles: true, composed: true }))
    const result = el.formValidityProbe()
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.flags.customError).toBe(true)
    el.remove()
  })

  it('a subsequent pad/channel commit clears a stuck readout customError (LLD-C6 — the fix M1)', () => {
    const el = makePicker() as ProbeColorPicker
    const field = readoutField(el) as unknown as { value: string }
    field.value = 'not-a-color'
    readoutField(el).dispatchEvent(new Event('change', { bubbles: true, composed: true }))
    expect(el.formValidityProbe().valid).toBe(false) // stuck invalid after the bad readout entry

    // A pad keyboard step is a pad/channel commit — must clear the customError even though the
    // readout itself was never corrected.
    pad(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(el.formValidityProbe().valid).toBe(true)
    el.remove()
  })

  it('a subsequent channel-slider commit ALSO clears a stuck readout customError', () => {
    const el = makePicker() as ProbeColorPicker
    const field = readoutField(el) as unknown as { value: string }
    field.value = 'not-a-color'
    readoutField(el).dispatchEvent(new Event('change', { bubbles: true, composed: true }))
    expect(el.formValidityProbe().valid).toBe(false)

    const hueSlider = slider(el, 'hue') as unknown as { value: number }
    hueSlider.value = 200
    slider(el, 'hue').dispatchEvent(new Event('input', { bubbles: true }))
    expect(el.formValidityProbe().valid).toBe(true)
    el.remove()
  })

  it('formReset restores the initial authored value (formResetProbe, the calendar/text-field precedent)', () => {
    const el = makePicker({ value: '#3b82f6' }) as ProbeColorPicker
    el.value = '#ff0000'
    el.formResetProbe()
    expect(el.value).toBe('#3b82f6')
    el.remove()
  })

  it('a fresh, untouched control paints a default working color AND formValue() is null simultaneously (SPEC-R9 AC4)', () => {
    const el = makePicker() as ProbeColorPicker
    // the render is non-empty — the thumb has a real position
    const thumb = el.querySelector('[data-part="pad-thumb"]') as HTMLElement
    expect(thumb.style.left).not.toBe('')
    // yet the form contributes nothing
    expect(el.formValueProbe()).toBeNull()
    el.remove()
  })
})

describe('ui-color-picker — whole-shape + disabled (ADR-0102/0057/0010)', () => {
  it('every channel prints a numeric value as text (non-color signifier, SPEC-R8 AC2)', () => {
    const el = makePicker()
    for (const ch of ['hue', 'chroma', 'lightness']) {
      expect(channelValueText(el, ch).length).toBeGreaterThan(0)
    }
    el.remove()
  })

  it('disabled forwards onto every composed child + the pad leaves the tab order', async () => {
    const el = makePicker()
    el.disabled = true
    await whenFlushed()
    expect((slider(el, 'hue') as unknown as { disabled: boolean }).disabled).toBe(true)
    expect((readoutField(el) as unknown as { disabled: boolean }).disabled).toBe(true)
    expect(pad(el).getAttribute('tabindex')).toBe('-1')
    el.remove()
  })

  it('a disabled pad ignores keyboard commits', async () => {
    const el = makePicker({ disabled: '' })
    await whenFlushed()
    const events: string[] = []
    el.addEventListener('change', () => events.push('change'))
    pad(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(events).toHaveLength(0)
    el.remove()
  })
})

// ── Descriptor trip-wire (LLD-C8) ────────────────────────────────────────────────────────────

const COLOR_PICKER_DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/color-picker`
const md = readFileSync(`${COLOR_PICKER_DIR}/color-picker.md`, 'utf8') as string
const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

const ATTR_NAMES = ['name', 'disabled', 'required', 'value', 'format']

describe('color-picker.md descriptor — frontmatter parses + schema-valid', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-color-picker')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-color-picker, tier=pattern, extends=UIFormElement, formAssociated=true', () => {
    expect(/^tag:\s*ui-color-picker\s*$/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIFormElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*true/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('records exactly five attributes — no app-specific generation-constraint props (ADR-0123 Alternatives)', () => {
    expect(parsed.attributes).toHaveLength(5)
    for (const forbidden of ['maxChroma', 'minL', 'hueDriftMax', 'baseHue', 'constraintClamp']) {
      expect(parsed.attributes.some((a) => a.name === forbidden)).toBe(false)
    }
  })
})

describe('color-picker.md descriptor — contract↔props trip-wire', () => {
  it('the full bijection is CLEAN — zero drift', () => {
    expect(compareDescriptorToProps(parsed.attributes, UIColorPickerElement.props)).toEqual([])
  })

  it('negative control: a drifted reflect FAILS the trip-wire', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'value' ? { ...a, reflect: false } : { ...a },
    )
    expect(compareDescriptorToProps(flipReflect, UIColorPickerElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.value.reflect' }),
    )
  })

  it('negative control: a mis-typed format attribute FAILS the trip-wire', () => {
    const flipType = parsed.attributes.map((a) => (a.name === 'format' ? { ...a, type: 'string', values: undefined } : { ...a }))
    expect(compareDescriptorToProps(flipType, UIColorPickerElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_TYPE', path: 'attributes.format.type' }),
    )
  })

  it('negative control: a removed or added attribute FAILS the trip-wire (bijection both ways)', () => {
    const dropValue = parsed.attributes.filter((a) => a.name !== 'value')
    expect(compareDescriptorToProps(dropValue, UIColorPickerElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.value' }),
    )
    const addBogus = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIColorPickerElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
