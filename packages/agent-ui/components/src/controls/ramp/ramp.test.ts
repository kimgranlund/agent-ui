import { describe, it, expect, afterEach } from 'vitest'
import { UIRampElement } from './ramp.ts'

// ramp.test.ts — jsdom behaviour probes (LLD-C4, token-surfaces.lld.md §3.2; SPEC-R5…R8). jsdom is blind to
// painted geometry AND real color resolution (SPEC-N2) — the wrap/order/forced-colors legs are
// ramp.browser.test.ts's job. This file covers: prop typing/defaults, ARIA via internals (role=list, label),
// DOM shape (cell/listitem count, aria-hidden box, printed step-label/value text), degenerate steps handling,
// and zero residue across connect/disconnect.

class ProbeRamp extends UIRampElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-ramp-probe', ProbeRamp)

const mounted: HTMLElement[] = []
function mount(el: HTMLElement): HTMLElement {
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

describe('UIRampElement — upgrade + typed props', () => {
  it('upgrades to the class; steps defaults to [], label/scheme default to empty/auto', () => {
    const el = document.createElement('ui-ramp') as UIRampElement
    expect(el).toBeInstanceOf(UIRampElement)
    expect(el.steps).toEqual([])
    expect(el.label).toBe('')
    expect(el.scheme).toBe('auto')
  })

  it('self-defines as ui-ramp, guarded against double-define', () => {
    expect(customElements.get('ui-ramp')).toBe(UIRampElement)
    expect(() => {
      if (!customElements.get('ui-ramp')) customElements.define('ui-ramp', UIRampElement)
    }).not.toThrow()
  })

  it('a JSON `steps` attribute parses to the typed array on connect', () => {
    const el = document.createElement('ui-ramp') as UIRampElement
    el.setAttribute('steps', '[{"label":"100","value":"#eef"},{"label":"900","value":"#003"}]')
    mount(el)
    expect(el.steps).toEqual([
      { label: '100', value: '#eef' },
      { label: '900', value: '#003' },
    ])
  })

  it('malformed `steps` attribute JSON never throws — falls back to [] (SPEC-R7)', () => {
    const el = document.createElement('ui-ramp') as UIRampElement
    expect(() => el.setAttribute('steps', '{not json')).not.toThrow()
    mount(el)
    expect(el.steps).toEqual([])
  })
})

describe('UIRampElement — list semantics via internals (SPEC-R8)', () => {
  it('role=list is set via ElementInternals on connect — NEVER a host role attribute', () => {
    const el = mount(new ProbeRamp()) as ProbeRamp
    expect(el.probeInternals.role).toBe('list')
    expect(el.getAttribute('role')).toBeNull()
  })

  it('an empty `label` leaves the list unlabeled (legal — SPEC-R8 AC2), still role=list, never aria-hidden', () => {
    const el = mount(new ProbeRamp()) as ProbeRamp
    expect(el.probeInternals.ariaLabel).toBeNull()
    expect(el.probeInternals.role).toBe('list')
    expect(el.hasAttribute('aria-hidden')).toBe(false)
  })

  it('a non-empty `label` names the list via internals.ariaLabel — never a host aria-label attribute', () => {
    const el = new ProbeRamp()
    el.label = 'Primary tonal range'
    mount(el)
    expect(el.probeInternals.ariaLabel).toBe('Primary tonal range')
    expect(el.hasAttribute('aria-label')).toBe(false)
  })
})

describe('UIRampElement — strip rendering (SPEC-R6/R8)', () => {
  it('one role=listitem per valid step, in order', () => {
    const el = new UIRampElement()
    el.steps = [
      { label: '100', value: '#eef' },
      { label: '900', value: '#003' },
    ]
    mount(el)
    const items = el.querySelectorAll('[role="listitem"]')
    expect(items).toHaveLength(2)
    expect(items[0].querySelector('[data-part="step-label"]')?.textContent).toBe('100')
    expect(items[1].querySelector('[data-part="step-label"]')?.textContent).toBe('900')
  })

  it("the listitem's combined text content is exactly `{label}{value}` (SPEC-R8 AC1, the ui-bar-chart precedent)", () => {
    const el = new UIRampElement()
    el.steps = [{ label: '500', value: '#336699' }]
    mount(el)
    const item = el.querySelector('[role="listitem"]') as HTMLElement
    expect(item.textContent).toBe('500#336699')
  })

  it('the box is aria-hidden and text-free (SPEC-R8 AC2, ADR-0118 cl.4) — color carries no announcement', () => {
    const el = new UIRampElement()
    el.steps = [{ label: 'a', value: '#111' }]
    mount(el)
    const box = el.querySelector('[data-part="box"]') as HTMLElement
    expect(box.getAttribute('aria-hidden')).toBe('true')
    expect(box.textContent).toBe('')
  })

  it('a literal step value routes verbatim to box.style.background', () => {
    const el = new UIRampElement()
    el.steps = [{ label: 'a', value: 'rgb(1, 2, 3)' }]
    mount(el)
    const box = el.querySelector('[data-part="box"]') as HTMLElement
    expect(box.style.background).toBe('rgb(1, 2, 3)')
  })

  it('a --var step value routes through var() (SPEC-R2, LLD-C1 cssValue)', () => {
    const el = new UIRampElement()
    el.steps = [{ label: 'a', value: '--md-sys-color-primary-500' }]
    mount(el)
    const box = el.querySelector('[data-part="box"]') as HTMLElement
    expect(box.style.background).toBe('var(--md-sys-color-primary-500)')
  })

  it('scheme pins every cell box.style.colorScheme (the whole strip shares it)', () => {
    const el = new UIRampElement()
    el.scheme = 'dark'
    el.steps = [
      { label: 'a', value: '#111' },
      { label: 'b', value: '#222' },
    ]
    mount(el)
    const boxes = [...el.querySelectorAll('[data-part="box"]')] as HTMLElement[]
    expect(boxes.map((b) => b.style.colorScheme)).toEqual(['dark', 'dark'])
  })

  it('changing `steps` re-renders reactively (whole-array swap, no incremental patch)', async () => {
    const el = new UIRampElement()
    el.steps = [{ label: 'a', value: '#111' }]
    mount(el)
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(1)

    el.steps = [
      { label: 'x', value: '#1' },
      { label: 'y', value: '#2' },
      { label: 'z', value: '#3' },
    ]
    await el.updateComplete
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(3)
  })
})

describe('UIRampElement — degenerate steps (SPEC-R7)', () => {
  it('empty steps → zero cells; host remains role=list (the honest empty state, SPEC-R8 AC2)', () => {
    const el = mount(new ProbeRamp()) as ProbeRamp
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(0)
    expect(el.probeInternals.role).toBe('list')
  })

  it('a property write of mixed garbage never reaches the render path (SPEC-R7 property-write guard)', () => {
    const el = new UIRampElement()
    // @ts-expect-error — deliberately garbage at the property boundary, exactly what cleanEntries must guard
    el.steps = [{ label: 'ok', value: '#1' }, { label: 'bad' }, null, { label: 'x', value: 42 }, { label: 'ok2', value: '#2' }]
    mount(el)
    const labels = [...el.querySelectorAll('[data-part="step-label"]')].map((n) => n.textContent)
    expect(labels).toEqual(['ok', 'ok2'])
  })

  it('a non-array property write (e.g. null) never throws and renders zero cells', () => {
    const el = new UIRampElement()
    // @ts-expect-error — a non-array write, the codec's inbound counterpart (property path, not attribute)
    expect(() => (el.steps = null)).not.toThrow()
    mount(el)
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(0)
  })

  it('duplicate labels render as separate cells (positional, not keyed)', () => {
    const el = new UIRampElement()
    el.steps = [
      { label: 'dup', value: '#111' },
      { label: 'dup', value: '#222' },
    ]
    mount(el)
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(2)
  })
})

describe('UIRampElement — zero residue across connect/disconnect', () => {
  it('effects die on disconnect; reconnect re-installs exactly once (not stacked)', async () => {
    const el = mount(new ProbeRamp()) as ProbeRamp
    el.steps = [{ label: 'a', value: '#1' }]
    await el.updateComplete
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(1)

    el.remove()
    el.steps = [{ label: 'a', value: '#1' }, { label: 'b', value: '#2' }]
    el.label = 'Later'
    await el.updateComplete

    document.body.append(el)
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(2)
    expect(el.probeInternals.role).toBe('list')
    expect(el.probeInternals.ariaLabel).toBe('Later')
    el.remove()
  })
})
