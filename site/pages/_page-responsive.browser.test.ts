// _page-responsive.browser.test.ts — AC17 (GH #170 / ADR-0155): the docs-site chrome on the amended
// shell grammar, cross-engine (the `site` browser project). The site nav moved from `stack` to the
// shell's own compact/narrow OVERLAY: below the 52.5rem compact line the nav pane hides behind the
// header menu toggle; tapping opens it as an overlay (X glyph, scrim + Escape dismiss); the persisted
// wide collapse choice is untouched; the header row stays clean and nothing overflows horizontally.
//
// Band control: the composed ui-super-shell's container query resolves against ITS OWN inline-size, which
// fills the `#app` box — so sizing `#app` moves the shell across bands (16px root ⇒ 40rem=640, 52.5rem=840).
import { describe, it, expect, afterEach } from 'vitest'
import { mountPage, SITE_NAV_ENTRIES } from './_page.ts'

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

function mountAt(width: number, persistCollapsed = false): { shell: HTMLElement; app: HTMLElement } {
  document.body.innerHTML = ''
  try { localStorage.clear(); if (persistCollapsed) localStorage.setItem('agent-ui.site.nav-collapsed', 'true') } catch { /* ignore */ }
  const app = document.createElement('div')
  app.id = 'app'
  app.style.inlineSize = `${width}px`
  document.body.append(app)
  mountPage({ title: 'Probe' })
  const shell = document.querySelector('ui-super-shell') as HTMLElement
  return { shell, app }
}

const isHidden = (el: HTMLElement | null): boolean => !el || getComputedStyle(el).display === 'none'
const navPane = (shell: HTMLElement): HTMLElement => shell.querySelector('[data-part="pane"][data-slot-name="nav-pane"]') as HTMLElement
const startToggle = (shell: HTMLElement): HTMLElement => shell.querySelector('[data-part="side-toggle"][data-side="start"]') as HTMLElement

afterEach(() => {
  document.body.innerHTML = ''
  try { localStorage.clear() } catch { /* ignore */ }
  window.history.replaceState(null, '', '/') // the router package's own url-history.test.ts hygiene, mirrored here for the S3c pushState probes below
})

describe('docs-site chrome — AC17 responsive nav (both engines)', () => {
  it('below the compact line (360px) the nav pane hides and the header shows a single menu toggle, no end toggle', async () => {
    const { shell } = mountAt(360)
    await raf()
    expect(isHidden(navPane(shell)), 'nav pane hidden below 52.5rem').toBe(true)
    expect(isHidden(startToggle(shell)), 'the menu toggle is present + visible').toBe(false)
    expect(shell.querySelector('[data-part="side-toggle"][data-side="end"]'), 'no dead end toggle (site authors no end side)').toBeNull()
  })

  it('tapping the toggle opens the nav overlay with the X glyph; scrim tap and Escape each dismiss it', async () => {
    const { shell } = mountAt(360)
    await raf()
    const toggle = startToggle(shell)
    toggle.click(); await raf()
    expect(shell.getAttribute('data-narrow-open'), 'overlay open').toBe('start')
    expect(isHidden(navPane(shell)), 'the nav pane is restored as an overlay').toBe(false)
    expect(isHidden(toggle.querySelector('[data-glyph="close"]')), 'the X glyph paints while open').toBe(false)
    expect(isHidden(toggle.querySelector('[data-glyph="menu"]')), 'the menu glyph hides while open').toBe(true)
    // the overlay carries the full vertical rail with real links (the collapse="menu" dropdown retired)
    expect(navPane(shell).querySelector('a[href]'), 'the overlay nav has real navigable links').not.toBeNull()
    // scrim tap dismisses
    const scrim = shell.querySelector('[data-part="scrim"]') as HTMLElement
    expect(isHidden(scrim), 'scrim visible while open').toBe(false)
    scrim.click(); await raf()
    expect(shell.hasAttribute('data-narrow-open'), 'scrim tap dismisses').toBe(false)
    // re-open, then Escape dismisses
    toggle.click(); await raf()
    shell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await raf()
    expect(shell.hasAttribute('data-narrow-open'), 'Escape dismisses').toBe(false)
  })

  it('at wide (1200px) the nav renders in-flow, and the persisted collapse choice round-trips via localStorage', async () => {
    const wide = mountAt(1200)
    await raf()
    expect(isHidden(navPane(wide.shell)), 'nav in-flow at wide').toBe(false)
    // toggling at wide collapses the side AND persists the choice
    startToggle(wide.shell).click(); await raf()
    expect(wide.shell.hasAttribute('collapsed-start'), 'wide toggle collapses the persisted side state').toBe(true)
    expect(localStorage.getItem('agent-ui.site.nav-collapsed'), 'the choice persists').toBe('true')
    // a fresh wide mount with the persisted choice restores it (the round-trip)
    const restored = mountAt(1200, true)
    await raf()
    expect(restored.shell.hasAttribute('collapsed-start'), 'persisted collapse restored on reload').toBe(true)
  })

  it('no horizontal overflow at 360 / 640 / 840 / 1200px, and the 360px header row stays clean', async () => {
    for (const width of [360, 640, 840, 1200]) {
      const { shell } = mountAt(width)
      await raf()
      expect(shell.scrollWidth, `no horizontal overflow of the shell at ${width}px`).toBeLessThanOrEqual(shell.clientWidth + 1)
    }
    const { shell } = mountAt(360)
    await raf()
    const header = shell.querySelector('[data-part="bar"][data-bar="header"]') as HTMLElement
    expect(header.scrollWidth, 'the 360px header row (brand + Search + Theme + toggle) fits without overflow').toBeLessThanOrEqual(header.clientWidth + 1)
  })
})

describe('docs-site chrome — site-chrome polish (S1 header hairline, S3a footer gap, S3c prev/next)', () => {
  it('S1 — the header hairline spans the outer bar box edge-to-edge, not the inset piece after the nav toggle', async () => {
    const { shell } = mountAt(1200)
    await raf()
    const header = shell.querySelector('[data-part="bar"][data-bar="header"]') as HTMLElement
    const toggle = startToggle(shell)
    expect(header.contains(toggle), 'the nav toggle lives INSIDE the bar box this test measures').toBe(true)
    expect(parseFloat(getComputedStyle(header).borderBottomWidth), 'the outer bar box itself carries the divider').toBeGreaterThan(0)
    const headerRect = header.getBoundingClientRect()
    const shellRect = shell.getBoundingClientRect()
    expect(headerRect.left, 'the border-carrying box starts at the shell\'s left edge').toBeCloseTo(shellRect.left, 0)
    expect(headerRect.right, 'the border-carrying box ends at the shell\'s right edge').toBeCloseTo(shellRect.right, 0)
  })

  it('S3a — .app-page fills the canvas region on a short page (no dead gap below the sticky footer)', async () => {
    const { shell } = mountAt(1200)
    await raf()
    const canvas = shell.querySelector('[data-part="canvas"]') as HTMLElement
    const page = canvas.querySelector(':scope > .app-page') as HTMLElement
    expect(page.getBoundingClientRect().height, '.app-page grows to fill the canvas region, not just its own short content').toBeCloseTo(canvas.getBoundingClientRect().height, 0)
  })

  it('S3c — the page footer derives real Previous/Next from SITE_NAV_ENTRIES and hides the dead end at each boundary', async () => {
    const middleIndex = Math.floor(SITE_NAV_ENTRIES.length / 2)
    const middle = SITE_NAV_ENTRIES[middleIndex]!
    // pushState (not a real `location.href` assignment) changes `location.pathname` without navigating —
    // the router package's own router.browser.test.ts precedent for this exact real-engine harness.
    window.history.pushState(null, '', middle.url)
    const { shell } = mountAt(1200)
    await raf()
    const prevLink = shell.querySelector('.page-footer-prev') as HTMLAnchorElement | null
    const nextLink = shell.querySelector('.page-footer-next') as HTMLAnchorElement | null
    expect(prevLink, 'a page in the middle of the order renders a real Previous link').not.toBeNull()
    expect(nextLink, 'a page in the middle of the order renders a real Next link').not.toBeNull()
    const resolve = (href: string): string => new URL(href, location.href).pathname
    expect(resolve(prevLink!.getAttribute('href')!)).toBe(resolve(SITE_NAV_ENTRIES[middleIndex - 1]!.url))
    expect(resolve(nextLink!.getAttribute('href')!)).toBe(resolve(SITE_NAV_ENTRIES[middleIndex + 1]!.url))
    expect(prevLink!.textContent).toBe(`← ${SITE_NAV_ENTRIES[middleIndex - 1]!.name}`)
    expect(nextLink!.textContent).toBe(`${SITE_NAV_ENTRIES[middleIndex + 1]!.name} →`)

    // the FIRST entry in the order — no dead Previous, a real Next
    window.history.pushState(null, '', SITE_NAV_ENTRIES[0]!.url)
    const first = mountAt(1200)
    await raf()
    expect(first.shell.querySelector('.page-footer-prev'), 'the first entry hides the dead Previous rather than rendering it').toBeNull()
    expect(first.shell.querySelector('.page-footer-next'), 'the first entry still gets a real Next').not.toBeNull()

    // the LAST entry in the order — no dead Next, a real Previous
    window.history.pushState(null, '', SITE_NAV_ENTRIES.at(-1)!.url)
    const last = mountAt(1200)
    await raf()
    expect(last.shell.querySelector('.page-footer-next'), 'the last entry hides the dead Next rather than rendering it').toBeNull()
    expect(last.shell.querySelector('.page-footer-prev'), 'the last entry still gets a real Previous').not.toBeNull()
  })
})

describe('docs-site chrome — S4 description clamp (2 lines by default, a proven-necessary more/less toggle)', () => {
  function mountWithIntro(intro: string): void {
    document.body.innerHTML = ''
    try { localStorage.clear() } catch { /* ignore */ }
    const app = document.createElement('div')
    app.id = 'app'
    app.style.inlineSize = '1200px'
    document.body.append(app)
    mountPage({ title: 'Probe', intro })
  }

  it('clamps a long description to ~2 lines and reveals a working more/less toggle', async () => {
    const long = 'This description is deliberately long enough that it will not fit inside two wrapped lines. '.repeat(4)
    mountWithIntro(long)
    await raf()
    const description = document.querySelector('.page-description') as HTMLElement
    const toggle = document.querySelector('.page-description-toggle') as HTMLButtonElement
    expect(toggle.hidden, 'the toggle reveals once the text actually overflows the 2-line clamp').toBe(false)
    expect(toggle.textContent).toBe('more')

    const lineHeightPx = parseFloat(getComputedStyle(description).lineHeight)
    const clampedHeight = description.getBoundingClientRect().height
    expect(clampedHeight, 'clamped height reads as ~2 line-heights, not the full unclamped text').toBeLessThan(lineHeightPx * 2.5)

    toggle.click()
    await raf()
    expect(toggle.textContent, 'the toggle flips to "less" once expanded').toBe('less')
    expect(description.getBoundingClientRect().height, 'expanding lifts the clamp — full height grows well past 2 lines').toBeGreaterThan(clampedHeight)

    toggle.click()
    await raf()
    expect(toggle.textContent, 'the toggle flips back to "more"').toBe('more')
    expect(description.getBoundingClientRect().height, 'collapsing restores the 2-line clamp').toBeCloseTo(clampedHeight, 0)
  })

  it('hides the toggle entirely for a short description that never overflows 2 lines', async () => {
    mountWithIntro('A short description.')
    await raf()
    const toggle = document.querySelector('.page-description-toggle') as HTMLButtonElement
    expect(toggle.hidden, 'no permanently-visible toggle on a description that already fits').toBe(true)
  })
})
