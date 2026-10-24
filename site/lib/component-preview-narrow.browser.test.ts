import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { page } from 'vitest/browser'

// component-preview-narrow.browser.test.ts: two <component-preview> follow-ups of the T-0432 audit (T-0433).
// (1) At a 400px viewport the card stacks its artboard over its code view, so the code panel sits inside the card
// instead of being pushed past its edge and clipped by the card's `overflow: hidden`. (2) The A2UI OptionDeck's
// allowRandom knob shows the sample's value (on) and drives the payload: switching it off drops Surprise me.
// Its own file because the viewport change would otherwise bleed into sibling tests.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import './component-preview.ts' // registers <component-preview> + the self-defining ui-* controls

// GH #347: REAL-TIMING HEADROOM (rAF settles under host load); class and rationale in vitest.browser.config.ts.
vi.setConfig({ testTimeout: 30_000 })

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

let root: HTMLElement
beforeEach(() => {
  root = document.createElement('div')
  document.body.append(root)
})
afterEach(() => root.remove())
afterAll(async () => {
  await page.viewport(1280, 800)
})

async function mountPreview(mode: string, target: string): Promise<HTMLElement> {
  const preview = document.createElement('component-preview')
  preview.setAttribute('mode', mode)
  preview.setAttribute('target', target)
  root.append(preview)
  await raf()
  await raf()
  return preview
}

describe('component-preview at a 400px viewport: the code panel fits inside the card (T-0433)', () => {
  for (const [mode, target] of [
    ['a2ui', 'OptionDeck'],
    ['a2ui', 'Button'],
    ['component', 'ui-button'],
  ] as const) {
    it(`${mode} ${target}: the code view lays out inside the card, nothing clipped sideways`, async () => {
      await page.viewport(400, 900)
      await raf()
      const preview = await mountPreview(mode, target)
      const card = preview.querySelector<HTMLElement>('.preview')!
      const code = preview.querySelector<HTMLElement>('.preview-code')!
      const stage = preview.querySelector<HTMLElement>('.preview-canvas > .canvas-stage')!
      const c = card.getBoundingClientRect()
      const k = code.getBoundingClientRect()
      const s = stage.getBoundingClientRect()
      expect(c.width, 'the card itself is wider than the 400px viewport').toBeLessThanOrEqual(400)
      expect(k.width, 'the code view has no width').toBeGreaterThan(c.width / 2)
      expect(k.height, 'the code view has no height').toBeGreaterThan(100)
      expect(k.left, 'the code view starts left of the card').toBeGreaterThanOrEqual(c.left - 0.5)
      expect(k.right, 'the code view runs past the card edge').toBeLessThanOrEqual(c.right + 0.5)
      expect(k.bottom, 'the code view runs past the card bottom').toBeLessThanOrEqual(c.bottom + 0.5)
      expect(s.right, 'the artboard runs past the card edge').toBeLessThanOrEqual(c.right + 0.5)
      expect(s.height, 'the artboard collapsed').toBeGreaterThan(100)
      expect(card.scrollWidth, 'the card overflows sideways').toBeLessThanOrEqual(card.clientWidth + 1)
    })
  }
})

describe('component-preview a2ui OptionDeck: the allowRandom knob reflects and drives the sample (T-0433)', () => {
  it('the knob starts on, the deck shows Surprise me, and switching it off removes the card', async () => {
    await page.viewport(1280, 800)
    const preview = await mountPreview('a2ui', 'OptionDeck')
    const toggle = preview.querySelector<HTMLElement & { checked: boolean }>('ui-switch[aria-label="allowRandom"]')
    expect(toggle, 'no allowRandom knob').not.toBeNull()
    expect(toggle!.checked, 'the allowRandom knob is off while the sample sets it on').toBe(true)
    const randomCard = (): Element | null => preview.querySelector('.canvas-surface ui-option-deck [data-random]')
    expect(randomCard(), 'the sample deck shows no Surprise me card').not.toBeNull()

    toggle!.click()
    await raf()
    await raf()
    expect(toggle!.checked).toBe(false)
    expect(randomCard(), 'switching allowRandom off left the Surprise me card').toBeNull()
    expect(preview.querySelector('.canvas-surface ui-option-deck'), 'the deck is gone after the knob edit').not.toBeNull()
  })
})

describe('component-preview component mode: a camelCase boolean knob sets the descriptor kebab attribute (T-0437)', () => {
  it('the allowRandom knob adds and removes the ui-option-deck Surprise me card', async () => {
    await page.viewport(1280, 800)
    const preview = await mountPreview('component', 'ui-option-deck')
    const toggle = preview.querySelector<HTMLElement & { checked: boolean }>('ui-switch[aria-label="allowRandom"]')
    expect(toggle, 'no allowRandom knob').not.toBeNull()
    const deck = preview.querySelector<HTMLElement>('.canvas-surface ui-option-deck')
    expect(deck, 'no live deck').not.toBeNull()
    const randomCard = (): Element | null => deck!.querySelector('[data-random]')
    expect(toggle!.checked, 'the allowRandom knob is off while the sample shows Surprise me').toBe(true)
    expect(randomCard(), 'the sample deck shows no Surprise me card').not.toBeNull()

    toggle!.click()
    await raf()
    await raf()
    expect(deck!.hasAttribute('allow-random'), 'the knob left allow-random set').toBe(false)
    expect(randomCard(), 'switching allowRandom off left the Surprise me card').toBeNull()

    toggle!.click()
    await raf()
    await raf()
    expect(deck!.hasAttribute('allow-random'), 'the knob did not set allow-random').toBe(true)
    expect(randomCard(), 'switching allowRandom on added no Surprise me card').not.toBeNull()
  })
})
