import { describe, it, expect, afterEach } from 'vitest'

// theme-provider.browser.test.ts — the CROSS-ENGINE browser smoke for ui-theme-provider (LLD-C7, SPEC-R3
// AC1/AC2/AC4). jsdom cannot resolve `light-dark()`/inherited `color-scheme` at all (theme-provider.test.ts's
// own file banner) — this is the ONLY place SPEC-R3's actual per-subtree token resolution and the
// nested-unset ancestor-inherit fix can be proven. Runs in BOTH Chromium and WebKit
// (vitest.browser.config.ts's two playwright instances).
//
// CSS wiring: the load-bearing cascade (ADR-0003) — foundation FIRST (tokens.css's light-dark() roles +
// dimensions.css), then this control's own sheet, then the self-defining module. A plain child `<div>`
// reading a `--md-sys-color-neutral-surface` role directly is the proof vehicle (no need for a full
// control) — the ANCESTOR-INHERIT leg (SPEC-R3 AC4) additionally needs a REAL nested-provider composition,
// which this file builds directly.
//
// Root-scheme pinning (the gallery.browser.test.ts precedent): the OS/browser `prefers-color-scheme`
// preference is an environment variable this suite must not depend on — every "ambient" assertion below
// EXPLICITLY sets `document.documentElement.style.colorScheme` to a known value first (save/restore), so
// "unset inherits the ambient" is proven against a PINNED ambient, in both directions, never an accident of
// the CI runner's default.
import '@agent-ui/components/foundation-styles.css'
import './theme-provider.css'
import './theme-provider.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

/** A plain child reading the neutral-surface role directly — the SAME token every scheme-sensitive
 *  specimen ultimately resolves. */
function surfaceProbe(): HTMLElement {
  const probe = document.createElement('div')
  probe.style.cssText = 'background: var(--md-sys-color-neutral-surface); inline-size: 10px; block-size: 10px;'
  return probe
}

function mount(markup: string): HTMLElement {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap
}

/** Pin the document root's `color-scheme` to a KNOWN value for the duration of `fn`, then restore —
 *  decouples "ambient" assertions from the runner's real OS/browser `prefers-color-scheme`. */
function withRootScheme<T>(scheme: 'light' | 'dark', fn: () => T): T {
  const root = document.documentElement
  const prior = root.style.colorScheme
  root.style.colorScheme = scheme
  try {
    return fn()
  } finally {
    root.style.colorScheme = prior
  }
}

describe('ui-theme-provider — the scheme→color-scheme mapping resolves REAL light-dark() tokens (SPEC-R3 AC1/AC2)', () => {
  it('a dark provider and a light provider resolve GENUINELY DIFFERENT surface colours for the same role', () => {
    const dark = document.createElement('ui-theme-provider')
    dark.setAttribute('scheme', 'dark')
    dark.append(surfaceProbe())
    const light = document.createElement('ui-theme-provider')
    light.setAttribute('scheme', 'light')
    light.append(surfaceProbe())

    const wrap = document.createElement('div')
    wrap.append(dark, light)
    document.body.append(wrap)
    mounted.push(wrap)

    const darkColor = getComputedStyle(dark.firstElementChild as HTMLElement).backgroundColor
    const lightColor = getComputedStyle(light.firstElementChild as HTMLElement).backgroundColor
    expect(darkColor, 'dark and light providers resolved the SAME surface colour — light-dark() did not engage').not.toBe(lightColor)
  })
})

describe('ui-theme-provider — unset inherits the PINNED ambient scheme in BOTH directions, never defaults to light (SPEC-R3 AC3)', () => {
  it('under a light-pinned root: unset matches an explicit scheme="light" sibling', () => {
    withRootScheme('light', () => {
      const unset = document.createElement('ui-theme-provider')
      unset.append(surfaceProbe())
      const explicitLight = document.createElement('ui-theme-provider')
      explicitLight.setAttribute('scheme', 'light')
      explicitLight.append(surfaceProbe())
      const wrap = document.createElement('div')
      wrap.append(unset, explicitLight)
      document.body.append(wrap)
      mounted.push(wrap)

      expect(unset.style.colorScheme, 'an unset provider must carry no inline color-scheme override').toBe('')
      const unsetColor = getComputedStyle(unset.firstElementChild as HTMLElement).backgroundColor
      const lightColor = getComputedStyle(explicitLight.firstElementChild as HTMLElement).backgroundColor
      expect(unsetColor).toBe(lightColor)
    })
  })

  it('under a DARK-pinned root: unset tracks dark (never coerces to light regardless of ambient) — the load-bearing fix, proven bidirectionally', () => {
    withRootScheme('dark', () => {
      const unset = document.createElement('ui-theme-provider')
      unset.append(surfaceProbe())
      const explicitDark = document.createElement('ui-theme-provider')
      explicitDark.setAttribute('scheme', 'dark')
      explicitDark.append(surfaceProbe())
      const explicitLight = document.createElement('ui-theme-provider') // the anti-vacuous foil
      explicitLight.setAttribute('scheme', 'light')
      explicitLight.append(surfaceProbe())
      const wrap = document.createElement('div')
      wrap.append(unset, explicitDark, explicitLight)
      document.body.append(wrap)
      mounted.push(wrap)

      expect(unset.style.colorScheme).toBe('')
      const unsetColor = getComputedStyle(unset.firstElementChild as HTMLElement).backgroundColor
      const darkColor = getComputedStyle(explicitDark.firstElementChild as HTMLElement).backgroundColor
      const lightColor = getComputedStyle(explicitLight.firstElementChild as HTMLElement).backgroundColor
      expect(unsetColor, 'unset did not track the dark-pinned ambient').toBe(darkColor)
      expect(unsetColor, 'unset must NOT have silently defaulted to light under a dark ambient').not.toBe(lightColor)
    })
  })
})

describe('ui-theme-provider — nested-unset inherits the ANCESTOR provider\'s scheme (SPEC-R3 AC4, the promotion\'s correctness case)', () => {
  it('an unset provider nested inside a scheme="dark" ancestor resolves DARK tokens, not the (pinned-light) page default', () => {
    withRootScheme('light', () => {
      const wrap = mount(
        `<ui-theme-provider scheme="dark">
          <div id="outer-probe" style="background: var(--md-sys-color-neutral-surface); inline-size: 10px; block-size: 10px;"></div>
          <ui-theme-provider>
            <div id="inner-probe" style="background: var(--md-sys-color-neutral-surface); inline-size: 10px; block-size: 10px;"></div>
          </ui-theme-provider>
        </ui-theme-provider>`,
      )
      const outerProbe = wrap.querySelector('#outer-probe') as HTMLElement
      const innerProbe = wrap.querySelector('#inner-probe') as HTMLElement
      const nestedProvider = wrap.querySelector('ui-theme-provider ui-theme-provider') as HTMLElement
      expect(nestedProvider.style.colorScheme, 'the nested provider must be genuinely unset, imposing no override of its own').toBe('')

      const outerColor = getComputedStyle(outerProbe).backgroundColor
      const innerColor = getComputedStyle(innerProbe).backgroundColor
      // The nested provider's own subtree resolves the SAME (dark) colour as its ancestor's directly-owned
      // content — proving inheritance carried the scheme through the nested-but-unset provider, not the
      // site-local predecessor's bug (which would have forced the inner subtree back to light).
      expect(innerColor, 'the nested unset provider did not inherit its ancestor\'s dark scheme').toBe(outerColor)

      // Anti-vacuous, against a KNOWN (pinned light) baseline — never an accident of the runner's own
      // OS/browser colour-scheme preference.
      const bareProbe = surfaceProbe()
      document.body.append(bareProbe)
      mounted.push(bareProbe)
      const bareColor = getComputedStyle(bareProbe).backgroundColor
      expect(innerColor, 'the nested-dark reading must genuinely differ from the pinned-light page default').not.toBe(bareColor)
    })
  })
})

// ── the scheme-boundary INK RE-ROOT (ADR-0148 — the fold-in of the gallery-local TKT-0002-class fix) ──────
// `color-scheme` re-rooting alone does NOT re-resolve an INHERITED `color`: light-dark() only re-resolves
// where a property containing it is DECLARED, so page-level ink (the `_page.css` body rule) computed once
// at the outer scheme leaks into a forced subtree as the wrong channel values — white bare text on a light
// surface (issue #31). theme-provider.css's `:where(ui-theme-provider) { color: … }` re-declares the ink AT
// the boundary. These are the bite legs whose absence deferred the fold-in (ADR-0117 LLD §5.3): red without
// the component-owned rule, green with it — plus the zero-specificity guarantee that keeps consumers in charge.
describe('ui-theme-provider — inherited ink re-resolves at the scheme boundary (ADR-0148, the issue #31 defect class)', () => {
  /** The `_page.css` body shape: an ancestor OUTSIDE any provider declaring the fleet ink role. */
  function pageInkWrap(providerScheme: 'light' | 'dark'): HTMLElement {
    return mount(
      `<div style="color: var(--md-sys-color-neutral-on-surface);">
        <span id="outside-text">outside the boundary</span>
        <ui-theme-provider scheme="${providerScheme}">bare text — never declares color<span id="explicit-probe" style="color: var(--md-sys-color-neutral-on-surface);">explicit</span></ui-theme-provider>
      </div>`,
    )
  }

  it('light-in-dark: bare text under a scheme="light" provider shows the LIGHT-resolved ink, never the inherited dark-scheme ink', () => {
    withRootScheme('dark', () => {
      const wrap = pageInkWrap('light')
      const provider = wrap.querySelector('ui-theme-provider') as HTMLElement
      const outsideInk = getComputedStyle(wrap.querySelector('#outside-text') as HTMLElement).color
      const explicitInk = getComputedStyle(wrap.querySelector('#explicit-probe') as HTMLElement).color
      const bareInk = getComputedStyle(provider).color // the ink every bare text node under the provider paints with
      // The explicit probe re-resolves by declaration (the mechanism that always worked); bare text must now match it…
      expect(bareInk, 'bare text kept the dark-root ink across the light boundary — the re-root is not engaging').toBe(explicitInk)
      // …and genuinely differ from the leaked outer resolution (anti-vacuous: proves the two schemes diverge here).
      expect(bareInk, 'inside and outside resolved identically — the boundary case never materialized').not.toBe(outsideInk)
    })
  })

  it('dark-in-light: the inverse boundary re-resolves too (bidirectional, the gallery precedent)', () => {
    withRootScheme('light', () => {
      const wrap = pageInkWrap('dark')
      const provider = wrap.querySelector('ui-theme-provider') as HTMLElement
      const outsideInk = getComputedStyle(wrap.querySelector('#outside-text') as HTMLElement).color
      const explicitInk = getComputedStyle(wrap.querySelector('#explicit-probe') as HTMLElement).color
      const bareInk = getComputedStyle(provider).color
      expect(bareInk, 'bare text kept the light-root ink across the dark boundary').toBe(explicitInk)
      expect(bareInk, 'inside and outside resolved identically — the boundary case never materialized').not.toBe(outsideInk)
    })
  })

  it('zero-specificity guarantee: ANY consumer ink declaration outranks the re-root (the rule must never move into @scope — the TKT-0001 proximity trap)', () => {
    withRootScheme('dark', () => {
      const style = document.createElement('style')
      style.textContent = '.consumer-ink { color: rgb(255, 0, 0); }'
      document.head.append(style)
      mounted.push(style)
      const wrap = mount('<ui-theme-provider scheme="light" class="consumer-ink">bare text</ui-theme-provider>')
      const provider = wrap.querySelector('ui-theme-provider') as HTMLElement
      expect(getComputedStyle(provider).color, 'a consumer class-selector ink lost to the component rule — the re-root has gained specificity').toBe('rgb(255, 0, 0)')
    })
  })
})
