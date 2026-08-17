import"./super-shell-D76CLu9A.js";import{n as e}from"./_page-DIBN49D1.js";import{t}from"./code-block-DEt2Scp8.js";import{a as n}from"./doc-page-H_CmxYv1.js";import{a as r}from"./specimens-BSFejhGR.js";import{t as i}from"./package-BjQHOzmo.js";var a=`// traits — stateless \`(host, opts) => cleanup\` behaviours and stateful controllers, invoked directly from a
// control's \`connected()\` (e.g. \`tabbable(this, …)\`); there is no \`host.use()\`.
export { tabbable } from './tabbable.ts'
export type { TabbableOptions } from './tabbable.ts'
export { trackUserInvalid } from './track-user-invalid.ts'
export type { TrackUserInvalidOptions, TrackUserInvalidController } from './track-user-invalid.ts'
// The form registry controller (G7 — ADR-0050/ADR-0051, LLD-C3): the ui-form-provider discovery/aggregation
// controller, invoked from a provider's \`connected()\` — the same trackUserInvalid controller pattern above.
export { formRegistry } from './form-registry.ts'
export type { FormRegistryController, FormMember } from './form-registry.ts'
export { rovingFocus } from './roving-focus.ts'
export type { RovingFocusOptions, RovingOrientation } from './roving-focus.ts'
export { overlay } from './overlay.ts'
export type { OverlayOptions, OverlayHandle, OverlayPlacement } from './overlay.ts'
export { selectionCommit } from './selection-commit.ts'
export type { SelectionCommitOptions, SelectionMode } from './selection-commit.ts'
export { valueDrag } from './value-drag.ts'
export type { ValueDragOptions } from './value-drag.ts'
// ui-split's N-separator drag gesture (app-surfaces-m4.lld.md LLD-C2) — a NEW sibling to \`value-drag\`,
// deliberately not a generalization of it (axis+RTL+multi-separator+delta vs value-drag's 1-D/LTR/absolute
// value contract; widening value-drag risks the shipped ui-slider/ui-slider-multi).
export { paneResize } from './pane-resize.ts'
export type { PaneResizeOptions, PaneResizeHandle } from './pane-resize.ts'
export { valueCodec, numberCodecOptions, currencyCodecOptions } from './value-codec.ts'
export type { ValueCodecOptions, ValueCodecController } from './value-codec.ts'
export { scrollFade } from './scroll-fade.ts'
export type { ScrollFadeOptions } from './scroll-fade.ts'
export { pressActivation } from './press-activation.ts'
export type { PressActivationOptions } from './press-activation.ts'
export { areaDrag } from './area-drag.ts'
export type { AreaDragOptions } from './area-drag.ts'
export { pendingComputed } from './pending-computed.ts'
export type { PendingComputedOptions, PendingComputedController, PendingSource } from './pending-computed.ts'
// The reorder-mode trait (GH #952, extracted from GH #921's agent-admin roster mechanics): pointer-capture
// drag + a keyboard fallback sharing one commit path. Not exported from the components root barrel — the
// 312 B pre-existing overage (npm run size) is a standing exception, not license to grow it further; add a
// root re-export only once a real consumer outside \`traits/\` needs one.
export { listReorder } from './list-reorder.ts'
export type { ListReorderOptions, ListReorderOrientation } from './list-reorder.ts'
// GH #964 — the sticky-TOC scroll-spy trait (SaaS UX brief §5, first slice): IntersectionObserver-based
// heading-activation, wired by the docs-site TOC recipe (site/pages/toc-content.ts) into its
// ui-nav-rail/ui-select twin, mint-last (no \`ui-toc\` control).
export { scrollSpy } from './scroll-spy.ts'
export type { ScrollSpyOptions } from './scroll-spy.ts'
`,o=`// overlay.ts — the non-modal Overlay controller (overlay-controller LLD-C1..C4). Gives any host a
// top-layer, light-dismissable, anchored popup via the native Popover API (\`popup.showPopover()\` /
// \`hidePopover()\`) + a positioning controller with TWO paths (GH #951): the zero-dep JS path
// (measure-and-place; mechanism settled by the team-lead, support-verified — see
// overlay-controller.lld.md) and, feature-detected at runtime (\`CSS.supports('anchor-name: --x')\`),
// a CSS Anchor Positioning enhanced path — \`anchor-name\`/\`position-anchor\`/\`anchor()\` + a shared,
// lazily-injected \`@position-try\` stylesheet (one rule per \`OverlayPlacement\`, all eight) with a
// fallback candidate LIST per preferred placement (flip-side, flip-align, flip-both — the
// \`FLIP-CANDIDATES\` comment at the \`overlay()\` setup site has why a single side-flip, the JS path's
// own tactic, isn't enough here) — never the browser's OWN generic \`flip-block\`/\`flip-inline\`
// try-tactic keywords, which this file does not use at all. The enhanced path registers NO
// scroll/resize listeners — that is its entire point, positioning becomes compositor-driven.
// Non-supporting engines get the JS path, byte-identical to before this ticket.
//
// Two recorded divergences (GH #951 Scope/Open — shipped where faithful, never silently approximated):
// (1) \`data-placement\` on the enhanced path is resolved via a single SYNCHRONOUS geometry read inside
// \`open()\` (matching the JS path's own synchronous \`position()\` write — every shipped consumer reads
// this attribute right after \`open()\`), but it is NOT kept live across an in-session scroll-driven
// re-flip the way the JS path's \`schedulePosition()\` re-derives it — no listener-free platform signal
// exists for "which named \`@position-try\` option is active" (verified: \`@position-try\` rules do not
// honor custom-property declarations, so a \`transitionrun\`-based observer does not apply here; see
// \`applyAnchoredPlacement()\`'s doc comment for the full trace).
//
// (2) Shift/clamp parity. The JS path's \`computePosition()\` continuously clamps into the viewport
// (\`Math.max(0, Math.min(...))\`) using the popup's OWN measured size. A first draft of this ticket
// believed \`max-inline-size\`/\`max-block-size\` could reconstruct the missing (far-edge) half of that
// clamp via \`calc(100vw - anchor(left))\`-shaped arithmetic — measured WRONG against this repo's real
// engines: \`anchor()\` is valid ONLY inside inset properties (top/right/bottom/left and their logical
// equivalents), never inside a SIZING property; the declaration silently fails at compute time and
// the property falls through to whatever unrelated rule the cascade supplies next (a real trap — it
// LOOKED like it was capping the size, because a pre-existing, unrelated \`max-inline-size\` rule from
// menu.css happened to already be there). \`insetDeclarationsFor()\`'s \`max(0px, …)\` inset clamp still
// stands (self-size-independent, derived purely from the anchor's own resolved position — it fixed
// the real GH #134 menu-overflow regression). What plugs the remaining gap is NOT a size cap at all:
// \`position-try-fallbacks\` carries the FULL 2×2 candidate set (flip-side, flip-align, flip-both), not
// only the JS path's single side-flip, so the CSS spec's own mandated "least-overflow" selection has
// a real chance of landing on a placement that fits within the viewport on ALL four edges (this is
// what fixed the second live regression, \`tabs.browser.test.ts\`'s overflow-menu commit relay — see
// \`applyAnchoredPlacement()\`'s doc comment for the full account). A popup that STILL doesn't fit any
// of the four candidates renders at whichever one overflows least — a discrete pick between four
// named placements, not JS's continuous edge-clamp; that residual case stays the recorded divergence.
//
// Boundary: a true MODAL (focus-trapped) stays on \`ui-modal\`'s \`<dialog>\` \`showModal()\` (ADR-0017).
// This controller is the NON-MODAL path (select popup, menu, tooltip, popover).
//
// Announce contract (ADR-0101): the trait announces every ACTUAL open-state transition — platform-,
// component-, or model-driven — \`toggle\` on a real show/hide, \`close\` alongside every real hide, fired
// after the host's own \`open\` prop has settled. Native ToggleEvent timing fidelity; see \`open()\`/\`close()\`.
// Unchanged by GH #951 — positioning-path choice is fully orthogonal to the announce contract.
//
// \`traits → dom\` is the one allowed cross-layer direction; the host type only.

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
  /** The popup element (\`[popover]\` part — owned by the host control). */
  popup: HTMLElement
  /** The trigger element the popup anchors to. */
  anchor: HTMLElement
  /**
   * Initial placement preference. The JS controller flips/shifts to keep the popup in-viewport.
   * Default: \`'bottom-start'\`.
   */
  placement?: OverlayPlacement
  /**
   * \`true\` → \`popover=auto\` (light-dismiss via Escape + outside-click).
   * \`false\` → \`popover=manual\` (tooltip: dismiss on blur/leave). Default: \`true\`.
   */
  auto?: boolean
  /**
   * Move focus into the popup on open (menu/listbox pattern). \`false\` for tooltip (no focus move).
   * Focus is restored to \`anchor\` on close. Default: \`true\`.
   */
  focusOnOpen?: boolean
}

/**
 * Options for an IMPERATIVE \`close()\` call (GH #586 critic fold MAJOR-2). Additive — every existing
 * caller passes none and gets today's behaviour unchanged.
 */
export interface OverlayCloseOptions {
  /**
   * \`false\` — skip the default "restore focus to the trigger" tail for THIS close only. For a
   * composing consumer whose OWN commit-relay listener already moved focus somewhere meaningful
   * during the SAME synchronous turn (the \`ui-menu\` → \`ui-tabs\` promoted-tab relay is the shipped
   * precedent) and does not want the overlay's default restore stealing it back a microtask later.
   * The platform light-dismiss path (Escape / outside-click) NEVER reads this — it always restores
   * focus to the trigger, the contract every other overlay consumer relies on. Default \`true\`
   * (today's behaviour).
   */
  restoreFocus?: boolean
}

/** The object returned by \`overlay()\` — imperative control + cleanup. */
export interface OverlayHandle {
  /** Show the popup (\`showPopover()\` + position); emits \`toggle\` on a real show (ADR-0101). No-op (no event) if already open. */
  open: () => void
  /** Hide the popup (\`hidePopover()\` + restore focus); emits \`close\`+\`toggle\` on a real hide (ADR-0101). No-op (no event) if already closed. \`opts.restoreFocus:false\` skips the focus restore for this one call (MAJOR-2, GH #586) — the platform light-dismiss path is unaffected. */
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
 * Measure the anchor + popup + viewport and compute the fixed \`top\`/\`left\` for the given \`placement\`.
 * Flips to the opposite side when the preferred side lacks space (flip). Clamps the result to the
 * viewport edges (shift). Returns the resolved placement for \`data-placement\`.
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

  return { top, left, placement: \`\${side}-\${align}\` as OverlayPlacement }
}

/** Is the popup ACTUALLY in the top layer? \`:popover-open\` throws in engines that lack it — guard it. */
function matchesPopoverOpen(popup: HTMLElement): boolean {
  try {
    return popup.matches(':popover-open')
  } catch {
    return false // pre-\`:popover-open\` engine — fall back to the internal flag at the call site
  }
}

// ── Enhanced path: CSS Anchor Positioning (GH #951) ─────────────────────────────────────────────
//
// Feature-detected ONCE at module load — every \`overlay()\` instance in the process shares this one
// verdict (a runtime engine doesn't change mid-session). Non-supporting engines never touch anything
// below; \`computePosition()\` above stays their entire (byte-identical) positioning story.
const supportsAnchorPositioning =
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('anchor-name: --ui-overlay-probe')

let anchorNameSeq = 0
/** A fresh \`anchor-name\` dashed-ident per \`overlay()\` instance — multiple anchored popups on one page
 * must not collide. \`anchor()\` used with no explicit anchor argument inside a \`@position-try\` rule
 * always resolves against whichever name the QUERYING element's OWN \`position-anchor\` points to, so
 * the shared stylesheet below never needs one rule set per instance despite this per-instance name. */
function nextAnchorName(): string {
  anchorNameSeq += 1
  return \`--ui-overlay-anchor-\${anchorNameSeq}\`
}

/** The 4 physical inset declarations for a resolved side+align — the SINGLE generator shared by the
 * static \`@position-try\` rule text below AND the per-instance base (preferred) placement applied
 * inline, so the two representations can never drift apart. The 0.25rem gap is a LITERAL, not a
 * computed value: CSS \`rem\` already tracks the root font-size identically to the JS path's own
 * \`parseFloat(getComputedStyle(root).fontSize)\` derivation — same design token, two mechanisms.
 *
 * Every declared value is wrapped in \`max(0px, …)\` — a self-size-independent RECONSTRUCTION of the
 * LOWER half of the JS path's continuous \`Math.max(0, Math.min(...))\` clamp (\`computePosition\`'s
 * shift step), derived purely from the anchor's own resolved position — never the popup's own size.
 * \`top\`/\`left\` measure directly from the SAME origin as the coordinate itself, so \`max(0px, …)\`
 * reproduces JS's LOWER bound; \`right\`/\`bottom\` measure from the OPPOSITE edge, so the identical
 * wrapper instead reproduces JS's UPPER bound on THAT far edge — but only the one the anchor itself
 * governs. GH #134 (menu-overflow) is the concrete regression this fixes on the enhanced path: an
 * anchor whose own right edge already sits past the viewport would otherwise carry that overflow
 * straight onto the popup via a bare \`anchor(right)\`.
 *
 * A first draft of this file ALSO tried a \`max-inline-size\`/\`max-block-size\` cap here, to close the
 * popup's OWN \`auto\`-sized far edge (the half this function cannot reach) via \`calc(100vw −
 * anchor(left))\`-shaped arithmetic — measured WRONG against real engines: \`anchor()\` is valid ONLY
 * inside inset properties, never a sizing property; the declaration silently fails at compute time,
 * masked by whatever unrelated rule the cascade supplies next. \`overlay.ts\`'s header comment (2) has
 * the full account, including how \`position-try-fallbacks\`'s FULLER candidate list — not a size cap
 * — is what actually plugs the residual gap. */
function insetDeclarationsFor(side: Side, align: Align): Record<'top' | 'right' | 'bottom' | 'left', string> {
  const gap = '0.25rem'
  const decl: Record<'top' | 'right' | 'bottom' | 'left', string> = { top: 'auto', right: 'auto', bottom: 'auto', left: 'auto' }
  if (side === 'bottom') decl.top = \`max(0px, calc(anchor(bottom) + \${gap}))\`
  else if (side === 'top') decl.bottom = \`max(0px, calc(anchor(top) + \${gap}))\`
  else if (side === 'right') decl.left = \`max(0px, calc(anchor(right) + \${gap}))\`
  else decl.right = \`max(0px, calc(anchor(left) + \${gap}))\` // side === 'left'

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

/** The \`@position-try\` rule name for a given placement — every one of the 8 possible placements is
 * registered once, since any placement can be the FLIP TARGET of its opposite-side preferred pick. */
function positionTryName(placement: OverlayPlacement): string {
  return \`--ui-overlay-try-\${placement}\`
}

function buildAnchorTryStylesheet(): string {
  return ALL_PLACEMENTS.map((p) => {
    const [side, align] = splitPlacement(p)
    const d = insetDeclarationsFor(side, align)
    return \`@position-try \${positionTryName(p)} { top: \${d.top}; right: \${d.right}; bottom: \${d.bottom}; left: \${d.left}; margin: 0; }\`
  }).join('\\n')
}

/** The align opposite — \`start\`↔\`end\`. Paired with \`FLIP_SIDE\` to build the fuller candidate set
 * below (flip-side, flip-align, flip-both) — see the FLIP-CANDIDATES comment at the \`overlay()\`
 * setup site for why a single side-flip (the JS path's own tactic) isn't enough on the enhanced
 * path. */
const FLIP_ALIGN = { start: 'end', end: 'start' } as const satisfies Record<Align, Align>

const ANCHOR_TRY_STYLE_ID = 'ui-overlay-anchor-tries'

/** Lazily inject the shared \`@position-try\` stylesheet into \`document.head\` — once per document (the
 * \`id\` marker guards re-injection across multiple \`overlay()\` instances, or a re-run inside one test's
 * shared DOM). No-ops outside a document AND outside a document that actually HAS a \`<head>\` (a bare
 * \`DOMImplementation\` document can lack one) — the earlier \`anchor.ownerDocument\` guard at the call
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
 * Wire a Popover API top-layer popup on a \`UIElement\` host. Invoke from \`connected()\` so listeners
 * ride the connection AbortSignal (auto-removed on disconnect). Returns an \`OverlayHandle\`; \`cleanup\`
 * is also called automatically on host disconnect via a scope-owned effect disposer.
 */
export function overlay(host: UIElement, opts: OverlayOptions): OverlayHandle {
  const { popup, anchor } = opts
  const prefPlacement = opts.placement ?? 'bottom-start'
  const auto = opts.auto ?? true
  const focusOnOpen = opts.focusOnOpen ?? true
  const [prefSide, prefAlign] = splitPlacement(prefPlacement)

  // Set the popover type on the popup part (done once — the part is created once, ADR-0017 pattern).
  popup.setAttribute('popover', auto ? 'auto' : 'manual')

  // ── Enhanced-path setup (GH #951) — one-time, static wiring; NOTHING here registers a listener.
  // \`anchorName\` doubles as the enhanced-path flag for the rest of this closure: non-null only when
  // \`supportsAnchorPositioning\` AND the host has a document to inject the shared stylesheet into.
  const anchorName = supportsAnchorPositioning && anchor.ownerDocument ? nextAnchorName() : null
  if (anchorName) {
    ensureAnchorTryStylesheet(anchor.ownerDocument)
    // \`anchor-name\` is a comma-list-valued property — APPEND rather than clobber, so a second
    // \`overlay()\` instance sharing this same anchor element (a real, if rare, composition — e.g. a
    // control that anchors both a tooltip AND a menu off the same trigger) never silently steals the
    // first instance's name and leaves its popup un-anchored.
    const existingAnchorNames = anchor.style.getPropertyValue('anchor-name')
    anchor.style.setProperty('anchor-name', existingAnchorNames ? \`\${existingAnchorNames}, \${anchorName}\` : anchorName)
    popup.style.setProperty('position-anchor', anchorName)
    // FLIP-CANDIDATES (GH #951 — a live regression, not a design preference): the JS path only ever
    // flips the SIDE (\`FLIP_SIDE\`, preserving align) — a first draft mirrored exactly that ONE
    // fallback here too. It broke \`tabs.browser.test.ts\`'s overflow-menu commit relay: an anchor
    // sitting at the very edge of a wider-than-viewport strip, with \`align:start\`, overflows the
    // popup's FAR (right) edge regardless of which SIDE (top/bottom) it's on — a side-only flip
    // can never fix a same-align overflow. The full 2×2 candidate set (flip-side alone, flip-align
    // alone, flip-both) gives the CSS spec's own mandated "least-overflow" fallback selection an
    // actual chance at finding a placement that fits all four edges (here, flipping ALIGN to \`end\`
    // pins the popup's right edge to the anchor's own right edge instead — which fits, since that
    // edge sits within the viewport even when the anchor's LEFT-aligned start doesn't). Ordered
    // flip-side first (closest to the JS path's own tactic), then flip-align, then flip-both.
    // \`resolveAnchoredPlacement()\`'s geometry decode works identically regardless of which of the
    // four the compositor actually lands on — it reads resolved rects, never a try-option's name.
    const flipSidePlacement = \`\${FLIP_SIDE[prefSide]}-\${prefAlign}\` as OverlayPlacement
    const flipAlignPlacement = \`\${prefSide}-\${FLIP_ALIGN[prefAlign]}\` as OverlayPlacement
    const flipBothPlacement = \`\${FLIP_SIDE[prefSide]}-\${FLIP_ALIGN[prefAlign]}\` as OverlayPlacement
    popup.style.setProperty(
      'position-try-fallbacks',
      [flipSidePlacement, flipAlignPlacement, flipBothPlacement].map(positionTryName).join(', '),
    )
  }

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
    popup.style.top = \`\${top}px\`
    popup.style.left = \`\${left}px\`
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
  // \`anchor()\`/\`@position-try\` on its own as the anchor moves, which is this path's entire point.

  /** Decode which of the FOUR candidates [preferred, flip-side, flip-align, flip-both] the compositor
   * actually applied, from geometry — the enhanced-path equivalent of \`computePosition()\`'s returned
   * \`placement\` field, and independent of the fallback LIST's own length or order (a fifth or sixth
   * candidate added later needs no change here). Comparing resolved rects is the only listener-free
   * readback available: \`@position-try\` rules only accept position/sizing/self-alignment properties,
   * not custom properties (verified empirically against the shipped implementation — a \`--resolved:
   * <ident>\` declaration inside \`@position-try\`, paired with a \`transition\` on that custom property to
   * fire \`transitionrun\` on activation, never fires; the rule's non-inset declarations are silently
   * dropped), so there is no CSS-side signal to relay a \`@position-try\` rule's identity back into JS
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
    // 'start', so a same-width \`*-end\` popup still reports the align it actually asked for instead
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
    return \`\${side}-\${align}\` as OverlayPlacement
  }

  /** Apply the BASE (preferred) placement inline — the default state before any \`@position-try\`
   * fallback activates (the fallback rules themselves live in the shared stylesheet; only the
   * candidate NAMES are referenced via \`position-try-fallbacks\`, built once at setup above) — then
   * read back the resolved placement SYNCHRONOUSLY (a forced-layout \`getBoundingClientRect()\` read
   * resolves the compositor's anchor-positioning pass immediately, measured against this repo's
   * pinned engines) to settle \`data-placement\`, matching the JS path's own synchronous \`position()\`
   * call — every shipped consumer (menu/select/combo-box/popover/form-popover/tooltip/nav-rail/
   * text-field popups) reads \`data-placement\` synchronously right after \`open()\` today; an
   * rAF-deferred first draft of this function broke that contract (6 consumer-suite regressions,
   * caught live by this ticket's own "existing suites stay green unmodified" bar) before landing here.
   *
   * Two recorded, deliberate divergences from the JS path (GH #951 Scope/Open — shipped where
   * faithful, not silently approximated):
   *
   * (1) \`data-placement\` freshness ACROSS an in-session re-flip. This resolves the placement once,
   * at open (or explicit re-open) time. It is NOT re-read on every subsequent scroll/resize the way
   * the JS path's \`schedulePosition()\` re-derives it — keeping it live across a compositor-driven
   * mid-scroll re-flip would require re-adding exactly the rAF-on-scroll/resize listener churn this
   * whole enhancement exists to remove, and the CSS Anchor Positioning spec exposes no cheaper
   * listener-free signal for "a named \`@position-try\` option just activated" (see
   * \`resolveAnchoredPlacement()\`'s doc comment for what was tried and why it doesn't work).
   *
   * (2) Shift/clamp parity. \`insetDeclarationsFor()\`'s \`max(0px, …)\` inset clamp reconstructs the
   * LOWER half of the JS path's continuous viewport clamp (self-size-independent — GH #134's real
   * menu-overflow regression is what this fixes). The UPPER half — capping the popup's OWN far,
   * \`auto\`-sized edge — genuinely CANNOT be reconstructed the same way: \`anchor()\` is invalid inside
   * a sizing property (\`max-inline-size\`/\`max-block-size\`), measured directly against this repo's
   * real engines after a first draft assumed otherwise (see \`insetDeclarationsFor()\`'s doc comment).
   * The \`position-try-fallbacks\` FULL 2×2 candidate list (see the \`FLIP-CANDIDATES\` comment at the
   * \`overlay()\` setup site) is the real stand-in — the CSS spec's own mandated "least overflow"
   * selection across four named placements, rather than a size cap, is what fixed the second live
   * regression (\`tabs.browser.test.ts\`'s overflow-menu commit relay). What remains genuinely
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

  function startAnchoredPositioning(): void {
    applyAnchoredPlacement()
  }

  // No teardown needed on the enhanced path — no listener, no scheduled frame, nothing outstanding.
  // Kept as a named function (rather than inlined at the call site) purely for symmetry with
  // \`stopPositioning()\`'s JS-path branch and readability at the call sites below.
  function stopAnchoredPositioning(): void {
    // intentional no-op
  }

  function startPositioning(): void {
    if (anchorName) {
      startAnchoredPositioning()
      return
    }
    positionAc?.abort() // guard: re-open without a close should not stack ACs
    positionAc = new AbortController()
    position() // immediate placement on open
    const signal = positionAc.signal
    window.addEventListener('scroll', schedulePosition, { signal, capture: true, passive: true })
    window.addEventListener('resize', schedulePosition, { signal, passive: true })
  }

  function stopPositioning(): void {
    if (anchorName) {
      stopAnchoredPositioning()
      return
    }
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
    // to the trigger on close"). \`document.activeElement\` at open() time is unreliable: WebKit does
    // not focus a <button> on click (so it would be \`body\`), and it can be stale by the time the
    // scope-owned effect runs. The captured \`opener\` is only a fallback for a non-focusable anchor.
    const target =
      anchor && anchor.isConnected && typeof anchor.focus === 'function' ? anchor : opener
    opener = null
    if (target && target.isConnected && typeof target.focus === 'function') target.focus()
  }

  // ── The shared "real hide has happened" tail (ADR-0101) ─────────────────────────────────────
  //
  // Stops positioning, restores focus, and announces \`close\`+\`toggle\` — the settle + announce work
  // common to EVERY real hide, however it was driven. Pulled out of \`close()\` so the platform
  // light-dismiss path (below) can share it WITHOUT re-invoking \`hidePopover()\` on a popup the
  // platform already hid: calling \`hidePopover()\` a second time from inside its own native 'toggle'
  // handler is a genuine cross-engine race (observed on both Chromium + WebKit) — some engines still
  // consider the popup "showing" at that exact synchronous point, so the redundant call re-runs the
  // platform's OWN hide algorithm and fires a SECOND real ToggleEvent, double-announcing. \`close\`
  // fires first: any host-side listener that syncs its own \`open\` prop off \`close\` (the family
  // pattern — menu.ts / select.ts / popover.ts / combo-box.ts all
  // \`this.listen(this, 'close', () => { this.open = false })\`) runs synchronously inside this emit,
  // so the prop is ALREADY false by the time \`toggle\` fires next (the ordering invariant, ADR-0101
  // mechanic 3 — a renderer's two-way bind reads \`el.open\` at \`toggle\` listener time and gets the
  // settled value on every path, commit or light-dismiss alike).
  //
  // \`shouldRestoreFocus\` (MAJOR-2, GH #586 critic fold) — ONLY the imperative \`close()\` path below can
  // pass \`false\` (a composing consumer's explicit opt-out); the platform light-dismiss listener always
  // calls this with no argument, so Escape / outside-click keeps restoring focus unconditionally.
  function announceHide(shouldRestoreFocus = true): void {
    stopPositioning()
    if (focusOnOpen && shouldRestoreFocus) restoreFocus()
    host.emit('close')
    host.emit('toggle') // value:{prop:'open',event:'toggle'} two-way signal (ADR-0019)
  }

  // ── Platform → model: the Popover toggle listener (LLD-C2: light-dismiss) ──────────────────
  //
  // Rides the host's connection AbortSignal via \`host.listen\` — auto-removed on host disconnect.
  // Discriminates a platform/light-dismiss close (isOpen is still true — WE never called close())
  // from the platform's OWN ECHO of a close WE drove (isOpen was already set false before we called
  // \`hidePopover()\`, so the platform's resulting toggle event is a no-op here — ADR-0101: we announce
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
  // component-, or model-driven): \`open()\` emits \`toggle\` on a real show; \`close()\` emits
  // \`close\`+\`toggle\` on a real hide. Native ToggleEvent timing fidelity — ToggleEvents fire on
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
    // even if \`isOpen\` drifted false (a spurious/async platform toggle can desync the flag while the
    // panel stays open — observed on the commit→close path). Basing the guard on \`:popover-open\`
    // (with \`isOpen\` as the fallback for engines pre-\`:popover-open\`) makes model-driven close reliable.
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
  // escape hatch via the returned handle's \`cleanup\` field.
  host.effect(() => cleanup)

  return { open, close, toggle, cleanup }
}
`,s=`// list-reorder.ts — the reusable reorder-MODE trait (GH #952), extracted verbatim-in-spirit from GH #921's
// agent-admin roster mechanics (\`site/pages/agent-admin-app.ts\`'s \`wireDrag\`/\`moveAgent\`, PR #922). Wires an
// explicit reorder MODE — armed by the CONSUMER's own toggle affordance, this trait owns no UI for arming it
// — over an ordered set of item elements: pointer-capture drag with sibling hit-testing (the #921 ruling 4
// mechanics) PLUS a keyboard fallback (Up/Down while a handle is armed+focused) satisfying WCAG 2.2 SC 2.5.7
// Dragging Movements. Both paths converge on the SAME commit: \`opts.onCommit(from, to)\` followed by a
// \`change\` CustomEvent on the host (\`change\` is the FIRST event-vocabulary member — the seven are
// \`change · input · select · open · close · toggle · action\`, \`action\` being the seventh, ADR-0153; \`change\`
// is ops plan §3.3's ruling for THIS trait's commit, recorded here since the ticket's own Scope/Open section
// left it as an open question).
//
// Keyboard moves relocate the item via native \`parent.moveBefore\` where the engine has it (the ADR-0022
// pattern \`dom/template.ts\`'s repeat directive uses) — an atomic move that never leaves the document, so
// the focused handle KEEPS focus — falling back to detach+reinsert (\`before\`/\`after\`) plus an explicit
// re-focus of whatever the item held as \`document.activeElement\` (jsdom + pre-moveBefore engines). Two
// consecutive ArrowDown presses therefore land on the same, still-focused handle (browser-proven in
// \`list-reorder.browser.test.ts\`).
//
// No HTML5 Drag-and-Drop API (#921's in-code ruling, repeated in this ticket's Acceptance) — pointer events
// only. \`setPointerCapture\` on the HANDLE keeps the gesture live past its own bounds, mirroring \`value-drag\`/
// \`area-drag\`/\`pane-resize\`'s shared lifetime discipline: an outer \`host.listen\` (connection-signal-scoped,
// zero residue on disconnect) arms the gesture; a per-drag \`AbortController\` bounds the move/up/cancel
// listeners to the drag itself.
//
// Hit-testing deliberately does NOT use \`document.elementFromPoint\` (the #921 page's own approach, taken
// because pointer capture pins the event target to the handle) — it instead re-reads \`opts.items()\` on every
// move and finds whichever item's own rect currently contains the pointer along the reorder axis. Same
// visual result (a real engine's coordinates are identical either way), but jsdom-testable without stubbing
// a DOM API this repo's unit gate cannot exercise for real (\`component-testing\`'s INSTRUMENT-BRIDGE note).
//
// CSS hooks (GH #921's \`agent-admin-app.css\` precedent, generalized): \`data-reorder-mode\` reflects
// \`opts.armed()\` onto \`opts.container?.() ?? host\`, re-applied inside a \`host.effect\` so a reactive \`armed\`
// accessor keeps it live without the consumer re-invoking this trait; \`data-dragging\` marks the ITEM
// currently being pointer-dragged, removed on drag-end.
//
// ARIA: this trait writes no \`aria-*\`/\`role\` anywhere — not on the host (the fleet's own
// ElementInternals-only law, CLAUDE.md "ARIA via ElementInternals, never host attributes") and not on items
// (unlike \`selectionCommit\`'s \`aria-selected\` reflect, reorder position carries no ARIA state of its own to
// publish — the accessible story is the labeled Up/Down affordance the CONSUMER's own handle carries, e.g. a
// real \`aria-label="Move X up"\` button). A host that wants to expose reorder-mode itself as ARIA (e.g.
// \`aria-roledescription\` on the list) reflects it through its OWN \`internals\` from \`opts.armed()\` — this
// trait cannot reach a host's protected \`internals\` (the same split \`track-user-invalid.ts\` documents) and
// does not attempt to.
//
// \`traits → dom\` is the one allowed cross-layer direction; the host type only.

import type { UIElement } from '../dom/index.ts'

export type ListReorderOrientation = 'vertical' | 'horizontal'

export interface ListReorderOptions {
  /** Live accessor for the ordered item elements. Re-read on every \`pointerdown\`/\`keydown\` AND on every
   *  \`pointermove\` (so a consumer that mutates the DOM order live, mirroring the #921 precedent, is honoured
   *  by the very next hit-test). */
  items: () => HTMLElement[]
  /** Live accessor: is reorder mode currently armed? Both the pointer-drag arm and the keyboard fallback are
   *  gated on this — an unarmed host emits neither \`data-dragging\` nor a commit. */
  armed: () => boolean
  /** Resolve an item's own drag/keyboard handle (the element \`pointerdown\`/\`keydown\` must land on to arm a
   *  gesture for THAT item — the #921 leading drag-handle cell, or the consumer's own Up/Down buttons).
   *  Return \`null\` to skip wiring that item (e.g. a shipped/protected row with no handle at all — the #921
   *  preset-protection precedent). Called with the item and its current index. */
  handle: (item: HTMLElement, index: number) => HTMLElement | null
  /** Resolve an item's KEYBOARD target — the element a \`keydown\` must land within (or on) to arm the
   *  Up/Down fallback for THAT item. Default: \`handle\` (one grip serves both paths). A consumer whose drag
   *  grip and its labeled Up/Down buttons are SEPARATE elements (the agent-admin caret precedent) returns
   *  the button group (or the row itself) here so keyboard routes through the trait too. Return \`null\` to
   *  skip keyboard wiring for that item. Called with the item and its current index. */
  keyboardTarget?: (item: HTMLElement, index: number) => HTMLElement | null
  /** Called once per commit, from a drag release OR a keyboard move — \`from\`/\`to\` are indices into
   *  \`opts.items()\` as read at the START of the gesture (drag) or at the moment of the key press (keyboard).
   *  The caller owns persistence + re-render; this trait touches no application state and never assumes the
   *  item elements survive a commit (a consumer that fully rebuilds its list on every commit, the #921
   *  \`refreshRoster\` precedent, is exactly as well-supported as one that mutates in place). */
  onCommit: (from: number, to: number) => void
  /** Arrow-key axis for the keyboard fallback (ArrowUp/ArrowDown for \`'vertical'\`, ArrowLeft/ArrowRight for
   *  \`'horizontal'\`) AND the pointer hit-test axis. Default: \`'vertical'\`. */
  orientation?: ListReorderOrientation
  /** Live accessor for the element \`data-reorder-mode\` reflects onto. Default: \`() => host\`. */
  container?: () => HTMLElement | null
}

// The item among \`list\` whose own rect currently contains the pointer along \`orientation\`'s axis — the
// jsdom-testable stand-in for \`document.elementFromPoint\` (see the file banner). \`null\` when the pointer
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

// Whether a move past \`overRect\`'s own midpoint (along \`orientation\`) reads as "before" or "after" that item
// — the #921 \`clientY < rect.top + rect.height / 2\` ruling, generalized to either axis.
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
 * Wire pointer-drag + keyboard-fallback reorder on a \`UIElement\` host. Invoke from \`connected()\` so the
 * outer listeners ride the connection AbortSignal (auto-removed on disconnect) and \`data-reorder-mode\`'s
 * reflect effect is scope-owned. Returns cleanup (idempotent).
 */
export function listReorder(host: UIElement, opts: ListReorderOptions): () => void {
  const orientation = opts.orientation ?? 'vertical'
  const keyboardTarget = opts.keyboardTarget ?? opts.handle
  let released = false

  // Reflect \`data-reorder-mode\` onto the container, live — a reactive \`armed()\` accessor (reading a signal)
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
      if (!over || over === item) return
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
  // Shares the exact commit path above: an adjacent-index swap, \`onCommit(from, to)\`, then the \`change\`
  // event. Gated on \`armed()\` + the press landing on an item's OWN handle, same as the pointer path.
  host.listen(host, 'keydown', (event) => {
    if (released || !opts.armed()) return
    const e = event as KeyboardEvent
    // Modified arrows (⌥/⌃/⌘ + arrow) are the platform's own chords, and an already-handled press belongs to
    // whoever handled it — neither is a reorder request.
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
    const isNextKey = orientation === 'vertical' ? e.key === 'ArrowDown' : e.key === 'ArrowRight'
    const isPrevKey = orientation === 'vertical' ? e.key === 'ArrowUp' : e.key === 'ArrowLeft'
    if (!isNextKey && !isPrevKey) return

    const targetEl = e.target as Element | null
    if (!targetEl) return
    const list = opts.items()
    const from = list.findIndex((it, i) => {
      const t = keyboardTarget(it, i)
      return t !== null && t.contains(targetEl)
    })
    if (from === -1) return
    const item = list[from]

    const to = isNextKey ? from + 1 : from - 1
    if (to < 0 || to >= list.length) return // already at an end — nothing to move past

    e.preventDefault()
    const neighbor = list[to]
    const parent = item.parentNode
    // Whatever the item currently holds as the focused element (the handle, or a keyboardTarget button) must
    // still be focused after the move — the WHOLE point of the fallback is repeat presses without re-tabbing.
    const active = document.activeElement
    const hadFocus = active instanceof HTMLElement && item.contains(active)
    // Moving "down" = before the neighbor's NEXT sibling (null → append), "up" = before the neighbor itself.
    const ref: ChildNode | null = isNextKey ? neighbor.nextSibling : neighbor
    if (parent && 'moveBefore' in parent) {
      // native atomic move (ADR-0022): the item never leaves the document → focus survives on its own
      ;(parent as ParentNode & { moveBefore(node: Node, child: Node | null): void }).moveBefore(item, ref)
    } else if (isPrevKey) {
      neighbor.before(item) // fallback: detach+reinsert — focus is dropped by the engine, restored below
    } else {
      neighbor.after(item)
    }
    if (hadFocus && document.activeElement !== active) {
      (active as HTMLElement).focus()
    }

    opts.onCommit(from, to)
    host.emit('change', { from, to })
  })

  return () => {
    released = true
  }
}
`,c=`// scroll-spy.ts — the heading-observation trait for a sticky TOC nav (GH #964, SaaS UX brief §5, first
// slice). Watches a fixed list of heading elements and reports which one is "active" (the current read
// position) — the standard scroll-spy contract a TOC composition recipe (ui-nav-rail/ui-select over a
// long-form article, GH #964's mint-last recipe — no \`ui-toc\` control minted) wires into its own
// active-item marking, the SAME external-sync shape \`ui-settings\` already uses to keep its rail and its
// compact-band \`ui-select\` twin in lock-step (GH #962 \`#markActiveRailItem\`).
//
// IntersectionObserver, not a scroll listener: a heading crosses a narrow "activation band" near the top
// of the viewport (\`opts.rootMargin\`) and the observer fires only on that crossing — no per-frame scroll
// math (unlike scroll-fade.ts's edge trait, which genuinely needs continuous scrollTop/scrollHeight
// comparison for its fade ramps; this trait needs only "did a heading's crossing state change").
// Feature-detected (\`typeof IntersectionObserver !== 'undefined'\`), the same jsdom/pre-engine guard
// scroll-fade.ts's ResizeObserver use takes — jsdom (the unit-test environment) implements neither API.
//
// ACTIVE = the LAST heading (in document order) whose entry is currently intersecting the band — the
// topmost heading that has already been scrolled up to (or past) the band's leading edge, biased toward
// the one closest to it. IntersectionObserver entries are DELTA-only (a callback reports only the targets
// whose intersection state just changed, never a full snapshot) — the trait keeps its own live map of
// every observed heading's last-known state so \`pickActive()\` always decides from the CURRENT whole
// picture, not just the entries this callback happened to report.
//
// FALLBACK: nothing intersecting (above the first heading's band, or scrolled between two headings whose
// bands don't overlap at that particular scroll position) never blanks the active id — it falls back to
// the nearest heading already scrolled past (\`getBoundingClientRect().top\` at or above the ROOT's own top
// edge — the viewport's \`0\` by default, \`opts.root\`'s rect top when a scrolling ancestor is named, so the
// fallback measures against the same frame the observer does), so a TOC never shows "nothing selected"
// mid-article.
//
// \`traits → dom\` is the one allowed cross-layer direction (reactive ← dom ← traits); the host type only.

import type { UIElement } from '../dom/index.ts'

export interface ScrollSpyOptions {
  /** The headings to observe, in DOCUMENT ORDER. Each must carry a stable \`id\` — \`onActiveChange\` reports
   *  that id (an id-less heading can never become "active": it has nothing to report). */
  headings: readonly HTMLElement[]
  /** Fired whenever the active heading changes — including to \`null\`, when the scroll position is above
   *  every heading's activation band (e.g. still inside the article's lead, before the first heading). */
  onActiveChange: (id: string | null) => void
  /** The scrolling ancestor IntersectionObserver measures against — \`null\` (default) is the layout
   *  viewport, matching every other consumer's expectation of "the page scroll", per the IntersectionObserver
   *  spec's own default. */
  root?: Element | null
  /** The activation band, an IntersectionObserver \`rootMargin\` string. Defaults to a narrow strip pinned
   *  near the top of the viewport (\`0px 0px -80% 0px\`) — a heading must reach roughly the top 20% of the
   *  viewport before it activates, favoring "what's just been scrolled to" over "what's still below the
   *  fold". */
  rootMargin?: string
  /** Reactively gate the trait — read inside the host's effect (mirrors scroll-fade.ts's \`enabled\`), so
   *  toggling the underlying signal tears the observer down/up live (e.g. suspending scroll-spy while the
   *  compact \`ui-select\` swap is showing and there is no rail to mark). Default: always on. */
  enabled?: () => boolean
}

const DEFAULT_ROOT_MARGIN = '0px 0px -80% 0px'

/** Decide the active heading from the live intersecting-state map, in document order — see the file
 *  banner for the "last intersecting, else nearest already-passed" rule. */
function pickActive(
  headings: readonly HTMLElement[],
  intersecting: ReadonlyMap<HTMLElement, boolean>,
  root: Element | null,
): HTMLElement | null {
  let active: HTMLElement | null = null
  for (const heading of headings) {
    if (intersecting.get(heading)) active = heading // last intersecting wins — document order
  }
  if (active) return active

  // Fallback: nothing currently in the band — the closest heading already scrolled past the ROOT's top
  // edge (\`top <= rootTop\`; the viewport's 0 when \`root\` is null, else the scrolling ancestor's own rect
  // top — the same frame the observer measures in), i.e. the largest \`top\` not exceeding it.
  const rootTop = root?.getBoundingClientRect().top ?? 0
  let bestTop = -Infinity
  for (const heading of headings) {
    const top = heading.getBoundingClientRect().top
    if (top <= rootTop && top > bestTop) {
      bestTop = top
      active = heading
    }
  }
  return active
}

/**
 * Observe \`opts.headings\` and call \`opts.onActiveChange\` with the currently-active heading's \`id\` (or
 * \`null\`) whenever it changes. Invoke from a control's \`connected()\` — e.g. a future \`ui-toc\` — or, for
 * this first slice, directly against an already-connected \`UIElement\` the docs-site TOC recipe already
 * composes (the \`ui-nav-rail\` it marks up as the active item, mirroring \`ui-settings\`' own external-sync
 * shape). Returns \`release()\` for early teardown (idempotent); otherwise the effect (and the observer it
 * installs) is disposed when the host disconnects.
 */
export function scrollSpy(host: UIElement, opts: ScrollSpyOptions): () => void {
  const isEnabled = opts.enabled ?? ((): boolean => true)
  const rootMargin = opts.rootMargin ?? DEFAULT_ROOT_MARGIN
  let lastReported: string | null | undefined // undefined = never reported yet, so the first decision always fires

  const dispose = host.effect(() => {
    if (!isEnabled()) {
      if (lastReported !== null) {
        lastReported = null
        opts.onActiveChange(null)
      }
      return
    }

    const headings = opts.headings
    if (headings.length === 0) return

    const intersecting = new Map<HTMLElement, boolean>()
    const root = opts.root ?? null

    const report = (): void => {
      const active = pickActive(headings, intersecting, root)
      const id = active?.id || null
      if (id === lastReported) return
      lastReported = id
      opts.onActiveChange(id)
    }

    if (typeof IntersectionObserver === 'undefined') {
      // jsdom / a pre-engine environment — no observer available; leave the caller's prior state as-is
      // (the same static-read fallback scroll-fade.ts/ui-settings take when ResizeObserver is absent),
      // never throw.
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) intersecting.set(entry.target as HTMLElement, entry.isIntersecting)
        report()
      },
      { root, rootMargin, threshold: 0 },
    )
    for (const heading of headings) observer.observe(heading)

    return () => observer.disconnect()
  })

  return () => dispose()
}
`;function l(e,t){let n=`export interface ${t} {`,r=e.indexOf(n);if(r===-1)throw Error(`traits-doc: interface "${t}" not found — renamed or removed?`);let i=0,a=r;for(;a<e.length;a++)if(e[a]===`{`)i++;else if(e[a]===`}`&&(i--,i===0)){a++;break}return e.slice(r,a)}function u(e,t){let n=e.indexOf(t);if(n===-1)throw Error(`traits-doc: block starting "${t}" not found — renamed or removed?`);let r=e.indexOf(`

`,n);return e.slice(n,r===-1?e.length:r).trimEnd()}function d(e,t){let n=`export function ${t}(`,r=e.indexOf(n);if(r===-1)throw Error(`traits-doc: function "${t}" not found — renamed or removed?`);let i=e.indexOf(`{`,r);return e.slice(r,i).trim()}function f(e,t){return e.split(`
`).slice(0,t).map(e=>e.replace(/^\/\/ ?/,``)).join(`
`)}function p(...e){let t=document.createElement(`p`);for(let n of e)t.append(typeof n==`string`?document.createTextNode(n):n);return t}function m(e){let t=document.createElement(`code`);return t.textContent=e,t}function h(e,t){let n=document.createElement(`a`);return n.href=e,n.textContent=t,n}function g(e){let t=document.createElement(`ul`);for(let n of e){let e=document.createElement(`li`);e.append(n),t.append(e)}return t}var{content:_}=e({title:`@agent-ui/components — traits`,intro:"Traits are the layer BELOW controls (CLAUDE.md’s Layout section: reactive ← dom ← traits ← controls) — stateless `(host, opts) => cleanup` behaviours (and a couple of stateful controllers) invoked directly from a control’s own `connected()`. Most traits live entirely inside `components/src/traits/` with no subpath export at all; exactly three are published as their own `@agent-ui/components/traits/*` entries for a consumer outside the fleet to reuse directly. This page documents those three, plus the unrelated `./dogfood-frame` asset pair."});_.append(n(2,`What a trait is`)),_.append(p(`Verbatim from the traits barrel’s own banner comment (`,m(`packages/agent-ui/components/src/traits/index.ts`),`):`)),_.append(t(f(a,2))),_.append(p(`There is no `,m(`host.use()`),` registration hook: a control imports the trait function and calls it itself, once, from its own `,m(`connected()`),` — the SAME lifecycle discipline every trait in the tree follows, published or not.`)),_.append(n(2,`The three public subpaths`)),_.append(p(`Read straight from `,m(`@agent-ui/components`),`’s own `,m(`package.json`)," `exports` map — a subpath added or removed there shows up here with zero edits to this page."));{let e=JSON.parse(i),t=Object.entries(e.exports).filter(([e])=>e.startsWith(`./traits/`)),n={"./traits/overlay":`Top-layer, light-dismissable anchored popup positioning — the non-modal overlay controller.`,"./traits/list-reorder":`Pointer-drag + keyboard-fallback list reordering (WCAG 2.2 SC 2.5.7).`,"./traits/scroll-spy":`IntersectionObserver-based heading-activation for a sticky TOC nav.`},r=document.createElement(`table`),a=document.createElement(`thead`),o=document.createElement(`tr`);for(let e of[`Subpath`,`Source`,`What it does`]){let t=document.createElement(`th`);t.textContent=e,o.append(t)}a.append(o),r.append(a);let s=document.createElement(`tbody`);for(let[e,r]of t){let t=document.createElement(`tr`),i=document.createElement(`td`);i.append(m(e));let a=document.createElement(`td`);a.append(m(r.replace(/^\.\//,``)));let o=document.createElement(`td`);o.textContent=n[e]??``,t.append(i,a,o),s.append(t)}r.append(s),_.append(r)}_.append(n(2,`@agent-ui/components/traits/overlay`)),_.append(p(`The non-modal, top-layer positioning controller behind every anchored popup in the fleet — select/combo-box listboxes, menu, popover, form-popover, tooltip, and text-field’s own suggestions panel. A true focus-trapped MODAL stays on `,m(`ui-modal`),`’s own `,m(`<dialog>`),` (`,m(`showModal()`),`); this trait is strictly the non-modal path (overlay-controller.lld.md LLD-C1..C4).`)),_.append(n(3,`OverlayPlacement / OverlayOptions / OverlayHandle — derived from source`)),_.append(t(u(o,`export type OverlayPlacement =`),`ts`)),_.append(t(l(o,`OverlayOptions`),`ts`)),_.append(t(l(o,`OverlayHandle`),`ts`)),_.append(t(d(o,`overlay`),`ts`)),_.append(p(`Consumed by: `,h(`./combo-box-doc.html`,`ui-combo-box`),` · `,h(`./form-popover-doc.html`,`ui-form-popover`),` · `,h(`./menu-doc.html`,`ui-menu`),` · `,h(`./popover-doc.html`,`ui-popover`),` · `,h(`./select-doc.html`,`ui-select`),` · `,h(`./text-field-doc.html`,`ui-text-field`),` · `,h(`./tooltip-doc.html`,`ui-tooltip`),` — seven controls, every one wiring it the same way: one `,m(`overlay(this, opts)`),` call in `,m(`connected()`),`, held as `,m(`this._overlayHandle`),`.`)),_.append(p(`Usage (illustrative — mirrors the real call at `,m(`packages/agent-ui/components/src/controls/popover/popover.ts:92`),`):`)),_.append(t([`import { overlay } from '@agent-ui/components/traits/overlay'`,``,`protected connected(): void {`,`  const handle = overlay(this, {`,`    popup: this.#panel,`,`    anchor: this.#trigger,`,`    placement: 'bottom-start',`,`    auto: true,        // popover=auto — Escape + outside-click light-dismiss`,`    focusOnOpen: true, // move focus into the panel on open`,`  })`,`  this.listen(this.#trigger, 'click', () => handle.toggle())`,`}`].join(`
`),`ts`)),_.append(p(`Live — this `,m(`<ui-tooltip>`),` wires the exact same trait call above (tooltip.ts’s own `,m(`overlay(this, { …, auto: false, focusOnOpen: false })`),`):`));{let e=document.createElement(`ui-tooltip`);e.setAttribute(`placement`,`top-start`);let t=document.createElement(`button`);t.type=`button`,t.textContent=`Hover or focus me`,e.append(t,document.createTextNode(`Positioned + light-dismissed by the overlay trait.`)),_.append(r(`overlay() — live, via ui-tooltip`,e))}_.append(n(2,`@agent-ui/components/traits/list-reorder`)),_.append(p(`Pointer-capture drag with sibling hit-testing plus a keyboard Up/Down fallback (WCAG 2.2 SC 2.5.7 Dragging Movements), both converging on one `,m(`onCommit(from, to)`),` call. No HTML5 Drag-and-Drop API. GH #952, extracted from GH #921’s agent-admin roster mechanics.`)),_.append(n(3,`ListReorderOptions — derived from source`)),_.append(t(u(s,`export type ListReorderOrientation =`),`ts`)),_.append(t(l(s,`ListReorderOptions`),`ts`)),_.append(t(d(s,`listReorder`),`ts`)),_.append(p(`Not re-exported from the components root barrel (a standing 312 B size-budget exception, `,m(`traits/index.ts`),`) — reach it via the subpath. `,`Zero components/src controls consume it today: its one live consumer, repo-wide, is the roster-drag mechanics on `,h(`./agent-admin-app.html`,`the Agent Admin App page`),` (`,m(`site/pages/agent-admin-app.ts:830`),`) — an app-tier page, not a fleet component. Stated plainly rather than staged: this is the trait’s documented first-slice status, not a gap in this page.`)),_.append(n(2,`@agent-ui/components/traits/scroll-spy`)),_.append(p(`IntersectionObserver-based heading-activation for a sticky TOC nav (GH #964, SaaS UX brief §5): watches a fixed list of heading elements and reports which one is “active” (the last heading whose entry currently intersects a narrow activation band near the top of the viewport, falling back to the nearest heading already scrolled past — never blanking mid-article).`)),_.append(n(3,`ScrollSpyOptions — derived from source`)),_.append(t(l(c,`ScrollSpyOptions`),`ts`)),_.append(t(d(c,`scrollSpy`),`ts`)),_.append(p(`Zero components/src controls consume it today either — its one live consumer, repo-wide, is the sticky-TOC composition recipe on `,h(`./toc-content.html`,`the Sticky TOC content layout page`),` (`,m(`site/pages/toc-content.ts:258`),`), which wires a real `,m(`ui-nav-rail`),`/`,m(`ui-select`),` pair to it — the GH #964 mint-last proof that no dedicated `,m(`ui-toc`),` control is needed.`)),_.append(n(2,`@agent-ui/components/dogfood-frame`)),_.append(p(`Unrelated to the traits above — a GENERATED asset pair (`,m(`scripts/build-dogfood-assets.mjs`),`), not a trait: the whole load-bearing docs-page CSS+JS cascade (foundation → component styles → self-defining controls → the Phosphor icon pack), pre-built as one minified IIFE bundle, for `,m(`ui-sandbox-frame`),`’s opt-in "dogfood mode" (SPEC-R12, GH #316/ADR-0162) — a sandboxed iframe that wants the SAME fleet CSS/JS the parent page runs, without re-deriving the cascade inside the frame itself.`)),_.append(p(`The real generated module — regenerate with `,m(`node scripts/build-dogfood-assets.mjs`),` (its own freshness gate, `,m(`dogfood-assets-freshness.test.ts`),`, rebuilds and byte-compares on every test run) — exports three constants, deliberately NOT imported onto this page (that would pull the multi-hundred-kB CSS/JS text into this page’s own bundle):`)),_.append(t(`import { DOGFOOD_CSS, DOGFOOD_JS, DOGFOOD_TAGS } from '@agent-ui/components/dogfood-frame' — the CSS text, the JS text, and DOGFOOD_TAGS (the list of tags the JS bundle self-defines, used by the freshness gate to compare against a fresh rebuild).`,`ts`)),_.append(p(`Consumed by: `,m(`ui-sandbox-frame`),`’s own bootstrap (`,m(`packages/agent-ui/components/src/controls/sandbox-frame/bootstrap.ts`),`) and `,m(`ui-agent-admin`),`’s lazy dogfood-mode loader (`,m(`packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts`),`).`)),_.append(g([p(`See it live: the `,h(`./gen-ui-live.html`,`GenUI Chat Demo`)),p(`and the `,h(`./agent-admin.html`,`Agent Admin`),` guide’s live-apply surfaces.`)]));