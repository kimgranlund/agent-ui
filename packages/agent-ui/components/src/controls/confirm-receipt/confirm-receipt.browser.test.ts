import { describe, it, expect, afterEach } from 'vitest'
import { userEvent } from 'vitest/browser'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import { glyphBox, rootResolve } from '../../../../../../scripts/lib/foundations-rules.mjs' // the glyph box n + 6 (T-0374)

// confirm-receipt.browser.test.ts: the real-engine painted proof for ui-confirm-receipt (T-0195, Direction A).
// jsdom is blind to layout, so this covers the whole-shape fill and hug, the actions row under the record card and
// outside it, Back and Confirm at their own lg step (40px at the root, 28px on an A2UI canvas, ADR-0245
// Amendment 2), the record spacing by computed geometry, the settled receipt and the 400px column.
//
// Side-effect imports, load-bearing order (ADR-0003): foundation roles and ramps first, then the sheet, then the
// control.
import '@agent-ui/components/foundation-styles.css'
import './confirm-receipt.css'
import './confirm-receipt.ts'
import type { UIConfirmReceiptElement } from './confirm-receipt.ts'

const mounted: HTMLElement[] = []
const container = (width: string, attrs: Record<string, string> = {}): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.style.cssText = `inline-size:${width}; padding:0; margin:0;`
  for (const [k, v] of Object.entries(attrs)) wrap.setAttribute(k, v)
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const receipt = (parent: HTMLElement, init: (el: UIConfirmReceiptElement) => void): UIConfirmReceiptElement => {
  const el = document.createElement('ui-confirm-receipt') as UIConfirmReceiptElement
  init(el)
  parent.append(el)
  return el
}

const settle = async (el: UIConfirmReceiptElement): Promise<void> => {
  await el.updateComplete
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
}

const booking = (el: UIConfirmReceiptElement): void => {
  el.title = 'Your stay'
  el.rows = [
    { label: 'Arrival', path: 'checkIn' },
    { label: 'Departure', path: 'checkOut' },
    { label: 'Guests', path: 'guests' },
  ]
  el.total = { label: 'Total, 3 nights', path: 'total' }
  el.data = { checkIn: '2026-10-12', checkOut: '2026-10-15', guests: '2', total: '$1,140.00', ref: 'Booking HX-2214' }
  el.refPath = 'ref'
  el.confirmAction = { action: 'confirm_booking' }
  el.backAction = { action: 'edit_booking' }
}

const order = (el: UIConfirmReceiptElement): void => {
  el.title = 'Your order'
  el.items = [
    { label: 'Linen tea towel', quantity: 2, amount: '$24.00' },
    { label: 'Stoneware mug, sand', quantity: 1, amount: '$18.00' },
    { label: 'Beeswax candle with a long name that wraps in a narrow column', quantity: 3, amount: '$27.00' },
  ]
  el.rows = [
    { label: 'Subtotal', path: 'subtotal' },
    { label: 'Shipping', path: 'shipping' },
  ]
  el.total = { label: 'Total', path: 'total' }
  el.data = { subtotal: '$69.00', shipping: '$6.00', total: '$75.00', ref: 'Order #10482' }
  el.refPath = 'ref'
  el.confirmAction = { action: 'place_order' }
  el.backAction = { action: 'edit_cart' }
}

/** A token's length read through layout on a probe inside `host`. */
const lengthOf = (host: HTMLElement, token: string): number => {
  const probe = document.createElement('span')
  probe.style.cssText = `position:absolute;block-size:1px;inline-size:var(${token});`
  host.append(probe)
  const width = Number.parseFloat(getComputedStyle(probe).inlineSize)
  probe.remove()
  return width
}

const partOf = (el: Element, name: string): HTMLElement => el.querySelector(`[data-part="${name}"]`) as HTMLElement

describe('ui-confirm-receipt: sizing (ADR-0223)', () => {
  it('fills its container by default and hugs under inline', async () => {
    const wrap = container('640px')
    const fill = receipt(wrap, booking)
    await settle(fill)
    const wrapBox = wrap.getBoundingClientRect()
    const fillBox = fill.getBoundingClientRect()
    expect(fillBox.height, 'the receipt painted zero height').toBeGreaterThan(0)
    expect(fillBox.width).toBeCloseTo(wrapBox.width, 0)

    const hug = receipt(wrap, (c) => {
      c.title = 'Hi'
      c.inline = true
    })
    await settle(hug)
    expect(hug.hasAttribute('inline')).toBe(true)
    expect(hug.getBoundingClientRect().width).toBeGreaterThan(0)
    expect(hug.getBoundingClientRect().width).toBeLessThan(wrapBox.width / 2)
  })
})

describe('ui-confirm-receipt: Direction A, the record card with the actions row outside it', () => {
  it('the actions row sits under the record, one widget gutter below, outside its box', async () => {
    const el = receipt(container('480px'), booking)
    await settle(el)
    const record = partOf(el, 'record').getBoundingClientRect()
    const actions = partOf(el, 'actions').getBoundingClientRect()
    expect(actions.top - record.bottom).toBeCloseTo(lengthOf(el, '--md-sys-widget-gutter'), 0)
    for (const name of ['back', 'confirm']) {
      const b = partOf(el, name).getBoundingClientRect()
      expect(b.top, `${name} starts below the record`).toBeGreaterThanOrEqual(record.bottom)
    }
  })

  it('the record ink sits the border plus 2 x inset from its edge; the card has its card radius', async () => {
    const el = receipt(container('480px'), booking)
    await settle(el)
    const recordEl = partOf(el, 'record')
    const record = recordEl.getBoundingClientRect()
    const header = partOf(el, 'header').getBoundingClientRect()
    const style = getComputedStyle(recordEl)
    expect(parseFloat(style.borderTopWidth)).toBe(1)
    const inset = lengthOf(el, '--md-sys-inset')
    expect(inset).toBeGreaterThan(0)
    expect(header.left - record.left).toBeCloseTo(1 + 2 * inset, 0)
    expect(header.top - record.top).toBeCloseTo(1 + 2 * inset, 0)
    expect(parseFloat(style.borderTopLeftRadius)).toBeCloseTo(lengthOf(el, '--md-sys-card-radius'), 0)
  })

  it('Back sits at the start and Confirm at the end of the actions row, on one line', async () => {
    const el = receipt(container('480px'), booking)
    await settle(el)
    const actions = partOf(el, 'actions').getBoundingClientRect()
    const back = partOf(el, 'back').getBoundingClientRect()
    const confirm = partOf(el, 'confirm').getBoundingClientRect()
    expect(back.left).toBeCloseTo(actions.left, 0)
    expect(confirm.right).toBeCloseTo(actions.right, 0)
    expect(back.top).toBeCloseTo(confirm.top, 0)
    expect(confirm.width).toBeGreaterThanOrEqual(actions.width * 0.4 - 0.5)
  })

  it('the total sits under a strong rule c wide; rows divide on a hairline', async () => {
    const el = receipt(container('480px'), booking)
    await settle(el)
    const total = getComputedStyle(partOf(el, 'total'))
    expect(parseFloat(total.borderTopWidth)).toBeCloseTo(lengthOf(el, '--md-sys-c'), 0)
    const rows = Array.from(el.querySelectorAll('[data-part="row"]')) as HTMLElement[]
    expect(parseFloat(getComputedStyle(rows[0]!).borderTopWidth)).toBe(0)
    expect(parseFloat(getComputedStyle(rows[1]!).borderTopWidth)).toBe(1)
  })

  it('no left-edge accent: no element has a left border unlike its right border', async () => {
    const wrap = container('480px')
    const els = [receipt(wrap, booking), receipt(wrap, order)]
    for (const el of els) await settle(el)
    let checked = 0
    for (const el of els) {
      for (const node of [el, ...Array.from(el.querySelectorAll('*'))] as Element[]) {
        const s = getComputedStyle(node)
        expect(s.borderLeftWidth, `${node.localName}[data-part=${node.getAttribute('data-part')}] left border width`).toBe(s.borderRightWidth)
        checked += 1
      }
    }
    expect(checked).toBeGreaterThan(30)
  })
})

describe('ui-confirm-receipt: Back and Confirm at their own lg step', () => {
  it('at the root register the buttons are the derived lg height', async () => {
    const el = receipt(container('480px'), booking)
    await settle(el)
    for (const name of ['back', 'confirm']) {
      expect(partOf(el, name).getBoundingClientRect().height).toBeCloseTo(rootResolve('lg').h, 0)
    }
  })

  it('on an A2UI canvas (widget / md) the buttons are 28px, the canvas lg step', async () => {
    const el = receipt(container('480px', { 'data-tier': 'widget', 'data-scale': 'md' }), booking)
    await settle(el)
    const lg = resolve('widget', 'md', 'lg').h
    expect(lg).toBe(28)
    for (const name of ['back', 'confirm']) {
      const b = partOf(el, name)
      expect(b.getBoundingClientRect().height).toBeCloseTo(lg, 0)
      expect(parseFloat(getComputedStyle(b).borderTopLeftRadius)).toBeCloseTo(resolve('widget', 'md', 'lg').control.radius, 0)
    }
  })
})

describe('ui-confirm-receipt: the settled receipt', () => {
  it('a Confirm press removes the actions row, paints the mark on its tint and shows the ref', async () => {
    const el = receipt(container('480px'), booking)
    await settle(el)
    const before = el.getBoundingClientRect()
    partOf(el, 'confirm').click()
    await settle(el)
    expect(el.querySelector('[data-part="actions"]')).toBeNull()
    expect(el.getBoundingClientRect().width).toBeCloseTo(before.width, 0)
    expect(el.getBoundingClientRect().height).toBeLessThan(before.height)
    const mark = partOf(el, 'mark')
    const tint = getComputedStyle(mark).backgroundColor
    expect(tint).not.toBe('rgba(0, 0, 0, 0)')
    expect(tint).not.toBe(getComputedStyle(partOf(el, 'record')).backgroundColor)
    const glyph = partOf(mark, 'glyph').getBoundingClientRect()
    expect([glyph.width, glyph.height]).toEqual([glyphBox(rootResolve()), glyphBox(rootResolve())])
    // the mark sits at the end of the header, beside the title
    const header = partOf(el, 'header').getBoundingClientRect()
    expect(mark.getBoundingClientRect().right).toBeCloseTo(header.right, 0)
    expect(partOf(el, 'ref').getBoundingClientRect().height).toBeGreaterThan(0)
  })

  it('a keyboard Confirm moves focus to the Confirmed mark, not the body (Kim 2026-10-20)', async () => {
    const el = receipt(container('480px'), booking)
    await settle(el)
    const confirm = partOf(el, 'confirm')
    confirm.focus()
    await userEvent.keyboard('{Enter}') // a real key press: the native button activates
    await settle(el)
    expect(el.status).toBe('confirmed')
    const mark = partOf(el, 'mark')
    expect(document.activeElement).toBe(mark)
    expect(document.activeElement).not.toBe(document.body)
    expect(mark.getAttribute('tabindex')).toBe('-1')
    expect(mark.getBoundingClientRect().height).toBeGreaterThan(0)
  })

  it('a Back press leaves the record pending with its actions in place', async () => {
    const el = receipt(container('480px'), booking)
    await settle(el)
    partOf(el, 'back').click()
    await settle(el)
    expect(el.status).toBe('pending')
    expect(partOf(el, 'actions').getBoundingClientRect().height).toBeGreaterThan(0)
  })
})

describe('ui-confirm-receipt: the 400px column', () => {
  for (const [name, init] of [['booking', booking], ['order', order]] as const) {
    it(`the ${name} has no horizontal overflow at 400px on an A2UI canvas, read-back and settled`, async () => {
      const el = receipt(container('400px', { 'data-tier': 'widget', 'data-scale': 'md' }), init)
      await settle(el)
      expect(el.scrollWidth).toBeLessThanOrEqual(el.clientWidth)
      const host = el.getBoundingClientRect()
      for (const node of Array.from(el.querySelectorAll('[data-part]')) as HTMLElement[]) {
        const box = node.getBoundingClientRect()
        expect(box.right, `${node.dataset.part} right edge`).toBeLessThanOrEqual(host.right + 0.5)
      }
      el.status = 'confirmed'
      await settle(el)
      expect(el.scrollWidth).toBeLessThanOrEqual(el.clientWidth)
    })
  }
})
