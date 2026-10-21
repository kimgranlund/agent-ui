// produce-binding-finding.test.ts: T-0299. Live round 6 (2026-10-15-r6-matrix :161, Haiku 5.5) answered the spa
// services ask with a priced Table (PRODUCT_CARD_MISSING), then a broken payload (PARSE), then a Card holding a
// DescriptionList that no composite-moment row detects, and that card shipped with no code. An earlier round's
// missing-composite finding now stays binding: a later round whose payload holds neither the composite nor a type its
// row stands aside for is sent back with the same code while a round is left, and on the last round ships tallied
// SEMANTIC_UNCORRECTED, never silently. Keyless, scripted provider, the concierge catalog and its composite rows.

import { describe, it, expect } from 'vitest'
import { produce } from '../agent/produce.ts'
import type { AgentProvider, TurnInput } from '../agent/agent-transport.ts'
import { readMetaLine } from '../agent/meta-line.ts'
import { composeCatalog } from '../catalog/compose.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { hospitalityFragment } from '../catalog/domains/hospitality/manifest.ts'
import { hospitalitySemanticChecks } from '../catalog/domains/hospitality/checks.ts'
import { compositeMomentChecks } from '../catalog/composite-moments.ts'
import { gateChecksOnCatalog } from '../catalog/semantic-check.ts'

const catalog = composeCatalog(defaultCatalog, hospitalityFragment, 'hospitality')
const semanticChecks = gateChecksOnCatalog([...hospitalitySemanticChecks, ...compositeMomentChecks], catalog)
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
    columns: [{ key: 'treatment', label: 'Treatment' }, { key: 'duration', label: 'Duration' }, { key: 'price', label: 'Price' }],
    rows: [{ treatment: 'Swedish massage', duration: '60 min', price: '€120' }, { treatment: 'Deep-tissue massage', duration: '60 min', price: '€135' }],
  },
])
const CARD = surface([
  { id: 'root', component: 'Card', child: 'list' },
  { id: 'list', component: 'DescriptionList', rows: [{ label: 'Swedish massage', value: '60 minutes, €120' }, { label: 'Deep-tissue massage', value: '60 minutes, €135' }] },
])
const card = (id: string, title: string, price: string): Record<string, unknown> => ({
  id, component: 'ProductCard', title, subtitle: '60 minutes', price, priceNote: 'per session', actionLabel: 'Book', action: { action: 'book_spa_treatment', context: { treatment: id } },
})
const GRID = surface([
  { id: 'root', component: 'Grid', gap: 'md', min: '16rem', children: ['swedish', 'deep'] },
  card('swedish', 'Swedish massage', '€120'),
  card('deep', 'Deep-tissue massage', '€135'),
])
const BROKEN = `${NOTE}\n{"version":"v1.0","updateComponents":{"surfaceId":"spa-menu",`

async function run(outputs: string[]): Promise<{ calls: number; reqs: string[]; rounds: number; codes: string[]; content: string[] }> {
  let n = 0
  const reqs: string[] = []
  const provider: AgentProvider = {
    async *stream(req) {
      reqs.push(req.messages.at(-1)!.content)
      yield outputs[Math.min(n++, outputs.length - 1)]!
    },
  }
  const lines: string[] = []
  for await (const line of produce(input, { provider, retrieve: () => [], catalog, semanticChecks }, { maxRounds: 3 })) lines.push(line)
  const meta = lines.map((l) => readMetaLine(l)?.a2uiMeta).find((m) => m?.trace !== undefined)
  return { calls: n, reqs, rounds: meta?.trace?.rounds ?? 0, codes: [...(meta?.trace?.failureCodes ?? [])], content: lines.filter((l) => readMetaLine(l) === undefined) }
}

describe('produce(): an earlier missing-composite finding stays binding on later rounds (T-0299)', () => {
  it('a round that swaps the priced Table for a Card with no ProductCard is sent back with PRODUCT_CARD_MISSING', async () => {
    const r = await run([TABLE, CARD, GRID])
    expect(r.calls).toBe(3)
    expect(r.reqs[2]).toContain('PRODUCT_CARD_MISSING')
    expect(r.codes).toEqual(['PRODUCT_CARD_MISSING'])
    expect(r.content.join('\n')).toContain('"ProductCard"')
  })

  it('the last round (Table, PARSE, Card, as :161) ships tallied SEMANTIC_UNCORRECTED, never silently', async () => {
    const r = await run([TABLE, BROKEN, CARD])
    expect(r.calls).toBe(3)
    expect(r.codes).toEqual(['PARSE', 'SEMANTIC_UNCORRECTED', 'TEXT_JSONL_ROUTED']) // the broken line was routed as the payload (T-0229)
  })

  it('negative control: a round that brings the ProductCard grid passes, and a Card on round 1 is not judged by it', async () => {
    const fixed = await run([TABLE, GRID])
    expect(fixed.calls).toBe(2)
    expect(fixed.codes).toEqual(['PRODUCT_CARD_MISSING'])
    const first = await run([CARD])
    expect(first.calls).toBe(1)
    expect(first.codes).toEqual([])
  })
})
