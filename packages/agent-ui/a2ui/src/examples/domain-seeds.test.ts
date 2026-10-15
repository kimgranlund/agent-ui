// domain-seeds.test.ts: the validity gate for the four T-0245 domain seeds. Each validates 0-failure against its
// own catalog (the default `agent-ui`, or the derived `<base>--<persona>` document `composePersonaCatalogDocs`
// composes, which the `validate-payload` CLI cannot load), renders through a real renderer with an empty error
// channel, and passes every semantic check its preset runs live: the persona's own checks, the hidden-state checks
// and the composite-moment checks (`semanticChecksDeps`), each gated on the catalog the seed targets.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import '@agent-ui/components/all' // ADR-0233: the catalog factories import no control; the test defines the fleet
import { domainSeeds } from './domain-seeds.ts'
import { allSeeds, allBasicSeeds, allPersonaSeeds, allMultiTurnSeeds, allRepairSeeds } from './index.ts'
import { validateA2ui } from '../renderer/validate.ts'
import { createRenderer } from '../renderer/renderer.ts'
import type { A2uiClientMessage } from '../renderer/renderer.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { a2uiBasicCatalog } from '../catalog/a2ui-basic/index.ts'
import { composePersonaCatalogDocs } from '../catalog/compose.ts'
import { SHIPPED_PERSONA_CATALOG_MANIFESTS } from '../catalog/personas/manifests.ts'
import { HIDDEN_STATE_CHECKS } from '../catalog/hidden-state-checks.ts'
import { compositeMomentChecks } from '../catalog/composite-moments.ts'
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
const CATALOGS: ReadonlyMap<string, Catalog> = new Map([...BASES, ...composePersonaCatalogDocs(BASES, SHIPPED_PERSONA_CATALOG_MANIFESTS)])

/** The checks a live turn on `catalogId` runs: the persona's own, then the hidden-state and composite-moment rows. */
function liveChecks(catalogId: string, catalog: Catalog) {
  const persona = catalogId.split('--')[1]
  const own = SHIPPED_PERSONA_CATALOG_MANIFESTS.find((m) => m.personaId === persona)?.semanticChecks ?? []
  return gateChecksOnCatalog([...own, ...HIDDEN_STATE_CHECKS, ...compositeMomentChecks], catalog)
}

const isError = (m: A2uiClientMessage): m is Extract<A2uiClientMessage, { error: unknown }> => 'error' in m

describe('the T-0245 domain seeds', () => {
  it('are four, each named once across every shelf', () => {
    expect(domainSeeds).toHaveLength(4)
    const names = [...allSeeds, ...allBasicSeeds, ...allPersonaSeeds, ...allMultiTurnSeeds, ...allRepairSeeds, ...domainSeeds].map((s) => s.name)
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([])
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
