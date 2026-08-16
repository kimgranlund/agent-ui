import { describe, it, expect, vi } from 'vitest'
import { paginated } from './paginated.ts'
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

interface Page {
  items: number[]
  next: number | undefined
}

describe('paginated() — SPEC-R7', () => {
  const fixturePages: Page[] = [
    { items: [1, 2], next: 1 },
    { items: [3, 4], next: 2 },
    { items: [5, 6], next: undefined },
  ]

  function makeFetchPage() {
    return vi.fn(async (cursor: number | undefined) => fixturePages[cursor ?? 0])
  }

  it('AC1: three loadMore() calls over a three-page fixture yields 3 pages and hasMore false', async () => {
    const store = createStore()
    const fetchPage = makeFetchPage()
    const p = paginated<Page, number>('feed', fetchPage, { store, getNextCursor: (last) => last.next })
    await flushMicrotasks()
    expect(p.pages.value.length).toBe(1) // the initial read already fetched page 1
    await p.loadMore()
    await p.loadMore()
    await flushMicrotasks()
    expect(p.pages.value.length).toBe(3)
    expect(p.hasMore.value).toBe(false)
  })

  it('AC2: invalidate(key) after two pages refetches from the first cursor and replaces pages with just the fresh first page', async () => {
    const store = createStore()
    const fetchPage = makeFetchPage()
    const p = paginated<Page, number>('feed2', fetchPage, { store, getNextCursor: (last) => last.next })
    await flushMicrotasks()
    await p.loadMore()
    await flushMicrotasks()
    expect(p.pages.value.length).toBe(2)

    store.invalidate('feed2')
    await flushMicrotasks()
    expect(p.pages.value.length).toBe(1)
    expect(p.pages.value[0]).toEqual(fixturePages[0])
    // the underlying resource's `read` always calls fetchPage(undefined, ...) — from the first cursor
    expect(fetchPage.mock.calls.some((c) => c[0] === undefined)).toBe(true)
  })

  it('loadMore() is a no-op once exhausted', async () => {
    const store = createStore()
    const fetchPage = makeFetchPage()
    const p = paginated<Page, number>('feed3', fetchPage, { store, getNextCursor: (last) => last.next })
    await flushMicrotasks()
    await p.loadMore()
    await p.loadMore()
    await flushMicrotasks()
    expect(p.hasMore.value).toBe(false)
    const callsBefore = fetchPage.mock.calls.length
    await p.loadMore()
    expect(fetchPage.mock.calls.length).toBe(callsBefore)
  })
})
