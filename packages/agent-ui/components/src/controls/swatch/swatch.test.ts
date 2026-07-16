import { describe, it, expect, afterEach } from 'vitest'
import { UISwatchElement } from './swatch.ts'

// swatch.test.ts — jsdom behaviour probes (LLD-C2, token-surfaces.lld.md §3.1; SPEC-R1…R4). jsdom is blind to
// real color resolution (SPEC-N2) — the getComputedStyle/scheme-divergence/forced-colors legs are
// swatch.browser.test.ts's job. This file covers: prop typing/defaults, ARIA via internals (role=img, the
// composed name in every case), DOM shape (box + value nodes, mutate-in-place across changes), degenerate
// input handling, and zero residue across connect/disconnect.

// A throwaway subclass re-exposing the protected `internals` (the icon.test.ts / bar-chart.test.ts precedent).
class ProbeSwatch extends UISwatchElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-swatch-probe', ProbeSwatch)

const mounted: HTMLElement[] = []
function mount(el: HTMLElement): HTMLElement {
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

describe('UISwatchElement — upgrade + typed props', () => {
  it('upgrades to the class; value/label default to "", scheme defaults to "auto"', () => {
    const el = document.createElement('ui-swatch') as UISwatchElement
    expect(el).toBeInstanceOf(UISwatchElement)
    expect(el.color).toBe('')
    expect(el.label).toBe('')
    expect(el.scheme).toBe('auto')
  })

  it('self-defines as ui-swatch, guarded against double-define', () => {
    expect(customElements.get('ui-swatch')).toBe(UISwatchElement)
    expect(() => {
      if (!customElements.get('ui-swatch')) customElements.define('ui-swatch', UISwatchElement)
    }).not.toThrow()
  })

  it('an unknown scheme attribute snaps back to "auto" (enumType hardening)', () => {
    const el = document.createElement('ui-swatch') as UISwatchElement
    el.setAttribute('scheme', 'sepia')
    mount(el)
    expect(el.scheme).toBe('auto')
  })
})

describe('UISwatchElement — role=img via internals (SPEC-R4, ADR-0118 cl.4)', () => {
  it('role=img is set via ElementInternals on connect — NEVER a host role attribute', () => {
    const el = mount(new ProbeSwatch()) as ProbeSwatch
    expect(el.probeInternals.role).toBe('img')
    expect(el.getAttribute('role')).toBeNull()
  })
})

describe('UISwatchElement — the composed accessible name (SPEC-R4)', () => {
  it('label + value: "label, value"', () => {
    const el = new ProbeSwatch()
    el.label = 'primary-500'
    el.color = 'oklch(0.6 0.03 225)'
    mount(el)
    expect(el.probeInternals.ariaLabel).toBe('primary-500, oklch(0.6 0.03 225)')
  })

  it('value only: the value alone', () => {
    const el = new ProbeSwatch()
    el.color = 'oklch(0.6 0.03 225)'
    mount(el)
    expect(el.probeInternals.ariaLabel).toBe('oklch(0.6 0.03 225)')
  })

  it('label only: the label alone', () => {
    const el = new ProbeSwatch()
    el.label = 'primary-500'
    mount(el)
    expect(el.probeInternals.ariaLabel).toBe('primary-500')
  })

  it('neither: "swatch" — never nameless', () => {
    const el = mount(new ProbeSwatch()) as ProbeSwatch
    expect(el.probeInternals.ariaLabel).toBe('swatch')
    expect(el.hasAttribute('aria-hidden')).toBe(false)
  })

  it('the composed name is reactive: set → clear → set again', async () => {
    const el = mount(new ProbeSwatch()) as ProbeSwatch
    expect(el.probeInternals.ariaLabel).toBe('swatch')

    el.label = 'primary-500'
    el.color = '#336699'
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBe('primary-500, #336699')

    el.label = ''
    el.color = ''
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBe('swatch')
  })
})

describe('UISwatchElement — DOM shape (box + value, mutate in place)', () => {
  it('builds exactly [data-part=box] + [data-part=value] once', () => {
    const el = new UISwatchElement()
    el.color = '#336699'
    el.label = 'primary-500'
    mount(el)
    expect(el.children).toHaveLength(2)
    expect(el.querySelector('[data-part="box"]')).not.toBeNull()
    expect(el.querySelector('[data-part="value"]')).not.toBeNull()
  })

  it('the value node text content IS the composed name (SPEC-R2: real DOM text)', () => {
    const el = new UISwatchElement()
    el.color = '#336699'
    el.label = 'primary-500'
    mount(el)
    expect(el.querySelector('[data-part="value"]')?.textContent).toBe('primary-500, #336699')
  })

  it('a literal value routes verbatim to box.style.background', () => {
    const el = new UISwatchElement()
    el.color = 'rgb(1, 2, 3)'
    mount(el)
    const box = el.querySelector('[data-part="box"]') as HTMLElement
    expect(box.style.background).toBe('rgb(1, 2, 3)')
  })

  it('a --var value routes through var() into box.style.background (SPEC-R2, the LLD-C1 cssValue transform)', () => {
    const el = new UISwatchElement()
    el.color = '--md-sys-color-primary-container'
    mount(el)
    const box = el.querySelector('[data-part="box"]') as HTMLElement
    expect(box.style.background).toBe('var(--md-sys-color-primary-container)')
  })

  it('scheme sets box.style.colorScheme; "auto" clears it', async () => {
    const el = new UISwatchElement()
    el.scheme = 'dark'
    mount(el)
    const box = el.querySelector('[data-part="box"]') as HTMLElement
    expect(box.style.colorScheme).toBe('dark')

    el.scheme = 'auto'
    await el.updateComplete
    expect(box.style.colorScheme).toBe('')
  })

  it('re-mutates the SAME box/value nodes across changes (no replaceChildren churn)', async () => {
    const el = new UISwatchElement()
    mount(el)
    const boxBefore = el.querySelector('[data-part="box"]')
    const valueBefore = el.querySelector('[data-part="value"]')

    el.color = '#abcdef'
    await el.updateComplete

    expect(el.querySelector('[data-part="box"]')).toBe(boxBefore)
    expect(el.querySelector('[data-part="value"]')).toBe(valueBefore)
    expect(el.children).toHaveLength(2)
  })
})

describe('UISwatchElement — degenerate value (SPEC-R3)', () => {
  it('empty value never throws; box stays present (border-only, transparent honesty)', () => {
    const el = new UISwatchElement()
    expect(() => mount(el)).not.toThrow()
    const box = el.querySelector('[data-part="box"]') as HTMLElement
    expect(box).not.toBeNull()
    expect(box.style.background).toBe('')
  })

  it('an invalid color string never throws (jsdom drops the bad declaration, same as a real browser)', () => {
    const el = new UISwatchElement()
    expect(() => {
      el.color = 'not-a-real-color'
      mount(el)
    }).not.toThrow()
  })
})

describe('UISwatchElement — zero residue across connect/disconnect', () => {
  it('effects die on disconnect; reconnect re-installs exactly once (not stacked)', async () => {
    const el = mount(new ProbeSwatch()) as ProbeSwatch
    el.color = '#111'
    el.label = 'a'
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBe('a, #111')

    el.remove() // disconnect → the connection scope is disposed → the effect dies with it
    el.color = '#222' // mutate WHILE disconnected
    el.label = 'b'
    await el.updateComplete // give any leaked effect a chance to flush

    document.body.append(el) // reconnect → connected() re-runs → exactly one fresh effect installs
    expect(el.probeInternals.role).toBe('img')
    expect(el.probeInternals.ariaLabel).toBe('b, #222')
    expect(el.children).toHaveLength(2) // no duplicate box/value nodes from a second build
    el.remove()
  })
})
