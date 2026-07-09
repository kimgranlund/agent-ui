import { describe, it, expect } from 'vitest'
import { UIStatElement } from './stat.ts'

// stat.test.ts — LLD-C5 jsdom behaviour probes (props/attributes, DOM shape, no-heading, delta
// word/glyph). jsdom is blind to painted geometry and computed-style ink (SPEC-N2) — the whole-shape
// floor, the color-invariant delta diff, and forced-colors legs live in stat.browser.test.ts; this file
// covers everything jsdom CAN see: prop typing, attribute coercion, and the DOM structure the render
// effect builds.

describe('UIStatElement — upgrade + typed props', () => {
  it('defaults: label="", value="", delta=null, caption=""', () => {
    const el = document.createElement('ui-stat') as UIStatElement
    expect(el).toBeInstanceOf(UIStatElement)
    expect(el.label).toBe('')
    expect(el.value).toBe('')
    expect(el.delta).toBeNull()
    expect(el.caption).toBe('')
  })

  it('self-defines as ui-stat, guarded against double-define', () => {
    expect(customElements.get('ui-stat')).toBe(UIStatElement)
    expect(() => {
      if (!customElements.get('ui-stat')) customElements.define('ui-stat', UIStatElement)
    }).not.toThrow()
  })

  it('a numeric value="48200" attribute upgrades to the typed NUMBER (so it formats)', () => {
    const el = document.createElement('ui-stat') as UIStatElement
    el.setAttribute('value', '48200')
    document.body.append(el)
    expect(el.value).toBe(48200)
    el.remove()
  })

  it('a pre-formatted value="$1.2M" attribute stays the verbatim STRING (author-controlled formatting)', () => {
    const el = document.createElement('ui-stat') as UIStatElement
    el.setAttribute('value', '$1.2M')
    document.body.append(el)
    expect(el.value).toBe('$1.2M')
    el.remove()
  })

  it('a delta="12" attribute upgrades to the typed number', () => {
    const el = document.createElement('ui-stat') as UIStatElement
    el.setAttribute('delta', '12')
    document.body.append(el)
    expect(el.delta).toBe(12)
    el.remove()
  })
})

describe('UIStatElement — no heading stamp (SPEC-R8 AC1)', () => {
  it('a fully-populated stat contains zero heading elements', () => {
    const el = document.createElement('ui-stat') as UIStatElement
    el.label = 'Revenue'
    el.value = 48200
    el.delta = 12
    el.caption = 'vs last month'
    document.body.append(el)
    expect(el.querySelector('h1,h2,h3,h4,h5,h6')).toBeNull()
    el.remove()
  })
})

describe('UIStatElement — tile DOM shape (SPEC-R7 AC1/AC3, SPEC-R8, LLD-C5)', () => {
  it('the ADR-0111 cl.2 example renders all four parts, value Intl-formatted, reading order intact', async () => {
    const el = document.createElement('ui-stat') as UIStatElement
    el.label = 'Revenue'
    el.value = 48200
    el.delta = 12
    el.caption = 'vs last month'
    document.body.append(el)
    await el.updateComplete

    const parts = [...el.children].map((c) => c.getAttribute('data-part'))
    expect(parts).toEqual(['label', 'value', 'delta', 'caption']) // reading order = DOM order (SPEC-R8)
    expect(el.querySelector('[data-part="label"]')?.textContent).toBe('Revenue')
    expect(el.querySelector('[data-part="value"]')?.textContent).toBe('48,200')
    expect(el.querySelector('[data-part="caption"]')?.textContent).toBe('vs last month')
    el.remove()
  })

  it('value=NaN renders the placeholder, delta=NaN renders no delta region, no exception escapes (AC3)', async () => {
    const el = document.createElement('ui-stat') as UIStatElement
    el.value = Number.NaN
    el.delta = Number.NaN
    expect(() => document.body.append(el)).not.toThrow()
    await el.updateComplete
    expect(el.querySelector('[data-part="value"]')?.textContent).toBe('—')
    expect(el.querySelector('[data-part="delta"]')).toBeNull()
    el.remove()
  })

  it('absent delta ⇒ no delta region; absent/empty caption ⇒ no caption part', async () => {
    const el = document.createElement('ui-stat') as UIStatElement
    el.label = 'Uptime'
    el.value = '99.98%'
    document.body.append(el)
    await el.updateComplete
    expect(el.querySelector('[data-part="delta"]')).toBeNull()
    expect(el.querySelector('[data-part="caption"]')).toBeNull()
    expect(el.querySelector('[data-part="value"]')?.textContent).toBe('99.98%') // verbatim passthrough
    el.remove()
  })

  it('whole-swap rebuild: only tbody-equivalent children exist after any prop change (no leftover nodes)', async () => {
    const el = document.createElement('ui-stat') as UIStatElement
    el.label = 'A'
    el.value = 1
    document.body.append(el)
    await el.updateComplete
    expect(el.childElementCount).toBe(2) // label + value only

    el.delta = 5
    el.caption = 'note'
    await el.updateComplete
    expect(el.childElementCount).toBe(4) // label + value + delta + caption

    el.delta = null
    await el.updateComplete
    expect(el.childElementCount).toBe(3) // label + value + caption — the delta region is gone, not hidden
    el.remove()
  })
})

describe('UIStatElement — delta direction as text (SPEC-R9 AC1)', () => {
  it('delta=12 ⇒ dir/word="up", glyph present + aria-hidden + text-free, signed text "+12"', async () => {
    const el = document.createElement('ui-stat') as UIStatElement
    el.label = 'Revenue'
    el.value = 100
    el.delta = 12
    document.body.append(el)
    await el.updateComplete

    const region = el.querySelector('[data-part="delta"]') as HTMLElement
    expect(region.getAttribute('data-dir')).toBe('up')
    expect(region.textContent).toContain('up')
    expect(region.textContent).toContain('+12')

    const glyph = region.querySelector('[data-part="delta-glyph"]') as HTMLElement
    expect(glyph).not.toBeNull()
    expect(glyph.getAttribute('aria-hidden')).toBe('true')
    expect(glyph.textContent).toBe('') // aria-hidden AND text-free (SPEC-R9 AC1)
    el.remove()
  })

  it('delta=-3 ⇒ dir/word="down", signed text "-3"', async () => {
    const el = document.createElement('ui-stat') as UIStatElement
    el.value = 100
    el.delta = -3
    document.body.append(el)
    await el.updateComplete

    const region = el.querySelector('[data-part="delta"]') as HTMLElement
    expect(region.getAttribute('data-dir')).toBe('down')
    expect(region.textContent).toContain('down')
    expect(region.textContent).toContain('-3')
    expect(region.querySelector('[data-part="delta-glyph"]')).not.toBeNull()
    el.remove()
  })

  it('delta=0 ⇒ dir="flat", word="unchanged", bare "0", and NO glyph node', async () => {
    const el = document.createElement('ui-stat') as UIStatElement
    el.value = 100
    el.delta = 0
    document.body.append(el)
    await el.updateComplete

    const region = el.querySelector('[data-part="delta"]') as HTMLElement
    expect(region.getAttribute('data-dir')).toBe('flat')
    expect(region.textContent).toContain('unchanged')
    expect(region.textContent).toContain('0')
    expect(region.querySelector('[data-part="delta-glyph"]')).toBeNull() // no arrow for "unchanged"
    el.remove()
  })

  it('the direction word precedes the signed number in DOM order (real, announced text)', async () => {
    const el = document.createElement('ui-stat') as UIStatElement
    el.value = 100
    el.delta = 12
    document.body.append(el)
    await el.updateComplete
    const region = el.querySelector('[data-part="delta"]') as HTMLElement
    // the word span's text is immediately followed by the plain "+12" text node
    expect(region.textContent).toBe('up +12')
    el.remove()
  })
})
