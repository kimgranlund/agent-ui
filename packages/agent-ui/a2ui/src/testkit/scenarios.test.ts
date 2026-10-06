// scenarios.test.ts: every committed green scenario runs clean through the mounted loop in jsdom, rounds
// turns through the real producer (T-0011). A zero-file glob fails the file.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { armOffline } from '../../tools/testkit/offline.ts'
import { kitScenarioFiles } from '../../tools/testkit/load.vite.ts'
import { resolveKitCatalog } from '../../tools/testkit/catalogs.ts'
import { parseScenario } from '../../tools/testkit/scenario.ts'
import { runScenario } from '../../tools/testkit/interaction.ts'
import { produceTurn } from '../../tools/testkit/producer-leg.ts'

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

const files = kitScenarioFiles()

describe('green scenarios', () => {
  it('the scenario glob is not empty', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const f of files) {
    it(f.name, async () => {
      const r = await runScenario(parseScenario(f.raw), { resolveCatalog: resolveKitCatalog, produceTurn })
      expect(r.findings).toEqual([])
    })
  }
})
