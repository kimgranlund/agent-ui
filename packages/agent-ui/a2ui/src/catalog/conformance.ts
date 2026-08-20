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

/**
 * Validate one component against its catalog definition. Returns `[]` when conformant. Checks PRESENT
 * props (unknown / type-mismatch, SPEC-R9's security allowlist scope) PLUS — GH #1189 — key PRESENCE
 * for any `PropDef.required:true` (an opt-in extension; every property that does not declare it behaves
 * byte-identically to before, the `Modal.open` negative control in `catalog/default/index.test.ts` among
 * them) PLUS — ADR-0226 cl.3 — cross-prop `PropDef.requires` (a declaring key present without one of
 * its named sibling keys) PLUS — ADR-0226 cl.4 — the structural children-model check (a `child`/
 * `children` key on a node whose def declares no children model at all). Every check is independent:
 * each fires once per defect even if no OTHER prop on the node is present/type-mismatched.
 */
export function validateCatalogConformance(component: A2uiComponent, catalog: Catalog): Failure[] {
  const def = catalog.components[component.component]
  if (!def) return [{ code: 'CATALOG', path: component.id }] // unknown type (SPEC-R9)

  const out: Failure[] = []

  // ADR-0226 cl.4 — closes the catalog-wide structural leniency (renderer/validate.ts `RESERVED` and
  // this module's own `RESERVED` both skip `child`/`children` unconditionally in the props loop below,
  // so — before this check — a node could carry either key regardless of its def declaring a children
  // model at all; `renderer/tree.ts` would then generically mount it, e.g. adopting a slotless Icon
  // child into a Button's label wrapper, a silently wrong render, never an error). Presence-vs-none
  // only, the deliberately minimal floor (ADR-0226 cl.4): a `child`-vs-`children`-vs-`ChildList` KIND
  // mismatch on a DECLARING def is refused this pass — no evidence of that defect class, and a wrong
  // kind still renders or IDGRAPH-fails visibly, unlike the silent leniency this closes.
  if (def.children === undefined) {
    if ('child' in component) out.push({ code: 'CATALOG', path: `${component.id}.child` })
    if ('children' in component) out.push({ code: 'CATALOG', path: `${component.id}.children` })
  }

  for (const [k, v] of Object.entries(component)) {
    if (RESERVED.has(k)) continue
    const pd = def.properties[k]
    if (!pd) {
      out.push({ code: 'CATALOG', path: `${component.id}.${k}` }) // unknown property
      continue
    }
    if (!matchesType(v, pd)) out.push({ code: 'CATALOG', path: `${component.id}.${k}` }) // type mismatch
  }
  for (const [k, pd] of Object.entries(def.properties)) {
    if (pd.required && !(k in component)) out.push({ code: 'CATALOG', path: `${component.id}.${k}` }) // omitted required key (GH #1189)
  }

  // ADR-0226 cl.3 — cross-prop `requires`: a declared key's PRESENCE on the node requires its named
  // sibling keys' PRESENCE too (never their eventual VALUE, cl.3's owned limit — a `{path}`/`{call}`
  // binding on either side satisfies presence, ADR-0026). Scoped to keys the node actually carries —
  // a `requires` declaration on a key the node never carries never fires, and every prop that doesn't
  // opt in behaves byte-identically. Reported at the MISSING sibling's own path (the actionable gap),
  // the same "point at the omitted key" convention `required` (GH #1189) already uses.
  for (const k of Object.keys(component)) {
    if (RESERVED.has(k)) continue
    const pd = def.properties[k]
    if (!pd?.requires) continue
    for (const need of pd.requires) {
      if (!(need in component)) out.push({ code: 'CATALOG', path: `${component.id}.${need}` })
    }
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
  if (pd.rejectFunctionCall && isFunctionCallAction(value)) return false
  return true
}

/**
 * GH #429 (ADR-0169 E7 row): the ONE narrow shape `PropDef.rejectFunctionCall` screens for — an
 * object VALUE carrying an own `functionCall` key, upstream's client-side-execution `Action` arm.
 * Not a general object-shape descent (that stays out of scope by design, per `matchesSchemaType`'s
 * own comment) — only this one named key, only when the declaring PropDef opts in.
 */
const isFunctionCallAction = (v: unknown): v is { functionCall: unknown } =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && 'functionCall' in v

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
