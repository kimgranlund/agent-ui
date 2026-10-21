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

  it('the card part is the card surface and an ADR-0046 [data-box] carrying the region padding; the root is none of them (T-0085, T-0197)', () => {
    const el = bookingFormFactory.create()
    const card = el.querySelector<HTMLElement>('[data-part="card"]')!
    expect(card.parentElement).toBe(el)
    expect(card.localName).toBe('div') // a minted part, never a nested ui-card
    expect(card.hasAttribute('data-box')).toBe(true)
    expect(card.style.paddingInline).toBe('var(--ui-box-pad-inline)')
    expect(card.style.paddingBlock).toBe('var(--ui-box-pad-block)')
    expect(card.style.border).toContain('var(--md-sys-color-neutral-outline-variant)')
    expect(card.style.backgroundColor).toBe('var(--md-sys-color-neutral-surface)')
    expect(card.style.display).toBe('flow-root')
    expect(card.style.alignSelf).toBe('stretch')
    expect([...card.children].map((c) => c.getAttribute('data-part'))).toEqual(['title', 'fields'])
    expect(el.hasAttribute('data-box')).toBe(false)
    expect([el.style.border, el.style.backgroundColor, el.style.paddingBlock, el.style.paddingInline]).toEqual(['', '', '', ''])
    expect([el.style.display, el.style.flexDirection, el.style.alignItems, el.style.gap]).toEqual(['flex', 'column', 'flex-end', 'var(--md-sys-widget-gutter)'])
    const fields = el.querySelector('[data-part="fields"]') as HTMLElement
    expect(fields.style.gap).toBe('var(--ui-box-gap)')
    expect([fields.style.marginBlockStart, fields.style.marginBlockEnd]).toEqual(['var(--ui-box-gap)', ''])
  })

  it('names every control tag it mints in `uses` (ADR-0233, T-0135: a date is a ui-text-field, which brings its own calendar)', () => {
    expect([...(bookingFormFactory.uses ?? [])]).toEqual([
      'ui-amount-picker',
      'ui-field',
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
    const date = fieldsEl.querySelector('ui-text-field') as unknown as { name: string; required: boolean; type: string } | null
    const select = fieldsEl.querySelector('ui-select') as unknown as { name: string; required: boolean } | null
    const yesNo = fieldsEl.querySelector('ui-radio-group') as unknown as { name: string; required: boolean } | null
    expect(date?.type).toBe('date') // a real date input is the form control (T-0135)
    expect(fieldsEl.querySelector('ui-calendar')).toBeNull() // the input mints its own calendar, lazily, on open
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
    expect(fieldWraps.map((f) => f.firstElementChild?.localName)).toEqual(['ui-text-field', 'ui-text-field', 'ui-text-field', 'ui-select', 'ui-radio-group'])
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
    expect((fieldsEl.querySelector('ui-text-field') as unknown as { value: string }).value).toBe('2026-08-10')
    expect((fieldsEl.querySelector('ui-radio-group') as unknown as { value: string }).value).toBe('Yes')
  })

  it('"value" reaches a date inside a date row (the prefill scan is not limited to direct children)', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', [
      { kind: 'dateSingle', path: 'checkIn', label: 'Check-in' },
      { kind: 'dateSingle', path: 'checkOut', label: 'Check-out' },
    ])
    bookingFormFactory.applyProp(el, 'value', { checkIn: '2026-11-14', checkOut: '2026-11-17' })
    const dates = [...el.querySelectorAll('[data-part="date-row"] ui-text-field')] as unknown as Array<{ value: string }>
    expect(dates.map((d) => d.value)).toEqual(['2026-11-14', '2026-11-17'])
  })

  it('an unrecognized prop (e.g. a stripped "submitAction" that somehow still arrived) is a no-op — never throws', () => {
    const el = bookingFormFactory.create()
    expect(() => bookingFormFactory.applyProp(el, 'submitAction', { action: 'bookRoom' })).not.toThrow()
  })
})

describe('bookingFormFactory date fields (T-0135, detached, jsdom-safe)', () => {
  const stay = [
    { kind: 'dateSingle', path: 'checkIn', label: 'Arrival', required: true },
    { kind: 'dateSingle', path: 'checkOut', label: 'Departure', required: true },
  ]
  type DateInput = HTMLElement & { value: string; min: string; type: string; name: string; required: boolean; placeholder: string }
  const fieldOf = (el: HTMLElement, path: string) => el.querySelector(`ui-field[data-a2ui-booking-field="${path}"]`) as HTMLElement
  const inputOf = (el: HTMLElement, path: string) => fieldOf(el, path).querySelector('ui-text-field') as unknown as DateInput
  /** What a guest's pick or typed commit does to the input: a new value, then its change. */
  const commit = async (el: HTMLElement, path: string, iso: string) => {
    inputOf(el, path).value = iso
    inputOf(el, path).dispatchEvent(new Event('change', { bubbles: true }))
    await Promise.resolve() // the run is re-held on a microtask, after the field's own commit settles
  }

  it('each date is a labelled ui-field over one ui-text-field type=date: the form control, named for the path, with no popover, button or calendar of the form\'s own', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', stay)
    const field = fieldOf(el, 'checkIn')
    expect((field as unknown as { label: string }).label).toBe('Arrival')
    expect(field.getAttribute('data-part')).toBe('date-field')
    const input = inputOf(el, 'checkIn')
    expect(input.parentElement).toBe(field)
    expect([input.type, input.name, input.required, input.placeholder]).toEqual(['date', 'checkIn', true, 'Choose date'])
    expect(field.querySelector('ui-popover, ui-button, ui-calendar')).toBeNull()
    expect(el.querySelector('ui-card')).toBeNull()
  })

  it('a bound value reaches each input as the ISO date (the input shows it in the reader\'s locale once connected)', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', stay)
    bookingFormFactory.applyProp(el, 'value', { checkIn: '2026-10-12', checkOut: 'not a date' })
    expect(inputOf(el, 'checkIn').value).toBe('2026-10-12')
    expect(inputOf(el, 'checkOut').value).toBe('') // never a non-date into a date input
  })

  it('a committed arrival becomes the departure min', async () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', stay)
    await commit(el, 'checkIn', '2026-11-14')
    expect(inputOf(el, 'checkOut').min).toBe('2026-11-14')
  })

  it('departure cannot precede arrival: an arrival moved past a set departure clears it (with its own change), one before keeps it', async () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', stay)
    bookingFormFactory.applyProp(el, 'value', { checkIn: '2026-11-14', checkOut: '2026-11-17' })
    const departureChanges: number[] = []
    inputOf(el, 'checkOut').addEventListener('change', () => departureChanges.push(1))
    await commit(el, 'checkIn', '2026-11-15')
    expect(inputOf(el, 'checkOut').value).toBe('2026-11-17')
    expect(departureChanges).toEqual([])
    await commit(el, 'checkIn', '2026-11-20')
    expect(inputOf(el, 'checkOut').value).toBe('')
    expect(inputOf(el, 'checkOut').min).toBe('2026-11-20')
    expect(departureChanges, 'the clear is announced so the bound aggregate drops it').toEqual([1])
  })

  it('a bound prefill sets the later field min but never clears a stored departure', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', stay)
    bookingFormFactory.applyProp(el, 'value', { checkIn: '2026-11-20', checkOut: '2026-11-17' })
    expect(inputOf(el, 'checkOut').value).toBe('2026-11-17')
    expect(inputOf(el, 'checkOut').min).toBe('2026-11-20')
  })

  it('the form steps its action Buttons down to md (T-0106, ADR-0245 Amendment 2)', async () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', stay)
    const reserve = document.createElement('ui-button')
    el.append(reserve) // the renderer appends the producer's child Button after create()
    await Promise.resolve() // the subtree observer stamps on a microtask
    expect(reserve.getAttribute('size')).toBe('md')
  })
})

describe('BookingForm field kinds (T-0197)', () => {
  type Control = HTMLElement & { name: string; required: boolean; label: string; value: unknown; type: string; min: unknown; max: number; step: number; actionName: string; orientation: string }
  const fieldOf = (el: HTMLElement, path: string) => el.querySelector(`ui-field[data-a2ui-booking-field="${path}"]`) as (HTMLElement & { label: string }) | null
  const controlOf = (el: HTMLElement, path: string) => fieldOf(el, path)!.firstElementChild as Control
  const build = (fields: unknown[]) => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', fields)
    return el
  }
  const seating = { kind: 'radio', path: 'seating', label: 'Seating', required: true, options: [{ value: 'early', label: '18:00' }, { value: 'late', label: '20:30' }] }
  const stay = { kind: 'dateRange', path: 'checkIn', endPath: 'checkOut', label: 'Arrival', endLabel: 'Departure', required: true }

  it('radio is a horizontal ui-radio-group of the item options under a ui-field', () => {
    const el = build([seating])
    expect(fieldOf(el, 'seating')!.label).toBe('Seating')
    const group = controlOf(el, 'seating')
    expect([group.localName, group.name, group.required, group.orientation]).toEqual(['ui-radio-group', 'seating', true, 'horizontal'])
    const radios = [...group.querySelectorAll('ui-radio')] as unknown as Array<HTMLElement & { value: string }>
    expect(radios.map((r) => [r.value, r.textContent])).toEqual([['early', '18:00'], ['late', '20:30']])
  })

  it('time is a ui-text-field type=time under a ui-field', () => {
    const el = build([{ kind: 'time', path: 'arrivalTime', label: 'Arrival time' }])
    expect(fieldOf(el, 'arrivalTime')!.label).toBe('Arrival time')
    const input = controlOf(el, 'arrivalTime')
    expect([input.localName, input.type, input.name, input.label, input.required]).toEqual(['ui-text-field', 'time', 'arrivalTime', 'Arrival time', false])
  })

  it('stepper is a ui-amount-picker under a ui-field, with min, max and step and no action-name', () => {
    const el = build([{ kind: 'stepper', path: 'covers', label: 'Covers', required: true, min: 1, max: 12, step: 1 }])
    expect(fieldOf(el, 'covers')!.label).toBe('Covers')
    const picker = controlOf(el, 'covers')
    expect([picker.localName, picker.name, picker.label, picker.required]).toEqual(['ui-amount-picker', 'covers', 'Covers', true])
    expect([picker.min, picker.max, picker.step]).toEqual([1, 12, 1])
    expect(picker.actionName).toBe('')
    expect(picker.hasAttribute('action-name')).toBe(false)
  })

  it('stepper sets min, max and step only when they are finite numbers', () => {
    const el = build([{ kind: 'stepper', path: 'guests', label: 'Guests', min: 'two', max: Number.NaN }])
    const picker = controlOf(el, 'guests')
    expect([picker.min, picker.max, picker.step]).toEqual([0, 100, 1]) // the picker's own defaults (amount-picker.md)
  })

  it('dateRange with endPath is its own date run of two date fields, start then end, both registered', () => {
    const el = build([{ kind: 'dateSingle', path: 'visit', label: 'Visit' }, stay, { kind: 'dateSingle', path: 'later', label: 'Later' }])
    const fields = el.querySelector('[data-part="fields"]')!
    const rows = [...fields.children] as HTMLElement[]
    expect(rows.map((r) => r.getAttribute('data-part'))).toEqual(['date-row', 'date-row', 'date-row']) // never joins an adjacent dateSingle run
    expect([...rows[1]!.children].map((c) => c.getAttribute('data-a2ui-booking-field'))).toEqual(['checkIn', 'checkOut'])
    expect([fieldOf(el, 'checkIn')!.label, fieldOf(el, 'checkOut')!.label]).toEqual(['Arrival', 'Departure'])
    const [start, end] = [controlOf(el, 'checkIn'), controlOf(el, 'checkOut')]
    expect([start.type, start.name, start.required, end.type, end.name, end.required]).toEqual(['date', 'checkIn', true, 'date', 'checkOut', true])
  })

  it('dateRange with no endLabel labels the end "End date"; with no endPath it is a dateSingle', () => {
    const el = build([{ kind: 'dateRange', path: 'from', endPath: 'to', label: 'From' }])
    expect(fieldOf(el, 'to')!.label).toBe('End date')
    const single = build([{ kind: 'dateRange', path: 'day', label: 'Day' }, { kind: 'dateSingle', path: 'next', label: 'Next' }])
    const rows = [...single.querySelector('[data-part="fields"]')!.children]
    expect(rows.map((r) => r.getAttribute('data-part'))).toEqual(['date-row']) // read as dateSingle, it joins the next one's run
    expect([...rows[0]!.children].map((c) => c.getAttribute('data-a2ui-booking-field'))).toEqual(['day', 'next'])
  })

  it('the dateRange end takes the start as its min, and a start moved past the end clears it', async () => {
    const el = build([stay])
    const [start, end] = [controlOf(el, 'checkIn'), controlOf(el, 'checkOut')]
    bookingFormFactory.applyProp(el, 'value', { checkIn: '2026-11-14', checkOut: '2026-11-17' })
    expect([start.value, end.value, end.min]).toEqual(['2026-11-14', '2026-11-17', '2026-11-14'])
    start.value = '2026-11-20'
    start.dispatchEvent(new Event('change', { bubbles: true }))
    await Promise.resolve()
    expect([end.value, end.min]).toEqual(['', '2026-11-20'])
  })

  it('"value" prefills each new kind: radio as a string or null, time as text, stepper only from a finite number', () => {
    const el = build([seating, { kind: 'time', path: 'at', label: 'At' }, { kind: 'stepper', path: 'covers', label: 'Covers', min: 1, max: 12 }])
    const [group, time, picker] = [controlOf(el, 'seating'), controlOf(el, 'at'), controlOf(el, 'covers')]
    bookingFormFactory.applyProp(el, 'value', { seating: 'late', at: '19:30', covers: '4' })
    expect([group.value, time.value, picker.value]).toEqual(['late', '19:30', 4])
    bookingFormFactory.applyProp(el, 'value', { seating: '', covers: 'many' })
    expect([group.value, picker.value]).toEqual([null, 4]) // a non-finite count leaves the picker as it was
    bookingFormFactory.applyProp(el, 'value', { seating: null, covers: 6 })
    expect([group.value, picker.value]).toEqual([null, 6])
  })

  it('the aggregate holds one scalar per path: one named control per path, two for a dateRange', () => {
    // Detached, values() is vacuously {} (form-provider.ts); the real aggregate is proven in concierge.browser.test.ts.
    // Here: one form control named per path, so values() holds one scalar per path, two for the dateRange.
    const el = build([stay, seating, { kind: 'time', path: 'at', label: 'At' }, { kind: 'stepper', path: 'covers', label: 'Covers' }])
    const named = [...el.querySelectorAll('ui-text-field, ui-radio-group, ui-amount-picker, ui-select')].map((c) => (c as Control).name)
    expect(named).toEqual(['checkIn', 'checkOut', 'seating', 'at', 'covers'])
    expect((el as unknown as { a2uiFormValue: unknown }).a2uiFormValue).toEqual({})
  })

  it('uses lists ui-amount-picker, the control the stepper mints', () => {
    expect(bookingFormFactory.uses).toContain('ui-amount-picker')
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

  it('T-0172: a row with `options` prints the label for a coded value (never the raw "twin"); an unmatched value prints as is', () => {
    const el = bookingConfirmationFactory.create()
    bookingConfirmationFactory.applyProp(el, 'rows', [
      { label: 'Room', path: 'room', options: [{ value: 'twin', label: 'Twin room' }, { value: 'suite', label: 'Suite' }] },
      { label: 'View', path: 'view', options: [{ value: 'sea', label: 'Sea view' }] },
    ])
    bookingConfirmationFactory.applyProp(el, 'data', { room: 'twin', view: 'garden' })
    const values = [...el.querySelectorAll('[data-a2ui-confirmation-row] [data-part="value"]')].map((v) => v.textContent)
    expect(values).toEqual(['Twin room', 'garden'])
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
