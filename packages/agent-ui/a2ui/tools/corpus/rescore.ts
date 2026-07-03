// rescore.ts — the ADR-0068 back-scoring shell (corpus LLD-C8 clause 4, build slice h11).
//
// Applies a critic-authored verdicts file (SPEC §5.3) to already-admitted, UNJUDGED records in the
// committed shard: at/above the corpus-quality bar -> `meta.qualityScore`; below bar ->
// `status:"quarantined"` (SPEC-R13, ONE-WAY under rescore — the only exit from quarantine is the
// judged `import-seeds --replace` re-admission, ADR-0068 clause 5c). Applies ONLY to records with no
// prior judged outcome (`qualityScore` absent AND `status !== "quarantined"`): an unknown name or a
// DIFFERENT verdict for an already-judged name halts the WHOLE run before any write (all-or-nothing —
// the whole file is validated and every update computed before the one `serialize()` call); an
// IDENTICAL verdict for an already-judged name is a no-op. Records not named in the file are left
// untouched and reported still-unjudged (rescore is deliberately partial, ADR-0068 clause 4).
//
// Run via Node type-stripping from the repo root:
//
//   node --experimental-strip-types packages/agent-ui/a2ui/tools/corpus/rescore.ts --verdicts <path>
//
// (`erasableSyntaxOnly` in the repo tsconfig guarantees this source strips cleanly — ADR-0062.)

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadStore, saveStore } from './fs-store.ts'
import { parseVerdictsFile } from '../../src/corpus/judge.ts'
import type { JudgeVerdict } from '../../src/corpus/admit.ts'
import type { CorpusRecord } from '../../src/corpus/record.ts'

declare const process: { cwd(): string; argv: string[]; exit(code?: number): never }
declare const console: { log(...args: unknown[]): void; error(...args: unknown[]): void }

// The estate's rubric home (LLD §0 correction) — `a2ui-corpus.md` carries the explicit `version:`
// marker every verdicts file's `rubricVersion` MUST cite (ADR-0068 clause 1, SPEC-R3). This shell
// reads it; `parseVerdictsFile` (the pure core) never touches the filesystem itself (ADR-0062).
const RUBRIC_PATH = '.claude/docs/rubrics/a2ui-corpus.md'

/** Read the rubric document's `version:` marker (a `version: <value>` line, anywhere in the file —
 * frontmatter or body). Halts with a clear message if the doc is missing or carries no marker. */
function readRubricVersion(repoRoot: string): string {
  let text: string
  try {
    text = readFileSync(join(repoRoot, RUBRIC_PATH), 'utf8') as string
  } catch {
    console.error(`rescore: could not read ${RUBRIC_PATH} — the rubric document must exist and carry a "version:" marker.`)
    process.exit(1)
  }
  const match = text.match(/^version:\s*(\S+)\s*$/m)
  if (!match) {
    console.error(`rescore: ${RUBRIC_PATH} carries no "version:" marker (ADR-0068 clause 1) — cannot validate the verdicts file.`)
    process.exit(1)
  }
  return match[1]!
}

function parseArgs(argv: string[]): { verdictsPath: string } {
  const flagIndex = argv.indexOf('--verdicts')
  const value = flagIndex === -1 ? undefined : argv[flagIndex + 1]
  if (value === undefined) {
    console.error('rescore: usage: rescore.ts --verdicts <path>')
    process.exit(1)
  }
  return { verdictsPath: value }
}

/** A record already carries a judged outcome — a passed record's `qualityScore`, or a failed record's
 * `status:"quarantined"` — and is therefore OUT of scope for a fresh rescore pass over it (ADR-0068
 * clause 4: rescore applies only to records with no prior judged outcome). */
function isAlreadyJudged(rec: CorpusRecord): boolean {
  return rec.meta.qualityScore !== undefined || rec.meta.status === 'quarantined'
}

/** Whether a NEW verdict for an already-judged record reproduces its CURRENT recorded outcome — the
 * idempotence check (ADR-0068 clause 4: "an identical verdict -> no-op"). A quarantined record never
 * persisted its failing score, so any verdict that still fails matches it; a scored record persisted
 * its exact `qualityScore`, so only a byte-identical passing score matches. Anything else is a
 * CONFLICTING re-verdict — halt (a re-judge is the deliberate `--replace` path, never a drive-by). */
function verdictMatchesCurrent(rec: CorpusRecord, verdict: JudgeVerdict): boolean {
  if (rec.meta.status === 'quarantined') return verdict.passed === false
  return verdict.passed === true && verdict.qualityScore === rec.meta.qualityScore
}

async function main(): Promise<void> {
  const { verdictsPath } = parseArgs(process.argv.slice(2))
  const repoRoot = process.cwd()

  const rubricVersion = readRubricVersion(repoRoot)
  const verdictsText = readFileSync(verdictsPath, 'utf8') as string
  const parsed = parseVerdictsFile(verdictsText, rubricVersion)
  if (!parsed.ok) {
    console.error(`rescore: the verdicts file is malformed (${parsed.issues.length} issue(s)):`)
    for (const issue of parsed.issues) console.error(`  - ${issue.path || '(root)'}: ${issue.message}`)
    console.error('Nothing was written.')
    process.exit(1)
  }

  const store = loadStore(repoRoot)
  const allRecords = store.all({ includeQuarantined: true })

  // Pass 1 — validate + compute EVERY update before touching the store (all-or-nothing, ADR-0068
  // clause 4). `issues` collects every unknown-name/conflicting-verdict finding across the WHOLE file
  // (never short-circuits at the first) so a mid-file failure is reported completely.
  const updates: Array<{ name: string; record: CorpusRecord }> = []
  const noops: string[] = []
  const issues: string[] = []

  for (const [name, verdict] of Object.entries(parsed.file.verdicts)) {
    const rec = store.get(name)
    if (rec === undefined) {
      issues.push(`"${name}": no record with this name exists in the store`)
      continue
    }
    if (isAlreadyJudged(rec)) {
      if (verdictMatchesCurrent(rec, verdict)) {
        noops.push(name)
      } else {
        issues.push(
          `"${name}": a DIFFERENT verdict was submitted for an already-judged record — a re-judge requires ` +
            'the explicit "import-seeds --replace" re-admission (ADR-0068 clause 5c), never a rescore overwrite',
        )
      }
      continue
    }
    const updated: CorpusRecord = verdict.passed
      ? { ...rec, meta: { ...rec.meta, qualityScore: verdict.qualityScore } }
      : { ...rec, meta: { ...rec.meta, status: 'quarantined' } }
    updates.push({ name, record: updated })
  }

  if (issues.length > 0) {
    console.error(`rescore: HALTED — ${issues.length} issue(s):`)
    for (const issue of issues) console.error(`  - ${issue}`)
    console.error('Nothing was written.')
    process.exit(1)
  }

  const stillUnjudged = allRecords.filter((r) => !isAlreadyJudged(r) && parsed.file.verdicts[r.name] === undefined).map((r) => r.name)

  // Pass 2 — nothing to apply: skip the write entirely (a stronger, simpler proof of the byte-level
  // no-op than re-serializing unchanged content would be).
  if (updates.length === 0) {
    console.log(`rescore: 0 update(s), ${noops.length} no-op(s) (already judged, matching), ${stillUnjudged.length} still unjudged.`)
    if (stillUnjudged.length > 0) console.log(`  still unjudged: ${stillUnjudged.join(', ')}`)
    return
  }

  for (const { record } of updates) store.put(record)
  saveStore(repoRoot, store)

  const scoredNow = updates.filter((u) => u.record.meta.qualityScore !== undefined).map((u) => u.name)
  const quarantinedNow = updates.filter((u) => u.record.meta.status === 'quarantined').map((u) => u.name)
  console.log(
    `rescore: ${updates.length} update(s) written (${scoredNow.length} scored, ${quarantinedNow.length} quarantined), ` +
      `${noops.length} no-op(s), ${stillUnjudged.length} still unjudged.`,
  )
  if (scoredNow.length > 0) console.log(`  scored: ${scoredNow.join(', ')}`)
  if (quarantinedNow.length > 0) console.log(`  quarantined: ${quarantinedNow.join(', ')}`)
  if (stillUnjudged.length > 0) console.log(`  still unjudged: ${stillUnjudged.join(', ')}`)
}

main().catch((e: unknown) => {
  console.error('rescore: unexpected failure', e)
  process.exit(1)
})
