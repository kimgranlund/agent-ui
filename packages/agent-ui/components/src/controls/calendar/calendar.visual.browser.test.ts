import { describe, it, expect, afterEach } from 'vitest'
import { page, server } from 'vitest/browser'
import type { UICalendarElement } from './calendar.ts'

// ADR-0110 pilot leg (v1 scope) — re-realizes ADR-0105's Acceptance (a)/(b) pixel claims as REAL
// `toMatchScreenshot` legs. Those claims ("pixel-identical to the pre-change screenshots" / the wide
// two-layer-cell gestalt) could previously only be proven by computed-style substitution
// (calendar.browser.test.ts §[13]) — this file is the actual pixel gate.
//
// Chromium-only (Decision 2): the `visual` project still launches both engines (vitest.browser.config.ts
// inherits `instances` from root — a project-level pin collides, see that file's comment), so every leg
// here is `it.skipIf(server.browser !== 'chromium')` — the ADR's named fallback mechanism. WebKit keeps
// the existing computed-style/whole-shape legs as its sanctioned proof. Baselines commit under
// `__baselines__/calendar.visual.browser.test.ts/<name>-chromium-darwin.png` (Decision 3); a missing
// baseline is created and FAILS FOR REVIEW on its first run (never silently passes) — re-baseline only
// via `npm run test:visual:update`.
//
// The two shapes named in the dispatch (ADR-0105's Acceptance legs):
//   (a) floor    — an unstretched, shrink-wrapped calendar (the pre-ADR-0105 compact rendering).
//   (b) wide     — a ~600px stretched range-mode panel (fluid tracks + the two-layer cell: circular
//                  point-layer endpoints, a continuous square band, the half-wash bridging them).
import '@agent-ui/components/foundation-styles.css'
import '../_surface/container-box.css'
import './calendar.css'
import './calendar.ts'

const mounted: HTMLElement[] = []

/** Shrink-wrapped mount (a flex row) — the ADR-0105 (a)-floor context. */
function mount(markup: string): { wrap: HTMLElement; el: UICalendarElement } {
  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  wrap.style.flexDirection = 'row'
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return { wrap, el: wrap.querySelector('ui-calendar') as UICalendarElement }
}

/**
 * A ~600px flex COLUMN with the default `align-items: stretch` — the same stretch chain the real
 * fleet composes through (ui-column/ui-field, ADR-0030) that blockifies the host's `inline-block`
 * into a stretched flex item (CSS Display §2.7) and hands the calendar the column's full width —
 * the ADR-0105 (b)-wide context (calendar.browser.test.ts `mountStretched`, same shape).
 */
function mountStretched(markup: string, widthPx = 600): { wrap: HTMLElement; el: UICalendarElement } {
  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  wrap.style.flexDirection = 'column'
  wrap.style.width = `${widthPx}px`
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return { wrap, el: wrap.querySelector('ui-calendar') as UICalendarElement }
}

afterEach(() => {
  while (mounted.length) mounted.pop()!.remove()
})

describe('ui-calendar — visual regression (ADR-0105 gestalt via the ADR-0110 pixel harness)', () => {
  it.skipIf(server.browser !== 'chromium')(
    '(a) floor: a shrink-wrapped calendar panel matches the committed baseline',
    async () => {
      const { el } = mount('<ui-calendar value="2026-07-15"></ui-calendar>')
      await el.updateComplete

      const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
      await expect.element(page.elementLocator(panel)).toMatchScreenshot('calendar-shrink-wrapped-floor')
    },
  )

  it.skipIf(server.browser !== 'chromium')(
    '(b) wide: a 600px-stretched range-mode panel (fluid tracks + two-layer cells) matches the committed baseline',
    async () => {
      const { el } = mountStretched(
        '<ui-calendar mode="range" value-start="2026-07-10" value-end="2026-07-20"></ui-calendar>',
      )
      await el.updateComplete

      const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
      await expect.element(page.elementLocator(panel)).toMatchScreenshot('calendar-wide-stretched-range')
    },
  )
})
