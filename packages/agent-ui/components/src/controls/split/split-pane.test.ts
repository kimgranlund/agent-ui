import { describe, it, expect } from 'vitest'
import { UISplitPaneElement } from './split-pane.ts'
import { UIContainerElement } from '../../dom/container.ts'
import { UIFormElement } from '../../dom/form.ts'

// n1a (pane half) — UISplitPaneElement, the generic pane child of ui-split (LLD-C1). BEHAVIOUR probes
// (jsdom): upgrade + defaults, props reflect (min/max/collapsible) vs property-only (initial), typed literal
// unions, no ARIA role, host-as-block content model, self-define, zero residue.

class ProbePane extends UISplitPaneElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-split-pane-probe', ProbePane)

describe('UISplitPaneElement — upgrade + defaults', () => {
  it('upgrades to the class; props default to their declared defaults', () => {
    const el = document.createElement('ui-split-pane') as UISplitPaneElement
    document.body.append(el)
    expect(el).toBeInstanceOf(UISplitPaneElement)
    expect(el).toBeInstanceOf(UIContainerElement)
    expect(el.initial).toBeNull()
    expect(el.min).toBe('')
    expect(el.max).toBe('')
    expect(el.collapsible).toBe(false)
    el.remove()
  })

  it('is NOT form-associated — a structural pane contributes nothing to a form', () => {
    const el = new UISplitPaneElement()
    expect(el).not.toBeInstanceOf(UIFormElement)
    expect('validity' in el).toBe(false)
  })

  it('static props is exactly [initial, min, max, collapsible], in order', () => {
    expect(Object.keys(UISplitPaneElement.props)).toEqual(['initial', 'min', 'max', 'collapsible'])
  })
})

describe('UISplitPaneElement — reflection (min/max/collapsible reflect; initial does not)', () => {
  it('min/max/collapsible reflect to their attribute', () => {
    const el = new UISplitPaneElement()
    document.body.append(el)
    el.min = '200px'
    el.max = '50%'
    el.collapsible = true
    expect(el.getAttribute('min')).toBe('200px')
    expect(el.getAttribute('max')).toBe('50%')
    expect(el.hasAttribute('collapsible')).toBe(true)
    el.collapsible = false
    expect(el.hasAttribute('collapsible')).toBe(false)
    el.remove()
  })

  it('a fresh pane carries NO min/max/collapsible attribute (unset ⇒ no opinion)', () => {
    const el = new UISplitPaneElement()
    for (const a of ['min', 'max', 'collapsible']) {
      expect(el.hasAttribute(a), `default ${a} must not reflect`).toBe(false)
    }
  })

  it('initial is PROPERTY-ONLY — never reflects to an attribute even when set', () => {
    const el = new UISplitPaneElement()
    document.body.append(el)
    el.initial = 0.4
    expect(el.hasAttribute('initial')).toBe(false) // no attribute at all — property-only (attribute: false)
    expect(el.initial).toBe(0.4)
    el.remove()
  })

  it('an inbound attribute can still SET min/max (they reflect both ways)', () => {
    const el = new UISplitPaneElement()
    document.body.append(el)
    el.setAttribute('min', '10rem')
    expect(el.min).toBe('10rem')
    el.remove()
  })
})

describe('UISplitPaneElement — typed literal unions (compile-time)', () => {
  it('collapsible is boolean, initial is number|null, min/max are strings', () => {
    const fn = (): void => {
      const el = new UISplitPaneElement()
      el.initial = 0.5
      el.initial = null
      el.min = '10px'
      el.max = '20%'
      el.collapsible = true
      // @ts-expect-error — collapsible is boolean, not string
      el.collapsible = 'yes'
      // @ts-expect-error — initial is number|null, not a string
      el.initial = '0.5'
    }
    expect(typeof fn).toBe('function')
  })
})

describe('UISplitPaneElement — structural: no ARIA, host-as-block content model', () => {
  it('exposes NO role — a generic content region (the ui-row precedent)', () => {
    const el = new ProbePane()
    document.body.append(el)
    expect(el.probeInternals.role).toBeNull()
    expect(el.getAttribute('role')).toBeNull()
    expect([...el.attributes].some((a) => a.name.startsWith('aria-'))).toBe(false)
    el.remove()
  })

  it('render() is void — the author\'s light-DOM children are never clobbered', () => {
    const el = new UISplitPaneElement()
    el.innerHTML = '<span>content</span>'
    document.body.append(el)
    expect(el.childElementCount).toBe(1)
    expect(el.textContent).toBe('content')
    el.remove()
  })

  it('self-defines as ui-split-pane, guarded against double-define', () => {
    expect(customElements.get('ui-split-pane')).toBe(UISplitPaneElement)
    expect(() => {
      if (!customElements.get('ui-split-pane')) customElements.define('ui-split-pane', UISplitPaneElement)
    }).not.toThrow()
  })
})

describe('UISplitPaneElement — zero residue across connect/disconnect', () => {
  it('connect→disconnect→reconnect leaves children intact and reflected values tracking', () => {
    const el = new ProbePane()
    el.innerHTML = '<span>x</span>'
    document.body.append(el)
    el.remove()
    el.min = '5rem'
    document.body.append(el)
    expect(el.getAttribute('min')).toBe('5rem')
    expect(el.childElementCount).toBe(1)
    el.remove()
  })
})
