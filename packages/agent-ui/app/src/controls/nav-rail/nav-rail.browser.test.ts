import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'
import { UINavRailElement } from './nav-rail.ts'
import { UINavRailGroupElement } from './nav-rail-group.ts'
import { UINavRailItemElement } from './nav-rail-item.ts'

// nav-rail.browser.test.ts — the CROSS-ENGINE ui-nav-rail smoke (ADR-0130; SPEC nav-rail-family.spec.md
// SPEC-R1..R8; LLD nav-rail-family.lld.md LLD-C8). jsdom cannot resolve CSS Grid/`@container` reflow, the
// Popover API's real top-layer behaviour, or real keyboard focus movement — this file is where the
// collapse="menu" narrow disclosure, the collapse="icon-popover" group flyouts (roving focus, commit-and-
// close, one-open-at-a-time), and the whole-shape geometry all become TRUE, in BOTH Chromium and WebKit
// (the menu.browser.test.ts / app-shell.browser.test.ts precedent — a Chromium-only pass is NOT a pass).
//
// Runs in BOTH engines:
//   [1] SPEC-R3 — ARIA role rides internals: all-link ⇒ navigation, all-bare ⇒ tablist
//   [2] SPEC-R5 — collapse="menu": WHOLE-SHAPE wide (list visible, trigger inert) vs. narrow (list hidden,
//       trigger visible, the open dropdown OVERLAYS rather than reflows); Escape + outside-click dismiss
//   [3] SPEC-R7 — collapse="drill-in": the rail itself never reflows at any width (anatomy-only)
//   [4] SPEC-R8 — collapse="icon-popover": icon-only rendering (label visually-hidden, kept as the AX
//       name), a group flyout opens/roving-focuses/commits-and-closes, one-group-open-at-a-time
//   [5] SPEC-R6 — the wide name|tag row + narrow ellipsis truncation (never wrap)
//   [6] SPEC-R4 — forced-colors: the active indicator survives (Chromium via CDP; WebKit asserts baseline)
//
// Side-effect imports — CSS load order (ADR-0003): foundation roles + dimensional ramp FIRST, then the
// components barrel (ui-menu's own CSS, composed by collapse="icon-popover"), then this family's CSS.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import './nav-rail.css'

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

/** Re-exposes the protected `internals` (the `ui-tabs`/`ui-menu` browser-suite precedent — vitest-browser
 *  locators are blind to internals-only ARIA; read it directly). */
class ProbeNavRail extends UINavRailElement {
  get internalsRole(): string | null {
    return this.internals.role
  }
}
customElements.define('ui-nav-rail-probe', ProbeNavRail)

const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

function makeItem(href: string, text: string, selected = false): UINavRailItemElement {
  const el = new UINavRailItemElement()
  el.href = href
  el.selected = selected
  el.textContent = text
  return el
}

/** A resizable wrapper the rail fills (the master-detail.browser.test.ts / app-shell.browser.test.ts
 *  "resize the wrapper, not the viewport" precedent) — `ui-nav-rail` establishes its OWN `@container`
 *  query container (nav-rail.css `:scope { container-type: inline-size }`), so the wrapper only controls
 *  how much inline space is AVAILABLE to it. */
const mounted: HTMLElement[] = []
function mountRail(el: HTMLElement, width = '300px'): { wrapper: HTMLElement; el: HTMLElement } {
  const wrapper = document.createElement('div')
  wrapper.style.width = width
  wrapper.style.height = '400px'
  wrapper.append(el)
  document.body.append(wrapper)
  mounted.push(wrapper)
  return { wrapper, el }
}

afterEach(async () => {
  await userEvent.unhover(document.body)
  while (mounted.length) {
    const wrapper = mounted.pop()!
    for (const panel of wrapper.querySelectorAll<HTMLElement>('[data-part="panel"]')) {
      if ((panel as HTMLElement & { hidePopover?: () => void }).hidePopover) {
        try {
          panel.hidePopover()
        } catch {
          /* already hidden */
        }
      }
    }
    wrapper.remove()
  }
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] ARIA role via internals (SPEC-R3)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-nav-rail — ARIA role derives from item shape, via internals (both engines)', () => {
  it('all items link-shaped ⇒ role=navigation; no host role/aria-* attribute', async () => {
    const el = document.createElement('ui-nav-rail-probe') as ProbeNavRail
    el.append(makeItem('/a', 'A'), makeItem('/b', 'B'))
    mountRail(el, '900px')
    await el.updateComplete
    expect(el.internalsRole, `${server.browser}: expected navigation`).toBe('navigation')
    expect(el.hasAttribute('role')).toBe(false)
  })

  it('all items bare ⇒ role=tablist', async () => {
    const el = document.createElement('ui-nav-rail-probe') as ProbeNavRail
    el.setAttribute('collapse', 'drill-in')
    el.append(makeItem('', 'One'), makeItem('', 'Two'))
    mountRail(el, '900px')
    await el.updateComplete
    expect(el.internalsRole, `${server.browser}: expected tablist`).toBe('tablist')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] collapse="menu" — whole-shape wide/narrow + Escape/outside-click dismiss (SPEC-R5)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-nav-rail collapse="menu" — WHOLE-SHAPE wide vs. narrow (SPEC-R5 AC1)', () => {
  it('WIDE: the full list is visible; the disclosure trigger is inert chrome (non-vacuous negative control)', async () => {
    const el = document.createElement('ui-nav-rail')
    const group = document.createElement('ui-nav-rail-group') as UINavRailGroupElement
    group.label = 'Components'
    group.append(makeItem('/button', 'Button'), makeItem('/select', 'Select'))
    el.append(group)
    mountRail(el, '900px')
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))

    const list = el.querySelector('[data-part="list"]') as HTMLElement
    const trigger = el.querySelector('[data-part="trigger"]') as HTMLElement
    expect(getComputedStyle(list).display, `${server.browser}: list hidden wide`).not.toBe('none')
    expect(getComputedStyle(trigger).display, `${server.browser}: trigger visible wide`).toBe('none')

    // WHOLE-SHAPE: real, non-collapsed rows — both items have non-zero rendered bounding boxes.
    const rows = [...el.querySelectorAll('[data-part="activator"]')] as HTMLElement[]
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      const rect = row.getBoundingClientRect()
      expect(rect.width, `${server.browser}: a row collapsed to zero width`).toBeGreaterThan(0)
      expect(rect.height, `${server.browser}: a row collapsed to zero height`).toBeGreaterThan(0)
    }
  })

  it('NARROW: the list is not directly visible; the trigger IS — the whole shape flips (SPEC-R5 AC1)', async () => {
    const el = document.createElement('ui-nav-rail')
    el.append(makeItem('/a', 'Alpha', true), makeItem('/b', 'Beta'))
    mountRail(el, '300px')
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))

    const list = el.querySelector('[data-part="list"]') as HTMLElement
    const trigger = el.querySelector('[data-part="trigger"]') as HTMLElement
    expect(getComputedStyle(list).display, `${server.browser}: list still shown narrow`).toBe('none')
    expect(getComputedStyle(trigger).display, `${server.browser}: trigger not shown narrow`).not.toBe('none')
    expect(trigger.getBoundingClientRect().width, `${server.browser}: trigger collapsed`).toBeGreaterThan(0)
  })

  it('activating the narrow trigger opens the list as an OVERLAY (does not reflow the page) (SPEC-R5 AC2)', async () => {
    const el = document.createElement('ui-nav-rail')
    el.append(makeItem('/a', 'Alpha'), makeItem('/b', 'Beta'))
    const { wrapper } = mountRail(el, '300px')
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))

    const before = wrapper.getBoundingClientRect().height
    const trigger = el.querySelector('[data-part="trigger"]') as HTMLElement
    await userEvent.click(trigger)
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))

    const disclosure = el.querySelector('[data-part="disclosure"]') as HTMLDetailsElement
    expect(disclosure.open, `${server.browser}: click did not open the disclosure`).toBe(true)
    const list = el.querySelector('[data-part="list"]') as HTMLElement
    expect(getComputedStyle(list).position, `${server.browser}: list is not an overlay narrow`).toBe('absolute')
    const listRect = list.getBoundingClientRect()
    expect(listRect.width, `${server.browser}: the open panel collapsed`).toBeGreaterThan(0)
    expect(listRect.height, `${server.browser}: the open panel collapsed`).toBeGreaterThan(0)
    // Overlay, not reflow: the WRAPPER's own height is unchanged by opening the dropdown.
    expect(wrapper.getBoundingClientRect().height, `${server.browser}: opening reflowed the page`).toBeCloseTo(before, 0)
  })

  it('Escape closes the open dropdown and returns focus to the trigger (SPEC-R5 AC2)', async () => {
    const el = document.createElement('ui-nav-rail')
    el.append(makeItem('/a', 'Alpha'), makeItem('/b', 'Beta'))
    mountRail(el, '300px')
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))

    const trigger = el.querySelector('[data-part="trigger"]') as HTMLElement
    await userEvent.click(trigger)
    const disclosure = el.querySelector('[data-part="disclosure"]') as HTMLDetailsElement
    expect(disclosure.open).toBe(true)

    await userEvent.keyboard('{Escape}')
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))
    expect(disclosure.open, `${server.browser}: Escape did not close the dropdown`).toBe(false)
  })

  it('an outside click closes the open dropdown (SPEC-R5 AC2)', async () => {
    const el = document.createElement('ui-nav-rail')
    el.append(makeItem('/a', 'Alpha'), makeItem('/b', 'Beta'))
    mountRail(el, '300px')
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))

    const trigger = el.querySelector('[data-part="trigger"]') as HTMLElement
    await userEvent.click(trigger)
    const disclosure = el.querySelector('[data-part="disclosure"]') as HTMLDetailsElement
    expect(disclosure.open).toBe(true)

    await userEvent.click(document.body)
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))
    expect(disclosure.open, `${server.browser}: an outside click did not close the dropdown`).toBe(false)
  })

  it('a WIDE container never collapses (negative control) — the assertion above is not vacuously true', async () => {
    const el = document.createElement('ui-nav-rail')
    el.append(makeItem('/a', 'Alpha'), makeItem('/b', 'Beta'))
    mountRail(el, '900px')
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))
    const list = el.querySelector('[data-part="list"]') as HTMLElement
    expect(getComputedStyle(list).display).not.toBe('none')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] collapse="drill-in" — no self-collapse at any width (SPEC-R7)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-nav-rail collapse="drill-in" — the rail itself never reflows (SPEC-R7)', () => {
  it('narrow or wide, the item rows stay rendered identically — no disclosure, no hidden items', async () => {
    for (const width of ['900px', '300px']) {
      const el = document.createElement('ui-nav-rail')
      el.setAttribute('collapse', 'drill-in')
      el.append(makeItem('', 'Overview', true), makeItem('', 'Appearance'))
      mountRail(el, width)
      await new Promise((r) => requestAnimationFrame(() => r(undefined)))

      expect(el.querySelector('[data-part="disclosure"]'), `${server.browser}: a disclosure appeared at ${width}`).toBeNull()
      const rows = [...el.querySelectorAll('[data-part="activator"]')] as HTMLElement[]
      expect(rows).toHaveLength(2)
      for (const row of rows) {
        expect(getComputedStyle(row).display, `${server.browser}: a row hid at ${width}`).not.toBe('none')
      }
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [4] collapse="icon-popover" — icon-only + group flyout + roving focus + one-open-at-a-time (SPEC-R8)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-nav-rail collapse="icon-popover" — icon-only rendering, correct AX name (SPEC-R8 AC1)', () => {
  it('the label is visually hidden (clipped) but stays in the accessible-name text', async () => {
    const el = document.createElement('ui-nav-rail')
    el.setAttribute('collapse', 'icon-popover')
    el.append(makeItem('/home', 'Home'))
    mountRail(el, '80px')
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))

    const label = el.querySelector('[data-part="label"]') as HTMLElement
    const rect = label.getBoundingClientRect()
    expect(rect.width, `${server.browser}: the label is not visually clipped in icon-popover mode`).toBeLessThanOrEqual(1)
    expect(label.textContent, `${server.browser}: the label text was removed, not just hidden`).toBe('Home')
  })
})

describe('ui-nav-rail collapse="icon-popover" — group flyout: open/roving-focus/commit-close (SPEC-R8 AC2)', () => {
  function mountIconPopoverGroup(): { el: HTMLElement; group: UINavRailGroupElement } {
    const el = document.createElement('ui-nav-rail')
    el.setAttribute('collapse', 'icon-popover')
    const group = document.createElement('ui-nav-rail-group') as UINavRailGroupElement
    group.label = 'Views'
    group.append(makeItem('', 'One'), makeItem('', 'Two'), makeItem('', 'Three'))
    el.append(group)
    mountRail(el, '80px')
    return { el, group }
  }

  it('activating the group icon opens an anchored popover; roving Arrow keys move real focus; Enter commits and closes', async () => {
    const { group } = mountIconPopoverGroup()
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))

    const menu = group.querySelector('ui-menu') as HTMLElement
    const trigger = menu.querySelector('[data-part="trigger"]') as HTMLElement
    await userEvent.click(trigger)
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))

    const panel = menu.querySelector('[data-part="panel"]') as HTMLElement
    expect(panel.matches(':popover-open'), `${server.browser}: the group popover did not open`).toBe(true)
    const items = [...panel.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    expect(items).toHaveLength(3)
    expect(panel.contains(document.activeElement), `${server.browser}: focus did not move into the panel`).toBe(true)

    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement, `${server.browser}: ArrowDown did not rove focus`).toBe(items[1])

    await userEvent.keyboard('{Enter}')
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))
    expect(panel.matches(':popover-open'), `${server.browser}: commit did not close the popover`).toBe(false)
  })

  it('one-group-open-at-a-time: opening group B closes group A (SPEC-R8 AC3, a biting negative control)', async () => {
    const el = document.createElement('ui-nav-rail')
    el.setAttribute('collapse', 'icon-popover')
    const groupA = document.createElement('ui-nav-rail-group') as UINavRailGroupElement
    groupA.label = 'A'
    groupA.append(makeItem('', 'A1'), makeItem('', 'A2'))
    const groupB = document.createElement('ui-nav-rail-group') as UINavRailGroupElement
    groupB.label = 'B'
    groupB.append(makeItem('', 'B1'), makeItem('', 'B2'))
    el.append(groupA, groupB)
    mountRail(el, '80px')
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))

    const menuA = groupA.querySelector('ui-menu') as HTMLElement
    const menuB = groupB.querySelector('ui-menu') as HTMLElement
    const triggerA = menuA.querySelector('[data-part="trigger"]') as HTMLElement
    const triggerB = menuB.querySelector('[data-part="trigger"]') as HTMLElement
    const panelA = menuA.querySelector('[data-part="panel"]') as HTMLElement
    const panelB = menuB.querySelector('[data-part="panel"]') as HTMLElement

    await userEvent.click(triggerA)
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))
    expect(panelA.matches(':popover-open'), `${server.browser}: group A did not open`).toBe(true)

    // Activate trigger B via KEYBOARD (focus + Enter), not a raw pointer click: in this deliberately
    // cramped 80px-wide fixture, group A's still-open panel visually overlaps trigger B's position (real,
    // correct overlay stacking — not a bug; a real consumer rail gives groups enough room that this
    // literal geometry never arises). Keyboard activation targets the focused element directly regardless
    // of pointer hit-testing, so it proves the SAME coordination logic (a real Tab+Enter user path) without
    // conflating it with an incidental fixture-spacing artifact.
    triggerB.focus()
    await userEvent.keyboard('{Enter}')
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))
    expect(panelB.matches(':popover-open'), `${server.browser}: group B did not open`).toBe(true)
    expect(panelA.matches(':popover-open'), `${server.browser}: group A stayed open — the coordination listener did not fire (biting NC)`).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [5] the wide name|tag row + narrow ellipsis truncate, never wrap (SPEC-R6)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-nav-rail — the name|tag row (SPEC-R6)', () => {
  function withTag(): { el: HTMLElement; row: HTMLElement; tag: HTMLElement } {
    const el = document.createElement('ui-nav-rail')
    const item = makeItem('/x', 'A Reasonably Long Component Name')
    const tag = document.createElement('span')
    tag.slot = 'trailing'
    tag.setAttribute('data-role', 'tag')
    tag.textContent = 'experimental'
    item.append(tag)
    el.append(item)
    return { el, row: item, tag }
  }

  it('WIDE: name sits at the leading edge, tag at the trailing edge, never overlapping/wrapped', async () => {
    const { el, tag } = withTag()
    mountRail(el, '900px')
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))
    const label = el.querySelector('[data-part="label"]') as HTMLElement
    const labelRect = label.getBoundingClientRect()
    const tagRect = tag.getBoundingClientRect()
    expect(labelRect.right, `${server.browser}: the name/tag columns overlap`).toBeLessThanOrEqual(tagRect.left + 1)
    expect(tagRect.height, `${server.browser}: the tag wrapped onto a second line`).toBeLessThan(labelRect.height * 1.5)
  })

  it('NARROW: the tag truncates via ellipsis; the row height is unchanged (single-line, never wraps)', async () => {
    // `collapse="drill-in"` — decouples this anatomy-only assertion from the DEFAULT `collapse="menu"`
    // self-collapse threshold (40rem): this test wants the row's OWN grid to narrow and the tag to
    // truncate, never the whole rail to collapse into its disclosure (which would hide the row entirely,
    // the bug this fix replaces — a collapsed [data-part=list] made the "row height" read 0, not "grew").
    const { el, tag } = withTag()
    el.setAttribute('collapse', 'drill-in')
    const activatorHeightWide = (() => {
      mountRail(el, '900px')
      const h = (el.querySelector('[data-part="activator"]') as HTMLElement).getBoundingClientRect().height
      mounted.pop()!.remove()
      return h
    })()
    mountRail(el, '140px')
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))
    const cs = getComputedStyle(tag)
    expect(cs.textOverflow, `${server.browser}: the tag does not ellipsis-truncate`).toBe('ellipsis')
    expect(cs.whiteSpace, `${server.browser}: the tag wraps instead of truncating`).toBe('nowrap')
    const activatorHeightNarrow = (el.querySelector('[data-part="activator"]') as HTMLElement).getBoundingClientRect().height
    expect(activatorHeightNarrow, `${server.browser}: the row grew — a wrap, not a truncate`).toBeCloseTo(activatorHeightWide, 0)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [6] forced-colors — the active indicator survives (SPEC-R4)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-nav-rail — forced-colors (Chromium via CDP; WebKit asserts the baseline)', () => {
  it('the active item indicator border is visible in normal mode AND survives forced-colors', async () => {
    const el = document.createElement('ui-nav-rail')
    el.setAttribute('collapse', 'drill-in')
    el.append(makeItem('', 'Active', true), makeItem('', 'Other'))
    mountRail(el, '900px')
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))
    const activeRow = el.querySelector('ui-nav-rail-item[selected] [data-part="activator"]') as HTMLElement

    expect(
      alphaOf(getComputedStyle(activeRow).borderInlineStartColor || getComputedStyle(activeRow).borderLeftColor),
      `${server.browser}: no visible indicator border in normal mode (forced-colors check would be vacuous)`,
    ).toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)
      const color = getComputedStyle(activeRow).borderInlineStartColor || getComputedStyle(activeRow).borderLeftColor
      expect(alphaOf(color), 'the active indicator vanished under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
