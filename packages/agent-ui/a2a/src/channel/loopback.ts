// loopback.ts — the A2aChannel contract + in-proc loopback pair (LLD-C7, SPEC-R8/N5/N3). Two FIFO
// queues + pending-resolver lists; microtask-only (no timers, no I/O — SPEC-N3's "zero timers-of-
// faith"). Ordering is structural: `send` appends, `receive` shifts. This channel IS the arena's
// isolation boundary (arena LLD §2): message-level, no side channel.
import type { A2aMessage } from '../protocol/types.ts'

export interface A2aChannel {
  send(msg: A2aMessage): Promise<void>
  receive(): AsyncIterable<A2aMessage>
  close(): void
}

/** A programming-error signal: `send` after `close` is a loud failure, never a silent drop. */
export class A2aChannelClosedError extends Error {
  constructor() {
    super('A2aChannel: send() called after close()')
    this.name = 'A2aChannelClosedError'
  }
}

interface Waiter {
  resolve: (v: IteratorResult<A2aMessage>) => void
}

/** One direction's inbox: a FIFO queue + parked `receive()` waiters, plus its own closed flag. `push`
 * is called by the PEER's `send`; `drainAndClose` is called by this endpoint's own `close()`. The
 * caller (`makeEndpoint`'s `send`) checks `closed` BEFORE calling `push` — a send into an
 * already-closed peer inbox must reject, never silently drop (review fix, symmetry with own-close). */
class Inbox {
  private queue: A2aMessage[] = []
  private waiters: Waiter[] = []
  closed = false

  push(msg: A2aMessage): void {
    const waiter = this.waiters.shift()
    if (waiter) waiter.resolve({ value: msg, done: false })
    else this.queue.push(msg)
  }

  next(): Promise<IteratorResult<A2aMessage>> {
    const buffered = this.queue.shift()
    if (buffered !== undefined) return Promise.resolve({ value: buffered, done: false })
    if (this.closed) return Promise.resolve({ value: undefined, done: true })
    return new Promise((resolve) => this.waiters.push({ resolve }))
  }

  /** Buffered messages drain (already-parked `next()` calls resolve normally on subsequent ticks since
   * the queue is untouched here); pending waiters with nothing buffered get `done` immediately —
   * no loss, no hang (SPEC-N5). */
  drainAndClose(): void {
    if (this.closed) return
    this.closed = true
    for (const w of this.waiters.splice(0)) w.resolve({ value: undefined, done: true })
  }
}

function makeEndpoint(ownInbox: Inbox, peerInbox: Inbox): A2aChannel {
  let sendClosed = false
  return {
    send(msg: A2aMessage): Promise<void> {
      if (sendClosed) return Promise.reject(new A2aChannelClosedError())
      // Symmetry with own-close (review fix): a send into an ALREADY-CLOSED peer inbox must not
      // silently succeed-and-drop (the SPEC-N5 no-loss guarantee) — reject loudly instead.
      if (peerInbox.closed) return Promise.reject(new A2aChannelClosedError())
      peerInbox.push(msg)
      return Promise.resolve()
    },
    receive(): AsyncIterable<A2aMessage> {
      return {
        [Symbol.asyncIterator](): AsyncIterator<A2aMessage> {
          return { next: () => ownInbox.next() }
        },
      }
    },
    close(): void {
      sendClosed = true
      ownInbox.drainAndClose()
    },
  }
}

/** Two independent endpoints: sending on one delivers to the other's `receive()`. Each endpoint's
 * `close()` is self-scoped (own send starts rejecting, own receive drains-then-ends) — closing one side
 * does not force-close the other. */
export function createLoopbackPair(): [A2aChannel, A2aChannel] {
  const inboxA = new Inbox() // fed by B's send(); read by A's receive()
  const inboxB = new Inbox() // fed by A's send(); read by B's receive()
  return [makeEndpoint(inboxA, inboxB), makeEndpoint(inboxB, inboxA)]
}
