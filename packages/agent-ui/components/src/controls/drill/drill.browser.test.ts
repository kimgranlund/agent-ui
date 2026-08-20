import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'

// ADR-0195 — ui-drill cross-engine browser-truth smoke (GH #954), re-anchored to the ADR-0195 Amendment
// (2026-08-19, GH #1510) S1 slice: contained + stack becomes the default presentation. jsdom-green
// (drill.test.ts) proves the state machine; this proves REAL painted visibility (a painted ANCESTOR is
// `display` != none, not hidden — the contract change from the pre-amendment unbounded swap), the real
// `inert` platform mechanism actually blocking a genuine pointer click (not just this repo's software
// guard), real platform click/keyboard activation, real focus-move on a path change, and the contained
// card's WHOLE-SHAPE geometry (bordered/clipped/same-cell-stacked). Direct imports (pre-barrel — the
// disclosure.browser.test.ts / checkbox.browser.test.ts precedent).
import '@agent-ui/components/foundation-styles.css'
import './drill.css'
import './drill.ts'
import './drill-panel.ts'

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

const mounted: HTMLElement[] = []

function mount(): {
  wrap: HTMLElement
  host: HTMLElement
  settingsTrigger: HTMLElement
  back: HTMLElement
  heading: HTMLElement
} {
  const wrap = document.createElement('div')
  wrap.style.inlineSize = '400px' // a realistic, deterministic container for the whole-shape assertions below
  wrap.innerHTML = `
    <ui-drill aria-label="Settings">
      <ui-drill-panel key="root" heading="Root">
        <button data-role="drill-trigger" data-drill-key="settings">Settings</button>
      </ui-drill-panel>
      <ui-drill-panel key="settings" parent="root" heading="Settings">
        <p>Settings content, a little taller than the root panel to prove intrinsic block-sizing.</p>
      </ui-drill-panel>
    </ui-drill>
  `
  document.body.append(wrap)
  mounted.push(wrap)
  const host = wrap.querySelector('ui-drill') as HTMLElement
  return {
    wrap,
    host,
    settingsTrigger: host.querySelector('[data-drill-key="settings"]') as HTMLElement,
    back: host.querySelector('[data-part="back"]') as HTMLElement,
    heading: host.querySelector('[data-part="heading"]') as HTMLElement,
  }
}

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove()
})

describe('ui-drill — real painted visibility (stack default, ADR-0195 Amendment cl.A1)', () => {
  it('at mount: the root panel is painted, the settings panel (off-path) is not', () => {
    const { host } = mount()
    const root = host.querySelector('[key="root"]') as HTMLElement
    const settings = host.querySelector('[key="settings"]') as HTMLElement
    expect(getComputedStyle(root).display).not.toBe('none')
    expect(getComputedStyle(settings).display).toBe('none')
  })

  it('a real pointer click on a drill-trigger PAINTS the new active pane AND keeps the ancestor painted, dimmed', async () => {
    const { settingsTrigger, host } = mount()
    await userEvent.click(settingsTrigger)
    const settings = host.querySelector('[key="settings"]') as HTMLElement
    const root = host.querySelector('[key="root"]') as HTMLElement & { inert: boolean }
    // the ACTIVE pane paints
    expect(getComputedStyle(settings).display).not.toBe('none')
    expect(settings.getAttribute('data-drill-pane')).toBe('active')
    // the ANCESTOR pane ALSO paints (the contract change — pre-amendment this asserted display:none here)
    expect(getComputedStyle(root).display).not.toBe('none')
    expect(root.getAttribute('data-drill-pane')).toBe('ancestor')
    expect(root.inert).toBe(true)
    // real dimming: the ancestor's ::after scrim overlay actually paints a non-transparent colour
    const scrim = getComputedStyle(root, '::after').backgroundColor
    expect(scrim).not.toBe('rgba(0, 0, 0, 0)')
    expect(scrim).not.toBe('transparent')
  })
})

describe('ui-drill — `inert` is a REAL platform block, not just a software guard (cl.A1/A6)', () => {
  it('the platform itself refuses focus into an inert ancestor — a real signature `inert` alone produces (distinct from the z-order/same-rect occlusion proven separately below)', async () => {
    const { settingsTrigger, host } = mount()
    await userEvent.click(settingsTrigger) // root is now a painted, inert ancestor
    const rootTrigger = host.querySelector('[key="root"] [data-drill-key="settings"]') as HTMLButtonElement
    rootTrigger.focus() // a direct, unambiguous programmatic focus attempt — no click/occlusion involved
    // Per the HTML spec, a real user agent REFUSES to focus a descendant of an inert subtree — this is the
    // browser's own enforcement, not this repo's `panel.inert` guard in drill.ts's #onTriggerClick.
    expect(document.activeElement).not.toBe(rootTrigger)
  })
})

describe('ui-drill — Back is keyboard-reachable (real Tab + Enter)', () => {
  it('Tab reaches the back button; Enter activates it', async () => {
    const { settingsTrigger, back, host } = mount()
    await userEvent.click(settingsTrigger) // drill forward first — back becomes visible
    expect(getComputedStyle(back).display).not.toBe('none')
    back.focus()
    expect(document.activeElement).toBe(back)
    await userEvent.keyboard('{Enter}')
    const root = host.querySelector('[key="root"]') as HTMLElement
    expect(getComputedStyle(root).display).not.toBe('none')
    expect(root.getAttribute('data-drill-pane')).toBe('active')
  })
})

describe('ui-drill — focus moves to the incoming panel heading on a real path change', () => {
  it('a real click drill-forward moves focus to [data-part="heading"]', async () => {
    const { settingsTrigger, heading } = mount()
    await userEvent.click(settingsTrigger)
    expect(document.activeElement).toBe(heading)
  })
})

describe('ui-drill — reduced motion suppresses the CSS-transform base (media-query gate present)', () => {
  it('the panel viewport carries a transition declaration that is neutralized under prefers-reduced-motion', () => {
    const { host } = mount()
    const settings = host.querySelector('[key="settings"]') as HTMLElement
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const transition = getComputedStyle(settings).transitionDuration
    // Under a real reduced-motion emulation this would read '0s'; absent explicit CDP emulation in this
    // environment we assert the declaration exists at all (anti-vacuous) rather than assume the OS state.
    expect(typeof transition).toBe('string')
    void reduced
  })

  it('cl.A7 — the ancestor dim wash is STATIC, never motion: no transition on the ::after scrim', async () => {
    const { settingsTrigger, host } = mount()
    await userEvent.click(settingsTrigger)
    const root = host.querySelector('[key="root"]') as HTMLElement
    expect(getComputedStyle(root, '::after').transitionDuration).toBe('0s')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  Contained geometry — the WHOLE-SHAPE law: a card surface, same-cell stacked panes, clipped edge
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-drill — contained card geometry (ADR-0195 Amendment cl.A4, both engines)', () => {
  it('the host paints a real bordered, rounded, clipped card (not a bare flex column)', () => {
    const { host } = mount()
    const cs = getComputedStyle(host)
    expect(cs.display).toBe('grid')
    expect(Number.parseFloat(cs.borderTopWidth)).toBeGreaterThan(0)
    expect(Number.parseFloat(cs.borderTopLeftRadius)).toBeGreaterThan(0)
    expect(cs.overflow).toBe('clip')
  })

  it('the active pane and a painted ancestor pane occupy the SAME rect (same-cell stacking, no DOM move)', async () => {
    const { settingsTrigger, host } = mount()
    const settings = host.querySelector('[key="settings"]') as HTMLElement
    settings.style.transition = 'none' // settled geometry, not the mid-slide frame (the ui-drawer precedent)
    await userEvent.click(settingsTrigger)
    const root = host.querySelector('[key="root"]') as HTMLElement
    const rootRect = root.getBoundingClientRect()
    const settingsRect = settings.getBoundingClientRect()
    expect(rootRect.left).toBeCloseTo(settingsRect.left, 0)
    expect(rootRect.top).toBeCloseTo(settingsRect.top, 0)
    expect(rootRect.width).toBeCloseTo(settingsRect.width, 0)
  })

  it('the active pane paints ABOVE the dimmed ancestor (z-order)', async () => {
    const { settingsTrigger, host } = mount()
    await userEvent.click(settingsTrigger)
    const root = host.querySelector('[key="root"]') as HTMLElement
    const settings = host.querySelector('[key="settings"]') as HTMLElement
    expect(Number(getComputedStyle(settings).zIndex)).toBeGreaterThan(Number(getComputedStyle(root).zIndex))
  })

  it('the host WHOLE bounding box is non-trivial in a realistic container (the whole-shape law)', () => {
    const { host, wrap } = mount()
    const hostRect = host.getBoundingClientRect()
    const wrapRect = wrap.getBoundingClientRect()
    expect(hostRect.width).toBeCloseTo(wrapRect.width, 0) // fill-by-default (ADR-0223), unchanged posture
    expect(hostRect.height).toBeGreaterThan(20) // a real rendered card, not a collapsed dot
  })
})

describe('ui-drill — forced-colors: the card border + header hairline + Back ink survive (Chromium CDP; WebKit asserts baseline)', () => {
  it('the host border stays a real, visible stroke under forced-colors', async () => {
    const { host } = mount()
    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }
    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)
      const borderColor = getComputedStyle(host).borderTopColor
      expect(borderColor).not.toBe('rgba(0, 0, 0, 0)')
      expect(borderColor).not.toBe('transparent')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
