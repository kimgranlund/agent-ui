import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'
import type { UISelectElement } from './select.ts'

// Wave-4 S4 browser smoke — ui-select (decomp S4 · overlay-controller.lld.md LLD-C1..C4 · ADR-0043).
//
// THIS IS THE ⭐ ADR-0043 SELECT GATE — S4's green smoke (Chromium + WebKit) ratifies the
// overlay + listbox composition. Runs in BOTH Chromium AND WebKit (overlays are WebKit-
// sensitive; a Chromium-only pass is NOT a pass per the wave-4 baked-in lessons).
//
// What is proven here (none of this resolves in jsdom):
//   [1] open round-trip — listbox enters/leaves the Popover API top layer (both engines)
//   [2] TOP LAYER — panel renders above an overflow:hidden ancestor (both engines)
//   [3] Keyboard open + navigate + commit — ArrowDown opens; Arrow roves; Enter commits (both engines)
//   [4] Form round-trip — value round-trips through a <form> submission (FormData) (both engines)
//   [5] WHOLE-SHAPE — trigger's Control-class height off the ramp; panel's real bounding box (both engines)
//   [6] forced-colors — trigger frame + panel surface survive WHCM (Chromium via CDP; WebKit baseline)
//   [7] C10 zero-residue — disconnect releases all overlay + roving + selection listeners
//
// Side-effect imports — CSS load order (ADR-0003): foundation roles + dimensional ramp FIRST,
// then the select sheet, then the self-defining module. Imported DIRECTLY (relative), NOT via the
// component-styles barrel (the s12 barrel wiring lands at the integration slice).
import '@agent-ui/components/foundation-styles.css'
import './select.css'
import './select.ts'

// ── mount/cleanup ─────────────────────────────────────────────────────────────────────────────

const mounted: HTMLElement[] = []

/**
 * Mount a ui-select into a realistic container (a display:flex row — the doc-specimen context per
 * the Test-the-whole-shape law). The listbox panel is in the top layer when open, so the container
 * only affects the trigger layout.
 */
function mount(markup: string): { wrap: HTMLElement; el: UISelectElement } {
  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  wrap.style.flexDirection = 'row'
  wrap.style.gap = '8px'
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const el = wrap.querySelector('ui-select') as UISelectElement
  return { wrap, el }
}

afterEach(async () => {
  await userEvent.unhover(document.body)
  while (mounted.length) {
    const m = mounted.pop()!
    // Close any open listbox panels before the next test (avoid stale top-layer state).
    const panels = m.querySelectorAll<HTMLElement>('[data-part="listbox"]')
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
//  [1] open round-trip — listbox enters/leaves the Popover API top layer (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-select — open round-trip via the native Popover API (both engines)', () => {
  it('open=true shows the listbox (popover is open + renders a box); open=false hides it', async () => {
    const { el } = mount(`
      <ui-select placeholder="Choose…">
        <div role="option" value="apple">Apple</div>
        <div role="option" value="banana">Banana</div>
      </ui-select>
    `)
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    expect(listbox.matches(':popover-open'), 'listbox should be hidden by default').toBe(false)

    el.open = true
    await el.updateComplete
    expect(listbox.matches(':popover-open'), `${server.browser}: listbox did not enter the top layer`).toBe(true)
    // Whole-shape: the open panel MUST render a real bounding box (not collapsed)
    const openRect = listbox.getBoundingClientRect()
    expect(openRect.width, `${server.browser}: listbox collapsed to zero width — whole-shape DoD`).toBeGreaterThan(0)
    expect(openRect.height, `${server.browser}: listbox collapsed to zero height — whole-shape DoD`).toBeGreaterThan(0)

    el.open = false
    await el.updateComplete
    expect(listbox.matches(':popover-open'), `${server.browser}: listbox did not leave the top layer`).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] TOP LAYER — panel renders above an overflow:hidden ancestor (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-select — top layer escapes overflow:hidden ancestor (both engines)', () => {
  it('the open listbox paints ABOVE an overflow:hidden ancestor (elementFromPoint hits the panel)', async () => {
    const { el } = mount(`
      <div style="overflow:hidden;width:80px;height:40px;position:relative">
        <ui-select style="display:inline-block">
          <div role="option" value="a">Option A</div>
        </ui-select>
      </div>
    `)
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    el.open = true
    await el.updateComplete

    const rect = listbox.getBoundingClientRect()
    expect(rect.width, 'listbox collapsed — top-layer escape is untestable').toBeGreaterThan(0)

    const cx = Math.round(rect.left + rect.width / 2)
    const cy = Math.round(rect.top + rect.height / 2)
    const hit = document.elementFromPoint(cx, cy)
    expect(hit, 'nothing was hit at the listbox centre').not.toBeNull()
    expect(
      listbox === hit || listbox.contains(hit),
      `${server.browser}: the listbox did not paint in the top layer (overflow:hidden ancestor occluded it)`,
    ).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] Keyboard open + navigate + commit (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-select — keyboard: open + navigate + commit (both engines)', () => {
  it('ArrowDown on the trigger opens the listbox + focus lands in the panel', async () => {
    const { el } = mount(`
      <ui-select placeholder="Choose…">
        <div role="option" value="apple">Apple</div>
        <div role="option" value="banana">Banana</div>
        <div role="option" value="cherry">Cherry</div>
      </ui-select>
    `)
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    trigger.focus()
    await userEvent.keyboard('{ArrowDown}')
    await el.updateComplete

    expect(listbox.matches(':popover-open'), `${server.browser}: listbox did not open on ArrowDown`).toBe(true)
    // Focus should be inside the listbox (moved by overlay's moveFocusIn)
    expect(
      listbox.contains(document.activeElement),
      `${server.browser}: focus did not move into the listbox on ArrowDown`,
    ).toBe(true)
  })

  it('Enter commits the focused option, closes the listbox, restores focus to the trigger', async () => {
    const { el } = mount(`
      <ui-select placeholder="Choose…">
        <div role="option" value="apple">Apple</div>
        <div role="option" value="banana">Banana</div>
      </ui-select>
    `)
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    let selectCount = 0
    let lastKey = ''
    el.addEventListener('select', (e) => { selectCount++; lastKey = (e as CustomEvent<string>).detail })

    // Open via keyboard
    trigger.focus()
    await userEvent.keyboard('{ArrowDown}')
    await el.updateComplete
    expect(listbox.matches(':popover-open')).toBe(true)

    // Focus is on the first option (rovingFocus seeds to index 0 when nothing selected)
    // Commit it with Enter
    await userEvent.keyboard('{Enter}')
    // onSelect sets this.value + this.open=false; the model→overlay effect that calls handle.close()
    // flushes on a later microtask. The Popover toggle event (and restoreFocus inside it) is a
    // "queue a task" per spec — runs after the current microtask queue drains. Two passes needed.
    await new Promise((r) => setTimeout(r, 0)) // let the queued Popover toggle task run
    await el.updateComplete                    // flush the resulting reactive effect

    expect(selectCount, 'select event should have fired once').toBe(1)
    expect(lastKey, 'committed key should be the first option').toBe('apple')
    expect(el.value, 'value should reflect the committed option').toBe('apple')
    expect(listbox.matches(':popover-open'), `${server.browser}: listbox should close after commit`).toBe(false)
    expect(document.activeElement, `${server.browser}: focus should return to the trigger`).toBe(trigger)
  })

  it('Escape closes the listbox + syncs open=false + emits close (both engines)', async () => {
    const { el } = mount(`
      <ui-select placeholder="Choose…">
        <div role="option" value="apple">Apple</div>
      </ui-select>
    `)
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    el.open = true
    await el.updateComplete
    expect(listbox.matches(':popover-open')).toBe(true)

    await userEvent.keyboard('{Escape}')
    // The overlay's restoreFocus() runs inside the async Popover toggle listener (spec: "queue a task").
    // Two passes: first drains the queued task, second flushes the resulting reactive effect.
    await new Promise((r) => setTimeout(r, 0)) // let the queued Popover toggle task + restoreFocus run
    await el.updateComplete                    // flush the resulting reactive effect

    expect(listbox.matches(':popover-open'), `${server.browser}: Escape did not close the listbox`).toBe(false)
    expect(el.open, 'open prop should sync to false').toBe(false)
    expect(closes, 'close event should fire').toBe(1)
    expect(toggles, 'toggle event should fire').toBe(1)
    // Focus restored to trigger
    expect(document.activeElement, 'focus should return to the trigger after Escape').toBe(trigger)
  })

  it('clicking an option commits it, closes the listbox, emits select (both engines)', async () => {
    const { el } = mount(`
      <ui-select placeholder="Pick fruit">
        <div role="option" value="mango">Mango</div>
        <div role="option" value="papaya">Papaya</div>
      </ui-select>
    `)
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    let lastKey = ''
    el.addEventListener('select', (e) => { lastKey = (e as CustomEvent<string>).detail })

    el.open = true
    await el.updateComplete

    const papaya = listbox.querySelector<HTMLElement>('[value="papaya"]')!
    await userEvent.click(papaya)
    await el.updateComplete

    expect(lastKey, 'select event detail should be the clicked option key').toBe('papaya')
    expect(el.value).toBe('papaya')
    expect(listbox.matches(':popover-open'), `${server.browser}: listbox should close after click-commit`).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [4] Form round-trip — value round-trips through a <form> (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-select — form round-trip (both engines)', () => {
  it('value submits under `name` via FormData; null when unselected; updates after commit', async () => {
    const { wrap } = mount(`
      <form>
        <ui-select name="color" placeholder="Choose color">
          <div role="option" value="red">Red</div>
          <div role="option" value="blue">Blue</div>
          <div role="option" value="green">Green</div>
        </ui-select>
      </form>
    `)
    const form = wrap.querySelector('form')!
    const el = wrap.querySelector('ui-select') as UISelectElement
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    // Nothing selected → no form entry
    expect(new FormData(form).get('color'), 'unselected select should not submit a value').toBeNull()

    // Select "blue" via keyboard
    el.open = true
    await el.updateComplete
    const blue = listbox.querySelector<HTMLElement>('[value="blue"]')!
    await userEvent.click(blue)
    await el.updateComplete

    expect(el.value, 'value should be blue after click commit').toBe('blue')
    expect(new FormData(form).get('color'), 'form should contain the selected value').toBe('blue')

    // Select "green" programmatically
    el.value = 'green'
    await el.updateComplete
    expect(new FormData(form).get('color'), 'programmatic value update should reflect in FormData').toBe('green')
  })

  it('required + no selection → valueMissing; validity clears after selection', async () => {
    const { wrap } = mount(`
      <form>
        <ui-select name="size" required>
          <div role="option" value="sm">Small</div>
          <div role="option" value="lg">Large</div>
        </ui-select>
      </form>
    `)
    const el = wrap.querySelector('ui-select') as UISelectElement

    expect(el.validity.valueMissing, 'required select with no selection → valueMissing').toBe(true)
    expect(el.validity.valid).toBe(false)

    el.value = 'sm'
    await el.updateComplete

    expect(el.validity.valid, 'validity should clear after selection').toBe(true)
    expect(el.validity.valueMissing).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [5] WHOLE-SHAPE — trigger Control-class height + panel real bounding box (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-select — whole-shape assertion (Test-the-whole-shape DoD law)', () => {
  it('trigger has a real Control-class bounding box (not collapsed); panel renders when open', async () => {
    const { el } = mount(`
      <ui-select placeholder="Select an option" style="width: 200px">
        <div role="option" value="opt1">Option One</div>
        <div role="option" value="opt2">Option Two</div>
      </ui-select>
    `)
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    // Trigger: must have real dimensions (a button with height + padding → non-zero box)
    const triggerRect = trigger.getBoundingClientRect()
    expect(triggerRect.width, `${server.browser}: trigger collapsed to zero width`).toBeGreaterThan(0)
    expect(triggerRect.height, `${server.browser}: trigger collapsed to zero height`).toBeGreaterThan(0)

    // Trigger height must come from the ramp (--ui-select-height = --ui-height-md = 28px at default [scale])
    // Allow for sub-pixel and border differences: must be ≥ 24px (the sm height)
    expect(
      triggerRect.height,
      `${server.browser}: trigger height is less than the sm-ramp minimum (24px) — did the height token fail?`,
    ).toBeGreaterThanOrEqual(24)

    // Trigger is wider than tall (a select trigger is not square — it is a bar showing a label)
    expect(
      triggerRect.width,
      `${server.browser}: trigger is taller than wide (unexpected aspect ratio for a select trigger)`,
    ).toBeGreaterThan(triggerRect.height)

    // Panel: must be hidden before open
    expect(listbox.matches(':popover-open'), 'listbox should be hidden before open').toBe(false)

    el.open = true
    await el.updateComplete

    // Panel: real bounding box in the top layer
    const panelRect = listbox.getBoundingClientRect()
    expect(panelRect.width, `${server.browser}: listbox collapsed to zero width — min-inline-size floor?`).toBeGreaterThan(0)
    expect(panelRect.height, `${server.browser}: listbox collapsed to zero height — are options inside?`).toBeGreaterThan(0)

    // Panel min-inline-size floor must be positive (prevents collapse with no content)
    const minWidth = px(getComputedStyle(listbox).minInlineSize)
    expect(minWidth, `${server.browser}: panel min-inline-size is not a positive px — collapse risk`).toBeGreaterThan(0)

    // B1: panel width must match the trigger width (the JS sets listbox.style.minInlineSize before
    // showPopover()). In the Popover API top layer, CSS `100%` resolves to 100vw, NOT the trigger
    // width — the JS measurement (trigger.getBoundingClientRect().width) is the correct fix.
    // Tolerance: ±8px for rounding and optional scrollbar.
    expect(
      Math.abs(panelRect.width - triggerRect.width),
      `${server.browser}: panel width (${panelRect.width}px) does not match trigger width (${triggerRect.width}px) — B1 fix: JS minInlineSize stamp`,
    ).toBeLessThanOrEqual(8)

    // Caret gestalt: the caret span must render with non-zero dimensions (sized = font, in an icon cell)
    const caret = trigger.querySelector<HTMLElement>('[data-part="caret"]')!
    const caretRect = caret.getBoundingClientRect()
    expect(caretRect.width, `${server.browser}: caret collapsed to zero width`).toBeGreaterThan(0)
    expect(caretRect.height, `${server.browser}: caret collapsed to zero height`).toBeGreaterThan(0)
    // Caret should be approximately icon-sized (--ui-icon-md = 18px at default [scale])
    // Allow ± 4px: it must not be gigantic (not icon-proportioned at the wrong size class)
    expect(caretRect.width, `${server.browser}: caret is wider than 36px — not font-sized`).toBeLessThan(36)

    // Phosphor-icon sweep: the INJECTED <svg> (setIcon(caret, 'caret-down')) must itself paint at a
    // real, non-collapsed size — not just its containing cell (the ui-slider "collapsed dot" lesson:
    // a container can pass every bounding-box check while its content renders at 0×0). Fits within the
    // caret cell (never spills past the icon-sized box) and is at least half the cell (never a stray
    // pixel-sized dot).
    const svg = caret.querySelector('svg')!
    const svgRect = svg.getBoundingClientRect()
    expect(svgRect.width, `${server.browser}: injected caret svg collapsed to zero width`).toBeGreaterThan(0)
    expect(svgRect.height, `${server.browser}: injected caret svg collapsed to zero height`).toBeGreaterThan(0)
    expect(svgRect.width, `${server.browser}: injected caret svg overflows its cell`).toBeLessThanOrEqual(caretRect.width)
    expect(svgRect.width, `${server.browser}: injected caret svg is a stray dot, not glyph-sized`).toBeGreaterThan(caretRect.width / 2)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [6] forced-colors — trigger + panel survive WHCM (Chromium via CDP; WebKit baseline)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-select — forced-colors (Chromium via CDP; WebKit asserts the baseline)', () => {
  it('trigger frame + panel surface are visible in normal mode AND survive forced-colors', async () => {
    const { el } = mount(`
      <ui-select placeholder="Choose…">
        <div role="option" value="a">Option A</div>
      </ui-select>
    `)
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    // Baseline (BOTH engines, normal mode): trigger has a visible border (non-transparent)
    expect(
      px(getComputedStyle(trigger).borderTopWidth),
      `${server.browser}: trigger frame has no border in normal mode (forced-colors check would be vacuous)`,
    ).toBeGreaterThan(0)

    el.open = true
    await el.updateComplete

    // Baseline: panel has a visible opaque background
    expect(
      alphaOf(getComputedStyle(listbox).backgroundColor),
      `${server.browser}: panel surface has no background in normal mode`,
    ).toBeGreaterThan(0)
    expect(
      px(getComputedStyle(listbox).borderTopWidth),
      `${server.browser}: panel frame has no border in normal mode`,
    ).toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      // WebKit: no CDP / forced-colors emulation
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'forced-colors', value: 'active' }],
    })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)

      // Trigger: must have a visible border (ButtonBorder) and ink (ButtonText)
      expect(
        px(getComputedStyle(trigger).borderTopWidth),
        'trigger frame vanished under forced-colors',
      ).toBeGreaterThan(0)

      // Panel: must have an opaque background (Canvas) and border (CanvasText)
      expect(
        alphaOf(getComputedStyle(listbox).backgroundColor),
        'panel surface vanished under forced-colors (Canvas not applied)',
      ).toBeGreaterThan(0)
      expect(
        px(getComputedStyle(listbox).borderTopWidth),
        'panel frame vanished under forced-colors (CanvasText border not applied)',
      ).toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [B4] Trigger geometry — [size] sm/md/lg exact px + [scale] anti-vacuous (C9 gate, both engines)
//
//  Proves the Control-class trigger resolves the §1-ramp height correctly for each size and that
//  a [scale] ancestor shifts the whole register — NOT a vacuous "just greater than zero" check.
//  Heights from the ADR-0038 / dimensions.css §1 table (default density = comfortable):
//    sm=24px · md=28px · lg=36px (all at the default [scale=ui-md] / [scale=content-md] subtree)
//  [scale=content-lg] (the top scale tier) shifts the md register to 48px (one row above content-md's 36).
//  The caret cell is icon-sized (≤ height); the caret glyph = font (§4.1 caret law).
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-select — trigger geometry: [size] exact px + [scale] anti-vacuous (B4, both engines)', () => {
  it('[size=sm] → trigger height = 24px; [size=md] = 28px; [size=lg] = 36px (§1-ramp)', () => {
    // Three selects, one per size, all in the same flex-row container (the doc-specimen context).
    const wrap = document.createElement('div')
    wrap.style.display = 'flex'
    wrap.style.flexDirection = 'row'
    wrap.style.gap = '8px'

    const mkSel = (size: string): HTMLElement => {
      const el = document.createElement('ui-select') as HTMLElement
      el.setAttribute('size', size)
      el.setAttribute('placeholder', size)
      const opt = document.createElement('div')
      opt.setAttribute('role', 'option')
      opt.setAttribute('value', 'x')
      opt.textContent = size
      el.append(opt)
      return el
    }

    const sm = mkSel('sm')
    const md = mkSel('md')
    const lg = mkSel('lg')
    wrap.append(sm, md, lg)
    document.body.append(wrap)
    mounted.push(wrap)

    const smTrigger = sm.querySelector<HTMLElement>('[data-part="trigger"]')!
    const mdTrigger = md.querySelector<HTMLElement>('[data-part="trigger"]')!
    const lgTrigger = lg.querySelector<HTMLElement>('[data-part="trigger"]')!

    // Exact px from ADR-0038 §1 table at default [scale] (comfortable density, ui-md register)
    expect(
      Math.round(smTrigger.getBoundingClientRect().height),
      `${server.browser}: [size=sm] trigger height should be 24px`,
    ).toBe(24)
    expect(
      Math.round(mdTrigger.getBoundingClientRect().height),
      `${server.browser}: [size=md] trigger height should be 28px`,
    ).toBe(28)
    expect(
      Math.round(lgTrigger.getBoundingClientRect().height),
      `${server.browser}: [size=lg] trigger height should be 36px`,
    ).toBe(36)

    // Anti-vacuous: adjacent sizes must NOT be equal (they step, not collapse)
    expect(
      Math.round(smTrigger.getBoundingClientRect().height),
      `${server.browser}: sm height must differ from md (anti-vacuous)`,
    ).not.toBe(Math.round(mdTrigger.getBoundingClientRect().height))
    expect(
      Math.round(mdTrigger.getBoundingClientRect().height),
      `${server.browser}: md height must differ from lg (anti-vacuous)`,
    ).not.toBe(Math.round(lgTrigger.getBoundingClientRect().height))
  })

  it('[scale=content-lg] shifts the md trigger height to 48px (anti-vacuous scale proof)', () => {
    // Wrapping in a [scale=content-lg] ancestor shifts the md register UP the ladder:
    // content-lg is the top scale tier (above content-md≡ui-lg), so content-lg × size=md = 48px
    // (one register above content-md's 36; consistent with lg × content-lg = 64px, ADR-0038 §1 table).
    // This proves the [scale] tokens propagate correctly into the control's height token chain.
    const wrapper = document.createElement('div')
    wrapper.setAttribute('scale', 'content-lg')
    wrapper.style.display = 'flex'
    wrapper.style.flexDirection = 'row'

    const el = document.createElement('ui-select') as HTMLElement
    el.setAttribute('placeholder', 'default size')
    const opt = document.createElement('div')
    opt.setAttribute('role', 'option')
    opt.setAttribute('value', 'x')
    opt.textContent = 'X'
    el.append(opt)
    wrapper.append(el)
    document.body.append(wrapper)
    mounted.push(wrapper)

    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
    const h = Math.round(trigger.getBoundingClientRect().height)

    // At [scale=content-lg] (the top scale tier), the md register = 48px (NOT the default 28px)
    expect(h, `${server.browser}: [scale=content-lg] trigger height should be 48px (top scale tier, one register above content-md's 36)`).toBe(48)

    // Anti-vacuous: the scaled value must differ from the default 28px
    expect(h, `${server.browser}: [scale=content-lg] height must differ from default 28px — was the scale propagated?`).not.toBe(28)
  })

  it('caret width ≤ trigger height at all sizes (§4.1: caret glyph = font, icon-cell = icon)', () => {
    // The §4.1 caret law: the caret GLYPH = font; the caret CELL = icon. Both are smaller than
    // the trigger height (height > icon for all sizes — the cell is icon-wide, trigger is taller).
    // This proves the caret cell does not overflow the trigger frame.
    const { el } = mount(`
      <ui-select placeholder="Default (md)">
        <div role="option" value="a">A</div>
      </ui-select>
    `)
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
    const caret = trigger.querySelector<HTMLElement>('[data-part="caret"]')!

    const triggerH = trigger.getBoundingClientRect().height
    const caretW = caret.getBoundingClientRect().width
    const caretH = caret.getBoundingClientRect().height

    // Caret cell is icon-sized (--ui-icon-md = 18px at default scale); trigger is 28px.
    // The caret cell must be smaller than the trigger height.
    expect(
      caretW,
      `${server.browser}: caret width (${caretW}px) must be less than trigger height (${triggerH}px)`,
    ).toBeLessThan(triggerH)
    expect(
      caretH,
      `${server.browser}: caret height (${caretH}px) must be less than or equal to trigger height (${triggerH}px)`,
    ).toBeLessThanOrEqual(triggerH)
    // Caret must also be positive (not collapsed)
    expect(caretW, `${server.browser}: caret collapsed to zero width`).toBeGreaterThan(0)
    expect(caretH, `${server.browser}: caret collapsed to zero height`).toBeGreaterThan(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [7] C10 zero-residue — disconnect releases all listeners (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-select — C10 zero-residue (both engines)', () => {
  it('after disconnect, Escape does NOT fire close on the detached host (listeners removed)', async () => {
    const { el } = mount(`
      <ui-select placeholder="Choose…">
        <div role="option" value="x">X</div>
      </ui-select>
    `)
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    el.open = true
    await el.updateComplete
    expect(listbox.matches(':popover-open')).toBe(true)

    let closes = 0
    el.addEventListener('close', () => closes++)

    // Close + disconnect
    el.open = false
    await el.updateComplete
    el.remove()

    // After disconnect, any stale toggle listener must be dead — no close fires
    expect(closes).toBe(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [8] Option GROUPS (optgroup parity) — headers render; grouped options keyboard-navigate + commit
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-select — option groups render + navigate (both engines)', () => {
  it('group headers render as real boxes; keyboard roves grouped options + commits across groups', async () => {
    const { el } = mount(`
      <ui-select placeholder="Choose a plan…">
        <div role="group" label="Personal">
          <div role="option" value="free">Free</div>
          <div role="option" value="pro">Pro</div>
        </div>
        <div role="group" label="Business">
          <div role="option" value="team">Team</div>
        </div>
      </ui-select>
    `)
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    trigger.focus()
    await userEvent.keyboard('{ArrowDown}')
    await el.updateComplete
    expect(listbox.matches(':popover-open'), `${server.browser}: grouped select did not open`).toBe(true)

    // The panel sits a 0.25rem (≈4px at the 16px root) GAP below the trigger — a breathing margin,
    // not flush against it. (Placement is viewport-collision-aware: this anchor has room below.)
    const tRect = trigger.getBoundingClientRect()
    const lRect = listbox.getBoundingClientRect()
    const gap = lRect.top - tRect.bottom
    expect(gap, `${server.browser}: panel should sit ~0.25rem below the trigger, not flush`).toBeGreaterThan(2)
    expect(gap, `${server.browser}: panel gap should be ~4px (0.25rem), not a large jump`).toBeLessThan(8)

    // Whole-shape: both group headers render REAL boxes (not collapsed) and sit above their options.
    const headers = [...listbox.querySelectorAll<HTMLElement>('[data-part="group-label"]')]
    expect(headers.map((h) => h.textContent)).toEqual(['Personal', 'Business'])
    for (const h of headers) {
      const r = h.getBoundingClientRect()
      expect(r.width, `${server.browser}: group header collapsed`).toBeGreaterThan(0)
      expect(r.height, `${server.browser}: group header collapsed`).toBeGreaterThan(0)
    }

    // Rove down to a grouped option in the SECOND group and commit it — selection traverses groups,
    // never landing on a header.
    await userEvent.keyboard('{ArrowDown}{ArrowDown}') // Free → Pro → Team (headers are skipped)
    await new Promise((r) => setTimeout(r, 0))
    await el.updateComplete
    await userEvent.keyboard('{Enter}')
    await new Promise((r) => setTimeout(r, 0))
    await el.updateComplete

    expect(el.value, `${server.browser}: committing a grouped option did not set the value`).toBe('team')
    expect(listbox.matches(':popover-open'), `${server.browser}: grouped commit did not close`).toBe(false)
  })
})
