import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'

// ADR-0230's own Consequences booked these goldens explicitly ("visual-shard goldens (re-capture,
// booked not silent)") and left them for a follow-up rather than blocking the HTML-plot-layer PR
// (#1582) further — this file is that follow-up, tracked by #1580. Pins the container-query
// chrome-degradation ladder's three rungs (ADR-0230 cl.3/cl.4) as pixel truth: wide keeps every
// fine-density chip, medium hides the fine tier (endpoint-preserving), narrow drops all chrome +
// plot furniture down to the bare columns mark. Widths mirror column-chart.browser.test.ts's own
// WIDE_PX/MEDIUM_PX/NARROW_PX — container-query `em` resolves against the host's own font-size
// (12px, the label-medium typescale row), not the document root's 16px; see that file's own
// comment for the arithmetic. Chromium-only (ADR-0110 harness convention — the browser instances'
// own visual-project narrowing). Baselines commit under
// `__baselines__/column-chart.visual.browser.test.ts/<name>-chromium-darwin.png`; re-baseline
// only via `npm run test:visual:update` (a deliberate act, per ADR-0223's R5 golden-regen law).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

const ROWS = JSON.stringify(
  Array.from({ length: 9 }, (_, i) => ({ label: `Cat${i}`, values: [i + 1] })),
)

const WIDE_PX = 400 // > 28em (336px) — full chrome, every fine-density chip visible
const MEDIUM_PX = 260 // 16em-28em — fine tier hides, first/last category chips survive
const NARROW_PX = 150 // < 16em (192px) — bare marks; needs the deliberate floor override below

const mountAt = (widthPx: number, extraAttrs = ''): { wrap: HTMLElement; chart: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.style.padding = '8px'
  wrap.innerHTML = `<ui-column-chart data='${ROWS}' ${extraAttrs}></ui-column-chart>`
  document.body.append(wrap)
  const chart = wrap.querySelector('ui-column-chart') as HTMLElement
  chart.style.inlineSize = `${widthPx}px`
  return { wrap, chart }
}

describe('ui-column-chart — visual regression (ADR-0230 container-query chrome-degradation ladder)', () => {
  it.skipIf(server.browser !== 'chromium')('wide (>=28em): full chrome, no fine-density chip hidden', async () => {
    const { wrap, chart } = mountAt(WIDE_PX)
    await (chart as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('column-chart-ladder-wide')
    wrap.remove()
  })

  it.skipIf(server.browser !== 'chromium')('medium (16em-28em): fine-density tier hidden, endpoints survive', async () => {
    const { wrap, chart } = mountAt(MEDIUM_PX)
    await (chart as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('column-chart-ladder-medium')
    wrap.remove()
  })

  it.skipIf(server.browser !== 'chromium')('narrow (<16em): bare marks — only the columns mark remains', async () => {
    const { wrap, chart } = mountAt(NARROW_PX)
    chart.style.setProperty('min-inline-size', '0') // the deliberate sub-floor override the rung is FOR (ADR-0230 cl.4)
    await (chart as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('column-chart-ladder-narrow')
    wrap.remove()
  })
})
