// functions.ts — pure catalog function implementations (catalog LLD-C7, SPEC-R5 / ADR-0026/ADR-0034).
//
// The v1.0 catalog functions:
//   `required` / `email` / `regex`  — binding-eval validators (SPEC-R5, callableFrom:clientOnly).
//   `ping`                           — server-invocable no-op probe (ADR-0034, callableFrom:clientOrRemote).
//   `formatCurrency`                 — locale-correct money formatting (ADR-0217, callableFrom:clientOnly).
//
// All are PURE — no DOM, no signals, no catalog/registry access. The shared `catalogFunctions` table
// is the single impl source used by BOTH invocation surfaces (ADR-0034 fork 2):
//   - binding-eval path (`renderer/functions.ts evaluate`): ignores `callableFrom`; consumer
//     (`checks.ts checkPassed`) narrows the `unknown` result through runtime type checks.
//   - server-invoke path (`renderer/call-function.ts`): checks `callableFrom` first; only reaches
//     here if the catalog declares the function `clientOrRemote` or `remoteOnly` in ALL active catalogs.
//
// The table's value type is `(args: NamedArgs) => unknown` because server functions (like `ping`)
// return arbitrary values — not the `{valid, message?}` shape. The binding-eval consumer always
// treats the result as `unknown` via `checkPassed`, so the widening does not change behavior.
//
// Zero dependencies: no imports. Bottom-of-stack; renderer imports downward (renderer → catalog).

/** The return shape of every catalog function (the `{valid, message?}` check result). */
export interface FunctionResult {
  valid: boolean
  message?: string
}

/** Named-arg map for all catalog functions — matches the wire `call.args` object after resolution. */
type NamedArgs = Record<string, unknown>

/**
 * `required` — validates that `args.value` is non-null, non-undefined, and non-empty string.
 * The canonical "this field must not be blank" gate (catalog SPEC-R5 / ADR-0026). Empty string,
 * `null`, and `undefined` are all treated as absent — the caller controls which channel (the data
 * model field or the DOM value) supplies `args.value` through the binding.
 */
export function required(args: NamedArgs): FunctionResult {
  const value = args.value
  if (value == null || value === '') return { valid: false, message: 'Required' }
  return { valid: true }
}

/**
 * `email` — validates that `args.value` conforms to a simple email pattern (local@domain.tld).
 * Empty / non-string values pass (they are not in scope for format validation — use `required`
 * first if the field is mandatory). This is the minimum conformant `email` validator mandated by
 * catalog SPEC-R5; a project catalog may register a stricter override.
 */
export function email(args: NamedArgs): FunctionResult {
  const value = args.value
  if (typeof value !== 'string' || value.length === 0) return { valid: true } // empty = not invalid per email
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  return ok ? { valid: true } : { valid: false, message: 'Invalid email address' }
}

/**
 * `regex` — validates that `args.value` matches `args.pattern` (a JS-compatible regex string).
 * Non-string value or pattern passes silently (type contract is the prop's `type` schema, not this
 * function's job). A malformed pattern yields `{valid:false}` with an explanatory message rather
 * than throwing, so a bad pattern in the catalog does not break the entire widget.
 */
export function regex(args: NamedArgs): FunctionResult {
  const { value, pattern } = args
  if (typeof value !== 'string' || typeof pattern !== 'string') return { valid: true }
  try {
    return new RegExp(pattern).test(value) ? { valid: true } : { valid: false, message: `Must match pattern` }
  } catch {
    return { valid: false, message: `Invalid pattern: ${String(pattern)}` }
  }
}

/**
 * `ping` — server-invocable no-op probe (ADR-0034, SPEC-R14). Takes no args, returns the constant
 * `true`. Used to verify the callFunction RPC round-trip. Declared `callableFrom:clientOrRemote`
 * in the default catalog. Has no side effects and no binding-eval usage.
 */
export function ping(): boolean {
  return true
}

/**
 * `formatCurrency` — locale-correct money formatting (ADR-0217). Named args `value` (number) +
 * `currency` (ISO-4217 string), returning the RUNTIME's default-locale `Intl.NumberFormat` currency
 * string (`Intl` is the lookup, never a hand-rolled table — the ADR-0038 geometry-font precedent).
 * No `locale` arg in v1 (ADR-0217 cl.1) — the display law is the runtime default, the same posture
 * `stat-model.ts`/`table-model.ts` already take for numeric figures; a test environment pins
 * `en-US` for determinism (ADR-0047's discipline), never the shipped impl. Degradation (this
 * catalog's OWN posture, deliberately distinct from a2ui-basic's `String(value)` — ADR-0217 cl.1):
 * a non-finite `value` renders the `stat-model.ts` placeholder em dash (`—`); an invalid/unknown
 * `currency` code falls back to a plain default-locale `Intl.NumberFormat` NUMBER string (money
 * formatting degrades to a number, not to an unformatted echo). No `decimals`/`grouping` args
 * (ADR-0217 cl.5, deliberately dropped) — per-currency fraction digits and grouping are `Intl`'s
 * own lookup, never a re-admitted per-locale knob.
 */
export function formatCurrency(args: NamedArgs): string {
  const value = args.value
  const currency = args.currency
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  if (typeof currency !== 'string' || currency === '') {
    return new Intl.NumberFormat(undefined).format(value)
  }
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value)
  } catch {
    // An unrecognized ISO-4217 code throws a RangeError inside Intl.NumberFormat's constructor —
    // degrade to a plain number, never an unformatted echo of the raw args (ADR-0217 cl.1).
    return new Intl.NumberFormat(undefined).format(value)
  }
}

/**
 * The shared pure-function implementation table for the default catalog (catalog LLD-C7 / ADR-0034
 * fork 2). Keyed by the same name the catalog declares in its `functions` block — BOTH invocation
 * surfaces look here: the binding-eval evaluator (`renderer/functions.ts`) and the server-invoke
 * handler (`renderer/call-function.ts`). Return type is `unknown` because server functions (like
 * `ping`) return arbitrary values; the binding-eval consumer (`checks.ts checkPassed`) narrows
 * the result through runtime type checks and is unaffected by the widened type.
 */
export const catalogFunctions: Record<string, (args: NamedArgs) => unknown> = {
  required,
  email,
  regex,
  ping,
  formatCurrency,
}
