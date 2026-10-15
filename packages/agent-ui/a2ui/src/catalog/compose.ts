// compose.ts — the persona catalog compose-time overlay (ADR-0172 cl.2, SPEC-R1/R2, `persona-catalog-
// composition.spec.md`). Turns a package-authored `CatalogFragment` (a persona's local pattern set,
// SPEC-R1) into a DERIVED `Catalog` document registered beside every other catalog (SPEC-R2), via a pure
// merge function (`composeCatalog`), the pure per-pairing entry (`composePersonaEntry`), and the
// derive-then-register step (`composePersonaCatalogs`) a project persona runs against a registry. The
// SHIPPED personas derive at load time instead (ADR-0241 cl.8): each `<base>--<persona>` id is a lazy record
// (`records.ts`) whose body is `composePersonaEntry`'s result. Never a fork of `Registry.register` (SPEC-N4):
// every derived catalog registers through the SAME `register()` path ADR-0169 already built, so the
// FACTORY_MISSING gate and `loadCatalog`'s re-validation both apply to a derived catalog exactly as they do
// to any other.
//
// Collision policy (OF1, ruled — SPEC §5): reject-loud. A local fragment's declared component OR
// function name that already exists in a targeted base's `components`/`functions` map fails THAT
// (fragment, base) pairing's composition with a `CatalogComposeError`, synchronously, when the pairing
// composes (registration for a project persona, body load for a shipped one), never a silent override. A
// collision against one targeted base never blocks a DIFFERENT base's pairing for the same fragment
// (SPEC-R2 AC3's own second half).
//
// Derived-id naming (OF1b, ruled): `<base>--<persona>` (`derivedCatalogId` below) — e.g.
// `agent-ui--concierge`, `a2ui-basic--croupier`. Disambiguates by construction once composition targets
// more than one base (SPEC-N5's widening) — a bare `croupier` alone could not tell a reader or
// `sanitizeCatalog` which base it derived from.
//
// Control loaders (ADR-0233). A persona package may ship `controls` records for controls outside
// `@agent-ui/components`; the derived entry's loader (`composeControlLoaders`) routes those tags to a loader
// over the persona records and every other tag to the base entry's loader. `@agent-ui/components/loader` is
// DOM-free at module top level, so this module stays importable from the Node and Workers tools that run
// the DOM-less compose step (`composePersonaCatalogDocs`, GH #516).

import { createControlLoader } from '@agent-ui/components/loader'
import type { ControlLoader, ControlRecord } from '@agent-ui/components/loader'
import { validateComponent, validateFunctions, CatalogError, CatalogLoadCode } from './catalog.ts'
import type { Catalog, ComponentDef, FunctionDef } from './catalog.ts'
import { validName } from './naming.ts'
import { domainCatalogId, parseDomainCatalogId } from './catalog-id.ts'
import type { CatalogEntry, CatalogRegistry, VariantDispatch, WidgetFactory } from './types.ts'
import type { SemanticCheck } from './semantic-check.ts'

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * A persona-scoped local pattern set's LOADED content (SPEC-R1 · §2 "Local pattern set / local
 * fragment") — typed `components`/`functions` maps mirroring `catalog.json`'s own shape, but never a
 * whole `Catalog`: no `catalogId`/`protocolVersion` of its own (those come from whichever base(s) it
 * composes onto, SPEC-R2). `loadCatalogFragment` is the load-time gate producing this shape.
 */
export interface CatalogFragment {
  components: Record<string, ComponentDef>
  functions: Record<string, FunctionDef>
}

/**
 * Parse + structurally validate a fragment document into a `CatalogFragment` (SPEC-R1 AC2): the SAME
 * structural + UAX-31 naming gates `loadCatalog`'s internal `validateComponent`/`validatePropDef`/
 * `validateFunctions` already run on a whole catalog — reused directly, never re-implemented — but
 * WITHOUT `loadCatalog`'s whole-document-only "`≥1 component`" invariant, since an empty fragment
 * (`components: {}`) is the legal identity-case input SPEC-R2 AC1 requires. Throws `CatalogError`
 * (`MALFORMED`/`NAME_INVALID`, catalog.ts's own codes) on any structural defect — a malformed or
 * `@`-prefixed fragment name fails load exactly as a malformed whole-catalog document does today.
 */
export function loadCatalogFragment(json: unknown): CatalogFragment {
  const root: unknown = typeof json === 'string' ? (JSON.parse(json) as unknown) : json
  if (!isObject(root)) throw new CatalogError(CatalogLoadCode.MALFORMED, 'catalog fragment must be a JSON object')

  const rawComponents = root.components
  if (rawComponents !== undefined && !isObject(rawComponents)) {
    throw new CatalogError(CatalogLoadCode.MALFORMED, 'catalog fragment .components must be an object')
  }
  const components: Record<string, ComponentDef> = {}
  for (const key of Object.keys((rawComponents as Record<string, unknown> | undefined) ?? {})) {
    if (!validName(key)) throw new CatalogError(CatalogLoadCode.NAME_INVALID, `component name "${key}" is not a valid UAX-31 / non-@ name`)
    components[key] = validateComponent(key, (rawComponents as Record<string, unknown>)[key])
  }
  const functions = validateFunctions(root.functions)
  return { components, functions }
}

/** Compose-time diagnostic codes (SPEC-R2's collision policy + the widening's own AC6 edge case). */
export const CatalogComposeErrorCode = {
  /** A fragment's declared component OR function name already exists in the targeted base (OF1, reject-loud). */
  COLLISION: 'CATALOG_COMPOSE_COLLISION',
  /** A fragment's `targetCatalogs` names an id that is not one of the two currently-registered bases
   *  (SPEC-R2 AC6) — including a REGISTERED-but-illegitimate id, e.g. the `a2ui-basic` canonical-URI
   *  alias (`A2UI_BASIC_CANONICAL_URI`, ADR-0169 cl.13), which resolves via `registry.get` but is
   *  inbound-only and never a legal composition target (SPEC-R2's own prose). */
  UNKNOWN_TARGET: 'CATALOG_COMPOSE_UNKNOWN_TARGET',
} as const
export type CatalogComposeErrorCode = (typeof CatalogComposeErrorCode)[keyof typeof CatalogComposeErrorCode]

/** Thrown by `composeCatalog`/`composePersonaCatalogs`. Mirrors `RegistryError`'s existing shape
 *  (`registry.ts:23-30`) — a typed `code` + a message — the SAME fail-loud-at-construction posture
 *  `RegistryError`'s own `FACTORY_MISSING` gate already has for a malformed base catalog. */
export class CatalogComposeError extends Error {
  readonly code: CatalogComposeErrorCode
  constructor(code: CatalogComposeErrorCode, message: string) {
    super(message)
    this.name = 'CatalogComposeError'
    this.code = code
  }
}

/** OF1b — the derived-catalogId naming convention: `<base>--<persona>` (e.g. `agent-ui--concierge`,
 *  `a2ui-basic--croupier`). One derivation per (fragment, targeted base) pairing (SPEC-R2) — never a
 *  three-way merge. */
export function derivedCatalogId(baseId: string, personaId: string): string {
  return `${baseId}--${personaId}`
}

/**
 * The pure compose-time overlay (ADR-0172 cl.2): merges `local`'s `components`/`functions` maps over
 * `base`'s, producing a NEW `Catalog` document under its own derived `catalogId` (OF1b). `protocolVersion`
 * carries through from `base` UNCHANGED (SPEC-R2 AC5) — it is not named as overlay-composable by ADR-0172
 * (the catalog carries no surface-theming field to carry through — GH #531). Reject-loud on ANY component
 * or function name collision (OF1, SPEC-R2
 * AC3) — thrown synchronously, before any partial merge is ever returned. An empty fragment
 * (`components: {}`, `functions: {}`) composes to a content-equal copy of `base`'s maps (AC1's identity
 * case) — `composePersonaCatalogs`'s caller then registers the result, which re-validates it through
 * `loadCatalog` (`Registry.register`), so no observable behavior differs from `base` alone.
 */
export function composeCatalog(base: Catalog, local: CatalogFragment, personaId: string): Catalog {
  const components: Record<string, ComponentDef> = { ...base.components }
  for (const [name, def] of Object.entries(local.components)) {
    if (Object.hasOwn(base.components, name)) {
      throw new CatalogComposeError(
        CatalogComposeErrorCode.COLLISION,
        `CATALOG_COMPOSE_COLLISION: persona "${personaId}"'s local fragment component "${name}" collides with base catalog "${base.catalogId}"`,
      )
    }
    components[name] = def
  }

  const functions: Record<string, FunctionDef> = { ...base.functions }
  for (const [name, def] of Object.entries(local.functions)) {
    if (Object.hasOwn(base.functions, name)) {
      throw new CatalogComposeError(
        CatalogComposeErrorCode.COLLISION,
        `CATALOG_COMPOSE_COLLISION: persona "${personaId}"'s local fragment function "${name}" collides with base catalog "${base.catalogId}"`,
      )
    }
    functions[name] = def
  }

  const out: Catalog = {
    catalogId: derivedCatalogId(base.catalogId, personaId),
    protocolVersion: base.protocolVersion,
    components,
    functions,
  }
  return out
}

/**
 * One shipped `catalog/personas/<persona-id>/` package's derive-then-register input (SPEC-R1's
 * `index.ts` export shape). `targetCatalogs` absent (or empty) defaults to `['agent-ui']` alone
 * (SPEC-R1's own widening note — a single-base fragment's authoring shape stays unchanged).
 */
export interface PersonaCatalogPackage {
  /** Stable kebab persona/preset id (SPEC-R1) — never a free-text label. */
  personaId: string
  fragment: CatalogFragment
  factories: Record<string, WidgetFactory>
  /** ADR-0169 cl.8's per-catalog function-impl override table, reused unchanged (SPEC-N4). */
  functions?: Record<string, (args: Record<string, unknown>) => unknown>
  /** Which registered base(s) this fragment composes onto — `agent-ui` and/or `a2ui-basic` (SPEC-N5, widened). */
  targetCatalogs?: readonly string[]
  /** ADR-0233: lazy records for the persona's own controls (outside `@agent-ui/components`). The derived
   *  entry's loader serves these tags; the host styles them (`'host'` mode). */
  controls?: readonly ControlRecord[]
}

/** `records` keyed by tag. */
function byTag(records: readonly ControlRecord[]): Record<string, ControlRecord> {
  const out: Record<string, ControlRecord> = {}
  for (const record of records) out[record.tag] = record
  return out
}

/**
 * The derived entry's control loader (ADR-0233): a tag with a persona record goes to a loader over the
 * persona records (`css: 'host'`), every other tag to `base`. `base` alone when the persona ships no
 * records; `undefined` when both are absent. With records but no base loader, a missing non-persona tag
 * rejects as unknown.
 */
export function composeControlLoaders(base: ControlLoader | undefined, records: readonly ControlRecord[] | undefined): ControlLoader | undefined {
  if (records === undefined || records.length === 0) return base
  const own = byTag(records)
  const persona = createControlLoader(own, { css: 'host' })
  const rest = base ?? createControlLoader({}, { css: 'host' })
  const split = (tags: Iterable<string>): [string[], string[]] => {
    const mine: string[] = []
    const others: string[] = []
    for (const tag of new Set(tags)) (Object.hasOwn(own, tag) ? mine : others).push(tag)
    return [mine, others]
  }
  return {
    missing(tags) {
      const [mine, others] = split(tags)
      return [...persona.missing(mine), ...rest.missing(others)]
    },
    async ensure(tags) {
      const [mine, others] = split(tags)
      await Promise.all([persona.ensure(mine), rest.ensure(others)])
    },
  }
}

const DEFAULT_TARGET_CATALOGS: readonly string[] = ['agent-ui']

/** The structural slice of `PersonaCatalogPackage`/`PersonaCatalogManifest` `targetsFor`/
 *  `assertLegalTarget` actually need — just `personaId`/`targetCatalogs`, never `factories`. Lets both
 *  the full (browser, factory-bearing) package shape and the manifest (server, factory-free) shape
 *  share the SAME default-resolution + legality logic below, with zero drift between the two. */
interface TargetedPersona {
  personaId: string
  targetCatalogs?: readonly string[]
}

/** The resolved `targetCatalogs` for one persona package/manifest — absent/empty defaults to
 *  `['agent-ui']` alone (SPEC-R1's own widening note). The ONE place this default lives —
 *  `composePersonaCatalogs`, `composePersonaCatalogDocs`, and `derivedCatalogIdsFor` all read through
 *  here, so none of the three ever drift. */
function targetsFor(persona: TargetedPersona): readonly string[] {
  return persona.targetCatalogs !== undefined && persona.targetCatalogs.length > 0 ? persona.targetCatalogs : DEFAULT_TARGET_CATALOGS
}

/** SPEC-N5 — the EXHAUSTIVE set of ids a `targetCatalogs` entry may legally name this wave: the two
 *  currently-registered SHORT base ids. Deliberately NOT "whatever `registry.get` resolves" — the
 *  `a2ui-basic` canonical-URI alias (`A2UI_BASIC_CANONICAL_URI`) is ALSO a real registry entry
 *  (ADR-0169 cl.13, recorded by `records.ts` beside the short id), but SPEC-R2's own prose is explicit that base
 *  "= the ALREADY-registered entry for B (`agent-ui` or `a2ui-basic` — never the canonical-URI alias,
 *  which is inbound-only and never a composition target)". A hypothetical future third base is
 *  likewise illegal here — SPEC-N5 names the boundary as "no THIRD base," not "no `a2ui-basic`." */
const LEGAL_TARGET_CATALOGS: ReadonlySet<string> = new Set(['agent-ui', 'a2ui-basic'])

/** SPEC-R2 AC6 / SPEC-R1 AC4 — reject-loud, the SAME posture a genuinely-unregistered id has, on ANY
 *  `targetCatalogs` entry outside `LEGAL_TARGET_CATALOGS`: a typo, a not-yet-shipped third base, OR a
 *  registered-but-illegitimate id (the `a2ui-basic` canonical-URI alias) — checked BEFORE `registry.get`
 *  is ever consulted, so a registered alias can never silently pass the existence check alone. */
function assertLegalTarget(baseId: string, personaId: string): void {
  if (!LEGAL_TARGET_CATALOGS.has(baseId)) {
    throw new CatalogComposeError(
      CatalogComposeErrorCode.UNKNOWN_TARGET,
      `CATALOG_COMPOSE_UNKNOWN_TARGET: persona "${personaId}" targets "${baseId}", which is not one of the two composable bases {agent-ui, a2ui-basic}`,
    )
  }
}

/**
 * SPEC-R2's derive-then-register step: for every persona package passed and every
 * base its `targetCatalogs` names, `composeCatalog` runs once against the ALREADY-registered entry for
 * that base, and the result registers via `registry.register(...)` under its own derived `catalogId`
 * (OF1b). A fragment naming BOTH bases produces TWO independently-composed, independently-registered
 * derived catalogs (SPEC-R2's own "never a three-way merge" clause). An unregistered target-base id
 * fails loud (SPEC-R2 AC6) — the SAME posture the collision case has, never a silent skip.
 *
 * Strictly upstream of `register()` (SPEC-N4): this function calls `registry.register`, it never forks
 * it — the FACTORY_MISSING gate and `loadCatalog`'s re-validation both still apply to every derived
 * catalog, unmodified.
 */
export function composePersonaCatalogs(registry: CatalogRegistry, personas: readonly PersonaCatalogPackage[]): void {
  for (const persona of personas) {
    for (const baseId of targetsFor(persona)) {
      assertLegalTarget(baseId, persona.personaId)
      const entry: CatalogEntry | undefined = registry.get(baseId)
      if (entry === undefined) {
        throw new CatalogComposeError(
          CatalogComposeErrorCode.UNKNOWN_TARGET,
          `CATALOG_COMPOSE_UNKNOWN_TARGET: persona "${persona.personaId}" targets unregistered base catalog "${baseId}"`,
        )
      }
      const derived = composePersonaEntry(entry, persona)
      registry.register(derived.catalog, derived.factories, derived.functions, derived.controls)
    }
  }
}

/**
 * One (persona, base) pairing as a catalog entry, without registering it (ADR-0241 cl.8): the derived document
 * (`composeCatalog`), the base factory table with the persona's on top, the merged function-impl tables, and the
 * composed control loader. `composePersonaCatalogs` registers what this returns; a shipped persona's lazy record
 * (`records.ts`, through `personas/body.ts`) resolves to it as its loaded body. Throws `CatalogComposeError`
 * exactly as `composeCatalog` does.
 */
export function composePersonaEntry(base: CatalogEntry, persona: PersonaCatalogPackage): CatalogEntry {
  const catalog = composeCatalog(base.catalog, persona.fragment, persona.personaId)
  const factories: Record<string, WidgetFactory | VariantDispatch> = { ...base.factories, ...persona.factories }
  const functions = base.functions !== undefined || persona.functions !== undefined ? { ...base.functions, ...persona.functions } : undefined
  const entry: CatalogEntry = functions !== undefined ? { catalog, factories, functions } : { catalog, factories }
  const controls = composeControlLoaders(base.controls, persona.controls)
  if (controls !== undefined) entry.controls = controls
  return entry
}

/**
 * GH #516 / persona-catalog-composition SPEC-R3's server-side leg — the Node/Workers-safe TWIN of
 * `PersonaCatalogPackage` (SPEC-R1's `personaId`/`fragment`/`targetCatalogs` triple), deliberately
 * WITHOUT `factories`: a `WidgetFactory` table imports `@agent-ui/components` for its `create()`
 * closures, which self-defines real `ui-*` custom elements on import — a hard crash in a DOM-less
 * server process (`HTMLElement is not defined`), never something either HTTP transport
 * (`dev-proxy-plugin.ts`/`worker/index.ts`) may import. Neither the composed prompt's catalog
 * teaching (`buildSystemPrompt`) nor the shared validator ever reads a `WidgetFactory` — only the
 * browser-side `Renderer`'s widget creation does (SPEC-R2 AC4's own point, restated here as the reason
 * a factory-free manifest is enough to satisfy BOTH server-side consumers) — so this shape is the
 * exhaustive server-side need.
 */
export interface PersonaCatalogManifest {
  /** Stable kebab persona id (SPEC-R1) — matches the same id `PersonaCatalogPackage.personaId` uses. */
  personaId: string
  fragment: CatalogFragment
  /** Which registered base(s) this fragment composes onto — `agent-ui` and/or `a2ui-basic` (SPEC-N5). */
  targetCatalogs?: readonly string[]
  /** ADR-0238: this persona's semantic checks, run by `produce()` after structural validation on
   *  every turn whose selected catalog is one of this persona's derived ids (`semanticChecksForCatalog`).
   *  Absent or empty: no check runs and the turn streams byte-identically. Pure, DOM-less functions only,
   *  since both server hosts import this manifest. */
  semanticChecks?: readonly SemanticCheck[]
}

/**
 * ADR-0238: the semantic checks for a turn's SELECTED catalog id. A derived `<base>--<persona>`
 * id resolves to that persona's declared `semanticChecks` (the same `targetsFor` pairing every derive step
 * reads); a base id, an unknown id, or a persona that declares none resolves to `[]`. Both server hosts call
 * this with the catalog `selectCatalog` actually chose, never the raw client id, so a fail-closed fallback to
 * the default catalog also falls back to no checks.
 */
export function semanticChecksForCatalog(catalogId: string, personas: readonly PersonaCatalogManifest[]): readonly SemanticCheck[] {
  for (const persona of personas) {
    if (persona.semanticChecks === undefined || persona.semanticChecks.length === 0) continue
    if (targetsFor(persona).some((baseId) => derivedCatalogId(baseId, persona.personaId) === catalogId)) return persona.semanticChecks
  }
  return []
}

// ── domain catalogs (T-0202, catalog architecture SPEC CA-R2, D2) ─────────────────────────────────────────
// A domain is a shared fragment of one field's types (`catalog/domains/<domain>/`, the persona fragment's shape).
// One turn may compose several: the derived id is `<base>--<d1>+<d2>` (`corpus/base-id.ts` `domainCatalogId`),
// the domains sorted and composed in that order, each step reject-loud against the base AND every domain composed
// before it, so two domains that share a type name never compose together. Domains are disjoint, so the order
// changes only the wire id, never the result.

/** One shipped domain's server-safe manifest (the `PersonaCatalogManifest` shape, keyed by `domainId`). */
export interface DomainCatalogManifest {
  /** Stable lowercase domain id (CA-R8): `games`, `hospitality`, `commerce`, `design`, `knowledge`. */
  domainId: string
  fragment: CatalogFragment
  /** The base(s) this domain composes onto. Absent or empty: `agent-ui` alone. */
  targetCatalogs?: readonly string[]
  /** This domain's semantic checks (D4): run on every turn whose effective catalog holds the domain, each gated
   *  on its own `requires` types (`gateChecksOnCatalog`). */
  semanticChecks?: readonly SemanticCheck[]
}

/** One shipped domain's browser package: the manifest's fragment plus its factories and optional controls. */
export interface DomainCatalogPackage {
  domainId: string
  fragment: CatalogFragment
  factories: Record<string, WidgetFactory>
  functions?: Record<string, (args: Record<string, unknown>) => unknown>
  targetCatalogs?: readonly string[]
  controls?: readonly ControlRecord[]
}

/** The `targetCatalogs` default and legality rules, shared with the persona shapes. */
const domainTargets = (d: { domainId: string; targetCatalogs?: readonly string[] }): readonly string[] =>
  targetsFor({ personaId: d.domainId, targetCatalogs: d.targetCatalogs })

/** `domains` sorted by id; a repeated id is refused (one domain composes once). */
function sortedDomains<D extends { domainId: string }>(domains: readonly D[]): D[] {
  const sorted = [...domains].sort((a, b) => (a.domainId < b.domainId ? -1 : a.domainId > b.domainId ? 1 : 0))
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.domainId === sorted[i - 1]!.domainId) {
      throw new CatalogComposeError(CatalogComposeErrorCode.COLLISION, `CATALOG_COMPOSE_COLLISION: domain "${sorted[i]!.domainId}" is composed twice`)
    }
  }
  return sorted
}

/**
 * Compose `domains` onto `base` (CA-R2): one derived `Catalog` under `<base>--<d1>+<d2>`. Each domain merges in
 * id order and throws `COLLISION` on a component or function name the base or an earlier domain already holds,
 * naming the colliding type and its owner. No domains is a content-equal copy of `base` under its own id.
 */
export function composeDomainCatalog(base: Catalog, domains: readonly { domainId: string; fragment: CatalogFragment }[]): Catalog {
  const ordered = sortedDomains(domains)
  const components: Record<string, ComponentDef> = { ...base.components }
  const functions: Record<string, FunctionDef> = { ...base.functions }
  const componentOwner = new Map<string, string>(Object.keys(base.components).map((n) => [n, `base catalog "${base.catalogId}"`]))
  const functionOwner = new Map<string, string>(Object.keys(base.functions).map((n) => [n, `base catalog "${base.catalogId}"`]))
  for (const { domainId, fragment } of ordered) {
    for (const [name, def] of Object.entries(fragment.components)) {
      const owner = componentOwner.get(name)
      if (owner !== undefined) {
        throw new CatalogComposeError(CatalogComposeErrorCode.COLLISION, `CATALOG_COMPOSE_COLLISION: domain "${domainId}" component "${name}" collides with ${owner}`)
      }
      componentOwner.set(name, `domain "${domainId}"`)
      components[name] = def
    }
    for (const [name, def] of Object.entries(fragment.functions)) {
      const owner = functionOwner.get(name)
      if (owner !== undefined) {
        throw new CatalogComposeError(CatalogComposeErrorCode.COLLISION, `CATALOG_COMPOSE_COLLISION: domain "${domainId}" function "${name}" collides with ${owner}`)
      }
      functionOwner.set(name, `domain "${domainId}"`)
      functions[name] = def
    }
  }
  return {
    catalogId: domainCatalogId(base.catalogId, ordered.map((d) => d.domainId)),
    protocolVersion: base.protocolVersion,
    components,
    functions,
  }
}

/** `domains` composed over the base entry, without registering: the derived document, the base factories with
 *  each domain's on top, the merged function tables and the control loaders chained in domain order. Every domain
 *  must target the base (`UNKNOWN_TARGET` otherwise). */
export function composeDomainEntry(base: CatalogEntry, domains: readonly DomainCatalogPackage[]): CatalogEntry {
  const ordered = sortedDomains(domains)
  for (const d of ordered) assertDomainTargets(d, base.catalog.catalogId)
  const catalog = composeDomainCatalog(base.catalog, ordered)
  let factories: Record<string, WidgetFactory | VariantDispatch> = { ...base.factories }
  let functions = base.functions
  let controls = base.controls
  for (const d of ordered) {
    factories = { ...factories, ...d.factories }
    if (d.functions !== undefined) functions = { ...functions, ...d.functions }
    controls = composeControlLoaders(controls, d.controls)
  }
  const entry: CatalogEntry = functions !== undefined ? { catalog, factories, functions } : { catalog, factories }
  if (controls !== undefined) entry.controls = controls
  return entry
}

function assertDomainTargets(d: { domainId: string; targetCatalogs?: readonly string[] }, baseId: string): void {
  for (const t of domainTargets(d)) assertLegalTarget(t, d.domainId)
  if (!domainTargets(d).includes(baseId)) {
    throw new CatalogComposeError(CatalogComposeErrorCode.UNKNOWN_TARGET, `CATALOG_COMPOSE_UNKNOWN_TARGET: domain "${d.domainId}" does not target base catalog "${baseId}"`)
  }
}

/**
 * The shipped domains an effective id names, when it is a canonical domain id over `baseIds` whose every domain
 * is in `domains` and targets that base: `{ base, domains }` in id order. `undefined` otherwise (a base id, a
 * persona id, an unknown or untargeted domain, a reversed or repeated spelling). The one parse every id reader
 * (records, sanitizer, guidance, checks) shares.
 */
export function resolveDomainCatalogId<D extends { domainId: string; targetCatalogs?: readonly string[] }>(
  catalogId: string,
  domains: readonly D[],
): { base: string; domains: readonly D[] } | undefined {
  const parsed = parseDomainCatalogId(catalogId)
  if (parsed === undefined || !LEGAL_TARGET_CATALOGS.has(parsed.base)) return undefined
  const out: D[] = []
  for (const id of parsed.domains) {
    const d = domains.find((x) => x.domainId === id)
    if (d === undefined || !domainTargets(d).includes(parsed.base)) return undefined
    out.push(d)
  }
  return { base: parsed.base, domains: out }
}

/** Every single-domain derived id (`<base>--<domain>`) the shipped `domains` produce, one per targeted base. */
export function domainCatalogIdsFor(domains: readonly { domainId: string; targetCatalogs?: readonly string[] }[]): readonly string[] {
  const out: string[] = []
  for (const d of domains) {
    for (const baseId of domainTargets(d)) {
      assertLegalTarget(baseId, d.domainId)
      out.push(domainCatalogId(baseId, [d.domainId]))
    }
  }
  return out
}

/**
 * The server-host derive step for domains: every non-empty set of `domains` that all target a base, composed
 * onto that base, keyed by its canonical id. Bounded by 2^n per base, so it stays an enumerated map the hosts'
 * `selectCatalog` reads unchanged; the renderer parses instead (`records.ts`). Reject-loud like the persona step.
 */
export function composeDomainCatalogDocs(bases: ReadonlyMap<string, Catalog>, domains: readonly DomainCatalogManifest[]): Map<string, Catalog> {
  const out = new Map<string, Catalog>()
  for (const baseId of LEGAL_TARGET_CATALOGS) {
    const base = bases.get(baseId)
    const eligible = sortedDomains(domains).filter((d) => domainTargets(d).includes(baseId))
    for (const d of eligible) for (const t of domainTargets(d)) assertLegalTarget(t, d.domainId)
    if (base === undefined) {
      if (eligible.length > 0) {
        throw new CatalogComposeError(CatalogComposeErrorCode.UNKNOWN_TARGET, `CATALOG_COMPOSE_UNKNOWN_TARGET: domain "${eligible[0]!.domainId}" targets unregistered base catalog "${baseId}"`)
      }
      continue
    }
    for (let mask = 1; mask < 1 << eligible.length; mask++) {
      const set = eligible.filter((_, i) => (mask & (1 << i)) !== 0)
      const derived = composeDomainCatalog(base, set)
      out.set(derived.catalogId, derived)
    }
  }
  return out
}

/**
 * D4: the semantic checks of every shipped domain the effective id holds, in domain order. A base id, a persona
 * id or an unknown domain resolves to none. Callers gate the result on the effective catalog's types
 * (`gateChecksOnCatalog`), so a check never demands a type the turn cannot emit.
 */
export function domainSemanticChecksForCatalog(catalogId: string, domains: readonly DomainCatalogManifest[]): readonly SemanticCheck[] {
  const resolved = resolveDomainCatalogId(catalogId, domains)
  if (resolved === undefined) return []
  return resolved.domains.flatMap((d) => d.semanticChecks ?? [])
}

/**
 * The server-host derive step (GH #516): the SAME per-(fragment, targeted base) composition
 * `composePersonaCatalogs` runs against a live `CatalogRegistry` (registering as a side effect), run
 * here against a PLAIN `catalogId → Catalog` base map instead, returning every derived `Catalog`
 * document keyed by its own derived id — no `CatalogRegistry`/`WidgetFactory` needed, so this is safe
 * to call from `dev-proxy-plugin.ts`'s Node process or `worker/index.ts`'s Workers runtime, neither of
 * which has a DOM. Reuses `composeCatalog`/`targetsFor`/`assertLegalTarget` UNCHANGED — the SAME
 * reject-loud collision (SPEC-R2 AC3) and unknown-target-base (SPEC-R2 AC6) posture as the client:  a
 * malformed shipped persona breaks BOTH server hosts' boot exactly as it fails the renderer's load of
 * that derived id (ADR-0241 cl.8), never a half-composed production surface.
 */
export function composePersonaCatalogDocs(bases: ReadonlyMap<string, Catalog>, personas: readonly PersonaCatalogManifest[]): Map<string, Catalog> {
  const out = new Map<string, Catalog>()
  for (const persona of personas) {
    for (const baseId of targetsFor(persona)) {
      assertLegalTarget(baseId, persona.personaId)
      const base = bases.get(baseId)
      if (base === undefined) {
        throw new CatalogComposeError(
          CatalogComposeErrorCode.UNKNOWN_TARGET,
          `CATALOG_COMPOSE_UNKNOWN_TARGET: persona "${persona.personaId}" targets unregistered base catalog "${baseId}"`,
        )
      }
      const derived = composeCatalog(base, persona.fragment, persona.personaId)
      out.set(derived.catalogId, derived)
    }
  }
  return out
}

/**
 * Every derived `catalogId` `composePersonaCatalogs` will register for `personas` — the SAME
 * (fragment, targeted base) pairing enumeration (`targetsFor`'s default included), computed WITHOUT a
 * live registry instance. SPEC-R3's `sanitizeCatalog` widening reads this: `agent-admin-schema.ts` is
 * pure data, with no renderer/registry instance around it, so recognizing a derived id there is a
 * static projection of the same persona/`targetCatalogs` metadata the derive step reads, not a
 * live registry-backed lookup (SPEC-R3's own "implementation choice, not fixed by this SPEC" clause).
 */
export function derivedCatalogIdsFor(personas: readonly PersonaCatalogPackage[]): readonly string[] {
  const out: string[] = []
  for (const persona of personas) {
    for (const baseId of targetsFor(persona)) {
      assertLegalTarget(baseId, persona.personaId)
      out.push(derivedCatalogId(baseId, persona.personaId))
    }
  }
  return out
}
