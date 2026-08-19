import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-badge specimens into document.body
// (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './badge-demo.ts'

// GH #347 — REAL-TIMING HEADROOM (rAF + kernel microtask settles under host load): vitest.browser.config.ts.
vi.setConfig({ testTimeout: 30_000 })

// badge-demo.browser.test.ts — the PAGE-LEVEL proof that the ui-badge demo mounts the REAL token: every badge label
// is SHORT (a token, never a headline — the GH #1279 law), the run list carries all five intents, and the live
// property-write specimen actually re-points `intent`, with the out-of-enum write hardened back to neutral
// (SPEC-R11 AC2) and logged.

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const clickByText = (t: string): void => {
  const b = [...document.querySelectorAll('ui-button')].find((x) => x.textContent?.trim() === t)
  if (!b) throw new Error(`no ui-button "${t}"`)
  ;(b as HTMLElement).click()
}

describe('badge-demo — short tokens in a real list + a live hardened intent write', () => {
  it('mounts ≥ 3 example sections; every badge label is a token (≤ 3 words) and all five intents appear', async () => {
    await raf()
    expect(document.querySelectorAll('[data-page-content] > section').length).toBeGreaterThanOrEqual(3)
    const badges = [...document.querySelectorAll('ui-badge')]
    expect(badges.length).toBeGreaterThanOrEqual(10)
    for (const b of badges) {
      const words = (b.getAttribute('label') ?? '').trim().split(/\s+/).filter(Boolean)
      expect(words.length, `badge label "${b.getAttribute('label')}" is not a token`).toBeLessThanOrEqual(3)
    }
    for (const i of ['neutral', 'info', 'success', 'warning', 'danger']) {
      expect(document.querySelector(`ui-badge[intent="${i}"]`), `no ui-badge[intent=${i}]`).not.toBeNull()
    }
  })

  it('a property write re-points the live badge; bound garbage is hardened back to neutral and logged', async () => {
    await raf()
    const log = document.querySelector('ul.event-log[aria-live="polite"]') as HTMLUListElement
    expect(log).not.toBeNull()
    expect(log.children.length).toBe(0)

    clickByText('danger · Failing')
    await raf()
    const live = [...document.querySelectorAll('ui-badge')].find((b) => b.getAttribute('label') === 'Failing' && b.closest('section')?.textContent?.includes('written live'))
    expect(live, 'the live badge did not take label=Failing').not.toBeNull()
    expect(live?.getAttribute('intent')).toBe('danger')
    expect(log.children.length).toBe(1)
    expect(log.children[0].textContent).toContain('rendered intent="danger"')

    clickByText('bound garbage: "purple"')
    await raf()
    expect(live?.getAttribute('intent'), 'out-of-enum intent was not hardened to neutral').toBe('neutral')
    expect(log.children.length).toBe(2)
    expect(log.children[1].textContent).toContain('intent ← "purple"')
    expect(log.children[1].textContent).toContain('rendered intent="neutral"')
  })
})
