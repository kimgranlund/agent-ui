import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { FIELD_CONTROL_REGISTRY, type SettingsField } from './schema.ts'

// n3b (schema half) — jsdom probes for the field-type → control registry (LLD-C13, SPEC-R10). Proves each
// v1 factory maps to the right fleet tag, applies its own constraints (min/max/step, select options), and
// that getValue/setValue bridge the settings-level `unknown` correctly ONCE the control is connected (the
// ADR-0050 form-connect seam bridge.ts uses) — generate.ts's own tests cover the end-to-end wiring.
//
// jsdom reality (the switch.test.ts/checkbox.test.ts precedent, validate.test.ts's own header): jsdom has
// no ElementInternals.setFormValue/setValidity at all. This file connects the REAL shipped tags via
// schema.ts's OWN production factories — no per-instance protected `internals` getter to reach for a plain
// tag, so the PROTOTYPE method is stubbed for this file's duration instead (see validate.test.ts for the
// full rationale). `.validity` is never truthfully wired here as a consequence — this file only asserts
// getValue()/setValue(), never `.validity`.
let realAttachInternals: typeof HTMLElement.prototype.attachInternals
beforeAll(() => {
  realAttachInternals = HTMLElement.prototype.attachInternals
  HTMLElement.prototype.attachInternals = function (this: HTMLElement): ElementInternals {
    const internals = realAttachInternals.call(this) as unknown as Record<string, unknown>
    if (typeof internals.setFormValue !== 'function') internals.setFormValue = () => {}
    if (typeof internals.setValidity !== 'function') internals.setValidity = () => {}
    return internals as unknown as ElementInternals
  }
})
afterAll(() => {
  HTMLElement.prototype.attachInternals = realAttachInternals
})

const mounted: Element[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

function connect(el: HTMLElement): HTMLElement {
  document.body.append(el)
  mounted.push(el)
  return el
}

function field(partial: Partial<SettingsField> & Pick<SettingsField, 'type'>): SettingsField {
  return { key: 'k', label: 'L', default: undefined, ...partial }
}

describe('FIELD_CONTROL_REGISTRY — the v1 type set (SPEC-R10)', () => {
  it('maps exactly the six v1 types', () => {
    expect(Object.keys(FIELD_CONTROL_REGISTRY).sort()).toEqual(['boolean', 'date', 'number', 'select', 'slider', 'text'].sort())
  })

  it('text/number/date all create a ui-text-field with the matching `type`', () => {
    for (const kind of ['text', 'number', 'date'] as const) {
      const registered = FIELD_CONTROL_REGISTRY[kind]!(field({ type: kind }))
      expect(registered.element.tagName.toLowerCase()).toBe('ui-text-field')
      expect((registered.element as unknown as { type: string }).type).toBe(kind)
    }
  })

  it('number/date apply validation.min/max/step onto the text-field as configuration', () => {
    const registered = FIELD_CONTROL_REGISTRY.number!(
      field({ type: 'number', validation: { min: 2, max: 10, step: 2 } }),
    )
    const el = registered.element as unknown as { min: string; max: string; step: number }
    expect(el.min).toBe('2')
    expect(el.max).toBe('10')
    expect(el.step).toBe(2)
  })

  it('boolean creates a ui-switch', () => {
    const registered = FIELD_CONTROL_REGISTRY.boolean!(field({ type: 'boolean' }))
    expect(registered.element.tagName.toLowerCase()).toBe('ui-switch')
  })

  it('select creates a ui-select with one [role=option] child per schema option', () => {
    const registered = FIELD_CONTROL_REGISTRY.select!(
      field({ type: 'select', options: [{ value: 'a', label: 'Apple' }, { value: 'b', label: 'Banana' }] }),
    )
    expect(registered.element.tagName.toLowerCase()).toBe('ui-select')
    const options = registered.element.querySelectorAll('[role="option"]')
    expect(options).toHaveLength(2)
    expect(options[0].getAttribute('value')).toBe('a')
    expect(options[0].textContent).toBe('Apple')
  })

  it('select with NO options warns once and renders an empty listbox (never throws)', () => {
    const warn = console.warn as unknown as { mock?: unknown }
    let warned = 0
    const original = console.warn
    console.warn = (...args: unknown[]) => {
      warned += 1
      original(...(args as []))
    }
    try {
      expect(() => FIELD_CONTROL_REGISTRY.select!(field({ type: 'select' }))).not.toThrow()
      expect(warned).toBe(1)
    } finally {
      console.warn = original
      void warn
    }
  })

  it('slider creates a ui-slider and applies validation.min/max/step as its OWN operating range', () => {
    const registered = FIELD_CONTROL_REGISTRY.slider!(field({ type: 'slider', validation: { min: 0, max: 5, step: 1 } }))
    expect(registered.element.tagName.toLowerCase()).toBe('ui-slider')
    const el = registered.element as unknown as { min: number; max: number; step: number }
    expect(el.min).toBe(0)
    expect(el.max).toBe(5)
    expect(el.step).toBe(1)
  })
})

describe('RegisteredControl — getValue/setValue bridge (the FormConnectDetail seam)', () => {
  it('boolean: setValue(true) checks the switch; getValue() decodes FormData-parity presence → true/false', () => {
    const registered = FIELD_CONTROL_REGISTRY.boolean!(field({ type: 'boolean' }))
    connect(registered.element)
    registered.setValue(true)
    expect(registered.getValue()).toBe(true)
    registered.setValue(false)
    expect(registered.getValue()).toBe(false)
  })

  it('number: setValue(42) BEFORE connect seeds the codec canonical — getValue() === 42 (the generate.ts seeding order: setValue always runs before the tree ever connects)', () => {
    const registered = FIELD_CONTROL_REGISTRY.number!(field({ type: 'number' }))
    registered.setValue(42) // pre-connect — the ONLY order generate.ts ever calls setValue in
    connect(registered.element) // the codec seeds its canonical from `value` AT ATTACH (value-codec.ts)
    expect(registered.getValue()).toBe(42)
  })

  it('number: a setValue AFTER connect now reaches the codec canonical with NO blur (TKT-0023 fix — value-codec.ts\'s unfocused-write resync; supersedes the old documented wall)', async () => {
    const registered = FIELD_CONTROL_REGISTRY.number!(field({ type: 'number' }))
    connect(registered.element)
    registered.setValue(42) // a programmatic, unfocused write — the exact shape generate.ts's external-sync uses
    await whenFlushed() // the codec's unfocused-write resync effect is microtask-scheduled
    expect(registered.getValue()).toBe(42) // canonical resynced — no blur needed
  })

  it('text: setValue/getValue round-trip a plain string', () => {
    const registered = FIELD_CONTROL_REGISTRY.text!(field({ type: 'text' }))
    connect(registered.element)
    registered.setValue('hello')
    expect(registered.getValue()).toBe('hello')
  })

  it('select: setValue selects the matching option; getValue reads it back', () => {
    const registered = FIELD_CONTROL_REGISTRY.select!(
      field({ type: 'select', options: [{ value: 'a', label: 'Apple' }, { value: 'b', label: 'Banana' }] }),
    )
    connect(registered.element)
    registered.setValue('b')
    expect(registered.getValue()).toBe('b')
  })

  it('slider: setValue(3) round-trips to getValue() === 3', () => {
    const registered = FIELD_CONTROL_REGISTRY.slider!(field({ type: 'slider', validation: { min: 0, max: 10 } }))
    connect(registered.element)
    registered.setValue(3)
    expect(registered.getValue()).toBe(3)
  })

  it('getValue() never throws before the control has ever connected (decodes the not-yet-observed null as "")', () => {
    const registered = FIELD_CONTROL_REGISTRY.text!(field({ type: 'text' }))
    expect(() => registered.getValue()).not.toThrow()
    expect(registered.getValue()).toBe('')
  })
})
