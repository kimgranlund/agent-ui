import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'
import '@agent-ui/components/foundation-styles.css'
import './glyph.css'
import './glyph.ts'
import { GLYPH_SYMBOLS } from './glyph-paths.ts'
import type { UIGlyphElement } from './glyph.ts'

// ui-glyph visual baseline (ADR-0245 clause 5, the ADR-0110 harness): the closed twelve-mark set at the
// library root register (data-tier product, data-scale sm) for sizes sm, md and lg, one row per size, each
// slot outlined so the 2n slot and the 2n - 2c mark read as pixels. Chromium-only. Baselines commit under
// `__baselines__/glyph.visual.browser.test.ts/`; re-baseline only via `npm run test:visual:update`.

describe('ui-glyph: visual regression', () => {
  it.skipIf(server.browser !== 'chromium')('the twelve marks at product / sm, sizes sm, md and lg', async () => {
    const wrap = document.createElement('div')
    wrap.setAttribute('data-tier', 'product')
    wrap.setAttribute('data-scale', 'sm')
    wrap.style.cssText = 'display: grid; gap: 8px; padding: 8px; inline-size: max-content; color: #1f1f1f; background: #fff;'
    for (const size of ['sm', 'md', 'lg']) {
      const row = document.createElement('div')
      row.setAttribute('data-size', size)
      row.style.cssText = 'display: flex; gap: 6px;'
      for (const symbol of GLYPH_SYMBOLS) {
        const glyph = document.createElement('ui-glyph') as UIGlyphElement
        glyph.symbol = symbol
        glyph.style.outline = '1px dotted #c0c0c0'
        row.append(glyph)
      }
      wrap.append(row)
    }
    document.body.append(wrap)
    await Promise.all([...wrap.querySelectorAll('ui-glyph')].map((g) => (g as UIGlyphElement).updateComplete))
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('glyph-marks-product-sm')
    wrap.remove()
  })
})
