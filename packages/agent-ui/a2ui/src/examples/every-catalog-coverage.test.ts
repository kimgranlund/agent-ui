// every-catalog-coverage.test.ts: the every-catalog coverage gate (T-0064). Every catalog id the renderer records
// (`BUILTIN_CATALOG_RECORDS`, held equal to the shipped folders and persona pairings by `records.test.ts`), minus
// the inbound-only a2ui-basic canonical-URI alias (ADR-0169 cl.13), must have a seed rendering each of its OWN
// component types, or an entry in `CATALOG_COVERAGE_EXEMPT` naming why not.
//
// A base catalog owns every component it declares. A derived `<base>--<persona>` catalog owns only its persona
// fragment's types (its keys minus its base's), because the base types are already the base's to cover. The
// coverage source is `seedsForCatalog(id)` alone, the same function the catalog preview page reads, never the
// corpus shard: a type covered only by the corpus would still show an empty card on the page.
//
// Both predicates are named functions shared by the standing legs and the planted legs at the end, which prove
// each one reports the defect it exists to catch (the `allowlistResidue` precedent, `catalog/default/index.test.ts`).

import { describe, it, expect } from 'vitest'
import { CATALOG_COVERAGE_EXEMPT, seedsForCatalog } from './index.ts'
import { BUILTIN_CATALOG_RECORDS } from '../catalog/records.ts'
import { A2UI_BASIC_CANONICAL_URI, a2uiBasicCatalog } from '../catalog/a2ui-basic/index.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { composePersonaCatalogDocs } from '../catalog/compose.ts'
import { SHIPPED_PERSONA_CATALOG_MANIFESTS } from '../catalog/personas/manifests.ts'
import type { Catalog } from '../catalog/catalog.ts'
import type { A2uiServerMessage } from '../protocol.ts'
import { isDerivedCatalogId, splitCatalogId } from '../catalog/catalog-id.ts'

type Exemptions = Readonly<Record<string, Readonly<Record<string, string>>>>
type SeedsFor = (catalogId: string) => readonly { messages: readonly A2uiServerMessage[] }[]

/** Every catalog id the gate judges: the renderer's records minus the canonical-URI alias. */
const catalogIds = (): string[] => BUILTIN_CATALOG_RECORDS.map((r) => r.id).filter((id) => id !== A2UI_BASIC_CANONICAL_URI)

/** The two base documents and every derived document the shipped personas compose over them. */
function catalogDocuments(): Map<string, Catalog> {
  const bases = new Map<string, Catalog>([
    ['agent-ui', defaultCatalog],
    ['a2ui-basic', a2uiBasicCatalog],
  ])
  return new Map([...bases, ...composePersonaCatalogDocs(bases, SHIPPED_PERSONA_CATALOG_MANIFESTS)])
}

/** The types `id` owns: every component of a base; a derived id's components minus its base's. */
function ownTypes(id: string, docs: ReadonlyMap<string, Catalog>): string[] {
  const doc = docs.get(id)
  if (doc === undefined) return []
  const split = splitCatalogId(id)
  if (split.tail === undefined) return Object.keys(doc.components)
  const base = docs.get(split.base)
  return Object.keys(doc.components).filter((type) => base === undefined || !Object.hasOwn(base.components, type))
}

/** Every component type an `updateComponents` message in `seeds` renders. */
function renderedTypes(seeds: readonly { messages: readonly A2uiServerMessage[] }[]): Set<string> {
  const used = new Set<string>()
  for (const seed of seeds) {
    for (const m of seed.messages) {
      const uc = (m as { updateComponents?: { components?: { component?: string }[] } }).updateComponents
      for (const c of uc?.components ?? []) if (c.component !== undefined) used.add(c.component)
    }
  }
  return used
}

/** `catalogId:type` for each own type of each id that no seed renders and no exemption names. */
function uncoveredTypes(ids: readonly string[], docs: ReadonlyMap<string, Catalog>, seedsFor: SeedsFor, exempt: Exemptions): string[] {
  const out: string[] = []
  for (const id of ids) {
    const used = renderedTypes(seedsFor(id))
    for (const type of ownTypes(id, docs)) {
      if (!used.has(type) && exempt[id]?.[type] === undefined) out.push(`${id}:${type}`)
    }
  }
  return out
}

/** Exemption entries that no longer hold: an id the gate does not judge, a type that id does not own, or a type a
 *  seed now renders. */
function exemptionResidue(ids: readonly string[], docs: ReadonlyMap<string, Catalog>, seedsFor: SeedsFor, exempt: Exemptions): string[] {
  const out: string[] = []
  for (const [id, types] of Object.entries(exempt)) {
    if (!ids.includes(id)) {
      out.push(`${id}: not a judged catalog id`)
      continue
    }
    const own = ownTypes(id, docs)
    const used = renderedTypes(seedsFor(id))
    for (const type of Object.keys(types)) {
      if (!own.includes(type)) out.push(`${id}:${type}: not an own type`)
      else if (used.has(type)) out.push(`${id}:${type}: a seed renders it`)
    }
  }
  return out
}

describe('the every-catalog coverage gate (T-0064)', () => {
  it('every shipped catalog id the renderer records has a catalog document', () => {
    const ids = catalogIds()
    const docs = catalogDocuments()
    const bases = ids.filter((id) => !isDerivedCatalogId(id))
    const derived = ids.filter(isDerivedCatalogId)
    expect(bases.length, `anti-vacuous: at least two bases, got ${bases.join(', ')}`).toBeGreaterThanOrEqual(2)
    expect(derived.length, 'anti-vacuous: at least one derived id').toBeGreaterThanOrEqual(1)
    expect(ids.filter((id) => !docs.has(id)), 'record ids with no catalog document').toEqual([])
  })

  it('no type of any shipped catalog is example-less outside CATALOG_COVERAGE_EXEMPT', () => {
    const uncovered = uncoveredTypes(catalogIds(), catalogDocuments(), seedsForCatalog, CATALOG_COVERAGE_EXEMPT)
    expect(uncovered, `catalog type(s) with no seed, add one or exempt it: ${uncovered.join(', ')}`).toEqual([])
  })

  it('CATALOG_COVERAGE_EXEMPT carries no residue', () => {
    expect(exemptionResidue(catalogIds(), catalogDocuments(), seedsForCatalog, CATALOG_COVERAGE_EXEMPT)).toEqual([])
  })

  it('the gate bites: a planted uncovered type and a planted residue entry are both reported', () => {
    const docs = catalogDocuments()
    const planted: Catalog = { ...defaultCatalog, catalogId: 'agent-ui--planted', components: { ...defaultCatalog.components, PlantedWidget: { name: 'PlantedWidget', properties: {} } } }
    docs.set('agent-ui--planted', planted)
    const ids = [...catalogIds(), 'agent-ui--planted']
    expect(uncoveredTypes(ids, docs, seedsForCatalog, CATALOG_COVERAGE_EXEMPT)).toContain('agent-ui--planted:PlantedWidget')
    const plantedExempt: Exemptions = { ...CATALOG_COVERAGE_EXEMPT, 'agent-ui': { Button: 'planted: seeds render Button' } }
    expect(exemptionResidue(catalogIds(), catalogDocuments(), seedsForCatalog, plantedExempt)).toEqual(['agent-ui:Button: a seed renders it'])
  })
})
