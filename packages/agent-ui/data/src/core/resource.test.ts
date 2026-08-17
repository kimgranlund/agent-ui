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

  it('AC3+AC5 cross: dispose() on ONE of two deduped resources never aborts the shared read; the LAST holder out does', async () => {
    const store = createStore()
    let seenSignal: AbortSignal | undefined
    let resolveRead!: (v: string) => void
    const readSpy = vi.fn((_k: string, ctx: { signal: AbortSignal }) => {
      seenSignal = ctx.signal
      return new Promise<string>((res) => {
        resolveRead = res
      })
    })
    const a = resource('shared', { read: readSpy }, { store })
    const b = resource('shared', { read: readSpy }, { store })
    await flushMicrotasks()
    expect(readSpy).toHaveBeenCalledTimes(1)
    a.dispose()
    expect(seenSignal?.aborted).toBe(false) // b still holds the shared read — not stranded
    resolveRead('v')
    await flushMicrotasks()
    expect(b.data.value).toBe('v')
    expect(b.status.value).toBe('success')
    expect(a.data.value).toBeUndefined()

    // last holder out aborts (SPEC-R3 d), and a resource disposed mid-flight reports nothing pending
    const c = resource('shared2', { read: readSpy }, { store })
    const d = resource('shared2', { read: readSpy }, { store })
    await flushMicrotasks()
    c.dispose()
    expect(seenSignal?.aborted).toBe(false)
    d.dispose()
    expect(seenSignal?.aborted).toBe(true)
    expect(d.pending.value).toBe(false)
  })

  it('AC3+AC5 cross: refetch() on ONE of two deduped resources starts a fresh read for it and leaves the sibling on the original', async () => {
    const store = createStore()
    let seenSignal: AbortSignal | undefined
    let resolveFirst!: (v: string) => void
    let calls = 0
    const src: DataSource<string> = {
      read: (_k, ctx) => {
        calls++
        if (calls === 1) {
          seenSignal = ctx.signal
          return new Promise<string>((res) => {
            resolveFirst = res
          })
        }
        return Promise.resolve('second')
      },
    }
    const a = resource('joined', src, { store })
    const b = resource('joined', src, { store })
    await flushMicrotasks()
    expect(calls).toBe(1)
    void a.refetch()
    expect(calls).toBe(2) // orphaned, not rejoined
    expect(seenSignal?.aborted).toBe(false) // b still awaits the first read
    await flushMicrotasks(10)
    expect(a.data.value).toBe('second')
    expect(a.pending.value).toBe(false)
    expect(b.pending.value).toBe(true) // b is still awaiting the original (un-aborted) read
    resolveFirst('first')
    await flushMicrotasks(10)
    expect(b.data.value).toBe('first') // b's own read settled normally — never stranded, never rejected
    expect(b.status.value).toBe('success')
    expect(b.pending.value).toBe(false)
    expect(calls).toBe(2)
  })

  it('invalidate() refetches even inside a staleMs freshness window (staleMs is an SWR shortcut, not an invalidate shield)', async () => {
    const store = createStore()
    let n = 0
    const readSpy = vi.fn(async () => ++n)
    const r = resource('fresh', { read: readSpy }, { store, staleMs: 60_000 })
    await flushMicrotasks()
    expect(readSpy).toHaveBeenCalledTimes(1)
    expect(r.data.value).toBe(1)
    store.invalidate('fresh')
    await flushMicrotasks()
    expect(readSpy).toHaveBeenCalledTimes(2)
    expect(r.data.value).toBe(2)
  })

  it('R2 AC2: live:true over a source without subscribe fails fast with a missing-capability DataError (no throw at construction)', async () => {
    const store = createStore()
    const readSpy = vi.fn(async () => 1)
    const r = resource('nolive', { read: readSpy }, { store, live: true })
    expect(r.status.value).toBe('error')
    expect(r.error.value?.code).toBe('missing-capability')
    await flushMicrotasks()
    expect(r.status.value).toBe('error') // a read never runs against a misconfigured resource
    expect(readSpy).not.toHaveBeenCalled()
    expect(r.pending.value).toBe(false)

    const noRead = resource('noread', {}, { store: createStore() })
    await flushMicrotasks()
    expect(noRead.error.value?.code).toBe('missing-capability')
    expect(noRead.status.value).toBe('error')

    // a subscribe-only source with live:true (the SPEC §5 `presence` example) is NOT a capability error
    async function* gen(): AsyncGenerator<number> {
      yield 42
    }
    const liveOnly = resource('presence', { subscribe: () => gen() }, { store: createStore(), live: true })
    await flushMicrotasks(10)
    expect(liveOnly.error.value).toBeUndefined()
    expect(liveOnly.data.value).toBe(42)
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
