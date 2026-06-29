// interpolate.ts — `${…}` DynamicString path interpolation (renderer ADR-0027).
//
// A2UI v1.0: any literal string containing an unescaped `${` is a DynamicString template, not an
// opaque constant. This module owns the two public exports that `functions.ts` gates behind:
//
//   isInterpolated(s)          — fast guard: true iff `s` contains an unescaped `${`.
//   interpolate(s, surface, itemScope, resolve) — scanner + classifier + path resolver + coerce + concat.
//
// DESIGN (ADR-0027 §2–5):
//
//   Scanner. A single left-to-right scan turns `s` into ordered segments:
//     · `\${`          → literal `${` (backslash consumed; the ONLY defined escape).
//     · unescaped `${` → expression, closed by its matching `}` (brace-depth tracked; plain `{` inside
//                        an expression increments depth, so a future nested `${…}` is parse-stable).
//     · everything else → literal character.
//
//   Classifier (the forward-compat seam, ADR-0027 §3). Each `${expr}` body is one of:
//     · No `(`  → JSON-Pointer PATH (this wave): absolute `/…` or relative `name` in item scope.
//     · Has `(` → function-expression grammar — DEFERRED (task #15); emit verbatim, no error.
//       When the function arm lands this single branch is extended to parse `body` into a FunctionCall
//       and route it to evaluate() — no scanner change required.
//
//   Malformed / unterminated `${` (no closing `}`): verbatim, no error. The spec defines only the
//   `\${` escape and no error code for parse failures; rendering literally is consistent with SPEC-N4
//   fault isolation and SPEC-R4 AC2's placeholder discipline (ADR-0027 §4).
//
//   Coercion (spec-exact, ADR-0027 §3.5): number/boolean → String(v); null/undefined → "" (empty
//   sentinel — NOT the literal "null"/"undefined"); object/array → JSON.stringify(v); string → itself.
//
//   Reactivity is free. `interpolate` runs inside the existing scope-owned bound-prop effect
//   (widget.ts:125). Each `${/path}` reads through `resolve` (binding.ts), which reads the per-path
//   memoized computed. The effect therefore depends on exactly the paths the template embeds and wakes
//   only when one of them changes — SPEC-N2 per-path waking, reused unchanged.
//
//   Escape model: `\${`-only. `\\` is NOT un-escaped (the spec is silent; this is the documented
//   limitation). `\\${expr}` is treated as escaped (the `\` before `$` matches the escape rule) and
//   renders as the literal `\${expr}` — a spec-undefined edge, logged here, not an error.

import type { Surface } from './surface.ts'
import type { ItemScope } from './types.ts'

/** The binding.ts `resolve` signature — the per-path memo reader (LLD-C5). */
type ResolveFn = (binding: { path: string }, surface: Surface, itemScope?: ItemScope) => unknown

/**
 * True iff `s` contains an unescaped `${` — i.e. a `$` followed immediately by `{` where the `$`
 * is NOT immediately preceded by a backslash. Must agree exactly with the scanner's escape model:
 * `\${` is the one defined escape; `\\` is NOT un-escaped (spec-undefined, documented limitation).
 */
export function isInterpolated(s: string): boolean {
  for (let i = 0; i < s.length - 1; i++) {
    if (s[i] === '$' && s[i + 1] === '{') {
      if (i === 0 || s[i - 1] !== '\\') return true
    }
  }
  return false
}

/**
 * Coerce a resolved value to a string per the A2UI v1.0 DynamicString coercion table (ADR-0027 §3.5):
 * null/undefined → "" (the empty-string sentinel — NOT "null"/"undefined"); string → itself;
 * number/boolean → String(v); object/array → JSON.stringify(v).
 */
function coerce(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

/**
 * Interpolate a `${…}` DynamicString template (ADR-0027). Scans `s` escape-aware into ordered
 * segments, classifies each expression body, resolves path segments through `resolve`, coerces
 * each resolved value, and concatenates in source order.
 *
 * Must be called INSIDE the scope-owned bound-prop effect (widget.ts:125) — `resolve` reads
 * the per-path computed there, subscribing the effect to exactly the embedded paths (SPEC-N2).
 *
 * Does NOT take `emitError` — it never emits an error code. Malformed input renders literally
 * (ADR-0027 render-literally model; consistent with SPEC-N4/R4 AC2).
 */
export function interpolate(
  s: string,
  surface: Surface,
  itemScope: ItemScope | undefined,
  resolve: ResolveFn,
): string {
  let out = ''
  let i = 0

  while (i < s.length) {
    // Escaped `\${` — emit literal `${` and consume all three characters. This is the only escape
    // this wave handles; `\\` is NOT un-escaped (spec-undefined, documented in module header).
    if (s[i] === '\\' && i + 2 < s.length && s[i + 1] === '$' && s[i + 2] === '{') {
      out += '${'
      i += 3
      continue
    }

    // Unescaped `${` — scan for the matching `}` with brace-depth tracking. Plain `{` inside an
    // expression increments depth so a future nested `${…}` is parse-stable (forward-compat seam).
    if (s[i] === '$' && i + 1 < s.length && s[i + 1] === '{') {
      i += 2 // skip `${`
      let body = ''
      let depth = 1
      while (i < s.length) {
        const c = s[i]!
        if (c === '{') {
          depth++
          body += c
        } else if (c === '}') {
          depth--
          if (depth === 0) {
            i++ // consume closing `}`
            break
          }
          body += c
        } else {
          body += c
        }
        i++
      }

      if (depth > 0) {
        // Unterminated `${` (no matching `}`) — render verbatim, no error (ADR-0027 render-literally).
        out += '${' + body
      } else if (body.includes('(')) {
        // Function-expression form (e.g. `${now()}`, `${formatDate(value:${/d}, format:'yyyy')}`).
        // DEFERRED — task #15 owns the tokenizer (identifiers, parens, arg:val, single-quoted
        // strings, recursive `${…}`). Emit verbatim, no error; when task #15 lands, this branch
        // routes `body` to a parser → FunctionCall → evaluate() — an additive classifier extension.
        out += '${' + body + '}'
      } else {
        // JSON-Pointer path (absolute `/…` or relative in item scope, no `(`).
        // Resolve via binding.ts — the same per-path memo the `{path}` value kind uses (LLD-C5).
        // A relative body (no leading `/`) is rewritten to its absolute pointer by `resolve` via
        // `scopedPointer(body, itemScope)` inside binding.ts — identical to the `{path}` read side.
        out += coerce(resolve({ path: body }, surface, itemScope))
      }
      continue
    }

    // Ordinary character — append and advance.
    out += s[i]!
    i++
  }

  return out
}
