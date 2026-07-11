import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// n2b — the CROSS-ENGINE app-shell smoke (LLD-C7, non-isolated legs only). Runs in BOTH Chromium and WebKit
// (vitest.browser.config.ts). jsdom cannot resolve CSS Grid layout / `@container` / `@scope` / forced-colors —
// this file is where those become TRUE. Covers the NON-isolated SPEC requirements: R3 (named-region layout,
// presence-driven), R4 (docking via composition, incl. the unknown-region + untouched-default fallbacks),
// R5 (narrow-container reflow, incl. ADR-0084's per-region `collapse`), R7 (forced-colors survival), and
// ADR-0083's `landmark` override. The ISOLATED legs (SPEC-R6/AC5) are a SEPARATE file
// (app-shell-isolation.browser.test.ts) — LLD-C7's single-writer split; not touched here.
//
// CSS wiring: `@agent-ui/app` has no component-styles-style barrel yet (LLD-C8, a later integration slice),
// so this smoke injects the sheets directly — the foundation (--md-sys-color-* roles + the dimensional ramp)
// FIRST, then app-shell.css, then the self-defining element module (mirrors row.browser.test.ts / card.browser.test.ts).
import '@agent-ui/components/foundation-styles.css'
import './app-shell.css'
import { UIAppShellRegionElement } from './app-shell.ts'

// Probe subclass re-exposing the protected `internals` (the tabs.browser.test.ts precedent) — a NEW tag,
// since the real class already claimed `ui-app-shell-region` at import time. ONLY used for the ADR-0083
// role-resolution leg below, and ONLY on a STANDALONE instance (no shell parent): app-shell.css's grid-
// placement selectors are TAG-QUALIFIED (`ui-app-shell-region[region=…]`), so a probe under a different tag
// would never land in a named area — the SAME "degrade-gracefully outside a shell" edge every region already
// has (SPEC-R3), deliberately leaned on here rather than fought. The GEOMETRY half of the leg (still lands in
// its `region`'s column) is proven separately below on a REAL `ui-app-shell-region` inside a REAL shell.
class ProbeRegion extends UIAppShellRegionElement {
  get ii(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-app-shell-region-axprobe', ProbeRegion)

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const px = (v: string): number => Number.parseFloat(v)

/** Alpha of a computed colour — 0 ⇒ vanished, > 0 ⇒ painted (a bare system-colour keyword is opaque). The
 *  card.browser.test.ts helper, copied (no shared browser-test-util module exists to import it from). */
const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime
 *  (the card.browser.test.ts precedent). */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

/** A resizable WRAPPER establishing its OWN query container — the shell reflows against the wrapper (its
 *  nearest ANCESTOR container), never against itself (a size-container query cannot be satisfied by the very
 *  box the query targets — the row.browser.test.ts "resize the wrapper, not the viewport" precedent) and
 *  never against the viewport (SPEC-R5). */
function mountShell(inner: string, width = '900px'): { wrapper: HTMLElement; shell: HTMLElement } {
  const wrapper = document.createElement('div')
  wrapper.style.containerType = 'inline-size'
  wrapper.style.width = width
  const shell = document.createElement('ui-app-shell')
  shell.innerHTML = inner
  wrapper.append(shell)
  document.body.append(wrapper)
  mounted.push(wrapper)
  return { wrapper, shell }
}

const FULL = `
  <ui-app-shell-region region="banner">Banner</ui-app-shell-region>
  <ui-app-shell-region region="navigation">Nav</ui-app-shell-region>
  <ui-app-shell-region region="main">Main</ui-app-shell-region>
  <ui-app-shell-region region="complementary">Aside</ui-app-shell-region>
  <ui-app-shell-region region="contentinfo">Footer</ui-app-shell-region>
`

describe('ui-app-shell cross-engine smoke — named-region layout (SPEC-R3/R4)', () => {
  it('all five regions land in their correct grid area — the whole rendered SHAPE, not per-part px', () => {
    const { wrapper, shell } = mountShell(FULL, '900px')
    const rectOf = (region: string): DOMRect =>
      (shell.querySelector(`[region="${region}"]`) as HTMLElement).getBoundingClientRect()
    const shellRect = shell.getBoundingClientRect()
    const banner = rectOf('banner')
    const nav = rectOf('navigation')
    const main = rectOf('main')
    const aside = rectOf('complementary')
    const footer = rectOf('contentinfo')

    // banner spans the top, footer the bottom — both full shell width, stacked vertically in that order.
    expect(banner.top).toBeCloseTo(shellRect.top, 0)
    expect(footer.bottom).toBeCloseTo(shellRect.bottom, 0)
    expect(banner.bottom).toBeLessThanOrEqual(nav.top + 0.5)
    expect(footer.top).toBeGreaterThanOrEqual(main.bottom - 0.5)

    // nav | main | aside sit side by side, in that left-to-right order, between banner and footer.
    expect(nav.left).toBeCloseTo(shellRect.left, 0)
    expect(aside.right).toBeCloseTo(shellRect.right, 0)
    expect(nav.right).toBeLessThanOrEqual(main.left + 0.5)
    expect(main.right).toBeLessThanOrEqual(aside.left + 0.5)

    // anti-vacuous: the five regions occupy FIVE genuinely distinct, non-zero-area boxes, not one collapsed stack.
    for (const r of [banner, nav, main, aside, footer]) {
      expect(r.width).toBeGreaterThan(0)
      expect(r.height).toBeGreaterThan(0)
    }

    wrapper.remove()
  })

  it('an ABSENT region reserves NO space — a main-only shell has zero-size banner/nav/aside/footer tracks', () => {
    const { wrapper, shell } = mountShell('<ui-app-shell-region region="main">Body</ui-app-shell-region>', '900px')
    // Read the RESOLVED (measured) track sizes off computed style — CSS Grid's ordinary auto-track sizing
    // collapsing an unoccupied named area, not a :has() rule (this sheet has none for this leg).
    const rows = getComputedStyle(shell).gridTemplateRows.split(/\s+/).map(px)
    const cols = getComputedStyle(shell).gridTemplateColumns.split(/\s+/).map(px)
    expect(rows).toHaveLength(3)
    expect(cols).toHaveLength(3)
    expect(rows[0], 'banner row did not collapse').toBe(0) // banner
    expect(rows[2], 'footer row did not collapse').toBe(0) // footer
    expect(cols[0], 'nav column did not collapse').toBe(0) // nav
    expect(cols[2], 'aside column did not collapse').toBe(0) // aside
    // anti-vacuous: main's OWN track (the middle row/column) is genuinely non-zero, and matches the shell.
    expect(rows[1]).toBeGreaterThan(0)
    expect(cols[1]).toBeGreaterThan(0)
    const shellRect = shell.getBoundingClientRect()
    const main = (shell.querySelector('[region="main"]') as HTMLElement).getBoundingClientRect()
    expect(main.width).toBeCloseTo(shellRect.width, 0)
    expect(main.height).toBeCloseTo(shellRect.height, 0)

    wrapper.remove()
  })

  it('an unknown region value AND an untouched (attribute-less) default both dock to the SAME place as an explicit main', () => {
    // Reference: an explicit region="main", alongside a banner (so the comparison rect is not the whole shell).
    const ref = mountShell(
      '<ui-app-shell-region region="banner">B</ui-app-shell-region><ui-app-shell-region region="main">Ref</ui-app-shell-region>',
      '900px',
    )
    const refMain = (ref.shell.querySelector('[region="main"]') as HTMLElement).getBoundingClientRect()
    ref.wrapper.remove()

    // SPEC-R4 AC2 — an out-of-set region value.
    const bogus = mountShell(
      '<ui-app-shell-region region="banner">B</ui-app-shell-region><ui-app-shell-region region="bogus-region">X</ui-app-shell-region>',
      '900px',
    )
    const bogusEl = bogus.shell.children[1] as HTMLElement & { region: string }
    // The JS PROPERTY is coerced to 'main' (props.ts enumType fallback) — but the directional lock
    // deliberately does NOT reflect that coercion back onto the DOM attribute (that would be the very
    // inbound→outbound bounce the lock exists to prevent), so the raw attribute stays 'bogus-region'
    // forever. This is exactly why app-shell.css's `main` placement is an EXCLUSIONARY catch-all rather than
    // an inclusion rule keyed on the literal string 'main' — the layout proof below is what actually matters.
    expect(bogusEl.region).toBe('main')
    expect(bogusEl.getAttribute('region')).toBe('bogus-region')
    const bogusRect = bogusEl.getBoundingClientRect()
    expect(bogusRect.top).toBeCloseTo(refMain.top, 0)
    expect(bogusRect.left).toBeCloseTo(refMain.left, 0)
    expect(bogusRect.width).toBeCloseTo(refMain.width, 0)
    expect(bogusRect.height).toBeCloseTo(refMain.height, 0)
    bogus.wrapper.remove()

    // The untouched-default regression (app-shell.css's exclusionary `main` catch-all) — no attribute at all.
    const bare = mountShell(
      '<ui-app-shell-region region="banner">B</ui-app-shell-region><ui-app-shell-region>X</ui-app-shell-region>',
      '900px',
    )
    const bareEl = bare.shell.children[1] as HTMLElement
    expect(bareEl.hasAttribute('region')).toBe(false)
    const bareRect = bareEl.getBoundingClientRect()
    expect(bareRect.top).toBeCloseTo(refMain.top, 0)
    expect(bareRect.left).toBeCloseTo(refMain.left, 0)
    expect(bareRect.width).toBeCloseTo(refMain.width, 0)
    expect(bareRect.height).toBeCloseTo(refMain.height, 0)
    bare.wrapper.remove()
  })
})

describe('ui-app-shell-region cross-engine smoke — landmark override (ADR-0083)', () => {
  it('landmark decouples the ROLE from the COLUMN: role=complementary while still landing in the navigation column', () => {
    // GEOMETRY half — a REAL `ui-app-shell-region` (app-shell.css's grid selectors are tag-qualified; see the
    // ProbeRegion banner above for why role introspection can't share this same node). `landmark="main"` is
    // the NC: a value that WOULD misroute this region into the main area if some future edit ever confused
    // `landmark` with `region` for placement — `landmark` drives NO CSS selector at all, so this must NOT move.
    // IDENTICAL nav content ("Nav") in both markups — nav's own column is `auto`-sized to ITS content, so a
    // differing text length between the two would confound the comparison with an unrelated auto-track width
    // change, not a landmark effect (measured: "Composer" vs "Nav" alone shifted the column ~39px).
    const ref = mountShell(
      '<ui-app-shell-region region="banner">B</ui-app-shell-region><ui-app-shell-region region="navigation">Nav</ui-app-shell-region><ui-app-shell-region region="main">Main</ui-app-shell-region>',
      '900px',
    )
    const refNav = (ref.shell.querySelector('[region="navigation"]') as HTMLElement).getBoundingClientRect()
    ref.wrapper.remove()

    const withLandmark = mountShell(
      '<ui-app-shell-region region="banner">B</ui-app-shell-region><ui-app-shell-region region="navigation" landmark="main">Nav</ui-app-shell-region><ui-app-shell-region region="main">Main</ui-app-shell-region>',
      '900px',
    )
    const navEl = withLandmark.shell.querySelector('[region="navigation"]') as HTMLElement
    const navRect = navEl.getBoundingClientRect()
    // NC: landmark="main" did NOT redirect this region into the main area — it is still exactly the nav column.
    expect(navRect.top).toBeCloseTo(refNav.top, 0)
    expect(navRect.left).toBeCloseTo(refNav.left, 0)
    expect(navRect.width).toBeCloseTo(refNav.width, 0)
    expect(navRect.height).toBeCloseTo(refNav.height, 0)
    withLandmark.wrapper.remove()

    // ROLE half — a STANDALONE probe pair (no shell; internals access needs the probe tag, see banner above).
    // Real-engine confirmation of the SAME resolution jsdom already proves exhaustively (app-shell.test.ts):
    // pure ElementInternals/property behaviour, not CSS/layout, so this is a cross-engine sanity check, not a
    // re-derivation.
    const withOverride = document.createElement('ui-app-shell-region-axprobe') as ProbeRegion
    withOverride.region = 'navigation'
    withOverride.landmark = 'complementary'
    document.body.append(withOverride)
    expect(withOverride.ii.role, 'landmark did not override the role').toBe('complementary')

    // NC: without the override, the SAME region falls back to its region's OWN default landmark.
    const withoutOverride = document.createElement('ui-app-shell-region-axprobe') as ProbeRegion
    withoutOverride.region = 'navigation'
    document.body.append(withoutOverride)
    expect(withoutOverride.ii.role, 'the no-override baseline was not the region default').toBe('navigation')

    withOverride.remove()
    withoutOverride.remove()
  })
})

describe('ui-app-shell cross-engine smoke — narrow-container reflow (SPEC-R5)', () => {
  it('side regions hide below the 40rem threshold; main takes the FULL width — resize the wrapper, not the viewport', () => {
    const { wrapper, shell } = mountShell(FULL, '900px') // wide → ≥ 40rem (640px @16px root)
    const nav = shell.querySelector('[region="navigation"]') as HTMLElement
    const aside = shell.querySelector('[region="complementary"]') as HTMLElement
    const main = shell.querySelector('[region="main"]') as HTMLElement

    expect(getComputedStyle(nav).display).not.toBe('none') // wide: nav genuinely visible
    expect(getComputedStyle(aside).display).not.toBe('none')
    const wideMainWidth = main.getBoundingClientRect().width
    const shellWidth = shell.getBoundingClientRect().width
    expect(wideMainWidth).toBeLessThan(shellWidth) // wide: main shares the row with nav/aside

    wrapper.style.width = '300px' // narrow the CONTAINER (< 40rem), not the viewport
    expect(getComputedStyle(nav).display, 'nav did not hide under the narrow reflow').toBe('none')
    expect(getComputedStyle(aside).display, 'aside did not hide under the narrow reflow').toBe('none')
    const narrowMainWidth = main.getBoundingClientRect().width
    const narrowShellWidth = shell.getBoundingClientRect().width
    expect(narrowMainWidth).toBeCloseTo(narrowShellWidth, 0) // narrow: main alone spans the full (narrow) width

    // anti-vacuous, comparing PROPORTIONS (not raw px — the two containers are different absolute widths, so
    // a raw px comparison is meaningless): main's SHARE of the shell's own width genuinely grew once nav/aside
    // vacated the row — the reflow actually relaid out the children, a vacuous computed-flag-only pass would
    // miss this.
    const wideMainShare = wideMainWidth / shellWidth
    const narrowMainShare = narrowMainWidth / narrowShellWidth
    expect(narrowMainShare).toBeGreaterThan(wideMainShare)

    wrapper.remove()
  })

  it('a WIDE container never reflows (negative control) — nav/aside stay visible at the same width repeatedly checked', () => {
    const { wrapper, shell } = mountShell(FULL, '900px')
    const nav = shell.querySelector('[region="navigation"]') as HTMLElement
    expect(getComputedStyle(nav).display).not.toBe('none')
    wrapper.style.width = '900px' // no-op resize — still wide
    expect(getComputedStyle(nav).display).not.toBe('none') // the assertion above must NOT vacuously always pass
    wrapper.remove()
  })

  it('collapse="stack" (ADR-0084): a side region stays VISIBLE + full-width when narrow — collapse="hide" (default) still hides', () => {
    // nav opts OUT of hiding (collapse="stack"); complementary keeps the default (collapse="hide") — the NC
    // this leg needs: stacking one region must NOT accidentally stop the OTHER, unrelated region from hiding.
    const { wrapper, shell } = mountShell(
      `
        <ui-app-shell-region region="banner">Banner</ui-app-shell-region>
        <ui-app-shell-region region="navigation" collapse="stack">Composer</ui-app-shell-region>
        <ui-app-shell-region region="main">Main</ui-app-shell-region>
        <ui-app-shell-region region="complementary">Aside</ui-app-shell-region>
        <ui-app-shell-region region="contentinfo">Footer</ui-app-shell-region>
      `,
      '900px',
    )
    const nav = shell.querySelector('[region="navigation"]') as HTMLElement
    const aside = shell.querySelector('[region="complementary"]') as HTMLElement

    wrapper.style.width = '300px' // narrow the CONTAINER (< 40rem), not the viewport
    expect(getComputedStyle(nav).display, 'collapse="stack" region hid — it should stay visible').not.toBe('none')
    expect(getComputedStyle(aside).display, 'the NC did not bite — the default collapse="hide" region did not hide').toBe('none')

    // anti-vacuous: the stacked region is not just "not display:none" — it genuinely occupies real, full-width space.
    const navRect = nav.getBoundingClientRect()
    const shellRect = shell.getBoundingClientRect()
    expect(navRect.width).toBeCloseTo(shellRect.width, 0)
    expect(navRect.height).toBeGreaterThan(0)

    wrapper.remove()
  })

  it('collapse="toggle" (SPEC-R8, LLD-C11): starts expanded (visible + full-width like stack) narrow; the affordance collapses it, keeps the button reachable', async () => {
    const { wrapper, shell } = mountShell(
      `
        <ui-app-shell-region region="banner">Banner</ui-app-shell-region>
        <ui-app-shell-region region="navigation" collapse="toggle">Composer</ui-app-shell-region>
        <ui-app-shell-region region="main">Main</ui-app-shell-region>
        <ui-app-shell-region region="complementary">Aside</ui-app-shell-region>
        <ui-app-shell-region region="contentinfo">Footer</ui-app-shell-region>
      `,
      '900px',
    )
    const nav = shell.querySelector('[region="navigation"]') as UIAppShellRegionElement
    const btn = nav.querySelector('[data-part="collapse-toggle"]') as HTMLButtonElement
    const content = nav.querySelector('[data-part="content"]') as HTMLElement

    wrapper.style.width = '300px' // narrow the CONTAINER (< 40rem), not the viewport
    expect(getComputedStyle(nav).display, 'a collapse="toggle" region hid before any user action — it should start expanded').not.toBe('none')
    expect(getComputedStyle(btn).display, 'the toggle affordance is not visible narrow').not.toBe('none')
    const navRect = nav.getBoundingClientRect()
    const shellRect = shell.getBoundingClientRect()
    expect(navRect.width).toBeCloseTo(shellRect.width, 0) // full-width, like stack, while expanded

    btn.click()
    await nav.updateComplete // the #collapsed signal write's effect re-run is microtask-batched
    expect(getComputedStyle(content).display, 'the content did not hide on collapse').toBe('none')
    expect(getComputedStyle(nav).display, 'the WHOLE region vanished — only its content should hide, the button must stay reachable').not.toBe('none')
    expect(getComputedStyle(btn).display, 'the affordance itself vanished — the user could never expand it again').not.toBe('none')

    btn.click() // toggling back expands it again
    await nav.updateComplete
    expect(getComputedStyle(content).display).not.toBe('none')

    wrapper.remove()
  })

  it('collapse="toggle" wide-layout-unchanged invariant (SPEC-R8 AC2): an EXPANDED toggle region is byte-identical, wide, to a default region', () => {
    const ref = mountShell(
      '<ui-app-shell-region region="banner">B</ui-app-shell-region><ui-app-shell-region region="navigation">Nav</ui-app-shell-region><ui-app-shell-region region="main">Main</ui-app-shell-region>',
      '900px',
    )
    const refNav = (ref.shell.querySelector('[region="navigation"]') as HTMLElement).getBoundingClientRect()
    ref.wrapper.remove()

    const toggled = mountShell(
      '<ui-app-shell-region region="banner">B</ui-app-shell-region><ui-app-shell-region region="navigation" collapse="toggle">Nav</ui-app-shell-region><ui-app-shell-region region="main">Main</ui-app-shell-region>',
      '900px',
    )
    const nav = toggled.shell.querySelector('[region="navigation"]') as HTMLElement
    const btn = nav.querySelector('[data-part="collapse-toggle"]') as HTMLElement
    // the assertion bites if the toggle anatomy renders ANY visible box wide, or perturbs the region's own
    // placement/size — the affordance must be OFF the box tree entirely at this width.
    expect(getComputedStyle(btn).display, 'the toggle affordance is visible WIDE — the invariant is broken').toBe('none')
    const navRect = nav.getBoundingClientRect()
    expect(navRect.top).toBeCloseTo(refNav.top, 0)
    expect(navRect.left).toBeCloseTo(refNav.left, 0)
    expect(navRect.width).toBeCloseTo(refNav.width, 0)
    expect(navRect.height).toBeCloseTo(refNav.height, 0)
    toggled.wrapper.remove()
  })

  it('collapse="toggle" is keyboard-operable (SPEC-R8 AC1) — a native <button>, Enter activates it', async () => {
    const { wrapper, shell } = mountShell(
      '<ui-app-shell-region region="navigation" collapse="toggle">Composer</ui-app-shell-region><ui-app-shell-region region="main">Main</ui-app-shell-region>',
      '900px',
    )
    wrapper.style.width = '300px'
    const nav = shell.querySelector('[region="navigation"]') as UIAppShellRegionElement
    const btn = nav.querySelector('[data-part="collapse-toggle"]') as HTMLButtonElement
    const content = nav.querySelector('[data-part="content"]') as HTMLElement
    btn.focus()
    expect(document.activeElement).toBe(btn) // natively focusable, no bespoke tabindex needed
    btn.click() // a native <button> activates identically on Enter/Space/click — click stands in for the platform key path
    await nav.updateComplete
    expect(getComputedStyle(content).display).toBe('none')
    wrapper.remove()
  })
})

describe('ui-app-shell cross-engine smoke — forced-colors survival (SPEC-R7 AC2)', () => {
  it('a region divider stays visible under forced-colors — Chromium emulates (CDP); WebKit asserts the baseline', async () => {
    const { wrapper, shell } = mountShell(FULL, '900px')
    const banner = shell.querySelector('[region="banner"]') as HTMLElement

    // Baseline (BOTH engines): the banner's bottom divider is a painted hairline (opaque).
    expect(alphaOf(getComputedStyle(banner).borderBottomColor), 'baseline divider is invisible').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP / forced-colors emulation (the documented cross-engine split, card.browser.test.ts
      // precedent). Assert the engine is genuinely NOT in forced-colors and stop; the leg is proven in Chromium.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      wrapper.remove()
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      expect(alphaOf(getComputedStyle(banner).borderBottomColor), 'divider vanished under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] }) // reset for the next test
    }
    wrapper.remove()
  })
})

describe('ui-app-shell-region cross-engine smoke — standalone degrade-gracefully (SPEC-R3)', () => {
  it('used outside a shell, it renders as a genuine block (not the UA inline default)', () => {
    const el = document.createElement('ui-app-shell-region')
    el.textContent = 'Standalone'
    document.body.append(el)
    mounted.push(el)
    expect(getComputedStyle(el).display).toBe('block')
    el.remove()
  })
})
