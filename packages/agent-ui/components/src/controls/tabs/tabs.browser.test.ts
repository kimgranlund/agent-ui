import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'
import { UITabsElement } from './tabs.ts'
import { UITabElement } from './tab.ts'
import { UITabPanelElement } from './tab-panel.ts'

// G9 s8 — the CROSS-ENGINE smoke for the tabs compound (decomp g9-containers s8). Where the jsdom probes pin the
// DECLARED rules, this pins what a REAL engine does: keyboard roving moves real focus + switches the visible
// panel; the :state(selected) indicator actually paints (and survives forced-colors); and the ARIA element-
// reflection (aria-controls/aria-labelledby — `ariaControlsElements`/`ariaLabelledByElements`, which jsdom
// lacks) is live. Runs in BOTH Chromium and WebKit (vitest.browser.config.ts → the two playwright instances).
//
// Side-effect CSS imports — the load-bearing order (ADR-0003): foundation roles + ramp FIRST, then the SHARED
// container surface seam, then this component sheet. (The component-styles barrel does NOT yet @import tabs.css
// — that is decomp s12 / integration — so this suite imports the two sheets directly, pre-barrel.) GH #586 —
// `tabs.ts` composes `ui-menu` as the overflow part (a real value import, self-registers `ui-menu`), so this
// suite ALSO needs `ui-menu`'s own sheet (its `display:contents` host rule — load-bearing for the trigger
// button's grid-item promotion, the menu.browser.test.ts precedent) + its `[data-box]` box-model dependency.
import '@agent-ui/components/foundation-styles.css'
import '../_surface/container.css'
import '../_surface/container-box.css'
import '../menu/menu.css'
import './tabs.css'

const mounted: HTMLElement[] = []
const mount = (markup: string): { wrap: HTMLElement; tabs: UITabsElement; tabEls: UITabElement[]; panelEls: UITabPanelElement[] } => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap) // connect → ui-tabs reparents the tabs into the strip + wires + applies selection
  mounted.push(wrap)
  const tabs = wrap.querySelector('ui-tabs') as UITabsElement
  const tabEls = [...wrap.querySelectorAll('ui-tab')] as UITabElement[]
  const panelEls = [...wrap.querySelectorAll('ui-tab-panel')] as UITabPanelElement[]
  return { wrap, tabs, tabEls, panelEls }
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const THREE = `
  <ui-tabs>
    <ui-tab>One</ui-tab><ui-tab>Two</ui-tab><ui-tab>Three</ui-tab>
    <ui-tab-panel>P1</ui-tab-panel><ui-tab-panel>P2</ui-tab-panel><ui-tab-panel>P3</ui-tab-panel>
  </ui-tabs>`

const px = (v: string): number => Number.parseFloat(v)

/** Let a ResizeObserver learn a real post-change size (the select.browser.test.ts `nextFrames` precedent —
 *  two rAFs comfortably clears the RO's own per-spec "after rendering updates" timing). */
const nextFrames = (n = 2): Promise<void> =>
  Array.from({ length: n }).reduce<Promise<void>>(
    (p) => p.then(() => new Promise((r) => requestAnimationFrame(() => r()))),
    Promise.resolve(),
  )

/** Alpha of a computed colour — 0 ⇒ the paint is transparent / has vanished. */
const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] Keyboard roving — ArrowRight moves REAL focus + switches the visible panel (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-tabs — keyboard roving moves focus + switches the visible panel (both engines)', () => {
  it('ArrowRight roves focus to the next tab and shows its panel; ArrowLeft/Home/End too', async () => {
    const { tabs, tabEls, panelEls } = mount(THREE)
    // C6 geometry — the tab rows resolve to a REAL MEASURED control height in a live engine, not a silent
    // 0-collapse if the token chain broke (e.g. a dropped token block — the `*/`-in-comment class of bug the
    // css-text regex cannot see). Anti-vacuous: it equals the --md-sys-height-lg ramp step (36px @ scale 1, GH
    // #297), not merely >0 — so a broken --ui-tabs-tab-height → --md-sys-height-lg chain fails HERE, where
    // jsdom/css-text can't.
    const rowHeight = Number.parseFloat(getComputedStyle(tabEls[0]).blockSize)
    expect(rowHeight, 'the tab row collapsed — the --ui-tabs-tab-height → --md-sys-height-lg chain did not resolve').toBeGreaterThan(0)
    expect(rowHeight, 'the tab row height is not the --md-sys-height-lg ramp step (36px @ scale 1, GH #297)').toBeCloseTo(36, 0)

    // baseline: tab 0 selected → its panel shows, the others are display:none (the [hidden] author rule).
    expect(getComputedStyle(panelEls[0]).display, 'panel 0 not shown at baseline').toBe('block')
    expect(getComputedStyle(panelEls[1]).display, 'panel 1 not hidden at baseline').toBe('none')

    await userEvent.click(tabEls[0]) // focus the strip on tab 0
    expect(document.activeElement, 'click did not focus tab 0').toBe(tabEls[0])

    await userEvent.keyboard('{ArrowRight}')
    await tabs.updateComplete
    expect(document.activeElement, 'ArrowRight did not rove focus to tab 1').toBe(tabEls[1]) // roving focus
    expect(tabEls[1].tabIndex, 'tab 1 not in the tab order').toBe(0)
    expect(tabEls[0].tabIndex, 'tab 0 still in the tab order').toBe(-1)
    expect(getComputedStyle(panelEls[1]).display, 'panel 1 did not show').toBe('block') // the visible panel switched
    expect(getComputedStyle(panelEls[0]).display, 'panel 0 did not hide').toBe('none')

    await userEvent.keyboard('{End}')
    await tabs.updateComplete
    expect(document.activeElement, 'End did not rove to the last tab').toBe(tabEls[2])
    expect(getComputedStyle(panelEls[2]).display).toBe('block')

    await userEvent.keyboard('{ArrowRight}') // wraps last → first
    await tabs.updateComplete
    expect(document.activeElement, 'ArrowRight did not wrap to the first tab').toBe(tabEls[0])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] The :state(selected) indicator actually PAINTS (both engines) + survives forced-colors (Chromium)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-tabs — the selected-tab indicator paints + survives forced-colors', () => {
  it('only the selected tab paints the ::after indicator; it survives forced-colors', async () => {
    const { tabs, tabEls } = mount(THREE)

    // baseline (BOTH engines): tab 0 (selected) paints an opaque indicator; tab 1 (unselected) does not.
    const selectedBar = (): string => getComputedStyle(tabEls[0], '::after').backgroundColor
    const unselectedBar = (): string => getComputedStyle(tabEls[1], '::after').backgroundColor
    expect(alphaOf(selectedBar()), 'the selected-tab indicator did not paint').toBeGreaterThan(0)
    expect(alphaOf(unselectedBar()), 'an unselected tab painted an indicator').toBe(0)

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP forced-colors emulation (the documented engine split) — assert we are genuinely
      // NOT in forced-colors (so the Chromium proof is not silently faked) and stop at the baseline.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'the engine did not enter forced-colors').toBe(true)
      // the indicator survives — the @media (forced-colors) block repaints it to Highlight (a system colour).
      expect(alphaOf(selectedBar()), 'the selected indicator vanished under forced-colors').toBeGreaterThan(0)
      await tabs.updateComplete
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] }) // reset
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] [density] — strip-gap + panel-pad SHIFT; the tab CONTROL HEIGHT HOLDS (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-tabs — [density] shifts shell spacing; the tab control height is density-invariant (both engines)', () => {
  it('[density] strip-gap + panel-pad SHIFT (--md-sys-space-driven); the tab block-size (--md-sys-height) HOLDS', () => {
    // tabs.css: --ui-tabs-strip-gap rides --md-sys-space-xs + --md-sys-space-md (GH #536 — carries the spacing
    // the removed per-tab inline padding used to); --ui-tabs-panel-pad rides --md-sys-space-md.
    // Both are shell/layout-ladder quantities (density-responsive). The tab CONTROL HEIGHT is --md-sys-height-lg
    // (36px explicit literal, ADR-0038, GH #297 — not a --md-sys-space quantity, density-invariant). Anti-vacuous: strip-gap
    // and panel-pad must measurably CHANGE, AND the tab height must be the same at compact and spacious.
    const { tabs, tabEls, panelEls } = mount(THREE)
    const tablist = tabs.querySelector('[data-part="tablist"]') as HTMLElement
    const panel = panelEls[0] // the visible panel (tab 0 selected by default)

    // comfortable (no [density] attr = --md-sys-density 1): the baseline shell spacing + control height
    const stripGapBase = px(getComputedStyle(tablist).columnGap)
    const panelPadBase = px(getComputedStyle(panel).paddingTop)
    const tabHeightBase = px(getComputedStyle(tabEls[0]).blockSize)
    expect(stripGapBase, 'comfortable strip-gap is not a positive px').toBeGreaterThan(0)
    expect(panelPadBase, 'comfortable panel-pad is not a positive px').toBeGreaterThan(0)
    expect(tabHeightBase, 'comfortable tab height is not 36px (GH #297)').toBeCloseTo(36, 0)

    // compact (density 0.5) — shell spacing halves; control height HOLDS
    tabs.setAttribute('density', 'compact')
    const stripGapCompact = px(getComputedStyle(tablist).columnGap)
    const panelPadCompact = px(getComputedStyle(panel).paddingTop)
    const tabHeightCompact = px(getComputedStyle(tabEls[0]).blockSize)
    expect(stripGapCompact, 'compact strip-gap did not shrink from comfortable').toBeCloseTo(stripGapBase / 2, 1)
    expect(panelPadCompact, 'compact panel-pad did not shrink from comfortable').toBeCloseTo(panelPadBase / 2, 1)
    expect(tabHeightCompact, `${server.browser}: tab height changed at compact (control height must be density-invariant)`).toBeCloseTo(tabHeightBase, 0)

    // spacious (density 1.5) — shell spacing grows; control height HOLDS
    tabs.setAttribute('density', 'spacious')
    const stripGapSpacious = px(getComputedStyle(tablist).columnGap)
    const panelPadSpacious = px(getComputedStyle(panel).paddingTop)
    const tabHeightSpacious = px(getComputedStyle(tabEls[0]).blockSize)
    expect(stripGapSpacious, 'spacious strip-gap did not grow from comfortable').toBeCloseTo(stripGapBase * 1.5, 1)
    expect(panelPadSpacious, 'spacious panel-pad did not grow from comfortable').toBeCloseTo(panelPadBase * 1.5, 1)
    expect(tabHeightSpacious, `${server.browser}: tab height changed at spacious (control height must be density-invariant)`).toBeCloseTo(tabHeightBase, 0)

    // anti-vacuity: shell spacing change is measurably nonzero (compact < spacious)
    expect(stripGapCompact, 'strip-gap is the same at compact and spacious (density has no effect)').toBeLessThan(stripGapSpacious)
    expect(panelPadCompact, 'panel-pad is the same at compact and spacious (density has no effect)').toBeLessThan(panelPadSpacious)
    // anti-vacuity: the tab height invariant is a real value (36px, GH #297), not vacuously zero
    expect(tabHeightCompact, 'tab height is 0 (control-height invariant is vacuous)').toBeGreaterThan(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [3b] GH #542 — the strip-gap RESOLVED VALUE pins the exact calc(space-xs + space-md); a tab carries
//  zero padding-inline (GH #536's removal, both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-tabs — strip-gap resolves the exact calc(space-xs + space-md); a tab has zero padding-inline (GH #542, both engines)', () => {
  it('at density 1 the tablist column-gap/gap is 16px (space-xs 4px + space-md 12px); a rendered tab is padding-inline:0px', () => {
    const { tabs, tabEls } = mount(THREE)
    const tablist = tabs.querySelector('[data-part="tablist"]') as HTMLElement

    // --ui-tabs-strip-gap: calc(var(--md-sys-space-xs) + var(--md-sys-space-md)) (tabs.css). The space tokens
    // themselves (shared/src/tokens/dimensions.css): --md-sys-space-xs: calc(4px * density),
    // --md-sys-space-md: calc(12px * density) — at density 1 (no [density] attr on the mount) that's
    // 4px + 12px = 16px EXACTLY. GH #536 grew the strip gap to carry the spacing the removed per-tab inline
    // padding used to provide; GH #542 pins the concrete resolved px (not merely >0) so a future ramp/space-
    // token edit that silently shifts the sum away from 16px fails HERE, in a real engine's cascade — the
    // same discipline the 36px tab-height probe above applies to the control-height ramp.
    const gapPx = px(getComputedStyle(tablist).columnGap)
    expect(gapPx, 'the tablist column-gap did not resolve to 16px at density 1 (space-xs 4px + space-md 12px)').toBeCloseTo(16, 0)
    expect(px(getComputedStyle(tablist).gap), 'gap and column-gap disagree on the resolved value').toBeCloseTo(16, 0)

    // GH #536 — the per-tab inline padding was removed (a tab's clickable area is now its label box; the strip
    // gap above carries the spacing that padding used to). Pin the negative directly: a rendered tab's own
    // computed padding-inline-start/-end must both be the literal 0px, not merely falsy/absent.
    const tabStyle = getComputedStyle(tabEls[0])
    expect(tabStyle.paddingInlineStart, 'a tab must carry zero padding-inline-start (GH #536)').toBe('0px')
    expect(tabStyle.paddingInlineEnd, 'a tab must carry zero padding-inline-end (GH #536)').toBe('0px')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [4] The ARIA wiring is live in a real engine — roles via internals + the element-reflection relations
// ════════════════════════════════════════════════════════════════════════════════════════════════════

// Probe subclasses re-expose the protected internals so the test can read the role + the aria-controls/
// labelledby element-reflection (a real-engine-only API — jsdom has neither). The parent recognises them by
// instanceof, so the probes nest like the real elements. (No CSS assertions here — the probe tags are not
// styled by tabs.css, which is fine: this leg proves the AX wiring, not the paint.)
class ProbeTabs extends UITabsElement {
  get ii(): ElementInternals {
    return this.internals
  }
}
class ProbeTab extends UITabElement {
  get ii(): ElementInternals {
    return this.internals
  }
}
class ProbeTabPanel extends UITabPanelElement {
  get ii(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-tabs-axprobe', ProbeTabs)
customElements.define('ui-tab-axprobe', ProbeTab)
customElements.define('ui-tab-panel-axprobe', ProbeTabPanel)

describe('ui-tabs — ARIA wiring via internals (roles + the element-reflection relations) (both engines)', () => {
  it('roles ride internals; aria-selected tracks selection; aria-controls/labelledby link tab↔panel', async () => {
    const tabs = new ProbeTabs()
    const tabA = new ProbeTab()
    const tabB = new ProbeTab()
    const panelA = new ProbeTabPanel()
    const panelB = new ProbeTabPanel()
    tabA.textContent = 'A'
    tabB.textContent = 'B'
    tabs.append(tabA, tabB, panelA, panelB)
    document.body.append(tabs)
    mounted.push(tabs)

    // roles via internals (drive the AX tree) — never a host role attribute.
    const strip = tabs.querySelector('[data-part="tablist"]') as HTMLElement
    expect(strip.getAttribute('role')).toBe('tablist')
    expect(tabA.ii.role).toBe('tab')
    expect(panelA.ii.role).toBe('tabpanel')
    expect(tabs.getAttribute('role')).toBeNull()
    expect(tabA.getAttribute('role')).toBeNull()

    // selection: the active tab carries aria-selected=true via internals.
    expect(tabA.ii.ariaSelected).toBe('true')
    expect(tabB.ii.ariaSelected).toBe('false')

    // the element-reflection relations — present in modern Chromium/WebKit. Feature-detected so the suite cannot
    // falsely fail on an engine without it; both target engines DO support it (the meaningful browser-only proof).
    const i = tabA.ii as unknown as { ariaControlsElements?: readonly Element[] }
    if ('ariaControlsElements' in tabA.ii) {
      expect(i.ariaControlsElements?.[0], 'tab.aria-controls did not point at its panel').toBe(panelA)
      const p = panelA.ii as unknown as { ariaLabelledByElements?: readonly Element[] }
      expect(p.ariaLabelledByElements?.[0], 'panel.aria-labelledby did not point at its tab').toBe(tabA)
    } else {
      // a stale engine: at minimum prove the wiring path ran (ids seeded) so the relation is not silently absent.
      expect(tabA.id.length, 'no fallback id seeded for the tab').toBeGreaterThan(0)
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [5] `fill` (ADR-0144 Q1) — the whole composed shape: a bounded parent, a pinned strip, a scrolling panel
// ════════════════════════════════════════════════════════════════════════════════════════════════════

const LONG_PANEL = Array.from({ length: 30 }, (_, i) => `<p>Paragraph ${i}</p>`).join('')

// The agent-admin shell shape (TKT-0085): a fixed-height flex column ancestor, `<ui-tabs fill>` as its sole
// flexed child. One long (overflowing) panel + one short one, so switching between them re-engages scroll.
const fillMarkup = (): string => `
  <div style="display:flex; flex-direction:column; block-size:220px;">
    <ui-tabs fill>
      <ui-tab>One</ui-tab><ui-tab>Two</ui-tab>
      <ui-tab-panel>${LONG_PANEL}</ui-tab-panel>
      <ui-tab-panel>Short</ui-tab-panel>
    </ui-tabs>
  </div>`

describe('ui-tabs — `fill`: NEGATIVE control — a fill-less tabs stays byte-identical to today (both engines)', () => {
  it('no flex/block-size/overflow rule applies without the attribute', () => {
    const { tabs, panelEls } = mount(THREE)
    expect(getComputedStyle(tabs).display, 'a fill-less ui-tabs must stay display:block').toBe('block')
    expect(getComputedStyle(panelEls[0]).overflowY, 'a fill-less panel must not gain overflow-y:auto').toBe('visible')
  })
})

describe('ui-tabs — `fill`: the whole composed shape — fills the bounded parent, strip pinned, panel scrolls (both engines)', () => {
  it('[MUST-PROVE] the shell fills its parent; the strip stays pinned while the active panel scrolls; hidden panels stay display:none; re-selection re-engages scroll', async () => {
    const wrap = document.createElement('div')
    wrap.innerHTML = fillMarkup()
    document.body.append(wrap)
    mounted.push(wrap)

    const boundedParent = wrap.firstElementChild as HTMLElement
    const tabs = wrap.querySelector('ui-tabs') as UITabsElement
    const tabEls = [...wrap.querySelectorAll('ui-tab')] as UITabElement[]
    const panelEls = [...wrap.querySelectorAll('ui-tab-panel')] as UITabPanelElement[]
    const strip = tabs.querySelector('[data-part="tablist"]') as HTMLElement
    const panel = panelEls[0]

    expect(getComputedStyle(tabs).display, `${server.browser}: [fill] did not switch the shell to flex`).toBe('flex')
    // the whole shape genuinely fills the bounded parent — no overflow leak past the host.
    expect(tabs.getBoundingClientRect().height, `${server.browser}: the fill shell did not fill its bounded parent`).toBeCloseTo(
      boundedParent.getBoundingClientRect().height,
      0,
    )

    expect(panel.scrollHeight, 'vacuous test setup — the panel did not overflow').toBeGreaterThan(panel.clientHeight)
    expect(getComputedStyle(panelEls[1]).display, 'a non-selected panel must stay display:none under fill').toBe('none')

    // the strip rect is IDENTICAL before vs after scrolling the panel — it is pinned, not scrolled away with it.
    const stripBefore = strip.getBoundingClientRect()
    panel.scrollTop = 60
    expect(panel.scrollTop, 'the panel did not actually scroll').toBeGreaterThan(0)
    const stripAfter = strip.getBoundingClientRect()
    expect(stripAfter.top, `${server.browser}: the tablist strip moved when the panel scrolled — it is not pinned`).toBeCloseTo(stripBefore.top, 0)
    expect(stripAfter.height).toBeCloseTo(stripBefore.height, 0)

    // switch to the short panel, then back — the long panel's scroll re-engages (a fresh overflow, not a stale flag).
    await userEvent.click(tabEls[1])
    await tabs.updateComplete
    expect(panelEls[1].hidden, 'the short panel did not become visible').toBe(false)
    await userEvent.click(tabEls[0])
    await tabs.updateComplete
    expect(panel.hidden, 'the long panel did not become visible again').toBe(false)
    expect(panel.scrollHeight, 'the long panel lost its overflow after re-selection').toBeGreaterThan(panel.clientHeight)
  })
})

describe('ui-tabs — `fill` panel scrollbar seam — consumer-INHERITED, var()-fallback only (ADR-0144 Q1 cl.3, both engines)', () => {
  it('an ancestor hides the filled panel scrollbar via --ui-tabs-panel-scrollbar-width; scrollTop still moves', () => {
    const wrap = document.createElement('div')
    wrap.style.setProperty('--ui-tabs-panel-scrollbar-width', 'none') // set on an ANCESTOR — inherits down to the panel
    wrap.innerHTML = fillMarkup()
    document.body.append(wrap)
    mounted.push(wrap)

    const panel = wrap.querySelector('ui-tab-panel') as HTMLElement
    const cs = getComputedStyle(panel) as CSSStyleDeclaration & { scrollbarWidth?: string }
    expect(cs.scrollbarWidth, `${server.browser}: the inherited seam did not hide the scrollbar`).toBe('none')
    panel.scrollTop = 30
    expect(panel.scrollTop, 'scrolling stopped working once the scrollbar was hidden').toBeGreaterThan(0)
  })
})

describe('ui-tabs — `fill` panel keyboard scroll — MEASURED, not assumed (ADR-0144 Q1 cl.4, both engines)', () => {
  it('[MUST-PROVE] a focused filled panel is keyboard-scrollable on every shipped engine (card-content.ts precedent)', async () => {
    const wrap = document.createElement('div')
    wrap.innerHTML = fillMarkup()
    document.body.append(wrap)
    mounted.push(wrap)

    const panel = wrap.querySelector('ui-tab-panel') as HTMLElement
    expect(panel.scrollHeight, 'vacuous test setup — the panel did not overflow').toBeGreaterThan(panel.clientHeight)

    // A genuine, trusted click establishes focus (the card-content.ts measurement: a bare `.focus()` call was
    // NOT sufficient on every engine; a real click is also the representative real-world path).
    await userEvent.click(panel)
    expect(document.activeElement, `${server.browser}: the panel did not take focus`).toBe(panel)

    await userEvent.keyboard('{ArrowDown}')
    expect(panel.scrollTop, `${server.browser}: ArrowDown did not move exactly one line (40px)`).toBeCloseTo(40, 0)
    await userEvent.keyboard('{ArrowDown}')
    expect(panel.scrollTop, `${server.browser}: a second ArrowDown did not add another line`).toBeCloseTo(80, 0)
    await userEvent.keyboard('{ArrowUp}')
    expect(panel.scrollTop, `${server.browser}: ArrowUp did not move back exactly one line`).toBeCloseTo(40, 0)

    await userEvent.keyboard('{PageDown}')
    // ±1px tolerance (numDigits -1, precision 5) — sub-pixel clientHeight fuzz measured on WebKit.
    expect(panel.scrollTop, `${server.browser}: PageDown did not move ~90% of the viewport`).toBeCloseTo(40 + panel.clientHeight * 0.9, -1)

    await userEvent.keyboard('{End}')
    expect(panel.scrollTop, `${server.browser}: End did not reach the bottom`).toBeCloseTo(panel.scrollHeight - panel.clientHeight, 0)
    await userEvent.keyboard('{Home}')
    expect(panel.scrollTop, `${server.browser}: Home did not return to the top`).toBe(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [6] GH #221 — the tablist part is the control's own horizontal overflow viewport (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-tabs — tablist overflow: whole labels scroll, never clip mid-word (GH #221, both engines)', () => {
  const NARROW = `
    <div style="inline-size: 252px">
      <ui-tabs>
        <ui-tab>Settings</ui-tab><ui-tab>Context: System</ui-tab><ui-tab>Context: Dialog</ui-tab>
      </ui-tabs>
    </div>` // ui-super-shell's 14-module pane width — the composition that surfaced the defect

  it('at 252px the strip overflows and SCROLLS; every tab still holds its whole nowrap label', () => {
    const { tabs, tabEls } = mount(NARROW)
    const strip = tabs.querySelector('[data-part="tablist"]') as HTMLElement
    expect(getComputedStyle(strip).overflowX, `${server.browser}: the tablist is not a scroll viewport`).toBe('auto')
    // the three whole labels genuinely outgrow the 252px host — lawful overflow, reachable by scroll
    expect(strip.scrollWidth, `${server.browser}: the row should outgrow 252px`).toBeGreaterThan(strip.clientWidth + 1)
    strip.scrollLeft = 40
    expect(strip.scrollLeft, `${server.browser}: the strip did not actually scroll`).toBeGreaterThan(0)
    strip.scrollLeft = 0
    // un-clipped: each tab's own box holds its full label (no internal text overflow = no mid-word cut)
    for (const t of tabEls) {
      expect(t.scrollWidth, `${server.browser}: "${t.textContent}" clips inside its own box`).toBeLessThanOrEqual(t.clientWidth + 1)
    }
  })

  it('the scrollbar-visibility seam is consumer-INHERITED (var()-fallback, the [fill] panel-seam shape)', () => {
    const { wrap, tabs } = mount(NARROW)
    const strip = tabs.querySelector('[data-part="tablist"]') as HTMLElement
    expect(getComputedStyle(strip).scrollbarWidth, `${server.browser}: the bare-control default must keep the UA bar`).toBe('auto')
    wrap.style.setProperty('--ui-tabs-strip-scrollbar-width', 'none') // a composing shell's repoint
    expect(getComputedStyle(strip).scrollbarWidth, `${server.browser}: the inherited repoint did not reach the tablist`).toBe('none')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [7] GH #581 — orientation="vertical" (Slice A): whole-shape geometry, keyboard axis, edges, RTL
//  (`.claude/docs/lld/tabs-vertical-overflow.lld.md` §3, §7 `vertical · scroll` + `fill × vertical` corners)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

const VERTICAL = `
  <ui-tabs orientation="vertical">
    <ui-tab>One</ui-tab><ui-tab>Two</ui-tab><ui-tab>Three</ui-tab>
    <ui-tab-panel>P1</ui-tab-panel><ui-tab-panel>P2</ui-tab-panel><ui-tab-panel>P3</ui-tab-panel>
  </ui-tabs>`

describe('ui-tabs — orientation="vertical": the default stays byte-identical (NEGATIVE control, both engines)', () => {
  it('a default (no orientation attribute) ui-tabs has no aria-orientation, no shell flex/row, and the #542/#543 horizontal probes are untouched', () => {
    const { tabs, tabEls } = mount(THREE)
    const strip = tabs.querySelector('[data-part="tablist"]') as HTMLElement
    expect(strip.hasAttribute('aria-orientation'), `${server.browser}: a default tabs must carry no aria-orientation`).toBe(false)
    expect(getComputedStyle(tabs).display, `${server.browser}: a default ui-tabs must stay display:block`).toBe('block')
    expect(getComputedStyle(strip).flexDirection, `${server.browser}: the default strip must stay flex-direction:row`).toBe('row')
    expect(getComputedStyle(tabEls[0]).justifyContent, `${server.browser}: the default label alignment must stay centered`).toBe('center')
    // GH #542/#543 pins, unmodified — a regression here means the horizontal path leaked vertical CSS.
    const gapPx = px(getComputedStyle(strip).columnGap)
    expect(gapPx, `${server.browser}: the horizontal strip-gap regressed off 16px`).toBeCloseTo(16, 0)
    // GH #586 negative — a default (no `overflow` attribute) ui-tabs renders no overflow part at all.
    expect(tabs.querySelector('[data-part="overflow"]'), `${server.browser}: a default tabs must carry no overflow part`).toBeNull()
  })
})

describe('ui-tabs — orientation="vertical": whole-shape geometry — strip beside panel, edges, alignment (both engines)', () => {
  it('[MUST-PROVE] the strip sits inline-start of the visible panel; aria-orientation is set; divider + indicator ride the inline-end edge; labels start-align; zero padding-inline holds; 16px row gap', async () => {
    const { tabs, tabEls, panelEls } = mount(VERTICAL)
    const strip = tabs.querySelector('[data-part="tablist"]') as HTMLElement

    // aria-orientation on the STRIP PART (never the host, never internals — a plain DOM attribute).
    expect(strip.getAttribute('aria-orientation'), `${server.browser}: the vertical strip must carry aria-orientation`).toBe('vertical')
    expect(tabs.hasAttribute('aria-orientation'), 'aria-orientation must never ride the host').toBe(false)

    // the whole-shape assertion (test-the-whole-shape law): shell is a real row — the strip's box sits
    // entirely to the inline-start (LTR: left) of the visible panel's box, and they share a top edge.
    const stripRect = strip.getBoundingClientRect()
    const panelRect = panelEls[0].getBoundingClientRect()
    expect(stripRect.right, `${server.browser}: the strip must sit LEFT of the panel (LTR)`).toBeLessThanOrEqual(panelRect.left + 1)
    expect(stripRect.top, `${server.browser}: the strip and panel must share a top edge (row layout)`).toBeCloseTo(panelRect.top, 0)
    expect(stripRect.width, 'vacuous test setup — the strip collapsed to zero width').toBeGreaterThan(0)

    // the strip is a flex COLUMN — the three tabs stack vertically, in DOM order.
    const r0 = tabEls[0].getBoundingClientRect()
    const r1 = tabEls[1].getBoundingClientRect()
    const r2 = tabEls[2].getBoundingClientRect()
    expect(r1.top, `${server.browser}: tab 1 must sit BELOW tab 0 (column stack)`).toBeGreaterThan(r0.bottom - 1)
    expect(r2.top, `${server.browser}: tab 2 must sit BELOW tab 1`).toBeGreaterThan(r1.bottom - 1)

    // the divider: border-inline-end 1px, border-block-end 0 (the horizontal edge is off).
    const stripStyle = getComputedStyle(strip)
    expect(stripStyle.borderInlineEndWidth, `${server.browser}: the vertical divider must be border-inline-end`).toBe('1px')
    expect(stripStyle.borderBlockEndWidth, `${server.browser}: the horizontal divider must be OFF under vertical`).toBe('0px')
    expect(stripStyle.borderRightWidth, `${server.browser}: inline-end resolves to the physical RIGHT edge in LTR`).toBe('1px')

    // the selected-tab indicator rides the SAME edge (inline-end/right in LTR), a full block-size bar.
    const indicator = getComputedStyle(tabEls[0], '::after')
    expect(indicator.right, `${server.browser}: the indicator must hug the inline-end (right, LTR) edge`).toBe('0px')
    expect(indicator.inlineSize, `${server.browser}: the indicator width did not resolve to the token`).toBe('2px')
    expect(px(indicator.blockSize), `${server.browser}: the indicator must span the FULL tab block-size, not a thin bottom bar`).toBeCloseTo(r0.height, 0)

    // #536's law extended: zero padding-inline stands under vertical too.
    const tabStyle = getComputedStyle(tabEls[0])
    expect(tabStyle.paddingInlineStart, 'a vertical tab must carry zero padding-inline-start (GH #536, extended)').toBe('0px')
    expect(tabStyle.paddingInlineEnd, 'a vertical tab must carry zero padding-inline-end (GH #536, extended)').toBe('0px')

    // labels start-align (a list convention) — not centered (the horizontal-strip convention).
    expect(tabStyle.justifyContent, `${server.browser}: a vertical tab label must start-align`).toBe('flex-start')

    // full-width rows via cross-axis STRETCH: every tab's inline-size equals the strip's content inline-size.
    expect(r0.width, `${server.browser}: a vertical tab must stretch to the column's full width`).toBeCloseTo(r1.width, 0)

    // the SAME strip-gap token, now spacing rows (row-gap) — 16px at density 1 (the #542 pin, vertical form).
    const rowGapPx = px(getComputedStyle(strip).rowGap)
    expect(rowGapPx, `${server.browser}: the vertical row-gap did not resolve to 16px at density 1`).toBeCloseTo(16, 0)

    await tabs.updateComplete
  })
})

describe('ui-tabs — orientation="vertical": keyboard axis — Up/Down move selection, Left/Right are INERT (both engines)', () => {
  it('[MUST-PROVE] ArrowDown/ArrowUp rove focus + selection; ArrowLeft/ArrowRight do nothing', async () => {
    const { tabs, tabEls, panelEls } = mount(VERTICAL)

    await userEvent.click(tabEls[0])
    expect(document.activeElement, 'click did not focus tab 0').toBe(tabEls[0])

    await userEvent.keyboard('{ArrowDown}')
    await tabs.updateComplete
    expect(document.activeElement, `${server.browser}: ArrowDown did not rove focus to tab 1 under vertical`).toBe(tabEls[1])
    expect(tabEls[1].tabIndex).toBe(0)
    expect(getComputedStyle(panelEls[1]).display, 'ArrowDown did not switch the visible panel').toBe('block')

    await userEvent.keyboard('{ArrowUp}')
    await tabs.updateComplete
    expect(document.activeElement, `${server.browser}: ArrowUp did not rove focus back to tab 0`).toBe(tabEls[0])

    // Left/Right are INERT under vertical — focus + selection must not move.
    await userEvent.keyboard('{ArrowRight}')
    await tabs.updateComplete
    expect(document.activeElement, `${server.browser}: ArrowRight must be inert under vertical`).toBe(tabEls[0])
    expect(getComputedStyle(panelEls[0]).display, 'ArrowRight must not switch the panel under vertical').toBe('block')

    await userEvent.keyboard('{ArrowLeft}')
    await tabs.updateComplete
    expect(document.activeElement, `${server.browser}: ArrowLeft must be inert under vertical`).toBe(tabEls[0])

    // Home/End are UNCHANGED either axis (both engines).
    await userEvent.keyboard('{End}')
    await tabs.updateComplete
    expect(document.activeElement, `${server.browser}: End did not move to the last tab under vertical`).toBe(tabEls[2])
    expect(getComputedStyle(panelEls[2]).display, 'End did not switch the panel under vertical').toBe('block')

    await userEvent.keyboard('{Home}')
    await tabs.updateComplete
    expect(document.activeElement, `${server.browser}: Home did not move to the first tab under vertical`).toBe(tabEls[0])
    expect(getComputedStyle(panelEls[0]).display, 'Home did not switch the panel under vertical').toBe('block')
  })
})

describe('ui-tabs — orientation="vertical": [fill] × vertical corner — shell row, strip pinned + own scroll (§7, both engines)', () => {
  it('[MUST-PROVE] the shell stays a flex ROW at block-size:100% under [fill][orientation=vertical]; the strip is a pinned column', () => {
    const wrap = document.createElement('div')
    wrap.style.cssText = 'display:flex; flex-direction:column; block-size:220px;'
    wrap.innerHTML = `
      <ui-tabs fill orientation="vertical">
        <ui-tab>One</ui-tab><ui-tab>Two</ui-tab><ui-tab>Three</ui-tab>
        <ui-tab-panel>P1</ui-tab-panel><ui-tab-panel>P2</ui-tab-panel><ui-tab-panel>P3</ui-tab-panel>
      </ui-tabs>`
    document.body.append(wrap)
    mounted.push(wrap)

    const tabs = wrap.querySelector('ui-tabs') as UITabsElement
    const strip = tabs.querySelector('[data-part="tablist"]') as HTMLElement
    const panel = wrap.querySelector('ui-tab-panel') as HTMLElement

    expect(getComputedStyle(tabs).display, `${server.browser}: [fill][orientation=vertical] must still be flex`).toBe('flex')
    // [fill] alone is a column; vertical (placed AFTER in source) must win the shell's main axis back to a row.
    expect(getComputedStyle(tabs).flexDirection, `${server.browser}: [fill]×vertical must compose to a ROW, not [fill]'s own column`).toBe('row')
    expect(tabs.getBoundingClientRect().height, `${server.browser}: the fill shell did not fill its bounded parent under vertical`).toBeCloseTo(
      wrap.getBoundingClientRect().height,
      0,
    )
    // the strip stays pinned (flex:none) at its own content width, and keeps its own overflow-y (not flexed
    // to fill the row) — the panel keeps its EXISTING scroll leg (flex:1 1 auto; overflow-y:auto), unchanged.
    expect(getComputedStyle(strip).flexShrink, `${server.browser}: the vertical strip must be pinned (flex-shrink:0)`).toBe('0')
    expect(getComputedStyle(strip).flexGrow, `${server.browser}: the vertical strip must be pinned (flex-grow:0)`).toBe('0')
    expect(getComputedStyle(strip).overflowY, `${server.browser}: the vertical strip must keep its own overflow-y:auto`).toBe('auto')
    expect(getComputedStyle(panel).flexGrow, `${server.browser}: the panel scroll leg (flex:1) must be unchanged under fill×vertical`).toBe('1')
    expect(getComputedStyle(panel).overflowY, `${server.browser}: the panel scroll leg (overflow-y:auto) must be unchanged under fill×vertical`).toBe(
      'auto',
    )
  })
})

describe('ui-tabs — orientation="vertical": RTL logical-properties smoke — the divider/indicator PHYSICALLY flip (both engines)', () => {
  it('[MUST-PROVE] under dir="rtl" the strip sits physically RIGHT of the panel, and the divider/indicator ride the physical LEFT edge', () => {
    const wrap = document.createElement('div')
    wrap.dir = 'rtl'
    wrap.innerHTML = VERTICAL
    document.body.append(wrap)
    mounted.push(wrap)

    const tabs = wrap.querySelector('ui-tabs') as UITabsElement
    const strip = tabs.querySelector('[data-part="tablist"]') as HTMLElement
    const panel = wrap.querySelector('ui-tab-panel') as HTMLElement
    const tab0 = wrap.querySelector('ui-tab') as HTMLElement

    // a flex ROW's main axis reverses under RTL: the strip (first child) renders on the PHYSICAL RIGHT,
    // the panel (second child) on the PHYSICAL LEFT — logical inline-start/-end tracks writing direction.
    const stripRect = strip.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    expect(stripRect.left, `${server.browser}: under RTL the strip must sit physically RIGHT of the panel`).toBeGreaterThanOrEqual(panelRect.right - 1)

    // inline-end (the edge facing the panel) is now the PHYSICAL LEFT edge — the divider + indicator follow.
    const stripStyle = getComputedStyle(strip)
    expect(stripStyle.borderLeftWidth, `${server.browser}: under RTL the divider must paint on the physical LEFT`).toBe('1px')
    expect(stripStyle.borderRightWidth, `${server.browser}: under RTL the physical RIGHT edge must be borderless`).toBe('0px')

    const indicator = getComputedStyle(tab0, '::after')
    expect(indicator.left, `${server.browser}: under RTL the indicator must hug the physical LEFT edge`).toBe('0px')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [8] Slice-A review inheritance (MINOR) — a nested horizontal ui-tabs inside a vertical one's panel
//  must NOT inherit the outer vertical skin (the exact-child-combinator hardening, tabs.css)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-tabs — nested tabs: a horizontal ui-tabs composed inside a vertical one stays horizontal (both engines)', () => {
  it('[MUST-PROVE] the inner (default, horizontal) tabs keeps center-aligned labels + a bottom-edge indicator — it does NOT inherit the outer vertical start-align / inline-end indicator', () => {
    const wrap = document.createElement('div')
    wrap.innerHTML = `
      <ui-tabs orientation="vertical">
        <ui-tab>Outer One</ui-tab><ui-tab>Outer Two</ui-tab>
        <ui-tab-panel>
          <ui-tabs>
            <ui-tab>Inner One</ui-tab><ui-tab>Inner Two</ui-tab>
            <ui-tab-panel>Inner P1</ui-tab-panel><ui-tab-panel>Inner P2</ui-tab-panel>
          </ui-tabs>
        </ui-tab-panel>
        <ui-tab-panel>Outer P2</ui-tab-panel>
      </ui-tabs>`
    document.body.append(wrap)
    mounted.push(wrap)

    const outerTabs = wrap.querySelector('ui-tabs') as UITabsElement
    const innerTabs = outerTabs.querySelector('ui-tab-panel ui-tabs') as UITabsElement
    expect(innerTabs, 'vacuous test setup — the nested ui-tabs did not mount').not.toBeNull()
    const innerTabEls = [...innerTabs.querySelectorAll(':scope > [data-part="tablist"] > ui-tab')] as UITabElement[]
    expect(innerTabEls.length, "vacuous test setup — the inner tabs reparented none of its own tabs").toBe(2)

    // the OUTER strip is genuinely vertical (sanity — the leak-source condition is real).
    const outerStrip = outerTabs.querySelector(':scope > [data-part="tablist"]') as HTMLElement
    expect(getComputedStyle(outerStrip).flexDirection, `${server.browser}: the outer strip must be the vertical column`).toBe('column')

    // the INNER tabs (default, horizontal) must NOT pick up the outer's vertical-only overrides.
    expect(getComputedStyle(innerTabEls[0]).justifyContent, `${server.browser}: a nested horizontal tab must stay CENTERED, not inherit the outer's start-align`).toBe('center')
    const innerAfter = getComputedStyle(innerTabEls[0], '::after')
    expect(innerAfter.insetBlockEnd, `${server.browser}: the inner indicator must ride the BOTTOM edge (horizontal), not the outer's inline-end`).toBe('0px')
    expect(px(innerAfter.blockSize), `${server.browser}: the inner indicator must stay the THIN bottom bar, not a full-height bar`).toBeCloseTo(2, 0)
    const innerStripStyle = getComputedStyle(innerTabs.querySelector(':scope > [data-part="tablist"]') as HTMLElement)
    expect(innerStripStyle.flexDirection, `${server.browser}: the inner strip must stay a horizontal ROW`).toBe('row')
    expect(innerStripStyle.borderBlockEndWidth, `${server.browser}: the inner divider must ride the horizontal bottom edge`).toBe('1px')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [9] GH #586 — overflow="menu" (LLD-C5..C9, `.claude/docs/lld/tabs-vertical-overflow.lld.md` §4/§5/§7)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

// Six FIXED-WIDTH tabs (deterministic across engines — an inline style beats tabs.css's own unset
// inline-size, independent of font metrics/label content) so the fit arithmetic is exactly computable.
const overflowMarkup = (count: number, widthPx: number): string =>
  `<ui-tabs overflow="menu">
    ${Array.from({ length: count }, (_, i) => `<ui-tab style="inline-size:${widthPx}px">Tab ${i}</ui-tab>`).join('')}
    ${Array.from({ length: count }, (_, i) => `<ui-tab-panel>P${i}</ui-tab-panel>`).join('')}
  </ui-tabs>`

const mountBounded = (
  innerWidthPx: number,
  count = 6,
  tabWidthPx = 100,
): { wrap: HTMLElement; tabs: UITabsElement; tabEls: UITabElement[]; strip: HTMLElement; menuEl: HTMLElement; trigger: HTMLButtonElement } => {
  const wrap = document.createElement('div')
  wrap.style.inlineSize = `${innerWidthPx}px`
  wrap.innerHTML = overflowMarkup(count, tabWidthPx)
  document.body.append(wrap)
  mounted.push(wrap)
  const tabs = wrap.querySelector('ui-tabs') as UITabsElement
  const tabEls = [...wrap.querySelectorAll('ui-tab')] as UITabElement[]
  const strip = tabs.querySelector('[data-part="tablist"]') as HTMLElement
  const menuEl = tabs.querySelector('[data-part="overflow"]') as HTMLElement
  const trigger = menuEl.querySelector('[data-part="trigger"]') as HTMLButtonElement
  return { wrap, tabs, tabEls, strip, menuEl, trigger }
}

describe('ui-tabs — overflow="menu": the part exists, wraps a real trigger + proxy panel (both engines)', () => {
  it("[MUST-PROVE] a bounded strip shows K visible tabs + the trigger, and exactly N-K proxy menuitems with the overflowed tabs' identities", async () => {
    const { tabEls, menuEl, trigger } = mountBounded(360)
    await nextFrames()

    expect(menuEl.hidden, 'not everything fits — the overflow part must be visible').toBe(false)
    expect(trigger.getAttribute('aria-haspopup'), 'the ui-menu trigger auto-gets aria-haspopup=menu (menu.ts)').toBe('menu')
    expect(trigger.getAttribute('aria-label')).toBe('More tabs')
    expect(trigger.id.length, 'the trigger must have SOME accessible name anchor').toBeGreaterThan(0)

    const visible = tabEls.filter((t) => !t.hasAttribute('data-overflowed'))
    const overflowed = tabEls.filter((t) => t.hasAttribute('data-overflowed'))
    expect(visible.length, 'vacuous — nothing fit').toBeGreaterThan(0)
    expect(visible.length, 'vacuous — everything fit, nothing overflowed').toBeLessThan(tabEls.length)

    // open the menu — exactly N-K proxy menuitems, data-values matching the overflowed tabs' identities.
    await userEvent.click(trigger)
    const panel = menuEl.querySelector('[data-part="panel"]') as HTMLElement
    const proxies = [...panel.querySelectorAll('[role="menuitem"]')] as HTMLElement[]
    expect(proxies.length, 'the proxy count must equal exactly the overflowed count').toBe(overflowed.length)
    const proxyValues = proxies.map((p) => p.dataset['value']).sort()
    const overflowedIdx = tabEls
      .map((t, i) => (t.hasAttribute('data-overflowed') ? String(i) : null))
      .filter((v): v is string => v !== null)
      .sort()
    expect(proxyValues, 'a keyless tab addresses by its DOM index — the proxy data-values must match exactly').toEqual(overflowedIdx)
  })

  it('overflow="scroll" (default) ⇒ NO overflow part exists (negative, real layout)', () => {
    const { tabs } = mount(THREE)
    expect(tabs.querySelector('[data-part="overflow"]')).toBeNull()
  })
})

describe('ui-tabs — overflow="menu": fit arithmetic is PINNED against real measurements (both engines)', () => {
  it('[MUST-PROVE] Σ(visible widths)+gaps ≤ (available − reserve); adding the next tab overflows it — the fit is tight, not slack', async () => {
    const { tabs, tabEls, strip } = mountBounded(360)
    await nextFrames()

    const visible = tabEls.filter((t) => !t.hasAttribute('data-overflowed'))
    const overflowed = tabEls.filter((t) => t.hasAttribute('data-overflowed'))
    expect(visible.length, 'vacuous test setup').toBeGreaterThan(0)
    expect(overflowed.length, 'vacuous test setup — nothing overflowed to prove tightness against').toBeGreaterThan(0)
    expect(visible.length + overflowed.length).toBe(tabEls.length)

    const gap = px(getComputedStyle(strip).columnGap)
    const tabHeight = px(getComputedStyle(tabs).getPropertyValue('--ui-tabs-tab-height'))
    const reserve = tabHeight + gap
    const budget = strip.getBoundingClientRect().width - reserve

    const visibleWidths = visible.map((t) => t.getBoundingClientRect().width)
    const visibleSum = visibleWidths.reduce((a, b) => a + b, 0) + Math.max(0, visible.length - 1) * gap
    expect(visibleSum, `${server.browser}: the visible set must fit the reserve-adjusted budget`).toBeLessThanOrEqual(budget + 0.5)

    // every tab shares the SAME forced width — reuse a visible one as the "next DOM-order tab"'s width.
    const uniformWidth = visibleWidths[0]
    expect(
      visibleSum + gap + uniformWidth,
      `${server.browser}: adding the very next tab must overflow the budget (the fit is exactly tight)`,
    ).toBeGreaterThan(budget + 0.5)
  })

  it('[MUST-PROVE] resize wider ⇒ the trigger hides and every tab becomes visible', async () => {
    const { wrap, tabEls, menuEl } = mountBounded(360)
    await nextFrames()
    expect(menuEl.hidden, 'vacuous — nothing overflowed at the narrow width').toBe(false)

    wrap.style.inlineSize = '900px' // comfortably wider than 6×100px + 5×16px = 680px
    await nextFrames()
    expect(menuEl.hidden, `${server.browser}: the trigger must hide once everything fits`).toBe(true)
    for (const t of tabEls) expect(t.hasAttribute('data-overflowed'), `${server.browser}: every tab must be visible once everything fits`).toBe(false)
  })

  it('[MUST-PROVE] resize is DETERMINISTIC — the same strip size yields the same visible set on re-observe (no oscillation)', async () => {
    const { wrap, tabEls } = mountBounded(360)
    await nextFrames()
    const firstPass = tabEls.map((t) => t.hasAttribute('data-overflowed'))
    expect(firstPass.some(Boolean), 'vacuous test setup').toBe(true)

    wrap.style.inlineSize = '500px' // a different size — a real intermediate resize
    await nextFrames()
    wrap.style.inlineSize = '360px' // back to the ORIGINAL size
    await nextFrames()
    const secondPass = tabEls.map((t) => t.hasAttribute('data-overflowed'))
    expect(secondPass, `${server.browser}: the same strip size must reproduce the same visible set — no oscillation`).toEqual(firstPass)
  })

  it('[MUST-PROVE] a resize transition never surfaces a "ResizeObserver loop" window error (component-checker MAJOR-1)', async () => {
    // `#applyFit`'s own writes (menuEl.hidden, the data-overflowed swap collapsing/expanding the
    // grid's auto trigger column) resize the SAME observed strip — pre-fix this reproduced
    // "ResizeObserver loop completed with undelivered notifications" on every fit transition
    // (3× in 5s). The fix defers the callback body one rAF (tabs.ts #wireOverflow); this probe
    // listens for the real `error` event a real engine surfaces that condition as, across several
    // real transitions (narrow → wide → narrow → mid), and asserts NONE fire.
    const { wrap } = mountBounded(360)
    await nextFrames()

    const errors: string[] = []
    const onError = (e: Event): void => {
      errors.push((e as ErrorEvent).message ?? String(e))
    }
    window.addEventListener('error', onError)
    try {
      wrap.style.inlineSize = '900px' // narrow → wide: overflow disengages (trigger hides, column collapses)
      await nextFrames(4)
      wrap.style.inlineSize = '360px' // wide → narrow: overflow re-engages (trigger shows, column expands)
      await nextFrames(4)
      wrap.style.inlineSize = '500px' // one more real transition
      await nextFrames(4)
    } finally {
      window.removeEventListener('error', onError)
    }

    expect(errors, `${server.browser}: a resize transition must never surface a window error (the RO-loop class): ${errors.join('; ')}`).toEqual([])
  })
})

describe('ui-tabs — overflow="menu": selected is ALWAYS pinned visible (both engines)', () => {
  it('[MUST-PROVE] a programmatic `selected` write to an overflowed tab promotes it — visible as the LAST slot — WITHOUT any select event', async () => {
    const { tabs, tabEls, menuEl } = mountBounded(360)
    await nextFrames()
    const lastTab = tabEls[tabEls.length - 1]
    expect(lastTab.hasAttribute('data-overflowed'), 'vacuous test setup — the last tab must start overflowed').toBe(true)

    let count = 0
    tabs.addEventListener('select', () => count++)
    tabs.selected = String(tabEls.length - 1) // the agent / renderer two-way write — a keyless tab's index identity
    await tabs.updateComplete
    await nextFrames()

    expect(count, 'a programmatic selected write must never echo a select event').toBe(0)
    expect(lastTab.hasAttribute('data-overflowed'), `${server.browser}: the newly-selected tab must be promoted out of the menu`).toBe(false)
    expect(
      menuEl.querySelector(`[data-part="panel"] [role="menuitem"][data-value="${tabEls.length - 1}"]`),
      'the promoted tab must no longer have a proxy row',
    ).toBeNull()

    // DOM order is preserved (display swap only) — the promoted tab renders as the LAST VISIBLE slot.
    const visible = tabEls.filter((t) => !t.hasAttribute('data-overflowed'))
    expect(visible[visible.length - 1], `${server.browser}: the promoted tab must be the last VISIBLE slot`).toBe(lastTab)
  })
})

describe('ui-tabs — overflow="menu": a menu commit relays through the ONE existing path (both engines)', () => {
  it('[MUST-PROVE] committing a proxy fires exactly ONE ui-tabs select, promotes the tab as the last visible slot, and paints its indicator', async () => {
    // 5×100px tabs at 450px ⇒ K=3 visible (0,1,2), 2 proxies (3,4) — hand-verified fit math (generous margin
    // against the trigger's exact rendered footprint, ~36px, varying a few px across engines).
    const { tabs, tabEls, menuEl, trigger } = mountBounded(450, 5, 100)
    await nextFrames()
    const overflowedBefore = tabEls.filter((t) => t.hasAttribute('data-overflowed'))
    expect(overflowedBefore.length, 'vacuous test setup').toBeGreaterThan(0)

    const selects: CustomEvent[] = []
    tabs.addEventListener('select', (e) => selects.push(e as CustomEvent))

    await userEvent.click(trigger)
    const panel = menuEl.querySelector('[data-part="panel"]') as HTMLElement
    const firstProxy = panel.querySelector('[role="menuitem"]') as HTMLElement
    const promotedIndex = Number(firstProxy.dataset['value'])
    const promotedTab = tabEls[promotedIndex]

    await userEvent.click(firstProxy)
    await tabs.updateComplete
    await nextFrames()

    expect(selects, `${server.browser}: a menu commit must fire EXACTLY one ui-tabs select`).toHaveLength(1)
    expect(selects[0].detail).toEqual({ value: String(promotedIndex), index: promotedIndex })
    expect(promotedTab.hasAttribute('data-overflowed'), `${server.browser}: the committed tab must be promoted out of the menu`).toBe(false)

    // Click parity (component-checker MAJOR-2, Kim ruling 2026-08-08): the promoted tab KEEPS focus —
    // ui-menu's default "restore to trigger" is suppressed for this relay (menu.ts keepFocusOnCommit,
    // set by tabs.ts's #ensureOverflowMenu) — after the model→overlay effect's own microtask has
    // settled (the `await`s above already span it), focus must still be on the promoted tab, not
    // pulled back to the trigger.
    expect(document.activeElement, `${server.browser}: the promoted tab must KEEP focus after a menu commit (click parity)`).toBe(promotedTab)

    const visible = tabEls.filter((t) => !t.hasAttribute('data-overflowed'))
    expect(visible[visible.length - 1], `${server.browser}: the committed tab must render as the LAST visible slot`).toBe(promotedTab)

    // the indicator paints on the newly-committed tab.
    const alpha = ((): number => {
      const c = getComputedStyle(promotedTab, '::after').backgroundColor
      if (c === 'transparent') return 0
      const m = c.match(/rgba?\(([^)]+)\)/i)
      if (!m) return 1
      const parts = m[1].split(/[\s,/]+/).filter(Boolean)
      return parts.length >= 4 ? Number(parts[3]) : 1
    })()
    expect(alpha, `${server.browser}: the promoted tab's indicator did not paint`).toBeGreaterThan(0)
  })

  it('[MUST-PROVE] Escape closes an open menu and returns focus to the trigger', async () => {
    const { menuEl, trigger } = mountBounded(360)
    await nextFrames()
    await userEvent.click(trigger)
    expect(menuEl.hasAttribute('open') || (menuEl as unknown as { open?: boolean }).open, 'the menu did not open').toBeTruthy()

    await userEvent.keyboard('{Escape}')
    expect(document.activeElement, `${server.browser}: Escape must return focus to the overflow trigger`).toBe(trigger)
  })
})

describe('ui-tabs — overflow="menu": roving focus covers exactly the VISIBLE tabs (both engines)', () => {
  it('[MUST-PROVE] an arrow walk visits exactly the visible tabs, never a hidden one; after a click on a mid VISIBLE tab, the next arrow steps from it', async () => {
    // 5×100px tabs at 450px ⇒ K=3 visible (0,1,2), 2 overflowed (3,4) — a genuine "mid" tab exists (generous
    // margin against the trigger's exact rendered footprint).
    const { tabs, tabEls } = mountBounded(450, 5, 100)
    await nextFrames()
    expect(tabEls[0].hasAttribute('data-overflowed')).toBe(false)
    expect(tabEls[1].hasAttribute('data-overflowed')).toBe(false)
    expect(tabEls[2].hasAttribute('data-overflowed')).toBe(false)
    expect(tabEls[3].hasAttribute('data-overflowed'), 'vacuous test setup').toBe(true)
    expect(tabEls[4].hasAttribute('data-overflowed'), 'vacuous test setup').toBe(true)

    await userEvent.click(tabEls[1]) // the MID visible tab
    expect(document.activeElement).toBe(tabEls[1])

    await userEvent.keyboard('{ArrowRight}')
    await tabs.updateComplete
    expect(document.activeElement, `${server.browser}: ArrowRight from the mid tab must step to the NEXT visible tab`).toBe(tabEls[2])

    await userEvent.keyboard('{ArrowRight}') // must WRAP to the first VISIBLE tab, never touch a hidden one
    await tabs.updateComplete
    expect(document.activeElement, `${server.browser}: the ring must wrap over the VISIBLE set only, skipping the overflowed tabs`).toBe(tabEls[0])
  })
})

describe('ui-tabs — overflow="menu": an overflowed tab has no client rects; the strip never scrolls (both engines)', () => {
  it('[MUST-PROVE] an overflowed tab renders nowhere; the strip stops scrolling entirely once fit is applied', async () => {
    const { strip, tabEls } = mountBounded(360)
    await nextFrames()
    const overflowed = tabEls.filter((t) => t.hasAttribute('data-overflowed'))
    expect(overflowed.length, 'vacuous test setup').toBeGreaterThan(0)
    for (const t of overflowed) {
      const r = t.getBoundingClientRect()
      expect(r.width, `${server.browser}: an overflowed tab must have zero width`).toBe(0)
      expect(r.height, `${server.browser}: an overflowed tab must have zero height`).toBe(0)
    }
    expect(getComputedStyle(strip).overflowX, `${server.browser}: the strip must not scroll in menu mode`).toBe('clip')
    expect(strip.scrollWidth, `${server.browser}: the strip must never actually overflow its own box in menu mode`).toBeLessThanOrEqual(
      strip.clientWidth + 1,
    )
  })
})

describe('ui-tabs — overflow="menu": the hidden-connect reveal engages fit (doc-review repair 1, both engines)', () => {
  it('[MUST-PROVE] connecting inside a display:none ancestor then revealing it ENGAGES overflow (K < N, trigger visible, N-K proxies)', async () => {
    const outer = document.createElement('div')
    outer.style.display = 'none'
    const inner = document.createElement('div')
    inner.style.inlineSize = '360px'
    inner.innerHTML = overflowMarkup(6, 100)
    outer.append(inner)
    document.body.append(outer)
    mounted.push(outer)

    const tabs = outer.querySelector('ui-tabs') as UITabsElement
    const tabEls = [...outer.querySelectorAll('ui-tab')] as UITabElement[]
    const menuEl = tabs.querySelector('[data-part="overflow"]') as HTMLElement

    // while hidden: the RO never fired a real size (the standing failure this guard closes) — no assertion on
    // the hide state here (a false negative before reveal is expected/harmless), only that nothing throws.
    outer.style.display = 'block' // REVEAL
    await nextFrames(4) // the reveal-time RO tick + the guard's remeasure-then-refit pass

    expect(menuEl.hidden, `${server.browser}: overflow must ENGAGE once revealed — the cache-validity guard`).toBe(false)
    const visible = tabEls.filter((t) => !t.hasAttribute('data-overflowed'))
    const overflowed = tabEls.filter((t) => t.hasAttribute('data-overflowed'))
    expect(visible.length, `${server.browser}: at least one tab (selected) must be visible`).toBeGreaterThan(0)
    expect(overflowed.length, `${server.browser}: the hidden-connect bug would leave this at ZERO forever`).toBeGreaterThan(0)

    await userEvent.click(menuEl.querySelector('[data-part="trigger"]') as HTMLElement)
    const proxies = menuEl.querySelectorAll('[data-part="panel"] [role="menuitem"]')
    expect(proxies.length, `${server.browser}: the proxy count must equal exactly the overflowed count`).toBe(overflowed.length)
  })
})

describe('ui-tabs — orientation="vertical" × overflow="menu": the §7 corner — fit axis flips to block-size (both engines)', () => {
  it("[MUST-PROVE] the fit axis flips to BLOCK-size under vertical; the trigger sits at the strip column's block-end, a tab-height square", () => {
    const wrap = document.createElement('div')
    wrap.style.cssText = 'display:flex; flex-direction:column; block-size:200px;'
    wrap.innerHTML = `
      <ui-tabs fill orientation="vertical" overflow="menu">
        <ui-tab>One</ui-tab><ui-tab>Two</ui-tab><ui-tab>Three</ui-tab><ui-tab>Four</ui-tab><ui-tab>Five</ui-tab>
        <ui-tab-panel>P1</ui-tab-panel><ui-tab-panel>P2</ui-tab-panel><ui-tab-panel>P3</ui-tab-panel><ui-tab-panel>P4</ui-tab-panel><ui-tab-panel>P5</ui-tab-panel>
      </ui-tabs>`
    document.body.append(wrap)
    mounted.push(wrap)

    const tabs = wrap.querySelector('ui-tabs') as UITabsElement
    const strip = tabs.querySelector('[data-part="tablist"]') as HTMLElement
    const menuEl = tabs.querySelector('[data-part="overflow"]') as HTMLElement
    const trigger = menuEl.querySelector('[data-part="trigger"]') as HTMLElement
    const tabEls = [...wrap.querySelectorAll('ui-tab')] as UITabElement[]
    const panel = wrap.querySelector('ui-tab-panel') as HTMLElement

    // the shell composes to a GRID (not [fill]'s own flex column) and still fills the bounded parent.
    expect(getComputedStyle(tabs).display, `${server.browser}: [orientation=vertical][overflow=menu] must be display:grid`).toBe('grid')
    expect(tabs.getBoundingClientRect().height, `${server.browser}: the fill shell must still fill its bounded parent`).toBeCloseTo(
      wrap.getBoundingClientRect().height,
      0,
    )

    // the fit axis flipped to BLOCK-size: the 200px-bounded column cannot hold all 5 rows + the trigger reserve.
    const visible = tabEls.filter((t) => !t.hasAttribute('data-overflowed'))
    const overflowed = tabEls.filter((t) => t.hasAttribute('data-overflowed'))
    expect(visible.length, 'vacuous test setup').toBeGreaterThan(0)
    expect(overflowed.length, `${server.browser}: the bounded column must overflow — the block-axis fit did not engage`).toBeGreaterThan(0)
    expect(menuEl.hidden).toBe(false)

    // the trigger sits BELOW the strip (the column's block-end), a tab-height square.
    const stripRect = strip.getBoundingClientRect()
    const triggerRect = trigger.getBoundingClientRect()
    expect(triggerRect.top, `${server.browser}: the trigger must sit at the strip column's BLOCK-END`).toBeGreaterThanOrEqual(stripRect.bottom - 1)
    const rowHeight = visible[0].getBoundingClientRect().height
    expect(triggerRect.height, `${server.browser}: the trigger must be the SAME height as a tab row`).toBeCloseTo(rowHeight, 0)
    expect(triggerRect.width, `${server.browser}: the trigger must be SQUARE`).toBeCloseTo(triggerRect.height, 0)

    // the panel scroll leg (ADR-0144 Q1) is UNCHANGED under fill×vertical×menu — the SAME composition
    // fill×vertical×scroll already proves (computed values resolve regardless of which layout mode applies).
    expect(getComputedStyle(panel).flexGrow, `${server.browser}: the panel scroll leg (flex:1) must be unchanged under fill×vertical×menu`).toBe('1')
    expect(
      getComputedStyle(panel).overflowY,
      `${server.browser}: the panel scroll leg (overflow-y:auto) must be unchanged under fill×vertical×menu`,
    ).toBe('auto')
  })
})
