// skill-pack-store.ts — ADR-0208 D3 (GH #1340/#1349): app-side ingestion of an `agent-ui-skillpack@1`
// snapshot (the D1 format `scripts/import-skill-pack.mjs` writes) into the shared ADR-0193
// `StorageAdapter` seam, IndexedDB tier, under `skill-packs:<packId>` — the imported SHELF.
//
// The trust shape is ADR-0202's document-ingest seam: bytes arrive ONLY by the user's explicit
// local-file choice (the page's file picker), zero egress — this module performs no fetch, opens no
// socket, and the sibling `skill-pack-no-egress.test.ts` pins that mechanically (the
// document-ingest-no-egress.test.ts precedent). Validation is FAIL-CLOSED with a NAMED reason (the
// `validateNewEntry` refusal law at pack grain, D3): wrong/absent format marker, a non-
// `EntryLibraryPack`-shaped pack, or an empty `provenance.sourceUrl`/`commitSha` all refuse visibly.
//
// The shelf is APP-level, deliberately not per-persona (D3): one imported shelf, every persona
// browses it; what IS per-persona is the opt-in (D4 — an add commits through the SAME
// `validateNewEntry` path into the active persona's own `entries:skill` store). Removing a pack
// deletes its `skill-packs:` record ONLY — entries a persona already opted into are COPIES (the
// standing law: a library add IS a custom add with the typing done, entry-data.ts) and are untouched.
// Re-import replaces the SHELF; it never rewrites a persona's opted-in copy (D4's no-background-
// mutation law — the collision-disabled picker row is the visible "your copy is older" state).
//
// IndexedDB tier by design (D3): arbitrary-size third-party bodies are exactly what the IDB tier
// exists for (the `resource-idb-store.ts` precedent, whose adapter/`__testSetAdapter` shape this
// module follows — jsdom suites prove THIS module's logic over an in-memory fake; the real tier's
// mechanics are already proven by `indexed-db-adapter.browser.test.ts`, not re-proven here).

import { createIndexedDbAdapter, type StorageAdapter } from '@agent-ui/shared'
import type { DataSource, SourceContext } from '@agent-ui/data'
import type { EntryLibraryPack, NewEntryInput } from '../entry-list/entry-data.ts'

/** The D1 format marker — ingestion fail-closes on anything else (never a best-effort parse). */
export const SKILL_PACK_FORMAT = 'agent-ui-skillpack@1'

/** The store-key namespace (ADR-0208 D3): one whole snapshot per imported repo, `skill-packs:<id>`. */
export const SKILL_PACK_KEY_PREFIX = 'skill-packs:'

/** One D5.4 directive-scan finding — a REVIEW AID the CLI stamped, never a silent filter: the pack
 *  library renders these beside the entry so the human verdict happens at review-before-enable. */
export interface SkillPackScanFinding {
  entryId: string
  line: number
  reason: string
}

/** The D1 provenance stamp — the corpus `meta.provenance` discipline extended with a pinned sha. */
export interface SkillPackProvenance {
  sourceUrl: string
  commitSha: string
  importedAt: string
  skillCount: number
  /** Harness vocabulary the product has no semantics for — dropped by the CLI but COUNTED (D1). */
  droppedFrontmatterKeys: string[]
  /** Malformed/fence-less SKILL.md dirs — skipped by the CLI, LISTED (never silently absent). */
  skipped: string[]
  scan: { flagged: SkillPackScanFinding[] }
}

/** The source repo's root license file, verbatim — or null when the repo carries none (D7: the pack
 *  library then states "no license file found" rather than guessing). */
export type SkillPackLicense = { fileName: string; text: string } | null

/** One whole imported snapshot — pack + provenance + license persist TOGETHER (D3). The pack member
 *  is `EntryLibraryPack`-shaped plain data whose entries all carry an explicit `id` (the source
 *  folder name, LLD-C7's stable-id law). */
export interface SkillPackSnapshot {
  format: typeof SKILL_PACK_FORMAT
  pack: {
    id: string
    label: string
    description: string
    rejectOnCollision?: boolean
    entries: NewEntryInput[]
  }
  provenance: SkillPackProvenance
  license: SkillPackLicense
}

export type ParseSkillPackResult = { ok: true; snapshot: SkillPackSnapshot } | { ok: false; error: string }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

/** One pack entry's shape check — `NewEntryInput` with the imported-pack strengthening: `id` is
 *  REQUIRED here (the folder name — D1's explicit stable id; a first-party pack may omit it, an
 *  imported one never does, because the id is the foreign key `rejectOnCollision` refuses on). */
function isImportedEntry(value: unknown): value is NewEntryInput & { id: string } {
  return isRecord(value) && isNonEmptyString(value.id) && isNonEmptyString(value.label) && typeof value.description === 'string' && typeof value.content === 'string'
}

function isScanFinding(value: unknown): value is SkillPackScanFinding {
  return isRecord(value) && typeof value.entryId === 'string' && typeof value.line === 'number' && typeof value.reason === 'string'
}

/**
 * D3's fail-closed validation over an already-parsed JSON value, every refusal a NAMED reason (the
 * `validateNewEntry` refusal law at pack grain). Accepts EXACTLY the D1 shape; nothing is coerced,
 * defaulted, or silently dropped — a snapshot that passes is stored byte-meaning-identical to what
 * the CLI wrote.
 */
export function parseSkillPackSnapshot(raw: unknown): ParseSkillPackResult {
  if (!isRecord(raw)) return { ok: false, error: 'Not a skill-pack snapshot (expected a JSON object).' }
  if (raw.format !== SKILL_PACK_FORMAT) {
    return { ok: false, error: `Unsupported format marker ${JSON.stringify(raw.format ?? null)} — expected "${SKILL_PACK_FORMAT}".` }
  }

  const pack = raw.pack
  if (!isRecord(pack) || !isNonEmptyString(pack.id) || !isNonEmptyString(pack.label) || typeof pack.description !== 'string') {
    return { ok: false, error: 'The pack is not EntryLibraryPack-shaped (id, label, and description are required).' }
  }
  if (!Array.isArray(pack.entries) || pack.entries.length === 0) {
    return { ok: false, error: 'The pack carries no entries — nothing to import.' }
  }
  for (const [index, entry] of pack.entries.entries()) {
    if (!isImportedEntry(entry)) {
      return { ok: false, error: `Pack entry ${index + 1} is malformed — every entry needs a non-empty id and label plus string description/content.` }
    }
  }

  const provenance = raw.provenance
  if (!isRecord(provenance)) return { ok: false, error: 'The provenance stamp is missing.' }
  if (!isNonEmptyString(provenance.sourceUrl)) return { ok: false, error: 'The provenance stamp carries no sourceUrl — refused (snapshot origin unknown).' }
  if (!isNonEmptyString(provenance.commitSha)) return { ok: false, error: 'The provenance stamp carries no commitSha — refused (snapshot is not pinned).' }
  const scanRaw = isRecord(provenance.scan) ? provenance.scan.flagged : undefined
  const flagged = Array.isArray(scanRaw) ? scanRaw.filter(isScanFinding) : []

  const license = raw.license
  if (license !== null && !(isRecord(license) && isNonEmptyString(license.fileName) && typeof license.text === 'string')) {
    return { ok: false, error: 'The license record is malformed — expected { fileName, text } or null.' }
  }

  return {
    ok: true,
    snapshot: {
      format: SKILL_PACK_FORMAT,
      pack: {
        id: pack.id.trim(),
        label: pack.label,
        description: pack.description,
        rejectOnCollision: pack.rejectOnCollision === true,
        entries: pack.entries as NewEntryInput[],
      },
      provenance: {
        sourceUrl: provenance.sourceUrl,
        commitSha: provenance.commitSha,
        importedAt: typeof provenance.importedAt === 'string' ? provenance.importedAt : '',
        skillCount: typeof provenance.skillCount === 'number' ? provenance.skillCount : pack.entries.length,
        droppedFrontmatterKeys: Array.isArray(provenance.droppedFrontmatterKeys) ? provenance.droppedFrontmatterKeys.filter((k): k is string => typeof k === 'string') : [],
        skipped: Array.isArray(provenance.skipped) ? provenance.skipped.filter((s): s is string => typeof s === 'string') : [],
        scan: { flagged },
      },
      license: license as SkillPackLicense,
    },
  }
}

/** The file-picker front door: raw file TEXT → parsed, validated snapshot. A file that is not JSON at
 *  all refuses with its own named reason before shape validation ever runs. */
export function parseSkillPackText(text: string): ParseSkillPackResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Not a JSON file — a skill pack is the .skillpack.json the import CLI writes.' }
  }
  return parseSkillPackSnapshot(raw)
}

// ── the shelf store (ADR-0193 StorageAdapter seam, IndexedDB tier) ───────────────────────────────────

const DB_NAME = 'agent-ui-skill-packs'

let realAdapter: StorageAdapter | undefined
let adapterOverride: StorageAdapter | undefined

function getAdapter(): StorageAdapter {
  if (adapterOverride) return adapterOverride
  realAdapter ??= createIndexedDbAdapter({ dbName: DB_NAME })
  return realAdapter
}

/** Test-only escape hatch — the `resource-idb-store.ts` `__testSetAdapter` precedent verbatim: swap
 *  the backing `StorageAdapter` for an in-memory fake so jsdom suites prove THIS module's own logic
 *  (jsdom implements no IndexedDB). `undefined` restores the real lazily-constructed adapter. */
export function __testSetAdapter(adapter: StorageAdapter | undefined): void {
  adapterOverride = adapter
}

/** The store key one imported pack's WHOLE snapshot lives under (D3). */
export function skillPackStoreKey(packId: string): string {
  return `${SKILL_PACK_KEY_PREFIX}${packId}`
}

/** Persist one accepted snapshot WHOLE (pack + provenance + license, D3). Keyed by the pack id —
 *  re-importing the same source repo OVERWRITES the shelf record wholesale (D2's idempotent
 *  re-import), and never touches any persona's opted-in entry copies (D4). */
export async function saveSkillPack(snapshot: SkillPackSnapshot): Promise<void> {
  await getAdapter().set(skillPackStoreKey(snapshot.pack.id), snapshot)
}

/** Every imported snapshot currently on the shelf, sorted by pack id (deterministic shelf order).
 *  Defensive read (the `readEntries` law): a foreign/corrupt record under the prefix is SKIPPED —
 *  re-validated through the same fail-closed parse the picker path uses — never a throw. */
export async function loadSkillPacks(): Promise<SkillPackSnapshot[]> {
  const adapter = getAdapter()
  const keys = (await adapter.keys()).filter((key) => key.startsWith(SKILL_PACK_KEY_PREFIX))
  const snapshots: SkillPackSnapshot[] = []
  for (const key of keys.sort()) {
    const value = await adapter.get(key).catch(() => undefined)
    const parsed = parseSkillPackSnapshot(value)
    if (parsed.ok) snapshots.push(parsed.snapshot)
  }
  return snapshots
}

/** Remove one pack from the shelf — deletes its `skill-packs:` record ONLY (D3): a persona's
 *  already-opted-in entries are copies and stay untouched, by construction (this module cannot even
 *  reach a persona store). */
export async function removeSkillPack(packId: string): Promise<void> {
  await getAdapter().delete(skillPackStoreKey(packId))
}

// ── the DataSource face (ADR-0227 wave 2, GH #1545 — the persona-roster-source pattern applied) ─────
// The shelf's CRUD verbs as a `DataSource<SkillPackSnapshot>` over the SAME adapter + keys the module
// functions above use (`skill-packs:<packId>`, IndexedDB db `agent-ui-skill-packs` — persisted data
// survives byte-for-byte), so a page's shelf read collapses to ONE `resource()` and every import/remove
// rides a `mutation()` (ADR-0227 clause 2: one fact, one owner; every render surface derives). No
// `subscribe` verb: the IndexedDB adapter carries no cross-tab seam (unlike the localStorage tier's
// `storage`-event pump the roster source rides) — a second tab's import lands on the next read.

/** The whole-shelf view the page's ONE skill-pack `resource()` reads — `read` present by contract
 *  (the persona source's `view` sub-source shape, list-as-one-value). */
export interface SkillPackShelfSource extends DataSource<readonly SkillPackSnapshot[]> {
  read(key: string, ctx: SourceContext): Promise<readonly SkillPackSnapshot[]>
}

/** The shelf as a `DataSource<SkillPackSnapshot>` (ADR-0227's verb set, minus `subscribe` — banner
 *  above) plus the `shelf` sub-source. Keys are pack ids (`create` is keyed by the snapshot's OWN
 *  `pack.id` — D2's idempotent re-import IS `create`'s last-write-wins upsert). */
export interface SkillPackSource extends DataSource<SkillPackSnapshot, undefined, SkillPackSnapshot> {
  read(key: string, ctx: SourceContext): Promise<SkillPackSnapshot>
  list(query: undefined, ctx: SourceContext): Promise<readonly SkillPackSnapshot[]>
  create(input: SkillPackSnapshot, ctx: SourceContext): Promise<SkillPackSnapshot>
  remove(key: string, ctx: SourceContext): Promise<void>
  readonly shelf: SkillPackShelfSource
}

export function createSkillPackSource(): SkillPackSource {
  const listAll = async (): Promise<SkillPackSnapshot[]> => loadSkillPacks()
  return {
    async read(key) {
      const snapshot = (await listAll()).find((s) => s.pack.id === key)
      if (snapshot === undefined) throw new Error(`skill-pack-source: no imported pack with id "${key}"`)
      return snapshot
    },
    async list() {
      return listAll()
    },
    async create(input) {
      await saveSkillPack(input) // whole-snapshot overwrite under the pack's own key (D2/D3)
      return input
    },
    async remove(key) {
      await removeSkillPack(key)
    },
    shelf: {
      read: async () => listAll(),
    },
  }
}

// ── the libraries-seam projection (D4) ───────────────────────────────────────────────────────────────

/**
 * Project shelf snapshots into skill-kind `EntryLibraryPack`s for the SAME reactive `libraries` seam
 * every first-party pack rides (`ui-agent-admin`'s `libraries` prop / GH #143) — no new list/toggle/
 * author code (the ADR-0132 cl.1 law). `rejectOnCollision` is FORCED true regardless of what the file
 * said (D4): imported ids key an external registry (the source repo's folder names), so a colliding
 * id is a genuine duplicate to refuse — and the picker's collision-DISABLED row is the visible "your
 * opted-in copy is older than the shelf" state after a refresh.
 */
export function importedSkillPackLibrary(snapshots: readonly SkillPackSnapshot[]): EntryLibraryPack[] {
  return snapshots.map((snapshot) => ({
    id: snapshot.pack.id,
    label: snapshot.pack.label,
    description: snapshot.pack.description,
    rejectOnCollision: true,
    entries: snapshot.pack.entries,
  }))
}

/** D7's attribution line, ONE place: source URL, short commit sha, import date, and the license file
 *  name — or the honest "no license file found" (never a guessed license). The pack library displays
 *  this on the imported pack's row; the toast path reuses it verbatim. */
export function skillPackAttribution(snapshot: SkillPackSnapshot): string {
  const shortSha = snapshot.provenance.commitSha.slice(0, 7)
  const day = snapshot.provenance.importedAt.slice(0, 10)
  const imported = day.length > 0 ? ` · imported ${day}` : ''
  const license = snapshot.license === null ? 'no license file found' : snapshot.license.fileName
  return `${snapshot.provenance.sourceUrl} @ ${shortSha}${imported} · ${license}`
}
