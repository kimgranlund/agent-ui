// fixtures.test.ts — S2 checkpoint: every committed fixture (HV-transcribed, canonical form, LLD-C10)
// parses into the typed model. This is transcription-only (does the shape assign?); judged validity
// (validateA2a) and byte-fidelity (decode/encode) land with their own modules in S3.
import { describe, expect, it } from 'vitest'
import type { A2aAgentCard, A2aMessage, A2aTask } from './types.ts'

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

describe('fixture catalog (LLD-C10) — transcription', () => {
  it('message fixtures parse into A2aMessage', () => {
    const msgs: A2aMessage[] = [messageText, messageData, messageFileBytes, messageFileUri].map(
      (raw) => JSON.parse(raw) as A2aMessage,
    )
    for (const m of msgs) {
      expect(m.kind).toBe('message')
      expect(typeof m.messageId).toBe('string')
      expect(Array.isArray(m.parts)).toBe(true)
    }
  })

  it('task fixtures parse into A2aTask', () => {
    const tasks: A2aTask[] = [taskInputRequired, taskCompleted].map((raw) => JSON.parse(raw) as A2aTask)
    for (const t of tasks) {
      expect(t.kind).toBe('task')
      expect(typeof t.id).toBe('string')
      expect(typeof t.contextId).toBe('string')
      expect(typeof t.status.state).toBe('string')
    }
  })

  it('card fixtures parse into A2aAgentCard and carry BOTH protocolVersion and version', () => {
    const cards: A2aAgentCard[] = [cardReferee, cardSeatX, cardSeatO].map(
      (raw) => JSON.parse(raw) as A2aAgentCard,
    )
    for (const c of cards) {
      expect(c.protocolVersion).toBe('0.3.0')
      expect(typeof c.version).toBe('string')
      expect(Array.isArray(c.skills)).toBe(true)
    }
  })

  it('rpc fixtures parse as JSON-RPC 2.0 envelopes', () => {
    const envelopes = [
      rpcMessageSendRequest,
      rpcMessageSendResponse,
      rpcTasksGetRequest,
      rpcTasksGetResponse,
      rpcTasksCancelRequest,
      rpcTasksCancelResponse,
      rpcErrorTaskNotFound,
    ].map((raw) => JSON.parse(raw) as Record<string, unknown>)
    for (const e of envelopes) expect(e.jsonrpc).toBe('2.0')
  })
})
