// compose.ts: composeRegistry (sources -> rows), registryViewFor (one catalog id -> its composed
// capabilities), and the one pure tag rule that relates a catalog type to the control it renders.
//
// A derived index, never a source (ADR-0173 cl.5). Pure: no `node:*`, no `src/agent/` import, so the
// Worker, the site and the Node tools can all import it. The disk-reading half lives in
// `tools/registry/load.ts`; this module only joins what it is handed.

import type {
  CapabilityRegistry,
  CapabilityRow,
  CapabilityStatus,
  CapabilityView,
  Consumer,
  GuidanceEntry,
  RegistrySources,
} from './types.ts'
import { CONSUMERS } from './types.ts'

// ── the tag rule ────────────────────────────────────────────────────────────────────────────────────────
// A type of the `agent-ui` default catalog renders the control whose tag is `ui-` plus the type's kebab-case,
// with exactly three named exceptions: `AudioPlayer` is the upstream basic-catalog name of `ui-audio`
// (GH #1209), and `Option`/`MenuItem` are sanctioned non-`ui-*` primitives. A new exception edits THIS rule,
// never a per-type alias (the parity gate in `registry-wiring.test.ts` reds against `WidgetFactory.tag`
// otherwise). Two scopes do NOT follow the rule and carry a derived tag only where the data proves it:
// `a2ui-basic` types are upstream vocabulary (`CheckBox`, `ChoicePicker`), and a persona type is often a
// composition of existing controls (`BookingForm` renders `ui-form-provider`, `FixtureBanner` a `div`). A
// persona type gets `tag` only when the rule's tag is a fleet control in the sources (`PlayingCard`).

const TAG_BY_RENAMED_TYPE: Readonly<Record<string, string>> = { AudioPlayer: 'ui-audio' }
const TAGLESS_TYPES: ReadonlySet<string> = new Set(['Option', 'MenuItem'])

/** The control tag a fleet-derived catalog type renders, or `null` for a type with no `ui-*` tag. */
export function tagForType(type: string): string | null {
  if (Object.hasOwn(TAG_BY_RENAMED_TYPE, type)) return TAG_BY_RENAMED_TYPE[type]!
  if (TAGLESS_TYPES.has(type)) return null
  return `ui-${type.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`
}

/** The fleet-derived catalog type a control tag renders, or `null` when the tag is not a `ui-*` tag. */
export function typeForTag(tag: string): string | null {
  if (!tag.startsWith('ui-')) return null
  for (const [type, renamed] of Object.entries(TAG_BY_RENAMED_TYPE)) if (renamed === tag) return type
  return tag
    .slice('ui-'.length)
    .split('-')
    .map((s) => (s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1)))
    .join('')
}

/** The one catalog whose type names derive from the fleet's tags (every other base is upstream vocabulary). */
export const FLEET_CATALOG_ID = 'agent-ui'

/** The separator `compose.ts` (catalog) builds derived ids with: `<base>--<persona>`, split on the FIRST one. */
const DERIVED_SEPARATOR = '--'

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────────────

const byId = (a: { readonly id: string }, b: { readonly id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

const consumers = (...list: Consumer[]): Consumer[] => CONSUMERS.filter((c) => list.includes(c))

const source = (path: string | undefined, record?: string): CapabilityRow['source'] => ({
  ...(path === undefined ? {} : { path }),
  ...(record === undefined ? {} : { record }),
})

function guidanceFields(entry: GuidanceEntry | undefined): Pick<CapabilityRow, 'intents' | 'notFor'> {
  if (entry === undefined) return {}
  return { intents: [...entry.intents], notFor: entry.notFor.map((e) => ({ type: e.type, why: e.why })) }
}

/**
 * One catalog scope's type and function rows. `tagOf` decides a type's derived tag: the pure rule for the
 * default catalog, a fleet-control lookup for a persona fragment, nothing for an upstream-vocabulary catalog.
 */
function scopeRows(
  scope: string,
  path: string | undefined,
  components: Readonly<Record<string, unknown>>,
  functions: Readonly<Record<string, unknown>>,
  guidance: Readonly<Record<string, GuidanceEntry>> | undefined,
  tagOf: (type: string) => string | null,
  feed: RegistrySources['feed'],
): CapabilityRow[] {
  const excludedFromFeed = new Map<string, string>()
  if (feed !== undefined && feed.catalogId === scope) for (const e of feed.excluded) excludedFromFeed.set(e.type, e.reason)

  const rows: CapabilityRow[] = []
  for (const name of Object.keys(components)) {
    const tag = tagOf(name)
    const entry = guidance === undefined || !Object.hasOwn(guidance, name) ? undefined : guidance[name]
    const status: CapabilityStatus = excludedFromFeed.has(name)
      ? { state: 'feed-excluded', reason: excludedFromFeed.get(name)! }
      : { state: 'emittable' }
    rows.push({
      id: `type:${scope}/${name}`,
      kind: 'type',
      source: source(path, name),
      status,
      consumers: consumers('prompt', 'renderer', ...(entry === undefined ? [] : (['eval'] as const))),
      name,
      scope,
      ...(tag === null ? {} : { tag }),
      ...guidanceFields(entry),
    })
  }
  for (const name of Object.keys(functions)) {
    rows.push({
      id: `function:${scope}/${name}`,
      kind: 'function',
      source: source(path, name),
      status: { state: 'shipped' },
      consumers: consumers('renderer'),
      name,
      scope,
    })
  }
  return rows.sort(byId)
}

// ── composeRegistry ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Compose the registry from `sources`. Deterministic: rows are id-sorted and carry no timestamp, so the
 * serialized registry has stable bytes. A runtime-tier-only source set (no `controls`, packs, shards or
 * exclusions) composes without throwing and simply holds no row of the build-tier kinds.
 */
export function composeRegistry(sources: RegistrySources): CapabilityRegistry {
  const controlTags = new Set((sources.controls ?? []).map((c) => c.tag))
  const ruleTag = (type: string): string | null => tagForType(type)
  const controlTag = (type: string): string | null => {
    const tag = tagForType(type)
    return tag !== null && controlTags.has(tag) ? tag : null
  }
  const noTag = (): null => null
  const base: CapabilityRow[] = []
  const personas: Record<string, CapabilityRow[]> = {}
  const typeRows: CapabilityRow[] = []

  for (const catalog of sources.catalogs) {
    base.push({
      id: `catalog:${catalog.catalogId}`,
      kind: 'catalog',
      source: source(catalog.path),
      status: { state: 'shipped' },
      consumers: consumers('prompt', 'renderer'),
      name: catalog.catalogId,
    })
    const rows = scopeRows(
      catalog.catalogId,
      catalog.path,
      catalog.components,
      catalog.functions,
      sources.guidance.base[catalog.catalogId],
      catalog.catalogId === FLEET_CATALOG_ID ? ruleTag : noTag,
      sources.feed,
    )
    base.push(...rows)
    typeRows.push(...rows)
  }

  for (const frag of sources.fragments) {
    const rows: CapabilityRow[] = [
      {
        id: `fragment:${frag.personaId}`,
        kind: 'fragment',
        source: source(frag.path),
        status: { state: 'shipped' },
        consumers: consumers('prompt', 'renderer'),
        name: frag.personaId,
        targetCatalogs: [...frag.targetCatalogs],
      },
    ]
    const own = scopeRows(
      frag.personaId,
      frag.path,
      frag.fragment.components,
      frag.fragment.functions,
      sources.guidance.persona[frag.personaId],
      controlTag,
      undefined,
    )
    rows.push(...own)
    typeRows.push(...own)
    personas[frag.personaId] = rows
  }

  for (const m of sources.miniSkills) {
    base.push({
      id: `mini-skill:${m.id}`,
      kind: 'mini-skill',
      source: source(m.path),
      status: { state: 'scoped' },
      consumers: consumers('prompt', 'shim'),
      name: m.id,
      scope: m.catalogId,
    })
  }
  for (const pack of sources.genuiPacks ?? []) {
    base.push({
      id: `genui-pack:${pack.id}`,
      kind: 'genui-pack',
      source: source(pack.path),
      status: { state: 'shipped' },
      consumers: consumers('prompt', 'shim'),
      name: pack.id,
    })
  }
  for (const shard of sources.corpusShards ?? []) {
    base.push({
      id: `corpus-shard:${shard.kind}/${shard.catalogId}`,
      kind: 'corpus-shard',
      source: source(shard.path),
      status: { state: 'scoped' },
      consumers: consumers('corpus', 'prompt'),
      name: `${shard.kind}/${shard.catalogId}`,
      scope: shard.catalogId,
      records: shard.records,
    })
  }

  if (sources.controls !== undefined) {
    const scopesByTag = new Map<string, Set<string>>()
    for (const row of typeRows) {
      if (row.tag === undefined || row.scope === undefined) continue
      const set = scopesByTag.get(row.tag) ?? new Set<string>()
      set.add(row.scope)
      scopesByTag.set(row.tag, set)
    }
    for (const control of sources.controls) {
      const catalogs = [...(scopesByTag.get(control.tag) ?? [])].sort()
      const type = typeForTag(control.tag)
      const reason = type === null ? undefined : sources.exclusions?.get(type)
      const status: CapabilityStatus =
        catalogs.length > 0 ? { state: 'catalogued' } : reason !== undefined ? { state: 'excluded', reason } : { state: 'uncatalogued' }
      base.push({
        id: `control:${control.tag}`,
        kind: 'control',
        source: source(control.path),
        status,
        consumers: consumers('site', ...(catalogs.length > 0 ? (['renderer', 'prompt'] as const) : [])),
        tag: control.tag,
        tier: control.tier,
        ...(control.description === undefined ? {} : { description: control.description }),
        uses: [...control.uses],
        catalogs,
      })
    }
  }

  base.sort(byId)
  const sortedPersonas: Record<string, CapabilityRow[]> = {}
  for (const id of Object.keys(personas).sort()) {
    const [fragment, ...rest] = personas[id]!
    sortedPersonas[id] = [fragment!, ...rest.sort(byId)]
  }
  return { base, personas: sortedPersonas }
}

// ── registryViewFor ─────────────────────────────────────────────────────────────────────────────────────

const EMPTY_VIEW = (catalogId: string): CapabilityView => ({
  catalogId,
  baseId: '',
  personaId: null,
  types: [],
  functions: [],
  retrievable: [],
  personaOnlyTypes: [],
})

/**
 * Resolve a catalog id to its composed view. The id splits on the FIRST `--` (the derived-id grammar of
 * `catalog/compose.ts`, the same split `selectionGuidanceForId` makes): a base id maps to its own rows; a
 * derived `<base>--<persona>` id maps to the base's rows plus the persona fragment's when that persona is
 * known and targets the base; an unknown persona half is the base view; an unknown base half is empty.
 * `retrievable` holds only the mini-skills and corpus shards scoped to EXACTLY `catalogId`: a derived id
 * therefore retrieves none of its base's (ADR-0172 SPEC-R6, the ruled exact filter, unchanged).
 */
export function registryViewFor(registry: CapabilityRegistry, catalogId: string): CapabilityView {
  const sep = catalogId.indexOf(DERIVED_SEPARATOR)
  const baseId = sep === -1 ? catalogId : catalogId.slice(0, sep)
  const personaHalf = sep === -1 ? null : catalogId.slice(sep + DERIVED_SEPARATOR.length)

  if (!registry.base.some((r) => r.kind === 'catalog' && r.name === baseId)) return EMPTY_VIEW(catalogId)

  const baseTypes = registry.base.filter((r) => r.kind === 'type' && r.scope === baseId)
  const baseFunctions = registry.base.filter((r) => r.kind === 'function' && r.scope === baseId)

  let personaId: string | null = null
  let personaTypes: CapabilityRow[] = []
  let personaFunctions: CapabilityRow[] = []
  if (personaHalf !== null && Object.hasOwn(registry.personas, personaHalf)) {
    const rows = registry.personas[personaHalf]!
    const fragment = rows.find((r) => r.kind === 'fragment')
    if (fragment?.targetCatalogs?.includes(baseId)) {
      personaId = personaHalf
      personaTypes = rows.filter((r) => r.kind === 'type')
      personaFunctions = rows.filter((r) => r.kind === 'function')
    }
  }

  const baseTypeNames = new Set(baseTypes.map((r) => r.name))
  return {
    catalogId,
    baseId,
    personaId,
    types: [...baseTypes, ...personaTypes],
    functions: [...baseFunctions, ...personaFunctions],
    retrievable: registry.base.filter((r) => (r.kind === 'mini-skill' || r.kind === 'corpus-shard') && r.scope === catalogId),
    personaOnlyTypes: personaTypes.map((r) => r.name!).filter((n) => !baseTypeNames.has(n)),
  }
}
