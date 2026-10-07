// types.ts: the capability registry's row model (GH #1807, the ADR for T-0013).
//
// The registry is a derived INDEX, never a source (ADR-0173 cl.5: no catalog row, sidecar entry or
// descriptor field is generated from it). Every row records WHERE its fact lives (`source`), the one
// decided STATE of that fact with the reason where a source recorded one, and which surfaces read it.
//
// Pure and import-free: this module (and the whole `./registry` subpath) carries no `node:*` and no
// import from `src/agent/`. The selection-guidance shape is declared structurally below rather than
// imported, because `gates.test.ts` leg 5 (composition containment) text-scans every non-agent module for
// a relative specifier into `src/agent/`, type-only imports included; `SelectionGuidance` from the
// producer toolkit is assignable to `GuidanceMap`.

/** The kinds of capability the registry indexes. */
export const CAPABILITY_KINDS = ['control', 'catalog', 'type', 'function', 'fragment', 'mini-skill', 'genui-pack', 'corpus-shard'] as const
export type CapabilityKind = (typeof CAPABILITY_KINDS)[number]

/** The surfaces that read a capability. A claim here is derived from a fact the registry can compute. */
export const CONSUMERS = ['prompt', 'renderer', 'site', 'corpus', 'shim', 'eval'] as const
export type Consumer = (typeof CONSUMERS)[number]

/**
 * The decided state of a row. Per kind:
 * - control: `catalogued` (a registered catalog or fragment type renders it) | `excluded` (no row anywhere,
 *   a recorded exclusion reason) | `uncatalogued` (neither: the state the coverage gate forbids)
 * - type: `emittable` | `feed-excluded` (default catalog types only, the ADR-0097 feed partition, with reason)
 * - mini-skill, corpus-shard: `scoped` (to its exact `catalogId`, the SPEC-R6 filter; the id is the row's `scope`)
 * - catalog, function, fragment, genui-pack: `shipped`
 */
export const CAPABILITY_STATES = ['catalogued', 'excluded', 'uncatalogued', 'emittable', 'feed-excluded', 'scoped', 'shipped'] as const
export type CapabilityState = (typeof CAPABILITY_STATES)[number]

export interface CapabilityStatus {
  readonly state: CapabilityState
  /** The recorded reason, present when a source recorded one (an exclusion, a feed exclusion, a scope). */
  readonly reason?: string
}

/** Where a row's fact lives: a repo-root-relative path, plus the record inside it when the file holds many. */
export interface CapabilitySource {
  readonly path?: string
  readonly record?: string
}

/** One `notFor` edge, as the selection sidecars carry it. */
export interface GuidanceEdge {
  readonly type: string
  readonly why: string
}

/** One type's selection guidance (structurally the producer toolkit's `SelectionEntry`). */
export interface GuidanceEntry {
  readonly intents: readonly string[]
  readonly notFor: readonly GuidanceEdge[]
}

/** Type id to its guidance, for one catalog or one persona fragment. */
export type GuidanceMap = Readonly<Record<string, GuidanceEntry>>

/**
 * Every shipped `selection.json` sidecar, keyed by what it pins: base catalog id (`catalogId`) and persona
 * fragment id (`personaId`). The shape of `RegistrySources.guidance`, and of the committed browser-safe
 * projection `selection-projection.gen.ts` (T-0025, GH #1815 item 3), which a host with no filesystem and
 * no `./agent` embed can hand to `composeRegistry` or resolve through `selectionProjectionFor`.
 */
export interface SelectionProjection {
  readonly base: Readonly<Record<string, GuidanceMap>>
  readonly persona: Readonly<Record<string, GuidanceMap>>
}

/**
 * One indexed capability. Plain JSON: optional fields are omitted, never `undefined` or `null`, so the
 * committed projection has deterministic bytes. Kind-specific fields:
 * - control: `tag`, `tier`, `description`, `uses`, `catalogs` (scopes whose types render it)
 * - type: `name`, `scope` (catalog id, or persona id for a fragment type), `tag` (the rule's tag for a default
 *   catalog type; for a persona type only when that tag is a fleet control in the sources; absent for a tagless
 *   type, an upstream-vocabulary type, and a composition), `intents`, `notFor`
 * - function: `name`, `scope`
 * - fragment: `name` (persona id), `targetCatalogs`
 * - mini-skill: `name`, `scope` (its exact catalog id)
 * - corpus-shard: `name`, `scope` (its exact catalog id), `records`
 */
export interface CapabilityRow {
  readonly id: string
  readonly kind: CapabilityKind
  readonly source: CapabilitySource
  readonly status: CapabilityStatus
  readonly consumers: readonly Consumer[]
  readonly name?: string
  readonly scope?: string
  readonly tag?: string
  readonly tier?: string
  readonly description?: string
  readonly uses?: readonly string[]
  readonly catalogs?: readonly string[]
  readonly intents?: readonly string[]
  readonly notFor?: readonly GuidanceEdge[]
  readonly targetCatalogs?: readonly string[]
  readonly records?: number
}

/** The composed registry: the base rows plus each persona fragment's rows (the fragment row first). */
export interface CapabilityRegistry {
  readonly base: readonly CapabilityRow[]
  readonly personas: Readonly<Record<string, readonly CapabilityRow[]>>
}

// ── sources ─────────────────────────────────────────────────────────────────────────────────────────────
// Two tiers. The RUNTIME tier is objects every host already holds (the registered catalogs, the persona
// fragments with their targets, the selection guidance, the mini-skill registry), so a Worker composes the
// registry with no new asset. The BUILD tier adds what only disk knows (descriptors, packs, corpus shards,
// the exclusion allowlist) and is optional: a runtime-only source set composes without it.

/** A registered catalog document, as far as the registry reads it (structurally `Catalog`). */
export interface CatalogSource {
  readonly catalogId: string
  readonly components: Readonly<Record<string, unknown>>
  readonly functions: Readonly<Record<string, unknown>>
  readonly path?: string
}

/** A persona fragment and the bases it targets (structurally `PersonaCatalogManifest`). */
export interface FragmentSource {
  readonly personaId: string
  readonly fragment: {
    readonly components: Readonly<Record<string, unknown>>
    readonly functions: Readonly<Record<string, unknown>>
  }
  readonly targetCatalogs: readonly string[]
  readonly path?: string
}

/** One mini-skill, as far as the registry reads it (structurally `MiniSkill`). */
export interface MiniSkillSource {
  readonly id: string
  readonly catalogId: string
  readonly path?: string
}

/** The ADR-0097 feed partition over the default catalog: surface types, and excluded types with reasons. */
export interface FeedSource {
  readonly catalogId: string
  readonly surface: readonly string[]
  readonly excluded: readonly { readonly type: string; readonly reason: string }[]
}

export interface ControlSource {
  readonly tag: string
  readonly tier: string
  readonly description?: string
  readonly uses: readonly string[]
  readonly path: string
}

export interface GenuiPackSource {
  readonly id: string
  readonly path?: string
}

export interface CorpusShardSource {
  readonly path: string
  readonly kind: string
  readonly catalogId: string
  readonly records: number
}

export interface RegistrySources {
  // runtime tier
  readonly catalogs: readonly CatalogSource[]
  readonly fragments: readonly FragmentSource[]
  readonly guidance: SelectionProjection
  readonly miniSkills: readonly MiniSkillSource[]
  readonly feed?: FeedSource
  // build tier
  readonly controls?: readonly ControlSource[]
  readonly exclusions?: ReadonlyMap<string, string>
  readonly genuiPacks?: readonly GenuiPackSource[]
  readonly corpusShards?: readonly CorpusShardSource[]
}

// ── views ───────────────────────────────────────────────────────────────────────────────────────────────

/** One catalog id's composed capabilities: what a turn on that id can emit and retrieve. */
export interface CapabilityView {
  readonly catalogId: string
  /** The base half of the id (the whole id when it carries no `--`); `''` when the base is unknown. */
  readonly baseId: string
  /** The persona half, or `null` when the id is a base or the persona does not target the base. */
  readonly personaId: string | null
  /** Type rows: the base's, then the persona fragment's. */
  readonly types: readonly CapabilityRow[]
  readonly functions: readonly CapabilityRow[]
  /** Mini-skill and corpus-shard rows scoped to exactly `catalogId` (the ruled SPEC-R6 exact filter). */
  readonly retrievable: readonly CapabilityRow[]
  /** Names of the types only the persona fragment adds. */
  readonly personaOnlyTypes: readonly string[]
}
