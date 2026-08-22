// report.ts — LLD-C4 §5 (GH #1584), the `report` leg (KEYLESS): derive `index.json` (the docs page's
// read contract, LLD §5) + a markdown summary. `deriveGenuiCorpusIndex` is the ONE function both this
// leg AND the standing gate (`src/corpus-genui/corpus-genui-data.test.ts`) call — no generator/gate
// drift pair (the `generate-sitemap.mjs` precedent). `now` is an injected clock (defaults to a real
// one) so a caller proving byte-identity across two derivations can hold the ONE genuinely time-varying
// field constant — every OTHER field is a pure function of the committed data.

import type { GenuiCorpusRecord } from '../../../src/corpus-genui/record.ts'
import type { GenuiArchivedVerdict, GenuiDimensionScores } from '../../../src/corpus-genui/verdicts.ts'
import type { GenuiHtmlLint } from '../../../src/corpus-genui/lint.ts'
import { loadGenuiRecords, loadGenuiVerdictArchive, loadPrompts, readRubricVersion, writeIndexJson } from '../fs.ts'

export interface GenuiCorpusIndexRecordRow {
  name: string
  promptId: string
  packId: string | null
  model: string | null
  status: 'pending' | 'judged'
  qualityScore?: number
  passed?: boolean
  failingDimensions?: string[]
  dimensions?: GenuiDimensionScores
  htmlHash: string
  verdictDate?: string
  lint: GenuiHtmlLint
}

export interface GenuiCorpusIndexPerPack {
  judged: number
  passed: number
  meanD2: number
  minScore: number
}

export interface GenuiCorpusIndexM3 {
  judged: number
  passed: number
  passRate: number
  minScore: number
  meanScore: number
  /** Every judged pack-conditioned record has `qualityScore >= 4` — the PRD §8 m3 floor (LLD §5). */
  floorMet: boolean
  perPack: Record<string, GenuiCorpusIndexPerPack>
  control?: { judged: number; meanD2: number }
}

export interface GenuiCorpusIndex {
  generatedAt: string
  rubricVersion: string
  promptSetVersion: number
  records: GenuiCorpusIndexRecordRow[]
  m3: GenuiCorpusIndexM3 | null
}

/** `dimensions` is NOT a field `GenuiCorpusRecord.meta` carries (LLD §3.1 names only `qualityScore`/
 *  `passed`/`failingDimensions`/`verdictDate` — the per-dimension breakdown lives on the ARCHIVED
 *  verdict, not the record). This reader looks it up by name from the verdict archive `apply` already
 *  consulted — LLD §5's `dimensions?` index-row field is optional for exactly this reason: a critic seat
 *  may score without per-dimension detail, and the row degrades honestly to `undefined` when so. */
function rowOf(record: GenuiCorpusRecord, archive: ReadonlyMap<string, GenuiArchivedVerdict>): GenuiCorpusIndexRecordRow {
  const dimensions = archive.get(record.name)?.dimensions
  return {
    name: record.name,
    promptId: record.promptId,
    packId: record.packId,
    model: record.meta.model,
    status: record.meta.status,
    ...(record.meta.qualityScore !== undefined ? { qualityScore: record.meta.qualityScore } : {}),
    ...(record.meta.passed !== undefined ? { passed: record.meta.passed } : {}),
    ...(record.meta.failingDimensions !== undefined ? { failingDimensions: record.meta.failingDimensions } : {}),
    ...(dimensions !== undefined ? { dimensions } : {}),
    ...(record.meta.verdictDate !== undefined ? { verdictDate: record.meta.verdictDate } : {}),
    htmlHash: record.meta.htmlHash,
    lint: record.meta.lint,
  }
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length
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
    m3 = {
      judged: judgedPackConditioned.length,
      passed: passedCount,
      passRate: passedCount / judgedPackConditioned.length,
      minScore: Math.min(...scores),
      meanScore: mean(scores),
      floorMet: scores.every((s) => s >= 4),
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
}

export function runReportLeg(repoRoot: string, opts: ReportOptions): ReportResult {
  const index = deriveGenuiCorpusIndex(repoRoot, { now: opts.now })
  const text = stableStringify(index)
  if (!opts.dryRun) writeIndexJson(repoRoot, text)
  const floorMet = opts.requireM3 === true ? index.m3 !== null && index.m3.floorMet : true
  return { ok: floorMet, index, text, summary: summaryOf(index) }
}
