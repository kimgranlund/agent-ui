// toc-content.browser.test.ts — GH #964: the real-engine leg scroll-spy.test.ts's banner cites (Chromium +
// WebKit, vitest.browser.config.ts `site` project). The trait test proves the DECISION against a fake observer;
// THIS proves the WIRING against the real IntersectionObserver band + the real ResizeObserver swap. Side-effect
// imports the real page module (the workbench.browser.test.ts precedent) and scrolls the site's ONE scroll
// region, `.app-page` (_page.css — the document itself never overflows).
import { describe, it, expect } from 'vitest'
import './toc-content.ts'
import type { UISelectElement } from '@agent-ui/components/controls/select'

const layout = (): HTMLElement => document.querySelector('.toc-content-layout') as HTMLElement
const selectedItem = (): HTMLElement | null => document.querySelector('.toc-content-nav ui-nav-rail-item[selected]')

describe('toc-content recipe — real observer wiring (GH #964)', () => {
  it('a heading crossing the activation band marks its rail item selected + aria-current and mirrors select.value', async () => {
    const scroller = document.querySelector('.app-page') as HTMLElement
    const target = document.getElementById('the-compact-swap') as HTMLElement
    expect(scroller.scrollHeight, 'anti-vacuous: the article must overflow the scroll region').toBeGreaterThan(scroller.clientHeight)
    // Land the heading 8px BELOW the scroller's top edge: inside the default band (top 20% of the viewport)
    // yet with `top > 0`, so ONLY the real IntersectionObserver crossing can name it — the already-passed
    // fallback would pick the previous section instead.
    scroller.scrollTop += target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 8
    await expect.poll(() => selectedItem()?.getAttribute('href'), { timeout: 4000 }).toBe('#the-compact-swap')
    expect(selectedItem()!.querySelector('[data-part="activator"]')?.getAttribute('aria-current')).toBe('page')
    expect((document.querySelector('.toc-content-select') as UISelectElement).value).toBe('the-compact-swap')
    scroller.scrollTop = 0
  })

  it('data-compact clears above the compact line (1024px) and stamps below it (700px)', async () => {
    const el = layout()
    expect(el.hasAttribute('data-compact'), 'the fleet default 414px viewport starts compact').toBe(true)
    el.style.inlineSize = '1024px'
    await expect.poll(() => el.hasAttribute('data-compact')).toBe(false)
    el.style.inlineSize = '700px'
    await expect.poll(() => el.hasAttribute('data-compact')).toBe(true)
    el.style.inlineSize = ''
  })
})
