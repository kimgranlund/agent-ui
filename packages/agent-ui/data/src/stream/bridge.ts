// stream/bridge.ts — SPEC-R12: ONE contract (`Streamed<T> = AsyncIterable<T>`, `core/types.ts`) +
// `pushToPull`, the push-queue -> async-iterator bridge with a DECLARED backpressure policy and
// exact-once teardown. `AgentTransport.turn(): AsyncIterable<string>` (ADR-0137) is the house
// precedent this contract cites — untouched.

import type { Streamed } from '../core/types.ts'

export type Backpressure = 'buffer' | 'drop-oldest' | 'drop-newest'

export interface PushToPullOptions {
  backpressure?: Backpressure
  highWaterMark?: number
  signal?: AbortSignal
  onTeardown?: () => void
}

export interface PushToPull<T> {
  /** Returns `false` once the queue is at/over `highWaterMark` — the consumer's backpressure cue, never a throw. */
  push(v: T): boolean
  end(err?: unknown): void
  stream: Streamed<T>
}

/** `pushToPull<T>(opts)` — SPEC-R12. */
export function pushToPull<T>(opts: PushToPullOptions = {}): PushToPull<T> {
  const backpressure = opts.backpressure ?? 'buffer'
  const highWaterMark = opts.highWaterMark ?? 256

  const queue: T[] = []
  let ended = false
  let endError: unknown
  let tornDown = false
  // Waiters: a pending `next()` call parked because the queue is currently empty.
  let waiter: { resolve: (r: IteratorResult<T>) => void; reject: (e: unknown) => void } | undefined

  function teardown(): void {
    if (tornDown) return
    tornDown = true
    opts.onTeardown?.()
  }

  function push(v: T): boolean {
    if (ended || tornDown) return false
    if (waiter) {
      const w = waiter
      waiter = undefined
      w.resolve({ value: v, done: false })
      return queue.length < highWaterMark
    }
    if (queue.length >= highWaterMark) {
      if (backpressure === 'drop-newest') return false
      if (backpressure === 'drop-oldest') {
        queue.shift()
        queue.push(v)
        return false
      }
      // 'buffer': keep every pushed item, but signal the consumer's cue by returning false.
      queue.push(v)
      return false
    }
    queue.push(v)
    return queue.length < highWaterMark
  }

  function end(err?: unknown): void {
    if (ended) return
    ended = true
    endError = err
    if (waiter) {
      const w = waiter
      waiter = undefined
      if (err !== undefined) w.reject(err)
      else w.resolve({ value: undefined, done: true })
      teardown()
    }
  }

  if (opts.signal) {
    if (opts.signal.aborted) {
      // aborted before the bridge is even consumed — end immediately, teardown on first pull.
      ended = true
    } else {
      opts.signal.addEventListener(
        'abort',
        () => {
          end()
          teardown()
        },
        { once: true },
      )
    }
  }

  const stream: Streamed<T> = {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<T>> {
          if (queue.length > 0) {
            const value = queue.shift()!
            if (ended && queue.length === 0) teardown()
            return { value, done: false }
          }
          if (ended) {
            teardown()
            if (endError !== undefined) throw endError
            return { value: undefined, done: true }
          }
          return new Promise<IteratorResult<T>>((resolve, reject) => {
            waiter = { resolve, reject }
          })
        },
        async return(value?: unknown): Promise<IteratorResult<T>> {
          teardown()
          return { value, done: true }
        },
        async throw(e?: unknown): Promise<IteratorResult<T>> {
          teardown()
          throw e
        },
      }
    },
  }

  return { push, end, stream }
}
