// site/agent-content/registry.ts: the typed read side of the generated agent-content registry (T-0160).
// Every reader of seed content (agent-admin-presets.ts, agent-admin-libraries.ts, and the Builder through
// them) goes through these lookups, never through a file path or a raw glob. The generator has already
// validated every ref, so a failed lookup here is a broken invariant and throws.
import type { NewEntryInput } from '@agent-ui/app/entry-data'
import { AGENT_CONTENT } from './registry.gen.ts'
import { findRef, type ContentRecord, type EntryKind, type EntryRecord, type PackRecord, type PersonaRecord, type PromptRecord } from './schema.ts'

export { personaSections, PERSONA_SECTIONS } from './schema.ts'

/** Every persona, roster ones first in `order`, then those outside the roster in path order. */
export function personaRecords(): PersonaRecord[] {
  const all = AGENT_CONTENT.filter((r): r is PersonaRecord => r.kind === 'persona')
  const rank = (r: PersonaRecord): number => (r.frontmatter.roster === false ? Number.MAX_SAFE_INTEGER : (r.frontmatter.order ?? 0))
  return [...all].sort((a, b) => rank(a) - rank(b))
}

export function personaRecord(id: string): PersonaRecord {
  const hit = AGENT_CONTENT.find((r): r is PersonaRecord => r.kind === 'persona' && r.id === id)
  if (!hit) throw new Error(`agent-content: no persona ${id}`)
  return hit
}

export function packRecord(id: string): PackRecord {
  const hit = AGENT_CONTENT.find((r): r is PackRecord => r.kind === 'pack' && r.id === id)
  if (!hit) throw new Error(`agent-content: no pack ${id}`)
  return hit
}

/** The packs of one entry kind, in their `order`. */
export function packRecords(kind: EntryKind): PackRecord[] {
  return AGENT_CONTENT.filter((r): r is PackRecord => r.kind === 'pack' && r.frontmatter.kind === kind).sort((a, b) => a.frontmatter.order - b.frontmatter.order)
}

/** The a2ui prompt files of one kind, in path order (the order the old raw glob sorted to). */
export function promptRecords(kind: PromptRecord['kind']): PromptRecord[] {
  return AGENT_CONTENT.filter((r): r is PromptRecord => r.kind === kind)
}

/** The entry a ref names (`./<id>@<v>` under `scope`, else a root entry). */
export function resolveRef(ref: string, kind: EntryKind, scope?: string): EntryRecord {
  const hit = findRef(AGENT_CONTENT as readonly ContentRecord[], ref, kind, scope)
  if (!hit) throw new Error(`agent-content: ${scope ?? 'root'} ref ${ref} names no ${kind}`)
  return hit
}

/** A library entry as the add-from-library menu takes it. `id` rides along only when the label differs
 *  from it (the Integrations trio, ADR-0168 cl.2); every other entry keys on its label, as before. */
export function entryInput(record: EntryRecord): NewEntryInput {
  const { label, description } = record.frontmatter
  return label === record.id ? { label, description, content: record.body } : { id: record.id, label, description, content: record.body }
}

/** A pack's entries, in menu order. A `derived: mini-skill` pack is every a2ui mini-skill, projected as
 *  the old raw glob did (label the id, description the triggers line, content the trimmed body). */
export function packEntries(id: string): NewEntryInput[] {
  const fm = packRecord(id).frontmatter
  if (fm.derived === 'mini-skill') {
    return promptRecords('mini-skill').map((r) => ({ label: r.id, description: r.frontmatter['triggers'] ?? '', content: r.body }))
  }
  return (fm.entries ?? []).map((ref) => entryInput(resolveRef(ref, fm.kind)))
}
