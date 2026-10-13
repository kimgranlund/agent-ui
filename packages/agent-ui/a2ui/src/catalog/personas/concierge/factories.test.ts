// factories.test.ts — the `concierge` persona's factory table (SPEC-R1, GH #497), mirroring
// `fixture-demo/factories.test.ts`'s "one factory really produces a working element" precedent.
//
// jsdom reality (the `form-provider.test.ts` precedent, verified before writing): a REAL
// `UIFormElement`-based control's `connectedCallback` runs `internals.setFormValue`/`setValidity`
// effects jsdom's `ElementInternals` does not implement — every probe below keeps its built elements
// DETACHED (never `document.body.appendChild`ed), so `connectedCallback` never fires and the gap never
// bites. Full connected/submit/gating behavior (native validity, `values()` aggregation) is proven in a
// REAL browser — `concierge.browser.test.ts` — not here.

import { describe, it, expect } from 'vitest'
import '@agent-ui/components/all' // ADR-0233: the catalog factories import no control; the test defines the fleet
import { bookingFormFactory, bookingConfirmationFactory, conciergeFactories } from './factories.ts'
import { conciergeFragment } from './index.ts'

describe('concierge factories — table parity (mirrors fixture-demo/factories.test.ts)', () => {
  it('declares exactly one factory per fragment component type — no gap, no extra', () => {
    expect(Object.keys(conciergeFactories).sort()).toEqual(Object.keys(conciergeFragment.components).sort())
  })
})

describe('bookingFormFactory — create() (detached, jsdom-safe)', () => {
  it('mints a real, unparented ui-form-provider with a title + fields part', () => {
    const el = bookingFormFactory.create()
    expect(el.tagName.toLowerCase()).toBe('ui-form-provider')
    expect(el.parentNode).toBeNull()
    expect(el.querySelector('[data-part="title"]')).not.toBeNull()
    expect(el.querySelector('[data-part="fields"]')).not.toBeNull()
  })

  it('the root is the card surface and an ADR-0046 [data-box] carrying the region padding (T-0085)', () => {
    const el = bookingFormFactory.create()
    expect(el.hasAttribute('data-box')).toBe(true)
    expect(el.style.paddingInline).toBe('var(--ui-box-pad-inline)')
    expect(el.style.paddingBlock).toBe('var(--ui-box-pad-block)')
    expect(el.style.border).toContain('var(--md-sys-color-neutral-outline-variant)')
    expect(el.style.backgroundColor).toBe('var(--md-sys-color-neutral-surface)')
    expect((el.querySelector('[data-part="fields"]') as HTMLElement).style.gap).toBe('var(--ui-box-gap)')
  })

  it('names every control tag it mints in `uses` (ADR-0233, T-0106)', () => {
    expect([...(bookingFormFactory.uses ?? [])]).toEqual([
      'ui-button',
      'ui-calendar',
      'ui-field',
      'ui-icon',
      'ui-popover',
      'ui-radio',
      'ui-radio-group',
      'ui-select',
      'ui-text',
      'ui-text-field',
    ])
    expect([...(bookingConfirmationFactory.uses ?? [])]).toEqual(['ui-card-content', 'ui-card-header', 'ui-text'])
  })

  it('exposes a2uiFormValue as a live getter proxying the form-provider\'s own values()', () => {
    const el = bookingFormFactory.create() as unknown as { values: () => Record<string, unknown>; a2uiFormValue: unknown }
    // Disconnected form-provider: values() is vacuously {} (form-provider.ts) — the getter must reflect that.
    expect(el.a2uiFormValue).toEqual({})
  })

  it('carries the ADR-0054 submitGate mark + the ADR-0161 value slot (readProp proxies the getter)', () => {
    expect(bookingFormFactory.submitGate).toBe(true)
    expect(bookingFormFactory.value).toEqual({ prop: 'value', event: 'change', readProp: 'a2uiFormValue' })
  })
})

describe('bookingFormFactory — applyProp (detached, jsdom-safe)', () => {
  it('"title" reflects onto the title part\'s textContent', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'title', 'Book your stay')
    expect(el.querySelector('[data-part="title"]')?.textContent).toBe('Book your stay')
  })

  it('"fields" rebuilds one control per entry, tagged by kind, with name = path and required propagated', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', [
      { kind: 'dateSingle', path: 'checkIn', label: 'Check-in', required: true },
      { kind: 'select', path: 'roomType', label: 'Room type', required: true, options: [{ value: 'suite', label: 'Suite' }] },
      { kind: 'checkbox', path: 'breakfast', label: 'Breakfast included' },
    ])
    const fieldsEl = el.querySelector('[data-part="fields"]')!
    const date = fieldsEl.querySelector('ui-calendar') as unknown as { name: string; required: boolean } | null
    const select = fieldsEl.querySelector('ui-select') as unknown as { name: string; required: boolean } | null
    const yesNo = fieldsEl.querySelector('ui-radio-group') as unknown as { name: string; required: boolean } | null
    const shown = fieldsEl.querySelector('ui-text-field') as unknown as { name: string; readonly: boolean }
    expect(shown.readonly).toBe(true) // a date's text field only shows the date; the calendar is the form control
    expect(shown.name).toBe('')
    expect(fieldsEl.querySelector('ui-checkbox')).toBeNull() // a boolean is a Yes / No choice
    expect(date?.name).toBe('checkIn')
    expect(date?.required).toBe(true)
    expect(select?.name).toBe('roomType')
    expect(select?.required).toBe(true)
    expect(select && (select as unknown as HTMLElement).querySelectorAll('[role="option"]').length).toBe(1)
    expect(yesNo?.name).toBe('breakfast')
    expect(yesNo?.required).toBe(false)
  })

  it('"text" and "number" kinds mint a ui-text-field with the matching type, name, label and required', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', [
      { kind: 'text', path: 'guestName', label: 'Guest name', required: true },
      { kind: 'number', path: 'guests', label: 'Guests' },
    ])
    const fields = [...el.querySelectorAll('[data-part="fields"] ui-text-field')] as unknown as Array<{
      name: string
      type: string
      label: string
      required: boolean
    }>
    expect(fields.map((f) => f.type)).toEqual(['text', 'number'])
    expect(fields.map((f) => f.name)).toEqual(['guestName', 'guests'])
    expect(fields.map((f) => f.label)).toEqual(['Guest name', 'Guests'])
    expect(fields.map((f) => f.required)).toEqual([true, false])
  })

  it('every field wears a ui-field, a date field included whose label is the field label (the visible label, T-0085)', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', [
      { kind: 'text', path: 'guestName', label: 'Guest name' },
      { kind: 'number', path: 'guests', label: 'Guests' },
      { kind: 'dateSingle', path: 'checkIn', label: 'Check-in' },
      { kind: 'select', path: 'roomType', label: 'Room type', options: [{ value: 'suite', label: 'Suite' }] },
      { kind: 'checkbox', path: 'breakfast', label: 'Breakfast included' },
    ])
    const fieldWraps = [...el.querySelectorAll('ui-field')] as unknown as Array<HTMLElement & { label: string }>
    expect(fieldWraps.map((f) => f.label)).toEqual(['Guest name', 'Guests', 'Check-in', 'Room type', 'Breakfast included'])
    expect(fieldWraps.map((f) => f.getAttribute('data-a2ui-booking-field'))).toEqual(['guestName', 'guests', 'checkIn', 'roomType', 'breakfast'])
    expect(fieldWraps.map((f) => f.firstElementChild?.localName)).toEqual(['ui-text-field', 'ui-text-field', 'ui-popover', 'ui-select', 'ui-radio-group'])
    expect(el.querySelector('ui-card')).toBeNull() // no nested container inside the form card (T-0106)
  })

  it('a run of consecutive dateSingle fields shares one wrapping date row; other kinds stay one per line', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', [
      { kind: 'text', path: 'guestName', label: 'Guest name' },
      { kind: 'dateSingle', path: 'checkIn', label: 'Check-in' },
      { kind: 'dateSingle', path: 'checkOut', label: 'Check-out' },
      { kind: 'number', path: 'guests', label: 'Guests' },
    ])
    const fieldsEl = el.querySelector('[data-part="fields"]')!
    const lines = [...fieldsEl.children] as HTMLElement[]
    expect(lines.map((c) => c.getAttribute('data-part') ?? c.getAttribute('data-a2ui-booking-field'))).toEqual([
      'guestName',
      'date-row',
      'guests',
    ])
    const row = lines[1]!
    expect(row.style.flexWrap).toBe('wrap')
    expect([...row.children].map((c) => c.getAttribute('data-a2ui-booking-field'))).toEqual(['checkIn', 'checkOut'])
    expect([...row.children].map((c) => c.localName)).toEqual(['ui-field', 'ui-field'])
    expect([...row.children].map((c) => (c as HTMLElement).style.flex)).toEqual(['1 1 12rem', '1 1 12rem'])
  })

  it('"value" prefills text and number fields from the aggregate as strings', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', [
      { kind: 'text', path: 'guestName', label: 'Guest name' },
      { kind: 'number', path: 'guests', label: 'Guests' },
    ])
    bookingFormFactory.applyProp(el, 'value', { guestName: 'Ada', guests: 2 })
    const [name, guests] = [...el.querySelectorAll('ui-text-field')] as unknown as Array<{ value: string }>
    expect(name!.value).toBe('Ada')
    expect(guests!.value).toBe('2')
  })

  it('a boolean field is a Yes / No radio group; "value" answers it from a boolean or a yes-ish string, null leaves it open', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', [{ kind: 'checkbox', path: 'breakfast', label: 'Breakfast' }])
    const group = el.querySelector('ui-radio-group') as unknown as HTMLElement & { value: string | null; orientation: string }
    expect([...group.querySelectorAll('ui-radio')].map((r) => (r as unknown as { value: string }).value)).toEqual(['Yes', 'No'])
    expect([...group.querySelectorAll('ui-radio')].map((r) => r.textContent)).toEqual(['Yes', 'No'])
    expect(group.orientation).toBe('horizontal')
    for (const [raw, answer] of [[true, 'Yes'], [false, 'No'], ['on', 'Yes'], ['No', 'No'], [null, null]] as const) {
      bookingFormFactory.applyProp(el, 'value', { breakfast: raw })
      expect(group.value, String(raw)).toBe(answer)
    }
  })

  it('a later "fields" apply REPLACES the prior control set (not additive)', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', [{ kind: 'checkbox', path: 'a', label: 'A' }])
    bookingFormFactory.applyProp(el, 'fields', [{ kind: 'checkbox', path: 'b', label: 'B' }])
    const fieldsEl = el.querySelector('[data-part="fields"]')!
    expect(fieldsEl.querySelectorAll('ui-radio-group').length).toBe(1)
    expect((fieldsEl.querySelector('ui-radio-group') as unknown as { name: string }).name).toBe('b')
  })

  it('"value" prefills each field control from the aggregate object, keyed by path', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', [
      { kind: 'dateSingle', path: 'checkIn', label: 'Check-in' },
      { kind: 'checkbox', path: 'breakfast', label: 'Breakfast' },
    ])
    bookingFormFactory.applyProp(el, 'value', { checkIn: '2026-08-10', breakfast: true })
    const fieldsEl = el.querySelector('[data-part="fields"]')!
    expect((fieldsEl.querySelector('ui-calendar') as unknown as { value: string }).value).toBe('2026-08-10')
    expect((fieldsEl.querySelector('ui-radio-group') as unknown as { value: string }).value).toBe('Yes')
  })

  it('"value" reaches a date inside a date row (the prefill scan is not limited to direct children)', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', [
      { kind: 'dateSingle', path: 'checkIn', label: 'Check-in' },
      { kind: 'dateSingle', path: 'checkOut', label: 'Check-out' },
    ])
    bookingFormFactory.applyProp(el, 'value', { checkIn: '2026-11-14', checkOut: '2026-11-17' })
    const dates = [...el.querySelectorAll('[data-part="date-row"] ui-calendar')] as unknown as Array<{ value: string }>
    expect(dates.map((d) => d.value)).toEqual(['2026-11-14', '2026-11-17'])
  })

  it('an unrecognized prop (e.g. a stripped "submitAction" that somehow still arrived) is a no-op — never throws', () => {
    const el = bookingFormFactory.create()
    expect(() => bookingFormFactory.applyProp(el, 'submitAction', { action: 'bookRoom' })).not.toThrow()
  })
})

describe('bookingFormFactory date fields (T-0106, detached, jsdom-safe)', () => {
  const stay = [
    { kind: 'dateSingle', path: 'checkIn', label: 'Arrival', required: true },
    { kind: 'dateSingle', path: 'checkOut', label: 'Departure', required: true },
  ]
  const cardOf = (el: HTMLElement, path: string) => el.querySelector(`ui-field[data-a2ui-booking-field="${path}"]`) as HTMLElement
  const textOf = (card: HTMLElement) => (card.querySelector('[data-a2ui-date-input]') as HTMLElement & { value: string }).value
  const buttonOf = (card: HTMLElement) => card.querySelector('[data-a2ui-date-button]') as HTMLElement & { size: string }
  const labelOf = (card: HTMLElement) => buttonOf(card).getAttribute('aria-label')
  const calendarOf = (card: HTMLElement) => card.querySelector('ui-calendar') as unknown as HTMLElement & { value: string; min: string; required: boolean }
  const pick = (card: HTMLElement, iso: string) => {
    const cal = calendarOf(card)
    cal.value = iso
    cal.dispatchEvent(new Event('change', { bubbles: true, composed: true })) // what a day click emits
  }
  const localeOf = (y: number, m: number, d: number) =>
    new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  it('each date is a labelled ui-field over a read-only input with one sm icon button inside a popover carrying the calendar', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', stay)
    const card = cardOf(el, 'checkIn')
    expect((card as unknown as { label: string }).label).toBe('Arrival') // ui-field draws the required marker off the calendar's [required]
    const input = card.querySelector('[data-a2ui-date-input]') as unknown as { localName: string; readonly: boolean; placeholder: string; parentElement: HTMLElement | null }
    expect(input.localName).toBe('ui-text-field')
    expect(input.readonly).toBe(true)
    expect(input.placeholder).toBe('Choose date')
    expect(textOf(card)).toBe('')
    expect(labelOf(card)).toBe('Choose arrival date')
    expect(buttonOf(card).size).toBe('sm')
    expect(buttonOf(card).hasAttribute('icon-only')).toBe(true)
    expect((buttonOf(card).querySelector('ui-icon') as unknown as { symbol: string }).symbol).toBe('calendar-blank')
    expect(buttonOf(card).parentElement).toBe(input) // the button sits in the field's trailing slot
    expect(buttonOf(card).getAttribute('slot')).toBe('trailing')
    expect(input.parentElement?.localName).toBe('ui-popover')
    expect(input.parentElement?.firstElementChild).toBe(input) // the first child is the popover trigger
    expect(calendarOf(card).parentElement).toBe(input.parentElement) // beside the text field, never nested in it
    expect(calendarOf(card).required).toBe(true)
    expect(el.querySelector('ui-card')).toBeNull()
  })

  it('shows the date in the reader\'s locale and relabels the button; the calendar keeps the ISO value', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', stay)
    bookingFormFactory.applyProp(el, 'value', { checkIn: '2026-10-12', checkOut: '' })
    expect(textOf(cardOf(el, 'checkIn'))).toBe(localeOf(2026, 10, 12))
    expect(textOf(cardOf(el, 'checkIn'))).not.toContain('2026-10-12')
    expect(calendarOf(cardOf(el, 'checkIn')).value).toBe('2026-10-12')
    expect(labelOf(cardOf(el, 'checkIn'))).toBe('Change arrival date')
    expect(textOf(cardOf(el, 'checkOut'))).toBe('')
    expect(labelOf(cardOf(el, 'checkOut'))).toBe('Choose departure date')
  })

  it('a pick updates the field text, closes the popover and takes the later field min from it', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', stay)
    const popover = cardOf(el, 'checkIn').querySelector('ui-popover') as unknown as { open: boolean }
    popover.open = true
    pick(cardOf(el, 'checkIn'), '2026-11-14')
    expect(textOf(cardOf(el, 'checkIn'))).toBe(localeOf(2026, 11, 14))
    expect(popover.open).toBe(false)
    expect(calendarOf(cardOf(el, 'checkOut')).min).toBe('2026-11-14')
  })

  it('departure cannot precede arrival: an arrival moved past a set departure clears it, one before keeps it', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', stay)
    bookingFormFactory.applyProp(el, 'value', { checkIn: '2026-11-14', checkOut: '2026-11-17' })
    pick(cardOf(el, 'checkIn'), '2026-11-15')
    expect(calendarOf(cardOf(el, 'checkOut')).value).toBe('2026-11-17')
    pick(cardOf(el, 'checkIn'), '2026-11-20')
    expect(calendarOf(cardOf(el, 'checkOut')).value).toBe('')
    expect(textOf(cardOf(el, 'checkOut'))).toBe('')
    expect(calendarOf(cardOf(el, 'checkOut')).min).toBe('2026-11-20')
  })

  it('a bound prefill sets the later card min but never clears a stored departure', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', stay)
    bookingFormFactory.applyProp(el, 'value', { checkIn: '2026-11-20', checkOut: '2026-11-17' })
    expect(calendarOf(cardOf(el, 'checkOut')).value).toBe('2026-11-17')
    expect(calendarOf(cardOf(el, 'checkOut')).min).toBe('2026-11-20')
  })

  it('opening the popover mounts a fresh calendar carrying the booked value (so it opens on the booked month)', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', stay)
    bookingFormFactory.applyProp(el, 'value', { checkIn: '2027-03-09' })
    const card = cardOf(el, 'checkIn')
    const before = calendarOf(card)
    buttonOf(card).dispatchEvent(new Event('click', { bubbles: true }))
    const after = calendarOf(card)
    expect(after).not.toBe(before)
    expect(after.value).toBe('2027-03-09')
    expect(card.querySelectorAll('ui-calendar').length).toBe(1)
  })

  it('a clicked day inside the open panel never swaps the calendar (only the trigger button does)', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', stay)
    const card = cardOf(el, 'checkIn')
    const before = calendarOf(card)
    before.dispatchEvent(new Event('click', { bubbles: true }))
    expect(calendarOf(card)).toBe(before)
  })

  it('a click on the field text (the popover trigger) mounts a fresh calendar; a click inside the panel leaves it', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', stay)
    const card = cardOf(el, 'checkIn')
    const input = card.querySelector('[data-a2ui-date-input]') as HTMLElement
    const before = calendarOf(card)
    input.dispatchEvent(new Event('click', { bubbles: true }))
    const after = calendarOf(card)
    expect(after).not.toBe(before)
    after.dispatchEvent(new Event('click', { bubbles: true }))
    expect(calendarOf(card)).toBe(after)
    expect(card.querySelectorAll('ui-calendar').length).toBe(1)
  })

  it('the form steps its action Buttons down to md and leaves the date picker buttons at sm (T-0106)', async () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', stay)
    const reserve = document.createElement('ui-button')
    el.append(reserve) // the renderer appends the producer's child Button after create()
    await Promise.resolve() // the subtree observer stamps on a microtask
    expect(reserve.getAttribute('size')).toBe('md')
    expect(buttonOf(cardOf(el, 'checkIn')).size).toBe('sm')
    expect(buttonOf(cardOf(el, 'checkOut')).getAttribute('size')).toBe('sm')
  })
})

describe('bookingConfirmationFactory — create()/applyProp (jsdom-safe: ui-card/ui-text carry no form association)', () => {
  it('mints a ui-card with a title + rows part', () => {
    const el = bookingConfirmationFactory.create()
    expect(el.tagName.toLowerCase()).toBe('ui-card')
    expect(el.querySelector('[data-part="title"]')).not.toBeNull()
    expect(el.querySelector('[data-part="rows"]')).not.toBeNull()
    expect(bookingConfirmationFactory.value).toBeUndefined() // display-only — no two-way commit
  })

  it('the title sits in a ui-card-header and the rows in a ui-card-content (the stock card regions, T-0085)', () => {
    const el = bookingConfirmationFactory.create()
    expect([...el.children].map((c) => c.localName)).toEqual(['ui-card-header', 'ui-card-content'])
    expect(el.querySelector('ui-card-header > [data-part="title"]')).not.toBeNull()
    expect(el.querySelector('ui-card-content > [data-part="rows"]')).not.toBeNull()
  })

  it('each row is a muted label at the start and an emphasis value at the end, hairline dividers between rows', () => {
    const el = bookingConfirmationFactory.create()
    bookingConfirmationFactory.applyProp(el, 'rows', [
      { label: 'Guest', path: 'guestName' },
      { label: 'Guests', path: 'guests' },
      { label: 'Check-in', path: 'checkIn' },
    ])
    const rows = [...el.querySelectorAll<HTMLElement>('[data-a2ui-confirmation-row]')]
    expect(rows.map((r) => r.style.justifyContent)).toEqual(['space-between', 'space-between', 'space-between'])
    expect(rows.map((r) => r.style.borderBlockStart)).toEqual(['', '1px solid var(--md-sys-color-neutral-outline-variant)', '1px solid var(--md-sys-color-neutral-outline-variant)'])
    const label = rows[0]!.querySelector<HTMLElement>('[data-part="label"]')!
    const value = rows[0]!.querySelector<HTMLElement>('[data-part="value"]')!
    expect(label.textContent).toBe('Guest')
    expect(label.style.color).toBe('var(--md-sys-color-neutral-on-surface-variant)')
    expect((value as unknown as { emphasis: boolean }).emphasis).toBe(true)
    expect(value.style.textAlign).toBe('end')
    expect(value.style.overflowWrap).toBe('anywhere') // a long value wraps under itself
  })

  it('"rows" builds one label/value pair per entry, value defaulting to the em-dash placeholder', () => {
    const el = bookingConfirmationFactory.create()
    bookingConfirmationFactory.applyProp(el, 'rows', [
      { label: 'Check-in', path: 'checkIn' },
      { label: 'Room', path: 'roomType' },
    ])
    const rows = el.querySelectorAll('[data-a2ui-confirmation-row]')
    expect(rows.length).toBe(2)
    expect(rows[0]!.querySelector('[data-part="value"]')?.textContent).toBe('—')
  })

  it('"data" fills each row\'s value from the aggregate — NEVER a literal the row itself carries (§1 argument b)', () => {
    const el = bookingConfirmationFactory.create()
    bookingConfirmationFactory.applyProp(el, 'rows', [{ label: 'Check-in', path: 'checkIn' }])
    bookingConfirmationFactory.applyProp(el, 'data', { checkIn: 'Friday' })
    expect(el.querySelector('[data-a2ui-confirmation-row] [data-part="value"]')?.textContent).toBe('Friday')
    // A later data change re-derives the SAME row — proving the row can only ever echo the bound object.
    bookingConfirmationFactory.applyProp(el, 'data', { checkIn: 'Saturday' })
    expect(el.querySelector('[data-a2ui-confirmation-row] [data-part="value"]')?.textContent).toBe('Saturday')
  })

  it('"data" shows an ISO date in locale form and a boolean as Yes / No (the bound values stay ISO and boolean)', () => {
    const el = bookingConfirmationFactory.create()
    bookingConfirmationFactory.applyProp(el, 'rows', [
      { label: 'Arrival', path: 'checkIn' },
      { label: 'Breakfast', path: 'breakfast' },
      { label: 'Notes', path: 'notes' },
    ])
    bookingConfirmationFactory.applyProp(el, 'data', { checkIn: '2026-10-12', breakfast: false, notes: '2026-13-45' })
    const values = [...el.querySelectorAll('[data-part="value"]')].map((v) => v.textContent)
    expect(values).toEqual([
      new Date(2026, 9, 12).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
      'No',
      '2026-13-45', // not a real date: shown as authored
    ])
  })

  it('a missing key in the aggregate falls back to the em-dash placeholder, never "undefined"/"null"', () => {
    const el = bookingConfirmationFactory.create()
    bookingConfirmationFactory.applyProp(el, 'rows', [{ label: 'Notes', path: 'notes' }])
    bookingConfirmationFactory.applyProp(el, 'data', {})
    expect(el.querySelector('[data-a2ui-confirmation-row] [data-part="value"]')?.textContent).toBe('—')
  })
})
