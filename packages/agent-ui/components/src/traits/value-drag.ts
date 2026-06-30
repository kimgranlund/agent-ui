// value-drag.ts — the pointer→value gesture controller (range-element LLD-C4). Maps pointer events
// on a track element to a [min,max] numeric value snapped to `step`. Separable from UIRangeElement
// so the gesture logic is independently testable and reusable: ui-slider, ui-slider-multi, and any
// future range-style control all wire this controller.
//
// Protocol: pointerdown → setPointerCapture → pointermove (position along track → snapped value
// → onValue(v)) → pointerup / lostpointercapture / pointercancel (commit, end drag).
//
// The outer pointerdown listener rides host.listen (connection-signal-scoped, zero residue on
// disconnect). Per-drag listeners live on the track under a per-drag AbortController that is
// aborted on any drag-end event, bounding their lifetime to the drag itself.
//
// `traits → dom` is the one allowed cross-layer direction; the host type only.

import type { UIElement } from '../dom/index.ts'

export interface ValueDragOptions {
  /** Live accessor returning the track element (the draggable rail). Re-read on each pointerdown. */
  track: () => HTMLElement | null
  /** Live accessor returning the range minimum. */
  min: () => number
  /** Live accessor returning the range maximum. */
  max: () => number
  /** Live accessor returning the step (≤ 0 = continuous, no snap). */
  step: () => number
  /** Called with the pointer-mapped, step-snapped value during drag (for live `input` events). */
  onValue: (value: number) => void
}

/** Convert a position ratio [0,1] to a step-snapped value in [min, max]. */
function snapValue(ratio: number, min: number, max: number, step: number): number {
  if (min >= max) return min // degenerate — zero-length range
  const raw = min + Math.max(0, Math.min(1, ratio)) * (max - min)
  if (step <= 0) return raw // continuous — no snap
  const snapped = Math.round((raw - min) / step) * step + min
  return Math.max(min, Math.min(max, snapped)) // clamp: handles last-step undershoot
}

/** Map a clientX coordinate to a [0,1] ratio along the track rect. */
function ratioFromX(clientX: number, rect: DOMRect): number {
  if (rect.width <= 0) return 0
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
}

/**
 * Wire pointer→value gesture tracking on a `UIElement` host. Invoke from `connected()` so listeners
 * ride the connection AbortSignal (auto-removed on disconnect). Returns cleanup (idempotent).
 */
export function valueDrag(host: UIElement, opts: ValueDragOptions): () => void {
  let released = false

  // Listen on the host so this listener auto-removes on disconnect (host.listen = connection-signal-
  // scoped). A pointerdown on a track child bubbles up here; opts.track() is re-read on every press.
  host.listen(host, 'pointerdown', (event) => {
    if (released) return
    const track = opts.track()
    if (!track) return

    const pe = event as PointerEvent
    // Ignore presses that did not originate from within the track.
    if (!track.contains(pe.target as Node | null)) return

    const min = opts.min()
    const max = opts.max()
    // Degenerate range — zero-length, no drag (value is pinned to min by the caller).
    if (min >= max) return

    track.setPointerCapture(pe.pointerId)

    // Snapshot the rect on press; re-snapshot on each move (accounts for scroll / resize).
    let rect = track.getBoundingClientRect()
    opts.onValue(snapValue(ratioFromX(pe.clientX, rect), min, max, opts.step()))

    // Per-drag AbortController — aborted on any drag-end event, bounding all drag listeners.
    const dragAc = new AbortController()
    const endDrag = (): void => { dragAc.abort() }

    track.addEventListener('pointermove', (e) => {
      const me = e as PointerEvent
      if (me.pointerId !== pe.pointerId) return
      rect = track.getBoundingClientRect()
      opts.onValue(snapValue(ratioFromX(me.clientX, rect), opts.min(), opts.max(), opts.step()))
    }, { signal: dragAc.signal })

    track.addEventListener('pointerup', (e) => {
      if ((e as PointerEvent).pointerId !== pe.pointerId) return
      endDrag()
    }, { signal: dragAc.signal })

    track.addEventListener('lostpointercapture', (e) => {
      if ((e as PointerEvent).pointerId !== pe.pointerId) return
      endDrag()
    }, { signal: dragAc.signal })

    track.addEventListener('pointercancel', (e) => {
      if ((e as PointerEvent).pointerId !== pe.pointerId) return
      endDrag()
    }, { signal: dragAc.signal })
  })

  return () => { released = true }
}
