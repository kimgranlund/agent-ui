// super-shell-responsive.browser.test.ts — ui-super-shell cross-engine browser truth for the GH #170
// responsive system (SPEC-R8 band ladder · SPEC-R9 toggle affordance law · SPEC-R10 scrollbar seam,
// LLD-C1/C2/C3/C7, ADR-0155). These legs need REAL layout (container queries, computed display,
// ResizeObserver, focus) — none is reachable in jsdom, so they live in the (app) browser shard.
//
// Root font is the engine default 16px here, so the two named lines are 40rem = 640px (narrow) and
// 52.5rem = 840px (compact); container widths are chosen to sit unambiguously inside each band.
import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/components/foundation-styles.css'
// GH #221 — the shell's tab strips compose the fleet ui-tabs control, whose own sheet (tabs.css, via
// the family barrel) owns the tablist viewport this file's R10a strip assertion now targets.
import '@agent-ui/components/component-styles.css'
import './super-shell.css'
import { UISuperShellElement } from './super-shell.ts'

const mounted: HTMLElement[] = []
afterEach(() => { for (const el of mounted.splice(0)) el.remove() })

/** Wait for a ResizeObserver-driven callback (the band-hygiene RO, SPEC-R9c) to have fired + settled. */
const settle = async (el: UISuperShellElement): Promise<void> => {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
  await el.updateComplete
}

interface MountOpts { width: number; collapseBand?: 'narrow' | 'compact'; narrowStart?: 'collapse' | 'stack' | 'tabs'; withRail?: boolean }

/** A fixed-width shell: header + a START side (nav-pane, optionally a preceding rail) + content. The
 *  container-type:inline-size on :scope makes the `@container` queries resolve against `width`. */
function mount(opts: MountOpts): UISuperShellElement {
  const el = document.createElement('ui-super-shell') as UISuperShellElement
  el.style.position = 'fixed'
  el.style.insetBlockStart = '0px'
  el.style.insetInlineStart = '0px'
  el.style.inlineSize = `${opts.width}px`
  el.style.blockSize = '400px'
  if (opts.collapseBand) el.setAttribute('collapse-band', opts.collapseBand)
  if (opts.narrowStart) el.setAttribute('narrow-start', opts.narrowStart)

  const header = document.createElement('div'); header.setAttribute('data-slot', 'header'); header.textContent = 'H'
  const children: HTMLElement[] = [header]
  if (opts.withRail) { const rail = document.createElement('div'); rail.setAttribute('data-slot', 'global-nav'); rail.textContent = 'GN'; children.push(rail) }
  const nav = document.createElement('div'); nav.setAttribute('data-slot', 'nav-pane'); nav.textContent = 'NAV'; children.push(nav)
  const content = document.createElement('div'); content.setAttribute('data-slot', 'content'); content.textContent = 'C'; children.push(content)
  el.append(...children)
  document.body.append(el)
  mounted.push(el)
  return el
}

const startSide = (el: UISuperShellElement): HTMLElement => el.querySelector('[data-part="middle"] > [data-slot-name="nav-pane"]') as HTMLElement
const startToggle = (el: UISuperShellElement): HTMLElement => el.querySelector('[data-part="side-toggle"][data-side="start"]') as HTMLElement
const isHidden = (box: HTMLElement): boolean => getComputedStyle(box).display === 'none'

describe('ui-super-shell — SPEC-R8 band ladder (AC13)', () => {
  it('a collapse-band="compact" shell hides its collapse side below 52.5rem while a DEFAULT shell at the same width keeps it', () => {
    const compact = mount({ width: 768, collapseBand: 'compact' }) // 48rem — inside the compact band
    const def = mount({ width: 768 }) // default (narrow-band) shell at the SAME width
    expect(isHidden(startSide(compact)), 'compact shell hides its collapse side at 48rem').toBe(true)
    expect(isHidden(startSide(def)), 'a default shell still shows it at 48rem (below its 40rem line only)').toBe(false)
  })

  it('the persisted collapsed-* attribute survives a wide → compact → wide crossing UNREWRITTEN (the no-clobber law)', async () => {
    const el = mount({ width: 1200, collapseBand: 'compact' })
    expect(el.hasAttribute('collapsed-start')).toBe(false) // persisted wide = expanded
    el.style.inlineSize = '768px'; await settle(el) // into the compact band
    expect(isHidden(startSide(el))).toBe(true) // hidden by the QUERY, not the attribute
    expect(el.hasAttribute('collapsed-start'), 'no attribute written at compact').toBe(false)
    el.style.inlineSize = '1200px'; await settle(el) // back to wide
    expect(isHidden(startSide(el))).toBe(false)
    expect(el.hasAttribute('collapsed-start'), 'the wide choice survived unrewritten').toBe(false)
  })

  it('AC14 — depth-2 outer-in cascade: the OUTER (compact) side collapses at 48rem while the INNER (default) side holds', async () => {
    const outer = mount({ width: 768, collapseBand: 'compact' })
    const canvas = outer.querySelector('[data-part="canvas"]') as HTMLElement
    const inner = document.createElement('ui-super-shell') as UISuperShellElement
    const innerNav = document.createElement('div'); innerNav.setAttribute('data-slot', 'nav-pane'); innerNav.textContent = 'inner-nav'
    const innerContent = document.createElement('div'); innerContent.setAttribute('data-slot', 'content'); innerContent.textContent = 'inner-C'
    inner.append(innerNav, innerContent)
    canvas.append(inner)
    await settle(outer)
    const innerSide = inner.querySelector('[data-part="middle"] > [data-slot-name="nav-pane"]') as HTMLElement
    expect(isHidden(startSide(outer)), 'outer app-ring side collapses at the compact line').toBe(true)
    // the inner container is now ~full outer width (the outer side is gone), comfortably above its own 40rem line
    expect(isHidden(innerSide), 'inner canvas side holds — collapses only below ITS 40rem line (GH #44 cascade)').toBe(false)
  })
})

describe('ui-super-shell — SPEC-R9 toggle affordance law (AC15/AC16)', () => {
  it('AC15 menu⇄X: the X paints only while the overlay is open, and NO stale X survives a resize back to wide', async () => {
    const el = mount({ width: 768, collapseBand: 'compact' })
    const toggle = startToggle(el)
    const menu = toggle.querySelector('[data-glyph="menu"]') as HTMLElement
    const close = toggle.querySelector('[data-glyph="close"]') as HTMLElement
    expect(isHidden(close), 'closed: X hidden, menu shown').toBe(true)
    expect(isHidden(menu)).toBe(false)
    toggle.click(); await settle(el) // open the overlay
    expect(el.getAttribute('data-narrow-open')).toBe('start')
    expect(isHidden(menu), 'open: menu hidden, X shown').toBe(true)
    expect(isHidden(close)).toBe(false)
    expect(toggle.getAttribute('aria-expanded'), 'aria-expanded truthful at compact (open===side)').toBe('true')
    // resize back to WIDE with the overlay still nominally open — the RO must clear the stale state
    el.style.inlineSize = '1200px'; await settle(el)
    expect(el.hasAttribute('data-narrow-open'), 'stale data-narrow-open cleared on band exit').toBe(false)
    expect(isHidden(close), 'no stale X at wide').toBe(true)
    expect(toggle.getAttribute('aria-expanded'), 'aria-expanded back to the wide !collapsed truth').toBe('true')
  })

  it('AC16 dismissal: scrim tap and Escape each clear the overlay with focus returned to the toggle', async () => {
    const el = mount({ width: 768, collapseBand: 'compact' })
    const toggle = startToggle(el)
    // scrim tap
    toggle.click(); await settle(el)
    expect(document.activeElement, 'focus moves to the opened side box').toBe(startSide(el))
    const scrim = el.querySelector('[data-part="scrim"]') as HTMLElement
    expect(isHidden(scrim), 'scrim visible while open').toBe(false)
    scrim.click(); await settle(el)
    expect(el.hasAttribute('data-narrow-open'), 'scrim tap dismisses').toBe(false)
    expect(document.activeElement, 'focus returns to the toggle').toBe(toggle)
    // Escape
    toggle.click(); await settle(el)
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await settle(el)
    expect(el.hasAttribute('data-narrow-open'), 'Escape dismisses').toBe(false)
    expect(document.activeElement, 'focus returns to the toggle after Escape').toBe(toggle)
  })

  it('AC16 overlay cap: at 320px the open overlay clamps to calc(100cqi - bar-size - overlay-inset), so a canvas edge stays visible', async () => {
    const el = mount({ width: 320, narrowStart: 'collapse' }) // narrow band, default collapse-band
    // Pane default is 252px < 320, so a `width < 320` pin would pass with OR without the cap (vacuous). Push
    // the pane's own size ABOVE the ~254px clamp (320cqi − 54px bar − 12px floating inset) so the cap rule is
    // genuinely load-bearing: uncapped the overlay would be 300px; the cap must pull it to ~254px.
    el.style.setProperty('--ui-super-shell-pane-size', '300px')
    const toggle = startToggle(el)
    toggle.click(); await settle(el)
    const width = startSide(el).getBoundingClientRect().width
    expect(width, 'the cap clamped the overlay BELOW its own 300px pane-size (deleting the cap would leave it at 300)').toBeLessThan(280)
    expect(Math.round(width), 'clamped to ~calc(100cqi - bar-size - overlay-inset) = 320 - 54 - 12 = 254px').toBeGreaterThan(248)
    expect(Math.round(width)).toBeLessThanOrEqual(258)
  })

  it('the mixed-arm compact probe: a compact shell with a STACK start side keeps a VISIBLE menu-glyph toggle at 45rem (its line is 40rem, not 52.5rem)', async () => {
    const el = mount({ width: 720, collapseBand: 'compact', narrowStart: 'stack' }) // 45rem — above the stack side's 40rem line
    const toggle = startToggle(el)
    expect(isHidden(toggle), 'a stack side toggle stays visible above 40rem, even on a compact shell').toBe(false)
    expect(isHidden(startSide(el)), 'the stack side keeps full wide behavior between 40–52.5rem').toBe(false)
    toggle.click(); await settle(el)
    // above the 40rem line a stack side takes the WIDE arm — persisted collapse, never the overlay
    expect(el.hasAttribute('data-narrow-open'), 'no overlay reachable for a stack side above its line').toBe(false)
    expect(el.collapsedStart, 'a click toggles the persisted collapse state instead').toBe(true)
  })
})

describe('ui-super-shell — floating overlay margin (shell-polish wave, S2): the pane floats popover-style instead of docking flush to the middle row', () => {
  const OVERLAY_INSET = 12 // px — --ui-super-shell-overlay-inset = module(18px) × 2/3, at the default 16px root font
  const TOLERANCE = 2 // px — cross-engine (chromium/webkit) subpixel-rounding slack

  const middlePart = (el: UISuperShellElement): HTMLElement => el.querySelector('[data-part="middle"]') as HTMLElement
  const endSide = (el: UISuperShellElement): HTMLElement => el.querySelector('[data-part="middle"] > [data-slot-name="options-pane"]') as HTMLElement
  const endToggle = (el: UISuperShellElement): HTMLElement => el.querySelector('[data-part="side-toggle"][data-side="end"]') as HTMLElement

  /** A shell with an END side (options-pane) instead of the shared `mount()`'s start side. */
  function mountEnd(width: number, collapseBand?: 'compact'): UISuperShellElement {
    const el = document.createElement('ui-super-shell') as UISuperShellElement
    el.style.cssText = `position:fixed;inset-block-start:0;inset-inline-start:0;inline-size:${width}px;block-size:400px`
    if (collapseBand) el.setAttribute('collapse-band', collapseBand)
    const header = document.createElement('div'); header.setAttribute('data-slot', 'header'); header.textContent = 'H'
    const options = document.createElement('div'); options.setAttribute('data-slot', 'options-pane'); options.textContent = 'OPT'
    const content = document.createElement('div'); content.setAttribute('data-slot', 'content'); content.textContent = 'C'
    el.append(header, options, content)
    document.body.append(el)
    mounted.push(el)
    return el
  }

  it('narrow band (<40rem), START side: the open overlay is inset from the middle row on the near, top, and bottom edges', async () => {
    const el = mount({ width: 600, narrowStart: 'collapse' })
    const toggle = startToggle(el)
    toggle.click(); await settle(el)
    const middleRect = middlePart(el).getBoundingClientRect()
    const paneRect = startSide(el).getBoundingClientRect()
    expect(Math.abs(paneRect.left - middleRect.left - OVERLAY_INSET), 'near-edge (inline-start) floating inset ≈ 12px, not flush (0px)').toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(paneRect.top - middleRect.top - OVERLAY_INSET), 'top floating inset ≈ 12px, not flush (0px)').toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(middleRect.bottom - paneRect.bottom - OVERLAY_INSET), 'bottom floating inset ≈ 12px, not flush (0px)').toBeLessThanOrEqual(TOLERANCE)
  })

  it('compact band (<52.5rem), START side: the same floating inset holds on the mirrored compact overlay rule', async () => {
    const el = mount({ width: 768, collapseBand: 'compact' }) // 48rem — inside the compact band only
    const toggle = startToggle(el)
    toggle.click(); await settle(el)
    const middleRect = middlePart(el).getBoundingClientRect()
    const paneRect = startSide(el).getBoundingClientRect()
    expect(Math.abs(paneRect.left - middleRect.left - OVERLAY_INSET), 'near-edge (inline-start) floating inset ≈ 12px').toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(paneRect.top - middleRect.top - OVERLAY_INSET), 'top floating inset ≈ 12px').toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(middleRect.bottom - paneRect.bottom - OVERLAY_INSET), 'bottom floating inset ≈ 12px').toBeLessThanOrEqual(TOLERANCE)
  })

  it('narrow band, END side: the mirrored inline-end selector floats with the same inset (near/top/bottom)', async () => {
    const el = mountEnd(600)
    const toggle = endToggle(el)
    toggle.click(); await settle(el)
    const middleRect = middlePart(el).getBoundingClientRect()
    const paneRect = endSide(el).getBoundingClientRect()
    expect(Math.abs(middleRect.right - paneRect.right - OVERLAY_INSET), 'near-edge (inline-end) floating inset ≈ 12px').toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(paneRect.top - middleRect.top - OVERLAY_INSET), 'top floating inset ≈ 12px').toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(middleRect.bottom - paneRect.bottom - OVERLAY_INSET), 'bottom floating inset ≈ 12px').toBeLessThanOrEqual(TOLERANCE)
  })

  it('compact band, END side: the mirrored compact-block inline-end selector floats with the same inset', async () => {
    const el = mountEnd(768, 'compact')
    const toggle = endToggle(el)
    toggle.click(); await settle(el)
    const middleRect = middlePart(el).getBoundingClientRect()
    const paneRect = endSide(el).getBoundingClientRect()
    expect(Math.abs(middleRect.right - paneRect.right - OVERLAY_INSET), 'near-edge (inline-end) floating inset ≈ 12px').toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(paneRect.top - middleRect.top - OVERLAY_INSET), 'top floating inset ≈ 12px').toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(middleRect.bottom - paneRect.bottom - OVERLAY_INSET), 'bottom floating inset ≈ 12px').toBeLessThanOrEqual(TOLERANCE)
  })

  it('the scrim stays full-bleed behind the floated panel — the margin belongs to the panel, never the backdrop', async () => {
    const el = mount({ width: 600 })
    const toggle = startToggle(el)
    toggle.click(); await settle(el)
    const middleRect = middlePart(el).getBoundingClientRect()
    const scrim = el.querySelector('[data-part="scrim"]') as HTMLElement
    const scrimRect = scrim.getBoundingClientRect()
    expect(Math.abs(scrimRect.left - middleRect.left), 'scrim flush to the middle row start edge').toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(scrimRect.top - middleRect.top), 'scrim flush to the middle row top edge').toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(scrimRect.right - middleRect.right), 'scrim flush to the middle row end edge').toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(scrimRect.bottom - middleRect.bottom), 'scrim flush to the middle row bottom edge').toBeLessThanOrEqual(TOLERANCE)
  })
})

describe('ui-super-shell — SPEC-R7c survival law across an RO band round-trip (LLD-C7 trip-wire)', () => {
  it('a tracked authored node survives a compact → wide → compact crossing un-cycled (same isConnected identity)', async () => {
    const el = mount({ width: 768, collapseBand: 'compact' })
    const live = document.createElement('div'); live.setAttribute('data-testid', 'live')
    ;(live as unknown as { __marker: string }).__marker = 'original'
    startSide(el).append(live)
    const toggle = startToggle(el)
    toggle.click(); await settle(el) // open overlay at compact
    el.style.inlineSize = '1200px'; await settle(el) // → wide (RO clears the overlay)
    el.style.inlineSize = '768px'; await settle(el) // → compact again
    const found = el.querySelector('[data-testid="live"]') as HTMLElement
    expect(found, 'the same node instance').toBe(live)
    expect(found.isConnected, 'never disconnected across the round-trip').toBe(true)
    expect((found as unknown as { __marker: string }).__marker, 'never rebuilt').toBe('original')
  })
})

describe('ui-super-shell — SPEC-R10 scrollbar seam (AC18)', () => {
  it('a pane box computes scrollbar-width:none with live scroll, and a consumer token repoint restores the bar', async () => {
    const el = mount({ width: 1200 })
    const pane = startSide(el)
    // force overflow inside the pane
    const filler = document.createElement('div'); filler.style.blockSize = '2000px'; pane.append(filler)
    await settle(el)
    expect(getComputedStyle(pane).scrollbarWidth, 'hidden scroller (SPEC-R10a)').toBe('none')
    expect(pane.scrollHeight, 'the pane genuinely overflows').toBeGreaterThan(pane.clientHeight + 1)
    pane.scrollTop = 40
    expect(pane.scrollTop, 'scroll stays live under the hidden bar').toBeGreaterThan(0)
    // the token repoint (consumer override) — the bar comes back
    el.style.setProperty('--ui-super-shell-scrollbar-width', 'auto')
    expect(getComputedStyle(pane).scrollbarWidth, 'repoint restores a visible scrollbar').toBe('auto')
  })

  it('the scroll-fade edge affordance lights on an overflowing pane (scrollFade wired, SPEC-R10b)', async () => {
    const el = mount({ width: 1200 })
    const pane = startSide(el)
    const filler = document.createElement('div'); filler.style.blockSize = '2000px'; pane.append(filler)
    await settle(el)
    expect(pane.hasAttribute('data-fade-bottom'), 'content hidden past the bottom edge fades (the scroll signal)').toBe(true)
  })

  it('the seam covers the active segment AND the narrow-tabs strip, not just plain panes (the other two R10a regions)', async () => {
    const el = document.createElement('ui-super-shell') as UISuperShellElement
    el.style.cssText = 'position:fixed;inset-block-start:0;inset-inline-start:0;inline-size:900px;block-size:400px'
    el.setAttribute('narrow-end', 'tabs')
    const content = document.createElement('div'); content.setAttribute('data-slot', 'content'); content.textContent = 'C'
    const seg1 = document.createElement('div'); seg1.setAttribute('data-slot', 'options-pane'); seg1.setAttribute('data-segment', 'Settings'); seg1.textContent = 's'
    const seg2 = document.createElement('div'); seg2.setAttribute('data-slot', 'options-pane'); seg2.setAttribute('data-segment', 'Context'); seg2.textContent = 'c'
    el.append(content, seg1, seg2)
    document.body.append(el); mounted.push(el)
    await settle(el)
    const activeSeg = el.querySelector('[data-segmented] > [data-segment][data-active]') as HTMLElement
    expect(getComputedStyle(activeSeg).scrollbarWidth, 'the active segment is a hidden scroller too').toBe('none')
    const strip = el.querySelector('[data-part="narrow-tabs"]') as HTMLElement
    expect(strip, 'the narrow-tabs strip composed (a tabs side is present)').not.toBeNull()
    // GH #221 — the strip is a ui-tabs composition: the live horizontal viewport is the CONTROL's own
    // tablist part (tabs.css `overflow-x: auto`), so the R10a hidden-scroller assertion targets it —
    // reached through the shell's --ui-tabs-strip-scrollbar-width chain onto the strip host.
    const stripViewport = strip.querySelector('[data-part="tablist"]') as HTMLElement
    expect(stripViewport, 'the composed ui-tabs created its tablist viewport').not.toBeNull()
    expect(getComputedStyle(stripViewport).scrollbarWidth, 'the narrow-tabs strip viewport is a hidden scroller too').toBe('none')
  })
})

describe('ui-super-shell — scrollFade survives a disconnect+reconnect (lifecycle regression, ADR-0082)', () => {
  it('re-arms the fade after a reconnect — scrollbar-width:none must never persist without its fade signal', async () => {
    const el = mount({ width: 1200 })
    const pane = startSide(el)
    const filler = document.createElement('div'); filler.style.blockSize = '2000px'; pane.append(filler)
    await settle(el)
    expect(pane.hasAttribute('data-fade-bottom'), 'faded on first connect').toBe(true)
    // disconnect: the trait rides host.effect (connection scope) → its cleanup strips the fade flags
    el.remove(); await settle(el)
    expect(pane.hasAttribute('data-fade-bottom'), 'the connection-scoped fade was disposed on disconnect').toBe(false)
    // reconnect: scrollFade must re-arm from connected() (else scrollbar-width:none persists with no fade)
    document.body.append(el); await settle(el)
    expect(getComputedStyle(pane).scrollbarWidth, 'the bar stays hidden across the reconnect').toBe('none')
    expect(pane.hasAttribute('data-fade-bottom'), 'the fade re-armed on reconnect (the B2 lifecycle fix)').toBe(true)
  })
})
