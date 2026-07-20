// super-shell-resize-tabs.browser.test.ts — ui-super-shell cross-engine browser truth for SPEC-R6/R7
// (LLD-C1/C2, agent-admin-shell-rehost.lld.md §2-3, ADR-0154): the resizable inner pane, pane segments,
// and the tabs narrow arm. Drive mechanism for the drag leg: the SPEC-R3 INSTRUMENT-BRIDGE (ui-split's
// own split.browser.test.ts precedent) — synthetic `dispatchEvent(new PointerEvent(...))` with
// `setPointerCapture` stubbed to a no-op (a synthetic PointerEvent is not an active pointer).
import { describe, it, expect, afterEach } from 'vitest'
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

    sep.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await el.updateComplete
    expect(pane.getBoundingClientRect().width, 'ArrowRight shrinks it back (the mirrored key)').toBeLessThan(grown)

    sep.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    await el.updateComplete
    const paneMinPx = 162 // the token default (9 modules), no consumer override in this mount
    expect(pane.getBoundingClientRect().width).toBeLessThanOrEqual(paneMinPx + 1)
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
