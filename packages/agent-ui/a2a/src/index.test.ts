// index.test.ts — S8 integration checkpoint (extended, corpus LLD-C8/B4 S5): the finalized barrel exposes
// the zero-dep consumer surface (protocol + rpc + channel + corpus) with no name collisions across the
// `export *` set, and end-to-end usage through the ONE public entry point works exactly as it does
// through the per-module imports the other suites exercise directly.
import { describe, expect, it } from 'vitest'
import * as a2a from './index.ts'

describe('@agent-ui/a2a barrel (LLD-C11, S8)', () => {
  it('exposes the protocol layer (LLD-C1/C2/C3/C4)', () => {
    expect(a2a.PROTOCOL_VERSION).toBe('0.3.0')
    expect(a2a.TASK_STATES).toHaveLength(9)
    expect(a2a.TERMINAL_STATES).toEqual(['completed', 'canceled', 'rejected', 'failed'])
    expect(typeof a2a.decodeA2a).toBe('function')
    expect(typeof a2a.encodeA2a).toBe('function')
    expect(typeof a2a.validateA2a).toBe('function')
    expect(typeof a2a.canTransition).toBe('function')
    expect(typeof a2a.guardTransition).toBe('function')
  })

  it('exposes the rpc layer (LLD-C5/C6)', () => {
    expect(a2a.SUPPORTED_METHODS).toEqual(['message/send', 'tasks/get', 'tasks/cancel'])
    expect(Object.keys(a2a.RPC_ERROR_TABLE)).toHaveLength(12)
    expect(typeof a2a.toRpcError).toBe('function')
    expect(typeof a2a.fromRpcError).toBe('function')
    expect(typeof a2a.frameRequest).toBe('function')
    expect(typeof a2a.parseFrame).toBe('function')
    expect(typeof a2a.createRpcCorrelator).toBe('function')
  })

  it('exposes the channel layer (LLD-C7)', () => {
    expect(typeof a2a.createLoopbackPair).toBe('function')
  })

  it('exposes the corpus consumption surface (corpus LLD-C1/C2, B4) — NOT admit.ts (tools/tests only)', () => {
    expect(typeof a2a.validateCorpusRecord).toBe('function')
    expect(typeof a2a.parseShard).toBe('function')
    expect(typeof a2a.serializeRecord).toBe('function')
    expect(typeof a2a.serializeShard).toBe('function')
    expect(typeof a2a.shardPath).toBe('function')
    expect(typeof a2a.admittedRecords).toBe('function')
    expect((a2a as Record<string, unknown>).admitRecord).toBeUndefined()
  })

  it('end-to-end: encode -> decode -> guard a legal task transition through the barrel alone', () => {
    const task = { kind: 'task' as const, id: 't1', contextId: 'c1', status: { state: 'submitted' as const } }
    const text = a2a.encodeA2a(task)
    const decoded = a2a.decodeA2a<typeof task>(text, { protocolVersion: a2a.PROTOCOL_VERSION, expect: 'task' })
    expect(decoded.ok).toBe(true)
    expect(decoded.ok && a2a.guardTransition(decoded.value.status.state, 'working')).toEqual([])
  })

  it('end-to-end: a message sent over a loopback pair round-trips through the barrel alone', async () => {
    const [x, y] = a2a.createLoopbackPair()
    const msg = { kind: 'message' as const, role: 'user' as const, parts: [{ kind: 'text' as const, text: 'hi' }], messageId: 'm1' }
    await x.send(msg)
    const iter = y.receive()[Symbol.asyncIterator]()
    const { value } = await iter.next()
    expect(value).toEqual(msg)
  })
})
