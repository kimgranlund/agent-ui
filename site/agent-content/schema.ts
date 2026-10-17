// site/agent-content/schema.ts: the agent-content file schema (T-0160). One home for the shape of every
// content kind, the zero-dependency frontmatter parser and the validator. Two consumers: the generator
// (`scripts/generate-agent-content.mjs`, which imports this file under Node's type stripping and refuses
// to write a registry from invalid content) and the site readers (`registry.ts` and the agent-admin pages).
// It imports nothing, so both runtimes can load it.
//
// The authored files live beside this module (`AGENTS.md` here is the authoring guide). Frontmatter is a
// JSON object between `---` fences: valid YAML, so a SKILL.md stays an Agent Skills file, and parsed
// with `JSON.parse`, so no YAML library is needed. The a2ui mini-skills and GenUI packs keep their own
// single-line `key: value` frontmatter and are read where they live (`packages/agent-ui/a2ui/src/agent/
// prompts/`); the registry carries them so every reader goes through one source.

/** The capability entry kinds a persona references and a pack groups. */
export const ENTRY_KINDS = ['skill', 'workflow', 'resource', 'tool'] as const
export type EntryKind = (typeof ENTRY_KINDS)[number]

export const CONTENT_KINDS = ['persona', ...ENTRY_KINDS, 'pack', 'mini-skill', 'genui-pack'] as const
export type ContentKind = (typeof CONTENT_KINDS)[number]

/** Each entry kind's folder name and file name, at the content root or under a persona folder. */
export const ENTRY_LAYOUT: Record<EntryKind, { dir: string; file: string }> = {
  skill: { dir: 'skills', file: 'SKILL.md' },
  workflow: { dir: 'workflows', file: 'WORKFLOW.md' },
  resource: { dir: 'resources', file: 'RESOURCE.md' },
  tool: { dir: 'tools', file: 'TOOL.md' },
}

/** Repo-relative roots. */
export const CONTENT_ROOT = 'site/agent-content'
export const MINI_SKILLS_DIR = 'packages/agent-ui/a2ui/src/agent/prompts/mini-skills'
export const GENUI_PACKS_DIR = 'packages/agent-ui/a2ui/src/agent/prompts/genui-packs'

export type PresetCategoryName = 'hospitality' | 'games'
export const PRESET_CATEGORIES: readonly PresetCategoryName[] = ['hospitality', 'games']

/** The persona body's named sections, in file order. The text before the first heading is the
 *  foundation. */
export const PERSONA_SECTIONS = { surfaceStyle: 'Surface style', houseFacts: 'House facts' } as const

export interface PersonaFrontmatter {
  id: string
  /** The seed version. A bump drops users' persisted stores for this persona (`personaStore`); 1 is the
   *  unbumped default and seeds no `seedVersion` field. */
  version: number
  /** Roster position, 1-based. Required unless `roster` is false. */
  order?: number
  /** False keeps the persona out of the roster (the Builder: machinery, not a pick). */
  roster?: false
  label: string
  tagline: string
  category?: PresetCategoryName
  /** The agent config (`AgentPreset.config`): display name, model id, the tools switch, and the
   *  optional model settings (T-0185), each validated against the model's capability row at read. */
  name: string
  model: string
  toolsEnabled: boolean
  effort?: string
  thinking?: string
  showReasoning?: boolean
  maxTokens?: number
  cacheTtl?: string
  /** The persona catalog fragment (`SHIPPED_PERSONA_CATALOGS` personaId, GH #497). */
  localPatterns?: string
  /** Shipped catalog domains composed onto the base (T-0202). */
  domains?: string[]
  bankroll?: boolean
  disabledBuiltins?: string[]
  skills: string[]
  workflows: string[]
  resources: string[]
  tools: string[]
  /** Why each seed version moved, newest first (`<version>: <reason>`). Authoring context only. */
  changelog?: string[]
  /** Authoring notes on choices a reader of the file would otherwise undo. Never reaches a seed. */
  notes?: string[]
}

export interface EntryFrontmatter {
  /** Agent Skills `name`: equals `id` and the folder name. */
  name: string
  description: string
  id: string
  version: number
  kind: EntryKind
  /** agent-model SPEC-R14: `context` (always in the prompt index) or `invocable` (reached by `@`/`/`).
   *  A root entry is `context`: the add-from-library path mints entries with no availability member. */
  availability: 'context' | 'invocable'
  /** Display label. The store entry id is `id`; a library entry carries an explicit `id` only when the
   *  label differs (the Integrations trio, ADR-0168 cl.2). */
  label: string
}

export interface PackFrontmatter {
  id: string
  version: number
  kind: EntryKind
  /** Position among the packs of its kind, 1-based. */
  order: number
  label: string
  description: string
  /** Persona-flavored pack: offered only to presets of this category (GH #143). Absent: generic. */
  category?: PresetCategoryName
  rejectOnCollision?: boolean
  /** Refs (`<id>@<version>`) to root entries of `kind`, in menu order. */
  entries?: string[]
  /** Instead of `entries`: every record of this registry kind, in path order. */
  derived?: 'mini-skill'
}

interface RecordBase {
  id: string
  version: number
  /** `sha256:` plus the hex sha256 of the file bytes. */
  digest: string
  /** Repo-relative POSIX path. */
  path: string
  body: string
}

export interface PersonaRecord extends RecordBase {
  kind: 'persona'
  frontmatter: PersonaFrontmatter
}
export interface EntryRecord extends RecordBase {
  kind: EntryKind
  /** The owning persona for a persona-local entry; absent for a root (library) entry. */
  scope?: string
  frontmatter: EntryFrontmatter
}
export interface PackRecord extends RecordBase {
  kind: 'pack'
  frontmatter: PackFrontmatter
}
export interface PromptRecord extends RecordBase {
  kind: 'mini-skill' | 'genui-pack'
  frontmatter: Record<string, string>
}
export type ContentRecord = PersonaRecord | EntryRecord | PackRecord | PromptRecord

// ── canonical form and digests ──────────────────────────────────────────────────────────────────────

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    const obj = value as Record<string, unknown>
    for (const key of Object.keys(obj).sort()) if (obj[key] !== undefined) out[key] = sortKeys(obj[key])
    return out
  }
  return value
}

/** Sorted-key, undefined-dropped, unspaced JSON (the `site/lib/agent-manifest/agent-manifest.ts` rule). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

/** The text an item digest is taken over (agent-content spec ACS-R4): the frontmatter as canonical JSON, a
 *  newline, then the body with LF line endings (empty for a pack). The caller hashes it (sha256, `sha256:` plus hex). */
export function digestInput(frontmatter: unknown, body: string): string {
  return `${canonicalJson(frontmatter)}\n${body.replace(/\r\n?/g, '\n')}`
}

/** What a persona's seed is made of: its own item digest and each entry it references, in ref order per
 *  kind. Its canonical digest is the agent manifest's `seedDigest` (persona-catalog-composition SPEC-R7). */
export function personaSeedClosure(records: readonly ContentRecord[], id: string): { persona: string; entries: { kind: EntryKind; scope?: string; id: string; version: number; digest: string }[] } {
  const persona = records.find((r): r is PersonaRecord => r.kind === 'persona' && r.id === id)
  if (!persona) throw new Error(`no persona ${id}`)
  const entries = ENTRY_KINDS.flatMap((kind) =>
    persona.frontmatter[`${kind}s`].map((ref) => {
      const e = findRef(records, ref, kind, id)
      if (!e) throw new Error(`${id}: ref ${ref} names no ${kind}`)
      return { kind, ...(e.scope === undefined ? {} : { scope: e.scope }), id: e.id, version: e.version, digest: e.digest }
    }),
  )
  return { persona: persona.digest, entries }
}

// ── parsing ─────────────────────────────────────────────────────────────────────────────────────────

const JSON_FENCE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/

/** A content `.md` file: JSON frontmatter, then the body with its one final newline removed. Throws on
 *  a missing fence, invalid JSON or a carriage return (bytes must be stable for the digest). */
export function splitJsonFrontmatter(source: string): { frontmatter: unknown; body: string } {
  if (source.includes('\r')) throw new Error('contains a carriage return')
  const match = JSON_FENCE.exec(source)
  if (!match) throw new Error('no --- frontmatter fence')
  const body = match[2]!.endsWith('\n') ? match[2]!.slice(0, -1) : match[2]!
  return { frontmatter: JSON.parse(match[1]!) as unknown, body }
}

/** The a2ui prompt `.md` frontmatter: single-line `key: value` pairs, body trimmed. The same split the
 *  agent-admin library used before T-0160 (`\r?` tolerant, PR #58). Null without a fence. */
export function splitKeyValueFrontmatter(source: string): { data: Record<string, string>; body: string } | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source)
  if (!match) return null
  const data: Record<string, string> = {}
  for (const line of match[1]!.split(/\r?\n/)) {
    const at = line.indexOf(':')
    if (at > 0) data[line.slice(0, at).trim()] = line.slice(at + 1).trim()
  }
  return { data, body: match[2]!.trim() }
}

/** A persona body split into its foundation and named sections. The format is exact: the foundation,
 *  then per section a blank line, `## <heading>`, a blank line and its text. */
export function personaSections(body: string): { foundation: string; sections: Record<string, string> } {
  const parts = body.split(/\n\n## ([^\n]+)\n\n/)
  const sections: Record<string, string> = {}
  for (let i = 1; i < parts.length; i += 2) {
    if (Object.hasOwn(sections, parts[i]!)) throw new Error(`duplicate section ${parts[i]}`)
    sections[parts[i]!] = parts[i + 1]!
  }
  return { foundation: parts[0]!, sections }
}

/** Where a repo-relative path sits in the layout, or null for a file the registry does not index. */
export function classifyPath(path: string): { kind: ContentKind; id: string; scope?: string } | null {
  if (path.startsWith(`${MINI_SKILLS_DIR}/`) && path.endsWith('.md')) return { kind: 'mini-skill', id: path.slice(MINI_SKILLS_DIR.length + 1, -3) }
  if (path.startsWith(`${GENUI_PACKS_DIR}/`) && path.endsWith('.md')) return { kind: 'genui-pack', id: path.slice(GENUI_PACKS_DIR.length + 1, -3) }
  if (!path.startsWith(`${CONTENT_ROOT}/`)) return null
  const parts = path.slice(CONTENT_ROOT.length + 1).split('/')
  const entryAt = (dir: string, file: string): EntryKind | undefined =>
    ENTRY_KINDS.find((k) => ENTRY_LAYOUT[k].dir === dir && ENTRY_LAYOUT[k].file === file)
  if (parts.length === 3 && parts[0] === 'personas' && parts[2] === 'agent.md') return { kind: 'persona', id: parts[1]! }
  if (parts.length === 3 && parts[0] === 'packs' && parts[2] === 'pack.json') return { kind: 'pack', id: parts[1]! }
  if (parts.length === 3) {
    const kind = entryAt(parts[0]!, parts[2]!)
    if (kind) return { kind, id: parts[1]! }
  }
  if (parts.length === 5 && parts[0] === 'personas') {
    const kind = entryAt(parts[2]!, parts[4]!)
    if (kind) return { kind, id: parts[3]!, scope: parts[1]! }
  }
  return null
}

/** One file as a registry record. `hash` maps the item's `digestInput` to its digest (the caller owns
 *  hashing, so this module stays free of `node:crypto`). Returns null for an a2ui prompt file without
 *  frontmatter or without the keys its reader needs (skipped, as the old raw glob skipped it). */
export function parseContentFile(path: string, source: string, hash: (text: string) => string): ContentRecord | null {
  const at = classifyPath(path)
  if (!at) throw new Error(`${path}: not a content path`)
  if (at.kind === 'mini-skill' || at.kind === 'genui-pack') {
    const parsed = splitKeyValueFrontmatter(source)
    if (!parsed?.data['id'] || (at.kind === 'genui-pack' && !parsed.data['label'])) return null
    const digest = hash(digestInput(parsed.data, parsed.body))
    return { kind: at.kind, id: parsed.data['id'], version: 1, digest, path, frontmatter: parsed.data, body: parsed.body }
  }
  if (at.kind === 'pack') {
    if (source.includes('\r')) throw new Error('contains a carriage return')
    const frontmatter = JSON.parse(source) as PackFrontmatter
    return { kind: 'pack', id: at.id, version: frontmatter.version, digest: hash(digestInput(frontmatter, '')), path, frontmatter, body: '' }
  }
  const { frontmatter, body } = splitJsonFrontmatter(source)
  const version = (frontmatter as { version: number }).version
  const digest = hash(digestInput(frontmatter, body))
  if (at.kind === 'persona') return { kind: 'persona', id: at.id, version, digest, path, frontmatter: frontmatter as PersonaFrontmatter, body }
  return { kind: at.kind, ...(at.scope === undefined ? {} : { scope: at.scope }), id: at.id, version, digest, path, frontmatter: frontmatter as EntryFrontmatter, body }
}

// ── validation ──────────────────────────────────────────────────────────────────────────────────────

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const REF = /^(\.\/)?([a-z0-9]+(?:-[a-z0-9]+)*)@([1-9][0-9]*)$/

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string')
const isVersion = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1

const CONFIG_KEYS = ['name', 'model', 'toolsEnabled', 'effort', 'thinking', 'showReasoning', 'maxTokens', 'cacheTtl']
const PERSONA_KEYS = ['id', 'version', 'order', 'roster', 'label', 'tagline', 'category', ...CONFIG_KEYS, 'localPatterns', 'domains', 'bankroll', 'disabledBuiltins', 'skills', 'workflows', 'resources', 'tools', 'changelog', 'notes']
const ENTRY_KEYS = ['name', 'description', 'id', 'version', 'kind', 'availability', 'label']
const PACK_KEYS = ['id', 'version', 'kind', 'order', 'label', 'description', 'category', 'rejectOnCollision', 'entries', 'derived']

function unknownKeys(o: Record<string, unknown>, allowed: string[]): string[] {
  return Object.keys(o).filter((k) => !allowed.includes(k))
}

/** Parse a ref against the registry: `./<id>@<v>` names an entry under the persona's own folder,
 *  `<id>@<v>` a root entry. */
export function parseRef(ref: string): { local: boolean; id: string; version: number } | null {
  const m = REF.exec(ref)
  return m ? { local: m[1] !== undefined, id: m[2]!, version: Number(m[3]) } : null
}

/** Find the record a ref names, or null. */
export function findRef(records: readonly ContentRecord[], ref: string, kind: EntryKind, scope?: string): EntryRecord | null {
  const parsed = parseRef(ref)
  if (!parsed || (parsed.local && scope === undefined)) return null
  const want = parsed.local ? scope : undefined
  const hit = records.find((r): r is EntryRecord => r.kind === kind && r.id === parsed.id && (r as EntryRecord).scope === want)
  return hit && hit.version === parsed.version ? hit : null
}

/** Every problem in a registry, as `<path>: <problem>` lines. `[]` means valid. */
export function validateContent(records: readonly ContentRecord[]): string[] {
  const out: string[] = []
  const add = (r: ContentRecord, problem: string): void => {
    out.push(`${r.path}: ${problem}`)
  }
  const seen = new Set<string>()
  for (const r of records) {
    const key = `${r.kind}|${(r as EntryRecord).scope ?? ''}|${r.id}`
    if (seen.has(key)) add(r, `duplicate ${r.kind} id ${r.id}`)
    seen.add(key)
  }

  const refsCheck = (r: ContentRecord, list: unknown, kind: EntryKind, field: string, scope?: string): void => {
    if (!isStringArray(list)) return add(r, `${field} is not a string array`)
    for (const ref of list) {
      if (!parseRef(ref)) add(r, `${field} ref ${ref} is not <id>@<version> or ./<id>@<version>`)
      else if (!findRef(records, ref, kind, scope)) add(r, `${field} ref ${ref} names no ${kind} at that version`)
    }
  }

  const packed = new Set<string>()
  const packOrders = new Map<string, number[]>()
  for (const r of records) {
    if (r.kind !== 'pack') continue
    const fm = r.frontmatter as unknown
    if (!isObject(fm)) {
      add(r, 'pack.json is not an object')
      continue
    }
    for (const k of unknownKeys(fm, PACK_KEYS)) add(r, `unknown key ${k}`)
    if (fm['id'] !== r.id) add(r, `id ${String(fm['id'])} is not the folder name ${r.id}`)
    if (!isVersion(fm['version'])) add(r, 'version is not a positive integer')
    if (!ENTRY_KINDS.includes(fm['kind'] as EntryKind)) add(r, `kind ${String(fm['kind'])} is not an entry kind`)
    if (!isVersion(fm['order'])) add(r, 'order is not a positive integer')
    else packOrders.set(String(fm['kind']), [...(packOrders.get(String(fm['kind'])) ?? []), fm['order']])
    if (typeof fm['label'] !== 'string' || fm['label'] === '') add(r, 'label is not a non-empty string')
    if (typeof fm['description'] !== 'string') add(r, 'description is not a string')
    if (fm['category'] !== undefined && !PRESET_CATEGORIES.includes(fm['category'] as PresetCategoryName)) add(r, `category ${String(fm['category'])} is unknown`)
    if (fm['rejectOnCollision'] !== undefined && fm['rejectOnCollision'] !== true) add(r, 'rejectOnCollision is not true when present')
    if ((fm['entries'] === undefined) === (fm['derived'] === undefined)) add(r, 'needs exactly one of entries and derived')
    if (fm['derived'] !== undefined && fm['derived'] !== 'mini-skill') add(r, `derived ${String(fm['derived'])} is unknown`)
    if (fm['derived'] === 'mini-skill' && fm['kind'] !== 'skill') add(r, 'a mini-skill pack is kind skill')
    if (fm['entries'] !== undefined && ENTRY_KINDS.includes(fm['kind'] as EntryKind)) {
      refsCheck(r, fm['entries'], fm['kind'] as EntryKind, 'entries')
      if (isStringArray(fm['entries'])) for (const ref of fm['entries']) packed.add(`${String(fm['kind'])}|${parseRef(ref)?.id ?? ''}`)
    }
  }
  for (const [kind, orders] of packOrders) {
    if (new Set(orders).size !== orders.length) out.push(`${CONTENT_ROOT}/packs: two ${kind} packs share an order`)
  }

  for (const r of records) {
    if (!ENTRY_KINDS.includes(r.kind as EntryKind)) continue
    const e = r as EntryRecord
    const fm = e.frontmatter as unknown
    if (!isObject(fm)) {
      add(r, 'frontmatter is not an object')
      continue
    }
    for (const k of unknownKeys(fm, ENTRY_KEYS)) add(r, `unknown key ${k}`)
    if (!ID.test(e.id)) add(r, `folder name ${e.id} is not lowercase-hyphenated`)
    if (fm['id'] !== e.id) add(r, `id ${String(fm['id'])} is not the folder name ${e.id}`)
    if (fm['name'] !== e.id) add(r, `name ${String(fm['name'])} is not the folder name ${e.id}`)
    if (fm['kind'] !== e.kind) add(r, `kind ${String(fm['kind'])} is not the folder kind ${e.kind}`)
    if (!isVersion(fm['version'])) add(r, 'version is not a positive integer')
    if (typeof fm['description'] !== 'string') add(r, 'description is not a string')
    else if (fm['description'].length > 1024) add(r, 'description is over 1024 characters (Agent Skills limit)')
    if (typeof fm['label'] !== 'string' || fm['label'] === '') add(r, 'label is not a non-empty string')
    if (fm['availability'] !== 'context' && fm['availability'] !== 'invocable') add(r, `availability ${String(fm['availability'])} is not context or invocable`)
    else if (e.scope === undefined && fm['availability'] !== 'context') add(r, 'a root entry is context (a library add carries no availability)')
    if (e.scope === undefined && !packed.has(`${e.kind}|${e.id}`)) add(r, 'a root entry no pack offers (move it under its persona)')
    if (e.scope !== undefined && fm['label'] !== e.id) add(r, 'a persona-local entry label is its id')
  }

  const orders: number[] = []
  for (const r of records) {
    if (r.kind !== 'persona') continue
    const fm = r.frontmatter as unknown
    if (!isObject(fm)) {
      add(r, 'frontmatter is not an object')
      continue
    }
    for (const k of unknownKeys(fm, PERSONA_KEYS)) add(r, `unknown key ${k}`)
    if (!ID.test(r.id)) add(r, `folder name ${r.id} is not lowercase-hyphenated`)
    if (fm['id'] !== r.id) add(r, `id ${String(fm['id'])} is not the folder name ${r.id}`)
    if (!isVersion(fm['version'])) add(r, 'version is not a positive integer')
    if (fm['roster'] !== undefined && fm['roster'] !== false) add(r, 'roster is false when present')
    if (fm['roster'] === false) {
      if (fm['order'] !== undefined) add(r, 'a persona outside the roster has no order')
    } else if (!isVersion(fm['order'])) add(r, 'order is not a positive integer')
    else orders.push(fm['order'])
    for (const k of ['label', 'tagline']) if (typeof fm[k] !== 'string' || fm[k] === '') add(r, `${k} is not a non-empty string`)
    if (fm['category'] !== undefined && !PRESET_CATEGORIES.includes(fm['category'] as PresetCategoryName)) add(r, `category ${String(fm['category'])} is unknown`)
    if (typeof fm['name'] !== 'string' || typeof fm['model'] !== 'string' || typeof fm['toolsEnabled'] !== 'boolean') add(r, 'needs name, model and toolsEnabled')
    for (const k of ['effort', 'thinking', 'cacheTtl']) if (fm[k] !== undefined && typeof fm[k] !== 'string') add(r, `${k} is not a string`)
    if (fm['showReasoning'] !== undefined && typeof fm['showReasoning'] !== 'boolean') add(r, 'showReasoning is not a boolean')
    if (fm['maxTokens'] !== undefined && !isVersion(fm['maxTokens'])) add(r, 'maxTokens is not a positive integer')
    if (fm['localPatterns'] !== undefined && typeof fm['localPatterns'] !== 'string') add(r, 'localPatterns is not a string')
    if (fm['domains'] !== undefined && !isStringArray(fm['domains'])) add(r, 'domains is not a string array')
    if (fm['bankroll'] !== undefined && fm['bankroll'] !== true) add(r, 'bankroll is true when present')
    if (fm['disabledBuiltins'] !== undefined && !isStringArray(fm['disabledBuiltins'])) add(r, 'disabledBuiltins is not a string array')
    for (const k of ['changelog', 'notes']) if (fm[k] !== undefined && !isStringArray(fm[k])) add(r, `${k} is not a string array`)
    for (const kind of ENTRY_KINDS) refsCheck(r, fm[`${kind}s`], kind, `${kind}s`, r.id)
    const { foundation, sections } = personaSections(r.body)
    if (foundation.trim() === '') add(r, 'no foundation text before the first section')
    const known: string[] = Object.values(PERSONA_SECTIONS)
    for (const heading of Object.keys(sections)) if (!known.includes(heading)) add(r, `unknown section ## ${heading}`)
    if (sections[PERSONA_SECTIONS.surfaceStyle] === undefined) add(r, `no ## ${PERSONA_SECTIONS.surfaceStyle} section`)
  }
  if (new Set(orders).size !== orders.length) out.push(`${CONTENT_ROOT}/personas: two roster personas share an order`)
  for (const r of records) {
    const scope = (r as EntryRecord).scope
    if (scope === undefined) continue
    const owner = records.find((p): p is PersonaRecord => p.kind === 'persona' && p.id === scope)
    if (!owner) add(r, `persona folder ${scope} has no agent.md`)
    else {
      const refs = (owner.frontmatter as unknown as Record<string, unknown>)[`${r.kind}s`]
      if (isStringArray(refs) && !refs.some((ref) => findRef(records, ref, r.kind as EntryKind, scope) === r)) add(r, `${scope} never references this entry`)
    }
  }
  return out
}
