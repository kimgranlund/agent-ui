import { describe, it, expect, afterEach } from 'vitest'
import { server, userEvent } from 'vitest/browser'
import { glyphBox } from '../../../../../../scripts/lib/foundations-rules.mjs' // the glyph box n + 6 (T-0374)

// amount-picker.browser.test.ts: the real-engine proof for ui-amount-picker (T-0196 Design, Test plan), in Chromium
// and WebKit. jsdom is blind to layout, focus order and the real slider drag, so this covers the keyboard map on
// the readout, the tab order (minus and plus skipped), the slider and readout staying in sync with one `change`
// per release, ARIA through internals and the readout part, the geometry at widget md (24px rows, square steps,
// the glyph box) and the sizing gate (fill by default, hug under `inline`).
//
// Side-effect imports, load-bearing order (ADR-0003): foundation roles and ramps first, then the sheets, then the
// controls.
import '@agent-ui/components/foundation-styles.css'
import '../glyph/glyph.css'
import '../slider/slider.css'
import './amount-picker.css'
import './amount-picker.ts'
import type { UIAmountPickerElement } from './amount-picker.ts'
import { resolve } from '../../../../../../scripts/lib/foundations-model.mjs'

/** The A2UI canvas register: widget / md (20 / 24 / 28 px controls, ADR-0245 Amendments 2 and 8). */
const WIDGET = resolve('widget', 'md', 'md')

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const canvas = (width = '360px'): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.setAttribute('data-tier', 'widget')
  wrap.setAttribute('data-scale', 'md')
  wrap.style.cssText = `inline-size:${width}; padding:0; margin:0;`
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap
}

const picker = async (attrs: Record<string, string>, parent = canvas()): Promise<UIAmountPickerElement> => {
  const el = document.createElement('ui-amount-picker') as UIAmountPickerElement
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  parent.append(el)
  await el.updateComplete
  await new Promise((r) => requestAnimationFrame(() => r(null)))
  return el
}

const part = <T extends HTMLElement = HTMLElement>(el: Element, name: string): T => el.querySelector(`:scope [data-part="${name}"]`) as T
const rect = (node: Element): DOMRect => node.getBoundingClientRect()

const record = (el: HTMLElement): string[] => {
  const log: string[] = []
  for (const type of ['input', 'change', 'action']) {
    el.addEventListener(type, (event) => {
      if (event.target === el) log.push(`${type}:${(el as UIAmountPickerElement).value}`)
    })
  }
  return log
}

describe('ui-amount-picker: keyboard on the readout', () => {
  it('arrows step, PageUp/PageDown move 10 steps, Home/End reach the bounds; change fires once on blur', async () => {
    const el = await picker({ min: '0', max: '100', step: '2', value: '10', label: 'Amount' })
    const log = record(el)
    part(el, 'readout').focus()
    await userEvent.keyboard('{ArrowUp}{ArrowRight}')
    expect(el.value).toBe(14)
    await userEvent.keyboard('{ArrowDown}{ArrowLeft}')
    expect(el.value).toBe(10)
    await userEvent.keyboard('{PageUp}')
    expect(el.value).toBe(30)
    await userEvent.keyboard('{PageDown}')
    expect(el.value).toBe(10)
    await userEvent.keyboard('{End}')
    expect(el.value).toBe(100)
    await userEvent.keyboard('{Home}')
    expect(el.value).toBe(0)
    expect(log.every((e) => e.startsWith('input:'))).toBe(true)
    part(el, 'readout').blur()
    expect(log.at(-1)).toBe('change:0')
    expect(log.filter((e) => e.startsWith('change')).length).toBe(1)
  })

  it('Enter fires the pending change and then the action with the value', async () => {
    const el = await picker({ min: '1', max: '8', value: '2', 'action-name': 'set_guests' })
    const log = record(el)
    let detail: unknown
    el.addEventListener('action', (e) => { detail = (e as CustomEvent).detail })
    part(el, 'readout').focus()
    await userEvent.keyboard('{ArrowUp}{Enter}')
    expect(log).toEqual(['input:3', 'change:3', 'action:3'])
    expect(detail).toEqual({ action: 'set_guests', context: { value: 3 } })
  })
})

describe('ui-amount-picker: tab order', () => {
  it('Tab reaches the readout, then the chips, then the commit; minus and plus are skipped', async () => {
    const before = document.createElement('button')
    before.textContent = 'before'
    const wrap = canvas()
    wrap.append(before)
    const el = await picker({ min: '1', max: '20', value: '4', presets: '[1,2]', 'action-name': 'add' }, wrap)
    before.focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(part(el, 'readout'))
    if (server.browser === 'webkit') {
      // WebKit's default Tab skips every <button> (the macOS full-keyboard-access setting), so only the step
      // buttons' exclusion is engine-independent: focus never lands on minus or plus.
      await userEvent.tab()
      expect(['decrease', 'increase']).not.toContain(document.activeElement?.getAttribute('data-part'))
      return
    }
    await userEvent.tab()
    expect(document.activeElement?.getAttribute('data-part')).toBe('preset')
    await userEvent.tab()
    expect(document.activeElement?.getAttribute('data-part')).toBe('preset')
    await userEvent.tab()
    expect(document.activeElement).toBe(part(el, 'commit'))
  })
})

describe('ui-amount-picker: slider sync', () => {
  it('a slider drag moves the value and readout live and fires one change on release', async () => {
    const el = await picker({ min: '0', max: '100', step: '10', value: '20', slider: '', label: 'Offer' }, canvas('300px'))
    const log = record(el)
    const slider = part(el, 'slider')
    const rail = slider.querySelector('.rail') as HTMLElement
    rail.setPointerCapture = (): void => {}
    const r = rect(rail)
    const at = (type: string, ratio: number): void => {
      rail.dispatchEvent(new PointerEvent(type, { clientX: r.left + r.width * ratio, clientY: r.top + r.height / 2, pointerId: 7, bubbles: true, cancelable: true, button: 0 }))
    }
    at('pointerdown', 0.5)
    at('pointermove', 0.8)
    await el.updateComplete
    expect(el.value).toBe(80)
    expect(part(el, 'readout').textContent).toBe('80')
    at('pointerup', 0.8)
    expect(log.filter((e) => e.startsWith('change'))).toEqual(['change:80'])
    expect(log.filter((e) => e.startsWith('input')).length).toBeGreaterThan(0)

    el.value = 30 // a programmatic write moves the slider and fires nothing
    await el.updateComplete
    expect((slider as HTMLElement & { value: number }).value).toBe(30)
    expect(log.filter((e) => e.startsWith('change')).length).toBe(1)
  })
})

describe('ui-amount-picker: ARIA', () => {
  it('the host is a named group through internals and the readout carries the spinbutton values', async () => {
    const el = await picker({ min: '5', max: '250', value: '25', currency: 'USD', label: 'Bet' })
    expect(el.getAttribute('role')).toBeNull()
    expect(el.getAttribute('aria-label')).toBeNull()
    const readout = part(el, 'readout')
    expect(readout.getAttribute('role')).toBe('spinbutton')
    expect(readout.getAttribute('aria-valuenow')).toBe('25')
    expect(readout.getAttribute('aria-valuetext')).toBe('$25.00')
    expect(part(el, 'label').getAttribute('aria-hidden')).toBe('true')
  })
})

describe('ui-amount-picker: geometry at widget md', () => {
  it('every row is the 24px control height; the step buttons are square; the glyph box is n + 6', async () => {
    const el = await picker({ min: '1', max: '20', value: '4', presets: '[1,2,4,8]', slider: '', 'action-name': 'add', label: 'Quantity' })
    const h = WIDGET.height
    expect(h).toBe(24)
    for (const name of ['decrease', 'increase', 'readout', 'commit']) expect(rect(part(el, name)).height).toBe(h)
    for (const chip of el.querySelectorAll('[data-part="preset"]')) expect(rect(chip).height).toBe(h)
    expect(rect(part(el, 'decrease')).width).toBe(h)
    expect(rect(part(el, 'increase')).width).toBe(h)
    const svg = part(el, 'decrease').querySelector('svg')!
    expect(rect(svg).width).toBe(glyphBox(WIDGET))
  })

  it('size sm and lg take the 20 and 28 rows', async () => {
    const sm = await picker({ size: 'sm' })
    const lg = await picker({ size: 'lg' })
    expect(rect(part(sm, 'readout')).height).toBe(resolve('widget', 'md', 'sm').height)
    expect(rect(part(lg, 'readout')).height).toBe(resolve('widget', 'md', 'lg').height)
  })
})

describe('ui-amount-picker: sizing (ADR-0223)', () => {
  it('fills its container by default and hugs under inline', async () => {
    const wrap = canvas('360px')
    const fill = await picker({ value: '3' }, wrap)
    expect(getComputedStyle(fill).display).toBe('grid')
    expect(rect(fill).width).toBe(360)
    const hug = await picker({ value: '3', inline: '' }, wrap)
    expect(getComputedStyle(hug).display).toBe('inline-grid')
    expect(rect(hug).width).toBeLessThan(360)
  })
})
