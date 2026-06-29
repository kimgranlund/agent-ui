// functions.ts — pure catalog function implementations (catalog LLD-C7, SPEC-R5 / ADR-0026).
//
// The three v1.0 catalog functions required by catalog SPEC-R5: `required` (non-empty check),
// `email` (format check), and `regex` (pattern check). All are PURE — no DOM, no signals, no
// catalog/registry access; they take a named `args` object (keyed by the wire arg name, matching
// the corrected `FunctionDef.args: Record<string, JsonSchema>` shape from ADR-0026) and return a
// `FunctionResult` bearing `{valid, message?}`. The renderer's evaluator (`renderer/functions.ts`)
// calls these after resolving each arg through `resolveValue` (literal | {path} | nested {call}).
//
// The default catalog (`default/catalog.json`) declares these three in its `functions` block; the
// evaluator looks them up here via the shared `catalogFunctions` registry below. A project catalog
// that registers its OWN function names would need to register implementations separately — the
// v1.0 extension point for that is a future follow-up.
//
// Zero dependencies: no imports. This is the bottom-of-stack implementation that the renderer
// evaluator can import downward (renderer → catalog, the allowed direction within a2ui).

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
 * The shared pure-function implementation table for the default catalog (catalog LLD-C7). Keyed by
 * the same name the catalog declares in its `functions` block — the evaluator (`renderer/functions.ts`)
 * looks here after verifying the name appears in `catalog.functions[name]`. A project catalog that
 * extends this table will require a future plugin registration seam (v1.0 out-of-scope, tracked).
 */
export const catalogFunctions: Record<string, (args: NamedArgs) => FunctionResult> = {
  required,
  email,
  regex,
}
