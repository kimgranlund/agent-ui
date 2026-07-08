// bar-math.ts — the pure, DOM-free bar-chart math (LLD-C4, chart-family.lld.md §3). No DOM, no host,
// unit-testable in plain Node/Vitest. Owns three things:
//
//   1. Input hardening (`cleanData`, SPEC-R7): a non-array input is `[]`; an entry survives only as a
//      plain object carrying a `string` `label` and a finite `number` `value` — dropped, never coerced.
//      Order is preserved (positional semantics — SPEC-R7's duplicate-label row: the list is positional,
//      not keyed).
//   2. The zero-baseline diverging bar math (`barRows`, SPEC-R6): `lo = min(0, …values)`,
//      `hi = max(0, …values)`, `span = hi − lo`. `span === 0` (the all-zero case; the empty case is an
//      early return) ⇒ every row is zero-length — the printed `0`s carry the reading. Else
//      `zeroPct = (−lo / span) · 100` (the ONE shared origin every row measures from — SPEC-R6 AC2);
//      `lengthPct = |v| / span · 100`; `startPct = v ≥ 0 ? zeroPct : zeroPct − lengthPct`. All-positive ⇒
//      `lo = 0`, bars measure from the inline-start edge (SPEC-R7 rows 3/4); all-negative ⇒ `hi = 0`, the
//      zero point sits at the track's inline-end (SPEC-R7 row 7); mixed sign ⇒ every bar shares the one
//      `zeroPct` (SPEC-R6 AC2). Every printed value rides a module-memoized default-locale
//      `Intl.NumberFormat` — sign preserved for free (no special-casing negative text).
//   3. `barDataProp`, the safe `data` codec (SPEC-R7 row 1/2): `from(null)` (attribute absent/removed) is
//      `[]`, NEVER `null`; malformed attribute JSON is caught and also falls back to `[]` — no throw ever
//      reaches `attributeChangedCallback`. `dom/props.ts`'s generic `jsonType<T>()` is deliberately NOT
//      used here — its bare `JSON.parse` throws on malformed attributes and maps a removed attribute to
//      `null` (props.ts:73-82), both of which SPEC-R7 forbids reaching the render path. This is the exact
//      reasoning LLD-C1 (sparkline's `sparklineValuesProp`) states for its own codec — the two controls
//      share the construction (chart-family.lld.md §3 LLD-C4: "same construction as LLD-C1's").

import type { PropConfig, PropType } from '../../dom/props.ts'

/** One bar-chart datum — the A2UI-emittable shape (SPEC-R5): `{ label: string; value: number }`. */
export interface BarDatum {
  label: string
  value: number
}

/** A rendered row: the datum plus its printed text + zero-baseline geometry (each 0..100, a percentage). */
export interface BarRow extends BarDatum {
  /** The locale-formatted printed value (Intl.NumberFormat, default locale; sign preserved). */
  text: string
  /** Fill inset from the track's inline-start, 0..100 (%). */
  startPct: number
  /** Fill length, 0..100 (%). */
  lengthPct: number
}

/**
 * Harden an arbitrary input into the rendered datum set (SPEC-R7): a non-array input yields `[]`; each
 * entry survives only as a plain object with a `string` `label` and a finite `number` `value` — drop,
 * never coerce (a stringly `"42"` value, a missing label, `NaN`/`Infinity` all drop the entry). Order is
 * preserved — the rendered list is positional, not keyed (SPEC-R7's duplicate-label row: both rows render).
 */
export function cleanData(input: unknown): BarDatum[] {
  if (!Array.isArray(input)) return []
  const out: BarDatum[] = []
  for (const entry of input) {
    if (
      entry !== null &&
      typeof entry === 'object' &&
      !Array.isArray(entry) &&
      typeof (entry as { label?: unknown }).label === 'string' &&
      typeof (entry as { value?: unknown }).value === 'number' &&
      Number.isFinite((entry as { value?: unknown }).value)
    ) {
      const e = entry as { label: string; value: number }
      out.push({ label: e.label, value: e.value })
    }
  }
  return out
}

/** Module-memoized default-locale formatter — the exact numbers `barRows` prints (SPEC-R6/R4's sibling rule). */
const numberFormat = new Intl.NumberFormat()

/**
 * The zero-baseline diverging bar math (SPEC-R6 + LLD-C4): `lo = min(0, …values)`, `hi = max(0, …values)`,
 * `span = hi − lo`. Empty input is an early `[]` (the codec/hardening boundary handles absence — this
 * function is never asked to normalize zero rows). `span === 0` (the all-zero case) ⇒ every row is
 * `startPct = lengthPct = 0`. Else `zeroPct = (−lo / span) · 100` is the ONE shared origin every row
 * measures from; `lengthPct = |v| / span · 100`; `startPct = v ≥ 0 ? zeroPct : zeroPct − lengthPct`.
 */
export function barRows(data: readonly BarDatum[]): BarRow[] {
  if (data.length === 0) return []
  let lo = 0
  let hi = 0
  for (const d of data) {
    if (d.value < lo) lo = d.value
    if (d.value > hi) hi = d.value
  }
  const span = hi - lo
  // `lo === 0` short-circuits to a literal `0` rather than `(-0 / span) * 100` — IEEE754 would otherwise
  // hand back a NEGATIVE zero (`-0`) for the common all-positive case, which is numerically identical but
  // needlessly surprising downstream (e.g. a strict `Object.is`-based equality check on the row's startPct).
  const zeroPct = span === 0 || lo === 0 ? 0 : (-lo / span) * 100
  return data.map((d) => {
    const text = numberFormat.format(d.value)
    if (span === 0) return { ...d, text, startPct: 0, lengthPct: 0 }
    const lengthPct = (Math.abs(d.value) / span) * 100
    const startPct = d.value >= 0 ? zeroPct : zeroPct - lengthPct
    return { ...d, text, startPct, lengthPct }
  })
}

/**
 * The safe `data` codec (SPEC-R7 row 1/2): `from(null)` (the attribute absent/removed) → `[]`, never
 * `null`; malformed attribute JSON is caught and also falls back to `[]` — no throw ever reaches
 * `attributeChangedCallback`. Every parsed value (well-formed or not) is run through `cleanData`, so the
 * property never carries a raw, un-hardened array — the codec and the SPEC-R7/case-3 property-write guard
 * (bar-chart.ts's rows effect calls `cleanData(this.data)` again) share the one hardening function.
 */
const barDataType: PropType<BarDatum[]> = {
  from(attr) {
    if (attr === null) return []
    try {
      return cleanData(JSON.parse(attr))
    } catch {
      return []
    }
  },
  to(value) {
    return JSON.stringify(value)
  },
}

export const barDataProp: PropConfig<BarDatum[]> = {
  type: barDataType,
  default: [],
}
