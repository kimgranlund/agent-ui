import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'
// mountPage self-imports the foundation cascade (ADR-0003) + the ui-* controls + the ui-nav-rail family +
// _page.css, so the chrome renders fully themed here.
import { mountPage } from './_page.ts'

// _page.visual.browser.test.ts — the LLD-C7 / AC17 VISUAL-SHARD ARTIFACT (GH #170 / ADR-0155): the docs-site
// chrome on the responsive grammar at a NARROW viewport, captured CLOSED and OVERLAY-OPEN. These baselines
// are the review INPUT for Kim's own narrow-viewport sign-off (GH #170 acceptance clause 3) — NOT a
// substitute for it: the pixel gate proves the render is STABLE run-to-run; Kim's utterance stays the open
// acceptance gate. Chromium-only (the `visual` project convention — see text.visual.browser.test.ts's banner);
// baselines commit under __baselines__/_page.visual.browser.test.ts/<name>-chromium-darwin.png and are
// (re)generated only via `npm run test:visual:update`.
const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

function mountNarrow(width = 390): HTMLElement {
  document.body.innerHTML = ''
  try { localStorage.clear() } catch { /* ignore */ }
  const app = document.createElement('div')
  app.id = 'app'
  app.style.inlineSize = `${width}px`
  document.body.append(app)
  mountPage({ title: 'Component', intro: 'The docs chrome at a narrow viewport.' })
  return document.querySelector('.app-shell') as HTMLElement
}

describe('docs-site chrome — narrow visual artifact (AC17, the GH #170 sign-off input)', () => {
  it.skipIf(server.browser !== 'chromium')(
    'narrow, nav CLOSED — the nav pane is hidden behind the header menu toggle',
    async () => {
      const shell = mountNarrow()
      await raf()
      await expect.element(page.elementLocator(shell)).toMatchScreenshot('docs-chrome-narrow-closed')
    },
  )

  it.skipIf(server.browser !== 'chromium')(
    'narrow, nav OVERLAY-OPEN — the full vertical rail restored as an overlay, X glyph + scrim',
    async () => {
      const shell = mountNarrow()
      await raf()
      const toggle = shell.querySelector('[data-part="side-toggle"][data-side="start"]') as HTMLElement
      toggle.click()
      await raf()
      await expect.element(page.elementLocator(shell)).toMatchScreenshot('docs-chrome-narrow-open')
    },
  )
})
