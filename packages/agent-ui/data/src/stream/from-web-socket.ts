// stream/from-web-socket.ts — SPEC-R13 (c): `fromWebSocket`, a bidirectional `Streamed<MessageEvent>`
// bridge with heartbeat, opt-in reconnect, and `bufferedAmount` backpressure. Cites the `A2aChannel`
// close-drain precedent (`packages/agent-ui/a2a/src/channel/loopback.ts`) for the `return()`/`close()`
// -> code 1000, no-reconnect law — a2a itself stays untouched (`data` cannot import `a2a`).

import { pushToPull } from './bridge.ts'
import type { Streamed } from '../core/types.ts'

export interface HeartbeatOptions {
  intervalMs: number
  timeoutMs: number
  ping: unknown
}

export interface ReconnectOptions {
  maxAttempts: number
  baseMs: number
  capMs: number
}

export interface FromWebSocketOptions {
  protocols?: string | readonly string[]
  heartbeat?: HeartbeatOptions
  reconnect?: ReconnectOptions
  highWaterMark?: number
  /** Injected for jsdom/node testing — the headless invariant's carved exception (./stream adapters only). */
  WebSocket?: typeof WebSocket
}

export interface WebSocketStream extends Streamed<MessageEvent> {
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): Promise<void>
  close(code?: number, reason?: string): void
}

/** `fromWebSocket(url, opts)` — SPEC-R13 (c). */
export function fromWebSocket(url: string, opts: FromWebSocketOptions = {}): WebSocketStream {
  const WS = opts.WebSocket ?? (globalThis as unknown as { WebSocket?: typeof WebSocket }).WebSocket
  if (!WS) throw new Error('fromWebSocket: no WebSocket available — pass one via opts.WebSocket')

  const highWaterMark = opts.highWaterMark ?? 0
  let closedByConsumer = false
  let reconnectAttempt = 0
  let heartbeatTimer: ReturnType<typeof setTimeout> | undefined
  let heartbeatDeadline: ReturnType<typeof setTimeout> | undefined
  let socket: WebSocket

  const { push, end, stream } = pushToPull<MessageEvent>({
    onTeardown: () => {
      closedByConsumer = true
      clearHeartbeat()
      try {
        socket.close(1000)
      } catch {
        // already closed — fine
      }
    },
  })

  function clearHeartbeat(): void {
    if (heartbeatTimer) clearTimeout(heartbeatTimer)
    if (heartbeatDeadline) clearTimeout(heartbeatDeadline)
  }

  function armHeartbeat(): void {
    if (!opts.heartbeat) return
    clearHeartbeat()
    const { intervalMs, timeoutMs, ping } = opts.heartbeat
    heartbeatTimer = setTimeout(() => {
      try {
        socket.send(JSON.stringify(ping))
      } catch {
        // socket already gone — the deadline below (or its close handler) settles this
      }
      heartbeatDeadline = setTimeout(() => {
        onDead()
      }, timeoutMs)
    }, intervalMs)
  }

  function onDead(): void {
    if (closedByConsumer) return
    if (opts.reconnect && reconnectAttempt < opts.reconnect.maxAttempts) {
      reconnectAttempt++
      const { baseMs, capMs } = opts.reconnect
      const ceiling = Math.min(capMs, baseMs * 2 ** reconnectAttempt)
      const delay = Math.random() * ceiling
      setTimeout(connect, delay)
    } else {
      end(new Error('WebSocket connection is dead (heartbeat timeout)'))
    }
  }

  function connect(): void {
    socket = opts.protocols ? new WS!(url, opts.protocols as string | string[]) : new WS!(url)
    socket.addEventListener('open', () => {
      reconnectAttempt = 0
      armHeartbeat()
    })
    socket.addEventListener('message', (evt: MessageEvent) => {
      armHeartbeat() // any message resets the dead-connection clock
      push(evt)
    })
    socket.addEventListener('close', () => {
      clearHeartbeat()
      if (!closedByConsumer) onDead()
    })
    socket.addEventListener('error', () => {
      // handled via the paired 'close' event on every real implementation; no separate action here.
    })
  }
  connect()

  async function send(data: string | ArrayBufferLike | Blob | ArrayBufferView): Promise<void> {
    while (socket.bufferedAmount > highWaterMark) {
      await new Promise((r) => setTimeout(r, 0))
    }
    socket.send(data as never)
  }

  function close(code = 1000, reason?: string): void {
    closedByConsumer = true
    clearHeartbeat()
    socket.close(code, reason)
  }

  return { [Symbol.asyncIterator]: () => stream[Symbol.asyncIterator](), send, close }
}
