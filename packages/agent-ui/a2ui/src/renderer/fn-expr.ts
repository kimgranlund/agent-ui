// fn-expr.ts — function-expression body parser (renderer ADR-0028, slice S1).
//
// Parses the INNER body of a `${fn(arg:val, …)}` interpolation segment into a `FunctionCall` that
// the renderer's `evaluate` (renderer/functions.ts, ADR-0026) can dispatch. This is a PURE,
// ZERO-DEP tokenizer: no DOM, no signals, no registry access. It translates surface syntax into
// the same JSON shapes (`{call, args}`, `{path}`, literals) that the JSON binding grammar already
// uses — so `evaluate` needs no changes.
//
// Grammar (A2UI v1.0, ADR-0028 §Context — named-args-only, v1.0 conformant):
//   body        ::= name '(' args ')'               — outer `${}` stripped by interpolate.ts scanner
//   name        ::= ('@'|'_'|letter) ('_'|letter|digit)*  — optionally @-prefixed (system fns)
//   args        ::= (arg (',' arg)*)?               — zero or more named args; positional → null
//   arg         ::= name ':' value                  — NAMED only; positional deferred to #18 (Fork 1)
//   value       ::= quoted | dollarBrace | number | boolean
//   quoted      ::= ("'"|'"') <chars> ("'"|'"')     — BOTH quote styles accepted (Fork 4)
//   dollarBrace ::= '${' body '}'                   — inner body: no '(' → {path}; '(' → nested call
//   number      ::= '-'? digit+ ('.' digit+)?
//   boolean     ::= 'true' | 'false'
//   (bare identifier or unrecognised token → INVALID → null)
//
// `null` is the sole failure signal. Every malformed input is treated as render-literally (ADR-0027
// render-literally model): the classifier branch in interpolate.ts falls back to `'${' + body + '}'`.
// No error is emitted for a parse failure — errors are emitted only by `evaluate` for unknown/
// throwing functions (the runtime fault path, ADR-0026 / SPEC-N4).

import type { FunctionCall, Binding } from '../protocol.ts'

// ── Concrete arg-value union — what parseValue may produce ──────────────────────

/** Closed value-kind union for a parsed arg (a subtype of `Binding<unknown>`). */
type ArgValue = string | number | boolean | { path: string } | FunctionCall

// ── Depth-aware scanner helpers ─────────────────────────────────────────────────

/**
 * Given `s` at depth=1 (scanning from just past an opening `(`), return the index of the matching
 * `)`. Quoted strings are skipped so a `)` inside a quote does not close the paren. `${fn(…)}`
 * spans are safe: the `(` inside increments depth and the matching `)` decrements it — net zero.
 * Returns -1 if unbalanced (malformed body → caller returns null).
 */
function findCloseParen(s: string, from: number): number {
  let depth = 1
  let i = from
  while (i < s.length) {
    const c = s[i]!
    if (c === "'" || c === '"') {
      // Skip to the closing quote so a `)` inside a string literal doesn't close the paren.
      const q = c; i++
      while (i < s.length && s[i] !== q) i++
    } else if (c === '(') {
      depth++
    } else if (c === ')') {
      depth--
      if (depth === 0) return i
    }
    i++
  }
  return -1 // unbalanced
}

/**
 * Split `s` on TOP-LEVEL commas — not inside `(…)`, `{…}`, or quoted strings. Returns a single
 * empty string for `s = ''` (→ no-arg call after the empty-segment filter in the main parser).
 */
function splitTopLevelCommas(s: string): string[] {
  const parts: string[] = []
  let start = 0
  let parenDepth = 0
  let braceDepth = 0
  let i = 0
  while (i < s.length) {
    const c = s[i]!
    if (c === "'" || c === '"') {
      const q = c; i++
      while (i < s.length && s[i] !== q) i++
    } else if (c === '{') {
      braceDepth++
    } else if (c === '}') {
      braceDepth--
    } else if (c === '(') {
      parenDepth++
    } else if (c === ')') {
      parenDepth--
    } else if (c === ',' && parenDepth === 0 && braceDepth === 0) {
      parts.push(s.slice(start, i))
      start = i + 1
    }
    i++
  }
  parts.push(s.slice(start))
  return parts
}

/**
 * Return the index of the FIRST TOP-LEVEL `:` in `s`, or -1 if none (positional arg, deferred #18).
 * "Top-level" = not inside `(…)`, `{…}`, or quoted strings.
 */
function firstTopLevelColon(s: string): number {
  let parenDepth = 0
  let braceDepth = 0
  let i = 0
  while (i < s.length) {
    const c = s[i]!
    if (c === "'" || c === '"') {
      const q = c; i++
      while (i < s.length && s[i] !== q) i++
    } else if (c === '{') {
      braceDepth++
    } else if (c === '}') {
      braceDepth--
    } else if (c === '(') {
      parenDepth++
    } else if (c === ')') {
      parenDepth--
    } else if (c === ':' && parenDepth === 0 && braceDepth === 0) {
      return i
    }
    i++
  }
  return -1
}

/**
 * If `v` is exactly one `${…}` span, return the inner body string; else return null.
 * Uses `{`/`}` depth to handle nested `${…}` inside an arg (e.g. `${inner(y:${/d})}`).
 */
function extractDollarBrace(v: string): string | null {
  if (v.length < 3 || !v.startsWith('${')) return null
  let depth = 1
  let i = 2
  while (i < v.length) {
    if (v[i] === '{') depth++
    else if (v[i] === '}') {
      depth--
      if (depth === 0) return i === v.length - 1 ? v.slice(2, i) : null // must consume all of v
    }
    i++
  }
  return null // unterminated
}

// ── Arg value parser ────────────────────────────────────────────────────────────

/**
 * Parse one arg value string into a concrete `ArgValue`, or return `null` on failure.
 * Failure propagates: null returned here causes `parseFunctionExpr` to return null for the whole
 * call (consistent with the ADR-0028 "any tokenize failure → null" rule).
 */
function parseValue(v: string): ArgValue | null {
  const t = v.trim()
  if (t.length === 0) return null

  // Quoted string literal — both ' and " accepted (Fork 4 of ADR-0028).
  if (t[0] === "'" || t[0] === '"') {
    const q = t[0]
    if (t.at(-1) !== q || t.length < 2) return null // unmatched or lone quote
    return t.slice(1, -1)
  }

  // `${…}` — classify inner body as path (no `(`) or nested function call (has `(`).
  if (t.startsWith('${')) {
    const inner = extractDollarBrace(t)
    if (inner === null) return null // malformed or trailing content
    if (inner.includes('(')) {
      // Nested function-expression: recursive parse. Null from a positional nested arg (Fork 1)
      // propagates — the outer call also returns null (ADR-0028 §4 "any failure → null").
      return parseFunctionExpr(inner) // null propagates
    }
    // Absolute (`/…`) or relative (`name`) path — identical to the `{path}` JSON binding shape.
    return { path: inner }
  }

  // Boolean literals.
  if (t === 'true') return true
  if (t === 'false') return false

  // Number literal: optional leading '-', digits, optional decimal.
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)

  // Bare identifier, unrecognised token — INVALID per grammar (paths must be `${…}`-wrapped).
  return null
}

// ── Public API ──────────────────────────────────────────────────────────────────

/** UAX-31 identifier regex for the call name, with optional @-prefix (system functions). */
const CALL_NAME_RE = /^@?[A-Za-z_][A-Za-z0-9_]*$/

/** UAX-31 identifier regex for arg names (no @-prefix; arg names are plain identifiers). */
const ARG_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * Parse a function-expression BODY (the string INSIDE a `${…}` that contains a `(`) into a
 * `FunctionCall` value (ADR-0026, §FunctionCall), or return `null` on any tokenization failure.
 *
 * Tokenization rules (ADR-0028):
 *   - Call name: UAX-31 identifier, optionally `@`-prefixed (e.g. `@index`).
 *   - Named args only (`name:value`). A positional arg (no top-level `:`) → null (Fork 1, #18).
 *   - Arg values: `'…'`/`"…"` quoted strings (both styles); `${path}` or `${fn(…)}` bindings;
 *     number and boolean literals. Bare identifiers are INVALID per grammar → null.
 *   - Malformed: bad name, unbalanced parens, trailing content → null.
 *
 * The caller (interpolate.ts classifier branch) treats `null` as "render verbatim, no error"
 * (ADR-0027 render-literally model, consistent with SPEC-N4 fault isolation).
 */
export function parseFunctionExpr(body: string): FunctionCall | null {
  const trimmed = body.trim()

  // The call name is everything before the FIRST `(`.
  const parenIdx = trimmed.indexOf('(')
  if (parenIdx === -1) return null // no `(` — not a function expression

  const name = trimmed.slice(0, parenIdx).trim()
  if (!CALL_NAME_RE.test(name)) return null // empty name or invalid identifier

  // Find the matching `)` for the opening `(` at parenIdx.
  const closeIdx = findCloseParen(trimmed, parenIdx + 1)
  if (closeIdx === -1) return null // unbalanced parens

  // Anything after the matching `)` is malformed (e.g. `fn() + extra`).
  if (trimmed.slice(closeIdx + 1).trim().length > 0) return null

  // Extract and parse the arg list.
  const argStr = trimmed.slice(parenIdx + 1, closeIdx)
  const segments = splitTopLevelCommas(argStr)
  const args: Record<string, Binding<unknown>> = {}

  for (const seg of segments) {
    const segment = seg.trim()
    if (segment.length === 0) continue // empty segment = no-arg call (`now()`) — skip

    // Named arg: find the first top-level ':'. No ':' → positional arg → Fork 1 deferred.
    const colonIdx = firstTopLevelColon(segment)
    if (colonIdx === -1) return null // positional arg — not supported in v1.0 (Fork 1)

    const argName = segment.slice(0, colonIdx).trim()
    if (!ARG_NAME_RE.test(argName)) return null // invalid arg name

    const argVal = parseValue(segment.slice(colonIdx + 1))
    if (argVal === null) return null // invalid value — propagate failure

    args[argName] = argVal as Binding<unknown>
  }

  return Object.keys(args).length > 0 ? { call: name, args } : { call: name }
}
