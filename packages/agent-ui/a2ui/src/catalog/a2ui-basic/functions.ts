// functions.ts — a2ui-basic client-side function implementations (ADR-0169 cl.11/cl.8).
//
// Upstream A2UI v0.9.1's `functions` block is schema-pinned to a BOOLEAN return dialect
// (`returnType: const "boolean"` on every validator, so results compose under `and`/`or`/`not`) — a
// different dialect from the default catalog's `{valid, message?}` shape (`catalog/functions.ts`).
// Registered per-catalog (cl.8, `Registry.register`'s third param) so the two dialects can share
// function NAMES (`required`/`regex`/`email`) with zero collision: `renderer/functions.ts`'s
// `evaluateCatalog` prefers `entry.functions` over the shared table.
//
// 13 of 14 upstream functions implemented; `openUrl` is EXCLUDED v1 (cl.11 row 11 / exclusion table
// E7) — no client-side action-execution surface exists (a side effect inside a reactive binding-eval
// effect would re-fire on every re-evaluation).
//
// Zero dependencies beyond platform globals (`Intl` — zero-dep per SPEC-N5, a browser platform API,
// not a package dependency).

type NamedArgs = Record<string, unknown>

/** `formatString` — the heavy lifting already exists: `renderer/functions.ts`'s `evaluate()` resolves
 *  every arg through `resolveValue`, which routes a template string through `interpolate` (ADR-0027)
 *  whose `${…}`/named-arg/`\${` grammar matches the schema's own `formatString` description verbatim.
 *  This impl is the identity pass-through the already-interpolated `value` arg needs. */
export function formatString(args: NamedArgs): unknown {
  return args.value
}

/** `required` — boolean dialect: `true` iff `value` is not `null`/`undefined`/`''`/an empty array (the
 *  empty-array arm is new vs. the shared `{valid}` dialect's `required`, catalog/functions.ts). */
export function required(args: NamedArgs): boolean {
  const value = args.value
  if (value == null || value === '') return false
  if (Array.isArray(value) && value.length === 0) return false
  return true
}

/** `regex` — boolean dialect of the shared `regex` (catalog/functions.ts): a malformed pattern
 *  degrades to `false`, never a throw (the evaluator's own fault-isolation posture, SPEC-N4). */
export function regex(args: NamedArgs): boolean {
  const { value, pattern } = args
  if (typeof value !== 'string' || typeof pattern !== 'string') return false
  try {
    return new RegExp(pattern).test(value)
  } catch {
    return false
  }
}

/** `length` — string length within `[min, max]` (either bound optional per the schema, "at least one
 *  of min/max"). Non-string `value` fails (a length check needs a string). */
export function length(args: NamedArgs): boolean {
  const { value, min, max } = args
  if (typeof value !== 'string') return false
  if (typeof min === 'number' && value.length < min) return false
  if (typeof max === 'number' && value.length > max) return false
  return true
}

/** `numeric` — `Number(value)` within `[min, max]`; `NaN` (a non-numeric `value`) fails. */
export function numeric(args: NamedArgs): boolean {
  const n = Number(args.value)
  if (Number.isNaN(n)) return false
  const { min, max } = args
  if (typeof min === 'number' && n < min) return false
  if (typeof max === 'number' && n > max) return false
  return true
}

/** `email` — boolean dialect of the shared `email` (catalog/functions.ts): the SAME regex. */
export function email(args: NamedArgs): boolean {
  const value = args.value
  if (typeof value !== 'string' || value.length === 0) return true // empty = not invalid, the shared precedent
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

// A fixed locale ('en-US'), not the runtime default — the schema names no locale, and a deterministic
// choice keeps `formatNumber`/`formatCurrency`/`pluralize` output stable across environments (never
// silently drifting with a CI/host's `LANG`/`ICU` data).
const FORMAT_LOCALE = 'en-US'

/** `formatNumber` — `Intl.NumberFormat` (platform global): `decimals` sets both min/max fraction
 *  digits; `useGrouping` follows `grouping` (default `true`, `grouping:false` opts out). */
export function formatNumber(args: NamedArgs): string {
  const n = Number(args.value)
  if (Number.isNaN(n)) return String(args.value)
  const decimals = typeof args.decimals === 'number' ? args.decimals : undefined
  const options: Intl.NumberFormatOptions = { useGrouping: args.grouping !== false }
  if (decimals !== undefined) {
    options.minimumFractionDigits = decimals
    options.maximumFractionDigits = decimals
  }
  return new Intl.NumberFormat(FORMAT_LOCALE, options).format(n)
}

/** `formatCurrency` — `Intl.NumberFormat` with `{style:'currency', currency}`; an invalid currency
 *  code degrades to `String(value)` rather than throwing (the evaluator's fault-isolation posture). */
export function formatCurrency(args: NamedArgs): string {
  const n = Number(args.value)
  const currency = args.currency
  if (Number.isNaN(n) || typeof currency !== 'string') return String(args.value)
  const decimals = typeof args.decimals === 'number' ? args.decimals : undefined
  const options: Intl.NumberFormatOptions = { style: 'currency', currency, useGrouping: args.grouping !== false }
  if (decimals !== undefined) {
    options.minimumFractionDigits = decimals
    options.maximumFractionDigits = decimals
  }
  try {
    return new Intl.NumberFormat(FORMAT_LOCALE, options).format(n)
  } catch {
    return String(args.value)
  }
}

// `formatDate`'s CLOSED token reference (upstream schema, zero-dep implementation — no date library):
// `yy yyyy · M MM MMM MMMM · d dd E EEEE · h hh (12h, with a) · H HH · mm · ss · a`. Numeric tokens are
// computed by field math; name tokens (`MMM`/`MMMM`/`E`/`EEEE`) and `a` (am/pm) route through
// `Intl.DateTimeFormat` part lookup (a platform global). Characters outside this token list pass
// through verbatim. Longer tokens are matched FIRST so e.g. `MMMM` never partially matches as `MM`+`MM`.
const DATE_TOKEN_RE = /yyyy|yy|MMMM|MMM|MM|M|EEEE|E|dd|d|hh|h|HH|H|mm|ss|a/g

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function dateTimePart(date: Date, type: Intl.DateTimeFormatPartTypes, options: Intl.DateTimeFormatOptions): string {
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date)
  return parts.find((p) => p.type === type)?.value ?? ''
}

function formatDateToken(date: Date, token: string): string {
  switch (token) {
    case 'yyyy':
      return String(date.getFullYear())
    case 'yy':
      return pad2(date.getFullYear() % 100)
    case 'MMMM':
      return dateTimePart(date, 'month', { month: 'long' })
    case 'MMM':
      return dateTimePart(date, 'month', { month: 'short' })
    case 'MM':
      return pad2(date.getMonth() + 1)
    case 'M':
      return String(date.getMonth() + 1)
    case 'EEEE':
      return dateTimePart(date, 'weekday', { weekday: 'long' })
    case 'E':
      return dateTimePart(date, 'weekday', { weekday: 'short' })
    case 'dd':
      return pad2(date.getDate())
    case 'd':
      return String(date.getDate())
    case 'hh': {
      const h = date.getHours() % 12 || 12
      return pad2(h)
    }
    case 'h': {
      const h = date.getHours() % 12 || 12
      return String(h)
    }
    case 'HH':
      return pad2(date.getHours())
    case 'H':
      return String(date.getHours())
    case 'mm':
      return pad2(date.getMinutes())
    case 'ss':
      return pad2(date.getSeconds())
    case 'a':
      return dateTimePart(date, 'dayPeriod', { hour: 'numeric', hour12: true })
    default:
      return token
  }
}

/** `formatDate` — args `{value, format}`; `value` is an ISO 8601 string, `format` the closed token
 *  string above. An unparseable `value` degrades to `String(value)` rather than throwing. */
export function formatDate(args: NamedArgs): string {
  const value = args.value
  const format = args.format
  if (typeof value !== 'string' || typeof format !== 'string') return String(value)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return format.replace(DATE_TOKEN_RE, (token) => formatDateToken(date, token))
}

/** `pluralize` — `Intl.PluralRules` resolves the CLDR category (`zero|one|two|few|many|other`);
 *  returns `args[category]` when the caller supplied that category, else `args.other`. */
export function pluralize(args: NamedArgs): string {
  const n = Number(args.value)
  const category = Number.isNaN(n) ? 'other' : new Intl.PluralRules(FORMAT_LOCALE).select(n)
  const picked = args[category]
  return typeof picked === 'string' ? picked : String(args.other ?? '')
}

/** `and` — args `{values}` (`minItems: 2` per schema): `true` iff every member is the literal boolean
 *  `true` (the schema-pinned strict boolean dialect). A malformed `values` (not an array, too short)
 *  is not a valid call — degrades to `false` rather than throwing. */
export function and(args: NamedArgs): boolean {
  const values = args.values
  return Array.isArray(values) && values.length >= 2 && values.every((v) => v === true)
}

/** `or` — args `{values}` (`minItems: 2`): `true` iff at least one member is the literal `true`. */
export function or(args: NamedArgs): boolean {
  const values = args.values
  return Array.isArray(values) && values.length >= 2 && values.some((v) => v === true)
}

/** `not` — args `{value}`: the strict boolean negation (`value !== true`, the schema-pinned dialect —
 *  a non-boolean `value` is treated as not-true, so `not` still returns `true` for it). */
export function not(args: NamedArgs): boolean {
  return args.value !== true
}

/** The a2ui-basic catalog's per-catalog function-impl override table (ADR-0169 cl.8/cl.11), registered
 *  alongside the factory table (`renderer.ts`'s constructor). `openUrl` is deliberately ABSENT (cl.11
 *  row 11 / exclusion E7) — its catalog declaration is likewise absent from `catalog.json`. */
export const a2uiBasicFunctions: Record<string, (args: Record<string, unknown>) => unknown> = {
  formatString,
  required,
  regex,
  length,
  numeric,
  email,
  formatNumber,
  formatCurrency,
  formatDate,
  pluralize,
  and,
  or,
  not,
}
