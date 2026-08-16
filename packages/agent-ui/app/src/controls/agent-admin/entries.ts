// entries.ts — the agent-admin DOMAIN layer over the generic ordered-entry-list primitive (ADR-0132 `n1`):
// the kind taxonomy, seeded defaults, the system-prompt projection, and — since GH #849 — the composer's
// reference rosters plus the send-time resolution they feed. The generic data CORE (`Entry`,
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
import { entriesStoreKey, isAmbient, readEntries, type Entry } from '../entry-list/entry-data.ts'
import type { CapabilityRow, ReferenceOption, TurnReference } from '../conversation/composer-options.ts'

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

/** GH #850 / capability-availability-tagging.spec.md SPEC-R1 — the FOUR capability kinds an AVAILABILITY
 *  mode (`Entry.availability`, in-context vs user-invocable) is defined for. The other kinds' selection
 *  semantics are their own (`prompt-section`'s composition order, `pattern-source`'s first-by-order pick,
 *  `catalog`'s derived single-select), so the field is inert on them: nothing branches on it there, and no
 *  section outside this set renders the mode control (`agent-admin.ts`'s `#makeSection`). Deliberately its
 *  own list rather than a filter over `CAPABILITY_KINDS` — that array's exclusions exist for a DIFFERENT
 *  reason (double-injection / wire-threaded selection), and folding two rules into one expression is how
 *  the next kind silently inherits the wrong one. */
export const AVAILABILITY_KINDS: readonly string[] = [ENTRY_KINDS.skill, ENTRY_KINDS.workflow, ENTRY_KINDS.resource, ENTRY_KINDS.tool]

/** `true` iff `kind` is one of the four kinds availability semantics are defined for (`AVAILABILITY_KINDS`). */
export function hasAvailabilityMode(kind: string): boolean {
  return AVAILABILITY_KINDS.includes(kind)
}

/** GH #848 — the kinds whose entry LABEL is free human display text, i.e. the kinds an operator may RENAME
 *  (`entry-list.ts`'s `rename` option, wired in `agent-admin.ts`'s `#makeSection`). The other three are
 *  excluded because their label is not display text at all: a `prompt-section` label IS the composed
 *  prompt's own `## {label}` heading (`composeSystemPrompt`), a `catalog` label mirrors the registry entry
 *  its id keys (ADR-0170 cl.1, read back through `readCatalogEntries`), and a `pattern-source` label names
 *  the pack its content came from.
 *
 *  Its OWN list, deliberately not `AVAILABILITY_KINDS` reused and not a filter over `CAPABILITY_KINDS` —
 *  the same reasoning `AVAILABILITY_KINDS` states above, applied once more: the three sets happen to
 *  coincide today, but each exists for a DIFFERENT reason (what may be reached ambiently · what may be
 *  renamed · what may be projected as prompt prose), and folding rules that merely agree today into one
 *  expression is how the next kind silently inherits the wrong one. A future kind opts into each rule it
 *  actually wants, one line at a time. */
export const RENAMABLE_KINDS: readonly string[] = [ENTRY_KINDS.skill, ENTRY_KINDS.workflow, ENTRY_KINDS.resource, ENTRY_KINDS.tool]

/** `true` iff `kind`'s entry labels are free human display text, i.e. renamable (`RENAMABLE_KINDS`). */
export function hasRenamableName(kind: string): boolean {
  return RENAMABLE_KINDS.includes(kind)
}

/** GH #917/GH #949 — the kinds whose per-entry CRUD routes through the Edit/Add DRAWER (`entry-list.ts`'s
 *  `entryDrawer` option) instead of inline row affordances. The original four (GH #917) were the ones whose
 *  rows carried the FULL cluster — the Invocable pill, Rename, Remove and an always-mounted content editor,
 *  plus a permanent dashed add-form under the list — which is the crowding the drawer exists to relieve.
 *  GH #949 widened the set to `prompt-section` and `pattern-source`: each carries neither the pill nor the
 *  rename pair, so they were never the crowded shape, but they DO carry a per-entry content editor and a
 *  Remove affordance (a non-builtin prompt section, any pattern-source entry) — the same drawer shape still
 *  applies, `entry-form.ts`'s per-kind `EntryFormOptions` simply omit the fields these two kinds lack
 *  (`availabilityToggle`/`rename` stay gated by their own lists below, unaffected by this one).
 *
 *  A THIRD list beside `AVAILABILITY_KINDS`/`RENAMABLE_KINDS`, not a reuse of either and not their
 *  intersection — the same law those two state about each other, applied once more: the three sets answer a
 *  DIFFERENT question (what may be reached ambiently · what may be renamed · whose CRUD is drawered), and
 *  folding rules that merely agree today into one expression is how the next kind silently inherits the
 *  wrong one. `catalog` alone stays excluded, on its own merits: its row's only verb is Remove (no rename,
 *  no content, no availability, adds come from the library picker — ADR-0170 cl.8), so a drawer there would
 *  hold a single button and add a click for nothing. */
export const DRAWER_CRUD_KINDS: readonly string[] = [
  ENTRY_KINDS.skill,
  ENTRY_KINDS.workflow,
  ENTRY_KINDS.resource,
  ENTRY_KINDS.tool,
  ENTRY_KINDS.promptSection,
  ENTRY_KINDS.patternSource,
]

/** `true` iff `kind`'s per-entry CRUD routes through the drawer (`DRAWER_CRUD_KINDS`). */
export function hasDrawerCrud(kind: string): boolean {
  return DRAWER_CRUD_KINDS.includes(kind)
}

/** GH #849 / capability-availability-tagging.spec.md SPEC-R5/R8 — the kinds the composer's `@` trigger
 *  reaches: MENTIONS attach material, and a Resource is the one kind that IS material. */
export const MENTIONABLE_KINDS: readonly string[] = [ENTRY_KINDS.resource]

/** GH #849 / SPEC-R5/R8 — the kinds the composer's `/` trigger reaches: INVOCATIONS do a thing (a skill,
 *  a workflow, a tool), listed as ONE grouped menu, direct-by-name (never a two-stage `/tool <name>`).
 *
 *  Two lists, not one filter over `AVAILABILITY_KINDS`: the `@`/`/` split IS the grammar (attach material
 *  vs do a thing, the harness idiom SPEC-R5 adopts), and the two sets' union happening to equal the four
 *  availability kinds today is a coincidence, not a rule — the same reasoning `AVAILABILITY_KINDS` and
 *  `RENAMABLE_KINDS` each state above. Widening `@` beyond Resources (SPEC's §3 grading — additive later)
 *  is one line here and zero grammar change. */
export const INVOCABLE_KINDS: readonly string[] = [ENTRY_KINDS.skill, ENTRY_KINDS.workflow, ENTRY_KINDS.tool]

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
// The DEV-only live turn's system prompt IS `composeSystemPrompt`'s output with every AMBIENT capability
// entry projected after it as ONE INDEX LINE — its label and description, never its content (GH #891/
// SPEC-R14, the owner's 2026-08-14 ruling / ADR-0190 rev.2). "Ambient" is enabled AND in-context, since
// GH #850/SPEC-R3 widened the per-entry filter with the availability conjunct (`isAmbient`,
// entry-data.ts): a user-invocable entry contributes NOTHING here, by design, until the user invokes it.
// ADR-0132 Fork 3 made entries generic prose — label + description + free-text content, NO parameter
// schema — so there is nothing machine-callable to declare as API `tools`; the index is the maximal
// faithful CATALOGUE of what the user authored, and the full text arrives on the one path that can afford
// it: the user's own express invocation (SPEC-R4's framing, which then rides replayed history).
//
// WHY an index and not the prose it used to be (the ruling's own reasoning, verified at HEAD): nothing
// model-side can pull text in later — this whole string is composed client-side per turn and both arms
// consume it as one blob — so ambient cost is paid on EVERY request, forever, and it is unbounded in both
// entry count and per-entry content size. The measured corpus (SPEC §12's survey, the shipped library
// packs): a realistic agent's ambient capability prose weighed 10–16 KB against a 361 B persona; as index
// lines it is 2.3–3.5 KB, a 77–80% cut, bounded by count × one line. `prompt-section` entries stay FULL
// always (`composeSystemPrompt` — they ARE the agent), and that is the ruled escape hatch for text which
// must be verbatim-ambient. A real tool-execution loop — the actual fix, letting the model pull an entry
// itself — stays a future, separately-decomposed feature (ADR-0132's own named deferral: parameter
// schemas first); this is the poor-man's bridge, named as such (SPEC-N3).

/** One capability kind's contribution to the live prompt: its `##` group heading + its entries (this
 *  function does the ambient-filter — enabled AND in-context, GH #850/SPEC-R3 — plus the sort and the
 *  master-switch gate itself, so the caller just hands over each kind's raw store slice). Since GH #891/
 *  SPEC-R14 each ambient entry contributes ONE index line, not its content. */
export interface LiveCapabilityGroup {
  kind: string
  /** The `## {heading}` group header (e.g. "Skills available to you"). */
  heading: string
  entries: readonly Entry[]
  /** The kind's MASTER switch (vision rev.5 — every capability section's header toggle, generalizing
   *  the old tools-only boolean): `false` gates the WHOLE kind out, winning over per-entry toggles. */
  enabled: boolean
}

// GH #525 bootstrap fix (2026-08-07 live-proof finding) — a real croupier session played two settled
// rounds with chips visibly tracked ON the surface, and the store's bankroll key stayed undefined the
// whole time: this file was the ONLY place `/bankroll` was ever taught, and it fired ONLY once a value
// was already stored — a bootstrap deadlock (no stored value ⇒ no path teaching ⇒ the model keeps its
// habitual key, `/chips` on the night's evidence ⇒ nothing for the mirror to read ⇒ never a stored
// value). The fix: `/bankroll` composes UNCONDITIONALLY for a capable persona, stored value or not — this
// is deliberately the ONLY place it may live. Persona prose (`surfaceStyle`, `agent-admin-presets.ts`)
// stays MODALITY-NEUTRAL by law (GH #412) — a data-model path is A2UI dialect, not persona intent.

/** The path-teaching sentence, byte-identical whether or not a figure is already stored (the resume
 *  sentence is the only part that varies) — the exact key a game's data model MUST use, named explicitly
 *  because nothing else in this build ever states it (a persona's own prose never may, GH #412). */
const BANKROLL_PATH_LINE =
  "Keep your game's running chip count at the data-model path /bankroll — that exact key, never chips/stack/score; every settlement writes the new figure there."

/**
 * GH #891/SPEC-R15 — the INDEX teaching block: the model is told, in the prompt itself, that the capability
 * lists are an index and that only the USER can load an entry. Host-owned and byte-pinned, living beside
 * the projection it teaches (the `BANKROLL_PATH_LINE` precedent, and for its very lesson: GH #525 proved an
 * affordance nobody is taught is an affordance that never fires — a model that cannot tell an index from
 * the real thing will either invent the missing text or silently skip the capability).
 *
 * Deliberately NOT in the a2ui mini-skill registry: that is producer/A2UI-side and modality-wrong for the
 * prose arm, while this string must ride EVERY arm that consumes `composeLiveSystemPrompt`.
 *
 * Three facts, in the ruling's own order, and nothing else (≤500 B — asserted in entries.test.ts): the
 * lists are an index (names + descriptions, no full text) · the model cannot load an entry itself, only the
 * user can, by tagging it in the composer (`@name` resources, `/name` skills/workflows/tools) · when a task
 * needs an indexed capability's full text, ASK for it by name. Zero index lines ⇒ zero teaching bytes (the
 * gated-equivalence law, SPEC-R14 AC3): a persona with no ambient capability entries composes exactly what
 * it composed before this ruling.
 */
export const CAPABILITY_INDEX_TEACHING =
  'The capability lists below are an INDEX: one line per item, its name and a short description — their full text is NOT loaded. ' +
  'You cannot load an item yourself; only the user can, by tagging it in the composer (@name for a resource, /name for a skill, workflow or tool). ' +
  "When a task needs an indexed item's full text, ask the user to tag it by name."

/** The live prompt's bankroll-teaching input (GH #525). Presence of this object (vs. `undefined`) is the
 *  whole gate: a caller hands one over only for a persona that is BOTH capable (`isBankrollCapable`) AND
 *  currently on the A2UI modality (`SURFACE_A2UI_KEY` — the SAME condition the post-turn mirror itself
 *  gates on, `agent-admin.ts`'s `#runSurfaceTurn`: no A2UI, no data-model teaching, modality-correct). */
export interface LiveBankrollState {
  /** The persisted figure, when the mirror has already written one. `undefined` ⇒ still fresh (no
   *  settlement mirrored yet) — only the path teaching composes, no resume-figure sentence yet (there is
   *  nothing to resume). */
  stored?: number
}

/**
 * The live system prompt: `composeSystemPrompt(sections)` followed by the SPEC-R15 teaching block and one
 * `## {heading}` block per capability kind that has ≥1 AMBIENT entry (enabled AND in-context — GH #850/
 * SPEC-R3), each such entry rendered as ONE INDEX LINE — `- {label} — {description}` — in `order` (ties by
 * `id`, the composeSystemPrompt law). A group whose `enabled` master switch is `false` is gated out
 * wholesale (vision rev.5 generalized the old tools-only `toolsEnabled` boolean to EVERY kind's
 * section-header switch — the master wins over per-entry toggles).
 *
 * GH #891/SPEC-R14 (the owner's ruling, ADR-0190 rev.2) — the INDEX LINE GRAMMAR, ruled here in code inside
 * the requirement's stated constraints (one line per entry, label then description, content bytes NOWHERE
 * ambient, groups keeping their `## {heading}` homes, the R3 ordering/gating laws untouched):
 *
 *     ## Skills available to you
 *     - House style — The voice: warm, concise, never salesy.
 *     - Menu reader                                  ← no description ⇒ the label alone, never a dangling dash
 *
 * A leading `- ` (the markdown list the rest of these prompts already speak) and a spaced em dash between
 * label and description; the description is WHITESPACE-COLLAPSED so "one line per entry" is literally true
 * even for a hand-edited multi-line description. `content` appears nowhere — it reaches the model only
 * through SPEC-R4's invocation framing (`resolveTurnReferences`, unchanged, still whole-content), which
 * BOTH availability modes reach through the typeahead. No truncation and no description cap (SPEC-N3): a
 * runaway description is visible in R14 AC2's per-entry budget assertion instead of silently cut.
 *
 * GATED EQUIVALENCE (ADR-0136 Fork 3, carried forward by SPEC-R14 AC3): with no ambient capability entries
 * the result is byte-identical to `composeSystemPrompt(sections)` — no teaching block, no trailing empty
 * header. GH #850/SPEC-R3 AC3's own arm stands too: a store in which no entry carries `availability`
 * composes exactly as an all-`context` one does.
 *
 * GH #525 — `bankroll`, when given (a capable, A2UI-on persona), always composes `BANKROLL_PATH_LINE`
 * right after the base prompt and ahead of the capability groups; `bankroll.stored`, when present, appends
 * a resume-figure sentence naming the exact figure. `undefined` (not capable, or A2UI is off) is the SAME
 * gated equivalence every other optional input here has — byte-identical to the pre-#525 output.
 */
export function composeLiveSystemPrompt(
  sections: readonly Entry[],
  capabilities: readonly LiveCapabilityGroup[],
  bankroll?: LiveBankrollState,
): string {
  const base = composeSystemPrompt(sections)
  const withBankroll =
    bankroll === undefined
      ? base
      : `${base}\n\n${BANKROLL_PATH_LINE}${
          bankroll.stored === undefined ? '' : ` Your current bankroll is ${bankroll.stored} — resume from it, never a fresh stake.`
        }`
  const groups: string[] = []
  for (const group of capabilities) {
    if (!group.enabled) continue // the kind's master switch gates the whole group out
    // GH #850/SPEC-R3(a) — the per-entry filter is `isAmbient`, not bare `e.enabled`: enabled AND
    // in-context. A user-invocable entry is skipped exactly the way a disabled one is (so a kind whose only
    // enabled entries are invocable contributes no header at all). The three conjuncts stay independent:
    // master switch → `enabled` → availability, none of them collapsed into another.
    const ambient = [...group.entries].filter(isAmbient).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    if (ambient.length === 0) continue // a kind with nothing ambient contributes no header
    groups.push(`## ${group.heading}\n${ambient.map(capabilityIndexLine).join('\n')}`)
  }
  // SPEC-R15's gate is the INDEX itself: no lines composed ⇒ not one teaching byte (and the whole result
  // degrades to the base prompt, SPEC-R14 AC3's gated equivalence).
  return groups.length > 0 ? `${withBankroll}\n\n${CAPABILITY_INDEX_TEACHING}\n\n${groups.join('\n\n')}` : withBankroll
}

/** SPEC-R14's one ambient line for one entry: `- {label} — {description}`, the description
 *  whitespace-collapsed to keep the line a line, and OMITTED (with its dash) when empty. The entry's
 *  `content` is deliberately unread here — that is the whole requirement. */
function capabilityIndexLine(entry: Entry): string {
  const description = entry.description.trim().replace(/\s+/g, ' ')
  return description.length > 0 ? `- ${entry.label} — ${description}` : `- ${entry.label}`
}

// ── the composer's reference rosters + turn-time resolution (GH #849, SPEC-R8/SPEC-R4) ─────────────────
// The two halves of the user-invocable REACH PATH, both pure functions over the same input shape
// (`ReferenceGroup[]` — one per mapped kind, exactly the `LiveCapabilityGroup` division of labor the
// prompt projection already uses: `agent-admin.ts` does the fresh store reads, this module does the
// filter/sort/projection). The composer stays generic (it knows `ReferenceOption`/`TurnReference`, never
// `Entry`, a store, or a kind's semantics — the SPEC's layering clause); this is the domain side of that
// seam, and the SINGLE repoint site if display truth ever moves off `Entry.label` (SPEC-R8).

/** One kind's raw store slice + its MASTER switch, for the roster/resolution projections below. The
 *  `LiveCapabilityGroup` shape minus `heading` — neither of these projections renders a group header (the
 *  composer's own menu groups by `kind` and labels it, conversation-composer.ts's `kindLabel`). */
export interface ReferenceGroup {
  kind: string
  entries: readonly Entry[]
  /** The kind's MASTER switch — `false` gates the whole kind out of BOTH the menu and every resolution. */
  enabled: boolean
}

/** The two rosters `ui-agent-admin` hands the composer (SPEC-R8): `@` and `/`, each already filtered,
 *  sorted and projected to the composer's generic option vocabulary. */
export interface ComposerRosters {
  mentionables: ReferenceOption[]
  invocables: ReferenceOption[]
}

/**
 * GH #891 (SPEC-R9) — the kind→glyph table: THE domain mapping the composer deliberately does not own.
 * `ReferenceOption.icon` is an opaque `ui-icon` glyph name to that element (§5's layering clause), so this
 * module — which already owns every other projection of a kind's meaning — is where the four capability
 * kinds get their mark.
 *
 * Glyph choices, from the CURATED set only (`icons.gen.ts`/`ICON_NAMES`; nothing had to be added, so the
 * GH #868 extension process stays unused — its bar is "no curated glyph fits"):
 *   · `resource` → `file-text`  — a resource IS attached material; the file glyph is literal.
 *   · `tool`     → `gear`       — the fleet's mechanism glyph (`wrench` is not in the curated set).
 *   · `workflow` → `share-network` — nodes-and-edges reads as a multi-step flow (`list` would say
 *                                   "some items", which is the ambiguity GH #868 rejected for Models).
 *   · `skill`    → `star`       — a named capability. NOT `sparkle`/`brain`: those two are already the
 *                                Models/Effort trigger glyphs in this very composer (GH #868), and a chip
 *                                repeating a picker's glyph reads as that picker's state.
 * A kind absent from this table (prompt sections, pattern sources, catalogs — none of which is ever a
 * mentionable/invocable) simply gets no icon: the composer then renders a label-only chip, its own
 * documented default, so this table needs no fallback glyph.
 */
const KIND_GLYPHS: Readonly<Record<string, string>> = {
  [ENTRY_KINDS.skill]: 'star',
  [ENTRY_KINDS.workflow]: 'share-network',
  [ENTRY_KINDS.resource]: 'file-text',
  [ENTRY_KINDS.tool]: 'gear',
}

/** One entry → one `ReferenceOption`. `label` is read from the entry ITSELF on every build, which is the
 *  whole of SPEC-R8's rename-following clause (GH #848 landed the rename as an in-place `label` write, so
 *  a fresh read IS the propagation — nothing to repoint). An empty description is OMITTED rather than sent
 *  as `''`, so the menu row renders label-only instead of an empty second line — and (GH #891/SPEC-R9) an
 *  unmapped kind's `icon` is omitted the same way, never sent as an empty glyph name. */
function referenceOptionOf(entry: Entry): ReferenceOption {
  const description = entry.description.trim()
  const icon = KIND_GLYPHS[entry.kind]
  return {
    id: entry.id,
    label: entry.label,
    kind: entry.kind,
    ...(description === '' ? {} : { description }),
    ...(icon === undefined ? {} : { icon }),
  }
}

/** The entries of one group that may appear in a menu / resolve at send: the kind's MASTER switch on AND
 *  the entry `enabled` — BOTH availability modes (SPEC-R8: an in-context entry may appear in the menu AND
 *  compose ambiently; a user-invocable one appears ONLY here). Deliberately NOT `isAmbient`: this is the
 *  reach path availability's `invocable` mode exists FOR, so filtering by it here would make a
 *  user-invocable entry unreachable everywhere — the exact inversion of the mode's contract. */
function reachableEntries(group: ReferenceGroup): Entry[] {
  if (!group.enabled) return []
  return [...group.entries].filter((e) => e.enabled).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

/**
 * SPEC-R8 — the menu roster projection: entries of the mapped kinds (`MENTIONABLE_KINDS` → `@`,
 * `INVOCABLE_KINDS` → `/`) that are `enabled` and whose kind's MASTER switch is on, BOTH availability
 * modes, in each kind's own `order` (ties by `id`, the `composeSystemPrompt` sort law). Disabled entries
 * and master-off kinds are absent; a kind mapped to neither roster (prompt sections, pattern sources,
 * catalogs) contributes nothing wherever it appears in `groups`.
 *
 * PURE and fresh-read by construction: it holds no state, so every build reflects whatever the store said
 * at the moment the caller read it (`agent-admin.ts`'s `#referenceGroups`) — which is what makes a rename
 * show on the next menu open with zero further wiring, and what keeps `id` (never `label`) the resolution
 * key everywhere (GH #402's law).
 */
export function buildComposerRosters(groups: readonly ReferenceGroup[]): ComposerRosters {
  const rosterFor = (kinds: readonly string[]): ReferenceOption[] =>
    groups.filter((g) => kinds.includes(g.kind)).flatMap((g) => reachableEntries(g).map(referenceOptionOf))
  return { mentionables: rosterFor(MENTIONABLE_KINDS), invocables: rosterFor(INVOCABLE_KINDS) }
}

// ── the capabilities MENU projection (GH #891/SPEC-R13, ADR-0190 rev.2 — the RULED global switch) ───────
// The composer's third affordance (SPEC-R11) is a GLOBAL enable/disable over the roster's `enabled` axis:
// its rows are this projection, its flips are a persistent store write (`agent-admin.ts`'s own handler).
// Deliberately its OWN projection beside `buildComposerRosters` (SPEC-R13's own note), never a widening of
// it: that roster is enabled-ONLY by contract (SPEC-R8 — a menu of what may be reached THIS turn), while
// this one must list BOTH enabled states, because a global off-switch that hides what it switched off
// cannot be flipped back on. Same `ReferenceGroup` input shape, so `agent-admin.ts` keeps doing the fresh
// store reads and this module keeps doing the filter/sort/projection.

/** SPEC-R13's row id: the `{kind}:{id}` PAIR, because `onCapabilityToggle(id, included)` hands back the row
 *  id ALONE and the entry it names is only unique per kind — `validateNewEntry` dedupes ids WITHIN a kind's
 *  list (an id is `slugify(label)`), so a resource and a skill both named "Notes" legitimately both hold
 *  `notes`. The reference path already acknowledges the same truth by carrying `kind` beside `id` in every
 *  `TurnReference` (`resolveTurnReferences`' per-kind lookup); here the one field that round-trips has to
 *  carry both, or a flip on one row would silently write the other kind's entry.
 *
 *  The id is OPAQUE to the composer (SPEC-R11/§5's layering clause — it renders it into `data-id` and echoes
 *  it back, nothing else), so encoding a pair in it costs the contract nothing. Kind names never contain a
 *  colon; an entry id MAY (a namespaced service ref, ADR-0185), which is why the parse splits on the FIRST
 *  colon only and is lossless for every id this store can hold. */
export function capabilityRowId(entry: Entry): string {
  return `${entry.kind}:${entry.id}`
}

/** `capabilityRowId`'s inverse — `undefined` for anything this projection could not have minted (no colon,
 *  an empty half, or a kind availability semantics are not defined for): a fail-closed parse, so a stray or
 *  hand-forged callback id can never be turned into a store write (SPEC-R4's drop law, applied to the
 *  toggle seam). */
export function parseCapabilityRowId(rowId: string): { kind: string; id: string } | undefined {
  const split = rowId.indexOf(':')
  if (split <= 0) return undefined
  const kind = rowId.slice(0, split)
  const id = rowId.slice(split + 1)
  if (id.length === 0 || !hasAvailabilityMode(kind)) return undefined
  return { kind, id }
}

/**
 * SPEC-R13 — the capabilities menu's rows: every entry of the four capability kinds
 * (`AVAILABILITY_KINDS`) whose kind's MASTER switch is on, in each kind's own `order` (ties by `id`, the
 * `composeSystemPrompt` sort law), `included` mirroring the entry's PERSISTED `enabled`.
 *
 * What it deliberately does NOT filter:
 *  · **`enabled`** — both states are listed. This surface IS the enable/disable dial, and a dial that drops
 *    the rows it turned off is one-way (the ruling's own point).
 *  · **`availability`** — both modes are listed, and the switch never touches that axis (SPEC-R1's
 *    orthogonality): the three tiers a user reads off this panel are enabled+in-context (ever-present),
 *    enabled+invocable (only on an express `@`/`/` invocation), and disabled (off everywhere).
 * What it DOES gate is the MASTER switch, which stays the admin surface's own (a master-off kind's rows
 * belong to a kind the user has switched off wholesale — SPEC-R3/R4's precedence, unchanged).
 *
 * The kind filter is `AVAILABILITY_KINDS` itself, not a fifth list beside it: this projection's rule IS
 * that set's rule — the panel teaches the availability×enabled matrix, which is defined for exactly the
 * kinds `Entry.availability` is defined for (SPEC-R1). A kind outside it contributes nothing even if a
 * caller hands it over.
 *
 * PURE and fresh-read by construction, exactly like `buildComposerRosters`: it holds no state, so every
 * build reflects whatever the store said when the caller read it (`agent-admin.ts`'s `#capabilityRowGroups`,
 * rebuilt from the standing `#applyMasterStates` reflect path — which is what makes an add, a delete, a
 * rename, an `enabled` flip, an availability flip and a master-switch flip all show without any
 * open-notification callback from the composer).
 */
export function buildCapabilityRows(groups: readonly ReferenceGroup[]): CapabilityRow[] {
  return groups
    .filter((group) => hasAvailabilityMode(group.kind) && group.enabled)
    .flatMap((group) =>
      [...group.entries]
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
        .map((entry) => ({ ...referenceOptionOf(entry), id: capabilityRowId(entry), included: entry.enabled })),
    )
}

/** SPEC-R4 — the reference kinds that frame into the outgoing user turn's TEXT. The `tool` kind is the one
 *  exception: it already HAS a wire (`integrations`, ADR-0168 cl.2), so an invoked tool rides that instead
 *  of prose. Everything else an entry can be (a skill, a workflow, a resource) is generic prose by
 *  ADR-0132 Fork 3 — label + description + free-text content, nothing machine-callable — so framing it into
 *  the turn IS the maximal faithful representation of "the user attached this". */
const FRAMED_KINDS: readonly string[] = [ENTRY_KINDS.skill, ENTRY_KINDS.workflow, ENTRY_KINDS.resource]

/** SPEC-R4's framing block heading — ONE header for the whole attached set, whatever it spans. */
const REFERENCE_FRAME_HEADING = '## Referenced for this message'

/** What one turn's references resolved to (SPEC-R4): the text that goes on the wire and into history, and
 *  the invoked tool ids the caller unions into THAT turn's `integrations`. */
export interface ResolvedTurnReferences {
  /** The typed text, FRAMED: each resolved prose entry as a labeled block, typed text last. With zero
   *  resolved references this is the typed text byte-identically (the gated-equivalence law again). */
  text: string
  /** The invoked TOOL entries' ids, deduped, in reference order — never their labels (GH #402). The caller
   *  unions them with the ambient projection; nothing here persists past this turn. */
  toolIds: string[]
}

/**
 * SPEC-R4 — turn-time resolution, host-side, by `id`, fail-closed.
 *
 * Each reference is resolved against `groups` (the caller's FRESH store read — the live-apply law) and
 * contributes NOTHING unless its kind is one this grammar maps, its kind's MASTER switch is on, an entry
 * with that `id` still exists, and that entry is `enabled`. A reference that was minted from a menu and
 * then deleted, disabled, or master-switched off between menu and send simply drops; the turn still sends
 * with the remaining resolutions intact (the `resolveIntegrations` drop law, applied host-side). Duplicate
 * references (same kind + id) resolve once.
 *
 * The FRAMING GRAMMAR (the SPEC leaves the exact bytes to an LLD; no LLD was authored for this arc, so it
 * is ruled here, in code, inside SPEC-R4's four stated constraints — labeled per entry, content verbatim,
 * typed text last, and zero resolved references ⇒ the bare typed text byte-identically):
 *
 *     ## Referenced for this message
 *     ### {label} ({kind})
 *     {description}          ← omitted when empty
 *
 *     {content}              ← omitted when empty, otherwise VERBATIM
 *
 *     {typed text}
 *
 * The block shape was originally the ambient projection's own (`### {label}` + description + content, the
 * S3 ruling: "the model meets an attachment in the same shape it already meets a capability"). Since
 * GH #891/SPEC-R14 the AMBIENT shape is one index LINE, so the two have deliberately parted: this is the
 * LOAD path and it stays whole-content — the framing block IS what an index line points at, which is
 * exactly why the teaching block tells the model to ask for it by name. The grammar itself is unchanged
 * byte-for-byte (SPEC-N3: R4's framing does not move), with ONE header naming whose material it is and the
 * kind in each block's own heading (a resource attached vs a skill invoked — one deterministic line, no
 * per-kind noun table to drift).
 *
 * The framed text is what BOTH arms send and what history records (SPEC-R4): the model-saw-it truth rides
 * the transcript, so a follow-up turn keeps the attachment without re-mentioning it. The COST is owned, not
 * hidden — a framed attachment's full content rides every later request of that session, with no cap this
 * arc (SPEC-N1); the chip the user dismissed or kept is the visible choice.
 */
export function resolveTurnReferences(
  text: string,
  references: readonly TurnReference[] | undefined,
  groups: readonly ReferenceGroup[],
): ResolvedTurnReferences {
  if (references === undefined || references.length === 0) return { text, toolIds: [] }
  const reachable = new Map<string, Map<string, Entry>>()
  for (const group of groups) reachable.set(group.kind, new Map(reachableEntries(group).map((e) => [e.id, e])))
  const seen = new Set<string>()
  const blocks: string[] = []
  const toolIds: string[] = []
  for (const reference of references) {
    // The dedupe key joins two FREE-FORM strings, so the separator has to be one neither can contain: an
    // id may carry `:` (`svc:calc:*`, ADR-0185) or a space, and any printable joiner would let one pair
    // forge another's key (entries.test.ts pins exactly that). NUL is the joiner — written as the ESCAPE
    // `\x00`, never as a raw byte: a literal NUL in the source made `grep` classify this whole file as
    // binary and SKIP it, blinding every grep-based fence over app/src (SPEC-R6 AC1's connector-token fence
    // among them) to anything in it. That was GH #899; source-bytes.test.ts is the standing trip-wire.
    const key = `${reference.kind}\x00${reference.id}`
    if (seen.has(key)) continue
    seen.add(key)
    const entry = reachable.get(reference.kind)?.get(reference.id)
    if (entry === undefined) continue // fail-closed: deleted, disabled, or a master-off kind
    if (entry.kind === ENTRY_KINDS.tool) {
      toolIds.push(entry.id)
      continue
    }
    if (!FRAMED_KINDS.includes(entry.kind)) continue // a kind with no framing semantics contributes nothing
    const lines = [`### ${entry.label} (${entry.kind})`]
    if (entry.description.trim().length > 0) lines.push(entry.description.trim())
    if (entry.content.trim().length > 0) lines.push('', entry.content.trim())
    blocks.push(lines.join('\n'))
  }
  if (blocks.length === 0) return { text, toolIds }
  const framed = `${REFERENCE_FRAME_HEADING}\n${blocks.join('\n\n')}`
  return { text: text.trim().length === 0 ? framed : `${framed}\n\n${text}`, toolIds }
}
