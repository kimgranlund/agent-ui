// contrast-pair.browser.test.ts: the real-engine half of the ContrastPair (ADR-0244 cl.3, T-0090). The stylist
// persona seed renders through the live renderer into a 480px column (the canvas content width), and the
// computed style proves what jsdom cannot: the sample region paints the given background behind the given ink,
// the card sits on the ADR-0046 box model (ink 19px inline and 13px block from the outer edge: the 1px border,
// the 6px box inset and the region padding; one 8px gap between parts), each verdict pill shows its glyph, and
// no element carries a left-edge accent. factories.test.ts owns the DOM shape and the text.

import { describe, it, expect, afterEach } from 'vitest'
// Side-effect CSS first (foundation, then the shipped control sheets), then the self-defining controls.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'
import { createRenderer } from '../../../renderer/renderer.ts'
import { personaStylistContrastSeed as seed } from '../../../examples/persona-exemplars.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

/** Render the stylist seed into a 480px column and return its ContrastPair cards, by label. */
async function renderPairs(): Promise<Map<string, HTMLElement>> {
  const mount = document.createElement('div')
  mount.style.inlineSize = '480px'
  document.body.append(mount)
  mounted.push(mount)
  const host = createRenderer()
  host.mount(mount)
  await host.preload(seed.catalogId)
  for (const message of seed.messages) host.ingest(JSON.stringify(message))
  host.finalize(seed.surfaceId)
  await host.settled()
  const cards = [...mount.querySelectorAll('ui-card')] as HTMLElement[]
  return new Map(cards.map((card) => [part(card, 'label').textContent ?? '', card]))
}

const rect = (el: Element): DOMRect => el.getBoundingClientRect()
const part = (root: Element, name: string): HTMLElement => root.querySelector(`[data-part="${name}"]`) as HTMLElement

describe('ContrastPair in a real engine', () => {
  it('the sample region paints the background behind the foreground ink, on both sample lines', async () => {
    const pairs = await renderPairs()
    const heading = pairs.get('Heading on page')!
    const sample = part(heading, 'sample')
    expect(getComputedStyle(sample).backgroundColor).toBe('rgb(232, 245, 238)') // #e8f5ee
    for (const line of ['sample-large', 'sample-body']) {
      expect(getComputedStyle(part(heading, line)).color, line).toBe('rgb(11, 61, 46)') // #0b3d2e
    }
    // The bound pair paints from the data model.
    const caption = pairs.get('Muted caption')!
    expect(getComputedStyle(part(caption, 'sample')).backgroundColor).toBe('rgb(255, 255, 255)')
    expect(getComputedStyle(part(caption, 'sample-body')).color).toBe('rgb(119, 119, 119)')
    expect(part(caption, 'ratio').textContent).toBe('4.47:1')
  })

  it('ADR-0046 geometry: ink 19px inline and 13px block from the edge, parts one 8px gap apart', async () => {
    const card = (await renderPairs()).get('Heading on page')!
    const host = rect(card)
    const header = rect(part(card, 'header'))
    const sample = rect(part(card, 'sample'))
    const verdicts = rect(part(card, 'verdicts'))
    const values = rect(part(card, 'values'))
    expect(getComputedStyle(card).borderTopWidth).toBe('1px')
    expect(header.left - host.left).toBeCloseTo(19, 0)
    expect(header.top - host.top).toBeCloseTo(13, 0)
    expect(host.right - sample.right).toBeCloseTo(19, 0)
    expect(sample.left - host.left).toBeCloseTo(19, 0)
    expect(sample.top - header.bottom).toBeCloseTo(8, 0)
    expect(verdicts.top - sample.bottom).toBeCloseTo(8, 0)
    expect(values.top - verdicts.bottom).toBeCloseTo(8, 0)
    expect(host.bottom - values.bottom).toBeCloseTo(13, 0)
    expect(getComputedStyle(part(card, 'sample')).marginBlockStart).toBe('0px') // the card's loose-child margin is gone
  })

  it('Unrated: no pills and no gap where they were; the sample still paints the raw pair', async () => {
    const card = (await renderPairs()).get('Translucent overlay')!
    expect(part(card, 'ratio').textContent).toBe('Unrated')
    expect(getComputedStyle(part(card, 'verdicts')).display).toBe('none')
    expect(rect(part(card, 'values')).top - rect(part(card, 'sample')).bottom).toBeCloseTo(8, 0)
    expect(getComputedStyle(part(card, 'sample')).backgroundColor).toMatch(/^rgba\(20, 20, 40, 0\.50?2?\)$/) // #14142880; engines print 0x80 as 0.5
  })

  it('each verdict pill shows a glyph beside its word: a tick for Pass, a cross for Fail', async () => {
    const caption = (await renderPairs()).get('Muted caption')!
    const pills = [...caption.querySelectorAll('[data-part="verdict"]')] as HTMLElement[]
    expect(pills.map((p) => p.getAttribute('intent'))).toEqual(['danger', 'success', 'danger'])
    for (const pill of pills) {
      const glyph = pill.querySelector('[data-part="glyph"]') as HTMLElement
      expect(getComputedStyle(glyph).display, pill.textContent ?? '').not.toBe('none')
      expect(rect(glyph).width).toBeGreaterThan(0)
    }
    expect(getComputedStyle(pills[0]!).clipPath).toBe('none')
    expect(getComputedStyle(pills[0]!.querySelector('[data-part="glyph"]')!).clipPath).not.toBe(
      getComputedStyle(pills[1]!.querySelector('[data-part="glyph"]')!).clipPath,
    )
  })

  it('no left-edge accent: every element\'s left border matches its right border in width and color', async () => {
    const pairs = await renderPairs()
    expect(pairs.size).toBe(4)
    for (const card of pairs.values()) {
      for (const el of [card, ...card.querySelectorAll('*')]) {
        const cs = getComputedStyle(el)
        const where = `${el.tagName.toLowerCase()}[${el.getAttribute('data-part') ?? ''}]`
        expect(cs.borderLeftWidth, where).toBe(cs.borderRightWidth)
        expect(cs.borderLeftColor, where).toBe(cs.borderRightColor)
      }
    }
  })
})
