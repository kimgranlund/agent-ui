// resource-idb-store.test.ts — GH #1212 (req-doc-ingestion.md R4/R7): the routing/materialize/hydrate
// logic proven under jsdom (vitest) via an in-memory FAKE `StorageAdapter`, injected through the module's
// `__testSetAdapter` escape hatch. jsdom does not implement `indexedDB` at all
// (indexed-db-adapter.ts's own header), so this suite deliberately does not re-prove the real IndexedDB
// tier's own mechanics (already covered by `indexed-db-adapter.browser.test.ts`) — it proves THIS module's
// own contract: the threshold decision, the split at mint time, the reload-survival path (a second
// "instance" reading the same fake backing store — the real IndexedDB tier's own cross-instance test,
// `indexed-db-adapter.browser.test.ts`, is what proves the underlying database itself persists), and the
// export projection.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { StorageAdapter } from '@agent-ui/shared'
import type { Entry } from '../entry-list/entry-data.ts'
import {
  RESOURCE_IDB_TEXT_THRESHOLD_CHARS,
  RESOURCE_IDB_PLACEHOLDER,
  isLargeResourceText,
  routeResourceContent,
  entryTextLength,
  materializeResourceEntry,
  materializeResourceEntries,
  materializeResourceEntriesAsync,
  resourceEntriesForExport,
  hydrateResourceEntries,
  __testSetAdapter,
} from './resource-idb-store.ts'

/** A fresh in-memory fake honoring the exact `StorageAdapter` contract — the SAME shape a real
 *  `createIndexedDbAdapter` instance offers, so swapping it in proves this module's own logic without
 *  needing a real IndexedDB implementation. */
function fakeAdapter(): StorageAdapter {
  const values = new Map<string, unknown>()
  return {
    async get(key) {
      return values.get(key)
    },
    async set(key, value) {
      values.set(key, value)
    },
    async delete(key) {
      values.delete(key)
    },
    async keys() {
      return [...values.keys()]
    },
  }
}

/** A minimal well-formed resource `Entry` for the tests below — the fields this module's own functions
 *  actually read (`content`/`idbRef`/`contentLength`), plus the rest `Entry` requires. */
function resourceEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'doc',
    kind: 'resource',
    label: 'doc.txt',
    description: '1.0 KB',
    content: 'short text',
    order: 0,
    enabled: true,
    builtin: false,
    ...overrides,
  }
}

beforeEach(() => {
  __testSetAdapter(fakeAdapter())
})

afterEach(() => {
  __testSetAdapter(undefined)
})

describe('isLargeResourceText / RESOURCE_IDB_TEXT_THRESHOLD_CHARS', () => {
  it('text at or under the threshold is NOT large', () => {
    expect(isLargeResourceText('a'.repeat(RESOURCE_IDB_TEXT_THRESHOLD_CHARS))).toBe(false)
    expect(isLargeResourceText('short')).toBe(false)
  })

  it('one char past the threshold IS large', () => {
    expect(isLargeResourceText('a'.repeat(RESOURCE_IDB_TEXT_THRESHOLD_CHARS + 1))).toBe(true)
  })
})

describe('routeResourceContent — the mint-time split', () => {
  it('small text passes through unchanged: no idbRef, no IndexedDB write', async () => {
    const routed = await routeResourceContent('a short note')
    expect(routed).toEqual({ content: 'a short note' })
  })

  it('large text routes: content becomes the honest placeholder, idbRef + contentLength are minted', async () => {
    const big = 'x'.repeat(RESOURCE_IDB_TEXT_THRESHOLD_CHARS + 500)
    const routed = await routeResourceContent(big)
    expect(routed.content).toBe(RESOURCE_IDB_PLACEHOLDER)
    expect(routed.idbRef).toBeDefined()
    expect(routed.contentLength).toBe(big.length)
  })

  it('two large attaches in the same session mint DIFFERENT idbRefs', async () => {
    const big = 'y'.repeat(RESOURCE_IDB_TEXT_THRESHOLD_CHARS + 10)
    const first = await routeResourceContent(big)
    const second = await routeResourceContent(big)
    expect(first.idbRef).toBeDefined()
    expect(second.idbRef).toBeDefined()
    expect(first.idbRef).not.toBe(second.idbRef)
  })

  it('fails OPEN when the adapter write rejects — the real text stays inline, never lost', async () => {
    __testSetAdapter({
      async get() {
        return undefined
      },
      async set() {
        throw new Error('quota exceeded')
      },
      async delete() {},
      async keys() {
        return []
      },
    })
    const big = 'z'.repeat(RESOURCE_IDB_TEXT_THRESHOLD_CHARS + 200)
    const routed = await routeResourceContent(big)
    expect(routed).toEqual({ content: big })
  })
})

describe('entryTextLength — the aggregate-budget input, correct with no IndexedDB round trip', () => {
  it('an un-routed entry: content.length', () => {
    expect(entryTextLength(resourceEntry({ content: 'hello' }))).toBe(5)
  })

  it('a routed entry: the stored contentLength, not the placeholder length', () => {
    const entry = resourceEntry({ content: RESOURCE_IDB_PLACEHOLDER, idbRef: 'res-abc', contentLength: 42_000 })
    expect(entryTextLength(entry)).toBe(42_000)
  })

  it('a routed entry missing contentLength (a hand-forged/legacy shape) falls back to content.length', () => {
    const entry = resourceEntry({ content: 'placeholder', idbRef: 'res-abc' })
    expect(entryTextLength(entry)).toBe('placeholder'.length)
  })
})

describe('materializeResourceEntry(ies) — SYNCHRONOUS, cache-only', () => {
  it('an entry with no idbRef is returned unchanged', () => {
    const entry = resourceEntry()
    expect(materializeResourceEntry(entry)).toBe(entry)
  })

  it('a routed entry whose text was just written in THIS session materializes from the warm cache', async () => {
    const big = 'w'.repeat(RESOURCE_IDB_TEXT_THRESHOLD_CHARS + 50)
    const routed = await routeResourceContent(big)
    const entry = resourceEntry({ content: routed.content, idbRef: routed.idbRef, contentLength: routed.contentLength })
    const materialized = materializeResourceEntry(entry)
    expect(materialized.content).toBe(big)
  })

  it('a routed entry NOT yet cached (e.g. right after a simulated reload, before hydration) keeps its placeholder', () => {
    const entry = resourceEntry({ content: RESOURCE_IDB_PLACEHOLDER, idbRef: 'res-never-cached', contentLength: 9000 })
    expect(materializeResourceEntry(entry).content).toBe(RESOURCE_IDB_PLACEHOLDER)
  })

  it('materializeResourceEntries maps a whole list', async () => {
    const big = 'v'.repeat(RESOURCE_IDB_TEXT_THRESHOLD_CHARS + 20)
    const routed = await routeResourceContent(big)
    const small = resourceEntry({ id: 'small', content: 'tiny' })
    const large = resourceEntry({ id: 'large', content: routed.content, idbRef: routed.idbRef, contentLength: routed.contentLength })
    const [materializedSmall, materializedLarge] = materializeResourceEntries([small, large])
    expect(materializedSmall?.content).toBe('tiny')
    expect(materializedLarge?.content).toBe(big)
  })
})

describe('entries survive reload — the ticket’s own acceptance criterion', () => {
  it('a large entry’s real text is recoverable from a FRESH module state (simulated reload) via hydrateResourceEntries', async () => {
    // Session 1: attach a large document, mint the routed entry, persist ONLY the placeholder shape (the
    // sync store's own write — `content`/`idbRef`/`contentLength`, exactly what `#handleAttach` persists).
    const big = 'reload-me-'.repeat(1000) // well over the threshold
    const routed = await routeResourceContent(big)
    const persistedEntry = resourceEntry({ content: routed.content, idbRef: routed.idbRef, contentLength: routed.contentLength })
    expect(persistedEntry.content).toBe(RESOURCE_IDB_PLACEHOLDER) // never the real text in the "localStorage" shape

    // "Reload": the module cache is the only in-memory state a real page reload would lose — the
    // IndexedDB tier itself (the fake here) persists independently, exactly like the real one.
    const survivingAdapter = fakeAdapter()
    // Copy the fake IndexedDB's own backing data across (a real reload keeps the SAME on-disk database;
    // simulate that by re-pointing at a fresh module cache but the SAME underlying values).
    await survivingAdapter.set(persistedEntry.idbRef as string, big)
    __testSetAdapter(survivingAdapter)

    // Before hydration: the sync/cache-only materialize still shows the placeholder (honest — nothing
    // fetched yet).
    expect(materializeResourceEntry(persistedEntry).content).toBe(RESOURCE_IDB_PLACEHOLDER)

    // Hydrate (what `agent-admin.ts` runs at `connected()`), then the SAME sync materialize now recovers
    // the real text with no further IndexedDB round trip.
    await hydrateResourceEntries([persistedEntry])
    expect(materializeResourceEntry(persistedEntry).content).toBe(big)

    // The async form also recovers it directly, without relying on the cache having been warmed first.
    __testSetAdapter(survivingAdapter)
    const [asyncMaterialized] = await materializeResourceEntriesAsync([persistedEntry])
    expect(asyncMaterialized?.content).toBe(big)
  })

  it('hydrateResourceEntries never re-fetches an already-cached ref (a repeat connect() is cheap)', async () => {
    // Deliberately the SAME adapter instance throughout (switching adapters — the reload simulation above
    // — clears the cache by design; this test is about the OPPOSITE case, a repeat connect() against a
    // cache that is already warm from this session's own mint).
    const adapter = fakeAdapter()
    __testSetAdapter(adapter)
    const big = 'q'.repeat(RESOURCE_IDB_TEXT_THRESHOLD_CHARS + 10)
    const routed = await routeResourceContent(big) // warms the cache via THIS adapter's own write
    const entry = resourceEntry({ content: routed.content, idbRef: routed.idbRef, contentLength: routed.contentLength })
    const getSpy = vi.spyOn(adapter, 'get')
    // Already cached from routeResourceContent's own write — hydrate should see it in cache and skip the read.
    await hydrateResourceEntries([entry])
    expect(getSpy).not.toHaveBeenCalled()
  })

  it('a lost/unreadable ref keeps its placeholder rather than throwing (hydrate and async materialize alike)', async () => {
    const entry = resourceEntry({ content: RESOURCE_IDB_PLACEHOLDER, idbRef: 'res-orphaned', contentLength: 500 })
    await expect(hydrateResourceEntries([entry])).resolves.toBeUndefined()
    const [materialized] = await materializeResourceEntriesAsync([entry])
    expect(materialized?.content).toBe(RESOURCE_IDB_PLACEHOLDER)
  })
})

describe('resourceEntriesForExport — the debug-bundle/persona-file export projection', () => {
  it('inlines real content and strips idbRef/contentLength for a routed entry', async () => {
    const big = 'export-me-'.repeat(800)
    const routed = await routeResourceContent(big)
    const entry = resourceEntry({ content: routed.content, idbRef: routed.idbRef, contentLength: routed.contentLength })
    const [exported] = await resourceEntriesForExport([entry])
    expect(exported?.content).toBe(big)
    expect(exported).not.toHaveProperty('idbRef')
    expect(exported).not.toHaveProperty('contentLength')
  })

  it('an un-routed entry passes through unchanged', async () => {
    const entry = resourceEntry({ content: 'plain note' })
    const [exported] = await resourceEntriesForExport([entry])
    expect(exported).toEqual(entry)
  })
})
