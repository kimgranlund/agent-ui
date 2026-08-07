import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'
import type { UIMultiSelectElement } from './multi-select.ts'

// M-F visual leg (ADR-0110, the text.visual.browser.test.ts / calendar.visual.browser.test.ts
// precedent) — the committed-baseline pixel diff for the checkmark paint states LLD §10 names:
// unselected / selected / disabled. Chromium-only. Baselines commit under
// `__baselines__/multi-select.visual.browser.test.ts/<name>-chromium-darwin.png`; a missing baseline
// is created and FAILS FOR REVIEW on its first run — re-baseline only via `npm run test:visual:update`.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

const OPTIONS = `
  <div role="option" value="design">Design</div>
  <div role="option" value="engineering">Engineering</div>
  <div role="option" value="product">Product</div>
`

describe('ui-multi-select — visual regression (LLD §10: unselected / selected / disabled checkmark paint)', () => {
  it.skipIf(server.browser !== 'chromium')(
    'unselected: no checkmark paints on any option',
    async () => {
      const el = document.createElement('ui-multi-select') as UIMultiSelectElement
      el.innerHTML = OPTIONS
      el.style.width = '12rem'
      document.body.append(el)
      await el.updateComplete

      await expect.element(page.elementLocator(el)).toMatchScreenshot('multi-select-unselected')
      el.remove()
    },
  )

  it.skipIf(server.browser !== 'chromium')(
    'selected: the checkmark paints on the tinted, selected option row(s)',
    async () => {
      const el = document.createElement('ui-multi-select') as UIMultiSelectElement
      el.innerHTML = OPTIONS
      el.style.width = '12rem'
      document.body.append(el)
      el.value = ['design', 'product']
      await el.updateComplete

      await expect.element(page.elementLocator(el)).toMatchScreenshot('multi-select-selected')
      el.remove()
    },
  )

  it.skipIf(server.browser !== 'chromium')(
    'disabled: the whole listbox mutes to the disabled neutral roles',
    async () => {
      const el = document.createElement('ui-multi-select') as UIMultiSelectElement
      el.innerHTML = OPTIONS
      el.style.width = '12rem'
      el.disabled = true
      document.body.append(el)
      el.value = ['design']
      await el.updateComplete

      await expect.element(page.elementLocator(el)).toMatchScreenshot('multi-select-disabled')
      el.remove()
    },
  )
})
