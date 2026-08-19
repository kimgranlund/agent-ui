import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-avatar roster into document.body
// (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './avatar-demo.ts'

// GH #347 — REAL-TIMING HEADROOM (rAF settles under concurrent host load).
vi.setConfig({ testTimeout: 30_000 })

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('avatar-demo — the real ui-avatar mounts in a team roster walking the fallback chain', () => {
  it('mounts the roster: five real ui-avatar rows, each beside a presence dot', async () => {
    await raf()
    expect(customElements.get('ui-avatar'), 'ui-avatar must be a defined custom element').toBeDefined()
    const roster = document.querySelector('ul[aria-label="Team roster"]')
    expect(roster, 'the roster list should be on the page').not.toBeNull()
    const rows = [...roster!.querySelectorAll(':scope > li')]
    expect(rows.length).toBe(5)
    for (const row of rows) {
      expect(row.querySelector('ui-avatar'), 'every roster row mounts a real ui-avatar').not.toBeNull()
      expect(row.querySelector('[role="img"][aria-label]'), 'every roster row has a page-authored presence dot').not.toBeNull()
    }
  })

  it('the initials-only row renders the initials part; the empty leaf does not', async () => {
    await raf()
    const rows = [...document.querySelectorAll('ul[aria-label="Team roster"] > li')]
    const initialsOnly = rows[3].querySelector('ui-avatar') as HTMLElement // Tomás Herrera — no src
    const empty = rows[4].querySelector('ui-avatar') as HTMLElement // no src, no identity → glyph
    expect(initialsOnly.querySelector('[data-part="initials"]')?.textContent?.trim()).toBe('TH')
    expect(empty.querySelector('[data-part="initials"]')).toBeNull()
  })

  it('renders at least two example sections incl. every [size] tier', () => {
    expect(document.querySelectorAll('section > h2').length).toBeGreaterThanOrEqual(2)
    for (const size of ['sm', 'md', 'lg']) {
      expect(document.querySelector(`ui-avatar[size="${size}"]`), `a size="${size}" specimen should exist`).not.toBeNull()
    }
  })
})
