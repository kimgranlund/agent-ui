// functions.ts — function-call binding evaluator (renderer LLD-C10, ADR-0026).
//
// A binding value has THREE kinds (ADR-0026): a literal, a `{path}` data-model reference, or a
// `{call, args}` function call. This module owns the third kind — the `evaluate` function — and
// exports `resolveValue`, the single dispatcher that `widget.ts`'s bound-prop effect calls for
// every dynamic prop:
//
//   resolveValue(value, surface, itemScope?, emitError, registry)
//     literal        → as-is (no reactive dep)
//     { path }       → resolve(binding, surface, itemScope)  [binding.ts, per-path memo, SPEC-N2]
//     { call, args } → evaluate(call, surface, itemScope?, emitError, registry)
//
// Running inside the existing scope-owned bound-prop effect means a `{path}` arg inside a `{call}`
// is tracked reactively — the effect re-runs on a data change at that path, re-evaluating the call
// with the fresh arg value. Per-path waking (SPEC-N2) is preserved unchanged.
//
// SYSTEM functions (`@`-prefix, reserved by naming.ts so they cannot collide with catalog names):
//   @index  — returns `itemScope.index + (args.offset ?? 0)`. ONLY valid inside a collection scope
//             (list item with an `itemScope`). Outside: FUNCTION error + undefined (v1.0 conformant).
//             Settles the ADR-0024 deferral: single-frame `ItemScope` is sufficient; no chain needed.
//
// CATALOG functions (keyed by name in the bound catalog's `functions` registry):
//   required / email / regex  — pure validators from `catalog/functions.ts`. The evaluator looks up
//   the FunctionDef in `catalog.functions[name]` (existence check) and the pure impl in the shared
//   `catalogFunctions` registry. An unknown catalog function emits FUNCTION + undefined. A throwing
//   impl also yields FUNCTION + undefined (non-fatal fault isolation, consistent with SPEC-N4/R9).
//
// Args recursion. Each named arg is itself `literal | {path} | {call}` — resolved through the same
// `resolveValue` dispatcher (one frame of recursion per nesting level; no cycle detection needed
// because the catalog schema is an acyclic tree). A `{path}` arg re-evaluates the whole call
// reactively whenever the path's data-model value changes (SPEC-N2 is preserved for free because the
// `{path}` case calls `resolve` which reads the per-path memo inside the bound-prop effect).
//
// FUNCTION errors are render-time emits (like CATALOG) and never throw: unknown name → `undefined`;
// throwing impl → `undefined`. Sibling props and widgets are unaffected (SPEC-N4 / fault isolation).

import { resolve } from './binding.ts'
import { isInterpolated, interpolate } from './interpolate.ts'
import { catalogFunctions } from '../catalog/functions.ts'
import type { FunctionCall, A2uiError } from '../protocol.ts'
import type { Surface } from './surface.ts'
import type { ItemScope } from './types.ts'
import type { CatalogRegistry } from '../catalog/types.ts'

// ── value-kind predicates ──────────────────────────────────────────────────────────────────────

/** True if `v` is a `{call}` function-call binding (ADR-0026 third arm). */
const isFunctionCall = (v: unknown): v is FunctionCall =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (v as { call?: unknown }).call === 'string'

/** True if `v` is a `{path}` data-model binding (the original second arm). */
const isPathBinding = (v: unknown): v is { path: string } =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (v as { path?: unknown }).path === 'string'

// ── public API ─────────────────────────────────────────────────────────────────────────────────

/**
 * Resolve any binding value to its current render value (renderer LLD-C5/C10 / ADR-0026/ADR-0027).
 * The single dispatcher `widget.ts`'s `WidgetDeps.resolveValue` delegates to. Four cases:
 *   `{call}` → `evaluate` (LLD-C10 function evaluator, ADR-0026).
 *   `{path}` → `resolve` in binding.ts (per-path memo, SPEC-N2, LLD-C5).
 *   template string (literal with unescaped `${`) → `interpolate` (DynamicString, ADR-0027).
 *   other literal → as-is (no reactive dep, byte-identical to today).
 * Called inside a scope-owned bound-prop effect, so per-path waking is preserved for every arm:
 * the `{path}` arm and each `${/expr}` inside a template all read the same per-path memo.
 */
export function resolveValue(
  value: unknown,
  surface: Surface,
  itemScope: ItemScope | undefined,
  emitError: (error: A2uiError) => void,
  registry: CatalogRegistry,
): unknown {
  if (isFunctionCall(value)) return evaluate(value, surface, itemScope, emitError, registry)
  if (isPathBinding(value)) return resolve(value, surface, itemScope)
  // DynamicString interpolation (ADR-0027): a literal string containing an unescaped `${` is a
  // template — route it through the scanner/classifier/resolver. A non-template string (or any
  // non-string literal) falls through byte-identical to the old `return value` arm.
  if (typeof value === 'string' && isInterpolated(value))
    return interpolate(value, surface, itemScope, resolve, emitError, registry)
  return value // literal (no template marker — returned byte-identical)
}

/**
 * Evaluate a `{call, args?}` function-call binding (renderer LLD-C10 / ADR-0026). Dispatches on
 * the call name's namespace: `@`-prefixed → system function table (today: `@index`); else → the
 * bound catalog's `functions` registry + the pure impl from `catalog/functions.ts`. Each named arg
 * is resolved recursively through `resolveValue` before the function body runs, so a `{path}` arg
 * propagates reactivity through the call.
 *
 * Unknown function name or a throwing impl → `emitError(FUNCTION)` + `undefined` (non-fatal; the
 * prop receives `undefined`, consistent with an unresolved `{path}`, SPEC-R4 AC2).
 */
export function evaluate(
  call: FunctionCall,
  surface: Surface,
  itemScope: ItemScope | undefined,
  emitError: (error: A2uiError) => void,
  registry: CatalogRegistry,
): unknown {
  const name = call.call
  const rawArgs = call.args ?? {}

  // Resolve each named arg recursively (literal | {path} | nested {call}).
  const args: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rawArgs)) {
    args[k] = resolveValue(v, surface, itemScope, emitError, registry)
  }

  // Dispatch on namespace: '@'-prefixed = system (reserved by naming.ts — no catalog collision).
  if (name.startsWith('@')) return evaluateSystem(name, args, itemScope, surface, emitError)
  return evaluateCatalog(name, args, surface, registry, emitError)
}

// ── system functions ───────────────────────────────────────────────────────────────────────────

function evaluateSystem(
  name: string,
  args: Record<string, unknown>,
  itemScope: ItemScope | undefined,
  surface: Surface,
  emitError: (error: A2uiError) => void,
): unknown {
  switch (name) {
    case '@index': {
      // `@index` MUST be inside a collection scope (v1.0 conformant: "only valid inside iteration").
      if (itemScope === undefined) {
        emitError({
          code: 'FUNCTION',
          surfaceId: surface.id,
          message: `@index used outside a collection scope — only valid inside a dynamic list`,
        })
        return undefined
      }
      // `offset` is a numeric addend for 1-based display: `{call:'@index', args:{offset:1}}` → 1-based.
      // NOT outer-scope addressing (ADR-0024 deferral settled: single-frame ItemScope is sufficient).
      const offset = typeof args.offset === 'number' ? args.offset : 0
      return itemScope.index + offset
    }
    default:
      emitError({
        code: 'FUNCTION',
        surfaceId: surface.id,
        message: `unknown system function "${name}" — only "@index" is defined in v1.0`,
      })
      return undefined
  }
}

// ── catalog functions ──────────────────────────────────────────────────────────────────────────

function evaluateCatalog(
  name: string,
  args: Record<string, unknown>,
  surface: Surface,
  registry: CatalogRegistry,
  emitError: (error: A2uiError) => void,
): unknown {
  // Step 1: verify the function is declared in the bound catalog's `functions` map (existence gate).
  const entry = registry.get(surface.catalogId)
  if (entry === undefined || entry.catalog.functions[name] === undefined) {
    emitError({
      code: 'FUNCTION',
      surfaceId: surface.id,
      message: `unknown catalog function "${name}" in catalog "${surface.catalogId}"`,
    })
    return undefined
  }

  // Step 2: look up the pure implementation in the shared table from catalog/functions.ts.
  // For the default catalog this is the `required`/`email`/`regex` trio; a project-catalog function
  // absent from this table emits FUNCTION (a future plugin seam would extend `catalogFunctions`).
  const impl = catalogFunctions[name]
  if (impl === undefined) {
    emitError({
      code: 'FUNCTION',
      surfaceId: surface.id,
      message: `catalog function "${name}" is declared but has no registered implementation`,
    })
    return undefined
  }

  // Step 3: call the pure impl. A throw is non-fatal (consistent with SPEC-N4/R9 fault isolation).
  try {
    return impl(args)
  } catch (err) {
    emitError({
      code: 'FUNCTION',
      surfaceId: surface.id,
      message: `catalog function "${name}" threw: ${String(err)}`,
    })
    return undefined
  }
}
