// area-drag.ts — the pointer→(x,y) gesture controller (LLD-C4, color-picker.lld.md · ADR-0123 cl.4). The
// 2-axis sibling of value-drag.ts: maps pointer events on an area element's rect to a (ratioX, ratioY) pair
// ∈ [0,1]², clamped, x = left→right and y = top→bottom. `value-drag` stays UNCHANGED (reused verbatim by the
// composed `ui-slider` channels) — this is the honest new primitive the 2D pad needs, not an edit to it.
//
// Protocol — identical lifetime discipline to value-drag: pointerdown → setPointerCapture → pointermove (both
// ratios re-computed from a re-read rect → onValue(x, y)) → pointerup / lostpointercapture / pointercancel
// (drag end). The outer pointerdown listener rides host.listen (connection-signal-scoped, zero residue on
// disconnect); per-drag listeners live on the area under a per-drag AbortController aborted on any drag-end
// event, bounding their lifetime to the drag itself (the value-drag precedent, unchanged).
//
// `traits → dom` is the one allowed cross-layer direction; the host type only.

import type { UIElement } from '../dom/index.ts'

export interface AreaDragOptions {
  /** Live accessor returning the 2-axis area element. Re-read on each pointerdown. */
  area: () => HTMLElement | null
  /** Called with the pointer-mapped ratios (both ∈ [0,1], clamped) during drag — x = left→right, y = top→bottom. */
  onValue: (x: number, y: number) => void
}

/** Map a client point to a [0,1]² ratio pair along the area rect. */
function ratiosFromPoint(clientX: number, clientY: number, rect: DOMRect): { x: number; y: number } {
  const x = rect.width <= 0 ? 0 : Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  const y = rect.height <= 0 ? 0 : Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
  return { x, y }
}

/**
 * Wire pointer→(x,y) gesture tracking on a `UIElement` host. Invoke from `connected()` so listeners ride the
 * connection AbortSignal (auto-removed on disconnect). Returns cleanup (idempotent).
 */
export function areaDrag(host: UIElement, opts: AreaDragOptions): () => void {
  let released = false

  // Listen on the host so this listener auto-removes on disconnect (host.listen = connection-signal-scoped).
  // A pointerdown on an area child bubbles up here; opts.area() is re-read on every press.
  host.listen(host, 'pointerdown', (event) => {
    if (released) return
    const area = opts.area()
    if (!area) return

    const pe = event as PointerEvent
    // Ignore presses that did not originate from within the area.
    if (!area.contains(pe.target as Node | null)) return

    area.setPointerCapture(pe.pointerId)

    // Snapshot the rect on press; re-snapshot on each move (accounts for scroll / resize).
    let rect = area.getBoundingClientRect()
    const first = ratiosFromPoint(pe.clientX, pe.clientY, rect)
    opts.onValue(first.x, first.y)

    // Per-drag AbortController — aborted on any drag-end event, bounding all drag listeners.
    const dragAc = new AbortController()
    const endDrag = (): void => { dragAc.abort() }

    area.addEventListener('pointermove', (e) => {
      const me = e as PointerEvent
      if (me.pointerId !== pe.pointerId) return
      rect = area.getBoundingClientRect()
      const next = ratiosFromPoint(me.clientX, me.clientY, rect)
      opts.onValue(next.x, next.y)
    }, { signal: dragAc.signal })

    area.addEventListener('pointerup', (e) => {
      if ((e as PointerEvent).pointerId !== pe.pointerId) return
      endDrag()
    }, { signal: dragAc.signal })

    area.addEventListener('lostpointercapture', (e) => {
      if ((e as PointerEvent).pointerId !== pe.pointerId) return
      endDrag()
    }, { signal: dragAc.signal })

    area.addEventListener('pointercancel', (e) => {
      if ((e as PointerEvent).pointerId !== pe.pointerId) return
      endDrag()
    }, { signal: dragAc.signal })
  })

  return () => { released = true }
}
