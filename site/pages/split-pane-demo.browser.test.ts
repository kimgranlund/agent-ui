import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the three live ui-split specimens into document.body.
import './split-pane-demo.ts'
import type { UISplitElement } from '@agent-ui/components/components'

// GH #347 — REAL-TIMING HEADROOM (rAF settles under load).
vi.setConfig({ testTimeout: 30_000 })

// split-pane-demo.browser.test.ts — the page-level guard for the ui-split-pane demo: the pane props actually
// biting inside real parents (initial seeding the ratio vector, collapsible arming Enter on the divider it
// leads), and the dynamic add/remove path re-deriving the separator set, with the panel log wired. Runs in
// BOTH Chromium and WebKit (the `site` browser project).

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

const split = (role: string): UISplitElement => {
  const elm = document.querySelector(`ui-split[data-role="${role}"]`)
  if (!elm) throw new Error(`no ui-split with data-role="${role}"`)
  return elm as UISplitElement
}
const clickByText = (text: string): void => {
  const btn = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === text)
  if (!btn) throw new Error(`no ui-button found with text "${text}"`)
  ;(btn as HTMLElement).click()
}

describe('split-pane-demo — the live pane-props page', () => {
  it('mounts the real page: three splits, ≥2 example sections, an aria-live panel log', async () => {
    await raf()
    expect(document.querySelectorAll('ui-split').length).toBe(3)
    expect(document.querySelectorAll('[data-page-content] > section').length).toBeGreaterThanOrEqual(3)
    const log = document.querySelector('ul.event-log')
    expect(log).not.toBeNull()
    expect(log?.getAttribute('aria-live')).toBe('polite')
  })

  it('initial seeds the bounded split: the first pane starts near its declared 0.2 share', async () => {
    await raf()
    const host = split('bounded-split')
    const seps = host.querySelectorAll('[data-separator]')
    expect(seps.length).toBe(2)
    // aria-valuenow = the leading pane's integer % of its two-neighbor pair: 0.2 / (0.2 + 0.55) ≈ 27%.
    const now = Number(seps[0].getAttribute('aria-valuenow'))
    expect(now).toBeGreaterThan(15)
    expect(now).toBeLessThan(40)
  })

  it('Enter on the collapsible pane\'s divider collapses it to the floor and Enter restores it', async () => {
    await raf()
    const host = split('collapsible-split')
    const sep = host.querySelector('[data-separator]') as HTMLElement
    const before = Number(sep.getAttribute('aria-valuenow'))
    sep.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await raf()
    const collapsed = Number(sep.getAttribute('aria-valuenow'))
    expect(collapsed).toBeLessThan(before)
    sep.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await raf()
    expect(Number(sep.getAttribute('aria-valuenow'))).toBeGreaterThan(collapsed)
  })

  it('adding and removing a workspace panel re-derives panes and separators (N panes ⇒ N−1)', async () => {
    await raf()
    const host = split('dynamic-split')
    expect(host.querySelectorAll('ui-split-pane').length).toBe(2)
    expect(host.querySelectorAll('[data-separator]').length).toBe(1)
    clickByText('Add a panel')
    await raf()
    await raf()
    expect(host.querySelectorAll('ui-split-pane').length).toBe(3)
    expect(host.querySelectorAll('[data-separator]').length).toBe(2)
    clickByText('Remove the last panel')
    await raf()
    await raf()
    expect(host.querySelectorAll('ui-split-pane').length).toBe(2)
    expect(host.querySelectorAll('[data-separator]').length).toBe(1)
    const lines = [...document.querySelectorAll('ul.event-log > li')]
    expect(lines.some((l) => l.textContent?.includes('add'))).toBe(true)
    expect(lines.some((l) => l.textContent?.includes('remove'))).toBe(true)
  })
})
