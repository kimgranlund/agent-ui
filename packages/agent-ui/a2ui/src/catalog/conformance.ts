// conformance.ts — catalog-conformance validator (catalog LLD-C6, SPEC-R7/R9/N3).
//
// The catalog-aware half of the shared validator: the renderer's `validate.ts` (LLD-C11) composes
// this, and so does corpus admission — one implementation, identical verdict (parity, N6). Pure:
// `(component, catalog) → Failure[]`. An unknown component type, an unknown property, a
// type-incorrect value, or a literal outside a declared `enum` (ADR-0098) each yields a `CATALOG`
// failure (the security allowlist, SPEC-R9). A `PropDef.format: 'safe-href'` (content-family LLD-C13,
// ADR-0114 cl.3 — `Text.href`/`Attachment.href`) adds one more static-literal check: an ABSOLUTE href
// literal naming a disallowed scheme also fails `CATALOG` here, defense-in-depth ahead of the component
// gate that resolves every href (including relatives) at render.

import type { A2uiComponent, Failure } from '../protocol.ts'
import type { Catalog, JsonSchema, PropDef } from './catalog.ts'

// A LOCAL copy of `@agent-ui/components/controls/text`'s `SAFE_HREF_SCHEMES`, not a cross-package import:
// this module is reachable from `vite.config.ts`'s own plugin graph (dev-proxy-plugin.ts → catalog.ts's
// `loadCatalog` → here), which Node loads NATIVELY (no esbuild/Vite transform — Vite's config loader only
// bundles RELATIVE imports, leaving bare package specifiers to Node's own ESM resolution). Every
// `@agent-ui/components` subpath resolves straight to its TypeScript SOURCE file (the package's whole
// zero-build, source-first design — see `package.json`'s `exports` map), which Node cannot load raw
// without a type-stripping flag this repo's tooling doesn't set. Importing it here broke `npm run build`/
// `npm run dev` with `ERR_UNKNOWN_FILE_EXTENSION` on `text.ts` — confirmed the FIRST time any
// `@agent-ui/components` import entered this Node-native-loaded chain (every other such import in a2ui/
// lives under `renderer/`, which is browser-only and never touches vite.config.ts's own graph). Kept
// value-identical to the source of truth on purpose (`text/href.ts`'s own frozen-shape comment);
// `conformance.test.ts` asserts the two arrays stay equal (a real cross-package import, safe under
// vitest's transform pipeline) so drift is caught even though the runtime values are two separate
// literals. Exported (not `const` module-private) so that sync test can compare it directly.
export const SAFE_HREF_SCHEMES = ['https:', 'http:', 'mailto:'] as const

// Structural keys owned by the adjacency model — not catalog-declared properties.
// `checks` is a component-level array (ADR-0029, SPEC-R4) — a renderer-layer construct like `action`,
// never a bindable catalog prop. Any node may legally carry `checks` without a CATALOG unknown-property failure.
const RESERVED = new Set(['id', 'component', 'child', 'children', 'checks'])

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
  if (!matchesSchemaType(value, pd.type)) return false
  if (pd.format === 'safe-href' && typeof value === 'string') return matchesSafeHref(value)
  return true
}

/**
 * The `format: 'safe-href'` validator's FIRST line (ADR-0114 cl.3, content-family LLD-C13 / SPEC-R12):
 * runs the SAME scheme allowlist the component gate (`safeHref`, `controls/text/href.ts`) enforces at
 * render, but ONLY over an ABSOLUTE literal — `new URL(value)` with no base. A relative or otherwise
 * unparseable-without-base literal DEFERS to the component gate (which resolves against
 * `document.baseURI` at render time) rather than failing here; only an absolute literal naming a
 * disallowed/dangerous scheme (`javascript:`, `data:`, …) fails `CATALOG` at the static-validation
 * boundary. Bindings never reach this function — `matchesType`'s `isBinding` guard returns before it.
 */
function matchesSafeHref(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return true // relative / unparseable-without-base — defer to the component gate (SPEC-R12)
  }
  return (SAFE_HREF_SCHEMES as readonly string[]).includes(url.protocol)
}

/** Minimal JSON-Schema primitive-type check: the `type` keyword vs the JS runtime type. */
function matchesSchemaType(value: unknown, schema: JsonSchema): boolean {
  if (typeof schema === 'boolean') return schema // `true` accepts all, `false` rejects all

  // JSON-Schema `enum` membership (§6.1.2, ADR-0098): a schema declaring `enum` rejects any value
  // that is not STRICTLY EQUAL (`===`, case-sensitive, no coercion) to a listed member. Checked
  // before the `type` dispatch — enum is a narrower constraint layered on top of `type`, not a
  // replacement for it. Only primitive-member equality is evaluated; deep-equality object members
  // are outside the validator's declared minimal-subset scope (no shipped catalog uses them).
  if (Array.isArray(schema.enum) && !schema.enum.some((member) => member === value)) return false

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
