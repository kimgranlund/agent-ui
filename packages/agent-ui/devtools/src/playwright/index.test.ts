import { describe, it, expect } from 'vitest'
import type { Page } from 'playwright'
import { HARNESS_SELECTORS, HARNESS_PAGE_PATH, openHarness } from './index.ts'
import type { HarnessPage } from './index.ts'

// n5's type half (SPEC-R11): the helper is structurally typed against a CONSUMER-supplied Page — this
// suite proves the REAL playwright `Page` (a devDependency HERE, never a runtime dep — the value-import
// grep gate is layering.test.ts's) satisfies `HarnessPage`, so a playwright consumer passes their page
// straight in while a playwright-less consumer still type-checks the module. The FUNCTIONAL proof over
// the real harness page DOM lives in site/pages/devtools-harness.helper.test.ts (jsdom fake page) and
// the real-engine smoke in site/pages/devtools-harness.browser.test.ts.

// The load-bearing line: if playwright's Page ever stops satisfying the structural slice, THIS stops
// compiling — the drift gate is the type system itself.
const pageSatisfiesHarnessPage = (page: Page): HarnessPage => page

describe('the structural Page slice (SPEC-R11)', () => {
  it("playwright's real Page type satisfies HarnessPage (compile-time law, asserted used)", () => {
    expect(typeof pageSatisfiesHarnessPage).toBe('function')
  })

  it('the selector list is the harness page hook list — one list, two consumers (SPEC-R8 AC3)', () => {
    expect(HARNESS_SELECTORS.status).toBe('[data-devtools="status"]')
    expect(HARNESS_SELECTORS.backend('replay')).toBe('[data-devtools="backend"][data-backend-id="replay"]')
    expect(HARNESS_SELECTORS.verdictOk('canvas')).toBe('[data-devtools="verdict"][data-surface-id="canvas"][data-ok="true"]')
    expect(HARNESS_PAGE_PATH).toBe('/devtools-harness.html')
  })

  it('openHarness normalizes a trailing-slash base URL and waits for the status hook', async () => {
    const calls: string[] = []
    const fake: HarnessPage = {
      goto: (url) => {
        calls.push(`goto:${url}`)
        return Promise.resolve()
      },
      waitForSelector: (sel) => {
        calls.push(`wait:${sel}`)
        return Promise.resolve()
      },
      click: () => Promise.resolve(),
      fill: () => Promise.resolve(),
      $eval: () => Promise.reject(new Error('unused')),
      $$eval: () => Promise.reject(new Error('unused')),
    }
    await openHarness(fake, 'http://localhost:5173/')
    expect(calls).toEqual(['goto:http://localhost:5173/devtools-harness.html', 'wait:[data-devtools="status"]'])
  })
})
