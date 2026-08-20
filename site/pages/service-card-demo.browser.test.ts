import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live gateway list + the availability-toggle
// scenario into document.body (mountPage appends to `#app ?? document.body` — the modal-demo.browser.test.ts
// precedent).
import './service-card-demo.ts'
import type { UIServiceCardElement } from '@agent-ui/components/components'

// GH #347 — REAL-TIMING HEADROOM. See vitest.browser.config.ts's own comment; a raf-settling test's duration
// is set by the browser's own scheduling, which stretches under concurrent host load.
vi.setConfig({ testTimeout: 30_000 })

// service-card-demo.browser.test.ts — the PAGE-LEVEL proof that the demo's OWN toggle scenario really drives
// ADR-0224 cl.4's availability law on a REAL rendered card (the control's own pixel-truth audit — every state
// combination, forced-colors — lives in service-card.browser.test.ts; this file proves the DEMO page's wiring:
// a real click on the "Take Search Index offline" button flips the real card's `available` property, and the
// accent edge genuinely repaints as a result — a REAL browser fact a jsdom custom-property cascade cannot be
// trusted to reproduce). It also proves the `action` event's activation contract end-to-end on the demo's own
// event log: it fires on a real click of an available card's Open button, and NEVER on a real click of an
// unavailable card's Unavailable chip — a real disabled native `<button>` cannot dispatch `click` at all (the
// platform contract this control leans on, not a JS guard) — the negative control that bites.

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`no element found with id "${id}"`)
  return el as T
}

function actionButtonOf(card: HTMLElement): HTMLButtonElement {
  const btn = card.querySelector('[data-part="action"]')
  if (!btn) throw new Error('no [data-part="action"] button found on the card')
  return btn as HTMLButtonElement
}

function logLines(): string[] {
  return [...document.querySelectorAll('.event-log li')].map((li) => li.textContent ?? '')
}

describe('service-card-demo — the toggle scenario drives the availability law on a REAL rendered card (ADR-0224 cl.4)', () => {
  it('starts available: the real action button is enabled and labelled "Open"', async () => {
    const card = byId<UIServiceCardElement>('service-card-toggle-target')
    await card.updateComplete
    const action = actionButtonOf(card)
    expect(card.hasAttribute('available'), 'the toggle target should start available').toBe(true)
    expect(action.disabled, 'the action button should not start disabled').toBe(false)
    expect(action.textContent).toContain('Open')
  })

  it('one real click on the toggle button flips `available` off AND repaints the status dot + the action swap TOGETHER', async () => {
    const card = byId<UIServiceCardElement>('service-card-toggle-target')
    const toggleButton = byId<HTMLButtonElement>('service-card-toggle-button')
    await card.updateComplete
    const dot = card.querySelector('[data-part="status"]') as Element
    const availableDot = getComputedStyle(dot).backgroundColor

    toggleButton.click()
    await card.updateComplete

    const action = actionButtonOf(card)
    expect(card.hasAttribute('available'), 'the available attribute should flip off from the ONE click').toBe(false)
    // The action swap: the SAME native <button> element, now disabled, reading the literal "Unavailable" chip.
    expect(action.disabled, 'a real disabled native button — the platform inert contract, free of charge').toBe(true)
    expect(action.textContent).toBe('Unavailable')
    // The status dot REPAINTED (the 0224 Amendment retired the accent edge — the dot is the sole
    // colour-status carrier) — a REAL browser fact (the css custom-property cascade a jsdom
    // getComputedStyle cannot be trusted to resolve the same way, service-card.browser.test.ts's own
    // rationale) — from this ONE click, never a separate coordinated edit.
    const unavailableDot = getComputedStyle(dot).backgroundColor
    expect(unavailableDot, 'the status dot colour did not repaint on the toggle click').not.toBe(availableDot)
  })

  it('the `action` event fires on a real click while available, and NEVER on a real click while unavailable', async () => {
    const claims = byId<UIServiceCardElement>('service-card-claims') // starts (and stays) available
    const toggleTarget = byId<UIServiceCardElement>('service-card-toggle-target') // unavailable, from the previous test
    await claims.updateComplete
    const before = logLines().length

    // A real click on an available card's real, enabled action button.
    actionButtonOf(claims).click()
    await claims.updateComplete
    expect(logLines().length, 'a click on an available card\'s Open button should log exactly one action').toBe(before + 1)
    expect(logLines().at(-1)).toContain('action')

    // The negative control: a real click on the now-unavailable card's REAL disabled native <button> — the
    // platform refuses to dispatch `click` on a disabled button at all, so the log must NOT grow.
    const afterClaims = logLines().length
    actionButtonOf(toggleTarget).click()
    await toggleTarget.updateComplete
    expect(logLines().length, 'clicking the disabled Unavailable chip must log nothing — the negative control').toBe(afterClaims)
  })
})
