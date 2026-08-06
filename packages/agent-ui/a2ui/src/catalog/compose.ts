// compose.ts — the persona catalog compose-time overlay (ADR-0172 cl.2, SPEC-R1/R2, `persona-catalog-
// composition.spec.md`). Turns a package-authored `CatalogFragment` (a persona's local pattern set,
// SPEC-R1) into a DERIVED `Catalog` document registered beside every other catalog (SPEC-R2), via a pure
// merge function (`composeCatalog`) plus the constructor-time derive-then-register step
// (`composePersonaCatalogs`) `renderer.ts` calls once, additive to its existing three static
// registrations. Never a fork of `Registry.register` (SPEC-N4) — every derived catalog registers through
// the SAME `register()` seam ADR-0169 already built, so the FACTORY_MISSING gate (registry.ts:51-58) and
// `loadCatalog`'s re-validation both apply to a derived catalog exactly as they do to any other.
//
// Collision policy (OF1, ruled — SPEC §5): reject-loud. A local fragment's declared component OR
// function name that already exists in a targeted base's `components`/`functions` map fails THAT
// (fragment, base) pairing's composition with a `CatalogComposeError`, synchronously, at
// constructor time — never a silent override. A collision against one targeted base never blocks a
// DIFFERENT base's pairing for the same fragment (SPEC-R2 AC3's own second half).
//
// Derived-id naming (OF1b, ruled): `<base>--<persona>` (`derivedCatalogId` below) — e.g.
// `agent-ui--concierge`, `a2ui-basic--croupier`. Disambiguates by construction once composition targets
// more than one base (SPEC-N5's widening) — a bare `croupier` alone could not tell a reader or
// `sanitizeCatalog` which base it derived from.

import { validateComponent, validateFunctions, CatalogError, CatalogLoadCode } from './catalog.ts'
import type { Catalog, ComponentDef, FunctionDef } from './catalog.ts'
import { validName } from './naming.ts'
import type { CatalogEntry, CatalogRegistry, WidgetFactory } from './types.ts'

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
 * `base`'s, producing a NEW `Catalog` document under its own derived `catalogId` (OF1b). `protocolVersion`/
 * `surfaceProperties` carry through from `base` UNCHANGED (SPEC-R2 AC5) — neither is named as
 * overlay-composable by ADR-0172. Reject-loud on ANY component or function name collision (OF1, SPEC-R2
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
  if (base.surfaceProperties !== undefined) out.surfaceProperties = base.surfaceProperties
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
}

const DEFAULT_TARGET_CATALOGS: readonly string[] = ['agent-ui']

/** The resolved `targetCatalogs` for one persona package — absent/empty defaults to `['agent-ui']`
 *  alone (SPEC-R1's own widening note). The ONE place this default lives — `composePersonaCatalogs`
 *  and `derivedCatalogIdsFor` both read through here, so the two never drift. */
function targetsFor(persona: PersonaCatalogPackage): readonly string[] {
  return persona.targetCatalogs !== undefined && persona.targetCatalogs.length > 0 ? persona.targetCatalogs : DEFAULT_TARGET_CATALOGS
}

/** SPEC-N5 — the EXHAUSTIVE set of ids a `targetCatalogs` entry may legally name this wave: the two
 *  currently-registered SHORT base ids. Deliberately NOT "whatever `registry.get` resolves" — the
 *  `a2ui-basic` canonical-URI alias (`A2UI_BASIC_CANONICAL_URI`) is ALSO a real registry entry
 *  (ADR-0169 cl.13, `renderer.ts`'s third registration), but SPEC-R2's own prose is explicit that base
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
 * SPEC-R2's constructor-time derive-then-register step: for every shipped persona package and every
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
      const derived = composeCatalog(entry.catalog, persona.fragment, persona.personaId)
      const factories: Record<string, WidgetFactory> = { ...entry.factories, ...persona.factories }
      const functions =
        entry.functions !== undefined || persona.functions !== undefined ? { ...entry.functions, ...persona.functions } : undefined
      registry.register(derived, factories, functions)
    }
  }
}

/**
 * Every derived `catalogId` `composePersonaCatalogs` will register for `personas` — the SAME
 * (fragment, targeted base) pairing enumeration (`targetsFor`'s default included), computed WITHOUT a
 * live registry instance. SPEC-R3's `sanitizeCatalog` widening reads this: `agent-admin-schema.ts` is
 * pure data, with no renderer/registry instance around it, so recognizing a derived id there is a
 * static projection of the same persona/`targetCatalogs` metadata the constructor step reads — not a
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
