// cases.ts: the agent-behavior eval's case sources (GH #1810).
//
// Selection cases are DERIVED, never hand-listed: one case per `notFor` edge A -> B across every
// `selection.json` sidecar (ADR-0232). The case prompts for A (A's first intent, verbatim), expects A, and
// forbids B. Base cases come through `selectionGuidanceFor` on the registered base catalogs; persona cases
// come from each persona dir that holds a `selection.json`, composed against the `agent-ui` base exactly
// as the runtime derives `agent-ui--<persona>`, keeping only the edges of the fragment's OWN types.
//
// Why the persona dir is scanned and `SHIPPED_PERSONA_CATALOG_MANIFESTS` is not imported: the persona
// `manifest.ts` files import `catalog.json` without an import attribute, which plain Node rejects
// (`ERR_IMPORT_ATTRIBUTE_MISSING`; see the headers of `src/agent/selection-guidance.ts` and
// `tools/catalog-files.ts`). Everything here reads from `process.cwd()` (the repo root), the same rule
// `selection-guidance.ts` follows at module load.
//
// The persona leg's acceptance cases are the hand-authored `fixtures/persona-cases.json`, protected by
// the pinned hash in `fixtures/pins.json` (`pins.ts`). The response-type leg's labelled set (T-0060,
// RTS-R10) is the hand-authored `fixtures/response-type-cases.json`, pinned the same way.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadCatalogById } from '../catalog-files.ts'
import { composeCatalog, loadCatalogFragment } from '../../src/catalog/compose.ts'
import type { CatalogFragment } from '../../src/catalog/compose.ts'
import type { Catalog } from '../../src/catalog/catalog.ts'
import type { Session } from '../../src/agent/agent-transport.ts'
import { selectionGuidanceFor } from '../../src/agent/selection-guidance.ts'

const PERSONAS_DIR = 'packages/agent-ui/a2ui/src/catalog/personas'
const BASE_IDS = ['agent-ui', 'a2ui-basic'] as const
const PERSONA_BASE = 'agent-ui'

/** One derived selection case: prompt for `expectType`, never emit `forbidType`. */
export interface SelectionCase {
  /** `<source>:<A>-><B>`. */
  readonly id: string
  /** The sidecar pin: `agent-ui`, `a2ui-basic`, or a persona id. */
  readonly source: string
  readonly catalogId: string
  readonly expectType: string
  readonly forbidType: string
  readonly why: string
  readonly prompt: string
}

/** One persona-leg case. `expectType` is optional: a base-catalog persona (the Quant) only proves it
 *  never reaches for another persona's type. */
export interface PersonaCase {
  readonly id: string
  readonly persona: string
  readonly catalogId: string
  readonly prompt: string
  readonly expectType?: string
}

function root(): string {
  return process.cwd()
}

/** Persona ids, sorted: every dir under the personas folder that holds a `selection.json`. */
export function personaIds(): string[] {
  const dir = join(root(), PERSONAS_DIR)
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, 'selection.json')))
    .map((e) => e.name)
    .sort()
}

const fragmentCache = new Map<string, CatalogFragment>()
function personaFragment(personaId: string): CatalogFragment {
  let fragment = fragmentCache.get(personaId)
  if (fragment === undefined) {
    const doc: unknown = JSON.parse(readFileSync(join(root(), PERSONAS_DIR, personaId, 'catalog.json'), 'utf8'))
    fragment = loadCatalogFragment(doc)
    fragmentCache.set(personaId, fragment)
  }
  return fragment
}

/** Persona id to its fragment's own component types. */
export function personaFragmentTypes(): Map<string, string[]> {
  return new Map(personaIds().map((id) => [id, Object.keys(personaFragment(id).components)]))
}

const catalogCache = new Map<string, Catalog>()

/** Load a case catalog by id, cached per id: a base id (`agent-ui`, `a2ui-basic`) or a derived
 *  `agent-ui--<persona>` id composed from the persona's fragment. Throws on any other id. */
export function loadCaseCatalog(catalogId: string): Catalog {
  const cached = catalogCache.get(catalogId)
  if (cached !== undefined) return cached
  let catalog: Catalog
  if ((BASE_IDS as readonly string[]).includes(catalogId)) {
    catalog = loadCatalogById(root(), catalogId as (typeof BASE_IDS)[number])
  } else {
    const prefix = `${PERSONA_BASE}--`
    const personaId = catalogId.startsWith(prefix) ? catalogId.slice(prefix.length) : ''
    if (!personaIds().includes(personaId)) throw new Error(`agent-eval: unknown case catalog "${catalogId}"`)
    catalog = composeCatalog(loadCaseCatalog(PERSONA_BASE), personaFragment(personaId), personaId)
  }
  catalogCache.set(catalogId, catalog)
  return catalog
}

function casesFrom(source: string, catalog: Catalog, onlyTypes: readonly string[] | undefined): SelectionCase[] {
  const guidance = selectionGuidanceFor(catalog)
  const out: SelectionCase[] = []
  for (const [typeName, entry] of Object.entries(guidance)) {
    if (onlyTypes !== undefined && !onlyTypes.includes(typeName)) continue
    for (const edge of entry.notFor) {
      out.push({
        id: `${source}:${typeName}->${edge.type}`,
        source,
        catalogId: catalog.catalogId,
        expectType: typeName,
        forbidType: edge.type,
        why: edge.why,
        prompt: entry.intents[0]!,
      })
    }
  }
  return out
}

/** Exactly one case per `notFor` edge across every sidecar (the bijection `cases.test.ts` gates). */
export function deriveSelectionCases(): SelectionCase[] {
  const out: SelectionCase[] = []
  for (const id of BASE_IDS) out.push(...casesFrom(id, loadCaseCatalog(id), undefined))
  for (const [personaId, types] of personaFragmentTypes()) {
    out.push(...casesFrom(personaId, loadCaseCatalog(`${PERSONA_BASE}--${personaId}`), types))
  }
  return out
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Validate one persona case's shape; throws naming the defect. */
export function parsePersonaCase(raw: unknown): PersonaCase {
  if (!isObject(raw)) throw new Error('agent-eval: a persona case must be an object')
  const { id, persona, catalogId, prompt, expectType } = raw
  for (const [key, value] of Object.entries({ id, persona, catalogId, prompt })) {
    if (typeof value !== 'string' || value.length === 0) throw new Error(`agent-eval: persona case "${String(id)}" needs a string "${key}"`)
  }
  if (expectType !== undefined && typeof expectType !== 'string') throw new Error(`agent-eval: persona case "${String(id)}" expectType must be a string`)
  return {
    id: id as string,
    persona: persona as string,
    catalogId: catalogId as string,
    prompt: prompt as string,
    ...(expectType !== undefined ? { expectType } : {}),
  }
}

/** Read the hand-authored acceptance set, `<fixturesDir>/persona-cases.json`. */
export function loadPersonaCases(fixturesDir: string): PersonaCase[] {
  const doc: unknown = JSON.parse(readFileSync(join(fixturesDir, 'persona-cases.json'), 'utf8'))
  if (!isObject(doc) || !Array.isArray(doc.cases)) throw new Error('agent-eval: persona-cases.json must hold a "cases" array')
  return doc.cases.map(parsePersonaCase)
}

/** The three response types a labelled case may expect (RTS-R10). */
export const RESPONSE_TYPE_EXPECTS = ['text', 'surface', 'both'] as const
export type ResponseTypeExpect = (typeof RESPONSE_TYPE_EXPECTS)[number]

/** One response-type case. `session`, when given, is one prior user turn then one assistant turn stored
 *  in the RTS-R12 shape (`<note>\n<jsonl>`), threaded into `produce()` as the turn's history. */
export interface ResponseTypeCase {
  readonly id: string
  readonly catalogId: string
  readonly prompt: string
  readonly expect: ResponseTypeExpect
  readonly session?: Session
}

function parseCaseSession(raw: unknown, id: string): Session {
  const fail = (): never => {
    throw new Error(`agent-eval: response-type case "${id}" session must hold exactly one "user" then one "assistant" turn of string "content"`)
  }
  if (!isObject(raw) || !Array.isArray(raw.turns) || raw.turns.length !== 2) return fail()
  const turns = raw.turns.map((t: unknown, i: number) => {
    if (!isObject(t) || t.role !== (i === 0 ? 'user' : 'assistant') || typeof t.content !== 'string') return fail()
    return { role: t.role as 'user' | 'assistant', content: t.content as string }
  })
  return { turns }
}

/** Validate one response-type case's shape; throws naming the defect. */
export function parseResponseTypeCase(raw: unknown): ResponseTypeCase {
  if (!isObject(raw)) throw new Error('agent-eval: a response-type case must be an object')
  const { id, catalogId, prompt, expect, session } = raw
  for (const [key, value] of Object.entries({ id, catalogId, prompt })) {
    if (typeof value !== 'string' || value.length === 0) throw new Error(`agent-eval: response-type case "${String(id)}" needs a string "${key}"`)
  }
  if (typeof expect !== 'string' || !(RESPONSE_TYPE_EXPECTS as readonly string[]).includes(expect)) {
    throw new Error(`agent-eval: response-type case "${String(id)}" expect must be one of ${RESPONSE_TYPE_EXPECTS.join(', ')}`)
  }
  return {
    id: id as string,
    catalogId: catalogId as string,
    prompt: prompt as string,
    expect: expect as ResponseTypeExpect,
    ...(session !== undefined ? { session: parseCaseSession(session, id as string) } : {}),
  }
}

/** Read the hand-authored labelled set, `<fixturesDir>/response-type-cases.json`. */
export function loadResponseTypeCases(fixturesDir: string): ResponseTypeCase[] {
  const doc: unknown = JSON.parse(readFileSync(join(fixturesDir, 'response-type-cases.json'), 'utf8'))
  if (!isObject(doc) || !Array.isArray(doc.cases)) throw new Error('agent-eval: response-type-cases.json must hold a "cases" array')
  return doc.cases.map(parseResponseTypeCase)
}
