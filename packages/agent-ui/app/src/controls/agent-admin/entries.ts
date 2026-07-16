// entries.ts — the generic ordered-entry-list PRIMITIVE (ADR-0132 `n1`): a named, ordered, toggleable
// entry within a typed list, parameterized by `kind`. Types + pure data/logic only (the schema.ts
// precedent) — `entry-list.ts` owns the rendering, `agent-admin.ts` owns the composition.
//
// Five instantiations share this ONE shape (ADR-0132 cl.1): prompt sections (kind='prompt-section',
// seeded with three built-in entries — Foundation/Personality/Critical Items) and four capability kinds
// (skill/workflow/resource/tool, unseeded — purely custom-authored, no backend to seed from). A future
// kind is a new `ENTRY_KINDS` member + optional seed data — never new list/toggle/author code
// (ADR-0132 cl.1/Fork 2: the taxonomy is extensible, not a hardcoded enum).
//
// Custom-entry depth is DELIBERATELY generic (ADR-0132 Fork 3): label + description + free-text content,
// uniform across every kind. A kind-specific schema (e.g. a Tool's parameter list) is an explicitly
// deferred, separately-scoped future extension — not built here.

/** The known kinds this build seeds/instantiates. Not a closed enum — `Entry.kind` is a plain `string`
 *  (ADR-0132 Fork 2: extensible without a code change); these are the five known constants, not an
 *  exhaustive union type. */
export const ENTRY_KINDS = {
  promptSection: 'prompt-section',
  skill: 'skill',
  workflow: 'workflow',
  resource: 'resource',
  tool: 'tool',
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
  }
}

/** Read one kind's entry list from a store, defensively: a bring-your-own store, a corrupt/foreign
 *  localStorage value, or a store that never seeded this key all degrade to an empty list, never throw. */
export function readEntries(store: { get(key: string): unknown } | undefined, kind: string): Entry[] {
  const raw = store?.get(entriesStoreKey(kind))
  return Array.isArray(raw) ? (raw as Entry[]) : []
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
}

/**
 * The live system prompt: `composeSystemPrompt(sections)` followed by one `## {heading}` block per
 * capability kind that has ≥1 enabled entry, each enabled entry rendered as `### {label}` + its
 * description + its content, in `order` (ties by `id`, the composeSystemPrompt law). `toolsEnabled === false`
 * gates the whole `tool` kind out (the master switch wins over per-entry toggles — the flat boolean finally
 * gets a live meaning consistent with its label). GATED EQUIVALENCE (ADR-0136 Fork 3): with no enabled
 * capability entries the result is byte-identical to `composeSystemPrompt(sections)` — the live prompt
 * degrades exactly to today's composed prompt, never a trailing empty header.
 */
export function composeLiveSystemPrompt(
  sections: readonly Entry[],
  capabilities: readonly LiveCapabilityGroup[],
  toolsEnabled: boolean,
): string {
  const base = composeSystemPrompt(sections)
  const groups: string[] = []
  for (const group of capabilities) {
    if (group.kind === ENTRY_KINDS.tool && !toolsEnabled) continue // the master switch gates the tools kind out
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
}

export type ValidateNewEntryResult = { ok: true; entry: Entry } | { ok: false; error: string }

/** Fail-closed validation for a new custom entry (ADR-0132 cl.4): a required, non-empty `label`, and a
 *  generated id that doesn't collide with an existing entry of the SAME kind (a suffix counter resolves
 *  a slug collision rather than rejecting it outright — a friendlier failure mode than forcing the
 *  author to rename). Never mutates `existing`. */
export function validateNewEntry(existing: readonly Entry[], kind: string, input: NewEntryInput): ValidateNewEntryResult {
  const label = input.label.trim()
  if (label.length === 0) return { ok: false, error: 'A name is required.' }

  const usedIds = new Set(existing.map((e) => e.id))
  let id = slugify(label)
  let suffix = 2
  while (usedIds.has(id)) {
    id = `${slugify(label)}-${suffix}`
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
