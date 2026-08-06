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
import '@agent-ui/components/components' // self-defines ui-* controls (the real fleet factories)
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

    const cal = mount.querySelector('ui-calendar') as HTMLElement
    expect(cal).not.toBeNull()
    const grid = cal.querySelectorAll<HTMLElement>('[role="gridcell"]')
    const day05 = [...grid].find((cell) => {
      const iso = cell.dataset['date']
      return iso !== undefined && iso.endsWith('-05') && cell.getAttribute('aria-disabled') !== 'true'
    })
    expect(day05, 'day 05 cell must exist and be enabled').toBeDefined()
    day05!.click() // real click-delegation path, not a synthetic off-DOM set

    const pickedIso = (cal as unknown as { value: string }).value
    expect(pickedIso).not.toBe('')

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
