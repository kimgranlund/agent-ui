// persona-edit.ts: T-0447 (agent authoring S5), the edit record behind a Co-pilot edit session's Undo.
// Pure, no DOM: the element captures around its one consumption site (`applyPersonaPatch`) and reverts on a
// receipt's Undo click.
//
// Why not the overlay's per-field reset: a Builder write replaces any prior user op at the key (base = seed,
// agent-overlay.ts `setOverlayKey`), so reset-to-seed throws away the user's pre-edit value; and imported,
// duplicated and new agents are plain memory stores with no reset at all. So the record holds the value each
// key had before the edit and the value the edit left. On an overlay store it also holds the key's own
// overlay slice, so a restore brings back the prior op exactly (its `source` and `seedChanged` included).
//
// The revert law: a key is restored only while it still holds this edit's after value. A key changed since
// is skipped and named, never overwritten.
import { canonical } from './value-digest.ts'
import { PERSONA_STATE_KEYS, type PatchReport, type PersonaStateStore } from './persona-patch.ts'
import type { OverlaySlices } from './agent-overlay.ts'

/** The overlay half of a store, duck-typed like `writeFrom`: a memory store has neither method. */
interface SliceStore {
  snapshotKeys(keys: readonly string[]): OverlaySlices
  restoreKeys(slices: OverlaySlices): void
}

function sliceStore(store: PersonaStateStore): SliceStore | undefined {
  const candidate = store as Partial<SliceStore>
  return typeof candidate.snapshotKeys === 'function' && typeof candidate.restoreKeys === 'function' ? (candidate as SliceStore) : undefined
}

/** What the store held at each key a patch names, before the patch applied. */
export interface EditSnapshot {
  keys: string[]
  before: Record<string, unknown>
  slices?: OverlaySlices
}

/** One edit: the keys it changed, each one's value before and after, and (overlay store) its prior ops. */
export interface EditRecord {
  keys: string[]
  before: Record<string, unknown>
  after: Record<string, unknown>
  slices?: OverlaySlices
}

const clone = <T>(value: T): T => (value === undefined ? value : structuredClone(value))

const pick = <T>(record: Readonly<Record<string, T>>, keys: readonly string[]): Record<string, T> => {
  const out: Record<string, T> = {}
  for (const key of keys) if (Object.hasOwn(record, key)) out[key] = record[key]!
  return out
}

/** Snapshot the persona-state keys `patch` names (`values` keys plus `entries` keys), before it applies. */
export function captureEdit(
  store: PersonaStateStore,
  patch: { values?: Record<string, unknown>; entries?: Record<string, unknown[]> },
): EditSnapshot {
  const named = new Set([...Object.keys(patch.values ?? {}), ...Object.keys(patch.entries ?? {})])
  const keys = PERSONA_STATE_KEYS.filter((key) => named.has(key))
  const before: Record<string, unknown> = {}
  for (const key of keys) before[key] = clone(store.get(key))
  const slices = sliceStore(store)?.snapshotKeys(keys)
  return slices === undefined ? { keys, before } : { keys, before, slices }
}

/** The record of what the patch actually changed: the snapshot cut to the keys `report` applied, added to
 *  or updated, each with its value now. `undefined` when the patch changed nothing. */
export function finishEdit(store: PersonaStateStore, snapshot: EditSnapshot, report: PatchReport): EditRecord | undefined {
  const changed = new Set([...report.applied, ...Object.keys(report.added), ...Object.keys(report.updated)])
  const keys = snapshot.keys.filter((key) => changed.has(key))
  if (keys.length === 0) return undefined
  const after: Record<string, unknown> = {}
  for (const key of keys) after[key] = clone(store.get(key))
  const record: EditRecord = { keys, before: pick(snapshot.before, keys), after }
  if (snapshot.slices !== undefined) record.slices = pick(snapshot.slices, keys)
  return record
}

/** One record per turn when a turn carries several patches: a key's `before` (and slice) from the earliest
 *  record naming it, its `after` from the latest. */
export function mergeEdit(earlier: EditRecord | undefined, later: EditRecord | undefined): EditRecord | undefined {
  if (earlier === undefined) return later
  if (later === undefined) return earlier
  const keys = [...earlier.keys, ...later.keys.filter((key) => !earlier.keys.includes(key))]
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}
  const slices: OverlaySlices = {}
  for (const key of keys) {
    const first = earlier.keys.includes(key) ? earlier : later
    const last = later.keys.includes(key) ? later : earlier
    before[key] = first.before[key]
    after[key] = last.after[key]
    const slice = first.slices?.[key]
    if (slice !== undefined) slices[key] = slice
  }
  const record: EditRecord = { keys, before, after }
  if (earlier.slices !== undefined || later.slices !== undefined) record.slices = slices
  return record
}

/** Undo one edit. A key still holding the record's after value is restored (its overlay slice on an overlay
 *  store, else its before value through `set`); any other key is skipped and never overwritten. */
export function revertEdit(store: PersonaStateStore, record: EditRecord): { reverted: string[]; skipped: string[] } {
  const reverted: string[] = []
  const skipped: string[] = []
  for (const key of record.keys) {
    if (canonical(store.get(key)) === canonical(record.after[key])) reverted.push(key)
    else skipped.push(key)
  }
  const overlay = sliceStore(store)
  const slices = record.slices
  if (overlay !== undefined && slices !== undefined) {
    const restore: OverlaySlices = {}
    for (const key of reverted) restore[key] = slices[key] ?? {}
    if (reverted.length > 0) overlay.restoreKeys(restore)
  } else {
    for (const key of reverted) store.set(key, clone(record.before[key]))
  }
  return { reverted, skipped }
}
