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
