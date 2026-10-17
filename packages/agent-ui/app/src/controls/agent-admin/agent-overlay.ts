// agent-overlay.ts: T-0161, a user's edits to a seeded agent stored as a DIFF over the seed, never as a
// full copy. The overlay is one record per agent, keyed `id@baseVersion`, carrying field-level ops: a
// scalar store key holds one op, and an entry list (`entries:<kind>`) holds one op per entry (added,
// removed, or a patch of the fields that differ) plus the id order when the user reordered it. Every op
// carries the seed value it was diffed against, because the browser registry holds only the CURRENT seed:
// the base must travel inside the overlay for a 3-way merge to be possible when the seed moves.
//
// The laws:
// - `resolveOverlay(seed, setOverlayKey(seed, o, key, value))[key]` equals `value` (deep, order included).
// - A seed update (`rebaseOverlay`) merges per field: the seed moved and the user did not, the new seed
//   flows in (the user never had an op there); the seed still equals the op's base, the op is kept; the
//   seed converged on the user value, the op drops; both moved apart, the USER value is kept and the op is
//   flagged `conflict` with the new seed value beside it. An entry the seed removed that the user edited
//   is kept whole as a user entry, flagged. Nothing is ever wiped.
// - Pure and zero-dep: the persistence (one `StorageAdapter` record per agent) is the caller's, through
//   `createOverlayStore`'s `persist` seam.
//
// Imported and duplicated agents are full records and never get an overlay (their seed IS the user's).
import type { SettingsStore } from '../settings/store.ts'

type Item = Readonly<Record<string, unknown>> & { readonly id: string }

/** One scalar store key's op. Presence carries meaning: no `value` means the user removed the key, no
 *  `base` means the seed had none. `conflict.seed` (absent: the seed dropped the key) is the new seed
 *  value a merge could not reconcile with the user's. */
export interface ValueOp {
  value?: unknown
  base?: unknown
  conflict?: { seed?: unknown }
}

/** One entry's op inside an entry list. `added` holds a whole user entry (no seed counterpart, or one
 *  the seed has since removed); `removed` and `patch` hold the seed entry they were diffed against. */
export type EntryOp =
  | { op: 'added'; entry: Item; conflict?: { seed?: unknown } }
  | { op: 'removed'; base: Item; conflict?: { seed?: unknown } }
  | { op: 'patch'; base: Item; set: Record<string, unknown>; unset: string[]; conflicts?: Record<string, { seed?: unknown }> }

/** One entry-list key's ops. `order` is the user's id sequence, present only when it differs from the
 *  natural one (seed order, then added entries). */
export interface ListOp {
  entries: Record<string, EntryOp>
  order?: string[]
}

export interface AgentOverlay {
  format: 1
  /** `id@baseVersion`: the seed this overlay was last diffed or merged against. */
  base: string
  baseVersion: number
  /** A fingerprint of the whole seed: a seed text edit without a version bump still triggers a merge. */
  baseDigest: string
  values: Record<string, ValueOp>
  lists: Record<string, ListOp>
}

/** One modified place, for the per-field "modified" state (T-0162). `change` names an entry-level op;
 *  `conflict` carries both values (an absent side means that side has no value there). */
export interface OverlayPath {
  key: string
  entryId?: string
  field?: string
  change?: 'added' | 'removed' | 'order'
  conflict?: { seed?: unknown; user?: unknown }
}

/** The address `resetPath` takes: a whole key, one entry, or one entry field. */
export interface OverlayAddress {
  key: string
  entryId?: string
  field?: string
}

// ── value helpers ────────────────────────────────────────────────────────────────────────────────────

/** JSON with object keys sorted: the equality and fingerprint basis (JSON drops `undefined` members,
 *  exactly as the StorageAdapter encoding does, so equal here means equal after a reload). */
function canonical(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined'
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : canonical(v))).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(record[k])}`).join(',')}}`
}

const same = (a: unknown, b: unknown): boolean => a === b || canonical(a) === canonical(b)

/** Two 32-bit FNV-1a passes (different offsets) over the canonical JSON: a sync, browser-safe change
 *  detector. It only decides whether a merge runs; a false "changed" costs one no-op merge. */
export function seedFingerprint(seed: Readonly<Record<string, unknown>>): string {
  const text = canonical(seed)
  let a = 0x811c9dc5
  let b = 0x01000193 ^ text.length
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193) >>> 0
    b = Math.imul(b ^ c, 0x0100019d) >>> 0
  }
  return `fnv:${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`
}

const has = (record: Readonly<Record<string, unknown>>, key: string): boolean => Object.hasOwn(record, key) && record[key] !== undefined

function isItemList(value: unknown): value is Item[] {
  if (!Array.isArray(value)) return false
  const ids = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item) || typeof (item as Item).id !== 'string') return false
    if (ids.has((item as Item).id)) return false
    ids.add((item as Item).id)
  }
  return true
}

const clone = <T>(value: T): T => (value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T))

// ── diff ─────────────────────────────────────────────────────────────────────────────────────────────

function patchFor(base: Item, user: Item): EntryOp | undefined {
  const set: Record<string, unknown> = {}
  const unset: string[] = []
  for (const field of Object.keys(user)) {
    if (user[field] !== undefined && !same(user[field], base[field])) set[field] = clone(user[field])
  }
  for (const field of Object.keys(base)) {
    if (base[field] !== undefined && user[field] === undefined) unset.push(field)
  }
  if (Object.keys(set).length === 0 && unset.length === 0) return undefined
  return { op: 'patch', base: clone(base), set, unset }
}

function applyPatch(base: Item, op: Extract<EntryOp, { op: 'patch' }>): Item {
  const next: Record<string, unknown> = { ...base, ...clone(op.set) }
  for (const field of op.unset) delete next[field]
  return next as Item
}

/** The natural id sequence: seed order (minus removals), then added entries in insertion order. */
function naturalIds(seedList: readonly Item[], entries: Readonly<Record<string, EntryOp>>): string[] {
  const ids = seedList.filter((s) => entries[s.id]?.op !== 'removed').map((s) => s.id)
  const seedIds = new Set(seedList.map((s) => s.id))
  for (const [id, op] of Object.entries(entries)) if (op.op === 'added' && !seedIds.has(id)) ids.push(id)
  return ids
}

function diffList(seedList: readonly Item[], userList: readonly Item[]): ListOp | undefined {
  const seedById = new Map(seedList.map((s) => [s.id, s]))
  const userIds = new Set(userList.map((u) => u.id))
  const entries: Record<string, EntryOp> = {}
  for (const user of userList) {
    const base = seedById.get(user.id)
    if (base === undefined) entries[user.id] = { op: 'added', entry: clone(user) }
    else {
      const patch = patchFor(base, user)
      if (patch !== undefined) entries[user.id] = patch
    }
  }
  for (const base of seedList) if (!userIds.has(base.id)) entries[base.id] = { op: 'removed', base: clone(base) }
  const ids = userList.map((u) => u.id)
  const natural = naturalIds(seedList, entries)
  const order = same(ids, natural) ? undefined : ids
  if (Object.keys(entries).length === 0 && order === undefined) return undefined
  return order === undefined ? { entries } : { entries, order }
}

function seedListAt(seed: Readonly<Record<string, unknown>>, key: string): Item[] | undefined {
  const value = seed[key]
  if (value === undefined) return []
  return isItemList(value) ? value : undefined
}

/** A copy of `overlay` with `key`'s op replaced by the diff of `value` against the seed. A conflict flag
 *  on a place the user still differs at is kept: it stays until reset or until the seed agrees. */
export function setOverlayKey(seed: Readonly<Record<string, unknown>>, overlay: AgentOverlay, key: string, value: unknown): AgentOverlay {
  const values = { ...overlay.values }
  const lists = { ...overlay.lists }
  delete values[key]
  delete lists[key]
  const seedList = seedListAt(seed, key)
  if (seedList !== undefined && isItemList(value)) {
    const op = diffList(seedList, value)
    if (op !== undefined) {
      const previous = overlay.lists[key]?.entries ?? {}
      for (const [id, next] of Object.entries(op.entries)) {
        const prior = previous[id]
        if (prior === undefined) continue
        if (next.op === 'patch' && prior.op === 'patch' && prior.conflicts !== undefined) {
          const kept = Object.fromEntries(Object.entries(prior.conflicts).filter(([field]) => field in next.set || next.unset.includes(field)))
          if (Object.keys(kept).length > 0) next.conflicts = kept
        } else if (next.op !== 'patch' && prior.op === next.op && prior.conflict !== undefined) next.conflict = prior.conflict
      }
      lists[key] = op
    }
  } else if (!same(value, seed[key])) {
    const prior = overlay.values[key]
    const op: ValueOp = {}
    if (value !== undefined) op.value = clone(value)
    if (has(seed, key)) op.base = clone(seed[key])
    if (prior?.conflict !== undefined) op.conflict = prior.conflict
    values[key] = op
  }
  return { ...overlay, values, lists }
}

/** A fresh overlay over `seed` with no ops. */
export function emptyOverlay(id: string, version: number, seed: Readonly<Record<string, unknown>>): AgentOverlay {
  return { format: 1, base: `${id}@${version}`, baseVersion: version, baseDigest: seedFingerprint(seed), values: {}, lists: {} }
}

/** The one-time migration: diff a full stored copy (today's per-key shape) against `seed`. */
export function diffOverlay(id: string, version: number, seed: Readonly<Record<string, unknown>>, stored: Readonly<Record<string, unknown>>): AgentOverlay {
  let overlay = emptyOverlay(id, version, seed)
  for (const [key, value] of Object.entries(stored)) overlay = setOverlayKey(seed, overlay, key, value)
  return overlay
}

// ── resolve ──────────────────────────────────────────────────────────────────────────────────────────

function resolveList(seedList: readonly Item[], op: ListOp): Item[] {
  const byId = new Map<string, Item>()
  for (const s of seedList) {
    const entryOp = op.entries[s.id]
    if (entryOp === undefined) byId.set(s.id, s)
    else if (entryOp.op === 'patch') byId.set(s.id, applyPatch(s, entryOp))
    else if (entryOp.op === 'added') byId.set(s.id, clone(entryOp.entry))
  }
  for (const [id, entryOp] of Object.entries(op.entries)) if (entryOp.op === 'added' && !byId.has(id)) byId.set(id, clone(entryOp.entry))
  const natural = naturalIds(seedList, op.entries).filter((id) => byId.has(id))
  if (op.order === undefined) return natural.map((id) => byId.get(id)!)
  // The user's order first (an id no longer present is skipped), then anything it never named (a new
  // seed entry) in natural order: the roster's `applyRosterOrder` rule.
  const listed = op.order.filter((id) => byId.has(id))
  const named = new Set(listed)
  return [...listed, ...natural.filter((id) => !named.has(id))].map((id) => byId.get(id)!)
}

/** One key's resolved value: the seed with the overlay applied. */
export function resolveOverlayKey(seed: Readonly<Record<string, unknown>>, overlay: AgentOverlay, key: string): unknown {
  const listOp = overlay.lists[key]
  if (listOp !== undefined) return resolveList(seedListAt(seed, key) ?? [], listOp)
  const valueOp = overlay.values[key]
  if (valueOp !== undefined) return 'value' in valueOp ? clone(valueOp.value) : undefined
  return seed[key]
}

/** The whole resolved record: every seed key plus every key the overlay added. */
export function resolveOverlay(seed: Readonly<Record<string, unknown>>, overlay: AgentOverlay): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of new Set([...Object.keys(seed), ...Object.keys(overlay.values), ...Object.keys(overlay.lists)])) {
    const value = resolveOverlayKey(seed, overlay, key)
    if (value !== undefined) out[key] = value
  }
  return out
}

// ── merge ────────────────────────────────────────────────────────────────────────────────────────────

const seedSide = (record: Readonly<Record<string, unknown>>, key: string): { seed?: unknown } => (has(record, key) ? { seed: clone(record[key]) } : {})

function rebaseValue(op: ValueOp, seed: Readonly<Record<string, unknown>>, key: string): ValueOp | undefined {
  const next = seed[key]
  const user = 'value' in op ? op.value : undefined
  const base = 'base' in op ? op.base : undefined
  if (same(next, user)) return undefined
  if (same(next, base)) return op
  const rebased: ValueOp = { ...('value' in op ? { value: op.value } : {}), ...(has(seed, key) ? { base: clone(next) } : {}) }
  rebased.conflict = seedSide(seed, key)
  return rebased
}

function rebaseEntry(op: EntryOp, next: Item | undefined): EntryOp | undefined {
  if (op.op === 'added') {
    if (next === undefined) return op
    if (same(next, op.entry)) return undefined
    const patch = patchFor(next, op.entry)
    if (patch === undefined || patch.op !== 'patch') return undefined
    patch.conflicts = Object.fromEntries([...Object.keys(patch.set), ...patch.unset].map((field) => [field, seedSide(next, field)]))
    return patch
  }
  if (op.op === 'removed') {
    if (next === undefined) return undefined
    if (same(next, op.base)) return op
    return { op: 'removed', base: clone(next), conflict: { seed: clone(next) } }
  }
  // A patch: the seed removed the entry the user edited, so the user's whole entry is kept as theirs.
  if (next === undefined) return { op: 'added', entry: applyPatch(op.base, op), conflict: {} }
  const set: Record<string, unknown> = {}
  const unset: string[] = []
  const conflicts: Record<string, { seed?: unknown }> = {}
  for (const field of [...Object.keys(op.set), ...op.unset]) {
    const user = field in op.set ? op.set[field] : undefined
    if (same(next[field], user)) continue
    if (user === undefined) unset.push(field)
    else set[field] = user
    const prior = op.conflicts?.[field]
    if (!same(next[field], op.base[field])) conflicts[field] = seedSide(next, field)
    else if (prior !== undefined) conflicts[field] = prior
  }
  if (Object.keys(set).length === 0 && unset.length === 0) return undefined
  return { op: 'patch', base: clone(next), set, unset, ...(Object.keys(conflicts).length > 0 ? { conflicts } : {}) }
}

function rebaseList(op: ListOp, seedList: readonly Item[]): ListOp | undefined {
  const byId = new Map(seedList.map((s) => [s.id, s]))
  const entries: Record<string, EntryOp> = {}
  for (const [id, entryOp] of Object.entries(op.entries)) {
    const next = rebaseEntry(entryOp, byId.get(id))
    if (next !== undefined) entries[id] = next
  }
  let order = op.order
  if (order !== undefined) {
    const withOrder = resolveList(seedList, { entries, order }).map((i) => i.id)
    if (same(withOrder, naturalIds(seedList, entries))) order = undefined
  }
  if (Object.keys(entries).length === 0 && order === undefined) return undefined
  return order === undefined ? { entries } : { entries, order }
}

/** Move `overlay` onto a new seed with a per-field 3-way merge (the module banner's rule). The same seed
 *  (version and fingerprint) returns `overlay` itself. */
export function rebaseOverlay(overlay: AgentOverlay, seed: Readonly<Record<string, unknown>>, id: string, version: number): AgentOverlay {
  const digest = seedFingerprint(seed)
  if (overlay.baseDigest === digest && overlay.baseVersion === version && overlay.base === `${id}@${version}`) return overlay
  const values: Record<string, ValueOp> = {}
  for (const [key, op] of Object.entries(overlay.values)) {
    const next = rebaseValue(op, seed, key)
    if (next !== undefined) values[key] = next
  }
  const lists: Record<string, ListOp> = {}
  for (const [key, op] of Object.entries(overlay.lists)) {
    const seedList = seedListAt(seed, key)
    if (seedList === undefined) {
      // The seed turned this key into a non-list: keep the user's resolved list whole, as a value op.
      values[key] = { value: resolveList([], op), conflict: seedSide(seed, key), ...(has(seed, key) ? { base: clone(seed[key]) } : {}) }
      continue
    }
    const next = rebaseList(op, seedList)
    if (next !== undefined) lists[key] = next
  }
  return { format: 1, base: `${id}@${version}`, baseVersion: version, baseDigest: digest, values, lists }
}

// ── modified state and reset ─────────────────────────────────────────────────────────────────────────

/** Every modified place in `overlay`, conflicts carrying both values. */
export function modifiedPaths(overlay: AgentOverlay): OverlayPath[] {
  const out: OverlayPath[] = []
  for (const [key, op] of Object.entries(overlay.values)) {
    out.push(op.conflict === undefined ? { key } : { key, conflict: { ...op.conflict, ...('value' in op ? { user: op.value } : {}) } })
  }
  for (const [key, list] of Object.entries(overlay.lists)) {
    for (const [entryId, op] of Object.entries(list.entries)) {
      if (op.op === 'patch') {
        for (const field of [...Object.keys(op.set), ...op.unset]) {
          const conflict = op.conflicts?.[field]
          const path: OverlayPath = { key, entryId, field }
          if (conflict !== undefined) path.conflict = { ...conflict, ...(field in op.set ? { user: op.set[field] } : {}) }
          out.push(path)
        }
      } else {
        const path: OverlayPath = { key, entryId, change: op.op }
        if (op.conflict !== undefined) path.conflict = { ...op.conflict, ...(op.op === 'added' ? { user: op.entry } : {}) }
        out.push(path)
      }
    }
    if (list.order !== undefined) out.push({ key, change: 'order' })
  }
  return out
}

/** A copy of `overlay` with one place returned to the seed: a whole key (its order too), one entry, or
 *  one entry field. */
export function resetPath(overlay: AgentOverlay, address: OverlayAddress): AgentOverlay {
  const values = { ...overlay.values }
  const lists = { ...overlay.lists }
  if (address.entryId === undefined) {
    delete values[address.key]
    delete lists[address.key]
    return { ...overlay, values, lists }
  }
  const list = lists[address.key]
  if (list === undefined) return overlay
  const entries = { ...list.entries }
  const op = entries[address.entryId]
  if (op === undefined) return overlay
  if (address.field === undefined || op.op !== 'patch') delete entries[address.entryId]
  else {
    const set = { ...op.set }
    delete set[address.field]
    const unset = op.unset.filter((f) => f !== address.field)
    const conflicts = Object.fromEntries(Object.entries(op.conflicts ?? {}).filter(([f]) => f !== address.field))
    if (Object.keys(set).length === 0 && unset.length === 0) delete entries[address.entryId]
    else entries[address.entryId] = { op: 'patch', base: op.base, set, unset, ...(Object.keys(conflicts).length > 0 ? { conflicts } : {}) }
  }
  if (Object.keys(entries).length === 0 && list.order === undefined) delete lists[address.key]
  else lists[address.key] = { ...list, entries }
  return { ...overlay, values, lists }
}

/** A persisted overlay, fail-closed: anything that is not one reads as `undefined`. */
export function parseOverlay(value: unknown): AgentOverlay | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const o = value as Partial<AgentOverlay>
  if (o.format !== 1 || typeof o.base !== 'string' || typeof o.baseVersion !== 'number' || typeof o.baseDigest !== 'string') return undefined
  if (typeof o.values !== 'object' || o.values === null || typeof o.lists !== 'object' || o.lists === null) return undefined
  for (const list of Object.values(o.lists)) {
    if (typeof list !== 'object' || list === null || typeof (list as ListOp).entries !== 'object' || (list as ListOp).entries === null) return undefined
  }
  return o as AgentOverlay
}

// ── the store ────────────────────────────────────────────────────────────────────────────────────────

export interface OverlayStoreOptions {
  seed: Readonly<Record<string, unknown>>
  overlay: AgentOverlay
  /** Called with the whole overlay after every write. Omit for an unpersisted store (the Builder's). */
  persist?: (overlay: AgentOverlay) => void
}

/** A `SettingsStore` over seed plus overlay: `get` resolves, `set` diffs against the seed. */
export interface OverlayStore extends SettingsStore {
  subscribe(listener: (key: string, value: unknown) => void): () => void
  overlay(): AgentOverlay
  modified(): OverlayPath[]
  /** Return one place to the seed and notify its key with the resolved value. */
  reset(address: OverlayAddress): void
}

export function createOverlayStore(options: OverlayStoreOptions): OverlayStore {
  const { seed, persist } = options
  let overlay = options.overlay
  // The last value written per key, so `get` hands back the very object `set` received (the settings
  // fields' zero-echo check compares by identity).
  const written = new Map<string, unknown>()
  const listeners = new Set<(key: string, value: unknown) => void>()
  const notify = (key: string, value: unknown): void => {
    for (const listener of listeners) listener(key, value)
  }
  return {
    get(key) {
      return written.has(key) ? written.get(key) : resolveOverlayKey(seed, overlay, key)
    },
    set(key, value) {
      overlay = setOverlayKey(seed, overlay, key, value)
      written.set(key, value)
      persist?.(overlay)
      notify(key, value)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    save(next) {
      for (const [key, value] of Object.entries(next)) this.set(key, value)
    },
    overlay: () => overlay,
    modified: () => modifiedPaths(overlay),
    reset(address) {
      overlay = resetPath(overlay, address)
      written.delete(address.key)
      persist?.(overlay)
      notify(address.key, resolveOverlayKey(seed, overlay, address.key))
    },
  }
}
