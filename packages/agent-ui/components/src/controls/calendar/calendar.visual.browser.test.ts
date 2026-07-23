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
//
// DETERMINISM LAW (GH #216): the mounted month must NEVER be able to contain the real today.
// `#today()` reads the real clock, so a today-adjacent mounted month lets the today-ring's cell
// drift day-to-day against whenever the baselines were captured — sub-tolerance churn in check
// mode, and (post-#215's exact-update runner) a legitimate PNG rewrite on every `--update` run.
// July 2020 is the pin: firmly in the past (a forward-moving wall clock can never re-enter it —
// the 6-row grid spans at most 2020-06-28..2020-08-08 incl. adjacent-month spill cells, so no
// cell ever matches the real y/m/d), yet weekday-identical to the original July-2026 baselines
// (both months start on a Wednesday, 31 days) — the gestalt these baselines prove is unchanged.
// The today-ring itself is deliberately ABSENT from these pixels; its rendering is proven
// clock-relative by calendar.browser.test.ts §[3]/§[4]. Do not remount a current-era month here.
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
      // July 2020, never-today (see the DETERMINISM LAW header note, GH #216).
      const { el } = mount('<ui-calendar value="2020-07-15"></ui-calendar>')
      await el.updateComplete

      const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
      await expect.element(page.elementLocator(panel)).toMatchScreenshot('calendar-shrink-wrapped-floor')
    },
  )

  it.skipIf(server.browser !== 'chromium')(
    '(b) wide: a 600px-stretched range-mode panel (fluid tracks + two-layer cells) matches the committed baseline',
    async () => {
      // July 2020, never-today (see the DETERMINISM LAW header note, GH #216).
      const { el } = mountStretched(
        '<ui-calendar mode="range" value-start="2020-07-10" value-end="2020-07-20"></ui-calendar>',
      )
      await el.updateComplete

      const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
      await expect.element(page.elementLocator(panel)).toMatchScreenshot('calendar-wide-stretched-range')
    },
  )
})
