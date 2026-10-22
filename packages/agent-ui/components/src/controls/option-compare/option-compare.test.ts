import { describe, it, expect, afterEach } from 'vitest'
import { UIOptionCompareElement } from './option-compare.ts'
import { cleanOptions, cleanRows, optionsProp, rowsProp } from './option-compare-model.ts'

// option-compare.test.ts: jsdom probes for ui-option-compare (T-0393, the Option compare forks 10 to 16). jsdom
// cannot prove paint, focus order, sticky or scroll (option-compare.browser.test.ts owns those); this pins the
// declared behaviour: the codecs, the column and cell counts, the empty cell, the best mark, the
// one-select-one-action channel, the value-keyed Your pick pill and each column's accessible description.

class ProbeOptionCompare extends UIOptionCompareElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-option-compare-probe', ProbeOptionCompare)

const ROWS = [
  { key: 'duration', label: 'Duration' },
  { key: 'price', label: 'Price' },
  { key: 'departs', label: 'Departs' },
  { key: 'changes', label: 'Changes' },
]
const OPTIONS = [
  { value: 'train', title: 'Train', subtitle: 'Alfa Pendular', values: { duration: '2h 50m', price: 'EUR 32', departs: '09:09', changes: 'None' } },
  { value: 'bus', title: 'Bus', subtitle: 'Rede Expressos', values: { duration: '3h 30m', price: 'EUR 19', departs: '08:30', changes: 'None' } },
  { value: 'flight', title: 'Flight', values: { duration: '55m', price: 'EUR 89', departs: '11:15' } }, // no `changes`
]

const mounted: HTMLElement[] = []
function make(init: (el: ProbeOptionCompare) => void = () => {}): ProbeOptionCompare {
  const el = new ProbeOptionCompare()
  el.rows = ROWS
  el.options = OPTIONS
  init(el)
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const columns = (el: Element): HTMLElement[] => Array.from(el.querySelectorAll('[data-part="option"]'))
const column = (el: Element, key: string): HTMLElement => el.querySelector(`[data-part="option"][data-key="${key}"]`)!
const cellsOf = (col: Element): HTMLElement[] => Array.from(col.querySelectorAll('[data-part="cell"]'))
/** A cell's visible value: its text minus the hidden row label. */
const valueOf = (cell: Element): string => (cell.lastChild?.textContent ?? '').trim()
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/** The accessible description the way a reader assembles it: each referenced node's text, in order. */
const description = (col: Element): string =>
  (col.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter((id) => id !== '')
    .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
    .join(', ')

/** Every `select` and `action` the control fires, in order. */
function record(el: HTMLElement): { type: string; detail: unknown; value: string }[] {
  const log: { type: string; detail: unknown; value: string }[] = []
  for (const type of ['select', 'action']) {
    el.addEventListener(type, (e) => log.push({ type, detail: (e as CustomEvent).detail, value: (el as UIOptionCompareElement).value }))
  }
  return log
}

describe('option-compare-model: the codecs', () => {
  it('a non-array and malformed JSON become []', () => {
    expect(cleanOptions(undefined)).toEqual([])
    expect(cleanRows({ key: 'a', label: 'A' })).toEqual([])
    expect(optionsProp.type.from('{not json')).toEqual([])
    expect(rowsProp.type.from(null)).toEqual([])
  })

  it('drops options without a value or a title, repeats and non-objects; values keep only text', () => {
    const out = cleanOptions([{ value: 'a' }, { title: 'B' }, 'c', { value: 'd', title: 'D', values: { x: ' 1 ', y: 2, z: {}, w: '' } }, { value: 'd', title: 'D again' }])
    expect(out).toEqual([{ value: 'd', title: 'D', values: { x: '1', y: '2' } }])
  })

  it('drops rows without a key or a label, and repeated keys', () => {
    expect(cleanRows([{ key: 'a' }, { label: 'B' }, { key: 'c', label: 'C' }, { key: 'c', label: 'C2' }])).toEqual([{ key: 'c', label: 'C' }])
  })

  it('the attribute form parses through the codecs', () => {
    const el = document.createElement('ui-option-compare') as UIOptionCompareElement
    el.setAttribute('rows', JSON.stringify([{ key: 'p', label: 'Price' }]))
    el.setAttribute('options', JSON.stringify([{ value: 'x', title: 'X', values: { p: 'EUR 5' } }]))
    document.body.append(el)
    mounted.push(el)
    expect(columns(el).map((c) => c.dataset.key)).toEqual(['x'])
    expect(valueOf(cellsOf(columns(el)[0]!)[0]!)).toBe('EUR 5')
  })
})

describe('UIOptionCompareElement: anatomy', () => {
  it('renders one column per option and one cell per row in each, plus one label per row', () => {
    const el = make()
    expect(columns(el).map((c) => c.dataset.key)).toEqual(['train', 'bus', 'flight'])
    for (const col of columns(el)) expect(cellsOf(col)).toHaveLength(4)
    expect(Array.from(el.querySelectorAll('[data-part="labels"] > [data-part="label"]')).map((l) => l.textContent)).toEqual([
      'Duration', 'Price', 'Departs', 'Changes',
    ])
    expect(el.querySelector('[data-part="labels"]')?.getAttribute('aria-hidden')).toBe('true')
    const grid = el.querySelector<HTMLElement>('[data-part="grid"]')!
    expect(grid.style.getPropertyValue('--ui-option-compare-columns')).toBe('3')
    expect(grid.style.getPropertyValue('--ui-option-compare-rows')).toBe('5')
  })

  it('a column with no value for a row key renders an empty cell', () => {
    const el = make()
    const changes = cellsOf(column(el, 'flight'))[3]!
    expect(valueOf(changes)).toBe('')
    expect(changes.querySelector('[data-part="cell-label"]')?.textContent).toBe('Changes')
    expect(valueOf(cellsOf(column(el, 'train'))[3]!)).toBe('None')
  })

  it('an options or rows update patches the columns in place', async () => {
    const el = make()
    const first = column(el, 'train')
    el.options = [{ value: 'train', title: 'Train 2', values: { duration: '2h' } }]
    el.rows = ROWS.slice(0, 2)
    await tick()
    expect(columns(el)).toEqual([first])
    expect(first.querySelector('[data-part="title"]')?.textContent).toBe('Train 2')
    expect(cellsOf(first)).toHaveLength(2)
    expect(el.querySelectorAll('[data-part="label"]')).toHaveLength(2)
  })

  it('has no ui-button descendant and no native form element', () => {
    const el = make()
    expect(el.querySelector('ui-button, button, input, select, textarea')).toBeNull()
  })

  it('holds exactly one tab stop', () => {
    const el = make()
    expect(columns(el).map((c) => c.tabIndex)).toEqual([0, -1, -1])
  })
})

describe('UIOptionCompareElement: ARIA', () => {
  it('the host is a listbox named by heading, else "Options", and no empty heading part renders', async () => {
    const el = make()
    expect(el.probeInternals.role).toBe('listbox')
    expect(el.probeInternals.ariaLabel).toBe('Options')
    expect(el.querySelector('[data-part="heading"]')).toBeNull()
    el.heading = 'Lisbon to Porto'
    await tick()
    expect(el.probeInternals.ariaLabel).toBe('Lisbon to Porto')
    expect(el.querySelector('[data-part="heading"]')?.textContent).toBe('Lisbon to Porto')
  })

  it('each column is an option named by its title', () => {
    const el = make()
    for (const col of columns(el)) {
      expect(col.getAttribute('role')).toBe('option')
      expect(col.getAttribute('aria-selected')).toBe('false')
      expect(document.getElementById(col.getAttribute('aria-labelledby')!)?.textContent).toBe(col.querySelector('[data-part="title"]')?.textContent)
    }
  })

  it("each option's accessible description holds every row label and value", () => {
    const el = make()
    expect(description(column(el, 'train'))).toBe('Alfa Pendular, Duration 2h 50m, Price EUR 32, Departs 09:09, Changes None')
    expect(description(column(el, 'bus'))).toBe('Rede Expressos, Duration 3h 30m, Price EUR 19, Departs 08:30, Changes None')
    // No subtitle and an empty cell: neither is described.
    expect(description(column(el, 'flight'))).toBe('Duration 55m, Price EUR 89, Departs 11:15')
  })
})

describe('UIOptionCompareElement: best', () => {
  it('best marks only its own column, with a Best pill holding a star, also described', () => {
    const el = make((d) => {
      d.best = 'train'
    })
    expect(columns(el).map((c) => c.hasAttribute('data-best'))).toEqual([true, false, false])
    const pills = el.querySelectorAll('[data-part="pill"]')
    expect(pills).toHaveLength(1)
    const pill = column(el, 'train').querySelector('[data-part="pill"]')!
    expect(pill.textContent).toBe('Best')
    expect(pill.getAttribute('data-kind')).toBe('best')
    expect(pill.querySelector('svg path')?.getAttribute('d')).toMatch(/^M8 2l/)
    expect(description(column(el, 'train')).startsWith('Best, Alfa Pendular')).toBe(true)
  })

  it('a best value that names no option marks nothing', () => {
    const el = make((d) => {
      d.best = 'boat'
    })
    expect(el.querySelector('[data-best]')).toBeNull()
    expect(el.querySelector('[data-part="pill"]')).toBeNull()
  })
})

describe('UIOptionCompareElement: one pick, one select, one action', () => {
  it('a pick fires one select, and one action only when actionName is set', () => {
    // Recorded before connect, the way the renderer wires its bind (the option-deck.test.ts note).
    let log: ReturnType<typeof record> = []
    const el = make((d) => {
      d.actionName = 'pick_leg'
      log = record(d)
    })
    column(el, 'bus').click()
    expect(log).toEqual([
      { type: 'select', detail: 'bus', value: 'bus' },
      { type: 'action', detail: { action: 'pick_leg', context: { value: 'bus' } }, value: 'bus' },
    ])

    const plain = make()
    const plainLog = record(plain)
    column(plain, 'flight').click()
    expect(plainLog).toEqual([{ type: 'select', detail: 'flight', value: 'flight' }])
  })

  it('a click on a cell picks its column', () => {
    const el = make()
    const log = record(el)
    cellsOf(column(el, 'train'))[1]!.click()
    expect(log.map((e) => e.detail)).toEqual(['train'])
  })

  it('a click on the label column picks nothing', () => {
    const el = make()
    const log = record(el)
    el.querySelector<HTMLElement>('[data-part="label"]')!.click()
    expect(log).toEqual([])
    expect(el.value).toBe('')
  })
})

describe('UIOptionCompareElement: the Your pick pill', () => {
  it('the "Your pick" pill moves with value', async () => {
    const el = make((d) => {
      d.best = 'train'
    })
    el.value = 'bus'
    await tick()
    const pick = (): HTMLElement[] => Array.from(el.querySelectorAll<HTMLElement>('[data-part="pill"][data-kind="pick"]'))
    expect(pick().map((p) => p.closest<HTMLElement>('[data-part="option"]')!.dataset.key)).toEqual(['bus'])
    expect(pick()[0]!.textContent).toBe('Your pick')
    expect(pick()[0]!.querySelector('svg path')?.getAttribute('d')).toMatch(/^M3 8\.5/)
    expect(column(el, 'bus').getAttribute('aria-selected')).toBe('true')

    column(el, 'flight').click()
    await tick()
    expect(pick().map((p) => p.closest<HTMLElement>('[data-part="option"]')!.dataset.key)).toEqual(['flight'])
    expect(column(el, 'bus').getAttribute('aria-selected')).toBe('false')
    expect(column(el, 'bus').querySelector('[data-part="pill"]')).toBeNull()
  })

  it('a picked best column shows Your pick and keeps data-best', async () => {
    const el = make((d) => {
      d.best = 'train'
      d.value = 'train'
    })
    const train = column(el, 'train')
    expect(train.hasAttribute('data-best')).toBe(true)
    expect(train.querySelectorAll('[data-part="pill"]')).toHaveLength(1)
    expect(train.querySelector('[data-part="pill"]')?.textContent).toBe('Your pick')
    el.value = ''
    await tick()
    expect(train.querySelector('[data-part="pill"]')?.textContent).toBe('Best')
  })
})
