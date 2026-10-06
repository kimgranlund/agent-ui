// interaction.browser.test.ts: the kit's closed loop in a real engine (T-0011, the packages-rest shard).
// Every committed scenario whose turns all use the `lines` or `error` arm and that has at least one act:
// click, action, scripted response, updateDataModel, re-render, with the loop's order and verdict checks
// before ingest. Imports only browser-safe kit modules (no load.node.ts, kit.ts, producer-leg.ts,
// catalog-gates.ts or the agent-eval pins). Acts are programmatic and never rely on focus. In a real page
// the tripwire rejects only off-origin URLs.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { armOffline } from '../../tools/testkit/offline.ts'
import { kitScenarioFiles } from '../../tools/testkit/load.vite.ts'
import { resolveKitCatalog } from '../../tools/testkit/catalogs.ts'
import { parseScenario, isLinesTurn, isErrorTurn } from '../../tools/testkit/scenario.ts'
import { runScenario } from '../../tools/testkit/interaction.ts'

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

const loops = kitScenarioFiles()
  .map((f) => ({ name: f.name, scenario: parseScenario(f.raw) }))
  .filter(({ scenario }) => scenario.turns.every((t) => isLinesTurn(t) || isErrorTurn(t)) && scenario.turns.some((t) => t.act !== undefined))

describe('the closed loop in a real engine', () => {
  it('there is at least one act-driven lines scenario, and the tripwire still refuses an off-origin fetch', async () => {
    expect(loops.length).toBeGreaterThan(0)
    await expect(fetch('https://api.example.com/v1/messages')).rejects.toThrow(/^KIT_NETWORK/)
  })

  for (const { name, scenario } of loops) {
    it(name, async () => {
      const r = await runScenario(scenario, { resolveCatalog: resolveKitCatalog })
      expect(r.findings).toEqual([])
    })
  }
})
