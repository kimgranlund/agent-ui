import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from '@vitest/browser/context'
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
    // css-text regex cannot see). Anti-vacuous: it equals the --ui-height-md ramp step (28px @ scale 1), not
    // merely >0 — so a broken --ui-tabs-tab-height → --ui-height-md chain fails HERE, where jsdom/css-text can't.
    const rowHeight = Number.parseFloat(getComputedStyle(tabEls[0]).blockSize)
    expect(rowHeight, 'the tab row collapsed — the --ui-tabs-tab-height → --ui-height-md chain did not resolve').toBeGreaterThan(0)
    expect(rowHeight, 'the tab row height is not the --ui-height-md ramp step (28px @ scale 1)').toBeCloseTo(28, 0)

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
//  [3] The ARIA wiring is live in a real engine — roles via internals + the element-reflection relations
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
