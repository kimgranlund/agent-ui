import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'
import type { UIComboBoxElement } from './combo-box.ts'

// Wave-4 S5 browser smoke — ui-combo-box (decomp S5 · overlay-controller.lld.md · ADR-0043).
//
// THIS IS THE ⭐ ADR-0043 COMBO-BOX GATE — S5's green smoke (Chromium + WebKit) ratifies the
// overlay + active-descendant + filter composition. BOTH engines required (not Chromium-only).
//
// What is proven here (none of this resolves in jsdom):
//   [1] open round-trip — listbox enters/leaves the Popover API top layer (both engines)
//   [2] TOP LAYER — panel renders above an overflow:hidden ancestor (both engines)
//   [3] active-descendant navigation — focus STAYS on the editor throughout Arrow nav; the
//       highlight moves via [data-active] + aria-activedescendant (both engines)
//   [4] type-filter + commit — typing filters; Enter commits; Escape closes (both engines)
//   [5] form round-trip — value round-trips through <form> FormData (both engines)
//   [6] WHOLE-SHAPE — editor's min-inline-size 20ch floor; panel real bounding box; the
//       editor is wider than tall (a field, not a square/dot) in a flex row (both engines)
//   [7] forced-colors — editor frame + panel surface survive WHCM (Chromium via CDP; WebKit baseline)
//   [8] C10 zero-residue — disconnect releases all overlay + input + keyboard listeners (both engines)
//
// Side-effect imports — CSS load order (ADR-0003): foundation roles + dimensional ramp FIRST,
// then the combo-box sheet, then the self-defining module. Imported DIRECTLY (relative), NOT
// via the component-styles barrel (the s12 barrel wiring lands at the integration slice).
import '@agent-ui/components/foundation-styles.css'
import '../_surface/container-box.css' // the box-model layer — provides the shared [data-fade-top]/[data-fade-bottom] mask
import './combo-box.css'
import './combo-box.ts'

// ── mount/cleanup ─────────────────────────────────────────────────────────────────────────────

const mounted: HTMLElement[] = []

/**
 * Mount a ui-combo-box into a realistic container (a display:flex row — the doc-specimen context
 * per the Test-the-whole-shape law). The listbox panel is in the Popover API top layer when open,
 * so the container affects the editor layout (where the 20ch min-inline-size floor lives).
 */
function mount(markup: string): { wrap: HTMLElement; el: UIComboBoxElement } {
  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  wrap.style.flexDirection = 'row'
  wrap.style.alignItems = 'center'
  wrap.style.gap = '8px'
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const el = wrap.querySelector('ui-combo-box') as UIComboBoxElement
  return { wrap, el }
}

afterEach(async () => {
  await userEvent.unhover(document.body)
  while (mounted.length) {
    const m = mounted.pop()!
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

describe('ui-combo-box — open round-trip via the native Popover API (both engines)', () => {
  it('open=true shows the listbox (popover is open + renders a box); open=false hides it', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="apple">Apple</div>
        <div role="option" value="banana">Banana</div>
      </ui-combo-box>
    `)
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    expect(listbox.matches(':popover-open'), 'listbox should be hidden by default').toBe(false)

    el.open = true
    await el.updateComplete
    expect(listbox.matches(':popover-open'), `${server.browser}: listbox did not enter the top layer`).toBe(true)

    // Whole-shape guard: the open panel MUST render a real bounding box (not collapsed)
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

describe('ui-combo-box — top layer escapes overflow:hidden ancestor (both engines)', () => {
  it('the open listbox paints ABOVE an overflow:hidden ancestor (elementFromPoint hits the panel)', async () => {
    const { el } = mount(`
      <div style="overflow:hidden;width:80px;height:40px;position:relative">
        <ui-combo-box style="display:inline-grid">
          <div role="option" value="a">Option A</div>
        </ui-combo-box>
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
//  [3] active-descendant — focus STAYS on the editor throughout Arrow nav (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-combo-box — active-descendant: focus stays on editor (both engines)', () => {
  it('ArrowDown on the editor opens the listbox; focus stays on the editor (NOT moved to the panel)', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="apple">Apple</div>
        <div role="option" value="banana">Banana</div>
        <div role="option" value="cherry">Cherry</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    editor.focus()
    await userEvent.keyboard('{ArrowDown}')
    await el.updateComplete

    expect(listbox.matches(':popover-open'), `${server.browser}: listbox did not open on ArrowDown`).toBe(true)

    // THE KEY INVARIANT: focus must NOT move to the listbox (active-descendant vs roving-focus)
    expect(
      document.activeElement,
      `${server.browser}: focus moved OFF the editor on ArrowDown (should stay via active-descendant)`,
    ).toBe(editor)

    // aria-activedescendant must now point to an option
    expect(
      editor.getAttribute('aria-activedescendant'),
      `${server.browser}: aria-activedescendant not set after ArrowDown`,
    ).toBeTruthy()

    // The first option must carry [data-active]
    const firstOpt = listbox.querySelector<HTMLElement>('[role=option]')!
    expect(
      firstOpt.hasAttribute('data-active'),
      `${server.browser}: first option does not have [data-active] after ArrowDown`,
    ).toBe(true)
  })

  it('repeated Arrow navigation: focus stays on editor; active-descendant advances + wraps', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="a">Alpha</div>
        <div role="option" value="b">Beta</div>
        <div role="option" value="c">Gamma</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    editor.focus()
    el.open = true
    await el.updateComplete

    // Navigate down three times: Alpha → Beta → Gamma
    await userEvent.keyboard('{ArrowDown}') // Alpha
    expect(document.activeElement).toBe(editor)
    await userEvent.keyboard('{ArrowDown}') // Beta
    expect(document.activeElement).toBe(editor)
    await userEvent.keyboard('{ArrowDown}') // Gamma
    expect(document.activeElement).toBe(editor)

    // Gamma should be active
    const opts = [...listbox.querySelectorAll<HTMLElement>('[role=option]')]
    expect(opts[2]!.hasAttribute('data-active'), 'Gamma should be active after 3 ArrowDowns').toBe(true)
    expect(opts[0]!.hasAttribute('data-active'), 'Alpha should NOT be active').toBe(false)

    // One more ArrowDown → wraps to Alpha
    await userEvent.keyboard('{ArrowDown}')
    expect(opts[0]!.hasAttribute('data-active'), 'Alpha should be active after wrapping').toBe(true)
    expect(document.activeElement).toBe(editor)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [4] type-filter + commit (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-combo-box — type-to-filter + commit (both engines)', () => {
  it('typing in the editor opens the panel and filters options (non-matching are hidden)', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="apple">Apple</div>
        <div role="option" value="banana">Banana</div>
        <div role="option" value="cherry">Cherry</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    expect(el.open).toBe(false)

    editor.focus()
    await userEvent.type(editor, 'app')
    await el.updateComplete

    expect(el.open, `${server.browser}: panel should open on typing`).toBe(true)
    expect(listbox.matches(':popover-open')).toBe(true)

    const opts = [...listbox.querySelectorAll<HTMLElement>('[role=option]')]
    expect(opts[0]!.hidden, 'Apple should be visible (matches "app")').toBe(false)
    expect(opts[1]!.hidden, 'Banana should be hidden (does not match "app")').toBe(true)
    expect(opts[2]!.hidden, 'Cherry should be hidden (does not match "app")').toBe(true)
  })

  it('Enter with active option commits: value = option key, editor = option label, panel closes', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="apple">Apple</div>
        <div role="option" value="banana">Banana</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    let changeCount = 0
    let selectKey = ''
    el.addEventListener('change', () => changeCount++)
    el.addEventListener('select', (e) => { selectKey = (e as CustomEvent<string>).detail })

    editor.focus()
    el.open = true
    await el.updateComplete
    await userEvent.keyboard('{ArrowDown}') // Apple
    await el.updateComplete
    await userEvent.keyboard('{Enter}')
    await el.updateComplete

    expect(el.value, `${server.browser}: value should be 'apple' after commit`).toBe('apple')
    expect(editor.textContent, `${server.browser}: editor should show 'Apple' label`).toBe('Apple')
    expect(listbox.matches(':popover-open'), `${server.browser}: panel should close after commit`).toBe(false)
    expect(changeCount).toBe(1)
    expect(selectKey).toBe('apple')
    // Focus must stay on the editor (NOT lost after commit — the UX invariant)
    expect(document.activeElement, 'focus should remain on the editor after commit').toBe(editor)
  })

  it('Enter with no active option + strict=false commits free text', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="apple">Apple</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!

    let changeCount = 0
    let selectCount = 0
    el.addEventListener('change', () => changeCount++)
    el.addEventListener('select', () => selectCount++)

    editor.focus()
    await userEvent.type(editor, 'pineapple')
    await el.updateComplete
    await userEvent.keyboard('{Enter}')
    await el.updateComplete

    expect(el.value, `${server.browser}: free-text value should commit`).toBe('pineapple')
    expect(changeCount, 'change should fire').toBe(1)
    expect(selectCount, 'select should NOT fire for free-text commit').toBe(0)
  })

  it('Escape closes the panel + syncs open=false + emits close + toggle (both engines)', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="apple">Apple</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    el.open = true
    await el.updateComplete
    expect(listbox.matches(':popover-open')).toBe(true)

    editor.focus()
    await userEvent.keyboard('{Escape}')
    await new Promise((r) => setTimeout(r, 0)) // let the queued Popover toggle task run (emits close/toggle)
    await el.updateComplete                    // flush the resulting reactive effect

    expect(listbox.matches(':popover-open'), `${server.browser}: Escape did not close the listbox`).toBe(false)
    expect(el.open, 'open prop should sync to false').toBe(false)
    expect(closes, 'close event should fire').toBe(1)
    expect(toggles, 'toggle event should fire').toBe(1)
  })

  it('clicking an option commits it and closes the panel (both engines)', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Pick fruit">
        <div role="option" value="mango">Mango</div>
        <div role="option" value="papaya">Papaya</div>
      </ui-combo-box>
    `)
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    let lastKey = ''
    el.addEventListener('select', (e) => { lastKey = (e as CustomEvent<string>).detail })

    el.open = true
    await el.updateComplete

    const papaya = listbox.querySelector<HTMLElement>('[value="papaya"]')!
    await userEvent.click(papaya)
    await el.updateComplete

    expect(lastKey, `${server.browser}: select detail should be the clicked option key`).toBe('papaya')
    expect(el.value).toBe('papaya')
    expect(listbox.matches(':popover-open'), `${server.browser}: panel should close after click-commit`).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [5] form round-trip — value round-trips through a <form> (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-combo-box — form round-trip (both engines)', () => {
  it('value submits under `name` via FormData; null when uncommitted; updates after commit', async () => {
    const { wrap } = mount(`
      <form>
        <ui-combo-box name="fruit" placeholder="Search fruit">
          <div role="option" value="apple">Apple</div>
          <div role="option" value="banana">Banana</div>
        </ui-combo-box>
      </form>
    `)
    const form = wrap.querySelector('form')!
    const el = wrap.querySelector('ui-combo-box') as UIComboBoxElement
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    // Nothing committed → no form entry (formValue() = null)
    expect(new FormData(form).get('fruit'), 'uncommitted combo-box should not submit a value').toBeNull()

    // Open + Arrow + Enter commits Apple
    el.open = true
    await el.updateComplete
    const apple = listbox.querySelector<HTMLElement>('[value="apple"]')!
    await userEvent.click(apple)
    await el.updateComplete

    expect(el.value).toBe('apple')
    expect(new FormData(form).get('fruit'), 'form should contain the committed value').toBe('apple')

    // Programmatic update
    el.value = 'banana'
    await el.updateComplete
    expect(new FormData(form).get('fruit'), 'programmatic value update should reflect in FormData').toBe('banana')
  })

  it('required + no value → valueMissing; clears after commit', async () => {
    const { wrap } = mount(`
      <form>
        <ui-combo-box name="size" required>
          <div role="option" value="sm">Small</div>
        </ui-combo-box>
      </form>
    `)
    const el = wrap.querySelector('ui-combo-box') as UIComboBoxElement

    expect(el.validity.valueMissing, 'required combo-box with no value → valueMissing').toBe(true)
    expect(el.validity.valid).toBe(false)

    el.value = 'sm'
    await el.updateComplete

    expect(el.validity.valid, 'validity should clear after value set').toBe(true)
    expect(el.validity.valueMissing).toBe(false)
  })

  it('strict=true + value not matching any option → typeMismatch; clears when matching', async () => {
    const { wrap } = mount(`
      <form>
        <ui-combo-box strict name="q">
          <div role="option" value="apple">Apple</div>
        </ui-combo-box>
      </form>
    `)
    const el = wrap.querySelector('ui-combo-box') as UIComboBoxElement

    el.value = 'pineapple' // not an option
    await el.updateComplete
    expect(el.validity.typeMismatch, 'strict + non-matching value → typeMismatch').toBe(true)

    el.value = 'apple' // matches
    await el.updateComplete
    expect(el.validity.valid, 'validity clears when value matches an option').toBe(true)
    expect(el.validity.typeMismatch).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [6] WHOLE-SHAPE — editor min-inline-size 20ch floor + panel real bounding box (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-combo-box — whole-shape assertion (Test-the-whole-shape DoD law)', () => {
  it('in a flex row, the editor floors to ≥20ch wide and is wider than tall (a field, not a dot)', async () => {
    // This is the anti-collapse regression test. A combo-box that shrinks to a dot in a flex
    // row (zero min-inline-size) passes all per-part px checks but is visually useless.
    // The --ui-combo-box-min-inline-size: 20ch floor (ADR-0021 entry-control law) prevents it.
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="apple">Apple</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!

    const editorRect = editor.getBoundingClientRect()

    // 20ch at 16px × ~8px/ch average ≈ 160px minimum. We assert ≥ 140px to allow for
    // narrower monospace fonts. The gestalt test (width ≫ height) is the load-bearing one.
    expect(
      editorRect.width,
      `${server.browser}: editor collapsed to ${editorRect.width}px — must floor to ~20ch (the ADR-0021 entry-control law)`,
    ).toBeGreaterThanOrEqual(140)

    // A combo-box editor must be far wider than tall — it is an input field, not a square.
    // The editor height is ~28px (--ui-height-md at default scale); width is ~20ch = ~160px+.
    expect(
      editorRect.width,
      `${server.browser}: editor is NOT wider than tall (collapsed or squeezed — ADR-0021 regression)`,
    ).toBeGreaterThan(editorRect.height)
  })

  it('editor has real Control-class height (≥ 24px = --ui-height-sm floor)', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="apple">Apple</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!
    const editorRect = editor.getBoundingClientRect()

    // The editor min-block-size is --ui-height-md = 28px at default scale.
    // We assert ≥ 24px (the sm-height floor) to allow rendering in different scale contexts.
    expect(
      editorRect.height,
      `${server.browser}: editor height is less than the sm-height minimum (24px) — did the height token fail?`,
    ).toBeGreaterThanOrEqual(24)
  })

  it('open panel has real bounding box (not collapsed); min-inline-size floor is positive', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…" style="width: 200px">
        <div role="option" value="opt1">Option One</div>
        <div role="option" value="opt2">Option Two</div>
        <div role="option" value="opt3">Option Three</div>
      </ui-combo-box>
    `)
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    expect(listbox.matches(':popover-open'), 'listbox should be hidden before open').toBe(false)

    el.open = true
    await el.updateComplete

    const panelRect = listbox.getBoundingClientRect()
    expect(panelRect.width, `${server.browser}: listbox collapsed to zero width — min-inline-size floor?`).toBeGreaterThan(0)
    expect(panelRect.height, `${server.browser}: listbox collapsed to zero height — are options inside?`).toBeGreaterThan(0)

    const minWidth = px(getComputedStyle(listbox).minInlineSize)
    expect(minWidth, `${server.browser}: panel min-inline-size is not a positive px — collapse risk`).toBeGreaterThan(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [7] forced-colors — editor frame + panel surface survive WHCM (Chromium via CDP; WebKit baseline)
// ════════════════════════════════════════════════════════════════════════════════════════════════
//
// Headless Playwright does not emulate `forced-colors: active` by default on WebKit. Chromium uses
// CDP Emulation to toggle the media query and assert the system-colour mappings declared in the
// `@media (forced-colors: active)` block survive (Field/FieldText, Canvas/CanvasText, Highlight).

describe('ui-combo-box — forced-colors (Chromium via CDP; WebKit asserts the baseline)', () => {
  it('editor frame + panel surface are visible in normal mode AND survive forced-colors', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Choose…">
        <div role="option" value="a">Option A</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    // Baseline (BOTH engines, normal mode): editor has a visible border
    expect(
      px(getComputedStyle(editor).borderTopWidth),
      `${server.browser}: editor frame has no border in normal mode (forced-colors check would be vacuous)`,
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
      // WebKit: no CDP forced-colors emulation available in headless mode
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'forced-colors', value: 'active' }],
    })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)

      // Editor: must have a visible border (FieldText) and a non-transparent background (Field)
      expect(
        px(getComputedStyle(editor).borderTopWidth),
        'editor frame vanished under forced-colors',
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
//  Edge-aware scroll fade (the gutter-exposure fix, 2026-07-04) — DEFAULT-ON, no opt-in prop. Also
//  proves the NEW max-block-size:40vh + overflow-y:auto bound (was `overflow: hidden`, unscrollable).
//  scroll-fade.test.ts proves the trait's decision logic (jsdom, stubbed geometry); this proves the
//  whole live wire on the real scroll viewport (the listbox panel).
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

describe('ui-combo-box — the panel is now BOUNDED (max-block-size:40vh) and gets an edge-aware fade by default (both engines)', () => {
  it('a long option list genuinely overflows the new 40vh cap (the bound is real, not vacuous — it used to be overflow:hidden)', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="a" style="block-size: 2000px">Apple</div>
        <div role="option" value="b">Banana</div>
      </ui-combo-box>
    `)
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!
    el.open = true
    await el.updateComplete
    await nextFrames()
    expect(listbox.scrollHeight, `${server.browser}: the panel did not overflow its new max-block-size cap`).toBeGreaterThan(listbox.clientHeight)
  })

  it('at the TOP: data-fade-bottom (more below), not data-fade-top', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="a" style="block-size: 2000px">Apple</div>
      </ui-combo-box>
    `)
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!
    el.open = true
    await el.updateComplete
    await nextFrames()
    await scrollTo(listbox, 0)
    expect(listbox.hasAttribute('data-fade-top'), `${server.browser}: fresh panel wrongly fades the top`).toBe(false)
    expect(listbox.hasAttribute('data-fade-bottom'), `${server.browser}: the panel did not fade its bottom`).toBe(true)
  })

  it('scrolled to the BOTTOM: data-fade-top, not data-fade-bottom', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="a" style="block-size: 2000px">Apple</div>
      </ui-combo-box>
    `)
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!
    el.open = true
    await el.updateComplete
    await nextFrames()
    await scrollTo(listbox, listbox.scrollHeight)
    expect(listbox.hasAttribute('data-fade-top'), `${server.browser}: end-of-scroll did not fade the top`).toBe(true)
    expect(listbox.hasAttribute('data-fade-bottom'), `${server.browser}: end-of-scroll wrongly kept the bottom faded`).toBe(false)
  })

  it('a SHORT option list (fits, no scrollable overflow) never fades either edge', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="a">Apple</div>
      </ui-combo-box>
    `)
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!
    el.open = true
    await el.updateComplete
    await nextFrames()
    expect(listbox.scrollHeight, 'the panel unexpectedly overflows (test setup is vacuous)').toBeLessThanOrEqual(listbox.clientHeight)
    expect(listbox.hasAttribute('data-fade-top')).toBe(false)
    expect(listbox.hasAttribute('data-fade-bottom')).toBe(false)
    expect(maskOf(listbox), `${server.browser}: a short panel painted a mask`).toBe('none')
  })

  it('the rendered mask PAINTS a gradient exactly when a flag is present', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="a" style="block-size: 2000px">Apple</div>
      </ui-combo-box>
    `)
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!
    el.open = true
    await el.updateComplete
    await nextFrames()
    await scrollTo(listbox, 0)
    expect(maskOf(listbox), `${server.browser}: the panel's fade flag did not paint a mask`).toMatch(/gradient/)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [8] C10 zero-residue — disconnect releases all listeners (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-combo-box — C10 zero-residue (both engines)', () => {
  it('after disconnect, input events do NOT open the panel (input listener removed)', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="x">X</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!

    el.remove() // disconnect → scope.dispose() → AbortController aborted → all listeners gone

    // Simulate typing on the disconnected editor — the listener must be gone
    editor.textContent = 'x'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    await el.updateComplete

    expect(el.open, 'disconnected combo-box should NOT open on input (listener removed)').toBe(false)
  })

  it('reconnect: exactly one panel open per ArrowDown + commit (no stacked listeners)', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="apple">Apple</div>
        <div role="option" value="banana">Banana</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!

    let changeCount = 0
    el.addEventListener('change', () => changeCount++)

    // First connect cycle: open + commit Apple
    el.open = true
    await el.updateComplete
    editor.focus()
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{Enter}')
    await el.updateComplete
    expect(changeCount).toBe(1)
    expect(el.value).toBe('apple')

    // Disconnect + reconnect (a re-mount in a dynamic list)
    el.remove()
    el.value = '' // reset
    changeCount = 0
    document.body.append(el)
    await el.updateComplete

    const newEditor = el.querySelector<HTMLElement>('[data-part="editor"]')!
    newEditor.focus()
    el.open = true
    await el.updateComplete
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{Enter}')
    await el.updateComplete

    // ONE commit → change fires ONCE (not doubled from stacked listeners)
    expect(changeCount, 'reconnected combo-box should fire change exactly once (no stacked listeners)').toBe(1)
    mounted.pop() // clean up the re-appended el (not in mounted[] from mount())
    el.remove()
  })
})
