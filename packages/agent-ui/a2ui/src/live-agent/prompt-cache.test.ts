// prompt-cache.test.ts: T-0206. `produce()` hands the provider the stable-prefix boundary of its system
// prompt (grammar, components, functions), and the Anthropic request body sends `system` as a block array
// with exactly one `cache_control` breakpoint closing that prefix. Stub provider only (no live model).

import { describe, it, expect } from 'vitest'
import { produce } from '../agent/produce.ts'
import type { ProduceOptions } from '../agent/produce.ts'
import type { AgentProvider, TurnInput } from '../agent/agent-transport.ts'
import { buildRequestBody } from '../agent/providers/anthropic.ts'
import { buildSystemPromptSections } from '../agent/system-prompt.ts'
import { appendAssistantTurn, appendUserTurn } from '../agent/session.ts'
import { defaultCatalog } from '../catalog/default/index.ts'

const VALID =
  '{"a2uiMeta":{"note":"here you go"}}\n' +
  '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
  '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Button","label":"Hi","action":{"action":"submit"}}]}}'

const intent: TurnInput = { kind: 'intent', text: 'a submit button', session: { turns: [] } }
const PERSONA = 'You are a terse booking assistant.'

type StreamReq = Parameters<AgentProvider['stream']>[0]

/** Run one turn through a stub provider and return the request it received. */
async function firstRequest(opts: Partial<ProduceOptions> = {}, turn: TurnInput = intent): Promise<StreamReq> {
  const reqs: StreamReq[] = []
  const provider: AgentProvider = {
    async *stream(req) {
      reqs.push(req)
      yield VALID
    },
  }
  for await (const _ of produce(turn, { provider, retrieve: () => [], catalog: defaultCatalog }, { maxRounds: 1, ...opts })) void _
  expect(reqs.length).toBeGreaterThan(0)
  return reqs[0]!
}

type Block = { type: string; text: string; cache_control?: { type: string; ttl?: string } }

describe('T-0206: stable-first system blocks with one cache breakpoint', () => {
  it('produce() passes the grammar + components + functions length as the boundary', async () => {
    const req = await firstRequest({ personaSystem: PERSONA })
    const { sections } = buildSystemPromptSections(defaultCatalog, [], undefined, [], PERSONA)
    expect(sections.slice(0, 3).map((s) => s.id)).toEqual(['grammar', 'components', 'functions'])
    const stable = sections.slice(0, 3).reduce((n, s) => n + s.chars, 0)
    expect(req.systemCacheBoundary).toBe(stable)
    expect(req.system.slice(stable)).toMatch(/^\n\n## /) // the boundary lands on a section header
  })

  it('the request body sends the block array with exactly one breakpoint after the stable prefix', async () => {
    const req = await firstRequest({ personaSystem: PERSONA })
    const body = buildRequestBody({ ...req, model: 'claude-haiku-5-5' })
    const blocks = body['system'] as Block[]
    expect(Array.isArray(blocks)).toBe(true)
    expect(blocks).toHaveLength(2)
    expect(blocks.filter((b) => b.cache_control !== undefined)).toHaveLength(1)
    expect(blocks[0]!.cache_control).toEqual({ type: 'ephemeral' })
    expect(blocks[0]!.text).toHaveLength(req.systemCacheBoundary!)
    expect(blocks[0]!.text).toContain('## Available functions')
    expect(blocks[0]!.text).not.toContain('## Persona')
    expect(blocks[1]!.text).toContain(PERSONA) // the persona stays last, outside the cached prefix
    expect(blocks.map((b) => b.text).join('')).toBe(req.system) // byte-identical prompt
  })

  it('the per-model cache TTL (T-0185) rides on the one breakpoint', () => {
    const body = buildRequestBody({ model: 'claude-sonnet-5-5', system: 'stable|rest', systemCacheBoundary: 7, messages: [], modelSettings: { cacheTtl: '1h' } })
    expect(body['system']).toEqual([
      { type: 'text', text: 'stable|', cache_control: { type: 'ephemeral', ttl: '1h' } },
      { type: 'text', text: 'rest' },
    ])
  })

  it('never sends an empty block: a boundary at the end caches the whole prompt as one block', () => {
    const body = buildRequestBody({ model: 'claude-sonnet-5-5', system: 'all stable', systemCacheBoundary: 10, messages: [] })
    expect(body['system']).toEqual([{ type: 'text', text: 'all stable', cache_control: { type: 'ephemeral' } }])
  })

  it('no boundary keeps the pre-T-0206 shapes (plain string, or one block under a TTL)', () => {
    expect(buildRequestBody({ model: 'claude-sonnet-5-5', system: 'p', messages: [] })['system']).toBe('p')
    expect(buildRequestBody({ model: 'claude-sonnet-5-5', system: 'p', messages: [], modelSettings: { cacheTtl: '5m' } })['system'])
      .toEqual([{ type: 'text', text: 'p', cache_control: { type: 'ephemeral', ttl: '5m' } }])
  })

  it('a second turn after a surface opened sends the same tools and cached prefix; the open surface rides the user turn', async () => {
    const first = await firstRequest({ personaSystem: PERSONA })
    const session = appendAssistantTurn(appendUserTurn({ turns: [] }, intent.text), VALID)
    const second = await firstRequest({ personaSystem: PERSONA }, { kind: 'intent', text: 'add a caption', session })
    expect(second.tools).toEqual(first.tools) // tools open the cache prefix, ahead of system
    expect(second.systemCacheBoundary).toBe(first.systemCacheBoundary)
    expect(second.system.slice(0, second.systemCacheBoundary)).toBe(first.system.slice(0, first.systemCacheBoundary))
    expect(second.messages.at(-1)!.content).toContain('[Open surfaces: main.]')
  })

  it('an A2UI-off turn has no stable prefix and passes no boundary', async () => {
    const req = await firstRequest({ a2uiEnabled: false, personaSystem: PERSONA })
    expect(req.systemCacheBoundary).toBeUndefined()
  })
})
