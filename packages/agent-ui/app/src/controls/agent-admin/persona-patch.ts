// persona-patch.ts — the CANONICAL persona-state key set and the three-filter apply gate a declared
// `personaPatch` (SPEC-R29) passes through before a single byte reaches a draft persona's store
// (ADR-0178 cl.2, LLD `agent-authoring-flow.lld.md` §3).
//
// WHY THIS MODULE EXISTS, and why the key set lives HERE rather than in the site's persona-file: the set
// describes COMPONENT state (exactly what `composeLiveSystemPrompt` reads at turn time); the persona FILE
// format is one consumer of it, and the apply gate is another. Two hand-maintained enumerations of the same
// truth is the silent-divergence class GH #406 closed for the file half — hoisting it to the one package
// both consumers already import (site → app is the DAG's normal direction) keeps that closed as the second
// consumer lands. `site/pages/agent-admin-persona-file.ts` re-exports the set, so every existing importer
// keeps its symbol.
//
// THE ADMISSION LAW (the fork the LLD rules, restated because it is the clause most at risk of drift): the
// shipped sanitizers COERCE — `sanitizeModel` answers DEFAULT_MODEL_ID for garbage, `sanitizeCatalog`
// answers the default id. That read-time law is right for READS and catastrophic for an APPLY gate: coercing
// a model's garbage into a plausible default would write a wrong-but-valid-looking value into the user's
// draft and call it the model's intent. So admission is a FIXPOINT test over those same sanitizers — a value
// is admitted iff its own sanitizer returns it UNCHANGED — which reuses each sanitizer's judgment without
// inventing a second validation vocabulary, and makes every rejection a DROP (recorded on the turn log,
// ADR-0178 cl.2's degrade posture) rather than a coercion or an error surface.
//
// NO DELETION SEMANTICS exist here, by construction: entries only ever APPEND (SPEC-R29's no-deletion law
// has no code path to misuse), and values merge per-key whole-value last-writer-wins — the store write IS
// that semantics.

import {
  A2UI_CATALOG_KEY,
  A2UI_LOCAL_PATTERNS_KEY,
  AGENT_ENABLED_KEY,
  BANKROLL_CAPABLE_KEY,
  BANKROLL_KEY,
  MODELS_INCLUDED_KEY,
  SURFACE_A2UI_KEY,
  SURFACE_AUTHORING_KEY,
  SURFACE_GENUI_DOGFOOD_KEY,
  SURFACE_GENUI_KEY,
  SURFACE_MARKDOWN_KEY,
  SURFACE_PLANNER_KEY,
  kindEnabledKey,
  sanitizeBankroll,
  sanitizeCatalog,
  sanitizeLocalPatterns,
  sanitizeModel,
  type SupportedModel,
} from './agent-admin-schema.ts'
import { sanitizeNumber } from '@agent-ui/shared'
import type { SettingsSchema } from '../settings/schema.ts'
import { ENTRY_KINDS } from './entries.ts'
import { entriesStoreKey, readEntries, validateNewEntry, type Entry, type NewEntryInput } from '../entry-list/entry-data.ts'

/** The six-plus entry-list store keys — one per `ENTRY_KINDS` member, derived, never hand-listed. */
export const PERSONA_ENTRY_LIST_KEYS: readonly string[] = Object.values(ENTRY_KINDS).map((kind) => entriesStoreKey(kind))

/** Every persona-scoped store key, in a stable order (a Set: `kindEnabledKey('tool')` IS the pre-existing
 *  `toolsEnabled` config key — one key, two readers). Order is the JSON key order of an exported persona
 *  file, so two exports of the same state are byte-identical strings.
 *
 *  GH #640 (Kim's ruling) — `SURFACE_PLANNER_KEY` joins the set here. Its omission was pre-persona-file
 *  drift, not a decision: it is a persona-scoped Surface Option exactly like the four keys around it, so a
 *  planner-enabled persona used to re-import with the capability silently reverted to the inverse default. */
export const PERSONA_STATE_KEYS: readonly string[] = [
  ...new Set([
    // the agent config (the settings pane's own fields + the Model grid's selection/inclusion record)
    'name',
    'model',
    'temperature',
    MODELS_INCLUDED_KEY,
    // the master switches — the Agent card's own, plus one per capability kind
    AGENT_ENABLED_KEY,
    ...Object.values(ENTRY_KINDS).map((kind) => kindEnabledKey(kind)),
    // Surface Options (the output-modality contract)
    SURFACE_MARKDOWN_KEY,
    SURFACE_A2UI_KEY,
    SURFACE_GENUI_KEY,
    SURFACE_GENUI_DOGFOOD_KEY,
    // ADR-0174 cl.1 / SPEC-R21 — the planner-stage opt-in (GH #640's ruled fix, above).
    SURFACE_PLANNER_KEY,
    // ADR-0178 cl.3 / SPEC-R30 — the persona-authoring modality gate. Persona-scoped like every other
    // Surface Option, so an exported Builder-shaped persona re-imports with its authoring capability
    // intact instead of silently reverting to the inverse default (OFF).
    SURFACE_AUTHORING_KEY,
    A2UI_CATALOG_KEY,
    // M-D SPEC-R5 — the persona's local-pattern-set SELECTION (never its definitions, which are
    // package-shipped code, SPEC-R1): symmetrical in storage shape to A2UI_CATALOG_KEY above.
    A2UI_LOCAL_PATTERNS_KEY,
    // GH #525 — the persistent-bankroll capability opt-in + its own persisted figure.
    BANKROLL_CAPABLE_KEY,
    BANKROLL_KEY,
    // the entry lists
    ...PERSONA_ENTRY_LIST_KEYS,
  ]),
]

/** The VALUE half of the canonical set — every persona key that is not an entry list. A patch's `values`
 *  member may name these and nothing else (§3 filter 1). */
export const PERSONA_VALUE_KEYS: readonly string[] = PERSONA_STATE_KEYS.filter((key) => !PERSONA_ENTRY_LIST_KEYS.includes(key))

/** The minimum a store must offer to be exported — `SettingsStore`'s `get`, nothing else. */
export interface PersonaStateReader {
  get(key: string): unknown
}

/** The read/write surface `applyPersonaPatch` needs — `SettingsStore`'s `get`/`set`, nothing else. */
export interface PersonaStateStore extends PersonaStateReader {
  set(key: string, value: unknown): void
}

/** The persona-scoped state a store currently answers, restricted to `PERSONA_STATE_KEYS` and to keys the
 *  store actually holds (an unset key is OMITTED, never written as `undefined` — the component's own
 *  fail-closed reads supply every default, and an omitted key must stay omitted for a round trip to be
 *  deep-equal). */
export function readPersonaState(store: PersonaStateReader | undefined): Record<string, unknown> {
  const state: Record<string, unknown> = {}
  for (const key of PERSONA_STATE_KEYS) {
    const value = store?.get(key)
    if (value !== undefined) state[key] = value
  }
  return state
}

/** The draft-state block a guided-authoring turn appends to the interviewer's composed persona (LLD §2's
 *  draft-state-feedback row): the SAME canonical projection the persona file exports, serialized fresh per
 *  turn so the interviewer sees what is established versus missing — INCLUDING the user's concurrent hand
 *  edits, which is the whole reason SPEC-R29's merge law is incremental.
 *
 *  Entry lists collapse to their labels: the interviewer needs to know WHICH sections/skills exist, never
 *  their bodies, and a full draft's prompt-section content would dominate the turn's context. */
export function draftStateBlock(store: PersonaStateReader | undefined): string {
  const state = readPersonaState(store)
  const summary: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(state)) {
    summary[key] = PERSONA_ENTRY_LIST_KEYS.includes(key) && Array.isArray(value)
      ? value.map((item) => (typeof item === 'object' && item !== null ? ((item as Entry).label ?? '') : String(item)))
      : value
  }
  return `## The draft agent's current configuration\n\nThis is the draft as it stands RIGHT NOW, re-read at the start of every turn (the user may also be hand-editing it between turns). Keys absent here are unset. Steer the interview toward what is still missing, and never re-ask for something already established.\n\n${JSON.stringify(summary, null, 2)}`
}

// ── filter 2: the per-key admission table (fixpoint checks over the shipped fail-closed readers) ─────────

/** The inputs a per-key admission predicate may consult — the SAME reads the component's own turn-time
 *  reads use, passed in rather than imported so the gate stays a pure function of its arguments. */
export interface PatchDeps {
  models: readonly SupportedModel[]
  schema: SettingsSchema
}

type Admit = (value: unknown, deps: PatchDeps) => boolean

/** Every switch-shaped key admits a LITERAL boolean only — never a truthy string/number. A stored
 *  non-boolean must not be able to turn a capability on by accident (each key's own fail-closed reader
 *  already refuses one; admitting it here would write a value those readers then ignore). */
const admitBoolean: Admit = (value) => typeof value === 'boolean'

const ADMISSION: Readonly<Record<string, Admit>> = {
  // `name` is free text — the settings field's own `required` validation is a UI-level affordance, and an
  // empty name degrades to 'Untitled agent' at read time exactly as a hand-cleared field does.
  name: (value) => typeof value === 'string',
  model: (value, deps) => sanitizeModel(value, deps.models) === value,
  temperature: (value, deps) => typeof value === 'number' && sanitizeNumber(deps.schema, 'temperature', value, Number.NaN) === value,
  // The Model grid's inclusion record — a plain object of booleans, the ONE shape `isModelIncluded` reads.
  [MODELS_INCLUDED_KEY]: (value) =>
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every((v) => typeof v === 'boolean'),
  [AGENT_ENABLED_KEY]: admitBoolean,
  ...Object.fromEntries(Object.values(ENTRY_KINDS).map((kind) => [kindEnabledKey(kind), admitBoolean])),
  [SURFACE_MARKDOWN_KEY]: admitBoolean,
  [SURFACE_A2UI_KEY]: admitBoolean,
  [SURFACE_GENUI_KEY]: admitBoolean,
  [SURFACE_GENUI_DOGFOOD_KEY]: admitBoolean,
  [SURFACE_PLANNER_KEY]: admitBoolean,
  [SURFACE_AUTHORING_KEY]: admitBoolean,
  [BANKROLL_CAPABLE_KEY]: admitBoolean,
  [A2UI_CATALOG_KEY]: (value) => sanitizeCatalog(value) === value,
  [A2UI_LOCAL_PATTERNS_KEY]: (value) => sanitizeLocalPatterns(value) === value,
  [BANKROLL_KEY]: (value) => sanitizeBankroll(value) === value,
}

// ── filter 3: entries, through the pane's OWN add path ───────────────────────────────────────────────────

/** `entries:skill` → `skill`. The reverse of `entriesStoreKey`, over the enumerated kinds only (an
 *  unrecognized key never reaches here — filter 1 dropped it). */
const KIND_FOR_ENTRY_KEY: ReadonlyMap<string, string> = new Map(
  Object.values(ENTRY_KINDS).map((kind) => [entriesStoreKey(kind), kind]),
)

/** One proposed entry member → the `NewEntryInput` the pane's add form would have produced, or `undefined`
 *  when the member is not entry-shaped at all. `label` is the ONE required field (it is what
 *  `validateNewEntry` slugs an id from); `description`/`content` default to empty strings and `id` is
 *  admitted only as a string, matching the add form's own field types. */
function entryInputFrom(member: unknown): NewEntryInput | undefined {
  if (typeof member !== 'object' || member === null || Array.isArray(member)) return undefined
  const raw = member as Record<string, unknown>
  if (typeof raw.label !== 'string') return undefined
  return {
    label: raw.label,
    description: typeof raw.description === 'string' ? raw.description : '',
    content: typeof raw.content === 'string' ? raw.content : '',
    ...(typeof raw.id === 'string' ? { id: raw.id } : {}),
  }
}

/** What one applied patch actually did — rides the turn log (never an error surface), so a dropped key is
 *  observable to whoever is debugging the interview without interrupting it (ADR-0178 cl.2). */
export interface PatchReport {
  /** Value keys written, in patch order. */
  applied: string[]
  /** Entry-list store key → how many entries were appended. */
  added: Record<string, number>
  /** Every key or entry that was refused, named for the log (`entries:skill[1]` for a member). */
  dropped: string[]
}

/**
 * Apply one declared patch to `store` through ADR-0178 cl.2's three filters, in order, fail-closed at every
 * step — a drop removes the ITEM, never the patch, never the turn.
 *
 *   1. Enumerated-key filter — `values` keys must be ∈ `PERSONA_VALUE_KEYS`, `entries` keys ∈
 *      `PERSONA_ENTRY_LIST_KEYS`. A `values` key naming an entry list (or the reverse) is wrong INTENT, not
 *      a near-miss, and drops with everything else unknown.
 *   2. Per-key admission — the fixpoint table above. Admitted ⇒ `store.set(key, value)`, whole-value,
 *      last-writer-wins (SPEC-R29's pinned merge law; the store write IS that semantics).
 *   3. `validateNewEntry` — each proposed entry through the IDENTICAL call the pane's own add path makes,
 *      including `{ rejectOnCollision: kind === ENTRY_KINDS.catalog }` (GH #564: a catalog id IS a foreign
 *      key, so a collision is a duplicate, not something to dedup-suffix). Admitted entries APPEND, one
 *      `store.set` per kind — one write, one pane re-render.
 *
 * CALLER'S DUTY: this function is gate-blind. Whether a patch may be consumed at all — the authoring-context
 * store-identity fence AND the fresh `SURFACE_AUTHORING_KEY` read, conjunctive (Kim's §15 option-(b) ruling)
 * — is the component's decision, made before it calls here.
 */
export function applyPersonaPatch(
  store: PersonaStateStore,
  patch: { values?: Record<string, unknown>; entries?: Record<string, unknown[]> },
  deps: PatchDeps,
): PatchReport {
  const report: PatchReport = { applied: [], added: {}, dropped: [] }

  for (const [key, value] of Object.entries(patch.values ?? {})) {
    const admit = ADMISSION[key]
    // Filter 1 and filter 2 collapse into one lookup: a key outside PERSONA_VALUE_KEYS has no admission
    // row (the table is built FROM the canonical set), so an unknown key and an entry-list key named in
    // `values` both fall out here.
    if (admit === undefined || !admit(value, deps)) {
      report.dropped.push(key)
      continue
    }
    store.set(key, value)
    report.applied.push(key)
  }

  for (const [key, members] of Object.entries(patch.entries ?? {})) {
    const kind = KIND_FOR_ENTRY_KEY.get(key)
    if (kind === undefined || !Array.isArray(members)) {
      report.dropped.push(key)
      continue
    }
    // `current` accumulates ACROSS this kind's members so a patch proposing two entries with the same
    // label gets the same id-collision treatment two sequential add-form submissions would.
    const current: Entry[] = readEntries(store, kind)
    const admitted: Entry[] = []
    for (const [index, member] of members.entries()) {
      const input = entryInputFrom(member)
      if (input === undefined) {
        report.dropped.push(`${key}[${index}]`)
        continue
      }
      const result = validateNewEntry([...current, ...admitted], kind, input, { rejectOnCollision: kind === ENTRY_KINDS.catalog })
      if (!result.ok) {
        report.dropped.push(`${key}[${index}]`)
        continue
      }
      admitted.push(result.entry)
    }
    if (admitted.length === 0) continue
    store.set(key, [...current, ...admitted])
    report.added[key] = admitted.length
  }

  return report
}
