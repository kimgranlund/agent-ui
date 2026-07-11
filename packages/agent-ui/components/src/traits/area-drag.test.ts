import { describe, it, expect, vi } from 'vitest'
import { UIElement } from '../dom/index.ts'
import { areaDrag } from './area-drag.ts'

// The area-drag gesture controller (color-picker LLD-C4) — the 2-axis sibling of value-drag.ts. Pointer
// position on a mocked 2D rect → expected (x,y) ratio pair, clamped [0,1]²; pointercancel/lostpointercapture
// ends the drag cleanly; disconnect removes the outer listener (auto-cleanup via connection AbortSignal);
// release() stops the controller idempotently. INSTRUMENT-BRIDGE (the value-drag.test.ts precedent): a
// synthetic dispatchEvent + a stubbed setPointerCapture (real capture throws on synthetic pointers).
//
// Named probes: area-maps-both-axes · area-clamps-out-of-bounds · area-pointercancel ·
//               area-lostpointercapture · area-auto-cleanup · area-released

// ── test helpers ──────────────────────────────────────────────────────────────────────────────────

// A 200×100 area at (100,50)..(300,150) — clean position-to-ratio arithmetic on both axes.
const RECT = {
  left: 100, right: 300, width: 200,
  top: 50, bottom: 150, height: 100,
  x: 100, y: 50,
  toJSON: (): Record<string, unknown> => ({}),
} as DOMRect

function stubArea(area: HTMLElement): void {
  vi.spyOn(area, 'getBoundingClientRect').mockReturnValue(RECT)
  // jsdom does not implement pointer-capture; stub to avoid throws (the value-drag.test.ts precedent).
  area.setPointerCapture = vi.fn()
  area.releasePointerCapture = vi.fn()
  area.hasPointerCapture = vi.fn(() => false)
}

// Build a synthetic PointerEvent with clientX/clientY and an optional pointerId (default 1).
const ptr = (type: string, x: number, y: number, id = 1): PointerEvent =>
  new PointerEvent(type, { clientX: x, clientY: y, pointerId: id, bubbles: true, cancelable: true })

// ── test element ──────────────────────────────────────────────────────────────────────────────────

class AreaDragEl extends UIElement {
  areaEl: HTMLElement = document.createElement('div')
  values: Array<{ x: number; y: number }> = []
  releaseFn: (() => void) | null = null

  protected connected(): void {
    this.append(this.areaEl)
    stubArea(this.areaEl)
    this.releaseFn = areaDrag(this, {
      area: () => this.areaEl,
      onValue: (x, y) => this.values.push({ x, y }),
    })
  }
}
customElements.define('ui-area-drag-test', AreaDragEl)

// ── probes ────────────────────────────────────────────────────────────────────────────────────────

describe('areaDrag — pointer→(x,y) gesture controller (color-picker LLD-C4)', () => {
  it('area-maps-both-axes: pointer at corners/center maps to the expected ratio pair', () => {
    const el = new AreaDragEl()
    document.body.append(el)

    // top-left corner → (0, 0)
    el.areaEl.dispatchEvent(ptr('pointerdown', 100, 50))
    expect(el.values.at(-1)).toEqual({ x: 0, y: 0 })

    // center → (0.5, 0.5)
    el.areaEl.dispatchEvent(ptr('pointermove', 200, 100))
    expect(el.values.at(-1)).toEqual({ x: 0.5, y: 0.5 })

    // bottom-right corner → (1, 1)
    el.areaEl.dispatchEvent(ptr('pointermove', 300, 150))
    expect(el.values.at(-1)).toEqual({ x: 1, y: 1 })

    // an asymmetric point: x=150 (ratio .25), y=125 (ratio .75) — proves the two axes are independent
    el.areaEl.dispatchEvent(ptr('pointermove', 150, 125))
    expect(el.values.at(-1)).toEqual({ x: 0.25, y: 0.75 })

    el.areaEl.dispatchEvent(ptr('pointerup', 150, 125))
    el.remove()
  })

  it('area-clamps-out-of-bounds: a point outside the rect clamps to [0,1] on both axes', () => {
    const el = new AreaDragEl()
    document.body.append(el)

    el.areaEl.dispatchEvent(ptr('pointerdown', -50, -50)) // past top-left → (0,0)
    expect(el.values.at(-1)).toEqual({ x: 0, y: 0 })

    el.areaEl.dispatchEvent(ptr('pointermove', 1000, 1000)) // past bottom-right → (1,1)
    expect(el.values.at(-1)).toEqual({ x: 1, y: 1 })

    el.areaEl.dispatchEvent(ptr('pointerup', 1000, 1000))
    el.remove()
  })

  it('area-pointercancel: cancel ends the drag; subsequent moves do not call onValue', () => {
    const el = new AreaDragEl()
    document.body.append(el)

    el.areaEl.dispatchEvent(ptr('pointerdown', 150, 100))
    const countAfterPress = el.values.length // one value from the press itself

    el.areaEl.dispatchEvent(ptr('pointercancel', 150, 100)) // cancel — drag ends
    el.areaEl.dispatchEvent(ptr('pointermove', 250, 125)) // must be ignored (drag AC aborted)
    expect(el.values).toHaveLength(countAfterPress) // no additional values after cancel

    el.remove()
  })

  it('area-lostpointercapture: capture loss ends the drag cleanly (no stuck-drag state)', () => {
    const el = new AreaDragEl()
    document.body.append(el)

    el.areaEl.dispatchEvent(ptr('pointerdown', 150, 100))
    const countAfterPress = el.values.length

    el.areaEl.dispatchEvent(ptr('lostpointercapture', 150, 100)) // capture released — drag ends
    el.areaEl.dispatchEvent(ptr('pointermove', 250, 125)) // must be ignored
    expect(el.values).toHaveLength(countAfterPress)

    el.remove()
  })

  it('area-auto-cleanup: disconnect removes the pointerdown listener (rides the connection AbortSignal)', () => {
    const el = new AreaDragEl()
    document.body.append(el)
    el.remove() // disconnect → connection AbortSignal aborts → host.listen listener removed

    el.areaEl.dispatchEvent(ptr('pointerdown', 200, 100)) // listener gone — nothing fires
    expect(el.values).toHaveLength(0)
  })

  it('area-released: release() stops the controller while still connected (idempotent)', () => {
    const el = new AreaDragEl()
    document.body.append(el)

    el.releaseFn?.() // early teardown
    el.releaseFn?.() // idempotent — safe to call twice (no throw)

    el.areaEl.dispatchEvent(ptr('pointerdown', 200, 100)) // released guard returns early
    el.areaEl.dispatchEvent(ptr('pointermove', 250, 125)) // no drag started
    expect(el.values).toHaveLength(0)

    el.remove()
  })
})
