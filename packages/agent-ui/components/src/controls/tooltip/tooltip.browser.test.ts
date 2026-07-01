import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from '@vitest/browser/context'
import type { UITooltipElement } from './tooltip.ts'

// Wave-4 S2 browser smoke — ui-tooltip (decomp S2 · overlay-controller.lld.md LLD-C1..C4 · ADR-0043).
//
// Runs in BOTH Chromium AND WebKit (overlays are WebKit-sensitive; a Chromium-only pass is NOT
// a pass per the wave-4 baked-in lessons). All tests that could be vacuous on one engine carry
// the `${server.browser}:` prefix on failure messages.
//
// What is proven here (none of this resolves in jsdom):
//   [1] Show on hover — showPopover() fires after the delay in a real engine (both engines)
//   [2] Show on keyboard focus — immediate show via focusin, no delay (both engines)
//   [3] Never steals focus — document.activeElement unchanged when tooltip opens (both engines)
//   [4] Positioning — panel appears at the correct side + flip at viewport edge (both engines)
//   [5] WHOLE-SHAPE — anchor + panel have real rendered bounding boxes
//   [6] Dismiss on Escape — closes + emits close (both engines)
//   [7] forced-colors — panel surface + frame survive (Chromium via CDP; WebKit baseline)
//
// Side-effect imports — CSS load order (ADR-0003): foundation roles FIRST, then the tooltip
// sheet, then the self-defining module. Imported DIRECTLY (relative), NOT via barrel (s12).
import '@agent-ui/components/foundation-styles.css'
import './tooltip.css'
import './tooltip.ts'

// ── mount/cleanup ─────────────────────────────────────────────────────────────────────────

const mounted: HTMLElement[] = []

/**
 * Mount a ui-tooltip into a realistic container (a display:flex row — the doc-specimen context
 * per the Test-the-whole-shape law). The panel enters the top layer, so the container only
 * affects the anchor layout.
 */
function mount(markup: string): { wrap: HTMLElement; el: UITooltipElement; anchor: HTMLElement; panel: HTMLElement } {
  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  wrap.style.flexDirection = 'row'
  wrap.style.gap = '8px'
  wrap.style.padding = '20px'
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const el = wrap.querySelector('ui-tooltip') as UITooltipElement
  const anchor = el.querySelector<HTMLElement>('[data-part="anchor"]')!
  const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
  return { wrap, el, anchor, panel }
}

afterEach(async () => {
  await userEvent.unhover(document.body)
  while (mounted.length) {
    const m = mounted.pop()!
    // Close any open tooltip panels before the next test (avoid stale top-layer state).
    const panels = m.querySelectorAll<HTMLElement>('[data-part="panel"]')
    for (const p of panels) {
      const hp = p as HTMLElement & { hidePopover?: () => void }
      if (hp.hidePopover) try { hp.hidePopover() } catch (_) { /* already hidden */ }
    }
    m.remove()
  }
})

/** Wait for a short macrotask to let setTimeout(fn, delay) timers fire. */
const waitMs = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

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
//  [1] Show on hover — showPopover() in a real engine after the delay (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-tooltip — show on hover after delay (both engines)', () => {
  it('mouseenter on the anchor opens the tooltip panel after the delay fires', async () => {
    const { el, anchor, panel } = mount(
      '<ui-tooltip><button style="padding:4px 12px">Hover me</button>Tooltip text</ui-tooltip>',
    )
    el.delay = 50 // fast for tests — still proves the delay mechanism

    expect(panel.matches(':popover-open'), 'panel should be hidden before hover').toBe(false)

    await userEvent.hover(anchor)
    // NOT open yet — delay pending
    expect(panel.matches(':popover-open'), 'panel must not open before the delay fires').toBe(false)

    // Wait for the delay + a safety margin
    await waitMs(150)
    await el.updateComplete

    expect(panel.matches(':popover-open'), `${server.browser}: panel did not enter the top layer after hover delay`).toBe(true)
    expect(el.open, 'open prop must be true after hover delay').toBe(true)
  })

  it('mouseleave before the delay fires cancels the show', async () => {
    const { el, anchor, panel } = mount(
      '<ui-tooltip><button style="padding:4px 12px">Hover me</button>Tooltip text</ui-tooltip>',
    )
    el.delay = 300

    await userEvent.hover(anchor)
    // unhover before the delay fires
    await userEvent.unhover(anchor)
    await waitMs(400) // past original delay — the cancelled timer must not fire
    await el.updateComplete

    expect(panel.matches(':popover-open'), `${server.browser}: tooltip opened after hover was cancelled`).toBe(false)
    expect(el.open).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] Show on keyboard focus — immediate, no delay (a11y — both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-tooltip — show immediately on keyboard focus (both engines)', () => {
  it('focusin on the anchor opens the tooltip immediately (no delay)', async () => {
    const { el, anchor, panel } = mount(
      '<ui-tooltip><button style="padding:4px 12px">Focus me</button>Focus tooltip</ui-tooltip>',
    )
    el.delay = 30_000 // huge delay — proves focus path is independent

    // Focus the anchor directly (keyboard Tab simulation)
    anchor.focus()
    await el.updateComplete

    expect(panel.matches(':popover-open'), `${server.browser}: focusin did not open the tooltip immediately`).toBe(true)
    expect(el.open).toBe(true)
  })

  it('focusout closes the open tooltip and emits close+toggle', async () => {
    const { el, anchor } = mount(
      '<ui-tooltip><button style="padding:4px 12px">Focus me</button>Tooltip text</ui-tooltip>',
    )

    anchor.focus()
    await el.updateComplete
    expect(el.open).toBe(true)

    let closes = 0; let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    anchor.blur()
    await el.updateComplete

    expect(el.open, `${server.browser}: focusout did not close the tooltip`).toBe(false)
    expect(closes).toBe(1)
    expect(toggles).toBe(1)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] Never steals focus (focusOnOpen=false — both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-tooltip — never steals focus (both engines)', () => {
  it('hover-triggered open does NOT move document.activeElement', async () => {
    const { el, anchor, panel } = mount(
      '<ui-tooltip><button style="padding:4px 12px">Hover</button>Tooltip text</ui-tooltip>',
    )
    el.delay = 50

    // Place focus on an external element (not the anchor).
    const external = document.createElement('button')
    external.textContent = 'External focus target'
    document.body.append(external)
    external.focus()
    const focusedBefore = document.activeElement

    await userEvent.hover(anchor)
    await waitMs(150)
    await el.updateComplete

    expect(panel.matches(':popover-open'), `${server.browser}: panel did not open for focus-steal test`).toBe(true)
    expect(
      document.activeElement,
      `${server.browser}: hover-open tooltip stole focus from ${focusedBefore?.tagName ?? 'null'}`,
    ).toBe(focusedBefore)

    external.remove()
  })

  it('focus-triggered open keeps activeElement on the anchor (not moved to panel)', async () => {
    const { el, anchor, panel } = mount(
      '<ui-tooltip><button style="padding:4px 12px">Focus</button>Tooltip text</ui-tooltip>',
    )

    anchor.focus()
    await el.updateComplete

    expect(panel.matches(':popover-open'), 'panel should be open').toBe(true)
    expect(
      document.activeElement,
      `${server.browser}: tooltip panel should not have received focus (focusOnOpen=false)`,
    ).not.toBe(panel)
    expect(document.activeElement).toBe(anchor) // focus stays on the anchor
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [4] Positioning — panel at bottom-start; flip at viewport edge (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-tooltip — JS positioning controller (both engines)', () => {
  it('default placement=bottom-start: panel top aligns with anchor bottom (± 8px tolerance)', async () => {
    const { el, anchor, panel } = mount(
      '<ui-tooltip placement="bottom-start"><button style="margin-top:30px;padding:4px 12px">Anchor</button><span>Tooltip content</span></ui-tooltip>',
    )
    el.delay = 0

    anchor.focus()
    await el.updateComplete

    const anchorRect = anchor.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()

    expect(
      Math.abs(panelRect.top - anchorRect.bottom),
      `${server.browser}: panel top (${panelRect.top}) not close to anchor bottom (${anchorRect.bottom})`,
    ).toBeLessThan(8)

    expect(panel.getAttribute('data-placement')).toBe('bottom-start')
  })

  it('flip: top-start flips to bottom-start when anchor is near the top of the viewport', async () => {
    const { el, anchor, panel } = mount(
      '<ui-tooltip placement="top-start"><button style="margin-top:2px;padding:4px 12px">Top anchor</button><span style="min-inline-size:8rem">Tooltip content</span></ui-tooltip>',
    )
    el.delay = 0

    anchor.focus()
    await el.updateComplete

    // Near the top → top-start has no room → flips to bottom-start
    expect(
      panel.getAttribute('data-placement'),
      `${server.browser}: placement did not flip from top-start near the viewport top`,
    ).toBe('bottom-start')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [5] WHOLE-SHAPE — anchor + panel non-collapsed bounding boxes (the Test-the-whole-shape law)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-tooltip — whole-shape assertion (the Test-the-whole-shape DoD law)', () => {
  it('the anchor has real dimensions AND the open panel has a non-collapsed bounding box', async () => {
    const { el, anchor, panel } = mount(`
      <ui-tooltip>
        <button style="padding:8px 16px">Hover for tooltip</button>
        <span>This is the tooltip description.</span>
      </ui-tooltip>
    `)
    el.delay = 0

    // Anchor in normal flow: must render a real box (a padded button → non-zero dimensions).
    const anchorRect = anchor.getBoundingClientRect()
    expect(anchorRect.width, `${server.browser}: anchor collapsed to zero width`).toBeGreaterThan(0)
    expect(anchorRect.height, `${server.browser}: anchor collapsed to zero height`).toBeGreaterThan(0)

    // Panel: must be hidden before open.
    expect(panel.matches(':popover-open'), 'panel should be hidden before open').toBe(false)

    // Open via focus (no delay for the whole-shape test — we just need the box).
    anchor.focus()
    await el.updateComplete

    // Panel: must have a real bounding box in the top layer.
    const panelRect = panel.getBoundingClientRect()
    expect(panelRect.width, `${server.browser}: panel collapsed to zero width — no min-inline-size floor?`).toBeGreaterThan(0)
    expect(panelRect.height, `${server.browser}: panel collapsed to zero height — no content or padding?`).toBeGreaterThan(0)

    // Anti-vacuous: verify the computed min-inline-size is positive (the ADR-0021 floor).
    const minWidth = px(getComputedStyle(panel).minInlineSize)
    expect(minWidth, `${server.browser}: panel min-inline-size is not positive — collapse risk`).toBeGreaterThan(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [6] Dismiss on Escape — closes + emits close (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-tooltip — Escape dismiss (both engines)', () => {
  it('Escape closes the tooltip, syncs open=false, and emits close + toggle', async () => {
    const { el, anchor, panel } = mount(
      '<ui-tooltip><button style="padding:4px 12px">Focus me</button>Tooltip text</ui-tooltip>',
    )
    el.delay = 0

    anchor.focus()
    await el.updateComplete
    expect(panel.matches(':popover-open'), 'panel should be open before Escape').toBe(true)

    let closes = 0; let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    // Focus is on the anchor — Escape fires on the document (our keydown listener).
    await userEvent.keyboard('{Escape}')
    await el.updateComplete

    expect(panel.matches(':popover-open'), `${server.browser}: Escape did not close the tooltip`).toBe(false)
    expect(el.open, 'open prop did not sync to false after Escape').toBe(false)
    expect(closes, 'close event did not fire on Escape').toBe(1)
    expect(toggles, 'toggle event did not fire on Escape').toBe(1)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [7] forced-colors — panel surface + frame survive (Chromium via CDP; WebKit baseline)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-tooltip — forced-colors (Chromium via CDP; WebKit asserts the baseline)', () => {
  it('panel surface + frame are visible in normal mode AND survive forced-colors', async () => {
    const { el, anchor, panel } = mount(
      '<ui-tooltip><button style="padding:4px 12px">Focus me</button>Tooltip text</ui-tooltip>',
    )
    el.delay = 0

    anchor.focus()
    await el.updateComplete

    // Baseline (BOTH engines, normal mode): the panel has an opaque background + border —
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
      // WebKit: no CDP / forced-colors emulation — assert we are NOT in forced-colors (so
      // the Chromium proof is not silently faked) and stop.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'forced-colors', value: 'active' }],
    })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)

      // Panel surface + frame + ink survive as system Canvas/CanvasText.
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
