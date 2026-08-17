// devtools-harness.helper.test.ts — the FUNCTIONAL half of the S5 helper proof (SPEC-R11 AC2's drive,
// jsdom tier): every `@agent-ui/devtools/playwright` helper drives the REAL harness page through a
// jsdom-backed structural `HarnessPage` fake — the same six members playwright's `Page` satisfies
// (type-compat proven in the package suite). Because the fake queries the SAME live document the real
// page mounted, this genuinely proves helper-selector ↔ page-hook agreement end to end (SPEC-R8 AC3's
// same-list law): a hook rename reddens THIS file. The real-engine leg (real geometry, real composer
// interaction) is devtools-harness.browser.test.ts; the honest residual gap — a real playwright `Page`
// against a live `vite dev` boot — is named in the slice Findings, not silently assumed.
import { describe, it, expect, beforeAll } from 'vitest'
import { openHarness, selectBackend, postTurn, waitForTurnEnd, readTimeline, expectRendered, exportCapture } from '@agent-ui/devtools/playwright'
import type { HarnessPage } from '@agent-ui/devtools/playwright'

beforeAll(async () => {
  if (typeof ElementInternals.prototype.setFormValue !== 'function') {
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = function (): void {}
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = function (): void {}
  }
  await import('./devtools-harness.ts') // the REAL page module (deferred — after the jsdom stubs)
})

/** The jsdom-backed structural Page: the six `HarnessPage` members over the live document. */
function jsdomPage(): HarnessPage & { visited: string[] } {
  const q = (sel: string): Element | null => document.querySelector(sel)
  const page: HarnessPage & { visited: string[] } = {
    visited: [],
    goto(url: string): Promise<void> {
      page.visited.push(url) // jsdom can't navigate; the page module is already mounted (deferred import)
      return Promise.resolve()
    },
    click(sel: string): Promise<void> {
      const el = q(sel)
      if (!(el instanceof HTMLElement)) return Promise.reject(new Error(`click: no element for ${sel}`))
      el.click()
      return Promise.resolve()
    },
    fill(sel: string, value: string): Promise<void> {
      const el = q(sel)
      if (!(el instanceof HTMLElement)) return Promise.reject(new Error(`fill: no element for ${sel}`))
      el.textContent = value
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return Promise.resolve()
    },
    async waitForSelector(sel: string, options?: { timeout?: number }): Promise<Element> {
      const deadline = Date.now() + (options?.timeout ?? 4000)
      for (;;) {
        const el = q(sel)
        if (el !== null) return el
        if (Date.now() > deadline) throw new Error(`waitForSelector timed out: ${sel}`)
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
    },
    $eval<R>(sel: string, fn: (element: Element) => R): Promise<R> {
      const el = q(sel)
      if (el === null) return Promise.reject(new Error(`$eval: no element for ${sel}`))
      return Promise.resolve(fn(el))
    },
    $$eval<R>(sel: string, fn: (elements: Element[]) => R): Promise<R> {
      return Promise.resolve(fn([...document.querySelectorAll(sel)]))
    },
  }
  return page
}

describe('the playwright helpers drive the REAL page end to end (SPEC-R11 over SPEC-R8 hooks)', () => {
  it('openHarness → selectBackend → postTurn → waitForTurnEnd → readTimeline → expectRendered → exportCapture', async () => {
    const page = jsdomPage()

    await openHarness(page, 'http://localhost:5173')
    expect(page.visited).toEqual(['http://localhost:5173/devtools-harness.html'])

    await selectBackend(page, 'replay') // already active — proves the active-state wait too

    const since = await postTurn(page, 'render the seed button')
    expect(since).toBe(0)
    await waitForTurnEnd(page, { since })

    const events = await readTimeline(page)
    expect(events.map((e) => e.kind)).toEqual(['turn-start', 'line', 'line', 'turn-end', 'render'])
    expect(events.at(-1)).toMatchObject({ kind: 'render', surfaceId: 'canvas', ok: true })

    await expectRendered(page, 'canvas') // the page's own browser-truth verdict row

    const capture = await exportCapture(page)
    expect(capture.kind).toBe('agent-ui-devtools-capture')
    expect(capture.version).toBe(1)
    expect(capture.timeline.map((e) => e.kind)).toEqual(['turn-start', 'line', 'line', 'turn-end', 'render'])
  })

  it('NEGATIVE control (SPEC-R11 AC2): expectRendered goes RED against a surfaceId that never rendered', async () => {
    const page = jsdomPage()
    await expect(expectRendered(page, 'surface-that-never-rendered', { timeoutMs: 150 })).rejects.toThrow(/waitForSelector timed out/)
  })

  it('a second turn needs the since baseline — waitForTurnEnd disambiguates consecutive turns', async () => {
    const page = jsdomPage()
    const since = await postTurn(page, 'again')
    expect(since).toBe(1) // one turn already completed above
    await waitForTurnEnd(page, { since })
    const events = await readTimeline(page)
    // the replay script has ONE canned turn — turn 2 exhausts: meta error → turn-end{status:'halt'}
    const kinds = events.map((e) => e.kind)
    expect(kinds.filter((k) => k === 'turn-start')).toHaveLength(2)
    expect(events.some((e) => e.kind === 'meta')).toBe(true)
    expect(events.filter((e): e is Extract<typeof e, { kind: 'turn-end' }> => e.kind === 'turn-end').at(-1)?.status).toBe('halt')
  })
})
