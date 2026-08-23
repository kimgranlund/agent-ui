// apply.ts — LLD-C4 (GH #1584), the `apply` leg (KEYLESS): flip named PENDING records to `judged` from
// a verdicts file, all-or-nothing, and archive that file verbatim under `verdicts/` in the same step
// (the ADR-0165 pattern, mirrored). Unknown name / conflicting re-verdict for an already-judged name
// halts the WHOLE run before any write; an identical re-apply is a byte-level no-op.

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { parseGenuiVerdictsFile } from '../../../src/corpus-genui/verdicts.ts'
import type { GenuiJudgeVerdict } from '../../../src/corpus-genui/verdicts.ts'
import type { GenuiCorpusRecord } from '../../../src/corpus-genui/record.ts'
import { loadGenuiRecordsByFile, writeGenuiRecordsByFile, readRubricVersion, archiveGenuiVerdicts, genuiVerdictArchiveFileName, VERDICTS_DIR } from '../fs.ts'

export interface ApplyOptions {
  verdictsPath: string
  dryRun?: boolean
}

export interface ApplyResult {
  ok: boolean
  updated: string[]
  noops: string[]
  issues: string[]
  archiveOutcome?: 'archived' | 'unchanged' | 'conflict'
}

/** Whether a NEW verdict for an already-judged record reproduces its CURRENT recorded outcome (the
 *  `rescore.ts` idempotence check, mirrored: only a byte-identical passing/failing outcome counts). */
function verdictMatchesCurrent(rec: GenuiCorpusRecord, verdict: GenuiJudgeVerdict): boolean {
  if (rec.meta.qualityScore !== verdict.qualityScore || rec.meta.passed !== verdict.passed) return false
  const current = rec.meta.failingDimensions ?? []
  const incoming = verdict.failingDimensions ?? []
  return current.length === incoming.length && current.every((d, i) => d === incoming[i])
}

export async function runApplyLeg(repoRoot: string, opts: ApplyOptions): Promise<ApplyResult> {
  const rubricVersion = readRubricVersion(repoRoot)
  if (rubricVersion === undefined) {
    return { ok: false, updated: [], noops: [], issues: ['the rubric document is missing or carries no version: marker'] }
  }

  let text: string
  try {
    text = readFileSync(opts.verdictsPath, 'utf8') as string
  } catch {
    return { ok: false, updated: [], noops: [], issues: [`could not read --verdicts path: ${opts.verdictsPath}`] }
  }

  const parsed = parseGenuiVerdictsFile(text, rubricVersion)
  if (!parsed.ok) {
    return { ok: false, updated: [], noops: [], issues: parsed.issues.map((i) => `${i.path || '(root)'}: ${i.message}`) }
  }

  const byFile = loadGenuiRecordsByFile(repoRoot)
  const byName = new Map<string, { file: string; record: GenuiCorpusRecord; index: number }>()
  for (const [file, records] of byFile) records.forEach((record, index) => byName.set(record.name, { file, record, index }))

  const issues: string[] = []
  const noops: string[] = []
  const updates: { file: string; index: number; record: GenuiCorpusRecord }[] = []

  for (const [name, verdict] of Object.entries(parsed.file.verdicts)) {
    const entry = byName.get(name)
    if (entry === undefined) {
      issues.push(`"${name}": no record with this name exists`)
      continue
    }
    if (entry.record.meta.status === 'judged') {
      if (verdictMatchesCurrent(entry.record, verdict)) {
        noops.push(name)
      } else {
        issues.push(
          `"${name}": a DIFFERENT verdict was submitted for an already-judged record — current is ` +
            `passed=${String(entry.record.meta.passed)} qualityScore=${String(entry.record.meta.qualityScore)}, ` +
            `incoming is passed=${String(verdict.passed)} qualityScore=${String(verdict.qualityScore)}`,
        )
      }
      continue
    }
    const updated: GenuiCorpusRecord = {
      ...entry.record,
      meta: {
        ...entry.record.meta,
        status: 'judged',
        qualityScore: verdict.qualityScore,
        passed: verdict.passed,
        ...(verdict.failingDimensions !== undefined ? { failingDimensions: verdict.failingDimensions } : {}),
        verdictDate: parsed.file.date,
      },
    }
    updates.push({ file: entry.file, index: entry.index, record: updated })
  }

  if (issues.length > 0) {
    return { ok: false, updated: [], noops, issues }
  }

  const outPath = `${VERDICTS_DIR}/${genuiVerdictArchiveFileName(parsed.file.date, basename(opts.verdictsPath))}`

  // Check the archive step FIRST, read-only (dryRun:true never writes on ANY of its three outcomes) —
  // all-or-nothing means a conflicting archive target must halt BEFORE the records are ever touched,
  // never after (the write-order this leg's own "nothing written" contract depends on).
  const preflight = archiveGenuiVerdicts(repoRoot, outPath, text, { dryRun: true })
  if (preflight.kind === 'conflict') {
    return {
      ok: false,
      updated: [],
      noops,
      issues: [`archiving "${outPath}" would overwrite different content (existing ${preflight.existingHash} != incoming ${preflight.incomingHash})`],
    }
  }

  if (opts.dryRun) {
    return { ok: true, updated: updates.map((u) => u.record.name), noops, issues: [] }
  }

  if (updates.length > 0) {
    const changed = new Map<string, GenuiCorpusRecord[]>()
    for (const { file } of updates) {
      if (changed.has(file)) continue
      const records = [...(byFile.get(file) ?? [])]
      for (const u of updates.filter((x) => x.file === file)) records[u.index] = u.record
      changed.set(file, records)
    }
    writeGenuiRecordsByFile(repoRoot, changed)
  }

  const outcome = archiveGenuiVerdicts(repoRoot, outPath, text)
  return { ok: true, updated: updates.map((u) => u.record.name), noops, issues: [], archiveOutcome: outcome.kind }
}
