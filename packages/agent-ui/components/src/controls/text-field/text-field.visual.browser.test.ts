import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'
import type { UITextFieldElement } from './text-field.ts'

// ADR-0223 slice 0 (Fill by Default pilot) — the DELIBERATELY (re)generated visual goldens for the
// pilot's posture flip (the ADR-0110 harness; the otp-field/calendar/multi-select precedent).
// ui-text-field carried no visual baselines before the flip, so slice 0 MINTS them: the two-posture
// truth is pinned as pixels — a bare field FILLS its block container; an `[inline]` field HUGS at the
// relocated ~20ch floor. Chromium-only. Baselines commit under
// `__baselines__/text-field.visual.browser.test.ts/<name>-chromium-darwin.png`; re-baseline only via
// `npm run test:visual:update` (a deliberate act, per the ADR's R5 golden-regen law).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

const mount = (attrs = ''): { wrap: HTMLElement; field: UITextFieldElement } => {
  const wrap = document.createElement('div')
  wrap.style.inlineSize = '480px' // a fixed block container so the fill posture is a stable pixel truth
  wrap.style.padding = '8px'
  wrap.innerHTML = `<ui-text-field label="Name" placeholder="Your name" ${attrs}></ui-text-field>`
  document.body.append(wrap)
  return { wrap, field: wrap.querySelector('ui-text-field') as UITextFieldElement }
}

describe('ui-text-field — visual regression (ADR-0223 slice-0 postures: fill default / [inline] hug)', () => {
  it.skipIf(server.browser !== 'chromium')('FILL (default): a bare field stretches to its block container', async () => {
    const { wrap, field } = mount()
    await field.updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('text-field-fill-default')
    wrap.remove()
  })

  it.skipIf(server.browser !== 'chromium')('[inline] hug: the field hugs at the ~20ch typing-width floor', async () => {
    const { wrap, field } = mount('inline')
    await field.updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('text-field-inline-hug')
    wrap.remove()
  })
})
