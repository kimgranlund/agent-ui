import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'

// ADR-0223 slice 1 (Fill by Default -- the entry family) -- the DELIBERATELY minted visual goldens for
// the composer's posture flip (the ADR-0110 harness; the text-field slice-0 pilot precedent): a bare
// composer FILLS its block container; an `[inline]` composer HUGS at the relocated ~20ch floor.
// Chromium-only. Re-baseline only via `npm run test:visual:update`.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import './conversation-composer.css'
import './conversation-composer.ts'
import '@agent-ui/icons/phosphor'
import '@agent-ui/components/controls/icon'
import '@agent-ui/components/controls/button'

const mount = (attrs = ''): { wrap: HTMLElement; host: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.style.inlineSize = '480px' // a fixed block container so the fill posture is a stable pixel truth
  wrap.style.padding = '8px'
  wrap.innerHTML = `<ui-conversation-composer ${attrs}></ui-conversation-composer>`
  document.body.append(wrap)
  return { wrap, host: wrap.querySelector('ui-conversation-composer') as HTMLElement }
}

describe('ui-conversation-composer -- visual regression (ADR-0223 slice-1 postures: fill default / [inline] hug)', () => {
  it.skipIf(server.browser !== 'chromium')('FILL (default): a bare composer stretches to its block container', async () => {
    const { wrap, host } = mount()
    await (host as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('conversation-composer-fill-default')
    wrap.remove()
  })

  it.skipIf(server.browser !== 'chromium')('[inline] hug: the composer hugs at the ~20ch typing-width floor', async () => {
    const { wrap, host } = mount('inline')
    await (host as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('conversation-composer-inline-hug')
    wrap.remove()
  })
})
