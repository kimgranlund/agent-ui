// stat-model.ts — the pure, DOM-free math for `ui-stat` (LLD-C4, report-family.lld.md §3; SPEC-R7/R9;
// ADR-0111). Everything here is a plain function over strings/numbers — no DOM, no signals,
// unit-testable without a browser (the sparkline-math.ts / bar-math.ts pure-core precedent).
//
// `formatStatValue` (SPEC-R7): a finite number formats via the module-memoized default-locale
// Intl.NumberFormat (the chart-family printed-value discipline); a non-finite number renders the
// placeholder em dash; a string passes through verbatim (the author's own pre-formatted text, e.g.
// "$1.2M" — no coercion, ever).
//
// `deltaParts` (SPEC-R9): the delta region announces DIRECTION, never valence — a `dir` (drives the CSS
// glyph orientation), a `word` (the real, visually-hidden-but-announced text: "up"/"down"/"unchanged"),
// and `text` (the Intl-formatted signed number, `signDisplay: 'exceptZero'` so 0 prints bare and ±N carry
// an explicit sign). `null` for any non-number/non-finite input — the delta region is not rendered at all
// (never a silent throw, never a fabricated direction for garbage input).
//
// `ringPercent` (GH#1208, the donut/progress-ring `variant='ring'` addition, req-a2ui-library.md item 7):
// the render-BOUNDARY clamp into [0,100] — mirrors the sparkline `cleanSeries` / bar-chart precedent of
// re-guarding at render time, since a PROPERTY write (`el.percent = 150`) bypasses `statPercentProp`'s
// `from` codec entirely (the codec only guards the ATTRIBUTE crossing, same asymmetry `badge`'s `intent`
// hardening documents). Never a thrown error, never an over/under-full arc — a non-number/non-finite
// input degrades to 0 (an empty track), same "absent ⇒ nothing fabricated" law as `deltaParts`.

import type { PropConfig } from '../../dom/props.ts'

const numberFormat = new Intl.NumberFormat() // module-memoized default-locale formatter (SPEC-R7)
const signedNumberFormat = new Intl.NumberFormat(undefined, { signDisplay: 'exceptZero' }) // SPEC-R9

/** The SPEC-R7 value rendering: finite number → Intl-formatted; non-finite number → the placeholder `—`
 *  (U+2014); string → verbatim passthrough (the author controls formatting for non-numeric values). */
export function formatStatValue(value: string | number): string {
  if (typeof value === 'number') return Number.isFinite(value) ? numberFormat.format(value) : '—'
  return value
}

export interface DeltaParts {
  dir: 'up' | 'down' | 'flat' // sign class (SPEC §2 Direction); 'flat' ⇔ delta === 0 — drives the CSS glyph
  word: 'up' | 'down' | 'unchanged' // the announced direction word (SPEC-R9) — real, visually-hidden text
  text: string // Intl.NumberFormat({ signDisplay: 'exceptZero' }) — '+12' / '-3' / '0'
}

/** null for any non-number / non-finite input — the delta region is not rendered at all (SPEC-R7 AC3). */
export function deltaParts(delta: unknown): DeltaParts | null {
  if (typeof delta !== 'number' || !Number.isFinite(delta)) return null
  const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  const word = delta > 0 ? 'up' : delta < 0 ? 'down' : 'unchanged'
  return { dir, word, text: signedNumberFormat.format(delta) }
}

/**
 * The safe `value` codec (SPEC-R7): `from(attr)`: `null` (attribute absent) → `''`; a TRIMMED attribute
 * that parses to a FINITE number → that number (so `value="48200"` formats); anything else → the
 * verbatim, untrimmed attribute string (so `value="$1.2M"` passes through unchanged). Property writes
 * keep whatever runtime type the author assigns — this codec only guards the ATTRIBUTE crossing.
 */
export const statValueProp: PropConfig<string | number> = {
  type: {
    from(attr) {
      if (attr === null) return ''
      const trimmed = attr.trim()
      const n = Number(trimmed)
      return trimmed !== '' && Number.isFinite(n) ? n : attr
    },
    to(value) {
      return String(value)
    },
  },
  default: '',
}

/** The safe `delta` codec (SPEC-R7): `from(attr)`: `null` → `null`; `parseFloat`; non-finite → `null`
 *  (never `NaN` reaches the render path — `deltaParts` would already guard it, but the codec stays
 *  honest at the boundary too, the chart-family safe-codec discipline). */
export const statDeltaProp: PropConfig<number | null> = {
  type: {
    from(attr) {
      if (attr === null) return null
      const n = Number.parseFloat(attr)
      return Number.isFinite(n) ? n : null
    },
    to(value) {
      return value === null ? null : String(value)
    },
  },
  default: null,
}

/**
 * The safe `percent` codec (GH#1208, `variant='ring'` completion, 0–100): `from(attr)`: `null` → `null`;
 * `parseFloat`; non-finite → `null`; a finite value clamps into [0,100] at the attribute boundary too (an
 * author-supplied `percent="140"` is not a design input to trust literally — clamp, never an over-full
 * arc). Deliberately mirrors `statDeltaProp`'s NULL-default shape rather than a plain `prop.number(0)`:
 * the LLD-C9 `kindOf` build-verify note (stat-descriptor.test.ts) — a non-null-defaulting number codec
 * classifies as `'unknown'`, not `'number'` (component-descriptor.ts's `kindOf` keys the number branch off
 * `from(null) === null`) — so `percent` stays `number | null`, `variant='ring'` with `percent` absent
 * rendering an empty (0%) track via `ringPercent` below, never a thrown error.
 */
export const statPercentProp: PropConfig<number | null> = {
  type: {
    from(attr) {
      if (attr === null) return null
      const n = Number.parseFloat(attr)
      if (!Number.isFinite(n)) return null
      return Math.min(100, Math.max(0, n))
    },
    to(value) {
      return value === null ? null : String(value)
    },
  },
  default: null,
}

/** Render-boundary clamp (see the header note above): `null`/non-finite → `0` (an empty track, never a
 *  thrown error); a finite value clamps into [0,100] (guards a raw PROPERTY write the codec never saw). */
export function ringPercent(percent: unknown): number {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) return 0
  return Math.min(100, Math.max(0, percent))
}
