// scripted-tools.test.ts: scripted manifests through the REAL buildToolDispatch (T-0011).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { armOffline } from '../../tools/testkit/offline.ts'
import { scriptedTools } from '../../tools/testkit/scripted-tools.ts'
import { buildToolDispatch } from '../../tools/agent/integrations/tool-dispatch.ts'
import type { ExecuteTool } from '../agent/agent-transport.ts'

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

const SCHEMA = { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] }

describe('scriptedTools with buildToolDispatch', () => {
  it('validates input and records one call per execute; a throw reply rejects', async () => {
    const { manifests, calls } = scriptedTools([
      { name: 'lookup', input_schema: SCHEMA, reply: 'found' },
      { name: 'broken', input_schema: SCHEMA, reply: { throw: 'down' } },
    ])
    const dispatch = buildToolDispatch(manifests, {}) as { executeTool: ExecuteTool; tools: readonly { name: string }[] }
    expect(dispatch.tools.map((t) => t.name)).toEqual(['lookup', 'broken'])
    expect(await dispatch.executeTool('lookup', { q: 'x' })).toBe('found')
    await expect(dispatch.executeTool('broken', { q: 'y' })).rejects.toThrow('down')
    expect(calls).toEqual([{ tool: 'lookup', input: { q: 'x' } }, { tool: 'broken', input: { q: 'y' } }])
  })

  it('an invalid input never reaches the executor', async () => {
    const { manifests, calls } = scriptedTools([{ name: 'lookup', input_schema: SCHEMA, reply: 'found' }])
    const dispatch = buildToolDispatch(manifests, {}) as { executeTool: ExecuteTool }
    await expect(dispatch.executeTool('lookup', { q: 7 })).rejects.toThrow(/invalid input/)
    await expect(dispatch.executeTool('lookup', {})).rejects.toThrow(/invalid input/)
    expect(calls).toEqual([])
  })
})
