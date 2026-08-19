import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'

// ADR-0223 slice 1 (Fill by Default -- the entry family) -- the DELIBERATELY minted visual goldens for
// this control's posture flip (the ADR-0110 harness; the text-field slice-0 pilot precedent). The
// two-posture truth is pinned as pixels: a bare host FILLS its block container; an `[inline]` host HUGS
// at the relocated content floor. Chromium-only. Baselines commit under
// `__baselines__/combo-box.visual.browser.test.ts/<name>-chromium-darwin.png`; re-baseline only via
// `npm run test:visual:update` (a deliberate act, per ADR-0223's R5 golden-regen law).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

const mount = (attrs = ''): { wrap: HTMLElement; host: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.style.inlineSize = '480px' // a fixed block container so the fill posture is a stable pixel truth
  wrap.style.padding = '8px'
  wrap.innerHTML = `<ui-combo-box label="Fruit" placeholder="Search fruit" ${attrs}><div role="option" value="a">Apple</div><div role="option" value="b">Banana</div></ui-combo-box>`
  document.body.append(wrap)
  return { wrap, host: wrap.querySelector('ui-combo-box') as HTMLElement }
}

describe('ui-combo-box -- visual regression (ADR-0223 slice-1 postures: fill default / [inline] hug)', () => {
  it.skipIf(server.browser !== 'chromium')('FILL (default): a bare ui-combo-box stretches to its block container', async () => {
    const { wrap, host } = mount()
    await (host as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('combo-box-fill-default')
    wrap.remove()
  })

  it.skipIf(server.browser !== 'chromium')('[inline] hug: the ui-combo-box hugs at its content floor', async () => {
    const { wrap, host } = mount('inline')
    await (host as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('combo-box-inline-hug')
    wrap.remove()
  })
})
