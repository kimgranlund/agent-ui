// persona-exemplars.test.ts: the standing validity gate for the persona seed shelf (`allPersonaSeeds`, T-0064).
// The same two legs `examples.test.ts` runs per seed, against each seed's own derived catalog: (a) `validateA2ui`
// against the document `composePersonaCatalogDocs` composes for that id verdicts 0-failure; (b) a real renderer
// loads the derived id, ingests every message as a JSONL line, finalizes, and emits an empty error channel. Plus
// the shelf pins (a derived id the renderer records, stamped on the seed's createSurface) and name uniqueness
// across every shelf, since the site pages key off a seed's name.
//
// jsdom reality (`examples.test.ts` header): form-associated controls call `ElementInternals.setFormValue` and
// `setValidity`, which jsdom lacks, so the prototype stubs are applied for this suite only.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import '@agent-ui/components/all' // ADR-0233: the catalog factories import no control; the test defines the fleet
import { allSeeds, allBasicSeeds, allPersonaSeeds, allMultiTurnSeeds, allRepairSeeds } from './index.ts'
import type { PersonaExampleSeed } from './types.ts'
import { validateA2ui } from '../renderer/validate.ts'
import { createRenderer } from '../renderer/renderer.ts'
import type { A2uiClientMessage } from '../renderer/renderer.ts'
import { BUILTIN_CATALOG_RECORDS } from '../catalog/records.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { a2uiBasicCatalog } from '../catalog/a2ui-basic/index.ts'
import { composePersonaCatalogDocs } from '../catalog/compose.ts'
import { SHIPPED_PERSONA_CATALOG_MANIFESTS } from '../catalog/personas/manifests.ts'
import type { Catalog } from '../catalog/catalog.ts'
import { isDerivedCatalogId } from '../catalog/catalog-id.ts'

// T-0041 (ADR-0241): warm the default catalog body once, at top level, as `examples.test.ts` does.
await createRenderer().preload('agent-ui')

let savedSetFormValue: unknown
let savedSetValidity: unknown
beforeAll(() => {
  savedSetFormValue = ElementInternals.prototype.setFormValue
  savedSetValidity = ElementInternals.prototype.setValidity
  if (typeof ElementInternals.prototype.setFormValue !== 'function') {
    ElementInternals.prototype.setFormValue = function (): void {}
  }
  if (typeof ElementInternals.prototype.setValidity !== 'function') {
    ElementInternals.prototype.setValidity = function (): void {}
  }
})
afterAll(() => {
  ElementInternals.prototype.setFormValue = savedSetFormValue as typeof ElementInternals.prototype.setFormValue
  ElementInternals.prototype.setValidity = savedSetValidity as typeof ElementInternals.prototype.setValidity
})

const isError = (m: A2uiClientMessage): m is Extract<A2uiClientMessage, { error: unknown }> => 'error' in m

/** Every derived `<base>--<persona>` id the renderer records. */
const DERIVED_IDS: readonly string[] = BUILTIN_CATALOG_RECORDS.map((r) => r.id).filter(isDerivedCatalogId)

/** Each derived id's composed catalog document, over the two real bases. */
const DERIVED_DOCS: ReadonlyMap<string, Catalog> = composePersonaCatalogDocs(
  new Map<string, Catalog>([
    ['agent-ui', defaultCatalog],
    ['a2ui-basic', a2uiBasicCatalog],
  ]),
  SHIPPED_PERSONA_CATALOG_MANIFESTS,
)

/** The jsdom real-host smoke (`examples.test.ts` `renderSmoke`): load each named catalog, mount, ingest every
 *  message as a JSONL line, finalize, dispose, and return every client message the host emitted. */
async function renderSmoke(seed: PersonaExampleSeed): Promise<A2uiClientMessage[]> {
  const sent: A2uiClientMessage[] = []
  const r = createRenderer()
  for (const message of seed.messages) if ('createSurface' in message) await r.preload(message.createSurface.catalogId)
  r.onClientMessage((m) => void sent.push(m))
  const mount = document.createElement('div')
  document.body.appendChild(mount)
  r.mount(mount)
  for (const message of seed.messages) r.ingest(JSON.stringify(message))
  r.finalize(seed.surfaceId)
  r.dispose()
  mount.remove()
  return sent
}

describe('the persona seed shelf (T-0064): shape', () => {
  it('every persona seed pins a derived catalog id and stamps it on its createSurface', () => {
    expect(allPersonaSeeds.length, 'anti-vacuous: the shelf is not empty').toBeGreaterThan(0)
    for (const seed of allPersonaSeeds) {
      expect(seed.protocolVersion, seed.name).toBe('v1.0')
      expect(DERIVED_IDS, seed.name).toContain(seed.catalogId)
      const stamped = seed.messages.flatMap((m) => ('createSurface' in m ? [m.createSurface.catalogId] : []))
      expect(stamped, seed.name).toEqual([seed.catalogId])
    }
  })

  it('every seed name is unique across every shelf', () => {
    const names = [...allSeeds, ...allBasicSeeds, ...allPersonaSeeds, ...allMultiTurnSeeds, ...allRepairSeeds].map((s) => s.name)
    const dupes = names.filter((n, i) => names.indexOf(n) !== i)
    expect(dupes).toEqual([])
  })
})

describe('the persona seed shelf (T-0064): standing validity gate', () => {
  for (const seed of allPersonaSeeds) {
    describe(`seed: ${seed.name}`, () => {
      it('validates 0-failure against its composed derived catalog', () => {
        const catalog = DERIVED_DOCS.get(seed.catalogId)
        expect(catalog, `no composed document for ${seed.catalogId}`).toBeDefined()
        expect(validateA2ui(seed.messages, catalog!)).toEqual({ valid: true, failures: [] })
      })

      it('renders through a real renderer on its derived id with an empty error channel', async () => {
        const sent = await renderSmoke(seed)
        expect(sent.filter(isError)).toEqual([])
      })
    })
  }
})
