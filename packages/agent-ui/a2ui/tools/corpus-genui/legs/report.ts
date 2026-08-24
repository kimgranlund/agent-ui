// report.ts — LLD-C4 §5 (GH #1584), the `report` leg (KEYLESS): derive `index.json` (the docs page's
// read contract, LLD §5) + a markdown summary. `deriveGenuiCorpusIndex` is the ONE function both this
// leg AND the standing gate (`src/corpus-genui/corpus-genui-data.test.ts`) call — no generator/gate
// drift pair (the `generate-sitemap.mjs` precedent). `now` is an injected clock (defaults to a real
// one) so a caller proving byte-identity across two derivations can hold the ONE genuinely time-varying
// field constant — every OTHER field is a pure function of the committed data.

import type { GenuiCorpusRecord } from '../../../src/corpus-genui/record.ts'
import type { GenuiArchivedVerdict } from '../../../src/corpus-genui/verdicts.ts'
import { loadGenuiRecords, loadGenuiVerdictArchive, loadPrompts, readRubricVersion, writeIndexJson } from '../fs.ts'
import type { LoadedGenuiRecord } from '../fs.ts'
// The pure, node-free TYPE shape lives in src/corpus-genui/index-shape.ts (a browser/site consumer type-
// imports it directly from there, never from here — this Node shell's own node:*/fs.ts imports would
// otherwise drag into the site's type program, the `site/tsconfig.json` "no node types" constraint).
// Re-exported here too so an EXISTING caller of THIS module's types (this leg, the standing gate) needs
// no import-path change.
export type { GenuiCorpusIndex, GenuiCorpusIndexRecordRow, GenuiCorpusIndexPerPack, GenuiCorpusIndexM3 } from '../../../src/corpus-genui/index-shape.ts'
import type { GenuiCorpusIndex, GenuiCorpusIndexRecordRow, GenuiCorpusIndexPerPack, GenuiCorpusIndexM3 } from '../../../src/corpus-genui/index-shape.ts'

/** `dimensions` is NOT a field `GenuiCorpusRecord.meta` carries (LLD §3.1 names only `qualityScore`/
 *  `passed`/`failingDimensions`/`verdictDate` — the per-dimension breakdown lives on the ARCHIVED
 *  verdict, not the record). This reader looks it up by name from the verdict archive `apply` already
 *  consulted — LLD §5's `dimensions?` index-row field is optional for exactly this reason: a critic seat
 *  may score without per-dimension detail, and the row degrades honestly to `undefined` when so. */
function rowOf(record: GenuiCorpusRecord, archive: ReadonlyMap<string, GenuiArchivedVerdict>): GenuiCorpusIndexRecordRow {
  const archived = archive.get(record.name)
  return {
    name: record.name,
    promptId: record.promptId,
    packId: record.packId,
    model: record.meta.model,
    status: record.meta.status,
    ...(record.meta.qualityScore !== undefined ? { qualityScore: record.meta.qualityScore } : {}),
    ...(record.meta.passed !== undefined ? { passed: record.meta.passed } : {}),
    ...(record.meta.failingDimensions !== undefined ? { failingDimensions: record.meta.failingDimensions } : {}),
    ...(archived?.dimensions !== undefined ? { dimensions: archived.dimensions } : {}),
    ...(archived?.rationale !== undefined ? { rationale: archived.rationale } : {}),
    ...(record.meta.verdictDate !== undefined ? { verdictDate: record.meta.verdictDate } : {}),
    htmlHash: record.meta.htmlHash,
    lint: record.meta.lint,
  }
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length
}

/** A cell key over `(promptId, packId)` — `packId` is `null` for the control arm; ` ` never occurs
 *  in either field so this is collision-free. */
function cellKey(promptId: string, packId: string | null): string {
  return `${promptId} ${packId ?? ''}`
}

export interface CellOverflow {
  promptId: string
  packId: string | null
  count: number
}

/** The report-time retry/reset guard (LLD §5 amendment, 2026-08-24): a `(promptId, packId)` cell carrying
 *  MORE than 3 records means a re-run piled up on top of a prior one instead of clearing it first — never
 *  silently cleared or deduped here (no data is deleted implicitly), always a hard rejection naming the
 *  offending cells so an operator clears `records/v1/*.jsonl` for exactly those cells before re-running.
 *  Chosen over silently keeping the newest 3: that would let the 2-of-3 majority floor loosen to
 *  2-of-N as retries accumulate, exactly the drift this guard exists to prevent. */
export function findCellOverflow(loaded: readonly LoadedGenuiRecord[]): CellOverflow[] {
  const counts = new Map<string, number>()
  for (const { record } of loaded) {
    const key = cellKey(record.promptId, record.packId)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const overflow: CellOverflow[] = []
  for (const [key, count] of counts) {
    if (count > 3) {
      const [promptId, packIdRaw] = key.split(' ') as [string, string]
      overflow.push({ promptId, packId: packIdRaw === '' ? null : packIdRaw, count })
    }
  }
  return overflow.sort((a, b) => (a.promptId < b.promptId ? -1 : a.promptId > b.promptId ? 1 : 0))
}

/**
 * Derive the whole `GenuiCorpusIndex` from the committed data dir (LLD §5). Pure OVER THE FILESYSTEM
 * SNAPSHOT: reading is a side effect, but two calls against the SAME on-disk state (and the same
 * injected `now`) yield byte-identical JSON — the standing gate's own re-derivation proof.
 */
export function deriveGenuiCorpusIndex(repoRoot: string, opts?: { now?: () => string }): GenuiCorpusIndex {
  const now = opts?.now ?? (() => new Date().toISOString())
  const promptSet = loadPrompts(repoRoot)
  const rubricVersion = readRubricVersion(repoRoot) ?? ''
  const loaded = loadGenuiRecords(repoRoot)
  const archiveResult = loadGenuiVerdictArchive(repoRoot)
  const archive = archiveResult.ok ? archiveResult.archive : new Map<string, GenuiArchivedVerdict>()

  const records = loaded.map(({ record }) => rowOf(record, archive)).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

  // Judged, PACK-CONDITIONED (packId !== null) records — the m3 floor's own scope (LLD §5: "the m3
  // reading... every judged pack-conditioned record"). Judged CONTROL records are aggregated separately.
  const judgedPackConditioned = loaded.filter(({ record }) => record.meta.status === 'judged' && record.packId !== null)
  const judgedControl = loaded.filter(({ record }) => record.meta.status === 'judged' && record.packId === null)

  let m3: GenuiCorpusIndexM3 | null = null
  if (judgedPackConditioned.length > 0) {
    const scores = judgedPackConditioned.map(({ record }) => record.meta.qualityScore!)
    const passedCount = judgedPackConditioned.filter(({ record }) => record.meta.passed === true).length
    const perPack: Record<string, GenuiCorpusIndexPerPack> = {}
    const packIds = [...new Set(judgedPackConditioned.map(({ record }) => record.packId!))].sort()
    for (const packId of packIds) {
      const inPack = judgedPackConditioned.filter(({ record }) => record.packId === packId)
      const packScores = inPack.map(({ record }) => record.meta.qualityScore!)
      const d2s = inPack.map(({ record }) => archive.get(record.name)?.dimensions?.D2 ?? record.meta.qualityScore!)
      perPack[packId] = {
        judged: inPack.length,
        passed: inPack.filter(({ record }) => record.meta.passed === true).length,
        meanD2: mean(d2s),
        minScore: Math.min(...packScores),
      }
    }

    // D2 (2026-08-24 LLD §5 amendment, genui-b3-judged-eval.lld.md v0.2): the floor reads per CELL
    // (promptId, packId), not per record. `--runs 3` means every cell is a small sample, not a single
    // coin flip; strict every-record-passes also gets monotonically harder as n grows (a p=0.9 model
    // passes a 12-cell floor at n=1 ~28% of the time, at n=3 ~2% — a defective metric, not a stricter
    // one). A cell passes iff >=2 of its (at most 3) records score qualityScore>=4; an E_NO_GENUI miss
    // never becomes a record at all, so it counts by ABSENCE — a cell with fewer than 2 passing records
    // fails the floor whether the shortfall is a low score or a miss. Cells are enumerated from
    // `prompts.json` itself (every prompt is pack-conditioned; 4 per pack x 3 packs = 12), not from
    // whatever records happen to exist, so a cell with ZERO judged records still counts as failing —
    // the exact "invisible miss" defect this amendment fixes.
    const passingRunsByCell = new Map<string, number>()
    for (const { record } of judgedPackConditioned) {
      if (record.meta.qualityScore! >= 4) {
        const key = cellKey(record.promptId, record.packId)
        passingRunsByCell.set(key, (passingRunsByCell.get(key) ?? 0) + 1)
      }
    }
    const floorMet = promptSet.prompts.every((p) => (passingRunsByCell.get(cellKey(p.id, p.packId)) ?? 0) >= 2)

    m3 = {
      judged: judgedPackConditioned.length,
      passed: passedCount,
      passRate: passedCount / judgedPackConditioned.length,
      minScore: Math.min(...scores),
      meanScore: mean(scores),
      floorMet,
      perPack,
      ...(judgedControl.length > 0
        ? {
            control: {
              judged: judgedControl.length,
              meanD2: mean(judgedControl.map(({ record }) => archive.get(record.name)?.dimensions?.D2 ?? record.meta.qualityScore!)),
            },
          }
        : {}),
    }
  }

  return { generatedAt: now(), rubricVersion, promptSetVersion: promptSet.promptSetVersion, records, m3 }
}

function stableStringify(index: GenuiCorpusIndex): string {
  return `${JSON.stringify(index, null, 2)}\n`
}

function summaryOf(index: GenuiCorpusIndex): string {
  const lines: string[] = []
  lines.push(`# GenUI corpus report`)
  lines.push(``)
  lines.push(`rubricVersion: ${index.rubricVersion} · promptSetVersion: ${index.promptSetVersion} · records: ${index.records.length}`)
  if (index.m3 === null) {
    lines.push(``)
    lines.push(`m3: null — no judged pack-conditioned record yet.`)
  } else {
    lines.push(``)
    lines.push(
      `m3: floorMet=${String(index.m3.floorMet)} judged=${index.m3.judged} passed=${index.m3.passed} ` +
        `passRate=${index.m3.passRate.toFixed(2)} minScore=${index.m3.minScore} meanScore=${index.m3.meanScore.toFixed(2)}`,
    )
    for (const [packId, row] of Object.entries(index.m3.perPack)) {
      lines.push(`  - ${packId}: judged=${row.judged} passed=${row.passed} meanD2=${row.meanD2.toFixed(2)} minScore=${row.minScore}`)
    }
    if (index.m3.control) lines.push(`  control: judged=${index.m3.control.judged} meanD2=${index.m3.control.meanD2.toFixed(2)}`)
  }
  return lines.join('\n')
}

export interface ReportOptions {
  requireM3?: boolean
  dryRun?: boolean
  now?: () => string
}

export interface ReportResult {
  ok: boolean
  index: GenuiCorpusIndex
  text: string
  summary: string
  /** Present only on the E_CELL_OVERFLOW rejection below — the leg's own named-error shape (the
   *  `collect` leg's `setupError` precedent), never thrown. */
  cellOverflow?: CellOverflow[]
}

export function runReportLeg(repoRoot: string, opts: ReportOptions): ReportResult {
  // The retry/reset guard runs BEFORE deriving anything — a cell over the 3-record cap means a prior
  // run's records were never cleared, and computing a floor over inflated cells would silently let the
  // 2-of-3 majority loosen to 2-of-N. Reject whole, write nothing, name every offending cell.
  const overflow = findCellOverflow(loadGenuiRecords(repoRoot))
  if (overflow.length > 0) {
    const index = deriveGenuiCorpusIndex(repoRoot, { now: opts.now }) // still computed, for visibility
    const lines = [
      `E_CELL_OVERFLOW: ${overflow.length} cell(s) exceed the 3-record cap — clear these before re-running:`,
      ...overflow.map((o) => `  (promptId=${o.promptId}, packId=${o.packId ?? 'control'}): ${o.count} records — clear records/v1/*.jsonl entries for this cell`),
    ]
    return { ok: false, index, text: stableStringify(index), summary: lines.join('\n'), cellOverflow: overflow }
  }
  const index = deriveGenuiCorpusIndex(repoRoot, { now: opts.now })
  const text = stableStringify(index)
  if (!opts.dryRun) writeIndexJson(repoRoot, text)
  const floorMet = opts.requireM3 === true ? index.m3 !== null && index.m3.floorMet : true
  return { ok: floorMet, index, text, summary: summaryOf(index) }
}
