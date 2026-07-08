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
// Announce contract (ADR-0101): the trait announces every ACTUAL open-state transition — platform-,
// component-, or model-driven — `toggle` on a real show/hide, `close` alongside every real hide, fired
// after the host's own `open` prop has settled. Native ToggleEvent timing fidelity; see `open()`/`close()`.
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
  /** Show the popup (`showPopover()` + position); emits `toggle` on a real show (ADR-0101). No-op (no event) if already open. */
  open: () => void
  /** Hide the popup (`hidePopover()` + restore focus); emits `close`+`toggle` on a real hide (ADR-0101). No-op (no event) if already closed. */
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
  gap = 0,
): { top: number; left: number; placement: OverlayPlacement } {
  let [side, align] = splitPlacement(pref)
  const pH = popupRect.height
  const pW = popupRect.width

  // Flip: switch to the opposite side when the preferred side lacks space but the opposite has room.
  // The gap counts against the space needed, so a panel flips when the preferred side can't fit the
  // panel PLUS its anchor gap (viewport-collision-aware placement).
  const spaceFor = {
    bottom: vh - anchorRect.bottom,
    top: anchorRect.top,
    right: vw - anchorRect.right,
    left: anchorRect.left,
  } as const satisfies Record<Side, number>
  const needed = (side === 'bottom' || side === 'top' ? pH : pW) + gap
  if (spaceFor[side] < needed && spaceFor[FLIP_SIDE[side]] >= needed) {
    side = FLIP_SIDE[side]
  }

  // Compute the anchored offset for the resolved side + alignment. The gap separates the panel edge
  // from the anchor edge (a small breathing margin between the trigger and its dropdown).
  let top: number
  let left: number

  if (side === 'bottom') {
    top = anchorRect.bottom + gap
    left = align === 'start' ? anchorRect.left : anchorRect.right - pW
  } else if (side === 'top') {
    top = anchorRect.top - pH - gap
    left = align === 'start' ? anchorRect.left : anchorRect.right - pW
  } else if (side === 'right') {
    top = align === 'start' ? anchorRect.top : anchorRect.bottom - pH
    left = anchorRect.right + gap
  } else {
    // side === 'left'
    top = align === 'start' ? anchorRect.top : anchorRect.bottom - pH
    left = anchorRect.left - pW - gap
  }

  // Shift: clamp so no edge escapes the viewport (keeps the panel on-screen even after the gap offset).
  top = Math.max(0, Math.min(top, vh - pH))
  left = Math.max(0, Math.min(left, vw - pW))

  return { top, left, placement: `${side}-${align}` as OverlayPlacement }
}

/** Is the popup ACTUALLY in the top layer? `:popover-open` throws in engines that lack it — guard it. */
function matchesPopoverOpen(popup: HTMLElement): boolean {
  try {
    return popup.matches(':popover-open')
  } catch {
    return false // pre-`:popover-open` engine — fall back to the internal flag at the call site
  }
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
    // The anchor↔panel gap = 0.25rem, resolved against the root font-size so it scales with the theme
    // (a small breathing margin between a trigger and its dropdown; also counts toward flip collision).
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const gap = 0.25 * rootPx
    const { top, left, placement } = computePosition(
      prefPlacement,
      anchor.getBoundingClientRect(),
      popup.getBoundingClientRect(),
      window.innerWidth,
      window.innerHeight,
      gap,
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
    // Restore to the ANCHOR (the trigger) — the deterministic, DoD-expected target ("focus returns
    // to the trigger on close"). `document.activeElement` at open() time is unreliable: WebKit does
    // not focus a <button> on click (so it would be `body`), and it can be stale by the time the
    // scope-owned effect runs. The captured `opener` is only a fallback for a non-focusable anchor.
    const target =
      anchor && anchor.isConnected && typeof anchor.focus === 'function' ? anchor : opener
    opener = null
    if (target && target.isConnected && typeof target.focus === 'function') target.focus()
  }

  // ── The shared "real hide has happened" tail (ADR-0101) ─────────────────────────────────────
  //
  // Stops positioning, restores focus, and announces `close`+`toggle` — the settle + announce work
  // common to EVERY real hide, however it was driven. Pulled out of `close()` so the platform
  // light-dismiss path (below) can share it WITHOUT re-invoking `hidePopover()` on a popup the
  // platform already hid: calling `hidePopover()` a second time from inside its own native 'toggle'
  // handler is a genuine cross-engine race (observed on both Chromium + WebKit) — some engines still
  // consider the popup "showing" at that exact synchronous point, so the redundant call re-runs the
  // platform's OWN hide algorithm and fires a SECOND real ToggleEvent, double-announcing. `close`
  // fires first: any host-side listener that syncs its own `open` prop off `close` (the family
  // pattern — menu.ts / select.ts / popover.ts / combo-box.ts all
  // `this.listen(this, 'close', () => { this.open = false })`) runs synchronously inside this emit,
  // so the prop is ALREADY false by the time `toggle` fires next (the ordering invariant, ADR-0101
  // mechanic 3 — a renderer's two-way bind reads `el.open` at `toggle` listener time and gets the
  // settled value on every path, commit or light-dismiss alike).
  function announceHide(): void {
    stopPositioning()
    if (focusOnOpen) restoreFocus()
    host.emit('close')
    host.emit('toggle') // value:{prop:'open',event:'toggle'} two-way signal (ADR-0019)
  }

  // ── Platform → model: the Popover toggle listener (LLD-C2: light-dismiss) ──────────────────
  //
  // Rides the host's connection AbortSignal via `host.listen` — auto-removed on host disconnect.
  // Discriminates a platform/light-dismiss close (isOpen is still true — WE never called close())
  // from the platform's OWN ECHO of a close WE drove (isOpen was already set false before we called
  // `hidePopover()`, so the platform's resulting toggle event is a no-op here — ADR-0101: we announce
  // ourselves at the trait's transition points; the echo must not double-fire it).
  host.listen(popup, 'toggle', (event) => {
    if (cleaned) return
    // ToggleEvent.newState is 'open' | 'closed'; cast safely for cross-engine compatibility.
    const newState = (event as Event & { newState?: string }).newState
    if (newState === 'closed' && isOpen) {
      // The platform closed the popup itself (Escape / outside-click) — WE never called close(), and
      // the platform already hid it, so this path shares ONLY the settle+announce tail (ADR-0101
      // mechanic 1: "the light-dismiss path flows through the same [announce] points") — NOT a
      // redundant hidePopover() call (see announceHide()'s doc comment for why that would race).
      isOpen = false
      announceHide()
    }
  })

  // ── The imperative surface (OverlayHandle) ───────────────────────────────────────────────────
  //
  // ADR-0101 — the overlay trait announces EVERY actual open-state transition (platform-,
  // component-, or model-driven): `open()` emits `toggle` on a real show; `close()` emits
  // `close`+`toggle` on a real hide. Native ToggleEvent timing fidelity — ToggleEvents fire on
  // programmatic showPopover()/hidePopover() too, not only platform light-dismiss. The no-transition
  // early-returns below are the loop-breakers (mechanic 2: no transition ⇒ no event) — they also
  // guard the echo-toggle from double-announcing what open()/close() already announced themselves.

  function open(): void {
    if (cleaned || isOpen) return // double-open is a no-op (idempotent) — the loop-breaker
    if (focusOnOpen) opener = document.activeElement as HTMLElement | null
    // Set isOpen BEFORE showPopover() so the echo-toggle (newState:'open') is seen as already open
    // (no re-entry from the toggle listener above, which only acts on newState:'closed').
    isOpen = true
    popup.showPopover()
    startPositioning()
    if (focusOnOpen) moveFocusIn()
    host.emit('toggle') // the real show, announced AFTER the host's own open-prop write has settled
  }

  function close(): void {
    if (cleaned) return
    // Idempotent, but resilient to flag desync: hide whenever the popup is ACTUALLY in the top layer,
    // even if `isOpen` drifted false (a spurious/async platform toggle can desync the flag while the
    // panel stays open — observed on the commit→close path). Basing the guard on `:popover-open`
    // (with `isOpen` as the fallback for engines pre-`:popover-open`) makes model-driven close reliable.
    const actuallyOpen = isOpen || matchesPopoverOpen(popup)
    if (!actuallyOpen) return // no transition — the loop-breaker (ADR-0101 mechanic 2)
    // Set isOpen BEFORE hidePopover() so the echo-toggle (newState:'closed') sees isOpen=false and
    // skips re-entry (the toggle listener above only acts when isOpen is still true).
    isOpen = false
    try {
      popup.hidePopover() // throws InvalidStateError only if not currently showing — a harmless no-op then
    } catch (_) {
      // intentional: the popup was not in the top layer (already hidden) — nothing more to do
    }
    announceHide()
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
    // restoreFocus() is intentionally NOT called here: on host disconnect the anchor is also
    // leaving the document (it is a child of the same host). focus() on a detached element is a
    // no-op; the browser correctly moves focus to body, which is the right behaviour on disconnect.
    // This mirrors native <dialog>.close() co-removal: the trigger goes with the dialog.
  }

  // Register the cleanup as a scope-owned effect disposer so it fires automatically on host
  // disconnect (scope.dispose() → effect disposed → cleanup()). Also usable as an early-teardown
  // escape hatch via the returned handle's `cleanup` field.
  host.effect(() => cleanup)

  return { open, close, toggle, cleanup }
}
