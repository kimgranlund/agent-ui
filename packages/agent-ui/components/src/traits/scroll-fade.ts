// scroll-fade.ts — the edge-aware scroll-fade trait (container box-model revision, ADR-0046 follow-up).
// A scroll viewport with a sticky header/footer bracket (container-box.css) has an inset gutter around the
// bracket — the bracket's own `background: inherit` does not reach the frame edge (the region floats inside,
// ADR-0046 revised 2026-07-04). Scrolled content can therefore show through that thin gutter. The fix is not
// on the bracket: it is on the CONTENT — fade its own edges before they reach the gutter, so nothing hard ever
// shows there. This trait supplies the "which edge" decision; container-box.css supplies the paint
// (`[data-fade-top]`/`[data-fade-bottom]` → a `mask-image` gradient, the same recipe card.css already shipped
// as a static, always-on fade).
//
// MEASURE vs PAINT can differ (`opts.paintTarget`, added for ui-card, Kim 2026-07-05: "the mask should not be
// placed on the container element — it should be on ui-card-content"): the scroll GEOMETRY (scrollTop/Height/
// clientHeight) reads off `viewport` — the actual overflow:auto element — but the `data-fade-*` flags + the
// published bracket offsets land on `paintTarget`, so the header/footer siblings never carry the mask and stay
// crisp. Defaults to `viewport` (unchanged for every other consumer — modal/select/menu/combo-box all paint the
// same element they measure).
//
// The BRACKET QUERY can differ from BOTH of those too (`opts.brackets`, added 2026-07-06 for ui-card's WRAPPER
// model, Kim via /intent-extract: an author-written `[scroll-wrapper]` child of `ui-card-content` becomes the
// real scroll viewport, nested two levels below the sticky header/footer — which are children of the CARD, not
// of the wrapper). `bandOf()` always queries `brackets`' DIRECT children for the sticky header/footer, wholly
// independent of which element is being measured or painted. Defaults to `viewport` (unchanged for every other
// consumer, where the brackets genuinely are the viewport's own direct children).
//
// PRESENCE-AWARE: the fade must ADAPT to a sticky header/footer — the gradient itself does the occlusion (a
// bracket needs no background; a bit of gradient showing through it is fine), so the ramp reaches PAST a
// present bracket. The trait publishes each edge's bracket band — `--ui-box-head`/`--ui-box-foot`, the
// bracket's rendered block-size + its inset gutter, or 0px when that edge has none — and container-box.css
// lands the ramp's opaque end at that offset + the fade depth. Content thus stays faded until it has cleared
// a present bracket; a bracketless edge (0px) collapses to the exact pre-offset viewport-edge fade.
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
  /** The scrolling viewport to observe — usually `host` itself, sometimes a control-owned part or ancestor. */
  viewport?: HTMLElement
  /**
   * The element that receives the `data-fade-*` flags + the published bracket offsets — defaults to
   * `viewport`. Set this when the element that scrolls is NOT the element the mask should paint on (ui-card:
   * the CARD is the scroll viewport, but the mask must land on `ui-card-content` so the sticky header/footer
   * never carry it).
   */
  paintTarget?: HTMLElement
  /**
   * The element whose DIRECT children are queried for a sticky header/footer bracket — defaults to `viewport`.
   * Set this when the brackets are neither the viewport's nor the paint target's own children (ui-card's
   * wrapper model: `viewport` is the author's `[scroll-wrapper]`, but the header/footer are children of the
   * CARD two levels up).
   */
  brackets?: HTMLElement
  /**
   * Reactively gate the trait — read inside the host's effect, so toggling the underlying signal turns the
   * fade attributes on/off live (and tears down the listener/observer when it goes false). Default: always on.
   */
  enabled?: () => boolean
}

// Direct-child sticky brackets, per the container box-model: a `header`/`footer` (or `[data-region]`) region
// on a `[data-box]` (modal / overlay panels), and `ui-card-header`/`ui-card-footer` on a ui-card viewport.
const HEAD = ':scope > :is(header, [data-region="header"], ui-card-header)'
const FOOT = ':scope > :is(footer, [data-region="footer"], ui-card-footer)'

/** The rendered band a sticky bracket occupies at its edge = its border-box block-size + the inset gutter
 * (its margin to the frame). `'0px'` when that edge has NO bracket — the fade then reaches the viewport edge. */
function bandOf(brackets: HTMLElement, sel: string, top: boolean): string {
  const el = brackets.querySelector(sel)
  if (!(el instanceof HTMLElement)) return '0px'
  const cs = getComputedStyle(el)
  return `${el.offsetHeight + (parseFloat(top ? cs.marginBlockStart : cs.marginBlockEnd) || 0)}px`
}

/** Publish each edge's bracket band as `--ui-box-head`/`--ui-box-foot` on `paint` — the offset container-box.css
 * extends the fade ramp PAST, so content stays faded until it has cleared a present sticky bracket (a
 * bracketless edge, 0px, fades at the viewport edge). The bracket query itself always runs against `brackets`
 * (its direct children — not necessarily `viewport`'s or `paint`'s own). Re-run on resize (a growing bracket/
 * viewport), not on the scroll path. */
function measure(brackets: HTMLElement, paint: HTMLElement): void {
  paint.style.setProperty('--ui-box-head', bandOf(brackets, HEAD, true))
  paint.style.setProperty('--ui-box-foot', bandOf(brackets, FOOT, false))
}

/** Zero out both fade flags + the published bracket offsets on `paint` — the "not active" / "not scrollable" state. */
function clear(paint: HTMLElement): void {
  paint.removeAttribute('data-fade-top')
  paint.removeAttribute('data-fade-bottom')
  paint.style.removeProperty('--ui-box-head')
  paint.style.removeProperty('--ui-box-foot')
}

/**
 * Toggle `data-fade-top`/`data-fade-bottom` on `paintTarget` (default `viewport`) from `viewport`'s live scroll
 * position, with the bracket band queried off `brackets` (default `viewport`). Invoke from the control's
 * `connected()` (e.g. `scrollFade(this, { viewport: dialog })`, or the ui-card wrapper model —
 * `scrollFade(this, { viewport: wrapper, paintTarget: content, brackets: card })` — when the three roles land on
 * three different elements). Returns `release()` for early teardown (idempotent); otherwise the effect (and the
 * listener/observer it installs) is disposed when the host disconnects.
 */
export function scrollFade(host: UIElement, opts: ScrollFadeOptions = {}): () => void {
  const viewport = opts.viewport ?? host
  const paint = opts.paintTarget ?? viewport
  const brackets = opts.brackets ?? viewport
  const isEnabled = opts.enabled ?? ((): boolean => true)

  const dispose = host.effect(() => {
    if (!isEnabled()) {
      clear(paint)
      return
    }

    const update = (): void => {
      const hasOverflow = viewport.scrollHeight > viewport.clientHeight + 1
      const atTop = viewport.scrollTop <= 1
      const atBottom = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 1
      paint.toggleAttribute('data-fade-top', hasOverflow && !atTop)
      paint.toggleAttribute('data-fade-bottom', hasOverflow && !atBottom)
    }

    const remeasure = (): void => {
      update() // the edge decision
      measure(brackets, paint) // the bracket offsets (presence + depth the fade ramp reaches past)
    }
    remeasure() // the at-mount state (no scroll event has fired yet)
    viewport.addEventListener('scroll', update, { passive: true }) // removed explicitly below — no AbortController
    // needed (this trait is not riding host.listen); a plain remove keeps the marginal size down.
    // The viewport's own box can resize independently of scrolling (a max-block-size cap, a card growing) —
    // re-run both the edge decision and the bracket measurement whenever EITHER does (a bracket resize that
    // reflows the viewport rides this too; `brackets` is observed separately since the wrapper model's
    // `brackets` — the card — is a distinct element from `viewport` — the author's wrapper). Feature-detected:
    // every evergreen engine has ResizeObserver, but jsdom (the unit-test environment) does not — the scroll
    // listener above still covers the decision there.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(remeasure) : null
    ro?.observe(viewport)
    if (brackets !== viewport) ro?.observe(brackets)

    return () => {
      viewport.removeEventListener('scroll', update)
      ro?.disconnect()
      clear(paint)
    }
  })

  return () => dispose()
}
