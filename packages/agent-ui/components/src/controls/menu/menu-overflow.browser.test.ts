import { describe, it, expect, afterEach } from 'vitest'
import { userEvent } from 'vitest/browser'
import type { UIMenuElement } from './menu.ts'

// Regression coverage for GH #133 (item label wrap) + GH #134 (panel right-edge overflow) — both
// root-caused to the same gap: the panel had a `min-inline-size` floor but no `max-inline-size`,
// and item rows had no `white-space`/`overflow`/`text-overflow` rule, so a label wider than the
// panel's available width at the trigger's position wrapped onto a second line instead of staying
// single-line (breaking the `--ui-menu-item-block-size` single-line-row contract, menu.css:55-77),
// and — per #134's own hypothesis — that post-measurement reflow could leave the overlay
// controller's shift-clamp (overlay.ts:135-137) computed against a stale panel width.
// Also GH #166 (hidden-scrollbar seam) — the panel's vertical scroller, same geometry surface.
//
// Real, deterministic geometry is asserted directly (computed style + getBoundingClientRect) rather
// than simulating scroll/resize behaviour — see agent-admin-app-scroll.browser.test.ts's header
// comment for why synthetic input-driven browser behaviour is an unreliable test signal in this
// harness; real layout geometry (what this file reads) does not have that problem.
import '@agent-ui/components/foundation-styles.css'
import '../_surface/container-box.css'
import './menu.css'
import './menu.ts'

const mounted: HTMLElement[] = []

function mount(markup: string): { wrap: HTMLElement; el: UIMenuElement } {
  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return { wrap, el: wrap.querySelector('ui-menu') as UIMenuElement }
}

afterEach(async () => {
  await userEvent.unhover(document.body)
  while (mounted.length) {
    const m = mounted.pop()!
    for (const panel of m.querySelectorAll<HTMLElement & { hidePopover?: () => void }>('[data-part="panel"]')) {
      try {
        panel.hidePopover?.()
      } catch (_) {
        /* already hidden */
      }
    }
    m.remove()
  }
})

const LONG_LABEL = 'The Hotel Concierge and the Grand Hospitality Suite Management Console'

const WITH_LONG_ITEM = `
  <ui-menu>
    <button style="padding:6px 12px">Open</button>
    <div data-value="a">${LONG_LABEL}</div>
    <div data-value="b">Short</div>
  </ui-menu>`

const WITH_LONG_ITEM_END_ALIGNED = `
  <ui-menu placement="bottom-end">
    <button style="padding:6px 12px">Open</button>
    <div data-value="a">${LONG_LABEL}</div>
    <div data-value="b">Short</div>
  </ui-menu>`

describe('ui-menu — long-label overflow (GH #133/#134)', () => {
  it('keeps a long item label single-line instead of wrapping (GH #133)', async () => {
    const { el } = mount(WITH_LONG_ITEM)
    const trigger = el.querySelector('[data-part="trigger"]') as HTMLElement
    await userEvent.click(trigger)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    const items = [...el.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    const longItem = items.find((i) => i.textContent?.includes('Hotel'))!
    const shortItem = items.find((i) => i.textContent?.includes('Short'))!

    const style = getComputedStyle(longItem)
    expect(style.whiteSpace).toBe('nowrap')
    expect(style.overflow).toBe('hidden')
    expect(style.textOverflow).toBe('ellipsis')
    // The row-height contract (menu.css:55-77) assumes single-line content — a wrapped row would
    // render measurably taller than a single-line sibling.
    expect(longItem.getBoundingClientRect().height).toBe(shortItem.getBoundingClientRect().height)
  })

  it('keeps the panel fully on-screen when the trigger sits near the right edge (GH #134)', async () => {
    const { wrap, el } = mount(WITH_LONG_ITEM_END_ALIGNED)
    wrap.style.position = 'fixed'
    wrap.style.top = '10px'
    wrap.style.left = '380px' // near the default 414px viewport's right edge
    const trigger = el.querySelector('[data-part="trigger"]') as HTMLElement
    await userEvent.click(trigger)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    const panel = el.querySelector('[data-part="panel"]') as HTMLElement
    expect(panel.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth)
  })
})

const MANY_ITEMS = `
  <ui-menu>
    <button style="padding:6px 12px">Open</button>
    ${Array.from({ length: 20 }, (_, i) => `<div data-value="i${i}">Item ${i + 1}</div>`).join('\n    ')}
  </ui-menu>`

describe('ui-menu — hidden-scrollbar seam (GH #166)', () => {
  it('hides the native scrollbar on the scrolling panel (--ui-menu-scrollbar-width: none)', async () => {
    const { el } = mount(MANY_ITEMS)
    const trigger = el.querySelector('[data-part="trigger"]') as HTMLElement
    await userEvent.click(trigger)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    const panel = el.querySelector('[data-part="panel"]') as HTMLElement
    // 20 items exceed the 12-row --ui-menu-max-block-size cap — the panel genuinely scrolls
    // (real geometry, not a simulated scroll: the seam only matters on an overflowing panel).
    expect(panel.scrollHeight).toBeGreaterThan(panel.clientHeight)
    // The fleet convention (command-modal.css / card.css / surface-host.css): the native scrollbar
    // is hidden via the consumer-overridable token; the scroll-fade (menu.ts, scrollFade) carries
    // the affordance. Scrolling itself stays live (overflow-y: auto is untouched).
    const style = getComputedStyle(panel) as CSSStyleDeclaration & { scrollbarWidth?: string }
    expect(style.scrollbarWidth).toBe('none')
    expect(style.overflowY).toBe('auto')
  })
})
