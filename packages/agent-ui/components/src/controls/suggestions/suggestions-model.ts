// suggestions-model.ts — the pure, DOM-free suggestions hardening + codec (ADR-0213 cl.2). No DOM, no
// host, unit-testable in plain Node/Vitest — the description-list-model.ts / table-model.ts in-folder
// pure-core split (ADR-0111 cl.8), applied to the `Suggestions` catalog type's ONE data prop. Owns:
//
//   1. `cleanSuggestions` — the ADR-0201 hardened-data-prop idiom, reused verbatim for this shape: a
//      non-array input is `[]`; an entry survives ONLY as a plain object whose `label` is a non-empty,
//      non-whitespace string. `value` is optional — a missing/blank/non-string `value` DEFAULTS to the
//      (already-validated) `label`, per ADR-0213 cl.2 ("`value` defaults to `label`"). Order preserved
//      (positional; duplicate labels/values both survive — no key identity is imposed, the
//      description-list precedent).
//   2. `suggestionsProp` — the safe JSON codec (the `descriptionRowsProp`/`tableRowsProp` shape
//      verbatim): `from(null)` (attribute absent/removed) is `[]`, NEVER `null`; malformed attribute
//      JSON also falls back to `[]` — no throw ever reaches `attributeChangedCallback`. Every parsed
//      value (well-formed or not) runs through `cleanSuggestions`, so the property never carries an
//      un-hardened array — the enforcement-locus pattern ADR-0201 established and ADR-0213 names as the
//      reused idiom.

import type { PropConfig, PropType } from '../../dom/props.ts'

/** One HARDENED suggestion chip — post-`cleanSuggestions`, both fields are always non-empty strings (a
 *  runtime invariant the hardening guarantees). `#chip` (suggestions.ts) and every other reader of the
 *  cleaned array is typed against THIS shape. */
export interface SuggestionItem {
  label: string
  value: string
}

/** The public INPUT shape — the property/attribute contract a consumer writes (`value` is OPTIONAL and
 *  defaults to `label`, ADR-0213 cl.2). `cleanSuggestions` accepts arbitrary `unknown` at the runtime
 *  boundary regardless (a malformed/foreign entry is simply dropped, never a type error) — this interface
 *  exists only so `static props`' generic parameter, and therefore `el.suggestions`'s WRITE type, matches
 *  what ADR-0213 actually documents as legal input, rather than the stricter post-hardening shape. A
 *  `SuggestionItem` (required `value`) is trivially assignable to `SuggestionInput` (optional `value`), so
 *  `cleanSuggestions`'s hardened return value satisfies the codec's `PropType<SuggestionInput[]>` contract
 *  with zero casts. */
export interface SuggestionInput {
  label: string
  value?: string
}

/** True for a plain object entry (non-null, non-array) — the structural floor an entry must clear
 *  (the description-list-model.ts `isPlainObject` precedent, duplicated per-file by convention — each
 *  control's pure core stays import-free of its siblings). */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Harden an arbitrary input into the rendered suggestion set (ADR-0213 cl.2, the ADR-0201
 * hardened-data-prop idiom): a non-array input yields `[]`; an entry survives only as a plain object
 * with a non-empty, non-whitespace string `label`. `value` defaults to `label` whenever it is absent,
 * not a string, or blank/whitespace-only — every surviving item therefore carries a real, non-empty
 * `value` a consumer can commit through `selected` without ever seeing `''` (which the control reserves
 * to mean "nothing taken yet"). Dropped, never coerced further — a label-less entry can never exist as
 * property state. Order preserved.
 */
export function cleanSuggestions(input: unknown): SuggestionItem[] {
  if (!Array.isArray(input)) return []
  const out: SuggestionItem[] = []
  for (const entry of input) {
    if (!isPlainObject(entry)) continue
    const label = entry.label
    if (typeof label !== 'string' || label.trim() === '') continue
    const rawValue = entry.value
    const value = typeof rawValue === 'string' && rawValue.trim() !== '' ? rawValue : label
    out.push({ label, value })
  }
  return out
}

/**
 * The safe `suggestions` codec (the `descriptionRowsProp`/`tableRowsProp` shape verbatim): `from(null)`
 * → `[]`, malformed JSON → `[]`, never throws; every parse result is hardened by `cleanSuggestions`, so
 * the property never holds a raw, un-hardened array (a direct property write is re-hardened by the
 * render effect calling `cleanSuggestions` again — the description-list.ts case-3 property-write guard,
 * shared shape).
 */
const suggestionsType: PropType<SuggestionInput[]> = {
  from(attr) {
    if (attr === null) return []
    try {
      return cleanSuggestions(JSON.parse(attr))
    } catch {
      return []
    }
  },
  to(value) {
    return JSON.stringify(value)
  },
}

export const suggestionsProp: PropConfig<SuggestionInput[]> = {
  type: suggestionsType,
  default: [],
}
