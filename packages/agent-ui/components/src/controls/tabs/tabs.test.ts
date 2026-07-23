import { describe, it, expect } from 'vitest'
import { UITabsElement } from './tabs.ts'
import { UITabElement } from './tab.ts'
import { UITabPanelElement } from './tab-panel.ts'

// G9 s8 — the tabs compound (ui-tabs + ui-tab + ui-tab-panel) jsdom behaviour probes (decomp g9-containers s8 /
// ADR-0015 surface · ADR-0019 the bindable `selected`). Under proof: selected drives aria-selected + the roving
// tabindex + panel visibility; ArrowRight/Left/Home/End move selection; click selects; the select/change events
// fire ONLY on a user commit (not a programmatic write); zero residue on disconnect + re-arm on reconnect; ARIA
// roles ride internals (not host attrs). What jsdom CANNOT resolve — :state(selected) paint, the aria-controls/
// labelledby element-reflection (jsdom lacks ariaControlsElements + CustomStateSet), real focus/forced-colors —
// is tabs.browser.test.ts. (jsdom DOES support internals.role + internals.ariaSelected — probed and relied on.)

// Probe subclasses re-exposing the protected internals (the button.test.ts precedent). The parent recognises
// tabs/panels by INSTANCEOF, so the probes nest inside a probe-tabs exactly like the real elements do.
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
customElements.define('ui-tabs-probe', ProbeTabs)
customElements.define('ui-tab-probe', ProbeTab)
customElements.define('ui-tab-panel-probe', ProbeTabPanel)

interface Fixture {
  tabs: ProbeTabs
  tabEls: ProbeTab[]
  panelEls: ProbeTabPanel[]
  strip: HTMLElement
}

function build(opts: { selected?: string; values?: string[]; count?: number } = {}): Fixture {
  const count = opts.count ?? 3
  const tabs = new ProbeTabs()
  if (opts.selected !== undefined) tabs.setAttribute('selected', opts.selected)
  const tabEls: ProbeTab[] = []
  const panelEls: ProbeTabPanel[] = []
  for (let i = 0; i < count; i++) {
    const t = new ProbeTab()
    t.textContent = `Tab ${i}`
    if (opts.values) t.setAttribute('key', opts.values[i])
    tabs.append(t)
    tabEls.push(t)
  }
  for (let i = 0; i < count; i++) {
    const p = new ProbeTabPanel()
    p.textContent = `Panel ${i}`
    tabs.append(p)
    panelEls.push(p)
  }
  document.body.append(tabs) // connect → reparent tabs into the strip + wire + the synchronous selection effect
  const strip = tabs.querySelector('[data-part="tablist"]') as HTMLElement
  return { tabs, tabEls, panelEls, strip }
}

const arrow = (el: Element, key: string): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  el.dispatchEvent(e)
  return e
}

describe('ui-tabs — anatomy + ARIA via internals (s8)', () => {
  it('reparents the ui-tab children into a [data-part=tablist] strip; panels stay as siblings', () => {
    const { tabs, tabEls, panelEls, strip } = build()
    expect(strip).not.toBeNull()
    expect(strip.getAttribute('role')).toBe('tablist') // role on the PART div (text-field editor-part precedent)
    // every tab is now inside the strip; every panel is a direct child of the host (a strip sibling)
    for (const t of tabEls) expect(t.parentElement).toBe(strip)
    for (const p of panelEls) expect(p.parentElement).toBe(tabs)
    expect(strip.parentElement).toBe(tabs)
  })

  it('roles ride internals (tab/tabpanel); NO host role/aria attribute anywhere', () => {
    const { tabs, tabEls, panelEls } = build()
    for (const t of tabEls) {
      expect(t.ii.role).toBe('tab') // via ElementInternals
      expect(t.getAttribute('role')).toBeNull() // never a host attribute
      expect(t.hasAttribute('aria-selected')).toBe(false)
    }
    for (const p of panelEls) {
      expect(p.ii.role).toBe('tabpanel')
      expect(p.getAttribute('role')).toBeNull()
    }
    expect(tabs.getAttribute('role')).toBeNull() // the host is role-free (the role rides the strip part)
  })
})

describe('ui-tabs — selected drives aria-selected + roving tabindex + panel visibility (s8)', () => {
  it('default (no selected) selects the first tab', () => {
    const { tabEls, panelEls } = build()
    expect(tabEls[0].ii.ariaSelected).toBe('true')
    expect(tabEls[1].ii.ariaSelected).toBe('false')
    expect(tabEls[0].tabIndex).toBe(0) // roving: the selected tab is the single tab-order entry
    expect(tabEls[1].tabIndex).toBe(-1)
    expect(panelEls[0].hidden).toBe(false) // only the selected panel shows
    expect(panelEls[1].hidden).toBe(true)
    expect(panelEls[2].hidden).toBe(true)
  })

  it('NEGATIVE control: a non-selected tab is NOT tabindex=0 (roving, not all-tabbable)', () => {
    const { tabEls } = build()
    expect(tabEls.filter((t) => t.tabIndex === 0)).toHaveLength(1) // exactly ONE tab in the tab order
    expect(tabEls[1].tabIndex).not.toBe(0)
    expect(tabEls[2].tabIndex).not.toBe(0)
  })

  it('a programmatic `selected` (index string) switches the active tab + panel', async () => {
    const { tabs, tabEls, panelEls } = build()
    tabs.selected = '2'
    await tabs.updateComplete // the selection effect is microtask-batched
    expect(tabs.getAttribute('selected')).toBe('2') // reflects
    expect(tabEls[2].ii.ariaSelected).toBe('true')
    expect(tabEls[2].tabIndex).toBe(0)
    expect(tabEls[0].tabIndex).toBe(-1)
    expect(panelEls[2].hidden).toBe(false)
    expect(panelEls[0].hidden).toBe(true)
  })

  it('`selected` resolves a tab VALUE (id), not only an index', async () => {
    const { tabs, tabEls } = build({ values: ['overview', 'pricing', 'faq'], selected: 'pricing' })
    expect(tabEls[1].ii.ariaSelected).toBe('true') // matched by key, not index
    tabs.selected = 'faq'
    await tabs.updateComplete
    expect(tabEls[2].ii.ariaSelected).toBe('true')
    expect(tabEls[1].ii.ariaSelected).toBe('false')
  })
})

describe('ui-tabs — keyboard roving (ArrowLeft/Right + Home/End) (s8)', () => {
  it('ArrowRight moves selection to the next tab and wraps last→first', async () => {
    const { tabs, tabEls, strip } = build()
    arrow(strip, 'ArrowRight')
    await tabs.updateComplete
    expect(tabEls[1].tabIndex).toBe(0)
    expect(tabEls[1].ii.ariaSelected).toBe('true')
    expect(tabEls[0].tabIndex).toBe(-1)

    arrow(strip, 'ArrowRight') // → tab 2
    arrow(strip, 'ArrowRight') // → wraps to tab 0
    await tabs.updateComplete
    expect(tabEls[0].tabIndex).toBe(0)
    expect(tabEls[0].ii.ariaSelected).toBe('true')
  })

  it('ArrowLeft wraps first→last; Home/End jump to the ends', async () => {
    const { tabs, tabEls, strip } = build()
    arrow(strip, 'ArrowLeft') // from tab 0 → wraps to tab 2
    await tabs.updateComplete
    expect(tabEls[2].ii.ariaSelected).toBe('true')

    arrow(strip, 'Home')
    await tabs.updateComplete
    expect(tabEls[0].ii.ariaSelected).toBe('true')

    arrow(strip, 'End')
    await tabs.updateComplete
    expect(tabEls[2].ii.ariaSelected).toBe('true')
  })

  it('a nav key calls preventDefault; a non-nav key is left alone', () => {
    const { strip } = build()
    expect(arrow(strip, 'ArrowRight').defaultPrevented).toBe(true)
    expect(arrow(strip, 'a').defaultPrevented).toBe(false)
  })
})

describe('ui-tabs — the commit `select` event + binding hygiene (s8)', () => {
  it('a keyboard commit emits the ONE `select` event with { value, index } — and NOT `change`', async () => {
    const { tabs, strip } = build()
    const selects: CustomEvent[] = []
    let changes = 0
    tabs.addEventListener('select', (e) => selects.push(e as CustomEvent))
    tabs.addEventListener('change', () => changes++)
    arrow(strip, 'ArrowRight')
    await tabs.updateComplete
    expect(selects).toHaveLength(1)
    expect(selects[0].detail).toEqual({ value: '1', index: 1 })
    expect(changes, '`select` is the only commit event — `change` is the catalog-bound NOT').toBe(0) // s11 binds event:'select'
  })

  it('a click on a tab selects it + emits select', async () => {
    const { tabs, tabEls } = build()
    const selects: CustomEvent[] = []
    tabs.addEventListener('select', (e) => selects.push(e as CustomEvent))
    tabEls[2].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await tabs.updateComplete
    expect(tabEls[2].ii.ariaSelected).toBe('true')
    expect(selects).toHaveLength(1)
    expect(selects[0].detail).toEqual({ value: '2', index: 2 })
  })

  it('a PROGRAMMATIC `selected` write emits NOTHING (binding hygiene — no echo loop)', async () => {
    const { tabs } = build()
    let count = 0
    tabs.addEventListener('select', () => count++)
    tabs.addEventListener('change', () => count++)
    tabs.selected = '1' // the agent / renderer two-way write
    await tabs.updateComplete
    expect(count).toBe(0) // applied silently — the user did not act
  })

  it('clicking the ALREADY-active tab does not re-emit (no spurious commit)', async () => {
    const { tabs, tabEls } = build()
    let count = 0
    tabs.addEventListener('select', () => count++)
    tabEls[0].dispatchEvent(new MouseEvent('click', { bubbles: true })) // tab 0 is already active
    await tabs.updateComplete
    expect(count).toBe(0)
  })

  // Regression — GH #20: a keyed tab's user-click commit must reflect `selected` as the tab's VALUE (its
  // `key`), never its positional DOM index, even though the index and the key can coincidentally collide in
  // shape (both are strings) — a keyless-tabs fixture (build() above) can't distinguish the two, so this one
  // pins `values` explicitly. The bug this guards: a tab whose `key` never resolved (e.g. an attribute-name
  // mismatch upstream) silently falls back to `#commit`'s documented index fallback — correct FOR a genuinely
  // key-less tab, wrong here because a real key IS present.
  it('a click commit on a KEYED tab reflects `selected` as the VALUE, not the DOM index (GH #20)', async () => {
    const { tabs, tabEls } = build({ values: ['overview', 'pricing', 'faq'] })
    const selects: CustomEvent[] = []
    tabs.addEventListener('select', (e) => selects.push(e as CustomEvent))
    tabEls[1].dispatchEvent(new MouseEvent('click', { bubbles: true })) // index 1, key 'pricing'
    await tabs.updateComplete
    expect(tabs.getAttribute('selected'), 'selected must reflect the VALUE, not the index "1"').toBe('pricing')
    expect(selects).toHaveLength(1)
    expect(selects[0].detail).toEqual({ value: 'pricing', index: 1 })
  })
})

describe('ui-tabs — zero residue + re-arm across connect/disconnect (s8)', () => {
  it('disconnect removes the strip listeners; reconnect re-wires exactly one set', async () => {
    const { tabs, tabEls, strip } = build()
    let count = 0
    tabs.addEventListener('select', () => count++)

    arrow(strip, 'ArrowRight') // → tab 1
    await tabs.updateComplete
    expect(count).toBe(1)

    tabs.remove() // disconnect → ac.abort() removes the keydown/click listeners
    arrow(strip, 'ArrowRight')
    expect(count).toBe(1) // no commit — the listener was abort-owned and torn down

    document.body.append(tabs) // reconnect → connected() re-installs the listeners + the selection effect
    arrow(strip, 'ArrowRight') // from the re-applied selection (tab 1) → tab 2
    await tabs.updateComplete
    expect(count).toBe(2) // exactly ONE more — a single re-wired listener, not a stacked leak
    expect(tabEls[2].ii.ariaSelected).toBe('true')
  })
})

describe('ui-tabs — `fill` reflected boolean (ADR-0144 Q1 cl.1)', () => {
  it('defaults to false/absent; setting the property reflects the attribute and vice versa', () => {
    const { tabs } = build()
    expect(tabs.fill).toBe(false)
    expect(tabs.hasAttribute('fill')).toBe(false)

    tabs.fill = true
    expect(tabs.hasAttribute('fill')).toBe(true) // property → attribute reflection

    tabs.fill = false
    expect(tabs.hasAttribute('fill')).toBe(false)

    tabs.setAttribute('fill', '') // attribute → property
    expect(tabs.fill).toBe(true)
  })
})

describe('ui-tabs — PANEL-LESS composition (GH #221: the ui-super-shell strip contract)', () => {
  // ui-super-shell composes both its tab strips from ui-tabs WITHOUT ui-tab-panel children (the
  // shell's segments/participants are its own visibility targets, never panels). This pin freezes
  // the tolerance that composition relies on: the tab↔panel pair wiring SKIPS absent panels while
  // selection, roving tabindex, and the one user-commit `select` event all run unaffected.
  function buildPanelless(): { tabs: ProbeTabs; tabEls: ProbeTab[]; strip: HTMLElement } {
    const tabs = new ProbeTabs()
    const tabEls: ProbeTab[] = []
    for (let i = 0; i < 3; i++) {
      const t = new ProbeTab()
      t.textContent = `Tab ${i}`
      tabs.append(t)
      tabEls.push(t)
    }
    document.body.append(tabs)
    return { tabs, tabEls, strip: tabs.querySelector('[data-part="tablist"]') as HTMLElement }
  }

  it('connects clean with zero panels: strip + roving + selection all live, nothing throws', () => {
    const { tabEls, strip } = buildPanelless()
    expect(strip.getAttribute('role')).toBe('tablist')
    for (const t of tabEls) expect(t.parentElement).toBe(strip) // reparent leg unaffected
    expect(tabEls[0].ii.ariaSelected).toBe('true') // first-tab default selection
    expect(tabEls[0].tabIndex).toBe(0) // roving intact
    expect(tabEls[1].tabIndex).toBe(-1)
  })

  it('a click commits + emits the ONE `select`; a programmatic `selected` write echoes NOTHING (ADR-0019)', async () => {
    const { tabs, tabEls } = buildPanelless()
    const seen: Array<{ value: string; index: number }> = []
    tabs.addEventListener('select', (e) => seen.push((e as CustomEvent<{ value: string; index: number }>).detail))
    tabEls[1].click()
    expect(seen).toEqual([{ value: '1', index: 1 }]) // key-less ⇒ the index identity
    await tabs.updateComplete
    expect(tabEls[1].ii.ariaSelected).toBe('true')
    tabs.selected = '2' // programmatic (the composing shell's sync-back write)
    await tabs.updateComplete
    expect(tabEls[2].ii.ariaSelected).toBe('true')
    expect(seen, 'a programmatic write must never echo a select event').toHaveLength(1)
  })

  it('link() accepts ANY element as the aria-controls target (the shell points tabs at its segments)', () => {
    const { tabEls } = buildPanelless()
    const segment = document.createElement('div') // a shell segment — NOT a ui-tab-panel
    expect(() => tabEls[0].link(segment, 'gh221-tab-id')).not.toThrow()
    expect(tabEls[0].id, 'link seeds the tab id when the author gave none').toBe('gh221-tab-id')
    // the element-reflection itself is a real-engine API (jsdom lacks ariaControlsElements) —
    // proven cross-engine in tabs.browser.test.ts; here the seam's contract surface is the pin.
  })
})

describe('ui-tabs — self-define (s8)', () => {
  it('registers all three tags', () => {
    expect(customElements.get('ui-tabs')).toBe(UITabsElement)
    expect(customElements.get('ui-tab')).toBe(UITabElement)
    expect(customElements.get('ui-tab-panel')).toBe(UITabPanelElement)
  })
})
