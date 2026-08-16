// stream/from-event-source.ts — SPEC-R13 (b): `fromEventSource`, a `Streamed<MessageEvent>` bridge
// over the platform `EventSource`. GET-only.
//
// AUTH CONSTRAINT: EventSource carries no custom headers — no `Authorization` header is possible.
// Authenticate via a cookie, a signed query-string ticket, or an equivalent out-of-band mechanism.
// `Last-Event-ID` resume on reconnect is the PLATFORM's own behavior; this adapter does not touch it.

import { pushToPull } from './bridge.ts'
import type { Streamed } from '../core/types.ts'

export interface FromEventSourceOptions {
  /** Named events to listen for, in addition to the default `message` (SPEC-R13 b). */
  events?: readonly string[]
  withCredentials?: boolean
  /** Injected for jsdom/node testing — the headless invariant's carved exception (./stream adapters only). */
  EventSource?: typeof EventSource
}

/** `fromEventSource(url, { events?, withCredentials?, EventSource? })` — SPEC-R13 (b). */
export function fromEventSource(url: string, opts: FromEventSourceOptions = {}): Streamed<MessageEvent> {
  const ES = opts.EventSource ?? (globalThis as unknown as { EventSource?: typeof EventSource }).EventSource
  if (!ES) throw new Error('fromEventSource: no EventSource available — pass one via opts.EventSource')

  const es = new ES(url, { withCredentials: opts.withCredentials })
  const { push, end, stream } = pushToPull<MessageEvent>({ onTeardown: () => es.close() })

  const names = opts.events && opts.events.length > 0 ? opts.events : ['message']
  for (const name of names) {
    es.addEventListener(name, ((evt: MessageEvent) => {
      push(evt)
    }) as EventListener)
  }
  es.addEventListener('error', () => {
    // The platform ITSELF retries a dropped connection (with Last-Event-ID) unless readyState is
    // CLOSED — this adapter only ends the Streamed<T> if the source has actually given up.
    if (es.readyState === ES.CLOSED) end(new Error('EventSource closed'))
  })

  return stream
}
