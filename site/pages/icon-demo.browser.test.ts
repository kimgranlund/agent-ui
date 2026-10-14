import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-icon specimens into document.body
// (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './icon-demo.ts'

// GH #347 — REAL-TIMING HEADROOM (rAF settles under host load): vitest.browser.config.ts, REAL-TIMING HEADROOM.
vi.setConfig({ testTimeout: 30_000 })

// icon-demo.browser.test.ts — the PAGE-LEVEL proof that the ui-icon demo mounts the REAL Phosphor-backed control in
// its real contexts: every ui-icon resolved to a non-missing <svg>, button adornments carry the slot × data-role
// anatomy, icon-only buttons name themselves via aria-label, and the ambient font-size ramp actually sizes the box.

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('icon-demo — real Phosphor icons in real contexts', () => {
  it('mounts ≥ 3 example sections and every ui-icon resolves to a real (non-missing) svg', async () => {
    await raf()
    expect(document.querySelectorAll('[data-page-content] > section').length).toBeGreaterThanOrEqual(3)
    const icons = [...document.querySelectorAll('[data-page-content] ui-icon')]
    expect(icons.length).toBeGreaterThanOrEqual(15)
    for (const icon of icons) {
      const svg = icon.querySelector('svg')
      expect(svg, `ui-icon[symbol=${icon.getAttribute('symbol')}] has no injected svg`).not.toBeNull()
      expect(svg?.hasAttribute('data-icon-missing'), `glyph ${icon.getAttribute('symbol')} is missing from the pack`).toBe(false)
    }
  })

  it('button adornments use slot=leading|trailing + data-role=icon; icon-only buttons carry aria-label', async () => {
    await raf()
    expect(document.querySelectorAll('[data-page-content] ui-button > ui-icon[slot="leading"][data-role="icon"]').length).toBeGreaterThanOrEqual(3)
    expect(document.querySelectorAll('[data-page-content] ui-button > ui-icon[slot="trailing"][data-role="icon"]').length).toBeGreaterThanOrEqual(2)
    // scoped to [data-page-content]: the site header's own icon-only chips are out of this demo's scope
    const iconOnly = [...document.querySelectorAll('[data-page-content] ui-button[icon-only]')]
    expect(iconOnly.length).toBe(2)
    for (const b of iconOnly) expect(b.getAttribute('aria-label')).toBeTruthy()
  })

  it('the ambient font-size ramp sizes the 1em cell — a 3rem icon is wider than a 1rem icon', async () => {
    await raf()
    const glyphs = [...document.querySelectorAll('ui-icon[symbol="calendar-check"]')] as HTMLElement[]
    const small = glyphs.find((g) => g.style.fontSize === '1rem')
    const large = glyphs.find((g) => g.style.fontSize === '3rem')
    expect(small && large).toBeTruthy()
    // ADR-0245 Amendment 6: a standalone icon outside a data-tier region follows the text, so the ramp sizes it
    // on the plain page: each box is its own font-size, and 3rem is three times 1rem.
    for (const g of [small!, large!]) expect(g.getBoundingClientRect().width).toBeCloseTo(parseFloat(getComputedStyle(g).fontSize), 0)
    expect(large!.getBoundingClientRect().width).toBeCloseTo(small!.getBoundingClientRect().width * 3, 0)
  })

  it('the ramp cards wrap at 400px instead of clipping in a scroller', async () => {
    await raf()
    const card = document.querySelector('ui-icon[symbol="calendar-check"]')!.closest('figure, .demo-figure') as HTMLElement
    const row = card.parentElement as HTMLElement
    const prev = row.style.inlineSize
    row.style.inlineSize = '352px'
    try {
      await raf()
      for (const c of row.children) expect(c.getBoundingClientRect().right).toBeLessThanOrEqual(row.getBoundingClientRect().right + 0.5)
    } finally {
      row.style.inlineSize = prev
    }
  })

  it('meaningful icons carry a label; decorative ones do not', async () => {
    await raf()
    expect(document.querySelectorAll('[data-page-content] ui-icon[label]').length).toBe(4)
    expect(document.querySelector('[data-page-content] ui-icon[symbol="paperclip"]')?.hasAttribute('label')).toBe(false)
  })
})
