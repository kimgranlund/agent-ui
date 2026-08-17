// core/paginated.ts — SPEC-R7: `paginated()`, a thin cursor-pagination layer over `resource()`.
// Pages live under ONE store key, never one key per page.

import { computed, type ReadonlySignal } from '@agent-ui/components'
import type { SourceContext } from './data-source.ts'
import { resource } from './resource.ts'
import { type Store, defaultStore } from './cache.ts'
import type { DataError } from './error.ts'
import type { ResourceStatus } from './resource.ts'

export interface PaginatedOptions<P, C> {
  store?: Store
  getNextCursor: (lastPage: P) => C | undefined
}

export interface Paginated<P> {
  readonly pages: ReadonlySignal<readonly P[]>
  readonly status: ReadonlySignal<ResourceStatus>
  readonly error: ReadonlySignal<DataError | undefined>
  readonly pending: ReadonlySignal<boolean>
  readonly hasMore: ReadonlySignal<boolean>
  loadMore(): Promise<void>
  refetch(): Promise<void>
  dispose(): void
}

interface PageState<P, C> {
  pages: P[]
  nextCursor: C | undefined
  exhausted: boolean
}

export function paginated<P, C = unknown>(
  key: string,
  fetchPage: (cursor: C | undefined, ctx: SourceContext) => Promise<P>,
  opts: PaginatedOptions<P, C>,
): Paginated<P> {
  const store = opts.store ?? defaultStore

  // The underlying resource tracks lifecycle (status/error/pending) for THIS key; its `data` is
  // the accumulated PageState, never a per-page key. `read` always re-derives the FIRST page, so
  // an invalidate-triggered refetch (wired through resource()'s own store subscription) naturally
  // resets to page one — SPEC-R7 AC2.
  const inner = resource<PageState<P, C>>(
    key,
    {
      async read(_k, ctx) {
        const first = await fetchPage(undefined, ctx)
        const nextCursor = opts.getNextCursor(first)
        return { pages: [first], nextCursor, exhausted: nextCursor === undefined }
      },
    },
    { store },
  )

  const pagesSig = computed<readonly P[]>(() => inner.data.value?.pages ?? [])
  const hasMoreSig = computed<boolean>(() => !(inner.data.value?.exhausted ?? false))

  let loadingMore: Promise<void> | undefined
  let disposed = false
  let loadMoreController: AbortController | undefined

  async function loadMore(): Promise<void> {
    if (loadingMore) return loadingMore
    const st = inner.data.peek()
    if (!st || st.exhausted || disposed) return
    loadingMore = (async () => {
      const controller = new AbortController()
      loadMoreController = controller
      const ctx: SourceContext = { signal: controller.signal }
      const page = await fetchPage(st.nextCursor, ctx)
      // Race guard (identity, not equality): if the page list was REPLACED while this page was in
      // flight — an invalidate/refetch reset it to a fresh first page, or dispose() ran — appending
      // onto the stale `st` would resurrect the old list. The in-flight page is simply dropped.
      if (disposed || controller.signal.aborted || inner.data.peek() !== st) return
      const nextCursor = opts.getNextCursor(page)
      const next: PageState<P, C> = { pages: [...st.pages, page], nextCursor, exhausted: nextCursor === undefined }
      store.commit(key, next) // mirrored into inner.data via the resource's own 'commit' subscription — no re-fetch
    })()
    try {
      await loadingMore
    } finally {
      loadingMore = undefined
      loadMoreController = undefined
    }
  }

  return {
    pages: pagesSig,
    status: inner.status,
    error: inner.error,
    pending: inner.pending,
    hasMore: hasMoreSig,
    loadMore,
    async refetch() {
      loadMoreController?.abort() // a page-append racing a refetch is superseded — the fresh first page wins
      await inner.refetch()
    },
    dispose() {
      disposed = true
      loadMoreController?.abort()
      inner.dispose()
    },
  }
}
