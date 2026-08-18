import { describe, it, expect } from 'vitest'
import { UIStatElement } from './stat.ts'

// stat.test.ts — LLD-C5 jsdom behaviour probes (props/attributes, DOM shape, no-heading, delta
// word/glyph). jsdom is blind to painted geometry and computed-style ink (SPEC-N2) — the whole-shape
// floor, the color-invariant delta diff, and forced-colors legs live in stat.browser.test.ts; this file
// covers everything jsdom CAN see: prop typing, attribute coercion, and the DOM structure the render
// effect builds.

describe('UIStatElement — upgrade + typed props', () => {
  it('defaults: label="", figure="", delta=null, caption="", variant="tile", percent=null', () => {
    const el = document.createElement('ui-stat') as UIStatElement
    expect(el).toBeInstanceOf(UIStatElement)
    expect(el.label).toBe('')
    expect(el.figure).toBe('')
    expect(el.delta).toBeNull()
    expect(el.caption).toBe('')
    expect(el.variant).toBe('tile')
    expect(el.percent).toBeNull()
  })

  it('self-defines as ui-stat, guarded against double-define', () => {
    expect(customElements.get('ui-stat')).toBe(UIStatElement)
    expect(() => {
      if (!customElements.get('ui-stat')) customElements.define('ui-stat', UIStatElement)
    }).not.toThrow()
  })

  it('a numeric value="48200" attribute upgrades to the typed NUMBER (so it formats)', () => {
    const el = document.createElement('ui-stat') as UIStatElement
    el.setAttribute('figure', '48200')
    document.body.append(el)
    expect(el.figure).toBe(48200)
    el.remove()
  })

  it('a pre-formatted value="$1.2M" attribute stays the verbatim STRING (author-controlled formatting)', () => {
    const el = document.createElement('ui-stat') as UIStatElement
    el.setAttribute('figure', '$1.2M')
    document.body.append(el)
    expect(el.figure).toBe('$1.2M')
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
    el.figure = 48200
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
    el.figure = 48200
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
    el.figure = Number.NaN
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
    el.figure = '99.98%'
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
    el.figure = 1
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
    el.figure = 100
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
    el.figure = 100
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
    el.figure = 100
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
    el.figure = 100
    el.delta = 12
    document.body.append(el)
    await el.updateComplete
    const region = el.querySelector('[data-part="delta"]') as HTMLElement
    // the word span's text is immediately followed by the plain "+12" text node
    expect(region.textContent).toBe('up +12')
    el.remove()
  })
})

describe('UIStatElement — variant="ring" (GH#1208)', () => {
  it('default variant="tile" never renders a ring part, even with percent set', async () => {
    const el = document.createElement('ui-stat') as UIStatElement
    el.label = 'Storage'
    el.figure = '72%'
    el.percent = 72
    document.body.append(el)
    await el.updateComplete
    expect(el.querySelector('[data-part="ring"]')).toBeNull()
    el.remove()
  })

  it('variant="ring" inserts an aria-hidden ring part immediately before value — reading order unchanged', async () => {
    const el = document.createElement('ui-stat') as UIStatElement
    el.label = 'Storage'
    el.variant = 'ring'
    el.figure = '72%'
    el.percent = 72
    document.body.append(el)
    await el.updateComplete

    const parts = [...el.children].map((c) => c.getAttribute('data-part'))
    expect(parts).toEqual(['label', 'ring', 'value'])
    const ring = el.querySelector('[data-part="ring"]') as HTMLElement
    expect(ring.getAttribute('aria-hidden')).toBe('true')
    expect(ring.textContent).toBe('') // purely decorative — no text of its own (SPEC-R7's law, applied)
    expect(el.querySelector('[data-part="value"]')?.textContent).toBe('72%')
    el.remove()
  })

  it('an unrecognized variant attribute snaps back to "tile" (enum codec, the sparkline/badge precedent)', async () => {
    const el = document.createElement('ui-stat') as UIStatElement
    el.setAttribute('variant', 'bogus')
    document.body.append(el)
    await el.updateComplete
    expect(el.variant).toBe('tile')
    expect(el.querySelector('[data-part="ring"]')).toBeNull()
    el.remove()
  })

  it('percent sets --_ring-pct on the ring node, clamped into [0,100] (attribute-boundary codec)', async () => {
    const el = document.createElement('ui-stat') as UIStatElement
    el.variant = 'ring'
    el.setAttribute('percent', '140')
    document.body.append(el)
    await el.updateComplete
    expect(el.percent).toBe(100) // clamped at the attribute boundary (statPercentProp)
    const ring = el.querySelector('[data-part="ring"]') as HTMLElement
    expect(ring.style.getPropertyValue('--_ring-pct')).toBe('100')
    el.remove()
  })

  it('a raw PROPERTY write out of range still clamps at render (ringPercent render-boundary guard)', async () => {
    const el = document.createElement('ui-stat') as UIStatElement
    el.variant = 'ring'
    document.body.append(el)
    el.percent = -30 // bypasses statPercentProp's `from` codec entirely (property write, not attribute)
    await el.updateComplete
    const ring = el.querySelector('[data-part="ring"]') as HTMLElement
    expect(ring.style.getPropertyValue('--_ring-pct')).toBe('0')
    el.remove()
  })

  it('percent absent/non-finite renders an empty (0%) track, never a thrown error', async () => {
    const el = document.createElement('ui-stat') as UIStatElement
    el.variant = 'ring'
    expect(() => document.body.append(el)).not.toThrow()
    el.percent = Number.NaN
    expect(() => undefined).not.toThrow()
    await el.updateComplete
    const ring = el.querySelector('[data-part="ring"]') as HTMLElement
    expect(ring.style.getPropertyValue('--_ring-pct')).toBe('0')
    el.remove()
  })
})
