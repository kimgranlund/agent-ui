import { describe, it, expect, afterEach } from 'vitest'
import { userEvent } from 'vitest/browser'
import type { UIProductCardElement } from '@agent-ui/components/controls/product-card'

// product-card.browser.test.ts: cross-engine (Chromium + WebKit) rendered truth for ui-product-card
// (ADR-0243). jsdom pins the declared rules (product-card.test.ts); this proves the geometry: the 16:10
// media box holds its height before the image loads, the two-line title clamp, fill by default versus the
// `inline` hug (ADR-0223), and a real user click emitting `action`.
//
// Side-effect imports in the load-bearing CSS order (ADR-0003): foundation roles and the dimensional
// ramp first, then the component sheets (via `all.css`), then the self-defining `all` entry.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'

const mounted: HTMLElement[] = []
const mount = async (markup: string, width = 400): Promise<{ wrap: HTMLElement; card: UIProductCardElement }> => {
  const wrap = document.createElement('div')
  wrap.style.inlineSize = `${width}px`
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const card = wrap.querySelector('ui-product-card') as UIProductCardElement
  await card.updateComplete
  return { wrap, card }
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const part = (card: Element, name: string): HTMLElement => card.querySelector(`[data-part="${name}"]`) as HTMLElement

describe('ui-product-card: rendered geometry', () => {
  it('the media box reserves its 16:10 height before the image loads', async () => {
    // A src that never resolves to pixels: the box must already hold its height.
    const { card } = await mount(`<ui-product-card title="Suite" image="/__product-card-never-loads__.png"></ui-product-card>`)
    const img = part(card, 'image') as HTMLImageElement
    expect(img.naturalWidth).toBe(0)
    const media = part(card, 'media').getBoundingClientRect()
    expect(media.width).toBeGreaterThan(0)
    expect(Math.abs(media.height - (media.width * 10) / 16)).toBeLessThan(1.5)
  })

  it('the title clamps at two lines', async () => {
    const long = 'Merino travel sweater, charcoal, relaxed fit with a long title that clamps at two lines and keeps going well past it'
    const { card } = await mount(`<ui-product-card title="${long}"></ui-product-card>`, 240)
    const title = part(card, 'title')
    const lineHeight = Number.parseFloat(getComputedStyle(title).lineHeight)
    expect(lineHeight).toBeGreaterThan(0)
    const height = title.getBoundingClientRect().height
    expect(height).toBeLessThanOrEqual(lineHeight * 2 + 1)
    expect(height).toBeGreaterThan(lineHeight * 1.5)
    expect(title.scrollHeight).toBeGreaterThan(title.clientHeight)
  })

  it('fills its container by default and hugs its content with inline', async () => {
    const fill = await mount(`<ui-product-card title="Suite" price="$312"></ui-product-card>`)
    expect(getComputedStyle(fill.card).display).toBe('flex')
    expect(Math.round(fill.card.getBoundingClientRect().width)).toBe(400)

    const hug = await mount(`<ui-product-card title="Suite" price="$312" inline></ui-product-card>`)
    expect(getComputedStyle(hug.card).display).toBe('inline-flex')
    expect(hug.card.getBoundingClientRect().width).toBeLessThan(400)
    expect(hug.card.getBoundingClientRect().width).toBeGreaterThan(0)
  })

  it('a real click on the action button emits action with the action payload', async () => {
    const payload = { action: 'book', context: { room: 'harbour' } }
    const { card } = await mount(`<ui-product-card title="Suite" price="$312" action-label="Book"></ui-product-card>`)
    card.action = payload
    await card.updateComplete
    const seen: unknown[] = []
    card.addEventListener('action', (e) => seen.push((e as CustomEvent).detail))
    await userEvent.click(part(card, 'title'))
    expect(seen).toEqual([])
    await userEvent.click(part(card, 'action'))
    expect(seen).toEqual([payload])
  })
})
