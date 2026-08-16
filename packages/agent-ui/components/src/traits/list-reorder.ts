// list-reorder.ts — the reusable reorder-MODE trait (GH #952), extracted verbatim-in-spirit from GH #921's
// agent-admin roster mechanics (`site/pages/agent-admin-app.ts`'s `wireDrag`/`moveAgent`, PR #922). Wires an
// explicit reorder MODE — armed by the CONSUMER's own toggle affordance, this trait owns no UI for arming it
// — over an ordered set of item elements: pointer-capture drag with sibling hit-testing (the #921 ruling 4
// mechanics) PLUS a keyboard fallback (Up/Down while a handle is armed+focused) satisfying WCAG 2.2 SC 2.5.7
// Dragging Movements. Both paths converge on the SAME commit: `opts.onCommit(from, to)` followed by a
// `change` CustomEvent on the host (the seventh event-vocabulary member — ADR-0153's `open`/`close`/`toggle`/
// `action` precedent; `change` is ops plan §3.3's ruling for THIS trait's commit, recorded here since the
// ticket's own Scope/Open section left it as an open question).
//
// No HTML5 Drag-and-Drop API (#921's in-code ruling, repeated in this ticket's Acceptance) — pointer events
// only. `setPointerCapture` on the HANDLE keeps the gesture live past its own bounds, mirroring `value-drag`/
// `area-drag`/`pane-resize`'s shared lifetime discipline: an outer `host.listen` (connection-signal-scoped,
// zero residue on disconnect) arms the gesture; a per-drag `AbortController` bounds the move/up/cancel
// listeners to the drag itself.
//
// Hit-testing deliberately does NOT use `document.elementFromPoint` (the #921 page's own approach, taken
// because pointer capture pins the event target to the handle) — it instead re-reads `opts.items()` on every
// move and finds whichever item's own rect currently contains the pointer along the reorder axis. Same
// visual result (a real engine's coordinates are identical either way), but jsdom-testable without stubbing
// a DOM API this repo's unit gate cannot exercise for real (`component-testing`'s INSTRUMENT-BRIDGE note).
//
// CSS hooks (GH #921's `agent-admin-app.css` precedent, generalized): `data-reorder-mode` reflects
// `opts.armed()` onto `opts.container?.() ?? host`, re-applied inside a `host.effect` so a reactive `armed`
// accessor keeps it live without the consumer re-invoking this trait; `data-dragging` marks the ITEM
// currently being pointer-dragged, removed on drag-end.
//
// ARIA: this trait writes no `aria-*`/`role` anywhere — not on the host (the fleet's own
// ElementInternals-only law, CLAUDE.md "ARIA via ElementInternals, never host attributes") and not on items
// (unlike `selectionCommit`'s `aria-selected` reflect, reorder position carries no ARIA state of its own to
// publish — the accessible story is the labeled Up/Down affordance the CONSUMER's own handle carries, e.g. a
// real `aria-label="Move X up"` button). A host that wants to expose reorder-mode itself as ARIA (e.g.
// `aria-roledescription` on the list) reflects it through its OWN `internals` from `opts.armed()` — this
// trait cannot reach a host's protected `internals` (the same split `track-user-invalid.ts` documents) and
// does not attempt to.
//
// `traits → dom` is the one allowed cross-layer direction; the host type only.

import type { UIElement } from '../dom/index.ts'

export type ListReorderOrientation = 'vertical' | 'horizontal'

export interface ListReorderOptions {
  /** Live accessor for the ordered item elements. Re-read on every `pointerdown`/`keydown` AND on every
   *  `pointermove` (so a consumer that mutates the DOM order live, mirroring the #921 precedent, is honoured
   *  by the very next hit-test). */
  items: () => HTMLElement[]
  /** Live accessor: is reorder mode currently armed? Both the pointer-drag arm and the keyboard fallback are
   *  gated on this — an unarmed host emits neither `data-dragging` nor a commit. */
  armed: () => boolean
  /** Resolve an item's own drag/keyboard handle (the element `pointerdown`/`keydown` must land on to arm a
   *  gesture for THAT item — the #921 leading drag-handle cell, or the consumer's own Up/Down buttons).
   *  Return `null` to skip wiring that item (e.g. a shipped/protected row with no handle at all — the #921
   *  preset-protection precedent). Called with the item and its current index. */
  handle: (item: HTMLElement, index: number) => HTMLElement | null
  /** Called once per commit, from a drag release OR a keyboard move — `from`/`to` are indices into
   *  `opts.items()` as read at the START of the gesture (drag) or at the moment of the key press (keyboard).
   *  The caller owns persistence + re-render; this trait touches no application state and never assumes the
   *  item elements survive a commit (a consumer that fully rebuilds its list on every commit, the #921
   *  `refreshRoster` precedent, is exactly as well-supported as one that mutates in place). */
  onCommit: (from: number, to: number) => void
  /** Arrow-key axis for the keyboard fallback (ArrowUp/ArrowDown for `'vertical'`, ArrowLeft/ArrowRight for
   *  `'horizontal'`) AND the pointer hit-test axis. Default: `'vertical'`. */
  orientation?: ListReorderOrientation
  /** Live accessor for the element `data-reorder-mode` reflects onto. Default: `() => host`. */
  container?: () => HTMLElement | null
}

// The item among `list` whose own rect currently contains the pointer along `orientation`'s axis — the
// jsdom-testable stand-in for `document.elementFromPoint` (see the file banner). `null` when the pointer
// currently sits over no item at all (a gap, or past the list's own ends).
function itemAtPoint(
  list: readonly HTMLElement[],
  clientX: number,
  clientY: number,
  orientation: ListReorderOrientation,
): HTMLElement | null {
  for (const item of list) {
    const rect = item.getBoundingClientRect()
    const hit = orientation === 'vertical'
      ? clientY >= rect.top && clientY <= rect.bottom
      : clientX >= rect.left && clientX <= rect.right
    if (hit) return item
  }
  return null
}

// Whether a move past `overRect`'s own midpoint (along `orientation`) reads as "before" or "after" that item
// — the #921 `clientY < rect.top + rect.height / 2` ruling, generalized to either axis.
function isBeforeMidpoint(
  clientX: number,
  clientY: number,
  overRect: DOMRect,
  orientation: ListReorderOrientation,
): boolean {
  return orientation === 'vertical'
    ? clientY < overRect.top + overRect.height / 2
    : clientX < overRect.left + overRect.width / 2
}

/**
 * Wire pointer-drag + keyboard-fallback reorder on a `UIElement` host. Invoke from `connected()` so the
 * outer listeners ride the connection AbortSignal (auto-removed on disconnect) and `data-reorder-mode`'s
 * reflect effect is scope-owned. Returns cleanup (idempotent).
 */
export function listReorder(host: UIElement, opts: ListReorderOptions): () => void {
  const orientation = opts.orientation ?? 'vertical'
  let released = false

  // Reflect `data-reorder-mode` onto the container, live — a reactive `armed()` accessor (reading a signal)
  // keeps this current without the consumer re-invoking the trait; a plain accessor just applies once.
  host.effect(() => {
    const container = opts.container?.() ?? host
    container.toggleAttribute('data-reorder-mode', opts.armed())
  })

  // ── pointer drag ──────────────────────────────────────────────────────────────────────────────────
  host.listen(host, 'pointerdown', (event) => {
    if (released || !opts.armed()) return
    const pe = event as PointerEvent
    const targetEl = pe.target as Element | null
    if (!targetEl) return

    const list = opts.items()
    const item = list.find((it) => it.contains(targetEl))
    if (!item) return
    const fromIndex = list.indexOf(item)
    const handleEl = opts.handle(item, fromIndex)
    if (!handleEl || !handleEl.contains(targetEl)) return // the press must land on THIS item's own handle

    handleEl.setPointerCapture(pe.pointerId)
    item.setAttribute('data-dragging', '')

    // Per-drag AbortController — aborted on any drag-end event, bounding all drag listeners to the drag
    // itself (the value-drag/area-drag/pane-resize shared lifetime discipline).
    const dragAc = new AbortController()

    const onMove = (moveEvent: PointerEvent): void => {
      if (moveEvent.pointerId !== pe.pointerId) return
      const over = itemAtPoint(opts.items(), moveEvent.clientX, moveEvent.clientY, orientation)
      if (!over || over === item || !host.contains(over)) return
      const rect = over.getBoundingClientRect()
      if (isBeforeMidpoint(moveEvent.clientX, moveEvent.clientY, rect, orientation)) over.before(item)
      else over.after(item)
    }

    const commit = (upEvent: PointerEvent): void => {
      if (upEvent.pointerId !== pe.pointerId) return
      handleEl.releasePointerCapture(pe.pointerId)
      item.removeAttribute('data-dragging')
      dragAc.abort()
      const toIndex = opts.items().indexOf(item) // re-read: the live DOM moves above already reordered it
      if (toIndex !== -1 && toIndex !== fromIndex) {
        opts.onCommit(fromIndex, toIndex)
        host.emit('change', { from: fromIndex, to: toIndex })
      }
    }

    handleEl.addEventListener('pointermove', onMove, { signal: dragAc.signal })
    handleEl.addEventListener('pointerup', (e) => commit(e as PointerEvent), { signal: dragAc.signal })
    handleEl.addEventListener('lostpointercapture', (e) => commit(e as PointerEvent), { signal: dragAc.signal })
    handleEl.addEventListener('pointercancel', (e) => commit(e as PointerEvent), { signal: dragAc.signal })
  })

  // ── keyboard fallback (WCAG 2.2 SC 2.5.7) ────────────────────────────────────────────────────────
  // Shares the exact commit path above: an adjacent-index swap, `onCommit(from, to)`, then the `change`
  // event. Gated on `armed()` + the press landing on an item's OWN handle, same as the pointer path.
  host.listen(host, 'keydown', (event) => {
    if (released || !opts.armed()) return
    const e = event as KeyboardEvent
    const isNextKey = orientation === 'vertical' ? e.key === 'ArrowDown' : e.key === 'ArrowRight'
    const isPrevKey = orientation === 'vertical' ? e.key === 'ArrowUp' : e.key === 'ArrowLeft'
    if (!isNextKey && !isPrevKey) return

    const targetEl = e.target as Element | null
    if (!targetEl) return
    const list = opts.items()
    const item = list.find((it) => {
      const h = opts.handle(it, list.indexOf(it))
      return h !== null && h.contains(targetEl)
    })
    if (!item) return

    const from = list.indexOf(item)
    const to = isNextKey ? from + 1 : from - 1
    if (to < 0 || to >= list.length) return // already at an end — nothing to move past

    e.preventDefault()
    const neighbor = list[to]
    if (isPrevKey) item.parentElement?.insertBefore(item, neighbor)
    else neighbor.after(item)

    opts.onCommit(from, to)
    host.emit('change', { from, to })
  })

  return () => {
    released = true
  }
}
