// component-descriptor.ts — the reusable {name}.md frontmatter reader + the descriptor schema (ADR-0004).
//
// A component's public surface is recorded as `{name}.md` YAML frontmatter (ADR-0004 — the descriptor
// replaces the never-built `{name}.api.json`). Two artifacts live here, both consumed by the governance
// slices that target that fence:
//
//   1. parseDescriptor(fence)            — the fence-scoped READER (factored out of the s8 button probe so
//                                          the s10 contract↔props trip-wire + every future component reuse
//                                          ONE parser, never a divergent copy — the drift the process kills).
//   2. validateComponentDescriptor(desc) — the descriptor SCHEMA: a hand-rolled, TOTAL structural validator
//                                          that IS the referential standard the frontmatter is checked
//                                          against (process.md §4's "api-contract schema", now a frontmatter
//                                          schema per ADR-0004). It is the STRUCTURAL standard only — the
//                                          live-props comparison (frontmatter ≡ finalize(Class)) is s10.
//
// Zero-dep by ruling: no YAML parser is installed and the descriptor is a CONTROLLED format, so the reader is
// a small indentation-scoped parser over the subset the descriptor uses (top-level scalars · `- ` sequences ·
// nested maps · inline `[a, b]` arrays · trailing `#` comments). It never executes the file; it reads text.

/** The three top-level value shapes a descriptor field can take. */
export type DescriptorShape = 'scalar' | 'sequence' | 'map'

/** A single `- ` mapping inside a sequence block (its field values; an inline `[a, b]` becomes a string[]). */
export type SequenceItem = Map<string, string | string[]>

/** A typed view of one `attributes[]` entry (the attributes-as-API row). */
export interface ParsedAttribute {
  name?: string
  type?: string
  values?: string[]
  default?: string
  reflect?: boolean
}

/** The structured frontmatter: the bucket each top-level field parsed into, plus a typed attributes view. */
export interface ParsedDescriptor {
  topLevelKeys: Set<string>
  scalars: Map<string, string>
  sequences: Map<string, SequenceItem[]>
  maps: Map<string, Map<string, string>>
  attributes: ParsedAttribute[]
}

// ── reader ──────────────────────────────────────────────────────────────────────────────────────────────

/** Split the leading `---`…`---` frontmatter fence from the prose body. Throws if there is no fence. */
export function splitFrontmatter(src: string): { fence: string; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(src)
  if (!m) throw new Error('source has no leading --- frontmatter fence')
  return { fence: m[1], body: m[2] }
}

const COMMENT_OR_BLANK = /^\s*#|^\s*$/

/** Strip a whitespace-led inline `#` comment. (Controlled format: values carry no literal `#`.) */
const stripComment = (raw: string): string => raw.replace(/\s+#.*$/, '').trim()
/** Drop a single pair of surrounding quotes (e.g. `'null'` → `null`). */
const unquote = (s: string): string => /^(['"])([\s\S]*)\1$/.exec(s)?.[2] ?? s
/** A scalar value: comment-stripped, unquoted, trimmed. */
const scalarValue = (raw: string): string => unquote(stripComment(raw))

interface RawBlock {
  key: string
  inline: string
  childLines: string[]
}

/** Group the fence into top-level (column-0) `key:` blocks with their indented child lines. */
function toBlocks(fence: string): RawBlock[] {
  const blocks: RawBlock[] = []
  let current: RawBlock | null = null
  for (const line of fence.split('\n')) {
    if (COMMENT_OR_BLANK.test(line)) continue
    const top = /^([A-Za-z][\w]*):(.*)$/.exec(line) // `^[A-Za-z]` ⇒ column 0, no leading whitespace
    if (top) {
      current = { key: top[1], inline: top[2], childLines: [] }
      blocks.push(current)
    } else if (current) {
      current.childLines.push(line)
    }
  }
  return blocks
}

/** Parse a `key: value` field line into a sequence item (inline `[a, b]` → string[]). */
function addField(item: SequenceItem, text: string): void {
  const m = /^\s*([A-Za-z][\w]*):\s*([\s\S]*)$/.exec(text)
  if (!m) return
  const value = scalarValue(m[2])
  if (/^\[.*\]$/.test(value)) {
    item.set(m[1], value.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter((s) => s !== ''))
  } else {
    item.set(m[1], value)
  }
}

/** Parse an indented `- ` sequence block into a list of field mappings. */
function parseSequence(lines: string[]): SequenceItem[] {
  const items: SequenceItem[] = []
  let current: SequenceItem | null = null
  for (const line of lines) {
    const dash = /^\s*-\s*(.*)$/.exec(line)
    if (dash) {
      current = new Map()
      items.push(current)
      addField(current, dash[1])
    } else if (current) {
      addField(current, line)
    }
  }
  return items
}

/** Parse an indented nested-mapping block (e.g. `face`/`aria`/`geometry`) into a key→scalar map. */
function parseMap(lines: string[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const line of lines) {
    const m = /^\s*([A-Za-z][\w]*):\s*([\s\S]*)$/.exec(line)
    if (m) map.set(m[1], scalarValue(m[2]))
  }
  return map
}

/** Shape one raw `attributes[]` item into a typed ParsedAttribute. */
function toAttribute(item: SequenceItem): ParsedAttribute {
  const name = item.get('name')
  const type = item.get('type')
  const values = item.get('values')
  const def = item.get('default')
  const reflect = item.get('reflect')
  return {
    name: typeof name === 'string' ? name : undefined,
    type: typeof type === 'string' ? type : undefined,
    values: Array.isArray(values) ? values : typeof values === 'string' ? [values] : undefined,
    default: typeof def === 'string' ? def : undefined,
    reflect: reflect === 'true' ? true : reflect === 'false' ? false : undefined,
  }
}

/** Read a frontmatter fence into the structured descriptor (top-level keys · scalars · sequences · maps). */
export function parseDescriptor(fence: string): ParsedDescriptor {
  const scalars = new Map<string, string>()
  const sequences = new Map<string, SequenceItem[]>()
  const maps = new Map<string, Map<string, string>>()
  for (const block of toBlocks(fence)) {
    const inline = scalarValue(block.inline)
    if (inline === '[]') sequences.set(block.key, [])
    else if (inline === '{}') maps.set(block.key, new Map())
    else if (inline !== '') scalars.set(block.key, inline)
    else if (block.childLines.length > 0 && /^\s*-/.test(block.childLines[0])) sequences.set(block.key, parseSequence(block.childLines))
    else maps.set(block.key, parseMap(block.childLines))
  }
  const topLevelKeys = new Set<string>([...scalars.keys(), ...sequences.keys(), ...maps.keys()])
  const attributes = (sequences.get('attributes') ?? []).map(toAttribute)
  return { topLevelKeys, scalars, sequences, maps, attributes }
}

// ── schema ──────────────────────────────────────────────────────────────────────────────────────────────

/** The structural defects validateComponentDescriptor reports. */
export const DESCRIPTOR_CODES = ['MISSING_FIELD', 'BAD_SHAPE', 'BAD_TAG', 'BAD_TIER', 'BAD_EXTENDS', 'BAD_ATTRIBUTE', 'BAD_FACE'] as const
export type DescriptorCode = (typeof DESCRIPTOR_CODES)[number]

/** One structural failure: a stable code + the field path it occurred at + a human message. */
export interface DescriptorFailure {
  code: DescriptorCode
  path: string
  message: string
}

// The descriptor field set (ADR-0004 / plan §10) and the shape each field MUST parse into.
const FIELD_SHAPE: Record<string, DescriptorShape> = {
  tag: 'scalar',
  tier: 'scalar',
  extends: 'scalar',
  attributes: 'sequence',
  properties: 'sequence',
  events: 'sequence',
  slots: 'sequence',
  parts: 'sequence',
  customStates: 'sequence',
  face: 'map',
  aria: 'map',
  keyboard: 'sequence',
  geometry: 'map',
  forcedColors: 'scalar',
}

const SIZE_CLASSES = ['control', 'indicator', 'pattern', 'container', 'layout', 'display'] as const // geometry.md "five size-classes"
const ATTR_TYPES = ['enum', 'boolean', 'number', 'string', 'json'] as const // the attribute codec set
const BASE_CLASSES = ['UIElement', 'UIFormElement'] as const // the two dom/ base elements
const BOOLEANS = ['true', 'false'] as const

const has = (set: readonly string[], v: string): boolean => set.includes(v)

/**
 * Validate a parsed frontmatter against the component-descriptor schema (ADR-0004). TOTAL — never throws;
 * every defect is a structured DescriptorFailure. This is the structural referential standard the contract
 * trip-wire (s10) builds on; it does NOT compare against the live class.
 */
export function validateComponentDescriptor(d: ParsedDescriptor): DescriptorFailure[] {
  const failures: DescriptorFailure[] = []
  const add = (code: DescriptorCode, path: string, message: string): void => void failures.push({ code, path, message })

  // 1 — every required field is present and parsed into its declared shape.
  for (const field of Object.keys(FIELD_SHAPE)) {
    if (!d.topLevelKeys.has(field)) {
      add('MISSING_FIELD', field, `required field "${field}" is absent`)
      continue
    }
    const shape = FIELD_SHAPE[field]
    const present = shape === 'scalar' ? d.scalars.has(field) : shape === 'sequence' ? d.sequences.has(field) : d.maps.has(field)
    if (!present) add('BAD_SHAPE', field, `field "${field}" must be a ${shape}`)
  }

  // 2 — tag is a ui-{name} custom-element tag.
  const tag = d.scalars.get('tag')
  if (tag !== undefined && !/^ui-[a-z][a-z0-9-]*$/.test(tag)) add('BAD_TAG', 'tag', `tag "${tag}" must match ui-{name}`)

  // 3 — tier is one of the geometry size-classes.
  const tier = d.scalars.get('tier')
  if (tier !== undefined && !has(SIZE_CLASSES, tier)) add('BAD_TIER', 'tier', `tier "${tier}" is not a size-class`)

  // 4 — extends is a known base element.
  const ext = d.scalars.get('extends')
  if (ext !== undefined && !has(BASE_CLASSES, ext)) add('BAD_EXTENDS', 'extends', `extends "${ext}" is not a known base element`)

  // 5 — each attributes[] entry is a well-formed attributes-as-API row.
  const seen = new Set<string>()
  for (const [i, item] of (d.sequences.get('attributes') ?? []).entries()) {
    const at = (sub: string): string => `attributes[${i}].${sub}`
    const name = item.get('name')
    if (typeof name !== 'string' || name === '') {
      add('BAD_ATTRIBUTE', at('name'), `attribute #${i} is missing a name`)
    } else {
      if (seen.has(name)) add('BAD_ATTRIBUTE', at('name'), `duplicate attribute name "${name}"`)
      seen.add(name)
    }
    const type = item.get('type')
    if (typeof type !== 'string' || !has(ATTR_TYPES, type)) {
      add('BAD_ATTRIBUTE', at('type'), `attribute "${name ?? i}" has an invalid type "${typeof type === 'string' ? type : ''}"`)
    } else if (type === 'enum' && !(Array.isArray(item.get('values')) && (item.get('values') as string[]).length > 0)) {
      add('BAD_ATTRIBUTE', at('values'), `enum attribute "${name ?? i}" needs a non-empty values list`)
    }
    if (!item.has('default')) add('BAD_ATTRIBUTE', at('default'), `attribute "${name ?? i}" is missing a default`)
    const reflect = item.get('reflect')
    if (typeof reflect !== 'string' || !has(BOOLEANS, reflect)) add('BAD_ATTRIBUTE', at('reflect'), `attribute "${name ?? i}" reflect must be true|false`)
  }

  // 6 — face records a boolean formAssociated (FACE form-control participation).
  const face = d.maps.get('face')
  if (face !== undefined) {
    const fa = face.get('formAssociated')
    if (fa === undefined || !has(BOOLEANS, fa)) add('BAD_FACE', 'face.formAssociated', 'face.formAssociated must be true|false')
  }

  return failures
}
