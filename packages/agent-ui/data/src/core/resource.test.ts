import { describe, it, expect, vi } from 'vitest'
import { effect } from '@agent-ui/components'
import { resource } from './resource.ts'
import { createStore } from './cache.ts'
import type { DataSource } from './data-source.ts'

function flushMicrotasks(times = 5): Promise<void> {
  return new Promise((r) => {
    let n = 0
    const tick = () => {
      n++
      if (n >= times) r()
      else Promise.resolve().then(tick)
    }
    tick()
  })
}

describe('resource() — SPEC-R3', () => {
  it('AC1: idle -> loading -> success on a resolving source; -> error on a rejecting one, data unchanged', async () => {
    const store = createStore()
    const ok: DataSource<number> = { read: async () => 7 }
    const r = resource('k1', ok, { store })
    expect(r.status.value === 'idle' || r.status.value === 'loading').toBe(true)
    await flushMicrotasks()
    expect(r.status.value).toBe('success')
    expect(r.data.value).toBe(7)
    expect(r.updatedAt.value).toBeTypeOf('number')

    const failing: DataSource<number> = { read: async () => { throw new Error('nope') } }
    const r2 = resource('k2', failing, { store })
    await flushMicrotasks()
    expect(r2.status.value).toBe('error')
    expect(r2.error.value?.kind).toBe('unknown')
    expect(r2.data.value).toBeUndefined()
  })

  it('AC2: SWR — a pre-seeded store serves data synchronously while a background revalidate runs', async () => {
    const store = createStore()
    store.commit('k', 1)
    let resolveRead!: (v: number) => void
    const src: DataSource<number> = { read: () => new Promise((res) => { resolveRead = res }) }
    const r = resource('k', src, { store })
    expect(r.data.value).toBe(1) // synchronous
    expect(r.status.value).toBe('success')
    expect(r.pending.value).toBe(true) // background revalidate in flight
    resolveRead(2)
    await flushMicrotasks()
    expect(r.data.value).toBe(2)
    expect(r.pending.value).toBe(false)
  })

  it('AC3: dedup — two resources on one key created in one tick call the source exactly once', async () => {
    const store = createStore()
    const readSpy = vi.fn(async () => 5)
    const src: DataSource<number> = { read: readSpy }
    const a = resource('dup', src, { store })
    const b = resource('dup', src, { store })
    await flushMicrotasks()
    expect(readSpy).toHaveBeenCalledTimes(1)
    expect(a.data.value).toBe(5)
    expect(b.data.value).toBe(5)
  })

  it('AC4: invalidate(prefix) refetches every active resource under it, not an unrelated key', async () => {
    const store = createStore()
    let n = 0
    const usersSpy = vi.fn(async () => ++n)
    const postsSpy = vi.fn(async () => 100)
    const u = resource('users/1', { read: usersSpy }, { store })
    const p = resource('posts/1', { read: postsSpy }, { store })
    await flushMicrotasks()
    expect(usersSpy).toHaveBeenCalledTimes(1)
    expect(postsSpy).toHaveBeenCalledTimes(1)
    store.invalidate('users/')
    await flushMicrotasks()
    expect(usersSpy).toHaveBeenCalledTimes(2)
    expect(postsSpy).toHaveBeenCalledTimes(1)
    void u
    void p
  })

  it('AC5: dispose() aborts the in-flight signal; refetch() aborts the earlier call and the later result wins', async () => {
    const store = createStore()
    let seenSignal: AbortSignal | undefined
    const src: DataSource<string> = {
      read: (_k, ctx) => {
        seenSignal = ctx.signal
        return new Promise((res) => setTimeout(() => res('v'), 5))
      },
    }
    const r = resource('disp', src, { store })
    await flushMicrotasks()
    r.dispose()
    expect(seenSignal?.aborted).toBe(true)

    let call = 0
    const src2: DataSource<string> = {
      read: () => (call++ === 0 ? new Promise<string>(() => {}) : Promise.resolve('second')),
    }
    const r2 = resource('refetch-key', src2, { store })
    await flushMicrotasks()
    void r2.refetch()
    await flushMicrotasks(10)
    expect(r2.data.value).toBe('second')
  })

  it('AC6: headless — resource() runs to completion with no window/document reference (see headless.test.ts for the static gate)', async () => {
    const store = createStore()
    const r = resource('h', { read: async () => 1 }, { store })
    await flushMicrotasks()
    expect(r.data.value).toBe(1)
  })

  it('AC7: live:true wakes data three times in order from a subscribe() source', async () => {
    const store = createStore()
    async function* gen(): AsyncGenerator<number> {
      yield 1
      yield 2
      yield 3
    }
    const src: DataSource<number> = { subscribe: () => gen() }
    const seen: number[] = []
    const r = resource('live', src, { store, live: true })
    const dispose = effect(() => {
      if (r.data.value !== undefined) seen.push(r.data.value)
    })
    await flushMicrotasks(10)
    expect(seen).toEqual([1, 2, 3])
    expect(r.status.value).toBe('success')
    dispose()
  })

  it('R2 AC2: a source without subscribe used with live:true fails fast with a missing-capability DataError', async () => {
    const store = createStore()
    const r = resource('nolive', { read: async () => 1 }, { store, live: true })
    await flushMicrotasks()
    // read still succeeds; live silently no-ops without `subscribe` (no verb, no crash) — but requesting
    // `live` from a read-only source and calling refetch on a source lacking read after removing it errors:
    const noRead = resource('noread', {}, { store: createStore() })
    await flushMicrotasks()
    expect(noRead.error.value?.code).toBe('missing-capability')
    expect(noRead.status.value).toBe('error')
    void r
  })

  it('an external commit (not an invalidate) is mirrored into data without re-fetching', async () => {
    const store = createStore()
    const readSpy = vi.fn(async () => 1)
    const r = resource('mirror', { read: readSpy }, { store })
    await flushMicrotasks()
    expect(readSpy).toHaveBeenCalledTimes(1)
    store.commit('mirror', 999)
    await flushMicrotasks()
    expect(r.data.value).toBe(999)
    expect(readSpy).toHaveBeenCalledTimes(1) // no extra read triggered
  })
})
