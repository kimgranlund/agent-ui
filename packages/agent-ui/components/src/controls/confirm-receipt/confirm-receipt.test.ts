import { describe, it, expect, afterEach } from 'vitest'
import { UIConfirmReceiptElement } from './confirm-receipt.ts'

// confirm-receipt.test.ts: jsdom probes for ui-confirm-receipt (T-0195). jsdom cannot prove paint or geometry
// (confirm-receipt.browser.test.ts owns that); this pins the declared behaviour: every value read from `data` by
// path, the empty-box law, the part order with the actions row outside the record, the press contract (Confirm
// commits status then emits change then action; Back emits its action and leaves status), the settled receipt
// (actions removed, the mark and the ref shown) and ARIA through internals.

class ProbeConfirmReceipt extends UIConfirmReceiptElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-confirm-receipt-probe', ProbeConfirmReceipt)

const mounted: HTMLElement[] = []
function make(init: (el: ProbeConfirmReceipt) => void = () => {}): ProbeConfirmReceipt {
  const el = new ProbeConfirmReceipt()
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
const childParts = (el: Element): (string | undefined)[] => Array.from(el.children).map((c) => (c as HTMLElement).dataset.part)
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

const BOOKING = (el: UIConfirmReceiptElement): void => {
  el.title = 'Your stay'
  el.rows = [
    { label: 'Arrival', path: 'checkIn' },
    { label: 'Guests', path: 'guests' },
    { label: 'Room', path: 'room', options: [{ value: 'garden', label: 'Garden suite, king' }] },
  ]
  el.total = { label: 'Total, 3 nights', path: 'total' }
  el.data = { checkIn: '2026-10-12', guests: 2, room: 'garden', total: '$1,140.00', ref: 'Booking HX-2214' }
  el.refPath = 'ref'
  el.confirmAction = { action: 'confirm_booking', context: { stay: 'garden' } }
  el.backAction = { action: 'edit_booking' }
}

const ORDER = (el: UIConfirmReceiptElement): void => {
  el.title = 'Your order'
  el.items = [
    { label: 'Linen tea towel', quantity: 2, amount: '$24.00' },
    { label: 'Gift wrap', amount: '$3.00' },
  ]
  el.rows = [{ label: 'Subtotal', path: 'subtotal' }]
  el.total = { label: 'Total', path: 'total' }
  el.data = { subtotal: '$27.00', total: '$27.00' }
  el.confirmAction = { action: 'place_order' }
}

describe('UIConfirmReceiptElement: values come from data by path', () => {
  it('a row value is data[path]; options map a code to its label; a number prints as text', () => {
    const el = make(BOOKING)
    const values = all(el, '[data-part="rows"] [data-part="value"]').map((v) => v.textContent)
    expect(values[1]).toBe('2')
    expect(values[2]).toBe('Garden suite, king')
    expect(all(el, '[data-part="rows"] [data-part="label"]').map((v) => v.textContent)).toEqual(['Arrival', 'Guests', 'Room'])
  })

  it('an ISO date prints in the reader locale, never as the raw wire string', () => {
    const el = make(BOOKING)
    const arrival = all(el, '[data-part="row"] [data-part="value"]')[0]!.textContent!
    expect(arrival).not.toBe('2026-10-12')
    expect(arrival).toMatch(/12/)
    expect(arrival).toMatch(/2026/)
  })

  it('a path with no value shows the missing mark; a change to data re-derives every value', async () => {
    const el = make(BOOKING)
    el.data = { checkIn: '2026-10-12', total: '$900.00' }
    await tick()
    const values = all(el, '[data-part="rows"] [data-part="value"]').map((v) => v.textContent)
    expect(values[1]).toBe('—')
    expect(q(el, '[data-part="total"] [data-part="value"]')?.textContent).toBe('$900.00')
  })

  it('the total reads data[total.path]; the control does no arithmetic over items', () => {
    const el = make(ORDER)
    el.data = { subtotal: '$27.00', total: '$99.00' } // a mismatched total is shown as bound, never recomputed
    return tick().then(() => {
      expect(q(el, '[data-part="total"] [data-part="label"]')?.textContent).toBe('Total')
      expect(q(el, '[data-part="total"] [data-part="value"]')?.textContent).toBe('$99.00')
    })
  })

  it('items show the quantity, label and amount; an item with no quantity has no quantity part', () => {
    const el = make(ORDER)
    const items = all(el, '[data-part="item"]')
    expect(items).toHaveLength(2)
    expect(q(items[0]!, '[data-part="quantity"]')?.textContent).toBe('2 ×')
    expect(q(items[0]!, '[data-part="label"]')?.textContent).toBe('Linen tea towel')
    expect(q(items[0]!, '[data-part="value"]')?.textContent).toBe('$24.00')
    expect(q(items[1]!, '[data-part="quantity"]')).toBeNull()
  })

  it('malformed rows, items and total entries are dropped, never thrown on', () => {
    const el = make((c) => {
      c.rows = [{ label: 'Ok', path: 'a' }, { label: 3 }, null, 'x'] as never
      c.items = [{ label: 'Ok', amount: '$1.00' }, { amount: '$2.00' }] as never
      c.total = { label: 'Total' } as never
      c.data = 'nope' as never
    })
    expect(all(el, '[data-part="row"]')).toHaveLength(1)
    expect(all(el, '[data-part="item"]')).toHaveLength(1)
    expect(q(el, '[data-part="total"]')).toBeNull()
  })
})

describe('UIConfirmReceiptElement: anatomy and the empty-box law', () => {
  it('the host holds the record then the actions row; the actions are never inside the record', () => {
    const el = make(BOOKING)
    expect(childParts(el)).toEqual(['record', 'actions'])
    const record = q(el, '[data-part="record"]')!
    expect(record.localName).toBe('section')
    expect(q(record, 'button')).toBeNull()
    expect(childParts(q(el, '[data-part="actions"]')!)).toEqual(['back', 'confirm'])
  })

  it('the record order is header, items, rows, total; a pending record has no ref', () => {
    expect(childParts(q(make(ORDER), '[data-part="record"]')!)).toEqual(['header', 'items', 'rows', 'total'])
    expect(childParts(q(make(BOOKING), '[data-part="record"]')!)).toEqual(['header', 'rows', 'total'])
  })

  it('no rows, no items and no total render no box for them; no title renders no title part', () => {
    const el = make()
    expect(childParts(q(el, '[data-part="record"]')!)).toEqual(['header'])
    expect(q(el, '[data-part="title"]')).toBeNull()
  })

  it('Back renders only when backAction is set; Confirm always renders while pending', async () => {
    const el = make(ORDER)
    expect(childParts(q(el, '[data-part="actions"]')!)).toEqual(['confirm'])
    el.backAction = { action: 'edit_cart' }
    await tick()
    expect(childParts(q(el, '[data-part="actions"]')!)).toEqual(['back', 'confirm'])
  })

  it('Back and Confirm are native type=button elements at the lg step', () => {
    const el = make(BOOKING)
    for (const name of ['back', 'confirm']) {
      const b = q(el, `[data-part="${name}"]`) as HTMLButtonElement
      expect(b.localName).toBe('button')
      expect(b.type).toBe('button')
      expect(b.dataset.size).toBe('lg')
    }
    expect(q(el, '[data-part="confirm"]')?.textContent).toBe('Confirm')
    expect(q(el, '[data-part="back"]')?.textContent).toBe('Back')
  })
})

describe('UIConfirmReceiptElement: the press contract', () => {
  it('Confirm commits status, then emits change, then action with {action, context}', () => {
    const el = make(BOOKING)
    const log: string[] = []
    el.addEventListener('change', (e) => log.push(`change:${(e as CustomEvent).detail}:${el.status}`))
    el.addEventListener('action', (e) => log.push(`action:${JSON.stringify((e as CustomEvent).detail)}:${el.status}`))
    q(el, '[data-part="confirm"]')!.click()
    expect(el.status).toBe('confirmed')
    expect(log).toEqual(['change:confirmed:confirmed', 'action:{"action":"confirm_booking","context":{"stay":"garden"}}:confirmed'])
  })

  it('the action event is dispatched on the host, bubbling and composed', () => {
    const el = make(BOOKING)
    let target: EventTarget | null = null
    let bubbles = false
    document.body.addEventListener('action', (e) => ((target = e.target), (bubbles = e.bubbles)), { once: true })
    q(el, '[data-part="confirm"]')!.click()
    expect(target).toBe(el)
    expect(bubbles).toBe(true)
  })

  it('Back emits its action and leaves status pending; no change event', () => {
    const el = make(BOOKING)
    const log: string[] = []
    el.addEventListener('change', () => log.push('change'))
    el.addEventListener('action', (e) => log.push(JSON.stringify((e as CustomEvent).detail)))
    q(el, '[data-part="back"]')!.click()
    expect(el.status).toBe('pending')
    expect(log).toEqual(['{"action":"edit_booking"}'])
  })

  it('Confirm with no confirmAction still settles and emits change, but no action', () => {
    const el = make((c) => {
      c.title = 'No action'
    })
    const log: string[] = []
    el.addEventListener('change', () => log.push('change'))
    el.addEventListener('action', () => log.push('action'))
    q(el, '[data-part="confirm"]')!.click()
    expect(el.status).toBe('confirmed')
    expect(log).toEqual(['change'])
  })

  it('a click on the record emits nothing', () => {
    const el = make(BOOKING)
    const log: string[] = []
    el.addEventListener('change', () => log.push('change'))
    el.addEventListener('action', () => log.push('action'))
    q(el, '[data-part="record"]')!.click()
    q(el, '[data-part="row"]')!.click()
    expect(log).toEqual([])
    expect(el.status).toBe('pending')
  })
})

describe('UIConfirmReceiptElement: the settled receipt', () => {
  it('after Confirm the actions row is removed from the DOM, the mark and the ref appear', async () => {
    const el = make(BOOKING)
    q(el, '[data-part="confirm"]')!.click()
    await tick()
    expect(q(el, '[data-part="actions"]')).toBeNull()
    expect(q(el, 'button')).toBeNull()
    expect(childParts(el)).toEqual(['record'])
    const mark = q(el, '[data-part="header"] [data-part="mark"]')!
    expect(mark.textContent).toBe('Confirmed')
    expect(q(mark, 'ui-glyph[data-part="glyph"]')?.getAttribute('symbol')).toBe('check')
    expect(q(el, '[data-part="ref"]')?.textContent).toBe('Booking HX-2214')
    expect(childParts(q(el, '[data-part="record"]')!)).toEqual(['header', 'rows', 'total', 'ref'])
  })

  it('a Confirm press moves focus to the mark (tabindex -1), never to the body', async () => {
    const el = make(BOOKING)
    const confirm = q(el, '[data-part="confirm"]')!
    confirm.focus()
    expect(document.activeElement).toBe(confirm)
    confirm.click()
    await tick()
    const mark = q(el, '[data-part="mark"]')!
    expect(mark.tabIndex).toBe(-1)
    expect(document.activeElement).toBe(mark)
  })

  it('a Back press leaves focus where it was', () => {
    const el = make(BOOKING)
    const back = q(el, '[data-part="back"]')!
    back.focus()
    back.click()
    expect(document.activeElement).toBe(back)
  })

  it('a receipt rendered confirmed never asks: no actions row, no button, the mark shown', () => {
    const el = make((c) => {
      BOOKING(c)
      c.status = 'confirmed'
    })
    expect(q(el, '[data-part="actions"]')).toBeNull()
    expect(q(el, 'button')).toBeNull()
    expect(q(el, '[data-part="mark"]')).not.toBeNull()
    expect(el.getAttribute('status')).toBe('confirmed')
  })

  it('the ref line shows only when refPath resolves to a non-empty value', async () => {
    const el = make((c) => {
      BOOKING(c)
      c.status = 'confirmed'
      c.refPath = 'missing'
    })
    expect(q(el, '[data-part="ref"]')).toBeNull()
    el.refPath = 'ref'
    await tick()
    expect(q(el, '[data-part="ref"]')?.textContent).toBe('Booking HX-2214')
  })

  it('a pending record shows no mark; an out-of-set status reads pending', () => {
    const el = make(BOOKING)
    expect(q(el, '[data-part="mark"]')).toBeNull()
    el.setAttribute('status', 'bogus')
    expect(el.status).toBe('pending')
  })
})

describe('UIConfirmReceiptElement: ARIA through internals', () => {
  it('role group named by the title, then title: Confirmed once settled; no host role or aria-* attribute', async () => {
    const el = make(BOOKING)
    expect(el.probeInternals.role).toBe('group')
    expect(el.probeInternals.ariaLabel).toBe('Your stay')
    q(el, '[data-part="confirm"]')!.click()
    await tick()
    expect(el.probeInternals.ariaLabel).toBe('Your stay: Confirmed')
    expect(el.hasAttribute('role')).toBe(false)
    expect(Array.from(el.attributes).some((a) => a.name.startsWith('aria-'))).toBe(false)
  })

  it('the header is the polite live region; the glyphs are ui-glyph, which hides itself', () => {
    const el = make(BOOKING)
    expect(q(el, '[data-part="header"]')?.getAttribute('aria-live')).toBe('polite')
    expect(q(el, '[data-part="back"] ui-glyph')?.getAttribute('symbol')).toBe('caret-left')
  })

  it('title is observed as receipt-title, never the global title attribute', () => {
    const el = make()
    el.setAttribute('receipt-title', 'From attribute')
    expect(el.title).toBe('From attribute')
    expect(el.hasAttribute('title')).toBe(false)
  })
})
