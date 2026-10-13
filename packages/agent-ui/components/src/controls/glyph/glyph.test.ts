import { describe, it, expect } from 'vitest'
import { UIGlyphElement, renderGlyph } from './glyph.ts'
import { GLYPH_MARKS, GLYPH_SYMBOLS, isGlyphSymbol } from './glyph-paths.ts'

// ui-glyph (ADR-0245 clauses 4 and 5): the closed mark set, the path table, the symbol and label effects.

class ProbeGlyph extends UIGlyphElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-glyph-probe', ProbeGlyph)

const mount = (attrs: string): ProbeGlyph => {
  const wrap = document.createElement('div')
  wrap.innerHTML = `<ui-glyph-probe ${attrs}></ui-glyph-probe>`
  document.body.append(wrap)
  return wrap.firstElementChild as ProbeGlyph
}

describe('the closed mark set (ADR-0245 clause 5)', () => {
  it('is exactly the twelve marks, in clause order', () => {
    expect(GLYPH_SYMBOLS).toEqual([
      'check', 'x', 'plus', 'minus', 'caret-up', 'caret-down', 'caret-left', 'caret-right', 'dot', 'more', 'warning', 'info',
    ])
  })

  it('only dot and more are filled; every other mark is a stroke', () => {
    const filled = GLYPH_SYMBOLS.filter((s) => 'filled' in GLYPH_MARKS[s])
    expect(filled).toEqual(['dot', 'more'])
  })

  it('isGlyphSymbol accepts the set and rejects pictorial and inherited names', () => {
    expect(GLYPH_SYMBOLS.every(isGlyphSymbol)).toBe(true)
    for (const name of ['eye', 'calendar-blank', 'toString', '']) expect(isGlyphSymbol(name), name).toBe(false)
  })
})

describe('renderGlyph', () => {
  it('draws a stroke mark as one non-scaling path on a 16-unit square', () => {
    const svg = renderGlyph('caret-down')
    expect(svg.getAttribute('viewBox')).toBe('0 0 16 16')
    expect(svg.getAttribute('fill')).toBe('none')
    expect(svg.getAttribute('stroke')).toBe('currentColor')
    const path = svg.querySelector('path')
    expect(path?.getAttribute('d')).toBe(GLYPH_MARKS['caret-down'].d)
    expect(path?.getAttribute('vector-effect')).toBe('non-scaling-stroke')
  })

  it('fills dot and more', () => {
    const svg = renderGlyph('more')
    expect(svg.getAttribute('fill')).toBe('currentColor')
    expect(svg.getAttribute('stroke')).toBe('none')
  })

  it('renders an empty data-glyph-missing svg for a name outside the set, never a guess', () => {
    const svg = renderGlyph('eye')
    expect(svg.getAttribute('data-glyph-missing')).toBe('eye')
    expect(svg.children.length).toBe(0)
  })
})

describe('UIGlyphElement', () => {
  it('self-defines as ui-glyph; symbol and label default to empty', () => {
    expect(customElements.get('ui-glyph')).toBe(UIGlyphElement)
    const el = document.createElement('ui-glyph') as UIGlyphElement
    expect(el.symbol).toBe('')
    expect(el.label).toBe('')
  })

  it('draws the mark for its symbol and redraws on change; empty clears the host', async () => {
    const el = mount('symbol="check"')
    await el.updateComplete
    expect(el.querySelector('path')?.getAttribute('d')).toBe(GLYPH_MARKS.check.d)
    el.symbol = 'x'
    await el.updateComplete
    expect(el.querySelectorAll('svg')).toHaveLength(1)
    expect(el.querySelector('path')?.getAttribute('d')).toBe(GLYPH_MARKS.x.d)
    el.symbol = ''
    await el.updateComplete
    expect(el.childNodes).toHaveLength(0)
    el.parentElement?.remove()
  })

  it('is decorative by default and meaningful with a label (ElementInternals, no host aria attribute)', async () => {
    const el = mount('symbol="warning"')
    await el.updateComplete
    expect(el.probeInternals.ariaHidden).toBe('true')
    expect(el.probeInternals.role).toBe(null)
    el.label = 'Warning'
    await el.updateComplete
    expect(el.probeInternals.role).toBe('img')
    expect(el.probeInternals.ariaLabel).toBe('Warning')
    expect(el.probeInternals.ariaHidden).toBe(null)
    expect(el.hasAttribute('aria-label')).toBe(false)
    el.parentElement?.remove()
  })
})
