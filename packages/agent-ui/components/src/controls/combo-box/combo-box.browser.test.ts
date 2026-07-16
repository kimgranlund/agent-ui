import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent, page } from 'vitest/browser'
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
//   [9] ADR-0085 — the editor's accessible name = "label", the committed text stays a DISTINCT value
//       (jsdom cannot compute an accessible name at all)
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

    // Regression guard (2026-07-07): when real matches exist, the "No matches" placeholder must
    // NOT paint alongside them. `hidden` is set by JS, but author-origin `display:block` on
    // `[data-part='empty']` used to beat the UA `[hidden]{display:none}` rule — check the
    // COMPUTED style, not just the IDL `hidden` flag, so a CSS-origin regression is caught even
    // if the attribute itself is set correctly.
    const emptyRow = listbox.querySelector<HTMLElement>('[data-part="empty"]')!
    expect(emptyRow.hidden, 'the "no matches" row should be hidden when real matches exist').toBe(true)
    expect(
      getComputedStyle(emptyRow).display,
      `${server.browser}: [data-part='empty'][hidden] must compute display:none — it must not paint alongside real matches`,
    ).toBe('none')
  })

  // ──────────────────────────────────────────────────────────────────────────────────────────────
  //  Bug fix (2026-07-07): typing text that matches ZERO options used to leave the listbox panel
  //  open with every [role=option] hidden — no content, no min-block-size — so the panel collapsed
  //  to its own 1px top+bottom border (a ~2px-tall rectangle painting as a stray horizontal line
  //  below the editor). The fix: a control-created "no matches" row (`[data-part="empty"]`) is
  //  revealed exactly when zero options are visible, giving the panel real, deliberate content +
  //  height instead of collapsing to a border-only sliver.
  // ──────────────────────────────────────────────────────────────────────────────────────────────
  it('typing text matching ZERO options shows the "No matches" row + the panel has a real bounding box (not a collapsed border-only line)', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="apple">Apple</div>
        <div role="option" value="banana">Banana</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    editor.focus()
    await userEvent.type(editor, 'asdfadf')
    await el.updateComplete

    const opts = [...listbox.querySelectorAll<HTMLElement>('[role=option]')]
    expect(opts.every((o) => o.hidden), 'every option should be filtered out').toBe(true)

    const emptyRow = listbox.querySelector<HTMLElement>('[data-part="empty"]')
    expect(emptyRow, `${server.browser}: no [data-part="empty"] row found`).not.toBeNull()
    expect(emptyRow!.hidden, `${server.browser}: the "no matches" row should be visible when zero options match`).toBe(false)
    expect(
      getComputedStyle(emptyRow!).display,
      `${server.browser}: the "no matches" row should compute display:block when zero options match`,
    ).toBe('block')
    expect(emptyRow!.textContent, 'the row should read "No matches"').toBe('No matches')
    // it must not be mistaken for a navigable/commit-able option by either path
    expect(emptyRow!.getAttribute('role'), 'the row is role=presentation, never role=option').toBe('presentation')

    // THE REGRESSION GUARD: the panel must render a REAL box, not collapse to a ~2px border sliver.
    const rect = listbox.getBoundingClientRect()
    expect(
      rect.height,
      `${server.browser}: the empty-results panel collapsed to ${rect.height}px — the stray-line regression`,
    ).toBeGreaterThan(20)
  })

  it('committing (Enter free-text) after a zero-match filter re-hides the "No matches" row (filter clears on commit)', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="apple">Apple</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    editor.focus()
    await userEvent.type(editor, 'zzz')
    await el.updateComplete
    expect(listbox.querySelector<HTMLElement>('[data-part="empty"]')!.hidden).toBe(false)

    await userEvent.keyboard('{Enter}') // strict=false free-text commit
    await el.updateComplete

    expect(
      listbox.querySelector<HTMLElement>('[data-part="empty"]')!.hidden,
      `${server.browser}: commit should clear the filter, re-hiding the "no matches" row`,
    ).toBe(true)
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

    el.open = true
    await el.updateComplete
    expect(listbox.matches(':popover-open')).toBe(true)

    // Counters attached AFTER the open (which itself now announces one `toggle` — ADR-0101: every
    // real show/hide announces) so they measure ONLY the Escape-driven close+toggle pair.
    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

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

  // ──────────────────────────────────────────────────────────────────────────────────────────────
  //  Bug fix (2026-07-07): a `contenteditable`'s OWN UA default is `white-space: pre-wrap` — every
  //  other single-line Control-class entry field in the fleet overrides this (text-field.css), but
  //  ui-combo-box's editor never did. A placeholder or typed value that exceeded the field's width
  //  WRAPPED onto a second line, growing the box past its fixed `--ui-combo-box-height` (min-block-
  //  size is a floor, not a cap) — the box's height became inconsistent with a single-line control,
  //  visually displacing the caret relative to a now multi-line placeholder block (the "caret sits
  //  oddly" defect Kim filed). The fix pins `white-space: nowrap` + `overflow: hidden`, matching
  //  text-field exactly: long content clips + the editor self-scrolls horizontally instead.
  // ──────────────────────────────────────────────────────────────────────────────────────────────
  it('the editor is single-line: white-space:nowrap + overflow:hidden (matches text-field; was missing)', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="apple">Apple</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!
    const cs = getComputedStyle(editor)

    expect(cs.whiteSpace, `${server.browser}: editor must not wrap (single-line Control-class entry field)`).not.toBe('pre-wrap')
    expect(cs.whiteSpace, `${server.browser}: editor white-space should be nowrap (or the nowrap-equivalent "pre")`).toMatch(/^(nowrap|pre)$/)
    expect(cs.overflow, `${server.browser}: overflowing content should clip, not grow the box`).toBe('hidden')
  })

  it('a long placeholder in a width-constrained host stays SINGLE-LINE (clips) instead of wrapping and growing the box height', async () => {
    const { el } = mount(`
      <ui-combo-box
        placeholder="Type or pick a fruit from the long long long list…"
        style="width: 220px"
      >
        <div role="option" value="apple">Apple</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!
    const rect = editor.getBoundingClientRect()

    // Before the fix this measured ~30px+ (2 wrapped lines); the fixed single-line height is the
    // --ui-combo-box-height token (--ui-height-md ≈ 28px at default scale). Assert it stays at the
    // sm-height floor (24px) rather than growing for a second line.
    expect(
      rect.height,
      `${server.browser}: editor grew to ${rect.height}px — the placeholder wrapped onto a 2nd line (the fixed regression)`,
    ).toBeLessThan(29)
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

  // ────────────────────────────────────────────────────────────────────────────────────────────
  //  The size-carrying model (2026-07-06 fix, ui-select's family): panel inset + option pad were
  //  fixed px (--ui-space-xs/sm), identical regardless of the editor's own geometry. They are now
  //  DERIVED off --ui-combo-box-height/-font/-padding-inline, so option text aligns under the
  //  editor's own text edge and the option row height matches the editor height. ui-combo-box has
  //  no `[size]` attribute yet (only one register renders today), so this is a single-register
  //  proof — not a [size] anti-vacuous sweep (that needs its own future ADR/decomp, see combo-box.md).
  // ────────────────────────────────────────────────────────────────────────────────────────────
  it('panel inset + option inline-pad sum to the editor inline pad — the alignment law, browser-measured', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="apple">Apple</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!
    el.open = true
    await el.updateComplete
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!
    const option = listbox.querySelector<HTMLElement>('[role="option"]')!

    const editorPad = px(getComputedStyle(editor).paddingInlineStart)
    const optionCs = getComputedStyle(option)
    const sum = px(optionCs.marginInlineStart) + px(optionCs.paddingInlineStart)

    expect(
      sum,
      `${server.browser}: panel-inset+option-inline (${sum}px) should equal the editor's own inline pad (${editorPad}px)`,
    ).toBeCloseTo(editorPad, 1)
  })

  it('option row rendered height == editor height — the row-height law, browser-measured', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="apple">Apple</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!
    const editorH = editor.getBoundingClientRect().height

    el.open = true
    await el.updateComplete
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!
    const option = listbox.querySelector<HTMLElement>('[role="option"]')!
    const rowH = option.getBoundingClientRect().height

    expect(
      rowH,
      `${server.browser}: option row height (${rowH}px) should match editor height (${editorH}px)`,
    ).toBeCloseTo(editorH, 0)
  })

  // ────────────────────────────────────────────────────────────────────────────────────────────
  //  h/2 STANDARDIZATION (2026-07-06 follow-up): the editor's inline text inset was the fleet's
  //  lone entry-control outlier still anchored to a fixed --ui-space-sm token instead of the
  //  Control-class h/2 value-edge law (text-field.css:119, select.css trigger). It is now
  //  calc(--ui-combo-box-height / 2) — byte-identical in model to ui-select's trigger/listbox
  //  pairing. These two probes pin the browser-measured consequence: the editor's OWN computed
  //  padding-inline is really h/2 (not just internally self-consistent), and the option text still
  //  lines up under the editor text at the new, wider offset.
  // ────────────────────────────────────────────────────────────────────────────────────────────
  it('editor computed padding-inline == --ui-combo-box-height / 2 (the fleet h/2 value-edge standard)', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="apple">Apple</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!
    const editorH = editor.getBoundingClientRect().height
    const editorPad = px(getComputedStyle(editor).paddingInlineStart)

    expect(
      editorPad,
      `${server.browser}: editor padding-inline (${editorPad}px) should equal height/2 (${editorH / 2}px) — the h/2 standard`,
    ).toBeCloseTo(editorH / 2, 0)
  })

  it("an open option's text inline offset (from the panel edge) equals the editor's text inline offset (from the editor edge) — alignment law holds under h/2", async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="apple">Apple</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!
    el.open = true
    await el.updateComplete
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!
    const option = listbox.querySelector<HTMLElement>('[role="option"]')!

    // The editor's own text edge, relative to the editor's box: padding-inline-start (h/2 now).
    const editorTextInset = px(getComputedStyle(editor).paddingInlineStart)

    // The option's text edge, relative to the PANEL's box: the option's own margin-inline-start
    // (the box-model inset, h/4) PLUS its padding-inline-start (h/4) — h/4 + h/4 == h/2, so this
    // must equal the editor's own inset exactly (both engines, browser-measured).
    const optionCs = getComputedStyle(option)
    const optionTextInset = px(optionCs.marginInlineStart) + px(optionCs.paddingInlineStart)

    expect(
      optionTextInset,
      `${server.browser}: option text inline offset (${optionTextInset}px) should equal the editor's text inline offset (${editorTextInset}px)`,
    ).toBeCloseTo(editorTextInset, 0)
  })

  it('option font-size resolves to --ui-combo-box-font (was inherited ambient — bug fix)', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="apple">Apple</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!
    el.open = true
    await el.updateComplete
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!
    const option = listbox.querySelector<HTMLElement>('[role="option"]')!

    const editorFont = px(getComputedStyle(editor).fontSize)
    const optionFont = px(getComputedStyle(option).fontSize)
    expect(
      optionFont,
      `${server.browser}: option font-size (${optionFont}px) should match the editor font (${editorFont}px), not an inherited ambient value`,
    ).toBeCloseTo(editorFont, 1)
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
//  TKT-0027 spot leg — the default panel cap is min(50vh, 12 option rows); an option row renders at
//  exactly --ui-combo-box-height (28px at default [size=md]), so the 12-row calc arm is 12×28 +
//  13×7 = 427px (under the default 896px-viewport's 448px 50vh) — the arm actually binding. The
//  full 12-fit/13-scroll/50vh-clamp trio lives on ui-menu (menu.browser.test.ts); this is the spot
//  check confirming the same formula holds here too.
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-combo-box — TKT-0027 panel max-block-size dial: a 13th option overflows the default cap (both engines)', () => {
  it('13 real options overflow the default min(50vh, 12 rows) cap (scrollHeight > clientHeight)', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        ${Array.from({ length: 13 }, (_, i) => `<div role="option" value="opt-${i}">Option ${i}</div>`).join('\n')}
      </ui-combo-box>
    `)
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!
    el.open = true
    await el.updateComplete
    await nextFrames()
    expect(
      listbox.scrollHeight,
      `${server.browser}: the 13th option did not overflow the default cap (TKT-0027 formula regression?)`,
    ).toBeGreaterThan(listbox.clientHeight)
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

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [9] ADR-0085 — the editor's accessible-name seam (jsdom cannot compute an accessible name at all)
// ════════════════════════════════════════════════════════════════════════════════════════════════
//
// combo-box.test.ts pins the DECLARED wiring (aria-label presence/absence, the yield to
// aria-labelledby via a direct setFieldLabelling call — the exact seam a real `ui-field` drives,
// ADR-0051). This is the read-back that resolution ACTUALLY happens: `page.getByRole` resolves a
// plain content-attribute name (`aria-label` bare, `aria-labelledby` fielded) correctly in both
// engines for a role="combobox" part (the text-field precedent, field.browser.test.ts).

describe('ui-combo-box — the editor accessible-name seam (ADR-0085, both engines)', () => {
  it('a labelled bare combo-box names the editor "label"; the committed text stays a DISTINCT accessible value', async () => {
    const { el } = mount(`
      <ui-combo-box label="Fruit" value="apple">
        <div role="option" value="apple">Apple</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!
    await el.updateComplete

    const named = page.getByRole('combobox', { name: 'Fruit', exact: true }).query()
    expect(named, `${server.browser}: no combobox named "Fruit" — the aria-label wire did not land`).not.toBeNull()
    expect(named).toBe(editor)
    // The value stays DISTINCT — nothing about the name erased the committed text.
    expect(editor.textContent, `${server.browser}: the editor's value should still read "Apple"`).toBe('Apple')
  })

  it('an unlabelled bare combo-box carries no aria-label (back-compat, ADR-0014-style unchanged)', async () => {
    const { el } = mount(`
      <ui-combo-box placeholder="Search…">
        <div role="option" value="apple">Apple</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!
    await el.updateComplete
    expect(editor.hasAttribute('aria-label'), `${server.browser}: an unlabelled editor should carry no aria-label`).toBe(false)
  })

  it('a fielded combo-box names the editor from the field label (aria-labelledby); the bare aria-label yields', async () => {
    const { el } = mount(`
      <ui-combo-box label="Fruit" value="apple">
        <div role="option" value="apple">Apple</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!

    // A stand-in field label part — setFieldLabelling is the PUBLIC seam a real ui-field calls
    // (ADR-0051); proves the same code path without pulling a sibling control into this control's
    // own isolated browser test file (the per-control CSS/JS import discipline above).
    const fieldLabel = document.createElement('div')
    fieldLabel.id = 'ext-field-label-1'
    fieldLabel.textContent = 'Favourite fruit'
    document.body.append(fieldLabel)
    mounted.push(fieldLabel)

    el.setFieldLabelling({ label: fieldLabel, description: null, error: null })
    await el.updateComplete

    expect(editor.hasAttribute('aria-label'), `${server.browser}: the bare aria-label should yield while fielded`).toBe(false)
    const named = page.getByRole('combobox', { name: 'Favourite fruit', exact: true }).query()
    expect(named, `${server.browser}: the fielded accessible name did not compute to "Favourite fruit"`).not.toBeNull()
    expect(editor.textContent, `${server.browser}: the committed value should still read "Apple"`).toBe('Apple')

    el.setFieldLabelling(null)
    await el.updateComplete
    const revertedName = page.getByRole('combobox', { name: 'Fruit', exact: true }).query()
    expect(revertedName, `${server.browser}: dissociation did not revert to the bare "Fruit" name`).not.toBeNull()
  })
})

// ── user-invalid leg (ADR-0051) — jsdom has no CustomStateSet, so :state(user-invalid) matching + the real
// editor border repaint can only be proven here (the text-field-states.browser.test.ts precedent).
describe('ui-combo-box — user-invalid leg (ADR-0051)', () => {
  it('a required, empty combo-box arms :state(user-invalid) + repaints the editor border, only AFTER focus+blur', async () => {
    const { el } = mount(`
      <ui-combo-box required>
        <div role="option" value="apple">Apple</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector('[data-part="editor"]') as HTMLElement

    expect(el.matches(':state(user-invalid)'), 'user-invalid must not flash before any interaction').toBe(false)
    const idleBorder = getComputedStyle(editor).borderColor

    editor.focus()
    editor.blur()
    await el.updateComplete

    expect(el.matches(':state(user-invalid)'), ':state(user-invalid) was not armed on editor blur').toBe(true)
    const invalidBorder = getComputedStyle(editor).borderColor
    expect(invalidBorder, "the editor's border-color did not repaint under :state(user-invalid)").not.toBe(idleBorder)

    // RECOVERY: a real commit (typed text + Enter, emitting `change`) clears the constraint.
    await userEvent.click(editor)
    await userEvent.keyboard('Apple')
    await userEvent.keyboard('{Enter}')
    await el.updateComplete
    expect(el.matches(':state(user-invalid)'), 'user-invalid persists after a value is committed').toBe(false)
  })
})

// TKT-0047 — the editor's disabled `opacity: 0.5` was replaced with a token-repoint (the fleet's
// dominant disabled mechanism, matching select.css's fully-repointed [disabled] precedent). No
// CSS transition on border/background/color in this file, so no settle-wait is needed.
describe('ui-combo-box — disabled paint (TKT-0047, opacity removed)', () => {
  it('disabled: the editor is fully opaque (no opacity dimming) yet its ink repaints to the muted token', async () => {
    const { el: idle } = mount(`
      <ui-combo-box>
        <div role="option" value="apple">Apple</div>
      </ui-combo-box>
    `)
    const idleEditor = idle.querySelector('[data-part="editor"]') as HTMLElement
    const idleInk = getComputedStyle(idleEditor).color

    const { el: disabled } = mount(`
      <ui-combo-box disabled>
        <div role="option" value="apple">Apple</div>
      </ui-combo-box>
    `)
    const disabledEditor = disabled.querySelector('[data-part="editor"]') as HTMLElement

    expect(getComputedStyle(disabledEditor).opacity, 'opacity dimming should be gone — the token repoint carries it now').toBe(
      '1',
    )
    expect(getComputedStyle(disabledEditor).color, 'the disabled ink must still repaint to the muted token').not.toBe(
      idleInk,
    )
  })

  // TKT-0063 — a real <fieldset disabled> (the FORM-disabled channel, never the combo-box's own `disabled`
  // attribute) must paint the SAME disabled row as the own-attribute case above.
  it('a combo-box inside a real <fieldset disabled> repaints to the SAME muted ink as the combo-box\'s own [disabled] attribute', async () => {
    const { el: ownDisabled } = mount(`
      <ui-combo-box disabled>
        <div role="option" value="apple">Apple</div>
      </ui-combo-box>
    `)
    const ownEditor = ownDisabled.querySelector('[data-part="editor"]') as HTMLElement
    const ownDisabledInk = getComputedStyle(ownEditor).color

    const { wrap } = mount(`<fieldset disabled><ui-combo-box><div role="option" value="apple">Apple</div></ui-combo-box></fieldset>`)
    const formDisabled = wrap.querySelector('ui-combo-box') as UIComboBoxElement
    const formEditor = formDisabled.querySelector('[data-part="editor"]') as HTMLElement
    await formDisabled.updateComplete

    expect(formEditor.getAttribute('aria-disabled'), 'the editor must be aria-disabled under the FORM-disabled channel too').toBe('true')
    expect(getComputedStyle(formEditor).color, 'a form-disabled combo-box must paint the SAME muted ink as an own-[disabled] combo-box').toBe(ownDisabledInk)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  TKT-0062 — the filled/container state law genuinely repaints in a REAL engine, not just structurally
//  (the text-field-states.browser.test.ts precedent, adapted: combo-box's editor IS the frame, so
//  every assertion reads the editor part directly rather than the host).
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-combo-box — the TKT-0062 filled/container state law (real repaint, both engines)', () => {
  it('empty+idle vs typed+idle repaint background AND ink together (not just border, unlike the old law)', async () => {
    const { el } = mount(`
      <ui-combo-box>
        <div role="option" value="apple">Apple</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector('[data-part="editor"]') as HTMLElement
    const emptyBg = getComputedStyle(editor).backgroundColor
    const emptyInk = getComputedStyle(editor).color

    await userEvent.click(editor)
    await userEvent.keyboard('apple')
    editor.blur() // drop focus so the FILLED (idle) row paints, not the focus row
    await expect.poll(() => editor.matches(':focus')).toBe(false)

    const filledBg = getComputedStyle(editor).backgroundColor
    const filledInk = getComputedStyle(editor).color
    expect(filledBg, 'the background did not repaint between empty and filled').not.toBe(emptyBg)
    expect(filledInk, 'the ink did not repaint between empty and filled').not.toBe(emptyInk)
  })

  it('focus wins over filled: a focused-AND-filled editor shows the FOCUS row, not the filled row', async () => {
    const { el } = mount(`
      <ui-combo-box>
        <div role="option" value="apple">Apple</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector('[data-part="editor"]') as HTMLElement

    await userEvent.click(editor)
    await userEvent.keyboard('apple')
    // still focused here — the mutual-exclusion CSS (filled excludes :focus) means the FOCUS
    // background/ink tokens must be what's painted, not the filled ones, even though the editor is
    // ALSO filled.
    expect(editor.matches(':focus'), 'the editor unexpectedly lost focus').toBe(true)
    await expect
      .poll(() => alphaOf(getComputedStyle(editor).borderTopColor), { timeout: 1500 })
      .toBe(0) // the focus row's border is transparent (same as the idle/filled rows — proven by the forced-colors test)

    // anti-vacuous: filled and focus DO differ on ink (on-surface-variant vs on-surface) — if this
    // ever becomes false (a token edit collapses the two roles), this test would start silently
    // passing for the wrong reason, so assert the values actually differ. POLL-BASED (not a
    // synchronous read) — combo-box.css carries no state transition today, but the read stays
    // poll-based to match the fleet's TKT-0062 pattern (a synchronous read caught text-field's ink
    // mid-fade the first time this shape was authored there).
    editor.blur()
    await expect.poll(() => editor.matches(':focus')).toBe(false)
    const filledInk = getComputedStyle(editor).color
    editor.focus()
    await expect.poll(() => editor.matches(':focus')).toBe(true)
    await expect
      .poll(() => getComputedStyle(editor).color, { timeout: 1500 })
      .not.toBe(filledInk)
  })

  it('an EMPTY combo-box\'s PLACEHOLDER repaints on hover and focus too (TKT-0065 lateral-review F13 regression)', async () => {
    // The bug this pins: the state rules repointed the editor's `color:` PROPERTY, but the
    // placeholder ::before carries its own `color: var(--ui-combo-box-placeholder)` — an alias of
    // the ink TOKEN — so a property-only repoint never reached it: an empty combo-box's placeholder
    // stayed frozen at the default ink under hover AND focus while text-field's repainted (proven
    // frozen in a real Chromium+WebKit probe). The fix repoints the --ui-combo-box-ink token itself
    // (the TKT-0062 mechanic-[b] shape); this test reads the ::before — the element that renders
    // the visible placeholder — never the editor's own color.
    const { el } = mount(`
      <ui-combo-box placeholder="Pick…">
        <div role="option" value="apple">Apple</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector('[data-part="editor"]') as HTMLElement
    const defaultInk = getComputedStyle(editor, '::before').color

    await userEvent.hover(editor)
    await expect
      .poll(() => getComputedStyle(editor, '::before').color, { timeout: 1500 })
      .not.toBe(defaultInk)
    await userEvent.unhover(editor)

    editor.focus()
    await expect.poll(() => editor.matches(':focus')).toBe(true)
    await expect
      .poll(() => getComputedStyle(editor, '::before').color, { timeout: 1500 })
      .not.toBe(defaultInk)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [10] TKT-0026 — a late-added Option adopts into the REAL top-layer panel (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-combo-box — dynamic options: a late Option adopts into the panel (TKT-0026, both engines)', () => {
  it('appended WHILE CLOSED: the late option renders inside the panel once opened, and is clickable', async () => {
    const { el } = mount(`
      <ui-combo-box>
        <div role="option" value="apple">Apple</div>
        <div role="option" value="banana">Banana</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    const late = document.createElement('div')
    late.setAttribute('role', 'option')
    late.setAttribute('value', 'cherry')
    late.textContent = 'Cherry'
    el.append(late)
    await Promise.resolve() // MutationObserver callback is microtask-deferred
    await Promise.resolve()

    expect(late.parentElement, `${server.browser}: the late option was not adopted into the panel`).toBe(listbox)

    await userEvent.click(editor)
    await userEvent.keyboard('{ArrowDown}')
    await el.updateComplete
    expect(listbox.matches(':popover-open'), `${server.browser}: the panel did not open`).toBe(true)

    const rect = late.getBoundingClientRect()
    expect(rect.width, `${server.browser}: the late option collapsed to zero width in the open panel`).toBeGreaterThan(0)
    expect(rect.height, `${server.browser}: the late option collapsed to zero height in the open panel`).toBeGreaterThan(0)

    await userEvent.click(late)
    await el.updateComplete
    expect(el.value, `${server.browser}: clicking the late option did not commit it`).toBe('cherry')
    expect(editor.textContent, `${server.browser}: the editor should show the committed label`).toBe('Cherry')
  })

  it('appended WHILE OPEN: the panel updates LIVE — the late option renders + is clickable without closing/reopening', async () => {
    const { el } = mount(`
      <ui-combo-box>
        <div role="option" value="apple">Apple</div>
        <div role="option" value="banana">Banana</div>
      </ui-combo-box>
    `)
    const editor = el.querySelector<HTMLElement>('[data-part="editor"]')!
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!

    await userEvent.click(editor)
    await userEvent.keyboard('{ArrowDown}')
    await el.updateComplete
    expect(listbox.matches(':popover-open'), `${server.browser}: the panel did not open`).toBe(true)

    const late = document.createElement('div')
    late.setAttribute('role', 'option')
    late.setAttribute('value', 'cherry')
    late.textContent = 'Cherry'
    el.append(late)
    await Promise.resolve() // MutationObserver callback is microtask-deferred
    await Promise.resolve()

    // Still open (the adoption must not disturb the open panel) AND the new option renders live,
    // BEFORE the "no matches" row (the emptyRow-stays-last invariant, live in a real engine too).
    expect(listbox.matches(':popover-open'), `${server.browser}: adopting a late option unexpectedly closed the panel`).toBe(true)
    expect(late.parentElement, `${server.browser}: the late option was not adopted into the OPEN panel`).toBe(listbox)
    expect(listbox.lastElementChild?.getAttribute('data-part'), `${server.browser}: the "no matches" row should stay last`).toBe('empty')
    const rect = late.getBoundingClientRect()
    expect(rect.width, `${server.browser}: the live-adopted option collapsed to zero width`).toBeGreaterThan(0)
    expect(rect.height, `${server.browser}: the live-adopted option collapsed to zero height`).toBeGreaterThan(0)

    await userEvent.click(late)
    await el.updateComplete
    expect(el.value, `${server.browser}: clicking the live-adopted option did not commit it`).toBe('cherry')
  })
})
