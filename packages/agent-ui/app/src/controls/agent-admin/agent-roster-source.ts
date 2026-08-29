// agent-roster-source.ts — ADR-0227 clause 4 (wave 1, GH #1542): `AgentRosterSource`, the persona
// roster CRUD as `@agent-ui/data`'s FIRST real consumer surface. This module is the ONE owner of the
// roster's persisted records — the imported-personas library, the display order, the active-agent id,
// and the per-persona `seedVersion`/`modifiedAt` markers — all riding the `StorageAdapter` localStorage
// tier (ADR-0193) under the SAME raw keys the retired hand-rolled `agent-admin-presets.ts` bookkeeping
// used, so every existing user's persisted personas survive the migration byte-for-byte (the adapter's
// `${namespace}.${key}` law reproduces `agent-admin-app.importedPersonas` etc. exactly; the one
// value-format delta, the active id, gets an explicit tolerant legacy read below).
//
// Shape: a generic factory (`createAgentRosterSource<P>`) returning an object that IS a
// `DataSource<P>` (`read · list · create · update · remove · subscribe` — ADR-0227's named verb set,
// `subscribe` wired to the adapter's cross-tab seam) PLUS:
//   - a `view` sub-source (`DataSource<AgentRosterView<P>>`) the page's ONE `resource()` reads —
//     roster + active id as one value, so the triplicated active-id collapses to one owner (F6/Q4);
//   - the sync twins (`listSync`/`activeIdSync`/…) the composition root needs for same-tick boot
//     hydration — the exact job ADR-0193's sync-read amendment exists for (the tier is sync by nature).
//
// SAME-TICK WRITES (load-bearing, stated): `createLocalStorageAdapter`'s `set`/`delete` bodies contain
// no `await`, so the backing `localStorage` write completes IN THE CALLING TICK — only the promise's
// settlement is deferred. `writeSeedVersionSync`/`resetStateSync` lean on that: the persona-store
// construction path (agent-admin-presets.ts) must sweep stale keys BEFORE `createMemoryStore` hydrates
// synchronously. A future async tier swap must re-derive this sequencing.
//
// Generic on P (never a concrete site type): the shipped personas — page-local data by TKT-0074's own
// scope ruling — are INJECTED at construction (ADR-0227 clause 2: delivery is explicit injection at the
// composition root), so this module never imports site code and the site keeps its narrower `Persona`.

import type { DataSource, SourceContext, Streamed } from '@agent-ui/data'
import { createLocalStorageAdapter, type SyncReadableStorageAdapter } from '@agent-ui/shared'

/** The roster's persisted namespace — the SAME prefix the pre-ADR-0227 hand-rolled keys used. */
export const PERSONA_ROSTER_NAMESPACE = 'agent-admin-app'

// Adapter-relative keys (the adapter prepends `${namespace}.`, reproducing the legacy raw keys).
const IMPORTED_KEY = 'importedPersonas'
const ORDER_KEY = 'rosterOrder'
// The active-agent id's record. Deliberately NOT exported: ADR-0227's acceptance pins the retired
// `ACTIVE_PRESET_KEY` to zero references outside this module — consumers read/write through
// `activeIdSync`/`writeActiveIdSync` (or the page's mutation) instead of touching the key.
const ACTIVE_KEY = 'activePreset'

/** The two roster-record raw keys, exported for test seeding/cleanup (full localStorage key names —
 *  byte-identical to the retired `agent-admin-presets.ts` constants). */
export const IMPORTED_PERSONAS_KEY = `${PERSONA_ROSTER_NAMESPACE}.${IMPORTED_KEY}`
export const ROSTER_ORDER_KEY = `${PERSONA_ROSTER_NAMESPACE}.${ORDER_KEY}`

/** The roster-record shape this source persists. Kept structural and WIDE (`category` is any string)
 *  so the site's own `Persona` — whose `category` is a literal union — extends it without this package
 *  importing site vocabulary. */
export interface AgentRecord {
  id: string
  label: string
  tagline: string
  category?: string
  /** The persona store's `initial` values — a preset's computed seed, or an imported file's state. */
  seed: Readonly<Record<string, unknown>>
  /** Only a shipped preset declares one (an imported persona's seed is never rewritten in place). */
  seedVersion?: number
  /** True for a persona minted by an import — a library record, not a shipped preset. */
  imported?: boolean
  /** ISO timestamp stamped at mint/import/duplicate time; absent for a shipped preset. */
  createdAt?: string
}

/** The ONE value the page's roster `resource()` holds: the ordered roster + the persisted active-agent
 *  id (undefined when never chosen — the FALLBACK rule, `personas[0]`, stays the consumer's own). */
export interface AgentRosterView<P extends AgentRecord = AgentRecord> {
  readonly personas: readonly P[]
  readonly activeId: string | undefined
}

/** Apply the persisted display order to the natural roster (GH #845, LLD-C11/§8a — ported verbatim):
 *  ids named by the order come first, in stored order (an id no longer on the roster is SKIPPED);
 *  everything unlisted follows in natural order, so a fresh mint/import lands at the end and an
 *  absent/empty order reproduces the natural order byte for byte. Exported pure so an optimistic
 *  `mutation()` commit can reuse the EXACT rule the real read applies — zero drift. */
export function applyRosterOrder<P extends AgentRecord>(natural: readonly P[], order: readonly string[]): P[] {
  if (order.length === 0) return [...natural]
  // A Map keeps insertion (= natural) order for whatever the stored order never names; deleting as we
  // go is also what makes a REPEATED id in the record harmless (it can only match once).
  const unlisted = new Map(natural.map((persona) => [persona.id, persona]))
  const listed: P[] = []
  for (const id of order) {
    const persona = unlisted.get(id)
    if (persona === undefined) continue
    unlisted.delete(id)
    listed.push(persona)
  }
  return [...listed, ...unlisted.values()]
}

export interface AgentRosterSourceOptions<P extends AgentRecord> {
  /** The shipped (non-deletable) roster entries in natural order — injected by the composition root. */
  shipped: readonly P[]
  /** The persistence tier (ADR-0193). Defaults to the localStorage tier under the legacy namespace;
   *  tests may hand in an isolated adapter. */
  adapter?: SyncReadableStorageAdapter
  /** Fired after `remove`/`removeImportedSync` sweeps a persona's persisted state — the seam the
   *  composition root uses to evict its own in-memory store cache in the same motion. */
  onRemove?: (id: string) => void
}

/**
 * The roster source: a `DataSource<P>` over the persona roster (ADR-0227 clause 4) plus the sync read
 * surface the same-tick boot path needs and the `view` sub-source the page's one `resource()` reads.
 * Every verb's write lands through the injected `StorageAdapter` — never a raw `localStorage` touch
 * (the ONE exception: `activeIdSync`'s explicit, documented legacy migration read).
 */
export interface AgentRosterSource<P extends AgentRecord> extends DataSource<P, undefined, Partial<P>> {
  // ── the DataSource verbs (all present — the interface narrows DataSource's optionality) ──
  read(key: string, ctx: SourceContext): Promise<P>
  list(query: undefined, ctx: SourceContext): Promise<readonly P[]>
  create(input: P, ctx: SourceContext): Promise<P>
  update(key: string, patch: Partial<P>, ctx: SourceContext): Promise<P>
  remove(key: string, ctx: SourceContext): Promise<void>
  /** Cross-tab per-persona updates: yields the persona under `key` whenever another tab changes a
   *  roster record it appears in (the adapter's `storage`-event seam, ADR-0193 cl.4). */
  subscribe(key: string, ctx: SourceContext): Streamed<P>

  /** The view-shaped sub-source the page's ONE roster `resource()` consumes (`live: true` rides its
   *  `subscribe` — the cross-tab staleness guard this wave adds). */
  readonly view: DataSource<AgentRosterView<P>>

  // ── sync twins (ADR-0193 sync-read amendment — the tier is sync by nature) ──
  listSync(): P[]
  importedSync(): P[]
  orderSync(): string[]
  saveOrderSync(ids: readonly string[]): void
  readViewSync(): AgentRosterView<P>
  upsertImportedSync(persona: P): P
  renameImportedSync(persona: P, label: string): boolean
  removeImportedSync(persona: P): boolean
  activeIdSync(): string | undefined
  writeActiveIdSync(id: string): void

  // ── the per-persona markers the retired `seedVersion`/`modifiedAt` keys carried ──
  seedVersionSync(id: string): number | undefined
  writeSeedVersionSync(id: string, version: number): void
  modifiedAtSync(id: string): number | undefined
  bumpModifiedAtSync(id: string): void
  /** Drop every persisted key under `${id}.` — the persona's own store state + markers, NEVER the
   *  roster records (the trailing dot keeps `travel` and `travel-imported` from crossing). */
  resetStateSync(id: string): void
}

export function createAgentRosterSource<P extends AgentRecord>(
  options: AgentRosterSourceOptions<P>,
): AgentRosterSource<P> {
  const adapter = options.adapter ?? createLocalStorageAdapter({ namespace: PERSONA_ROSTER_NAMESPACE })
  const shipped = options.shipped
  // The pre-ADR-0227 raw active-id key exists only under the production namespace — an injected adapter
  // (an isolated test tier, or a future non-localStorage tier) has no legacy record to migrate.
  const legacyActiveIdKey = options.adapter === undefined ? `${PERSONA_ROSTER_NAMESPACE}.${ACTIVE_KEY}` : undefined

  /** The persisted imported personas, fail-closed: a corrupt/foreign record reads as an EMPTY library
   *  (never a throw at page boot) — the retired `loadImportedPersonas` filter, ported verbatim. */
  const importedSync = (): P[] => {
    const parsed = adapter.getSync(IMPORTED_KEY)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (p): p is P =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as AgentRecord).id === 'string' &&
        typeof (p as AgentRecord).label === 'string' &&
        typeof (p as AgentRecord).seed === 'object' &&
        (p as AgentRecord).seed !== null,
    )
  }

  /** The persisted order, fail-closed exactly like `importedSync`. */
  const orderSync = (): string[] => {
    const parsed = adapter.getSync(ORDER_KEY)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string')
  }

  const saveOrderSync = (ids: readonly string[]): void => {
    void adapter.set(ORDER_KEY, [...ids])
  }

  /** Shipped first, imports in import order, then the persisted display order applied on top — the ONE
   *  choke point every caller reads the roster through. Read FRESH (never cached). */
  const listSync = (): P[] => applyRosterOrder([...shipped, ...importedSync()], orderSync())

  const activeIdSync = (): string | undefined => {
    const value = adapter.getSync(ACTIVE_KEY)
    if (typeof value === 'string') return value
    if (value !== undefined) return undefined // a non-string JSON value — corrupt/foreign, fail closed
    // EXPLICIT LEGACY MIGRATION READ (ADR-0227 wave 1, stated in the PR): pre-wave writes stored the id
    // RAW (`localStorage.setItem(key, persona.id)`), which the adapter's JSON parse reads as undefined.
    // One tolerant raw read keeps every existing user's active selection; the next `writeActiveIdSync`
    // re-persists it through the adapter and this branch goes quiet. (Persona ids are kebab slugs, so a
    // raw id can never be valid JSON and land in the branches above.)
    if (legacyActiveIdKey === undefined || typeof localStorage === 'undefined') return undefined
    const raw = localStorage.getItem(legacyActiveIdKey)
    return raw === null || raw.length === 0 ? undefined : raw
  }

  const writeActiveIdSync = (id: string): void => {
    void adapter.set(ACTIVE_KEY, id)
  }

  const readViewSync = (): AgentRosterView<P> => ({ personas: listSync(), activeId: activeIdSync() })

  /** Upsert one imported persona (last-write-wins on a same-id record — a defensive dedupe, not a
   *  merge policy; ids are minted collision-safe upstream). Stamps `imported: true`. */
  const upsertImportedSync = (persona: P): P => {
    const stored = { ...persona, imported: true }
    void adapter.set(IMPORTED_KEY, [...importedSync().filter((p) => p.id !== persona.id), stored])
    return stored
  }

  /** Rename an IMPORTED persona — DISPLAY ONLY, ids stable (GH #848's rename law, ported verbatim):
   *  `false` (nothing touched) for a preset, a blank label, or an id no library record answers to.
   *  IN-PLACE rewrite so a rename never reorders the picker (order is the reorder verb's business). */
  const renameImportedSync = (persona: P, label: string): boolean => {
    if (persona.imported !== true) return false
    const next = label.trim()
    if (next.length === 0) return false
    const library = importedSync()
    if (!library.some((p) => p.id === persona.id)) return false
    void adapter.set(
      IMPORTED_KEY,
      library.map((p) => (p.id === persona.id ? { ...p, label: next, imported: true } : p)),
    )
    return true
  }

  const seedVersionSync = (id: string): number | undefined => {
    const value = adapter.getSync(`${id}.seedVersion`)
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
  }

  const writeSeedVersionSync = (id: string, version: number): void => {
    void adapter.set(`${id}.seedVersion`, version)
  }

  const modifiedAtSync = (id: string): number | undefined => {
    const value = adapter.getSync(`${id}.modifiedAt`)
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
  }

  const bumpModifiedAtSync = (id: string): void => {
    void adapter.set(`${id}.modifiedAt`, Date.now())
  }

  const resetStateSync = (id: string): void => {
    const prefix = `${id}.`
    for (const key of adapter.keysSync()) {
      if (key.startsWith(prefix)) void adapter.delete(key)
    }
  }

  /** Delete an IMPORTED persona — the state sweep, the library record, and its order slot (GH #845,
   *  LLD-C12/§8b, ported verbatim). `false` (and touches NOTHING) for a shipped preset. The active-id
   *  record is deliberately NOT this function's concern — the page's own fallback rewrites it. */
  const removeImportedSync = (persona: P): boolean => {
    if (persona.imported !== true) return false
    resetStateSync(persona.id)
    void adapter.set(
      IMPORTED_KEY,
      importedSync().filter((p) => p.id !== persona.id),
    )
    const order = orderSync()
    if (order.includes(persona.id)) saveOrderSync(order.filter((id) => id !== persona.id))
    options.onRemove?.(persona.id)
    return true
  }

  /** Is this adapter-relative key one of the three roster-view records? Per-persona state keys are the
   *  settings stores' own business — a cross-tab edit there changes a store, not the roster view. */
  const isRosterRecordKey = (key: string): boolean => key === IMPORTED_KEY || key === ORDER_KEY || key === ACTIVE_KEY

  /** One shared cross-tab pump: resolves once per roster-record change from ANOTHER tab (the adapter's
   *  `storage`-event seam), until `signal` aborts. Both `subscribe` legs ride it. The adapter listener
   *  tears down in the generator's `finally` — a consumer must drive `return()` (or abort the signal)
   *  on abandonment, as `resource()`'s own `stopLive` does; a bare-`.next()` abandoner would leak it. */
  async function* rosterChanges(ctx: SourceContext): AsyncGenerator<void> {
    if (!adapter.subscribe || ctx.signal.aborted) return
    let wake: (() => void) | undefined
    let pending = false
    const unsubscribe = adapter.subscribe((change) => {
      if (!isRosterRecordKey(change.key)) return
      pending = true
      wake?.()
    })
    const aborted = new Promise<void>((resolve) => {
      ctx.signal.addEventListener('abort', () => resolve(), { once: true })
    })
    try {
      while (!ctx.signal.aborted) {
        if (!pending) await Promise.race([new Promise<void>((resolve) => (wake = resolve)), aborted])
        if (ctx.signal.aborted) return
        if (pending) {
          pending = false
          yield
        }
      }
    } finally {
      unsubscribe()
    }
  }

  const notFound = (id: string): Error => new Error(`agent-roster-source: no roster entry with id "${id}"`)

  return {
    // ── DataSource<P> (ADR-0227 clause 4's verb set) ──
    async read(key) {
      const persona = listSync().find((p) => p.id === key)
      if (persona === undefined) throw notFound(key)
      return persona
    },
    async list() {
      return listSync()
    },
    async create(input) {
      return upsertImportedSync(input)
    },
    async update(key, patch) {
      const persona = listSync().find((p) => p.id === key)
      if (persona === undefined) throw notFound(key)
      // The one supported patch today is the rename law's (label); anything else on an imported record
      // rewrites in place under the same imported-only fence.
      if (typeof patch.label === 'string') {
        if (!renameImportedSync(persona, patch.label)) {
          throw new Error(`agent-roster-source: "${key}" refused the rename (shipped, blank, or no record)`)
        }
      } else {
        if (persona.imported !== true) throw new Error(`agent-roster-source: "${key}" is shipped — records exist only for imports`)
        upsertImportedSync({ ...persona, ...patch, id: persona.id })
      }
      const updated = listSync().find((p) => p.id === key)
      if (updated === undefined) throw notFound(key)
      return updated
    },
    async remove(key) {
      const persona = listSync().find((p) => p.id === key)
      if (persona === undefined || !removeImportedSync(persona)) throw notFound(key)
    },
    subscribe(key, ctx) {
      const changes = rosterChanges(ctx)
      return (async function* () {
        for await (const _ of changes) {
          const persona = listSync().find((p) => p.id === key)
          if (persona !== undefined) yield persona
        }
      })()
    },

    // ── the view sub-source (the page's ONE resource reads this) ──
    view: {
      read: async () => readViewSync(),
      subscribe(_key, ctx) {
        const changes = rosterChanges(ctx)
        return (async function* () {
          for await (const _ of changes) yield readViewSync()
        })()
      },
    },

    // ── sync twins + markers ──
    listSync,
    importedSync,
    orderSync,
    saveOrderSync,
    readViewSync,
    upsertImportedSync,
    renameImportedSync,
    removeImportedSync,
    activeIdSync,
    writeActiveIdSync,
    seedVersionSync,
    writeSeedVersionSync,
    modifiedAtSync,
    bumpModifiedAtSync,
    resetStateSync,
  }
}
