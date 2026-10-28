import { describe, it, expect, afterEach } from 'vitest'
import { userEvent } from 'vitest/browser'
import { glyphBox } from '../../../../../../scripts/lib/foundations-rules.mjs' // the glyph box n + 6 (T-0374)

import '@agent-ui/components/foundation-styles.css'
import './board-grid.css'
import './board-grid.ts'
import { resolve, rootResolve } from '../../../../../../scripts/lib/foundations-model.mjs'

/** The derived root register (product / md / md, ADR-0245 Amendment 8). */
const ROOT = rootResolve('md')

// board-grid.browser.test.ts: real-engine truth for ui-board-grid (ADR-0243), Chromium + WebKit. The
// whole-shape law: the board's own bounding box in a realistic container, square cells at least 34px,
// fill by default versus `inline` hug, and the two-axis roving with REAL focus and real key events (the one
// thing jsdom cannot prove: a native button must not fire a second click on Enter or Space).

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

/** A realistic container: a 360px-wide column, the phone-width panel a chat surface gives a board. */
function mount(markup: string): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'inline-size:360px; padding:16px; box-sizing:border-box;'
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap.firstElementChild as HTMLElement
}

type Board = HTMLElement & { cells: unknown; updateComplete: Promise<void> }

const cells = (el: Element): HTMLElement[] => Array.from(el.querySelectorAll<HTMLElement>('[data-part="cell"]'))
const rect = (el: Element): DOMRect => el.getBoundingClientRect()

describe('ui-board-grid: whole shape', () => {
  it('a 6x6 board paints a real square board inside its container', () => {
    const el = mount('<ui-board-grid rows="6" cols="6" label="Enemy waters" action-name="fire"></ui-board-grid>')
    const all = cells(el)
    expect(all).toHaveLength(36)
    const first = rect(all[0]!)
    const last = rect(all[35]!)
    const boardW = last.right - first.left
    const boardH = last.bottom - first.top
    expect(boardW).toBeGreaterThanOrEqual(6 * 34)
    expect(Math.abs(boardW - boardH)).toBeLessThan(1) // a square board of square cells
    const host = rect(el)
    expect(first.left).toBeGreaterThanOrEqual(host.left)
    expect(last.right).toBeLessThanOrEqual(host.right + 0.5)
    expect(last.bottom).toBeLessThanOrEqual(host.bottom + 0.5)
    expect(Math.abs(host.height - boardH)).toBeLessThan(1) // no frame inset (T-0146): the host is the board
  })

  it('each cell is square with a side of at least 34px at the default size', () => {
    const el = mount('<ui-board-grid rows="8" cols="9"></ui-board-grid>')
    const all = cells(el)
    expect(all).toHaveLength(72)
    for (const c of all) {
      const r = rect(c)
      expect(r.width).toBeGreaterThanOrEqual(34)
      expect(Math.abs(r.width - r.height)).toBeLessThan(0.5)
    }
    // the rows sit on separate lines: the first cell of row 2 is below the first cell of row 1
    expect(rect(all[9]!).top).toBeGreaterThan(rect(all[0]!).bottom - 0.5)
  })

  it('a board with room paints the derived 6n cell; a narrow one gives way to the 34px floor and no further (ADR-0243 Amendment 2)', () => {
    // 6n at the root md (n 8): height 32 + icon box 16
    const cell = ROOT.height + ROOT.iconBox
    const roomy = mount('<ui-board-grid rows="6" cols="6"></ui-board-grid>')
    for (const c of cells(roomy)) {
      expect(rect(c).width).toBeCloseTo(cell, 1)
      expect(rect(c).height).toBeCloseTo(cell, 1)
    }
    const narrow = mount('<ui-board-grid rows="2" cols="9"></ui-board-grid>') // 9 x 48 + gaps overflows the 328px column
    const side = rect(cells(narrow)[0]!).width
    expect(side).toBeLessThan(cell)
    expect(side).toBeGreaterThanOrEqual(34)
    const tight = mount('<ui-board-grid rows="1" cols="12"></ui-board-grid>') // even 12 x 34 overflows: the floor holds
    for (const c of cells(tight)) expect(rect(c).width).toBeCloseTo(34, 1)
  })

  it('fills its container by default; inline hugs the board', () => {
    const fill = mount('<ui-board-grid rows="3" cols="3"></ui-board-grid>')
    const container = fill.parentElement!
    const inner = container.clientWidth - 32 // the wrap's 16px padding each side
    expect(Math.abs(rect(fill).width - inner)).toBeLessThan(1)

    const hug = mount('<ui-board-grid rows="3" cols="3" inline></ui-board-grid>')
    const all = cells(hug)
    const boardW = rect(all[2]!).right - rect(all[0]!).left
    expect(rect(hug).width).toBeLessThan(inner)
    expect(Math.abs(rect(hug).width - boardW)).toBeLessThan(1) // no frame inset: the hug is the board itself
  })
})

describe('ui-board-grid: the ADR-0046 box model (Amendment 7)', () => {
  it('no frame inset, the first cell on the host edge (T-0146); the cell gap is the derived 2px data-grid gap', () => {
    const el = mount(`<ui-board-grid rows="2" cols="3"></ui-board-grid>`)
    const [a, b] = cells(el)
    expect(rect(a!).left - rect(el).left).toBeCloseTo(0, 0)
    expect(rect(a!).top - rect(el).top).toBeCloseTo(0, 0)
    expect(rect(b!).left - rect(a!).right).toBeCloseTo(2, 0)
  })
})

describe('ui-board-grid: the corner glyph (ADR-0245 Amendment 6)', () => {
  it('sits in its own glyph box n + 6, inset c from the cell corner', async () => {
    const el = mount('<ui-board-grid rows="2" cols="2"></ui-board-grid>') as Board
    el.cells = [{ row: 0, col: 0, mark: '', intent: 'success' }]
    await el.updateComplete
    const cell = cells(el)[0]!
    const glyph = cell.querySelector('[data-part="intent"]') as HTMLElement
    expect(glyph.textContent).toBe('+')
    const box = rect(glyph)
    expect([box.width, box.height]).toEqual([glyphBox(ROOT), glyphBox(ROOT)])
    const border = Number.parseFloat(getComputedStyle(cell).borderRightWidth)
    expect(rect(cell).right - border - box.right, 'inline inset').toBeCloseTo(ROOT.c, 0)
    expect(rect(cell).bottom - Number.parseFloat(getComputedStyle(cell).borderBottomWidth) - box.bottom, 'block inset').toBeCloseTo(ROOT.c, 0)
  })
})

describe('ui-board-grid: the mark (T-0146)', () => {
  it('a letter is sized from its cell: font size half the cell side, cap height at least a third', async () => {
    const el = mount('<ui-board-grid rows="1" cols="5"></ui-board-grid>') as Board
    el.cells = [{ row: 0, col: 0, mark: 'S' }]
    await el.updateComplete
    const cell = cells(el)[0]!
    const side = rect(cell).width
    const size = Number.parseFloat(getComputedStyle(cell).fontSize)
    expect(size).toBeGreaterThanOrEqual(side / 2 - 2)
    expect(size * 0.68).toBeGreaterThanOrEqual(side / 3) // a sans cap height is about 0.7em
  })
})

describe('ui-board-grid: keyboard with real focus', () => {
  it('one tab stop; arrows rove by cell and row, skipping disabled cells; Enter and Space emit exactly once', async () => {
    const before = document.createElement('button')
    before.textContent = 'before'
    document.body.prepend(before)
    mounted.push(before)
    const el = mount('<ui-board-grid rows="3" cols="3" action-name="fire"></ui-board-grid>') as Board
    el.cells = [{ row: 0, col: 1, mark: 'x', intent: 'danger', disabled: true }]
    await el.updateComplete
    const all = cells(el)
    const log: unknown[] = []
    el.addEventListener('action', (e) => log.push((e as CustomEvent).detail))

    before.focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(all[0])

    await userEvent.keyboard('{ArrowRight}') // skips the disabled (0,1)
    expect(document.activeElement).toBe(all[2])
    await userEvent.keyboard('{ArrowRight}') // edge, no wrap
    expect(document.activeElement).toBe(all[2])
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(all[5])
    expect(all.filter((c) => c.getAttribute('tabindex') === '0')).toEqual([all[5]])

    await userEvent.keyboard('{Enter}')
    expect(log).toEqual([{ action: 'fire', context: { row: 1, col: 2 } }])
    await userEvent.keyboard(' ')
    expect(log).toHaveLength(2)
    expect(log[1]).toEqual({ action: 'fire', context: { row: 1, col: 2 } })

    await userEvent.tab() // one tab stop: Tab leaves the board
    expect(el.contains(document.activeElement)).toBe(false)
  })

  it('a read-only board roves with real focus and never emits', async () => {
    const el = mount('<ui-board-grid rows="2" cols="2"></ui-board-grid>')
    const all = cells(el)
    const log: unknown[] = []
    el.addEventListener('action', (e) => log.push(e))
    all[0]!.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(all[2])
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(log).toHaveLength(0)
  })
})

// ADR-0245 geometry pin (clause 10c): the migrated tokens read the derived foundation inside an opt-in
// data-tier region and today's value outside it. Values are foundations-model.mjs resolve('product', 'sm', 'md') (the region below, not the root): n 6,
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

describe('ui-board-grid: ADR-0245 derived foundations, dark launch', () => {
  it('reads today\'s value outside a data-tier region and the derived value inside', () => {
    const { out, inside } = foundationsPair('ui-board-grid', 'rows="3" cols="3"')
    expect(lengthOf(out, '--ui-board-grid-cell-size')).toBe(46)
    const sm = resolve('product', 'sm', 'md') // the explicit product / sm region
    expect(lengthOf(inside, '--ui-board-grid-cell-size')).toBe(sm.height + sm.iconBox) // 6n = height 24 + icon box 12
  })
})
