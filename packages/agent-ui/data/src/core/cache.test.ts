import { describe, it, expect, vi } from 'vitest'
import { createStore } from './cache.ts'

describe('createStore — SPEC-R4', () => {
  it('single-writer: mutating a value obtained from get() does not wake subscribers, and get() still returns the committed reference', () => {
    const store = createStore<{ n: number }>()
    store.commit('a', { n: 1 })
    const cb = vi.fn()
    store.subscribe('a', cb)
    const got = store.get('a')!
    got.n = 999 // direct in-place mutation — not a `commit`
    expect(cb).not.toHaveBeenCalled()
    expect(store.get('a')).toBe(got) // same reference, single-writer proven by observation
  })

  it('snapshot -> commit -> restore round-trips byte-equal; untouched keys keep identity', () => {
    const store = createStore<number>()
    store.commit('a', 1)
    const bVal = 100
    store.commit('b', bVal)
    const snap = store.snapshot()
    store.commit('a', 2)
    store.restore(snap)
    expect(store.get('a')).toBe(1)
    expect(store.get('b')).toBe(bVal) // Object.is-same reference before and after
  })

  it('commit with an Object.is-equal value does not wake subscribers', () => {
    const store = createStore<number>()
    store.commit('a', 1)
    const cb = vi.fn()
    store.subscribe('a', cb)
    store.commit('a', 1)
    expect(cb).not.toHaveBeenCalled()
  })

  it("invalidate('users/') wakes every users/* subscriber and not posts/1, with reason 'invalidate'", () => {
    const store = createStore<number>()
    store.commit('users/1', 1)
    store.commit('users/2', 2)
    store.commit('posts/1', 3)
    const usersCb = vi.fn()
    const postsCb = vi.fn()
    store.subscribe('users/1', usersCb)
    store.subscribe('posts/1', postsCb)
    store.invalidate('users/')
    expect(usersCb).toHaveBeenCalledWith('invalidate')
    expect(postsCb).not.toHaveBeenCalled()
  })

  it("commit notifies with reason 'commit'", () => {
    const store = createStore<number>()
    const cb = vi.fn()
    store.subscribe('a', cb)
    store.commit('a', 1)
    expect(cb).toHaveBeenCalledWith('commit')
  })

  it('restore() also wakes subscribers of a key the restored snapshot no longer holds (an optimistic create rolled back)', () => {
    const store = createStore<number>()
    const snap = store.snapshot()
    const created = vi.fn()
    store.subscribe('users/new', created)
    store.commit('users/new', 1) // the optimistic create
    expect(created).toHaveBeenCalledTimes(1)
    store.restore(snap) // rollback: the key is gone from the map
    expect(store.get('users/new')).toBeUndefined()
    expect(created).toHaveBeenCalledTimes(2)
    expect(created).toHaveBeenLastCalledWith('commit')
  })

  it('subscribe returns an unsubscribe function', () => {
    const store = createStore<number>()
    const cb = vi.fn()
    const unsub = store.subscribe('a', cb)
    unsub()
    store.commit('a', 1)
    expect(cb).not.toHaveBeenCalled()
  })
})
