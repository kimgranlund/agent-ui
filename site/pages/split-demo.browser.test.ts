import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the three live ui-split specimens into document.body.
import './split-demo.ts'
import type { UISplitElement } from '@agent-ui/components/components'

// GH #347 — REAL-TIMING HEADROOM (rAF settles under load).
vi.setConfig({ testTimeout: 30_000 })

// split-demo.browser.test.ts — the page-level guard for the ui-split demo: the three REAL splits mounted
// (uncontrolled editor/preview, controlled list/detail, vertical console), the separators rendered with the
// ARIA contract, the keyboard path firing input+change into the resize log, and the controlled specimen's
// echo-back loop actually moving `sizes`. Runs in BOTH Chromium and WebKit (the `site` browser project).

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

const split = (role: string): UISplitElement => {
  const elm = document.querySelector(`ui-split[data-role="${role}"]`)
  if (!elm) throw new Error(`no ui-split with data-role="${role}"`)
  return elm as UISplitElement
}

describe('split-demo — the live resizable-split page', () => {
  it('mounts the real page: three splits, ≥2 example sections, an aria-live resize log', async () => {
    await raf()
    expect(document.querySelectorAll('ui-split').length).toBe(3)
    expect(document.querySelectorAll('[data-page-content] > section').length).toBeGreaterThanOrEqual(3)
    const log = document.querySelector('ul.event-log')
    expect(log).not.toBeNull()
    expect(log?.getAttribute('aria-live')).toBe('polite')
  })

  it('each split renders N−1 focusable role=separator dividers', async () => {
    await raf()
    for (const [role, panes] of [
      ['editor-split', 2],
      ['controlled-split', 2],
      ['vertical-split', 3],
    ] as const) {
      const host = split(role)
      const seps = host.querySelectorAll('[data-separator]')
      expect(seps.length, `${role} separators`).toBe(panes - 1)
      for (const sep of seps) {
        expect(sep.getAttribute('role')).toBe('separator')
        expect(sep.getAttribute('tabindex')).toBe('0')
        expect(sep.getAttribute('aria-valuenow')).not.toBeNull()
      }
    }
  })

  it('a keyboard step on the editor split fires input AND change into the resize log', async () => {
    await raf()
    const host = split('editor-split')
    const sep = host.querySelector('[data-separator]') as HTMLElement
    const before = document.querySelectorAll('ul.event-log > li').length
    sep.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await raf()
    const lines = [...document.querySelectorAll('ul.event-log > li')]
    expect(lines.length).toBeGreaterThanOrEqual(before + 2) // one input + one change per key step
    expect(lines.some((l) => l.textContent?.includes('input'))).toBe(true)
    expect(lines.some((l) => l.textContent?.includes('change'))).toBe(true)
  })

  it('the controlled specimen: a preset writes sizes and the echo-back keeps a key step committed', async () => {
    await raf()
    const host = split('controlled-split')
    const evenBtn = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.includes('[0.5, 0.5]'))
    ;(evenBtn as HTMLElement).click()
    await raf()
    expect(host.sizes).toEqual([0.5, 0.5])
    const sep = host.querySelector('[data-separator]') as HTMLElement
    sep.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await raf()
    // The page's change handler echoed the proposed vector back into `sizes` — it moved off [0.5, 0.5].
    // (Direction is engine/width-dependent under the pair-relative step + min clamps — assert the MOVE, not its sign.)
    const sizes = host.sizes as number[]
    expect(sizes[0]).not.toBeCloseTo(0.5, 5)
    expect(sizes[0] + sizes[1]).toBeCloseTo(1, 5)
    const readout = document.querySelector('[data-demo="sizes-readout"]')
    expect(readout?.textContent).toContain(sizes[0].toFixed(2))
  })
})
