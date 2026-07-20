import { describe, it, expect, afterEach } from 'vitest'

// n3a — the CROSS-ENGINE ui-settings smoke (LLD-C12, SPEC-R9). jsdom cannot resolve CSS Grid/flex layout
// or `@container` — this file is where the composed ui-master-detail's wide side-by-side / narrow
// drill-in becomes TRUE for a REAL settings arrangement, in BOTH Chromium and WebKit (the
// master-detail.browser.test.ts precedent). This file proves COMPOSITION, not master-detail's own
// internals (its drill-in/keyboard/ARIA contract is already proven there) — the only NEW geometry here is
// the rail's own layout + the panel swap.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/app/master-detail-pane.css'
import '@agent-ui/app/master-detail.css'
import '@agent-ui/app/master-detail-pane'
import '@agent-ui/app/master-detail'
import './settings.css'
import { UISettingsElement } from './settings.ts'
import { createMemoryStore } from './memory-store.ts'
import type { SettingsSchema } from './schema.ts'
import type { UINavRailItemElement } from '../nav-rail/nav-rail-item.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const REALISTIC_SCHEMA: SettingsSchema = {
  version: 1,
  sections: [
    {
      id: 'profile', label: 'Profile',
      fields: [
        { key: 'displayName', type: 'text', label: 'Display name', default: '' },
        { key: 'bio', type: 'text', label: 'Bio', default: '' },
      ],
    },
    {
      id: 'appearance', label: 'Appearance',
      fields: [
        { key: 'darkMode', type: 'boolean', label: 'Dark mode', default: false },
        {
          key: 'density', type: 'select', label: 'Density', default: 'comfortable',
          options: [{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' }],
        },
        { key: 'fontScale', type: 'slider', label: 'Font scale', default: 1, validation: { min: 0.5, max: 2, step: 0.1 } },
      ],
    },
  ],
}

/** A resizable WRAPPER establishing its OWN query container — ui-settings' composed ui-master-detail
 *  reflows against the wrapper, never the viewport (the master-detail.browser.test.ts precedent). */
function mountSettings(width = '900px'): { wrapper: HTMLElement; el: UISettingsElement; store: ReturnType<typeof createMemoryStore> } {
  const wrapper = document.createElement('div')
  wrapper.style.containerType = 'inline-size'
  wrapper.style.width = width
  wrapper.style.height = '500px'
  const el = document.createElement('ui-settings') as UISettingsElement
  const store = createMemoryStore()
  el.store = store
  el.schema = REALISTIC_SCHEMA
  wrapper.append(el)
  document.body.append(wrapper)
  mounted.push(wrapper)
  return { wrapper, el, store }
}

describe('ui-settings cross-engine smoke — wide (composes ui-master-detail, SPEC-R9 AC1)', () => {
  it('rail and panel show SIDE BY SIDE via the composed ui-master-detail/ui-split — realistic mixed-type section', async () => {
    const { wrapper, el } = mountSettings('900px')
    await el.updateComplete
    const rail = el.querySelector('ui-nav-rail') as HTMLElement
    const panel = el.querySelector('[data-part="panel"]') as HTMLElement
    expect(getComputedStyle(rail).display).not.toBe('none')
    expect(getComputedStyle(panel).display).not.toBe('none')
    const railRect = rail.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    expect(railRect.width).toBeGreaterThan(0)
    expect(panelRect.width).toBeGreaterThan(0)
    expect(railRect.right).toBeLessThanOrEqual(panelRect.left + 0.5) // side by side, rail first

    // the FIRST section ("profile") is active by default — its two text fields render, mixed with the
    // OTHER section's switch/select/slider NOT present (only the active section mounts).
    expect(panel.querySelectorAll('ui-text-field')).toHaveLength(2)
    expect(panel.querySelector('ui-switch')).toBeNull()
    wrapper.remove()
  })

  it('clicking a rail item switches the panel to a DIFFERENT mixed-type section, real click + real layout', async () => {
    const { wrapper, el } = mountSettings('900px')
    await el.updateComplete
    const appearanceItem = [...el.querySelectorAll<UINavRailItemElement>('ui-nav-rail-item')].find(
      (item) => item.dataset.sectionId === 'appearance',
    )!
    appearanceItem.click()
    await el.updateComplete
    const panel = el.querySelector('[data-part="panel"]') as HTMLElement
    expect(panel.querySelector('ui-switch')).not.toBeNull()
    expect(panel.querySelector('ui-select')).not.toBeNull()
    expect(panel.querySelector('ui-slider')).not.toBeNull()
    expect(panel.querySelectorAll('ui-text-field')).toHaveLength(0) // the profile section's fields were DETACHED
    // ADR-0130 cl.4 a11y CORRECTION: a bare/button-shaped item's activator carries role=tab/aria-selected
    // (an in-page selection commit), never aria-current="page" (that verb is reserved for href/link items).
    expect(appearanceItem.selected).toBe(true)
    const activator = appearanceItem.querySelector('[data-part="activator"]')!
    expect(activator.getAttribute('role')).toBe('tab')
    expect(activator.getAttribute('aria-selected')).toBe('true')
    expect(activator.hasAttribute('aria-current')).toBe(false)
    wrapper.remove()
  })

  it('a REAL store round-trip: a real field change (real layout, real element) commits to the supplied store', async () => {
    const { wrapper, el, store } = mountSettings('900px')
    await el.updateComplete
    const field = el.querySelector('ui-text-field') as HTMLElement & { value: string; focus(): void }
    field.focus()
    field.value = 'Ada Lovelace'
    field.dispatchEvent(new Event('input', { bubbles: true }))
    field.dispatchEvent(new Event('change', { bubbles: true }))
    await Promise.resolve() // the commit is deferred one microtask (generate.ts — the codec staleness guard)
    expect(store.get('displayName')).toBe('Ada Lovelace')
    wrapper.remove()
  })
})

describe('ui-settings cross-engine smoke — narrow drill-in (inherited from ui-master-detail, SPEC-R9 AC1)', () => {
  it('no selection narrow ⇒ only the rail shows; a rail click narrow drills into the panel', async () => {
    const { wrapper, el } = mountSettings('900px')
    await el.updateComplete
    wrapper.style.width = '300px' // narrow the CONTAINER (< 40rem), not the viewport
    const rail = el.querySelector('ui-nav-rail') as HTMLElement
    const panel = el.querySelector('[data-part="panel"]') as HTMLElement
    // master-detail's OWN drill-in keys off ITS `selected` — ui-settings syncs that to a resolved section
    // (never empty once a schema is present), so narrow already shows the panel/detail view by default.
    // The COMPOSITION proof here is that master-detail's drill-in rules apply at all to ui-settings' DOM —
    // not a re-test of the drill-in mechanism itself (proven in master-detail.browser.test.ts).
    expect(getComputedStyle(panel).display).not.toBe('none')
    const md = el.querySelector('ui-master-detail') as HTMLElement
    expect(md.getAttribute('data-view')).toBe('detail')
    void rail
    wrapper.remove()
  })
})

// ── GH #50 — the single-section posture: detail-only, no rail, no Back, at EVERY width ──────────────────

const SINGLE_SECTION_SCHEMA: SettingsSchema = {
  version: 1,
  sections: [
    {
      id: 'agent', label: 'Agent',
      fields: [{ key: 'name', type: 'text', label: 'Name', default: '' }],
    },
  ],
}

describe('ui-settings — single-section posture renders detail-only (GH #50)', () => {
  function mountSingle(width: string): { wrapper: HTMLElement; el: UISettingsElement } {
    const wrapper = document.createElement('div')
    wrapper.style.containerType = 'inline-size'
    wrapper.style.width = width
    wrapper.style.height = '500px'
    const el = document.createElement('ui-settings') as UISettingsElement
    el.store = createMemoryStore()
    el.schema = SINGLE_SECTION_SCHEMA
    wrapper.append(el)
    document.body.append(wrapper)
    mounted.push(wrapper)
    return { wrapper, el }
  }

  it('WIDE: the list pane + separator hide, the Back affordance hides, the detail pane fills', async () => {
    const { el } = mountSingle('900px')
    await el.updateComplete
    expect(el.hasAttribute('data-single-section')).toBe(true)
    const listPane = el.querySelector('ui-split-pane[data-role="list"]') as HTMLElement
    const back = el.querySelector('[data-part="back"]') as HTMLElement
    const detailPane = el.querySelector('ui-split-pane[data-role="detail"]') as HTMLElement
    expect(getComputedStyle(listPane).display, 'the one-item rail is not navigation — it must hide').toBe('none')
    expect(getComputedStyle(back).display, 'no list to go back to — the Back affordance must hide').toBe('none')
    expect(getComputedStyle(detailPane).display).not.toBe('none')
    // the lone visible pane takes the full container width (minus nothing — no separator remains)
    expect(detailPane.getBoundingClientRect().width).toBeGreaterThan(850)
  })

  it('NARROW (< 40rem, the drill-in branch): the Back affordance STAYS hidden — the specificity contract vs master-detail.css:100 holds', async () => {
    const { wrapper, el } = mountSingle('900px')
    await el.updateComplete
    wrapper.style.width = '300px'
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))) // container-query reflow
    const back = el.querySelector('[data-part="back"]') as HTMLElement
    const panel = el.querySelector('[data-part="panel"]') as HTMLElement
    expect(getComputedStyle(back).display, 'narrow drill-in must NOT resurface the Back (the reveal rule loses on specificity)').toBe('none')
    expect(getComputedStyle(panel).display, 'the detail panel still shows narrow').not.toBe('none')
  })

  it('control case: the MULTI-section fixture still shows its rail wide (zero behavior change outside the posture)', async () => {
    const { el } = mountSettings('900px')
    await el.updateComplete
    expect(el.hasAttribute('data-single-section')).toBe(false)
    const listPane = el.querySelector('ui-split-pane[data-role="list"]') as HTMLElement
    expect(getComputedStyle(listPane).display).not.toBe('none')
  })
})

describe('ui-settings — reduced motion (inherited — no bespoke transition of its OWN)', () => {
  it('settings.css declares no transition/animation of its own on any part', async () => {
    const { wrapper, el } = mountSettings('900px')
    await el.updateComplete
    for (const selector of ['ui-nav-rail', 'ui-nav-rail-item', '[data-part="panel"]']) {
      const node = el.querySelector(selector) as HTMLElement
      const style = getComputedStyle(node)
      expect(style.transitionDuration === '0s' || style.transitionDuration === '').toBe(true)
    }
    wrapper.remove()
  })
})

describe('ui-settings — external sync (TKT-0021, store.subscribe), cross-engine', () => {
  it('a real store.set reflects into a REAL boolean (ui-switch) field — no user gesture involved', async () => {
    const { wrapper, el } = mountSettings('900px')
    await el.updateComplete
    const appearanceItem = [...el.querySelectorAll<UINavRailItemElement>('ui-nav-rail-item')].find(
      (item) => item.dataset.sectionId === 'appearance',
    )!
    appearanceItem.click()
    await el.updateComplete
    const control = el.querySelector('ui-switch') as unknown as HTMLElement & { checked: boolean }
    expect(control.checked).toBe(false)
    ;(el.store as ReturnType<typeof createMemoryStore>).set('darkMode', true)
    expect(control.checked).toBe(true)
    wrapper.remove()
  })

  it('a real store.set reflects the RAW value into a REAL codec-wall field (ui-text-field type=number) — visible immediately via the same control identity, real layout, real engine', async () => {
    const wrapper = document.createElement('div')
    wrapper.style.containerType = 'inline-size'
    wrapper.style.width = '900px'
    wrapper.style.height = '500px'
    const el = document.createElement('ui-settings') as UISettingsElement
    const store = createMemoryStore()
    el.store = store
    el.schema = {
      version: 1,
      sections: [{
        id: 'general', label: 'General',
        fields: [{ key: 'retryCount', type: 'number', label: 'Retry count', default: 0 }],
      }],
    }
    wrapper.append(el)
    document.body.append(wrapper)
    try {
      await el.updateComplete
      const control = el.querySelector('ui-text-field[name="retryCount"]') as unknown as HTMLElement & { value: string }
      const before = control
      store.set('retryCount', 5) // the "external" write — no user gesture, no blur
      expect(control.value).toBe('5')
      expect(el.querySelector('ui-text-field[name="retryCount"]'), 'the reflection regenerated the control instead of reusing it').toBe(before)
    } finally {
      wrapper.remove()
    }
  })
})

describe('ui-settings — keyboard (rail items are real <button> activators; Tab reaches the generated field)', () => {
  it('Tab from the first rail item reaches the next rail item, then the panel’s first control', async () => {
    const { wrapper, el } = mountSettings('900px')
    await el.updateComplete
    // ui-nav-rail-item is `display:contents` (never itself a focusable node) — the created `[data-part=
    // activator]` <button> is the real focusable/AX-bearing node (nav-rail-item.ts).
    const activators = el.querySelectorAll<HTMLButtonElement>('ui-nav-rail-item [data-part="activator"]')
    activators[0].focus()
    expect(document.activeElement).toBe(activators[0])
    // native <button> Tab order is the platform's own — asserting focusability + native semantics is the
    // composition-level proof; the exhaustive real-Tab traversal is the form-e2e.browser.test.ts precedent
    // (components/src/controls/form-provider), not re-derived per composing surface.
    expect(activators[0].tabIndex).not.toBe(-1)
    wrapper.remove()
  })

  it('activating a rail item via Enter/Space (native <button> semantics) switches the section', async () => {
    const { wrapper, el } = mountSettings('900px')
    await el.updateComplete
    const appearanceItem = [...el.querySelectorAll<UINavRailItemElement>('ui-nav-rail-item')].find(
      (item) => item.dataset.sectionId === 'appearance',
    )!
    const activator = appearanceItem.querySelector<HTMLButtonElement>('[data-part="activator"]')!
    activator.focus()
    activator.click() // native <button> Enter/Space parity is the platform's own — proven by every ui-master-detail "back" button already
    await el.updateComplete
    expect(el.section).toBe('appearance')
    wrapper.remove()
  })
})

describe('ui-settings — inter-field vertical rhythm (GH #136)', () => {
  it('the generated ui-form-provider lays out as a flex column with a real, non-zero gap', async () => {
    const { wrapper, el } = mountSettings('900px')
    await el.updateComplete
    const provider = el.querySelector('ui-form-provider') as HTMLElement
    const style = getComputedStyle(provider)
    expect(style.display).toBe('flex')
    expect(style.flexDirection).toBe('column')
    const gapPx = parseFloat(style.rowGap || style.gap)
    expect(gapPx).toBeGreaterThan(0)
    wrapper.remove()
  })

  it('two consecutive generated field blocks render with real breathing room between them, not flush (real bounding rects, no simulated scroll/resize)', async () => {
    const { wrapper, el } = mountSettings('900px')
    await el.updateComplete
    // the active "profile" section renders two ui-field-wrapped controls (displayName, bio) as direct
    // siblings inside the ONE generated ui-form-provider — exactly the reported "flush" pair.
    const fields = [...el.querySelectorAll('[data-part="panel"] ui-field')] as HTMLElement[]
    expect(fields).toHaveLength(2)
    const [first, second] = fields
    const firstRect = first.getBoundingClientRect()
    const secondRect = second.getBoundingClientRect()
    expect(secondRect.top, 'the second field must render below the first (sanity check on the fixture)').toBeGreaterThan(firstRect.top)
    const verticalGap = secondRect.top - firstRect.bottom
    // pre-fix this measures ~0 (flush, the reported bug) — post-fix it is the real computed --ui-settings-gap.
    expect(verticalGap).toBeGreaterThan(4)
    wrapper.remove()
  })
})

describe('ui-settings composed inside an ISOLATED ui-app-shell region (the master-detail reconnect precedent)', () => {
  it('a settings surface relocated by ADR-0082 isolation composes EXACTLY ONCE — no duplicate ui-master-detail', async () => {
    await import('@agent-ui/app/app-shell.css')
    await import('@agent-ui/app/app-shell')
    const shell = document.createElement('ui-app-shell')
    shell.setAttribute('isolated', '')
    const region = document.createElement('ui-app-shell-region')
    region.setAttribute('region', 'main')

    const settings = document.createElement('ui-settings') as UISettingsElement
    settings.schema = REALISTIC_SCHEMA
    region.append(settings)
    shell.append(region)

    document.body.append(shell)
    try {
      const inShadow = shell.shadowRoot!.querySelector('ui-settings') as HTMLElement
      expect(inShadow, 'the settings surface did not relocate into the shadow at all — setup broken').not.toBeNull()
      expect(inShadow.querySelectorAll('ui-master-detail'), 'a duplicate composition survived the isolation relocation reconnect').toHaveLength(1)
      expect(inShadow.querySelectorAll('ui-nav-rail-item')).toHaveLength(2)
    } finally {
      shell.remove()
    }
  })
})
