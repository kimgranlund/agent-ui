import { describe, it, expect, vi } from 'vitest'
import { UIElement } from '../dom/index.ts'
import { valueDrag } from './value-drag.ts'

// The value-drag gesture controller (range-element LLD-C4). pointer position along a mocked track
// rect → expected snapped value; step snapping; min > max degeneracy (pin to min, no drag);
// pointercancel / lostpointercapture ends the drag cleanly; disconnect removes the outer listener
// (auto-cleanup via connection AbortSignal); release() stops the controller idempotently.
//
// Named probes: drag-maps-position · drag-step-snap · drag-degenerate · drag-pointercancel ·
//               drag-lostpointercapture · drag-auto-cleanup · drag-released

// ── test helpers ──────────────────────────────────────────────────────────────────────────────────

// Track rect: x [100, 300], width 200. Chosen so position-to-ratio arithmetic is clean.
const RECT = {
  left: 100, right: 300, width: 200,
  top: 0, bottom: 40, height: 40,
  x: 100, y: 0,
  toJSON: (): Record<string, unknown> => ({}),
} as DOMRect

function stubTrack(track: HTMLElement): void {
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT)
  // jsdom does not implement pointer-capture; stub to avoid throws.
  track.setPointerCapture = vi.fn()
  track.releasePointerCapture = vi.fn()
  track.hasPointerCapture = vi.fn(() => false)
}

// Build a synthetic PointerEvent with clientX and an optional pointerId (default 1).
const ptr = (type: string, x: number, id = 1): PointerEvent =>
  new PointerEvent(type, { clientX: x, pointerId: id, bubbles: true, cancelable: true })

// ── test element ──────────────────────────────────────────────────────────────────────────────────

interface DragConfig { min?: number; max?: number; step?: number }

class DragEl extends UIElement {
  trackEl: HTMLElement = document.createElement('div')
  values: number[] = []
  cfg: DragConfig = {}
  releaseFn: (() => void) | null = null

  protected connected(): void {
    this.append(this.trackEl)
    stubTrack(this.trackEl)
    this.releaseFn = valueDrag(this, {
      track: () => this.trackEl,
      min: () => this.cfg.min ?? 0,
      max: () => this.cfg.max ?? 100,
      step: () => this.cfg.step ?? 0,
      onValue: (v) => this.values.push(v),
    })
  }
}
customElements.define('ui-vdrag', DragEl)

// ── probes ────────────────────────────────────────────────────────────────────────────────────────

describe('valueDrag — pointer→value gesture controller (LLD-C4)', () => {
  it('drag-maps-position: pointer at 0%/50%/100% of track maps to min/mid/max (continuous, no snap)', () => {
    const el = new DragEl()
    document.body.append(el)

    // pointerdown at left edge → ratio 0 → value 0
    el.trackEl.dispatchEvent(ptr('pointerdown', 100))
    expect(el.values.at(-1)).toBe(0)

    // move to midpoint: x=200, ratio = (200−100)/200 = 0.5, value = 50
    el.trackEl.dispatchEvent(ptr('pointermove', 200))
    expect(el.values.at(-1)).toBe(50)

    // move to right edge → ratio 1 → value 100
    el.trackEl.dispatchEvent(ptr('pointermove', 300))
    expect(el.values.at(-1)).toBe(100)

    el.trackEl.dispatchEvent(ptr('pointerup', 300))
    el.remove()
  })

  it('drag-step-snap: pointer position snaps to the nearest step multiple', () => {
    const el = new DragEl()
    el.cfg = { min: 0, max: 100, step: 10 }
    document.body.append(el)

    // x=160: ratio = 60/200 = 0.3, raw = 30 → Math.round(30/10)*10 = 30 (exact)
    el.trackEl.dispatchEvent(ptr('pointerdown', 160))
    expect(el.values.at(-1)).toBe(30)

    // x=145: ratio = 45/200 = 0.225, raw = 22.5 → Math.round(2.25)*10 = 20
    el.trackEl.dispatchEvent(ptr('pointermove', 145))
    expect(el.values.at(-1)).toBe(20)

    // x=255: ratio = 155/200 = 0.775, raw = 77.5 → Math.round(7.75)*10 = 80
    el.trackEl.dispatchEvent(ptr('pointermove', 255))
    expect(el.values.at(-1)).toBe(80)

    el.trackEl.dispatchEvent(ptr('pointerup', 255))
    el.remove()
  })

  it('drag-degenerate: min >= max → no drag starts, onValue is never called', () => {
    const el = new DragEl()
    el.cfg = { min: 50, max: 0 } // min > max — degenerate zero-length range
    document.body.append(el)

    el.trackEl.dispatchEvent(ptr('pointerdown', 200))
    el.trackEl.dispatchEvent(ptr('pointermove', 250))
    expect(el.values).toHaveLength(0) // no drag, no value emitted

    el.remove()
  })

  it('drag-pointercancel: cancel ends the drag; subsequent moves do not call onValue', () => {
    const el = new DragEl()
    document.body.append(el)

    el.trackEl.dispatchEvent(ptr('pointerdown', 150))
    const countAfterPress = el.values.length // one value from the press itself

    el.trackEl.dispatchEvent(ptr('pointercancel', 150)) // cancel — drag ends
    el.trackEl.dispatchEvent(ptr('pointermove', 250)) // must be ignored (drag AC aborted)
    expect(el.values).toHaveLength(countAfterPress) // no additional values after cancel

    el.remove()
  })

  it('drag-lostpointercapture: capture loss ends the drag cleanly (no stuck-drag state)', () => {
    const el = new DragEl()
    document.body.append(el)

    el.trackEl.dispatchEvent(ptr('pointerdown', 150))
    const countAfterPress = el.values.length

    el.trackEl.dispatchEvent(ptr('lostpointercapture', 150)) // capture released — drag ends
    el.trackEl.dispatchEvent(ptr('pointermove', 250)) // must be ignored
    expect(el.values).toHaveLength(countAfterPress)

    el.remove()
  })

  it('drag-auto-cleanup: disconnect removes the pointerdown listener (rides the connection AbortSignal)', () => {
    const el = new DragEl()
    document.body.append(el)
    el.remove() // disconnect → connection AbortSignal aborts → host.listen listener removed

    el.trackEl.dispatchEvent(ptr('pointerdown', 200)) // listener gone — nothing fires
    expect(el.values).toHaveLength(0)
  })

  it('drag-released: release() stops the controller while still connected (idempotent)', () => {
    const el = new DragEl()
    document.body.append(el)

    el.releaseFn?.() // early teardown
    el.releaseFn?.() // idempotent — safe to call twice (no throw)

    el.trackEl.dispatchEvent(ptr('pointerdown', 200)) // released guard returns early
    el.trackEl.dispatchEvent(ptr('pointermove', 250)) // no drag started
    expect(el.values).toHaveLength(0)

    el.remove()
  })
})
