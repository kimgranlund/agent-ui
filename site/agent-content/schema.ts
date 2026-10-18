// site/agent-content/schema.ts: the agent-content file schema (T-0160). One home for the shape of every
// content kind, the zero-dependency frontmatter parser and the validator. Two consumers: the generator
// (`scripts/generate-agent-content.mjs`, which imports this file under Node's type stripping and refuses
// to write a registry from invalid content) and the site readers (`registry.ts` and the agent-admin pages).
// Its one import is the kind schema (`@agent-ui/app/agent-admin-content-fields`, T-0162): each kind's
// fields, defined once for this validator, the settings form and the Builder's patch gate. That module
// imports nothing, so both runtimes can still load this one.
//
// The authored files live beside this module (`AGENTS.md` here is the authoring guide). Frontmatter is a
// JSON object between `---` fences: valid YAML, so a SKILL.md stays an Agent Skills file, and parsed
// with `JSON.parse`, so no YAML library is needed. The a2ui mini-skills and GenUI packs are not content
// files: they keep their single-line `key: value` frontmatter (`splitKeyValueFrontmatter` below) and the
// site reads them through its live raw glob, so a mini-skill edit has one generated copy (a2ui's
// `assets.gen.ts`) and one generator.
// T-0163: the one canonical JSON lives with the corpus canonicalizer (zero-dep, no runtime imports, so the
// Node generator loads it by path too).
import { canonicalJson } from '../../packages/agent-ui/a2ui/src/corpus/canonical.ts'

import {
  CONTENT_ENTRY_KINDS,
  ENTRY_FIELDS,
  ID_PATTERN as ID,
  PACK_FIELDS,
  PERSONA_FIELDS,
  PRESET_CATEGORIES,
  REF_PATTERN as REF,
  checkFieldValue,
  checkFrontmatter,
} from '@agent-ui/app/agent-admin-content-fields'
import type { SeedHistory } from './seed-history.ts'

/** The capability entry kinds a persona references and a pack groups (defined once, in the kind schema). */
export const ENTRY_KINDS = CONTENT_ENTRY_KINDS
export type EntryKind = (typeof ENTRY_KINDS)[number]
export { ID_PATTERN, PRESET_CATEGORIES } from '@agent-ui/app/agent-admin-content-fields'

export const CONTENT_KINDS = ['persona', ...ENTRY_KINDS, 'pack'] as const
export type ContentKind = (typeof CONTENT_KINDS)[number]

/** Each entry kind's folder name and file name, at the content root or under a persona folder. */
export const ENTRY_LAYOUT: Record<EntryKind, { dir: string; file: string }> = {
  skill: { dir: 'skills', file: 'SKILL.md' },
  workflow: { dir: 'workflows', file: 'WORKFLOW.md' },
  resource: { dir: 'resources', file: 'RESOURCE.md' },
  tool: { dir: 'tools', file: 'TOOL.md' },
}

/** Repo-relative content root. */
export const CONTENT_ROOT = 'site/agent-content'

/** The persona-flavored pack categories (GH #143; the list lives in the kind schema). */
export type PresetCategoryName = (typeof PRESET_CATEGORIES)[number]

/** The persona body's named sections, in file order. The text before the first heading is the
 *  foundation. */
export const PERSONA_SECTIONS = { surfaceStyle: 'Surface style', houseFacts: 'House facts' } as const

export interface PersonaFrontmatter {
  id: string
  /** The seed version. Users' edits are an overlay keyed `id@version` and merged onto a new seed (`personaStore`); 1 is the
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
  /** Instead of `entries`: every a2ui mini-skill, in file order (read by the site's raw glob). */
  derived?: 'mini-skill'
}

interface RecordBase {
  id: string
  version: number
  /** `sha256:` plus the hex sha256 of `digestInput(frontmatter, body)`: the frontmatter as canonical JSON,
   *  a newline, then the body with LF line endings (ACS-R4). Not the file bytes, so JSON whitespace and key
   *  order never move it. */
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
export type ContentRecord = PersonaRecord | EntryRecord | PackRecord

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** A record as the browser registry carries it (`registry.runtime.gen.ts`): no `path` or `digest`, and a
 *  persona without its authoring-only `changelog` and `notes`. */
export type RuntimeRecord = DistributiveOmit<ContentRecord, 'path' | 'digest'>

/** The runtime projection of one record. */
export function runtimeRecord(record: ContentRecord): RuntimeRecord {
  const { path: _path, digest: _digest, ...rest } = record
  if (rest.kind !== 'persona') return rest
  const { changelog: _changelog, notes: _notes, ...frontmatter } = rest.frontmatter
  return { ...rest, frontmatter }
}

/** The browser's per-version field digests (`SEED_DIGESTS`, T-0355): persona id, then past seed version,
 *  then store key to the `valueDigest`s of the values that take the new seed there (ACS-R7 item 6: the
 *  version's final seed value, plus its earlier values when the history row carries a ruling). */
export type SeedDigests = Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>>>

// ── canonical form and digests ──────────────────────────────────────────────────────────────────────

/** Sorted-key, undefined-dropped, unspaced JSON (the `site/lib/agent-manifest/agent-manifest.ts` rule): the
 *  repo's one implementation (T-0163), so a registry item digest and a compiler item digest share their bytes. */
export { canonicalJson }

/** The text an item digest is taken over (agent-content spec ACS-R4): the frontmatter as canonical JSON, a
 *  newline, then the body with LF line endings (empty for a pack). The caller hashes it (sha256, `sha256:` plus hex). */
export function digestInput(frontmatter: unknown, body: string): string {
  return `${canonicalJson(frontmatter)}\n${body.replace(/\r\n?/g, '\n')}`
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
 *  hashing, `digest.ts`, so this module stays free of `node:crypto`). Throws on a file outside the grammar. */
export function parseContentFile(path: string, source: string, hash: (text: string) => string): ContentRecord {
  const at = classifyPath(path)
  if (!at) throw new Error(`${path}: not a content path`)
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

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string')
const isVersion = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1

/** Parse a ref against the registry: `./<id>@<v>` names an entry under the persona's own folder,
 *  `<id>@<v>` a root entry. */
export function parseRef(ref: string): { local: boolean; id: string; version: number } | null {
  const m = REF.exec(ref)
  return m ? { local: m[1] !== undefined, id: m[2]!, version: Number(m[3]) } : null
}

/** Find the record a ref names, or null. Works over full records and runtime projections alike. */
export function findRef<R extends RuntimeRecord>(records: readonly R[], ref: string, kind: EntryKind, scope?: string): Extract<R, { kind: EntryKind }> | null {
  const parsed = parseRef(ref)
  if (!parsed || (parsed.local && scope === undefined)) return null
  const want = parsed.local ? scope : undefined
  const hit = records.find((r): r is Extract<R, { kind: EntryKind }> => r.kind === kind && r.id === parsed.id && (r as { scope?: string }).scope === want)
  return hit && hit.version === parsed.version ? hit : null
}

/** Every problem in the committed seed history table (`seed-history.ts`, T-0355), as `<path>: <problem>`
 *  lines: a persona the registry lacks, a version key that is not a positive integer below the persona's
 *  current version, a key that is no scalar persona store key (an entry list is not recorded yet), an empty
 *  or missing `seeded` list, or a value of the wrong shape for its field. `[]` means valid. */
export function validateSeedHistory(records: readonly ContentRecord[], history: SeedHistory): string[] {
  const out: string[] = []
  const at = `${CONTENT_ROOT}/seed-history.ts`
  const fields = new Map(PERSONA_FIELDS.flatMap((f) => (f.key === undefined || f.type === 'entries' ? [] : [[f.key, f] as const])))
  for (const [id, versions] of Object.entries(history)) {
    const persona = records.find((r): r is PersonaRecord => r.kind === 'persona' && r.id === id)
    if (!persona) {
      out.push(`${at}: ${id} names no persona`)
      continue
    }
    for (const [version, keys] of Object.entries(versions)) {
      if (!/^[1-9][0-9]*$/.test(version)) out.push(`${at}: ${id} version key "${version}" is not a positive integer`)
      else if (Number(version) >= persona.version) out.push(`${at}: ${id} version ${version} is not below its current version ${persona.version}`)
      for (const [key, row] of Object.entries(keys)) {
        const field = fields.get(key)
        if (!field) {
          out.push(`${at}: ${id}@${version} key ${key} is no scalar persona store key`)
          continue
        }
        if (!Array.isArray(row?.seeded) || row.seeded.length === 0) {
          out.push(`${at}: ${id}@${version} ${key} has no seeded values`)
          continue
        }
        for (const value of row.seeded) {
          const problem = checkFieldValue(field, value)
          if (problem !== undefined) out.push(`${at}: ${id}@${version} ${key} value ${JSON.stringify(value)}: ${problem}`)
        }
      }
    }
  }
  return out
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

  // The list's shape is the kind schema's (`checkFrontmatter`); this checks that each well-formed ref
  // names a record.
  const refsCheck = (r: ContentRecord, list: unknown, kind: EntryKind, field: string, scope?: string): void => {
    if (!isStringArray(list)) return
    for (const ref of list) {
      if (parseRef(ref) && !findRef(records, ref, kind, scope)) add(r, `${field} ref ${ref} names no ${kind} at that version`)
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
    for (const problem of checkFrontmatter(PACK_FIELDS, fm)) add(r, problem)
    if (fm['id'] !== r.id) add(r, `id ${String(fm['id'])} is not the folder name ${r.id}`)
    if (isVersion(fm['order'])) packOrders.set(String(fm['kind']), [...(packOrders.get(String(fm['kind'])) ?? []), fm['order']])
    if ((fm['entries'] === undefined) === (fm['derived'] === undefined)) add(r, 'needs exactly one of entries and derived')
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
    for (const problem of checkFrontmatter(ENTRY_FIELDS, fm)) add(r, problem)
    if (!ID.test(e.id)) add(r, `folder name ${e.id} is not lowercase-hyphenated`)
    if (fm['id'] !== e.id) add(r, `id ${String(fm['id'])} is not the folder name ${e.id}`)
    if (fm['name'] !== e.id) add(r, `name ${String(fm['name'])} is not the folder name ${e.id}`)
    if (fm['kind'] !== e.kind) add(r, `kind ${String(fm['kind'])} is not the folder kind ${e.kind}`)
    if (typeof fm['description'] === 'string' && fm['description'].length > 1024) add(r, 'description is over 1024 characters (Agent Skills limit)')
    if (e.scope === undefined && fm['availability'] === 'invocable') add(r, 'a root entry is context (a library add carries no availability)')
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
    // Keys, required fields and value shapes: the persona kind schema, the same rows the settings form
    // and the Builder's patch gate read (T-0162, ACS-R10).
    for (const problem of checkFrontmatter(PERSONA_FIELDS, fm)) add(r, problem)
    if (!ID.test(r.id)) add(r, `folder name ${r.id} is not lowercase-hyphenated`)
    if (fm['id'] !== r.id) add(r, `id ${String(fm['id'])} is not the folder name ${r.id}`)
    if (fm['roster'] === false) {
      if (fm['order'] !== undefined) add(r, 'a persona outside the roster has no order')
    } else if (fm['order'] === undefined) add(r, 'order is required in the roster')
    else if (isVersion(fm['order'])) orders.push(fm['order'])
    for (const kind of ENTRY_KINDS) refsCheck(r, fm[`${kind}s`], kind, `${kind}s`, r.id)
    let split: ReturnType<typeof personaSections>
    try {
      split = personaSections(r.body)
    } catch (error) {
      add(r, error instanceof Error ? error.message : String(error))
      continue
    }
    const { foundation, sections } = split
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
