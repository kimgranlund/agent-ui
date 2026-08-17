// site/pages/events.test.ts — the standing drift gate for events.html (GH #1045). Two legs:
//
//   G1 — controlsWithEvents() (lib/frontmatter.ts) is a real, non-vacuous derivation off the shipped
//        descriptor set, with a genuine NEGATIVE CONTROL: a control whose descriptor declares
//        `events: []` (ui-card) must NOT appear — proving the "at least one event" filter actually
//        bites, not just that it returns something.
//   G2 — the page module (side-effect import, the a2a-tic-tac-toe.test.ts jsdom precedent) mounts, the
//        derived per-control Events section renders a real ui-select/ui-switch table, and the live event
//        log genuinely grows when the real controls emit — a mocked/inert demo would leave the log empty.
import { describe, it, expect, beforeAll } from 'vitest'
import { controlsWithEvents } from '../lib/frontmatter.ts'

describe('controlsWithEvents() — the derived per-control event inventory', () => {
  const members = controlsWithEvents()

  it('anti-vacuous: a real, non-trivial slice of the fleet declares events', () => {
    expect(members.length).toBeGreaterThan(5)
  })

  it('includes ui-select and ui-switch (this page’s own live demo pair)', () => {
    expect(members.some((m) => m.tag === 'ui-select')).toBe(true)
    expect(members.some((m) => m.tag === 'ui-switch')).toBe(true)
  })

  it('negative control: ui-card (events: []) is genuinely excluded — the filter bites', () => {
    expect(members.some((m) => m.tag === 'ui-card')).toBe(false)
  })

  it('every included control’s events sequence really is non-empty (re-derives the filter directly)', () => {
    for (const m of members) {
      expect(m.doc.descriptor.sequences.get('events')?.length ?? 0).toBeGreaterThan(0)
    }
  })
})

describe('events.html page — mounted (jsdom)', () => {
  let root: ParentNode

  beforeAll(async () => {
    // jsdom reality (the a2ui-chat.test.ts / a2ui-live.ask-lifecycle.test.ts precedent): `ElementInternals.
    // setFormValue`/`setValidity` are ABSENT in jsdom, and this page mounts real form-associated controls
    // (ui-select, ui-switch). Stub ONCE at the shared prototype, BEFORE the deferred page import below (a
    // static top-of-file import would evaluate the page's eager mount before the stub lands).
    if (typeof ElementInternals.prototype.setFormValue !== 'function') {
      ;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = function (): void {}
      ;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = function (): void {}
    }
    const appRoot = document.createElement('div')
    appRoot.id = 'app'
    document.body.append(appRoot)
    await import('./events.ts') // mounts on import (mountPage), exactly like every other /site page
    root = appRoot
  })

  it('renders the derived per-control Events section for ui-select', () => {
    const headings = [...root.querySelectorAll('h3')].map((h) => h.textContent)
    expect(headings).toContain('ui-select')
    expect(headings).toContain('ui-switch')
  })

  it('mounts the real live ui-select + ui-switch pair', () => {
    expect(root.querySelector('ui-select')).not.toBeNull()
    expect(root.querySelector('ui-switch')).not.toBeNull()
  })

  it('the live event log genuinely grows when the real controls emit (not a static/mocked demo)', () => {
    const log = root.querySelector('.event-log') as HTMLElement
    const before = log.children.length

    const select = root.querySelector('ui-select') as HTMLElement
    select.dispatchEvent(new CustomEvent('select', { detail: 'pro' }))
    expect(log.children.length).toBe(before + 1)
    expect(log.lastElementChild?.textContent).toContain('select')

    const uiSwitch = root.querySelector('ui-switch') as HTMLElement
    uiSwitch.dispatchEvent(new Event('change'))
    expect(log.children.length).toBe(before + 2)
    expect(log.lastElementChild?.textContent).toContain('change')
  })
})
