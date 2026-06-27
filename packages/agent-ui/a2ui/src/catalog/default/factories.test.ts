import { describe, it, expect } from 'vitest'
import { buttonFactory, defaultFactories } from './factories.ts'

// factories.ts imports the @agent-ui/components controls barrel, so `ui-button` self-defines on load —
// these assertions run against the REAL UIButtonElement (a live jsdom control), not a stub. The
// "factory present for every catalog-declared type" cross-check is a wave-3 host concern; this slice
// proves the Button factory STANDALONE.
const UIButton = customElements.get('ui-button')

describe('default catalog factories — Button → ui-button (catalog LLD-C5, SPEC-R4)', () => {
  it('registers the Button factory in the default table (tag ui-button, no value)', () => {
    expect(defaultFactories.Button).toBe(buttonFactory)
    expect(buttonFactory.tag).toBe('ui-button')
    expect(buttonFactory.value).toBeUndefined() // Button is not an input — renderer LLD-C8 wires no two-way binding
  })

  it('create() yields a live, upgraded ui-button control', () => {
    expect(UIButton).toBeTruthy() // the controls barrel self-defined the tag on import
    const el = buttonFactory.create()
    expect(el.tagName.toLowerCase()).toBe('ui-button')
    expect(el).toBeInstanceOf(UIButton!) // real UIButtonElement, not an inert HTMLUnknownElement
  })

  it('applyProp maps variant → the control variant prop', () => {
    const el = buttonFactory.create()
    buttonFactory.applyProp(el, 'variant', 'soft')
    expect((el as { variant?: unknown }).variant).toBe('soft') // reaches the real reflecting prop accessor
  })

  it('applyProp maps label → textContent', () => {
    const el = buttonFactory.create()
    buttonFactory.applyProp(el, 'label', 'Hi')
    expect(el.textContent).toBe('Hi')
  })

  it('applyProp coerces a null label to empty text (clears, never "null")', () => {
    const el = buttonFactory.create()
    buttonFactory.applyProp(el, 'label', null)
    expect(el.textContent).toBe('')
  })

  it('applyProp falls back to an attribute for an unmapped prop', () => {
    const el = buttonFactory.create()
    buttonFactory.applyProp(el, 'data-x', 'y')
    expect(el.getAttribute('data-x')).toBe('y')
  })
})
