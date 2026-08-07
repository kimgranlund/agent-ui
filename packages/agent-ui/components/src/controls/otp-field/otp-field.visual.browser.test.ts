import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'
import type { UIOtpFieldElement } from './otp-field.ts'

// S2-a visual leg (ADR-0110, the multi-select.visual.browser.test.ts / calendar.visual.browser.test.ts
// precedent) — the committed-baseline pixel diff for the cell paint states LLD §12.4 names: empty /
// partially filled with the active ring / complete / disabled / user-invalid. Chromium-only. Baselines
// commit under `__baselines__/otp-field.visual.browser.test.ts/<name>-chromium-darwin.png`; a missing
// baseline is created and FAILS FOR REVIEW on its first run — re-baseline only via `npm run test:visual:update`.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

describe('ui-otp-field — visual regression (LLD §12.4: empty / active / complete / disabled / user-invalid)', () => {
  it.skipIf(server.browser !== 'chromium')('empty: six idle cells, no active ring (unfocused)', async () => {
    const el = document.createElement('ui-otp-field') as UIOtpFieldElement
    el.setAttribute('label', 'Code')
    document.body.append(el)
    await el.updateComplete

    await expect.element(page.elementLocator(el)).toMatchScreenshot('otp-field-empty')
    el.remove()
  })

  it.skipIf(server.browser !== 'chromium')('partially filled, focused: filled cells + the active-cell ring on the first empty cell', async () => {
    const el = document.createElement('ui-otp-field') as UIOtpFieldElement
    el.setAttribute('label', 'Code')
    document.body.append(el)
    el.value = '42'
    await el.updateComplete
    const editor = el.querySelector('[data-part="editor"]') as HTMLElement
    editor.focus()
    await el.updateComplete

    await expect.element(page.elementLocator(el)).toMatchScreenshot('otp-field-partial-active')
    el.remove()
  })

  it.skipIf(server.browser !== 'chromium')('complete: every cell filled', async () => {
    const el = document.createElement('ui-otp-field') as UIOtpFieldElement
    el.setAttribute('label', 'Code')
    document.body.append(el)
    el.value = '424242'
    await el.updateComplete

    await expect.element(page.elementLocator(el)).toMatchScreenshot('otp-field-complete')
    el.remove()
  })

  it.skipIf(server.browser !== 'chromium')('disabled: every cell mutes to the disabled neutral roles', async () => {
    const el = document.createElement('ui-otp-field') as UIOtpFieldElement
    el.setAttribute('label', 'Code')
    el.setAttribute('disabled', '')
    document.body.append(el)
    el.value = '42'
    await el.updateComplete

    await expect.element(page.elementLocator(el)).toMatchScreenshot('otp-field-disabled')
    el.remove()
  })

  it.skipIf(server.browser !== 'chromium')('user-invalid: the danger border paints on every cell after the first blur', async () => {
    const el = document.createElement('ui-otp-field') as UIOtpFieldElement
    el.setAttribute('label', 'Code')
    el.setAttribute('required', '')
    document.body.append(el)
    const editor = el.querySelector('[data-part="editor"]') as HTMLElement
    editor.focus()
    editor.blur() // real DOM focus+blur — the capture-phase host listener (trackUserInvalid) catches it
    await el.updateComplete

    await expect.element(page.elementLocator(el)).toMatchScreenshot('otp-field-user-invalid')
    el.remove()
  })
})
