// site/pages/agent-admin-persona-file.ts — the PERSONA FILE: the portable, versioned envelope an
// admin-authored persona exports to and imports from (GH #406, M-B DoD box 3 — "the persona-library
// pattern"). PURE data + serialization: no DOM, no localStorage, no store construction — everything here
// is a plain function over a `SettingsStore`-shaped reader and plain JSON, so the whole round trip is
// deterministically testable (agent-admin-persona-file.test.ts) without a page.
//
// WHAT A PERSONA IS, on the wire: exactly the persona-scoped STORE state the live turn reads — the agent
// config (name/model/temperature), every master switch, the Surface Options, and all six entry lists
// (prompt sections — Foundation + Surface style + whatever the admin authored — plus the four capability
// kinds and the pattern-source pick). That set IS what `composeLiveSystemPrompt` consumes at turn time
// (agent-admin.ts's `#capabilityGroups`), so a byte-identical state means a byte-identical composed
// persona prompt: identical live behaviour by construction, not by hopeful reconstruction. Deliberately
// NOT exported: conversation history, the Dialog Turns ring, and the composer's ephemeral Effort dial —
// none of them persona state (the component owns them per element lifetime).
//
// The KEY SET is enumerated (`PERSONA_STATE_KEYS`), never "whatever localStorage holds under the prefix":
// the persisted layer only carries keys the admin has WRITTEN (a fresh preset store has none of them),
// while the store itself answers seed ∪ persisted. Reading through the store is the only way to capture a
// persona that was never edited, and enumerating the keys is what keeps a foreign/hand-edited file from
// smuggling unknown keys into a minted persona (`readPersonaState` filters on the way IN as well as OUT).
//
// The set + that reader are no longer CONSTRUCTED here: ADR-0178's apply gate needs the identical
// enumeration (`@agent-ui/app/agent-admin-persona-patch`, the module that now owns it), and two
// hand-maintained copies of one truth is exactly the silent divergence GH #406 closed for this format.
// They are re-exported below so every importer of this file keeps its symbol unchanged.
//
// LIBRARY SEMANTICS (GH #406 fork 2): importing MINTS A NEW persona — a collision-safe id, its own
// persisted store — and never overwrites a shipped preset in place. The imported STATE is carried
// verbatim (including the `name` config key): only the roster IDENTITY (id + label) is uniquified —
// mintIdentity below mints both — so the library shows two distinguishable rows while the agent itself
// behaves byte-identically to the one that was exported.
import { ENTRY_KINDS, entriesStoreKey } from '@agent-ui/app'
import {
  PERSONA_ENTRY_LIST_KEYS,
  PERSONA_STATE_KEYS,
  readPersonaState,
  type PersonaStateReader,
} from '@agent-ui/app/agent-admin-persona-patch'
import type { Persona } from './agent-admin-presets.ts'
import type { PresetCategory } from './agent-admin-libraries.ts'

/** The envelope's discriminator — a file whose `kind` is anything else is rejected outright. */
export const PERSONA_FILE_KIND = 'agent-ui-persona'

/** The format version this build WRITES, and the highest it reads. */
export const PERSONA_FILE_VERSION = 1

const ENTRY_LIST_KEYS: readonly string[] = PERSONA_ENTRY_LIST_KEYS

/** The canonical key set + the projection that reads a store through it — owned by
 *  `@agent-ui/app/agent-admin-persona-patch` (see this file's header) and re-exported UNCHANGED, so
 *  `PERSONA_STATE_KEYS`/`readPersonaState`/`PersonaStateReader` still resolve from here for every existing
 *  importer. Nothing about the format changed with the move: the set is the same ordered enumeration, plus
 *  `SURFACE_PLANNER_KEY`, whose absence was a gap (GH #640's ruled fix). */
export { PERSONA_STATE_KEYS, readPersonaState }
export type { PersonaStateReader }

/** The persona's own roster metadata, as it travels in the file (the store state carries no label). */
export interface PersonaFileMeta {
  label: string
  tagline: string
  category?: PresetCategory
  /** The id of the persona this file was exported FROM — provenance only; the import mints its own. */
  sourceId: string
}

export interface PersonaFile {
  kind: typeof PERSONA_FILE_KIND
  version: number
  /** ISO timestamp, provenance only — never read back into state (so it can differ between two files
   *  carrying the same persona without changing a single byte of behaviour). */
  exportedAt: string
  persona: PersonaFileMeta
  state: Record<string, unknown>
}

/** Build the file for `persona` from the state its store currently holds. */
export function exportPersonaFile(persona: Persona, store: PersonaStateReader | undefined, now: Date = new Date()): PersonaFile {
  return {
    kind: PERSONA_FILE_KIND,
    version: PERSONA_FILE_VERSION,
    exportedAt: now.toISOString(),
    persona: {
      label: persona.label,
      tagline: persona.tagline,
      ...(persona.category === undefined ? {} : { category: persona.category }),
      sourceId: persona.id,
    },
    state: readPersonaState(store),
  }
}

/** The file's text form — pretty-printed, so an exported persona is a readable, hand-editable artifact
 *  (that is the whole point of a shareable preset file) rather than one minified line. */
export function personaFileText(file: PersonaFile): string {
  return `${JSON.stringify(file, null, 2)}\n`
}

/** `the-hotel-concierge-persona.json` — a download name derived from the label, never from the id (the
 *  file is for a human to recognize; `slug` falls back to `persona` for an all-punctuation label). */
export function personaFileName(persona: Persona): string {
  return `${slug(persona.label)}-persona.json`
}

export type ReadPersonaFileResult = { ok: true; file: PersonaFile } | { ok: false; error: string }

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** One entry list's ITEM-level check — the `Entry` shape, field for field. Returns an error message, or
 *  `undefined` when every item is well-formed.
 *
 *  REJECT, never sanitize-drop (the fork, ruled here): a dropped malformed entry would import a persona
 *  that LOOKS fine and behaves differently from the one exported — the exact silent-divergence class this
 *  whole feature exists to close. A rejection names the list and the index, so a hand-edited file (the
 *  format is deliberately hand-editable) can be repaired; a silent drop leaves nothing to repair.
 *
 *  This is also the only guard downstream of the file: `entries.ts`'s `readEntries` blind-casts whatever
 *  the store answers (`raw as Entry[]`), so a malformed item that got past here would reach render/compose
 *  code as a real `Entry` — and, because an import PERSISTS before it is ever rendered, would wedge the
 *  page on every subsequent reload until someone cleared localStorage by hand. */
function entryListError(key: string, list: readonly unknown[]): string | undefined {
  for (const [index, item] of list.entries()) {
    const at = `"${key}" entry ${index}`
    if (!isPlainObject(item)) return `The persona file's ${at} is not an entry.`
    for (const field of ['id', 'kind', 'label', 'description', 'content'] as const) {
      if (typeof item[field] !== 'string') return `The persona file's ${at} has no ${field}.`
    }
    if (typeof item.order !== 'number' || !Number.isFinite(item.order)) return `The persona file's ${at} has no order.`
    for (const flag of ['enabled', 'builtin'] as const) {
      if (typeof item[flag] !== 'boolean') return `The persona file's ${at} has no ${flag} flag.`
    }
  }
  return undefined
}

/**
 * Parse + validate a persona file's TEXT, fail-closed with a message a human can act on. Rejects (in
 * order): unparseable JSON · a non-object body · a wrong/absent `kind` · a version this build cannot
 * read · a missing/blank persona label · a non-object `state` · a state whose prompt sections are absent
 * or not an array (a persona with no sections would compose the generic fallback prompt — accepting it
 * would silently import a different agent than the one exported) · any entry list holding an item that
 * is not a well-formed `Entry` (`entryListError` — the deep check, since nothing downstream re-validates).
 * Unknown state keys are DROPPED rather than rejected: a hand-edited file may carry notes, and only
 * `PERSONA_STATE_KEYS` may reach a store.
 */
export function readPersonaFile(text: string): ReadPersonaFileResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    return { ok: false, error: 'Not a valid JSON file.' }
  }
  if (!isPlainObject(parsed)) return { ok: false, error: 'Not a persona file — the top level is not an object.' }
  if (parsed.kind !== PERSONA_FILE_KIND) {
    return { ok: false, error: `Not an agent-ui persona file (expected kind "${PERSONA_FILE_KIND}").` }
  }
  const { version } = parsed
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'The persona file declares no usable version.' }
  }
  if (version > PERSONA_FILE_VERSION) {
    return { ok: false, error: `Persona file version ${version} is newer than this build reads (version ${PERSONA_FILE_VERSION}).` }
  }
  const meta = parsed.persona
  if (!isPlainObject(meta) || typeof meta.label !== 'string' || meta.label.trim().length === 0) {
    return { ok: false, error: 'The persona file carries no name.' }
  }
  const rawState = parsed.state
  if (!isPlainObject(rawState)) return { ok: false, error: 'The persona file carries no state.' }
  const sections = rawState[entriesStoreKey(ENTRY_KINDS.promptSection)]
  if (!Array.isArray(sections)) return { ok: false, error: 'The persona file carries no prompt sections.' }
  for (const key of ENTRY_LIST_KEYS) {
    if (!(key in rawState)) continue
    const list = rawState[key]
    if (!Array.isArray(list)) return { ok: false, error: `The persona file's "${key}" is not a list.` }
    const error = entryListError(key, list as readonly unknown[])
    if (error !== undefined) return { ok: false, error }
  }

  const state: Record<string, unknown> = {}
  for (const key of PERSONA_STATE_KEYS) {
    if (key in rawState) state[key] = rawState[key]
  }
  return {
    ok: true,
    file: {
      kind: PERSONA_FILE_KIND,
      version,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
      persona: {
        label: meta.label.trim(),
        tagline: typeof meta.tagline === 'string' ? meta.tagline : '',
        ...(meta.category === 'hospitality' || meta.category === 'games' ? { category: meta.category } : {}),
        sourceId: typeof meta.sourceId === 'string' ? meta.sourceId : '',
      },
      state,
    },
  }
}

/** A kebab id from a label — the `validateNewEntry` slug law (entries.ts), reused so persona ids read
 *  like every other minted id in this surface. */
function slug(label: string): string {
  const out = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return out.length > 0 ? out : 'persona'
}

/** A collision-safe id/label pair against ids/labels already on the roster — the suffix counter that
 *  `validateNewEntry` uses for entries, applied to personas (a colliding id would silently SHARE the
 *  other persona's persisted store, which is the one failure mode library semantics must not have).
 *
 *  `tag` picks the uniquify WORDING only — the loop itself (base slug, taken-id/taken-label check,
 *  numeric suffix once both collide) is the ONE mechanism both a file import (`importedPersonaFrom`,
 *  `'imported'`) and a from-scratch mint (`mintBlankPersona`, GH #637 S1, `'new'`) run through, so a
 *  colliding blank agent gets the exact same collision-safety an imported one already has. */
function mintIdentity(
  label: string,
  taken: ReadonlySet<string>,
  takenLabels: ReadonlySet<string>,
  tag: 'imported' | 'new',
): { id: string; label: string } {
  const base = slug(label)
  const idFor = (n: number): string => (tag === 'imported' ? `${base}-imported${n > 1 ? `-${n}` : ''}` : `${base}${n > 1 ? `-${n}` : ''}`)
  const labelFor = (n: number): string =>
    tag === 'imported' ? `${label} (imported${n > 1 ? ` ${n}` : ''})` : `${label}${n > 1 ? ` ${n}` : ''}`
  let n = 1
  let id = idFor(n)
  let display = labelFor(n)
  while (taken.has(id) || takenLabels.has(display)) {
    n += 1
    id = idFor(n)
    display = labelFor(n)
  }
  return { id, label: display }
}

/**
 * Mint the roster entry a parsed file imports to: a NEW persona (never an overwrite) whose SEED is the
 * file's state verbatim, and whose id/label are made unique against the current roster. The state is
 * copied, never aliased — the caller's file object stays untouched.
 */
export function importedPersonaFrom(file: PersonaFile, roster: readonly Persona[]): Persona {
  const { id, label } = mintIdentity(
    file.persona.label,
    new Set(roster.map((p) => p.id)),
    new Set(roster.map((p) => p.label)),
    'imported',
  )
  return {
    id,
    label,
    tagline: file.persona.tagline.length > 0 ? file.persona.tagline : `Imported persona (from ${file.persona.sourceId || 'a persona file'})`,
    ...(file.persona.category === undefined ? {} : { category: file.persona.category }),
    seed: { ...file.state },
    imported: true,
  }
}

/**
 * Mint a brand-new BLANK persona (GH #637 S1, the roster's "New agent → Blank" action): the SAME
 * collision-safe identity mint `importedPersonaFrom` runs (`mintIdentity`, tagged `'new'` so the
 * id/label read "new-agent"/"New agent" rather than "…-imported"/"(imported)"), carrying a caller-
 * supplied seed instead of a parsed file's state — this module owns identity + envelope shape only,
 * never a fresh agent's default values (the page composes those from the SAME shipped defaults
 * `ui-agent-admin` itself falls back to when no store is set, `agent-admin.ts` connected()).
 */
export function mintBlankPersona(seed: Readonly<Record<string, unknown>>, roster: readonly Persona[]): Persona {
  const { id, label } = mintIdentity(
    'New agent',
    new Set(roster.map((p) => p.id)),
    new Set(roster.map((p) => p.label)),
    'new',
  )
  return {
    id,
    label,
    tagline: 'A freshly minted agent, ready to configure.',
    seed: { ...seed },
    imported: true, // roster-persisted the SAME way an imported persona is (GH #406) — never a shipped preset
  }
}
