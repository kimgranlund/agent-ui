import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'
import type { UIAttachmentElement } from './attachment.ts'
import { iconRegistry, ICON_NAMES, type IconName, type IconPack } from '@agent-ui/icons'

// ADR-0223 slice 3 (Fill by Default — display composites) — the DELIBERATELY minted visual goldens for
// ui-attachment's posture flip (the ADR-0110 harness; the text-field slice-0 pilot / button slice-2
// precedent). The two-posture truth is pinned as pixels: a bare card FILLS its block container; an
// `[inline]` card HUGS at the role-(d) whole-shape floor (SPEC-R18 AC1) — the SAME floor value in both
// postures. Chromium-only. Baselines commit under
// `__baselines__/attachment.visual.browser.test.ts/<name>-chromium-darwin.png`; re-baseline only via
// `npm run test:visual:update` (a deliberate act, per ADR-0223's R5 golden-regen law).
//
// controls/attachment/ is not yet exported from controls/index.ts (the LLD-C11 shared-file integration
// slice, a separate wave) — direct (pre-barrel) imports, the attachment.browser.test.ts precedent.
import '@agent-ui/components/foundation-styles.css'
import '../icon/icon.css'
import './attachment.css'
import './attachment.ts'

// A deterministic in-file IconPack (the attachment.browser.test.ts precedent) — the glyph-derivation
// assertions don't depend on whether the Phosphor subpath happened to self-register elsewhere.
const bodies = Object.fromEntries(ICON_NAMES.map((n) => [n, `<path data-icon="${n}"/>`])) as Record<IconName, string>
iconRegistry.registerPack({ id: 'ui-attachment-visual-test-pack', viewBox: '0 0 16 16', icons: bodies } satisfies IconPack)
iconRegistry.setActivePack('ui-attachment-visual-test-pack')

const mount = (attrs = ''): { wrap: HTMLElement; host: UIAttachmentElement } => {
  const wrap = document.createElement('div')
  wrap.style.inlineSize = '480px' // a fixed block container so the fill posture is a stable pixel truth
  wrap.style.padding = '8px'
  wrap.innerHTML = `<ui-attachment filename="report.pdf" mime-type="application/pdf" size-bytes="48200" ${attrs}></ui-attachment>`
  document.body.append(wrap)
  return { wrap, host: wrap.querySelector('ui-attachment') as UIAttachmentElement }
}

describe('ui-attachment — visual regression (ADR-0223 slice-3 postures: fill default / [inline] hug)', () => {
  it.skipIf(server.browser !== 'chromium')('FILL (default): a bare ui-attachment stretches to its block container', async () => {
    const { wrap, host } = mount()
    await host.updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('attachment-fill-default')
    wrap.remove()
  })

  it.skipIf(server.browser !== 'chromium')('[inline] hug: the ui-attachment hugs at the whole-shape floor', async () => {
    const { wrap, host } = mount('inline')
    await host.updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('attachment-inline-hug')
    wrap.remove()
  })
})
