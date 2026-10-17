// site/agent-content/seed-file.ts: T-0162, the content file format as a writer (agent-content SPEC
// ACS-R10). `formatContentFile` is the exact inverse of `splitJsonFrontmatter`, and `personaSeedFiles`
// turns a persona's store state (an exported persona file: the Builder's export, or any agent's) into the
// seed folder `scripts/agent-content.mjs new --from` writes, so a Builder-made agent can be committed as a
// seed. Pure and environment-neutral: the CLI runs it under Node, and the browser could.
//
// The seed format carries less than store state: `personaSeedFiles` names every value it leaves out
// (`dropped`) instead of losing it silently. What a seed carries is the persona kind schema's `file` rows
// (content-fields.ts) plus the body sections; switches, the model grid's record and the selection keys are
// user state that a fresh seed starts at its defaults.
import { PERSONA_FIELDS, checkFieldValue } from '@agent-ui/app/agent-admin-content-fields'
import { CONTENT_ROOT, ENTRY_KINDS, ENTRY_LAYOUT, PERSONA_SECTIONS, type ContentRecord, type EntryKind } from './schema.ts'

/** One content `.md` file: the frontmatter as two-space JSON between `---` fences, then the body and one
 *  final newline (the shape every shipped file has; `splitJsonFrontmatter` reads it back exactly). */
export function formatContentFile(frontmatter: Readonly<Record<string, unknown>>, body: string): string {
  return `---\n${JSON.stringify(frontmatter, null, 2)}\n---\n${body}\n`
}

/** The persona store's identity for a seed: its folder id and its roster fields. */
export interface SeedIdentity {
  id: string
  label: string
  tagline: string
  order: number
  category?: string
}

interface StateEntry {
  id?: unknown
  label?: unknown
  description?: unknown
  content?: unknown
  enabled?: unknown
  builtin?: unknown
  availability?: unknown
  idbRef?: unknown
}

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const BODY_SECTIONS: Readonly<Record<string, string>> = { 'surface-style': PERSONA_SECTIONS.surfaceStyle, 'house-facts': PERSONA_SECTIONS.houseFacts }

/** `state` as a seed folder under `CONTENT_ROOT/personas/<id>/`: `agent.md` plus one persona-local file per
 *  capability entry, except an entry that equals a library entry in `records` (same kind, id, description
 *  and content), which becomes a ref to it. `dropped` names each value the seed format cannot carry. */
export function personaSeedFiles(
  identity: SeedIdentity,
  state: Readonly<Record<string, unknown>>,
  records: readonly ContentRecord[],
): { files: Array<{ path: string; text: string }>; dropped: string[] } {
  const dropped: string[] = []
  const files: Array<{ path: string; text: string }> = []
  const folder = `${CONTENT_ROOT}/personas/${identity.id}`
  const frontmatter: Record<string, unknown> = {
    id: identity.id,
    version: 1,
    order: identity.order,
    label: identity.label,
    tagline: identity.tagline,
    ...(identity.category === undefined ? {} : { category: identity.category }),
  }

  // The scalar fields a seed carries: each `file` row of the persona kind schema with a store key, in the
  // schema's order, admitted by the same check the validator runs on the file.
  for (const field of PERSONA_FIELDS) {
    if (field.file === undefined || field.key === undefined || field.type === 'entries') continue
    const value = state[field.key]
    if (value === undefined) continue
    let fileValue: unknown = value
    if (field.fileType === 'strings' && typeof value === 'string') fileValue = value.split('+').filter((s) => s !== '')
    if (field.fileType === 'true') {
      if (value !== true) continue
      fileValue = true
    }
    if (checkFieldValue(field, fileValue, 'file') === undefined) frontmatter[field.file] = fileValue
    else dropped.push(`${field.key}: ${JSON.stringify(value)} does not fit the seed format`)
  }
  if (typeof frontmatter['name'] !== 'string') frontmatter['name'] = identity.label
  if (typeof frontmatter['model'] !== 'string') frontmatter['model'] = 'claude-haiku-5-5'
  frontmatter['toolsEnabled'] = state['toolsEnabled'] !== false

  // Every other state key is user state a seed does not carry.
  const carried = new Set(PERSONA_FIELDS.filter((f) => f.file !== undefined && f.key !== undefined).map((f) => f.key!))
  for (const [key, value] of Object.entries(state)) {
    if (carried.has(key) || key === 'entries:prompt-section' || value === undefined) continue
    if (key.startsWith('entries:') && Array.isArray(value) && value.length === 0) continue
    dropped.push(`${key}: user state, not part of a seed`)
  }

  // The body: the Foundation text, then Surface style and House facts. Other sections are dropped.
  const sections = Array.isArray(state['entries:prompt-section']) ? (state['entries:prompt-section'] as StateEntry[]) : []
  const textOf = (id: string): string | undefined => {
    const hit = sections.find((s) => s.id === id)
    return typeof hit?.content === 'string' ? hit.content : undefined
  }
  const disabled = sections.filter((s) => s.builtin === true && s.enabled === false && typeof s.id === 'string').map((s) => s.id as string)
  if (disabled.length > 0) frontmatter['disabledBuiltins'] = disabled
  for (const s of sections) {
    if (typeof s.id !== 'string' || s.id === 'foundation' || s.id in BODY_SECTIONS) continue
    dropped.push(
      s.builtin === true
        ? `prompt section ${String(s.label ?? s.id)}: a seed starts its builtin sections at the shipped text`
        : `prompt section ${String(s.label ?? s.id)}: the seed body carries Foundation, Surface style and House facts only`,
    )
  }
  let body = (textOf('foundation') ?? '').trim() === '' ? `You are ${String(frontmatter['name'])}.` : textOf('foundation')!
  body += `\n\n## ${PERSONA_SECTIONS.surfaceStyle}\n\n${textOf('surface-style') ?? ''}`
  const houseFacts = textOf('house-facts')
  if (houseFacts !== undefined) body += `\n\n## ${PERSONA_SECTIONS.houseFacts}\n\n${houseFacts}`

  // The capability entries: a ref to an identical library entry, else a persona-local file.
  for (const kind of ENTRY_KINDS) {
    const refs: string[] = []
    const list = Array.isArray(state[`entries:${kind}`]) ? (state[`entries:${kind}`] as StateEntry[]) : []
    for (const entry of list) {
      if (typeof entry.id !== 'string' || !ID.test(entry.id)) {
        dropped.push(`${kind} ${String(entry.label ?? entry.id)}: its id is not a lowercase-hyphenated folder name`)
        continue
      }
      if (entry.idbRef !== undefined) {
        dropped.push(`${kind} ${entry.id}: its content lives in browser storage, not in the export`)
        continue
      }
      const description = typeof entry.description === 'string' ? entry.description : ''
      const content = typeof entry.content === 'string' ? entry.content : ''
      const library = records.find(
        (r) => r.kind === kind && r.id === entry.id && (r as { scope?: string }).scope === undefined && r.body === content && (r.frontmatter as { description?: string }).description === description,
      )
      if (library !== undefined) {
        refs.push(`${library.id}@${library.version}`)
        continue
      }
      refs.push(`./${entry.id}@1`)
      const { dir, file } = ENTRY_LAYOUT[kind as EntryKind]
      const entryFrontmatter = { name: entry.id, description, id: entry.id, version: 1, kind, availability: entry.availability === 'invocable' ? 'invocable' : 'context', label: entry.id }
      files.push({ path: `${folder}/${dir}/${entry.id}/${file}`, text: formatContentFile(entryFrontmatter, content) })
      if (typeof entry.label === 'string' && entry.label !== entry.id) dropped.push(`${kind} ${entry.id}: its display label "${entry.label}" (a persona-local entry's label is its id)`)
      if (entry.enabled === false) dropped.push(`${kind} ${entry.id}: switched off (a seed entry starts on)`)
    }
    frontmatter[`${kind}s`] = refs
  }

  files.unshift({ path: `${folder}/agent.md`, text: formatContentFile(frontmatter, body) })
  return { files, dropped }
}
