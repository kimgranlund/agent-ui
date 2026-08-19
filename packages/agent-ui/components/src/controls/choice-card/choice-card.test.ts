import { describe, it, expect } from 'vitest'
import { UIChoiceCardElement } from './choice-card.ts'

// jsdom probes — ui-choice-card (ADR-0220 GH #1368). The option unit — the WHOLE card is the hit
// target and a11y unit, ARIA via ElementInternals, no selection commit of its own (the owning
// ui-choice-group drives roving + commit). The REAL whole-shape geometry + forced-colors + non-color
// signifier proofs live in choice-card.browser.test.ts (Chromium + WebKit).
//
// Named probes: cc-upgrade · cc-typed · cc-define-guard · cc-role · cc-tabindex-default ·
// cc-set-selected · cc-set-unselected · cc-disabled-reflects

// `internals` is `protected` on UIElement — expose it through a probe subclass (the multi-select.test.ts
// / checkbox.test.ts `probeInternals` precedent) rather than reaching past the type system.
class ProbeChoiceCard extends UIChoiceCardElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-choice-card-probe', ProbeChoiceCard)

describe('ui-choice-card — upgrade + typed prop surface (cc-upgrade)', () => {
  it('cc-upgrade: upgrades to UIChoiceCardElement with default prop values (no connect needed)', () => {
    const el = document.createElement('ui-choice-card') as UIChoiceCardElement
    expect(el).toBeInstanceOf(UIChoiceCardElement)
    expect(el.value).toBe('')
    expect(el.disabled).toBe(false)
  })

  it('cc-typed: props have the correct types (compile-time NCs)', () => {
    const fn = (): void => {
      const el = new UIChoiceCardElement()
      el.value = 'standard'
      el.disabled = true
      // @ts-expect-error — value is string, not a number
      el.value = 1
      // @ts-expect-error — disabled is boolean, not a string
      el.disabled = 'yes'
    }
    expect(typeof fn).toBe('function') // never invoked — the @ts-expect-error lines are the assertion
  })

  it('cc-define-guard: self-defines ui-choice-card, guarded against a double-define', () => {
    expect(customElements.get('ui-choice-card')).toBe(UIChoiceCardElement)
    expect(() => {
      if (!customElements.get('ui-choice-card')) customElements.define('ui-choice-card', UIChoiceCardElement)
    }).not.toThrow()
  })
})

describe('ui-choice-card — ARIA role + tab order (cc-role · cc-tabindex-default)', () => {
  it('cc-role: role=option via internals, never a host attribute', () => {
    const el = new ProbeChoiceCard()
    el.setAttribute('value', 'standard')
    document.body.append(el)
    expect(el.probeInternals.role).toBe('option')
    expect(el.getAttribute('role')).toBeNull() // FACE — never a host role attribute
    el.remove()
  })

  it('cc-tabindex-default: an author-less card starts OUT of the tab order (the ui-tab precedent)', () => {
    const el = new UIChoiceCardElement()
    document.body.append(el)
    expect(el.tabIndex).toBe(-1)
    el.remove()
  })

  it('cc-tabindex-default: an author-set tabindex is left alone', () => {
    const el = new UIChoiceCardElement()
    el.setAttribute('tabindex', '0')
    document.body.append(el)
    expect(el.tabIndex).toBe(0)
    el.remove()
  })
})

describe('ui-choice-card — setSelected() (cc-set-selected · cc-set-unselected)', () => {
  it('cc-set-selected: sets internals.ariaSelected to "true" and adds :state(selected)', () => {
    const el = new ProbeChoiceCard()
    document.body.append(el)
    el.setSelected(true)
    expect(el.probeInternals.ariaSelected).toBe('true')
    // Optional-chained: jsdom has no CustomStateSet — the real :state(selected) paint is the browser leg.
    expect(el.probeInternals.states?.has('selected') ?? true).toBe(true)
    expect(el.getAttribute('aria-selected')).toBeNull() // FACE — never a host attribute
    el.remove()
  })

  it('cc-set-unselected: sets internals.ariaSelected to "false" and removes :state(selected)', () => {
    const el = new ProbeChoiceCard()
    document.body.append(el)
    el.setSelected(true)
    el.setSelected(false)
    expect(el.probeInternals.ariaSelected).toBe('false')
    expect(el.probeInternals.states?.has('selected') ?? false).toBe(false)
    el.remove()
  })
})

describe('ui-choice-card — disabled reflects as a real attribute (cc-disabled-reflects)', () => {
  it('cc-disabled-reflects: setting the disabled PROP reflects the [disabled] attribute (the roving/selectionCommit isDisabled() backstop)', () => {
    const el = new UIChoiceCardElement()
    document.body.append(el)
    expect(el.hasAttribute('disabled')).toBe(false)
    el.disabled = true
    expect(el.hasAttribute('disabled')).toBe(true)
    el.disabled = false
    expect(el.hasAttribute('disabled')).toBe(false)
    el.remove()
  })
})
