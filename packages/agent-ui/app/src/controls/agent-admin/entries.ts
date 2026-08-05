// entries.ts — the generic ordered-entry-list PRIMITIVE (ADR-0132 `n1`): a named, ordered, toggleable
// entry within a typed list, parameterized by `kind`. Types + pure data/logic only (the schema.ts
// precedent) — `entry-list.ts` owns the rendering, `agent-admin.ts` owns the composition.
//
// Five instantiations share this ONE shape (ADR-0132 cl.1): prompt sections (kind='prompt-section',
// seeded with three built-in entries — Foundation/Personality/Critical Items) and four capability kinds
// (skill/workflow/resource/tool — their STORES start empty; entries arrive hand-authored, or since
// GH #47/#48 from an opt-in-per-add library pack (`EntryLibraryPack` below) — still never an automatic
// initial seed). A future kind is a new `ENTRY_KINDS` member + optional seed data — never new
// list/toggle/author code (ADR-0132 cl.1/Fork 2: the taxonomy is extensible, not a hardcoded enum).
//
// Custom-entry depth is DELIBERATELY generic (ADR-0132 Fork 3): label + description + free-text content,
// uniform across every kind. A kind-specific schema (e.g. a Tool's parameter list) is an explicitly
// deferred, separately-scoped future extension — not built here.

import { A2UI_CATALOG_KEY, A2UI_CATALOG_OPTIONS, DEFAULT_A2UI_CATALOG_ID, sanitizeCatalog } from './agent-admin-schema.ts'

/** The known kinds this build seeds/instantiates. Not a closed enum — `Entry.kind` is a plain `string`
 *  (ADR-0132 Fork 2: extensible without a code change); these are the five known constants, not an
 *  exhaustive union type. */
export const ENTRY_KINDS = {
  promptSection: 'prompt-section',
  skill: 'skill',
  workflow: 'workflow',
  resource: 'resource',
  tool: 'tool',
  // genui-surface.spec.md SPEC-R11 (D3/D4) — the GenUI pattern-source picker's data-level kind: reuses
  // this SAME generic entry-list primitive (no new list/toggle/author code) rather than inventing a
  // bespoke picker. D3 rules SOURCE-level pick (never per-pattern multi-select): unlike the four
  // capability kinds above, where every ENABLED entry composes, `agent-admin.ts` reads only the FIRST
  // enabled `pattern-source` entry (by `order`) as the turn's picked source — enabling more than one is
  // never an error, just a no-op past the first (a defensive degrade, never a UI-level constraint).
  patternSource: 'pattern-source',
  // ADR-0170 cl.1 — the A2UI catalog LIBRARY: the family's first SINGLE-select kind, and the first whose
  // selection truth lives OUTSIDE this store. The entries record MEMBERSHIP (which registered catalogs
  // this persona has on its shelf); the ONE selection is `A2UI_CATALOG_KEY`, and every switch's checked
  // state DERIVES from it at read time (`readCatalogEntries` below) — the per-entry `enabled` flag is
  // never the selection truth for this kind, so no store state can make the section disagree with the
  // `catalogId` the runner actually threads (cl.2's second-writer defect, closed by construction).
  catalog: 'catalog',
} as const

export interface Entry {
  id: string
  kind: string
  label: string
  description: string
  content: string
  /** Ascending sort order within its kind — ties broken by `id` (stable, deterministic). */
  order: number
  /** Toggle state — a disabled entry is skipped by `composeSystemPrompt` and by any future capability
   *  consumer, but is NEVER removed from the list (ADR-0132 Fork 4). */
  enabled: boolean
  /** A built-in entry can be toggled but never deleted (ADR-0132 Fork 4) — enforced by the UI
   *  (`entry-list.ts` renders no delete affordance for `builtin: true`), not by this module. */
  builtin: boolean
}

/** The store key one kind's entry list lives under — `entries:${kind}`, one array value per kind (the
 *  `SettingsStore` `get`/`set` contract already handles arbitrary JSON-serializable `unknown` values). */
export function entriesStoreKey(kind: string): string {
  return `entries:${kind}`
}

/** The three built-in, non-deletable, toggle-on-by-default prompt sections (ADR-0132 cl.2). Order is the
 *  composition order `composeSystemPrompt` reads. */
export const DEFAULT_PROMPT_SECTIONS: readonly Entry[] = [
  {
    id: 'foundation',
    kind: ENTRY_KINDS.promptSection,
    label: 'Foundation',
    description: 'Core role and capabilities — who this agent is and what it does.',
    content: 'You are a helpful assistant.',
    order: 0,
    enabled: true,
    builtin: true,
  },
  {
    id: 'personality',
    kind: ENTRY_KINDS.promptSection,
    label: 'Personality',
    description: 'Tone and voice — how this agent communicates.',
    content: 'Be concise and direct. Prefer plain language over jargon, and get to the useful answer without unnecessary hedging or filler.',
    order: 1,
    enabled: true,
    builtin: true,
  },
  {
    id: 'critical-items',
    kind: ENTRY_KINDS.promptSection,
    label: 'Critical Items',
    description: 'Hard constraints and must-follow rules.',
    content: 'Never fabricate information. Ask a clarifying question when a request is ambiguous rather than guessing. Respect user privacy and never share sensitive data.',
    order: 2,
    enabled: true,
    builtin: true,
  },
]

/** Every store key + its seed value `initialValuesFor` (agent-admin-schema.ts) needs to fold in, so a
 *  fresh default store's localStorage read-back actually works for entries too (the same CRITICAL fix
 *  `agent-admin-schema.ts`'s own `initialValuesFor` applies to the flat schema fields). Capability kinds
 *  seed to an empty array — nothing to seed without a real backend. */
export function initialEntryValues(): Record<string, unknown> {
  return {
    [entriesStoreKey(ENTRY_KINDS.promptSection)]: DEFAULT_PROMPT_SECTIONS,
    [entriesStoreKey(ENTRY_KINDS.skill)]: [],
    [entriesStoreKey(ENTRY_KINDS.workflow)]: [],
    [entriesStoreKey(ENTRY_KINDS.resource)]: [],
    [entriesStoreKey(ENTRY_KINDS.tool)]: [],
    [entriesStoreKey(ENTRY_KINDS.patternSource)]: [],
    // ADR-0170 cl.1 — an empty ROSTER seed, like every other capability kind. The Default catalog row is
    // NOT seeded here: it is guaranteed at READ time (`readCatalogEntries`), which covers a fresh store
    // and a pre-existing persona whose localStorage never carried this key alike — no migration write.
    [entriesStoreKey(ENTRY_KINDS.catalog)]: [],
  }
}

/** genui-surface.spec.md SPEC-R11 (D3) — the single-pick projection: the FIRST enabled `pattern-source`
 *  entry by `order` (ties by `id`, the `composeSystemPrompt` sort law), or `undefined` when none is
 *  enabled. A source-level pick, never a per-pattern multi-select — an admin who enables more than one is
 *  never rejected, the rest are just never read (SPEC-R10's degradation law: no source picked ⇒ the base
 *  genui teaching block alone, the modality still works). */
export function pickedPatternSource(entries: readonly Entry[]): Entry | undefined {
  return [...entries]
    .filter((e) => e.enabled)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))[0]
}

/** Read one kind's entry list from a store, defensively: a bring-your-own store, a corrupt/foreign
 *  localStorage value, or a store that never seeded this key all degrade to an empty list, never throw. */
export function readEntries(store: { get(key: string): unknown } | undefined, kind: string): Entry[] {
  const raw = store?.get(entriesStoreKey(kind))
  return Array.isArray(raw) ? (raw as Entry[]) : []
}

// ── the catalog roster projection (ADR-0170 cl.2/cl.4) ─────────────────────────────────────────────────

/** The ensured Default roster row — `builtin: true` (toggleable, never deletable, ADR-0132 Fork 4), its
 *  label AND description read from the registry (`A2UI_CATALOG_OPTIONS`), never hardcoded: the ensured row
 *  and the same catalog added from the library pack therefore read identically. `order: -1` sorts it
 *  FIRST: every stored row's order comes from `validateNewEntry`'s `maxOrder + 1` over the RAW store,
 *  which starts at 0 and never contains this projection-only row. */
function defaultCatalogEntry(): Entry {
  const option = A2UI_CATALOG_OPTIONS.find((o) => o.id === DEFAULT_A2UI_CATALOG_ID)
  return {
    id: DEFAULT_A2UI_CATALOG_ID,
    kind: ENTRY_KINDS.catalog,
    label: option?.label ?? DEFAULT_A2UI_CATALOG_ID,
    description: option?.description ?? '',
    content: '',
    order: -1,
    enabled: false, // overridden by the derivation below — stated only to satisfy the Entry shape
    builtin: true,
  }
}

/**
 * The catalog kind's read-time projection (ADR-0170 cl.2/cl.4) — PURE: it reads, it never writes.
 *
 * Two guarantees, both derived rather than stored:
 *  1. **The Default row is always present.** A store whose `entries:catalog` roster lacks it (a fresh
 *     store, or a persona whose localStorage predates this kind) gets it prepended as a builtin — a
 *     read-time guarantee, never a migration write. A roster that already carries a real `agent-ui` row
 *     (added from the library pack) keeps that row exactly as stored, dedup-free.
 *  2. **Exactly one entry is enabled.** Every row's `enabled` is REPLACED by
 *     `id === sanitizeCatalog(store.get(A2UI_CATALOG_KEY))` — the same fail-closed read expression every
 *     wire site uses. The stored per-entry flags are dead weight for this kind (cl.2): drift between the
 *     roster and the threaded `catalogId` is structurally impossible, and an unregistered row (a
 *     dedup-suffixed duplicate) can never derive to ON, since `sanitizeCatalog` never returns its id.
 */
export function readCatalogEntries(store: { get(key: string): unknown } | undefined): Entry[] {
  const roster = readEntries(store, ENTRY_KINDS.catalog)
  const withDefault = roster.some((e) => e.id === DEFAULT_A2UI_CATALOG_ID) ? roster : [defaultCatalogEntry(), ...roster]
  const active = sanitizeCatalog(store?.get(A2UI_CATALOG_KEY))
  return withDefault.map((entry) => ({ ...entry, enabled: entry.id === active }))
}

/** ADR-0170 cl.3 — `true` iff `id` names a catalog the registry actually carries. The ONE membership
 *  expression the section's handlers share (never a second registry): an unregistered id is refusable
 *  VISIBLY (no write, the re-render snaps the switch back) instead of being silently coerced to the
 *  default by `sanitizeCatalog` on the next read. */
export function isRegisteredCatalog(id: string): boolean {
  return A2UI_CATALOG_OPTIONS.some((option) => option.id === id)
}

/** Compose the ONE final system-prompt string from the ENABLED prompt-section entries, in `order`
 *  (ADR-0132 cl.2/cl.6) — the live-apply mechanism itself, same "fresh read at turn time" law the rest
 *  of this build already follows. A labeled block per section (never bare-concatenated) keeps the
 *  composed prompt legible when more than one section carries real content. Falls back to
 *  `DEFAULT_SYSTEM_PROMPT_FALLBACK` if every section is disabled or empty (fail-closed: never an empty
 *  instruction reaching the stub reply, the `DEFAULT_SYSTEM_PROMPT` law generalized to N sections). */
export const DEFAULT_SYSTEM_PROMPT_FALLBACK = 'You are a helpful assistant.'

export function composeSystemPrompt(sections: readonly Entry[]): string {
  const blocks = [...sections]
    .filter((s) => s.enabled && s.content.trim().length > 0)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((s) => `## ${s.label}\n${s.content.trim()}`)
  return blocks.length > 0 ? blocks.join('\n\n') : DEFAULT_SYSTEM_PROMPT_FALLBACK
}

// ── The live system-prompt projection (ALM-C1, TKT-0052/ADR-0136 Fork 3) ───────────────────────────────
// The DEV-only live turn's system prompt IS `composeSystemPrompt`'s output with every ENABLED capability
// entry projected after it as labeled prose (LLD Q2). ADR-0132 Fork 3 made entries generic prose — label +
// description + free-text content, NO parameter schema — so there is nothing machine-callable to declare as
// API `tools`; system-prompt projection is the maximal FAITHFUL wire representation of what the user
// authored (the model genuinely receives every enabled entry, so a capability edit changes the very next
// live reply). A real tool-execution loop stays a future, separately-decomposed feature (ADR-0132's own
// named deferral — it needs parameter schemas first).

/** One capability kind's contribution to the live prompt: its `##` group heading + its entries (this
 *  function does the enabled-filter/sort/tools-gate itself, so the caller just hands over each kind's raw
 *  store slice). */
export interface LiveCapabilityGroup {
  kind: string
  /** The `## {heading}` group header (e.g. "Skills available to you"). */
  heading: string
  entries: readonly Entry[]
  /** The kind's MASTER switch (vision rev.5 — every capability section's header toggle, generalizing
   *  the old tools-only boolean): `false` gates the WHOLE kind out, winning over per-entry toggles. */
  enabled: boolean
}

/**
 * The live system prompt: `composeSystemPrompt(sections)` followed by one `## {heading}` block per
 * capability kind that has ≥1 enabled entry, each enabled entry rendered as `### {label}` + its
 * description + its content, in `order` (ties by `id`, the composeSystemPrompt law). A group whose
 * `enabled` master switch is `false` is gated out wholesale (vision rev.5 generalized the old tools-only
 * `toolsEnabled` boolean to EVERY kind's section-header switch — the master wins over per-entry toggles).
 * GATED EQUIVALENCE (ADR-0136 Fork 3): with no enabled capability entries the result is byte-identical
 * to `composeSystemPrompt(sections)` — the live prompt degrades exactly to today's composed prompt,
 * never a trailing empty header.
 */
export function composeLiveSystemPrompt(
  sections: readonly Entry[],
  capabilities: readonly LiveCapabilityGroup[],
): string {
  const base = composeSystemPrompt(sections)
  const groups: string[] = []
  for (const group of capabilities) {
    if (!group.enabled) continue // the kind's master switch gates the whole group out
    const enabled = [...group.entries]
      .filter((e) => e.enabled)
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    if (enabled.length === 0) continue // a kind with nothing enabled contributes no header
    const blocks = enabled.map((e) => {
      const lines = [`### ${e.label}`]
      if (e.description.trim().length > 0) lines.push(e.description.trim())
      if (e.content.trim().length > 0) lines.push('', e.content.trim())
      return lines.join('\n')
    })
    groups.push(`## ${group.heading}\n${blocks.join('\n\n')}`)
  }
  return groups.length > 0 ? `${base}\n\n${groups.join('\n\n')}` : base
}

/** A slug id from a label — lowercase, non-alphanumeric runs collapsed to one hyphen, trimmed. Falls
 *  back to `entry` if the label is entirely non-alphanumeric (e.g. all emoji/punctuation) — never an
 *  empty id. */
function slugify(label: string): string {
  const slug = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug.length > 0 ? slug : 'entry'
}

export interface NewEntryInput {
  label: string
  description: string
  content: string
  /** ADR-0168 cl.2 / LLD-C7 — an OPTIONAL stable id that wins over the `slugify(label)` default. A pack
   *  whose entries key an EXTERNAL vocabulary (the Integrations pack: its entries ARE the dev proxy's
   *  registry ids) supplies it, so the id survives a label edit and the display label is free to be human
   *  text — the three-facts law (id ≠ tool.name ≠ label) reaching the admin store. Every hand-authored
   *  entry and every pack that omits it keeps slugify-from-label EXACTLY as before; collision dedup (the
   *  suffix counter below) applies to an explicit id the same as a slugged one. */
  id?: string
}

// ── Entry libraries (GH #47/#48) — packs of ready-to-add entries ────────────────────────────────────────
// A library pack is pure DATA (the ADR-0132 cl.1 law: a capability surface grows by data, never by new
// list/toggle/author code): a named collection of `NewEntryInput`s for ONE kind, offered by the entry
// list's add-from-library affordance and committed through the SAME `validateNewEntry` path as a
// hand-authored entry (slug-dedup, order, enabled, deletable — a library add IS a custom add with the
// typing done). Packs live with their consumer (page-local, the presets precedent); the component only
// renders whatever packs it is handed.
export interface EntryLibraryPack {
  /** Stable kebab id — unique within the kind's pack list. */
  id: string
  /** Display name ("A2UI composition idioms", "Hospitality"). */
  label: string
  /** One-line pack description (menu row tooltip). */
  description: string
  /** Ready-to-add entry inputs, in menu order. */
  entries: readonly NewEntryInput[]
}

export type ValidateNewEntryResult = { ok: true; entry: Entry } | { ok: false; error: string }

/** Fail-closed validation for a new custom entry (ADR-0132 cl.4): a required, non-empty `label`, and an
 *  id that doesn't collide with an existing entry of the SAME kind (a suffix counter resolves a
 *  collision rather than rejecting it outright — a friendlier failure mode than forcing the author to
 *  rename). The id is `input.id` when the caller supplies one (LLD-C7: a pack keying an external
 *  vocabulary), else `slugify(label)` exactly as before. Never mutates `existing`. */
export function validateNewEntry(existing: readonly Entry[], kind: string, input: NewEntryInput): ValidateNewEntryResult {
  const label = input.label.trim()
  if (label.length === 0) return { ok: false, error: 'A name is required.' }

  // An explicit id is trimmed but NEVER slugged — it is a foreign key (a registry id), so mangling it
  // would be the very coupling this widening exists to break. An empty/blank one falls back to the slug.
  const base = input.id?.trim() ? input.id.trim() : slugify(label)
  const usedIds = new Set(existing.map((e) => e.id))
  let id = base
  let suffix = 2
  while (usedIds.has(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }

  const maxOrder = existing.reduce((max, e) => Math.max(max, e.order), -1)
  return {
    ok: true,
    entry: {
      id,
      kind,
      label,
      description: input.description.trim(),
      content: input.content,
      order: maxOrder + 1,
      enabled: true,
      builtin: false,
    },
  }
}
