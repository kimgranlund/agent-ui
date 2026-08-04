// validate-input.ts — LLD-C2 (SPEC-R17 / ADR-0168 cl.3): the ONE place a model-authored tool input is
// checked against the manifest's declared `input_schema`, so the schema stops being advisory. Hand-rolled
// and dependency-free on purpose (SPEC-N1's posture — this module ships inside the production Cloudflare
// Worker bundle, ADR-0152), covering a deliberately CLOSED subset of JSON Schema:
//
//   { type: 'object', properties: { <name>: { type: 'string'|'number'|'integer'|'boolean' } }, required?: string[] }
//
// Two entry points, two different moments:
//   · `validateToolInput` runs at DISPATCH — pure, never throws, returns structured failures naming each
//     bad field (the dispatch turns those into the rejection the adapter converts to an `is_error`
//     tool_result; GH #49's degrade-the-answer-never-the-turn contract).
//   · `assertSupportedSchema` runs at REGISTRATION only — it THROWS if a manifest declares anything the
//     checker above cannot enforce (nested objects/arrays, oneOf/anyOf/allOf, enum, format, …), so the
//     failure mode is a boot fail-fast, never a silently half-validated tool (SPEC-R17).
//
// Unknown extra input properties are PERMITTED — JSON Schema's own default; tightening that is a later,
// observable decision (ADR-0168 cl.3), not a silent one taken here.

/** The property types the checker can enforce. `integer` is a `number` that is `Number.isInteger`. */
const PRIMITIVE_TYPES = ['string', 'number', 'integer', 'boolean'] as const
type PrimitiveType = (typeof PRIMITIVE_TYPES)[number]

/** The only keywords a supported schema may use — at the root, and per property. */
const ROOT_KEYWORDS = ['type', 'properties', 'required', 'description'] as const
const PROPERTY_KEYWORDS = ['type', 'description'] as const

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Present = the key exists AND is not explicitly `undefined` (so `{place: undefined}` reads as missing,
 *  reported once as "required" rather than twice, as required AND wrong-typed). */
function isPresent(input: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(input, key) && input[key] !== undefined
}

function matchesType(value: unknown, type: PrimitiveType): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value)
    case 'boolean':
      return typeof value === 'boolean'
  }
}

/** `integer` reads better as "an integer" than "a integer"; the rest take "a". */
function article(type: PrimitiveType): string {
  return type === 'integer' ? 'an' : 'a'
}

/**
 * Check one tool call's input against its declared `input_schema` (the supported subset above). Pure and
 * total: NEVER throws, even on a schema shape it does not understand (registration already fail-fasts on
 * those — this is the dispatch path, where a throw would be the wrong failure mode). Extra properties the
 * schema does not declare are allowed.
 */
export function validateToolInput(
  schema: Record<string, unknown>,
  input: Record<string, unknown>,
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = []

  const required = schema.required
  if (Array.isArray(required)) {
    for (const name of required) {
      if (typeof name === 'string' && !isPresent(input, name)) errors.push(`\`${name}\` is required`)
    }
  }

  const properties = schema.properties
  if (isPlainObject(properties)) {
    for (const [name, declared] of Object.entries(properties)) {
      if (!isPlainObject(declared)) continue
      const type = declared.type
      if (!isPrimitiveType(type)) continue
      if (!isPresent(input, name)) continue
      if (!matchesType(input[name], type)) errors.push(`\`${name}\` must be ${article(type)} ${type}`)
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}

function isPrimitiveType(value: unknown): value is PrimitiveType {
  return typeof value === 'string' && (PRIMITIVE_TYPES as readonly string[]).includes(value)
}

/**
 * REGISTRATION-TIME ONLY (SPEC-R17): throw if `schema` uses anything `validateToolInput` cannot enforce.
 * The subset is closed by an ALLOW-list of keywords, so a construct nobody anticipated (`$ref`,
 * `patternProperties`, a future keyword) fails loudly at boot instead of passing unchecked at dispatch.
 */
export function assertSupportedSchema(schema: Record<string, unknown>): void {
  if (!isPlainObject(schema)) throw new Error('unsupported input_schema: must be a JSON Schema object')
  if (schema.type !== 'object') {
    throw new Error(`unsupported input_schema: root \`type\` must be "object" (got ${JSON.stringify(schema.type)})`)
  }

  for (const keyword of Object.keys(schema)) {
    if (!(ROOT_KEYWORDS as readonly string[]).includes(keyword)) {
      throw new Error(
        `unsupported input_schema: keyword \`${keyword}\` (the supported subset is ${ROOT_KEYWORDS.join('/')})`,
      )
    }
  }

  if (schema.required !== undefined) {
    if (!Array.isArray(schema.required) || schema.required.some((name) => typeof name !== 'string')) {
      throw new Error('unsupported input_schema: `required` must be an array of property names')
    }
  }

  if (schema.properties === undefined) return
  if (!isPlainObject(schema.properties)) throw new Error('unsupported input_schema: `properties` must be an object')

  for (const [name, declared] of Object.entries(schema.properties)) {
    if (!isPlainObject(declared)) {
      throw new Error(`unsupported input_schema: property \`${name}\` must be a schema object`)
    }
    if (!isPrimitiveType(declared.type)) {
      throw new Error(
        `unsupported input_schema: property \`${name}\` declares type ${JSON.stringify(declared.type)} ` +
          `(supported: ${PRIMITIVE_TYPES.join(', ')})`,
      )
    }
    for (const keyword of Object.keys(declared)) {
      if (!(PROPERTY_KEYWORDS as readonly string[]).includes(keyword)) {
        throw new Error(
          `unsupported input_schema: property \`${name}\` uses keyword \`${keyword}\` ` +
            `(the supported subset is ${PROPERTY_KEYWORDS.join('/')})`,
        )
      }
    }
  }
}
