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
// — that is decomp s12 / integration — so this suite imports the two sheets directly, pre-barrel.)
import '@agent-ui/components/foundation-styles.css'
import '../_surface/container.css'
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
    // css-text regex cannot see). Anti-vacuous: it equals the --md-sys-height-md ramp step (28px @ scale 1), not
    // merely >0 — so a broken --ui-tabs-tab-height → --md-sys-height-md chain fails HERE, where jsdom/css-text can't.
    const rowHeight = Number.parseFloat(getComputedStyle(tabEls[0]).blockSize)
    expect(rowHeight, 'the tab row collapsed — the --ui-tabs-tab-height → --md-sys-height-md chain did not resolve').toBeGreaterThan(0)
    expect(rowHeight, 'the tab row height is not the --md-sys-height-md ramp step (28px @ scale 1)').toBeCloseTo(28, 0)

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
    // tabs.css:29-30: --ui-tabs-strip-gap rides --md-sys-space-xs; --ui-tabs-panel-pad rides --md-sys-space-md.
    // Both are shell/layout-ladder quantities (density-responsive). The tab CONTROL HEIGHT is --md-sys-height-md
    // (28px explicit literal, ADR-0038 — not a --md-sys-space quantity, density-invariant). Anti-vacuous: strip-gap
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
    expect(tabHeightBase, 'comfortable tab height is not 28px').toBeCloseTo(28, 0)

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
    // anti-vacuity: the tab height invariant is a real value (28px), not vacuously zero
    expect(tabHeightCompact, 'tab height is 0 (control-height invariant is vacuous)').toBeGreaterThan(0)
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
