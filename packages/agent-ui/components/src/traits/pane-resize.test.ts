import { describe, it, expect, vi } from 'vitest'
import { UIElement } from '../dom/index.ts'
import { paneResize } from './pane-resize.ts'
import type { PaneResizeHandle } from './pane-resize.ts'

// n1b — the pane-resize gesture controller (LLD-C2, SPEC-R3). The `value-drag.test.ts` harness shape
// (mock the track rect via `getBoundingClientRect`, stub `setPointerCapture`, synthetic PointerEvents),
// adapted for pane-resize's axis/RTL/multi-separator/delta contract instead of value-drag's 1-D value map.

// Host rect: x [0, 200], width 200 (horizontal) — the HOST is the track (the ui-slider precedent).
const RECT_H = { left: 0, right: 200, width: 200, top: 0, bottom: 40, height: 40, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
const RECT_V = { left: 0, right: 40, width: 40, top: 0, bottom: 200, height: 200, x: 0, y: 0, toJSON: () => ({}) } as DOMRect

const ptr = (type: string, coord: number, axis: 'horizontal' | 'vertical' = 'horizontal', id = 1): PointerEvent =>
  new PointerEvent(type, {
    ...(axis === 'horizontal' ? { clientX: coord } : { clientY: coord }),
    pointerId: id,
    bubbles: true,
    cancelable: true,
  })

interface ResizeCall { index: number; delta: number; commit: boolean }

class SplitProbe extends UIElement {
  seps: HTMLElement[] = []
  calls: ResizeCall[] = []
  axisValue: 'horizontal' | 'vertical' = 'horizontal'
  rtlValue = false
  handle: PaneResizeHandle | null = null

  connected(): void {
    for (let i = 0; i < 2; i++) {
      const sep = document.createElement('div')
      sep.setAttribute('data-separator', '')
      sep.setPointerCapture = vi.fn() // jsdom does not implement pointer capture
      sep.releasePointerCapture = vi.fn()
      this.append(sep)
      this.seps.push(sep)
    }
    // Plain reassignment (not vi.spyOn — a polymorphic `this` inside the class trips vi.spyOn's typing
    // against a base carrying #private fields); tests may re-assign `el.getBoundingClientRect` further.
    this.getBoundingClientRect = (): DOMRect => (this.axisValue === 'horizontal' ? RECT_H : RECT_V)
    this.handle = paneResize(this, {
      separators: () => this.seps,
      axis: () => this.axisValue,
      rtl: () => this.rtlValue,
      onResize: (index, delta, commit) => this.calls.push({ index, delta, commit }),
    })
  }
}
customElements.define('ui-split-probe', SplitProbe)

describe('paneResize — separator identification + axis mapping (LLD-C2)', () => {
  it('identifies the pressed separator by index (via [data-separator] + separators())', () => {
    const el = new SplitProbe()
    document.body.append(el)

    el.seps[1].dispatchEvent(ptr('pointermove', 50)) // no pointerdown yet — must be a no-op (no drag in flight)
    expect(el.calls).toHaveLength(0)

    el.seps[1].dispatchEvent(ptr('pointerdown', 100))
    el.seps[1].dispatchEvent(ptr('pointermove', 150)) // +50px / 200 extent = +0.25
    expect(el.calls.at(-1)).toMatchObject({ index: 1, commit: false })
    expect(el.calls.at(-1)?.delta).toBeCloseTo(0.25, 6)

    el.seps[1].dispatchEvent(ptr('pointerup', 150))
    el.remove()
  })

  it('a press that misses a [data-separator] element is ignored', () => {
    const el = new SplitProbe()
    document.body.append(el)
    el.dispatchEvent(ptr('pointerdown', 100)) // targets the host itself, not a separator
    el.dispatchEvent(ptr('pointermove', 150))
    expect(el.calls).toHaveLength(0)
    el.remove()
  })

  it('horizontal axis maps clientX to delta; vertical axis maps clientY', () => {
    const el = new SplitProbe()
    el.axisValue = 'vertical'
    document.body.append(el)

    el.seps[0].dispatchEvent(ptr('pointerdown', 40, 'vertical'))
    el.seps[0].dispatchEvent(ptr('pointermove', 90, 'vertical')) // +50 / 200 extent = +0.25
    expect(el.calls.at(-1)?.delta).toBeCloseTo(0.25, 6)
    // a clientX-only event (wrong axis) carries no clientY — must not be mistaken for a vertical move
    el.seps[0].dispatchEvent(ptr('pointerup', 90, 'vertical'))
    el.remove()
  })

  it('degenerate extent (rect.width/height <= 0) yields delta 0, never throws', () => {
    const el = new SplitProbe()
    document.body.append(el)
    el.getBoundingClientRect = (): DOMRect => ({ ...RECT_H, width: 0 }) as DOMRect

    el.seps[0].dispatchEvent(ptr('pointerdown', 0))
    el.seps[0].dispatchEvent(ptr('pointermove', 50))
    expect(el.calls.every((c) => c.delta === 0)).toBe(true)
    el.remove()
  })
})

describe('paneResize — RTL inverts the horizontal sense (SPEC-R3 AC3)', () => {
  it('the SAME physical drag produces an opposite-signed delta under rtl=true', () => {
    const ltr = new SplitProbe()
    document.body.append(ltr)
    ltr.seps[0].dispatchEvent(ptr('pointerdown', 0))
    ltr.seps[0].dispatchEvent(ptr('pointermove', 50))
    const ltrDelta = ltr.calls.at(-1)?.delta ?? 0
    ltr.remove()

    const rtl = new SplitProbe()
    rtl.rtlValue = true
    document.body.append(rtl)
    rtl.seps[0].dispatchEvent(ptr('pointerdown', 0))
    rtl.seps[0].dispatchEvent(ptr('pointermove', 50))
    const rtlDelta = rtl.calls.at(-1)?.delta ?? 0
    rtl.remove()

    expect(ltrDelta).toBeGreaterThan(0)
    expect(rtlDelta).toBeCloseTo(-ltrDelta, 10) // inverted, same magnitude
  })

  it('vertical axis is NOT affected by rtl (RTL only inverts the horizontal sense, SPEC-R3)', () => {
    const el = new SplitProbe()
    el.axisValue = 'vertical'
    el.rtlValue = true
    document.body.append(el)
    el.seps[0].dispatchEvent(ptr('pointerdown', 0, 'vertical'))
    el.seps[0].dispatchEvent(ptr('pointermove', 50, 'vertical'))
    expect(el.calls.at(-1)?.delta).toBeCloseTo(0.25, 6) // unchanged sign — not inverted
    el.remove()
  })
})

describe('paneResize — live vs commit (SPEC-R3 AC1)', () => {
  it('every pointermove is commit=false (live); pointerup/lostpointercapture/pointercancel is commit=true', () => {
    const el = new SplitProbe()
    document.body.append(el)
    el.seps[0].dispatchEvent(ptr('pointerdown', 0))
    el.seps[0].dispatchEvent(ptr('pointermove', 20))
    el.seps[0].dispatchEvent(ptr('pointermove', 40))
    expect(el.calls.filter((c) => !c.commit)).toHaveLength(2)
    el.seps[0].dispatchEvent(ptr('pointerup', 40))
    expect(el.calls.at(-1)?.commit).toBe(true)
    el.remove()
  })

  it('lostpointercapture commits (drag ends cleanly, no stuck-drag state)', () => {
    const el = new SplitProbe()
    document.body.append(el)
    el.seps[0].dispatchEvent(ptr('pointerdown', 0))
    el.seps[0].dispatchEvent(ptr('lostpointercapture', 30))
    expect(el.calls.at(-1)?.commit).toBe(true)
    const countAfterCommit = el.calls.length
    el.seps[0].dispatchEvent(ptr('pointermove', 60)) // drag already ended — must be ignored
    expect(el.calls).toHaveLength(countAfterCommit)
    el.remove()
  })

  it('pointercancel commits and ends the drag (subsequent moves ignored)', () => {
    const el = new SplitProbe()
    document.body.append(el)
    el.seps[0].dispatchEvent(ptr('pointerdown', 0))
    el.seps[0].dispatchEvent(ptr('pointercancel', 30))
    const countAfterCancel = el.calls.length
    el.seps[0].dispatchEvent(ptr('pointermove', 90))
    expect(el.calls).toHaveLength(countAfterCancel)
    el.remove()
  })
})

describe('paneResize — capture-continuity is STRUCTURAL (SPEC-R3 AC2)', () => {
  it('a pointermove dispatched AFTER a pointerleave, before pointerup, STILL resizes (no pointerleave binding)', () => {
    const el = new SplitProbe()
    document.body.append(el)
    el.seps[0].dispatchEvent(ptr('pointerdown', 0))
    el.seps[0].dispatchEvent(new PointerEvent('pointerleave', { bubbles: true })) // must be a complete no-op
    el.seps[0].dispatchEvent(ptr('pointermove', 60)) // the assertion that bites if leave ended the drag
    expect(el.calls.at(-1)).toMatchObject({ commit: false })
    expect(el.calls.at(-1)?.delta).toBeCloseTo(0.3, 6)
    el.seps[0].dispatchEvent(ptr('pointerup', 60))
    el.remove()
  })
})

describe('paneResize — secondary pointers are ignored', () => {
  it('a pointermove with a DIFFERENT pointerId than the pressed one is ignored', () => {
    const el = new SplitProbe()
    document.body.append(el)
    el.seps[0].dispatchEvent(ptr('pointerdown', 0, 'horizontal', 1))
    el.seps[0].dispatchEvent(ptr('pointermove', 100, 'horizontal', 2)) // secondary pointer — ignored
    expect(el.calls).toHaveLength(0)
    el.seps[0].dispatchEvent(ptr('pointerup', 0, 'horizontal', 1))
    el.remove()
  })
})

describe('paneResize — abortDrag() (SPEC-R2 M2, the mid-drag-mutation contract)', () => {
  it('abortDrag() ends an in-flight drag SILENTLY — no onResize call, subsequent moves ignored', () => {
    const el = new SplitProbe()
    document.body.append(el)
    el.seps[0].dispatchEvent(ptr('pointerdown', 0))
    el.seps[0].dispatchEvent(ptr('pointermove', 20))
    const countBeforeAbort = el.calls.length

    el.handle?.abortDrag()
    expect(el.calls).toHaveLength(countBeforeAbort) // silent — abortDrag itself calls onResize ZERO times

    el.seps[0].dispatchEvent(ptr('pointermove', 90)) // the stale drag's listeners are gone — ignored
    expect(el.calls).toHaveLength(countBeforeAbort)
    el.remove()
  })

  it('abortDrag() with no drag in flight is a no-op (never throws)', () => {
    const el = new SplitProbe()
    document.body.append(el)
    expect(() => el.handle?.abortDrag()).not.toThrow()
    el.remove()
  })

  it('a NEW drag after abortDrag() works normally (the handle is reusable)', () => {
    const el = new SplitProbe()
    document.body.append(el)
    el.seps[0].dispatchEvent(ptr('pointerdown', 0))
    el.handle?.abortDrag()

    el.seps[1].dispatchEvent(ptr('pointerdown', 0))
    el.seps[1].dispatchEvent(ptr('pointermove', 20))
    expect(el.calls.at(-1)).toMatchObject({ index: 1, commit: false })
    el.seps[1].dispatchEvent(ptr('pointerup', 20))
    el.remove()
  })
})

describe('paneResize — release() + auto-cleanup (zero residue)', () => {
  it('release() is idempotent and stops the outer pointerdown listener', () => {
    const el = new SplitProbe()
    document.body.append(el)
    el.handle?.release()
    expect(() => el.handle?.release()).not.toThrow()

    el.seps[0].dispatchEvent(ptr('pointerdown', 0))
    el.seps[0].dispatchEvent(ptr('pointermove', 50))
    expect(el.calls).toHaveLength(0)
    el.remove()
  })

  it('disconnect removes the outer pointerdown listener (rides the connection AbortSignal)', () => {
    const el = new SplitProbe()
    document.body.append(el)
    el.remove() // disconnect

    el.seps[0].dispatchEvent(ptr('pointerdown', 0))
    expect(el.calls).toHaveLength(0)
  })
})
