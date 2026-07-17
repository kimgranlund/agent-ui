import { describe, it, expect, afterEach } from 'vitest'
import { server, userEvent, cdp } from 'vitest/browser'
import { UIToolbarElement } from './toolbar.ts'
import { UIButtonElement } from '../button/button.ts'

// toolbar.lld.md LLD-C9 — the CROSS-ENGINE smoke for ui-toolbar (ADR-0121). Where toolbar.test.ts pins the
// DECLARED/logical roving behaviour, this pins what a REAL engine does: real focus order (one Tab stop, arrow
// navigation along orientation, Home/End, no wrap, no type-ahead, disabled-skip, reconnect re-arm) AND the
// whole-shape law (a populated toolbar of REAL ui-buttons renders as a bar with real width/height, both
// postures). Runs in BOTH Chromium and WebKit (vitest.browser.config.ts → the two playwright instances).
//
// Side-effect CSS imports — the load-bearing order (ADR-0003): foundation roles + ramp FIRST, then the shared
// container surface seam, then this component sheet, then the button sheet (the item control it hosts).
import '@agent-ui/components/foundation-styles.css'
import '../_surface/container.css'
import './toolbar.css'
import '../button/button.css'

const mounted: HTMLElement[] = []
const mount = (markup: string): { wrap: HTMLElement; toolbar: UIToolbarElement; buttons: UIButtonElement[] } => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const toolbar = wrap.querySelector('ui-toolbar') as UIToolbarElement
  const buttons = [...wrap.querySelectorAll('ui-button')] as UIButtonElement[]
  return { wrap, toolbar, buttons }
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const THREE = `
  <ui-toolbar label="Text formatting">
    <ui-button variant="ghost">Bold</ui-button>
    <ui-button variant="ghost">Italic</ui-button>
    <ui-button variant="ghost">Underline</ui-button>
  </ui-toolbar>`

/** Alpha of a computed colour — 0 ⇒ transparent / no plane painted. */
const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] Real focus order — one Tab stop, arrow navigation, Home/End, no wrap, no type-ahead (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-toolbar — real keyboard roving (SPEC-R4, both engines)', () => {
  it('Tab lands on the ONE roving item; the next Tab leaves the toolbar entirely (one stop)', async () => {
    const { buttons } = mount(THREE)
    await userEvent.tab()
    expect(document.activeElement, 'Tab did not land on the roving item').toBe(buttons[0])
    expect(buttons[0].tabIndex).toBe(0)
    expect(buttons[1].tabIndex).toBe(-1)
    expect(buttons[2].tabIndex).toBe(-1)

    await userEvent.tab()
    expect(document.activeElement, 'a second Tab did not leave the toolbar (not a single stop)').not.toBe(buttons[1])
  })

  it('ArrowRight moves REAL focus to the next item and STOPS at the end (no wrap); ArrowLeft mirrors it', async () => {
    const { toolbar, buttons } = mount(THREE)
    buttons[0].focus()
    expect(document.activeElement).toBe(buttons[0])

    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement, 'ArrowRight did not rove focus to item 1').toBe(buttons[1])
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(buttons[2])
    await userEvent.keyboard('{ArrowRight}') // at the end — must NOT wrap to item 0 (the ui-tabs contrast)
    expect(document.activeElement, 'ArrowRight wrapped past the last item (toolbar must not wrap)').toBe(buttons[2])

    await userEvent.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(buttons[1])
    await userEvent.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(buttons[0])
    await userEvent.keyboard('{ArrowLeft}') // at the start — must NOT wrap to the last item
    expect(document.activeElement, 'ArrowLeft wrapped past the first item (toolbar must not wrap)').toBe(buttons[0])
    void toolbar
  })

  it('Home/End jump to the first/last item; a printable key is NOT type-ahead (no navigation)', async () => {
    const { buttons } = mount(THREE)
    buttons[0].focus()
    await userEvent.keyboard('{End}')
    expect(document.activeElement).toBe(buttons[2])
    await userEvent.keyboard('{Home}')
    expect(document.activeElement).toBe(buttons[0])

    await userEvent.keyboard('i') // would type-ahead-match "Italic" on a listbox/menu — the toolbar must NOT
    expect(document.activeElement, 'a printable key moved roving focus (toolbar has no type-ahead)').toBe(buttons[0])
  })

  it('a disabled item is skipped by ArrowRight (both engines)', async () => {
    const { toolbar, buttons } = mount(THREE)
    buttons[1].setAttribute('disabled', '')
    await toolbar.updateComplete
    buttons[0].focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement, 'ArrowRight landed on the disabled item').toBe(buttons[2])
  })

  it('a disabled ui-button re-enabling MID-SESSION does not reclaim a second tab stop (the roving-marker contract, ADR-0121 amendment)', async () => {
    // The named regression this fix closes: ui-button's own `tabbable` trait re-runs its effect on every
    // `disabled` toggle. Without the ROVING_ITEM_ATTR marker check on EVERY run (not just the trait's first
    // install), a re-enable would unconditionally rewrite tabIndex=0 — breaking "one Tab stop" a second time,
    // well after the initial connect race toolbar.ts's rovingFocus() call already resolved.
    const { toolbar, buttons } = mount(THREE)
    buttons[1].setAttribute('disabled', '')
    await toolbar.updateComplete
    expect(buttons[1].tabIndex, 'disabled item unexpectedly still has a tab stop').toBe(-1)

    buttons[1].removeAttribute('disabled') // re-enable mid-session — tabbable's effect re-runs
    await toolbar.updateComplete
    expect(buttons[1].tabIndex, 're-enabling reclaimed a second tab stop (the roving owner should still hold it)').toBe(-1)
    expect(buttons[0].tabIndex, 'the original roving item lost its tab stop').toBe(0)

    // The one-Tab-stop contract still holds after the re-enable: only buttons[0] is Tab-reachable.
    buttons[0].focus()
    await userEvent.tab()
    expect(document.activeElement, 'Tab did not leave the toolbar as one stop after the re-enable').not.toBe(buttons[1])
  })

  it('disconnect then reconnect re-arms roving with no duplicate listener (one move per ArrowRight)', async () => {
    const { wrap, toolbar, buttons } = mount(THREE)
    wrap.remove()
    document.body.append(wrap) // reconnect — connected() re-runs fresh
    await toolbar.updateComplete
    buttons[0].focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement, 'a stacked listener moved focus more than one step').toBe(buttons[1])
    mounted.push(wrap)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] Whole-shape — a populated toolbar of REAL ui-buttons renders as a bar (both postures, both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-toolbar — whole-shape: a populated bar renders with real width/height (SPEC-R7, both engines)', () => {
  it('the min-block-size floor holds even with small content — the bar reads as a bar, not a collapsed dot', () => {
    const { toolbar } = mount(`<ui-toolbar><ui-button variant="ghost">One</ui-button></ui-toolbar>`)
    const box = toolbar.getBoundingClientRect()
    expect(box.width, 'the toolbar collapsed to zero width').toBeGreaterThan(0)
    // --ui-toolbar-min-block-size: var(--md-sys-height-md) — 28px @ scale 1 (the ADR-0038 lookup, the tabs precedent)
    expect(box.height, 'the toolbar did not honour its min-block-size floor').toBeGreaterThanOrEqual(28)
  })

  it('a populated 3-button toolbar renders a real bounding box with all items laid out horizontally', () => {
    const { toolbar, buttons } = mount(THREE)
    const box = toolbar.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
    // three real items, side by side (not stacked) — the whole-shape gestalt, not merely a non-zero box
    expect(buttons[1].getBoundingClientRect().left).toBeGreaterThan(buttons[0].getBoundingClientRect().left)
    expect(buttons[2].getBoundingClientRect().left).toBeGreaterThan(buttons[1].getBoundingClientRect().left)
    expect(buttons[0].getBoundingClientRect().top).toBeCloseTo(buttons[1].getBoundingClientRect().top, 0)
  })

  it('orientation=vertical stacks the items in a column (a real px layout change, not just a computed keyword)', async () => {
    const { toolbar, buttons } = mount(THREE)
    toolbar.setAttribute('orientation', 'vertical')
    await toolbar.updateComplete
    expect(getComputedStyle(toolbar).flexDirection).toBe('column')
    expect(buttons[1].getBoundingClientRect().top, 'vertical toolbar did not stack its items').toBeGreaterThan(
      buttons[0].getBoundingClientRect().top,
    )
  })

  it('embedded (elevation unset/0) is transparent; floating (elevation=2) paints a raised, non-transparent plane', async () => {
    const { toolbar } = mount(THREE)
    const embedded = getComputedStyle(toolbar).backgroundColor
    expect(alphaOf(embedded), 'an embedded (unset-elevation) toolbar painted a surface').toBe(0)

    toolbar.setAttribute('elevation', '2')
    await toolbar.updateComplete
    const floating = getComputedStyle(toolbar).backgroundColor
    expect(alphaOf(floating), 'a floating (elevation=2) toolbar painted no surface').toBeGreaterThan(0)
    expect(floating, 'the floating plane color did not change from the embedded baseline').not.toBe(embedded)
  })

  it('overflow=scroll pins a single line (flex-wrap:nowrap) with its own inline scroll region', async () => {
    const { toolbar } = mount(THREE)
    toolbar.setAttribute('overflow', 'scroll')
    await toolbar.updateComplete
    expect(getComputedStyle(toolbar).flexWrap).toBe('nowrap')
    expect(['auto', 'scroll']).toContain(getComputedStyle(toolbar).overflowInline || getComputedStyle(toolbar).overflowX)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] forced-colors (WHCM) — Chromium-only CDP emulation (the ui-tabs/ui-row precedent)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

describe('ui-toolbar — forced-colors keeps a raised plane a system colour', () => {
  it('elevation=2 survives forced-colors (Canvas, no tonal wash)', async () => {
    const { toolbar } = mount(THREE)
    toolbar.setAttribute('elevation', '2')
    await toolbar.updateComplete

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'the engine did not enter forced-colors').toBe(true)
      const bg = getComputedStyle(toolbar).backgroundColor
      // Canvas resolves to an opaque system colour in every forced-colors palette — never transparent.
      expect(alphaOf(bg), 'the raised toolbar lost its surface under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
