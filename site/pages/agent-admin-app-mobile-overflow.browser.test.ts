// agent-admin-app-mobile-overflow.browser.test.ts — GH #1223: /agent-admin-app rendered zoomed-out on a
// real phone. The viewport <meta> exists on every page, so the zoom-out is the mobile engine widening the
// LAYOUT viewport to fit CONTENT that overflows 414px (document.scrollWidth > window.innerWidth). This
// file is the standing regression: it mounts the REAL page at the fleet-default 414×896 (ADR-0150) and
// asserts the document lays out within the viewport width. On failure it walks the whole tree and NAMES
// the offending elements (tag/id/data-part + the overflowing right edge), so a regression reports its own
// culprit instead of a bare boolean.
//
// Its own file (the agent-admin-app-scroll.browser.test.ts precedent): the page module resolves `#app`
// at import time, so the real `<div id="app">` must exist BEFORE the dynamic import — folding into
// agent-admin-app.browser.test.ts (module-level side-effect import) would mount into document.body and
// skip the `#app`-scoped CSS this page actually ships.
import { describe, it, expect, vi } from 'vitest'
import { page } from 'vitest/browser'

// GH #347 — REAL-TIMING HEADROOM. This file awaits real elapsed time (a `page.viewport()` driver round
// trip, rAF settles, and a mid-test page-module `import()` pulling the whole page graph through the dev
// server), so its duration stretches under concurrent host load.
// Class definition + why this is not a global raise: vitest.browser.config.ts, REAL-TIMING HEADROOM.
vi.setConfig({ testTimeout: 30_000 })

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

/** A human-usable name for an offender: tag + id/data-part/class head. */
function describeEl(el: Element): string {
  const id = el.id ? `#${el.id}` : ''
  const part = el.getAttribute('data-part')
  const cls = el.classList.length ? `.${[...el.classList].slice(0, 2).join('.')}` : ''
  return `${el.tagName.toLowerCase()}${id}${part ? `[data-part="${part}"]` : ''}${cls}`
}

/** Walk every element and report those whose rendered box escapes the viewport width.
 *
 *  Two escape routes are covered, because desktop `document.scrollWidth` alone misses one of them:
 *   - IN-FLOW content wider than the viewport (the classic scrollWidth > innerWidth case). Boxes inside a
 *     scroll container that clips them are skipped — their overflow is that container's own job.
 *   - `position: fixed` boxes laid out beyond the viewport edge (GH #1223's actual offender — the closed
 *     roster drawer's dialog). A fixed box escapes every ancestor's overflow clipping, contributes NOTHING
 *     to scrollWidth in a desktop engine, yet a real phone's layout-viewport sizing still sees the
 *     rendered content and zooms the page out to fit it. Fixed boxes therefore never get the
 *     clipped-ancestor exemption. */
function findOffenders(limit: number): string[] {
  const clips = (el: Element): boolean => {
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const ox = getComputedStyle(a).overflowX
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true
    }
    return false
  }
  const out: string[] = []
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0) continue
    if (r.right <= limit + 1) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden') continue
    const fixed = cs.position === 'fixed'
    if (fixed || !clips(el)) out.push(`${describeEl(el)}${fixed ? ' [fixed]' : ''} right=${Math.round(r.right)}px`)
  }
  return out
}

/** One overflow assertion for the CURRENT page state — fails naming the offenders. Checks BOTH
 *  document.scrollWidth (in-flow overflow) and the rendered-box walk (fixed off-canvas boxes that
 *  scrollWidth cannot see — the class GH #1223 was actually about). */
function assertNoOverflow(state: string): void {
  const limit = window.innerWidth
  const scrollWidth = document.documentElement.scrollWidth
  const offenders = findOffenders(limit)
  if (scrollWidth > limit || offenders.length > 0) {
    expect.fail(
      `[${state}] horizontal overflow at ${limit}px (document.scrollWidth ${scrollWidth}px) — offending elements:\n` +
        offenders.map((o) => `  - ${o}`).join('\n'),
    )
  }
  expect(scrollWidth).toBeLessThanOrEqual(limit)
}

describe('agent-admin-app — no horizontal overflow at the 414px fleet viewport (GH #1223)', () => {
  it('every pane, every settings section, and the roster drawer lay out within the viewport', async () => {
    await page.viewport(414, 896)

    // The real page's static HTML provides #app before the script runs — recreate that contract.
    document.body.innerHTML = ''
    const app = document.createElement('div')
    app.id = 'app'
    document.body.appendChild(app)

    await import('./agent-admin-app.ts')
    await raf()
    await raf()

    assertNoOverflow('initial (chat pane)')

    // Walk every pane through the narrow single-select segments (the 414px rendering's real switcher).
    const paneSegments = document.querySelector('[data-part="pane-segments"]')!
    const segments = [...paneSegments.querySelectorAll<HTMLElement>('ui-segment')]
    expect(segments.length).toBeGreaterThan(1)
    for (const segment of segments) {
      segment.click()
      await raf()
      const pane = segment.getAttribute('value') ?? '?'
      assertNoOverflow(`pane: ${pane}`)

      // Inside Settings, walk all five section tabs (Agent · Capabilities · Surface · Context ×2).
      if (pane === 'settings') {
        const nav = document.querySelector('[data-part="settings-nav"]')
        const tabs = nav ? [...nav.querySelectorAll<HTMLElement>('ui-tab')] : []
        expect(tabs.length).toBeGreaterThan(1)
        for (const tab of tabs) {
          tab.click()
          await raf()
          assertNoOverflow(`settings section: ${tab.textContent?.trim() ?? '?'}`)
        }
      }
    }

    // The page-owned roster drawer (Manage agents, GH #845) — open it and re-check.
    const drawer = document.querySelector('ui-drawer.roster-drawer') as (HTMLElement & { open: boolean }) | null
    expect(drawer).not.toBeNull()
    drawer!.open = true
    // Let the entry slide finish — the dialog transitions in from its off-canvas resting inset, so a
    // measurement taken mid-slide reads a legitimate transient as an offender. Poll the real geometry.
    const dialog = drawer!.querySelector('[data-part="dialog"]')!
    for (let i = 0; i < 60 && dialog.getBoundingClientRect().right > window.innerWidth; i++) await raf()
    assertNoOverflow('roster drawer open')
    drawer!.open = false
    await raf()
  })
})
