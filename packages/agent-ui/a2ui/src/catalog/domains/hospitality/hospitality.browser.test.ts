// hospitality.browser.test.ts — a real Chromium/WebKit engine drives `BookingForm`'s FULL, connected
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
import { resolve } from '../../../../../shared/src/tokens/scale.mjs'

// The A2UI canvas register (ADR-0245 Amendment 2): widget at scale md, n 6; the card margin and gutter read from it.
const CANVAS = resolve('widget', 'md', 'md')

const isAction = (m: A2uiClientMessage): m is A2uiActionMessage => 'action' in m

describe('BookingForm — real submitGate required-gating (ADR-0054, native, no producer-authored checks)', () => {
  it('an unchecked required field refuses the submit click — no action sent; checking it then permits', async () => {
    const mount = document.createElement('div')
    document.body.append(mount)
    const r = createRenderer()
    r.mount(mount)
    const sent: A2uiClientMessage[] = []
    r.onClientMessage((m) => sent.push(m))

    await r.preload('agent-ui--hospitality') // ADR-0241: a lazy record; loaded, the ingest below applies synchronously
    r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui--hospitality' } })
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

    const button = mount.querySelector('ui-form-provider > ui-button') as HTMLElement
    const radios = [...mount.querySelectorAll<HTMLElement>('ui-radio-group ui-radio')]
    expect(button).not.toBeNull()
    expect(radios.map((r) => r.textContent), 'a boolean is a Yes / No choice (T-0092)').toEqual(['Yes', 'No'])
    expect(mount.querySelector('ui-checkbox')).toBeNull()

    button.click() // required + unanswered — the ui-form-provider submitGate refuses; no action emitted
    expect(sent.filter(isAction)).toHaveLength(0)

    radios[0]!.click() // real user gesture — answers Yes (radio's own click-to-check)
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

    await r.preload('agent-ui--hospitality') // ADR-0241: a lazy record; loaded, the ingest below applies synchronously
    r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: 's2', catalogId: 'agent-ui--hospitality' } })
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
            fields: [{ kind: 'dateSingle', path: 'checkIn', label: 'Arrival', required: true }],
            value: { path: '/booking' },
            child: 'submitBtn',
          },
          { id: 'submitBtn', component: 'Button', label: 'Book now', action: { action: 'confirmBooking', submit: true } },
          {
            id: 'confirm',
            component: 'BookingConfirmation',
            title: 'Your booking',
            rows: [{ label: 'Arrival', path: 'checkIn' }],
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

    // The date input (T-0135): no month grid exists until its own trigger opens the panel.
    const dateCard = mount.querySelector('ui-field[data-a2ui-booking-field="checkIn"]') as HTMLElement
    expect(dateCard.querySelector('ui-calendar'), 'no calendar until the first open').toBeNull()
    ;(dateCard.querySelector('[data-part="calendar-button"]') as HTMLElement).click()
    await whenFlushed()
    const cal = dateCard.querySelector('[data-part="calendar-popup"] ui-calendar') as HTMLElement
    expect(box(cal).height, 'the calendar opens in the input\'s panel').toBeGreaterThan(0)
    const grid = cal.querySelectorAll<HTMLElement>('[role="gridcell"]')
    const day05 = [...grid].find((cell) => {
      const iso = cell.dataset['date']
      return iso !== undefined && iso.endsWith('-05') && cell.getAttribute('aria-disabled') !== 'true'
    })
    expect(day05, 'day 05 cell must exist and be enabled').toBeDefined()
    day05!.click() // real click-delegation path, not a synthetic off-DOM set

    const pickedIso = day05!.dataset['date']!
    expect(pickedIso).toMatch(/^\d{4}-\d{2}-05$/)

    await whenFlushed()
    expect(box(cal).height, 'picking a day closes the popover').toBe(0)
    ;(mount.querySelector('ui-form-provider > ui-button') as HTMLElement).click() // valid (required field filled) — gate permits
    await whenFlushed() // the BookingConfirmation's bound "data" effect re-runs asynchronously
    expect(sent.filter(isAction)).toHaveLength(1)

    // The SAME surface's data model now carries the aggregate at /booking — BookingConfirmation's OWN
    // reactive bind-effect (an ordinary bindable prop, widget.ts) picked it up with NO second message.
    const confirmRowAfter = mount.querySelector('[data-a2ui-confirmation-row] [data-part="value"]')
    const [py, pm, pd] = pickedIso.split('-').map(Number)
    const pickedText = new Date(py!, pm! - 1, pd!).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    expect(confirmRowAfter?.textContent).toBe(pickedText) // shown in locale form, the data model keeps the ISO
    const inputText = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(py!, pm! - 1, pd!))
    expect((dateCard.querySelector('ui-text-field') as HTMLElement & { value: string }).value).toBe(inputText) // the input's own locale text

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
  await r.preload('agent-ui--hospitality')
  r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: `stay-${width}`, catalogId: 'agent-ui--hospitality' } })
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
            { kind: 'dateSingle', path: 'checkIn', label: 'Arrival', required: true },
            { kind: 'dateSingle', path: 'checkOut', label: 'Departure', required: true },
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
            { label: 'Arrival', path: 'checkIn' },
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
  it('every field shows its visible label, no month grid renders inline and ink sits 19px in from the card', async () => {
    const { mount, r } = await mountStay(480)
    const form = mount.querySelector('ui-form-provider [data-part="card"]')! // the card part, T-0197
    for (const [path, label] of [
      ['guestName', 'Guest name'],
      ['guests', 'Number of guests'],
      ['checkIn', 'Arrival'],
      ['checkOut', 'Departure'],
    ] as const) {
      const own = [...wrapOf(mount, path).children].find((c) => c.getAttribute('data-part') === 'label') as HTMLElement
      expect(own?.textContent?.replace(/\s*\*$/, ''), `${path}: the label (a required field's carries a trailing mark)`).toBe(label)
      expect(box(own).height, `${path}: the label is rendered, not just named`).toBeGreaterThan(0)
    }
    for (const cal of mount.querySelectorAll('ui-calendar')) expect(box(cal).height, 'no inline month grid').toBe(0)
    // 1px frame + the 18px card margin (ADR-0245 Amendment 2, scale.mjs resolve('widget','md','md').card.margin), the same 19px a stock card's regions put their ink at.
    expect(box(wrapOf(mount, 'guestName')).left - box(form).left).toBeCloseTo(1 + CANVAS.card.margin, 0)
    expect(box(form.querySelector('[data-part="title"]')).left - box(form).left).toBeCloseTo(1 + CANVAS.card.margin, 0)
    const card = mount.querySelector('ui-card')!
    expect(box(card.querySelector('[data-part="title"]')).left - box(card).left).toBeCloseTo(1 + CANVAS.card.margin, 0)
    // 12px between fields (the card gutter at the canvas register, resolve('widget','md','md').card.gutter).
    expect(box(wrapOf(mount, 'guests')).top - box(wrapOf(mount, 'guestName')).bottom).toBeCloseTo(CANVAS.card.gutter, 0)
    r.dispose()
    mount.remove()
  })

  it('arrival and departure fields share a row in the 480px column and stack in the 336px phone column', async () => {
    const wide = await mountStay(480)
    const [inW, outW] = [box(wrapOf(wide.mount, 'checkIn')), box(wrapOf(wide.mount, 'checkOut'))]
    expect(outW.top, 'side by side: same row').toBeCloseTo(inW.top, 0)
    expect(outW.left - inW.right, 'the 12px gap between them').toBeCloseTo(CANVAS.card.gutter, 0)
    wide.r.dispose()
    wide.mount.remove()

    const narrow = await mountStay(336)
    const [inN, outN] = [box(wrapOf(narrow.mount, 'checkIn')), box(wrapOf(narrow.mount, 'checkOut'))]
    expect(outN.top - inN.bottom, 'stacked: departure below arrival, 12px apart').toBeCloseTo(CANVAS.card.gutter, 0)
    expect(outN.left).toBeCloseTo(inN.left, 0)
    narrow.r.dispose()
    narrow.mount.remove()
  })

  it('the summary is label start (muted) and value end (emphasis) per row, with a divider between rows', async () => {
    const { mount, r } = await mountStay(480)
    const rows = [...mount.querySelectorAll<HTMLElement>('[data-a2ui-confirmation-row]')]
    expect(rows.map((row) => row.querySelector('[data-part="value"]')?.textContent)).toEqual([
      'Ada Lovelace',
      new Date(2026, 10, 14).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    ])
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

describe('BookingForm date fields: arrival and departure are real date inputs with a round trigger (T-0106, T-0135)', () => {
  const fieldOf = (mount: HTMLElement, path: string): HTMLElement =>
    mount.querySelector(`ui-field[data-a2ui-booking-field="${path}"]`) as HTMLElement
  const inputOf = (field: HTMLElement): HTMLElement & { value: string } =>
    field.querySelector('ui-text-field') as HTMLElement & { value: string }
  const triggerOf = (field: HTMLElement): HTMLElement => field.querySelector('[data-part="calendar-button"]') as HTMLElement
  const monthTitle = (field: HTMLElement): string => field.querySelector('ui-calendar [data-part="title"]')?.textContent ?? ''
  const localeDate = (y: number, m: number, d: number): string =>
    new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(y, m - 1, d))

  it('shows two date inputs with no nested card, side by side at 480px and stacked at 336px; each trigger is a round square one step below the md input', async () => {
    const wide = await mountStay(480)
    const [a, d] = [fieldOf(wide.mount, 'checkIn'), fieldOf(wide.mount, 'checkOut')]
    expect(box(d).top, 'side by side').toBeCloseTo(box(a).top, 0)
    expect(box(d).left - box(a).right, 'the 12px gap between fields').toBeCloseTo(CANVAS.card.gutter, 0)
    expect(wide.mount.querySelector('ui-form-provider ui-card'), 'no card inside the form card').toBeNull()
    for (const field of [a, d]) {
      const [input, trigger] = [box(inputOf(field)), box(triggerOf(field))]
      expect(inputOf(field).getAttribute('type')).toBe('date')
      expect(input.height, 'the input at the md step on the canvas register').toBeCloseTo(CANVAS.h, 0)
      expect(trigger.width, 'icon buttons are never rectangular').toBeCloseTo(trigger.height, 1)
      expect(trigger.height, 'one control step below the input (n - 1)').toBeCloseTo(CANVAS.h - 4, 0)
      expect(getComputedStyle(triggerOf(field)).borderTopLeftRadius, 'fully round').toBe('50%')
      expect(trigger.right).toBeLessThanOrEqual(input.right)
      expect(box(field.querySelector('[data-part="label"]')).height).toBeGreaterThan(0)
    }
    expect(inputOf(a).value, 'the booked arrival in the reader\'s locale').toBe(localeDate(2026, 11, 14))
    wide.r.dispose()
    wide.mount.remove()

    const narrow = await mountStay(336)
    const [an, dn] = [fieldOf(narrow.mount, 'checkIn'), fieldOf(narrow.mount, 'checkOut')]
    expect(box(dn).top - box(an).bottom, 'stacked, 12px apart').toBeCloseTo(CANVAS.card.gutter, 0)
    expect(box(dn).left).toBeCloseTo(box(an).left, 0)
    narrow.r.dispose()
    narrow.mount.remove()
  })

  it('opens on the booked month, and departure days before the arrival are disabled', async () => {
    const { mount, r } = await mountStay(480) // arrival 2026-11-14, departure 2026-11-17
    const arrival = fieldOf(mount, 'checkIn')
    triggerOf(arrival).click()
    expect(monthTitle(arrival), 'the booked month, not today\'s').toContain('November')
    expect(monthTitle(arrival)).toContain('2026')
    triggerOf(arrival).click() // toggles closed

    const departure = fieldOf(mount, 'checkOut')
    triggerOf(departure).click()
    const disabled = (day: string): string | null =>
      departure.querySelector<HTMLElement>(`[role="gridcell"][data-date="2026-11-${day}"]`)?.getAttribute('aria-disabled') ?? null
    expect(disabled('13'), 'the day before arrival').toBe('true')
    expect(disabled('14'), 'arrival day itself').not.toBe('true')
    expect(disabled('20')).not.toBe('true')
    r.dispose()
    mount.remove()
  })

  it('a pick writes the ISO to the data model, and an arrival moved past the departure clears the departure', async () => {
    const { mount, r } = await mountStay(480)
    const arrival = fieldOf(mount, 'checkIn')
    triggerOf(arrival).click()
    arrival.querySelector<HTMLElement>('[role="gridcell"][data-date="2026-11-20"]')!.click()
    await whenFlushed()
    const departure = fieldOf(mount, 'checkOut')
    expect(inputOf(arrival).value).toBe(localeDate(2026, 11, 20))
    expect(inputOf(departure).value, 'cleared: before the new arrival').toBe('')
    expect(inputOf(departure).getAttribute('min'), 'the departure min follows the arrival').toBe('2026-11-20')
    const form = mount.querySelector('ui-form-provider') as HTMLElement & { values(): Record<string, unknown> }
    expect(form.values()['checkIn']).toBe('2026-11-20') // the ISO, never the locale text
    expect(form.values()['checkOut'] ?? '').toBe('')
    r.dispose()
    mount.remove()
  })

  it('a departure typed before the arrival is invalid, so the form refuses to submit', async () => {
    const { mount, r } = await mountStay(480)
    const departure = inputOf(fieldOf(mount, 'checkOut')) as HTMLElement & { value: string; validity: ValidityState }
    departure.value = '2026-11-10' // before the 2026-11-14 arrival
    await whenFlushed()
    expect(departure.getAttribute('min'), 'the arrival is the departure min').toBe('2026-11-14')
    expect(departure.validity.rangeUnderflow).toBe(true)
    r.dispose()
    mount.remove()
  })
})

// T-0197: the four new field kinds, rendered in the real engine on the canvas register (widget md).
async function mountKinds(fields: unknown[], value: Record<string, unknown> = {}, width = 480) {
  const mount = document.createElement('div')
  mount.style.inlineSize = `${width}px`
  document.body.append(mount)
  const r = createRenderer()
  r.mount(mount)
  const sent: A2uiClientMessage[] = []
  r.onClientMessage((m) => sent.push(m))
  await r.preload('agent-ui--hospitality')
  const id = `kinds-${Math.random().toString(36).slice(2)}`
  r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: id, catalogId: 'agent-ui--hospitality' } })
  r.ingestMessage({ version: 'v1.0', updateDataModel: { surfaceId: id, path: '/booking', value } })
  r.ingestMessage({
    version: 'v1.0',
    updateComponents: {
      surfaceId: id,
      components: [
        { id: 'root', component: 'BookingForm', title: 'Book a table at Vela', fields, value: { path: '/booking' }, child: 'submitBtn' },
        { id: 'submitBtn', component: 'Button', variant: 'solid', label: 'Confirm', action: { action: 'confirmBooking', submit: true } },
      ],
    },
  })
  r.finalize(id)
  await whenFlushed()
  const form = mount.querySelector('ui-form-provider') as HTMLElement & { values(): Record<string, unknown> }
  const button = mount.querySelector('ui-form-provider > ui-button') as HTMLElement
  const done = (): void => {
    r.dispose()
    mount.remove()
  }
  return { mount, form, button, sent, done }
}

const SEATING = { kind: 'radio', path: 'seating', label: 'Seating', required: true, options: [{ value: 'early', label: '18:00' }, { value: 'late', label: '20:30' }] }
const COVERS = { kind: 'stepper', path: 'covers', label: 'Covers', required: true, min: 1, max: 12, step: 1 }
const KINDS = [
  { kind: 'dateRange', path: 'checkIn', endPath: 'checkOut', label: 'Arrival', endLabel: 'Departure', required: true },
  SEATING,
  { kind: 'time', path: 'arrivalTime', label: 'Arrival time' },
  COVERS,
  { kind: 'checkbox', path: 'breakfast', label: 'Breakfast' },
  { kind: 'text', path: 'notes', label: 'Notes' },
]

describe('BookingForm field kinds (T-0197)', () => {
  it('each new kind renders at widget md with 24px control rows under its visible label', async () => {
    const { mount, done } = await mountKinds(KINDS, { checkIn: '2026-11-14', checkOut: '2026-11-17', covers: 2 })
    expect(mount.querySelector('[data-tier="widget"]'), 'the canvas register').not.toBeNull()
    const rows: Array<[string, string]> = [
      ['checkIn', 'ui-text-field'],
      ['checkOut', 'ui-text-field'],
      ['arrivalTime', 'ui-text-field'],
      ['covers', '[data-part="stepper"]'],
      ['notes', 'ui-text-field'],
    ]
    for (const [path, row] of rows) {
      expect(box(wrapOf(mount, path).querySelector(row)).height, `${path}: one control row`).toBeCloseTo(CANVAS.h, 0)
      const label = [...wrapOf(mount, path).children].find((c) => c.getAttribute('data-part') === 'label') as HTMLElement
      expect(box(label).height, `${path}: the ui-field label is rendered`).toBeGreaterThan(0)
    }
    for (const path of ['seating', 'breakfast']) {
      // A choice row is the radio part's own height at widget md (12px, scale.mjs parts.radio), not the 24px input row.
      expect(box(wrapOf(mount, path).querySelector('ui-radio-group')).height, `${path}: one option row`).toBeCloseTo(CANVAS.parts.radio, 0)
      for (const radio of wrapOf(mount, path).querySelectorAll('ui-radio')) expect(box(radio).height, `${path}: an option`).toBeCloseTo(CANVAS.parts.radio, 0)
    }
    const time = wrapOf(mount, 'arrivalTime').querySelector('ui-text-field')!
    expect(time.getAttribute('type')).toBe('time')
    const picker = wrapOf(mount, 'covers').querySelector('ui-amount-picker')!
    const ownLabel = picker.querySelector('[data-part="label"]')
    expect(ownLabel === null || box(ownLabel).height === 0, 'the picker label part hides under the ui-field').toBe(true)
    expect(picker.querySelector('[data-part="commit"], [data-part="action"]'), 'no commit button of its own').toBeNull()
    done()
  })

  it('the radio and checkbox option text is the text field size', async () => {
    const { mount, done } = await mountKinds(KINDS)
    const fieldSize = getComputedStyle(wrapOf(mount, 'notes').querySelector('ui-text-field')!).fontSize
    const options = [...mount.querySelectorAll('ui-radio')]
    expect(options).toHaveLength(4)
    for (const option of options) expect(getComputedStyle(option).fontSize, option.textContent ?? '').toBe(fieldSize)
    done()
  })

  it('the stepper submits through the producer Button and its value is in the aggregate', async () => {
    const { mount, form, button, sent, done } = await mountKinds([COVERS], { covers: 2 })
    ;(wrapOf(mount, 'covers').querySelector('[data-part="increase"]') as HTMLElement).click()
    await whenFlushed()
    button.click()
    await whenFlushed()
    const actions = sent.filter(isAction)
    expect(actions).toHaveLength(1)
    expect(actions[0]!.action.name).toBe('confirmBooking')
    expect(form.values()['covers']).toBe('3')
    done()
  })

  it('the required gate refuses a blank radio, then permits once a seating is chosen', async () => {
    const { mount, form, button, sent, done } = await mountKinds([SEATING])
    button.click()
    expect(sent.filter(isAction), 'blank required radio: no action').toHaveLength(0)
    ;(wrapOf(mount, 'seating').querySelectorAll('ui-radio')[1] as HTMLElement).click()
    button.click()
    expect(sent.filter(isAction)).toHaveLength(1)
    expect(form.values()['seating']).toBe('late')
    done()
  })
})

describe('BookingForm action under the card (T-0197)', () => {
  for (const width of [480, 336]) {
    it(`the producer Button sits under the card at the end edge, a widget gutter below it, 24px high (${width}px)`, async () => {
      const { form, button, done } = await mountKinds(KINDS, {}, width)
      const card = form.querySelector('[data-part="card"]')!
      expect(button.parentElement, 'a direct child of the submit-gate root').toBe(form)
      expect(box(button).top - box(card).bottom, 'the widget gutter between card and Button').toBeCloseTo(CANVAS.widget.gutter, 0)
      expect(box(button).right, 'end-aligned with the card').toBeCloseTo(box(card).right, 0)
      expect(box(button).top, 'outside the card box').toBeGreaterThanOrEqual(box(card).bottom)
      expect(box(button).left, 'it hugs its label').toBeGreaterThan(box(card).left + box(card).width / 2)
      expect(box(button).height, 'the md button, 24px on the canvas register').toBeCloseTo(CANVAS.h, 0)
      done()
    })
  }
})
