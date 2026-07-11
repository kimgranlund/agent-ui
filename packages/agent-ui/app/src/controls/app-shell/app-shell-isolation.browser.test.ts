import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// n2c — the ISOLATION cross-engine gate (LLD-C5/C7; SPEC-R6). Runs in BOTH Chromium and WebKit
// (vitest.browser.config.ts). This file is SINGLE-WRITER-DISJOINT from app-shell.browser.test.ts (LLD-C7):
// it owns ONLY the isolated-mode legs — AC2 (tokens + the control's own styles reach in-shadow controls),
// AC3 (no host-CSS leak, with the off-isolation negative control), the SPEC-R7 forced-colors chrome-parity
// leg (restored post-review — the isolated `:host` divider/forced-colors mirror, app-shell.browser.test.ts's
// own R7 leg pattern reused), and AC5 (the isolated LAYOUT: grid-area placement + narrow reflow hold, with the
// "no :host mirror injected" negative control). AC1 (off-path byte-identical) and AC4 (escalation) are
// documentation/process legs, not separate assertions here.
//
// This is a BROWSER-TRUTH BET (LLD-C5 F2): the two genuinely unproven surfaces are (i) `@scope (ui-{name})`
// evaluated INSIDE a shadow-injected sheet (Safari 17.4 — the real unknown) and (ii) the universal `*`
// dimension-ramp custom-property re-derivation across the shadow boundary. `adoptedStyleSheets` support
// itself is NOT the fragile part (broadly available). Per the escalation contract: if either leg fails on an
// engine after trying the SPEC-R6 AC4 fallbacks, this is NOT worked around or silently skipped — it is
// reported honestly, per engine, for Kim's escalation.
//
// MEASURED FINDING (both engines, not a divergence): the injected fleet `<link rel=stylesheet>`s load
// ASYNCHRONOUSLY (a real network fetch, same as any document `<link>`) — a shadow's composed controls are
// UNSTYLED for one paint until they resolve. WORSE, once they DO resolve, a control whose CSS transitions a
// property gated behind its `ready` custom state (button.css's `background-color`/`color`/`border-color`
// fade) treats "unstyled → styled" as a genuine style CHANGE eligible for that transition — so a composed
// control can visibly FADE IN over `--ui-motion-fast` rather than snapping to its final look instantly (measured:
// waiting past the stylesheet `load` event alone still caught an un-settled, still-transitioning background on
// one engine). Every assertion below awaits BOTH `whenLinksLoad` AND `whenSettled` (which additionally waits
// out any still-running CSS transition/animation) before measuring. A real consumer sees a brief FOUC +
// possible fade-in in isolated mode — worth flagging (not a defect this slice fixes — the LLD's
// `<style>@import…` alternative would have the identical async-fetch property, and the transition is the
// component's OWN, unrelated to isolation).
//
// CSS wiring: `@agent-ui/app` has no barrel yet (LLD-C8) — this smoke injects the DOCUMENT-level sheets a
// light-DOM reference control needs directly (mirrors app-shell.browser.test.ts / row.browser.test.ts /
// card.browser.test.ts). The shell's OWN isolated-mode injection (foundation + component-styles + the F1b
// grid mirror, INSIDE the shadow) is app-shell.ts's own responsibility — this file never re-implements it,
// except in the deliberately-broken negative-control harnesses below (which hand-build an isolated shadow
// omitting exactly one piece, to prove that piece is load-bearing).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css' // ui-button's own CSS, for the light-DOM reference control
import './app-shell.css'
import './app-shell.ts'
import type { UIAppShellRegionElement } from './app-shell.ts'
import '@agent-ui/components/controls/button' // self-defines ui-button — the real composed control both legs use
// The SAME two fleet-asset `?url` imports app-shell.ts uses — reused ONLY by the negative-control harnesses
// below to hand-construct an isolated shadow missing one specific piece.
import foundationStylesHref from '@agent-ui/components/foundation-styles.css?url'
import componentStylesHref from '@agent-ui/components/component-styles.css?url'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime
 *  (the card.browser.test.ts / app-shell.browser.test.ts precedent). */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

/** Alpha of a computed colour — 0 ⇒ vanished/transparent, > 0 ⇒ painted. The card.browser.test.ts /
 *  app-shell.browser.test.ts helper, copied (no shared browser-test-util module exists in this repo). */
const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

/** Resolve once every `<link rel=stylesheet>` under `root` has actually loaded (`.sheet` populated) — a
 *  MEASURED necessity: the injected fleet stylesheets load via a real, ASYNCHRONOUS network fetch (see the
 *  file banner), so every geometry/colour/style assertion below must wait past this or it measures the
 *  pre-load, unstyled paint instead of the isolated shell's real, settled state. */
function whenLinksLoad(root: ParentNode): Promise<void> {
  const links = [...root.querySelectorAll('link[rel="stylesheet"]')] as HTMLLinkElement[]
  return Promise.all(
    links.map(
      (link) =>
        new Promise<void>((resolve) => {
          if (link.sheet) resolve()
          else link.addEventListener('load', () => resolve(), { once: true })
        }),
    ),
  ).then(() => undefined)
}

/** Resolve once `el`'s own CSS transitions/animations (if any are currently running) have finished — the
 *  MEASURED necessity (see the file banner): a control's `ready`-gated fade can still be mid-transition the
 *  instant its stylesheet finishes loading, so a synchronous measurement right after `whenLinksLoad` can
 *  catch an un-settled colour. `getAnimations()` (CSS Transitions/Animations are BOTH surfaced through the
 *  Web Animations API) resolves immediately when nothing is running. */
function whenSettled(el: Element): Promise<void> {
  return Promise.all(el.getAnimations().map((a) => a.finished)).then(() => undefined)
}

/** A resizable, `[scale]`/`[density]`-bearing ancestor wrapper — the "ancestor theme-provider" SPEC-R6 AC2
 *  names (this fleet has no dedicated theme-provider element yet outside `site/`, which this package must
 *  not depend on; a plain `[scale]`/`[density]` ancestor is the SAME mechanism a real one would ultimately
 *  set — the row.browser.test.ts precedent). */
function contextWrapper(scale?: string, density?: string): HTMLElement {
  const wrapper = document.createElement('div')
  if (scale) wrapper.setAttribute('scale', scale)
  if (density) wrapper.setAttribute('density', density)
  document.body.append(wrapper)
  mounted.push(wrapper)
  return wrapper
}

/** A real isolated `<ui-app-shell isolated>` with `inner` markup docked into its `main` region, appended
 *  under `parent`. Returns the shell (its shadowRoot is the isolation entry point every leg reads) —
 *  ALREADY SETTLED (its injected stylesheets have loaded) by the time the promise resolves. */
async function mountIsolatedShell(parent: HTMLElement, inner: string): Promise<HTMLElement> {
  const shell = document.createElement('ui-app-shell')
  shell.setAttribute('isolated', '')
  const region = document.createElement('ui-app-shell-region')
  region.setAttribute('region', 'main')
  region.innerHTML = inner
  shell.append(region)
  parent.append(shell)
  await whenLinksLoad(shell.shadowRoot!)
  return shell
}

describe('ui-app-shell isolated — AC2: tokens pierce + the control’s own styles apply', () => {
  it('an in-shadow ui-button matches an identical light-DOM reference under the SAME [scale] ancestor — geometry', async () => {
    // Default (no [scale]) baseline — establishes what "unscaled" looks like, so the content-lg comparison
    // below is provably NOT vacuous (a height that never changes regardless of context proves nothing).
    const plainCtx = contextWrapper()
    const plainRef = document.createElement('ui-button')
    plainRef.textContent = 'Plain'
    plainCtx.append(plainRef)
    const plainHeight = plainRef.getBoundingClientRect().height

    const ctx = contextWrapper('content-lg')
    const reference = document.createElement('ui-button')
    reference.textContent = 'Reference'
    ctx.append(reference)
    const referenceHeight = reference.getBoundingClientRect().height

    const shell = await mountIsolatedShell(ctx, '<ui-button>In-shadow</ui-button>')
    const inShadow = shell.shadowRoot!.querySelector('ui-button') as HTMLElement

    // anti-vacuous: [scale=content-lg] genuinely changes the rendered height vs. the unscaled baseline.
    expect(referenceHeight).not.toBeCloseTo(plainHeight, 0)
    // AC2 leg (a): the SAME [scale] ancestor reaches THROUGH the shadow boundary — the in-shadow button's
    // height matches the light-DOM reference exactly, not the unscaled default.
    const inShadowHeight = inShadow.getBoundingClientRect().height
    expect(inShadowHeight).toBeCloseTo(referenceHeight, 0)
    expect(inShadowHeight).not.toBeCloseTo(plainHeight, 0)
  })

  it('an in-shadow ui-button reads the SAME colour role as the light-DOM reference — colour', async () => {
    const ctx = contextWrapper()
    const reference = document.createElement('ui-button')
    reference.textContent = 'Reference'
    ctx.append(reference)
    const referenceBg = getComputedStyle(reference).backgroundColor
    expect(alphaOf(referenceBg), 'the reference button has no visible fill — the baseline is broken').toBeGreaterThan(0)

    const shell = await mountIsolatedShell(ctx, '<ui-button>In-shadow</ui-button>')
    const inShadow = shell.shadowRoot!.querySelector('ui-button') as HTMLElement
    await whenSettled(inShadow) // the ready-gated background-color fade (see file banner) — wait it out
    expect(getComputedStyle(inShadow).backgroundColor).toBe(referenceBg)
  })

  it('the in-shadow button’s OWN styles are applied — @scope(ui-button) matched inside the shadow, not the UA inline default', async () => {
    const ctx = contextWrapper()
    const shell = await mountIsolatedShell(ctx, '<ui-button>In-shadow</ui-button>')
    const inShadow = shell.shadowRoot!.querySelector('ui-button') as HTMLElement
    // button.css sets `display: inline-grid` on :scope; an UNSTYLED custom element defaults to `inline` — so
    // this is a genuine, meaningful signal that @scope (ui-button) matched INSIDE the shadow-injected sheet
    // (the Safari-17.4 unknown, LLD-C5 F2(i)), not a coincidence.
    expect(getComputedStyle(inShadow).display).toBe('inline-grid')
    expect(getComputedStyle(inShadow).blockSize).not.toBe('auto') // block-size is explicitly set off the ramp
  })
})

describe('ui-app-shell isolated — AC3: no inbound host-CSS leak (with the off-isolation negative control)', () => {
  it('a host-page rule targeting ui-button does NOT reach the in-shadow control; it DOES reach a non-isolated one', async () => {
    // `!important`: button.css's OWN `@scope (ui-button) { :scope { color: … } }` rule already sets `color`
    // (measured: it otherwise beats a bare `ui-button{…}` type-selector rule on specificity alone, in EITHER
    // light or shadow DOM) — the leak PROBE needs unambiguous override capability so a light-DOM miss can
    // only mean "isolation genuinely blocked it", never "the probe rule was too weak to begin with".
    const styleTag = document.createElement('style')
    styleTag.textContent = 'ui-button { color: rgb(255, 0, 0) !important }'
    document.head.append(styleTag)
    try {
      const ctx = contextWrapper()

      // Negative control FIRST (proves the rule genuinely reaches a composed control when isolation is OFF —
      // so its absence on the isolated one below is meaningful, not a fluke of the rule never applying at all).
      const unisolatedShell = document.createElement('ui-app-shell')
      const unisolatedRegion = document.createElement('ui-app-shell-region')
      unisolatedRegion.setAttribute('region', 'main')
      const unisolatedButton = document.createElement('ui-button')
      unisolatedButton.textContent = 'Leaks'
      unisolatedRegion.append(unisolatedButton)
      unisolatedShell.append(unisolatedRegion)
      ctx.append(unisolatedShell)
      expect(getComputedStyle(unisolatedButton).color, 'the negative control did not bite — the host rule never reached ANY composed button').toBe('rgb(255, 0, 0)')

      // The real leg: isolated — the SAME host rule must NOT reach the relocated, shadow-tree button.
      const isolatedShell = await mountIsolatedShell(ctx, '<ui-button>Isolated</ui-button>')
      const isolatedButton = isolatedShell.shadowRoot!.querySelector('ui-button') as HTMLElement
      await whenSettled(isolatedButton) // the ready-gated `color` fade (see file banner) — wait it out, for rigor
      expect(getComputedStyle(isolatedButton).color).not.toBe('rgb(255, 0, 0)')
    } finally {
      styleTag.remove()
    }
  })
})

describe('ui-app-shell isolated — forced-colors chrome parity (SPEC-R7, restored post-review)', () => {
  it('an isolated region divider stays visible under forced-colors — Chromium emulates (CDP); WebKit asserts the baseline', async () => {
    const ctx = contextWrapper()
    const shell = await mountIsolatedShell(ctx, '<ui-button>Main</ui-button>')
    // The main region alone carries no divider (only banner/nav/aside/footer face one) — dock a banner too,
    // so this leg has a real divider to measure, mirroring app-shell.browser.test.ts's light-mode leg.
    const banner = document.createElement('ui-app-shell-region')
    banner.setAttribute('region', 'banner')
    // Relocated-shape stand-in: appended directly into the shadow root (a top-level shadow child, exactly the
    // shape app-shell.ts's own connectedCallback relocation produces) — `:host > ui-app-shell-region[…]`
    // matches it the same way it matches a genuinely relocated region. The fleet stylesheets are already
    // loaded (mountIsolatedShell awaited that); no new <link> was added, so no further wait is needed.
    shell.shadowRoot!.append(banner)

    // Baseline (BOTH engines): the banner's bottom divider is a painted hairline (opaque) — proves the
    // `:host`-scoped divider mirror matched inside the shadow at all, before forced-colors enters the picture.
    expect(alphaOf(getComputedStyle(banner).borderBottomColor), 'baseline divider is invisible').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP / forced-colors emulation (the documented cross-engine split, app-shell.browser.test.ts
      // precedent). Assert the engine is genuinely NOT in forced-colors and stop; the leg is proven in Chromium.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      expect(alphaOf(getComputedStyle(banner).borderBottomColor), 'isolated divider vanished under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] }) // reset for the next test
    }
  })
})

describe('ui-app-shell isolated — AC5: the isolated LAYOUT (grid-area placement + narrow reflow hold)', () => {
  type RegionName = 'banner' | 'navigation' | 'main' | 'complementary' | 'contentinfo'
  const REGION_TEXT: Record<RegionName, string> = { banner: 'Banner', navigation: 'Nav', main: 'Main', complementary: 'Aside', contentinfo: 'Footer' }

  /** The full five-region markup, optionally with EXTRA attribute text on named regions (e.g. `{navigation:
   *  'collapse="stack"'}`) — the ADR-0084 isolated-collapse leg reuses this to dock a stacking composer. */
  function fullMarkup(extra: Partial<Record<RegionName, string>> = {}): string {
    return (Object.keys(REGION_TEXT) as RegionName[])
      .map((region) => `<ui-app-shell-region region="${region}" ${extra[region] ?? ''}>${REGION_TEXT[region]}</ui-app-shell-region>`)
      .join('\n')
  }
  const FULL = fullMarkup()

  /** A REAL isolated shell composed with all five regions directly (bypassing mountIsolatedShell's
   *  single-region convenience, since this leg needs the FULL region set, not one docked into `main`). */
  async function mountFullIsolatedShell(
    width = '900px',
    extra: Partial<Record<RegionName, string>> = {},
  ): Promise<{ wrapper: HTMLElement; shell: HTMLElement }> {
    const wrapper = document.createElement('div')
    wrapper.style.containerType = 'inline-size'
    wrapper.style.width = width
    const shell = document.createElement('ui-app-shell')
    shell.setAttribute('isolated', '')
    shell.innerHTML = fullMarkup(extra)
    wrapper.append(shell)
    document.body.append(wrapper)
    mounted.push(wrapper)
    await whenLinksLoad(shell.shadowRoot!)
    return { wrapper, shell }
  }

  it('all five regions land in their correct grid area INSIDE the shadow — the whole rendered shape', async () => {
    const { shell } = await mountFullIsolatedShell('900px')
    const root = shell.shadowRoot!
    const rectOf = (region: string): DOMRect => (root.querySelector(`[region="${region}"]`) as HTMLElement).getBoundingClientRect()
    const shellRect = shell.getBoundingClientRect()
    const banner = rectOf('banner')
    const nav = rectOf('navigation')
    const main = rectOf('main')
    const aside = rectOf('complementary')
    const footer = rectOf('contentinfo')

    expect(banner.top).toBeCloseTo(shellRect.top, 0)
    expect(footer.bottom).toBeCloseTo(shellRect.bottom, 0)
    expect(banner.bottom).toBeLessThanOrEqual(nav.top + 0.5)
    expect(footer.top).toBeGreaterThanOrEqual(main.bottom - 0.5)
    expect(nav.left).toBeCloseTo(shellRect.left, 0)
    expect(aside.right).toBeCloseTo(shellRect.right, 0)
    expect(nav.right).toBeLessThanOrEqual(main.left + 0.5)
    expect(main.right).toBeLessThanOrEqual(aside.left + 0.5)
    for (const r of [banner, nav, main, aside, footer]) {
      expect(r.width).toBeGreaterThan(0)
      expect(r.height).toBeGreaterThan(0)
    }
  })

  it('narrow reflow holds under isolation — side regions hide below 40rem, main takes the FULL width', async () => {
    const { wrapper, shell } = await mountFullIsolatedShell('900px')
    const root = shell.shadowRoot!
    const nav = root.querySelector('[region="navigation"]') as HTMLElement
    const aside = root.querySelector('[region="complementary"]') as HTMLElement
    const main = root.querySelector('[region="main"]') as HTMLElement

    expect(getComputedStyle(nav).display).not.toBe('none')
    const wideMainWidth = main.getBoundingClientRect().width
    const wideShellWidth = shell.getBoundingClientRect().width
    expect(wideMainWidth).toBeLessThan(wideShellWidth)

    wrapper.style.width = '300px' // narrow the CONTAINER (< 40rem), not the viewport
    expect(getComputedStyle(nav).display, 'nav did not hide under the isolated narrow reflow').toBe('none')
    expect(getComputedStyle(aside).display, 'aside did not hide under the isolated narrow reflow').toBe('none')
    const narrowMainWidth = main.getBoundingClientRect().width
    const narrowShellWidth = shell.getBoundingClientRect().width
    expect(narrowMainWidth).toBeCloseTo(narrowShellWidth, 0)

    // anti-vacuous, by PROPORTION (the two containers are different absolute widths): main's share of the
    // shell genuinely grew once nav/aside vacated the row.
    expect(narrowMainWidth / narrowShellWidth).toBeGreaterThan(wideMainWidth / wideShellWidth)
  })

  it('collapse="stack" (ADR-0084) holds under isolation — a side region stays VISIBLE + full-width when narrow, inside the shadow', async () => {
    const { wrapper, shell } = await mountFullIsolatedShell('900px', {
      navigation: 'collapse="stack"', // the composer opts OUT of hiding; complementary keeps the default (hide)
    })
    const root = shell.shadowRoot!
    const nav = root.querySelector('[region="navigation"]') as HTMLElement
    const aside = root.querySelector('[region="complementary"]') as HTMLElement

    wrapper.style.width = '300px' // narrow the CONTAINER (< 40rem)
    expect(getComputedStyle(nav).display, 'the isolated collapse="stack" region hid — it should stay visible').not.toBe('none')
    expect(getComputedStyle(aside).display, 'the NC did not bite — the default collapse="hide" region (isolated) did not hide').toBe('none')

    // anti-vacuous: genuinely occupies real, full-width space (not just "not display:none").
    const navRect = nav.getBoundingClientRect()
    const shellRect = shell.getBoundingClientRect()
    expect(navRect.width).toBeCloseTo(shellRect.width, 0)
    expect(navRect.height).toBeGreaterThan(0)
  })

  it('collapse="toggle" (SPEC-R8 AC3, LLD-C11) holds under isolation — the affordance + collapse behaviour work in-shadow', async () => {
    const { wrapper, shell } = await mountFullIsolatedShell('900px', {
      navigation: 'collapse="toggle"',
    })
    const root = shell.shadowRoot!
    const nav = root.querySelector('[region="navigation"]') as UIAppShellRegionElement

    wrapper.style.width = '300px' // narrow the CONTAINER (< 40rem)
    expect(getComputedStyle(nav).display, 'the isolated collapse="toggle" region hid before any collapse — it should start expanded like stack').not.toBe('none')
    const btn = nav.querySelector('[data-part="collapse-toggle"]') as HTMLElement
    expect(getComputedStyle(btn).display, 'the toggle affordance did not become visible narrow, in-shadow').not.toBe('none')

    btn.click()
    await nav.updateComplete // the #collapsed signal write's effect re-run is microtask-batched
    const content = nav.querySelector('[data-part="content"]') as HTMLElement
    expect(getComputedStyle(content).display, 'clicking the in-shadow affordance did not collapse the content — the mirror rule is missing').toBe('none')
    expect(getComputedStyle(nav).display, 'the region itself vanished on collapse — only its content part should hide').not.toBe('none')
  })

  it('collapse="stack" HARDEN (review fix, off the a2ui-live dogfood): the shell rule out-specifies a competing consumer width rule, even inside the shadow', async () => {
    // The exact conflict a2ui-live.css hit in LIGHT mode: a consumer docks `collapse="stack"` AND its own
    // fixed-width card rule (`.chat-pane { inline-size: 26rem }`) on the SAME region — the item's own width
    // used to beat the (pre-harden) stack rule's stretch. Under ISOLATION a page's document stylesheet can
    // never reach relocated shadow content at all (ADR-0082) — so the ONLY place this guarantee can live is
    // the shell's OWN mirrored rule. Reproduced here by injecting the competing rule DIRECTLY into the
    // shadow (the sole channel by which anything could ever reach this element), proving the shell's
    // `:host > […][collapse='stack']` (specificity 0,2,1) out-specifies a bare consumer class (0,1,0)
    // regardless of how the rule got there.
    const { wrapper, shell } = await mountFullIsolatedShell('900px', {
      navigation: 'collapse="stack" class="chat-pane"',
    })
    const competing = document.createElement('style')
    competing.textContent = '.chat-pane { inline-size: 26rem; }'
    shell.shadowRoot!.append(competing)

    const nav = shell.shadowRoot!.querySelector('[region="navigation"]') as HTMLElement
    wrapper.style.width = '300px' // narrow the CONTAINER (< 40rem)
    expect(getComputedStyle(nav).display, 'the region hid — collapse="stack" did not hold').not.toBe('none')

    const navRect = nav.getBoundingClientRect()
    const shellRect = shell.getBoundingClientRect()
    expect(navRect.width, 'the competing consumer width rule beat the shell hardened stack rule').toBeCloseTo(shellRect.width, 0)
  })

  it('NEGATIVE CONTROL — without the collapse="stack" rule mirrored into the shadow, the region hides anyway (isolates that ONE rule, distinct from the whole-mirror NC below)', async () => {
    // Hand-built harness — the SAME grid mirror as the real isolation flow (`:host{display:grid…}` + the
    // grid-area assignments + the hide rules), but this copy OMITS just the `collapse="stack"` rule — proving
    // THAT rule specifically is load-bearing under isolation, not merely that the mirror as a whole is (the
    // NEXT negative control already proves that broader fact).
    const wrapper = document.createElement('div')
    wrapper.style.width = '900px'
    document.body.append(wrapper)
    mounted.push(wrapper)

    const host = document.createElement('div')
    wrapper.append(host)
    const shadow = host.attachShadow({ mode: 'open' })
    shadow.innerHTML =
      `<link rel="stylesheet" href="${foundationStylesHref}">` +
      `<link rel="stylesheet" href="${componentStylesHref}">` +
      `<style>
        ui-app-shell-region { display: block; }
        :host {
          display: grid;
          grid-template: 'banner banner banner' auto 'nav main aside' 1fr 'footer footer footer' auto / auto 1fr auto;
          container-type: inline-size;
        }
        :host > ui-app-shell-region:not([region='banner']):not([region='navigation']):not([region='complementary']):not([region='contentinfo']) { grid-area: main; }
        :host > ui-app-shell-region[region='banner'] { grid-area: banner; }
        :host > ui-app-shell-region[region='navigation'] { grid-area: nav; }
        :host > ui-app-shell-region[region='complementary'] { grid-area: aside; }
        :host > ui-app-shell-region[region='contentinfo'] { grid-area: footer; }
        @container (inline-size < 40rem) {
          :host { grid-template: 'banner' auto 'main' 1fr 'footer' auto / 1fr; }
          :host > ui-app-shell-region[region='navigation'],
          :host > ui-app-shell-region[region='complementary'] { display: none; }
          /* collapse="stack" rule DELIBERATELY OMITTED here — the ONE thing under test */
        }
      </style>` +
      `<ui-app-shell-region region="banner">Banner</ui-app-shell-region>` +
      `<ui-app-shell-region region="navigation" collapse="stack">Composer</ui-app-shell-region>` +
      `<ui-app-shell-region region="main">Main</ui-app-shell-region>` +
      `<ui-app-shell-region region="complementary">Aside</ui-app-shell-region>` +
      `<ui-app-shell-region region="contentinfo">Footer</ui-app-shell-region>`
    await whenLinksLoad(shadow)

    const nav = shadow.querySelector('[region="navigation"]') as HTMLElement
    wrapper.style.width = '300px' // narrow the CONTAINER
    // NC bites: without the collapse="stack" rule mirrored, the attribute has no effect — nav hides anyway,
    // exactly like the default collapse="hide" sibling above.
    expect(getComputedStyle(nav).display, 'the NC did not bite — nav stayed visible even without the collapse rule mirrored').toBe('none')
  })

  it('NEGATIVE CONTROL — without the F1b :host grid mirror injected, isolated regions land UN-placed (proves the mirror is load-bearing)', async () => {
    // Hand-built harness: attachShadow + inject foundation/component-styles + relocate children — EXACTLY
    // app-shell.ts's own flow, MINUS the grid rules (`:host{display:grid…}` + the grid-area assignments +
    // the @container reflow). The region's OWN base `display:block` rule is KEPT (a single inline rule,
    // reproduced below) so this isolates SPECIFICALLY the grid mirror's absence, not a compounded "nothing at
    // all was injected" scenario — a more precise negative control than simply injecting zero CSS. If this
    // did NOT show broken placement, the real component's own grid-mirror injection would not be proven
    // load-bearing at all — a green AC5 above could be a coincidence of some OTHER mechanism.
    const wrapper = document.createElement('div')
    wrapper.style.width = '900px'
    document.body.append(wrapper)
    mounted.push(wrapper)

    const host = document.createElement('div') // a stand-in host — not a real ui-app-shell (no LLD-C4 doc sheet applies to it, matching the isolated case where relocated content leaves the light tree entirely)
    wrapper.append(host)
    const shadow = host.attachShadow({ mode: 'open' })
    shadow.innerHTML =
      `<link rel="stylesheet" href="${foundationStylesHref}">` +
      `<link rel="stylesheet" href="${componentStylesHref}">` +
      `<style>ui-app-shell-region { display: block; }</style>` + // KEPT — isolates the grid rules as the ONLY omission
      FULL
    await whenLinksLoad(shadow)

    const banner = shadow.querySelector('[region="banner"]') as HTMLElement
    const nav = shadow.querySelector('[region="navigation"]') as HTMLElement
    const main = shadow.querySelector('[region="main"]') as HTMLElement
    const aside = shadow.querySelector('[region="complementary"]') as HTMLElement
    const footer = shadow.querySelector('[region="contentinfo"]') as HTMLElement

    // Un-placed: with no grid at all (`:host` never got `display:grid`), the regions stack in plain
    // document flow, in DOM order (banner, nav, main, aside, footer) — NOT the named 3-row/3-col grid AC5
    // proves above. `getComputedStyle(host).display` is provably NOT 'grid' — the one fact the real mirror's
    // `:host{display:grid…}` line supplies — and every region spans the FULL host width (no nav/aside COLUMN
    // split at all, since the grid-area assignments never had a grid to resolve against). This is exactly
    // the broken shape AC5's own negative control names ("regions land un-placed").
    expect(getComputedStyle(host).display).not.toBe('grid')
    const hostWidth = host.getBoundingClientRect().width
    const rects = [banner, nav, main, aside, footer].map((el) => el.getBoundingClientRect())
    for (const r of rects) expect(r.width).toBeCloseTo(hostWidth, 0) // no column split — every region is full-width
    for (let i = 1; i < rects.length; i++) {
      expect(rects[i - 1].bottom, 'regions did not stack in plain DOM order').toBeLessThanOrEqual(rects[i].top + 0.5)
    }
  })
})
