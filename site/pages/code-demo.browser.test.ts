import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-code specimens into document.body
// (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './code-demo.ts'

// GH #347 — REAL-TIMING HEADROOM (rAF settles under host load): vitest.browser.config.ts, REAL-TIMING HEADROOM.
vi.setConfig({ testTimeout: 30_000 })

// code-demo.browser.test.ts — the PAGE-LEVEL proof that the ui-code demo mounts the REAL zero-machinery leaf: the
// verbatim column stays one-text-node (no spans — ui-code never tokenizes itself), the projected column carries real
// `<span data-token>` runs whose concatenated text equals the verbatim source (the SPEC-C2 invariant, projected),
// whitespace survives, and the overflow specimen scrolls inside its own 22rem box rather than blowing it out.

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('code-demo — verbatim vs projected, honestly side by side', () => {
  it('mounts ≥ 3 example sections and one language pair per sample', async () => {
    await raf()
    expect(document.querySelectorAll('[data-page-content] > section').length).toBeGreaterThanOrEqual(3)
    for (const lang of ['json', 'ts', 'css', 'python', 'html', 'markdown']) {
      expect(document.querySelectorAll(`ui-code[language="${lang}"]`).length, `expected a verbatim + projected pair for ${lang}`).toBe(2)
    }
  })

  it('verbatim blocks are a single text node; projected blocks carry data-token spans with identical text', async () => {
    await raf()
    for (const lang of ['json', 'ts', 'css', 'python', 'html', 'markdown']) {
      const [verbatim, projected] = [...document.querySelectorAll(`ui-code[language="${lang}"]`)]
      expect(verbatim.querySelector('[data-token]'), `${lang}: the verbatim block was tokenized`).toBeNull()
      expect(projected.querySelectorAll('[data-token]').length, `${lang}: the projected block has no token spans`).toBeGreaterThan(0)
      expect(projected.textContent).toBe(verbatim.textContent)
    }
  })

  it('whitespace fidelity — tab, trailing spaces and the blank line survive in the DOM text', async () => {
    await raf()
    const ws = [...document.querySelectorAll('ui-code')].find((c) => c.textContent?.includes('tab-indented'))
    expect(ws?.textContent).toContain('\n\treturn value   //')
    expect(ws?.textContent).toContain('}\n\n//')
  })

  it('the overflow specimen scrolls inside its own 22rem box', async () => {
    await raf()
    const overflow = [...document.querySelectorAll('ui-code')].find((c) => c.textContent?.startsWith('curl -sS')) as HTMLElement
    expect(overflow).toBeTruthy()
    expect(overflow.scrollWidth).toBeGreaterThan(overflow.clientWidth)
    expect(overflow.getBoundingClientRect().width).toBeLessThan(400) // 22rem at 16px = 352px; never blown out by the line
  })
})
