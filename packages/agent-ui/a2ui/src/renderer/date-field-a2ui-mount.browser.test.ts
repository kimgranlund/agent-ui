// date-field-a2ui-mount.browser.test.ts — GH #886 regression coverage (cross-engine truth).
//
// GH #886 reported two symptoms for "the ui-calendar/datepicker rendered inside a generated A2UI
// form": (1) a stray calendar icon floating above the field, and (2) a "Please enter a valid date."
// validation error showing BEFORE any user interaction. A prior investigation pass confirmed the
// control's own interaction-gated validity timing (`trackUserInvalid`, ADR-0014 cl.2c) reads correctly
// in isolation but could not rule out the renderer's initial-value hydration path (`tree.ts`/`widget.ts`)
// as a source of a stray synthetic interaction, and could not confirm the icon-detachment claim without
// a captured payload.
//
// This suite drives the REAL renderer (`createRenderer`) — not a hand-rolled stub — over every payload
// shape a generated date field plausibly takes: the default catalog's `TextField type="date"` reached
// through a `Field` wrapper (the corpus idiom, `examples/patterns.ts`'s pattern-schedule-picker) and
// bare (no `Field` — the naive-agent shape, ADR-0051's aria-only fallback), an empty+required+`checks`
// field (the blocked-submit idiom), the REAL `booking-reservation` corpus seed's inline `Calendar
// mode="range"`, and a structural-resend (`type` arriving on a LATER streamed patch than `value` —
// RSR-C6/ADR-0128) exercising the renderer's prop-only reconcile path on an ALREADY-CONNECTED control.
//
// RESULT (2026-08-14 investigation, this file's authoring pass): NEITHER symptom reproduces from the
// shipped code in ANY of these shapes, in either engine. The interaction gate
// (`controller.userInvalid()` = `interacted && invalid`, text-field.ts/calendar.ts) never fires before a
// real blur/change on the host, including across a structural resend and a renderer-driven `{path}`
// value hydration (a plain, silent property set — `factories.ts`'s `setProp`). The calendar
// affordance's trailing-slot icon (text-field.ts's host-as-grid anatomy) and the full `ui-calendar`
// header's nav icons stay measurably CONTAINED within their control's own box in every shape tested.
// The one CONFIRMED, adjacent defect in this area — a bare `TextField`/`DateTimeInput` never gets
// wrapped in `ui-field` by any current catalog factory, so it carries no VISIBLE label (ADR-0051's
// aria-only fallback) — is already tracked as GH #888 and is the most plausible innocent explanation for
// an unlabeled icon-only box being misread as "a stray floating icon"; it is not fixed here (adjacent
// gap, own tracking issue). These tests lock in the confirmed-clean behaviour so a future regression in
// either mechanism is caught immediately.

import { describe, it, expect } from 'vitest'
import '@agent-ui/shared/tokens.css'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'
import { createRenderer } from './renderer.ts'
import { bookingReservationSeed } from '../examples/catalog-coverage.ts'

/** True iff `inner`'s box sits fully inside `outer`'s box (with a 1px numeric-rounding tolerance) —
 *  the "the icon is INSIDE the field, not floating above/outside it" assertion. */
function isContained(outer: DOMRect, inner: DOMRect, tolerance = 1): boolean {
  return (
    inner.left >= outer.left - tolerance &&
    inner.right <= outer.right + tolerance &&
    inner.top >= outer.top - tolerance &&
    inner.bottom <= outer.bottom + tolerance
  )
}

describe('GH #886 — date TextField/Calendar in a generated A2UI form (regression)', () => {
  it('Field-wrapped TextField[type=date] (the corpus schedule-picker shape): visible label, contained icon, no premature error', async () => {
    const mount = document.createElement('div')
    document.body.append(mount)
    const r = createRenderer()
    r.mount(mount)

    const SCHEDULE_ID = 'pattern-schedule'
    r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: SCHEDULE_ID, catalogId: 'agent-ui', sendDataModel: true } })
    r.ingestMessage({
      version: 'v1.0',
      updateDataModel: { surfaceId: SCHEDULE_ID, value: { schedule: { date: '2026-07-15' } } },
    })
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: SCHEDULE_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['root_content'] },
          { id: 'root_content', component: 'CardContent', children: ['col'] },
          { id: 'col', component: 'Column', gap: 'md', children: ['f_date'] },
          { id: 'f_date', component: 'Field', label: 'Date', child: 'in_date' },
          { id: 'in_date', component: 'TextField', name: 'date', type: 'date', value: { path: '/schedule/date' } },
        ],
      },
    })
    await new Promise((resolve) => requestAnimationFrame(resolve))

    const field = mount.querySelector('ui-field') as HTMLElement
    const tf = mount.querySelector('ui-text-field') as HTMLElement
    const trailing = tf.querySelector('[slot="trailing"]') as HTMLElement
    const errorNode = field.querySelector('[data-part="error"]') as HTMLElement

    expect(field.querySelector('[data-part="label"]')?.textContent).toBe('Date') // a REAL visible label, not aria-only
    expect(isContained(tf.getBoundingClientRect(), trailing.getBoundingClientRect())).toBe(true) // the calendar icon is INSIDE the field, never floating above it
    expect(errorNode.hidden).toBe(true) // no premature error before any interaction
    expect(tf.getAttribute('aria-invalid')).toBeNull()

    r.dispose()
    mount.remove()
  })

  it('BARE TextField[type=date] (no Field wrapper), empty + required + a `checks` row: no premature error despite an immediately-failing check', async () => {
    const mount = document.createElement('div')
    document.body.append(mount)
    const r = createRenderer()
    r.mount(mount)

    const ID = 'bare-date'
    r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: ID, catalogId: 'agent-ui', sendDataModel: true } })
    r.ingestMessage({ version: 'v1.0', updateDataModel: { surfaceId: ID, value: { booking: { date: '' } } } })
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['root_content'] },
          { id: 'root_content', component: 'CardContent', children: ['in_date'] },
          {
            id: 'in_date', component: 'TextField', name: 'date', type: 'date', label: 'Date', required: true,
            value: { path: '/booking/date' },
            checks: [{ call: 'required', args: { value: { path: '/booking/date' } }, message: 'Date is required' }],
          },
        ],
      },
    })
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve)) // let the checks effect settle

    const tf = mount.querySelector('ui-text-field') as HTMLElement
    const trailing = tf.querySelector('[slot="trailing"]') as HTMLElement
    const msg = tf.querySelector('.ui-text-field-message') as HTMLElement

    expect(isContained(tf.getBoundingClientRect(), trailing.getBoundingClientRect())).toBe(true)
    expect(msg.hidden).toBe(true) // required+empty fails the check immediately (native parity) but stays INVISIBLE pre-interaction
    expect(tf.getAttribute('aria-invalid')).toBeNull()

    r.dispose()
    mount.remove()
  })

  it('the REAL booking-reservation corpus seed (inline Calendar mode=range): every icon stays contained, no stray float', async () => {
    const mount = document.createElement('div')
    mount.style.width = '414px'
    document.body.append(mount)
    const r = createRenderer()
    r.mount(mount)

    for (const msg of bookingReservationSeed.messages) r.ingestMessage(msg)
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))

    const cal = mount.querySelector('ui-calendar') as HTMLElement
    const calRect = cal.getBoundingClientRect()
    const navIcons = Array.from(cal.querySelectorAll('svg'))
    expect(navIcons.length).toBeGreaterThan(0)
    for (const icon of navIcons) {
      expect(isContained(calRect, icon.getBoundingClientRect())).toBe(true)
    }

    // The Calendar sits inside its Field wrapper (a visible label above it), not a rogue sibling.
    const field = cal.closest('ui-field')
    expect(field).not.toBeNull()
    expect(field?.querySelector('[data-part="label"]')?.textContent).toBe('Check-in — check-out')

    r.dispose()
    mount.remove()
  })

  it('structural resend — `type` arrives on a LATER patch than `value` (streamed-incrementally): still no premature error, icon still contained', async () => {
    const mount = document.createElement('div')
    document.body.append(mount)
    const r = createRenderer()
    r.mount(mount)

    const ID = 'resend-date'
    r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: ID, catalogId: 'agent-ui', sendDataModel: true } })
    r.ingestMessage({ version: 'v1.0', updateDataModel: { surfaceId: ID, value: { booking: { date: '2026-08-20' } } } })
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['root_content'] },
          { id: 'root_content', component: 'CardContent', children: ['f_date'] },
          { id: 'f_date', component: 'Field', label: 'Date', child: 'in_date' },
          // FIRST arrival carries no `type` at all (defaults to text) — a genuinely realistic
          // incremental-streaming shape (structure before the full prop set has arrived).
          { id: 'in_date', component: 'TextField', name: 'date', value: { path: '/booking/date' } },
        ],
      },
    })
    await new Promise((resolve) => requestAnimationFrame(resolve))

    // A later patch on the SAME id adds `type: 'date'` — a prop-only structural resend (RSR-C6) onto
    // the control the renderer already connected; identity is preserved (never re-minted).
    const before = mount.querySelector('ui-text-field')
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: ID,
        components: [
          { id: 'in_date', component: 'TextField', name: 'date', type: 'date', value: { path: '/booking/date' } },
        ],
      },
    })
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))

    const tf = mount.querySelector('ui-text-field') as HTMLElement
    expect(tf).toBe(before) // identity preserved across the resend — never re-minted
    const trailing = tf.querySelector('[slot="trailing"]') as HTMLElement
    const msg = tf.querySelector('.ui-text-field-message') as HTMLElement

    expect(trailing).not.toBeNull() // the calendar affordance really did activate on the type change
    expect(isContained(tf.getBoundingClientRect(), trailing.getBoundingClientRect())).toBe(true)
    expect(msg.hidden).toBe(true)
    expect(tf.getAttribute('aria-invalid')).toBeNull()

    r.dispose()
    mount.remove()
  })
})
