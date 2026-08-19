import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-text article into document.body
// (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './text-demo.ts'

// GH #347 — REAL-TIMING HEADROOM (rAF settles under host load): vitest.browser.config.ts, REAL-TIMING HEADROOM.
vi.setConfig({ testTimeout: 30_000 })

// text-demo.browser.test.ts — the PAGE-LEVEL proof that the ui-text demo mounts the REAL control doing its editorial
// job: every variant appears at least once, headings are REAL stamped <h1>–<h3> (the `as` axis), the link is a
// gated <a href> carrying the policy constants (ADR-0114), and truncate/emphasis specimens are present.

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('text-demo — the article is real ui-text, every role, real semantics', () => {
  it('mounts ≥ 3 example sections and one <ui-text> per variant', async () => {
    await raf()
    expect(document.querySelectorAll('[data-page-content] > section').length).toBeGreaterThanOrEqual(3)
    for (const v of ['kicker', 'overline', 'display', 'headline', 'title', 'lead', 'body', 'label', 'quote']) {
      expect(document.querySelector(`ui-text[variant="${v}"]`), `no ui-text[variant=${v}] on the page`).not.toBeNull()
    }
  })

  it('stamps real headings + a real blockquote through `as` — the page outline is honest', async () => {
    await raf()
    expect(document.querySelector('ui-text[as="h1"] h1')?.textContent).toContain('Receipts')
    expect(document.querySelector('ui-text[as="h2"] h2')).not.toBeNull()
    expect(document.querySelector('ui-text[as="h3"] h3')).not.toBeNull()
    expect(document.querySelector('ui-text[as="blockquote"] blockquote')).not.toBeNull()
  })

  it('the link is a real gated <a href> with the ADR-0114 policy constants', async () => {
    await raf()
    const a = document.querySelector('ui-text[as="a"] a') as HTMLAnchorElement | null
    expect(a, 'no stamped <a> inside ui-text[as=a]').not.toBeNull()
    expect(a?.getAttribute('href')).toBe('https://github.com/nonoun/agent-ui')
    expect(a?.getAttribute('rel')).toBe('noopener noreferrer')
    expect(a?.getAttribute('target')).toBe('_blank')
  })

  it('truncate + emphasis specimens are present and behave', async () => {
    await raf()
    const truncated = document.querySelector('ui-text[truncate]') as HTMLElement | null
    expect(truncated).not.toBeNull()
    expect(truncated?.getAttribute('title')).toContain('Quarterly business review')
    expect(document.querySelectorAll('ui-text[emphasis]').length).toBeGreaterThanOrEqual(2)
  })
})
