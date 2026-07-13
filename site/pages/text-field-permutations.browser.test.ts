import { describe, it, expect } from 'vitest'

// text-field-permutations.browser.test.ts — the whole-shape overflow proof for the type-variants matrix
// (TKT-0037). The old construction (all heads, then all cells, on a fixed `repeat(types.length, …)` template)
// rendered a single non-wrapping 12-column row (≥132rem minimum) that clipped on every real viewport, with the
// 11rem track minimum sitting below ui-text-field's 20ch min-inline-size floor (ADR-0021) so specimens overflowed
// into the neighbors' captions. jsdom cannot catch either defect (no layout), so this proof is browser-only —
// the [[test-the-whole-shape]] law: assert the rendered geometry, not the DOM counts alone.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import './text-field-permutations.ts' // mounts itself (mountPage's fallback — no #app in this test document)

const content = document.querySelector('[data-page-content]') as HTMLElement
const typeMatrix = content?.querySelector('.matrix--type-cards') as HTMLElement

describe('text-field-permutations — the type matrix wraps instead of overflowing (TKT-0037)', () => {
  it('mounted, and the type matrix renders one self-contained card per parsed type', () => {
    expect(typeMatrix).not.toBeNull()
    const cards = typeMatrix.querySelectorAll('.type-card')
    expect(cards.length).toBeGreaterThanOrEqual(12) // the parsed `type` enum (anti-vacuous floor, grows with the enum)
    // each card binds head + specimen + caption together — the binding a wrap must never split
    for (const card of cards) {
      expect(card.querySelector('.matrix-head'), 'card missing its `type = X` head').not.toBeNull()
      expect(card.querySelector('ui-text-field'), 'card missing its specimen').not.toBeNull()
      expect(card.querySelector('.geo-label'), 'card missing its caption').not.toBeNull()
    }
  })

  it('never overflows horizontally — the grid wraps to the columns that fit', () => {
    // the whole-shape gate: the matrix (and the page content around it) must not scroll horizontally
    expect(typeMatrix.scrollWidth, 'the type matrix overflows its own box').toBeLessThanOrEqual(typeMatrix.clientWidth)
    expect(
      document.documentElement.scrollWidth,
      'the page scrolls horizontally — the pre-TKT-0037 clipped-row defect',
    ).toBeLessThanOrEqual(document.documentElement.clientWidth)
  })

  it('a specimen never overflows its card into a neighbor (the 20ch-floor vs track-minimum collision)', () => {
    for (const card of typeMatrix.querySelectorAll<HTMLElement>('.type-card')) {
      const cardBox = card.getBoundingClientRect()
      const field = card.querySelector('ui-text-field') as HTMLElement
      const fieldBox = field.getBoundingClientRect()
      expect(fieldBox.width, 'specimen collapsed to nothing').toBeGreaterThan(0)
      // half-pixel tolerance for engine rounding
      expect(fieldBox.right, `specimen bleeds out of its card (${card.querySelector('.matrix-head')?.textContent})`).toBeLessThanOrEqual(cardBox.right + 0.5)
      expect(fieldBox.left).toBeGreaterThanOrEqual(cardBox.left - 0.5)
    }
  })
})
