// scroll-spy.ts — the heading-observation trait for a sticky TOC nav (GH #964, SaaS UX brief §5, first
// slice). Watches a fixed list of heading elements and reports which one is "active" (the current read
// position) — the standard scroll-spy contract a TOC composition recipe (ui-nav-rail/ui-select over a
// long-form article, GH #964's mint-last recipe — no `ui-toc` control minted) wires into its own
// active-item marking, the SAME external-sync shape `ui-settings` already uses to keep its rail and its
// compact-band `ui-select` twin in lock-step (GH #962 `#markActiveRailItem`).
//
// IntersectionObserver, not a scroll listener: a heading crosses a narrow "activation band" near the top
// of the viewport (`opts.rootMargin`) and the observer fires only on that crossing — no per-frame scroll
// math (unlike scroll-fade.ts's edge trait, which genuinely needs continuous scrollTop/scrollHeight
// comparison for its fade ramps; this trait needs only "did a heading's crossing state change").
// Feature-detected (`typeof IntersectionObserver !== 'undefined'`), the same jsdom/pre-engine guard
// scroll-fade.ts's ResizeObserver use takes — jsdom (the unit-test environment) implements neither API.
//
// ACTIVE = the LAST heading (in document order) whose entry is currently intersecting the band — the
// topmost heading that has already been scrolled up to (or past) the band's leading edge, biased toward
// the one closest to it. IntersectionObserver entries are DELTA-only (a callback reports only the targets
// whose intersection state just changed, never a full snapshot) — the trait keeps its own live map of
// every observed heading's last-known state so `pickActive()` always decides from the CURRENT whole
// picture, not just the entries this callback happened to report.
//
// FALLBACK: nothing intersecting (above the first heading's band, or scrolled between two headings whose
// bands don't overlap at that particular scroll position) never blanks the active id — it falls back to
// the nearest heading already scrolled past (`getBoundingClientRect().top <= 0`), so a TOC never shows
// "nothing selected" mid-article.
//
// `traits → dom` is the one allowed cross-layer direction (reactive ← dom ← traits); the host type only.

import type { UIElement } from '../dom/index.ts'

export interface ScrollSpyOptions {
  /** The headings to observe, in DOCUMENT ORDER. Each must carry a stable `id` — `onActiveChange` reports
   *  that id (an id-less heading can never become "active": it has nothing to report). */
  headings: readonly HTMLElement[]
  /** Fired whenever the active heading changes — including to `null`, when the scroll position is above
   *  every heading's activation band (e.g. still inside the article's lead, before the first heading). */
  onActiveChange: (id: string | null) => void
  /** The scrolling ancestor IntersectionObserver measures against — `null` (default) is the layout
   *  viewport, matching every other consumer's expectation of "the page scroll", per the IntersectionObserver
   *  spec's own default. */
  root?: Element | null
  /** The activation band, an IntersectionObserver `rootMargin` string. Defaults to a narrow strip pinned
   *  near the top of the viewport (`0px 0px -80% 0px`) — a heading must reach roughly the top 20% of the
   *  viewport before it activates, favoring "what's just been scrolled to" over "what's still below the
   *  fold". */
  rootMargin?: string
  /** Reactively gate the trait — read inside the host's effect (mirrors scroll-fade.ts's `enabled`), so
   *  toggling the underlying signal tears the observer down/up live (e.g. suspending scroll-spy while the
   *  compact `ui-select` swap is showing and there is no rail to mark). Default: always on. */
  enabled?: () => boolean
}

const DEFAULT_ROOT_MARGIN = '0px 0px -80% 0px'

/** Decide the active heading from the live intersecting-state map, in document order — see the file
 *  banner for the "last intersecting, else nearest already-passed" rule. */
function pickActive(
  headings: readonly HTMLElement[],
  intersecting: ReadonlyMap<HTMLElement, boolean>,
): HTMLElement | null {
  let active: HTMLElement | null = null
  for (const heading of headings) {
    if (intersecting.get(heading)) active = heading // last intersecting wins — document order
  }
  if (active) return active

  // Fallback: nothing currently in the band — the closest heading already scrolled past (top <= 0),
  // i.e. the smallest negative `top` (closest to 0).
  let bestTop = -Infinity
  for (const heading of headings) {
    const top = heading.getBoundingClientRect().top
    if (top <= 0 && top > bestTop) {
      bestTop = top
      active = heading
    }
  }
  return active
}

/**
 * Observe `opts.headings` and call `opts.onActiveChange` with the currently-active heading's `id` (or
 * `null`) whenever it changes. Invoke from a control's `connected()` — e.g. a future `ui-toc` — or, for
 * this first slice, directly against an already-connected `UIElement` the docs-site TOC recipe already
 * composes (the `ui-nav-rail` it marks up as the active item, mirroring `ui-settings`' own external-sync
 * shape). Returns `release()` for early teardown (idempotent); otherwise the effect (and the observer it
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

    const report = (): void => {
      const active = pickActive(headings, intersecting)
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
      { root: opts.root ?? null, rootMargin, threshold: 0 },
    )
    for (const heading of headings) observer.observe(heading)

    return () => observer.disconnect()
  })

  return () => dispose()
}
