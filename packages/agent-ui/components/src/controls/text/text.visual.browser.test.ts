import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'
import type { UITextElement } from './text.ts'

// ADR-0110 pilot leg (v1 scope) — re-realizes ADR-0106's truncate acceptance ("shows a clipped single
// line" / the ellipsis gestalt) as a REAL `toMatchScreenshot` leg. text.browser.test.ts already proves
// the mechanism numerically (`clientWidth < scrollWidth`, computed `text-overflow: ellipsis`) — this file
// is the actual pixel gate for the gestalt those numbers stand in for.
//
// Chromium-only (Decision 2): both engines launch under the `visual` project (a project-level `instances`
// pin collides with vitest's `extends: true` array-concat — see vitest.browser.config.ts), so every leg
// here is `it.skipIf(server.browser !== 'chromium')`. Baselines commit under
// `__baselines__/text.visual.browser.test.ts/<name>-chromium-darwin.png` (Decision 3); a missing baseline
// is created and FAILS FOR REVIEW on its first run — re-baseline only via `npm run test:visual:update`.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

describe('ui-text — visual regression (ADR-0106 ellipsis gestalt via the ADR-0110 pixel harness)', () => {
  it.skipIf(server.browser !== 'chromium')(
    'host leg: an unstamped truncated ui-text in a 12rem box shows a clipped single line + ellipsis',
    async () => {
      const el = document.createElement('ui-text') as UITextElement
      el.truncate = true
      el.style.display = 'block'
      el.style.width = '12rem'
      el.textContent = 'A title long enough that it will not fit in twelve rem of width at all'
      document.body.append(el)

      await expect.element(page.elementLocator(el)).toMatchScreenshot('text-truncate-host')
      el.remove()
    },
  )

  it.skipIf(server.browser !== 'chromium')(
    'stamped leg: a truncated ui-text stamped as="h4" in a 12rem box shows the SAME clipped gestalt',
    async () => {
      const el = document.createElement('ui-text') as UITextElement
      el.truncate = true
      el.setAttribute('as', 'h4')
      el.style.width = '12rem'
      el.textContent = 'A title long enough that it will not fit in twelve rem of width at all'
      document.body.append(el)
      await el.updateComplete

      await expect.element(page.elementLocator(el)).toMatchScreenshot('text-truncate-stamped-h4')
      el.remove()
    },
  )
})
