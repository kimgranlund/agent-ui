import { describe, it, expect, vi } from 'vitest'
import { mutation } from './mutation.ts'
import { resource } from './resource.ts'
import { createStore } from './cache.ts'

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

describe('mutation() — SPEC-R5', () => {
  it('AC1: status is pending before fn resolves, success after; a rejecting fn yields a DataError', async () => {
    const store = createStore()
    let resolveFn!: (v: number) => void
    const m = mutation<void, number>(() => new Promise((res) => { resolveFn = res }), { store })
    const p = m.run()
    expect(m.status.value).toBe('pending')
    resolveFn(1)
    await p
    expect(m.status.value).toBe('success')

    const failing = mutation<void, number>(async () => { throw new Error('nope') }, { store })
    await failing.run()
    expect(failing.status.value).toBe('error')
    expect(failing.error.value?.kind).toBe('unknown')
  })

  it('AC2: invalidate keys refetch an active resource on settle (either way)', async () => {
    const store = createStore()
    let n = 0
    const readSpy = vi.fn(async () => ++n)
    const r = resource('users/1', { read: readSpy }, { store })
    await flushMicrotasks()
    expect(readSpy).toHaveBeenCalledTimes(1)

    const m = mutation<void, void>(async () => {}, { store, invalidate: ['users/'] })
    await m.run()
    await flushMicrotasks()
    expect(readSpy).toHaveBeenCalledTimes(2)
    void r
  })

  it('AC3: optimistic write is visible synchronously; on error the touched key rolls back byte-equal, untouched keys keep identity', async () => {
    const store = createStore()
    const untouchedRef = { id: 2, name: 'b' }
    store.commit('users/2', untouchedRef)
    const patched = { id: 1, name: 'patched' }

    const m = mutation<typeof patched, void>(
      async () => { throw new Error('rejected') },
      { store, optimistic: (input, s) => s.commit('users/1', input) },
    )
    const run = m.run(patched)
    expect(store.get('users/1')).toBe(patched) // synchronous, before fn settles
    await run
    expect(store.get('users/1')).toBeUndefined() // rolled back to the pre-run value (absent)
    expect(store.get('users/2')).toBe(untouchedRef) // Object.is-same, untouched
  })

  it('AC4: two concurrent runs touching different keys — only the first rejecting run rolls back its own key', async () => {
    const store = createStore()
    let resolveB!: (v: void) => void

    const mA = mutation<void, void>(async () => { throw new Error('a fails') }, {
      store,
      optimistic: (_i, s) => s.commit('a', 'a-optimistic'),
    })
    const mB = mutation<void, void>(() => new Promise((res) => { resolveB = res }), {
      store,
      optimistic: (_i, s) => s.commit('b', 'b-optimistic'),
    })

    const runA = mA.run()
    const runB = mB.run() // b's snapshot captures a's optimistic write already in the store
    await runA // a settles (rejects) first
    expect(store.get('a')).toBeUndefined() // a's own key rolled back
    expect(store.get('b')).toBe('b-optimistic') // b's key untouched by a's rollback

    resolveB()
    await runB
    expect(store.get('b')).toBe('b-optimistic')
  })

  it('a run after dispose() is inert', async () => {
    const store = createStore()
    const fn = vi.fn(async () => 1)
    const m = mutation<void, number>(fn, { store })
    m.dispose()
    const result = await m.run()
    expect(result).toBeUndefined()
  })
})
