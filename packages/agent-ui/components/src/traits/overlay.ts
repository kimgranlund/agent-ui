// overlay.ts — the non-modal Overlay controller (overlay-controller LLD-C1..C4). Gives any host a
// top-layer, light-dismissable, anchored popup via the native Popover API (`popup.showPopover()` /
// `hidePopover()`) + a zero-dep JS positioning controller (measure-and-place; mechanism settled by
// the team-lead, support-verified — see overlay-controller.lld.md).
//
// CSS anchor-positioning is a PROGRESSIVE ENHANCEMENT (`@supports (anchor-name: --x)` / feature-detect)
// where available — NOT a v1 dual-path requirement; the JS controller is the reliable path.
//
// Boundary: a true MODAL (focus-trapped) stays on `ui-modal`'s `<dialog>` `showModal()` (ADR-0017).
// This controller is the NON-MODAL path (select popup, menu, tooltip, popover).
//
// `traits → dom` is the one allowed cross-layer direction; the host type only.

import type { UIElement } from '../dom/index.ts'

export type OverlayPlacement =
  | 'bottom-start'
  | 'bottom-end'
  | 'top-start'
  | 'top-end'
  | 'left-start'
  | 'left-end'
  | 'right-start'
  | 'right-end'

export interface OverlayOptions {
  /** The popup element (`[popover]` part — owned by the host control). */
  popup: HTMLElement
  /** The trigger element the popup anchors to. */
  anchor: HTMLElement
  /**
   * Initial placement preference. The JS controller flips/shifts to keep the popup in-viewport.
   * Default: `'bottom-start'`.
   */
  placement?: OverlayPlacement
  /**
   * `true` → `popover=auto` (light-dismiss via Escape + outside-click).
   * `false` → `popover=manual` (tooltip: dismiss on blur/leave). Default: `true`.
   */
  auto?: boolean
  /**
   * Move focus into the popup on open (menu/listbox pattern). `false` for tooltip (no focus move).
   * Focus is restored to `anchor` on close. Default: `true`.
   */
  focusOnOpen?: boolean
}

/** The object returned by `overlay()` — imperative control + cleanup. */
export interface OverlayHandle {
  /** Show the popup (`showPopover()` + position). */
  open: () => void
  /** Hide the popup (`hidePopover()` + restore focus). */
  close: () => void
  /** Toggle the popup. */
  toggle: () => void
  /** Remove all listeners/observers (idempotent); also called automatically on host disconnect. */
  cleanup: () => void
}

// ── Internal types for the side / align split ────────────────────────────────────────────────────

type Side = 'bottom' | 'top' | 'left' | 'right'
type Align = 'start' | 'end'

// Opposite side map (as const + literal union — the pattern for erasableSyntaxOnly, no enum).
const FLIP_SIDE = {
  bottom: 'top',
  top: 'bottom',
  left: 'right',
  right: 'left',
} as const satisfies Record<Side, Side>

function splitPlacement(p: OverlayPlacement): [Side, Align] {
  const i = p.indexOf('-')
  return [p.slice(0, i) as Side, p.slice(i + 1) as Align]
}

// ── Zero-dep JS positioning controller (LLD-C3) ─────────────────────────────────────────────────

/**
 * Measure the anchor + popup + viewport and compute the fixed `top`/`left` for the given `placement`.
 * Flips to the opposite side when the preferred side lacks space (flip). Clamps the result to the
 * viewport edges (shift). Returns the resolved placement for `data-placement`.
 */
export function computePosition(
  pref: OverlayPlacement,
  anchorRect: DOMRect,
  popupRect: DOMRect,
  vw: number,
  vh: number,
): { top: number; left: number; placement: OverlayPlacement } {
  let [side, align] = splitPlacement(pref)
  const pH = popupRect.height
  const pW = popupRect.width

  // Flip: switch to the opposite side when the preferred side lacks space but the opposite has room.
  const spaceFor = {
    bottom: vh - anchorRect.bottom,
    top: anchorRect.top,
    right: vw - anchorRect.right,
    left: anchorRect.left,
  } as const satisfies Record<Side, number>
  const needed = side === 'bottom' || side === 'top' ? pH : pW
  if (spaceFor[side] < needed && spaceFor[FLIP_SIDE[side]] >= needed) {
    side = FLIP_SIDE[side]
  }

  // Compute initial offset from the anchor for the resolved side + alignment.
  let top: number
  let left: number

  if (side === 'bottom') {
    top = anchorRect.bottom
    left = align === 'start' ? anchorRect.left : anchorRect.right - pW
  } else if (side === 'top') {
    top = anchorRect.top - pH
    left = align === 'start' ? anchorRect.left : anchorRect.right - pW
  } else if (side === 'right') {
    top = align === 'start' ? anchorRect.top : anchorRect.bottom - pH
    left = anchorRect.right
  } else {
    // side === 'left'
    top = align === 'start' ? anchorRect.top : anchorRect.bottom - pH
    left = anchorRect.left - pW
  }

  // Shift: clamp so no edge escapes the viewport.
  top = Math.max(0, Math.min(top, vh - pH))
  left = Math.max(0, Math.min(left, vw - pW))

  return { top, left, placement: `${side}-${align}` as OverlayPlacement }
}

// ── The controller ───────────────────────────────────────────────────────────────────────────────

/**
 * Wire a Popover API top-layer popup on a `UIElement` host. Invoke from `connected()` so listeners
 * ride the connection AbortSignal (auto-removed on disconnect). Returns an `OverlayHandle`; `cleanup`
 * is also called automatically on host disconnect via a scope-owned effect disposer.
 */
export function overlay(host: UIElement, opts: OverlayOptions): OverlayHandle {
  const { popup, anchor } = opts
  const prefPlacement = opts.placement ?? 'bottom-start'
  const auto = opts.auto ?? true
  const focusOnOpen = opts.focusOnOpen ?? true

  // Set the popover type on the popup part (done once — the part is created once, ADR-0017 pattern).
  popup.setAttribute('popover', auto ? 'auto' : 'manual')

  let isOpen = false
  let opener: HTMLElement | null = null
  // AbortController for positioning scroll/resize listeners (active only while the popup is open).
  let positionAc: AbortController | null = null
  let rafId: ReturnType<typeof requestAnimationFrame> | null = null
  let cleaned = false

  // ── Positioning (LLD-C3) ─────────────────────────────────────────────────────────────────────

  function position(): void {
    const { top, left, placement } = computePosition(
      prefPlacement,
      anchor.getBoundingClientRect(),
      popup.getBoundingClientRect(),
      window.innerWidth,
      window.innerHeight,
    )
    popup.style.position = 'fixed'
    popup.style.top = `${top}px`
    popup.style.left = `${left}px`
    popup.style.bottom = 'auto'
    popup.style.right = 'auto'
    popup.style.margin = '0'
    popup.setAttribute('data-placement', placement)
  }

  function schedulePosition(): void {
    if (rafId !== null) return // already scheduled — throttle
    rafId = requestAnimationFrame(() => {
      rafId = null
      position()
    })
  }

  function startPositioning(): void {
    positionAc?.abort() // guard: re-open without a close should not stack ACs
    positionAc = new AbortController()
    position() // immediate placement on open
    const signal = positionAc.signal
    window.addEventListener('scroll', schedulePosition, { signal, capture: true, passive: true })
    window.addEventListener('resize', schedulePosition, { signal, passive: true })
  }

  function stopPositioning(): void {
    positionAc?.abort()
    positionAc = null
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  // ── Focus policy (LLD-C4: non-modal) ────────────────────────────────────────────────────────

  function moveFocusIn(): void {
    // Focus the first keyboard-focusable descendant; fall back to the popup itself if none present.
    const focusable = popup.querySelector<HTMLElement>(
      'a[href],area[href],button:not([disabled]),details>summary,' +
        'input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    )
    ;(focusable ?? popup).focus()
  }

  function restoreFocus(): void {
    const el = opener
    opener = null
    if (el && el.isConnected && typeof el.focus === 'function') el.focus()
  }

  // ── Platform → model: the Popover toggle listener (LLD-C2: light-dismiss) ──────────────────
  //
  // Rides the host's connection AbortSignal via `host.listen` — auto-removed on host disconnect.
  // Discriminates a platform/light-dismiss close (isOpen is still true) from a close WE drove
  // (isOpen was set to false before we called `hidePopover()`).

  host.listen(popup, 'toggle', (event) => {
    if (cleaned) return
    // ToggleEvent.newState is 'open' | 'closed'; cast safely for cross-engine compatibility.
    const newState = (event as Event & { newState?: string }).newState
    if (newState === 'closed' && isOpen) {
      // The platform closed the popup (Escape / outside-click) while we thought it was open —
      // sync state, stop positioning, restore focus, and announce via the two-way bind (ADR-0019).
      isOpen = false
      stopPositioning()
      if (focusOnOpen) restoreFocus()
      host.emit('close')
      host.emit('toggle') // value:{prop:'open',event:'toggle'} two-way signal (ADR-0019)
    }
  })

  // ── The imperative surface (OverlayHandle) ───────────────────────────────────────────────────

  function open(): void {
    if (cleaned || isOpen) return // double-open is a no-op (idempotent)
    if (focusOnOpen) opener = document.activeElement as HTMLElement | null
    // Set isOpen BEFORE showPopover() so the echo-toggle (newState:'open') is seen as already open.
    isOpen = true
    popup.showPopover()
    startPositioning()
    if (focusOnOpen) moveFocusIn()
  }

  function close(): void {
    if (cleaned || !isOpen) return // double-close is a no-op (idempotent)
    // Set isOpen BEFORE hidePopover() so the echo-toggle (newState:'closed') sees isOpen=false and
    // does NOT re-emit close/toggle — only a platform-driven close emits (the discriminator pattern).
    isOpen = false
    popup.hidePopover()
    stopPositioning()
    if (focusOnOpen) restoreFocus()
  }

  function toggle(): void {
    if (isOpen) close()
    else open()
  }

  function cleanup(): void {
    if (cleaned) return
    cleaned = true
    if (isOpen) {
      isOpen = false
      try {
        popup.hidePopover() // may throw if the element is no longer a popover — guard it
      } catch (_) {
        // intentional no-op: the popup is gone or no longer popover-typed; focus restore below
      }
    }
    stopPositioning()
  }

  // Register the cleanup as a scope-owned effect disposer so it fires automatically on host
  // disconnect (scope.dispose() → effect disposed → cleanup()). Also usable as an early-teardown
  // escape hatch via the returned handle's `cleanup` field.
  host.effect(() => cleanup)

  return { open, close, toggle, cleanup }
}
