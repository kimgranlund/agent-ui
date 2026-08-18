// image-model.ts — the pure, DOM-free math for ui-image (GH #1189 R1/R2): no DOM, no host, unit-testable in
// plain Node/Vitest — the table-model.ts/description-list-model.ts in-folder pure-core split (ADR-0111 cl.8).
// Owns three independent concerns:
//
//   1. `parseAspectRatio` — sanitizes the `aspect` prop's free-form "W/H" string into a value CSS
//      `aspect-ratio` accepts, falling back to `DEFAULT_ASPECT` for anything malformed/absent. The fallback
//      is the ZERO-CLS guarantee (R1): the host ALWAYS resolves to a concrete `aspect-ratio` — never "auto" —
//      so space is reserved before the `<img>` has any natural dimensions to report, whatever the author supplies.
//   2. `usageHintDefaults` — the `usageHint` → native `loading`/`decoding`/`fetchpriority` mapping (R1's
//      lazy-loading contract): `hero` is the one hint whose image is the likely LCP element, so it skips
//      `loading="lazy"` and opts into `fetchpriority="high"`; every other hint lazy-loads (zero-dep, browser-
//      native — no IntersectionObserver machinery, per the ticket).
//   3. The WCAG contrast math (R2's pinned acceptance test): a from-scratch sRGB relative-luminance +
//      contrast-ratio implementation (WCAG 2.x formula), plus `compositeBlackOverWhite`, the ONE compositing
//      case this component's pinned fixture needs (an opaque-black-alpha scrim over a solid #FFFFFF image —
//      black-over-white alpha compositing collapses to `channel = (1 − alpha) × 255` on every channel, so no
//      general alpha-over-arbitrary-color compositor is needed here).

/** The `aspect-ratio` value a bare `<ui-image>` (no `aspect` attribute, or a malformed one) resolves to — the
 *  common content default (a 16:9 hero/card frame) that GUARANTEES zero CLS by always being a concrete ratio,
 *  never "auto" (auto would defer sizing to the image's natural dimensions, which are unknown pre-load). */
export const DEFAULT_ASPECT = '16 / 9'

const ASPECT_RE = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/

/**
 * Parse a free-form `"W/H"` aspect string (`"16/9"`, `"1 / 1"`, `"4/3"`) into a CSS `aspect-ratio`-legal value
 * (`"W / H"`). Anything that fails to parse as two positive, finite numbers — absent, malformed, zero, or
 * negative — falls back to `DEFAULT_ASPECT`, never to `"auto"`: the zero-CLS guarantee holds unconditionally.
 */
export function parseAspectRatio(input: string): string {
  const m = ASPECT_RE.exec(input)
  if (!m) return DEFAULT_ASPECT
  const w = Number(m[1])
  const h = Number(m[2])
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return DEFAULT_ASPECT
  return `${w} / ${h}`
}

/** The `usageHint` enum ui-image accepts (mirrored by image.md's `attributes[].values`). */
export const USAGE_HINTS = ['hero', 'thumb', 'avatar', 'inline'] as const
export type UsageHint = (typeof USAGE_HINTS)[number]

/** The native loading-eagerness triad a given `usageHint` maps to. */
export interface UsageHintLoading {
  loading: 'eager' | 'lazy'
  decoding: 'sync' | 'async'
  /** Present only for `hero` — every other hint omits the attribute entirely (browser default `auto`), rather
   *  than asserting a `low`/`auto` value this component has no real evidence for. */
  fetchPriority?: 'high'
}

/**
 * `usageHint` → the native `<img>` loading defaults (R1). `hero` is the one hint whose image is plausibly the
 * page's LCP element: it never lazy-loads (`loading="eager"`) and opts into `fetchpriority="high"` so the
 * browser's preload scanner prioritizes it. Every other hint (`thumb` / `avatar` / `inline`, and the default
 * when `usageHint` is omitted) lazy-loads (`loading="lazy"`) — the common case for content images below the
 * fold or repeated many-per-page (a gallery of thumbs, a list of avatars). `decoding="async"` always — it
 * never blocks the main thread on decode, independent of loading eagerness.
 */
export function usageHintDefaults(hint: UsageHint): UsageHintLoading {
  if (hint === 'hero') return { loading: 'eager', decoding: 'async', fetchPriority: 'high' }
  return { loading: 'lazy', decoding: 'async' }
}

// ── WCAG contrast math (R2's pinned acceptance test) ─────────────────────────────────────────────────────────

/** sRGB gamma-encoded channel (0–255) → linear-light channel (0–1) — the WCAG 2.x piecewise formula. */
function srgbChannelToLinear(channel255: number): number {
  const c = channel255 / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** WCAG relative luminance of an sRGB triple (each channel 0–255). */
export function relativeLuminance(rgb: readonly [number, number, number]): number {
  const [r, g, b] = rgb
  return 0.2126 * srgbChannelToLinear(r) + 0.7152 * srgbChannelToLinear(g) + 0.0722 * srgbChannelToLinear(b)
}

/** The WCAG contrast ratio between two sRGB triples — order-independent (lighter over darker), range [1, 21]. */
export function contrastRatio(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Alpha-composite an OPAQUE-BLACK wash of the given alpha (0–1) over a solid `#FFFFFF` background — the ONE
 * case this component's pinned fixture needs (R2: "a solid #FFFFFF image behind the scrim gradient"). Because
 * black is `(0,0,0)`, `src·alpha + dst·(1−alpha)` collapses to `(1 − alpha) × 255` on every channel — no
 * general premultiplied-alpha compositor is needed for this one worst-case fixture.
 */
export function compositeBlackOverWhite(alpha: number): readonly [number, number, number] {
  const c = Math.round((1 - alpha) * 255)
  return [c, c, c]
}
