// a2ui-gallery.test.ts: jsdom page-level leg for the A2UI composition gallery PAGE (T-0040, ADR-0241). The lib's own
// drift gate (lib/a2ui-gallery.test.ts) warms the catalog itself; this drives the REAL page module (a side-effect import
// into a fresh #app), whose `buildSeedCard` sets each card's `data-rendered` from the live surface's child count
// synchronously after `finalize`. On a COLD default catalog (the lazy record of ADR-0241, first renderer on the page)
// that count is 0, so every card would carry a "rendered an empty surface" defect note; the page's
// `import '../lib/warm-catalog.ts'` keeps the first renderer warm. This file is its own module graph (vitest isolates
// per file), so nothing else warms the catalog before the page does: dropping that import turns this test red, since the
// default is lazy (ADR-0241 Amendment 1; lib/warm-catalog.test.ts is the leg that bites on any tree).
import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(async () => {
  // jsdom reality (the lib gallery test precedent): form-associated controls need the ElementInternals stubs.
  if (typeof ElementInternals.prototype.setFormValue !== 'function') {
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = function (): void {}
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = function (): void {}
  }
  const appRoot = document.createElement('div')
  appRoot.id = 'app'
  document.body.append(appRoot)
  await import('./a2ui-gallery.ts') // mounts on import and builds the whole gallery, like every other /site page
})

describe('the A2UI gallery page: every card painted on the first build', () => {
  it('found real cards (anti-vacuous)', () => {
    expect(document.querySelectorAll('.seed-card').length).toBeGreaterThanOrEqual(10)
  })

  it('no card is flagged unrendered and none carries a defect note', () => {
    const cards = [...document.querySelectorAll<HTMLElement>('.seed-card')]
    expect(cards.filter((card) => card.dataset.rendered !== 'true').map((card) => card.dataset.seed)).toEqual([])
    expect(cards.filter((card) => card.querySelector('.seed-card-defect') !== null).map((card) => card.dataset.seed)).toEqual([])
  })
})
