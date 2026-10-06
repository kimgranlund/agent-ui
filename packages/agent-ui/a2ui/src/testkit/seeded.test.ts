// seeded.test.ts: every committed seeded-defect fixture reds with exactly its pinned layer and code, in jsdom
// (T-0011). The renderer layer's fixture runs through the mounted loop (`runScenario`); every other layer
// through the DOM-free runner the CLI selftest also uses. One test per LAYERS member.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { armOffline } from '../../tools/testkit/offline.ts'
import { kitSeededFiles } from '../../tools/testkit/load.vite.ts'
import { resolveKitCatalog } from '../../tools/testkit/catalogs.ts'
import { LAYERS } from '../../tools/testkit/findings.ts'
import { domFreeRunner, parseSeededDoc, runSeeded, seededFixture, seededNeedsDom } from '../../tools/testkit/seeded.ts'
import type { SeededFixture } from '../../tools/testkit/seeded.ts'
import { runScenario } from '../../tools/testkit/interaction.ts'
import { produceTurn } from '../../tools/testkit/producer-leg.ts'
import { ScenarioError } from '../../tools/testkit/scenario.ts'

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

const deps = { resolveCatalog: resolveKitCatalog }
const fixtures: SeededFixture[] = kitSeededFiles().map((f) => {
  const doc = parseSeededDoc(f.raw, f.layer!)
  if (seededNeedsDom(doc) && doc.kind === 'agent-ui-a2ui-scenario') {
    return seededFixture(doc, async () => (await runScenario(doc, { ...deps, produceTurn })).findings)
  }
  return seededFixture(doc, domFreeRunner(doc, deps))
})

describe('seeded-defect fixtures', () => {
  for (const layer of LAYERS) {
    it(`layer ${layer}: at least one fixture, each red first with exactly its pinned layer and code`, async () => {
      const mine = fixtures.filter((f) => f.layer === layer)
      expect(mine.length).toBeGreaterThan(0)
      for (const f of mine) {
        const found = await f.run()
        expect(found[0], f.name).toMatchObject(f.expectRed)
      }
    })
  }

  it('runSeeded over every fixture and every layer reports nothing', async () => {
    expect(await runSeeded(fixtures)).toEqual([])
  })

  it('a seeded doc in the wrong layer directory is a ScenarioError', () => {
    const raw = kitSeededFiles().find((f) => f.layer === 'validator')!.raw
    expect(() => parseSeededDoc(raw, 'interop')).toThrow(ScenarioError)
  })
})
