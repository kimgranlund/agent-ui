import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'

// ADR-0223 slice 2 (Fill by Default -- action/selection) -- the DELIBERATELY minted visual goldens for
// this control's posture flip (the ADR-0110 harness; the text-field slice-0 pilot precedent). The
// two-posture truth is pinned as pixels: a bare host FILLS its block container; an `[inline]` host HUGS
// its content (this slice relocates no content floor -- the content IS the floor). Chromium-only.
// Baselines commit under `__baselines__/pagination.visual.browser.test.ts/<name>-chromium-darwin.png`;
// re-baseline only via `npm run test:visual:update` (a deliberate act, per ADR-0223's R5 golden-regen law).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

const mount = (attrs = ''): { wrap: HTMLElement; host: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.style.inlineSize = '480px' // a fixed block container so the fill posture is a stable pixel truth
  wrap.style.padding = '8px'
  wrap.innerHTML = `<ui-pagination pages="5" page="2" label="Results pages" ${attrs}></ui-pagination>`
  document.body.append(wrap)
  return { wrap, host: wrap.querySelector('ui-pagination') as HTMLElement }
}

describe('ui-pagination -- visual regression (ADR-0223 slice-2 postures: fill default / [inline] hug)', () => {
  it.skipIf(server.browser !== 'chromium')('FILL (default): a bare ui-pagination stretches to its block container', async () => {
    const { wrap, host } = mount()
    await (host as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('pagination-fill-default')
    wrap.remove()
  })

  it.skipIf(server.browser !== 'chromium')('[inline] hug: the ui-pagination hugs its content', async () => {
    const { wrap, host } = mount('inline')
    await (host as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('pagination-inline-hug')
    wrap.remove()
  })
})
