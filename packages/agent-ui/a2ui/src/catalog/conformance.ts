// conformance.ts — catalog-conformance validator (catalog LLD-C6, SPEC-R7/R9/N3).
//
// The catalog-aware half of the shared validator: the renderer's `validate.ts` (LLD-C11) composes
// this, and so does corpus admission — one implementation, identical verdict (parity, N6). Pure:
// `(component, catalog) → Failure[]`. An unknown component type, an unknown property, or a
// type-incorrect value each yields a `CATALOG` failure (the security allowlist, SPEC-R9).

import type { A2uiComponent, Failure } from '../protocol.ts'
import type { Catalog, JsonSchema, PropDef } from './catalog.ts'

// Structural keys owned by the adjacency model — not catalog-declared properties.
const RESERVED = new Set(['id', 'component', 'child', 'children'])

/** Validate one component against its catalog definition. Returns `[]` when conformant. */
export function validateCatalogConformance(component: A2uiComponent, catalog: Catalog): Failure[] {
  const def = catalog.components[component.component]
  if (!def) return [{ code: 'CATALOG', path: component.id }] // unknown type (SPEC-R9)

  const out: Failure[] = []
  for (const [k, v] of Object.entries(component)) {
    if (RESERVED.has(k)) continue
    const pd = def.properties[k]
    if (!pd) {
      out.push({ code: 'CATALOG', path: `${component.id}.${k}` }) // unknown property
      continue
    }
    if (!matchesType(v, pd)) out.push({ code: 'CATALOG', path: `${component.id}.${k}` }) // type mismatch
  }
  return out
}

/**
 * A deferred-resolution binding: a `{path}` data-model reference OR a `{call}` function-call
 * (ADR-0026 three-armed union). Both occupy the same "binding" position in a prop value and are
 * evaluated at render time by LLD-C5 / LLD-C10 respectively — neither is a static literal.
 */
const isBinding = (v: unknown): v is { path: string } | { call: string } =>
  typeof v === 'object' && v !== null && !Array.isArray(v) &&
  (typeof (v as { path?: unknown }).path === 'string' ||
   typeof (v as { call?: unknown }).call === 'string')

/**
 * A value conforms if it is a literal matching `pd.type`, or — when `pd.bindable` — a `{path}`
 * or `{call}` deferred-resolution binding (ADR-0026: both arms are deferred, so conformance must
 * accept both; static type checking of a `{call}` result is out-of-scope for the static validator).
 */
function matchesType(value: unknown, pd: PropDef): boolean {
  if (pd.bindable && isBinding(value)) return true // deferred resolution at render (LLD-C5/LLD-C10)
  return matchesSchemaType(value, pd.type)
}

/** Minimal JSON-Schema primitive-type check: the `type` keyword vs the JS runtime type. */
function matchesSchemaType(value: unknown, schema: JsonSchema): boolean {
  if (typeof schema === 'boolean') return schema // `true` accepts all, `false` rejects all
  const t = schema.type
  if (t === undefined) return true // unconstrained schema
  const types = Array.isArray(t) ? t : [t]
  return types.some((one) => matchesPrimitive(value, one))
}

function matchesPrimitive(value: unknown, t: unknown): boolean {
  switch (t) {
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number'
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value)
    case 'array':
      return Array.isArray(value)
    case 'null':
      return value === null
    default:
      return true // unknown schema keyword — do not over-reject
  }
}
