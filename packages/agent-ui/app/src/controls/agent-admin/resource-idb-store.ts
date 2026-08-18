// resource-idb-store.ts — GH #1212 (req-doc-ingestion.md R4/R7): IndexedDB routing for LARGE resource-entry
// TEXT, off the ADR-0193 IndexedDB tier already shipped in `@agent-ui/shared` (`createIndexedDbAdapter`).
//
// WHY a threshold, and why THIS number. `entries:resource` (like every entry-list kind) lives as ONE JSON
// array inside `@agent-ui/app`'s `SettingsStore` (`memory-store.ts`), which write-throughs to the
// localStorage `StorageAdapter` tier (ADR-0193 cl.2) — a budget EVERY persisted key on the origin shares
// (ADR-0193 Consequences: "localStorage's ~5MB/origin ceiling"). A short hand-typed resource note costs
// that shared budget nothing; a genuinely large ingested document (`extractDocumentText`, GH #1210) can
// reach `MAX_DOCUMENT_CHARS` (50,000 chars, `document-budget.ts`) per document, UTF-16-doubled to roughly
// 100KB in the underlying string storage — and a handful of those across a roster of personas erodes the
// shared quota fast (exactly the "genuinely large-value consumer" case ADR-0193's own Consequences names
// as the IndexedDB tier's reason to exist). `RESOURCE_IDB_TEXT_THRESHOLD_CHARS` draws the line well UNDER
// that per-document ceiling — large enough that a short attached note or snippet never leaves the fast
// synchronous path (no IndexedDB round trip at all), small enough that anything approaching the real
// per-document budget routes out before it can matter.
//
// THE SYNC/ASYNC SEAM. `SettingsStore` is deliberately sync (LLD-C15 fork F7); `StorageAdapter` is
// deliberately async (ADR-0193 cl.1 — IndexedDB's own API cannot be sync). Routing a resource entry's TEXT
// onto the async tier while the entry itself still lives in the sync store means the entry's OWN `content`
// field can no longer always be the real text: a routed entry stores a short, honest PLACEHOLDER in
// `content` (never silently empty — this fleet's "honest degradation" law, the `truncateToBudget` marker
// precedent) plus an opaque `idbRef` pointing at the real text in the IndexedDB tier. Anything that needs
// the real text again reads through `materializeResourceEntry(Entries)` (sync, cache-only — fine for the
// common case where this session already holds it) or `materializeResourceEntriesAsync` (awaits IndexedDB
// directly — the export path's own need, since a user-triggered export can afford to await a click).
//
// ONE SHARED IndexedDB DATABASE. `Entry.id` is unique only WITHIN one persona's own kind list
// (`entry-data.ts`'s `validateNewEntry`), so two personas' resource entries can legally share an id (two
// "notes.md" attachments). Rather than thread a per-persona namespace into this module (which would need
// a persona identity `ui-agent-admin` does not itself carry), every routed entry mints its OWN globally
// unique `idbRef` at write time (`mintResourceIdbRef`) — collision-free by construction, independent of
// which persona, kind list, or entry id it belongs to.

import { createIndexedDbAdapter, type StorageAdapter } from '@agent-ui/shared'
import type { Entry } from '../entry-list/entry-data.ts'

/** The size boundary between "stays inline in the entry's own `content` field" (today's behavior, zero
 *  extra round trip) and "routes to the IndexedDB tier" — 4,000 chars. Chosen well under
 *  `MAX_DOCUMENT_CHARS` (50,000, `document-budget.ts`'s per-document cap) — the module banner's own
 *  reasoning: most hand-authored or short attached notes never leave the fast synchronous path, while a
 *  genuinely large ingested document routes out well before it can meaningfully compete for the shared
 *  ~5MB/origin localStorage budget (ADR-0193 Consequences). */
export const RESOURCE_IDB_TEXT_THRESHOLD_CHARS = 4_000

/** `true` iff `text` is long enough to route to the IndexedDB tier (`RESOURCE_IDB_TEXT_THRESHOLD_CHARS`). */
export function isLargeResourceText(text: string): boolean {
  return text.length > RESOURCE_IDB_TEXT_THRESHOLD_CHARS
}

/** The honest placeholder a routed entry's `content` carries — never empty, never silent (the
 *  `truncateToBudget` marker precedent, document-budget.ts): anything that reads `entry.content` without
 *  materializing it first sees a self-describing string, not blank text that looks like an empty note. */
export const RESOURCE_IDB_PLACEHOLDER = '[large document — content stored separately in the IndexedDB tier]'

const DB_NAME = 'agent-ui-resource-text'

let realAdapter: StorageAdapter | undefined
let adapterOverride: StorageAdapter | undefined

function getAdapter(): StorageAdapter {
  if (adapterOverride) return adapterOverride
  realAdapter ??= createIndexedDbAdapter({ dbName: DB_NAME })
  return realAdapter
}

/** Test-only escape hatch (the `document-extraction.ts` `__testResetRegistry` naming precedent): swap the
 *  backing `StorageAdapter` for an in-memory fake, so a jsdom-run vitest suite can prove this module's
 *  OWN routing/materialize/hydrate logic without touching real IndexedDB (jsdom does not implement it —
 *  `indexed-db-adapter.ts`'s own header; the real tier's own mechanics are already proven by
 *  `indexed-db-adapter.browser.test.ts`, not re-proven here). Also clears the module cache, so each test
 *  starts from a clean slate. `undefined` restores the real (lazily-constructed) IndexedDB adapter. */
export function __testSetAdapter(adapter: StorageAdapter | undefined): void {
  adapterOverride = adapter
  cache.clear()
}

/** A fresh, globally-unique IndexedDB key for one routed entry's text — independent of `Entry.id` (module
 *  banner: unique only within one persona's own kind list). Not a UUID (no crypto dependency needed for an
 *  opaque local key) — a timestamp plus a random suffix is collision-free enough for one browser's own
 *  IndexedDB database. */
function mintResourceIdbRef(): string {
  return `res-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** The in-memory cache every materialize/hydrate function reads/writes — keyed by `idbRef`, populated
 *  synchronously the moment a routed entry's real text is known (write time) or fetched (hydrate/read
 *  time). Deliberately module-scoped, not an element instance field: `idbRef` is already globally unique,
 *  and the export path (site/pages/agent-admin-app.ts) needs the SAME cache the live `ui-agent-admin`
 *  element warms, with no persona identity to thread between them. */
const cache = new Map<string, string>()

async function writeResourceText(ref: string, text: string): Promise<void> {
  await getAdapter().set(ref, text)
  cache.set(ref, text)
}

async function readResourceTextFresh(ref: string): Promise<string | undefined> {
  const value = await getAdapter().get(ref)
  if (typeof value !== 'string') return undefined
  cache.set(ref, value)
  return value
}

/** One entry's routed representation, minted at attach/mint time (`RoutedContent.idbRef` present) or the
 *  pass-through case (`idbRef` absent — `content` IS the real text, exactly today's behavior). */
export interface RoutedContent {
  content: string
  idbRef?: string
  contentLength?: number
}

/**
 * Decide + perform the routing for one freshly-extracted document's text (req-doc-ingestion R4): text at
 * or under the threshold passes through unchanged (`{ content: text }`, no IndexedDB touched at all); text
 * over it is written to the IndexedDB tier under a fresh `idbRef`, and the returned `content` is the
 * honest placeholder, with `contentLength` carrying the TRUE character count (so the per-agent aggregate
 * knowledge-budget sum, `entryTextLength` below, stays correct with no further IndexedDB round trip).
 *
 * FAILS OPEN: an IndexedDB write that throws (unavailable — SSR, a locked-down embed; a quota error; any
 * other rejection) is caught and this function falls back to the pass-through case — the real text stays
 * inline rather than being lost. The "large text never touches localStorage" guarantee is best-effort in
 * this one degraded case, never data loss.
 */
export async function routeResourceContent(text: string): Promise<RoutedContent> {
  if (!isLargeResourceText(text)) return { content: text }
  const ref = mintResourceIdbRef()
  try {
    await writeResourceText(ref, text)
    return { content: RESOURCE_IDB_PLACEHOLDER, idbRef: ref, contentLength: text.length }
  } catch {
    return { content: text }
  }
}

/** The true character length of one entry's text, routed or not — the aggregate knowledge-budget sum's
 *  own input (`document-ingest.ts`'s `exceedsAgentKnowledgeBudget`), correct with NO IndexedDB round trip:
 *  a routed entry carries its true length inline (`contentLength`, minted alongside `idbRef` and never
 *  stale — nothing rewrites one without the other). An entry with no `idbRef` has no separate figure to
 *  consult; `content.length` already IS the true length. */
export function entryTextLength(entry: Pick<Entry, 'content' | 'idbRef' | 'contentLength'>): number {
  return entry.idbRef !== undefined ? (entry.contentLength ?? entry.content.length) : entry.content.length
}

/** Materialize ONE entry's content from the module cache — SYNCHRONOUS, cache-only, never touches
 *  IndexedDB itself: an entry with no `idbRef` is returned unchanged (the common case, zero cost); a
 *  routed entry whose real text is already cached (this session's own attach, or a completed
 *  `hydrateResourceEntries` pass) gets `content` swapped for the real text; a routed entry not yet cached
 *  is returned with its placeholder UNCHANGED (fail-soft — never throws, never blocks a render on a
 *  pending fetch). */
export function materializeResourceEntry(entry: Entry): Entry {
  if (entry.idbRef === undefined) return entry
  const cached = cache.get(entry.idbRef)
  return cached === undefined ? entry : { ...entry, content: cached }
}

/** `materializeResourceEntry` over a whole list — the `#referenceGroups`/section-render call sites' own
 *  shape (agent-admin.ts). */
export function materializeResourceEntries(entries: readonly Entry[]): Entry[] {
  return entries.map(materializeResourceEntry)
}

/**
 * ASYNC materialize: every routed entry's real text, fetched from IndexedDB when not already cached —
 * guaranteed-correct (unlike the sync form above) at the cost of an await, which is why this is the
 * EXPORT path's own function (`resourceEntriesForExport` below), never the live turn-composition path's.
 * An entry whose IndexedDB read fails or resolves to nothing (a genuinely lost ref) keeps its placeholder
 * rather than throwing — one bad ref never blocks an otherwise-good export.
 */
export async function materializeResourceEntriesAsync(entries: readonly Entry[]): Promise<Entry[]> {
  return Promise.all(
    entries.map(async (entry) => {
      if (entry.idbRef === undefined) return entry
      const cached = cache.get(entry.idbRef)
      if (cached !== undefined) return { ...entry, content: cached }
      const fetched = await readResourceTextFresh(entry.idbRef).catch(() => undefined)
      return fetched === undefined ? entry : { ...entry, content: fetched }
    }),
  )
}

/**
 * The export-ready projection (site/pages/agent-admin-app.ts's persona-file + debug-bundle export): every
 * resource entry's REAL content inlined (never a placeholder), with `idbRef`/`contentLength` STRIPPED —
 * an `idbRef` is a reference into THIS browser's own IndexedDB database, meaningless (or actively
 * misleading) once written into a portable file another browser reads. The exported entry is a plain,
 * self-contained `Entry` exactly like one that was never routed at all.
 */
export async function resourceEntriesForExport(entries: readonly Entry[]): Promise<Entry[]> {
  const materialized = await materializeResourceEntriesAsync(entries)
  return materialized.map((entry) => {
    if (entry.idbRef === undefined) return entry
    const { idbRef: _idbRef, contentLength: _contentLength, ...rest } = entry
    return rest as Entry
  })
}

/**
 * Warm the module cache for every routed entry among `entries` not already cached — fire-and-forget from
 * a live element's `connected()`/store-reassignment path (`agent-admin.ts`), so a RELOAD's resource
 * entries become reference-resolvable (SPEC-R4 framing) and render with their real content as soon as the
 * IndexedDB reads land, with no caller ever forced to await it first. Resolves once every read has
 * settled (success or fail) — a caller that DOES want to know when hydration is done (a test, or a
 * caller wanting to re-render only once) may await it; a fire-and-forget caller simply ignores the
 * returned promise.
 */
export async function hydrateResourceEntries(entries: readonly Entry[]): Promise<void> {
  await Promise.all(
    entries
      .filter((entry): entry is Entry & { idbRef: string } => entry.idbRef !== undefined && !cache.has(entry.idbRef))
      .map((entry) => readResourceTextFresh(entry.idbRef).catch(() => undefined)),
  )
}
