// stream/from-web-socket.ts — SPEC-R13 (c): `fromWebSocket`, a bidirectional `Streamed<MessageEvent>`
// bridge with heartbeat, opt-in reconnect, and `bufferedAmount` backpressure. Cites the `A2aChannel`
// close-drain precedent (`packages/agent-ui/a2a/src/channel/loopback.ts`) for the `return()`/`close()`
// -> code 1000, no-reconnect law — a2a itself stays untouched (`data` cannot import `a2a`).

import { pushToPull } from './bridge.ts'
import type { Streamed } from '../core/types.ts'
import type { DataError } from '../core/error.ts'

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

/** The dead-connection end: a `DataError` (`network`, retryable), never a bare `Error` — SPEC-R13 AC5 / R6. */
function deadConnectionError(reason: string): DataError {
  return { kind: 'network', retryable: true, cause: new Error(`WebSocket connection is dead (${reason})`) }
}

/** `fromWebSocket(url, opts)` — SPEC-R13 (c). */
export function fromWebSocket(url: string, opts: FromWebSocketOptions = {}): WebSocketStream {
  const WS = opts.WebSocket ?? (globalThis as unknown as { WebSocket?: typeof WebSocket }).WebSocket
  if (!WS) throw new Error('fromWebSocket: no WebSocket available — pass one via opts.WebSocket')

  const highWaterMark = opts.highWaterMark ?? 0
  let closedByConsumer = false // return()/close(): code 1000 semantics, never a reconnect
  let reconnectAttempt = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let heartbeatTimer: ReturnType<typeof setTimeout> | undefined
  let heartbeatDeadline: ReturnType<typeof setTimeout> | undefined
  let socket: WebSocket
  // Every listener is bound to the socket GENERATION it was attached under; abandoning a socket
  // (heartbeat death, reconnect, consumer close) bumps the generation so its late events — the
  // 'close' a dying socket still fires — can never re-enter onDead() and double-reconnect.
  let socketGen = 0
  let socketAbandoned = false

  const { push, end, stream } = pushToPull<MessageEvent>({
    onTeardown: () => {
      closedByConsumer = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      abandonSocket(1000)
    },
  })

  function clearHeartbeat(): void {
    if (heartbeatTimer) clearTimeout(heartbeatTimer)
    if (heartbeatDeadline) clearTimeout(heartbeatDeadline)
  }

  /** Detach from the current socket exactly once: listeners go inert, heartbeat stops, the socket is closed. */
  function abandonSocket(code?: number, reason?: string): void {
    if (socketAbandoned) return
    socketAbandoned = true
    socketGen++
    clearHeartbeat()
    try {
      socket.close(code, reason)
    } catch {
      // already closed — fine
    }
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
        onDead('heartbeat timeout')
      }, timeoutMs)
    }, intervalMs)
  }

  function onDead(reason: string): void {
    if (closedByConsumer) return
    abandonSocket() // the dead socket is CLOSED, not leaked alongside its replacement
    if (opts.reconnect && reconnectAttempt < opts.reconnect.maxAttempts) {
      reconnectAttempt++
      const { baseMs, capMs } = opts.reconnect
      const ceiling = Math.min(capMs, baseMs * 2 ** reconnectAttempt)
      const delay = Math.random() * ceiling
      reconnectTimer = setTimeout(connect, delay)
    } else {
      end(deadConnectionError(reason))
    }
  }

  function connect(): void {
    if (closedByConsumer) return // a close() during the back-off wait wins — no zombie socket
    socketAbandoned = false
    const gen = ++socketGen
    socket = opts.protocols ? new WS!(url, opts.protocols as string | string[]) : new WS!(url)
    socket.addEventListener('open', () => {
      if (gen !== socketGen) return
      reconnectAttempt = 0
      armHeartbeat()
    })
    socket.addEventListener('message', (evt: MessageEvent) => {
      if (gen !== socketGen) return
      armHeartbeat() // any message resets the dead-connection clock
      push(evt)
    })
    socket.addEventListener('close', () => {
      if (gen !== socketGen) return
      clearHeartbeat()
      if (!closedByConsumer) onDead('socket closed')
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
    if (reconnectTimer) clearTimeout(reconnectTimer)
    abandonSocket(code, reason)
    end() // a pending next() settles { done: true }; the stream is finished, not merely disconnected
  }

  return { [Symbol.asyncIterator]: () => stream[Symbol.asyncIterator](), send, close }
}
