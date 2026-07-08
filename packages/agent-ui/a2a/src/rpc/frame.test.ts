// frame.test.ts — S5 checkpoint: per-method round-trip with correlation intact; malformed -> A2A_RPC;
// unknown method -> -32601; known-unsupported -> -32004 (SPEC-R7 AC1).
import { describe, expect, it } from 'vitest'
import {
  classifyMethod,
  createRpcCorrelator,
  frameError,
  frameRequest,
  frameSuccess,
  isKnownMethod,
  isSupportedMethod,
  KNOWN_METHODS,
  parseFrame,
  SUPPORTED_METHODS,
  type MessageSendParams,
  type TaskIdParams,
  type TaskQueryParams,
} from './frame.ts'
import type { A2aMessage, A2aTask } from '../protocol/types.ts'

const encodeFrame = (frame: unknown): string => JSON.stringify(frame)

const MSG: A2aMessage = { kind: 'message', role: 'user', parts: [{ kind: 'text', text: 'e5' }], messageId: 'm1' }
const TASK: A2aTask = { kind: 'task', id: 't1', contextId: 'c1', status: { state: 'working' } }

describe('method tables (LLD-C6)', () => {
  it('SUPPORTED_METHODS is exactly the 3 B1 methods', () => {
    expect(SUPPORTED_METHODS).toEqual(['message/send', 'tasks/get', 'tasks/cancel'])
  })

  it('KNOWN_METHODS is a superset of SUPPORTED_METHODS and includes the HV-3 surface', () => {
    for (const m of SUPPORTED_METHODS) expect(isKnownMethod(m)).toBe(true)
    expect(isKnownMethod('message/stream')).toBe(true)
    expect(isKnownMethod('tasks/resubscribe')).toBe(true)
    expect(isKnownMethod('tasks/pushNotificationConfig/set')).toBe(true)
    expect(isKnownMethod('agent/getAuthenticatedExtendedCard')).toBe(true)
    expect(KNOWN_METHODS.length).toBeGreaterThan(SUPPORTED_METHODS.length)
  })

  it('classifyMethod: supported / known-unsupported / unknown', () => {
    expect(classifyMethod('message/send')).toBe('supported')
    expect(classifyMethod('message/stream')).toBe('known-unsupported')
    expect(classifyMethod('totally/madeup')).toBe('unknown')
    expect(isSupportedMethod('message/stream')).toBe(false)
  })
})

describe('per-method frame -> parse round-trip with correlation (SPEC-R7 AC1)', () => {
  it('message/send', () => {
    const correlator = createRpcCorrelator()
    const id = correlator.nextId()
    correlator.track(id, 'message/send')
    const params: MessageSendParams = { message: MSG }
    const req = frameRequest(id, 'message/send', params)
    const parsedReq = parseFrame(encodeFrame(req))
    expect(parsedReq.ok).toBe(true)
    expect(parsedReq.ok && parsedReq.frame).toEqual(req)

    const resp = frameSuccess(id, TASK)
    const parsedResp = parseFrame(encodeFrame(resp))
    expect(parsedResp.ok).toBe(true)
    const correlated = correlator.resolve((parsedResp.ok && parsedResp.frame.id) as number)
    expect(correlated).toEqual({ ok: true, method: 'message/send' })
  })

  it('tasks/get', () => {
    const correlator = createRpcCorrelator()
    const id = correlator.nextId()
    correlator.track(id, 'tasks/get')
    const params: TaskQueryParams = { id: 't1' }
    const req = frameRequest(id, 'tasks/get', params)
    expect(parseFrame(encodeFrame(req)).ok).toBe(true)
    const resp = frameSuccess(id, TASK)
    expect(parseFrame(encodeFrame(resp)).ok).toBe(true)
    expect(correlator.resolve(id)).toEqual({ ok: true, method: 'tasks/get' })
  })

  it('tasks/cancel', () => {
    const correlator = createRpcCorrelator()
    const id = correlator.nextId()
    correlator.track(id, 'tasks/cancel')
    const params: TaskIdParams = { id: 't1' }
    const req = frameRequest(id, 'tasks/cancel', params)
    expect(parseFrame(encodeFrame(req)).ok).toBe(true)
    const resp = frameSuccess(id, TASK)
    expect(parseFrame(encodeFrame(resp)).ok).toBe(true)
    expect(correlator.resolve(id)).toEqual({ ok: true, method: 'tasks/cancel' })
  })

  it('the correlator is monotonic starting at 1 (deterministic, no randomness)', () => {
    const correlator = createRpcCorrelator()
    expect(correlator.nextId()).toBe(1)
    expect(correlator.nextId()).toBe(2)
    expect(correlator.nextId()).toBe(3)
  })
})

describe('malformed envelope handling', () => {
  it('unparseable body -> A2A_RPC, never a throw', () => {
    expect(() => parseFrame('{not json')).not.toThrow()
    const result = parseFrame('{not json')
    expect(result.ok).toBe(false)
    expect(!result.ok && result.failures[0]?.code).toBe('A2A_RPC')
  })

  it('missing jsonrpc -> A2A_RPC', () => {
    const result = parseFrame(JSON.stringify({ id: 1, method: 'message/send', params: {} }))
    expect(result.ok).toBe(false)
    expect(!result.ok && result.failures.some((f) => f.code === 'A2A_RPC')).toBe(true)
  })

  it('a response id matching no pending request is a correlation failure, not a throw', () => {
    const correlator = createRpcCorrelator()
    expect(() => correlator.resolve(999)).not.toThrow()
    const result = correlator.resolve(999)
    expect(result.ok).toBe(false)
    expect(!result.ok && result.failure).toEqual({ code: 'A2A_RPC', path: '/id', detail: expect.stringContaining('999') })
  })
})

describe('error frames', () => {
  it('frameError round-trips through parseFrame', () => {
    const err = frameError(1, -32001, 'Task not found')
    const parsed = parseFrame(encodeFrame(err))
    expect(parsed.ok).toBe(true)
    expect(parsed.ok && parsed.frame).toEqual(err)
  })
})
