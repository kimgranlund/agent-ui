// scripted-provider.test.ts: the kit's keyless provider (tools/testkit/scripted-provider.ts, T-0011).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { armOffline } from '../../tools/testkit/offline.ts'
import { scriptedProvider } from '../../tools/testkit/scripted-provider.ts'
import type { AgentProvider, ProviderEvent } from '../agent/agent-transport.ts'

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

type Req = Parameters<AgentProvider['stream']>[0]
const req = (extra: Partial<Req> = {}): Req => ({ model: 'm', system: 's', messages: [], ...extra })

async function text(p: AgentProvider, r: Req = req()): Promise<string> {
  let out = ''
  for await (const frag of p.stream(r)) out += frag
  return out
}

describe('scriptedProvider', () => {
  it('round n yields rounds[min(n, len - 1)] and counts calls', async () => {
    const p = scriptedProvider(['a', 'b'])
    expect([await text(p), await text(p), await text(p)]).toEqual(['a', 'b', 'b'])
    expect(p.calls).toBe(3)
    expect(() => scriptedProvider([])).toThrow()
  })

  it('a tool round calls executeTool once, records the result, reports the tool event, and yields only `then`', async () => {
    const p = scriptedProvider([{ tool: 'lookup', input: { q: 'x' }, then: 'after' }])
    const calls: [string, Record<string, unknown>][] = []
    const events: ProviderEvent[] = []
    const out = await text(p, req({
      executeTool: async (name, input) => {
        calls.push([name, input])
        return 'RESULT'
      },
      onEvent: (ev) => events.push(ev),
    }))
    expect(out).toBe('after')
    expect(calls).toEqual([['lookup', { q: 'x' }]])
    expect(p.toolCalls).toEqual([{ tool: 'lookup', input: { q: 'x' }, result: 'RESULT' }])
    expect(events).toEqual([{ kind: 'tool', text: 'lookup' }])
  })

  it('a rejected tool call becomes text, never a throw; no executeTool records unavailable', async () => {
    const p = scriptedProvider([{ tool: 'lookup', input: {}, then: 'still here' }])
    expect(await text(p, req({ executeTool: async () => { throw new Error('boom') } }))).toBe('still here')
    expect(p.toolCalls[0]!.result).toBe('error: boom')
    await text(p)
    expect(p.toolCalls[1]!.result).toBe('unavailable')
  })
})
