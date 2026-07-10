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
//                                          schema per ADR-0004). It is the STRUCTURAL standard only — it does
//                                          NOT compare the frontmatter against the live class.
//   3. compareDescriptorToProps(a, p)    — the contract↔props TRIP-WIRE (process.md §1): asserts the
//                                          descriptor's `attributes[]` and the live `static props` table
//                                          (what `finalize(Class)` installs from) are a faithful BIJECTION,
//                                          so the descriptor cannot drift from the real component. Fleet-wide
//                                          (any component runs it); kept import-free by reading the live props
//                                          STRUCTURALLY (LivePropConfig) instead of pulling the dom layer.
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

/** Sentinel key a BARE-SCALAR sequence item (`- ready`, no `key:` of its own) stores its value under. `#` can
 *  never be a real field name (fields match `[A-Za-z][\w]*`), so it cannot collide — and `scalarSeq` reads it back. */
const BARE_SCALAR_KEY = '#scalar'

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

/** Parse a `key: value` field line into a sequence item (inline `[a, b]` → string[]); a bare scalar with no
 *  `key:` of its own (e.g. customStates `- ready`) is kept under BARE_SCALAR_KEY (was DROPPED before this fix).
 *  An inline array element ELEMENT is `.filter`ed for blank/trailing-comma ARTIFACTS (an empty split segment,
 *  e.g. `[a, b, ]`'s trailing slot) BEFORE it is `unquote()`d — in that order, so a genuinely-quoted empty
 *  string (`''`/`""`, 2 characters pre-unquote, needed for ADR-0083's `landmark` enum whose first member IS
 *  the empty string) survives the artifact filter and only THEN unquotes to a real `''`, rather than being
 *  indistinguishable from a blank artifact and dropped. Every existing bare (unquoted) token is unaffected —
 *  `unquote` is a no-op unless the WHOLE element is wrapped in one matching quote pair. */
function addField(item: SequenceItem, text: string): void {
  const m = /^\s*([A-Za-z][\w]*):\s*([\s\S]*)$/.exec(text)
  if (!m) {
    const bare = scalarValue(text)
    if (bare !== '') item.set(BARE_SCALAR_KEY, bare)
    return
  }
  const value = scalarValue(m[2])
  if (/^\[.*\]$/.test(value)) {
    item.set(
      m[1],
      value.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter((s) => s !== '').map((s) => unquote(s)),
    )
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

/**
 * Read a BARE-SCALAR sequence field as the list of values its items carry (e.g. customStates `- ready` →
 * `['ready']`). A bare-scalar item parses to a single-entry map keyed by BARE_SCALAR_KEY (the addField fix);
 * this reads those back. Items that are full `key: value` mappings (e.g. attributes/slots) contribute nothing.
 */
export function scalarSeq(desc: ParsedDescriptor, field: string): string[] {
  const out: string[] = []
  for (const item of desc.sequences.get(field) ?? []) {
    const v = item.get(BARE_SCALAR_KEY)
    if (typeof v === 'string') out.push(v)
  }
  return out
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

const SIZE_CLASSES = ['control', 'indicator', 'range', 'pattern', 'container', 'layout', 'display'] as const // geometry.md size-class set (range added for Wave-2 Range family)
const ATTR_TYPES = ['enum', 'boolean', 'number', 'string', 'json'] as const // the attribute codec set
const BASE_CLASSES = [
  'UIElement',
  'UIFormElement',
  'UIContainerElement',
  // Wave 0/1 control-suite bases (controls/_base/); each is a direct-extends target for leaf controls.
  'UIIndicatorElement', // checkbox / switch / radio (ADR-0042)
  'UIRangeElement',     // slider family
  'UIListboxElement',   // listbox / select options (listbox-roving LLD-C3)
] as const
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

// ── contract↔props trip-wire ────────────────────────────────────────────────────────────────────────────
//
// The schema above proves the frontmatter is STRUCTURALLY well-formed; it does NOT prove the descriptor tells
// the truth about the component. compareDescriptorToProps closes that gap (process.md §1): it asserts the
// descriptor's `attributes[]` and the live `static props` table (what `finalize(Class)` installs accessors
// from) are in BIJECTION and field-consistent, so the descriptor cannot drift from the real component without
// a red probe.
//
// The live props are read STRUCTURALLY (LivePropConfig) so this module stays import-free — it never pulls the
// dom layer; a caller passes `Class.props`, which satisfies LiveProps structurally. The codecs carry no kind
// tag, so a prop's type kind is recovered by PROBING `config.type.from` (kindOf), never by reading a field
// that does not exist.

/** A live `static props` entry, read structurally (no dom import — this module imports nothing). */
export interface LivePropConfig {
  type: { from(attr: string | null): unknown }
  default: unknown
  attribute?: string | false
  reflect?: boolean
}

/** A live `static props` table keyed by prop name (a control's `Class.props` satisfies this structurally). */
export type LiveProps = Record<string, LivePropConfig>

/** The drift defects compareDescriptorToProps reports (the descriptor disagrees with the live class). */
export const DRIFT_CODES = ['DRIFT_MISSING', 'DRIFT_EXTRA', 'DRIFT_TYPE', 'DRIFT_DEFAULT', 'DRIFT_REFLECT', 'DRIFT_VALUES'] as const
export type DriftCode = (typeof DRIFT_CODES)[number]

/** One drift defect: a stable code + the descriptor path it occurred at + a human message. */
export interface DriftFailure {
  code: DriftCode
  path: string
  message: string
}

/** The codec kinds a descriptor `type` can name (mirrors props.ts ATTR_TYPES); kindOf recovers it by probing. */
export type DriftKind = 'enum' | 'boolean' | 'number' | 'string' | 'json' | 'unknown'

/** A sentinel attribute string that is never a valid enum member nor valid JSON (probes the codec fallback). */
const NON_MEMBER = '\u0000__agent-ui-non-member__'

type Probe = { ok: true; value: unknown } | { ok: false }

/** Run a codec probe, swallowing throws (an opaque codec may throw on input it cannot parse, e.g. JSON). */
function probe(fn: () => unknown): Probe {
  try {
    return { ok: true, value: fn() }
  } catch {
    return { ok: false }
  }
}

/**
 * Recover a live codec's KIND by behaviour (the codecs carry no kind tag — props.ts). Each branch keys off
 * `config.type.from` on a few probe inputs: boolean maps absence→false / presence→true; number and json both
 * map absence→null but split on `from('5')` vs `from('"x"')` (json parses, number does not); a STRING/ENUM
 * codec both map absence→a string, so the two are told apart by a SECOND probe: `from(NON_MEMBER)` (a garbage
 * sentinel no real enum contains) — a plain string codec is a passthrough (`attr ?? ''`), so it returns
 * NON_MEMBER UNCHANGED; an enum SNAPS a non-member back to its fixed `values[0]`, so it returns something
 * OTHER than NON_MEMBER (even when that fixed member is itself `''` — ADR-0083's `landmark`, whose enum
 * `values[0]` is the empty string, would otherwise be indistinguishable from a plain string prop: both read
 * `from(null) === ''`. Only the NON_MEMBER probe's OUTCOME, never its literal value, tells them apart — a bare
 * `nul.value === ''` shortcut checked BEFORE this probe was the pre-ADR-0083 bug). Returns 'unknown' when no
 * branch matches (the natural DRIFT_TYPE signal).
 */
function kindOf(config: LivePropConfig): DriftKind {
  const from = (a: string | null): Probe => probe(() => config.type.from(a))
  const nul = from(null)
  if (!nul.ok) return 'unknown'
  // A HARDENED array codec (SPEC-R3/R7, the chart family's safe values/data codecs) maps a removed/absent
  // attribute to `[]`, never `null` — the generic `jsonType<T>()` shape below never produces this. An array
  // result is unambiguous (never `false`/string/`null`), so it is classified "json" directly, ahead of the
  // null-keyed branches that would otherwise miss it and fall through to 'unknown'.
  if (Array.isArray(nul.value)) return 'json'
  if (nul.value === false) {
    const empty = from('')
    return empty.ok && empty.value === true ? 'boolean' : 'unknown'
  }
  if (typeof nul.value === 'string') {
    const fallback = from(NON_MEMBER)
    if (fallback.ok && fallback.value !== NON_MEMBER) return 'enum'
    if (nul.value === '') return 'string'
  }
  if (nul.value === null) {
    const empty = from('')
    const five = from('5')
    if (empty.ok && empty.value === null && five.ok && five.value === 5) return 'number'
    const quoted = from('"x"')
    return quoted.ok && quoted.value === 'x' ? 'json' : 'unknown'
  }
  return 'unknown'
}

/**
 * Probe whether a live enum codec accepts EXACTLY the descriptor's `values` (order-significant): every
 * declared member must round-trip (be a real live member) and the fallback for a non-member must equal
 * `values[0]` (so the first member — the codec's snap target — agrees). NOTE the one asymmetry probing an
 * opaque closure cannot close: a live member the descriptor OMITS while preserving the prefix is invisible
 * (you cannot enumerate the closure), so values[] must be the declared contract a human keeps complete.
 */
function enumMembersMatch(config: LivePropConfig, values: string[]): boolean {
  if (values.length === 0) return false
  const from = (a: string | null): Probe => probe(() => config.type.from(a))
  const everyMember = values.every((v) => {
    const r = from(v)
    return r.ok && r.value === v
  })
  const fallback = from(NON_MEMBER)
  return everyMember && fallback.ok && fallback.value === values[0]
}

/**
 * The contract↔props trip-wire: assert the descriptor `attributes[]` and the live `static props` are a
 * faithful BIJECTION. TOTAL — never throws; every disagreement is a structured DriftFailure. Checks: (NAME)
 * every live prop has a descriptor attribute and vice-versa (DRIFT_MISSING / DRIFT_EXTRA); then per matched
 * name the (TYPE) live codec behaves as the declared kind (DRIFT_TYPE), the (DEFAULT) `String(config.default)`
 * equals the descriptor token (DRIFT_DEFAULT), the (REFLECT) `config.reflect ?? false` equals the flag
 * (DRIFT_REFLECT), and (VALUES) an enum's declared members are the live member set (DRIFT_VALUES). The
 * descriptor is assumed schema-valid first (validateComponentDescriptor); nameless attributes are that
 * validator's concern and are skipped here.
 */
export function compareDescriptorToProps(attributes: ParsedAttribute[], props: LiveProps): DriftFailure[] {
  const failures: DriftFailure[] = []
  const add = (code: DriftCode, path: string, message: string): void => void failures.push({ code, path, message })

  const byName = new Map<string, ParsedAttribute>()
  for (const a of attributes) if (a.name !== undefined && a.name !== '') byName.set(a.name, a)
  const liveNames = Object.keys(props)
  const liveSet = new Set(liveNames)

  // 1 — NAME bijection: a live prop with no descriptor row is MISSING; a descriptor row with no live prop is EXTRA.
  for (const name of liveNames) {
    if (!byName.has(name)) add('DRIFT_MISSING', `attributes.${name}`, `live prop "${name}" has no descriptor attribute`)
  }
  for (const name of byName.keys()) {
    if (!liveSet.has(name)) add('DRIFT_EXTRA', `attributes.${name}`, `descriptor attribute "${name}" has no live prop`)
  }

  // 2 — per matched name: type kind · default · reflect · enum members consistent with the live PropConfig.
  for (const name of liveNames) {
    const attr = byName.get(name)
    if (attr === undefined) continue
    const config = props[name]
    const at = (sub: string): string => `attributes.${name}.${sub}`

    const liveKind = kindOf(config)
    if (attr.type !== liveKind) {
      add('DRIFT_TYPE', at('type'), `descriptor type "${attr.type ?? ''}" != live codec kind "${liveKind}"`)
    } else if (liveKind === 'enum' && !enumMembersMatch(config, attr.values ?? [])) {
      add('DRIFT_VALUES', at('values'), `enum "${name}" values [${(attr.values ?? []).join(', ')}] are not the live member set`)
    }

    const liveDefault = String(config.default)
    if (attr.default !== liveDefault) {
      add('DRIFT_DEFAULT', at('default'), `descriptor default "${attr.default ?? ''}" != live default "${liveDefault}"`)
    }

    const descReflect = attr.reflect ?? false
    const liveReflect = config.reflect ?? false
    if (descReflect !== liveReflect) {
      add('DRIFT_REFLECT', at('reflect'), `descriptor reflect ${descReflect} != live reflect ${liveReflect}`)
    }
  }

  return failures
}

// ── contract↔source trip-wire ───────────────────────────────────────────────────────────────────────────
//
// compareDescriptorToProps closes the props gap, but two facts the descriptor records have NO `static props`
// row to compare against — they are not class fields at all:
//
//   • customStates — a control's custom states are added IMPERATIVELY and conditionally (button.ts:
//     `requestAnimationFrame(() => this.internals.states?.add('ready'))`, optional-chained, behind rAF), and a
//     state may also be referenced ONLY by the stylesheet (`:state(ready)`). Neither is a statically-inspectable
//     field, so the truth lives in the .ts/.css source text.
//   • slots — light-DOM, host-as-grid components place slotted children purely in CSS (`[slot='leading']`);
//     there is no slot manifest in the class. The truth lives in the .css selectors.
//
// compareDescriptorToSource cross-checks the descriptor against that SOURCE USAGE (the caller passes the .ts and
// .css TEXT — this module stays import-free; it never reads the filesystem). It is a NAME-BIJECTION trip-wire,
// like compareDescriptorToProps, but states/slots carry no codec, so there is no TYPE/DEFAULT/REFLECT — only the
// name sets are compared. STATES are bidirectional (used ≡ documented); SLOTS are one-directional — every
// CSS-styled slot must be documented, but a documented slot need NOT be CSS-selected (`label`, button.md's
// default centre cell, is a real slot the grid never selects by name — the one asymmetry, mirroring the live
// member the enum probe cannot enumerate in enumMembersMatch).

/**
 * The custom states a component USES — the union of the imperative `internals.states` mutations in the .ts
 * (`.states?.add('X')` / `.delete` / `.toggle` / `.replace` / `.has`, optional-chain tolerant) AND the
 * `:state(X)` selectors in the .css. A state is "used" if EITHER source references it.
 */
export function collectUsedStates(ts: string, css: string): Set<string> {
  const names = new Set<string>()
  for (const m of ts.matchAll(/\.states\??\.(?:add|delete|toggle|replace|has)\(\s*['"]([^'"]+)['"]/g)) names.add(m[1])
  for (const m of css.matchAll(/:state\(\s*([A-Za-z][\w-]*)\s*\)/g)) names.add(m[1])
  return names
}

/** The slot POSITIONS the .css styles — every `[slot='X']` attribute selector (quoting optional, `:has()`-nested or not). */
export function collectStyledSlots(css: string): Set<string> {
  const names = new Set<string>()
  for (const m of css.matchAll(/\[slot\s*=\s*['"]?([A-Za-z][\w-]*)['"]?\s*\]/g)) names.add(m[1])
  return names
}

/** The content ROLES the .css styles — every `[data-role='X']` attribute selector (quoting optional). Reused by the /site dead-name guard (s12). */
export function collectStyledRoles(css: string): Set<string> {
  const names = new Set<string>()
  for (const m of css.matchAll(/\[data-role\s*=\s*['"]?([A-Za-z][\w-]*)['"]?\s*\]/g)) names.add(m[1])
  return names
}

/** The drift defects compareDescriptorToSource reports (the descriptor disagrees with the component .ts/.css). */
export const SOURCE_DRIFT_CODES = ['STATE_UNDOCUMENTED', 'STATE_UNUSED', 'SLOT_UNDOCUMENTED'] as const
export type SourceDriftCode = (typeof SOURCE_DRIFT_CODES)[number]

/** One source-drift defect: a stable code + the descriptor path it occurred at + a human message. */
export interface SourceDriftFailure {
  code: SourceDriftCode
  path: string
  message: string
}

/** The slot names a descriptor declares (the `slots[]` sequence rows' `name:` values). */
function declaredSlotNames(desc: ParsedDescriptor): Set<string> {
  const names = new Set<string>()
  for (const item of desc.sequences.get('slots') ?? []) {
    const name = item.get('name')
    if (typeof name === 'string' && name !== '') names.add(name)
  }
  return names
}

/**
 * The contract↔source trip-wire: assert the descriptor's customStates/slots tell the truth about where the fact
 * ACTUALLY lives (the component .ts/.css). TOTAL — never throws; every disagreement is a structured
 * SourceDriftFailure. STATES (bidirectional): used-states (collectUsedStates) ≡ descriptor.customStates —
 * STATE_UNDOCUMENTED for a used state the descriptor omits, STATE_UNUSED for a documented state no source uses.
 * SLOTS (one-directional): every CSS-styled slot (collectStyledSlots) must be IN descriptor.slots —
 * SLOT_UNDOCUMENTED otherwise; a documented-but-unstyled slot (`label`, the default cell) is NOT a defect.
 */
export function compareDescriptorToSource(desc: ParsedDescriptor, source: { ts: string; css: string }): SourceDriftFailure[] {
  const failures: SourceDriftFailure[] = []
  const add = (code: SourceDriftCode, path: string, message: string): void => void failures.push({ code, path, message })

  // STATES — bijection between source usage (.ts add + .css :state) and the documented customStates.
  const usedStates = collectUsedStates(source.ts, source.css)
  const declaredStates = new Set(scalarSeq(desc, 'customStates'))
  for (const s of usedStates) {
    if (!declaredStates.has(s)) add('STATE_UNDOCUMENTED', `customStates.${s}`, `state "${s}" is used in source but absent from customStates`)
  }
  for (const s of declaredStates) {
    if (!usedStates.has(s)) add('STATE_UNUSED', `customStates.${s}`, `customStates declares "${s}" but no source (.ts/.css) uses it`)
  }

  // SLOTS — one-directional: every CSS-styled slot must be documented (an undocumented styled slot is the drift).
  const declaredSlots = declaredSlotNames(desc)
  for (const s of collectStyledSlots(source.css)) {
    if (!declaredSlots.has(s)) add('SLOT_UNDOCUMENTED', `slots.${s}`, `slot "${s}" is styled in css but absent from slots`)
  }

  return failures
}
