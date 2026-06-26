// catalog.ts — Catalog schema model + loader (catalog LLD-C1, catalog SPEC-R1/R4).
//
// `loadCatalog` parses + structurally validates a catalog document and produces the `Catalog`
// type the shared validator (`renderer/validate.ts`, LLD-C11) consumes. Invariant: a returned
// `Catalog` is structurally valid — downstream code never re-checks shape. The loader THROWS a
// `CatalogError` on a malformed document (it is a load-time gate, not a wire-error producer).

import { validName } from './naming.ts'

/** A JSON-Schema fragment: an object schema or a boolean schema (`true`/`false`). */
export type JsonSchema = Record<string, unknown> | boolean

/** A2UI v1.0 catalog (catalog SPEC §5.1). */
export interface Catalog {
  catalogId: string
  protocolVersion: string
  components: Record<string, ComponentDef>
  functions: Record<string, FunctionDef>
  surfaceProperties?: JsonSchema
}

export interface ComponentDef {
  name: string
  properties: Record<string, PropDef>
  children?: 'child' | 'children' | 'ChildList'
  value?: { prop: string; event: string }
}

export interface PropDef {
  type: JsonSchema
  bindable?: boolean
  mapsTo: string
}

export interface FunctionDef {
  args: JsonSchema[]
  returns: JsonSchema
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
  if (root.surfaceProperties !== undefined) out.surfaceProperties = root.surfaceProperties as JsonSchema
  return out
}

function parseJson(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    bad('catalog string is not parseable JSON')
  }
}

function validateComponent(key: string, raw: unknown): ComponentDef {
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
    if (!isObject(raw.value) || typeof raw.value.prop !== 'string' || typeof raw.value.event !== 'string') {
      bad(`component "${key}".value must be { prop: string; event: string }`)
    }
    def.value = { prop: raw.value.prop, event: raw.value.event }
  }

  return def
}

function validatePropDef(key: string, prop: string, raw: unknown): PropDef {
  if (!isObject(raw)) bad(`property "${key}.${prop}" must be an object`)
  if (raw.type === undefined) bad(`property "${key}.${prop}" must declare a type schema`)
  if (typeof raw.mapsTo !== 'string') bad(`property "${key}.${prop}".mapsTo must be a string`)
  if (raw.bindable !== undefined && typeof raw.bindable !== 'boolean') bad(`property "${key}.${prop}".bindable must be a boolean`)

  const pd: PropDef = { type: raw.type as JsonSchema, mapsTo: raw.mapsTo }
  if (raw.bindable !== undefined) pd.bindable = raw.bindable
  return pd
}

function validateFunctions(raw: unknown): Record<string, FunctionDef> {
  if (raw === undefined) return {}
  if (!isObject(raw)) bad('catalog.functions must be an object')
  const out: Record<string, FunctionDef> = {}
  for (const fn of Object.keys(raw)) {
    if (!validName(fn)) badName(`function name "${fn}" is not a valid UAX-31 / non-@ name`)
    const def = raw[fn]
    if (!isObject(def) || !Array.isArray(def.args) || def.returns === undefined) {
      bad(`function "${fn}" must be { args: JsonSchema[]; returns: JsonSchema }`)
    }
    out[fn] = { args: def.args as JsonSchema[], returns: def.returns as JsonSchema }
  }
  return out
}
