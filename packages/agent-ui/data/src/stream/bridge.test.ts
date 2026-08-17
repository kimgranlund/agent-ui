import { describe, it, expect, vi } from 'vitest'
import { pushToPull } from './bridge.ts'

async function collect<T>(iter: AsyncIterable<T>, count: number): Promise<T[]> {
  const out: T[] = []
  for await (const v of iter) {
    out.push(v)
    if (out.length >= count) break
  }
  return out
}

describe('pushToPull — SPEC-R12', () => {
  it("AC1: 'buffer' keeps every pushed value, yielded in order", async () => {
    const { push, end, stream } = pushToPull<number>({ backpressure: 'buffer', highWaterMark: 2 })
    push(1)
    push(2)
    push(3) // over HWM(2) — 'buffer' keeps it anyway, push() just returns false as the cue
    end()
    const values: number[] = []
    for await (const v of stream) values.push(v)
    expect(values).toEqual([1, 2, 3])
  })

  it("AC1: 'drop-oldest' at HWM drops the oldest queued value", async () => {
    const { push, end, stream } = pushToPull<number>({ backpressure: 'drop-oldest', highWaterMark: 2 })
    push(1)
    push(2)
    push(3) // queue at HWM(2) -> drop oldest (1), keep [2,3]
    end()
    const values: number[] = []
    for await (const v of stream) values.push(v)
    expect(values).toEqual([2, 3])
  })

  it("AC1: 'drop-newest' at HWM drops the incoming value", async () => {
    const { push, end, stream } = pushToPull<number>({ backpressure: 'drop-newest', highWaterMark: 2 })
    push(1)
    push(2)
    push(3) // queue at HWM(2) -> drop incoming (3), keep [1,2]
    end()
    const values: number[] = []
    for await (const v of stream) values.push(v)
    expect(values).toEqual([1, 2])
  })

  it('AC2: return() then abort() -> onTeardown count is 1', async () => {
    const controller = new AbortController()
    const onTeardown = vi.fn()
    const { stream } = pushToPull<number>({ signal: controller.signal, onTeardown })
    const iterator = stream[Symbol.asyncIterator]()
    await iterator.return!()
    controller.abort()
    expect(onTeardown).toHaveBeenCalledTimes(1)
  })

  it('AC2: abort() then return() -> onTeardown count is 1 (reverse order)', async () => {
    const controller = new AbortController()
    const onTeardown = vi.fn()
    const { stream } = pushToPull<number>({ signal: controller.signal, onTeardown })
    const iterator = stream[Symbol.asyncIterator]()
    controller.abort()
    await iterator.return!()
    expect(onTeardown).toHaveBeenCalledTimes(1)
  })

  it('AC3: push after end is a no-op — no yield, no throw', async () => {
    const { push, end, stream } = pushToPull<number>()
    push(1)
    end()
    const afterEnd = push(2) // no-op
    expect(afterEnd).toBe(false)
    const values = await collect(stream, 5)
    expect(values).toEqual([1])
  })

  it('a waiting next() resolves as soon as a value is pushed', async () => {
    const { push, stream } = pushToPull<number>()
    const iterator = stream[Symbol.asyncIterator]()
    const pending = iterator.next()
    push(42)
    const result = await pending
    expect(result).toEqual({ value: 42, done: false })
  })

  it('a waiting next() resolves done:true when end() is called with no pending value', async () => {
    const { end, stream } = pushToPull<number>()
    const iterator = stream[Symbol.asyncIterator]()
    const pending = iterator.next()
    end()
    const result = await pending
    expect(result).toEqual({ value: undefined, done: true })
  })

  it('two concurrent next() calls on an empty queue BOTH settle, in order — the second never strands the first', async () => {
    const { push, end, stream } = pushToPull<number>()
    const it = stream[Symbol.asyncIterator]()
    const p1 = it.next()
    const p2 = it.next()
    push(1)
    push(2)
    expect(await p1).toEqual({ value: 1, done: false })
    expect(await p2).toEqual({ value: 2, done: false })
    const p3 = it.next()
    const p4 = it.next()
    end()
    expect(await p3).toEqual({ value: undefined, done: true })
    expect(await p4).toEqual({ value: undefined, done: true })
  })

  it('a signal that is ALREADY aborted at construction tears down immediately — not on first pull', () => {
    const onTeardown = vi.fn()
    const ac = new AbortController()
    ac.abort()
    const { push } = pushToPull<number>({ signal: ac.signal, onTeardown })
    expect(onTeardown).toHaveBeenCalledTimes(1)
    expect(push(1)).toBe(false)
  })

  it('return() while a next() is parked settles that next() done:true (never hangs) and tears down once', async () => {
    const onTeardown = vi.fn()
    const { push, stream } = pushToPull<number>({ onTeardown })
    const iterator = stream[Symbol.asyncIterator]()
    const pending = iterator.next()
    await iterator.return!()
    expect(await pending).toEqual({ value: undefined, done: true })
    expect(onTeardown).toHaveBeenCalledTimes(1)
    expect(push(1)).toBe(false) // producer pushes after a consumer return are no-ops
    expect((await iterator.next()).done).toBe(true)
  })
})
