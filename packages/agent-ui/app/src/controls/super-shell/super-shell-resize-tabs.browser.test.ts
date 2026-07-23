// super-shell-resize-tabs.browser.test.ts — ui-super-shell cross-engine browser truth for SPEC-R6/R7
// (LLD-C1/C2, agent-admin-shell-rehost.lld.md §2-3, ADR-0154): the resizable inner pane, pane segments,
// and the tabs narrow arm. Drive mechanism for the drag leg: the SPEC-R3 INSTRUMENT-BRIDGE (ui-split's
// own split.browser.test.ts precedent) — synthetic `dispatchEvent(new PointerEvent(...))` with
// `setPointerCapture` stubbed to a no-op (a synthetic PointerEvent is not an active pointer).
import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest'
import { userEvent, page } from 'vitest/browser'
import '@agent-ui/components/foundation-styles.css'
import './super-shell.css'
import { UISuperShellElement } from './super-shell.ts'

const mounted: HTMLElement[] = []
afterEach(() => { for (const el of mounted.splice(0)) el.remove() })

function stubCapture(el: HTMLElement): void {
  el.setPointerCapture = (_id: number): void => {}
}

const ptr = (type: string, clientX: number, id = 1): PointerEvent =>
  new PointerEvent(type, { clientX, pointerId: id, bubbles: true, cancelable: true })

/** A fixed-position, fixed-width ui-super-shell with a resizable+segmented end pane, tabs at narrow. */
function mount(width = 900): { el: UISuperShellElement; content: HTMLElement; pane: HTMLElement } {
  const el = document.createElement('ui-super-shell') as UISuperShellElement
  el.style.position = 'fixed'
  el.style.insetBlockStart = '0px'
  el.style.insetInlineStart = '0px'
  el.style.inlineSize = `${width}px`
  el.style.blockSize = '400px'
  el.setAttribute('resizable-end', '')
  el.setAttribute('narrow-end', 'tabs')

  const content = document.createElement('div')
  content.setAttribute('data-slot', 'content')
  content.setAttribute('data-tab-label', 'Chat')
  // A tracked node standing in for a live embedded surface (SPEC-R7c's survival law) — identity-checked
  // via isConnected + a marker property, never re-created.
  const live = document.createElement('div')
  live.setAttribute('data-testid', 'live-surface')
  ;(live as unknown as { __marker: string }).__marker = 'original'
  content.append(live)

  // Segments are SIBLINGS sharing the SAME data-slot (the compose() mechanism groups every top-level
  // child of one slot into ONE pane box, exactly like multiple data-slot="header" children already
  // do) — not a wrapper div with data-segment children nested inside it.
  const settings = document.createElement('div')
  settings.setAttribute('data-slot', 'options-pane')
  settings.setAttribute('data-segment', 'Settings')
  settings.textContent = 'settings content'
  const context = document.createElement('div')
  context.setAttribute('data-slot', 'options-pane')
  context.setAttribute('data-segment', 'Context')
  context.textContent = 'context content'

  el.append(content, settings, context)
  document.body.append(el)
  mounted.push(el)
  return { el, content, pane: settings.parentElement as unknown as HTMLElement }
}

describe('ui-super-shell — SPEC-R6 resizable inner pane (AC9)', () => {
  it('GH #206 (independent-review MAJOR-2): a freshly-mounted, never-touched resizer already carries aria-valuenow/-valuemin/-valuemax', async () => {
    // SPEC-R6b names the trio as part of the RENDERED separator, not just its post-interaction state —
    // an SR user tabbing to an untouched resizer must hear a real value, not silence.
    const { el, pane } = mount()
    await el.updateComplete
    const sep = el.querySelector('[data-part="pane-resizer"][data-side="end"]') as HTMLElement
    expect(sep.hasAttribute('aria-valuenow'), 'valuenow is present at rest, before any drag/keypress').toBe(true)
    expect(sep.hasAttribute('aria-valuemin'), 'valuemin is present at rest').toBe(true)
    expect(sep.hasAttribute('aria-valuemax'), 'valuemax is present at rest').toBe(true)
    const valuenow = Number(sep.getAttribute('aria-valuenow'))
    const valuemin = Number(sep.getAttribute('aria-valuemin'))
    const valuemax = Number(sep.getAttribute('aria-valuemax'))
    expect(valuenow, 'valuenow matches the pane\'s real, un-dragged rendered width').toBe(Math.round(pane.getBoundingClientRect().width))
    expect(valuemin, 'valuemin is the resolved pane-min floor (162px, no consumer override)').toBe(162)
    expect(valuemin, 'valuemin never exceeds valuemax').toBeLessThanOrEqual(valuemax)
    expect(valuenow, 'valuenow sits within the reported bounds').toBeGreaterThanOrEqual(valuemin)
    expect(valuenow).toBeLessThanOrEqual(valuemax)
  })

  it('drag resizes the end pane within bounds and reflects size-end on commit', async () => {
    const { el, pane } = mount()
    await el.updateComplete
    const sep = el.querySelector('[data-part="pane-resizer"][data-side="end"]') as HTMLElement
    expect(sep, 'the resizer part exists once resizable-end is set').not.toBeNull()
    stubCapture(sep)
    const startWidth = pane.getBoundingClientRect().width

    sep.dispatchEvent(ptr('pointerdown', 700))
    sep.dispatchEvent(ptr('pointermove', 640)) // drag left (toward content) grows the END pane
    await el.updateComplete
    const midWidth = pane.getBoundingClientRect().width
    expect(midWidth, 'a live move grows the pane before commit').toBeGreaterThan(startWidth)

    sep.dispatchEvent(ptr('pointerup', 640))
    await el.updateComplete
    expect(el.sizeEnd, 'size-end reflects the committed px size').not.toBeNull()
    expect(Math.round(pane.getBoundingClientRect().width)).toBe(Math.round(el.sizeEnd!))
  })

  it('GH #206: a drag writes aria-valuemin/-valuemax alongside aria-valuenow (SPEC-R6b)', async () => {
    const { el, pane } = mount()
    await el.updateComplete
    const sep = el.querySelector('[data-part="pane-resizer"][data-side="end"]') as HTMLElement
    stubCapture(sep)

    sep.dispatchEvent(ptr('pointerdown', 700))
    sep.dispatchEvent(ptr('pointermove', 640)) // drag left (toward content) grows the END pane
    await el.updateComplete
    const valuenow = Number(sep.getAttribute('aria-valuenow'))
    const valuemin = Number(sep.getAttribute('aria-valuemin'))
    const valuemax = Number(sep.getAttribute('aria-valuemax'))
    expect(sep.hasAttribute('aria-valuemin'), 'aria-valuemin is written alongside aria-valuenow').toBe(true)
    expect(sep.hasAttribute('aria-valuemax'), 'aria-valuemax is written alongside aria-valuenow').toBe(true)
    expect(valuenow, 'valuenow matches the live pane width').toBe(Math.round(pane.getBoundingClientRect().width))
    expect(valuemin, 'valuemin is the resolved pane-min floor (162px, no consumer override)').toBe(162)
    expect(valuemax, 'valuenow never exceeds the resolved valuemax').toBeGreaterThanOrEqual(valuenow)
    expect(valuemin, 'valuemin never exceeds valuemax').toBeLessThanOrEqual(valuemax)

    sep.dispatchEvent(ptr('pointerup', 640))
    await el.updateComplete
    expect(sep.getAttribute('aria-valuenow'), 'valuenow still present on commit').not.toBeNull()
    expect(sep.getAttribute('aria-valuemin'), 'valuemin still present on commit').not.toBeNull()
    expect(sep.getAttribute('aria-valuemax'), 'valuemax still present on commit').not.toBeNull()
  })

  it('keyboard arrows step by one module; Home drives straight to the pane minimum (R6c)', async () => {
    const { el, pane } = mount()
    await el.updateComplete
    const sep = el.querySelector('[data-part="pane-resizer"][data-side="end"]') as HTMLElement
    const before = pane.getBoundingClientRect().width

    // LTR + side='end': growsRight = rtl = false, so growKey='ArrowLeft' (super-shell.ts's side-aware
    // #handleResizerKeydown) — dragging/stepping the END separator LEFT (toward the canvas) grows it,
    // the physical mirror of the START side's own ArrowRight-grows convention.
    sep.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    await el.updateComplete
    const grown = pane.getBoundingClientRect().width
    expect(grown, 'ArrowLeft grows the end pane in LTR').toBeGreaterThan(before)
    // GH #206 (SPEC-R6b) — valuemin/-max are written alongside valuenow on every keyboard step too.
    expect(Number(sep.getAttribute('aria-valuenow')), 'valuenow matches the live pane width').toBe(Math.round(grown))
    expect(sep.hasAttribute('aria-valuemin'), 'aria-valuemin written on a keyboard step').toBe(true)
    expect(sep.hasAttribute('aria-valuemax'), 'aria-valuemax written on a keyboard step').toBe(true)
    expect(Number(sep.getAttribute('aria-valuemin')), 'valuemin is the resolved pane-min floor (162px)').toBe(162)
    expect(Number(sep.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(Number(sep.getAttribute('aria-valuemax')))

    sep.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await el.updateComplete
    expect(pane.getBoundingClientRect().width, 'ArrowRight shrinks it back (the mirrored key)').toBeLessThan(grown)

    sep.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    await el.updateComplete
    const paneMinPx = 162 // the token default (9 modules), no consumer override in this mount
    expect(pane.getBoundingClientRect().width).toBeLessThanOrEqual(paneMinPx + 1)
    // Home drives straight to the min bound — valuenow should now equal the reported valuemin.
    expect(Number(sep.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(Number(sep.getAttribute('aria-valuemin')) + 1)
  })

  it('a committed size SURVIVES a collapse round-trip (R6e)', async () => {
    const { el, pane } = mount()
    await el.updateComplete
    const sep = el.querySelector('[data-part="pane-resizer"][data-side="end"]') as HTMLElement
    stubCapture(sep)
    sep.dispatchEvent(ptr('pointerdown', 700))
    sep.dispatchEvent(ptr('pointermove', 640))
    sep.dispatchEvent(ptr('pointerup', 640))
    await el.updateComplete
    const committed = el.sizeEnd
    expect(committed).not.toBeNull()

    el.collapsedEnd = true
    await el.updateComplete
    el.collapsedEnd = false
    await el.updateComplete
    expect(el.sizeEnd, 'the collapse round-trip never touched the committed size').toBe(committed)
    expect(Math.round(pane.getBoundingClientRect().width)).toBe(Math.round(committed!))
  })
})

describe('ui-super-shell — SPEC-R7a pane segments (AC10, wide)', () => {
  it('a segmented pane shows a pane-local strip and exactly one segment at a time', async () => {
    const { el } = mount()
    await el.updateComplete
    const pane = el.querySelector('[data-slot-name="options-pane"]') as HTMLElement
    expect(pane.hasAttribute('data-segmented'), 'data-segment children mark the pane segmented').toBe(true)
    const strip = pane.querySelector('[data-part="pane-tabs"]') as HTMLElement
    expect(strip, 'the pane-local strip is composed').not.toBeNull()
    const tabs = [...strip.querySelectorAll('[data-part="pane-tab"]')]
    expect(tabs.length).toBe(2)

    const settings = pane.querySelector('[data-segment="Settings"]') as HTMLElement
    const context = pane.querySelector('[data-segment="Context"]') as HTMLElement
    expect(settings.hasAttribute('data-active'), 'the first segment defaults active').toBe(true)
    expect(context.hasAttribute('data-active')).toBe(false)

    ;(tabs[1] as HTMLElement).click()
    await el.updateComplete
    expect(settings.hasAttribute('data-active')).toBe(false)
    expect(context.hasAttribute('data-active'), 'clicking the second tab switches the active segment').toBe(true)
    expect(settings.isConnected, 'switching segments never reparents (R7c)').toBe(true)
  })
})

describe('ui-super-shell — SPEC-R7b tabs narrow arm (AC10 flattening, AC11 survival)', () => {
  it('flattens to per-segment top-level tabs at narrow: Content + Settings + Context', async () => {
    const { el } = mount(500) // below the 40rem/640px narrow line
    await el.updateComplete
    const strip = el.querySelector('[data-part="narrow-tabs"]') as HTMLElement
    expect(strip, 'the narrow-tabs strip is composed once a side declares tabs').not.toBeNull()
    const labels = [...strip.querySelectorAll('[data-part="narrow-tab"]')].map((t) => t.textContent)
    expect(labels).toEqual(['Chat', 'Settings', 'Context'])
  })

  it('AC11(a): a live surface survives a same-band resize — zero DOM moves', async () => {
    const { el, content } = mount()
    await el.updateComplete
    const live = content.querySelector('[data-testid="live-surface"]')!
    const sep = el.querySelector('[data-part="pane-resizer"][data-side="end"]') as HTMLElement
    stubCapture(sep)
    sep.dispatchEvent(ptr('pointerdown', 700))
    sep.dispatchEvent(ptr('pointermove', 650))
    sep.dispatchEvent(ptr('pointerup', 650))
    await el.updateComplete
    expect(live.isConnected).toBe(true)
    expect(content.querySelector('[data-testid="live-surface"]')).toBe(live)
  })

  it('AC11(b): a live surface survives a wide→narrow crossing AND a Chat→Settings→Chat tab round-trip, un-cycled', async () => {
    const { el, content } = mount(900)
    await el.updateComplete
    const live = content.querySelector('[data-testid="live-surface"]')!

    el.style.inlineSize = '500px' // cross into narrow
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    await el.updateComplete
    expect(live.isConnected, 'the crossing into narrow never reparents content').toBe(true)
    expect(content.querySelector('[data-testid="live-surface"]')).toBe(live)

    const tabs = [...el.querySelectorAll('[data-part="narrow-tab"]')] as HTMLElement[]
    const settingsTab = tabs.find((t) => t.textContent === 'Settings')!
    const chatTab = tabs.find((t) => t.textContent === 'Chat')!
    settingsTab.click()
    await el.updateComplete
    chatTab.click()
    await el.updateComplete
    expect(live.isConnected, 'a full tab round-trip never reparents content').toBe(true)
    expect(content.querySelector('[data-testid="live-surface"]')).toBe(live)
    expect((live as unknown as { __marker: string }).__marker, 'the SAME node instance, not a rebuilt lookalike').toBe('original')
  })
})

describe('ui-super-shell — SPEC-R6c/AC12 bounds', () => {
  it('no horizontal overflow at any band with a resizable pane and segments both active', async () => {
    for (const width of [900, 500]) {
      const { el } = mount(width)
      await el.updateComplete
      expect(el.scrollWidth, `width=${width}`).toBeLessThanOrEqual(el.clientWidth + 1)
    }
  })

  it('no horizontal overflow once the resizable pane is driven all the way to its End (max) bound', async () => {
    // The static assertion above never actually resizes anything — the pane at its DEFAULT size can't
    // reveal a clamp-math overflow bug. Drive it to the resolved maximum (End clamps to the canvas's own
    // min-size floor, R6c) at the WIDE band (the only one where the resizer itself is live, not flattened
    // into narrow-tabs) and assert the shell still never overflows its own box.
    const { el } = mount(900)
    await el.updateComplete
    const sep = el.querySelector('[data-part="pane-resizer"][data-side="end"]') as HTMLElement
    sep.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    await el.updateComplete
    expect(el.scrollWidth, 'driven to End (max pane size)').toBeLessThanOrEqual(el.clientWidth + 1)

    sep.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    await el.updateComplete
    expect(el.scrollWidth, 'driven back to Home (min pane size)').toBeLessThanOrEqual(el.clientWidth + 1)
  })
})

// ── GH #214 — the resizer OWNS the gap it sits in (no double-spacing) ────────────────────────────────
// The bug: `[data-part='middle']`'s flex `gap` used to stack around the resizer (gap + 4px + gap = 40px
// at the 18px module gap) where every resizer-less seam gets exactly one 18px gap. The fix sizes the
// resizer's hit-box to the gap itself and pulls its neighbors back in by one gap via negative
// margin-inline, so the NET rendered distance is identical whether or not a resizer sits in the seam —
// proven here with real rects, both engines, never hand math.
function mountPlain(width: number): { el: UISuperShellElement; canvas: HTMLElement; pane: HTMLElement } {
  const el = document.createElement('ui-super-shell') as UISuperShellElement
  el.style.position = 'fixed'
  el.style.insetBlockStart = '0px'
  el.style.insetInlineStart = '0px'
  el.style.inlineSize = `${width}px`
  el.style.blockSize = '400px'
  const content = document.createElement('div'); content.setAttribute('data-slot', 'content')
  const opts = document.createElement('div'); opts.setAttribute('data-slot', 'options-pane')
  el.append(content, opts)
  document.body.append(el)
  mounted.push(el)
  return { el, canvas: el.querySelector('[data-part="canvas"]') as HTMLElement, pane: el.querySelector('[data-slot-name="options-pane"]') as HTMLElement }
}

function mountResizable(width: number): { el: UISuperShellElement; canvas: HTMLElement; pane: HTMLElement; resizer: HTMLElement } {
  const el = document.createElement('ui-super-shell') as UISuperShellElement
  el.style.position = 'fixed'
  el.style.insetBlockStart = '0px'
  el.style.insetInlineStart = '0px'
  el.style.inlineSize = `${width}px`
  el.style.blockSize = '400px'
  el.setAttribute('resizable-end', '')
  const content = document.createElement('div'); content.setAttribute('data-slot', 'content')
  const opts = document.createElement('div'); opts.setAttribute('data-slot', 'options-pane')
  el.append(content, opts)
  document.body.append(el)
  mounted.push(el)
  return {
    el,
    canvas: el.querySelector('[data-part="canvas"]') as HTMLElement,
    pane: el.querySelector('[data-slot-name="options-pane"]') as HTMLElement,
    resizer: el.querySelector('[data-part="pane-resizer"][data-side="end"]') as HTMLElement,
  }
}

describe('ui-super-shell — GH #214 resizer-gap footprint (no double-spacing)', () => {
  it('pane→canvas rendered distance WITH a resizer equals the plain (resizer-less) gap', async () => {
    const plain = mountPlain(900)
    await plain.el.updateComplete
    const plainGap = plain.pane.getBoundingClientRect().left - plain.canvas.getBoundingClientRect().right

    const resizable = mountResizable(900)
    await resizable.el.updateComplete
    const resizerGap = resizable.pane.getBoundingClientRect().left - resizable.canvas.getBoundingClientRect().right

    expect(Math.round(resizerGap), 'a resizer-bearing seam renders the SAME distance as a plain seam').toBe(Math.round(plainGap))
    expect(Math.round(plainGap), 'sanity: the plain gap is genuinely the 18px module gap, not 0').toBe(18)
  })

  it("the resizer's hit-box occupies exactly the gap's own width (a better drag target than the old 4px)", async () => {
    const { el, resizer } = mountResizable(900)
    await el.updateComplete
    expect(Math.round(resizer.getBoundingClientRect().width), 'hit-box = --ui-super-shell-gap (18px)').toBe(18)
  })

  it('single-sided (non-resizable) consumers are unchanged: every other seam still renders one plain gap', async () => {
    // Regression pin: the fix touches ONLY [data-part='pane-resizer'] — a shell authored with NO
    // resizable side at all must keep its ordinary rail/pane/canvas gaps untouched.
    const el = document.createElement('ui-super-shell') as UISuperShellElement
    el.style.position = 'fixed'; el.style.insetBlockStart = '0px'; el.style.insetInlineStart = '0px'
    el.style.inlineSize = '900px'; el.style.blockSize = '400px'
    const rail = document.createElement('div'); rail.setAttribute('data-slot', 'global-nav')
    const nav = document.createElement('div'); nav.setAttribute('data-slot', 'nav-pane')
    const content = document.createElement('div'); content.setAttribute('data-slot', 'content')
    el.append(rail, nav, content)
    document.body.append(el); mounted.push(el)
    await el.updateComplete
    const railBox = el.querySelector('[data-part="rail"]') as HTMLElement
    const navBox = el.querySelector('[data-slot-name="nav-pane"]') as HTMLElement
    const canvasBox = el.querySelector('[data-part="canvas"]') as HTMLElement
    expect(Math.round(navBox.getBoundingClientRect().left - railBox.getBoundingClientRect().right), 'rail→pane gap unchanged').toBe(18)
    expect(Math.round(canvasBox.getBoundingClientRect().left - navBox.getBoundingClientRect().right), 'pane→canvas gap unchanged (no resizer authored)').toBe(18)
  })

  it('the ink stays clipped to its content-box (4px, centered) at rest, on hover, AND while dragging — never the full hit-box', async () => {
    const { el, resizer } = mountResizable(900)
    await el.updateComplete
    stubCapture(resizer)
    expect(getComputedStyle(resizer).backgroundClip, 'rest: content-box').toBe('content-box')

    resizer.dispatchEvent(ptr('pointerdown', 700))
    resizer.dispatchEvent(ptr('pointermove', 690))
    await el.updateComplete
    expect(el.matches(':state(dragging)'), 'sanity: dragging is armed').toBe(true)
    expect(getComputedStyle(resizer).backgroundClip, 'dragging: STILL content-box (background-color, never the background shorthand)').toBe('content-box')

    resizer.dispatchEvent(ptr('pointerup', 690))
    await el.updateComplete
  })
})

// ── min-size-floors census (GH #185 follow-up) — the dual-collapse-side squeeze window ──────────────
// The flagship finding: BOTH sides `resizable` + collapse-mode is reachable through the public API
// (chat-shell.ts forwards resizable-start/-end + narrow-start/-end + collapse-band), but no shipped
// consumer authors it — so it shipped un-exercised. At the DEFAULT `collapse-band` (40rem/640px), a
// dual-sided shell has NO band protection between 640px and roughly the width its own fixed geometry
// needs (~700-850px depending on rails) — a passive container resize in that window used to crush
// `[data-part='canvas']` toward 0 (it was the row's one `flex:1 1 auto; min-inline-size:0` item; every
// pane beside it is `flex:0 0 auto`, incapable of yielding). `min-inline-size` on canvas now reads the
// SAME `--ui-super-shell-canvas-min-size` token the drag clamp already used — realizing SPEC-R6c's
// unconditional "the canvas keeps ≥ canvas-min-size" bound in live layout, not just mid-drag.
function mountDualResizable(width: number): { el: UISuperShellElement; middle: HTMLElement } {
  const el = document.createElement('ui-super-shell') as UISuperShellElement
  el.style.position = 'fixed'
  el.style.insetBlockStart = '0px'
  el.style.insetInlineStart = '0px'
  el.style.inlineSize = `${width}px`
  el.style.blockSize = '400px'
  el.setAttribute('resizable-start', '')
  el.setAttribute('resizable-end', '')
  const nav = document.createElement('div'); nav.setAttribute('data-slot', 'nav-pane')
  const content = document.createElement('div'); content.setAttribute('data-slot', 'content')
  const opts = document.createElement('div'); opts.setAttribute('data-slot', 'options-pane')
  el.append(nav, content, opts)
  document.body.append(el)
  mounted.push(el)
  return { el, middle: el.querySelector('[data-part="middle"]') as HTMLElement }
}

describe('ui-super-shell — dual-collapse-side canvas floor (min-size-floors census GH #185; auto-collapse GH #205)', () => {
  // GH #205 retires the OLD interim outcome this describe block used to pin ("below natural fit, the row
  // overflows deliberately") — AC20 is now UNCONDITIONAL: canvas ≥ floor AND zero row overflow at every
  // step of the flagged 640-900px window, never just at-or-above natural fit. The 700px width this block
  // used to assert OVERFLOWS at now flips to NO-overflow (folded into this one sweep, not kept as a
  // second identically-shaped test) — its outcome is now "the end side auto-collapses," not "the row
  // scrolls." Natural fit for THIS mount (both sides resizable, no rails) measures at exactly 702px, live,
  // both engines (252 pane + 18 gap/resizer + 162 canvas floor + 18 gap/resizer + 252 pane) — 44px LOWER
  // than this same config's pre-GH#214 746px, since the resizer no longer stacks a second gap around
  // itself (its net footprint is now exactly one gap, GH #214).
  it('across the full flagged 640-900px sweep, canvas holds ≥ its floor with ZERO row overflow at every step', async () => {
    for (const width of [640, 700, 701, 702, 746, 800, 846, 900]) {
      const { el, middle } = mountDualResizable(width)
      await el.updateComplete
      const canvas = el.querySelector('[data-part="canvas"]') as HTMLElement
      expect(canvas.getBoundingClientRect().width, `width=${width}`).toBeGreaterThanOrEqual(161)
      expect(middle.scrollWidth, `width=${width} — no overflow, at or below natural fit alike (GH #205)`).toBeLessThanOrEqual(middle.clientWidth + 1)
    }
  })

  it('below natural fit (700px, comfortably under the measured 702px), the END side auto-collapses — the mechanism itself, not just its outcome', async () => {
    // 701px (exactly 1px under 702) sits INSIDE the deliberate `scrollWidth > clientWidth + 1` epsilon
    // (the same one-pixel subpixel-rounding tolerance R6c/AC12's own overflow checks use fleet-wide) — it
    // does NOT trigger the mechanism, by design (a hairline sub-2px "overflow" is noise, not a real fit
    // failure). 700px is unambiguously below fit and reliably triggers it, measured live, both engines.
    const { el, middle } = mountDualResizable(700)
    await el.updateComplete
    expect(el.hasAttribute('data-auto-collapsed-end'), 'end auto-collapses first (the file convention: end, then start)').toBe(true)
    expect(el.hasAttribute('data-auto-collapsed-start'), 'collapsing end alone already resolves the fit — start is left alone (escalate-only-if-needed)').toBe(false)
    // R9a precedent, extended to the ambient case: no dead toggle for a side auto-collapsed out of the row.
    expect(el.hasAttribute('collapsed-end'), 'the PUBLIC collapsed-end prop must NEVER be written by the ambient mechanism (R2d — never masquerade as a user choice)').toBe(false)
    const optionsPane = middle.querySelector('[data-slot-name="options-pane"]') as HTMLElement
    expect(getComputedStyle(optionsPane).display, 'the auto-collapsed end pane is genuinely hidden').toBe('none')
  })

  it('at and above natural fit (702px), neither side auto-collapses — the mechanism engages only when genuinely needed', async () => {
    const { el } = mountDualResizable(702)
    await el.updateComplete
    expect(el.hasAttribute('data-auto-collapsed-start')).toBe(false)
    expect(el.hasAttribute('data-auto-collapsed-end')).toBe(false)
  })
})

// GH #205 — MAJOR-1 (independent review): the PUBLIC collapse effect (ts:154-163) used to read
// collapsedStart/collapsedEnd and re-sync ARIA ONLY, never re-checking fit — so a toggle-restore or a
// public collapse could leave the row overflowing (restore case) or a stale data-auto-collapsed-*
// attribute + hidden toggle behind (mirror case) until the next ambient HOST resize. Needs a header
// (mountDualResizable has none — no toggles compose without one, SPEC-R9a) so the real toggle CLICK path
// (not a direct prop assignment) is what's actually exercised.
function mountDualResizableWithHeader(width: number): { el: UISuperShellElement; middle: HTMLElement } {
  const el = document.createElement('ui-super-shell') as UISuperShellElement
  el.style.position = 'fixed'
  el.style.insetBlockStart = '0px'
  el.style.insetInlineStart = '0px'
  el.style.inlineSize = `${width}px`
  el.style.blockSize = '400px'
  el.setAttribute('resizable-start', '')
  el.setAttribute('resizable-end', '')
  const header = document.createElement('div'); header.setAttribute('data-slot', 'header')
  const nav = document.createElement('div'); nav.setAttribute('data-slot', 'nav-pane')
  const content = document.createElement('div'); content.setAttribute('data-slot', 'content')
  const opts = document.createElement('div'); opts.setAttribute('data-slot', 'options-pane')
  el.append(header, nav, content, opts)
  document.body.append(el)
  mounted.push(el)
  return { el, middle: el.querySelector('[data-part="middle"]') as HTMLElement }
}

const settleFit = async (el: UISuperShellElement): Promise<void> => {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
  await el.updateComplete
}

describe('ui-super-shell — GH #205 auto-collapse re-checks fit on a PUBLIC collapse/restore too (independent-review MAJOR-1)', () => {
  it('mirror case: publicly collapsing one side clears a STALE auto-collapse on the other; toggle-restore case: restoring it re-engages auto-collapse, never a stale overflow', async () => {
    const { el, middle } = mountDualResizableWithHeader(700) // inside the flagged window; natural fit is 702px
    await settleFit(el)
    // Baseline: nothing manually collapsed yet — the row auto-collapses END on its own (the existing
    // squeeze behavior, unaffected by this fix).
    expect(el.hasAttribute('data-auto-collapsed-end'), 'baseline: end auto-collapses on its own at 700px').toBe(true)
    expect(el.hasAttribute('data-auto-collapsed-start')).toBe(false)

    // Mirror case: the user PUBLICLY collapses START (frees even more room) — the STALE auto-collapsed-end
    // attribute (now unnecessary) must clear, not persist alongside a hidden toggle nobody can reach.
    el.collapsedStart = true
    await settleFit(el)
    expect(el.hasAttribute('data-auto-collapsed-end'), 'the stale auto-collapse on END clears once START frees room (no longer needed)').toBe(false)
    expect(el.hasAttribute('data-auto-collapsed-start'), 'START is hidden via the PUBLIC prop — the ambient mechanism need not also mark it').toBe(false)
    const optionsPane = middle.querySelector('[data-slot-name="options-pane"]') as HTMLElement
    expect(getComputedStyle(optionsPane).display, 'END is visually restored once its stale auto-collapse clears').not.toBe('none')
    expect(middle.scrollWidth, 'still no overflow').toBeLessThanOrEqual(middle.clientWidth + 1)

    // Toggle-restore case: the user clicks the START toggle to restore it — the row can no longer hold
    // both sides at 700px, so the ambient mechanism must re-engage (END yields first, the file convention)
    // rather than leaving the row to overflow until the next ambient host resize.
    const startToggle = el.querySelector('[data-part="side-toggle"][data-side="start"]') as HTMLElement
    expect(startToggle, 'sanity: the header composes a real start toggle').not.toBeNull()
    startToggle.click()
    await settleFit(el)
    expect(el.collapsedStart, "the user's restore intent is honestly stored in the PUBLIC prop").toBe(false)
    expect(el.hasAttribute('data-auto-collapsed-end'), 'the ambient mechanism re-engages immediately on the toggle click, not on the next host resize').toBe(true)
    expect(el.hasAttribute('data-auto-collapsed-start')).toBe(false)
    expect(middle.scrollWidth, 'no overflow window even momentarily — the effect re-checks fit synchronously with the click').toBeLessThanOrEqual(middle.clientWidth + 1)
  })
})

// ── GH #182 regression pin — the pane-resizer's THREE decoupled visual states ───────────────────────
// The original bug: a real engine renders no jsdom probe can see (background/outline computed paint).
// This is the permanent gate against the exact gate-blindness that let the solid full-height primary
// slab ship green — `component-reviewer` finding, ui:component-reviewer review of GH #182's fix.
//
// Viewport (ADR-0150 cl.5, the text.browser.test.ts/menu.browser.test.ts precedent): this file's own
// mount() sizes the shell at 900px so the resizer sits in WIDE mode (SPEC-R4's ≥40rem/640px line) — past
// the fleet's default 414×896 harness viewport. `getBoundingClientRect()` numbers are viewport-independent
// (position:fixed geometry resolves regardless), but a REAL `userEvent.hover()`/`.focus()` needs the
// target actually on-screen for Playwright's actionability — so this describe ONLY widens the viewport,
// then restores the fleet default for any file content appended after it.
describe('ui-super-shell — pane-resizer visual states (GH #182 regression pin)', () => {
  beforeAll(async () => {
    await page.viewport(1024, 600)
  })
  afterAll(async () => {
    await page.viewport(414, 896) // restore the fleet default (ADR-0150 cl.5)
  })

  it('rest vs hover: the hover/drag fill is a real repaint off the resting ink', async () => {
    const { el } = mount()
    await el.updateComplete
    const sep = el.querySelector('[data-part="pane-resizer"][data-side="end"]') as HTMLElement
    const restBg = getComputedStyle(sep).backgroundColor

    await userEvent.hover(sep)
    const hoverBg = getComputedStyle(sep).backgroundColor
    await userEvent.unhover(sep)

    expect(restBg, 'the resting ink must differ from the hover/drag fill').not.toBe(hoverBg)
  })

  it('focus-visible draws a thin ring but never ALSO fills the background (the GH #182 slab)', async () => {
    const { el } = mount()
    await el.updateComplete
    const sep = el.querySelector('[data-part="pane-resizer"][data-side="end"]') as HTMLElement
    const restBg = getComputedStyle(sep).backgroundColor

    await userEvent.hover(sep)
    const hoverBg = getComputedStyle(sep).backgroundColor
    await userEvent.unhover(sep)
    expect(restBg, 'the fixture must be meaningful: rest and hover must genuinely differ').not.toBe(hoverBg)

    sep.focus()
    await expect.poll(() => sep.matches(':focus-visible')).toBe(true)

    const cs = getComputedStyle(sep)
    expect(cs.backgroundColor, 'GH #182 regression: a focused-but-not-hovered resizer must stay the resting ink, not the hover fill').toBe(restBg)
    expect(cs.backgroundColor, 'the focused background must not be the hover/drag fill either').not.toBe(hoverBg)
    expect(cs.outlineStyle, 'no focus-visible outline drawn').toBe('solid')
    expect(Number.parseFloat(cs.outlineWidth), 'the focus outline width is zero').toBeGreaterThan(0)

    sep.blur()
  })

  it('the focus outline resolves the DEDICATED --md-sys-color-focus-ring token, never --md-sys-color-primary reused', async () => {
    const { el } = mount()
    // --md-sys-color-primary and --md-sys-color-focus-ring are both light-dark() roles that COINCIDE in
    // light mode by design (ADR-0009's dedicated-role tokens.test.ts pins) — forcing dark scheme is what
    // makes them diverge (primary-450 vs primary-400), so only here can a probe tell the two apart.
    el.style.colorScheme = 'dark'
    await el.updateComplete
    const sep = el.querySelector('[data-part="pane-resizer"][data-side="end"]') as HTMLElement

    const probePrimary = document.createElement('span')
    probePrimary.style.background = 'var(--md-sys-color-primary)'
    sep.append(probePrimary)
    const primaryDark = getComputedStyle(probePrimary).backgroundColor
    probePrimary.remove()

    const probeRing = document.createElement('span')
    probeRing.style.background = 'var(--md-sys-color-focus-ring)'
    sep.append(probeRing)
    const ringDark = getComputedStyle(probeRing).backgroundColor
    probeRing.remove()

    expect(ringDark, 'the two dark-mode swatches must genuinely differ for this probe to be meaningful').not.toBe(primaryDark)

    sep.focus()
    await expect.poll(() => sep.matches(':focus-visible')).toBe(true)
    const outlineColor = getComputedStyle(sep).outlineColor
    expect(outlineColor, 'the outline must resolve --md-sys-color-focus-ring').toBe(ringDark)
    expect(outlineColor, 'the outline must NOT resolve --md-sys-color-primary directly').not.toBe(primaryDark)

    sep.blur()
  })
})

// ── GH #185 (parity gap a) — the ui-split `:state(dragging)` fill-persistence precedent, mirrored ──────
// The gap: without `internals.states.add/delete('dragging')` (split.ts's own mechanism), a fast drag that
// sweeps the pointer off the thin 0.25rem ink (GH #214 widened the HIT-BOX to a full gap; the visible ink
// stays the original thin sliver) drops the `:hover` fill mid-gesture, reading as the
// resizer "letting go." No real `userEvent.hover()` is used below — the synthetic `ptr()` PointerEvents
// never engage a real `:hover`, so a persisting fill can ONLY come from `:state(dragging)` (super-shell.css's
// `:scope:state(dragging) [data-part='pane-resizer']`), proving the state — not incidental hover — holds it.
describe('ui-super-shell — pane-resizer :state(dragging) fill persistence (GH #185 parity gap a)', () => {
  it('the drag fill persists via :state(dragging) for the whole gesture, with no real :hover engaged', async () => {
    const { el } = mount()
    await el.updateComplete
    const sep = el.querySelector('[data-part="pane-resizer"][data-side="end"]') as HTMLElement
    stubCapture(sep)
    const restBg = getComputedStyle(sep).backgroundColor

    expect(el.matches(':state(dragging)'), 'dragging must not be armed before any interaction').toBe(false)

    sep.dispatchEvent(ptr('pointerdown', 700))
    sep.dispatchEvent(ptr('pointermove', 640)) // the first live move arms :state(dragging)
    await el.updateComplete
    expect(el.matches(':state(dragging)'), ':state(dragging) was not armed on the first live move').toBe(true)
    const dragBg = getComputedStyle(sep).backgroundColor
    expect(dragBg, 'the drag fill must differ from the resting ink for this probe to be meaningful').not.toBe(restBg)

    sep.dispatchEvent(ptr('pointermove', 620)) // simulates the pointer sweeping further — still no real hover
    await el.updateComplete
    expect(getComputedStyle(sep).backgroundColor, 'the fill must still hold mid-drag with no real :hover engaged').toBe(dragBg)

    sep.dispatchEvent(ptr('pointerup', 620))
    await el.updateComplete
    expect(el.matches(':state(dragging)'), 'dragging must clear on release').toBe(false)
    expect(getComputedStyle(sep).backgroundColor, 'the fill must revert to the resting ink after release').toBe(restBg)
  })
})

// ── GH #196 (ui-split parity gap c) — text-selection suspension for the whole drag gesture ──────────────
// The gap: a fast drag sweeping the pointer across pane/canvas text has no selection boundary of its own
// and would highlight-select it, since the resizer's `:state(dragging)` (armed by #185) only drove the
// fill, never `user-select`. Mirrors split.css's own `:scope:state(dragging) { user-select: none }`
// (TKT-0015 pt.2) onto super-shell's `:scope` (super-shell.css).
describe('ui-super-shell — pane-resizer text-selection suspension during drag (GH #196 parity gap c)', () => {
  it('user-select is none on the shell for the whole drag and reverts after pointerup', async () => {
    const { el } = mount()
    await el.updateComplete
    const sep = el.querySelector('[data-part="pane-resizer"][data-side="end"]') as HTMLElement
    stubCapture(sep)

    // WebKit exposes the computed value only under the prefixed CSSOM name (split.browser.test.ts's own
    // TKT-0015 pt.2 precedent — unprefixed `userSelect` reads empty there); read both and prefer whichever
    // is populated.
    const userSelectOf = (target: Element): string => {
      const cs = getComputedStyle(target)
      return cs.userSelect || cs.webkitUserSelect
    }

    expect(userSelectOf(el), 'user-select must be unset before any interaction').not.toBe('none')

    sep.dispatchEvent(ptr('pointerdown', 700))
    sep.dispatchEvent(ptr('pointermove', 640)) // the first live move arms :state(dragging)
    await el.updateComplete
    expect(userSelectOf(el), 'user-select must suspend to none once dragging is armed').toBe('none')

    sep.dispatchEvent(ptr('pointermove', 620)) // simulates the pointer sweeping across pane/canvas text
    await el.updateComplete
    expect(userSelectOf(el), 'user-select must still hold none mid-drag').toBe('none')

    sep.dispatchEvent(ptr('pointerup', 620))
    await el.updateComplete
    expect(userSelectOf(el), 'user-select must revert after release').not.toBe('none')
  })
})
