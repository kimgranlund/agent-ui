import { describe, it, expect, afterEach } from 'vitest'
import { userEvent } from 'vitest/browser'

// option-deck.browser.test.ts: the real-engine proof for ui-option-deck (T-0193, the OptionDeck fork sheet). jsdom
// has no focus order and no layout, so this covers the roving tab stop and arrow keys, Enter and Space each
// picking once, the Surprise me key, and the one-column row with no horizontal overflow at the 400px column. Runs
// in Chromium and WebKit through the `packages` project instances.
//
// Side-effect imports, load-bearing order (ADR-0003): foundation roles and ramps first, then the sheet, then the
// control.
import '@agent-ui/components/foundation-styles.css'
import './option-deck.css'
import './option-deck.ts'
import type { UIOptionDeckElement } from './option-deck.ts'

const OPTIONS = [
  { value: 'blackjack', title: 'Blackjack', description: 'Beat the dealer to 21 without going bust.', icon: 'star', tone: 'primary', index: 'A', meta: ['1 to 6 players', '5 min', 'Easy'] },
  { value: 'holdem', title: "Texas Hold'em", description: 'Two hole cards, five on the board, best hand wins.', icon: 'heart', tone: 'accent', index: 'K', meta: ['2 to 9 players', '15 min', 'Medium'] },
  { value: 'draw', title: 'Five-card draw', description: 'Swap up to three cards once, then show down.', tone: 'info', index: '5', meta: ['2 to 6 players'] },
]

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

/** A deck on the A2UI canvas register (widget / md) inside a container of `width`, with its select log. */
async function mount(width: string, props: Partial<UIOptionDeckElement> = {}): Promise<{ deck: UIOptionDeckElement; selects: unknown[] }> {
  const wrap = document.createElement('div')
  wrap.dataset.tier = 'widget'
  wrap.dataset.scale = 'md'
  wrap.style.cssText = `inline-size:${width}; padding:0; margin:0;`
  const deck = document.createElement('ui-option-deck') as UIOptionDeckElement
  Object.assign(deck, { heading: 'Pick your table', options: OPTIONS, ...props })
  const selects: unknown[] = []
  deck.addEventListener('select', (e) => selects.push((e as CustomEvent).detail))
  wrap.append(deck)
  document.body.append(wrap)
  mounted.push(wrap)
  await deck.updateComplete
  return { deck, selects }
}

const cards = (deck: Element): HTMLElement[] => Array.from(deck.querySelectorAll('[data-part="option"]'))

describe('ui-option-deck: roving focus', () => {
  it('Tab lands on the one tab stop, and the arrow keys move through the cards in tree order', async () => {
    const { deck } = await mount('44rem')
    const [a, b, c] = cards(deck)
    await userEvent.tab()
    expect(document.activeElement).toBe(a)
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(b)
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(c)
    await userEvent.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(b)
    await userEvent.keyboard('{Home}')
    expect(document.activeElement).toBe(a)
    expect(cards(deck).map((card) => card.tabIndex)).toEqual([0, -1, -1])
  })
})

describe('ui-option-deck: Enter and Space pick once', () => {
  it('Enter on the focused card fires one select with its value', async () => {
    const { deck, selects } = await mount('44rem')
    await userEvent.tab()
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{Enter}')
    expect(selects).toEqual(['holdem'])
    expect(deck.value).toBe('holdem')
    expect(cards(deck)[1]!.getAttribute('aria-selected')).toBe('true')
  })

  it('Space on the focused card fires one select with its value', async () => {
    const { deck, selects } = await mount('44rem')
    await userEvent.tab()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    await userEvent.keyboard(' ')
    expect(selects).toEqual(['draw'])
    expect(deck.value).toBe('draw')
  })

  it('allowRandom adds the Surprise me card, which fires "random"', async () => {
    const { deck, selects } = await mount('44rem', { allowRandom: true })
    const random = cards(deck).at(-1)!
    expect(random.dataset.key).toBe('random')
    await userEvent.click(random)
    expect(selects).toEqual(['random'])
    expect(deck.value).toBe('random')
  })
})

describe('ui-option-deck: the 400px column', () => {
  it('one track, each card a horizontal row, and no horizontal overflow', async () => {
    const { deck } = await mount('400px', { allowRandom: true, value: 'blackjack' })
    const grid = deck.querySelector<HTMLElement>('[data-part="grid"]')!
    const list = cards(deck)
    const lefts = new Set(list.map((card) => Math.round(card.getBoundingClientRect().left)))
    expect(lefts.size).toBe(1)
    const tracks = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/)
    expect(tracks).toHaveLength(1)
    // The row form: the band leads and the body sits beside it, not under it.
    const hero = list[0]!.querySelector<HTMLElement>('[data-part="hero"]')!.getBoundingClientRect()
    const body = list[0]!.querySelector<HTMLElement>('[data-part="body"]')!.getBoundingClientRect()
    expect(body.left).toBeGreaterThanOrEqual(hero.right - 1)
    expect(Math.round(body.top)).toBe(Math.round(hero.top))
    expect(deck.scrollWidth).toBeLessThanOrEqual(deck.clientWidth)
    for (const card of list) expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth)
    expect(deck.getBoundingClientRect().width).toBeLessThanOrEqual(400)
  })

  it('a wide surface fits two tracks (negative control for the one-column check)', async () => {
    const { deck } = await mount('44rem')
    const grid = deck.querySelector<HTMLElement>('[data-part="grid"]')!
    expect(getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length).toBeGreaterThan(1)
  })
})

// T-0388: the deck is its own inline-size container, so it has no intrinsic width. Under a parent that sizes its
// child to content (a centring column, a flex row, a centring grid cell) it used to resolve to 0px. The host now
// fills the available inline size itself, so every parent gets the fill, not only a stretched surface root.
describe('ui-option-deck: fills a shrink-to-fit parent', () => {
  const PARENTS: Record<string, string> = {
    'a centring column': 'display:flex; flex-direction:column; align-items:center;',
    'a flex row': 'display:flex; flex-direction:row;',
    'a centring grid cell': 'display:grid; justify-items:center;',
  }
  for (const [name, css] of Object.entries(PARENTS)) {
    it(`a deck nested in ${name} fills the column`, async () => {
      const { deck } = await mount('40rem')
      const parent = document.createElement('div')
      parent.style.cssText = css
      deck.parentElement!.append(parent)
      parent.append(deck)
      await deck.updateComplete
      const width = deck.getBoundingClientRect().width
      expect(width).toBeCloseTo(parent.getBoundingClientRect().width, 0)
      expect(width).toBeGreaterThan(0)
      expect(cards(deck)[0]!.getBoundingClientRect().width).toBeGreaterThan(0)
    })
  }
})
