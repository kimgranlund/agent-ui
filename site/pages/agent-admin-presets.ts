// site/pages/agent-admin-presets.ts — the agent-admin roster: the six original A2UI-SHOWCASE personas
// (TKT-0074) + the GH #46 hospitality/travel additions (the Concierge upgraded in place to the Hotel
// Concierge; the Maître d' and the Travel Agent new) + their persona-scoped store mechanics. PAGE-LOCAL
// data, deliberately not a package export (the ticket's scope line): the PAGE owns which personas
// exist; the packages own only the primitives this file composes (createOverlayStore · createMemoryStore ·
// entriesStoreKey · DEFAULT_PROMPT_SECTIONS).
//
// The design (ruled in-conversation 2026-07-16, the option-2 shape): each persona is its OWN store, so
// edits persist PER PERSONA and survive switching away and back. A shipped preset's store reads its seed
// plus the user's overlay (`createOverlayStore`, T-0161: edits are a diff, merged onto a new seed); an
// imported or duplicated persona's is `createMemoryStore({ initial: seed, persistKey:
// 'agent-admin-app.<id>' })`, persisted values winning over the seed (memory-store.ts's parity law). Switching personas swaps `admin.store`; the component's own
// reactive store effect (agent-admin.ts's connected()) re-pushes it into the settings pane, rewires
// every entry section, and — GH #145 fix — genuinely resets the conversation: a real store
// reassignment (a different object reference from the previously-seen one) clears the visible chat
// log + any open A2UI surfaces, the live-request history ring, and the Dialog Turns log, so a
// freshly-selected persona starts a clean thread rather than appending onto the old one. A bare
// reconnect with the SAME store (e.g. a layout crossing) is NOT a switch and does not reset. Proven
// by the store-swap probe in agent-admin-app.test.ts and the reset regression in agent-admin.test.ts.
//
// Each persona steers a DIFFERENT catalog family + interaction mechanism — through its CAPABILITY
// entries, never through its prompt sections: its Foundation builtin is rewritten to the persona, a
// custom "Surface style" section states when a surface earns its place vs prose and what belongs on it
// (INTENT ONLY, modality-neutral — GH #412 rewrote all fourteen: naming a dialect or a component
// vocabulary in persona prose broke the moment the admin flipped Surface Options, and dialect is the
// a2ui producer grammar's job, ADR-0138), and its capability entries either intent-match the shipped
// mini-skill registry (ADR-0091, the game/dashboard showcases: card-layout · game-table-chrome ·
// game-hud · dashboard-kpi-grid) or carry AUTHORED
// hospitality/travel skills seeded from the library packs (GH #46). A `context` skill reaches the live prompt
// through composeLiveSystemPrompt as an index line only (label and one-line description, agent-model SPEC-R14);
// its full content loads when the user names it. form-rhythm/login-form
// left the roster with the old Concierge). The stub path still proves the plumbing: the stub reply
// cites the composed prompt + enabled capabilities without emitting surfaces.
import { createMemoryStore } from '@agent-ui/app/settings-memory-store'
import type { SettingsStore } from '@agent-ui/app/settings-store'
// ADR-0227 wave 1 (GH #1542) — the roster's persisted records (imported library · display order ·
// active id · seedVersion/modifiedAt markers) all live in the AgentRosterSource now: @agent-ui/data's
// first real consumer surface, persisting through the StorageAdapter browser-storage tier under the SAME
// raw keys this file used to hand-roll, so existing users' personas survive byte-for-byte. This file
// keeps its sync function surface (personaRoster · saveImportedPersona · …) as thin delegations — the
// page's own resource()/mutation() grammar lives in agent-admin-app.ts.
import {
  createAgentRosterSource,
  PERSONA_ROSTER_NAMESPACE,
  type AgentRecord,
  type AgentRosterSource,
} from '@agent-ui/app/agent-admin-roster-source'
// T-0161: a shipped persona's edits are an overlay (a diff over its seed) merged on a seed update.
import {
  createOverlayStore,
  diffOverlay,
  emptyOverlay,
  rebaseOverlay,
  type OverlayAddress,
  type OverlayPath,
  type OverlayStore,
  type Provenance,
  type ProvenanceReader,
} from '@agent-ui/app/agent-admin-overlay'
import { ENTRY_KINDS, DEFAULT_PROMPT_SECTIONS } from '@agent-ui/app/agent-admin-entries'
import { entriesStoreKey } from '@agent-ui/app/entry-data'
import type { Entry } from '@agent-ui/app/entry-data'
// T-0160: the presets are content files (`site/agent-content/personas/<id>/agent.md`, their entries
// either refs into the shared library packs or files under the persona's own folder), read through the
// generated registry. A preset seeds from the SAME entry files the add-from-library menu offers
// (agent-admin-libraries.ts reads the same packs): one authored source, zero drift (GH #46).
import type { PresetCategory } from './agent-admin-libraries.ts'
import { personaRecord, personaRecords, personaSections, PERSONA_SECTIONS, resolveRef, seedDigestsAt, type RuntimePersona } from '../agent-content/registry.ts'
import type { EntryKind } from '../agent-content/schema.ts'
// GH #497 — the concierge/croupier content personas seed their OWN local pattern set selection (the
// `SHIPPED_PERSONA_CATALOGS` `personaId`, SPEC-R5) the same way every other persona-scoped config key
// seeds: through `presetSeed`'s returned record, keyed by the schema's own storage key.
// GH #525 — the persistent-bankroll capability opt-in seeds the SAME way (design call 2, 2026-08-07: a
// games-category capability, presets opt in).
import { A2UI_DOMAINS_KEY, A2UI_LOCAL_PATTERNS_KEY, BANKROLL_CAPABLE_KEY } from '@agent-ui/app/agent-admin-schema'
// ADR-0178 cl.3/cl.4 (GH #633) — the Builder persona's own gate seeds + the CANONICAL key vocabulary its
// generated prompt section is composed from (never a hand-listed copy — see `vocabularySection`).
import { SURFACE_A2UI_KEY, SURFACE_AUTHORING_KEY, modelRoster } from '@agent-ui/app/agent-admin-schema'
import { PATCHABLE_VALUE_SHAPES, PERSONA_ENTRY_LIST_KEYS, PERSONA_VALUE_KEYS } from '@agent-ui/app/agent-admin-persona-patch'
import type { EffortLevel } from '@agent-ui/app/composer-options'
import type { CacheTtl, ThinkingMode } from '@agent-ui/a2ui/agent/model-capabilities'

export interface AgentPreset {
  id: string
  label: string
  /** One line for the picker strip's title attribute — what this persona SHOWCASES. */
  tagline: string
  /** GH #143 — the persona's library-pack scope: which FLAVORED (Hospitality/Games) library packs its
   *  own "add from library" menu offers, on top of the generic packs every preset always sees
   *  (`agent-admin-libraries.ts`'s `librariesForCategory`). Absent ⇒ neither flavor — a preset with no
   *  persona-flavored home (The Quant/The Curator/The Stylist: dashboards, browsable collections, design
   *  tokens — none of them a hotel or a game) sees generic packs only, never a stray Hospitality/Games
   *  one. This is a SURFACING scope only — packs stay shared/reusable on the data side regardless. */
  category?: PresetCategory
  /** T-0185: the agent config. Model settings (`effort`, `thinking`, `showReasoning`, `maxTokens`,
   *  `cacheTtl`) are optional and must validate against the model's capability row; there is no
   *  temperature (the 5.5 models accept only 1.0, and no request ever sent it). */
  config: {
    name: string
    model: string
    toolsEnabled: boolean
    effort?: EffortLevel
    thinking?: ThinkingMode
    showReasoning?: boolean
    maxTokens?: number
    cacheTtl?: 'off' | CacheTtl
  }
  /** The persona's Foundation rewrite (the builtin keeps its id/label; only content changes). */
  foundation: string
  /** The custom "Surface style" section — when to show a surface vs prose, and WHAT belongs on it.
   *  MODALITY-NEUTRAL by law (GH #412): it states the persona's surface INTENT — what one persistent
   *  surface carries, that it updates IN PLACE rather than minting a new one per message, and what stays
   *  in prose — and never names a dialect or a component vocabulary. Those belong to the a2ui producer's own
   *  grammar blocks (`system-prompt.ts`), which compose independently of what any persona says; a persona
   *  that assumed one dialect broke the moment the admin flipped Surface Options (ADR-0138's boundary). */
  surfaceStyle: string
  /** T-0231: the facts this persona must always know (hours, policies, schedules), seeded as a "House facts"
   *  prompt section after Surface style. Capability entries reach the prompt as index lines only (ADR-0190
   *  rev.2), and a guest never names a resource, so a fact the agent must answer unprompted lives here, the
   *  ruled escape hatch. Plain facts, modality-neutral like `surfaceStyle`. Absent: no section. */
  houseFacts?: string
  skills: readonly SeedEntry[]
  workflows: readonly SeedEntry[]
  resources: readonly SeedEntry[]
  tools: readonly SeedEntry[]
  /** Builtin prompt-section ids to seed DISABLED (coverage: disabled-but-never-removed, ADR-0132 Fork 4). */
  disabledBuiltins?: readonly string[]
  /** The seed version: the `version` of its `agent.md` (T-0160, with the reason on its `changelog` list),
   *  pinned in this agent's `site/lib/agent-manifest/<id>.manifest.json`. Absent = 1. A user's edits are an
   *  overlay keyed `id@version` (T-0161, `personaStore`): a bump merges them onto the new seed per field and
   *  never wipes them; a field both sides changed keeps the user value, flagged `seedChanged`. */
  seedVersion?: number
  /** GH #497 — this persona's `SHIPPED_PERSONA_CATALOGS` `personaId` (`concierge`/`croupier`), seeded as
   *  its `A2UI_LOCAL_PATTERNS_KEY` selection. Absent (every OTHER preset) ⇒ no local set seeded — the
   *  SAME fail-closed default `A2UI_CATALOG_KEY` already has (no preset seeds that either, `presetSeed`'s
   *  own comment). `sanitizeLocalPatterns` (agent-admin-schema.ts) is the one fail-closed read gate;
   *  `site/lib/agent-manifest/agent-manifest.test.ts` validates this value against the shipped persona
   *  folders and the agent's manifest, so a typo reds that gate instead of reading as "none". */
  localPatterns?: string
  /** T-0202 (catalog architecture CA-R3): the shipped domains this persona composes onto its base, seeded as its
   *  `A2UI_DOMAINS_KEY` selection (the canonical `+`-joined tail). Absent or empty: the base alone, the same
   *  fail-closed default `localPatterns` has. Replaces `localPatterns` in W1; no preset sets it before then. */
  domains?: readonly string[]
  /** GH #525 (design call 2, 2026-08-07) — opts this persona into the persistent-bankroll capability:
   *  its games keep a running score at the FIXED data-model path `/bankroll`, so the app may mirror that
   *  pointer into the persona store after every surface turn and state the stored figure back at turn
   *  start. Absent (every OTHER preset) ⇒ `BANKROLL_CAPABLE_KEY` is never seeded — the SAME "key omitted
   *  entirely" default `localPatterns` above already has; a persona whose games track something ELSE
   *  (the Quizmaster's round score, say) must never have its turns scanned for a pointer it never writes. */
  bankroll?: boolean
}

/** A seed capability entry — expanded to a full `Entry` (order = array index) by `presetSeed`. */
interface SeedEntry {
  id: string
  label: string
  description: string
  content: string
  enabled?: boolean
  /** agent-model SPEC-R14; absent reads `context`, so only `invocable` is ever seeded. */
  availability?: 'invocable'
}

/** A persona's refs of one kind as seed entries, in ref order. A ref names a library entry (the same
 *  file a pack offers) or, with `./`, an entry under the persona's own folder. The seed id is the entry
 *  id, which for an Integrations entry is the dev proxy's registry key (ADR-0168 cl.2 / LLD-C7, the
 *  three-facts law: an integration seeded under its human label would be dropped by the registry
 *  intersection, an armed tool silently inert) and for every other entry equals its label. */
function seedEntries(record: RuntimePersona, kind: EntryKind): SeedEntry[] {
  return record.frontmatter[`${kind}s`].map((ref) => {
    const entry = resolveRef(ref, kind, record.id)
    const { label, description, availability } = entry.frontmatter
    return { id: entry.id, label, description, content: entry.body, ...(availability === 'invocable' ? { availability } : {}) }
  })
}

/** One persona file as an `AgentPreset`. Optional fields stay ABSENT when the file omits them (never
 *  `undefined` or a default): `presetSeed` and `personaFromPreset` key on presence. */
function presetFromRecord(record: RuntimePersona): AgentPreset {
  const fm = record.frontmatter
  const { foundation, sections } = personaSections(record.body)
  const houseFacts = sections[PERSONA_SECTIONS.houseFacts]
  return {
    id: fm.id,
    label: fm.label,
    tagline: fm.tagline,
    ...(fm.category === undefined ? {} : { category: fm.category }),
    config: {
      name: fm.name,
      model: fm.model,
      toolsEnabled: fm.toolsEnabled,
      ...(fm.effort === undefined ? {} : { effort: fm.effort as EffortLevel }),
      ...(fm.thinking === undefined ? {} : { thinking: fm.thinking as ThinkingMode }),
      ...(fm.showReasoning === undefined ? {} : { showReasoning: fm.showReasoning }),
      ...(fm.maxTokens === undefined ? {} : { maxTokens: fm.maxTokens }),
      ...(fm.cacheTtl === undefined ? {} : { cacheTtl: fm.cacheTtl as 'off' | CacheTtl }),
    },
    foundation,
    surfaceStyle: sections[PERSONA_SECTIONS.surfaceStyle] ?? '',
    ...(houseFacts === undefined ? {} : { houseFacts }),
    skills: seedEntries(record, 'skill'),
    workflows: seedEntries(record, 'workflow'),
    resources: seedEntries(record, 'resource'),
    tools: seedEntries(record, 'tool'),
    ...(fm.disabledBuiltins === undefined ? {} : { disabledBuiltins: [...fm.disabledBuiltins] }),
    ...(fm.version > 1 ? { seedVersion: fm.version } : {}),
    ...(fm.localPatterns === undefined ? {} : { localPatterns: fm.localPatterns }),
    ...(fm.domains === undefined ? {} : { domains: [...fm.domains] }),
    ...(fm.bankroll === undefined ? {} : { bankroll: fm.bankroll }),
  }
}

/** The roster presets, in each file's `order`. Each persona steers its own catalog family and interaction
 *  mechanism (this file's header); the game roster (the six-game wave, 2026-07-19 shortlist) exercises the
 *  mechanisms the Croupier and Quizmaster leave uncovered. Why each seed version moved is the file's
 *  `changelog`. */
export const AGENT_PRESETS: readonly AgentPreset[] = personaRecords()
  .filter((r) => r.frontmatter.roster !== false)
  .map(presetFromRecord)

// ── seed + store mechanics ────────────────────────────────────────────────────────────────────────────────

// ONE prefix truth: the memory-store persist keys and the roster source's records share the namespace
// they always did (`agent-admin-app.…`) — imported from the source module so the two can never drift.
const PERSIST_PREFIX = PERSONA_ROSTER_NAMESPACE
const persistKeyFor = (id: string): string => `${PERSIST_PREFIX}.${id}`

/** Expand a persona's seed entries to full `Entry` records (order = index; enabled defaults true). */
function expand(kind: string, seeds: readonly SeedEntry[]): Entry[] {
  return seeds.map((s, i) => ({
    id: s.id,
    kind,
    label: s.label,
    description: s.description,
    content: s.content,
    order: i,
    enabled: s.enabled ?? true,
    builtin: false, // seeded capabilities are user-deletable, unlike the shipped prompt builtins
    ...(s.availability === undefined ? {} : { availability: s.availability }),
  }))
}

/** The full store seed for a persona: the four config keys + EVERY entry-list key (genui-surface
 *  SPEC-R11/B2 added `pattern-source` and ADR-0170 added `catalog`, both seeded EMPTY — no shipped persona
 *  scripts a picked source or curates a catalog shelf; the admin picks per agent, same as any
 *  hand-authored entry). The prompt sections are the three
 *  shipped builtins with Foundation's CONTENT rewritten to the persona (ids, labels, and non-deletability
 *  untouched — ADR-0132 cl.2) + the persona's "Surface style" custom section appended (and its "House facts"
 *  section after it, when the preset has one, T-0231); `disabledBuiltins`
 *  seeds those builtins toggled off (never removed, Fork 4). */
export function presetSeed(preset: AgentPreset): Record<string, unknown> {
  const sections: Entry[] = [
    ...DEFAULT_PROMPT_SECTIONS.map((s) => ({
      ...s,
      content: s.id === 'foundation' ? preset.foundation : s.content,
      enabled: preset.disabledBuiltins?.includes(s.id) ? false : s.enabled,
    })),
    {
      id: 'surface-style',
      kind: ENTRY_KINDS.promptSection,
      label: 'Surface style',
      description: 'When to show a surface vs prose, and what belongs on it.',
      content: preset.surfaceStyle,
      order: DEFAULT_PROMPT_SECTIONS.length,
      enabled: true,
      builtin: false, // the one persona section a user may delete
    },
    ...(preset.houseFacts === undefined
      ? []
      : [
          {
            id: 'house-facts',
            kind: ENTRY_KINDS.promptSection,
            label: 'House facts',
            description: 'The facts this agent always knows: hours, policies and schedules (T-0231).',
            content: preset.houseFacts,
            order: DEFAULT_PROMPT_SECTIONS.length + 1,
            enabled: true,
            builtin: false,
          },
        ]),
  ]
  return {
    ...preset.config,
    // GH #497 — absent ⇒ key omitted entirely (not seeded `undefined`), matching every other
    // never-seeded persona-scoped key's byte-identical "absent" shape.
    ...(preset.localPatterns === undefined ? {} : { [A2UI_LOCAL_PATTERNS_KEY]: preset.localPatterns }),
    // T-0202: the same "absent means key omitted" shape; the stored value is the canonical sorted tail.
    ...(preset.domains === undefined || preset.domains.length === 0 ? {} : { [A2UI_DOMAINS_KEY]: [...new Set(preset.domains)].sort().join('+') }),
    // GH #525 — the SAME "absent ⇒ key omitted entirely" shape: only a preset that opts in seeds the
    // capability flag at all; every other persona's store never carries `BANKROLL_CAPABLE_KEY`, so
    // `isBankrollCapable`'s fail-closed read answers "not capable" exactly as if this key never existed.
    ...(preset.bankroll === true ? { [BANKROLL_CAPABLE_KEY]: true } : {}),
    [entriesStoreKey(ENTRY_KINDS.promptSection)]: sections,
    [entriesStoreKey(ENTRY_KINDS.skill)]: expand(ENTRY_KINDS.skill, preset.skills),
    [entriesStoreKey(ENTRY_KINDS.workflow)]: expand(ENTRY_KINDS.workflow, preset.workflows),
    [entriesStoreKey(ENTRY_KINDS.resource)]: expand(ENTRY_KINDS.resource, preset.resources),
    [entriesStoreKey(ENTRY_KINDS.tool)]: expand(ENTRY_KINDS.tool, preset.tools),
    // genui-surface.spec.md SPEC-R11/B2 — no shipped persona scripts a picked pattern source (D3's
    // single-pick is an admin choice, not a persona-authored default); seeded empty like a fresh store.
    [entriesStoreKey(ENTRY_KINDS.patternSource)]: [],
    // ADR-0170 cl.1/cl.4 — the catalog ROSTER, seeded empty on the SAME rationale: no shipped persona
    // curates a catalog shelf, and the Default row is guaranteed at READ time (`readCatalogEntries`), so
    // an empty seed and an absent key render identically. The persona's SELECTION is `A2UI_CATALOG_KEY`,
    // which no preset seeds either — every persona starts on the default catalog, fail-closed.
    [entriesStoreKey(ENTRY_KINDS.catalog)]: [],
  }
}

// ── the PERSONA roster (GH #406) ──────────────────────────────────────────────────────────────────────
// A `Persona` is what the PAGE switches between: an id + roster metadata + the store SEED. A shipped
// preset becomes one via `personaFromPreset` (its seed = `presetSeed`); an IMPORTED persona (the
// persona-library pattern — agent-admin-persona-file.ts) carries the imported store state as its seed
// directly. That is the whole reason this indirection exists: an imported persona's state is a full
// store snapshot (edited builtins, admin-authored sections, master switches), which the `AgentPreset`
// shape — foundation + surfaceStyle + four seed lists — cannot express without losing bytes, and losing
// bytes is exactly what "identical live behaviour" forbids. Everything below (the store cache, the
// seedVersion migration, reset) keys on the persona id, so both kinds share one mechanism.

// GH #1699 (2026-08-29) — was a page-local `interface Persona` duplicating the package's roster-record
// shape field-for-field; now a declared subset of the package's `AgentRecord` so the same thing has one
// name (the builder's-call line the ticket left open). `category` narrows to this page's own literal
// union — the package's `AgentRecord.category` stays structurally WIDE (any string) so this subtype
// relation holds without the package importing site vocabulary.
export type Persona = Omit<AgentRecord, 'category'> & {
  category?: PresetCategory
}

/** A shipped preset as a roster persona. */
export function personaFromPreset(preset: AgentPreset): Persona {
  return {
    id: preset.id,
    label: preset.label,
    tagline: preset.tagline,
    ...(preset.category === undefined ? {} : { category: preset.category }),
    seed: presetSeed(preset),
    ...(preset.seedVersion === undefined ? {} : { seedVersion: preset.seedVersion }),
  }
}

const storeCache = new Map<string, SettingsStore>()

// ── the roster source (ADR-0227 clause 4 — @agent-ui/data's first real consumer) ─────────────────────────
// Constructed HERE, the composition seam that owns the shipped roster (clause 2: delivery is explicit
// injection — the shipped personas are page data, so the page tier hands them in). It owns every record
// the retired hand-rolled keys carried: the imported library, the display order, the active-agent id,
// and the per-persona seedVersion/modifiedAt markers — same raw keys, now through the StorageAdapter
// tier (ADR-0193). `onRemove` keeps the page-side store cache honest in the same motion a delete sweeps.
export const rosterSource: AgentRosterSource<Persona> = createAgentRosterSource<Persona>({
  shipped: AGENT_PRESETS.map(personaFromPreset),
  onRemove: (id) => storeCache.delete(id),
})

/** The persisted last-write time (epoch ms), or `undefined` when this persona's store has never been
 *  written to since boot (a fresh preset, or a reset one) — the Manage-agents card's Date fallback reads
 *  this when `Persona.createdAt` is absent (GH #921's own fallback ruling; the marker is bumped by the
 *  store-subscribe seam in `personaStore` below and swept with the namespace on reset). */
export function loadModifiedAt(id: string): number | undefined {
  return rosterSource.modifiedAtSync(id)
}

/** GH #1277 — has this persona ever been INSTANTIATED (its store built at least once, seed applied)?
 *  The probe is the seedVersion marker `personaStore` writes on first construction (persisted, so it
 *  survives reload) plus the session's own store cache (covers a storage-less environment). The Team
 *  pane's 'From catalog' section is exactly the presets for which this is still `false` — once
 *  instantiated a preset leaves the catalog read (the pane's dedup law) and is picked as a live agent. */
export function personaInstantiated(id: string): boolean {
  return storeCache.has(id) || rosterSource.seedVersionSync(id) !== undefined
}

/** A shipped persona's store over its seed plus its persisted overlay (T-0161, agent-content SPEC ACS-R6
 *  and ACS-R7). Three starting states:
 *  - an overlay exists: merge it onto the current seed (`rebaseOverlay`, a no-op when the seed is the
 *    same), so a seed bump keeps every user edit and flags a field both sides changed `seedChanged`;
 *  - today's pre-overlay shape (full per-key copies) at the CURRENT version: diff the copies against the
 *    seed into an overlay, then drop the copies (the one-time migration);
 *  - those copies at an OLDER version: the seed they were written against is not in the registry, only its
 *    field digests where the history table recorded them (T-0355, `site/agent-content/seed-history.ts`). A
 *    stored value whose digest is one the stored version lists is untouched and takes the new seed; every
 *    other differing value may be a user edit, so it is kept, flagged `seedChanged`. A copy with no version
 *    marker gets no digests (its version is unknown), so all of its differing values are kept flagged.
 *  The sweep-before-hydrate ordering leans on the storage tier's same-tick writes (agent-roster-source.ts's
 *  own stated law). */
function overlayStoreFor(persona: Persona): OverlayStore {
  const { id, seed } = persona
  const wanted = persona.seedVersion ?? 1
  let overlay = rosterSource.overlaySync(id)
  if (overlay !== undefined) {
    const merged = rebaseOverlay(overlay, seed, id, wanted)
    if (merged !== overlay) rosterSource.writeOverlaySync(id, merged)
    overlay = merged
  } else {
    const legacy = rosterSource.legacyStateSync(id)
    // No marker means the copy's version is unknown: still an older-version copy for the flagging, but no
    // version's digests apply, so every differing value is kept and flagged (T-0355).
    const marker = rosterSource.seedVersionSync(id)
    const persisted = marker ?? 1
    const baseDigests = marker === undefined ? undefined : seedDigestsAt(id, marker)
    overlay = diffOverlay(id, wanted, seed, legacy, { baseUnknown: persisted < wanted, ...(baseDigests === undefined ? {} : { baseDigests }) })
    if (Object.keys(legacy).length > 0) {
      rosterSource.dropLegacyStateSync(id)
      rosterSource.writeOverlaySync(id, overlay)
    }
  }
  rosterSource.writeSeedVersionSync(id, wanted)
  return createOverlayStore({ seed, overlay, persist: (next) => rosterSource.writeOverlaySync(id, next) })
}

/** T-0162 (ACS-R8): a whole-record store answers one provenance for every place: how the record was
 *  minted. A blank agent's values are the user's from the start; a record minted before T-0162 recorded no
 *  origin and reads `imported`. No seed sits under it, so it offers no reset and no diff. */
function withRecordProvenance(store: SettingsStore, persona: Persona): SettingsStore & ProvenanceReader {
  const provenance: Provenance = persona.origin === 'duplicate' ? 'duplicate' : persona.origin === 'new' ? 'user' : 'imported'
  return Object.assign(store, { provenance: (): Provenance => provenance })
}

/** The persona's store, cached per id so switching away and back keeps one live instance. A shipped
 *  persona reads seed plus overlay (`overlayStoreFor`); an imported or duplicated one is a full record
 *  (its seed IS the user's), so its own persisted keys win over that seed, memory-store.ts's parity law. */
export function personaStore(persona: Persona): SettingsStore {
  let store = storeCache.get(persona.id)
  if (!store) {
    if (persona.imported === true) {
      rosterSource.writeSeedVersionSync(persona.id, persona.seedVersion ?? 1)
      store = withRecordProvenance(createMemoryStore({ initial: persona.seed, persistKey: persistKeyFor(persona.id) }), persona)
    } else store = overlayStoreFor(persona)
    // GH #921 — bump the modified-at marker on every REAL write (never on construction itself — a fresh
    // store's seed read is not an edit). `subscribe` is optional on `SettingsStore`; both store kinds
    // implement it, but the guard keeps this inert against a hypothetical future store shape that doesn't.
    store.subscribe?.(() => rosterSource.bumpModifiedAtSync(persona.id))
    storeCache.set(persona.id, store)
  }
  return store
}

/** The overlay store of a shipped persona, or `undefined` for an imported one (no overlay). */
function overlayStore(persona: Persona): OverlayStore | undefined {
  if (persona.imported === true) return undefined
  return personaStore(persona) as OverlayStore
}

/** Every place a user changed on a shipped persona, conflicts with both values (the per-field
 *  "modified" state, T-0161 for T-0162). Empty for an imported persona: it has no seed to differ from. */
export function personaModified(persona: Persona): OverlayPath[] {
  return overlayStore(persona)?.modified() ?? []
}

/** Return one place (a key, an entry, or one entry field) of a shipped persona to its seed. The whole
 *  agent's reset stays `resetPersona`. */
export function resetPersonaField(persona: Persona, address: OverlayAddress): void {
  overlayStore(persona)?.reset(address)
}

/** Test seam: drop the cached store without touching storage, so the next `personaStore` reads storage
 *  again as a reload would. */
export function __testEvictPersonaStore(id: string): void {
  storeCache.delete(id)
}

/** Reset a persona to its seed: drop every persisted key under its namespace (including keys the
 *  user's own edits minted) + the cached store, so the next `personaStore` rebuilds from the pure seed.
 *  For an IMPORTED persona the seed IS the imported file's state — reset returns it to exactly what was
 *  imported, the same "back to how it shipped" semantic a preset gets. The active-id record lives
 *  OUTSIDE any persona namespace, so the sweep can never take it (the page's own fallback rule). */
export function resetPersona(persona: Persona): void {
  rosterSource.resetStateSync(persona.id)
  storeCache.delete(persona.id)
}

export function presetStore(preset: AgentPreset): SettingsStore {
  return personaStore(personaFromPreset(preset))
}

export function resetPreset(preset: AgentPreset): void {
  resetPersona(personaFromPreset(preset))
}

// ── the imported-persona library (GH #406) ────────────────────────────────────────────────────────────
// Imported personas are ROSTER data, so they persist as one storage record (metadata + seed), NOT
// as a store: their store is minted from that seed by `personaStore` exactly like a preset's, which is
// what makes an imported persona survive a reload — the roster record restores WHAT the persona is, and
// its own `agent-admin-app.<id>.*` keys restore the edits made since.
//
// The rehydration law, stated exactly (memory-store.ts): a persisted value wins over the seed for every
// key the NAMESPACE holds — construction scans `agent-admin-app.<id>.*` wholesale, so a key first written
// AFTER the import (say a master switch the source persona had never touched) rehydrates exactly like a
// seeded one. GH #409 fixed that: the loop used to iterate the SEED's own keys, which made the seed a
// hidden allowlist — Surface Options and the capability master switches (no preset seed carries them, and
// neither does an export taken before they were ever touched) persisted on write and vanished on reload.

/** The persisted imported personas, fail-closed: a corrupt/foreign record reads as an EMPTY library
 *  (never a throw at page boot — a broken record must not take the whole admin page down with it).
 *  The record itself (and its raw key) lives in the roster source (ADR-0227 wave 1). */
export function loadImportedPersonas(): Persona[] {
  return rosterSource.importedSync()
}

/** Append one imported persona to the persisted library (last-write-wins on a same-id record — ids are
 *  minted collision-safe against the live roster, so this is a defensive dedupe, not a merge policy). */
export function saveImportedPersona(persona: Persona): void {
  rosterSource.upsertImportedSync(persona)
}

// ── roster management: order · delete · rename (GH #845, LLD-C11/C12/C13) ─────────────────────────────
// The three verbs the Edit Agents drawer needs that the library record alone cannot express. All three are
// PAGE-OWNED persistence detail (the drawer itself is page composition, agent-admin-app.ts) — nothing here
// changes what a persona IS, only which ones exist, what they are called, and in what order they are shown.
//
// PRESET PROTECTION IS STRUCTURAL, twice over: the page never renders a delete/rename affordance for a
// shipped preset, and both functions ALSO guard on `imported === true` and return `false` — defense in
// depth, so a future caller (or a hand-crafted `Persona` object) can never sweep a shipped preset's keys.

/** The persisted order, fail-closed: a corrupt/foreign record reads as NO order (⇒ the natural order),
 *  never a throw at page boot. Why an ORDER ARRAY rather than an index on the library record: a
 *  record-side order cannot order PRESETS relative to imported entries (presets never live in the
 *  library record), and the drawer reorders the WHOLE roster. The record lives OUTSIDE any
 *  `agent-admin-app.<id>.` namespace, so `resetPersona`'s prefix sweep can never take it with it. */
export function loadRosterOrder(): string[] {
  return rosterSource.orderSync()
}

/** Persist the display order (ids, in display order). Ids that no longer resolve are harmless — the read
 *  side skips them (`personaRoster`), so a ghost can never resurrect a deleted persona. */
export function saveRosterOrder(ids: readonly string[]): void {
  rosterSource.saveOrderSync(ids)
}

/** The full roster the page offers: the shipped presets first, then the imported library in import order —
 *  THEN the persisted display order applied on top (GH #845, LLD-C11/§8a). The order rule itself is the
 *  source module's `applyRosterOrder` (one choke point, reused by the page's optimistic commits too);
 *  the records are read FRESH on every call — the page rebuilds nothing else when an import lands. */
export function personaRoster(): Persona[] {
  return rosterSource.listSync()
}

/** Delete an IMPORTED persona — the roster record, every persisted key it owns, and its slot in the order
 *  array (GH #845, LLD-C12/§8b). Returns `false` (and touches NOTHING) for a shipped preset. The sweep,
 *  the record rewrite, and the order-slot removal live in the source (`removeImportedSync`), whose
 *  `onRemove` seam also evicts this page's cached store instance in the same motion. The active-id
 *  record is deliberately NOT this function's concern — the page's own fallback rewrites it. */
export function deleteImportedPersona(persona: Persona): boolean {
  return rosterSource.removeImportedSync(persona)
}

/** Rename an IMPORTED persona — DISPLAY ONLY, ids stay stable (GH #845, LLD-C13/§8c; the GH #848 rename
 *  law). Returns `false` (and touches nothing) for a preset, a blank label, or an id no library record
 *  answers to. The record is re-read LIVE and rewritten IN PLACE (never append-after-filter, which would
 *  reorder the picker) — the ported law lives in the source's `renameImportedSync`. */
export function renameImportedPersona(persona: Persona, label: string): boolean {
  return rosterSource.renameImportedSync(persona, label)
}

// ── the Builder (ADR-0178 cl.4 / LLD-C7, GH #633) ─────────────────────────────────────────────────────
// The host-authored interviewer behind "New agent → Generate": it asks the user what they want, and
// declares what it learns as `personaPatch` meta-line arms that the admin applies to the DRAFT through
// ADR-0178 cl.2's three-filter gate.
//
// DELIBERATELY NOT IN `AGENT_PRESETS`/`personaRoster()` (OF4's recommendation, adopted as the default):
// hidden-until-invoked. The roster is a SHOWCASE of personas a user picks between; the Builder is
// machinery the flow arms for them. Its agent.md says `"roster": false`; reversing this is that one line
// (plus an `order`) if it ever earns a row.
//
// Its store is a FRESH overlay store per flow entry (`createOverlayStore` over an empty overlay, T-0161)
// with NO `persist`: nothing user-editable reaches the Builder (no pane binds it; the panes all bind the
// DRAFT), so persisting it could only accumulate drift against host-authored config, never preserve a
// user's work.

/** The interview craft (`site/agent-content/personas/builder/agent.md`) — CONFIG, like every other
 *  persona's prompt content. What it must NOT carry is
 *  the `personaPatch` WIRE MECHANICS: those compose from S2's byte-pinned `authoring-teaching.md` under
 *  the authoring gate (ADR-0178 cl.1 rule 5). The boundary holds because garbled VOCABULARY degrades to
 *  dropped keys (filter 1, fail-closed, recoverable in the next turn), whereas garbled MECHANICS would
 *  be unrecoverable — which is exactly why mechanics stay host-owned and byte-pinned, and only
 *  vocabulary may be config. */
const BUILDER_PRESET: AgentPreset = presetFromRecord(personaRecord('builder'))

/** The GENERATED key-vocabulary section (LLD §2's fork row) — composed at mint time from
 *  `persona-patch.ts`'s canonical exports, never hand-listed. SPEC-R29 makes the producer
 *  persona-key-agnostic, so this vocabulary can only reach the model from the host side; generating it
 *  from the SAME module the apply gate enumerates is what keeps the two from drifting. */
function vocabularySection(): Entry {
  const roster = modelRoster()
    .map((m) => m.id)
    .join(', ')
  const values = PERSONA_VALUE_KEYS.map((key) => `- \`${key}\` — ${(PATCHABLE_VALUE_SHAPES[key] ?? '').replace('{roster}', roster)}`).join('\n')
  const entries = PERSONA_ENTRY_LIST_KEYS.map((key) => `- \`${key}\``).join('\n')
  // ADR-0178's ratified amendment (GH #696) — WHICH sections are replaceable, and what each is for, is
  // VOCABULARY (the mechanics of how a replacement is expressed stay in the byte-pinned teaching, cl.1
  // rule 5). Generated from `DEFAULT_PROMPT_SECTIONS` itself: a hand-listed trio would teach an id the
  // apply gate no longer recognizes the moment the seed changed, which is the exact drift this whole
  // section is generated to avoid.
  const builtinSections = DEFAULT_PROMPT_SECTIONS.map((s) => `- \`${s.id}\` — **${s.label}**: ${s.description}`).join('\n')
  const promptSectionKey = entriesStoreKey(ENTRY_KINDS.promptSection)
  // The worked example names the LEADING seeded section, read off the seed — never a literal id, and never a
  // literal fallback id either: an empty string here would REDDEN the drift gate, which is what a broken seed
  // should do rather than quietly teaching a plausible-looking id the gate would drop.
  const lead = DEFAULT_PROMPT_SECTIONS[0]
  return {
    id: 'patchable-keys',
    kind: ENTRY_KINDS.promptSection,
    label: 'Draft keys you may set',
    description: 'The draft agent’s own configuration keys, generated from the host’s apply gate.',
    content:
      'These are the ONLY keys of the draft agent you may set. Anything else is dropped silently, so ' +
      'sending it just wastes the turn.\n\n' +
      `## Single values\n\n${values}\n\n` +
      `## Lists you may APPEND to\n\n${entries}\n\n` +
      'Each list member is an object with a `label` (required) and optional `description`/`content`.\n\n' +
      `## Built-in sections you may REPLACE\n\n${builtinSections}\n\n` +
      'The draft starts with these sections already holding generic placeholder text nobody wrote. ' +
      'Fill them in — that is what makes the agent’s own identity lead its prompt instead of sitting ' +
      'underneath boilerplate. Send the section’s `id` and the new `content` on the ' +
      `\`${promptSectionKey}\` list, and it replaces that section’s text in place. For example, writing the ` +
      `agent’s own role into its ${lead?.label ?? ''} section:\n\n` +
      `    {"entries":{"${promptSectionKey}":[{"id":"${lead?.id ?? ''}","content":"You are Casey, a restaurant ` +
      'concierge for the guests of one hotel. You find them a table, book it, and tell them plainly when ' +
      'you cannot."}]}}\n\n' +
      'Everything else about lists is unchanged: appending is the only other thing you can do to one, and ' +
      'you can never remove anything or empty a built-in section. A user’s own authored entries are safe ' +
      'from you by construction; the placeholder scaffolding the draft ships with is yours to fill in.',
    order: 99, // last — the reference material reads after the craft
    enabled: true,
    builtin: false,
  }
}

/** T-0447, the Builder's edit-session craft: how to change an agent that already exists. Code-authored
 *  beside `vocabularySection()` (a persona body carries only `PERSONA_SECTIONS`), seeded DISABLED so the
 *  generate interview composes byte-identically; `builderStore(model, 'edit')` turns it on. */
export function editSessionSection(): Entry {
  return {
    id: 'edit-session',
    kind: ENTRY_KINDS.promptSection,
    label: 'Edit session',
    description: 'How to change an agent that already exists. On only in an edit session.',
    content:
      'This session edits an agent that already exists. The configuration headed "The draft agent\'s current ' +
      'configuration" is that agent as it stands now, not a new draft: nothing is missing from it, so do not ' +
      'interview for more. Every change you send lands on it at once, and the user can undo each turn\'s ' +
      'change from its receipt.\n\n' +
      '- Change only what the user asked for in this message. Never re-send a value or a section the request ' +
      'did not touch, even to restate it.\n' +
      '- Read the current value before you change it, and keep the parts of it the request did not mention.\n' +
      '- Before you replace the whole text of a built-in section or switch the model, say in one sentence what ' +
      'you will change and ask the user to confirm. Send the change on the next turn, once they agree.\n' +
      '- Never declare a team here. If the user wants a brand-new agent, tell them to use New agent in the ' +
      'agent picker; this session cannot create one.\n' +
      '- When the request is unclear, ask one short question instead of guessing.\n' +
      '- After a change, say in one sentence what you changed.',
    order: 98,
    enabled: false,
    builtin: false,
  }
}

/** The Builder as a `Persona` — same shape the roster uses, just never IN the roster. */
export function builderPersona(): Persona {
  const seed = presetSeed(BUILDER_PRESET)
  const sections = [...(seed[entriesStoreKey(ENTRY_KINDS.promptSection)] as Entry[]), vocabularySection(), editSessionSection()]
  return {
    id: 'builder',
    label: BUILDER_PRESET.label,
    tagline: BUILDER_PRESET.tagline,
    seed: {
      ...seed,
      [entriesStoreKey(ENTRY_KINDS.promptSection)]: sections,
      // The point of the whole persona: its own turns are taught the personaPatch arm (SPEC-R30).
      [SURFACE_AUTHORING_KEY]: true,
      // ADR-0097's shipped machinery is how an interview question becomes something clickable — the
      // ask arm rides an ordinary A2UI surface through `ingestLine`, so zero new question mechanics.
      [SURFACE_A2UI_KEY]: true,
    },
  }
}

/** A FRESH store per flow entry: no `persist`, no cache (see this section's header for why).
 *
 *  GH #670 — `model` is the Co-pilot card's PRE-ARM pick, folded into the seed rather than written after the
 *  fact: the interview's own config read then finds the user's choice already committed, so the pick wins by
 *  construction and there is no overwrite step to lose a race with. Absent ⇒ the Builder preset's own
 *  Sonnet-class id stands (LLD §15: interview quality is the product). */
export function builderStore(model?: string, mode: 'generate' | 'edit' = 'generate'): SettingsStore {
  const persona = builderPersona().seed
  // T-0447, an edit session turns the seeded-off edit-session craft on; generate keeps the seed as is.
  const sectionsKey = entriesStoreKey(ENTRY_KINDS.promptSection)
  const base =
    mode === 'edit'
      ? { ...persona, [sectionsKey]: (persona[sectionsKey] as Entry[]).map((e) => (e.id === 'edit-session' ? { ...e, enabled: true } : e)) }
      : persona
  const seed = model === undefined ? base : { ...base, model }
  // The same seed-plus-overlay read every persona store has (T-0161), with nothing persisted.
  return createOverlayStore({ seed, overlay: emptyOverlay('builder', 1, seed) })
}
