import { describe, it, expect, afterEach } from 'vitest'
import { userEvent } from 'vitest/browser'

// option-compare.browser.test.ts: the real-engine proof for ui-option-compare (T-0393, the Option compare forks 10
// to 16, Direction A). jsdom has no focus order, no layout and no scrolling, so this covers the roving tab stop
// and arrow keys, Enter and Space each picking once, the rows aligning across columns through subgrid, a fourth
// option at the 400px column scrolling inside the control with the label column pinned, and the host keeping a
// width inside a shrink-to-fit parent. Runs in Chromium and WebKit through the `packages` project instances.
//
// Side-effect imports, load-bearing order (ADR-0003): foundation roles and ramps first, then the sheet, then the
// control.
import '@agent-ui/components/foundation-styles.css'
import './option-compare.css'
import './option-compare.ts'
import type { UIOptionCompareElement } from './option-compare.ts'

const ROWS = [
  { key: 'duration', label: 'Duration' },
  { key: 'price', label: 'Price' },
  { key: 'departs', label: 'Departs' },
  { key: 'changes', label: 'Changes' },
]
const TRAIN = { value: 'train', title: 'Train', subtitle: 'Alfa Pendular', values: { duration: '2h 50m', price: 'EUR 32', departs: '09:09', changes: 'None' } }
const BUS = { value: 'bus', title: 'Bus', subtitle: 'Rede Expressos', values: { duration: '3h 30m', price: 'EUR 19', departs: '08:30', changes: 'None' } }
const FLIGHT = { value: 'flight', title: 'Flight', subtitle: 'TP 1940', values: { duration: '55m', price: 'EUR 89', departs: '11:15', changes: 'None' } }
const CAR = { value: 'car', title: 'Car', subtitle: 'Rental, A1', values: { duration: '3h 10m', price: 'EUR 64', departs: 'Any', changes: 'None' } }

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

/** A control on the A2UI canvas register (widget / md) inside a container of `width`, with its select log. */
async function mount(width: string, props: Partial<UIOptionCompareElement> = {}): Promise<{ host: UIOptionCompareElement; selects: unknown[] }> {
  const wrap = document.createElement('div')
  wrap.dataset.tier = 'widget'
  wrap.dataset.scale = 'md'
  // The column holds the A2UI canvas, whose widget margin pads the surface (the mockup's 400px column tile).
  wrap.style.cssText = `inline-size:${width}; box-sizing:border-box; padding:var(--md-sys-widget-margin); margin:0;`
  const host = document.createElement('ui-option-compare') as UIOptionCompareElement
  Object.assign(host, { heading: 'Lisbon to Porto', best: 'train', rows: ROWS, options: [TRAIN, BUS, FLIGHT], ...props })
  const selects: unknown[] = []
  host.addEventListener('select', (e) => selects.push((e as CustomEvent).detail))
  wrap.append(host)
  document.body.append(wrap)
  mounted.push(wrap)
  await host.updateComplete
  return { host, selects }
}

const columns = (host: Element): HTMLElement[] => Array.from(host.querySelectorAll('[data-part="option"]'))
const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('ui-option-compare: roving focus', () => {
  it('Tab lands on the one tab stop, and the arrow keys, Home and End move through the columns in tree order', async () => {
    const { host } = await mount('40rem')
    const [a, b, c] = columns(host)
    await userEvent.tab()
    expect(document.activeElement).toBe(a)
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(b)
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(c)
    await userEvent.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(b)
    await userEvent.keyboard('{End}')
    expect(document.activeElement).toBe(c)
    await userEvent.keyboard('{Home}')
    expect(document.activeElement).toBe(a)
    expect(columns(host).map((col) => col.tabIndex)).toEqual([0, -1, -1])
  })
})

describe('ui-option-compare: Enter and Space pick once', () => {
  it('Enter on the focused column fires one select with its value', async () => {
    const { host, selects } = await mount('40rem')
    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}')
    await userEvent.keyboard('{Enter}')
    expect(selects).toEqual(['bus'])
    expect(host.value).toBe('bus')
    expect(columns(host)[1]!.getAttribute('aria-selected')).toBe('true')
  })

  it('Space on the focused column fires one select with its value', async () => {
    const { host, selects } = await mount('40rem')
    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    await userEvent.keyboard(' ')
    expect(selects).toEqual(['flight'])
    expect(host.value).toBe('flight')
  })
})

describe('ui-option-compare: the rows align across columns', () => {
  it('each row label and every cell of that row share one top edge (subgrid)', async () => {
    const { host } = await mount('40rem', { options: [TRAIN, { value: 'bus', title: 'Bus', values: BUS.values }, FLIGHT] })
    const labels = Array.from(host.querySelectorAll<HTMLElement>('[data-part="label"]'))
    expect(labels).toHaveLength(4)
    labels.forEach((label, row) => {
      for (const col of columns(host)) {
        // The label and cell are each centred in the shared row, at the same type size or one step apart, so their
        // centres agree; the rows themselves are one subgrid track.
        const cell = col.querySelectorAll<HTMLElement>('[data-part="cell"]')[row]!
        const c = cell.getBoundingClientRect()
        const l = label.getBoundingClientRect()
        expect(Math.abs((c.top + c.bottom) / 2 - (l.top + l.bottom) / 2)).toBeLessThanOrEqual(1.5)
      }
    })
  })
})

describe('ui-option-compare: the 400px column', () => {
  it('a fourth option at the 400px column scrolls inside the control', async () => {
    const { host } = await mount('400px', { options: [TRAIN, BUS, FLIGHT, CAR] })
    const scroller = host.querySelector<HTMLElement>('[data-part="scroller"]')!
    const labels = host.querySelector<HTMLElement>('[data-part="labels"]')!
    // The scroller overflows; the host does not, and stays inside the column.
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth)
    expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth)
    expect(host.getBoundingClientRect().width).toBeLessThanOrEqual(400)

    const labelsStart = labels.getBoundingClientRect().left
    const car = columns(host)[3]!
    const carBefore = car.getBoundingClientRect().left
    scroller.scrollLeft = scroller.scrollWidth
    await frame()
    expect(scroller.scrollLeft).toBeGreaterThan(0)
    // The option tracks moved under the pinned label column, which kept its inline-start edge.
    expect(car.getBoundingClientRect().left).toBeLessThan(carBefore - 1)
    expect(labels.getBoundingClientRect().left).toBeCloseTo(labelsStart, 0)
    // And the last column is now fully in view inside the scroller.
    expect(car.getBoundingClientRect().right).toBeLessThanOrEqual(scroller.getBoundingClientRect().right + 0.5)
  })

  it('three options at the 400px column fit without scrolling (negative control for the overflow check)', async () => {
    const { host } = await mount('400px')
    const scroller = host.querySelector<HTMLElement>('[data-part="scroller"]')!
    expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth)
  })
})

// The host declares no container (the T-0387 and T-0388 lesson), so under a parent that sizes its child to content
// it keeps its intrinsic width instead of collapsing to 0px.
describe('ui-option-compare: keeps a width inside a shrink-to-fit parent', () => {
  const PARENTS: Record<string, string> = {
    'a centring column': 'display:flex; flex-direction:column; align-items:center;',
    'a flex row': 'display:flex; flex-direction:row;',
    'a centring grid cell': 'display:grid; justify-items:center;',
  }
  for (const [name, css] of Object.entries(PARENTS)) {
    it(`nested in ${name}, every column has a width`, async () => {
      const { host } = await mount('40rem')
      const parent = document.createElement('div')
      parent.style.cssText = css
      host.parentElement!.append(parent)
      parent.append(host)
      await host.updateComplete
      expect(host.getBoundingClientRect().width).toBeGreaterThan(0)
      for (const col of columns(host)) expect(col.getBoundingClientRect().width).toBeGreaterThan(0)
    })
  }
})
