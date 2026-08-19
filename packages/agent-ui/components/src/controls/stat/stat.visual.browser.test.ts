import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'
import type { UIStatElement } from './stat.ts'

// ADR-0223 slice 3 (Fill by Default — display composites) — the DELIBERATELY minted visual goldens for
// ui-stat's posture flip (the ADR-0110 harness; the text-field slice-0 pilot / button slice-2 precedent).
// The two-posture truth is pinned as pixels: a bare tile FILLS its block container; an `[inline]` tile
// HUGS at the role-(d) whole-shape floor (SPEC-R10) — the SAME floor value in both postures, unlike the
// entry family's hug-only content floor. Chromium-only. Baselines commit under
// `__baselines__/stat.visual.browser.test.ts/<name>-chromium-darwin.png`; re-baseline only via
// `npm run test:visual:update` (a deliberate act, per ADR-0223's R5 golden-regen law).
//
// controls/stat/ is not yet exported from controls/index.ts (the LLD-C10 shared-file integration slice,
// a separate wave) — direct (pre-barrel) imports, the stat.browser.test.ts precedent.
import '@agent-ui/components/foundation-styles.css'
import './stat.css'
import './stat.ts'

const mount = (attrs = ''): { wrap: HTMLElement; host: UIStatElement } => {
  const wrap = document.createElement('div')
  wrap.style.inlineSize = '480px' // a fixed block container so the fill posture is a stable pixel truth
  wrap.style.padding = '8px'
  wrap.innerHTML = `<ui-stat label="Revenue" figure="48200" delta="12" caption="vs last month" ${attrs}></ui-stat>`
  document.body.append(wrap)
  const host = wrap.querySelector('ui-stat') as UIStatElement
  // ADR-0223 slice-3 checker follow-up (folded into slice 4, GH #1422): ui-stat ships no visible card
  // chrome (plain text, Display class), so the fill-vs-hug posture delta was pixel-INVISIBLE in this
  // crop — the slice-3 Findings comment named this explicitly. A test-only outline + tint on the HOST
  // (never in component CSS — this styling exists only in the harness) makes the host's own box edge a
  // visible pixel truth: FILL reads as the tinted box spanning the wrap; [inline] hug reads as the
  // tinted box hugging the whole-shape floor width.
  host.style.outline = '1px dashed magenta'
  host.style.background = 'rgba(0, 145, 255, 0.08)'
  return { wrap, host }
}

describe('ui-stat — visual regression (ADR-0223 slice-3 postures: fill default / [inline] hug)', () => {
  it.skipIf(server.browser !== 'chromium')('FILL (default): a bare ui-stat stretches to its block container', async () => {
    const { wrap, host } = mount()
    await host.updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('stat-fill-default')
    wrap.remove()
  })

  it.skipIf(server.browser !== 'chromium')('[inline] hug: the ui-stat hugs at the whole-shape floor', async () => {
    const { wrap, host } = mount('inline')
    await host.updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('stat-inline-hug')
    wrap.remove()
  })
})
