// _page-bar-inset.browser.test.ts — GH #626, the pixel-true bar/canvas column alignment, cross-engine.
//
// THE INVARIANT THIS FILE EXISTS FOR: the page pager (`.page-footer-inner`, rendered in the shell's
// CANVAS) and the app footer (`.app-context-footer-inner`, rendered inside the shell's footer BAR) are
// two separately-owned boxes on opposite sides of a component boundary that must nevertheless print
// their first glyph at the same x. Nothing about that is self-evident from either rule: before #626 the
// bar carried `padding-inline: calc(module / 3)`, so the footer's column was 12px narrower and 6px
// further in than the pager's, and every reading of the two CSS rules said "same formula, must align".
// A measurement is the only thing that can tell the difference, and only in a real engine — jsdom
// resolves no `min()`, no container query, and no layout.
//
// Why measure CONTENT edges and not `left`: both boxes are `margin-inline: auto` inside their own
// regions with their own inline padding history; the promise Kim can see on the live site is where the
// TEXT starts, so the assertion reads `getBoundingClientRect().left` of the box whose border box IS the
// column (neither carries inline padding) and compares the two directly.
//
// Band choice: 700px, deliberately BELOW the 52.5rem (840px) compact line. Above it the site's nav pane
// renders IN FLOW, which insets the canvas from the frame's inline start while the footer bar still
// spans the frame edge-to-edge — the two columns then live in regions of different width and origin, so
// a same-x assertion would be asserting something the layout never promised. The second test states that
// wide posture as the REGION-RELATIVE invariant it actually is, so the wide band is covered rather than
// quietly skipped.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { mountPage, SITE_NAV_ENTRIES } from './_page.ts'

// An INTERIOR sitemap entry (never the first or last), so the pager renders BOTH links and the box is
// laid out by `justify-content: space-between` exactly as it is on a real doc page. Derived from the
// live sitemap rather than hard-coded: a page rename would otherwise turn this file green-but-vacuous
// (the `.page-footer-inner` guard below would fire, but only after someone wondered why).
const PAGER_PATH = SITE_NAV_ENTRIES[1]!.url.replace(/^\./, '')

// GH #347 — REAL-TIMING HEADROOM (see vitest.browser.config.ts): this file awaits rAF settles.
vi.setConfig({ testTimeout: 30_000 })

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

function mountAt(width: number): HTMLElement {
  document.body.innerHTML = ''
  try { localStorage.clear() } catch { /* ignore */ }
  const app = document.createElement('div')
  app.id = 'app'
  app.style.inlineSize = `${width}px`
  document.body.append(app)
  // The pager only EXISTS on a page with a sitemap neighbour: `buildPageFooter` returns undefined when
  // `location.pathname` matches no `SITE_NAV_ENTRIES` entry (_page.ts's "no dead ends" fork), so a
  // default test URL renders no `.page-footer-inner` at all and this whole file measures nothing. A real
  // interior entry — one with both a Previous and a Next — is what puts the box on the page.
  window.history.replaceState(null, '', PAGER_PATH)
  mountPage({ title: 'Probe' })
  return document.querySelector('ui-super-shell') as HTMLElement
}

const q = (sel: string): HTMLElement => {
  const found = document.querySelector(sel) as HTMLElement | null
  expect(found, `missing ${sel}`).not.toBeNull()
  return found!
}

/** The USED px value of `--ui-bar-inline-inset` where `host` sits. Resolved through a throwaway probe, not
 *  `getPropertyValue`: an unregistered custom property computes to its substituted token stream
 *  (`calc(24px * 1)`), which never string-equals a used `padding` value of `24px`. */
function resolvedBarInset(host: HTMLElement): string {
  const probe = document.createElement('div')
  probe.style.paddingInline = 'var(--ui-bar-inline-inset)'
  host.append(probe)
  const used = getComputedStyle(probe).paddingInlineStart
  probe.remove()
  expect(used, 'the shared bar-inset role resolves').not.toBe('0px')
  return used
}

/** Asserts `column` is `min(64rem, region − 2 × --ui-bar-inline-inset)` wide and centred in `region`. The
 *  cap is read off the real root font-size rather than assumed to be 1024px, so a root-size change moves
 *  the expectation with the layout instead of reddening this file. */
function expectColumn(column: HTMLElement, region: HTMLElement, label: string): void {
  const inset = parseFloat(resolvedBarInset(region))
  const cap = 64 * parseFloat(getComputedStyle(document.documentElement).fontSize)
  const regionBox = region.getBoundingClientRect()
  const columnBox = column.getBoundingClientRect()
  const want = Math.min(cap, regionBox.width - 2 * inset)
  expect(Math.abs(columnBox.width - want), `${label} · column width`).toBeLessThanOrEqual(0.5)
  expect(Math.abs((columnBox.left - regionBox.left) - (regionBox.width - columnBox.width) / 2), `${label} · centred`).toBeLessThanOrEqual(0.5)
}

afterEach(() => {
  document.body.innerHTML = ''
  try { localStorage.clear() } catch { /* ignore */ }
  window.history.replaceState(null, '', '/')
})

describe('GH #626 — the bar column and the canvas column land on the SAME x', () => {
  it('below the compact line the pager and the app footer share one content-edge x (the reported bug)', async () => {
    mountAt(700)
    await raf()
    const pager = q('.page-footer-inner').getBoundingClientRect()
    const appFooter = q('.app-context-footer-inner').getBoundingClientRect()
    // Sub-pixel tolerance only: the two are the same `min()` of the same terms over the same region
    // width, so anything above rounding noise means a padding mechanism came back somewhere in between.
    // The pre-#626 failure was 6px — an order of magnitude above this floor, so the gate genuinely bites.
    expect(Math.abs(pager.left - appFooter.left), 'pager vs app-footer content-edge x').toBeLessThanOrEqual(0.5)
    expect(Math.abs(pager.right - appFooter.right), 'pager vs app-footer content-edge right x').toBeLessThanOrEqual(0.5)
  })

  it('the app header insets by the SAME token, one level in from the bar edge (the nav toggle sits outside it)', async () => {
    mountAt(700)
    await raf()
    // MEASURED, then corrected: the brand does NOT share the pager's x, and asserting that it did would
    // have been asserting a promise the layout never made. The site authors a nav side, so `bar-content`
    // is preceded by a 54px side-toggle inside the header bar; the brand starts after it. What IS shared
    // is the token — `.app-context-header` insets its row by `--ui-bar-inline-inset`, the same term the
    // pager's column subtracts twice — so that is what this pins.
    const inset = resolvedBarInset(q('.app-context-header'))
    expect(getComputedStyle(q('.app-context-header')).paddingInlineStart, 'header row inset').toBe(inset)
    expect(getComputedStyle(q('.app-context-header')).paddingInlineEnd, 'header row inset (end)').toBe(inset)
  })

  it('the footer BAR itself is a padding-less rail, so its content box reaches the frame edge', async () => {
    mountAt(700)
    await raf()
    const bar = q('[data-part="bar"][data-bar="footer"]')
    const cs = getComputedStyle(bar)
    // Longhands, never the `padding` shorthand: a shorthand string satisfies a `not.toBe('0px')` style
    // check vacuously (super-shell-bar-seam.browser.test.ts's standing rule 1, same trap).
    expect(cs.paddingInlineStart, 'footer bar padding-inline-start').toBe('0px')
    expect(cs.paddingInlineEnd, 'footer bar padding-inline-end').toBe('0px')
    // The ADR-0166 sliver's structural cause: the site's own `.app-context-footer` paints a DIFFERENT
    // surface than the bar, so any gap between their inline edges leaks the bar's colour. Zero gap ⇒ no
    // leak, whatever either palette does.
    const barBox = bar.getBoundingClientRect()
    const painted = q('.app-context-footer').getBoundingClientRect()
    expect(Math.abs(painted.left - barBox.left), 'painted footer surface reaches the bar\'s start edge').toBeLessThanOrEqual(0.5)
    expect(Math.abs(painted.right - barBox.right), 'painted footer surface reaches the bar\'s end edge').toBeLessThanOrEqual(0.5)
  })

  it('at wide both columns run the SAME formula over their own region — one capped, one not, both off one token', async () => {
    mountAt(1200)
    await raf()
    const canvas = q('[data-part="canvas"]')
    const bar = q('[data-part="bar"][data-bar="footer"]')
    // MEASURED, then corrected: at 1200px the two region-relative insets are NOT equal (24px vs 88px),
    // and that is correct, not a defect — the in-flow nav narrows the canvas to below the 64rem cap while
    // the frame-spanning footer bar stays above it, so one column is capped-and-centred and the other is
    // inset-and-full. Equal insets was never the promise. The promise is that BOTH resolve
    // `min(64rem, region − 2 × --ui-bar-inline-inset)` and centre it — which is exactly what this checks,
    // in the one band where the two regions genuinely differ, so a divergence has somewhere to show.
    expect(canvas.getBoundingClientRect().left, 'the wide band is genuinely the offset-canvas case').toBeGreaterThan(bar.getBoundingClientRect().left + 1)
    expectColumn(q('.page-footer-inner'), canvas, 'pager in the canvas')
    expectColumn(q('.app-context-footer-inner'), bar, 'app footer in the bar')
  })
})
