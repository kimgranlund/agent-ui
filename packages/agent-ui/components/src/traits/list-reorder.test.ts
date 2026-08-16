import { describe, it, expect, vi } from 'vitest'
import { UIElement } from '../dom/index.ts'
import { listReorder } from './list-reorder.ts'

// The reorder-mode trait (GH #952, extracted from GH #921's agent-admin roster mechanics) — pointer-capture
// drag with sibling hit-testing + a keyboard fallback sharing the SAME commit path. INSTRUMENT-BRIDGE (the
// area-drag.test.ts/value-drag.test.ts precedent): synthetic dispatchEvent + a stubbed setPointerCapture
// (real capture throws on a synthetic pointer); item rects are stubbed directly (this trait's own hit-test
// reads `getBoundingClientRect`, never `document.elementFromPoint` — see the file's own banner for why).
//
// Named probes: unarmed-no-op · drag-commits-on-move-past-midpoint · drag-cancel-no-commit ·
//               keyboard-arrow-commits · keyboard-fallback-blocked-at-ends · data-reorder-mode-reflects ·
//               data-dragging-marks-active-row · change-event-detail · auto-cleanup · released

function rowRect(top: number, height = 40): DOMRect {
  return {
    top, bottom: top + height, height, left: 0, right: 100, width: 100, x: 0, y: top,
    toJSON: (): Record<string, unknown> => ({}),
  } as DOMRect
}

function stubHandle(el: HTMLElement): void {
  el.setPointerCapture = vi.fn()
  el.releasePointerCapture = vi.fn()
  el.hasPointerCapture = vi.fn(() => false)
}

const ptr = (type: string, x: number, y: number, id = 1): PointerEvent =>
  new PointerEvent(type, { clientX: x, clientY: y, pointerId: id, bubbles: true, cancelable: true })

interface Commit { from: number; to: number }

class ListReorderEl extends UIElement {
  rows: HTMLElement[] = [] // build-time identities only — NEVER read for order; `items()` re-queries the DOM
  handles = new Map<HTMLElement, HTMLElement>()
  armedFlag = true
  commits: Commit[] = []
  changeEvents: Commit[] = []
  releaseFn: (() => void) | null = null

  // Live DOM order — the real contract every consumer (querySelectorAll, the #921 precedent) honours: a
  // mid-drag imperative move (`over.before(item)`) is only visible to the trait's own re-read if `items()`
  // reflects CURRENT DOM position, never a cached array.
  liveItems(): HTMLElement[] {
    return [...this.children] as HTMLElement[]
  }

  buildRows(count: number, rowHeight = 40): void {
    this.rows = []
    for (let i = 0; i < count; i++) {
      const row = document.createElement('div')
      const handle = document.createElement('div')
      row.append(handle)
      this.append(row)
      vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(rowRect(i * rowHeight, rowHeight))
      stubHandle(handle)
      this.rows.push(row)
      this.handles.set(row, handle)
    }
  }

  get handleEls(): HTMLElement[] {
    return this.rows.map((r) => this.handles.get(r)!)
  }

  protected connected(): void {
    this.releaseFn = listReorder(this, {
      items: () => this.liveItems(),
      armed: () => this.armedFlag,
      handle: (item) => this.handles.get(item) ?? null,
      onCommit: (from, to) => this.commits.push({ from, to }),
    })
    this.listen(this, 'change', (e) => this.changeEvents.push((e as CustomEvent<Commit>).detail))
  }
}
customElements.define('ui-list-reorder-test', ListReorderEl)

describe('listReorder — reorder-mode trait (GH #952)', () => {
  it('unarmed-no-op: pointerdown/keydown do nothing while armed() is false', () => {
    const el = new ListReorderEl()
    el.armedFlag = false
    document.body.append(el)
    el.buildRows(3)

    el.handleEls[0].dispatchEvent(ptr('pointerdown', 50, 10))
    el.handleEls[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(el.commits).toHaveLength(0)

    el.remove()
  })

  it('drag-commits-on-move-past-midpoint: dragging row 0 past row 2\'s midpoint commits (0,2)', () => {
    const el = new ListReorderEl()
    document.body.append(el)
    el.buildRows(3) // rows at y=[0,40), [40,80), [80,120)

    el.handleEls[0].dispatchEvent(ptr('pointerdown', 50, 10))
    // Move into row 2's lower half (y=100 > 80+20 midpoint) — row 0 moves after row 2.
    el.handleEls[0].dispatchEvent(ptr('pointermove', 50, 100))
    el.handleEls[0].dispatchEvent(ptr('pointerup', 50, 100))

    expect(el.commits).toEqual([{ from: 0, to: 2 }])
    expect(el.changeEvents).toEqual([{ from: 0, to: 2 }])
    // data-dragging is removed once the drag ends.
    expect(el.rows[0].hasAttribute('data-dragging')).toBe(false)
  })

  it('drag-cancel-no-commit: pointercancel ends the drag with no commit', () => {
    const el = new ListReorderEl()
    document.body.append(el)
    el.buildRows(3)

    el.handleEls[0].dispatchEvent(ptr('pointerdown', 50, 10))
    expect(el.rows[0].hasAttribute('data-dragging')).toBe(true)
    el.handleEls[0].dispatchEvent(ptr('pointercancel', 50, 10))

    expect(el.commits).toHaveLength(0)
    expect(el.rows[0].hasAttribute('data-dragging')).toBe(false)
  })

  it('keyboard-arrow-commits: ArrowDown on a handle swaps it with the next item and commits (0,1)', () => {
    const el = new ListReorderEl()
    document.body.append(el)
    el.buildRows(3)

    el.handleEls[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))

    expect(el.commits).toEqual([{ from: 0, to: 1 }])
    expect(el.changeEvents).toEqual([{ from: 0, to: 1 }])
    // The DOM order itself moved too (shared commit path with drag — a real re-render is the caller's job,
    // but this trait's own imperative move must already reflect the new order).
    expect([...el.children].indexOf(el.rows[0])).toBe(1)
  })

  it('keyboard-fallback-blocked-at-ends: ArrowUp on the first item is a no-op (no commit)', () => {
    const el = new ListReorderEl()
    document.body.append(el)
    el.buildRows(3)

    el.handleEls[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }))
    expect(el.commits).toHaveLength(0)
  })

  it('data-reorder-mode-reflects: the container carries data-reorder-mode while armed() is true', () => {
    const el = new ListReorderEl()
    document.body.append(el)
    el.buildRows(2)

    expect(el.hasAttribute('data-reorder-mode')).toBe(true)
  })

  it('auto-cleanup: disconnect removes the pointerdown/keydown listeners (rides the connection AbortSignal)', () => {
    const el = new ListReorderEl()
    document.body.append(el)
    el.buildRows(2)
    el.remove() // disconnect → connection AbortSignal aborts → host.listen listeners removed

    el.handleEls[0].dispatchEvent(ptr('pointerdown', 50, 10))
    expect(el.commits).toHaveLength(0)
  })

  it('released: release() stops the controller while still connected (idempotent)', () => {
    const el = new ListReorderEl()
    document.body.append(el)
    el.buildRows(2)

    el.releaseFn?.()
    el.releaseFn?.() // idempotent — safe to call twice

    el.handleEls[0].dispatchEvent(ptr('pointerdown', 50, 10))
    el.handleEls[0].dispatchEvent(ptr('pointermove', 50, 45))
    el.handleEls[0].dispatchEvent(ptr('pointerup', 50, 45))
    expect(el.commits).toHaveLength(0)

    el.remove()
  })
})
