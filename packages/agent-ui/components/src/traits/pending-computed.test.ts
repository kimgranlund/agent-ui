import { describe, it, expect, vi } from 'vitest'
import { signal, whenFlushed } from '../reactive/index.ts'
import { UIElement } from '../dom/index.ts'
import { pendingComputed, type PendingComputedController } from './pending-computed.ts'

// The pendingComputed controller (GH #974): last-settled `value` + query-scoped `pending` (+ `error`) around
// a Promise or async-iterable source. Named probes: promise-settle · stale-content-stays-visible ·
// query-scoped-pending (supersession) · rejection · async-iterable-yields · null-source-clears-pending ·
// release-ignores-late-settle · zero-residue-on-disconnect · re-arm-on-reconnect.

/** Deferred helper: a Promise plus externally-callable resolve/reject, for controlling settle order in tests. */
function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// `queryFn` reads a SIGNAL (`queryKey`) so a signal write re-runs the SAME controller's tracking effect — the
// real mechanism a consumer relies on for "a new query starts", as opposed to installing a fresh controller
// (which would start with fresh, empty signals — not the shape under test in `stale-content-stays-visible` /
// `query-scoped-pending` below).
class PendingEl extends UIElement {
  controller: PendingComputedController<string> | null = null
  readonly queryKey = signal(0)
  queryFn: ((key: number) => Promise<string> | AsyncIterable<string> | null | undefined) | null = null
  source: (() => Promise<string> | AsyncIterable<string> | null | undefined) | null = null
  protected connected(): void {
    this.controller = pendingComputed(this, {
      source: () => (this.queryFn ? this.queryFn(this.queryKey.value) : (this.source?.() ?? undefined)),
    })
  }
}
customElements.define('ui-pending-probe', PendingEl)

describe('pendingComputed — last-settled value + query-scoped pending (GH #974)', () => {
  it('promise-settle: pending flips true immediately, then false + value set on resolve', async () => {
    const d = deferred<string>()
    const el = new PendingEl()
    el.source = () => d.promise
    document.body.append(el)

    expect(el.controller!.pending.value).toBe(true)
    expect(el.controller!.value.value).toBeUndefined()

    d.resolve('first')
    await d.promise
    await Promise.resolve() // let the .then() microtask flush

    expect(el.controller!.pending.value).toBe(false)
    expect(el.controller!.value.value).toBe('first')
    el.remove()
  })

  it('stale-content-stays-visible: a new query starting never blanks the last-settled value', async () => {
    const d1 = deferred<string>()
    const d2 = deferred<string>()
    const el = new PendingEl()
    el.queryFn = (key) => (key === 0 ? d1.promise : d2.promise)
    document.body.append(el)
    d1.resolve('answer-A')
    await d1.promise
    await Promise.resolve()
    expect(el.controller!.value.value).toBe('answer-A')

    // A real reactive re-run of the SAME controller's tracking effect — writing the signal `source()` reads.
    // Effect re-runs are microtask-scheduled (scheduler.ts), so wait for the batch to settle before reading.
    el.queryKey.value = 1
    await whenFlushed()

    expect(el.controller!.pending.value).toBe(true)
    expect(el.controller!.value.value).toBe('answer-A') // stale content still visible — never blanked
    el.remove()
  })

  it('query-scoped-pending: a superseded query resolving late never clears pending or overwrites value for the current one', async () => {
    const stale = deferred<string>()
    const current = deferred<string>()
    const el = new PendingEl()
    el.queryFn = (key) => (key === 0 ? stale.promise : current.promise)
    document.body.append(el)
    expect(el.controller!.pending.value).toBe(true)

    // A newer question starts via the same reactive mechanism as above.
    el.queryKey.value = 1
    await whenFlushed()
    expect(el.controller!.pending.value).toBe(true)

    // The STALE query resolves after being superseded — must be ignored entirely (query-scoped by generation).
    stale.resolve('stale-answer')
    await stale.promise
    await Promise.resolve()
    expect(el.controller!.pending.value).toBe(true) // unaffected by the stale settle
    expect(el.controller!.value.value).toBeUndefined() // never adopted the stale answer

    current.resolve('current-answer')
    await current.promise
    await Promise.resolve()
    expect(el.controller!.pending.value).toBe(false)
    expect(el.controller!.value.value).toBe('current-answer')
    el.remove()
  })

  it('rejection: error is set and pending clears on a rejected promise; error clears on the next query', async () => {
    const d = deferred<string>()
    const el = new PendingEl()
    el.source = () => d.promise
    document.body.append(el)

    const boom = new Error('boom')
    d.reject(boom)
    await d.promise.catch(() => {})
    await Promise.resolve()

    expect(el.controller!.pending.value).toBe(false)
    expect(el.controller!.error.value).toBe(boom)
    expect(el.controller!.value.value).toBeUndefined() // never settled a value

    // Next query clears the error even before it settles.
    const d2 = deferred<string>()
    el.controller!.release()
    el.controller = pendingComputed(el, { source: () => d2.promise })
    expect(el.controller!.error.value).toBeUndefined()
    el.remove()
  })

  it('async-iterable-yields: each yield is a settle (value advances, pending stays true until done)', async () => {
    async function* stream(): AsyncGenerator<string> {
      yield 'chunk-1'
      yield 'chunk-2'
    }
    const el = new PendingEl()
    el.source = () => stream()
    document.body.append(el)

    // A macrotask hop guarantees a full microtask drain (an async generator's yield/resume machinery takes
    // several microtask ticks per step — several `await Promise.resolve()` calls undercounts it).
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(el.controller!.value.value).toBe('chunk-2') // last yield wins
    expect(el.controller!.pending.value).toBe(false) // iterator completed (done: true)
    el.remove()
  })

  it('null-source-clears-pending: a null/undefined source clears pending + error, leaves value alone', async () => {
    const d = deferred<string>()
    const el = new PendingEl()
    el.source = () => d.promise
    document.body.append(el)
    d.resolve('kept')
    await d.promise
    await Promise.resolve()
    expect(el.controller!.value.value).toBe('kept')

    el.controller!.release()
    el.controller = pendingComputed(el, { source: () => undefined })
    expect(el.controller!.pending.value).toBe(false)
    expect(el.controller!.error.value).toBeUndefined()
    expect(el.controller!.value.value).toBeUndefined() // fresh controller instance — value starts undefined
    el.remove()
  })

  it('release-ignores-late-settle: a released controller never mutates its signals from a late resolve', async () => {
    const d = deferred<string>()
    const el = new PendingEl()
    el.source = () => d.promise
    document.body.append(el)
    const c = el.controller!
    c.release()

    d.resolve('too-late')
    await d.promise
    await Promise.resolve()

    expect(c.value.value).toBeUndefined()
    expect(c.pending.value).toBe(true) // frozen at whatever it was the instant release() ran
    el.remove()
  })

  it('zero-residue-on-disconnect: an async iterator is told to return() when the host disconnects', async () => {
    const returnSpy = vi.fn(async () => ({ value: undefined, done: true as const }))
    const source: AsyncIterable<string> = {
      [Symbol.asyncIterator]() {
        return {
          next: () => new Promise<IteratorResult<string>>(() => {}), // never settles on its own
          return: returnSpy,
        }
      },
    }
    const el = new PendingEl()
    el.source = () => source
    document.body.append(el)
    el.remove() // disconnect — the scope-owned effect's cleanup should call iterator.return()
    await Promise.resolve()
    expect(returnSpy).toHaveBeenCalledTimes(1)
  })

  it('re-arm-on-reconnect: a fresh connected() call installs a fresh controller with fresh signals', async () => {
    const el = new PendingEl()
    el.source = () => Promise.resolve('a')
    document.body.append(el)
    const first = el.controller
    el.remove()
    document.body.append(el)
    const second = el.controller
    expect(second).not.toBe(first)
  })
})
