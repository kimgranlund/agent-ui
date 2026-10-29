// domain-seeds.test.ts: the validity gate for the T-0245 domain seeds and the T-0274 game over. Each validates 0-failure against its
// own catalog (the default `agent-ui`, or the derived `<base>--<persona>` document `composePersonaCatalogDocs`
// composes, which the `validate-payload` CLI cannot load), renders through a real renderer with an empty error
// channel, and passes every semantic check its preset runs live: the persona's own checks, the hidden-state checks
// the composite-moment checks, the framed-choice check, the option-deck count check and the single-pick check (`semanticChecksDeps`), each gated on the catalog the seed targets.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import '@agent-ui/components/all' // ADR-0233: the catalog factories import no control; the test defines the fleet
import { domainSeeds, domainAdmiralBattleshipSeed } from './domain-seeds.ts'
import { allSeeds, allBasicSeeds, allPersonaSeeds, allPersonaCorpusSeeds, allMultiTurnSeeds, allRepairSeeds } from './index.ts'
import { validateA2ui } from '../renderer/validate.ts'
import { createRenderer } from '../renderer/renderer.ts'
import type { A2uiClientMessage } from '../renderer/renderer.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { a2uiBasicCatalog } from '../catalog/a2ui-basic/index.ts'
import { composeDomainCatalogDocs, composePersonaCatalogDocs, domainSemanticChecksForCatalog, semanticChecksForCatalog } from '../catalog/compose.ts'
import { SHIPPED_PERSONA_CATALOG_MANIFESTS } from '../catalog/personas/manifests.ts'
import { SHIPPED_DOMAIN_CATALOG_MANIFESTS } from '../catalog/domains/manifests.ts'
import { HIDDEN_STATE_CHECKS } from '../catalog/hidden-state-checks.ts'
import { compositeMomentChecks } from '../catalog/composite-moments.ts'
import { framedChoiceCheck } from '../catalog/framed-choice-check.ts'
import { optionDeckCountCheck } from '../catalog/option-deck-check.ts'
import { singlePickCheck } from '../catalog/single-pick-check.ts'
import { inertPropCheck, receiptTotalCheck } from '../catalog/inert-prop-checks.ts'
import { gateChecksOnCatalog, runSemanticChecks, semanticSurfaceViews } from '../catalog/semantic-check.ts'
import type { Catalog } from '../catalog/catalog.ts'

await createRenderer().preload('agent-ui')

let savedSetFormValue: unknown
let savedSetValidity: unknown
beforeAll(() => {
  savedSetFormValue = ElementInternals.prototype.setFormValue
  savedSetValidity = ElementInternals.prototype.setValidity
  if (typeof ElementInternals.prototype.setFormValue !== 'function') ElementInternals.prototype.setFormValue = function (): void {}
  if (typeof ElementInternals.prototype.setValidity !== 'function') ElementInternals.prototype.setValidity = function (): void {}
})
afterAll(() => {
  ElementInternals.prototype.setFormValue = savedSetFormValue as typeof ElementInternals.prototype.setFormValue
  ElementInternals.prototype.setValidity = savedSetValidity as typeof ElementInternals.prototype.setValidity
})

const BASES = new Map<string, Catalog>([
  ['agent-ui', defaultCatalog],
  ['a2ui-basic', a2uiBasicCatalog],
])
const CATALOGS: ReadonlyMap<string, Catalog> = new Map([
  ...BASES,
  ...composePersonaCatalogDocs(BASES, SHIPPED_PERSONA_CATALOG_MANIFESTS),
  ...composeDomainCatalogDocs(BASES, SHIPPED_DOMAIN_CATALOG_MANIFESTS),
])

/** The checks a live turn on `catalogId` runs: the persona's or each domain's own, then the hidden-state and composite-moment rows, the framed-choice check, the option-deck count check, the single-pick check and (T-0556) the two prop-hygiene checks. */
function liveChecks(catalogId: string, catalog: Catalog) {
  const own = [
    ...semanticChecksForCatalog(catalogId, SHIPPED_PERSONA_CATALOG_MANIFESTS),
    ...domainSemanticChecksForCatalog(catalogId, SHIPPED_DOMAIN_CATALOG_MANIFESTS),
  ]
  return gateChecksOnCatalog([...own, ...HIDDEN_STATE_CHECKS, ...compositeMomentChecks, framedChoiceCheck, optionDeckCountCheck, singlePickCheck, inertPropCheck, receiptTotalCheck], catalog)
}

const isError = (m: A2uiClientMessage): m is Extract<A2uiClientMessage, { error: unknown }> => 'error' in m

describe('the T-0245 domain seeds', () => {
  it('are six, each shelved exactly once (T-0240: the base seeds on allSeeds, the persona three on allPersonaCorpusSeeds; T-0199 the Itinerary)', () => {
    expect(domainSeeds).toHaveLength(6)
    const names = [...allSeeds, ...allBasicSeeds, ...allPersonaSeeds, ...allPersonaCorpusSeeds, ...allMultiTurnSeeds, ...allRepairSeeds].map((s) => s.name)
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([])
    for (const seed of domainSeeds) expect(names.filter((n) => n === seed.name), seed.name).toHaveLength(1)
  })

  // T-0240: two properties the T-0245 verifier found no test covered.
  it('each sends its data model with every action (`createSurface.sendDataModel: true`), so the user state reaches the agent', () => {
    for (const seed of domainSeeds) {
      const creates = seed.messages.flatMap((m) => ('createSurface' in m ? [m.createSurface] : []))
      expect(creates, seed.name).toHaveLength(1)
      expect(creates[0]!.sendDataModel, seed.name).toBe(true)
    }
  })

  it('the battleship boards mark a miss with a cross and a hit with a filled dot, judged against the committed fleets', () => {
    type Cell = { row: number; col: number; mark: string }
    type Model = { secret: { fleet: Cell[]; playerFleet: Cell[] }; sea: { cells: Cell[] }; home: { cells: Cell[] } }
    const model = domainAdmiralBattleshipSeed.messages.flatMap((m) => ('updateDataModel' in m ? [m.updateDataModel.value as Model] : []))[0]!
    const holds = (fleet: Cell[], c: Cell): boolean => fleet.some((s) => s.row === c.row && s.col === c.col)
    const shots = [
      ...model.sea.cells.map((c) => ({ c, hit: holds(model.secret.fleet, c) })),
      ...model.home.cells.filter((c) => c.mark !== '■').map((c) => ({ c, hit: holds(model.secret.playerFleet, c) })),
    ]
    expect(shots.filter((s) => !s.hit).length, 'anti-vacuous: some shot missed').toBeGreaterThan(0)
    expect(shots.filter((s) => s.hit).length, 'anti-vacuous: some shot hit').toBeGreaterThan(0)
    for (const { c, hit } of shots) expect(c.mark, `${c.row},${c.col}`).toBe(hit ? '●' : '✕')
  })

  for (const seed of domainSeeds) {
    describe(seed.name, () => {
      const catalog = CATALOGS.get(seed.catalogId)

      it('validates 0-failure against its catalog', () => {
        expect(catalog, `no catalog for ${seed.catalogId}`).toBeDefined()
        expect(validateA2ui(seed.messages, catalog!)).toEqual({ valid: true, failures: [] })
      })

      it('renders through a real renderer with an empty error channel', async () => {
        const sent: A2uiClientMessage[] = []
        const r = createRenderer()
        await r.preload(seed.catalogId)
        r.onClientMessage((m) => void sent.push(m))
        const mount = document.createElement('div')
        document.body.appendChild(mount)
        r.mount(mount)
        for (const message of seed.messages) r.ingest(JSON.stringify(message))
        r.finalize(seed.surfaceId)
        r.dispose()
        mount.remove()
        expect(sent.filter(isError)).toEqual([])
      })

      it('passes every semantic check its preset runs live', () => {
        const checks = liveChecks(seed.catalogId, catalog!)
        expect(checks.length, 'anti-vacuous: some check runs').toBeGreaterThan(0)
        const surfaces = semanticSurfaceViews({ turns: [] }, [...seed.messages])
        expect(runSemanticChecks(checks, { surfaces })).toEqual({ findings: [], errored: [] })
      })
    })
  }
})
