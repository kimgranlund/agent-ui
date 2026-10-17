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
//   flagged `seedChanged` with the base and the new seed value beside it. An entry the seed removed that
//   the user edited is kept whole as a user entry, flagged. Nothing is ever wiped
//   (`.claude/docs/spec/agent-content.spec.md` ACS-R6 to ACS-R8).
// - Pure and zero-dep: the persistence (one `StorageAdapter` record per agent) is the caller's, through
//   `createOverlayStore`'s `persist` seam.
//
// Imported and duplicated agents are full records and never get an overlay (their seed IS the user's).
//
// T-0162 (ACS-R8): every op records its `source`, the surface that wrote it: `user` (a settings-pane
// edit, the default), `builder` (an applied Builder `personaPatch`) or `pack` (an entry added from a
// library pack). `user` is stored as no `source` member, so a user op keeps its pre-T-0162 shape. A place
// with no op reads `seed`. `provenanceAt` answers one place's provenance.
import type { SettingsStore } from '../settings/store.ts'

/** The surface an op was written by (ACS-R8). */
export const EDIT_SOURCES = ['user', 'builder', 'pack'] as const
export type EditSource = (typeof EDIT_SOURCES)[number]

/** Where one place's value came from (ACS-R8): the seed, an op's source, or a whole record minted by an
 *  import or a duplicate (agent-model SPEC-R6), which has no seed and no overlay. */
export type Provenance = 'seed' | EditSource | 'imported' | 'duplicate'

type Item = Readonly<Record<string, unknown>> & { readonly id: string }

/** A merge the seed and the user disagreed on: the seed value the user's op was made against (`base`)
 *  and the seed value that replaced it (`seed`). An absent side had no value (a key or entry the seed
 *  did not carry, or a base nobody kept). The user value is the op's own. */
export interface SeedChanged {
  base?: unknown
  seed?: unknown
}

/** One scalar store key's op. Presence carries meaning: no `value` means the user removed the key, no
 *  `base` means the seed had none. */
export interface ValueOp {
  value?: unknown
  base?: unknown
  seedChanged?: SeedChanged
  /** Absent reads `user` (an op written before T-0162 recorded sources). */
  source?: EditSource
}

/** One entry's op inside an entry list. `added` holds a whole user entry (no seed counterpart, or one
 *  the seed has since removed); `removed` and `patch` hold the seed entry they were diffed against. A
 *  patch flags per field. */
export type EntryOp =
  | { op: 'added'; entry: Item; seedChanged?: SeedChanged; source?: EditSource }
  | { op: 'removed'; base: Item; seedChanged?: SeedChanged; source?: EditSource }
  | { op: 'patch'; base: Item; set: Record<string, unknown>; unset: string[]; seedChanged?: Record<string, SeedChanged>; source?: EditSource }

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
 *  `seedChanged` carries the base, the new seed and the user values (an absent side has no value there). */
export interface OverlayPath {
  key: string
  entryId?: string
  field?: string
  change?: 'added' | 'removed' | 'order'
  seedChanged?: SeedChanged & { user?: unknown }
  /** The op's source; absent reads `user`. */
  source?: EditSource
}

/** The address `resetPath` takes: a whole key, one entry, one entry field, or (`order`) a list's order. */
export interface OverlayAddress {
  key: string
  entryId?: string
  field?: string
  order?: true
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

/** A copy of `overlay` with `key`'s op replaced by the diff of `value` against the seed. A `seedChanged`
 *  flag on a place the user still differs at is kept: it stays until reset or until the seed agrees. */
export function setOverlayKey(
  seed: Readonly<Record<string, unknown>>,
  overlay: AgentOverlay,
  key: string,
  value: unknown,
  source: EditSource = 'user',
): AgentOverlay {
  const values = { ...overlay.values }
  const lists = { ...overlay.lists }
  delete values[key]
  delete lists[key]
  const seedList = seedListAt(seed, key)
  if (seedList !== undefined && isItemList(value)) {
    const op = diffList(seedList, value)
    // An empty list on a key the seed lacks diffs to nothing, yet must read back as `[]`, not as absent.
    if (op === undefined && !has(seed, key)) values[key] = { value: [], ...sourceOf({ source }) }
    if (op !== undefined) {
      const previous = overlay.lists[key]?.entries ?? {}
      for (const [id, next] of Object.entries(op.entries)) {
        const prior = previous[id]
        // An entry this write left as it was keeps the source that wrote it; a changed one takes this one.
        Object.assign(next, sourceOf({ source: prior !== undefined && sameOp(prior, next) ? prior.source : source }))
        if (prior === undefined) continue
        if (next.op === 'patch' && prior.op === 'patch' && prior.seedChanged !== undefined) {
          const kept = Object.fromEntries(Object.entries(prior.seedChanged).filter(([field]) => field in next.set || next.unset.includes(field)))
          if (Object.keys(kept).length > 0) next.seedChanged = kept
        } else if (next.op !== 'patch' && prior.op === next.op && prior.seedChanged !== undefined) next.seedChanged = prior.seedChanged
      }
      lists[key] = op
    }
  } else if (!same(value, seed[key])) {
    const prior = overlay.values[key]
    const op: ValueOp = {}
    if (value !== undefined) op.value = clone(value)
    if (has(seed, key)) op.base = clone(seed[key])
    if (prior?.seedChanged !== undefined) op.seedChanged = prior.seedChanged
    // A write that leaves the value as it was keeps the source that wrote it (a Builder-set model re-set by
    // the picker stays the Builder's), the rule `sameOp` applies to list entries.
    const unchanged = prior !== undefined && ('value' in prior ? same(prior.value, value) : value === undefined)
    Object.assign(op, sourceOf({ source: unchanged ? prior.source : source }))
    values[key] = op
  }
  return { ...overlay, values, lists }
}

/** Two entry ops that change the same thing (their flags and sources aside). */
function sameOp(a: EntryOp, b: EntryOp): boolean {
  const bare = ({ seedChanged: _flags, source: _source, ...rest }: EntryOp): unknown => rest
  return same(bare(a), bare(b))
}

/** A fresh overlay over `seed` with no ops. */
export function emptyOverlay(id: string, version: number, seed: Readonly<Record<string, unknown>>): AgentOverlay {
  return { format: 1, base: `${id}@${version}`, baseVersion: version, baseDigest: seedFingerprint(seed), values: {}, lists: {} }
}

/** The one-time migration (ACS-R7): diff a full stored copy (today's per-key shape) against `seed`.
 *  `baseUnknown` is the copy written against an OLDER seed version, which the registry no longer holds:
 *  a stored value that differs from the seed may be the user's or the old seed's, so every differing
 *  place keeps the stored value and is flagged `seedChanged` (no base). A seed entry missing from the
 *  stored list is no evidence of a user removal there (a later version may have added it), so that
 *  branch records no removals and no order. */
export function diffOverlay(
  id: string,
  version: number,
  seed: Readonly<Record<string, unknown>>,
  stored: Readonly<Record<string, unknown>>,
  options: { baseUnknown?: boolean } = {},
): AgentOverlay {
  let overlay = emptyOverlay(id, version, seed)
  for (const [key, value] of Object.entries(stored)) overlay = setOverlayKey(seed, overlay, key, value)
  if (options.baseUnknown !== true) return overlay
  const values: Record<string, ValueOp> = {}
  for (const [key, op] of Object.entries(overlay.values)) values[key] = { ...op, seedChanged: seedSide(seed, key) }
  const lists: Record<string, ListOp> = {}
  for (const [key, list] of Object.entries(overlay.lists)) {
    const entries: Record<string, EntryOp> = {}
    for (const [entryId, op] of Object.entries(list.entries)) {
      if (op.op === 'added') entries[entryId] = { ...op, seedChanged: {} }
      else if (op.op === 'patch') {
        const flags = Object.fromEntries([...Object.keys(op.set), ...op.unset].map((field) => [field, seedSide(op.base, field)]))
        entries[entryId] = { ...op, seedChanged: flags }
      }
    }
    if (Object.keys(entries).length > 0) lists[key] = { entries }
  }
  return { ...overlay, values, lists }
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

/** `{ seed: record[key] }` (or `{ base: … }`), or `{}` when the record carries no value there. */
const seedSide = (record: Readonly<Record<string, unknown>>, key: string, side: 'seed' | 'base' = 'seed'): SeedChanged =>
  has(record, key) ? { [side]: clone(record[key]) } : {}

function rebaseValue(op: ValueOp, seed: Readonly<Record<string, unknown>>, key: string): ValueOp | undefined {
  const next = seed[key]
  const user = 'value' in op ? op.value : undefined
  const base = 'base' in op ? op.base : undefined
  if (same(next, user)) return undefined
  if (same(next, base)) return op
  const rebased: ValueOp = { ...('value' in op ? { value: op.value } : {}), ...(has(seed, key) ? { base: clone(next) } : {}) }
  rebased.seedChanged = { ...('base' in op ? { base: op.base } : {}), ...seedSide(seed, key) }
  if (op.source !== undefined) rebased.source = op.source
  return rebased
}

function rebaseEntry(op: EntryOp, next: Item | undefined): EntryOp | undefined {
  if (op.op === 'added') {
    if (next === undefined) return op
    if (same(next, op.entry)) return undefined
    const patch = patchFor(next, op.entry)
    if (patch === undefined || patch.op !== 'patch') return undefined
    patch.seedChanged = Object.fromEntries([...Object.keys(patch.set), ...patch.unset].map((field) => [field, seedSide(next, field)]))
    if (op.source !== undefined) patch.source = op.source
    return patch
  }
  if (op.op === 'removed') {
    if (next === undefined) return undefined
    if (same(next, op.base)) return op
    return { op: 'removed', base: clone(next), seedChanged: { base: op.base, seed: clone(next) }, ...sourceOf(op) }
  }
  // A patch: the seed removed the entry the user edited, so the user's whole entry is kept as theirs.
  if (next === undefined) return { op: 'added', entry: applyPatch(op.base, op), seedChanged: { base: op.base }, ...sourceOf(op) }
  const set: Record<string, unknown> = {}
  const unset: string[] = []
  const flags: Record<string, SeedChanged> = {}
  for (const field of [...Object.keys(op.set), ...op.unset]) {
    const user = field in op.set ? op.set[field] : undefined
    if (same(next[field], user)) continue
    if (user === undefined) unset.push(field)
    else set[field] = user
    const prior = op.seedChanged?.[field]
    if (!same(next[field], op.base[field])) flags[field] = { ...seedSide(op.base, field, 'base'), ...seedSide(next, field) }
    else if (prior !== undefined) flags[field] = prior
  }
  if (Object.keys(set).length === 0 && unset.length === 0) return undefined
  return { op: 'patch', base: clone(next), set, unset, ...(Object.keys(flags).length > 0 ? { seedChanged: flags } : {}), ...sourceOf(op) }
}

/** An op's recorded source as a spreadable member: nothing for `user`, the default an absent member reads. */
function sourceOf(op: { source?: EditSource }): { source?: EditSource } {
  return op.source === undefined || op.source === 'user' ? {} : { source: op.source }
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

/** The entries a list op holds whole: added ones, and edited ones rebuilt from their base, in the user's
 *  order when it kept one. */
function userEntries(op: ListOp): Item[] {
  const byId = new Map<string, Item>()
  for (const [id, entryOp] of Object.entries(op.entries)) {
    if (entryOp.op === 'added') byId.set(id, clone(entryOp.entry))
    else if (entryOp.op === 'patch') byId.set(id, applyPatch(entryOp.base, entryOp))
  }
  const ids = [...(op.order ?? []).filter((id) => byId.has(id)), ...[...byId.keys()].filter((id) => !(op.order ?? []).includes(id))]
  return ids.map((id) => byId.get(id)!)
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
      // The seed turned this key into a non-list: keep every entry the user added or edited (an edit
      // rebuilt from the base it patched), flagged, as a value op. An entry the user only removed, or never
      // touched, goes with the seed.
      const kept = userEntries(op)
      if (kept.length > 0) values[key] = { value: kept, seedChanged: seedSide(seed, key), ...(has(seed, key) ? { base: clone(seed[key]) } : {}) }
      continue
    }
    const next = rebaseList(op, seedList)
    if (next !== undefined) lists[key] = next
  }
  return { format: 1, base: `${id}@${version}`, baseVersion: version, baseDigest: digest, values, lists }
}

// ── modified state and reset ─────────────────────────────────────────────────────────────────────────

/** Every modified place in `overlay`; a `seedChanged` place carries the base, seed and user values. */
export function modifiedPaths(overlay: AgentOverlay): OverlayPath[] {
  const out: OverlayPath[] = []
  for (const [key, op] of Object.entries(overlay.values)) {
    const source = sourceOf(op)
    out.push(op.seedChanged === undefined ? { key, ...source } : { key, ...source, seedChanged: { ...op.seedChanged, ...('value' in op ? { user: op.value } : {}) } })
  }
  for (const [key, list] of Object.entries(overlay.lists)) {
    for (const [entryId, op] of Object.entries(list.entries)) {
      if (op.op === 'patch') {
        for (const field of [...Object.keys(op.set), ...op.unset]) {
          const flag = op.seedChanged?.[field]
          const path: OverlayPath = { key, entryId, field, ...sourceOf(op) }
          if (flag !== undefined) path.seedChanged = { ...flag, ...(field in op.set ? { user: op.set[field] } : {}) }
          out.push(path)
        }
      } else {
        const path: OverlayPath = { key, entryId, change: op.op, ...sourceOf(op) }
        if (op.seedChanged !== undefined) path.seedChanged = { ...op.seedChanged, ...(op.op === 'added' ? { user: op.entry } : {}) }
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
  if (address.order === true && address.entryId === undefined) {
    const list = lists[address.key]
    if (list?.order === undefined) return overlay
    if (Object.keys(list.entries).length === 0) delete lists[address.key]
    else lists[address.key] = { entries: list.entries }
    return { ...overlay, values, lists }
  }
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
    const flags = Object.fromEntries(Object.entries(op.seedChanged ?? {}).filter(([f]) => f !== address.field))
    if (Object.keys(set).length === 0 && unset.length === 0) delete entries[address.entryId]
    else entries[address.entryId] = { op: 'patch', base: op.base, set, unset, ...(Object.keys(flags).length > 0 ? { seedChanged: flags } : {}), ...sourceOf(op) }
  }
  if (Object.keys(entries).length === 0 && list.order === undefined) delete lists[address.key]
  else lists[address.key] = { ...list, entries }
  return { ...overlay, values, lists }
}

/** One place's provenance (ACS-R8): the source of the op that holds it, or `seed` when no op does. An
 *  entry field reads its entry's op (a patch is one op per entry); a whole entry-list key reads `seed`
 *  only when no entry op and no order op touch it, else by precedence, not recency: `user` when any entry
 *  op or the order is the user's, then `builder`, then `pack`. */
export function provenanceAt(overlay: AgentOverlay, address: OverlayAddress): Provenance {
  const value = overlay.values[address.key]
  if (value !== undefined) return value.source ?? 'user'
  const list = overlay.lists[address.key]
  if (list === undefined) return 'seed'
  if (address.entryId !== undefined) {
    const op = list.entries[address.entryId]
    if (op === undefined) return 'seed'
    if (address.field !== undefined && op.op === 'patch' && !(address.field in op.set) && !op.unset.includes(address.field)) return 'seed'
    return op.source ?? 'user'
  }
  const sources = new Set(Object.values(list.entries).map((op) => op.source ?? 'user'))
  if (list.order !== undefined || sources.has('user')) return 'user'
  return sources.has('builder') ? 'builder' : sources.has('pack') ? 'pack' : 'seed'
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isItem = (value: unknown): value is Item => isRecord(value) && typeof value['id'] === 'string'
const isFlag = (value: unknown): boolean => value === undefined || isRecord(value)
const isSource = (value: unknown): boolean => value === undefined || (EDIT_SOURCES as readonly unknown[]).includes(value)

function isEntryOp(value: unknown): value is EntryOp {
  if (!isRecord(value) || !isSource(value['source'])) return false
  switch (value['op']) {
    case 'added':
      return isItem(value['entry']) && isFlag(value['seedChanged'])
    case 'removed':
      return isItem(value['base']) && isFlag(value['seedChanged'])
    case 'patch':
      return (
        isItem(value['base']) &&
        isRecord(value['set']) &&
        Array.isArray(value['unset']) &&
        value['unset'].every((f) => typeof f === 'string') &&
        (value['seedChanged'] === undefined || (isRecord(value['seedChanged']) && Object.values(value['seedChanged']).every(isRecord)))
      )
    default:
      return false
  }
}

function isListOp(value: unknown): value is ListOp {
  if (!isRecord(value) || !isRecord(value['entries'])) return false
  const order = value['order']
  if (order !== undefined && !(Array.isArray(order) && order.every((id) => typeof id === 'string'))) return false
  return Object.values(value['entries']).every(isEntryOp)
}

/** A persisted overlay, fail-closed: anything that is not one, down to each op's shape, reads as
 *  `undefined` (the caller then starts from an empty overlay). */
export function parseOverlay(value: unknown): AgentOverlay | undefined {
  if (!isRecord(value)) return undefined
  if (value['format'] !== 1 || typeof value['base'] !== 'string' || typeof value['baseVersion'] !== 'number' || typeof value['baseDigest'] !== 'string') return undefined
  const { values, lists } = value
  if (!isRecord(values) || !isRecord(lists)) return undefined
  if (!Object.values(values).every((op) => isRecord(op) && isFlag(op['seedChanged']) && isSource(op['source']))) return undefined
  if (!Object.values(lists).every(isListOp)) return undefined
  return value as unknown as AgentOverlay
}

// ── the store ────────────────────────────────────────────────────────────────────────────────────────

export interface OverlayStoreOptions {
  seed: Readonly<Record<string, unknown>>
  overlay: AgentOverlay
  /** Called with the whole overlay after every write. Omit for an unpersisted store (the Builder's). */
  persist?: (overlay: AgentOverlay) => void
}

/** The per-place provenance surface the admin pane reads (T-0162): an overlay store answers all of it; a
 *  whole-record store (an import or a duplicate) answers `provenance` alone, with no seed to reset to. */
export interface ProvenanceReader {
  provenance(address: OverlayAddress): Provenance
  /** The seed's value at `key`, for the diff; absent on a whole-record store. */
  seedValue?(key: string): unknown
  modified?(): OverlayPath[]
  /** Return one place to the seed. On a `seedChanged` place this is "take seed": the op's base already
   *  moved to the new seed, so dropping the op resolves to it. */
  reset?(address: OverlayAddress): void
}

/** A store that records which surface wrote a value (ACS-R8). `set` is a `user` write; `setFrom` names the
 *  source. A writer reaches it through `writeFrom`, which falls back to `set` on a store without it (an
 *  import's whole record has no ops to tag). */
export interface SourcedStore extends SettingsStore {
  setFrom(key: string, value: unknown, source: EditSource): void
}

/** Write `value` as `source`: `setFrom` on a store that records sources, else a plain `set`. */
export function writeFrom(store: SettingsStore, key: string, value: unknown, source: EditSource): void {
  const sourced = store as Partial<SourcedStore>
  if (typeof sourced.setFrom === 'function') sourced.setFrom(key, value, source)
  else store.set(key, value)
}

/** A `SettingsStore` over seed plus overlay: `get` resolves, `set` diffs against the seed as a `user` op,
 *  `setFrom` as the named source's. */
export interface OverlayStore extends SourcedStore, ProvenanceReader {
  subscribe(listener: (key: string, value: unknown) => void): () => void
  overlay(): AgentOverlay
  modified(): OverlayPath[]
  reset(address: OverlayAddress): void
  seedValue(key: string): unknown
}

export function createOverlayStore(options: OverlayStoreOptions): OverlayStore {
  const { seed, persist } = options
  let overlay = options.overlay
  // The resolved value per key, cached until that key is written or reset: `get` hands back a stable
  // reference between writes (and the very object `set` received, for the settings fields' zero-echo
  // check, which compares by identity), as a plain Map-backed store does.
  const resolved = new Map<string, unknown>()
  const listeners = new Set<(key: string, value: unknown) => void>()
  const notify = (key: string, value: unknown): void => {
    for (const listener of listeners) listener(key, value)
  }
  const write = (key: string, value: unknown, source: EditSource): void => {
    overlay = setOverlayKey(seed, overlay, key, value, source)
    resolved.set(key, value)
    persist?.(overlay)
    notify(key, value)
  }
  return {
    get(key) {
      if (!resolved.has(key)) resolved.set(key, resolveOverlayKey(seed, overlay, key))
      return resolved.get(key)
    },
    set(key, value) {
      write(key, value, 'user')
    },
    setFrom(key, value, source) {
      write(key, value, source)
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
    provenance: (address) => provenanceAt(overlay, address),
    seedValue: (key) => clone(seed[key]),
    reset(address) {
      overlay = resetPath(overlay, address)
      const value = resolveOverlayKey(seed, overlay, address.key)
      resolved.set(address.key, value)
      persist?.(overlay)
      notify(address.key, value)
    },
  }
}
