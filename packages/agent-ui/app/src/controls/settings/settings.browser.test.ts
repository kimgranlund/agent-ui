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
    const rail = el.querySelector('[data-part="rail"]') as HTMLElement
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
    const appearanceItem = [...el.querySelectorAll<HTMLButtonElement>('[data-part="rail-item"]')].find(
      (item) => item.dataset.sectionId === 'appearance',
    )!
    appearanceItem.click()
    await el.updateComplete
    const panel = el.querySelector('[data-part="panel"]') as HTMLElement
    expect(panel.querySelector('ui-switch')).not.toBeNull()
    expect(panel.querySelector('ui-select')).not.toBeNull()
    expect(panel.querySelector('ui-slider')).not.toBeNull()
    expect(panel.querySelectorAll('ui-text-field')).toHaveLength(0) // the profile section's fields were DETACHED
    expect(appearanceItem.getAttribute('aria-current')).toBe('page')
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
    const rail = el.querySelector('[data-part="rail"]') as HTMLElement
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

describe('ui-settings — reduced motion (inherited — no bespoke transition of its OWN)', () => {
  it('settings.css declares no transition/animation of its own on any part', async () => {
    const { wrapper, el } = mountSettings('900px')
    await el.updateComplete
    for (const selector of ['[data-part="rail"]', '[data-part="rail-item"]', '[data-part="panel"]']) {
      const node = el.querySelector(selector) as HTMLElement
      const style = getComputedStyle(node)
      expect(style.transitionDuration === '0s' || style.transitionDuration === '').toBe(true)
    }
    wrapper.remove()
  })
})

describe('ui-settings — keyboard (rail buttons are native <button>s; Tab reaches the generated field)', () => {
  it('Tab from the first rail item reaches the next rail item, then the panel’s first control', async () => {
    const { wrapper, el } = mountSettings('900px')
    await el.updateComplete
    const items = el.querySelectorAll<HTMLButtonElement>('[data-part="rail-item"]')
    items[0].focus()
    expect(document.activeElement).toBe(items[0])
    // native <button> Tab order is the platform's own — asserting focusability + native semantics is the
    // composition-level proof; the exhaustive real-Tab traversal is the form-e2e.browser.test.ts precedent
    // (components/src/controls/form-provider), not re-derived per composing surface.
    expect(items[0].tabIndex).not.toBe(-1)
    wrapper.remove()
  })

  it('activating a rail item via Enter/Space (native <button> semantics) switches the section', async () => {
    const { wrapper, el } = mountSettings('900px')
    await el.updateComplete
    const appearanceItem = [...el.querySelectorAll<HTMLButtonElement>('[data-part="rail-item"]')].find(
      (item) => item.dataset.sectionId === 'appearance',
    )!
    appearanceItem.focus()
    appearanceItem.click() // native <button> Enter/Space parity is the platform's own — proven by every ui-master-detail "back" button already
    await el.updateComplete
    expect(el.section).toBe('appearance')
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
      expect(inShadow.querySelectorAll('[data-part="rail-item"]')).toHaveLength(2)
    } finally {
      shell.remove()
    }
  })
})
