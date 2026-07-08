// codec.test.ts — S3 checkpoint: byte-fidelity round-trip over every committed fixture (SPEC-R3 AC1).
import { describe, expect, it } from 'vitest'
import { decodeA2a, encodeA2a } from './codec.ts'
import { PROTOCOL_VERSION } from './types.ts'

import messageText from './fixtures/message.text.json?raw'
import messageData from './fixtures/message.data.json?raw'
import messageFileBytes from './fixtures/message.file-bytes.json?raw'
import messageFileUri from './fixtures/message.file-uri.json?raw'
import taskInputRequired from './fixtures/task.input-required.json?raw'
import taskCompleted from './fixtures/task.completed.json?raw'
import cardReferee from './fixtures/card.referee.json?raw'
import cardSeatX from './fixtures/card.seat-x.json?raw'
import cardSeatO from './fixtures/card.seat-o.json?raw'
import rpcMessageSendRequest from './fixtures/rpc.message-send.request.json?raw'
import rpcMessageSendResponse from './fixtures/rpc.message-send.response.json?raw'
import rpcTasksGetRequest from './fixtures/rpc.tasks-get.request.json?raw'
import rpcTasksGetResponse from './fixtures/rpc.tasks-get.response.json?raw'
import rpcTasksCancelRequest from './fixtures/rpc.tasks-cancel.request.json?raw'
import rpcTasksCancelResponse from './fixtures/rpc.tasks-cancel.response.json?raw'
import rpcErrorTaskNotFound from './fixtures/rpc.error.task-not-found.json?raw'

const FIXTURES: Record<string, string> = {
  'message.text': messageText,
  'message.data': messageData,
  'message.file-bytes': messageFileBytes,
  'message.file-uri': messageFileUri,
  'task.input-required': taskInputRequired,
  'task.completed': taskCompleted,
  'card.referee': cardReferee,
  'card.seat-x': cardSeatX,
  'card.seat-o': cardSeatO,
  'rpc.message-send.request': rpcMessageSendRequest,
  'rpc.message-send.response': rpcMessageSendResponse,
  'rpc.tasks-get.request': rpcTasksGetRequest,
  'rpc.tasks-get.response': rpcTasksGetResponse,
  'rpc.tasks-cancel.request': rpcTasksCancelRequest,
  'rpc.tasks-cancel.response': rpcTasksCancelResponse,
  'rpc.error.task-not-found': rpcErrorTaskNotFound,
}

describe('codec (LLD-C2) — byte-fidelity round-trip', () => {
  for (const [name, raw] of Object.entries(FIXTURES)) {
    it(`${name}: decode -> encode is byte-identical`, () => {
      const decoded = decodeA2a(raw, { protocolVersion: PROTOCOL_VERSION, expect: 'auto' })
      expect(decoded.ok, `expected ${name} to decode clean: ${JSON.stringify(decoded.ok ? [] : decoded.failures)}`).toBe(true)
      expect(decoded.ok && encodeA2a(decoded.value)).toBe(raw)
    })
  }

  it('non-JSON input decodes to a coded A2A_SCHEMA failure, never throws', () => {
    const result = decodeA2a('{not json', { protocolVersion: PROTOCOL_VERSION, expect: 'auto' })
    expect(result.ok).toBe(false)
    expect(!result.ok && result.failures).toEqual([{ code: 'A2A_SCHEMA', path: '/', detail: expect.any(String), parse: true }])
  })
})
