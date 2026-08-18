// description-list-model.ts — the pure, DOM-free receipt math (ADR-0201 cl.2/cl.3). No DOM, no host,
// unit-testable in plain Node/Vitest — the table-model.ts/stat-model.ts in-folder pure-core split
// (ADR-0111 cl.8). Owns:
//
//   1. Input hardening (`cleanDescriptionRows`, ADR-0201 cl.3 — the EMPTY-VALUE OMISSION LAW, by
//      construction): a non-array input is `[]`; an entry survives ONLY as a plain object whose `label`
//      is a non-empty, non-whitespace string AND whose `value` is a non-empty, non-whitespace string or
//      a finite number. Everything else — absent/null value, empty/whitespace string, boolean, NaN/±∞,
//      object, array — DROPS the row, never coerces it (a boolean `value` dropping is deliberate: the
//      humanization law says the PRODUCER renders Yes/No; the component never repairs the violation
//      silently, it refuses to render the raw literal). Order preserved (positional).
//   2. `formatRowValue` — a surviving string passes through VERBATIM (humanization is the producer's
//      job, the #1174 law unchanged); a surviving finite number prints via the shared module-memoized
//      default-locale `Intl.NumberFormat` (the table/stat/chart-family printed-value precedent).
//   3. `descriptionRowsProp`, the safe JSON codec (the `tableRowsProp` shape verbatim): `from(null)`
//      (attribute absent/removed) is `[]`, NEVER `null`; malformed attribute JSON is caught and also
//      falls back to `[]` — no throw ever reaches `attributeChangedCallback`; every parsed value (well-
//      formed or not) runs through `cleanDescriptionRows`, so the property never carries an un-hardened
//      array. `dom/props.ts`'s generic `jsonType<T>()` is deliberately NOT used — its bare `JSON.parse`
//      throws on malformed attributes and maps a removed attribute to `null` (the exact reasoning
//      table-model.ts records for its own codecs).

import type { PropConfig, PropType } from '../../dom/props.ts'

/** One receipt row — a label with its value. The SAME shape serves the public input contract (`value`
 *  may arrive as anything; the hardening judges it) and the rendered set (post-`cleanDescriptionRows`,
 *  `value` is always a non-empty string or a finite number — a runtime invariant the hardening
 *  guarantees). */
export interface DescriptionRow {
  label: string
  value: string | number
}

/** True for a plain object entry (non-null, non-array) — the structural floor an entry must clear. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Harden an arbitrary input into the rendered row set (ADR-0201 cl.3 — the empty-value omission law, BY
 * CONSTRUCTION): a non-array input yields `[]`; an entry survives only as a plain object with a
 * non-empty, non-whitespace string `label` AND a `value` that is a non-empty, non-whitespace string or a
 * finite number. Dropped, never coerced — a valueless field can never exist as property state, so an
 * empty row is unrepresentable downstream. Order preserved (positional; duplicate labels both survive —
 * the component imposes no key identity).
 */
export function cleanDescriptionRows(input: unknown): DescriptionRow[] {
  if (!Array.isArray(input)) return []
  const out: DescriptionRow[] = []
  for (const entry of input) {
    if (!isPlainObject(entry)) continue
    const label = entry.label
    const value = entry.value
    if (typeof label !== 'string' || label.trim() === '') continue
    if (typeof value === 'string') {
      if (value.trim() === '') continue // the omission law — an empty/whitespace value never renders
      out.push({ label, value })
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      out.push({ label, value })
    }
    // every other value shape (absent, null, boolean, NaN/±∞, object, array) drops the row
  }
  return out
}

/** Module-memoized default-locale formatter — the exact text every finite-number value prints. */
const numberFormat = new Intl.NumberFormat()

/** A surviving string passes through VERBATIM (humanization is the producer's job, ADR-0201 cl.3); a
 *  surviving finite number prints via the shared default-locale `Intl.NumberFormat`. */
export function formatRowValue(value: string | number): string {
  return typeof value === 'string' ? value : numberFormat.format(value)
}

/**
 * The safe `rows` codec (the `tableRowsProp` shape verbatim): `from(null)` → `[]`, malformed JSON → `[]`,
 * never throws; every parse result is hardened by `cleanDescriptionRows`, so the property never holds a
 * raw, un-hardened array (a direct property write is re-hardened by the render effect calling
 * `cleanDescriptionRows` again — the table.ts effects' own case-3 guard, shared function each).
 */
const rowsType: PropType<DescriptionRow[]> = {
  from(attr) {
    if (attr === null) return []
    try {
      return cleanDescriptionRows(JSON.parse(attr))
    } catch {
      return []
    }
  },
  to(value) {
    return JSON.stringify(value)
  },
}

export const descriptionRowsProp: PropConfig<DescriptionRow[]> = {
  type: rowsType,
  default: [],
}
