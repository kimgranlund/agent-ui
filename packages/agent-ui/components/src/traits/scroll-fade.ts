// scroll-fade.ts — the edge-aware scroll-fade trait (container box-model revision, ADR-0046 follow-up).
// A scroll viewport with a sticky header/footer bracket (container-box.css) has an inset gutter around the
// bracket — the bracket's own `background: inherit` does not reach the frame edge (the region floats inside,
// ADR-0046 revised 2026-07-04). Scrolled content can therefore show through that thin gutter. The fix is not
// on the bracket: it is on the CONTENT — fade its own edges before they reach the gutter, so nothing hard ever
// shows there. This trait supplies the "which edge" decision; container-box.css supplies the paint
// (`[data-fade-top]`/`[data-fade-bottom]` → a `mask-image` gradient, the same recipe card.css already shipped
// as a static, always-on fade).
//
// The BRACKET QUERY can differ from `viewport` (`opts.brackets`, added 2026-07-06 for ui-card, still needed):
// `bandOf()` queries `brackets`' DIRECT children for the header/footer, independent of which element is being
// measured/painted — ui-card-content IS the scroll viewport (and the masked element, below), but the header/
// footer are the CARD's own direct children, one level up. Defaults to `viewport` (unchanged for every other
// consumer, where the brackets genuinely are the viewport's own direct children).
//
// MEASURE and PAINT are always the SAME element (`viewport`) — a short-lived `opts.paintTarget` split existed
// 2026-07-05/06 for an EARLIER ui-card shape (the card measured, a sibling `ui-card-content` painted; then a
// nested `[scroll-wrapper]` measured while `ui-card-content` painted). REVISED 2026-07-07 (Kim): ui-card-content
// now directly manages its own overflow AND carries the mask — one box, no split — so `paintTarget` is retired
// (no remaining consumer ever set it distinct from `viewport`); this keeps the trait's surface to the two roles
// that are still genuinely independent (`viewport`/`brackets`), not three.
//
// PRESENCE-AWARE: the fade must ADAPT to a sticky/overlaid header/footer — the gradient itself does the
// occlusion (a bracket needs no background; a bit of gradient showing through it is fine), so the ramp reaches
// PAST a present bracket. The trait publishes each edge's bracket band — `--ui-box-head`/`--ui-box-foot`, the
// bracket's rendered block-size + its inset gutter, or 0px when that edge has none — and the consumer's own CSS
// (container-box.css's mask rule, or ui-card-content's own block-padding) reads it. Content thus stays faded
// until it has cleared a present bracket; a bracketless edge (0px) collapses to the exact pre-offset fade/padding.
//
// EDGE-AWARE, not symmetric: a flag is present only when content is genuinely hidden past THAT edge — a short
// / non-scrolling viewport gets neither flag (never faded), and an at-top/at-bottom viewport only fades the
// edge that still hides something.
//
// Deliberately JS-driven, not `animation-timeline: scroll()`: the decision is three comparisons against
// scrollTop/scrollHeight/clientHeight — trivially unit-testable in jsdom and immune to scroll-driven-animation
// engine-support gaps. The PAINT it drives is the well-proven `mask-image` mechanism already shipped (card.css).
//
// Reactive gate (mirrors tabbable.ts's `disabled: () => boolean` shape): `opts.enabled` is read inside the
// host's own `host.effect`, so an author-facing opt-in prop (e.g. ui-card-content's `scroll-fade`) can turn the
// whole mechanism on/off live. Omit it for an always-on internal viewport (a modal dialog, an overlay panel).
//
// `traits → dom` is the one allowed cross-layer direction; the host type only.

import type { UIElement } from '../dom/index.ts'

export interface ScrollFadeOptions {
  /**
   * The scrolling viewport — measured (scrollTop/Height/clientHeight) AND painted (the `data-fade-*` flags +
   * the published bracket offsets all land here). Usually `host` itself, sometimes a control-owned part.
   */
  viewport?: HTMLElement
  /**
   * The element whose DIRECT children are queried for a header/footer bracket — defaults to `viewport`. Set
   * this when the brackets are NOT the viewport's own children (ui-card: `viewport` is `ui-card-content`
   * itself, but the header/footer are the CARD's direct children, one level up).
   */
  brackets?: HTMLElement
  /**
   * Reactively gate the trait — read inside the host's effect, so toggling the underlying signal turns the
   * fade attributes on/off live (and tears down the listener/observer when it goes false). Default: always on.
   */
  enabled?: () => boolean
}

// Direct-child brackets, per the container box-model: a `header`/`footer` (or `[data-region]`) region on a
// `[data-box]` (modal / overlay panels), and `ui-card-header`/`ui-card-footer` on the ui-card that hosts a
// `ui-card-content` viewport.
const HEAD = ':scope > :is(header, [data-region="header"], ui-card-header)'
const FOOT = ':scope > :is(footer, [data-region="footer"], ui-card-footer)'

/** The rendered band a bracket occupies at its edge = its border-box block-size + the inset gutter (its margin
 * to the frame). `'0px'` when that edge has NO bracket — the fade/padding then reaches the viewport edge. */
function bandOf(brackets: HTMLElement, sel: string, top: boolean): string {
  const el = brackets.querySelector(sel)
  if (!(el instanceof HTMLElement)) return '0px'
  const cs = getComputedStyle(el)
  return `${el.offsetHeight + (parseFloat(top ? cs.marginBlockStart : cs.marginBlockEnd) || 0)}px`
}

/** Publish each edge's bracket band as `--ui-box-head`/`--ui-box-foot` on `viewport` — the offset a consumer's
 * CSS extends the fade ramp (or its own block-padding) PAST, so content stays clear of / faded until it has
 * cleared a present bracket (a bracketless edge, 0px, collapses to the plain depth). The bracket query itself
 * always runs against `brackets` (its direct children — not necessarily `viewport`'s own). Re-run on resize (a
 * growing bracket/viewport), not on the scroll path. */
function measure(brackets: HTMLElement, viewport: HTMLElement): void {
  viewport.style.setProperty('--ui-box-head', bandOf(brackets, HEAD, true))
  viewport.style.setProperty('--ui-box-foot', bandOf(brackets, FOOT, false))
}

/** Zero out both fade flags + the published bracket offsets on `viewport` — the "not active" / "not scrollable" state. */
function clear(viewport: HTMLElement): void {
  viewport.removeAttribute('data-fade-top')
  viewport.removeAttribute('data-fade-bottom')
  viewport.style.removeProperty('--ui-box-head')
  viewport.style.removeProperty('--ui-box-foot')
}

/**
 * Toggle `data-fade-top`/`data-fade-bottom` on `viewport` from its own live scroll position, with the bracket
 * band queried off `brackets` (default `viewport`). Invoke from the control's `connected()` (e.g.
 * `scrollFade(this, { viewport: dialog })`, or ui-card's `scrollFade(this, { brackets: card })` when the
 * viewport IS the host but the brackets live on a distinct ancestor). Returns `release()` for early teardown
 * (idempotent); otherwise the effect (and the listener/observer it installs) is disposed when the host
 * disconnects.
 */
export function scrollFade(host: UIElement, opts: ScrollFadeOptions = {}): () => void {
  const viewport = opts.viewport ?? host
  const brackets = opts.brackets ?? viewport
  const isEnabled = opts.enabled ?? ((): boolean => true)

  const dispose = host.effect(() => {
    if (!isEnabled()) {
      clear(viewport)
      return
    }

    const update = (): void => {
      const hasOverflow = viewport.scrollHeight > viewport.clientHeight + 1
      const atTop = viewport.scrollTop <= 1
      const atBottom = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 1
      viewport.toggleAttribute('data-fade-top', hasOverflow && !atTop)
      viewport.toggleAttribute('data-fade-bottom', hasOverflow && !atBottom)
    }

    const remeasure = (): void => {
      update() // the edge decision
      measure(brackets, viewport) // the bracket offsets (presence + depth the fade ramp reaches past)
    }
    remeasure() // the at-mount state (no scroll event has fired yet)
    viewport.addEventListener('scroll', update, { passive: true }) // removed explicitly below — no AbortController
    // needed (this trait is not riding host.listen); a plain remove keeps the marginal size down.
    // The viewport's own box can resize independently of scrolling (a max-block-size cap, a card growing) —
    // re-run both the edge decision and the bracket measurement whenever EITHER does (a bracket resize that
    // reflows the viewport rides this too; `brackets` is observed separately since it can be a distinct element
    // from `viewport`, e.g. ui-card). Feature-detected: every evergreen engine has ResizeObserver, but jsdom
    // (the unit-test environment) does not — the scroll listener above still covers the decision there.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(remeasure) : null
    ro?.observe(viewport)
    if (brackets !== viewport) ro?.observe(brackets)

    return () => {
      viewport.removeEventListener('scroll', update)
      ro?.disconnect()
      clear(viewport)
    }
  })

  return () => dispose()
}
