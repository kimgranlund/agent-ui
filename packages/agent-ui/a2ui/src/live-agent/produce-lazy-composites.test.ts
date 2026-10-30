// produce-lazy-composites.test.ts: T-0593. The composite-moment rows left the eager `@agent-ui/a2ui/agent` bundle:
// `produce()` imports `catalog/composite-moments.ts` dynamically, once, before the first round of a turn that carries
// semantic checks. A fresh module graph proves both halves: a turn with no checks never loads the module, and the very
// first turn with checks still runs them (round 1's PRODUCT_CARD_MISSING) and still binds the missing composite on a
// later round (the T-0299 "Earlier this turn" wording, which only the lazily loaded rows produce). Keyless, scripted.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AgentProvider, TurnInput } from '../agent/agent-transport.ts'

let loads = 0
beforeEach(() => {
  loads = 0
  vi.resetModules()
  vi.doMock('../catalog/composite-moments.ts', async (importOriginal) => {
    loads++
    return importOriginal()
  })
})
afterEach(() => {
  vi.doUnmock('../catalog/composite-moments.ts')
})

const input: TurnInput = { kind: 'intent', text: 'What spa services can I book during my stay?', session: { turns: [] } }
const NOTE = '{"a2uiMeta":{"note":"Here are the spa treatments you can book."}}'
const surface = (components: unknown[]): string =>
  `${NOTE}\n{"version":"v1.0","createSurface":{"surfaceId":"spa-menu","catalogId":"agent-ui--hospitality"}}\n` +
  JSON.stringify({ version: 'v1.0', updateComponents: { surfaceId: 'spa-menu', components } })
const TABLE = surface([
  {
    id: 'root',
    component: 'Table',
    label: 'Grand Meridian spa treatments',
    columns: [{ key: 'treatment', label: 'Treatment' }, { key: 'price', label: 'Price' }],
    rows: [{ treatment: 'Swedish massage', price: '€120' }, { treatment: 'Deep-tissue massage', price: '€135' }],
  },
])
const CARD = surface([
  { id: 'root', component: 'Card', child: 'list' },
  { id: 'list', component: 'DescriptionList', rows: [{ label: 'Swedish massage', value: '60 minutes, €120' }] },
])

async function run(withChecks: boolean): Promise<{ reqs: string[] }> {
  const { produce } = await import('../agent/produce.ts')
  const { defaultCatalog } = await import('../catalog/default/index.ts')
  // the hospitality manifest itself imports the module (its checks ask `askedCompositeMoment`), so only the checks run takes it
  const catalog = withChecks
    ? (await import('../catalog/compose.ts')).composeCatalog(defaultCatalog, (await import('../catalog/domains/hospitality/manifest.ts')).hospitalityFragment, 'hospitality')
    : defaultCatalog
  const semanticChecks = withChecks
    ? (await import('../catalog/semantic-check.ts')).gateChecksOnCatalog((await import('../catalog/composite-moments.ts')).compositeMomentChecks, catalog)
    : []
  const outputs = [TABLE, CARD, CARD]
  let n = 0
  const reqs: string[] = []
  const provider: AgentProvider = {
    async *stream(req) {
      reqs.push(req.messages.at(-1)!.content)
      yield outputs[Math.min(n++, outputs.length - 1)]!
    },
  }
  for await (const _ of produce(input, { provider, retrieve: () => [], catalog, semanticChecks }, { maxRounds: 3 })) void _
  return { reqs }
}

describe('produce(): the composite-moment rows load lazily and still run on the first turn (T-0593)', () => {
  it('a turn with no semantic checks never loads the composite-moment module', async () => {
    const r = await run(false)
    expect(r.reqs).toHaveLength(1)
    expect(loads).toBe(0)
  })

  it('the first turn with checks runs them on round 1 and binds the missing composite on round 2', async () => {
    const r = await run(true)
    expect(loads).toBe(1)
    expect(r.reqs).toHaveLength(3)
    expect(r.reqs[1]).toContain('PRODUCT_CARD_MISSING')
    expect(r.reqs[2]).toContain('PRODUCT_CARD_MISSING')
    expect(r.reqs[2]).toContain('Earlier this turn')
  })
})
