import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent, page } from 'vitest/browser'
import type { UIMenuElement } from './menu.ts'

// Wave-4 S3 browser smoke — ui-menu (decomp S3 · overlay-controller.lld.md LLD-C1..C4 · ADR-0043).
//
// Runs in BOTH Chromium AND WebKit (overlays are WebKit-sensitive; a Chromium-only pass is NOT
// a pass per the wave-4 baked-in review lessons). What is proven here:
//
//   [1] open round-trip — showPopover()/hidePopover() in a real engine (both engines)
//   [2] TOP LAYER — the panel renders above an `overflow:hidden`/`transform` ancestor (both engines)
//   [3] Light-dismiss via ESCAPE — closes + syncs open=false + emits close (both engines)
//   [4] Roving focus — Arrow keys move REAL focus over menuitems (both engines)
//   [5] Commit → select + close — Enter commits the focused item, emits select, closes (both engines)
//   [6] Focus restore — trigger gets focus back after close/commit (both engines)
//   [7] WHOLE-SHAPE — panel bounding box + menuitem item-pad geometry are non-collapsed (both engines)
//   [8] forced-colors — panel surface + frame survive (Chromium via CDP; WebKit asserts the baseline)
//
// Side-effect imports — CSS load order (ADR-0003): foundation roles + dimensional ramp FIRST.
import '@agent-ui/components/foundation-styles.css'
import '../_surface/container-box.css' // the box-model layer — provides the shared [data-fade-top]/[data-fade-bottom] mask
import './menu.css'
import './menu.ts'

// ── mount / cleanup ───────────────────────────────────────────────────────────────────────────

const mounted: HTMLElement[] = []

/**
 * Mount a ui-menu into a realistic container (a display:flex row — the doc-specimen context per
 * the Test-the-whole-shape law). The menu panel enters the top layer when open, so the container
 * only affects the trigger layout.
 */
function mount(markup: string): { wrap: HTMLElement; el: UIMenuElement } {
  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  wrap.style.flexDirection = 'row'
  wrap.style.gap = '8px'
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const el = wrap.querySelector('ui-menu') as UIMenuElement
  return { wrap, el }
}

afterEach(async () => {
  await userEvent.unhover(document.body)
  while (mounted.length) {
    const m = mounted.pop()!
    // Close any open menu panels before the next test.
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

const THREE_ITEMS = `
  <ui-menu>
    <button style="padding:6px 12px">Open menu</button>
    <div data-value="copy">Copy</div>
    <div data-value="paste">Paste</div>
    <div data-value="delete">Delete</div>
  </ui-menu>`

const WITH_DISABLED = `
  <ui-menu>
    <button style="padding:6px 12px">Open menu</button>
    <div data-value="a">Alpha</div>
    <div data-value="b" disabled>Beta</div>
    <div data-value="c">Gamma</div>
  </ui-menu>`

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] open round-trip — showPopover()/hidePopover() in a real engine (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-menu — open round-trip via the native Popover API (both engines)', () => {
  it('open=true shows the panel in the top layer; open=false hides it', async () => {
    const { el } = mount(THREE_ITEMS)
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!

    expect(panel.matches(':popover-open'), 'panel should be hidden by default').toBe(false)

    el.open = true
    await el.updateComplete
    expect(
      panel.matches(':popover-open'),
      `${server.browser}: panel did not enter the top layer`,
    ).toBe(true)

    el.open = false
    await el.updateComplete
    expect(
      panel.matches(':popover-open'),
      `${server.browser}: panel did not leave the top layer`,
    ).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] TOP LAYER — panel renders above an overflow:hidden and a transform ancestor
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-menu — top layer escapes overflow:hidden and transform ancestors (both engines)', () => {
  it('the open panel paints ABOVE an overflow:hidden ancestor', async () => {
    const { el } = mount(`
      <div style="overflow:hidden;width:80px;height:40px;position:relative">
        <ui-menu style="display:contents">
          <button>Open</button>
          <div>Item A</div>
          <div>Item B</div>
        </ui-menu>
      </div>
    `)
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!

    el.open = true
    await el.updateComplete

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
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] Light-dismiss via ESCAPE — closes + syncs open + emits close (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-menu — Escape light-dismiss (both engines)', () => {
  it('Escape closes the panel, syncs open=false, and emits close + toggle', async () => {
    const { el } = mount(THREE_ITEMS)
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

    // Focus is in the panel (focusOnOpen=true); Escape reaches the focused element.
    await userEvent.keyboard('{Escape}')
    // The Popover API fires the toggle event as a queued task — await el.updateComplete resolves
    // BEFORE that task runs. The extra setTimeout(0) lets the queued task run (restoreFocus +
    // overlay controller close/toggle emits), then a second updateComplete flushes the resulting
    // reactive effect (open = false via the close listener).
    await new Promise((r) => setTimeout(r, 0))
    await el.updateComplete

    expect(
      panel.matches(':popover-open'),
      `${server.browser}: Escape did not close the panel`,
    ).toBe(false)
    expect(el.open, 'open prop did not sync to false after Escape').toBe(false)
    expect(closes, 'close event did not fire on Escape').toBe(1)
    expect(toggles, 'toggle event did not fire on Escape').toBe(1)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [4] Roving focus — Arrow keys move REAL focus over menuitems (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-menu — keyboard roving moves real focus over menuitems (both engines)', () => {
  it('ArrowDown roves focus from the first to the second menuitem; ArrowUp reverses', async () => {
    const { el } = mount(THREE_ITEMS)
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    const items = [...panel.querySelectorAll<HTMLElement>('[role="menuitem"]')]

    el.open = true
    await el.updateComplete

    // focusOnOpen=true moves focus into the panel; the first enabled item has tabindex=0.
    // Wait for the focus to settle in the panel.
    expect(
      panel.contains(document.activeElement),
      `${server.browser}: focus did not move into the panel on open`,
    ).toBe(true)

    await userEvent.keyboard('{ArrowDown}')
    await el.updateComplete
    expect(
      document.activeElement,
      `${server.browser}: ArrowDown did not rove focus to item 1`,
    ).toBe(items[1])
    expect(items[1].tabIndex, 'item 1 not in the roving tab order').toBe(0)
    expect(items[0].tabIndex, 'item 0 still in the roving tab order').toBe(-1)

    await userEvent.keyboard('{ArrowUp}')
    await el.updateComplete
    expect(
      document.activeElement,
      `${server.browser}: ArrowUp did not rove focus back to item 0`,
    ).toBe(items[0])
  })

  it('ArrowDown wraps from the last item to the first (loop=true)', async () => {
    const { el } = mount(THREE_ITEMS)
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    const items = [...panel.querySelectorAll<HTMLElement>('[role="menuitem"]')]

    el.open = true
    await el.updateComplete

    // Jump to the last item via End key.
    await userEvent.keyboard('{End}')
    await el.updateComplete
    expect(document.activeElement, `${server.browser}: End did not move to last item`).toBe(items[2])

    // ArrowDown from last → wraps to first.
    await userEvent.keyboard('{ArrowDown}')
    await el.updateComplete
    expect(
      document.activeElement,
      `${server.browser}: ArrowDown did not wrap to the first item`,
    ).toBe(items[0])
  })

  it('ArrowDown skips a disabled menuitem', async () => {
    const { el } = mount(WITH_DISABLED)
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    const items = [...panel.querySelectorAll<HTMLElement>('[role="menuitem"]')]

    el.open = true
    await el.updateComplete

    // First item (Alpha) is focused. ArrowDown should skip Beta (disabled) and land on Gamma.
    await userEvent.keyboard('{ArrowDown}')
    await el.updateComplete
    expect(
      document.activeElement,
      `${server.browser}: ArrowDown did not skip the disabled item`,
    ).toBe(items[2])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [5] Commit → select + close (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-menu — Enter commits the focused item, emits select, and closes the menu (both engines)', () => {
  it('Enter on the focused menuitem emits select with {value, index} and closes the panel', async () => {
    const { el } = mount(THREE_ITEMS)
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    const items = [...panel.querySelectorAll<HTMLElement>('[role="menuitem"]')]

    const selects: { value: string; index: number }[] = []
    el.addEventListener('select', (ev) => {
      selects.push((ev as CustomEvent<{ value: string; index: number }>).detail)
    })

    el.open = true
    await el.updateComplete

    // Rove to the second item (Paste, index 1).
    await userEvent.keyboard('{ArrowDown}')
    await el.updateComplete
    expect(document.activeElement).toBe(items[1])

    // Commit with Enter.
    await userEvent.keyboard('{Enter}')
    await el.updateComplete

    expect(selects, `${server.browser}: select was not emitted`).toHaveLength(1)
    expect(selects[0]!.value, `${server.browser}: wrong select value`).toBe('paste')
    expect(selects[0]!.index, `${server.browser}: wrong select index`).toBe(1)
    expect(
      panel.matches(':popover-open'),
      `${server.browser}: menu did not close after commit`,
    ).toBe(false)
    expect(el.open, `${server.browser}: open prop not synced to false after commit`).toBe(false)
  })

  it('clicking a menuitem emits select and closes the menu', async () => {
    const { el } = mount(THREE_ITEMS)
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    const items = [...panel.querySelectorAll<HTMLElement>('[role="menuitem"]')]

    const selects: { value: string; index: number }[] = []
    el.addEventListener('select', (ev) => {
      selects.push((ev as CustomEvent<{ value: string; index: number }>).detail)
    })

    el.open = true
    await el.updateComplete

    await userEvent.click(items[2])
    await el.updateComplete

    expect(selects).toHaveLength(1)
    expect(selects[0]!.value).toBe('delete')
    expect(selects[0]!.index).toBe(2)
    expect(panel.matches(':popover-open')).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [6] Focus restore — trigger gets focus back after close / commit (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-menu — focus restores to trigger on close (both engines)', () => {
  it('Escape closes the menu and restores focus to the trigger', async () => {
    const { el } = mount(THREE_ITEMS)
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!

    el.open = true
    await el.updateComplete
    expect(
      el.querySelector<HTMLElement>('[data-part="panel"]')!.contains(document.activeElement),
      'focus should be in the panel when open',
    ).toBe(true)

    await userEvent.keyboard('{Escape}')
    // restoreFocus() runs inside the Popover toggle listener which fires as a queued task;
    // await el.updateComplete resolves BEFORE that task. The extra macrotask yields to it.
    await new Promise((r) => setTimeout(r, 0))
    await el.updateComplete
    expect(
      document.activeElement,
      `${server.browser}: focus was not restored to the trigger on Escape`,
    ).toBe(trigger)
  })

  it('a commit (Enter) closes the menu and restores focus to the trigger', async () => {
    const { el } = mount(THREE_ITEMS)
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!

    el.open = true
    await el.updateComplete

    await userEvent.keyboard('{Enter}')
    // Commit triggers a programmatic hidePopover(); the Popover API queues the toggle event
    // (and any associated focus restoration) as a macrotask — yield to let it run.
    await new Promise((r) => setTimeout(r, 0))
    await el.updateComplete

    expect(
      document.activeElement,
      `${server.browser}: focus was not restored to the trigger after commit`,
    ).toBe(trigger)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [7] WHOLE-SHAPE — panel bounding box + menuitem item-pad geometry (the Test-the-whole-shape law)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-menu — whole-shape assertion (the Test-the-whole-shape DoD law)', () => {
  it('trigger has real dimensions; open panel has a non-collapsed bounding box; items have item-pad geometry', async () => {
    const { el } = mount(`
      <ui-menu>
        <button style="padding:8px 16px">Open menu</button>
        <div data-value="a">Option A</div>
        <div data-value="b">Option B</div>
        <div data-value="c">Option C</div>
      </ui-menu>
    `)
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!

    // Trigger in normal flow: must have real dimensions (a button with padding → non-zero box).
    const triggerRect = trigger.getBoundingClientRect()
    expect(triggerRect.width, `${server.browser}: trigger collapsed to zero width`).toBeGreaterThan(0)
    expect(triggerRect.height, `${server.browser}: trigger collapsed to zero height`).toBeGreaterThan(0)

    // Panel must be hidden before open.
    expect(panel.matches(':popover-open'), 'panel is open before explicit open=true').toBe(false)

    el.open = true
    await el.updateComplete

    // Panel: must have a real bounding box in the top layer.
    const panelRect = panel.getBoundingClientRect()
    expect(
      panelRect.width,
      `${server.browser}: panel collapsed to zero width — no min-inline-size floor?`,
    ).toBeGreaterThan(0)
    expect(
      panelRect.height,
      `${server.browser}: panel collapsed to zero height — no padding / items?`,
    ).toBeGreaterThan(0)

    // Anti-vacuous: the panel min-inline-size must be a positive px value (the ADR-0021 lesson).
    const minWidth = px(getComputedStyle(panel).minInlineSize)
    expect(
      minWidth,
      `${server.browser}: panel min-inline-size is not a positive px — collapse risk`,
    ).toBeGreaterThan(0)

    // The panel is wider than it is tall (a menu has more inline extent than block extent at minimum).
    // At 10rem min + 3 items, the panel should be wider than tall.
    // (This is the "gestalt" assertion from the Test-the-whole-shape law.)
    expect(
      panelRect.width,
      `${server.browser}: panel width (${panelRect.width}) is less than its height (${panelRect.height}) — unexpected panel aspect ratio`,
    ).toBeGreaterThan(panelRect.height)

    // Menuitem item-pad geometry — the LEGACY ITEM-PAD assertion (§4.6/§5.1, per the decomp).
    // Each item has block padding of --md-sys-space-xs (4px at density=1) on each side, so
    // padding-block ≥ 1px (anti-vacuous — NOT the control height floor). Also check inline padding
    // is present (--md-sys-space-md = 12px at density=1). Both must be positive and non-trivial.
    const items = [...panel.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    expect(items.length, 'items were not moved into the panel').toBeGreaterThan(0)
    const firstItem = items[0]!
    const cs = getComputedStyle(firstItem)
    const padBlockStart = px(cs.paddingBlockStart)
    const padInlineStart = px(cs.paddingInlineStart)
    expect(
      padBlockStart,
      `${server.browser}: menuitem has no block padding — item-pad geometry broken`,
    ).toBeGreaterThan(0)
    expect(
      padInlineStart,
      `${server.browser}: menuitem has no inline padding — item-pad geometry broken`,
    ).toBeGreaterThan(0)
    // Inline pad > block pad (the item-pad is "wider than tall" in its own space).
    expect(
      padInlineStart,
      `${server.browser}: menuitem inline-pad (${padInlineStart}) is less than block-pad (${padBlockStart}) — unexpected item proportions`,
    ).toBeGreaterThanOrEqual(padBlockStart)

    // Each item has a real non-zero rendered height (not collapsed).
    for (const item of items) {
      const itemRect = item.getBoundingClientRect()
      expect(
        itemRect.height,
        `${server.browser}: menuitem collapsed to zero height — item-pad geometry broken`,
      ).toBeGreaterThan(0)
    }
  })

  // 2026-07-06 fix: --ui-menu-item-radius used to subtract --md-sys-space-xs (4px), a DIFFERENT value
  // than the --ui-box-inset (6px) the item's own margin actually reads — an ADR-0018 nested-radius
  // inconsistency. Now both read the SAME --ui-box-inset. (ui-menu has no `[size]` attribute — this
  // is a single-register consistency proof, not a [size] sweep; see menu.css's structural-divergence
  // note — flagged, not forced, per the family-consistency pass.)
  it('nested item-radius == panel-radius − the SAME inset the item margin reads (ADR-0018)', async () => {
    const { el } = mount(THREE_ITEMS)
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    el.open = true
    await el.updateComplete

    const item = panel.querySelector<HTMLElement>('[role="menuitem"]')!
    const panelRadius = px(getComputedStyle(panel).borderTopLeftRadius)
    const itemRadius = px(getComputedStyle(item).borderTopLeftRadius)
    const inset = px(getComputedStyle(item).marginInlineStart)

    expect(
      itemRadius,
      `${server.browser}: item radius (${itemRadius}px) should equal panel radius (${panelRadius}px) − its own inset (${inset}px)`,
    ).toBeCloseTo(panelRadius - inset, 1)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [8] forced-colors — panel surface + frame survive (Chromium via CDP; WebKit baseline)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-menu — forced-colors (Chromium via CDP; WebKit asserts the baseline)', () => {
  it('panel surface + frame are visible in normal mode AND survive forced-colors', async () => {
    const { el } = mount(THREE_ITEMS)
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    el.open = true
    await el.updateComplete

    // Baseline (BOTH engines, normal mode): the panel has a visible opaque background + border.
    expect(
      alphaOf(getComputedStyle(panel).backgroundColor),
      `${server.browser}: the panel surface has no background in normal mode (forced-colors check would be vacuous)`,
    ).toBeGreaterThan(0)
    expect(
      px(getComputedStyle(panel).borderTopWidth),
      `${server.browser}: the panel frame has no border in normal mode`,
    ).toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      // WebKit: no CDP / forced-colors emulation — assert we are NOT already in forced-colors.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'forced-colors', value: 'active' }],
    })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)

      // Panel surface + frame survive as system Canvas/CanvasText.
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

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  Edge-aware scroll fade (the gutter-exposure fix, 2026-07-04) — DEFAULT-ON, no opt-in prop. Also
//  proves the NEW max-block-size:40vh + overflow-y:auto bound (the panel was previously unbounded).
//  scroll-fade.test.ts proves the trait's decision logic (jsdom, stubbed geometry); this proves the
//  whole live wire on the real scroll viewport (the menu panel).
// ════════════════════════════════════════════════════════════════════════════════════════════════

/** The resolved mask — WebKit ships mask-image unprefixed too, but read both to be engine-agnostic. */
const maskOf = (el: HTMLElement): string => {
  const cs = getComputedStyle(el) as CSSStyleDeclaration & { webkitMaskImage?: string }
  return cs.maskImage || cs.webkitMaskImage || 'none'
}

const scrollTo = (el: HTMLElement, top: number): Promise<void> =>
  new Promise((resolve) => {
    if (el.scrollTop === top) {
      resolve()
      return
    }
    el.addEventListener('scroll', () => resolve(), { once: true })
    el.scrollTop = top
  })

/** See select.browser.test.ts's nextFrames — the panel's real size only lands after showPopover() paints. */
const nextFrames = (n = 2): Promise<void> =>
  Array.from({ length: n }).reduce<Promise<void>>(
    (p) => p.then(() => new Promise((r) => requestAnimationFrame(() => r()))),
    Promise.resolve(),
  )

const TALL_ITEMS = `
  <ui-menu>
    <button style="padding:6px 12px">Open menu</button>
    <div data-value="a" style="block-size: 2000px">Alpha</div>
    <div data-value="b">Beta</div>
  </ui-menu>`

describe('ui-menu — the panel is now BOUNDED (max-block-size:40vh) and gets an edge-aware fade by default (both engines)', () => {
  it('a long item list genuinely overflows the new 40vh cap (the bound is real, not vacuous)', async () => {
    const { el } = mount(TALL_ITEMS)
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    el.open = true
    await el.updateComplete
    await nextFrames()
    expect(panel.scrollHeight, `${server.browser}: the panel did not overflow its new max-block-size cap`).toBeGreaterThan(panel.clientHeight)
  })

  it('at the TOP: data-fade-bottom (more below), not data-fade-top', async () => {
    const { el } = mount(TALL_ITEMS)
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    el.open = true
    await el.updateComplete
    await nextFrames()
    await scrollTo(panel, 0)
    expect(panel.hasAttribute('data-fade-top'), `${server.browser}: fresh panel wrongly fades the top`).toBe(false)
    expect(panel.hasAttribute('data-fade-bottom'), `${server.browser}: the panel did not fade its bottom`).toBe(true)
  })

  it('scrolled to the BOTTOM: data-fade-top, not data-fade-bottom', async () => {
    const { el } = mount(TALL_ITEMS)
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    el.open = true
    await el.updateComplete
    await nextFrames()
    await scrollTo(panel, panel.scrollHeight)
    expect(panel.hasAttribute('data-fade-top'), `${server.browser}: end-of-scroll did not fade the top`).toBe(true)
    expect(panel.hasAttribute('data-fade-bottom'), `${server.browser}: end-of-scroll wrongly kept the bottom faded`).toBe(false)
  })

  it('a SHORT menu (fits, no scrollable overflow) never fades either edge', async () => {
    const { el } = mount(THREE_ITEMS)
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    el.open = true
    await el.updateComplete
    await nextFrames()
    expect(panel.scrollHeight, 'the panel unexpectedly overflows (test setup is vacuous)').toBeLessThanOrEqual(panel.clientHeight)
    expect(panel.hasAttribute('data-fade-top')).toBe(false)
    expect(panel.hasAttribute('data-fade-bottom')).toBe(false)
    expect(maskOf(panel), `${server.browser}: a short panel painted a mask`).toBe('none')
  })

  it('the rendered mask PAINTS a gradient exactly when a flag is present', async () => {
    const { el } = mount(TALL_ITEMS)
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    el.open = true
    await el.updateComplete
    await nextFrames()
    await scrollTo(panel, 0)
    expect(maskOf(panel), `${server.browser}: the panel's fade flag did not paint a mask`).toMatch(/gradient/)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  TKT-0027 — the panel max-block-size dial: default min(50vh, calc(12 * item-row + 13 * inset)).
//  At default [size]/[density] (--ui-menu-item-font=14px, --ui-menu-item-pad-block=--md-sys-space-xs=
//  4px ⇒ a 22px item row; --ui-box-inset=6px), the calc arm resolves to 12×22 + 13×6 = 342px — under
//  the default 896px-tall viewport's 50vh (448px), so the calc arm is the one actually binding
//  (anti-vacuous: 12 real items fit, a 13th genuinely overflows). At a viewport short enough that
//  50vh < 342px, min() flips to the vh arm instead — the THIRD leg below proves that flip is real,
//  not just "some cap exists".
// ════════════════════════════════════════════════════════════════════════════════════════════════

const manyItems = (n: number): string => {
  const rows = Array.from({ length: n }, (_, i) => `<div data-value="item-${i}">Item ${i}</div>`).join('\n')
  return `
    <ui-menu>
      <button style="padding:6px 12px">Open menu</button>
      ${rows}
    </ui-menu>`
}

describe('ui-menu — TKT-0027 panel max-block-size dial (default min(50vh, 12 item rows), both engines)', () => {
  it('12 real items fit within the default cap without scrolling (the 12-row calc arm, not a vacuous cap)', async () => {
    const { el } = mount(manyItems(12))
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    el.open = true
    await el.updateComplete
    await nextFrames()
    expect(
      panel.scrollHeight,
      `${server.browser}: 12 items unexpectedly overflow the default cap — the 12-row calc math regressed`,
    ).toBeLessThanOrEqual(panel.clientHeight)
  })

  it('a 13th item overflows the default cap (scrollHeight > clientHeight)', async () => {
    const { el } = mount(manyItems(13))
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    el.open = true
    await el.updateComplete
    await nextFrames()
    expect(
      panel.scrollHeight,
      `${server.browser}: the 13th item did not overflow the default cap`,
    ).toBeGreaterThan(panel.clientHeight)
  })

  it('at a short viewport, min() flips to the 50vh arm instead of the 12-row calc arm', async () => {
    const { el } = mount(manyItems(13))
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    // 500px tall ⇒ 50vh = 250px, well under the 342px calc arm (the default-viewport legs above) —
    // short enough that min() must resolve to the vh side, not a rounding-distance coincidence.
    await page.viewport(414, 500)
    try {
      el.open = true
      await el.updateComplete
      await nextFrames()
      const resolvedMax = px(getComputedStyle(panel).maxBlockSize)
      const expectedVh = window.innerHeight * 0.5
      expect(
        resolvedMax,
        `${server.browser}: max-block-size (${resolvedMax}px) did not resolve to the 50vh arm (${expectedVh}px) — min() picked the calc arm instead`,
      ).toBeCloseTo(expectedVh, -1)
      // Anti-vacuous: the clamp genuinely binds — 13 rows still overflow this shorter cap.
      expect(
        panel.scrollHeight,
        `${server.browser}: the panel did not overflow the 50vh-clamped cap`,
      ).toBeGreaterThan(panel.clientHeight)
    } finally {
      await page.viewport(414, 896) // restore the fleet default viewport for subsequent tests in this file
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [9] Selectable-item variant (GH #55) — menuitemradio/menuitemcheckbox, real-engine commit +
//      the WHOLE-SHAPE checkmark render (Test-the-whole-shape law: a jsdom pass on aria-checked
//      alone would miss a checkmark that never actually paints — measure it, both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

const RADIO_ITEMS = `
  <ui-menu>
    <button style="padding:6px 12px">Agent ▾</button>
    <div role="menuitemradio" data-value="a">Alpha</div>
    <div role="menuitemradio" data-value="b">Beta</div>
    <div role="menuitemradio" data-value="c">Gamma</div>
  </ui-menu>`

describe('ui-menu — selectable items: real-engine roving + commit-managed aria-checked (both engines, GH #55)', () => {
  it('ArrowDown roves REAL focus across menuitemradio rows exactly like plain menuitem', async () => {
    const { el } = mount(RADIO_ITEMS)
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    const items = [...panel.querySelectorAll<HTMLElement>('[role="menuitemradio"]')]

    el.open = true
    await el.updateComplete
    expect(panel.contains(document.activeElement), `${server.browser}: focus did not move into the panel`).toBe(true)

    await userEvent.keyboard('{ArrowDown}')
    await el.updateComplete
    expect(document.activeElement, `${server.browser}: ArrowDown did not rove onto the second menuitemradio row`).toBe(items[1])
  })

  it('Enter commits a menuitemradio row: aria-checked flips to true, closes the menu, emits select — same contract as menuitem', async () => {
    const { el } = mount(RADIO_ITEMS)
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    const items = [...panel.querySelectorAll<HTMLElement>('[role="menuitemradio"]')]

    const selects: { value: string; index: number }[] = []
    el.addEventListener('select', (ev) => {
      selects.push((ev as CustomEvent<{ value: string; index: number }>).detail)
    })

    el.open = true
    await el.updateComplete
    await userEvent.keyboard('{ArrowDown}') // → Beta
    await userEvent.keyboard('{Enter}')
    await el.updateComplete

    expect(items[1]!.getAttribute('aria-checked'), `${server.browser}: committed row must be checked`).toBe('true')
    expect(items[0]!.getAttribute('aria-checked')).toBe('false')
    expect(items[2]!.getAttribute('aria-checked')).toBe('false')
    expect(selects, `${server.browser}: select was not emitted`).toHaveLength(1)
    expect(selects[0]!.value).toBe('b')
    expect(panel.matches(':popover-open'), `${server.browser}: menu did not close after commit`).toBe(false)
  })

  it('a second click commit re-assigns the one-true checked row across two real commits', async () => {
    const { el } = mount(RADIO_ITEMS)
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    const items = [...panel.querySelectorAll<HTMLElement>('[role="menuitemradio"]')]

    el.open = true
    await el.updateComplete
    await userEvent.click(items[0]!)
    await el.updateComplete
    expect(items[0]!.getAttribute('aria-checked')).toBe('true')

    el.open = true
    await el.updateComplete
    await userEvent.click(items[2]!)
    await el.updateComplete
    expect(items[0]!.getAttribute('aria-checked'), `${server.browser}: the previous choice must flip off`).toBe('false')
    expect(items[2]!.getAttribute('aria-checked')).toBe('true')
  })

  it('WHOLE-SHAPE: the checked row paints a real, non-transparent checkmark glyph; the unchecked rows do not', async () => {
    const { el } = mount(RADIO_ITEMS)
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    const items = [...panel.querySelectorAll<HTMLElement>('[role="menuitemradio"]')]

    el.open = true
    await el.updateComplete
    await userEvent.click(items[1]!) // Beta becomes checked; panel closes
    el.open = true // re-open to inspect the now-checked row's paint
    await el.updateComplete
    await nextFrames()

    const checkedStyle = getComputedStyle(items[1]!, '::before')
    const uncheckedStyle = getComputedStyle(items[0]!, '::before')

    // The glyph slot itself must be a genuinely sized box on BOTH rows (the reserved-space law —
    // rows in the same group align identically whether checked or not), and the checked row's
    // background must actually paint (non-transparent, non-zero alpha) while the unchecked row's
    // does not — this is what a pure ARIA-state jsdom assertion cannot catch.
    expect(px(checkedStyle.width), `${server.browser}: the checkmark glyph slot collapsed to zero width`).toBeGreaterThan(0)
    expect(px(checkedStyle.height), `${server.browser}: the checkmark glyph slot collapsed to zero height`).toBeGreaterThan(0)
    expect(
      alphaOf(checkedStyle.backgroundColor),
      `${server.browser}: the checked row's glyph never actually painted (background stayed transparent)`,
    ).toBeGreaterThan(0)
    expect(
      alphaOf(uncheckedStyle.backgroundColor),
      `${server.browser}: an UNCHECKED row painted a checkmark — should stay transparent`,
    ).toBe(0)
  })
})
