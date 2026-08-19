import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live composer/attachment lists into document.body.
import './attachment-demo.ts'

// GH #347 — REAL-TIMING HEADROOM (rAF settles under host load; see vitest.browser.config.ts).
vi.setConfig({ testTimeout: 30_000 })

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const clickByText = (text: string): void => {
  const btn = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === text)
  if (!btn) throw new Error(`no ui-button found with text "${text}"`)
  ;(btn as HTMLElement).click()
}
const strip = (): HTMLElement => document.querySelector('[aria-label="Pending attachments"]') as HTMLElement
const logLines = (): string[] => [...document.querySelectorAll('ul.event-log > li')].map((li) => li.textContent ?? '')

describe('attachment-demo — REAL ui-attachment cards in a composer strip + a received list, with a composer action log', () => {
  it('mounts ≥ 2 example sections, 1 pending card + 3 received cards, each with the name/meta parts', async () => {
    await raf()
    expect(document.querySelectorAll('section').length).toBeGreaterThanOrEqual(2)
    expect(strip().querySelectorAll('ui-attachment').length, 'the thread opens with one attached file').toBe(1)
    const received = document.querySelector('[aria-label="Attachments in this message"]')!
    expect(received.querySelectorAll('ui-attachment').length).toBe(3)
    for (const card of document.querySelectorAll('ui-attachment')) {
      expect(card.querySelector('[data-part="name"]')?.textContent?.length ?? 0).toBeGreaterThan(0)
      expect(card.querySelector('[data-part="meta"]'), 'every fixture carries a finite sizeBytes ⇒ a meta cell').not.toBeNull()
    }
    expect(document.querySelector('ul.event-log[aria-live="polite"]'), 'the action log is wired').not.toBeNull()
    expect(logLines().length, 'the opening attach is logged').toBe(1)
    expect(logLines()[0]).toContain('composer:attach')
  })

  it('"Attach next file" appends a real card and logs; "Remove" drops it and logs — the card itself emits nothing', async () => {
    await raf()
    clickByText('Attach next file')
    await raf()
    expect(strip().querySelectorAll('ui-attachment').length).toBe(2)
    expect(logLines().at(-1)).toContain('composer:attach  →  console-export.json  pending=2')
    const remove = strip().querySelector('ui-button[aria-label="Remove console-export.json"]') as HTMLElement
    expect(remove).toBeTruthy()
    remove.click()
    await raf()
    expect(strip().querySelectorAll('ui-attachment').length).toBe(1)
    expect(logLines().at(-1)).toContain('composer:remove  →  console-export.json  pending=1')
  })
})
