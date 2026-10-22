// option-compare-model.ts: the pure, DOM-free hardening for ui-option-compare (T-0393, the Option compare forks
// 10 to 16 in .sdlc/tickets/.0199-itinerary-compare/handoff.md). No DOM, no host, unit-testable in plain Node (the
// option-deck-model.ts in-folder split). Owns:
//
//   1. `cleanOptions`: a non-array is `[]`; a non-object entry is dropped; an entry without a non-empty `value`
//      or `title` is dropped, and so is a repeat of an earlier `value` (one column per key). `values` keeps only
//      its string and finite-number entries, each trimmed; a missing or malformed `values` is `{}`, so every
//      cell of that column renders empty.
//   2. `cleanRows`: the same array and entry rules for the attribute rows; an entry needs a non-empty `key` and
//      `label`, and a repeated `key` is dropped.
//   3. `optionsProp` and `rowsProp`: the safe JSON codecs. A removed attribute or malformed JSON falls back to
//      `[]` and never throws into attributeChangedCallback. A property write bypasses the codec, so
//      option-compare.ts re-cleans every value on the render path.

import type { PropConfig, PropType } from '../../dom/props.ts'

/** One option as an author or agent writes it. Every field may arrive malformed; the cleaner judges it. */
export interface OptionCompareOption {
  value?: unknown
  title?: unknown
  subtitle?: unknown
  values?: unknown
}

/** One attribute row as an author or agent writes it. */
export interface OptionCompareRow {
  key?: unknown
  label?: unknown
}

/** One option after hardening: display-ready strings, `subtitle` present only when real. */
export interface CleanOption {
  value: string
  title: string
  subtitle?: string
  values: Record<string, string>
}

/** One attribute row after hardening. */
export interface CleanRow {
  key: string
  label: string
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** A trimmed non-empty string, a finite number as its digits, anything else `undefined`. */
function text(raw: unknown): string | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw)
  if (typeof raw !== 'string') return undefined
  const t = raw.trim()
  return t === '' ? undefined : t
}

/** Harden an arbitrary input into display-ready options, in order. */
export function cleanOptions(input: unknown): CleanOption[] {
  if (!Array.isArray(input)) return []
  const out: CleanOption[] = []
  const seen = new Set<string>()
  for (const entry of input) {
    if (!isPlainObject(entry)) continue
    const value = text(entry.value)
    const title = text(entry.title)
    if (value === undefined || title === undefined || seen.has(value)) continue
    seen.add(value)
    const values: Record<string, string> = {}
    if (isPlainObject(entry.values)) {
      for (const [key, raw] of Object.entries(entry.values)) {
        const cell = text(raw)
        if (cell !== undefined) values[key] = cell
      }
    }
    const option: CleanOption = { value, title, values }
    const subtitle = text(entry.subtitle)
    if (subtitle !== undefined) option.subtitle = subtitle
    out.push(option)
  }
  return out
}

/** Harden an arbitrary input into the attribute rows, in order. */
export function cleanRows(input: unknown): CleanRow[] {
  if (!Array.isArray(input)) return []
  const out: CleanRow[] = []
  const seen = new Set<string>()
  for (const entry of input) {
    if (!isPlainObject(entry)) continue
    const key = text(entry.key)
    const label = text(entry.label)
    if (key === undefined || label === undefined || seen.has(key)) continue
    seen.add(key)
    out.push({ key, label })
  }
  return out
}

/** A JSON-array codec over `clean`: `null` and malformed JSON read as `[]`. */
function jsonArray<T>(clean: (input: unknown) => unknown[]): PropType<T[]> {
  return {
    from(attr) {
      if (attr === null) return []
      try {
        return clean(JSON.parse(attr)) as T[]
      } catch {
        return []
      }
    },
    to(value) {
      return JSON.stringify(value)
    },
  }
}

export const optionsProp: PropConfig<OptionCompareOption[]> = {
  type: jsonArray<OptionCompareOption>(cleanOptions),
  default: [],
}

export const rowsProp: PropConfig<OptionCompareRow[]> = {
  type: jsonArray<OptionCompareRow>(cleanRows),
  default: [],
}
