// produce-persona-hint.test.ts: SPEC RTS-R7 (response type selection), the persona hint `prefers` through the
// real produce() loop. The hint is advisory: it composes one `response-preference` paragraph into the system
// prompt the stub provider receives and never changes the tool offer; `'auto'` composes neither paragraph.

import { describe, it, expect } from 'vitest'
import { produce } from '../agent/produce.ts'
import type { ProduceDeps, ProduceOptions } from '../agent/produce.ts'
import type { AgentProvider } from '../agent/agent-transport.ts'
import { readAsset } from '../agent/asset-source.ts'
import { defaultCatalog } from '../catalog/default/index.ts'

type StreamReq = Parameters<AgentProvider['stream']>[0]

const TEXT_PARAGRAPH = readAsset('agent/prompts/response-preference-text.md').trim()
const SURFACE_PARAGRAPH = readAsset('agent/prompts/response-preference-surface.md').trim()

/** Run one text-only turn and return the single request the stub provider received. */
async function requestFor(opts: Partial<ProduceOptions>): Promise<StreamReq> {
  const reqs: StreamReq[] = []
  const provider: AgentProvider = {
    async *stream(req) {
      reqs.push(req)
      yield 'Sure.'
    },
  }
  const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
  for await (const _ of produce({ kind: 'intent', text: 'a submit button', session: { turns: [] } }, deps, { maxRounds: 3, ...opts })) void _
  expect(reqs).toHaveLength(1)
  return reqs[0]!
}

describe('persona hint', () => {
  it('the paragraphs are non-empty and distinct', () => {
    expect(TEXT_PARAGRAPH.length).toBeGreaterThan(0)
    expect(SURFACE_PARAGRAPH.length).toBeGreaterThan(0)
    expect(TEXT_PARAGRAPH).not.toBe(SURFACE_PARAGRAPH)
  })

  it("prefers 'text' composes the text paragraph and still offers render_surface", async () => {
    const req = await requestFor({ prefers: 'text' })
    expect(req.system).toContain(TEXT_PARAGRAPH)
    expect(req.system).not.toContain(SURFACE_PARAGRAPH)
    expect(req.tools?.map((t) => t.name)).toEqual(['render_surface'])
    expect('toolChoice' in req).toBe(false)
  })

  it("prefers 'surface' composes the surface paragraph and forces no tool", async () => {
    const req = await requestFor({ prefers: 'surface' })
    expect(req.system).toContain(SURFACE_PARAGRAPH)
    expect(req.system).not.toContain(TEXT_PARAGRAPH)
    expect(req.tools?.map((t) => t.name)).toEqual(['render_surface'])
    expect('toolChoice' in req).toBe(false)
  })

  it("prefers 'auto' composes neither paragraph, byte-identical to no hint", async () => {
    const auto = await requestFor({ prefers: 'auto' })
    expect(auto.system).not.toContain(TEXT_PARAGRAPH)
    expect(auto.system).not.toContain(SURFACE_PARAGRAPH)
    expect(auto.system).toBe((await requestFor({})).system)
  })

  it('an A2UI-off turn composes no paragraph, since render_surface is not offered there', async () => {
    const off = await requestFor({ prefers: 'surface', a2uiEnabled: false })
    expect(off.tools).toBeUndefined()
    expect(off.system).not.toContain(SURFACE_PARAGRAPH)
    expect(off.system).toBe((await requestFor({ a2uiEnabled: false })).system)
  })
})
