import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'
import type { UIPopoverElement } from './popover.ts'

// Wave-4 S1 browser smoke — ui-popover (decomp S1 · overlay-controller.lld.md LLD-C1..C4 · ADR-0043).
//
// THIS IS THE ⭐ ADR-0043 OVERLAY-HALF GATE — S1's green smoke (Chromium + WebKit) ratifies the
// overlay controller. Runs in BOTH Chromium AND WebKit (overlays are WebKit-sensitive; a
// Chromium-only pass is NOT a pass per the wave-4 baked-in lessons).
//
// What is proven here (none of this resolves in jsdom):
//   [1] open round-trip — showPopover()/hidePopover() in a real engine (both engines)
//   [2] TOP LAYER — the panel renders above an `overflow:hidden`/`transform` ancestor (both engines)
//   [3] Light-dismiss via ESCAPE — closes + syncs open=false + emits close (both engines)
//   [4] Light-dismiss via OUTSIDE-CLICK — closes + syncs open=false (both engines)
//   [5] Positioning — panel appears at the correct side + flip/shift at viewport edge (both engines)
//   [6] WHOLE-SHAPE — trigger + panel have real rendered bounding boxes (the Test-the-whole-shape law)
//   [7] forced-colors — panel surface + frame survive (Chromium via CDP; WebKit asserts the baseline)
//
// Side-effect imports — the CSS load order (ADR-0003): foundation roles + dimensional ramp FIRST,
// then the popover sheet, then the self-defining module. Imported DIRECTLY (relative), NOT via the
// component-styles barrel (the s12 barrel wiring lands at the integration slice).
import '@agent-ui/components/foundation-styles.css'
import './popover.css'
import './popover.ts'

// ── mount/cleanup ─────────────────────────────────────────────────────────────────────────────

const mounted: HTMLElement[] = []

/**
 * Mount a ui-popover into a realistic container (a display:flex row — the doc-specimen context per
 * the Test-the-whole-shape law). The popover panel is in the top layer when open, so the container
 * only affects the trigger layout (the panel escapes via the Popover API).
 */
function mount(markup: string): { wrap: HTMLElement; el: UIPopoverElement } {
  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  wrap.style.flexDirection = 'row'
  wrap.style.gap = '8px'
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const el = wrap.querySelector('ui-popover') as UIPopoverElement
  return { wrap, el }
}

afterEach(async () => {
  await userEvent.unhover(document.body)
  while (mounted.length) {
    const m = mounted.pop()!
    // Close any open popover panels before the next test (avoid stale top-layer state).
    const panels = m.querySelectorAll<HTMLElement>('[data-part="panel"]')
    for (const panel of panels) {
      if ((panel as HTMLElement & { hidePopover?: () => void }).hidePopover) {
        try { panel.hidePopover() } catch (_) { /* already hidden */ }
      }
    }
    m.remove()
  }
})

const px = (v: string): number => Number.parseFloat(v)

/** Alpha of a computed colour string. */
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

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] open round-trip — showPopover()/hidePopover() in a real engine (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-popover — open round-trip via the native Popover API (both engines)', () => {
  it('open=true shows the panel (popover is open + renders a box); open=false hides it', async () => {
    const { el } = mount(
      '<ui-popover><button>Toggle</button><p>Popover content</p></ui-popover>',
    )
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!

    expect(panel.matches(':popover-open'), 'panel should be hidden by default').toBe(false)

    el.open = true
    await el.updateComplete
    expect(panel.matches(':popover-open'), `${server.browser}: panel did not enter the top layer`).toBe(true)
    // Whole-shape: the open panel MUST render a real bounding box (not collapsed)
    const openRect = panel.getBoundingClientRect()
    expect(openRect.width, `${server.browser}: panel collapsed to zero width — the whole-shape DoD`).toBeGreaterThan(0)
    expect(openRect.height, `${server.browser}: panel collapsed to zero height — the whole-shape DoD`).toBeGreaterThan(0)

    el.open = false
    await el.updateComplete
    expect(panel.matches(':popover-open'), `${server.browser}: panel did not leave the top layer`).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] TOP LAYER — panel renders above an overflow:hidden and a transform ancestor
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-popover — top layer escapes overflow:hidden and transform ancestors (both engines)', () => {
  it('the open panel paints ABOVE an overflow:hidden ancestor (elementFromPoint hits the panel, not the clip)', async () => {
    const { wrap, el } = mount(`
      <div style="overflow:hidden;width:80px;height:40px;position:relative">
        <ui-popover style="display:contents">
          <button>Toggle</button>
          <div><p>Popover content that exceeds the clipping ancestor</p></div>
        </ui-popover>
      </div>
    `)
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!

    el.open = true
    await el.updateComplete

    // Position the hit-test at the panel's top-left corner — it should be in the top layer and
    // reachable by elementFromPoint (the overflow:hidden ancestor cannot clip the Popover top layer).
    const rect = panel.getBoundingClientRect()
    expect(rect.width, 'panel collapsed — top-layer escape is untestable').toBeGreaterThan(0)

    const cx = Math.round(rect.left + rect.width / 2)
    const cy = Math.round(rect.top + rect.height / 2)
    const hit = document.elementFromPoint(cx, cy)
    expect(hit, 'nothing was hit at the panel centre').not.toBeNull()
    expect(
      panel === hit || panel.contains(hit),
      `${server.browser}: the panel did not paint in the top layer (overflow:hidden ancestor occluded it)`,
    ).toBe(true)
    void wrap
  })

  it('the open panel paints ABOVE a transform ancestor (top-layer escapes stacking contexts)', async () => {
    const { el } = mount(`
      <div style="transform:scale(1);overflow:hidden;width:80px;height:40px">
        <ui-popover style="display:contents">
          <button>Toggle</button>
          <div><p>Content</p></div>
        </ui-popover>
      </div>
    `)
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    el.open = true
    await el.updateComplete

    const rect = panel.getBoundingClientRect()
    expect(rect.width, 'panel collapsed under transform ancestor').toBeGreaterThan(0)
    const hit = document.elementFromPoint(
      Math.round(rect.left + rect.width / 2),
      Math.round(rect.top + rect.height / 2),
    )
    expect(
      panel === hit || panel.contains(hit),
      `${server.browser}: transform ancestor occluded the panel (top layer did not escape)`,
    ).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] Light-dismiss via ESCAPE — closes + syncs open + emits close (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-popover — Escape light-dismiss (both engines)', () => {
  it('Escape closes the panel, syncs open=false, and emits close + toggle', async () => {
    const { el } = mount(
      '<ui-popover><button>Toggle</button><p>Content</p></ui-popover>',
    )
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!

    el.open = true
    await el.updateComplete
    expect(panel.matches(':popover-open'), 'panel should be open before Escape').toBe(true)

    // Counters attached AFTER the open (which itself now announces one `toggle` — ADR-0101: every
    // real show/hide announces) so they measure ONLY the Escape-driven close+toggle pair.
    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    // Focus is in the panel (focusOnOpen=true moves it); Escape reaches the focused element.
    await userEvent.keyboard('{Escape}')
    // The Popover API toggle event is spec-queued as a task (not a microtask), so it fires AFTER
    // userEvent + updateComplete. Let the queued task run before asserting the synced prop/events.
    await new Promise((r) => setTimeout(r, 0)) // let the queued Popover toggle task run (close-sync)
    await el.updateComplete                    // flush the resulting reactive effect

    expect(panel.matches(':popover-open'), `${server.browser}: Escape did not close the panel`).toBe(false)
    expect(el.open, 'open prop did not sync to false after Escape').toBe(false)
    expect(closes, 'close event did not fire on Escape').toBe(1)
    expect(toggles, 'toggle event did not fire on Escape').toBe(1)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [4] Light-dismiss via outside-click — closes + syncs open (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-popover — outside-click light-dismiss (both engines)', () => {
  it('clicking OUTSIDE the open panel closes it and syncs open=false (popover=auto behaviour)', async () => {
    const { el } = mount(
      '<ui-popover><button>Toggle</button><p>Content</p></ui-popover>',
    )
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!

    // A DEDICATED outside target, pinned to a clear corner. Clicking a bare body point is unsafe:
    // the mount wrapper sits at the body's top-left, so {x:1,y:1} lands on the TRIGGER — a trigger
    // click is a component-driven toggle-close (isOpen set false before hidePopover), which now
    // ALSO announces (ADR-0101 — every real transition emits), but it is still not the PLATFORM
    // light-dismiss path this test targets. A real outside-click must miss both trigger and panel.
    const outside = document.createElement('button')
    outside.textContent = 'outside'
    outside.style.cssText = 'position:fixed;bottom:8px;right:8px'
    document.body.append(outside)
    mounted.push(outside)

    el.open = true
    await el.updateComplete
    expect(panel.matches(':popover-open'), 'panel should be open').toBe(true)

    // Outside-click = light-dismiss for popover=auto — click the dedicated outside target.
    await userEvent.click(outside)
    // The Popover API toggle event is spec-queued as a task (not a microtask) — let it run before
    // asserting the synced prop (same timing fix as the Escape path above).
    await new Promise((r) => setTimeout(r, 0)) // let the queued Popover toggle task run (close-sync)
    await el.updateComplete                    // flush the resulting reactive effect

    expect(panel.matches(':popover-open'), `${server.browser}: outside-click did not close the panel`).toBe(false)
    expect(el.open, 'open prop did not sync to false after outside-click').toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [4b] Trigger-RECLICK-to-close under native light-dismiss — the mouse-desync fix's residual leg
// ════════════════════════════════════════════════════════════════════════════════════════════════
//
// jsdom cannot cover this (no Popover API) — this is the ONE cross-engine leg the mouse-desync fix
// review flagged as untested. The trigger carries no `popovertarget`, so it is NOT a native Popover
// "invoker": the platform's own light-dismiss algorithm treats a click on it as an OUTSIDE click on
// `pointerdown` and hides the popup natively — in the SAME gesture as this control's own `click`
// listener flipping `this.open` (popover.ts ~L109-111). The hazard: the platform's `close`-sync (this
// control's `this.listen(this, 'close', () => { this.open = false })`, popover.ts ~L119-121) rides the
// platform ToggleEvent, which is spec-QUEUED AS A TASK (proven by the Escape/outside-click legs above,
// which need a `setTimeout(0)` to observe it landing) — so IF that queued close-sync raced ahead of
// this control's synchronous click handler, `this.open = !this.open` would read an already-false prop
// and REOPEN (false → true). The fix (flip the prop, not `handle.toggle()`) only holds if the click
// listener always runs — and reads `this.open` — before that queued task lands.
describe('ui-popover — trigger reclick closes under native light-dismiss (both engines)', () => {
  it('click(trigger) opens; click(trigger) again closes — no flicker-reopen from the light-dismiss/prop-flip race', async () => {
    const { el } = mount(
      '<ui-popover><button>Toggle</button><p>Content</p></ui-popover>',
    )
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!

    await userEvent.click(trigger)
    await el.updateComplete
    expect(panel.matches(':popover-open'), `${server.browser}: first click did not open the panel`).toBe(true)
    expect(el.open, 'open prop did not sync true after the first click').toBe(true)

    await userEvent.click(trigger)
    await el.updateComplete
    // Let any queued platform toggle task (native light-dismiss's OWN close, racing this control's
    // click-driven close) drain before asserting — a reopen would surface here.
    await new Promise((r) => setTimeout(r, 0))
    await el.updateComplete

    expect(
      panel.matches(':popover-open'),
      `${server.browser}: second click left the panel open (expected trigger-reclick to close it)`,
    ).toBe(false)
    expect(
      el.open,
      `${server.browser}: open prop did not settle false after the second click (flicker-reopen?)`,
    ).toBe(false)

    // Settle again after a further tick to rule out a DELAYED reopen (a second queued task racing back).
    await new Promise((r) => setTimeout(r, 0))
    expect(panel.matches(':popover-open'), `${server.browser}: panel reopened after settling — the race is real`).toBe(false)
    expect(el.open, `${server.browser}: open prop reopened after settling — the race is real`).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [5] Positioning — panel appears at bottom-start; flip/shift at viewport edge (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-popover — JS positioning controller (both engines)', () => {
  it('default placement=bottom-start: the open panel top aligns with the trigger bottom (± a few px)', async () => {
    // Mount the trigger near the top of the page so there is plenty of room below (no flip).
    const { el } = mount(
      '<ui-popover placement="bottom-start"><button style="margin-top:20px">Toggle</button><div style="height:60px;min-width:100px"><p>Content</p></div></ui-popover>',
    )
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!

    el.open = true
    await el.updateComplete

    const triggerRect = trigger.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()

    // The JS controller places the panel top at anchorRect.bottom (before shift).
    // Allow ± 8px tolerance for sub-pixel rounding and borders.
    expect(
      Math.abs(panelRect.top - triggerRect.bottom),
      `${server.browser}: panel top (${panelRect.top}) is not close to trigger bottom (${triggerRect.bottom}) — positioning broken`,
    ).toBeLessThan(8)

    // Panel left aligns with trigger left for bottom-start.
    expect(
      Math.abs(panelRect.left - triggerRect.left),
      `${server.browser}: panel left (${panelRect.left}) is not close to trigger left (${triggerRect.left}) for bottom-start`,
    ).toBeLessThan(8)

    // data-placement records the resolved placement.
    expect(panel.getAttribute('data-placement')).toBe('bottom-start')
  })

  it('flip: top-start flips to bottom-start when the trigger is too close to the top (< panel height)', async () => {
    // Mount the trigger at the VERY top of the page — top-start has no room above; should flip to bottom.
    const { el } = mount(
      '<ui-popover placement="top-start"><button style="margin-top:2px">Toggle</button><div style="height:80px;min-width:100px"><p>Content</p></div></ui-popover>',
    )
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    el.open = true
    await el.updateComplete

    // The flip condition: spaceFor['top'] < panelHeight && spaceFor['bottom'] >= panelHeight.
    // With the trigger near the top, top is insufficient → flipped to bottom.
    expect(
      panel.getAttribute('data-placement'),
      `${server.browser}: placement did not flip from top-start to bottom-start near the top edge`,
    ).toBe('bottom-start')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [6] WHOLE-SHAPE — trigger + panel gestalt (the Test-the-whole-shape law)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-popover — whole-shape assertion (the Test-the-whole-shape DoD law)', () => {
  it('the trigger renders with real dimensions AND the open panel has a non-collapsed bounding box', async () => {
    const { el } = mount(`
      <ui-popover>
        <button style="padding:8px 16px">Open popover</button>
        <div style="min-inline-size:12rem;padding:16px">
          <p>This is the popover content panel.</p>
        </div>
      </ui-popover>
    `)
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!

    // Trigger in normal flow: must have real dimensions (a button with padding → non-zero box)
    const triggerRect = trigger.getBoundingClientRect()
    expect(triggerRect.width, `${server.browser}: trigger collapsed to zero width`).toBeGreaterThan(0)
    expect(triggerRect.height, `${server.browser}: trigger collapsed to zero height`).toBeGreaterThan(0)

    // Trigger width > height (a button is wider than tall — the disclosure trigger gestalt)
    expect(
      triggerRect.width,
      `${server.browser}: trigger is taller than wide (unexpected button aspect ratio)`,
    ).toBeGreaterThan(triggerRect.height)

    // Panel: must not exist in the normal flow / must be hidden before open
    expect(panel.matches(':popover-open'), 'panel is open before explicit open=true').toBe(false)

    el.open = true
    await el.updateComplete

    // Panel: must have a real bounding box in the top layer (the whole-shape law)
    const panelRect = panel.getBoundingClientRect()
    expect(panelRect.width, `${server.browser}: panel collapsed to zero width — no min-inline-size floor?`).toBeGreaterThan(0)
    expect(panelRect.height, `${server.browser}: panel collapsed to zero height — no content or padding?`).toBeGreaterThan(0)

    // Anti-vacuous: the panel has a minimum inline-size floor (--ui-popover-min-inline-size)
    // so even an empty panel does not collapse. The computed min-inline-size must be positive.
    const minWidth = px(getComputedStyle(panel).minInlineSize)
    expect(minWidth, `${server.browser}: panel min-inline-size is not a positive px — collapse risk`).toBeGreaterThan(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [7] forced-colors — panel surface + frame survive (Chromium via CDP; WebKit baseline)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-popover — forced-colors (Chromium via CDP; WebKit asserts the baseline)', () => {
  it('panel surface + frame are visible in normal mode AND survive forced-colors', async () => {
    const { el } = mount(
      '<ui-popover><button>Toggle</button><p>Content</p></ui-popover>',
    )
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    el.open = true
    await el.updateComplete

    // Baseline (BOTH engines, normal mode): the panel has a visible opaque background + border —
    // ensures the forced-colors assertion below is non-vacuous.
    expect(
      alphaOf(getComputedStyle(panel).backgroundColor),
      `${server.browser}: the panel surface has no background in normal mode (forced-colors check would be vacuous)`,
    ).toBeGreaterThan(0)
    expect(
      px(getComputedStyle(panel).borderTopWidth),
      `${server.browser}: the panel frame has no border in normal mode`,
    ).toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      // WebKit: no CDP / forced-colors emulation — assert we are NOT in forced-colors (so the
      // Chromium proof is not silently faked) and stop.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'forced-colors', value: 'active' }],
    })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)

      // Panel surface + frame + ink survive as system Canvas/CanvasText (the forced-colors block
      // in popover.css explicitly repaints them — the background must remain opaque).
      expect(
        alphaOf(getComputedStyle(panel).backgroundColor),
        'panel surface vanished under forced-colors (Canvas not applied)',
      ).toBeGreaterThan(0)
      expect(
        alphaOf(getComputedStyle(panel).borderTopColor),
        'panel frame vanished under forced-colors (CanvasText border not applied)',
      ).toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
