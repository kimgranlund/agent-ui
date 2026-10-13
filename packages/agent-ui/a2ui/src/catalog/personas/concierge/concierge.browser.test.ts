// concierge.browser.test.ts — a real Chromium/WebKit engine drives `BookingForm`'s FULL, connected
// behavior through the real `createRenderer()` (the `input-multi-slot.browser.test.ts` precedent this
// file follows): native cross-descendant validity gating (ADR-0054/ADR-0050, jsdom-unreachable per
// `factories.test.ts`'s own header — jsdom's `ElementInternals` has no `setFormValue`/`setValidity`) and
// the `BookingForm`→`BookingConfirmation` round trip through a REAL bound data-model path, never a
// producer literal (the decomp note's §1 arguments (a)/(b), both proven live here, not just structurally
// in jsdom). Reactive effects flush asynchronously (`reactive/scheduler.ts`'s `whenFlushed`) — every
// assertion that depends on a bound-prop effect having re-run `await`s it first.

import { describe, it, expect } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import '@agent-ui/shared/tokens.css' // the layout leg below measures real boxes: tokens, foundation, control sheets
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all' // self-defines ui-* controls (the real fleet factories)
import { createRenderer } from '../../../renderer/renderer.ts'
import type { A2uiClientMessage } from '../../../renderer/renderer.ts'
import type { A2uiActionMessage } from '../../../renderer/action.ts'

const isAction = (m: A2uiClientMessage): m is A2uiActionMessage => 'action' in m

describe('BookingForm — real submitGate required-gating (ADR-0054, native, no producer-authored checks)', () => {
  it('an unchecked required field refuses the submit click — no action sent; checking it then permits', async () => {
    const mount = document.createElement('div')
    document.body.append(mount)
    const r = createRenderer()
    r.mount(mount)
    const sent: A2uiClientMessage[] = []
    r.onClientMessage((m) => sent.push(m))

    await r.preload('agent-ui--concierge') // ADR-0241: a lazy record; loaded, the ingest below applies synchronously
    r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui--concierge' } })
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          {
            id: 'root',
            component: 'BookingForm',
            title: 'Confirm the policy',
            fields: [{ kind: 'checkbox', path: 'agree', label: 'I agree to the cancellation policy', required: true }],
            child: 'submitBtn',
          },
          { id: 'submitBtn', component: 'Button', label: 'Book now', action: { action: 'confirmBooking', submit: true } },
        ],
      },
    })
    r.finalize('s1')
    await whenFlushed()

    const button = mount.querySelector('ui-button') as HTMLElement
    const checkbox = mount.querySelector('ui-checkbox') as HTMLElement
    expect(button).not.toBeNull()
    expect(checkbox).not.toBeNull()

    button.click() // required + unchecked — the ui-form-provider submitGate refuses; no action emitted
    expect(sent.filter(isAction)).toHaveLength(0)

    checkbox.click() // real user gesture — checks it (indicator-element's own click-to-toggle)
    button.click() // now valid — the gate permits, the click→action wiring fires
    const actions = sent.filter(isAction)
    expect(actions).toHaveLength(1)
    expect(actions[0]!.action.name).toBe('confirmBooking')

    r.dispose()
    mount.remove()
  })
})

describe('BookingForm → BookingConfirmation — a real day-cell pick round-trips through a bound data-model path', () => {
  it('picking a real calendar day writes the aggregate to /booking; BookingConfirmation reads it back live — never a literal', async () => {
    const mount = document.createElement('div')
    document.body.append(mount)
    const r = createRenderer()
    r.mount(mount)
    const sent: A2uiClientMessage[] = []
    r.onClientMessage((m) => sent.push(m))

    await r.preload('agent-ui--concierge') // ADR-0241: a lazy record; loaded, the ingest below applies synchronously
    r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: 's2', catalogId: 'agent-ui--concierge' } })
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's2',
        components: [
          { id: 'root', component: 'Column', children: ['form', 'confirm'] },
          {
            id: 'form',
            component: 'BookingForm',
            title: 'Pick your date',
            fields: [{ kind: 'dateSingle', path: 'checkIn', label: 'Check-in', required: true }],
            value: { path: '/booking' },
            child: 'submitBtn',
          },
          { id: 'submitBtn', component: 'Button', label: 'Book now', action: { action: 'confirmBooking', submit: true } },
          {
            id: 'confirm',
            component: 'BookingConfirmation',
            title: 'Your booking',
            rows: [{ label: 'Check-in', path: 'checkIn' }],
            data: { path: '/booking' },
          },
        ],
      },
    })
    r.finalize('s2')
    await whenFlushed()

    // Before any pick, the confirmation shows the em-dash placeholder — never a producer literal.
    const confirmRowBefore = mount.querySelector('[data-a2ui-confirmation-row] [data-part="value"]')
    expect(confirmRowBefore?.textContent).toBe('—')

    // The compact date field (T-0085): no month grid until its calendar button opens the popover.
    expect(mount.querySelector('ui-calendar'), 'no inline month grid before the picker opens').toBeNull()
    const dateField = mount.querySelector('ui-text-field') as HTMLElement
    ;(dateField.querySelector('[data-part="calendar-button"]') as HTMLElement).click()
    const cal = dateField.querySelector('[data-part="calendar-popup"] ui-calendar') as HTMLElement
    expect(cal, 'the calendar opens in the field\'s popover').not.toBeNull()
    const grid = cal.querySelectorAll<HTMLElement>('[role="gridcell"]')
    const day05 = [...grid].find((cell) => {
      const iso = cell.dataset['date']
      return iso !== undefined && iso.endsWith('-05') && cell.getAttribute('aria-disabled') !== 'true'
    })
    expect(day05, 'day 05 cell must exist and be enabled').toBeDefined()
    day05!.click() // real click-delegation path, not a synthetic off-DOM set

    const pickedIso = day05!.dataset['date']!
    expect(pickedIso).toMatch(/^\d{4}-\d{2}-05$/)

    ;(mount.querySelector('ui-button') as HTMLElement).click() // valid (required field filled) — gate permits
    await whenFlushed() // the BookingConfirmation's bound "data" effect re-runs asynchronously
    expect(sent.filter(isAction)).toHaveLength(1)

    // The SAME surface's data model now carries the aggregate at /booking — BookingConfirmation's OWN
    // reactive bind-effect (an ordinary bindable prop, widget.ts) picked it up with NO second message.
    const confirmRowAfter = mount.querySelector('[data-a2ui-confirmation-row] [data-part="value"]')
    expect(confirmRowAfter?.textContent).toBe(pickedIso)

    r.dispose()
    mount.remove()
  })
})

// T-0085: the look Kim asked for, measured on real boxes. The stay form (text, number, a check-in/check-out
// pair) and its summary, mounted at the canvas's two content widths: 480px (the 32rem column, any viewport
// from about 500px up) and 336px (a 400px phone).
async function mountStay(width: number): Promise<{ mount: HTMLElement; r: ReturnType<typeof createRenderer> }> {
  const mount = document.createElement('div')
  mount.style.inlineSize = `${width}px`
  document.body.append(mount)
  const r = createRenderer()
  r.mount(mount)
  await r.preload('agent-ui--concierge')
  r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: `stay-${width}`, catalogId: 'agent-ui--concierge' } })
  r.ingestMessage({
    version: 'v1.0',
    updateDataModel: {
      surfaceId: `stay-${width}`,
      path: '/stay',
      value: { guestName: 'Ada Lovelace', guests: '2', checkIn: '2026-11-14', checkOut: '2026-11-17' },
    },
  })
  r.ingestMessage({
    version: 'v1.0',
    updateComponents: {
      surfaceId: `stay-${width}`,
      components: [
        { id: 'root', component: 'Column', children: ['form', 'summary'] },
        {
          id: 'form',
          component: 'BookingForm',
          title: 'Your stay',
          fields: [
            { kind: 'text', path: 'guestName', label: 'Guest name', required: true },
            { kind: 'number', path: 'guests', label: 'Number of guests', required: true },
            { kind: 'dateSingle', path: 'checkIn', label: 'Check-in', required: true },
            { kind: 'dateSingle', path: 'checkOut', label: 'Check-out', required: true },
          ],
          value: { path: '/stay' },
          child: 'submitBtn',
        },
        { id: 'submitBtn', component: 'Button', variant: 'solid', label: 'Reserve', action: { action: 'reserveStay', submit: true } },
        {
          id: 'summary',
          component: 'BookingConfirmation',
          title: 'Stay summary',
          rows: [
            { label: 'Guest', path: 'guestName' },
            { label: 'Check-in', path: 'checkIn' },
          ],
          data: { path: '/stay' },
        },
      ],
    },
  })
  r.finalize(`stay-${width}`)
  await whenFlushed()
  return { mount, r }
}

const box = (el: Element | null): DOMRect => (el as HTMLElement).getBoundingClientRect()
const wrapOf = (mount: HTMLElement, path: string): HTMLElement =>
  [...mount.querySelectorAll<HTMLElement>('[data-a2ui-booking-field]')].find((w) => w.getAttribute('data-a2ui-booking-field') === path)!

describe('BookingForm and BookingConfirmation: labelled fields, compact dates, a summary card (T-0085)', () => {
  it('every field shows its visible label, no month grid renders inline, ink sits 19px in and Reserve is 36px', async () => {
    const { mount, r } = await mountStay(480)
    const form = mount.querySelector('ui-form-provider')!
    for (const [path, label] of [
      ['guestName', 'Guest name'],
      ['guests', 'Number of guests'],
      ['checkIn', 'Check-in'],
      ['checkOut', 'Check-out'],
    ] as const) {
      const own = [...wrapOf(mount, path).children].find((c) => c.getAttribute('data-part') === 'label') as HTMLElement
      expect(own?.textContent, `${path}: the ui-field label part`).toBe(label)
      expect(box(own).height, `${path}: the label is rendered, not just named`).toBeGreaterThan(0)
    }
    expect(mount.querySelectorAll('ui-calendar').length, 'no inline month grid').toBe(0)
    // 1px frame + 12px region padding + 6px inset, the same 19px a stock card's regions put their ink at.
    expect(box(wrapOf(mount, 'guestName')).left - box(form).left).toBeCloseTo(19, 0)
    const button = mount.querySelector('ui-button')!
    expect(box(button).left - box(form).left).toBeCloseTo(19, 0)
    expect(box(button).height).toBeCloseTo(36, 0)
    const card = mount.querySelector('ui-card')!
    expect(box(card.querySelector('[data-part="title"]')).left - box(card).left).toBeCloseTo(19, 0)
    // 8px between fields (the ADR-0046 region gap).
    expect(box(wrapOf(mount, 'guests')).top - box(wrapOf(mount, 'guestName')).bottom).toBeCloseTo(8, 0)
    r.dispose()
    mount.remove()
  })

  it('check-in and check-out share a row in the 480px column and stack in the 336px phone column', async () => {
    const wide = await mountStay(480)
    const [inW, outW] = [box(wrapOf(wide.mount, 'checkIn')), box(wrapOf(wide.mount, 'checkOut'))]
    expect(outW.top, 'side by side: same row').toBeCloseTo(inW.top, 0)
    expect(outW.left - inW.right, 'the 8px gap between them').toBeCloseTo(8, 0)
    wide.r.dispose()
    wide.mount.remove()

    const narrow = await mountStay(336)
    const [inN, outN] = [box(wrapOf(narrow.mount, 'checkIn')), box(wrapOf(narrow.mount, 'checkOut'))]
    expect(outN.top - inN.bottom, 'stacked: check-out below check-in, 8px apart').toBeCloseTo(8, 0)
    expect(outN.left).toBeCloseTo(inN.left, 0)
    narrow.r.dispose()
    narrow.mount.remove()
  })

  it('the summary is label start (muted) and value end (emphasis) per row, with a divider between rows', async () => {
    const { mount, r } = await mountStay(480)
    const rows = [...mount.querySelectorAll<HTMLElement>('[data-a2ui-confirmation-row]')]
    expect(rows.map((row) => row.querySelector('[data-part="value"]')?.textContent)).toEqual(['Ada Lovelace', '2026-11-14'])
    const [label, value] = [rows[0]!.querySelector('[data-part="label"]')!, rows[0]!.querySelector('[data-part="value"]')!]
    expect(box(label).left).toBeCloseTo(box(rows[0]!).left, 0)
    const valueText = document.createRange()
    valueText.selectNodeContents(value)
    expect(valueText.getBoundingClientRect().right, 'the value text ends at the row end').toBeCloseTo(box(rows[0]!).right, 0)
    expect(getComputedStyle(label).color).not.toBe(getComputedStyle(value).color)
    expect(Number.parseInt(getComputedStyle(value).fontWeight, 10)).toBeGreaterThan(Number.parseInt(getComputedStyle(label).fontWeight, 10))
    expect(getComputedStyle(rows[0]!).borderTopWidth).toBe('0px')
    expect(getComputedStyle(rows[1]!).borderTopWidth).toBe('1px')
    r.dispose()
    mount.remove()
  })
})
