// _page-responsive.browser.test.ts — AC17 (GH #170 / ADR-0155): the docs-site chrome on the amended
// shell grammar, cross-engine (the `site` browser project). The site nav moved from `stack` to the
// shell's own compact/narrow OVERLAY: below the 52.5rem compact line the nav pane hides behind the
// header menu toggle; tapping opens it as an overlay (X glyph, scrim + Escape dismiss); the persisted
// wide collapse choice is untouched; the header row stays clean and nothing overflows horizontally.
//
// Band control: the composed ui-super-shell's container query resolves against ITS OWN inline-size, which
// fills the `#app` box — so sizing `#app` moves the shell across bands (16px root ⇒ 40rem=640, 52.5rem=840).
import { describe, it, expect, afterEach, vi } from 'vitest'
import { mountPage, SITE_NAV_ENTRIES } from './_page.ts'

// GH #347 — REAL-TIMING HEADROOM. This file awaits real elapsed time (rAF frame settles),
// so its duration is set by the browser's scheduling, which stretches under concurrent host load.
// Class definition + why this is not a global raise: vitest.browser.config.ts, REAL-TIMING HEADROOM.
vi.setConfig({ testTimeout: 30_000 })

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

  it('S1 regression — no site-scoped declaration leaks onto a NESTED ui-super-shell mounted as page content', async () => {
    // the reviewer's probe shape: a demo/guide page (super-shell.html, chat-shell.html, …) composes its
    // OWN <ui-super-shell> several DOM levels inside [data-page-content] — a descendant selector would
    // reach it; the child-combinator chain in _page.css must not.
    //
    // ADR-0166 (GH #371) REPAIRED THIS TEST'S DISCRIMINATOR, and the repair is the whole point. It used
    // to read `borderBottomWidth === 0` on the nested bar, which worked only because a bar had NO border
    // of its own: any 1px there could only have come from the site's rule. Now every bar draws its own
    // 1px seam, so `0` is simply the wrong expectation and `1px` proves nothing either way — the leak and
    // the legitimate seam are the SAME VALUE, and a test that cannot tell them apart certifies nothing.
    // The discriminator is now the seam TOKEN: repoint it on the nested shell to a value nothing else
    // uses. If the site's rule reached in with its own `border-block-end: 1px`, the nested bar would read
    // 1px (the site declaration out-specifying the component's token-driven one); with no leak it reads
    // the repointed 3px. Same guarantee, a probe that still bites.
    const { shell } = mountAt(1200)
    await raf()
    const content = shell.querySelector('[data-page-content]') as HTMLElement
    const nested = document.createElement('ui-super-shell')
    nested.style.setProperty('--ui-super-shell-bar-seam', '3px solid red')
    const nestedHeader = document.createElement('div')
    nestedHeader.setAttribute('data-slot', 'header')
    nestedHeader.textContent = 'Nested demo header'
    const nestedBody = document.createElement('div')
    nestedBody.textContent = 'Nested demo content'
    nested.append(nestedHeader, nestedBody) // nestedBody carries no data-slot — it defaults to 'content' (the one mandatory slot)
    content.append(nested)
    await raf()
    const nestedHeaderBar = nested.querySelector('[data-part="bar"][data-bar="header"]') as HTMLElement
    expect(nestedHeaderBar, 'the nested shell composes its own header bar').not.toBeNull()
    expect(
      getComputedStyle(nestedHeaderBar).borderBlockEndWidth,
      "the nested bar's seam is its OWN component-drawn, consumer-repointed one — no site-scoped declaration reached it",
    ).toBe('3px')
  })

  it('GH #382 follow-up — the overlaid nav card carries ONE right edge: the pane box\'s, never the rail\'s too', async () => {
    // Kim's compounding-border report: with the overlay open, a second hairline sat just inside the card's
    // right edge. The card's own `border` is #381/#382's `--ui-super-shell-overlay-outline` on the PANE
    // BOX; the inner one was `_page.css`'s wide-posture nav↔content divider on `[data-site-nav]`, still
    // drawing in a posture that has no content beside it to divide.
    //
    // The discriminator names its biting variable explicitly: the card edge and the divider are BOTH 1px,
    // so a width read on either box alone cannot tell them apart (the GH #371 lesson two tests up). This
    // reads the PAIR — the pane box must keep its edge, the rail must have dropped its own — and pins the
    // rail's value exactly (`'0px'`), never `not.toBe('1px')`, which a `2px` regression would satisfy.
    const { shell } = mountAt(360)
    await raf()
    startToggle(shell).click(); await raf()
    expect(shell.getAttribute('data-narrow-open'), 'the overlay is open — the posture under test').toBe('start')
    const pane = navPane(shell)
    const rail = pane.querySelector('[data-site-nav]') as HTMLElement
    expect(rail, 'the site rail is the pane box\'s child — the doubling geometry').not.toBeNull()
    expect(
      getComputedStyle(pane).borderInlineEndWidth,
      "the overlay CARD keeps its own four-sided outline (#382) — this fix must not have removed the real edge",
    ).toBe('1px')
    expect(
      getComputedStyle(rail).borderInlineEndWidth,
      'the rail\'s wide-posture divider retracts inside the card — no doubled edge',
    ).toBe('0px')
  })

  it('GH #382 follow-up — the wide-posture nav↔content divider is INTACT at 1200px', async () => {
    // The other half of the pair: the retraction is postural, not a deletion. At wide the pane box draws
    // nothing (no overlay arm matches) and the rail's divider is the ONLY thing separating nav from
    // content — so this reads the same two boxes with the expectations swapped.
    const { shell } = mountAt(1200)
    await raf()
    expect(shell.hasAttribute('data-narrow-open'), 'no overlay state at wide').toBe(false)
    const pane = navPane(shell)
    const rail = pane.querySelector('[data-site-nav]') as HTMLElement
    expect(getComputedStyle(pane).borderInlineEndWidth, 'the in-flow pane box draws no edge of its own').toBe('0px')
    expect(getComputedStyle(rail).borderInlineEndWidth, 'the wide divider still draws').toBe('1px')
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

  it('S3c sub-page — a component sub-page (not itself in SITE_NAV_ENTRIES) resolves the pager to its PARENT entry\'s neighbors', async () => {
    // button-permutations.html is NOT in SITE_NAV_ENTRIES (only button-demo.html is, GH #1619's demo-preferred
    // canonical URL) — isNavCurrent must map it to that parent entry, the SAME mapping buildNav's own
    // rail-highlight already relies on.
    const docIndex = SITE_NAV_ENTRIES.findIndex((e) => e.url === './button-demo.html')
    expect(docIndex, 'button-demo.html must exist in SITE_NAV_ENTRIES for this probe to mean anything').toBeGreaterThanOrEqual(0)
    window.history.pushState(null, '', './button-permutations.html')
    const { shell } = mountAt(1200)
    await raf()
    const prevLink = shell.querySelector('.page-footer-prev') as HTMLAnchorElement | null
    const nextLink = shell.querySelector('.page-footer-next') as HTMLAnchorElement | null
    const resolve = (href: string): string => new URL(href, location.href).pathname
    const expectedPrev = docIndex > 0 ? SITE_NAV_ENTRIES[docIndex - 1] : undefined
    const expectedNext = docIndex < SITE_NAV_ENTRIES.length - 1 ? SITE_NAV_ENTRIES[docIndex + 1] : undefined
    expect(expectedPrev && expectedNext, 'button-demo.html must have both neighbors for this probe to exercise both links').toBeTruthy()
    expect(prevLink, 'the sub-page gets a real Previous, derived from its parent entry\'s own neighbor').not.toBeNull()
    expect(resolve(prevLink!.getAttribute('href')!)).toBe(resolve(expectedPrev!.url))
    expect(nextLink, 'the sub-page gets a real Next, derived from its parent entry\'s own neighbor').not.toBeNull()
    expect(resolve(nextLink!.getAttribute('href')!)).toBe(resolve(expectedNext!.url))
  })

  it('S3c landing page — a page outside SITE_NAV_ENTRIES with no active NAV group renders NO pager band at all', async () => {
    window.history.pushState(null, '', './index.html') // Home: an ungrouped NAV link, and absent from SITE_NAV_ENTRIES
    const { shell } = mountAt(1200)
    await raf()
    expect(shell.querySelector('.page-footer'), 'no empty sticky footer band when nothing resolves to paginate').toBeNull()
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

// ADR-0166 (GH #371) — the consumer-hairline repair, counted rather than asserted-by-absence. The docs
// site independently derived the bar↔body separator TWICE before the component owned it: once as
// `border-block-end` on the header BAR box (GH #183-S1 / #210) and once as `border-block-start` on
// `.app-context-footer`, which is the footer's CONTENT and therefore sat 6px inside the bar's own edge
// (the bar's `padding-inline`). Now that the component draws the seam on the bar box itself, both site
// declarations are gone — and the way to prove that is to COUNT block-axis hairlines down each bar's box
// chain, not to grep the sheet: a `1px` re-introduced by any other selector would still pass a grep.
describe('docs-site chrome — the bar seam is drawn ONCE, by the component (ADR-0166 cl.2, GH #371)', () => {
  /** Every block-axis border on the SEAM CHAIN of one bar: the bar box, its `bar-content` wrapper, and the
   *  authored site box inside that wrapper. Deliberately NOT the whole subtree — controls nested in a bar
   *  (ui-button, the theme ui-menu's trigger and panel) carry their own 1px borders for their own reasons,
   *  and sweeping those in makes the count a measure of the header's contents rather than of the seam. The
   *  three boxes below are exactly where the two removed duplicates lived. */
  const hairlines = (box: HTMLElement): string[] => {
    const chain = [box]
    const barContent = box.querySelector<HTMLElement>(':scope > [data-part="bar-content"]')
    if (barContent) {
      chain.push(barContent)
      const authored = barContent.querySelector<HTMLElement>(':scope > .app-context-header, :scope > .app-context-footer')
      if (authored) chain.push(authored)
    }
    const hits: string[] = []
    for (const el of chain) {
      const cs = getComputedStyle(el)
      for (const prop of ['borderBlockStartWidth', 'borderBlockEndWidth'] as const) {
        const name = el.getAttribute('data-part') ?? (el.className || el.tagName)
        if (cs[prop] !== '0px' && cs[prop] !== '') hits.push(`${name} → ${prop}=${cs[prop]}`)
      }
    }
    return hits
  }

  it('the header bar box and everything inside it carry EXACTLY ONE block-axis hairline — the component\'s', async () => {
    const { shell } = mountAt(1200)
    await raf()
    const header = shell.querySelector('[data-part="bar"][data-bar="header"]') as HTMLElement
    expect(header, 'the docs shell composes a header bar').not.toBeNull()
    // the ONE survivor is the component's own, on the bar box, block-END
    expect(getComputedStyle(header).borderBlockEndWidth, "the component's seam").toBe('1px')
    const found = hairlines(header)
    expect(found, found.join(' | ')).toHaveLength(1)
  })

  it('the footer bar box and everything inside it carry EXACTLY ONE block-axis hairline — the component\'s', async () => {
    const { shell } = mountAt(1200)
    await raf()
    const footer = shell.querySelector('[data-part="bar"][data-bar="footer"]') as HTMLElement
    expect(footer, 'the docs shell composes a footer bar').not.toBeNull()
    expect(getComputedStyle(footer).borderBlockStartWidth, "the component's seam").toBe('1px')
    const found = hairlines(footer)
    expect(found, found.join(' | ')).toHaveLength(1)
  })

  it('the site declares NO seam of its own on either bar — proven by repointing the token, since a count cannot see a same-box duplicate', async () => {
    // The counting probe above catches the FOOTER duplicate (it lived on `.app-context-footer`, a
    // different box from the bar) but is structurally blind to the HEADER one, which lived on the very
    // box and the very property the component now uses — one box, one property, count of 1 either way.
    // This is that gap closed. The site's own selector
    // (`ui-theme-provider.app-shell > .site-shell > [data-part='frame'] > [data-part='bar'][data-bar='header']`)
    // is specificity 0,5,1 against the component's 0,2,0, and specificity is compared BEFORE scope
    // proximity — so a re-declared `border-block-end: 1px` there WINS and pins the seam at 1px, ignoring
    // the token. Repointing the token to 3px therefore reads 3px only if the site declares nothing.
    const { shell } = mountAt(1200)
    await raf()
    shell.style.setProperty('--ui-super-shell-bar-seam', '3px solid red')
    const header = shell.querySelector('[data-bar="header"]') as HTMLElement
    const footer = shell.querySelector('[data-bar="footer"]') as HTMLElement
    expect(getComputedStyle(header).borderBlockEndWidth, 'the header seam obeys the token — no site declaration overrides it').toBe('3px')
    expect(getComputedStyle(footer).borderBlockStartWidth, 'the footer seam obeys the token — no site declaration overrides it').toBe('3px')
  })

  it('cl.1 — the docs shell frame inserts no block-axis space, so each bar sits flush against middle', async () => {
    const { shell } = mountAt(1200)
    await raf()
    const frame = shell.querySelector('[data-part="frame"]') as HTMLElement
    const middle = shell.querySelector('[data-part="middle"]') as HTMLElement
    const header = shell.querySelector('[data-bar="header"]') as HTMLElement
    const footer = shell.querySelector('[data-bar="footer"]') as HTMLElement
    expect(['normal', '0px']).toContain(getComputedStyle(frame).rowGap)
    expect(Math.abs(header.getBoundingClientRect().bottom - middle.getBoundingClientRect().top)).toBeLessThanOrEqual(1)
    expect(Math.abs(middle.getBoundingClientRect().bottom - footer.getBoundingClientRect().top)).toBeLessThanOrEqual(1)
  })
})
