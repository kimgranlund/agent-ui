// overlay.ts — the non-modal Overlay controller (overlay-controller LLD-C1..C4). Gives any host a
// top-layer, light-dismissable, anchored popup via the native Popover API (`popup.showPopover()` /
// `hidePopover()`) + a positioning controller with TWO paths (GH #951): the zero-dep JS path
// (measure-and-place; mechanism settled by the team-lead, support-verified — see
// overlay-controller.lld.md) and, feature-detected at runtime (`CSS.supports('anchor-name: --x')`),
// a CSS Anchor Positioning enhanced path — `anchor-name`/`position-anchor`/`anchor()` + a shared,
// lazily-injected `@position-try` stylesheet (one rule per `OverlayPlacement`, all eight) with a
// fallback candidate LIST per preferred placement (flip-side, flip-align, flip-both — the
// `FLIP-CANDIDATES` comment at the `overlay()` setup site has why a single side-flip, the JS path's
// own tactic, isn't enough here) — never the browser's OWN generic `flip-block`/`flip-inline`
// try-tactic keywords, which this file does not use at all. The enhanced path registers NO
// scroll/resize listeners — that is its entire point, positioning becomes compositor-driven.
// Non-supporting engines get the JS path, byte-identical to before this ticket.
//
// Two recorded divergences (GH #951 Scope/Open — shipped where faithful, never silently approximated):
// (1) `data-placement` on the enhanced path is resolved via a single SYNCHRONOUS geometry read inside
// `open()` (matching the JS path's own synchronous `position()` write — every shipped consumer reads
// this attribute right after `open()`), but it is NOT kept live across an in-session scroll-driven
// re-flip the way the JS path's `schedulePosition()` re-derives it — no listener-free platform signal
// exists for "which named `@position-try` option is active" (verified: `@position-try` rules do not
// honor custom-property declarations, so a `transitionrun`-based observer does not apply here; see
// `applyAnchoredPlacement()`'s doc comment for the full trace).
//
// (2) Shift/clamp parity. The JS path's `computePosition()` continuously clamps into the viewport
// (`Math.max(0, Math.min(...))`) using the popup's OWN measured size. A first draft of this ticket
// believed `max-inline-size`/`max-block-size` could reconstruct the missing (far-edge) half of that
// clamp via `calc(100vw - anchor(left))`-shaped arithmetic — measured WRONG against this repo's real
// engines: `anchor()` is valid ONLY inside inset properties (top/right/bottom/left and their logical
// equivalents), never inside a SIZING property; the declaration silently fails at compute time and
// the property falls through to whatever unrelated rule the cascade supplies next (a real trap — it
// LOOKED like it was capping the size, because a pre-existing, unrelated `max-inline-size` rule from
// menu.css happened to already be there). `insetDeclarationsFor()`'s `max(0px, …)` inset clamp still
// stands (self-size-independent, derived purely from the anchor's own resolved position — it fixed
// the real GH #134 menu-overflow regression). What plugs the remaining gap is NOT a size cap at all:
// `position-try-fallbacks` carries the FULL 2×2 candidate set (flip-side, flip-align, flip-both), not
// only the JS path's single side-flip, so the CSS spec's own mandated "least-overflow" selection has
// a real chance of landing on a placement that fits within the viewport on ALL four edges (this is
// what fixed the second live regression, `tabs.browser.test.ts`'s overflow-menu commit relay — see
// `applyAnchoredPlacement()`'s doc comment for the full account). A popup that STILL doesn't fit any
// of the four candidates renders at whichever one overflows least — a discrete pick between four
// named placements, not JS's continuous edge-clamp; that residual case stays the recorded divergence.
//
// GH #1339 (the FormPopover catalog panel rendering detached from its trigger): the enhanced path
// carries an IACVT guard. An OPEN popup whose `anchor()` references fail to resolve — the anchor sat
// in a `display:none` subtree at open time (the catalog page builds most cards inside hidden tab
// panels), or the engine missed re-resolution after a hidden→shown / rewire transition — takes every
// inset back to `auto` at computed-value time, and a `position:fixed` popup with all-`auto` insets
// renders at its STATIC position: in-flow beside its trigger, visually detached. A second measured
// failure state renders the same picture: a placement resolved while the anchor sat past a viewport
// edge bakes its `max(0px, …)` pin into the base layout, and a later INNER-scroller move translates
// that stale pin without ever re-running the anchor-positioning layout. The guard verifies
// (synchronously post-open, at each popup box transition via a ResizeObserver — the reveal signal —
// and at each anchor visibility crossing via an IntersectionObserver — the scroll-into-view signal;
// still zero scroll/resize listeners) that a RENDERED open popup sits where the CURRENT anchor rect
// demands, and otherwise demotes that one open session to the JS path. See
// `verifyAnchoredPlacement()`.
//
// Lineage (reconciled 2026-08-19): PR #1359 landed an earlier, narrower GH #1339 guard — a pure
// `computedInsetsAllAuto()` detector run once post-open, demoting the cycle when all four computed
// insets read the literal `auto`. That signature fires ONLY while the popup itself has NO box
// (CSSOM returns used px values for any positioned element with a box — #1359's own measurement),
// i.e. it was a "popup boxless at open" detector; it could not see a boxless ANCHOR (its recorded
// residual: `position()` reading a zero anchor rect, parking the popup at ~(0,4) with no reveal
// hook to recover) nor the stale-pin state above. The verify guard SUPERSEDES it as the ONE guard
// path: a boxless popup is deliberately DEFERRED, not demoted (nothing renders, so nothing is
// misplaced — an eager demotion would forfeit the enhanced path even on engines that resolve
// correctly at reveal), then judged the moment it gains a box against the anchor's CURRENT rect;
// the demoted session's per-frame anchor tracker closes the boxless-anchor residual.
// `computedInsetsAllAuto` and its jsdom probes were retired with it — one guard, never two
// competing ones. #1359's fixture shape lives on in overlay.browser.test.ts section [7], re-pinned
// under this guard's semantics.
//
// Boundary: a true MODAL (focus-trapped) stays on `ui-modal`'s `<dialog>` `showModal()` (ADR-0017).
// This controller is the NON-MODAL path (select popup, menu, tooltip, popover).
//
// Announce contract (ADR-0101): the trait announces every ACTUAL open-state transition — platform-,
// component-, or model-driven — `toggle` on a real show/hide, `close` alongside every real hide, fired
// after the host's own `open` prop has settled. Native ToggleEvent timing fidelity; see `open()`/`close()`.
// Unchanged by GH #951 — positioning-path choice is fully orthogonal to the announce contract.
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

/**
 * Options for an IMPERATIVE `close()` call (GH #586 critic fold MAJOR-2). Additive — every existing
 * caller passes none and gets today's behaviour unchanged.
 */
export interface OverlayCloseOptions {
  /**
   * `false` — skip the default "restore focus to the trigger" tail for THIS close only. For a
   * composing consumer whose OWN commit-relay listener already moved focus somewhere meaningful
   * during the SAME synchronous turn (the `ui-menu` → `ui-tabs` promoted-tab relay is the shipped
   * precedent) and does not want the overlay's default restore stealing it back a microtask later.
   * The platform light-dismiss path (Escape / outside-click) NEVER reads this — it always restores
   * focus to the trigger, the contract every other overlay consumer relies on. Default `true`
   * (today's behaviour).
   */
  restoreFocus?: boolean
}

/** The object returned by `overlay()` — imperative control + cleanup. */
export interface OverlayHandle {
  /** Show the popup (`showPopover()` + position); emits `toggle` on a real show (ADR-0101). No-op (no event) if already open. */
  open: () => void
  /** Hide the popup (`hidePopover()` + restore focus); emits `close`+`toggle` on a real hide (ADR-0101). No-op (no event) if already closed. `opts.restoreFocus:false` skips the focus restore for this one call (MAJOR-2, GH #586) — the platform light-dismiss path is unaffected. */
  close: (opts?: OverlayCloseOptions) => void
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

// ── Enhanced path: CSS Anchor Positioning (GH #951) ─────────────────────────────────────────────
//
// Feature-detected ONCE at module load — every `overlay()` instance in the process shares this one
// verdict (a runtime engine doesn't change mid-session). Non-supporting engines never touch anything
// below; `computePosition()` above stays their entire (byte-identical) positioning story.
const supportsAnchorPositioning =
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('anchor-name: --ui-overlay-probe')

let anchorNameSeq = 0
/** A fresh `anchor-name` dashed-ident per `overlay()` instance — multiple anchored popups on one page
 * must not collide. `anchor()` used with no explicit anchor argument inside a `@position-try` rule
 * always resolves against whichever name the QUERYING element's OWN `position-anchor` points to, so
 * the shared stylesheet below never needs one rule set per instance despite this per-instance name. */
function nextAnchorName(): string {
  anchorNameSeq += 1
  return `--ui-overlay-anchor-${anchorNameSeq}`
}

/** The 4 physical inset declarations for a resolved side+align — the SINGLE generator shared by the
 * static `@position-try` rule text below AND the per-instance base (preferred) placement applied
 * inline, so the two representations can never drift apart. The 0.25rem gap is a LITERAL, not a
 * computed value: CSS `rem` already tracks the root font-size identically to the JS path's own
 * `parseFloat(getComputedStyle(root).fontSize)` derivation — same design token, two mechanisms.
 *
 * Every declared value is wrapped in `max(0px, …)` — a self-size-independent RECONSTRUCTION of the
 * LOWER half of the JS path's continuous `Math.max(0, Math.min(...))` clamp (`computePosition`'s
 * shift step), derived purely from the anchor's own resolved position — never the popup's own size.
 * `top`/`left` measure directly from the SAME origin as the coordinate itself, so `max(0px, …)`
 * reproduces JS's LOWER bound; `right`/`bottom` measure from the OPPOSITE edge, so the identical
 * wrapper instead reproduces JS's UPPER bound on THAT far edge — but only the one the anchor itself
 * governs. GH #134 (menu-overflow) is the concrete regression this fixes on the enhanced path: an
 * anchor whose own right edge already sits past the viewport would otherwise carry that overflow
 * straight onto the popup via a bare `anchor(right)`.
 *
 * A first draft of this file ALSO tried a `max-inline-size`/`max-block-size` cap here, to close the
 * popup's OWN `auto`-sized far edge (the half this function cannot reach) via `calc(100vw −
 * anchor(left))`-shaped arithmetic — measured WRONG against real engines: `anchor()` is valid ONLY
 * inside inset properties, never a sizing property; the declaration silently fails at compute time,
 * masked by whatever unrelated rule the cascade supplies next. `overlay.ts`'s header comment (2) has
 * the full account, including how `position-try-fallbacks`'s FULLER candidate list — not a size cap
 * — is what actually plugs the residual gap. */
function insetDeclarationsFor(side: Side, align: Align): Record<'top' | 'right' | 'bottom' | 'left', string> {
  const gap = '0.25rem'
  const decl: Record<'top' | 'right' | 'bottom' | 'left', string> = { top: 'auto', right: 'auto', bottom: 'auto', left: 'auto' }
  if (side === 'bottom') decl.top = `max(0px, calc(anchor(bottom) + ${gap}))`
  else if (side === 'top') decl.bottom = `max(0px, calc(anchor(top) + ${gap}))`
  else if (side === 'right') decl.left = `max(0px, calc(anchor(right) + ${gap}))`
  else decl.right = `max(0px, calc(anchor(left) + ${gap}))` // side === 'left'

  if (side === 'bottom' || side === 'top') {
    if (align === 'start') decl.left = 'max(0px, anchor(left))'
    else decl.right = 'max(0px, anchor(right))'
  } else {
    if (align === 'start') decl.top = 'max(0px, anchor(top))'
    else decl.bottom = 'max(0px, anchor(bottom))'
  }
  return decl
}

const ALL_PLACEMENTS = [
  'bottom-start', 'bottom-end', 'top-start', 'top-end',
  'left-start', 'left-end', 'right-start', 'right-end',
] as const satisfies readonly OverlayPlacement[]

/** The `@position-try` rule name for a given placement — every one of the 8 possible placements is
 * registered once, since any placement can be the FLIP TARGET of its opposite-side preferred pick. */
function positionTryName(placement: OverlayPlacement): string {
  return `--ui-overlay-try-${placement}`
}

function buildAnchorTryStylesheet(): string {
  return ALL_PLACEMENTS.map((p) => {
    const [side, align] = splitPlacement(p)
    const d = insetDeclarationsFor(side, align)
    return `@position-try ${positionTryName(p)} { top: ${d.top}; right: ${d.right}; bottom: ${d.bottom}; left: ${d.left}; margin: 0; }`
  }).join('\n')
}

/** The align opposite — `start`↔`end`. Paired with `FLIP_SIDE` to build the fuller candidate set
 * below (flip-side, flip-align, flip-both) — see the FLIP-CANDIDATES comment at the `overlay()`
 * setup site for why a single side-flip (the JS path's own tactic) isn't enough on the enhanced
 * path. */
const FLIP_ALIGN = { start: 'end', end: 'start' } as const satisfies Record<Align, Align>

const ANCHOR_TRY_STYLE_ID = 'ui-overlay-anchor-tries'

/** Lazily inject the shared `@position-try` stylesheet into `document.head` — once per document (the
 * `id` marker guards re-injection across multiple `overlay()` instances, or a re-run inside one test's
 * shared DOM). No-ops outside a document AND outside a document that actually HAS a `<head>` (a bare
 * `DOMImplementation` document can lack one) — the earlier `anchor.ownerDocument` guard at the call
 * site only proves a document exists, not that it carries a head; this is the guard that makes that
 * defensive claim actually true. */
function ensureAnchorTryStylesheet(doc: Document): void {
  if (!doc.head) return
  if (doc.getElementById(ANCHOR_TRY_STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = ANCHOR_TRY_STYLE_ID
  style.textContent = buildAnchorTryStylesheet()
  doc.head.appendChild(style)
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
  const [prefSide, prefAlign] = splitPlacement(prefPlacement)

  // The enhanced path's fallback candidate list (see the FLIP-CANDIDATES comment below for why all
  // three flips) — computed up front so the GH #1339 IACVT fallback can neutralize it for one open
  // session and `startAnchoredPositioning()` can restore it verbatim on the next.
  const flipSidePlacement = `${FLIP_SIDE[prefSide]}-${prefAlign}` as OverlayPlacement
  const flipAlignPlacement = `${prefSide}-${FLIP_ALIGN[prefAlign]}` as OverlayPlacement
  const flipBothPlacement = `${FLIP_SIDE[prefSide]}-${FLIP_ALIGN[prefAlign]}` as OverlayPlacement
  const tryFallbacksValue = [flipSidePlacement, flipAlignPlacement, flipBothPlacement].map(positionTryName).join(', ')

  // Set the popover type on the popup part (done once — the part is created once, ADR-0017 pattern).
  popup.setAttribute('popover', auto ? 'auto' : 'manual')

  // ── Enhanced-path setup (GH #951) — one-time, static wiring; NOTHING here registers a listener.
  // `anchorName` doubles as the enhanced-path flag for the rest of this closure: non-null only when
  // `supportsAnchorPositioning` AND the host has a document to inject the shared stylesheet into.
  const anchorName = supportsAnchorPositioning && anchor.ownerDocument ? nextAnchorName() : null
  if (anchorName) {
    ensureAnchorTryStylesheet(anchor.ownerDocument)
    // `anchor-name` is a comma-list-valued property — APPEND rather than clobber, so a second
    // `overlay()` instance sharing this same anchor element (a real, if rare, composition — e.g. a
    // control that anchors both a tooltip AND a menu off the same trigger) never silently steals the
    // first instance's name and leaves its popup un-anchored.
    const existingAnchorNames = anchor.style.getPropertyValue('anchor-name')
    anchor.style.setProperty('anchor-name', existingAnchorNames ? `${existingAnchorNames}, ${anchorName}` : anchorName)
    popup.style.setProperty('position-anchor', anchorName)
    // FLIP-CANDIDATES (GH #951 — a live regression, not a design preference): the JS path only ever
    // flips the SIDE (`FLIP_SIDE`, preserving align) — a first draft mirrored exactly that ONE
    // fallback here too. It broke `tabs.browser.test.ts`'s overflow-menu commit relay: an anchor
    // sitting at the very edge of a wider-than-viewport strip, with `align:start`, overflows the
    // popup's FAR (right) edge regardless of which SIDE (top/bottom) it's on — a side-only flip
    // can never fix a same-align overflow. The full 2×2 candidate set (flip-side alone, flip-align
    // alone, flip-both) gives the CSS spec's own mandated "least-overflow" fallback selection an
    // actual chance at finding a placement that fits all four edges (here, flipping ALIGN to `end`
    // pins the popup's right edge to the anchor's own right edge instead — which fits, since that
    // edge sits within the viewport even when the anchor's LEFT-aligned start doesn't). Ordered
    // flip-side first (closest to the JS path's own tactic), then flip-align, then flip-both.
    // `resolveAnchoredPlacement()`'s geometry decode works identically regardless of which of the
    // four the compositor actually lands on — it reads resolved rects, never a try-option's name.
    popup.style.setProperty('position-try-fallbacks', tryFallbacksValue)
  }

  let isOpen = false
  let opener: HTMLElement | null = null
  // AbortController for positioning scroll/resize listeners (active only while the popup is open).
  let positionAc: AbortController | null = null
  let rafId: ReturnType<typeof requestAnimationFrame> | null = null
  let cleaned = false
  // GH #1339 — enhanced-path guard state: `anchoredFallback` marks an open session demoted to the
  // JS path after the anchored placement failed verification; the guard's only re-check signals
  // besides open() itself are `revealObserver` (popup box appears/changes) and
  // `anchorVisibilityObserver` (anchor crosses viewport visibility) — never scroll/resize, so the
  // enhanced path's zero-listener-churn law stands; `fallbackTrackId` is the demoted session's
  // per-frame anchor tracker.
  let anchoredFallback = false
  let revealObserver: ResizeObserver | null = null
  let anchorVisibilityObserver: IntersectionObserver | null = null
  let fallbackTrackId: ReturnType<typeof requestAnimationFrame> | null = null

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

  // ── Enhanced-path positioning (GH #951) — no scroll/resize listeners; the compositor re-resolves
  // `anchor()`/`@position-try` on its own as the anchor moves, which is this path's entire point.

  /** Decode which of the FOUR candidates [preferred, flip-side, flip-align, flip-both] the compositor
   * actually applied, from geometry — the enhanced-path equivalent of `computePosition()`'s returned
   * `placement` field, and independent of the fallback LIST's own length or order (a fifth or sixth
   * candidate added later needs no change here). Comparing resolved rects is the only listener-free
   * readback available: `@position-try` rules only accept position/sizing/self-alignment properties,
   * not custom properties (verified empirically against the shipped implementation — a `--resolved:
   * <ident>` declaration inside `@position-try`, paired with a `transition` on that custom property to
   * fire `transitionrun` on activation, never fires; the rule's non-inset declarations are silently
   * dropped), so there is no CSS-side signal to relay a `@position-try` rule's identity back into JS
   * without the browser tightening that spec gap. */
  function resolveAnchoredPlacement(): OverlayPlacement {
    const a = anchor.getBoundingClientRect()
    const p = popup.getBoundingClientRect()
    const EPS = 1 // sub-pixel tolerance against layout rounding
    let side: Side = prefSide
    if (p.top >= a.bottom - EPS) side = 'bottom'
    else if (p.bottom <= a.top + EPS) side = 'top'
    else if (p.left >= a.right - EPS) side = 'right'
    else if (p.right <= a.left + EPS) side = 'left'
    // Align decode: a genuine geometric tie (e.g. a popup exactly as wide as its anchor) reads as
    // equidistant from both edges — default to the PREFERRED align on a tie rather than always
    // 'start', so a same-width `*-end` popup still reports the align it actually asked for instead
    // of a token a consumer's caret/transform-origin styling would read as the wrong side.
    let align: Align
    if (side === 'bottom' || side === 'top') {
      const dStart = Math.abs(p.left - a.left)
      const dEnd = Math.abs(p.right - a.right)
      align = Math.abs(dStart - dEnd) <= EPS ? prefAlign : dStart < dEnd ? 'start' : 'end'
    } else {
      const dStart = Math.abs(p.top - a.top)
      const dEnd = Math.abs(p.bottom - a.bottom)
      align = Math.abs(dStart - dEnd) <= EPS ? prefAlign : dStart < dEnd ? 'start' : 'end'
    }
    return `${side}-${align}` as OverlayPlacement
  }

  /** Apply the BASE (preferred) placement inline — the default state before any `@position-try`
   * fallback activates (the fallback rules themselves live in the shared stylesheet; only the
   * candidate NAMES are referenced via `position-try-fallbacks`, built once at setup above) — then
   * read back the resolved placement SYNCHRONOUSLY (a forced-layout `getBoundingClientRect()` read
   * resolves the compositor's anchor-positioning pass immediately, measured against this repo's
   * pinned engines) to settle `data-placement`, matching the JS path's own synchronous `position()`
   * call — every shipped consumer (menu/select/combo-box/popover/form-popover/tooltip/nav-rail/
   * text-field popups) reads `data-placement` synchronously right after `open()` today; an
   * rAF-deferred first draft of this function broke that contract (6 consumer-suite regressions,
   * caught live by this ticket's own "existing suites stay green unmodified" bar) before landing here.
   *
   * Two recorded, deliberate divergences from the JS path (GH #951 Scope/Open — shipped where
   * faithful, not silently approximated):
   *
   * (1) `data-placement` freshness ACROSS an in-session re-flip. This resolves the placement once,
   * at open (or explicit re-open) time. It is NOT re-read on every subsequent scroll/resize the way
   * the JS path's `schedulePosition()` re-derives it — keeping it live across a compositor-driven
   * mid-scroll re-flip would require re-adding exactly the rAF-on-scroll/resize listener churn this
   * whole enhancement exists to remove, and the CSS Anchor Positioning spec exposes no cheaper
   * listener-free signal for "a named `@position-try` option just activated" (see
   * `resolveAnchoredPlacement()`'s doc comment for what was tried and why it doesn't work).
   *
   * (2) Shift/clamp parity. `insetDeclarationsFor()`'s `max(0px, …)` inset clamp reconstructs the
   * LOWER half of the JS path's continuous viewport clamp (self-size-independent — GH #134's real
   * menu-overflow regression is what this fixes). The UPPER half — capping the popup's OWN far,
   * `auto`-sized edge — genuinely CANNOT be reconstructed the same way: `anchor()` is invalid inside
   * a sizing property (`max-inline-size`/`max-block-size`), measured directly against this repo's
   * real engines after a first draft assumed otherwise (see `insetDeclarationsFor()`'s doc comment).
   * The `position-try-fallbacks` FULL 2×2 candidate list (see the `FLIP-CANDIDATES` comment at the
   * `overlay()` setup site) is the real stand-in — the CSS spec's own mandated "least overflow"
   * selection across four named placements, rather than a size cap, is what fixed the second live
   * regression (`tabs.browser.test.ts`'s overflow-menu commit relay). What remains genuinely
   * unreproduced: a popup that overflows EVERY one of the four candidates on its own far edge,
   * independent of where the anchor sits, still isn't clamped — a discrete four-way pick, never a
   * continuous edge-clamp. Recorded here rather than silently approximated. */
  function applyAnchoredPlacement(): void {
    popup.style.position = 'fixed'
    popup.style.margin = '0'
    const base = insetDeclarationsFor(prefSide, prefAlign)
    popup.style.top = base.top
    popup.style.right = base.right
    popup.style.bottom = base.bottom
    popup.style.left = base.left
    popup.setAttribute('data-placement', resolveAnchoredPlacement())
  }

  /** GH #1339 — is the popup's RENDERED box where the engine's own declarations would put it for the
   * anchor's CURRENT rect? Checks the four anchored candidates [preferred, flip-side, flip-align,
   * flip-both]: a correctly anchored popup ALWAYS sits exactly on one of them — the CSS spec's
   * "least overflow" fallback selection is a discrete pick between these same named declarations,
   * never a continuous adjustment. Mirrors `insetDeclarationsFor()` arithmetically, INCLUDING the
   * `max(0px, …)` clamps (`anchor(x)` inside a `right`/`bottom` property measures from the
   * containing block's own far edge — the ICB, scrollbar-exclusive, hence
   * `documentElement.clientWidth` and not `window.innerWidth`), so a legitimately clamped placement
   * (the GH #134/#586 viewport-edge shapes) reads as HOLDING and stays on the enhanced path with
   * its align-flip `data-placement` verdict intact. `false` therefore means the box is NOT where
   * the current anchor demands it — an IACVT static-position render, or the measured stale-pin
   * freeze (a clamp-bound base translated by scroll compensation but never re-laid-out). The one
   * residual blind spot — a wrong box coinciding pixel-exactly with a candidate — is by definition
   * pixel-correct at that instant, and the next verification signal (a box change or an anchor
   * visibility crossing, see `startAnchoredPositioning()`) re-judges it against fresh geometry.
   * The mirror cannot silently drift from the generator: every enhanced-path suite runs with this
   * guard live, so a generator change the mirror misses demotes those fixtures to the JS path and
   * trips their zero-scroll/resize-listener assertion loudly. EPS absorbs sub-pixel rounding — a
   * genuine detachment misses by whole element-widths, not pixels. */
  function anchoredPlacementHolds(p: DOMRect): boolean {
    const a = anchor.getBoundingClientRect()
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const gap = 0.25 * rootPx
    const vw = document.documentElement.clientWidth || window.innerWidth
    const vh = document.documentElement.clientHeight || window.innerHeight
    const EPS = 2
    const near = (actual: number, expected: number): boolean => Math.abs(actual - expected) <= EPS
    const candidates: ReadonlyArray<readonly [Side, Align]> = [
      [prefSide, prefAlign],
      [FLIP_SIDE[prefSide], prefAlign],
      [prefSide, FLIP_ALIGN[prefAlign]],
      [FLIP_SIDE[prefSide], FLIP_ALIGN[prefAlign]],
    ]
    for (const [side, align] of candidates) {
      let sideOk: boolean
      if (side === 'bottom') sideOk = near(p.top, Math.max(0, a.bottom + gap))
      else if (side === 'top') sideOk = near(p.bottom, vh - Math.max(0, vh - a.top + gap))
      else if (side === 'right') sideOk = near(p.left, Math.max(0, a.right + gap))
      else sideOk = near(p.right, vw - Math.max(0, vw - a.left + gap)) // side === 'left'
      if (!sideOk) continue
      const alignOk =
        side === 'bottom' || side === 'top'
          ? align === 'start'
            ? near(p.left, Math.max(0, a.left))
            : near(p.right, vw - Math.max(0, vw - a.right))
          : align === 'start'
            ? near(p.top, Math.max(0, a.top))
            : near(p.bottom, vh - Math.max(0, vh - a.bottom))
      if (alignOk) return true
    }
    return false
  }

  /** GH #1339 — the IACVT guard (the FormPopover catalog detachment, root-caused on the live page).
   * An OPEN popup whose `anchor()` references fail to resolve — the anchor sat in a `display:none`
   * subtree at open time, or the engine missed re-resolution after a hidden→shown or instance-rewire
   * transition — takes every inset back to `auto` at computed-value time, and a `position:fixed`
   * popup with all-`auto` insets renders at its STATIC position: in-flow beside its trigger,
   * visually detached — and the measured stale-pin freeze (see `startAnchoredPositioning()`'s
   * IntersectionObserver comment) renders the same picture with `anchor()` still resolving. Checked
   * at the only moments either state can newly arise without re-adding the listener churn this path
   * exists to remove: synchronously post-open (inside `startAnchoredPositioning()`, so a demoted
   * session's `data-placement` is already the JS path's settled value when `open()` returns — the
   * sync-read contract holds), at each popup box transition via the reveal observer, and at each
   * anchor visibility crossing. A popup with NO box is left alone — nothing renders, so
   * nothing is misplaced, and the observer re-checks the moment it gains one. On detection the open
   * session DEMOTES to the JS path (`position()`'s px insets + its scroll/resize tracking + the
   * per-frame anchor tracker below — a reveal can fire mid-relayout, see
   * `startFallbackAnchorTracking()`), with `position-try-fallbacks` neutralized so no unresolvable
   * `@position-try` candidate can override the explicit insets; the next `open()` retries the
   * enhanced path fresh. */
  function verifyAnchoredPlacement(): void {
    if (cleaned || !isOpen || anchoredFallback) return
    const p = popup.getBoundingClientRect()
    if (p.width === 0 && p.height === 0) return // no box yet (hidden subtree) — the reveal observer re-checks
    if (anchoredPlacementHolds(p)) {
      // The box is where the current anchor demands it — re-resolve `data-placement`, since after
      // a hidden-at-open reveal the open-time decode ran against a boxless popup and read
      // meaningless geometry.
      popup.setAttribute('data-placement', resolveAnchoredPlacement())
      return
    }
    anchoredFallback = true
    popup.style.setProperty('position-try-fallbacks', 'none')
    // Sever `position-anchor` too — measured: an element that still carries a default anchor keeps
    // riding Chromium's (here FROZEN) anchor scroll-compensation translation even after its insets
    // are replaced with plain px, rendering exactly the stale scroll delta away from the used
    // values. Removing it makes the JS path's fixed coordinates render literally.
    popup.style.removeProperty('position-anchor')
    startJsPositioning()
    startFallbackAnchorTracking()
  }

  /** GH #1339 — while a session is demoted, the JS path's scroll/resize listeners alone can miss a
   * pure LAYOUT shift moving the anchor. The live case: the catalog's tab-reveal fired the reveal
   * observer mid-relayout, the fallback positioned against a not-yet-settled anchor rect, and the
   * page then settled with no scroll event — leaving the panel stale exactly where the bug report
   * shows it. A demoted session has ALREADY traded the enhanced path's zero-churn law for
   * correctness, so it also runs a per-frame anchor-rect compare (one `getBoundingClientRect` per
   * frame; a re-position only on actual movement), ending with the session. Healthy enhanced
   * sessions never start this loop. */
  function startFallbackAnchorTracking(): void {
    if (fallbackTrackId !== null) return
    let last = anchor.getBoundingClientRect()
    const tick = (): void => {
      fallbackTrackId = null
      if (cleaned || !isOpen || !anchoredFallback) return
      const now = anchor.getBoundingClientRect()
      if (now.top !== last.top || now.left !== last.left || now.width !== last.width || now.height !== last.height) {
        last = now
        position()
      }
      fallbackTrackId = requestAnimationFrame(tick)
    }
    fallbackTrackId = requestAnimationFrame(tick)
  }

  function startAnchoredPositioning(): void {
    anchoredFallback = false
    // Restore what a prior open session's GH #1339 demotion may have severed/neutralized — the
    // enhanced path is retried fresh on every open.
    popup.style.setProperty('position-anchor', anchorName!) // non-null: only the anchorName branch calls this
    popup.style.setProperty('position-try-fallbacks', tryFallbacksValue)
    applyAnchoredPlacement()
    verifyAnchoredPlacement() // post-open IACVT verification (GH #1339) — synchronous, see its doc comment
    // The post-REVEAL verification signal (GH #1339): a ResizeObserver fires when the popup's box
    // appears (hidden-at-open → revealed), changes, or vanishes — never on scroll/resize. Active
    // only while open; disconnected in stopAnchoredPositioning().
    if (typeof ResizeObserver !== 'undefined') {
      revealObserver ??= new ResizeObserver(() => verifyAnchoredPlacement())
      revealObserver.observe(popup)
    }
    // The clamp-boundary verification signal (GH #1339, measured live on the catalog page): a
    // placement resolved while the anchor sat at/past a viewport edge bakes its `max(0px, …)` pin
    // into the base layout, and Chromium's scroll compensation then TRANSLATES that stale pin when
    // an inner scroller later moves the anchor into view — it never re-runs the anchor-positioning
    // layout, leaving the panel frozen exactly where the bug report shows it (used insets were
    // measured still carrying the pre-scroll pin while the rendered box rode the scroll delta).
    // An IntersectionObserver on the ANCHOR fires precisely on those visibility crossings — async,
    // compositor-friendly, zero per-scroll JS — and the verify it triggers judges the box against
    // the anchor's CURRENT rect, demoting the frozen session to the JS path. In-view scrolling (no
    // crossing) needs no signal: compensation is exact there (measured — the scroll-while-open flow
    // stays anchored to the pixel).
    if (typeof IntersectionObserver !== 'undefined') {
      anchorVisibilityObserver ??= new IntersectionObserver(() => verifyAnchoredPlacement(), { threshold: [0, 0.5, 1] })
      anchorVisibilityObserver.observe(anchor)
    }
  }

  function stopAnchoredPositioning(): void {
    revealObserver?.disconnect()
    anchorVisibilityObserver?.disconnect()
    anchoredFallback = false
  }

  /** Start the JS path for THIS open session: immediate measure-and-place + scroll/resize tracking.
   * Called by `startPositioning()` on non-supporting engines AND by the GH #1339 IACVT fallback when
   * the enhanced path's `anchor()` references fail to resolve on a rendered open popup. */
  function startJsPositioning(): void {
    positionAc?.abort() // guard: re-open without a close should not stack ACs
    positionAc = new AbortController()
    position() // immediate placement on open
    const signal = positionAc.signal
    window.addEventListener('scroll', schedulePosition, { signal, capture: true, passive: true })
    window.addEventListener('resize', schedulePosition, { signal, passive: true })
  }

  function startPositioning(): void {
    if (anchorName) {
      startAnchoredPositioning()
      return
    }
    startJsPositioning()
  }

  function stopPositioning(): void {
    if (anchorName) stopAnchoredPositioning()
    // JS-path teardown — on the enhanced path these are armed only after a GH #1339 IACVT fallback
    // demoted the open session (null/idle otherwise, making this a no-op there).
    positionAc?.abort()
    positionAc = null
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (fallbackTrackId !== null) {
      cancelAnimationFrame(fallbackTrackId)
      fallbackTrackId = null
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
  //
  // `shouldRestoreFocus` (MAJOR-2, GH #586 critic fold) — ONLY the imperative `close()` path below can
  // pass `false` (a composing consumer's explicit opt-out); the platform light-dismiss listener always
  // calls this with no argument, so Escape / outside-click keeps restoring focus unconditionally.
  function announceHide(shouldRestoreFocus = true): void {
    stopPositioning()
    if (focusOnOpen && shouldRestoreFocus) restoreFocus()
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

  function close(opts?: OverlayCloseOptions): void {
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
    announceHide(opts?.restoreFocus ?? true)
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
