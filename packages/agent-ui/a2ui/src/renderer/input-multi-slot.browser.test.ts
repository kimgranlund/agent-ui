// input-multi-slot.browser.test.ts — ADR-0161's own acceptance shape (GH #314): a real Chromium/WebKit
// engine drives a REAL `ui-calendar` range selection through the FULL renderer host (`createRenderer`,
// not a hand-rolled `TreeDeps` stub or a direct `installInputBinding` call) end-to-end into a submitted
// action's `dataModel` snapshot — the Hotel-Concierge booking-form defect this ADR closes. jsdom can
// dispatch the same synthetic clicks (`catalog/default/index.test.ts`'s RadioGroup/SegmentedControl
// precedent), but a real engine is the stronger, documented-preferred proof for a user gesture driving
// the real control's click delegation + focus/keyboard cursor bookkeeping (the `tree.browser.test.ts`
// precedent this file follows).

import { describe, it, expect } from 'vitest'
import '@agent-ui/components/components' // self-defines ui-* controls (the real default-catalog factories)
import { createRenderer } from './renderer.ts'
import type { A2uiClientMessage } from './renderer.ts'
import type { A2uiActionMessage } from './action.ts'

const isAction = (m: A2uiClientMessage): m is A2uiActionMessage => 'action' in m

describe('ADR-0161 / GH #314 — a real ui-calendar range pick writes valueStart/valueEnd and a submit action carries both', () => {
  it('two real day-cell clicks complete a range; surface.data holds the pair; the submit action.dataModel carries both', () => {
    const mount = document.createElement('div')
    document.body.append(mount)
    const r = createRenderer()
    r.mount(mount)

    const sent: A2uiClientMessage[] = []
    r.onClientMessage((m) => sent.push(m))

    r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui', sendDataModel: true } })
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: 'Column', children: ['cal', 'submit'] },
          {
            id: 'cal',
            component: 'Calendar',
            name: 'stay',
            mode: 'range',
            valueStart: { path: '/checkIn' },
            valueEnd: { path: '/checkOut' },
          },
          { id: 'submit', component: 'Button', label: 'Book', action: { action: 'book' } },
        ],
      },
    })
    r.finalize('s1')

    // The two grid cells the user picks — day 5 and day 12 of the calendar's CURRENT display month
    // (no `value`/`valueStart`/`valueEnd` seeded, so calendar.ts's own connect-time default is TODAY;
    // `min`/`max` are absent, so neither day is disabled). Real `.click()`, not a synthetic dispatch on
    // an off-DOM stub — the full click-delegation path (`#handleGridClick` → `#commitDate` →
    // `#commitRangeDate`) runs exactly as a user's pointer would drive it.
    const cal = mount.querySelector('ui-calendar') as HTMLElement & { valueStart: string; valueEnd: string }
    expect(cal).not.toBeNull()
    const grid = cal.querySelectorAll<HTMLElement>('[role="gridcell"]')
    const byDay = (day: string) =>
      [...grid].find((cell) => {
        const iso = cell.dataset['date']
        return iso !== undefined && iso.endsWith(`-${day}`) && cell.getAttribute('aria-disabled') !== 'true'
      })
    const start = byDay('05')
    const end = byDay('12')
    expect(start, 'day 05 cell must exist and be enabled').toBeDefined()
    expect(end, 'day 12 cell must exist and be enabled').toBeDefined()

    start!.click() // anchor pick — `select` fires, `change` does NOT (range incomplete, ADR-0093 clause 2)
    expect(sent.filter(isAction)).toHaveLength(0) // no submit yet
    end!.click() // completion pick — `#commitRangeDate` fires ONE `change` with BOTH props already final

    // The control's own accessors reflect the completed, normalized range.
    const startIso = cal.valueStart
    const endIso = cal.valueEnd
    expect(startIso).not.toBe('')
    expect(endIso).not.toBe('')
    expect(startIso < endIso).toBe(true) // day 05 < day 12 — no swap needed, but asserts real dates landed

    // ADR-0161's headline: the renderer's generic LLD-C8 controller wrote BOTH slots back into
    // surface.data at their bound paths — the GH #314 defect (range values binding one-way only) is
    // closed. Read it the same way `action.dataModel` will: through a real submitted action, below.
    ;(mount.querySelector('ui-button') as HTMLElement).click()

    const actions = sent.filter(isAction)
    expect(actions).toHaveLength(1)
    const dataModel = actions[0]!.action.dataModel as { checkIn: string; checkOut: string } | undefined
    expect(dataModel).toBeDefined()
    expect(dataModel!.checkIn).toBe(startIso) // the submit snapshot carries the FULL range, not half of it
    expect(dataModel!.checkOut).toBe(endIso)

    r.dispose()
    mount.remove()
  })

  it('the first pick alone (no completion) writes nothing — a half-open range never lands in the data model, DIRECTLY OBSERVED via a submit', () => {
    const mount = document.createElement('div')
    document.body.append(mount)
    const r = createRenderer()
    r.mount(mount)

    const sent: A2uiClientMessage[] = []
    r.onClientMessage((m) => sent.push(m))

    r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: 's2', catalogId: 'agent-ui', sendDataModel: true } })
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's2',
        components: [
          { id: 'root', component: 'Column', children: ['cal', 'submit'] },
          {
            id: 'cal',
            component: 'Calendar',
            mode: 'range',
            valueStart: { path: '/checkIn' },
            valueEnd: { path: '/checkOut' },
          },
          { id: 'submit', component: 'Button', label: 'Book', action: { action: 'book' } },
        ],
      },
    })
    // Seed a DEFINED baseline data model (an unrelated marker key) — otherwise `surface.data` stays
    // the pristine `undefined` a fresh surface starts with, and `action.dataModel` would be `undefined`
    // regardless of whether the writeback ran, making the "writes nothing" claim unobservable this way.
    r.ingestMessage({ version: 'v1.0', updateDataModel: { surfaceId: 's2', path: '/marker', value: 'baseline' } })
    r.finalize('s2')

    const cal = mount.querySelector('ui-calendar') as HTMLElement
    const grid = cal.querySelectorAll<HTMLElement>('[role="gridcell"]')
    const start = [...grid].find((cell) => {
      const iso = cell.dataset['date']
      return iso !== undefined && iso.endsWith('-05') && cell.getAttribute('aria-disabled') !== 'true'
    })
    expect(start).toBeDefined()

    start!.click() // anchor only — `change` never fires (ADR-0093 clause 2), so no listener runs at all

    // The control's own accessor confirms the anchor pick alone never completed a range.
    expect((cal as unknown as { valueEnd: string }).valueEnd).toBe('')

    // DIRECTLY OBSERVED (not inferred from the accessor alone): submit and read the actual client
    // message's dataModel — a hypothetical regression that wrote `/checkIn` on the anchor pick (while
    // `valueEnd` stayed correctly empty) would surface HERE as a stray key, where the accessor check
    // above could never catch it.
    ;(mount.querySelector('ui-button') as HTMLElement).click()
    const actions = sent.filter(isAction)
    expect(actions).toHaveLength(1)
    const dataModel = actions[0]!.action.dataModel as Record<string, unknown> | undefined
    expect(dataModel).toEqual({ marker: 'baseline' }) // the seeded baseline, unchanged — no stray keys

    r.dispose()
    mount.remove()
  })
})
