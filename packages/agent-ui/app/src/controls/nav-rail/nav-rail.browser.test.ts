import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'
import { UINavRailElement } from './nav-rail.ts'
import { UINavRailGroupElement } from './nav-rail-group.ts'
import { UINavRailItemElement } from './nav-rail-item.ts'

// nav-rail.browser.test.ts — the CROSS-ENGINE ui-nav-rail smoke (ADR-0130; SPEC nav-rail-family.spec.md
// SPEC-R1..R8; LLD nav-rail-family.lld.md LLD-C8). jsdom cannot resolve CSS Grid/`@container` reflow, the
// Popover API's real top-layer behaviour, or real keyboard focus movement — this file is where the
// collapse="menu" narrow flyout, the collapse="icon-popover" group flyouts (roving focus, commit-and-
// close, one-open-at-a-time), and the whole-shape geometry all become TRUE, in BOTH Chromium and WebKit
// (the menu.browser.test.ts / app-shell.browser.test.ts precedent — a Chromium-only pass is NOT a pass).
//
// Runs in BOTH engines:
//   [1] SPEC-R3 — ARIA role rides internals: all-link ⇒ navigation, all-bare ⇒ tablist
//   [2] SPEC-R5 — collapse="menu": WHOLE-SHAPE wide (list in flow, trigger inert, overlay DISARMED) vs.
//       narrow (list unrendered until activated, trigger visible, overlay ARMED); the open panel is a
//       TOP-LAYER anchored popover; Escape + outside-click dismiss, now PLATFORM-owned (GH #368)
//   [2a] GH #368 — keyboard open (Enter AND Space, SPEC-R5 AC2's own words), focus into the panel on open
//       and back to the trigger on close, the trigger-reclick light-dismiss race, and aria-expanded truthful
//       across click / Enter / Space / Escape / outside-click / programmatic showPopover-hidePopover
//   [2b] TKT-0035 — collapse-container="ancestor": a narrow-column rail defers its 40rem threshold to a
//       NAMED `@container ui-nav-rail-collapse` a consumer opts an ancestor into (WIDE ancestor ⇒ vertical
//       rail even in a narrow column AND no armed overlay — the wrong-box discriminator; NARROW ancestor ⇒
//       collapses and reaches the same top layer); "self" (default) ignores it
//   [2c] GH #368 — the open panel is a CONTENT-SIZED card: four 1px outline borders, a resolved min/max
//       inline-size clamp, narrower than the rail; a 40-item panel caps, scrolls and stays on-screen
//   [2d] SPEC-R5 AC3 — top-layer rendering escapes a clipping ancestor, proven by HIT-TEST past its edge
//   [2e] GH #368 — crossing the threshold live (900→300→900) and leaving zero overlay residue behind
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

// ── GH #368 helpers ──────────────────────────────────────────────────────────────────────────────

/** OverlayPlacement's closed set (traits/overlay.ts) — the host must pass a MEMBER, never a free string. */
const PLACEMENTS = [
  'bottom-start',
  'bottom-end',
  'top-start',
  'top-end',
  'left-start',
  'left-end',
  'right-start',
  'right-end',
] as const

/**
 * Settle a layout + arming + platform-event cycle. Two rAFs cover the ResizeObserver callback (it runs at
 * the end of a layout step) and the frame that renders its effect; the macrotask turn covers the popover
 * ToggleEvent, which the spec QUEUES AS A TASK rather than firing synchronously (the same drain
 * popover.browser.test.ts needs for its light-dismiss legs).
 */
async function settle(): Promise<void> {
  await new Promise((r) => requestAnimationFrame(() => r(undefined)))
  await new Promise((r) => setTimeout(r, 0))
  await new Promise((r) => requestAnimationFrame(() => r(undefined)))
}

/** The menu arm's two DIRECT-CHILD parts. Scoped with `:scope >` deliberately: `[data-part="trigger"]`
 *  also names ui-menu's own trigger inside a `collapse="icon-popover"` group, so an unscoped query would
 *  silently read the wrong element in a mixed fixture. */
function menuParts(el: HTMLElement): { list: HTMLElement; trigger: HTMLElement } {
  const list = el.querySelector(':scope > [data-part="list"]') as HTMLElement
  const trigger = el.querySelector(':scope > [data-part="trigger"]') as HTMLElement
  expect(list, `${server.browser}: the menu panel part never rendered`).not.toBeNull()
  expect(trigger, `${server.browser}: the menu trigger part never rendered`).not.toBeNull()
  return { list, trigger }
}

/** `:popover-open` throws in an engine that lacks it — guard the read (overlay.ts:143's own idiom). */
function popoverOpen(el: HTMLElement): boolean {
  try {
    return el.matches(':popover-open')
  } catch {
    return false
  }
}

/** Resolve a custom property's value (which may itself be a `var()` chain) to the same computed colour
 *  string `getComputedStyle` reports for a border, so the two are comparable. */
function resolveColor(value: string): string {
  const probe = document.createElement('div')
  probe.style.color = value
  document.body.append(probe)
  const resolved = getComputedStyle(probe).color
  probe.remove()
  return resolved
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

/** A NAMED-ancestor wrapper for `collapse-container="ancestor"` (TKT-0035): an OUTER box that establishes
 *  `container-type: inline-size; container-name: ui-nav-rail-collapse` sized to `ancestorWidth`, and an
 *  INNER narrow "sidebar column" (`columnWidth`, no container-type of its own) the rail actually sits in —
 *  proving the rail's OWN box plays no part once `collapse-container="ancestor"` relinquishes its containment
 *  (the _page.css `.app-shell` / buildNav shape, reduced to its load-bearing structure). */
function mountRailInNamedAncestor(
  el: HTMLElement,
  ancestorWidth: string,
  columnWidth: string,
): { ancestor: HTMLElement; column: HTMLElement } {
  const ancestor = document.createElement('div')
  ancestor.style.width = ancestorWidth
  ancestor.style.containerType = 'inline-size'
  ancestor.style.containerName = 'ui-nav-rail-collapse'
  const column = document.createElement('div')
  column.style.width = columnWidth
  column.append(el)
  ancestor.append(column)
  document.body.append(ancestor)
  mounted.push(ancestor)
  return { ancestor, column }
}

afterEach(async () => {
  await userEvent.unhover(document.body)
  while (mounted.length) {
    const wrapper = mounted.pop()!
    // Both overlay panels in this family: ui-menu's `panel` (icon-popover) and the menu arm's own `list`
    // (GH #368). A popover left in the top layer across tests leaks light-dismiss into the next one.
    for (const panel of wrapper.querySelectorAll<HTMLElement>('[data-part="panel"], [data-part="list"][popover]')) {
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
//  [1b] the group section-label reads the `kicker` typescale role, not a bare font-size
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-nav-rail-group — context-label uses the kicker-small typescale role (both engines)', () => {
  it('font-size/font-weight/letter-spacing resolve to the kicker-small register, uppercased at the consumer', async () => {
    const rail = document.createElement('ui-nav-rail')
    const group = new UINavRailGroupElement()
    group.label = 'Components'
    group.append(makeItem('/a', 'A'))
    rail.append(group)
    mountRail(rail, '900px')
    await (rail as unknown as { updateComplete: Promise<void> }).updateComplete
    await (group as unknown as { updateComplete: Promise<void> }).updateComplete

    const label = group.querySelector('[data-part="context-label"]') as HTMLElement
    expect(label, `${server.browser}: the context-label span never rendered`).not.toBeNull()
    // GH #370 — `text-transform` is PRESENTATIONAL, so the authored text is still what the DOM carries
    // (a11y/copy stay as-typed); only the computed style + the rendered glyphs change.
    expect(label.textContent, 'the DOM text stays as-authored — uppercase is a transform, not a rewrite').toBe('Components')

    const cs = getComputedStyle(label)
    // kicker-small @ scale 1 (dimensions.css, GH #370's re-ruled role): size 11px, weight 400, tracking 0.2em.
    expect(Number.parseFloat(cs.fontSize), `${server.browser}: expected the kicker-small 11px register`).toBeCloseTo(11, 0)
    expect(cs.fontWeight, `${server.browser}: expected the kicker REGULAR register (GH #370)`).toBe('400')
    // letter-spacing resolves to px (0.2em of the 11px kicker-small font = 2.2px) — a real, non-zero
    // tracking value, the thing a bare font-size read could never produce. Pinned tightly enough to fail
    // if the role ever slid back to the pre-#370 0.08em (0.88px).
    expect(Number.parseFloat(cs.letterSpacing), `${server.browser}: expected the 0.2em kicker tracking`).toBeCloseTo(2.2, 1)
    expect(cs.textTransform, 'GH #370 — casing lives at the consumer, as text.css does it').toBe('uppercase')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [1c] GH #624 — main-menu nav polish (kicker block-padding, activator border-aware padding,
//       neutral kicker/active-family-high color roles)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-nav-rail — GH #624 nav polish (both engines)', () => {
  it('item 1: only the FIRST group kicker gets the extra block-start relief, not every kicker', async () => {
    const rail = document.createElement('ui-nav-rail')
    const groupA = new UINavRailGroupElement()
    groupA.label = 'Components'
    groupA.append(makeItem('/a', 'A'))
    const groupB = new UINavRailGroupElement()
    groupB.label = 'Guides'
    groupB.append(makeItem('/b', 'B'))
    rail.append(groupA, groupB)
    mountRail(rail, '900px')
    await (rail as unknown as { updateComplete: Promise<void> }).updateComplete
    await (groupA as unknown as { updateComplete: Promise<void> }).updateComplete
    await (groupB as unknown as { updateComplete: Promise<void> }).updateComplete

    const firstLabel = groupA.querySelector('[data-part="context-label"]') as HTMLElement
    const secondLabel = groupB.querySelector('[data-part="context-label"]') as HTMLElement
    const firstPad = Number.parseFloat(getComputedStyle(firstLabel).paddingBlockStart)
    const secondPad = Number.parseFloat(getComputedStyle(secondLabel).paddingBlockStart)
    expect(firstPad, `${server.browser}: the first kicker did not get extra block-start relief`).toBeGreaterThan(secondPad)
  })

  it('item 2: the activator start padding is one border-width less than the end padding (optical alignment)', async () => {
    const el = document.createElement('ui-nav-rail')
    el.setAttribute('collapse', 'drill-in')
    el.append(makeItem('/x', 'Row'))
    mountRail(el, '900px')
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))
    const activator = el.querySelector('[data-part="activator"]') as HTMLElement
    const cs = getComputedStyle(activator)
    const start = Number.parseFloat(cs.paddingInlineStart)
    const end = Number.parseFloat(cs.paddingInlineEnd)
    const borderWidth = Number.parseFloat(cs.borderInlineStartWidth)
    expect(borderWidth, `${server.browser}: expected a non-zero marker border width`).toBeGreaterThan(0)
    expect(end - start, `${server.browser}: start padding should trail end padding by exactly the marker border width`).toBeCloseTo(
      borderWidth,
      1,
    )
  })

  it('item 4: the kicker ink resolves to the neutral role, not the on-surface ink', async () => {
    const rail = document.createElement('ui-nav-rail')
    const group = new UINavRailGroupElement()
    group.label = 'Components'
    group.append(makeItem('/a', 'A'))
    rail.append(group)
    mountRail(rail, '900px')
    await (rail as unknown as { updateComplete: Promise<void> }).updateComplete
    await (group as unknown as { updateComplete: Promise<void> }).updateComplete

    const label = group.querySelector('[data-part="context-label"]') as HTMLElement
    const kickerColor = getComputedStyle(label).color
    const inkColor = resolveColor(getComputedStyle(rail).getPropertyValue('--ui-nav-rail-ink').trim())
    const neutralColor = resolveColor(getComputedStyle(rail).getPropertyValue('--ui-nav-rail-meta-ink').trim())
    expect(kickerColor, `${server.browser}: the kicker still reads the on-surface ink`).not.toBe(inkColor)
    expect(kickerColor, `${server.browser}: the kicker does not resolve to the neutral role`).toBe(neutralColor)
  })

  it('item 5: the active item ink resolves to the primary-high role, not the base primary', async () => {
    const el = document.createElement('ui-nav-rail')
    el.setAttribute('collapse', 'drill-in')
    el.append(makeItem('/x', 'Active', true))
    mountRail(el, '900px')
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))
    const activator = el.querySelector('[data-part="activator"]') as HTMLElement
    const activeColor = getComputedStyle(activator).color
    const baseColor = resolveColor('var(--md-sys-color-primary)')
    const highColor = resolveColor('var(--md-sys-color-primary-high)')
    expect(activeColor, `${server.browser}: the active item still reads the base primary role`).not.toBe(baseColor)
    expect(activeColor, `${server.browser}: the active item does not resolve to the primary-high role`).toBe(highColor)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] collapse="menu" — whole-shape wide/narrow + Escape/outside-click dismiss (SPEC-R5)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-nav-rail collapse="menu" — WHOLE-SHAPE wide vs. narrow (SPEC-R5 AC1)', () => {
  it('WIDE: the full list is visible in flow; the trigger is inert chrome; the overlay is DISARMED (n4b)', async () => {
    const el = document.createElement('ui-nav-rail')
    const group = document.createElement('ui-nav-rail-group') as UINavRailGroupElement
    group.label = 'Components'
    group.append(makeItem('/button', 'Button'), makeItem('/select', 'Select'))
    el.append(group)
    mountRail(el, '900px')
    await settle()

    const { list, trigger } = menuParts(el)
    expect(getComputedStyle(list).display, `${server.browser}: list hidden wide`).not.toBe('none')
    expect(getComputedStyle(trigger).display, `${server.browser}: trigger visible wide`).toBe('none')

    // n4b — the ARMING outcome, not just visibility: wide, the panel is a plain in-flow box.
    expect(list.hasAttribute('popover'), `${server.browser}: the wide arm carries a popover attribute`).toBe(false)
    expect(popoverOpen(list), `${server.browser}: the wide panel is in the top layer`).toBe(false)
    expect(getComputedStyle(list).position, `${server.browser}: the wide panel is positioned like an overlay`).not.toBe('fixed')

    // WHOLE-SHAPE: real, non-collapsed rows — both items have non-zero rendered bounding boxes.
    const rows = [...el.querySelectorAll('[data-part="activator"]')] as HTMLElement[]
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      const rect = row.getBoundingClientRect()
      expect(rect.width, `${server.browser}: a row collapsed to zero width`).toBeGreaterThan(0)
      expect(rect.height, `${server.browser}: a row collapsed to zero height`).toBeGreaterThan(0)
    }
  })

  it('NARROW: the list is not rendered until activated; the trigger IS — the whole shape flips (SPEC-R5 AC1)', async () => {
    const el = document.createElement('ui-nav-rail')
    el.append(makeItem('/a', 'Alpha', true), makeItem('/b', 'Beta'))
    mountRail(el, '300px')
    await settle()

    const { list, trigger } = menuParts(el)
    expect(getComputedStyle(list).display, `${server.browser}: list still shown narrow`).toBe('none')
    expect(getComputedStyle(trigger).display, `${server.browser}: trigger not shown narrow`).not.toBe('none')
    expect(trigger.getBoundingClientRect().width, `${server.browser}: trigger collapsed`).toBeGreaterThan(0)
    // n4b — narrow ARMS the overlay (the trigger's click handler is inert until it does).
    expect(list.getAttribute('popover'), `${server.browser}: the narrow arm did not arm the popover`).toBe('auto')
  })

  it('activating the narrow trigger opens a TOP-LAYER, anchored panel; the page does not reflow (SPEC-R5 AC2, n3)', async () => {
    const el = document.createElement('ui-nav-rail')
    el.append(makeItem('/a', 'Alpha'), makeItem('/b', 'Beta'))
    const { wrapper } = mountRail(el, '300px')
    await settle()

    const before = wrapper.getBoundingClientRect().height
    const { list, trigger } = menuParts(el)
    await userEvent.click(trigger)
    await settle()

    expect(popoverOpen(list), `${server.browser}: the click did not put the panel in the top layer`).toBe(true)
    expect(getComputedStyle(list).position, `${server.browser}: the open panel is not overlay-positioned`).toBe('fixed')
    // n3 — the host passes one of OverlayPlacement's eight members, never a free string.
    expect(PLACEMENTS, `${server.browser}: data-placement is outside OverlayPlacement's closed set`).toContain(
      list.getAttribute('data-placement'),
    )
    const listRect = list.getBoundingClientRect()
    expect(listRect.width, `${server.browser}: the open panel collapsed`).toBeGreaterThan(0)
    expect(listRect.height, `${server.browser}: the open panel collapsed`).toBeGreaterThan(0)
    // Anchored to the trigger: the panel sits below it, not at some default UA-centred position.
    expect(listRect.top, `${server.browser}: the panel is not anchored below its trigger`).toBeGreaterThanOrEqual(
      trigger.getBoundingClientRect().bottom - 1,
    )
    // Overlay, not reflow: the WRAPPER's own height is unchanged by opening the panel.
    expect(wrapper.getBoundingClientRect().height, `${server.browser}: opening reflowed the page`).toBeCloseTo(before, 0)
  })

  it('the ADR-0101 announce contract: one toggle per open, one close + one toggle per close (n3)', async () => {
    const el = document.createElement('ui-nav-rail')
    el.append(makeItem('/a', 'Alpha'), makeItem('/b', 'Beta'))
    mountRail(el, '300px')
    await settle()

    // Only the HOST's own announce events count — a ToggleEvent from the panel does not bubble, and
    // ui-menu is not composed in this arm, so every counted event is the trait's own announcement.
    let toggles = 0
    let closes = 0
    el.addEventListener('toggle', () => toggles++)
    el.addEventListener('close', () => closes++)

    const { trigger } = menuParts(el)
    await userEvent.click(trigger)
    await settle()
    expect(toggles, `${server.browser}: expected exactly one toggle on a real show`).toBe(1)
    expect(closes, `${server.browser}: a show must not announce close`).toBe(0)

    await userEvent.keyboard('{Escape}')
    await settle()
    expect(closes, `${server.browser}: expected exactly one close on a real hide`).toBe(1)
    expect(toggles, `${server.browser}: expected exactly one further toggle on a real hide`).toBe(2)
  })

  it('Escape closes the open panel and returns focus to the trigger (SPEC-R5 AC2, platform-owned dismissal — n5)', async () => {
    const el = document.createElement('ui-nav-rail')
    el.append(makeItem('/a', 'Alpha'), makeItem('/b', 'Beta'))
    mountRail(el, '300px')
    await settle()

    const { list, trigger } = menuParts(el)
    await userEvent.click(trigger)
    await settle()
    expect(popoverOpen(list)).toBe(true)

    await userEvent.keyboard('{Escape}')
    await settle()
    expect(popoverOpen(list), `${server.browser}: Escape did not close the panel`).toBe(false)
    expect(document.activeElement, `${server.browser}: focus did not return to the trigger on Escape`).toBe(trigger)
  })

  it('an outside click closes the open panel (SPEC-R5 AC2, platform-owned dismissal — n5)', async () => {
    const el = document.createElement('ui-nav-rail')
    el.append(makeItem('/a', 'Alpha'), makeItem('/b', 'Beta'))
    mountRail(el, '300px')
    await settle()

    const { list, trigger } = menuParts(el)
    await userEvent.click(trigger)
    await settle()
    expect(popoverOpen(list)).toBe(true)

    await userEvent.click(document.body)
    await settle()
    expect(popoverOpen(list), `${server.browser}: an outside click did not close the panel`).toBe(false)
  })

  it('a WIDE container never collapses (negative control) — the assertion above is not vacuously true', async () => {
    const el = document.createElement('ui-nav-rail')
    el.append(makeItem('/a', 'Alpha'), makeItem('/b', 'Beta'))
    mountRail(el, '900px')
    await settle()
    const { list } = menuParts(el)
    expect(getComputedStyle(list).display).not.toBe('none')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [2a] collapse="menu" — keyboard open, focus round-trip, and truthful aria (n14, n17)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-nav-rail collapse="menu" — keyboard open + focus round-trip (SPEC-R5 AC2, n14)', () => {
  /** A narrow menu rail with two link items, settled. */
  function narrowMenuRail(): HTMLElement {
    const el = document.createElement('ui-nav-rail')
    el.append(makeItem('/a', 'Alpha'), makeItem('/b', 'Beta'))
    mountRail(el, '300px')
    return el
  }

  // SPEC-R5 AC2's own words are "click OR Enter/Space". A <summary> used to supply the keyboard half
  // natively; a plain <button> supplies it just as natively, and these two legs are what prove the swap
  // did not quietly drop it.
  for (const key of ['{Enter}', ' '] as const) {
    it(`the trigger opens the panel on ${key === ' ' ? 'Space' : 'Enter'}`, async () => {
      const el = narrowMenuRail()
      await settle()
      const { list, trigger } = menuParts(el)

      trigger.focus()
      expect(document.activeElement, `${server.browser}: the trigger did not take focus`).toBe(trigger)
      await userEvent.keyboard(key)
      await settle()

      expect(popoverOpen(list), `${server.browser}: ${key} did not open the panel`).toBe(true)
      expect(trigger.getAttribute('aria-expanded'), `${server.browser}: aria-expanded did not track the ${key} open`).toBe('true')
    })
  }

  it('on open, focus lands on the panel’s first focusable descendant', async () => {
    const el = narrowMenuRail()
    await settle()
    const { list, trigger } = menuParts(el)

    await userEvent.click(trigger)
    await settle()
    expect(list.contains(document.activeElement), `${server.browser}: focus did not move into the panel`).toBe(true)
    // Specifically the FIRST focusable descendant — an item activator, not the panel fallback.
    const firstActivator = list.querySelector('[data-part="activator"]') as HTMLElement
    expect(document.activeElement, `${server.browser}: focus did not land on the first focusable row`).toBe(firstActivator)
  })

  it('a trigger re-click closes the panel — no flicker-reopen from the light-dismiss race', async () => {
    // The platform light-dismisses on a trigger re-click (the trigger is OUTSIDE the popover) and QUEUES
    // its ToggleEvent, so a handler that re-derived state from the DOM would read "closed" and reopen.
    // The popover.browser.test.ts:256 race, proven here for this control's own synchronous flag.
    const el = narrowMenuRail()
    await settle()
    const { list, trigger } = menuParts(el)

    await userEvent.click(trigger)
    await settle()
    expect(popoverOpen(list)).toBe(true)

    await userEvent.click(trigger)
    await settle()
    expect(popoverOpen(list), `${server.browser}: the re-click left the panel open`).toBe(false)
    await settle() // a further drain — a DELAYED reopen would surface here
    expect(popoverOpen(list), `${server.browser}: the panel reopened after settling — the race is real`).toBe(false)
    expect(trigger.getAttribute('aria-expanded'), `${server.browser}: aria-expanded stuck true after the re-click`).toBe('false')
  })

  it('GH #378 — a LATE item reaches the panel while the overlay is armed and OPEN, and the arm/disarm seam is undisturbed', async () => {
    // The jsdom leg proves the relocation; this proves the thing jsdom cannot see — that doing it against
    // a LIVE, armed, top-layer popover disturbs none of the state `arm`/`disarm` own. The issue asked for
    // exactly this check ("relocation interacts with the observer's arm/disarm").
    const el = narrowMenuRail()
    await settle()
    const { list, trigger } = menuParts(el)
    await userEvent.click(trigger)
    await settle()
    expect(popoverOpen(list), `${server.browser}: the fixture never opened — the rest would be vacuous`).toBe(true)

    el.append(makeItem('/c', 'Gamma'))
    await settle()

    const late = [...list.querySelectorAll('ui-nav-rail-item')].at(-1) as HTMLElement
    expect(late?.textContent?.trim(), `${server.browser}: the late item is not in the panel`).toBe('Gamma')
    // The seam, read on its three owned facts — the panel is still a popover, still open, and the trigger
    // still says so. A relocation that closed or unarmed it would break exactly here.
    expect(list.getAttribute('popover'), `${server.browser}: the relocation stripped the popover arm`).toBe('auto')
    expect(popoverOpen(list), `${server.browser}: the relocation dismissed the open panel`).toBe(true)
    expect(trigger.getAttribute('aria-expanded'), `${server.browser}: aria-expanded desynced across the relocation`).toBe('true')
    // and the panel still light-dismisses afterwards — the handle is live, not merely still-open
    await userEvent.click(trigger)
    await settle()
    expect(popoverOpen(list), `${server.browser}: the overlay handle stopped responding after a relocation`).toBe(false)
  })
})

describe('ui-nav-rail collapse="menu" — aria-expanded is truthful on EVERY path (n17)', () => {
  it('aria-controls resolves to the panel, and aria-expanded tracks click / Escape / outside-click / programmatic', async () => {
    const el = document.createElement('ui-nav-rail')
    el.append(makeItem('/a', 'Alpha'), makeItem('/b', 'Beta'))
    mountRail(el, '300px')
    await settle()
    const { list, trigger } = menuParts(el)

    // aria-controls resolves to the panel's REAL id (n17's own predicate).
    const controls = trigger.getAttribute('aria-controls')
    expect(controls, `${server.browser}: the trigger carries no aria-controls`).toBeTruthy()
    expect(
      document.getElementById(controls as string),
      `${server.browser}: aria-controls does not resolve to the panel`,
    ).toBe(list)

    expect(trigger.getAttribute('aria-expanded'), `${server.browser}: closed must read false`).toBe('false')

    // (1) pointer click
    await userEvent.click(trigger)
    await settle()
    expect(trigger.getAttribute('aria-expanded'), `${server.browser}: click open`).toBe('true')

    // (2) Escape
    await userEvent.keyboard('{Escape}')
    await settle()
    expect(trigger.getAttribute('aria-expanded'), `${server.browser}: Escape close`).toBe('false')

    // (3) outside click
    await userEvent.click(trigger)
    await settle()
    await userEvent.click(document.body)
    await settle()
    expect(trigger.getAttribute('aria-expanded'), `${server.browser}: outside-click close`).toBe('false')

    // (4) PROGRAMMATIC — the platform surface, bypassing the trigger entirely. overlay() writes zero
    // ARIA, so only the panel's own ToggleEvent listener can keep this honest.
    list.showPopover()
    await settle()
    expect(trigger.getAttribute('aria-expanded'), `${server.browser}: programmatic showPopover()`).toBe('true')
    list.hidePopover()
    await settle()
    expect(trigger.getAttribute('aria-expanded'), `${server.browser}: programmatic hidePopover()`).toBe('false')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [2c] collapse="menu" — the flyout is a content-sized card, capped and on-screen (n6, n7, n13)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-nav-rail collapse="menu" — the open panel is a CONTENT-SIZED bordered card (n6, n13)', () => {
  it('all four borders are 1px in the outline colour; the width clamp resolves; the card is narrower than the rail', async () => {
    // A CONTROLLED fixture: deliberately SHORT labels in a 300px rail, so "narrower than the rail" is
    // decided by the fixture rather than by accidental content width.
    const el = document.createElement('ui-nav-rail')
    el.append(makeItem('/a', 'A'), makeItem('/b', 'B'))
    mountRail(el, '300px')
    await settle()
    const { list, trigger } = menuParts(el)

    await userEvent.click(trigger)
    await settle()
    expect(popoverOpen(list), `${server.browser}: the card fixture never opened`).toBe(true)

    const cs = getComputedStyle(list)
    const outline = getComputedStyle(el).getPropertyValue('--ui-nav-rail-outline').trim()
    expect(outline, `${server.browser}: --ui-nav-rail-outline did not resolve`).not.toBe('')
    const expectedColor = resolveColor(outline)
    for (const side of ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'] as const) {
      expect(cs[side], `${server.browser}: ${side} is not 1px`).toBe('1px')
    }
    for (const side of ['borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'] as const) {
      expect(cs[side], `${server.browser}: ${side} is not the --ui-nav-rail-outline colour`).toBe(expectedColor)
    }

    // The width CLAMP is the biting variable. `!== 'none'` would be vacuous (min-inline-size's initial
    // computed value is `auto`, not `none`) — and so is a bare px-shape match on min-inline-size ALONE:
    // measured under the recorded clamp-removal control, Chromium resolves an unset min-inline-size to
    // `0px`, which matches /^[0-9.]+px$/ happily, while WebKit reports `auto`. So the floor is asserted
    // NON-ZERO, which bites in both engines; the ceiling's shape match bites on Chromium's `none`.
    expect(cs.minInlineSize, `${server.browser}: min-inline-size did not resolve to a length`).toMatch(/^[0-9.]+px$/)
    expect(
      Number.parseFloat(cs.minInlineSize),
      `${server.browser}: min-inline-size resolved to zero — there is no floor, so the clamp is absent`,
    ).toBeGreaterThan(0)
    expect(cs.maxInlineSize, `${server.browser}: max-inline-size did not resolve to a length`).toMatch(/^[0-9.]+px$/)

    // Content-sized, NOT full-bleed: the full-bleed band (listW == railW, listLeft == railLeft) IS the
    // GH #368 defect — its side borders sat exactly on the rail's own edges.
    const listRect = list.getBoundingClientRect()
    const railRect = el.getBoundingClientRect()
    expect(listRect.width, `${server.browser}: the panel is still full-bleed against the rail`).toBeLessThan(railRect.width)
  })

  it('a 40-item rail’s panel stays fully on-screen and SCROLLS its overflow (n7)', async () => {
    const el = document.createElement('ui-nav-rail')
    for (let i = 0; i < 40; i++) el.append(makeItem(`/i${i}`, `Item ${i}`))
    mountRail(el, '300px')
    await settle()
    const { list, trigger } = menuParts(el)

    await userEvent.click(trigger)
    await settle()
    expect(popoverOpen(list), `${server.browser}: the 40-item fixture never opened`).toBe(true)

    const rect = list.getBoundingClientRect()
    // `height <= innerHeight` alone would permit a panel that fits but sits off-screen — assert the EDGES.
    expect(rect.top, `${server.browser}: the panel escaped the top of the viewport`).toBeGreaterThanOrEqual(0)
    expect(rect.bottom, `${server.browser}: the panel escaped the bottom of the viewport`).toBeLessThanOrEqual(
      window.innerHeight + 1,
    )
    expect(
      list.scrollHeight,
      `${server.browser}: the panel grew to fit 40 items instead of capping and scrolling`,
    ).toBeGreaterThan(list.clientHeight)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [2d] the GH #260 class — a clipping ancestor can no longer trap the panel (SPEC-R5 AC3, n12)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-nav-rail collapse="menu" — SPEC-R5 AC3: top-layer rendering escapes a clipping ancestor (n12)', () => {
  it('the panel paints and HIT-TESTS below an overflow:hidden ancestor’s bottom edge', async () => {
    // Reproduced at intake, both engines: rail inside a single 44px-tall overflow:hidden ancestor, panel
    // opened → listTop=28 listBottom=122 vs clipperBottom=44, i.e. 78 of the panel's 94px clipped (~83%
    // of the menu invisible). Top-layer MEMBERSHIP is what fixes it.
    const clipper = document.createElement('div')
    clipper.style.width = '300px'
    clipper.style.height = '44px'
    clipper.style.overflow = 'hidden'
    const el = document.createElement('ui-nav-rail')
    el.append(makeItem('/a', 'Alpha'), makeItem('/b', 'Beta'))
    clipper.append(el)
    document.body.append(clipper)
    mounted.push(clipper)
    await settle()

    const { list, trigger } = menuParts(el)
    await userEvent.click(trigger)
    await settle()

    const clipRect = clipper.getBoundingClientRect()
    const listRect = list.getBoundingClientRect()
    // The panel genuinely extends past the clipper — otherwise the hit-test below proves nothing.
    expect(
      listRect.bottom,
      `${server.browser}: the panel does not extend past the clipper, so this probe would be vacuous`,
    ).toBeGreaterThan(clipRect.bottom + 4)

    // The load-bearing assertion: a point INSIDE the panel but PAST the clipper's bottom edge hit-tests to
    // the panel. Deliberately NOT `matches(':popover-open')` — that is exactly what the negative control
    // removes, so it could never bite.
    const probeX = listRect.left + listRect.width / 2
    const probeY = clipRect.bottom + Math.min(12, (listRect.bottom - clipRect.bottom) / 2)
    const hit = document.elementFromPoint(probeX, probeY)
    expect(hit, `${server.browser}: nothing was painted at (${probeX}, ${probeY})`).not.toBeNull()
    expect(
      list === hit || list.contains(hit),
      `${server.browser}: the point past the clipper hit ${hit?.tagName}, not the panel — it is still clipped`,
    ).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [2e] the arming seam across the threshold, and the wide arm's byte-cleanliness (n4b, n8)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-nav-rail collapse="menu" — crossing the threshold live (n4b) and leaving no residue (n8)', () => {
  it('900 → 300 → 900 lands in the correct state each time, with no stranded popover attribute', async () => {
    const el = document.createElement('ui-nav-rail')
    el.append(makeItem('/a', 'Alpha'), makeItem('/b', 'Beta'))
    const { wrapper } = mountRail(el, '900px')
    await settle()
    const { list, trigger } = menuParts(el)

    expect(list.hasAttribute('popover'), `${server.browser}: armed at 900px`).toBe(false)
    expect(getComputedStyle(trigger).display, `${server.browser}: trigger shown at 900px`).toBe('none')

    wrapper.style.width = '300px'
    await settle()
    expect(list.getAttribute('popover'), `${server.browser}: not armed after narrowing to 300px`).toBe('auto')
    expect(getComputedStyle(trigger).display, `${server.browser}: trigger hidden at 300px`).not.toBe('none')

    wrapper.style.width = '900px'
    await settle()
    expect(list.hasAttribute('popover'), `${server.browser}: a stranded popover attribute after re-widening`).toBe(false)
    expect(getComputedStyle(list).display, `${server.browser}: the list did not return to flow`).not.toBe('none')
  })

  it('ZERO RESIDUE: the band ResizeObserver is disconnected on host disconnect (C10)', async () => {
    // The band observer is this wave's one NEW long-lived subscriber, and it can watch an ANCESTOR of the
    // rail (under collapse-container="ancestor") — an observer that outlived its host would keep a foreign
    // element alive and keep arming a detached panel. It rides a scope-owned effect whose disposer calls
    // disconnect(); this proves that disposer actually fires. Counted by patching the prototype rather than
    // replacing the class, so the real observer still does its real work in this same test.
    const real = ResizeObserver.prototype.disconnect
    let disconnects = 0
    ResizeObserver.prototype.disconnect = function patched(this: ResizeObserver): void {
      disconnects++
      real.call(this)
    }
    try {
      const el = document.createElement('ui-nav-rail')
      el.append(makeItem('/a', 'Alpha'), makeItem('/b', 'Beta'))
      const { wrapper } = mountRail(el, '300px')
      await settle()
      // Anti-vacuous: the observer must genuinely have been created and armed the band, or a passing
      // disconnect count would prove nothing at all.
      const { list } = menuParts(el)
      expect(list.getAttribute('popover'), `${server.browser}: the band observer never armed — nothing to leak`).toBe('auto')
      expect(disconnects, `${server.browser}: disconnected before the host even left the document`).toBe(0)

      el.remove()
      await settle()
      expect(disconnects, `${server.browser}: the band ResizeObserver outlived its host`).toBeGreaterThan(0)
      wrapper.remove()
    } finally {
      ResizeObserver.prototype.disconnect = real
    }
  })

  it('after open → close → resize-to-wide, every overlay inline style is cleared and the list is back in flow (n8)', async () => {
    // This leg exists because overlay() has NO reset path: it writes six inline styles on every position()
    // (overlay.ts:189-194), clears none of them in cleanup() (overlay.ts:334-350), and never un-sets the
    // popover attribute it sets at :165. Without nav-rail.ts's own disarm, all of that survives into the
    // wide arm — and the stranded `popover` alone makes the UA hide the in-flow list.
    const el = document.createElement('ui-nav-rail')
    el.append(makeItem('/a', 'Alpha'), makeItem('/b', 'Beta'))
    const { wrapper } = mountRail(el, '300px')
    await settle()
    const { list, trigger } = menuParts(el)

    await userEvent.click(trigger)
    await settle()
    expect(popoverOpen(list), `${server.browser}: the panel never opened`).toBe(true)
    expect(list.style.position, `${server.browser}: overlay() did not write its inline position`).toBe('fixed')

    await userEvent.keyboard('{Escape}')
    await settle()
    wrapper.style.width = '900px'
    await settle()

    expect(list.style.position, `${server.browser}: inline position survived into the wide arm`).toBe('')
    expect(list.style.top, `${server.browser}: inline top survived`).toBe('')
    expect(list.style.left, `${server.browser}: inline left survived`).toBe('')
    expect(list.style.right, `${server.browser}: inline right survived`).toBe('')
    expect(list.style.margin, `${server.browser}: inline margin survived`).toBe('')
    expect(list.hasAttribute('popover'), `${server.browser}: the popover attribute survived`).toBe(false)

    // In flow: the panel's top edge sits at the rail's own content-box top.
    const listTop = list.getBoundingClientRect().top
    const railTop = el.getBoundingClientRect().top
    expect(listTop, `${server.browser}: the panel is not back in the rail's flow`).toBeCloseTo(railTop, 0)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [2b] collapse-container="ancestor" — the narrow-sidebar seam (TKT-0035)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-nav-rail collapse-container="ancestor" — the narrow-sidebar seam (TKT-0035, n4c)', () => {
  it('a rail in a narrow ~15rem column shows the WIDE vertical rail when a WIDE named ancestor opts in (the acceptance)', async () => {
    const el = document.createElement('ui-nav-rail')
    el.setAttribute('collapse', 'menu')
    el.setAttribute('collapse-container', 'ancestor')
    el.append(makeItem('/a', 'Alpha'), makeItem('/b', 'Beta'))
    mountRailInNamedAncestor(el, '900px', '240px') // ancestor WIDE (≥40rem), rail's own column ~15rem
    await settle()

    expect(getComputedStyle(el).containerType, `${server.browser}: the rail did not relinquish its own containment`).toBe('normal')
    const { list, trigger } = menuParts(el)
    expect(getComputedStyle(list).display, `${server.browser}: the list collapsed despite a WIDE named ancestor`).not.toBe('none')
    expect(getComputedStyle(trigger).display, `${server.browser}: the trigger showed despite a WIDE named ancestor`).toBe('none')

    // n4c's load-bearing half (GH #368): an observer watching the rail's OWN box (`this`, 240px) instead of
    // the RESOLVED container box (the 900px named ancestor) would arm the overlay here. This is the
    // assertion that discriminates a wrong-box observer — visibility alone is pure CSS and would pass.
    expect(
      list.hasAttribute('popover'),
      `${server.browser}: the band observer armed the overlay — it is watching the rail's own 240px box, not the resolved 900px container`,
    ).toBe(false)

    // WHOLE-SHAPE: real rendered rows in the narrow column, not a zero-size ghost (the [[test-the-whole-shape]] law).
    const rows = [...el.querySelectorAll('[data-part="activator"]')] as HTMLElement[]
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      const rect = row.getBoundingClientRect()
      expect(rect.width, `${server.browser}: a row collapsed to zero width`).toBeGreaterThan(0)
      expect(rect.height, `${server.browser}: a row collapsed to zero height`).toBeGreaterThan(0)
    }
  })

  it('the SAME narrow-column rail collapses AND arms a real top-layer panel when the named ancestor goes NARROW', async () => {
    const el = document.createElement('ui-nav-rail')
    el.setAttribute('collapse', 'menu')
    el.setAttribute('collapse-container', 'ancestor')
    el.append(makeItem('/a', 'Alpha'), makeItem('/b', 'Beta'))
    mountRailInNamedAncestor(el, '300px', '240px') // ancestor NARROW (<40rem) too
    await settle()

    const { list, trigger } = menuParts(el)
    expect(getComputedStyle(list).display, `${server.browser}: the list stayed visible despite a NARROW named ancestor`).toBe('none')
    expect(getComputedStyle(trigger).display, `${server.browser}: the trigger did not show despite a NARROW named ancestor`).not.toBe('none')

    // The ancestor arm must reach the SAME overlay, not a degraded one: activation opens the top layer.
    expect(list.getAttribute('popover'), `${server.browser}: the ancestor arm did not arm the overlay`).toBe('auto')
    await userEvent.click(trigger)
    await settle()
    expect(popoverOpen(list), `${server.browser}: the ancestor arm's panel did not reach the top layer`).toBe(true)
    expect(getComputedStyle(list).position, `${server.browser}: the ancestor arm's panel is not overlay-positioned`).toBe('fixed')
  })

  it('NEGATIVE CONTROL — collapse-container="self" (default) ignores a wide named ancestor; the rail measures its OWN narrow box', async () => {
    const el = document.createElement('ui-nav-rail')
    el.setAttribute('collapse', 'menu') // collapse-container defaults to 'self' — no attribute set
    el.append(makeItem('/a', 'Alpha'), makeItem('/b', 'Beta'))
    mountRailInNamedAncestor(el, '900px', '240px') // ancestor WIDE, but self mode must ignore it
    await settle()

    expect(getComputedStyle(el).containerType, `${server.browser}: self mode should still self-contain`).toBe('inline-size')
    const { list } = menuParts(el)
    expect(
      getComputedStyle(list).display,
      `${server.browser}: self mode read the ancestor instead of its own box (non-vacuous negative control)`,
    ).toBe('none')
    // The JS half of the same control: self mode must ARM (its own box is 240px, below the line) — the
    // mirror image of the wide-ancestor case above, so one shared observer bug cannot pass both.
    expect(list.getAttribute('popover'), `${server.browser}: self mode did not arm on its own narrow box`).toBe('auto')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] collapse="drill-in" — no self-collapse at any width (SPEC-R7)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-nav-rail collapse="drill-in" — the rail itself never reflows (SPEC-R7)', () => {
  it('narrow or wide, the item rows stay rendered identically — no menu parts, no hidden items', async () => {
    for (const width of ['900px', '300px']) {
      const el = document.createElement('ui-nav-rail')
      el.setAttribute('collapse', 'drill-in')
      el.append(makeItem('', 'Overview', true), makeItem('', 'Appearance'))
      mountRail(el, width)
      await new Promise((r) => requestAnimationFrame(() => r(undefined)))

      expect(el.querySelector(':scope > [data-part="trigger"]'), `${server.browser}: a menu trigger appeared at ${width}`).toBeNull()
      expect(el.querySelector(':scope > [data-part="list"]'), `${server.browser}: a menu panel appeared at ${width}`).toBeNull()
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
    // truncate, never the whole rail to collapse into its menu flyout (which would hide the row entirely,
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

  it('GH #624 item 3: the tag reads the mono typeface and the neutral color role, not the row ink', async () => {
    const { el, tag } = withTag()
    mountRail(el, '900px')
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))
    const cs = getComputedStyle(tag)
    expect(cs.fontFamily.toLowerCase(), `${server.browser}: expected a monospace font stack on the tag`).toContain('mono')
    const tagColor = cs.color
    const inkColor = resolveColor(getComputedStyle(el).getPropertyValue('--ui-nav-rail-ink').trim())
    const neutralColor = resolveColor(getComputedStyle(el).getPropertyValue('--ui-nav-rail-meta-ink').trim())
    expect(tagColor, `${server.browser}: the tag still reads the row's own ink`).not.toBe(inkColor)
    expect(tagColor, `${server.browser}: the tag does not resolve to the neutral role`).toBe(neutralColor)
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
