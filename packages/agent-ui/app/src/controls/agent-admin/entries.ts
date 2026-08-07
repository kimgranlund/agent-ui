// entries.ts — the agent-admin DOMAIN layer over the generic ordered-entry-list primitive (ADR-0132 `n1`):
// the kind taxonomy, seeded defaults, and the system-prompt projection. The generic data CORE (`Entry`,
// `NewEntryInput`, `EntryLibraryPack`, `ValidateNewEntryResult`, `validateNewEntry`, `entriesStoreKey`,
// `readEntries`) moved to `../entry-list/entry-data.ts` (ADR-0164 cl.2) — `entry-list.ts` owns the
// rendering, this module owns the composition this consumer's kinds need.
//
// Five instantiations share the core's ONE shape (ADR-0132 cl.1): prompt sections (kind='prompt-section',
// seeded with three built-in entries — Foundation/Personality/Critical Items) and four capability kinds
// (skill/workflow/resource/tool — their STORES start empty; entries arrive hand-authored, or since
// GH #47/#48 from an opt-in-per-add library pack (`EntryLibraryPack`) — still never an automatic
// initial seed). A future kind is a new `ENTRY_KINDS` member + optional seed data — never new
// list/toggle/author code (ADR-0132 cl.1/Fork 2: the taxonomy is extensible, not a hardcoded enum).
//
// Custom-entry depth is DELIBERATELY generic (ADR-0132 Fork 3): label + description + free-text content,
// uniform across every kind. A kind-specific schema (e.g. a Tool's parameter list) is an explicitly
// deferred, separately-scoped future extension — not built here.

import { A2UI_CATALOG_KEY, A2UI_CATALOG_OPTIONS, DEFAULT_A2UI_CATALOG_ID, sanitizeCatalog } from './agent-admin-schema.ts'
import { entriesStoreKey, readEntries, type Entry } from '../entry-list/entry-data.ts'

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
 *
 * GH #525 (design call 1, 2026-08-07) — `bankroll`, when given, appends ONE terse line stating the
 * persona's current stored figure and that any game dealt this turn MUST seed `/bankroll` from it rather
 * than a fresh stake, right after the base prompt and ahead of the capability groups. `undefined` (every
 * call site's law: not opted in, or nothing stored yet) is the SAME gated equivalence — byte-identical to
 * the pre-#525 output.
 */
export function composeLiveSystemPrompt(
  sections: readonly Entry[],
  capabilities: readonly LiveCapabilityGroup[],
  bankroll?: number,
): string {
  const base = composeSystemPrompt(sections)
  const withBankroll =
    bankroll === undefined
      ? base
      : `${base}\n\nYour current bankroll is ${bankroll}. Any game you deal MUST seed /bankroll from this figure, never a fresh stake.`
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
  return groups.length > 0 ? `${withBankroll}\n\n${groups.join('\n\n')}` : withBankroll
}
