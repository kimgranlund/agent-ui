// selection-guidance.ts: per-type SELECTION guidance for the catalog-derived prompt inventory.
//
// Each shipped catalog carries a `selection.json` sidecar beside its `catalog.json`: for every
// agent-emittable type, 1 to 3 `intents` (the job, in the user's words) and 0 to 4 `notFor` edges
// (`{ type, why }`: a confusable sibling and the axis that tells them apart). The guidance is prompt-only
// prose the renderer and validator never read, so it lives beside the agent rather than inside
// `catalog.json` (the ADR-0097 `feed-catalog.ts` precedent: per-type policy beside the agent, never a
// policy view inside the catalog; it also keeps the prose out of every browser renderer bundle).
//
// Node-only, like `system-prompt.ts`/`mini-skills.ts`: the five sidecars load at MODULE LOAD through
// `readFileSync` from `process.cwd()` (the TKT-0044 rule, never `import.meta.url`). No value import from
// `../catalog/`: the persona `manifest.ts` files import `catalog.json` without an import attribute, so a
// plain-Node import of `@agent-ui/a2ui/agent` would throw `ERR_IMPORT_ATTRIBUTE_MISSING`. That is also why
// the persona list below is hard-coded; `catalog/selection-guidance.test.ts` holds it equal to
// `SHIPPED_PERSONA_CATALOG_MANIFESTS` (coverage is a gate, never a hand-checked list).
//
// Two consumers: the catalog inventory (`system-prompt.ts` `catalogInventory`, through
// `selectionGuidanceFor` and `renderSelectionClause`) and the genui dogfood inventory
// (`dogfood-inventory.ts` `dogfoodInventory`, through `selectionGuidanceForId` and
// `renderSelectionClauseWith`, with `notFor` targets re-spelled as `ui-*` tags). The dogfood module has no
// `Catalog` object, hence the id-keyed resolver; both clauses come from the one formatter.

import { readFileSync } from 'node:fs'
import type { Catalog } from '../catalog/catalog.ts'

declare const process: { cwd(): string }

const CATALOG_DIR = `${process.cwd()}/packages/agent-ui/a2ui/src/catalog`

/** One `notFor` edge: a confusable sibling type and the axis that separates it from this type. */
export interface SelectionEdge {
  readonly type: string
  readonly why: string
}

/** One type's selection guidance. */
export interface SelectionEntry {
  readonly intents: readonly string[]
  readonly notFor: readonly SelectionEdge[]
}

/** Type id to its guidance, for one catalog (or one derived catalog's base plus persona union). */
export type SelectionGuidance = Readonly<Record<string, SelectionEntry>>

/** Load-time and render-time diagnostic codes. */
export const SelectionGuidanceErrorCode = {
  /** A shape defect, a separator or em dash in the text, a duplicate or self edge, a restatement, or a pin mismatch. */
  MALFORMED: 'SELECTION_GUIDANCE_MALFORMED',
  /** A count or length cap breach (intents 1..3 of 1..60 chars; notFor 0..4, each `why` 1..90 chars). */
  CAP: 'SELECTION_GUIDANCE_CAP',
  /** A `notFor` target that is not a component of the catalog the clause renders against. */
  UNRESOLVED: 'SELECTION_GUIDANCE_UNRESOLVED',
} as const
export type SelectionGuidanceErrorCode = (typeof SelectionGuidanceErrorCode)[keyof typeof SelectionGuidanceErrorCode]

/** Thrown by the loader and the clause renderer (the `CatalogComposeError` shape in `catalog/compose.ts`). */
export class SelectionGuidanceError extends Error {
  readonly code: SelectionGuidanceErrorCode
  constructor(code: SelectionGuidanceErrorCode, message: string) {
    super(message)
    this.name = 'SelectionGuidanceError'
    this.code = code
  }
}

const INTENTS_MAX = 3
const INTENT_CHARS_MAX = 60
const NOT_FOR_MAX = 4
const WHY_CHARS_MAX = 90

const MIDDLE_DOT = '·'
const EM_DASH = '\u2014'
const PIN_KEYS = ['catalogId', 'personaId'] as const

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Lowercase and strip non-alphanumerics: the anti-restatement comparison form. */
const normalize = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function malformed(message: string): SelectionGuidanceError {
  return new SelectionGuidanceError(SelectionGuidanceErrorCode.MALFORMED, `SELECTION_GUIDANCE_MALFORMED: ${message}`)
}

function cap(message: string): SelectionGuidanceError {
  return new SelectionGuidanceError(SelectionGuidanceErrorCode.CAP, `SELECTION_GUIDANCE_CAP: ${message}`)
}

/** The separator-safety and no-em-dash rules every authored string obeys. */
function assertSafeText(where: string, text: string): void {
  if (text.includes(MIDDLE_DOT)) throw malformed(`${where} contains the clause separator "${MIDDLE_DOT}"`)
  if (text.includes(EM_DASH)) throw malformed(`${where} contains an em dash`)
}

function hasExactKeys(obj: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(obj)
  return own.length === keys.length && keys.every((k) => Object.hasOwn(obj, k))
}

function loadEntry(typeName: string, raw: unknown): SelectionEntry {
  assertSafeText(`type name "${typeName}"`, typeName)
  if (!isObject(raw) || !hasExactKeys(raw, ['intents', 'notFor'])) {
    throw malformed(`"${typeName}" must be an object with exactly the keys "intents" and "notFor"`)
  }
  const { intents: rawIntents, notFor: rawNotFor } = raw
  if (!Array.isArray(rawIntents)) throw malformed(`"${typeName}".intents must be an array`)
  if (!Array.isArray(rawNotFor)) throw malformed(`"${typeName}".notFor must be an array`)

  if (rawIntents.length < 1 || rawIntents.length > INTENTS_MAX) {
    throw cap(`"${typeName}" has ${rawIntents.length} intents (1..${INTENTS_MAX})`)
  }
  const intents: string[] = []
  for (const intent of rawIntents as unknown[]) {
    if (typeof intent !== 'string') throw malformed(`"${typeName}".intents holds a non-string`)
    if (intent.length < 1 || intent.length > INTENT_CHARS_MAX) {
      throw cap(`"${typeName}" intent "${intent}" is ${intent.length} chars (1..${INTENT_CHARS_MAX})`)
    }
    assertSafeText(`"${typeName}" intent "${intent}"`, intent)
    if (intent.includes(';')) throw malformed(`"${typeName}" intent "${intent}" contains the intent separator ";"`)
    if (normalize(intent) === normalize(typeName)) throw malformed(`"${typeName}" intent "${intent}" only restates the type name`)
    intents.push(intent)
  }

  if (rawNotFor.length > NOT_FOR_MAX) throw cap(`"${typeName}" has ${rawNotFor.length} notFor edges (0..${NOT_FOR_MAX})`)
  const notFor: SelectionEdge[] = []
  const targets = new Set<string>()
  for (const edge of rawNotFor as unknown[]) {
    if (!isObject(edge) || !hasExactKeys(edge, ['type', 'why'])) {
      throw malformed(`"${typeName}".notFor holds an edge that is not exactly { type, why }`)
    }
    const { type, why } = edge
    if (typeof type !== 'string' || type.length === 0) throw malformed(`"${typeName}".notFor holds an edge with no target type`)
    if (typeof why !== 'string') throw malformed(`"${typeName}" -> "${type}" why must be a string`)
    if (why.length < 1 || why.length > WHY_CHARS_MAX) {
      throw cap(`"${typeName}" -> "${type}" why is ${why.length} chars (1..${WHY_CHARS_MAX})`)
    }
    assertSafeText(`"${typeName}" edge target "${type}"`, type)
    assertSafeText(`"${typeName}" -> "${type}" why`, why)
    if (why.includes('(') || why.includes(')')) throw malformed(`"${typeName}" -> "${type}" why contains a parenthesis`)
    if (type === typeName) throw malformed(`"${typeName}" has a self edge`)
    if (targets.has(type)) throw malformed(`"${typeName}" names "${type}" twice in notFor`)
    if (normalize(why) === normalize(type)) throw malformed(`"${typeName}" -> "${type}" why only restates the target name`)
    targets.add(type)
    notFor.push(Object.freeze({ type, why }))
  }

  return Object.freeze({ intents: Object.freeze(intents), notFor: Object.freeze(notFor) })
}

/**
 * Validate one `selection.json` document and return its `types` map. The root carries exactly one pin
 * key (`catalogId` for a base catalog, `personaId` for a persona fragment, a non-empty string) plus a
 * `types` object. Shape defects throw `MALFORMED`; count and length breaches throw `CAP`. The pin's VALUE
 * is checked by the module-load reader below, not here.
 */
export function loadSelectionGuidance(doc: unknown): SelectionGuidance {
  if (!isObject(doc)) throw malformed('the document must be a JSON object')
  const pins = PIN_KEYS.filter((k) => Object.hasOwn(doc, k))
  if (pins.length !== 1 || !hasExactKeys(doc, [pins[0]!, 'types'])) {
    throw malformed('the document must hold exactly one of "catalogId"/"personaId" plus "types"')
  }
  const pin = doc[pins[0]!]
  if (typeof pin !== 'string' || pin.length === 0) throw malformed(`"${pins[0]}" must be a non-empty string`)
  if (!isObject(doc.types)) throw malformed('"types" must be an object')

  const out: Record<string, SelectionEntry> = {}
  for (const [typeName, raw] of Object.entries(doc.types)) out[typeName] = loadEntry(typeName, raw)
  return Object.freeze(out)
}

function readPinned(rel: string, pinKey: (typeof PIN_KEYS)[number], pinValue: string): SelectionGuidance {
  const path = `${CATALOG_DIR}/${rel}`
  let doc: unknown
  try {
    doc = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    throw malformed(`${path} is not readable JSON (${e instanceof Error ? e.message : String(e)})`)
  }
  const guidance = loadSelectionGuidance(doc)
  if ((doc as Record<string, unknown>)[pinKey] !== pinValue) throw malformed(`${path} must pin ${pinKey} "${pinValue}"`)
  return guidance
}

/** The shipped persona fragments with a sidecar, hard-coded for the plain-Node reason in the header. */
const PERSONA_IDS = ['concierge', 'croupier', 'fixture-demo'] as const

const BASE_GUIDANCE: Readonly<Record<string, SelectionGuidance>> = Object.freeze({
  'agent-ui': readPinned('default/selection.json', 'catalogId', 'agent-ui'),
  'a2ui-basic': readPinned('a2ui-basic/selection.json', 'catalogId', 'a2ui-basic'),
})

const PERSONA_GUIDANCE: Readonly<Record<string, SelectionGuidance>> = Object.freeze(
  Object.fromEntries(PERSONA_IDS.map((id) => [id, readPinned(`personas/${id}/selection.json`, 'personaId', id)])),
)

const EMPTY: SelectionGuidance = Object.freeze({})

/**
 * Resolve a catalog id to its guidance: `agent-ui` and `a2ui-basic` map to their own sidecars; a derived
 * `<base>--<persona>` id (`compose.ts` `derivedCatalogId`, split on the FIRST `--`) maps to the base
 * entries plus the persona's (base only when the persona half is unknown, empty when the base half is).
 * Any other id, including the inbound-only canonical-URI alias, maps to `{}`. The id-keyed seam for a
 * consumer with no `Catalog` object (`dogfood-inventory.ts`).
 */
export function selectionGuidanceForId(id: string): SelectionGuidance {
  const sep = id.indexOf('--')
  if (sep === -1) return Object.hasOwn(BASE_GUIDANCE, id) ? BASE_GUIDANCE[id]! : EMPTY
  const baseId = id.slice(0, sep)
  const personaId = id.slice(sep + 2)
  if (!Object.hasOwn(BASE_GUIDANCE, baseId)) return EMPTY
  const base = BASE_GUIDANCE[baseId]!
  if (!Object.hasOwn(PERSONA_GUIDANCE, personaId)) return base
  return Object.freeze({ ...base, ...PERSONA_GUIDANCE[personaId]! })
}

/** Resolve a catalog to its guidance, keyed on `catalogId` only (`selectionGuidanceForId`'s rules). */
export function selectionGuidanceFor(catalog: Catalog): SelectionGuidance {
  return selectionGuidanceForId(catalog.catalogId)
}

/**
 * The one clause formatter: `''` for a missing entry; otherwise ` · use: <intents joined by "; ">`, then,
 * when `notFor` is non-empty, ` · not for: <labelFor(type) (why), ...>`. `labelFor` names each edge
 * target in the consumer's dialect (identity for the catalog inventory, a `ui-*` tag for the dogfood
 * inventory). It resolves nothing itself: each caller owns its `UNRESOLVED` check.
 */
export function renderSelectionClauseWith(entry: SelectionEntry | undefined, labelFor: (type: string) => string): string {
  if (entry === undefined) return ''
  const use = ` ${MIDDLE_DOT} use: ${entry.intents.join('; ')}`
  if (entry.notFor.length === 0) return use
  return `${use} ${MIDDLE_DOT} not for: ${entry.notFor.map((e) => `${labelFor(e.type)} (${e.why})`).join(', ')}`
}

/**
 * Render one inventory clause: ` · use: <intents joined by "; ">`, then, when `notFor` is non-empty,
 * ` · not for: <Type (why), ...>`. Throws `UNRESOLVED` when an edge target is not a component of
 * `catalog`. A missing entry renders `''` and never throws: coverage belongs to the gate
 * (`catalog/selection-guidance.test.ts`), not the renderer.
 */
export function renderSelectionClause(entry: SelectionEntry | undefined, catalog: Catalog): string {
  if (entry === undefined) return ''
  for (const edge of entry.notFor) {
    if (!Object.hasOwn(catalog.components, edge.type)) {
      throw new SelectionGuidanceError(
        SelectionGuidanceErrorCode.UNRESOLVED,
        `SELECTION_GUIDANCE_UNRESOLVED: notFor target "${edge.type}" is not a component of catalog "${catalog.catalogId}"`,
      )
    }
  }
  return renderSelectionClauseWith(entry, (t) => t)
}

/** The character budget for the selection clauses the default catalog's inventory carries: the sum of
 *  `renderSelectionClause` lengths over every `agent-ui` type. To be enforced by the `prompt-drift.test.ts`
 *  leg the inventory wiring adds, never by runtime truncation: an over-budget sidecar is re-authored
 *  tersely, never silently clipped. The ceiling
 *  is the guidance delta no larger than the inventory it annotates, i.e. the `## Available components`
 *  section of the pinned default prompt (`live-agent/prompt-equivalence.baseline.json`, 9 570 chars at
 *  38ed6721). Value = min(ceiling, measured rounded up to the next 100, plus 300 headroom).
 *  MEASURED 2026-10-04: 8 277 chars over 80 types (144 notFor edges, 72 reciprocal pairs);
 *  ceiling 9 570; budget 8 600.
 *  This budgets one clause family; the whole composed prompt has its own budget in `prompt-budget.ts`
 *  (ADR-0234), which stays separate because that module must stay free of `node:*`. */
export const SELECTION_GUIDANCE_CHAR_BUDGET = 8_600
