// channel.ts — the HTTP client arm of the A2aChannel contract (LLD-C8, SPEC-R8 AC1). `send` frames
// `message/send` and awaits each POST SEQUENTIALLY (ordering, SPEC-N5); a successful response's result
// (a Message, or a Task carrying `status.message`) enqueues onto this channel's own `receive()` in
// arrival order. The injectable `post` seam is what the standing transport-invariance test wires
// DIRECTLY to `createRpcCore(...).handleRpc` — the full framing path exercises with zero sockets; only
// the default `post` (used by the manual smoke) touches a real socket via `fetch`.
import { createRpcCorrelator, frameRequest, parseFrame, type MessageSendParams } from '../../src/rpc/frame.ts'
import { encodeA2a } from '../../src/protocol/codec.ts'
import type { A2aMessage, A2aTask } from '../../src/protocol/types.ts'
import type { A2aFailure } from '../../src/protocol/validate.ts'
import type { A2aChannel } from '../../src/channel/loopback.ts'
import { A2aChannelClosedError } from '../../src/channel/loopback.ts'

/** Wraps a coded transport-level failure — never fabricates a `receive()` message (LLD §8). */
export class A2aTransportError extends Error {
  readonly failure: A2aFailure
  constructor(failure: A2aFailure) {
    super(`A2aTransportError: ${failure.code} at ${failure.path} — ${failure.detail}`)
    this.name = 'A2aTransportError'
    this.failure = failure
  }
}

export type HttpPost = (endpoint: string, body: string) => Promise<string>

export interface HttpChannelOptions {
  post?: HttpPost
}

export function httpChannel(endpoint: string, opts: HttpChannelOptions = {}): A2aChannel {
  const post = opts.post ?? defaultPost
  const correlator = createRpcCorrelator()
  const queue: A2aMessage[] = []
  const waiters: Array<(v: IteratorResult<A2aMessage>) => void> = []
  let closed = false

  function deliver(msg: A2aMessage): void {
    const w = waiters.shift()
    if (w) w({ value: msg, done: false })
    else queue.push(msg)
  }

  return {
    async send(msg: A2aMessage): Promise<void> {
      if (closed) throw new A2aChannelClosedError()
      const id = correlator.nextId()
      correlator.track(id, 'message/send')
      const params: MessageSendParams = { message: msg }
      const req = frameRequest(id, 'message/send', params)

      let raw: string
      try {
        raw = await post(endpoint, encodeA2a(req)) // sequential await — ordering guarantee (SPEC-N5)
      } catch (e) {
        throw new A2aTransportError({ code: 'A2A_RPC', path: '/', detail: `transport failure: ${String(e)}` })
      }

      const parsed = parseFrame(raw)
      if (!parsed.ok) throw new A2aTransportError(parsed.failures[0] ?? { code: 'A2A_RPC', path: '/', detail: 'invalid response JSON' })

      const frame = parsed.frame
      if ('error' in frame) {
        throw new A2aTransportError({ code: 'A2A_RPC', path: '/error', detail: JSON.stringify(frame.error) })
      }
      if ('result' in frame) {
        const result = frame.result
        if (isA2aMessage(result)) deliver(result)
        else if (isA2aTask(result) && result.status.message) deliver(result.status.message)
        // a bare Task with no piggybacked message: nothing to deliver (the arena polls tasks/get separately)
      }
    },

    receive(): AsyncIterable<A2aMessage> {
      return {
        [Symbol.asyncIterator](): AsyncIterator<A2aMessage> {
          return {
            next(): Promise<IteratorResult<A2aMessage>> {
              const buffered = queue.shift()
              if (buffered !== undefined) return Promise.resolve({ value: buffered, done: false })
              if (closed) return Promise.resolve({ value: undefined, done: true })
              return new Promise((resolve) => waiters.push(resolve))
            },
          }
        },
      }
    },

    close(): void {
      if (closed) return
      closed = true
      for (const w of waiters.splice(0)) w({ value: undefined, done: true })
    },
  }
}

function isA2aMessage(v: unknown): v is A2aMessage {
  return typeof v === 'object' && v !== null && (v as { kind?: unknown }).kind === 'message'
}

function isA2aTask(v: unknown): v is A2aTask {
  return typeof v === 'object' && v !== null && (v as { kind?: unknown }).kind === 'task'
}

function defaultPost(endpoint: string, body: string): Promise<string> {
  return fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.text()
  })
}
