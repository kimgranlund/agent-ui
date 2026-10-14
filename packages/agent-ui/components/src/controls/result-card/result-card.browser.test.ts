import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'

/** The derived root register (product / sm / md, ADR-0245). */
const ROOT = resolve('product', 'sm', 'md')

// result-card.browser.test.ts: the real-engine painted proof for ui-result-card (ADR-0244, ResultCard fork
// sheet). jsdom is blind to layout, so this covers the whole-shape fill and hug, the ADR-0046 box model by
// computed geometry, the no-edge-accent law, the producer buttons at the lg step (28px derived), and the stat wrap.
//
// Side-effect imports, load-bearing order (ADR-0003): foundation roles and ramps first, then the sheets, then
// the controls. The card mints no button, so the test brings ui-button itself (as the renderer would).
import '@agent-ui/components/foundation-styles.css'
import '../button/button.css'
import './result-card.css'
import '../button/button.ts'
import './result-card.ts'
import type { UIResultCardElement } from './result-card.ts'

const mounted: HTMLElement[] = []
const container = (width: string): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.style.cssText = `inline-size:${width}; padding:0; margin:0;`
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const button = (label: string, variant?: string): HTMLElement => {
  const b = document.createElement('ui-button')
  b.textContent = label
  if (variant) b.setAttribute('variant', variant)
  return b
}

const card = (
  parent: HTMLElement,
  init: (el: UIResultCardElement) => void,
  children: HTMLElement[] = [],
): UIResultCardElement => {
  const el = document.createElement('ui-result-card') as UIResultCardElement
  init(el)
  el.append(...children) // the renderer appends a node's children before the host connects
  parent.append(el)
  return el
}

const settle = async (el: UIResultCardElement): Promise<void> => {
  await el.updateComplete
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
}

const winCard = (parent: HTMLElement): UIResultCardElement =>
  card(
    parent,
    (c) => {
      c.outcome = 'win'
      c.title = 'Blackjack, hand 12'
      c.summary = 'You beat the dealer 20 to 18. Your stack is up for the night.'
      c.stats = [
        { label: 'Chips', value: 1290, delta: 50, intent: 'success' },
        { label: 'Hands', value: 12 },
        { label: 'Win rate', value: '58%' },
      ]
    },
    [button('Play again'), button('Change bet', 'soft')],
  )

describe('ui-result-card: sizing (ADR-0223)', () => {
  it('fills its container by default and hugs under inline', async () => {
    const wrap = container('640px')
    const fill = card(wrap, (c) => {
      c.outcome = 'draw'
      c.title = 'Tic-tac-toe'
    })
    await settle(fill)
    const wrapBox = wrap.getBoundingClientRect()
    const fillBox = fill.getBoundingClientRect()
    expect(fillBox.height, 'the card painted zero height').toBeGreaterThan(0)
    expect(fillBox.width).toBeCloseTo(wrapBox.width, 0)

    const hug = card(wrap, (c) => {
      c.outcome = 'draw'
      c.title = 'Tic-tac-toe'
      c.inline = true
    })
    await settle(hug)
    expect(hug.hasAttribute('inline')).toBe(true)
    expect(hug.getBoundingClientRect().width).toBeGreaterThan(0)
    expect(hug.getBoundingClientRect().width).toBeLessThan(wrapBox.width / 2)
  })
})

describe('ui-result-card: the ADR-0046 box model', () => {
  it('ink sits 6px inside the frame plus region padding 12 inline and 6 block; regions are 8px apart', async () => {
    const el = winCard(container('480px'))
    await settle(el)
    const host = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    const border = parseFloat(style.borderTopWidth)
    expect(border).toBe(1)
    const box = (name: string): DOMRect => (el.querySelector(`:scope > [data-part="${name}"]`) as HTMLElement).getBoundingClientRect()
    // border 1px + the 6px box inset + the region padding (12px inline, 6px block)
    expect(box('header').left - host.left).toBeCloseTo(border + 6 + 12, 0)
    expect(box('header').top - host.top).toBeCloseTo(border + 6 + 6, 0)
    expect(host.right - box('stats').right).toBeCloseTo(border + 6 + 12, 0)
    expect(box('summary').top - box('header').bottom).toBeCloseTo(8, 0)
    expect(box('stats').top - box('summary').bottom).toBeCloseTo(8, 0)
    const actions = Array.from(el.querySelectorAll(':scope > ui-button')) as HTMLElement[]
    expect(actions).toHaveLength(2)
    const first = actions[0]!.getBoundingClientRect()
    const second = actions[1]!.getBoundingClientRect()
    expect(first.top - box('stats').bottom).toBeCloseTo(8, 0)
    expect(host.bottom - first.bottom).toBeCloseTo(border + 6 + 6, 0)
    expect(first.left - host.left).toBeCloseTo(border + 6 + 12, 0)
    // the actions share one row, 8px apart
    expect(second.top).toBeCloseTo(first.top, 0)
    expect(second.left - first.right).toBeCloseTo(8, 0)
  })

  it('no left-edge accent: no element has a left border unlike its right border', async () => {
    const outcomes = ['win', 'lose', 'draw', 'done'] as const
    const wrap = container('480px')
    const cards = outcomes.map((outcome) =>
      card(
        wrap,
        (c) => {
          c.outcome = outcome
          c.title = 'Final'
          c.summary = 'Summary line.'
          c.stats = [{ label: 'Chips', value: 10, delta: -3, intent: 'danger' }]
        },
        [button('Play again')],
      ),
    )
    for (const c of cards) await settle(c)
    let checked = 0
    for (const c of cards) {
      for (const node of [c, ...Array.from(c.querySelectorAll('*'))] as Element[]) {
        const s = getComputedStyle(node)
        expect(s.borderLeftWidth, `${node.localName}[data-part=${node.getAttribute('data-part')}] left border width`).toBe(s.borderRightWidth)
        if (parseFloat(s.borderLeftWidth) > 0) {
          expect(s.borderLeftColor, `${node.localName}[data-part=${node.getAttribute('data-part')}] left border color`).toBe(s.borderRightColor)
          expect(s.borderLeftStyle).toBe(s.borderRightStyle)
        }
        checked += 1
      }
    }
    expect(checked).toBeGreaterThan(20)
  })
})

describe('ui-result-card: the producer buttons at the lg step', () => {
  it('every direct ui-button child carries size lg and renders the derived 28px tall', async () => {
    const el = winCard(container('480px'))
    const late = button('Show board')
    el.append(late)
    await settle(el)
    const buttons = Array.from(el.children).filter((c) => c.localName === 'ui-button') as HTMLElement[]
    expect(buttons).toHaveLength(3)
    for (const b of buttons) {
      expect(b.getAttribute('size')).toBe('lg')
      expect(b.getBoundingClientRect().height).toBeCloseTo(resolve('product', 'sm', 'lg').h, 0)
    }
  })
})

describe('ui-result-card: the outcome pill and the stat wrap', () => {
  it('each outcome pill paints its glyph and word on its own tint', async () => {
    const outcomes = ['win', 'lose', 'draw', 'done'] as const
    const wrap = container('480px')
    const cards = outcomes.map((outcome) => card(wrap, (c) => (c.outcome = outcome)))
    for (const c of cards) await settle(c)
    const tints = cards.map((c) => {
      const pill = c.querySelector('[data-part="outcome"]') as HTMLElement
      const glyph = c.querySelector('[data-part="outcome-glyph"]') as SVGElement
      expect(glyph.getBoundingClientRect().width).toBeGreaterThan(0)
      expect((c.querySelector('[data-part="outcome-word"]') as HTMLElement).getBoundingClientRect().width).toBeGreaterThan(0)
      return getComputedStyle(pill).backgroundColor
    })
    expect(new Set(tints).size).toBe(4)
  })

  it('four stats wrap at the 360px frame minimum with no horizontal overflow', async () => {
    const el = card(container('360px'), (c) => {
      c.outcome = 'lose'
      c.title = 'Admiral, battle over'
      c.stats = [
        { label: 'Shots', value: 23 },
        { label: 'Hits', value: 5, delta: -3, intent: 'danger' },
        { label: 'Ships left', value: 0 },
        { label: 'Turns', value: 41 },
      ]
    }, [button('Play again'), button('Show board', 'soft')])
    await settle(el)
    expect(el.scrollWidth).toBeLessThanOrEqual(el.clientWidth)
    const tiles = Array.from(el.querySelectorAll('[data-part="stat"]')) as HTMLElement[]
    expect(tiles).toHaveLength(4)
    const host = el.getBoundingClientRect()
    for (const tile of tiles) {
      const box = tile.getBoundingClientRect()
      expect(box.right).toBeLessThanOrEqual(host.right + 0.5)
      expect(box.left).toBeGreaterThanOrEqual(host.left - 0.5)
    }
  })
})

// ADR-0245 geometry pin (clause 10c): the migrated tokens read the derived foundation inside an opt-in
// data-tier region and today's value outside it. Values are scale.mjs resolve('product', 'sm', 'md'): n 6,
// height 24, c 2, icon box 12, radius 6. Lengths are read through layout (`inline-size: var(<token>)`).
const lengthOf = (host: HTMLElement, token: string): number => {
  const probe = document.createElement('span')
  probe.style.cssText = `position:absolute;block-size:1px;inline-size:var(${token});`
  host.append(probe)
  const width = Number.parseFloat(getComputedStyle(probe).inlineSize)
  probe.remove()
  return width
}
const foundationsPair = (tag: string, attrs: string): { out: HTMLElement; inside: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.innerHTML = `<div data-foundations="legacy"><${tag} ${attrs}></${tag}></div><div data-tier="product" data-scale="sm"><${tag} ${attrs}></${tag}></div>`
  document.body.append(wrap)
  mounted.push(wrap)
  const [out, inside] = Array.from(wrap.querySelectorAll<HTMLElement>(tag)) as [HTMLElement, HTMLElement]
  return { out, inside }
}

describe('ui-result-card: the stat glyph (ADR-0245 Amendment 6)', () => {
  it('a stat glyph is its own glyph box 2n - 2c, n clear of its label', async () => {
    const el = card(container('480px'), (c) => {
      c.stats = [{ label: 'Hits', value: 3, intent: 'danger' }]
    })
    await settle(el)
    const glyph = el.querySelector('[data-part="stat"] [data-part="glyph"]') as HTMLElement
    const label = el.querySelector('[data-part="stat"] [data-part="label"]') as HTMLElement
    const box = glyph.getBoundingClientRect()
    expect([box.width, box.height]).toEqual([ROOT.glyph, ROOT.glyph])
    expect(label.getBoundingClientRect().left - box.right, 'glyph to label gap').toBeCloseTo(ROOT.n, 0)
  })
})

describe('ui-result-card: ADR-0245 derived foundations, dark launch', () => {
  it('reads today\'s value outside a data-tier region and the derived value inside', () => {
    const { out, inside } = foundationsPair('ui-result-card', 'outcome="win" result-title="Blackjack"')
    expect(lengthOf(out, '--ui-result-card-outcome-radius')).toBe(999)
    expect(lengthOf(inside, '--ui-result-card-outcome-radius')).toBe(ROOT.h) // any radius over half the pill's height is a pill
    expect(lengthOf(out, '--ui-result-card-outcome-gap')).toBe(5)
    expect(lengthOf(inside, '--ui-result-card-outcome-gap')).toBe(ROOT.n)
    expect(lengthOf(out, '--ui-result-card-stat-radius')).toBe(lengthOf(out, '--md-sys-shape-corner-base') - 2)
    expect(lengthOf(inside, '--ui-result-card-stat-radius')).toBe(ROOT.n)
    for (const el of [out, inside]) expect(lengthOf(el, '--ui-result-card-stat-gap')).toBe(2)
  })
})
