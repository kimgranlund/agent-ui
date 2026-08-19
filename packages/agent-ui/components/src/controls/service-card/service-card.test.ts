import { describe, it, expect } from 'vitest'
import { UIServiceCardElement } from './service-card.ts'

// service-card.test.ts — S1 jsdom probes for ui-service-card (ADR-0224). jsdom cannot prove paint/geometry
// (the browser suite, service-card.browser.test.ts, owns that) — this pins the DECLARED behaviour: typed
// props, ARIA-via-internals, the empty-path/description omission law, and — the centrepiece — the
// availability flip's FOUR coordinated consequences firing off ONE `available` write (cl.4), all from a
// single probe subclass exposing the protected `internals` handle.

class ProbeServiceCard extends UIServiceCardElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-service-card-probe', ProbeServiceCard)

function make(): ProbeServiceCard {
  return new ProbeServiceCard()
}

const action = (el: Element): HTMLButtonElement => el.querySelector('[data-part="action"]') as HTMLButtonElement
const title = (el: Element): HTMLElement => el.querySelector('[data-part="title"]') as HTMLElement
const statusText = (el: Element): HTMLElement => el.querySelector('[data-part="status-text"]') as HTMLElement
const path = (el: Element): HTMLElement | null => el.querySelector('[data-part="path"]')
const description = (el: Element): HTMLElement | null => el.querySelector('[data-part="description"]')

// ── upgrade + typed prop surface ──────────────────────────────────────────────────────────────────

describe('UIServiceCardElement — upgrade + typed props', () => {
  it('upgrades to the class; props default to name/path/description="", available=true, actionLabel="Open", inline=false', () => {
    const el = document.createElement('ui-service-card') as UIServiceCardElement
    expect(el).toBeInstanceOf(UIServiceCardElement)
    expect(el.name).toBe('')
    expect(el.path).toBe('')
    expect(el.description).toBe('')
    expect(el.available).toBe(true)
    expect(el.actionLabel).toBe('Open')
    expect(el.inline).toBe(false)
  })

  it('self-defines as ui-service-card, guarded against double-define', () => {
    expect(customElements.get('ui-service-card')).toBe(UIServiceCardElement)
    expect(() => {
      if (!customElements.get('ui-service-card')) customElements.define('ui-service-card', UIServiceCardElement)
    }).not.toThrow()
  })

  it('actionLabel is NOT reflected (read live at render); a real `action-label` HTML attribute still coerces IN (the mimeType/mime-type kebab-name precedent)', async () => {
    const el = make()
    document.body.append(el)
    el.actionLabel = 'Launch' // a JS write never touches the attribute — actionLabel is reflect:false
    expect(el.hasAttribute('action-label')).toBe(false)
    expect(el.hasAttribute('actionLabel')).toBe(false)
    el.setAttribute('action-label', 'From Markup') // the INBOUND path: attribute → property, via the kebab name
    await el.updateComplete
    expect(el.actionLabel).toBe('From Markup')
    el.remove()
  })

  it('inline reflects as boolean presence (ADR-0223 R2)', () => {
    const el = make()
    document.body.append(el)
    el.inline = true
    expect(el.getAttribute('inline')).toBe('')
    el.inline = false
    expect(el.hasAttribute('inline')).toBe(false)
    el.remove()
  })
})

// ── ARIA (cl.6) ───────────────────────────────────────────────────────────────────────────────────

describe('UIServiceCardElement — ARIA via internals (cl.6)', () => {
  it('internals.role is "group"; no host role/aria-* attribute (FACE — ARIA via internals only)', () => {
    const el = make()
    document.body.append(el)
    expect(el.probeInternals.role).toBe('group')
    expect(el.getAttribute('role')).toBeNull()
    for (const attr of Array.from(el.attributes)) expect(attr.name.startsWith('aria-')).toBe(false)
    el.remove()
  })

  it('internals.ariaLabel mirrors `name`, live', async () => {
    const el = make()
    el.name = 'Claims Agent'
    document.body.append(el)
    expect(el.probeInternals.ariaLabel).toBe('Claims Agent')
    el.name = 'Renamed'
    await el.updateComplete // effects are microtask-batched
    expect(el.probeInternals.ariaLabel).toBe('Renamed')
    el.remove()
  })

  it('the title part mirrors `name`', () => {
    const el = make()
    el.name = 'Claims Agent'
    document.body.append(el)
    expect(title(el).textContent).toBe('Claims Agent')
    el.remove()
  })
})

// ── the empty-value omission law (ADR-0201, applied per part — cl.2) ────────────────────────────────

describe('UIServiceCardElement — path/description render NO box when empty (cl.2)', () => {
  it('path: absent by default; appears when set; removed when cleared back to empty', async () => {
    const el = make()
    document.body.append(el)
    expect(path(el)).toBeNull()
    el.path = '/claims-agent-service'
    await el.updateComplete // effects are microtask-batched
    expect(path(el)?.textContent).toBe('/claims-agent-service')
    el.path = ''
    await el.updateComplete
    expect(path(el)).toBeNull()
    el.remove()
  })

  it('description: absent by default; appears when set; removed when cleared back to empty', async () => {
    const el = make()
    document.body.append(el)
    expect(description(el)).toBeNull()
    el.description = 'Handles first-notice-of-loss intake.'
    await el.updateComplete
    expect(description(el)?.textContent).toBe('Handles first-notice-of-loss intake.')
    el.description = ''
    await el.updateComplete
    expect(description(el)).toBeNull()
    el.remove()
  })

  it('path then description insert in the correct order (heading, path, description)', async () => {
    const el = make()
    document.body.append(el)
    el.description = 'A description first.'
    el.path = '/svc' // path added AFTER description already exists
    await el.updateComplete
    const body = el.querySelector('[data-part="body"]') as HTMLElement
    const kids = Array.from(body.children).map((c) => c.getAttribute('data-part'))
    expect(kids).toEqual(['heading', 'path', 'description'])
    el.remove()
  })
})

// ── the availability law — ONE boolean, FOUR coordinated consequences (cl.4) ────────────────────────

describe('UIServiceCardElement — the availability law (cl.4)', () => {
  it('available=true (default): the action is enabled, labelled with a leading glyph + actionLabel, status-text says "Available"', () => {
    const el = make()
    el.name = 'Claims Agent'
    document.body.append(el)
    const btn = action(el)
    expect(btn.disabled).toBe(false)
    expect(btn.textContent).toBe('→Open')
    expect(statusText(el).textContent).toBe('Available')
    expect(btn.getAttribute('aria-label')).toBe('Open Claims Agent')
    el.remove()
  })

  it('available=false: the SAME button element gains a real disabled attribute + literal "Unavailable" text, status-text flips', async () => {
    const el = make()
    el.name = 'Claims Agent'
    document.body.append(el)
    const btn = action(el)
    el.available = false
    await el.updateComplete // effects are microtask-batched
    expect(action(el)).toBe(btn) // ONE element identity across both states (cl.3)
    expect(btn.disabled).toBe(true)
    expect(btn.textContent).toBe('Unavailable')
    expect(statusText(el).textContent).toBe('Unavailable')
    expect(btn.getAttribute('aria-label')).toBe('Unavailable Claims Agent')
    el.remove()
  })

  it('the self-reflect-on-connect guard: [available] is present at connect even though nobody ever wrote the prop (the default-true reflect-on-write timing gap)', () => {
    const el = make()
    document.body.append(el) // never touches el.available at all — relies purely on the default
    expect(el.available).toBe(true)
    expect(el.hasAttribute('available')).toBe(true) // would be FALSE without the connect-time self-reflect
    el.remove()
  })

  it('[available] round-trips correctly through explicit writes too (the guard never fights a real producer write)', async () => {
    const el = make()
    document.body.append(el)
    el.available = false
    await el.updateComplete
    expect(el.hasAttribute('available')).toBe(false)
    el.available = true
    await el.updateComplete
    expect(el.hasAttribute('available')).toBe(true)
    el.remove()
  })

  it('actionLabel changes only repaint the AVAILABLE-state label, never the unavailable literal', async () => {
    const el = make()
    document.body.append(el)
    el.actionLabel = 'Launch'
    await el.updateComplete
    expect(action(el).textContent).toBe('→Launch')
    el.available = false
    await el.updateComplete
    expect(action(el).textContent).toBe('Unavailable')
    el.actionLabel = 'Ignored' // unavailable never reads actionLabel
    await el.updateComplete
    expect(action(el).textContent).toBe('Unavailable')
    el.remove()
  })

  it('accessible name falls back to the bare label when `name` is empty (no trailing space)', () => {
    const el = make()
    document.body.append(el)
    expect(action(el).getAttribute('aria-label')).toBe('Open')
    el.remove()
  })
})

// ── events — `action` re-emit, available-only (cl.7) ─────────────────────────────────────────────

describe('UIServiceCardElement — `action` event (ADR-0153, cl.7)', () => {
  it('clicking the action button while available emits `action` on the host', () => {
    const el = make()
    document.body.append(el)
    let count = 0
    el.addEventListener('action', () => count++)
    action(el).click()
    expect(count).toBe(1)
    el.remove()
  })

  it('no event fires when unavailable — a real disabled native button refuses .click() activation entirely', async () => {
    // .click() (not a raw dispatchEvent) is the load-bearing call here: the HTML "click() on a disabled
    // form control" algorithm is what refuses activation — a raw `dispatchEvent(new MouseEvent(...))`
    // bypasses that gate even in a real browser (it invokes listeners directly, no activation check),
    // which is exactly why the CROSS-ENGINE proof of a real user gesture being refused lives in
    // service-card.browser.test.ts (userEvent.click, a genuine OS-level gesture through Playwright).
    const el = make()
    document.body.append(el)
    el.available = false
    await el.updateComplete // effects are microtask-batched — the .disabled write must land first
    let count = 0
    el.addEventListener('action', () => count++)
    action(el).click()
    expect(count).toBe(0)
    el.remove()
  })
})

// ── the menu slot stays live regardless of availability (cl.3/cl.4) ─────────────────────────────────

describe('UIServiceCardElement — the menu slot stays interactive when unavailable (cl.3/cl.4)', () => {
  it('a light-DOM [slot="menu"] child is left completely untouched by the availability flip', () => {
    const el = make()
    const menu = document.createElement('button')
    menu.setAttribute('slot', 'menu')
    menu.textContent = 'More'
    el.append(menu)
    document.body.append(el)
    expect(el.querySelector('[slot="menu"]')).toBe(menu)
    el.available = false
    expect(el.querySelector('[slot="menu"]')).toBe(menu) // still present, never removed/disabled
    expect(menu.hasAttribute('disabled')).toBe(false)
    expect(menu.parentElement).toBe(el)
    el.remove()
  })

  it('the host never gains aria-disabled when unavailable — unavailable is data, not disablement', () => {
    const el = make()
    document.body.append(el)
    el.available = false
    expect(el.probeInternals.ariaDisabled).not.toBe('true')
    expect(el.getAttribute('aria-disabled')).toBeNull()
    el.remove()
  })
})

// ── zero residue across connect/disconnect ──────────────────────────────────────────────────────

describe('UIServiceCardElement — zero residue across connect/disconnect', () => {
  it('disconnect removes the click listener; reconnect re-arms exactly once (not stacked)', () => {
    const el = make()
    document.body.append(el)
    let count = 0
    el.addEventListener('action', () => count++)
    action(el).click()
    expect(count).toBe(1)

    el.remove() // disconnect → ac.abort() removes the listener
    action(el).click()
    expect(count).toBe(1) // no change — listener gone

    document.body.append(el) // reconnect → connected() re-runs, #ensureParts is idempotent (no duplicate button)
    expect(el.querySelectorAll('[data-part="action"]')).toHaveLength(1)
    action(el).click()
    expect(count).toBe(2) // exactly one more — not a stacked double
    el.remove()
  })
})
