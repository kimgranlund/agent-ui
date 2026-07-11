import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest'
import { whenFlushed, type UIFormElement } from '@agent-ui/components'
import '@agent-ui/components/controls/text-field'
import '@agent-ui/components/controls/switch'
import '@agent-ui/components/controls/select'
import '@agent-ui/components/controls/slider'
import { applyValidation } from './validate.ts'
import type { SettingsField } from './schema.ts'

// n3c — jsdom probes for the validation wiring (LLD-C14, SPEC-R11 AC2). ONE timing source: native
// constraint props where a control's own formValidity() already checks them (text-field/select), a
// setCustomValidity reactive bridge only where nothing native exists (boolean → ui-switch's `required`).
//
// jsdom reality (the switch.test.ts/checkbox.test.ts precedent): ElementInternals.setFormValue/setValidity
// are ENTIRELY absent in jsdom, and UIFormElement's base calls them synchronously on connect. Every prior
// fleet test reaches this via a per-control Probe SUBCLASS (a protected `internals` getter re-exposed).
// This file instead connects the REAL shipped tags through schema.ts's OWN production factories/plain
// `document.createElement` calls (proving the actual registry, not a stand-in) — there is no per-instance
// protected getter to reach for a plain tag, so the PROTOTYPE method is stubbed for this file's duration
// instead. Consequence: the platform `.validity` getter is never truthfully wired in jsdom (the stub is a
// no-op) — assertions below verify `setCustomValidity`'s OWN call (a real, un-stubbed public method) or a
// plain native-prop write, never `.validity.valid` itself; the true cross-control validity proof is
// settings.browser.test.ts's job (real engines have full ElementInternals).
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

function connect<T extends HTMLElement>(el: T): T {
  document.body.append(el)
  mounted.push(el)
  return el
}

function field(partial: Partial<SettingsField> & Pick<SettingsField, 'type'>): SettingsField {
  return { key: 'k', label: 'L', default: undefined, ...partial }
}

describe('applyValidation — native constraint props (text-field/select: required; text-field: min/max/step)', () => {
  it('sets `required` on a text field via the native prop (ui-text-field enforces it itself)', () => {
    const el = connect(document.createElement('ui-text-field')) as unknown as UIFormElement & { required: boolean }
    const dispose = applyValidation(el, field({ type: 'text', validation: { required: true } }))
    expect(el.required).toBe(true)
    dispose()
  })

  it('sets min/max/step on a number field via the native props', () => {
    const el = connect(document.createElement('ui-text-field')) as unknown as UIFormElement & { type: string }
    el.type = 'number'
    const dispose = applyValidation(el, field({ type: 'number', validation: { min: 1, max: 9, step: 2 } }))
    const asAny = el as unknown as { min: string; max: string; step: number }
    expect(asAny.min).toBe('1')
    expect(asAny.max).toBe('9')
    expect(asAny.step).toBe(2)
    dispose()
  })

  it('sets `required` on a select field via the native prop (ui-select enforces it itself)', () => {
    const el = connect(document.createElement('ui-select')) as unknown as UIFormElement & { required: boolean }
    const dispose = applyValidation(el, field({ type: 'select', validation: { required: true } }))
    expect(el.required).toBe(true)
    dispose()
  })

  it('a min > max mismatch warns once (the schema author error) and never throws', () => {
    const el = connect(document.createElement('ui-text-field')) as unknown as UIFormElement & { type: string }
    el.type = 'number'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(() => applyValidation(el, field({ type: 'number', validation: { min: 9, max: 1 } }))).not.toThrow()
      expect(warnSpy).toHaveBeenCalledTimes(1)
    } finally {
      warnSpy.mockRestore()
    }
  })
})

describe('applyValidation — the setCustomValidity fallback (no native support)', () => {
  it('a required boolean field (ui-switch) calls setCustomValidity(non-empty) while unchecked, ("") once checked', async () => {
    const el = connect(document.createElement('ui-switch')) as unknown as UIFormElement & { checked: boolean }
    const spy = vi.spyOn(el, 'setCustomValidity')
    const dispose = applyValidation(el, field({ type: 'boolean', validation: { required: true } }))
    await whenFlushed()
    expect(spy).toHaveBeenLastCalledWith(expect.stringMatching(/.+/))
    el.checked = true
    await whenFlushed()
    expect(spy).toHaveBeenLastCalledWith('')
    dispose()
  })

  it('disposing the effect stops further setCustomValidity calls', async () => {
    const el = connect(document.createElement('ui-switch')) as unknown as UIFormElement & { checked: boolean }
    const dispose = applyValidation(el, field({ type: 'boolean', validation: { required: true } }))
    await whenFlushed()
    const spy = vi.spyOn(el, 'setCustomValidity')
    dispose()
    el.checked = true
    await whenFlushed()
    expect(spy).not.toHaveBeenCalled()
  })

  it('a pattern rule on a text field calls setCustomValidity reactively as the value changes', async () => {
    const el = connect(document.createElement('ui-text-field')) as unknown as UIFormElement & { value: string }
    const dispose = applyValidation(el, field({ type: 'text', validation: { pattern: '^[a-z]+$' } }))
    const spy = vi.spyOn(el, 'setCustomValidity')
    el.value = 'ABC'
    await whenFlushed()
    expect(spy).toHaveBeenLastCalledWith(expect.stringMatching(/.+/))
    el.value = 'abc'
    await whenFlushed()
    expect(spy).toHaveBeenLastCalledWith('')
    dispose()
  })

  it('a pattern rule on a NON-text field is ignored (warned), never applied', () => {
    const el = connect(document.createElement('ui-slider')) as unknown as UIFormElement
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const spy = vi.spyOn(el, 'setCustomValidity')
    try {
      const dispose = applyValidation(el, field({ type: 'slider', validation: { pattern: '^[a-z]+$' } }))
      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(spy).not.toHaveBeenCalled()
      dispose()
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('`required` on a field type with NEITHER a native check nor a bridge (slider) is ignored (warned), never silently dropped', () => {
    const el = connect(document.createElement('ui-slider')) as unknown as UIFormElement
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const spy = vi.spyOn(el, 'setCustomValidity')
    try {
      const dispose = applyValidation(el, field({ type: 'slider', validation: { required: true } }))
      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(spy).not.toHaveBeenCalled()
      dispose()
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('`required: false` on a slider warns NOTHING (only an unenforceable TRUE requirement is a schema-author error)', () => {
    const el = connect(document.createElement('ui-slider')) as unknown as UIFormElement
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const dispose = applyValidation(el, field({ type: 'slider', validation: { required: false } }))
      expect(warnSpy).not.toHaveBeenCalled()
      dispose()
    } finally {
      warnSpy.mockRestore()
    }
  })
})

describe('applyValidation — no validation rules is a true no-op', () => {
  it('returns a callable disposer even with no `field.validation`, and never calls setCustomValidity', () => {
    const el = connect(document.createElement('ui-text-field')) as unknown as UIFormElement
    const spy = vi.spyOn(el, 'setCustomValidity')
    const dispose = applyValidation(el, field({ type: 'text' }))
    expect(() => dispose()).not.toThrow()
    expect(spy).not.toHaveBeenCalled()
  })
})
