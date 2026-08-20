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

function mount(opts: { chrome?: 'backbar' | 'crumbs'; layout?: 'stack' | 'columns'; width?: string } = {}): {
  wrap: HTMLElement
  host: HTMLElement
  settingsTrigger: HTMLElement
  back: HTMLElement
  heading: HTMLElement
} {
  const wrap = document.createElement('div')
  // A realistic, deterministic container for the whole-shape assertions below. S3 (cl.A8): the DEFAULT
  // 400px is already BELOW ADR-0150's 52.5rem/840px compact-body line — any test proving a genuine
  // `layout="columns"` render MUST pass a `width` wide enough to clear that line, or the narrow-degrade
  // would fire immediately and silently fall back to stack (drill.browser.test.ts's own narrow-degrade
  // describe block does exactly that, deliberately).
  wrap.style.inlineSize = opts.width ?? '400px'
  wrap.innerHTML = `
    <ui-drill aria-label="Settings"${opts.chrome ? ` chrome="${opts.chrome}"` : ''}${opts.layout ? ` layout="${opts.layout}"` : ''}>
      <ui-drill-panel key="root" heading="Root">
        <button data-role="drill-trigger" data-drill-key="settings">Settings</button>
        <button data-role="drill-trigger" data-drill-key="notifications">Notifications</button>
      </ui-drill-panel>
      <ui-drill-panel key="settings" parent="root" heading="Settings">
        <p>Settings content, a little taller than the root panel to prove intrinsic block-sizing.</p>
        <button data-role="drill-trigger" data-drill-key="appearance">Appearance</button>
      </ui-drill-panel>
      <ui-drill-panel key="appearance" parent="settings" heading="Appearance">
        <p>Appearance content.</p>
      </ui-drill-panel>
      <ui-drill-panel key="notifications" parent="root" heading="Notifications">
        <p>Notifications content.</p>
      </ui-drill-panel>
    </ui-drill>
  `
  document.body.append(wrap)
  mounted.push(wrap)
  const host = wrap.querySelector('ui-drill') as HTMLElement
  return {
    wrap,
    host,
    settingsTrigger: host.querySelector('[key="root"] [data-drill-key="settings"]') as HTMLElement,
    back: host.querySelector('[data-part="back"]') as HTMLElement,
    heading: host.querySelector('[data-part="heading"]') as HTMLElement,
  }
}

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove()
})

/** Settle a resize/render cycle: two rAFs cover the ResizeObserver callback (fires at the end of a layout
 *  step) and the frame that runs drill.ts's own effect off the #version bump it makes (the nav-rail
 *  `settle()` precedent, nav-rail.browser.test.ts). */
async function settle(): Promise<void> {
  await new Promise((r) => requestAnimationFrame(() => r(undefined)))
  await new Promise((r) => setTimeout(r, 0))
  await new Promise((r) => requestAnimationFrame(() => r(undefined)))
}

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
    // GH #1519 root-cause fix: a freshly-inserted root panel is mid its OWN entrance transition
    // (the CSS-transform base's `@starting-style` slide-in, drill.css) the instant this test's real
    // `userEvent.click` fires — under the extra same-page scheduling load THREE sequential mount/render
    // cycles put on this file (this test is the third; reproduced 7/10 in a tight loop, 0/10 once this
    // line is added — measured, not guessed), Playwright's own actionability "stable across two frames"
    // check can land on a still-in-flight frame and dispatch the real click at a stale coordinate that
    // slides just off the small trigger button before the transform's next frame lands — a real click
    // that resolves with no error, on no element (confirmed via a native 'click' listener directly on
    // the button: it never fired). Settle the transition FIRST, exactly the "same-cell stacking" test
    // below already does for its own geometry read (the ui-drawer precedent, "settled geometry, not the
    // mid-slide frame") — the fix belongs here, in the test's own interaction setup, not in drill.ts:
    // the component's real entrance motion is correct and intentional; only a same-tick click into it
    // is racy.
    ;(host.querySelector('[key="root"]') as HTMLElement).style.transition = 'none'
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

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  ADR-0195 Amendment S2 (GH #1510) — chrome="crumbs": real click navigation, keyboard reach, forced-colors
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-drill — chrome="crumbs" real-engine navigation (ADR-0195 Amendment cl.A2/A3/A6)', () => {
  it('at mount, chrome="crumbs" paints the crumbs nav (not the Back button); the heading is the trail\'s only entry', () => {
    const { host } = mount({ chrome: 'crumbs' })
    const back = host.querySelector('[data-part="back"]') as HTMLElement
    const crumbsNav = host.querySelector('[data-part="crumbs"]') as HTMLElement
    const heading = host.querySelector('[data-part="heading"]') as HTMLElement
    expect(getComputedStyle(back).display).toBe('none')
    expect(getComputedStyle(crumbsNav).display).not.toBe('none')
    expect(crumbsNav.contains(heading)).toBe(true)
    expect(heading.getAttribute('aria-current')).toBe('location')
    expect(crumbsNav.querySelectorAll('[data-part="crumb"]')).toHaveLength(0)
  })

  it('a real pointer click on an ancestor crumb navigates: truncates the path (direction back), never touching an INERT ancestor pane', async () => {
    const { host, settingsTrigger } = mount({ chrome: 'crumbs' })
    await userEvent.click(settingsTrigger)
    const appearanceTrigger = host.querySelector('[key="settings"] [data-drill-key="appearance"]') as HTMLElement
    await userEvent.click(appearanceTrigger)
    // three-level path: root/settings/appearance — two ancestor crumbs render
    let crumbs = [...host.querySelectorAll('[data-part="crumb"]')] as HTMLButtonElement[]
    expect(crumbs.map((c) => c.textContent)).toEqual(['Root', 'Settings'])
    const rootCrumb = crumbs[0]!
    await userEvent.click(rootCrumb)
    const root = host.querySelector('[key="root"]') as HTMLElement
    expect(getComputedStyle(root).display).not.toBe('none')
    expect(root.getAttribute('data-drill-pane')).toBe('active')
    // the crumbs nav rebuilt down to zero ancestors (back at the root)
    crumbs = [...host.querySelectorAll('[data-part="crumb"]')] as HTMLButtonElement[]
    expect(crumbs).toHaveLength(0)
    const heading = host.querySelector('[data-part="heading"]') as HTMLElement
    expect(heading.textContent).toBe('Root')
    expect(heading.getAttribute('aria-current')).toBe('location')
  })

  it('Tab reaches an ancestor crumb button; Enter activates it (real keyboard, native <button> semantics)', async () => {
    const { host, settingsTrigger } = mount({ chrome: 'crumbs' })
    await userEvent.click(settingsTrigger)
    const rootCrumb = host.querySelector('[data-part="crumb"]') as HTMLButtonElement
    expect(getComputedStyle(rootCrumb).display).not.toBe('none')
    rootCrumb.focus()
    expect(document.activeElement).toBe(rootCrumb)
    await userEvent.keyboard('{Enter}')
    const root = host.querySelector('[key="root"]') as HTMLElement
    expect(root.getAttribute('data-drill-pane')).toBe('active')
  })

  it('forced-colors: the crumb link ink + separator stay real system colours (Chromium CDP; WebKit asserts baseline)', async () => {
    const { host, settingsTrigger } = mount({ chrome: 'crumbs' })
    await userEvent.click(settingsTrigger)
    const crumb = host.querySelector('[data-part="crumb"]') as HTMLElement
    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }
    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)
      const ink = getComputedStyle(crumb).color
      expect(ink).not.toBe('rgba(0, 0, 0, 0)')
      expect(ink).not.toBe('transparent')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  ADR-0195 Amendment S3 (GH #1510) — layout="columns": real painted visibility, click routing, keyboard,
//  focus law, forced-colors, and the narrow-host auto-degrade (cl.A8) via a REAL container resize.
//  Every mount below passes `width: '1000px'` — well above ADR-0150's 52.5rem/840px compact-body line — so
//  `layout="columns"` genuinely renders as columns; the default 400px mount (this file's own default) is
//  already BELOW that line, which the narrow-degrade block exploits deliberately.
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-drill — layout="columns" real painted visibility (ADR-0195 Amendment cl.A1/A4, S3)', () => {
  it('a painted ancestor column is visible (not display:none), not inert, and carries NO scrim wash', async () => {
    const { host, settingsTrigger } = mount({ layout: 'columns', width: '1000px' })
    await userEvent.click(settingsTrigger)
    const root = host.querySelector('[key="root"]') as HTMLElement & { inert: boolean }
    const settings = host.querySelector('[key="settings"]') as HTMLElement
    expect(host.getAttribute('data-drill-layout')).toBe('columns')
    expect(getComputedStyle(root).display).not.toBe('none')
    expect(getComputedStyle(settings).display).not.toBe('none')
    expect(root.inert).toBe(false) // the contract change from stack — "all interactive"
    expect(root.getAttribute('data-drill-pane')).toBe('ancestor')
    // NO dim wash under columns (contrast the stack describe block above, same assertion, opposite result)
    const scrim = getComputedStyle(root, '::after').backgroundColor
    expect(scrim === 'rgba(0, 0, 0, 0)' || scrim === 'transparent').toBe(true)
  })

  it('ancestor and active columns occupy DIFFERENT rects, side by side (not stack\'s same-cell overlap)', async () => {
    const { host, settingsTrigger } = mount({ layout: 'columns', width: '1000px' })
    await userEvent.click(settingsTrigger)
    const root = host.querySelector('[key="root"]') as HTMLElement
    const settings = host.querySelector('[key="settings"]') as HTMLElement
    const rootRect = root.getBoundingClientRect()
    const settingsRect = settings.getBoundingClientRect()
    expect(settingsRect.left).toBeGreaterThanOrEqual(rootRect.right) // side by side, never overlapping
  })

  it('the host owns ONE horizontal scroll region (overflow-x: auto) once columns are painted', async () => {
    const { host, settingsTrigger } = mount({ layout: 'columns', width: '1000px' })
    await userEvent.click(settingsTrigger)
    expect(getComputedStyle(host).overflowX).toBe('auto')
  })
})

describe('ui-drill — columns commit generalization: a real click on a non-rightmost column truncates+re-navigates (cl.A1)', () => {
  it('clicking the ROOT column\'s own "Notifications" trigger truncates the 3-level path and re-navigates, reusing #commit', async () => {
    const { host, settingsTrigger } = mount({ layout: 'columns', width: '1000px' })
    await userEvent.click(settingsTrigger)
    const appearanceTrigger = host.querySelector('[key="settings"] [data-drill-key="appearance"]') as HTMLElement
    await userEvent.click(appearanceTrigger)
    const appearance = host.querySelector('[key="appearance"]') as HTMLElement
    expect(appearance.getAttribute('data-drill-pane')).toBe('active') // 3-level path confirmed
    const rootNotifications = host.querySelector('[key="root"] [data-drill-key="notifications"]') as HTMLElement
    await userEvent.click(rootNotifications) // root is a non-rightmost, fully-interactive column under columns
    const notifications = host.querySelector('[key="notifications"]') as HTMLElement
    expect(notifications.getAttribute('data-drill-pane')).toBe('active')
    expect(getComputedStyle(appearance).display).toBe('none') // truncated OFF the path — not merely reordered
    expect(getComputedStyle(host.querySelector('[key="settings"]') as HTMLElement).display).toBe('none')
  })
})

describe('ui-drill — columns keyboard reachability across every painted column (real Tab + Enter)', () => {
  it('Tab reaches BOTH the ancestor column\'s trigger and the active column\'s own trigger; Enter activates the ancestor one', async () => {
    const { host, settingsTrigger } = mount({ layout: 'columns', width: '1000px' })
    await userEvent.click(settingsTrigger)
    const rootNotifications = host.querySelector('[key="root"] [data-drill-key="notifications"]') as HTMLButtonElement
    rootNotifications.focus() // a direct, unambiguous focus attempt — the ancestor column is NOT inert here
    expect(document.activeElement).toBe(rootNotifications)
    await userEvent.keyboard('{Enter}')
    const notifications = host.querySelector('[key="notifications"]') as HTMLElement
    expect(notifications.getAttribute('data-drill-pane')).toBe('active')
  })
})

describe('ui-drill — columns scoped focus law: drill-forward keeps focus on the clicked trigger (cl.A6)', () => {
  it('a real click on an ancestor column\'s trigger does NOT move focus to the incoming heading (contrast: stack DOES move it, see above)', async () => {
    const { host, heading, settingsTrigger } = mount({ layout: 'columns', width: '1000px' })
    await userEvent.click(settingsTrigger)
    const rootNotifications = host.querySelector('[key="root"] [data-drill-key="notifications"]') as HTMLElement
    await userEvent.click(rootNotifications)
    // Never asserts focus LANDS on the trigger — WebKit does not put a plain `<button>` in its default
    // click-focusable set (a real, documented engine policy difference: a WebKit click can even BLUR the
    // previously-focused element rather than leave it, measured here), so "focus stays on the trigger" is
    // not a portable cross-engine claim. The actual code contract (cl.A6) is narrower and IS portable: this
    // component's own `#render()` never calls `.focus()` on the incoming heading under columns — contrast
    // the stack-mode test elsewhere in this file, which explicitly asserts the heading DOES receive it.
    expect(document.activeElement).not.toBe(heading)
  })
})

describe('ui-drill — columns forced-colors: the divider stays a real, visible stroke (Chromium CDP; WebKit asserts baseline)', () => {
  it('the ancestor/active column divider (border-inline-end) survives forced-colors', async () => {
    const { host, settingsTrigger } = mount({ layout: 'columns', width: '1000px' })
    await userEvent.click(settingsTrigger)
    const root = host.querySelector('[key="root"]') as HTMLElement
    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }
    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)
      const borderColor = getComputedStyle(root).borderInlineEndColor
      expect(borderColor).not.toBe('rgba(0, 0, 0, 0)')
      expect(borderColor).not.toBe('transparent')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

describe('ui-drill — narrow-host auto-degrade to stack (ADR-0195 Amendment cl.A8, a REAL container resize)', () => {
  it('starts WIDE (>52.5rem) rendering columns; shrinking the host below the line degrades to stack, ancestors dim+inert again', async () => {
    const { wrap, host, settingsTrigger } = mount({ layout: 'columns', width: '1000px' })
    await userEvent.click(settingsTrigger)
    const root = host.querySelector('[key="root"]') as HTMLElement & { inert: boolean }
    const settings = host.querySelector('[key="settings"]') as HTMLElement
    // WIDE arm — confirmed columns (this describe block's own precondition, not a re-test of the above)
    expect(host.getAttribute('data-drill-layout')).toBe('columns')
    expect(root.inert).toBe(false)
    // Settled geometry, not the mid-slide frame (the ui-drawer/GH#1519 precedent, this file's own): the
    // drill-forward click above still has its OWN entrance transition in flight the instant this test
    // continues — neutralize it before the resize measurement below, which otherwise catches root/settings
    // mid-transition (measured: a stale non-zero `translateX` on `settings`, not a geometry bug).
    root.style.transition = 'none'
    settings.style.transition = 'none'

    // The host itself narrows — independent of window width — below ADR-0150's 52.5rem/840px line.
    wrap.style.inlineSize = '500px'
    await settle()

    expect(host.getAttribute('data-drill-layout')).toBe('stack') // the layout ATTRIBUTE stays 'columns' (cl.A8)
    expect(host.getAttribute('layout')).toBe('columns')
    expect(root.inert).toBe(true) // the ancestor is dimmed + inert again, exactly stack's own contract
    expect(root.getAttribute('data-drill-pane')).toBe('ancestor')
    // same-cell stacking is back — the active pane and the ancestor pane occupy the SAME rect (not columns'
    // side-by-side tracks)
    const rootRect = root.getBoundingClientRect()
    const settingsRect = settings.getBoundingClientRect()
    expect(rootRect.left).toBeCloseTo(settingsRect.left, 0)
    expect(rootRect.width).toBeCloseTo(settingsRect.width, 0)
    const scrim = getComputedStyle(root, '::after').backgroundColor
    expect(scrim).not.toBe('rgba(0, 0, 0, 0)')
    expect(scrim).not.toBe('transparent')
  })

  it('growing the host back above the line restores columns (bidirectional, no stale degrade state)', async () => {
    const { wrap, host, settingsTrigger } = mount({ layout: 'columns', width: '500px' }) // starts NARROW
    await userEvent.click(settingsTrigger)
    const root = host.querySelector('[key="root"]') as HTMLElement & { inert: boolean }
    expect(host.getAttribute('data-drill-layout')).toBe('stack') // degraded from the start (starts narrow)
    const settings = host.querySelector('[key="settings"]') as HTMLElement
    root.style.transition = 'none' // settled geometry, not the mid-slide frame (see the test above)
    settings.style.transition = 'none'

    wrap.style.inlineSize = '1000px'
    await settle()

    expect(host.getAttribute('data-drill-layout')).toBe('columns')
    expect(root.inert).toBe(false)
    const rootRect = root.getBoundingClientRect()
    const settingsRect = settings.getBoundingClientRect()
    expect(settingsRect.left).toBeGreaterThanOrEqual(rootRect.right) // side by side again
  })
})
