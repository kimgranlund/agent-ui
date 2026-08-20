// catalog.ts — Catalog schema model + loader (catalog LLD-C1, catalog SPEC-R1/R4).
//
// `loadCatalog` parses + structurally validates a catalog document and produces the `Catalog`
// type the shared validator (`renderer/validate.ts`, LLD-C11) consumes. Invariant: a returned
// `Catalog` is structurally valid — downstream code never re-checks shape. The loader THROWS a
// `CatalogError` on a malformed document (it is a load-time gate, not a wire-error producer).

import { validName } from './naming.ts'

/** A JSON-Schema fragment: an object schema or a boolean schema (`true`/`false`). */
export type JsonSchema = Record<string, unknown> | boolean

/** A2UI v1.0 catalog (catalog SPEC §5.1). No surface-theming field — GH #531, following upstream
 *  v1.0's "Decoupled Branding": theming is a consumer/CSS concern, not a catalog-level mechanism. */
export interface Catalog {
  catalogId: string
  protocolVersion: string
  components: Record<string, ComponentDef>
  functions: Record<string, FunctionDef>
}

export interface ComponentDef {
  name: string
  properties: Record<string, PropDef>
  children?: 'child' | 'children' | 'ChildList'
  value?: ValueSlot | readonly ValueSlot[]
}

/**
 * One two-way commit slot — a DOM value prop + the commit event that fires it (ADR-0161). A
 * component whose commit gesture finalizes several props (Calendar range, SliderMulti) declares
 * one slot per prop; a component with one committed value keeps the single-object form, unchanged
 * forever (`ComponentDef.value` / `WidgetFactory.value` both widen to `ValueSlot | ValueSlot[]`).
 *
 * ADR-0169 cl.7 (amends ADR-0019/ADR-0161): `readProp`/`marshal` are OPTIONAL, additive widenings for
 * interop with a wire dialect whose commit shape the DOM value prop alone cannot express — every
 * existing slot omits both, so every existing catalog/factory behaves byte-identically. `prop` keeps
 * naming the WIRE side of the round-trip (the `{path}` writeback target); `readProp` (absent ⇒ `prop`)
 * names the DOM property the renderer's input controller actually READS off the control on commit —
 * the first consumer is `CheckBox` (wire `value` is a boolean, but `ui-checkbox.value` is the
 * submitted STRING; the boolean lives on `ui-checkbox.checked`). `marshal` (absent ⇒ raw) is a CLOSED
 * commit-value transform applied AFTER the read — the first (and only) member,
 * `'singletonStringList'`, wraps a single committed string into a one-element array (or `[]` for
 * empty/`null`), the first consumer is `ChoicePicker` (wire `value` is a string LIST; the control
 * commits one string). A closed literal enum keeps `catalog.json` plain JSON — never a function;
 * widening it is a future amendment to this clause, not an ad-hoc addition.
 */
export interface ValueSlot {
  prop: string
  event: string
  readProp?: string
  marshal?: 'singletonStringList'
}

/**
 * Normalize a `value` mark to a slot array (ADR-0161): the single-object form (today's shape,
 * byte-unchanged) becomes a one-element array; the array form passes through untouched. The ONE
 * shared reader `validateComponent` (below) and the renderer's input controller
 * (`renderer/input.ts`, LLD-C8) both use, so per-slot iteration is defined exactly once.
 */
export function valueSlots(mark: ValueSlot | readonly ValueSlot[]): readonly ValueSlot[] {
  return Array.isArray(mark) ? (mark as readonly ValueSlot[]) : [mark as ValueSlot]
}

export interface PropDef {
  type: JsonSchema
  bindable?: boolean
  mapsTo: string
  /** A default-catalog PropDef extension (our schema, not A2UI wire vocabulary) — currently only
   *  `'safe-href'` (ADR-0114 cl.3, content-family LLD-C13): the shared validator's first line runs the
   *  ADR-0114 scheme allowlist over an ABSOLUTE static string literal; a relative/unparseable-without-base
   *  literal defers to the component gate (`safeHref`, `controls/text/href.ts`), which resolves at render. */
  format?: string
  /**
   * A catalog-declared extension (ADR-0169 E7 row / GH #429), absent everywhere but
   * `a2ui-basic/catalog.json`'s `Button.action`: gate-encodes the ONE Action arm
   * `matchesSchemaType`'s deliberate shallow type check cannot see (it checks only the PropDef's
   * top-level `type` keyword, never descending into nested `properties`/`required`, so ADR-0011's
   * Postel tolerance arms keep passing un-narrowed — cl.10). When `true`, an object VALUE carrying an
   * own `functionCall` key fails `CATALOG` at validate — upstream's client-side-execution `Action` arm
   * (`{event}|{functionCall}` oneOf), which `readActionSpec` (renderer.ts) has no arm for and would
   * otherwise render a Button whose click silently dispatches nothing. Declared only where the wire
   * dialect actually offers the arm; absent ⇒ today's behavior, byte-identical (the default catalog's
   * `Button.action` never declares it, so its own Postel tolerance for an unrecognized action shape is
   * untouched).
   */
  rejectFunctionCall?: boolean
  /**
   * A catalog-declared extension (our schema, not A2UI wire vocabulary) — GH #1189, the FIRST consumer
   * being `Image.alt` (a real accessibility gap, not a form-validity concern the existing `TextField.
   * required`/`Checkbox.required` wire props already cover — those are bindable BOOLEAN props reflecting
   * the control's own native-validity `required` attribute, a completely different axis). When `true`,
   * `conformance.ts`'s shared validator additionally fails `CATALOG` when the property KEY is absent from
   * the component node entirely — the ONE presence check layered on top of the existing PRESENT-props
   * type/unknown checks (SPEC-R9's security allowlist scope, unchanged for every property that does not
   * opt in: `matchesType`/`matchesSchemaType` behavior is byte-identical). A `{path}`/`{call}` binding
   * satisfies presence (the key is there; its eventual resolved value is out of the static validator's
   * reach, ADR-0026) — only a fully OMITTED key fails. Declared only where a real authoring gap needs a
   * hard admission-time gate; absent ⇒ today's behavior, byte-identical.
   */
  required?: boolean
  /**
   * A catalog-declared extension (ADR-0226 cl.3) — cross-prop conformance: "this key's PRESENCE
   * requires those keys' PRESENCE" on the SAME component node. When declared, `conformance.ts`'s
   * shared validator fails `CATALOG` for each named key absent from the node WHENEVER the
   * declaring key is itself present (a `{path}`/`{call}` binding satisfies the declaring key's own
   * presence, same as GH #1189's `required`, ADR-0026). PRESENCE-based only — like `required`, it
   * never judges the eventual VALUE a bound key resolves to (an `icon` bound to a path that
   * resolves empty still satisfies `icon.requires:["label"]`'s presence check; that residual gap is
   * an owned limit, not a defect — ADR-0226 cl.3). Declared only where a real cross-prop contract
   * needs a hard admission-time gate (`Button.icon.requires:["label"]`, `Button.iconOnly.
   * requires:["icon"]`); absent ⇒ today's behavior, byte-identical for every prop that doesn't opt in.
   */
  requires?: readonly string[]
}

/**
 * A catalog function declaration (catalog LLD-C7, ADR-0026 / ADR-0034). `args` is a NAMED object
 * (`Record<string, JsonSchema>`) matching the wire `{call, args:{…}}` shape — the positional
 * `JsonSchema[]` form was non-conformant with A2UI v1.0 and is corrected here. `callableFrom`
 * is the v1.0 execution-boundary enum (ADR-0034 clause 2 / SPEC-R14 / fact 5): absent → `clientOnly`
 * (the spec default; least-authority; a function is not server-invocable unless explicitly opted in).
 */
export interface FunctionDef {
  args: Record<string, JsonSchema>
  returns: JsonSchema
  callableFrom: 'clientOnly' | 'remoteOnly' | 'clientOrRemote'
}

/** Load-time diagnostic codes. `NAME_INVALID` is the catalog SPEC §5.3 `CATALOG_NAME_INVALID`; */
/** `MALFORMED` covers structural defects the SPEC only requires the loader to throw on. */
export const CatalogLoadCode = {
  NAME_INVALID: 'CATALOG_NAME_INVALID',
  MALFORMED: 'CATALOG_MALFORMED',
} as const
export type CatalogLoadCode = (typeof CatalogLoadCode)[keyof typeof CatalogLoadCode]

export class CatalogError extends Error {
  readonly code: CatalogLoadCode
  constructor(code: CatalogLoadCode, message: string) {
    super(message)
    this.name = 'CatalogError'
    this.code = code
  }
}

/**
 * Render a `PropDef`'s declared type/enum as a compact, model-facing string (GH #288/#286): the system
 * prompt's catalog inventory (`system-prompt.ts`'s `catalogInventory`) and `produce.ts`'s self-correct
 * feedback (`messagesFor`) both need the SAME "what shape can this value take" description — a single
 * source, so a future JSON-Schema keyword the minimal validator (`conformance.ts`'s `matchesSchemaType`)
 * grows gets described consistently in both places rather than drifting between two hand-rolled copies.
 * An `enum` narrows first (its declared members, `|`-joined, matching the wire's exact-literal check);
 * otherwise the JSON-Schema `type` keyword (single or `anyOf`-style array, also `|`-joined); an
 * unconstrained schema (`type` absent) or a bare `true` boolean schema is `'any'`; a bare `false` schema
 * (accepts nothing) is `'never'` — both edge cases exist only in `JsonSchema`'s type, not in any shipped
 * catalog row today.
 *
 * Enum members whose spelling LOOKS numeric (e.g. `Card.elevation`'s `-3`..`3`, string-typed on the
 * wire) are individually double-quoted (`"-3"|"-2"|…`) — GH #286/#288 follow-up (2): the wire's
 * exact-literal check requires the STRING `"1"`, but an unquoted `-3|-2|-1|0|1|2|3` render is
 * indistinguishable from a bare-number enum, so a model kept guessing the bare number and exhausted
 * the self-correct budget. Non-numeric-spelled members (`h1|h2|body`) render unquoted, unchanged.
 */
const LOOKS_NUMERIC = /^-?\d+(\.\d+)?$/

export function describePropType(pd: PropDef): string {
  const schema = pd.type
  if (typeof schema === 'boolean') return schema ? 'any' : 'never'
  if (Array.isArray(schema.enum)) {
    return schema.enum
      .map((m) => {
        const s = String(m)
        return LOOKS_NUMERIC.test(s) ? `"${s}"` : s
      })
      .join('|')
  }
  const t = schema.type
  if (t === undefined) return 'any'
  return (Array.isArray(t) ? t : [t]).map(String).join('|')
}

const CHILD_MODELS = new Set(['child', 'children', 'ChildList'])

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function bad(message: string): never {
  throw new CatalogError(CatalogLoadCode.MALFORMED, message)
}
function badName(message: string): never {
  throw new CatalogError(CatalogLoadCode.NAME_INVALID, message)
}

/**
 * Parse + structurally validate a catalog document into a `Catalog`.
 * Accepts a JSON string (parsed first) or an already-parsed object. Throws `CatalogError`
 * (`MALFORMED` / `NAME_INVALID`) on any defect (catalog LLD-C1 load pipeline).
 */
export function loadCatalog(json: unknown): Catalog {
  const root: unknown = typeof json === 'string' ? parseJson(json) : json
  if (!isObject(root)) bad('catalog must be a JSON object')

  if (typeof root.catalogId !== 'string' || root.catalogId.length === 0) bad('catalog.catalogId must be a non-empty string')
  if (typeof root.protocolVersion !== 'string' || root.protocolVersion.length === 0) bad('catalog.protocolVersion must be a non-empty string')
  if (!isObject(root.components)) bad('catalog.components must be an object')

  const componentKeys = Object.keys(root.components)
  if (componentKeys.length === 0) bad('catalog.components must declare ≥1 component (SPEC-R1 AC1)')

  const components: Record<string, ComponentDef> = {}
  for (const key of componentKeys) {
    if (!validName(key)) badName(`component name "${key}" is not a valid UAX-31 / non-@ name`)
    components[key] = validateComponent(key, root.components[key])
  }

  const functions = validateFunctions(root.functions)

  const out: Catalog = {
    catalogId: root.catalogId,
    protocolVersion: root.protocolVersion,
    components,
    functions,
  }
  return out
}

function parseJson(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    bad('catalog string is not parseable JSON')
  }
}

// `validateComponent`/`validateFunctions` are exported (M-D, SPEC-R1 AC2, `persona-catalog-composition.spec.md`)
// so `catalog/compose.ts`'s `loadCatalogFragment` reuses the SAME structural + UAX-31 naming gates a whole
// catalog document runs, without inheriting `loadCatalog`'s whole-DOCUMENT-only invariants (the
// `catalog.components must declare ≥1 component` guard above, catalog SPEC-R1 AC1) — a fragment's `{}` is a
// legal identity-case input (SPEC-R2 AC1) a whole `Catalog` document's own load gate must still reject.
export function validateComponent(key: string, raw: unknown): ComponentDef {
  if (!isObject(raw)) bad(`component "${key}" must be an object`)

  // `name` is optional in the document; it defaults to the declaring key (the type identity
  // payloads reference). If present it must match the key and be a valid name.
  let name = key
  if (raw.name !== undefined) {
    if (typeof raw.name !== 'string') bad(`component "${key}".name must be a string`)
    if (!validName(raw.name)) badName(`component name "${raw.name}" is not a valid UAX-31 / non-@ name`)
    if (raw.name !== key) bad(`component "${key}".name must equal its key (got "${raw.name}")`)
    name = raw.name
  }

  if (!isObject(raw.properties)) bad(`component "${key}".properties must be an object`)
  const properties: Record<string, PropDef> = {}
  for (const prop of Object.keys(raw.properties)) {
    if (!validName(prop)) badName(`property name "${prop}" on "${key}" is not a valid UAX-31 / non-@ name`)
    properties[prop] = validatePropDef(key, prop, raw.properties[prop])
  }

  const def: ComponentDef = { name, properties }

  if (raw.children !== undefined) {
    if (typeof raw.children !== 'string' || !CHILD_MODELS.has(raw.children)) {
      bad(`component "${key}".children must be one of child | children | ChildList`)
    }
    def.children = raw.children as ComponentDef['children']
  }

  if (raw.value !== undefined) {
    def.value = validateValueMark(key, raw.value)
  }

  return def
}

const MARSHAL_VALUES = new Set(['singletonStringList'])

const isValueSlot = (v: unknown): v is ValueSlot =>
  isObject(v) &&
  typeof v.prop === 'string' &&
  typeof v.event === 'string' &&
  (v.readProp === undefined || typeof v.readProp === 'string') &&
  (v.marshal === undefined || MARSHAL_VALUES.has(v.marshal as string))

/** Build a normalized `ValueSlot`, carrying `readProp`/`marshal` only when the raw entry declared them
 *  (ADR-0169 cl.7) — omitting both reproduces the pre-cl.7 slot shape byte-for-byte. */
function toSlot(entry: { prop: string; event: string; readProp?: string; marshal?: string }): ValueSlot {
  const slot: ValueSlot = { prop: entry.prop, event: entry.event }
  if (entry.readProp !== undefined) slot.readProp = entry.readProp
  if (entry.marshal !== undefined) slot.marshal = entry.marshal as ValueSlot['marshal']
  return slot
}

/**
 * Validate a component's `value` mark (ADR-0161, widened by ADR-0169 cl.7): the single-object form,
 * unchanged, or a non-empty array of `{prop,event,readProp?,marshal?}` slots with DISTINCT `prop`
 * names across slots (two slots writing back the same DOM prop is ambiguous — rejected at load).
 * Events MAY repeat (a multi-prop commit gesture, e.g. Calendar's range pair, fires one shared
 * `change`). `readProp`/`marshal`, when present, are validated by `isValueSlot` above (a non-string
 * `readProp` or a `marshal` outside the closed enum fails load).
 */
function validateValueMark(key: string, raw: unknown): ValueSlot | readonly ValueSlot[] {
  if (Array.isArray(raw)) {
    if (raw.length === 0) bad(`component "${key}".value array must be non-empty`)
    const slots = raw.map((entry) => {
      if (!isValueSlot(entry)) bad(`component "${key}".value entries must each be { prop: string; event: string; readProp?: string; marshal?: 'singletonStringList' }`)
      return toSlot(entry)
    })
    const props = slots.map((s) => s.prop)
    if (new Set(props).size !== props.length) bad(`component "${key}".value slot props must be distinct`)
    return slots
  }
  if (!isValueSlot(raw))
    bad(`component "${key}".value must be { prop: string; event: string; readProp?: string; marshal?: 'singletonStringList' } or a non-empty array of such`)
  return toSlot(raw)
}

function validatePropDef(key: string, prop: string, raw: unknown): PropDef {
  if (!isObject(raw)) bad(`property "${key}.${prop}" must be an object`)
  if (raw.type === undefined) bad(`property "${key}.${prop}" must declare a type schema`)
  if (typeof raw.mapsTo !== 'string') bad(`property "${key}.${prop}".mapsTo must be a string`)
  if (raw.bindable !== undefined && typeof raw.bindable !== 'boolean') bad(`property "${key}.${prop}".bindable must be a boolean`)
  if (raw.format !== undefined && typeof raw.format !== 'string') bad(`property "${key}.${prop}".format must be a string`)
  if (raw.rejectFunctionCall !== undefined && typeof raw.rejectFunctionCall !== 'boolean')
    bad(`property "${key}.${prop}".rejectFunctionCall must be a boolean`)
  if (raw.required !== undefined && typeof raw.required !== 'boolean')
    bad(`property "${key}.${prop}".required must be a boolean`)
  if (raw.requires !== undefined && (!Array.isArray(raw.requires) || raw.requires.some((r) => typeof r !== 'string')))
    bad(`property "${key}.${prop}".requires must be a string array`)

  const pd: PropDef = { type: raw.type as JsonSchema, mapsTo: raw.mapsTo }
  if (raw.bindable !== undefined) pd.bindable = raw.bindable
  if (raw.format !== undefined) pd.format = raw.format
  if (raw.rejectFunctionCall !== undefined) pd.rejectFunctionCall = raw.rejectFunctionCall
  if (raw.required !== undefined) pd.required = raw.required
  if (raw.requires !== undefined) pd.requires = raw.requires as readonly string[]
  return pd
}

const CALLABLE_FROM_VALUES = new Set(['clientOnly', 'remoteOnly', 'clientOrRemote'])

export function validateFunctions(raw: unknown): Record<string, FunctionDef> {
  if (raw === undefined) return {}
  if (!isObject(raw)) bad('catalog.functions must be an object')
  const out: Record<string, FunctionDef> = {}
  for (const fn of Object.keys(raw)) {
    if (!validName(fn)) badName(`function name "${fn}" is not a valid UAX-31 / non-@ name`)
    const def = raw[fn]
    // `args` is a NAMED object (ADR-0026: corrected from the prior positional JsonSchema[] shape).
    if (!isObject(def) || !isObject(def.args) || def.returns === undefined) {
      bad(`function "${fn}" must be { args: Record<string,JsonSchema>; returns: JsonSchema }`)
    }
    // `callableFrom` defaults to 'clientOnly' (v1.0 spec default, ADR-0034 clause 2 / fact 5:
    // "If omitted, it defaults to clientOnly"). Least-authority: a function is not server-invocable
    // unless explicitly declared `remoteOnly`/`clientOrRemote`.
    let callableFrom: FunctionDef['callableFrom'] = 'clientOnly'
    if (def.callableFrom !== undefined) {
      if (typeof def.callableFrom !== 'string' || !CALLABLE_FROM_VALUES.has(def.callableFrom)) {
        bad(`function "${fn}".callableFrom must be 'clientOnly' | 'remoteOnly' | 'clientOrRemote' (or absent)`)
      }
      callableFrom = def.callableFrom as FunctionDef['callableFrom']
    }
    out[fn] = { args: def.args as Record<string, JsonSchema>, returns: def.returns as JsonSchema, callableFrom }
  }
  return out
}
