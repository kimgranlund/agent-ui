// scroll-fade.ts — the edge-aware scroll-fade trait (container box-model revision, ADR-0046 follow-up).
// A scroll viewport with a sticky header/footer bracket (container-box.css) has an inset gutter around the
// bracket — the bracket's own `background: inherit` does not reach the frame edge (the region floats inside,
// ADR-0046 revised 2026-07-04). Scrolled content can therefore show through that thin gutter. The fix is not
// on the bracket: it is on the CONTENT — fade its own edges before they reach the gutter, so nothing hard ever
// shows there. This trait supplies the "which edge" decision; container-box.css supplies the paint
// (`[data-fade-top]`/`[data-fade-bottom]` → a `mask-image` gradient, the same recipe card.css already shipped
// as a static, always-on fade).
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
function bandOf(viewport: HTMLElement, sel: string, top: boolean): string {
  const el = viewport.querySelector(sel)
  if (!(el instanceof HTMLElement)) return '0px'
  const cs = getComputedStyle(el)
  return `${el.offsetHeight + (parseFloat(top ? cs.marginBlockStart : cs.marginBlockEnd) || 0)}px`
}

/** Publish each edge's bracket band as `--ui-box-head`/`--ui-box-foot` — the offset container-box.css extends the
 * fade ramp PAST, so content stays faded until it has cleared a present sticky bracket (a bracketless edge, 0px,
 * fades at the viewport edge). Re-run on resize (a growing bracket/viewport), not on the scroll path. */
function measure(viewport: HTMLElement): void {
  viewport.style.setProperty('--ui-box-head', bandOf(viewport, HEAD, true))
  viewport.style.setProperty('--ui-box-foot', bandOf(viewport, FOOT, false))
}

/** Zero out both fade flags + the published bracket offsets — the "not active" / "not scrollable" state. */
function clear(viewport: HTMLElement): void {
  viewport.removeAttribute('data-fade-top')
  viewport.removeAttribute('data-fade-bottom')
  viewport.style.removeProperty('--ui-box-head')
  viewport.style.removeProperty('--ui-box-foot')
}

/**
 * Toggle `data-fade-top`/`data-fade-bottom` on `viewport` from its live scroll position. Invoke from the
 * control's `connected()` (e.g. `scrollFade(this, { viewport: dialog })`). Returns `release()` for early
 * teardown (idempotent); otherwise the effect (and the listener/observer it installs) is disposed when the
 * host disconnects.
 */
export function scrollFade(host: UIElement, opts: ScrollFadeOptions = {}): () => void {
  const viewport = opts.viewport ?? host
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
      measure(viewport) // the bracket offsets (presence + depth the fade ramp reaches past)
    }
    remeasure() // the at-mount state (no scroll event has fired yet)
    viewport.addEventListener('scroll', update, { passive: true }) // removed explicitly below — no AbortController
    // needed (this trait is not riding host.listen); a plain remove keeps the marginal size down.
    // The viewport's own box can resize independently of scrolling (a max-block-size cap, a card growing) —
    // re-run both the edge decision and the bracket measurement whenever it does (a bracket resize that
    // reflows the viewport rides this too). Feature-detected: every evergreen engine has ResizeObserver, but
    // jsdom (the unit-test environment) does not — the scroll listener above still covers the decision there.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(remeasure) : null
    ro?.observe(viewport)

    return () => {
      viewport.removeEventListener('scroll', update)
      ro?.disconnect()
      clear(viewport)
    }
  })

  return () => dispose()
}
