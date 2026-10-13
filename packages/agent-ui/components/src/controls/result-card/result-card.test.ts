import { describe, it, expect, afterEach } from 'vitest'
import { UIResultCardElement } from './result-card.ts'
import { cleanStats, formatDelta, MAX_STATS, outcomeOf, statsProp } from './result-card-model.ts'

// result-card.test.ts: jsdom probes for ui-result-card (ADR-0244, ResultCard fork sheet). jsdom cannot prove
// paint or geometry (result-card.browser.test.ts owns that); this pins the declared behaviour: the four
// outcomes as word plus glyph, the stats hardening (the cap of four, valueless entries dropped), the
// empty-box law, the part order before the producer's children, ARIA through internals and the lg stamp.

class ProbeResultCard extends UIResultCardElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-result-card-probe', ProbeResultCard)

const mounted: HTMLElement[] = []
function make(init: (el: ProbeResultCard) => void = () => {}): ProbeResultCard {
  const el = new ProbeResultCard()
  init(el)
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const q = (el: Element, sel: string): HTMLElement | null => el.querySelector(sel)
const all = (el: Element, sel: string): HTMLElement[] => Array.from(el.querySelectorAll(sel))
const childParts = (el: Element): (string | undefined)[] => Array.from(el.children).map((c) => (c as HTMLElement).dataset.part ?? c.localName)
const glyphD = (el: Element): string | null => el.querySelector('[data-part="outcome-glyph"] path')?.getAttribute('d') ?? null
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('UIResultCardElement: the four outcomes', () => {
  const CASES = [
    ['win', 'Win'],
    ['lose', 'Loss'],
    ['draw', 'Draw'],
    ['done', 'Done'],
  ] as const

  for (const [outcome, word] of CASES) {
    it(`${outcome} shows the word "${word}" and its own glyph`, () => {
      const el = make((c) => {
        c.outcome = outcome
      })
      const pill = q(el, '[data-part="outcome"]')!
      expect(pill.dataset.outcome).toBe(outcome)
      expect(q(pill, '[data-part="outcome-word"]')?.textContent).toBe(word)
      const svg = q(pill, '[data-part="outcome-glyph"]')!
      expect(svg.getAttribute('aria-hidden')).toBe('true')
      expect(glyphD(el)).toMatch(/^M/)
    })
  }

  it('the four glyphs are pairwise distinct shapes', () => {
    const shapes = CASES.map(([outcome]) => glyphD(make((c) => (c.outcome = outcome))))
    expect(new Set(shapes).size).toBe(4)
  })

  it('defaults to done and reflects the outcome attribute', () => {
    const el = make()
    expect(el.outcome).toBe('done')
    expect(q(el, '[data-part="outcome-word"]')?.textContent).toBe('Done')
    el.outcome = 'win'
    expect(el.getAttribute('outcome')).toBe('win')
  })

  it('an out-of-set outcome renders as done (word and glyph), never a blank pill', () => {
    const el = make((c) => {
      ;(c as unknown as { outcome: string }).outcome = 'victory'
    })
    expect(q(el, '[data-part="outcome-word"]')?.textContent).toBe('Done')
    expect(q(el, '[data-part="outcome"]')?.dataset.outcome).toBe('done')
    expect(outcomeOf('victory')).toBe('done')
  })

  it('a changed outcome patches the same pill in place', async () => {
    const el = make((c) => (c.outcome = 'win'))
    const pill = q(el, '[data-part="outcome"]')
    el.outcome = 'lose'
    await el.updateComplete
    expect(q(el, '[data-part="outcome"]')).toBe(pill)
    expect(q(el, '[data-part="outcome-word"]')?.textContent).toBe('Loss')
  })
})

describe('UIResultCardElement: anatomy and the empty-box law', () => {
  it('outcome only: renders the header alone, no summary or stats box', () => {
    const el = make()
    expect(childParts(el)).toEqual(['header'])
    expect(q(el, '[data-part="title"]')).toBeNull()
  })

  it('renders header, summary and stats in order with their text', () => {
    const el = make((c) => {
      c.outcome = 'win'
      c.title = 'Blackjack, hand 12'
      c.summary = 'You beat the dealer 20 to 18.'
      c.stats = [{ label: 'Chips', value: 1290, delta: 50, intent: 'success' }, { label: 'Hands', value: 12 }]
    })
    expect(childParts(el)).toEqual(['header', 'summary', 'stats'])
    expect(q(el, '[data-part="title"]')?.textContent).toBe('Blackjack, hand 12')
    expect(q(el, '[data-part="summary"]')?.textContent).toBe('You beat the dealer 20 to 18.')
    expect(all(el, '[data-part="stat"]').map((s) => q(s, '[data-part="value"]')?.textContent)).toEqual([
      new Intl.NumberFormat().format(1290),
      '12',
    ])
    expect(q(el, '[data-part="delta"]')?.textContent).toBe('+50')
  })

  it('an empty or blank summary renders no summary box; empty stats render no stats box', () => {
    const el = make((c) => {
      c.summary = '   '
      c.stats = []
    })
    expect(q(el, '[data-part="summary"]')).toBeNull()
    expect(q(el, '[data-part="stats"]')).toBeNull()
  })

  it('a summary or stats that empties later removes its box', async () => {
    const el = make((c) => {
      c.summary = 'Lisbon, 4 nights.'
      c.stats = [{ label: 'Nights', value: 4 }]
    })
    expect(childParts(el)).toEqual(['header', 'summary', 'stats'])
    el.summary = ''
    el.stats = []
    await el.updateComplete
    expect(childParts(el)).toEqual(['header'])
  })

  it('no children renders no actions row: only the parts are host children', () => {
    const el = make((c) => (c.summary = 'You answered 8 of 10 correctly.'))
    expect(Array.from(el.children).every((c) => (c as HTMLElement).dataset.part !== undefined)).toBe(true)
  })
})

describe('UIResultCardElement: stats hardening', () => {
  it(`keeps at most ${MAX_STATS} stats and drops the rest`, () => {
    expect(MAX_STATS).toBe(4)
    const el = make((c) => {
      c.stats = Array.from({ length: 6 }, (_, i) => ({ label: `S${i + 1}`, value: i + 1 }))
    })
    expect(all(el, '[data-part="stat"]').map((s) => q(s, '[data-part="label"]')?.textContent)).toEqual(['S1', 'S2', 'S3', 'S4'])
  })

  it('drops valueless and non-object entries before the cap counts them', () => {
    const cleaned = cleanStats([
      { label: 'No value' },
      { label: 'Blank', value: '  ' },
      { label: 'NaN', value: Number.NaN },
      null,
      'Chips',
      { label: 'Moves', value: 9 },
      { value: '1 / 1' },
    ])
    expect(cleaned).toEqual([
      { label: 'Moves', value: '9' },
      { label: '', value: '1 / 1' },
    ])
  })

  it('formats a signed delta and ignores a non-delta', () => {
    expect(formatDelta(50)).toBe('+50')
    expect(formatDelta('-3')).toBe('-3')
    expect(formatDelta(0)).toBe('0')
    expect(formatDelta('')).toBeNull()
    expect(formatDelta({})).toBeNull()
  })

  it('a stat intent adds a glyph and data-intent; neutral or unknown adds neither', () => {
    const el = make((c) => {
      c.stats = [
        { label: 'Chips', value: 1, intent: 'success' },
        { label: 'Hands', value: 2, intent: 'neutral' },
        { label: 'Bet', value: 3, intent: 'bogus' },
      ]
    })
    const tiles = all(el, '[data-part="stat"]')
    expect(tiles.map((t) => t.dataset.intent)).toEqual(['success', undefined, undefined])
    expect(tiles.map((t) => q(t, '[data-part="glyph"]') !== null)).toEqual([true, false, false])
  })

  it('the attribute codec parses JSON, falls back to [] on null or malformed input, and never throws', () => {
    const from = statsProp.type.from
    expect(from(null)).toEqual([])
    expect(from('{not json')).toEqual([])
    expect(from('[{"label":"Shots","value":23}]')).toEqual([{ label: 'Shots', value: '23' }])
  })
})

describe('UIResultCardElement: the producer children and the lg stamp', () => {
  it('parts sit before children appended before connect, and each direct ui-button is stamped lg', () => {
    const el = new ProbeResultCard()
    el.outcome = 'win'
    el.summary = 'You won.'
    const again = document.createElement('ui-button')
    const bet = document.createElement('ui-button')
    bet.setAttribute('size', 'sm')
    el.append(again, bet)
    document.body.append(el)
    mounted.push(el)
    expect(childParts(el)).toEqual(['header', 'summary', 'ui-button', 'ui-button'])
    expect(again.getAttribute('size')).toBe('lg')
    expect(bet.getAttribute('size')).toBe('lg')
  })

  it('a part that appears later is inserted before the children, and a later button is stamped too', async () => {
    const el = make((c) => (c.outcome = 'draw'))
    const again = document.createElement('ui-button')
    el.append(again)
    await tick()
    expect(again.getAttribute('size')).toBe('lg')
    el.stats = [{ label: 'Moves', value: 9 }]
    await el.updateComplete
    expect(childParts(el)).toEqual(['header', 'stats', 'ui-button'])
  })

  it('only direct ui-button children are stamped, never a nested one', async () => {
    const el = make()
    const wrap = document.createElement('div')
    const nested = document.createElement('ui-button')
    wrap.append(nested)
    el.append(wrap)
    await tick()
    expect(nested.hasAttribute('size')).toBe(false)
  })
})

describe('UIResultCardElement: ARIA through internals', () => {
  it('is a group named by the outcome word and the title', () => {
    const el = make((c) => {
      c.outcome = 'lose'
      c.title = 'Admiral, battle over'
    })
    expect(el.probeInternals.role).toBe('group')
    expect(el.probeInternals.ariaLabel).toBe('Loss: Admiral, battle over')
    expect(el.hasAttribute('role')).toBe(false)
    expect(el.hasAttribute('aria-label')).toBe(false)
  })

  it('falls back to the outcome word alone when the title is empty', () => {
    const el = make((c) => (c.outcome = 'draw'))
    expect(el.probeInternals.ariaLabel).toBe('Draw')
  })

  it('the header is the polite live region; the host is not', () => {
    const el = make()
    expect(q(el, '[data-part="header"]')?.getAttribute('aria-live')).toBe('polite')
    expect(el.probeInternals.ariaLive ?? null).not.toBe('polite')
  })

  it('title is observed as result-title, never the global title attribute', () => {
    const el = make((c) => (c.title = 'Quiz complete'))
    expect(el.hasAttribute('title')).toBe(false)
    el.setAttribute('result-title', 'Trip plan booked')
    expect(el.title).toBe('Trip plan booked')
  })
})
