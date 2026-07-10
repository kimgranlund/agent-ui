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
