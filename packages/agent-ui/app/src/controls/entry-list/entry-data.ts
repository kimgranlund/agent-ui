// entry-data.ts — the generic ordered-entry-list DATA CORE (ADR-0164 cl.2, split out of agent-admin's
// `entries.ts`, itself ADR-0132 `n1`): a named, ordered, toggleable entry within a typed list,
// parameterized by a bare `kind: string`. Types + pure data/logic only (the settings/schema.ts
// precedent) — `entry-list.ts` owns the rendering, a consumer (agent-admin.ts today) owns the domain
// layer (kind constants, seeded defaults, system-prompt projection) and the composition.
//
// The split line is mechanical (ADR-0164 cl.2): anything naming a kind constant, a seeded default, or
// the system-prompt projection is domain and stays with the consumer; anything parameterized by bare
// `kind: string` is core and lives here. Custom-entry depth is DELIBERATELY generic (ADR-0132 Fork 3):
// label + description + free-text content, uniform across every kind — a kind-specific schema (e.g. a
// Tool's parameter list) is an explicitly deferred, separately-scoped future extension, not built here.

export interface Entry {
  id: string
  kind: string
  label: string
  description: string
  content: string
  /** Ascending sort order within its kind — ties broken by `id` (stable, deterministic). */
  order: number
  /** Toggle state — a disabled entry is skipped by a domain consumer's own composition (e.g.
   *  `composeSystemPrompt`), but is NEVER removed from the list (ADR-0132 Fork 4). */
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

/** Read one kind's entry list from a store, defensively: a bring-your-own store, a corrupt/foreign
 *  localStorage value, or a store that never seeded this key all degrade to an empty list, never throw. */
export function readEntries(store: { get(key: string): unknown } | undefined, kind: string): Entry[] {
  const raw = store?.get(entriesStoreKey(kind))
  return Array.isArray(raw) ? (raw as Entry[]) : []
}

/** A slug id from a label — lowercase, non-alphanumeric runs collapsed to one hyphen, trimmed. Falls
 *  back to `entry` if the label is entirely non-alphanumeric (e.g. all emoji/punctuation) — never an
 *  empty id. Exported (GH #564) so `entry-list.ts`'s add-from-library picker can predict a pack entry's
 *  resulting id — the SAME resolution `validateNewEntry` uses below — to know whether it would collide. */
export function slugify(label: string): string {
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

/** GH #564 — `validateNewEntry`'s own additive options bag (the SAME law `EntryListOptions` follows,
 *  entry-list.ts): new members are optional with a default that is byte-identical for every existing
 *  caller. */
export interface ValidateNewEntryOptions {
  /** `true` for a kind whose entry id is a FOREIGN KEY into an external registry (the catalog kind,
   *  ADR-0170 cl.8) — a colliding id there is a genuine DUPLICATE (re-adding the SAME registered catalog
   *  mints a second identical-looking card), not a name clash a suffix can resolve; mangling the id "would
   *  be the very coupling this widening exists to break" (see the comment below). `false`/absent — every
   *  hand-authored kind (e.g. two "Rules" prose entries legitimately coexisting) — keeps the suffix
   *  counter exactly as before. */
  rejectOnCollision?: boolean
}

/** Fail-closed validation for a new custom entry (ADR-0132 cl.4): a required, non-empty `label`, and an
 *  id that doesn't collide with an existing entry of the SAME kind. GH #564 — the collision itself now
 *  branches on `options.rejectOnCollision` (default `false`): a suffix counter resolves it (a friendlier
 *  failure mode than forcing the author to rename) UNLESS the caller flags this kind's id as a foreign
 *  key, in which case the add is rejected outright instead of minting an unregistered `${base}-2` row.
 *  The id is `input.id` when the caller supplies one (LLD-C7: a pack keying an external vocabulary), else
 *  `slugify(label)` exactly as before. Never mutates `existing`. */
export function validateNewEntry(
  existing: readonly Entry[],
  kind: string,
  input: NewEntryInput,
  options?: ValidateNewEntryOptions,
): ValidateNewEntryResult {
  const label = input.label.trim()
  if (label.length === 0) return { ok: false, error: 'A name is required.' }

  // An explicit id is trimmed but NEVER slugged — it is a foreign key (a registry id), so mangling it
  // would be the very coupling this widening exists to break. An empty/blank one falls back to the slug.
  const base = input.id?.trim() ? input.id.trim() : slugify(label)
  const usedIds = new Set(existing.map((e) => e.id))
  let id = base
  if (usedIds.has(id)) {
    // GH #564 — a foreign-key id's collision IS the duplicate; reject rather than mint a second, dedup-
    // suffixed row that would still render the SAME pack label as a phantom copy.
    if (options?.rejectOnCollision) return { ok: false, error: 'Already in the list.' }
    let suffix = 2
    while (usedIds.has(id)) {
      id = `${base}-${suffix}`
      suffix += 1
    }
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
