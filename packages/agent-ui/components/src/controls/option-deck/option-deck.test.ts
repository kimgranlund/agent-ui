import { describe, it, expect, afterEach } from 'vitest'
import { UIOptionDeckElement } from './option-deck.ts'
import { cleanOptions, MAX_META, optionsProp, toneOf } from './option-deck-model.ts'

// option-deck.test.ts: jsdom probes for ui-option-deck (T-0193, the OptionDeck fork sheet). jsdom cannot prove
// paint, focus order or geometry (option-deck.browser.test.ts owns those); this pins the declared behaviour: the
// options codec, the one-select-one-action channel, Surprise me, the value-keyed paint, disabled and no buttons.

class ProbeOptionDeck extends UIOptionDeckElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-option-deck-probe', ProbeOptionDeck)

const OPTIONS = [
  { value: 'blackjack', title: 'Blackjack', description: 'Beat the dealer to 21.', icon: 'star', tone: 'primary', index: 'A', meta: ['1 to 6 players', '5 min', 'Easy'] },
  { value: 'holdem', title: "Texas Hold'em", description: 'Best five-card hand wins.', tone: 'accent', index: 'K' },
  { value: 'draw', title: 'Five-card draw' },
]

const mounted: HTMLElement[] = []
function make(init: (el: ProbeOptionDeck) => void = () => {}): ProbeOptionDeck {
  const el = new ProbeOptionDeck()
  el.options = OPTIONS
  init(el)
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const cards = (el: Element): HTMLElement[] => Array.from(el.querySelectorAll('[data-part="option"]'))
const card = (el: Element, key: string): HTMLElement => el.querySelector(`[data-part="option"][data-key="${key}"]`)!
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/** Every `select` and `action` the deck fires, in order. */
function record(el: HTMLElement): { type: string; detail: unknown; value: string }[] {
  const log: { type: string; detail: unknown; value: string }[] = []
  for (const type of ['select', 'action']) {
    el.addEventListener(type, (e) => log.push({ type, detail: (e as CustomEvent).detail, value: (el as UIOptionDeckElement).value }))
  }
  return log
}

describe('option-deck-model: the options codec', () => {
  it('a non-array and malformed JSON become []', () => {
    expect(cleanOptions(undefined)).toEqual([])
    expect(cleanOptions({ value: 'a', title: 'A' })).toEqual([])
    expect(optionsProp.type.from('{not json')).toEqual([])
    expect(optionsProp.type.from(null)).toEqual([])
  })

  it('drops entries without a value or a title, and non-object entries', () => {
    const out = cleanOptions([{ value: 'a' }, { title: 'B' }, 'c', null, { value: ' ', title: 'D' }, { value: 'e', title: 'E' }])
    expect(out.map((o) => o.value)).toEqual(['e'])
  })

  it('cuts meta to three non-empty strings', () => {
    const [o] = cleanOptions([{ value: 'a', title: 'A', meta: ['1', '', 2, '3', '4', '5'] }])
    expect(MAX_META).toBe(3)
    expect(o!.meta).toEqual(['1', '2', '3'])
  })

  it('keeps the optional index as a string, a number as its digits', () => {
    const out = cleanOptions([{ value: 'a', title: 'A', index: 'K' }, { value: 'b', title: 'B', index: 5 }, { value: 'c', title: 'C' }])
    expect(out.map((o) => o.index)).toEqual(['K', '5', undefined])
  })

  it('an out-of-set tone reads neutral, and the reserved random key is dropped', () => {
    expect(toneOf('success')).toBe('success')
    expect(toneOf('#ff0000')).toBe('neutral')
    expect(cleanOptions([{ value: 'random', title: 'R' }])).toEqual([])
  })

  it('the attribute form parses through the codec', () => {
    const el = document.createElement('ui-option-deck') as UIOptionDeckElement
    el.setAttribute('options', JSON.stringify([{ value: 'x', title: 'X', index: 7 }]))
    document.body.append(el)
    mounted.push(el)
    expect(cards(el).map((c) => c.dataset.key)).toEqual(['x'])
    expect(el.querySelector('[data-part="index"]')?.textContent).toBe('7')
  })
})

describe('UIOptionDeckElement: anatomy and ARIA', () => {
  it('renders one option card per option with title, description, meta and the corner index', () => {
    const el = make((d) => {
      d.heading = 'Pick your table'
    })
    expect(el.probeInternals.role).toBe('listbox')
    expect(el.probeInternals.ariaLabel).toBe('Pick your table')
    expect(cards(el).map((c) => c.dataset.key)).toEqual(['blackjack', 'holdem', 'draw'])
    const bj = card(el, 'blackjack')
    expect(bj.getAttribute('role')).toBe('option')
    expect(bj.dataset.tone).toBe('primary')
    expect(bj.querySelector('[data-part="title"]')?.textContent).toBe('Blackjack')
    expect(bj.querySelectorAll('[data-part="chip"]')).toHaveLength(3)
    expect(Array.from(bj.querySelectorAll('[data-part="index"]')).map((n) => n.textContent)).toEqual(['A', 'A'])
    expect(document.getElementById(bj.getAttribute('aria-labelledby')!)?.textContent).toBe('Blackjack')
    expect(bj.getAttribute('aria-describedby')!.split(' ')).toHaveLength(2)
    const plain = card(el, 'draw')
    expect(plain.dataset.tone).toBe('neutral')
    expect(plain.querySelector('[data-part="index"]')).toBeNull()
    expect(plain.querySelector('[data-part="description"]')).toBeNull()
    expect(plain.hasAttribute('aria-describedby')).toBe(false)
  })

  it('has no ui-button descendant and no native button', () => {
    const el = make((d) => {
      d.allowRandom = true
    })
    expect(el.querySelector('ui-button')).toBeNull()
    expect(el.querySelector('button')).toBeNull()
  })

  it('falls back to the "Options" name and renders no empty heading part', () => {
    const el = make()
    expect(el.probeInternals.ariaLabel).toBe('Options')
    expect(el.querySelector('[data-part="heading"]')).toBeNull()
    expect(el.querySelector('[data-part="subheading"]')).toBeNull()
  })

  it('holds exactly one tab stop', () => {
    const el = make()
    expect(cards(el).map((c) => c.tabIndex)).toEqual([0, -1, -1])
  })
})

describe('UIOptionDeckElement: one pick, one select, one action', () => {
  it('a click fires exactly one select with the string key, after value is set', () => {
    const el = make()
    const log = record(el)
    card(el, 'holdem').click()
    expect(log).toEqual([{ type: 'select', detail: 'holdem', value: 'holdem' }])
    expect(el.value).toBe('holdem')
  })

  it('with actionName set, one select then exactly one action carrying {action, context: {value}}', () => {
    // Recorded before connect, the way the renderer wires its bind: a listener added after connect runs after
    // the deck's own select listener, so it would see the nested action first.
    let log: ReturnType<typeof record> = []
    const el = make((d) => {
      d.actionName = 'pick_game'
      log = record(d)
    })
    card(el, 'blackjack').click()
    expect(log).toEqual([
      { type: 'select', detail: 'blackjack', value: 'blackjack' },
      { type: 'action', detail: { action: 'pick_game', context: { value: 'blackjack' } }, value: 'blackjack' },
    ])
  })

  it('no action without actionName', () => {
    const el = make()
    const log = record(el)
    card(el, 'draw').click()
    expect(log.filter((e) => e.type === 'action')).toEqual([])
  })

  it('a click on an inner part (the title) picks its card', () => {
    const el = make()
    const log = record(el)
    card(el, 'draw').querySelector<HTMLElement>('[data-part="title"]')!.click()
    expect(log.map((e) => e.detail)).toEqual(['draw'])
  })

  it('the Surprise me card commits "random" and carries the random label', () => {
    let log: ReturnType<typeof record> = []
    const el = make((d) => {
      d.allowRandom = true
      d.actionName = 'pick_game'
      d.randomLabel = 'Deal me in'
      log = record(d)
    })
    const random = cards(el).at(-1)!
    expect(random.dataset.key).toBe('random')
    expect(random.hasAttribute('data-random')).toBe(true)
    expect(random.querySelector('[data-part="title"]')?.textContent).toBe('Deal me in')
    expect(random.querySelector('[data-part="shuffle"]')).not.toBeNull()
    random.click()
    expect(log.map((e) => e.detail)).toEqual(['random', { action: 'pick_game', context: { value: 'random' } }])
    expect(el.value).toBe('random')
  })

  it('no Surprise me card without allowRandom', () => {
    const el = make()
    expect(el.querySelector('[data-random]')).toBeNull()
  })
})

describe('UIOptionDeckElement: the selected paint follows value', () => {
  it('setting el.value programmatically marks that card and shows the pill', async () => {
    const el = make()
    el.value = 'holdem'
    await tick()
    expect(card(el, 'holdem').getAttribute('aria-selected')).toBe('true')
    expect(card(el, 'holdem').querySelector('[data-part="pick"]')?.textContent).toBe('Your pick')
    expect(card(el, 'blackjack').getAttribute('aria-selected')).toBe('false')
    expect(el.querySelectorAll('[data-part="pick"]')).toHaveLength(1)
  })

  it('a re-pick moves the mark and the pill', async () => {
    const el = make((d) => {
      d.value = 'blackjack'
    })
    expect(card(el, 'blackjack').getAttribute('aria-selected')).toBe('true')
    card(el, 'draw').click()
    await tick()
    expect(card(el, 'blackjack').getAttribute('aria-selected')).toBe('false')
    expect(card(el, 'draw').getAttribute('aria-selected')).toBe('true')
    expect(el.querySelectorAll('[data-part="pick"]')).toHaveLength(1)
  })

  it('an options update patches the cards in place', async () => {
    const el = make()
    const first = card(el, 'blackjack')
    el.options = [{ value: 'blackjack', title: 'Blackjack 21' }]
    await tick()
    expect(cards(el)).toEqual([first])
    expect(first.querySelector('[data-part="title"]')?.textContent).toBe('Blackjack 21')
  })
})

describe('UIOptionDeckElement: disabled', () => {
  it('commits nothing: no select, no action, no value', () => {
    const el = make((d) => {
      d.disabled = true
      d.actionName = 'pick_game'
      d.allowRandom = true
    })
    const log = record(el)
    card(el, 'blackjack').click()
    cards(el).at(-1)!.click()
    expect(log).toEqual([])
    expect(el.value).toBe('')
    expect(el.probeInternals.ariaDisabled).toBe('true')
    expect(cards(el).every((c) => c.getAttribute('aria-disabled') === 'true' && c.tabIndex === -1)).toBe(true)
  })

  it('a re-enable restores one tab stop and the pick', async () => {
    const el = make((d) => {
      d.disabled = true
    })
    el.disabled = false
    await tick()
    expect(cards(el).map((c) => c.tabIndex)).toEqual([0, -1, -1])
    const log = record(el)
    card(el, 'draw').click()
    expect(log.map((e) => e.detail)).toEqual(['draw'])
  })
})
