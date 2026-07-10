// pane-resize.ts — the axis+RTL-aware N-separator drag gesture controller (app-surfaces-m4.lld.md LLD-C2,
// SPEC-R3/R4). A NEW, sibling trait to `value-drag.ts` — DELIBERATELY not a generalization of it (LLD §2.2
// fork F2): `value-drag` is 1-D/horizontal/LTR-only (one track → one [min,max] value); `ui-split` needs an
// axis-aware (`clientX`/`clientY`) + RTL-aware (inverted horizontal sense) + per-separator DELTA (not an
// absolute value) mapping. Widening `value-drag`'s contract would risk the shipped `ui-slider`/
// `ui-slider-multi` (the test-the-whole-shape law); this sibling trait is zero-risk and independently
// testable. Mirrors `value-drag`'s host-scoped-pointerdown + per-drag-AbortController lifetime shape.
//
// Protocol (LLD §2.2): `pointerdown` on a `[data-separator]` element → identify its index (`indexOf` in the
// live `separators()` list — the slider-multi nearer-handle-gate precedent, here a straight lookup since
// each separator owns exactly one drag) → `setPointerCapture` → `pointermove` computes `deltaRatio` along
// `axis()` (RTL-inverted for horizontal) SINCE THE PRESS POINT, against the HOST's own live extent (the
// host IS the track — the `ui-slider` precedent, `track: () => this`) → `onResize(i, delta, false)` (live)
// → `pointerup`/`lostpointercapture`/`pointercancel` → `onResize(i, delta, true)` (commit).
//
// Mid-drag mutation (SPEC-R2 M2): the returned handle exposes a DISTINCT `abortDrag()` — not the release
// fn doubling as it (the review nit this LLD names) — so the element's MutationObserver can end an
// in-flight drag on a pane-count change WITHOUT emitting a resize against the now-stale separator index.
// `abortDrag()` is a silent stop (no `onResize` call): the caller's ratios are left exactly where the last
// LIVE update put them — "settle at pre-mutation ratios" (LLD §2.2) falls out for free, since the element's
// re-derive logic runs against whatever ratios currently stand, untouched by the aborted drag.
//
// Test-drive (SPEC-R3 INSTRUMENT-BRIDGE): the browser gate cannot exercise REAL `setPointerCapture` — a
// synthetic PointerEvent is not an active pointer (Playwright/WebKit throws NotFoundError) — so every drag
// is driven via synthetic `dispatchEvent(new PointerEvent(...))` with `setPointerCapture` stubbed to a
// no-op (the `slider.browser.test.ts` `stubCapture` precedent). Capture-continuity (a `pointermove` after a
// `pointerleave`, before `pointerup`, still resizes) is proven STRUCTURALLY: the move/up listeners live on
// the per-drag `AbortController`, bound to the SEPARATOR element (not the connection scope), so they never
// unbind on hover/leave — only on `pointerup`/`pointercancel`/`abortDrag()`.
//
// `traits → dom` is the one allowed cross-layer direction; the host type only.

import type { UIElement } from '../dom/index.ts'

export interface PaneResizeOptions {
  /** Live accessor for the CURRENT separator elements, in order (re-read on every `pointerdown`). */
  separators: () => HTMLElement[]
  /** Live accessor for the resize axis — selects `clientX` (horizontal) vs `clientY` (vertical). */
  axis: () => 'horizontal' | 'vertical'
  /** Live accessor for whether the horizontal sense is right-to-left (invert the delta). */
  rtl: () => boolean
  /** Called with the separator's index and the ratio delta since press. `commit=false` on each live
   *  pointermove (drives an `input`); `commit=true` on drag-end (drives a `change`). */
  onResize: (separatorIndex: number, deltaRatio: number, commit: boolean) => void
}

export interface PaneResizeHandle {
  /** Idempotent: stop the trait entirely (removes the outer pointerdown listener's effect + ends any
   *  in-flight drag without committing). Call from `disconnected()`. */
  release: () => void
  /** End any IN-FLIGHT drag without emitting a resize (SPEC-R2 M2) — a no-op when no drag is active. The
   *  element's MutationObserver calls this FIRST on a mid-drag pane-count change, before re-deriving. */
  abortDrag: () => void
}

/**
 * Wire the N-separator pointer-drag gesture on a `UIElement` host (the host IS the track — its own
 * `getBoundingClientRect()` supplies the axis extent, the `ui-slider` precedent). Invoke from `connected()`
 * so the outer listener rides the connection AbortSignal (auto-removed on disconnect via `host.listen`).
 */
export function paneResize(host: UIElement, opts: PaneResizeOptions): PaneResizeHandle {
  let released = false
  let dragAc: AbortController | null = null

  const endDrag = (): void => {
    dragAc?.abort()
    dragAc = null
  }

  host.listen(host, 'pointerdown', (event) => {
    if (released) return
    const pe = event as PointerEvent
    const originEl = (pe.target as Element | null)?.closest('[data-separator]') as HTMLElement | null
    if (!originEl) return
    const separators = opts.separators()
    const index = separators.indexOf(originEl)
    if (index === -1) return

    originEl.setPointerCapture(pe.pointerId)

    const axis = opts.axis()
    const rtl = opts.rtl()
    const startCoord = axis === 'horizontal' ? pe.clientX : pe.clientY

    // Ratio delta since the press point, against the HOST's live extent — re-measured on every call
    // (accounts for scroll/resize mid-drag, the value-drag `re-snapshot the rect on each move` precedent).
    const deltaFor = (clientCoord: number): number => {
      const rect = host.getBoundingClientRect()
      const extent = axis === 'horizontal' ? rect.width : rect.height
      if (extent <= 0) return 0
      let px = clientCoord - startCoord
      if (axis === 'horizontal' && rtl) px = -px // RTL inverts the horizontal sense (SPEC-R3 AC3)
      return px / extent
    }

    const localAc = new AbortController()
    dragAc = localAc

    originEl.addEventListener('pointermove', (e) => {
      const me = e as PointerEvent
      if (me.pointerId !== pe.pointerId) return
      const coord = axis === 'horizontal' ? me.clientX : me.clientY
      opts.onResize(index, deltaFor(coord), false)
    }, { signal: localAc.signal })

    const commitEnd = (e: Event): void => {
      const me = e as PointerEvent
      if (me.pointerId !== pe.pointerId) return
      const coord = axis === 'horizontal' ? me.clientX : me.clientY
      opts.onResize(index, deltaFor(coord), true)
      endDrag()
    }
    // Deliberately NO `pointerleave` listener — binding drag-end to hover/leave is exactly the bug SPEC-R3
    // AC2's capture-continuity assertion bites on. The drag ends ONLY on an explicit end signal or abort.
    originEl.addEventListener('pointerup', commitEnd, { signal: localAc.signal })
    originEl.addEventListener('lostpointercapture', commitEnd, { signal: localAc.signal })
    originEl.addEventListener('pointercancel', commitEnd, { signal: localAc.signal })
  })

  return {
    release: () => {
      released = true
      endDrag()
    },
    abortDrag: () => {
      endDrag() // silent — no onResize call, so the caller's ratios stay at their last LIVE value
    },
  }
}
