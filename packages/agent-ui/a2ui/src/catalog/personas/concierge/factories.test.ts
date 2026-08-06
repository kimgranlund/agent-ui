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
    const calendar = fieldsEl.querySelector('ui-calendar') as unknown as { name: string; required: boolean } | null
    const select = fieldsEl.querySelector('ui-select') as unknown as { name: string; required: boolean } | null
    const checkbox = fieldsEl.querySelector('ui-checkbox') as unknown as (HTMLElement & { name: string; required: boolean }) | null
    expect(calendar?.name).toBe('checkIn')
    expect(calendar?.required).toBe(true)
    expect(select?.name).toBe('roomType')
    expect(select?.required).toBe(true)
    expect(select && (select as unknown as HTMLElement).querySelectorAll('[role="option"]').length).toBe(1)
    expect(checkbox?.name).toBe('breakfast')
    expect(checkbox?.required).toBe(false)
    expect(checkbox?.textContent).toBe('Breakfast included') // self-labeled, indicatorFactory precedent
  })

  it('a later "fields" apply REPLACES the prior control set (not additive)', () => {
    const el = bookingFormFactory.create()
    bookingFormFactory.applyProp(el, 'fields', [{ kind: 'checkbox', path: 'a', label: 'A' }])
    bookingFormFactory.applyProp(el, 'fields', [{ kind: 'checkbox', path: 'b', label: 'B' }])
    const fieldsEl = el.querySelector('[data-part="fields"]')!
    expect(fieldsEl.querySelectorAll('ui-checkbox').length).toBe(1)
    expect((fieldsEl.querySelector('ui-checkbox') as unknown as { name: string }).name).toBe('b')
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
    expect((fieldsEl.querySelector('ui-checkbox') as unknown as { checked: boolean }).checked).toBe(true)
  })

  it('an unrecognized prop (e.g. a stripped "submitAction" that somehow still arrived) is a no-op — never throws', () => {
    const el = bookingFormFactory.create()
    expect(() => bookingFormFactory.applyProp(el, 'submitAction', { action: 'bookRoom' })).not.toThrow()
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
    bookingConfirmationFactory.applyProp(el, 'data', { checkIn: '2026-08-10' })
    expect(el.querySelector('[data-a2ui-confirmation-row] [data-part="value"]')?.textContent).toBe('2026-08-10')
    // A later data change re-derives the SAME row — proving the row can only ever echo the bound object.
    bookingConfirmationFactory.applyProp(el, 'data', { checkIn: '2026-08-12' })
    expect(el.querySelector('[data-a2ui-confirmation-row] [data-part="value"]')?.textContent).toBe('2026-08-12')
  })

  it('a missing key in the aggregate falls back to the em-dash placeholder, never "undefined"/"null"', () => {
    const el = bookingConfirmationFactory.create()
    bookingConfirmationFactory.applyProp(el, 'rows', [{ label: 'Notes', path: 'notes' }])
    bookingConfirmationFactory.applyProp(el, 'data', {})
    expect(el.querySelector('[data-a2ui-confirmation-row] [data-part="value"]')?.textContent).toBe('—')
  })
})
