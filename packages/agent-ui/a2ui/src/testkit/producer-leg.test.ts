// producer-leg.test.ts: a rounds turn through the REAL produce() (tools/testkit/producer-leg.ts, T-0011).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { armOffline } from '../../tools/testkit/offline.ts'
import { judgeProduce, runProducerTurn, produceTurn } from '../../tools/testkit/producer-leg.ts'
import { orderDefects, splitLines } from '../../tools/testkit/judge.ts'
import type { ScriptedToolSpec } from '../../tools/testkit/scenario.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import type { TurnInput } from '../agent/agent-transport.ts'

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

const j = (v: unknown): string => JSON.stringify(v)
const VALID = [
  j({ version: 'v1.0', createSurface: { surfaceId: 's', catalogId: 'agent-ui' } }),
  j({ version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Text', text: 'hi' }] } }),
].join('\n')
const NOTED = `${j({ a2uiMeta: { note: 'here you go' } })}\n${VALID}`
const INVALID = j({ version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'NoSuchType' }] } })
const input: TurnInput = { kind: 'intent', text: 'show hi', session: { turns: [] } }
const LOOKUP: ScriptedToolSpec = { name: 'lookup', input_schema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] }, reply: 'found' }

describe('runProducerTurn and judgeProduce', () => {
  it('invalid-then-valid rounds give outcome eventual with rounds 2, and no finding', async () => {
    const r = await runProducerTurn(input, [INVALID, VALID], defaultCatalog)
    expect(r.outcome).toBe('eventual')
    expect(r.rounds).toBe(2)
    expect(judgeProduce(r, undefined)).toEqual([])
    expect(judgeProduce(r, { produce: { outcome: 'eventual', rounds: 2 } })).toEqual([])
  })

  it('never-valid rounds halt: PRODUCE_HALT carrying the validator codes', async () => {
    const r = await runProducerTurn(input, [INVALID], defaultCatalog)
    expect(r.outcome).toBe('halt')
    const red = judgeProduce(r, undefined)
    expect(red.map((f) => `${f.layer}:${f.code}`)).toEqual(['producer:PRODUCE_HALT'])
    expect(red[0]!.detail).toContain('CATALOG')
    expect(judgeProduce(r, { produce: { outcome: 'halt' } })).toEqual([])
  })

  it('a wrong expect.produce.rounds gives PRODUCE_MISMATCH', async () => {
    const r = await runProducerTurn(input, [INVALID, VALID], defaultCatalog)
    expect(judgeProduce(r, { produce: { outcome: 'eventual', rounds: 3 } }).map((f) => f.code)).toEqual(['PRODUCE_MISMATCH'])
  })

  it('failureCodes come from the trace when the final round carries a note', async () => {
    const r = await runProducerTurn(input, [INVALID, NOTED], defaultCatalog)
    expect(r.failureCodes).toEqual(['CATALOG'])
    expect(judgeProduce(r, { produce: { outcome: 'eventual', failureCodes: ['CATALOG'] } })).toEqual([])
    expect(judgeProduce(r, { produce: { outcome: 'eventual', failureCodes: ['SCHEMA'] } }).map((f) => f.code)).toEqual(['PRODUCE_MISMATCH'])
  })

  it('a tool round with opts.tools records one call; a wrong expect.tools gives TOOLS_MISMATCH', async () => {
    const r = await runProducerTurn(input, [{ tool: 'lookup', input: { q: 'hi' }, then: VALID }], defaultCatalog, { tools: [LOOKUP] })
    expect(r.toolCalls).toEqual([{ tool: 'lookup', input: { q: 'hi' } }])
    expect(judgeProduce(r, { produce: { outcome: 'first-pass' }, tools: [{ tool: 'lookup', input: { q: 'hi' } }] })).toEqual([])
    expect(judgeProduce(r, { produce: { outcome: 'first-pass' }, tools: [{ tool: 'lookup', input: { q: 'bye' } }] }).map((f) => f.code)).toEqual(['TOOLS_MISMATCH'])
  })

  it('every yielded content line follows every meta-line (validate-then-stream)', async () => {
    const r = await runProducerTurn(input, [INVALID, NOTED], defaultCatalog)
    const { meta, content } = splitLines(r.lines)
    expect(meta.length).toBeGreaterThan(0)
    expect(content.length).toBe(2)
    expect(Math.max(...meta.map((m) => m.index))).toBeLessThan(Math.min(...content.map((c) => c.index)))
    expect(orderDefects(r.lines)).toEqual([])
  })

  it('produceTurn judges with the turn expectations and paths', async () => {
    const turn = { respond: { rounds: [INVALID] }, expect: { produce: { outcome: 'first-pass' as const } } }
    const out = await produceTurn(input, turn, { turnIndex: 2, catalog: defaultCatalog })
    expect(out.findings.map((f) => `${f.code}@${f.path}`)).toEqual(['PRODUCE_MISMATCH@$.turns[2].expect.produce'])
  })
})
