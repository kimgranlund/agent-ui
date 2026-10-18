// site/agent-content/registry.ts: the typed read side of the generated agent-content registry (T-0160).
// Every reader of seed content (agent-admin-presets.ts, agent-admin-libraries.ts, and the Builder through
// them) goes through these lookups, never through a file path. It reads the browser projection
// (`registry.runtime.gen.ts`: no paths, item digests, changelogs or notes, plus the seed history's field
// digests, T-0355); Node-side tooling reads the full
// records in `registry.gen.ts`. The generator has already validated every ref, so a failed lookup here is a
// broken invariant and throws.
import type { NewEntryInput } from '@agent-ui/app/entry-data'
import { AGENT_CONTENT_RUNTIME, SEED_DIGESTS } from './registry.runtime.gen.ts'
import { findRef, type EntryKind, type RuntimeRecord } from './schema.ts'

export { personaSections, PERSONA_SECTIONS } from './schema.ts'

export type RuntimePersona = Extract<RuntimeRecord, { kind: 'persona' }>
export type RuntimeEntry = Extract<RuntimeRecord, { kind: EntryKind }>
export type RuntimePack = Extract<RuntimeRecord, { kind: 'pack' }>

/** Every persona, roster ones first in `order`, then those outside the roster. */
export function personaRecords(): RuntimePersona[] {
  const all = AGENT_CONTENT_RUNTIME.filter((r): r is RuntimePersona => r.kind === 'persona')
  const rank = (r: RuntimePersona): number => (r.frontmatter.roster === false ? Number.MAX_SAFE_INTEGER : (r.frontmatter.order ?? 0))
  return [...all].sort((a, b) => rank(a) - rank(b))
}

export function personaRecord(id: string): RuntimePersona {
  const hit = AGENT_CONTENT_RUNTIME.find((r): r is RuntimePersona => r.kind === 'persona' && r.id === id)
  if (!hit) throw new Error(`agent-content: no persona ${id}`)
  return hit
}

/** T-0355: per store key, the digests (`valueDigest`) of the values a persona's seed at a past `version`
 *  held that take the new seed (ACS-R7 item 6), from the committed history table; `undefined` where that
 *  version recorded none. */
export function seedDigestsAt(id: string, version: number): Readonly<Record<string, readonly string[]>> | undefined {
  return SEED_DIGESTS[id]?.[String(version)]
}

export function packRecord(id: string): RuntimePack {
  const hit = AGENT_CONTENT_RUNTIME.find((r): r is RuntimePack => r.kind === 'pack' && r.id === id)
  if (!hit) throw new Error(`agent-content: no pack ${id}`)
  return hit
}

/** The packs of one entry kind, in their `order`. */
export function packRecords(kind: EntryKind): RuntimePack[] {
  return AGENT_CONTENT_RUNTIME.filter((r): r is RuntimePack => r.kind === 'pack' && r.frontmatter.kind === kind).sort((a, b) => a.frontmatter.order - b.frontmatter.order)
}

/** The entry a ref names (`./<id>@<v>` under `scope`, else a root entry). */
export function resolveRef(ref: string, kind: EntryKind, scope?: string): RuntimeEntry {
  const hit = findRef(AGENT_CONTENT_RUNTIME, ref, kind, scope)
  if (!hit) throw new Error(`agent-content: ${scope ?? 'root'} ref ${ref} names no ${kind}`)
  return hit
}

/** A library entry as the add-from-library menu takes it. `id` rides along only when the label differs
 *  from it (the Integrations trio, ADR-0168 cl.2); every other entry keys on its label, as before. */
export function entryInput(record: RuntimeEntry): NewEntryInput {
  const { label, description } = record.frontmatter
  return label === record.id ? { label, description, content: record.body } : { id: record.id, label, description, content: record.body }
}

/** A pack's entries, in menu order. A `derived` pack has no refs; its reader supplies the entries (the
 *  mini-skill pack, agent-admin-libraries.ts). */
export function packEntries(id: string): NewEntryInput[] {
  const fm = packRecord(id).frontmatter
  if (fm.derived !== undefined) throw new Error(`agent-content: pack ${id} is derived (${fm.derived}); its reader supplies the entries`)
  return (fm.entries ?? []).map((ref) => entryInput(resolveRef(ref, fm.kind)))
}

/** T-0163: a persona's content manifest for the one compiler (`@agent-ui/app/agent-admin-compile`): its seed
 *  version and the seed version of every entry it refs, keyed by kind then entry id (the store entry id).
 *  The resolution reads the versions from here; the browser registry carries no item digests, so the
 *  compiler digests each item as composed. */
export function personaContentManifest(id: string): { id: string; version: number; source: 'seed'; items: Record<string, Record<string, number>> } {
  const record = personaRecord(id)
  const items: Record<string, Record<string, number>> = {}
  for (const kind of ['skill', 'workflow', 'resource', 'tool'] as const) {
    const versions: Record<string, number> = {}
    for (const ref of record.frontmatter[`${kind}s`]) {
      const entry = resolveRef(ref, kind, record.id)
      versions[entry.id] = entry.version
    }
    items[kind] = versions
  }
  return { id, version: record.version, source: 'seed', items }
}
