// a2a-concepts.browser.test.ts — the WHOLE-SHAPE cross-engine smoke for the A2A concepts/demos page
// (corpus LLD-C11, SPEC-R15 AC1). jsdom (../lib/a2a-concepts.test.ts) proves the derivation is correct
// (card count/text/verdicts); this proves the PAGE actually mounts and renders real geometry — both
// Chromium and WebKit (vitest.browser.config.ts's `site` project).
import { describe, it, expect } from 'vitest'
// Side-effect import: builds the whole page into #app (mountPage), same precedent as
// a2a-tic-tac-toe.browser.test.ts / a2ui-catalog.browser.test.ts.
import './a2a-concepts.ts'

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('the A2A concepts/demos page — real render, both sections, every card clean (both engines)', () => {
  it('mounts with no parse-failure panel and at least 13 cards rendered', async () => {
    await raf()
    expect(document.querySelector('[data-error]')).toBeNull()
    const cards = [...document.querySelectorAll<HTMLElement>('.concept-card')]
    expect(cards.length).toBeGreaterThanOrEqual(13)
  })

  it('every rendered card carries a clean in-page verdict (data-validated="true")', async () => {
    await raf()
    const cards = [...document.querySelectorAll<HTMLElement>('.concept-card')]
    const dirty = cards.filter((c) => c.dataset.validated !== 'true')
    expect(dirty.map((c) => c.dataset.record), 'one or more cards failed their in-page verdict').toEqual([])
  })

  it('both the Concepts and Demos section grids rendered with real, non-zero card boxes', async () => {
    await raf()
    const conceptsGrid = document.querySelector<HTMLElement>('.concepts-grid[data-section="concepts"]')
    const demosGrid = document.querySelector<HTMLElement>('.concepts-grid[data-section="demos"]')
    expect(conceptsGrid, 'no Concepts grid found').not.toBeNull()
    expect(demosGrid, 'no Demos grid found').not.toBeNull()
    expect(getComputedStyle(conceptsGrid!).display).toBe('grid')

    const firstCard = conceptsGrid!.querySelector<HTMLElement>('.concept-card')
    expect(firstCard, 'no card rendered inside the Concepts grid').not.toBeNull()
    const rect = firstCard!.getBoundingClientRect()
    expect(rect.width).toBeGreaterThan(0)
    expect(rect.height).toBeGreaterThan(0)
  })

  // The cap (`max-block-size`) bounds the CONTENT box (content-box is the fleet's box model here — no
  // border-box reset on either pane), so the true rendered-height ceiling is the cap PLUS that element's
  // own padding + border — read off its OWN computed style rather than assumed, so this doesn't hard-code a
  // box model the CSS could legitimately change.
  function heightCeiling(el: HTMLElement): number {
    const cs = getComputedStyle(el)
    const box = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'] as const
    const extra = box.reduce((sum, prop) => sum + parseFloat(cs[prop]), 0)
    return parseFloat(cs.maxBlockSize) + extra + 2 // +2px slack (scrollbar-gutter/rounding)
  }

  it('a body/prose pane and a JSON payload pane are both height-capped (never stretch a card unbounded)', async () => {
    await raf()
    const body = document.querySelector<HTMLElement>('.concept-card-body')
    expect(body, 'no card body pane found').not.toBeNull()
    expect(body!.getBoundingClientRect().height).toBeLessThanOrEqual(heightCeiling(body!))

    const payload = document.querySelector<HTMLElement>('.concept-card-artifact-json > .code-block')
    expect(payload, 'no JSON payload pane found').not.toBeNull()
    expect(payload!.getBoundingClientRect().height).toBeLessThanOrEqual(heightCeiling(payload!))
  })

  it('the site nav carries the A2A Concepts & Demos link', async () => {
    await raf()
    const navLink = document.querySelector('[data-site-nav] a[href="./a2a-concepts.html"]')
    expect(navLink, 'nav does not carry a link to a2a-concepts.html').not.toBeNull()
  })
})
