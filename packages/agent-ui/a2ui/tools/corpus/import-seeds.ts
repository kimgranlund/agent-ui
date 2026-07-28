// import-seeds.ts — the ADR-0055 seed-import script (corpus LLD-C14).
//
// Maps every ExampleSeed on the shelf (`src/examples/`) onto a candidate `CorpusRecord` per ADR-0055's
// pre-alignment (LLD §3 "Seed pre-alignment") and runs it through `admit()` — the corpus's SINGLE
// write path (LLD §2 invariant iv; ADR-0055 clause 2, "the single write path holds"). Run via Node
// type-stripping from the repo root:
//
//   node --experimental-strip-types packages/agent-ui/a2ui/tools/corpus/import-seeds.ts
//   node --experimental-strip-types packages/agent-ui/a2ui/tools/corpus/import-seeds.ts --verdicts <path>
//   node --experimental-strip-types packages/agent-ui/a2ui/tools/corpus/import-seeds.ts --verdicts <path> --replace <name>
//   node --experimental-strip-types packages/agent-ui/a2ui/tools/corpus/import-seeds.ts --dry-run
//   node --experimental-strip-types packages/agent-ui/a2ui/tools/corpus/import-seeds.ts --help
//
// (`erasableSyntaxOnly` in the repo tsconfig guarantees this source strips cleanly — ADR-0062.)
// Idempotent: a re-run's candidates collide (exact canonical hash) with their own prior record and are
// reported as already-present, not written again. A near/exact duplicate between two DISTINCT seeds
// HALTS the run for a human ruling (LLD §5/§8 "seed near-dup at import" — never silent-skip). Collision
// identity is read directly off `AdmitResult.collidesWith` (SPEC §5.2's typed contract, realized).
//
// `--verdicts <path>` (ADR-0068 clause 2/3): wires `createVerdictJudge(parseVerdictsFile(...))` into
// `deps.judge` — every candidate this run must be judged, or `admit()`'s judge throws and this script
// reports + halts (the θ_dup halt precedent, never a silent unjudged admit into a judged-era corpus).
// Quarantine survivability (ADR-0068 clause 5): dedup warming now enumerates quarantined records too
// (a plain re-import of an identical seed hits `E_DUP` against its quarantined predecessor rather than
// re-admitting it), and a candidate that clears dedup whose NAME matches a stored QUARANTINED record
// HALTS with nothing written. `--replace <name>` is the sanctioned exit: a deliberate, judged
// re-admission of that one seed, with its predecessor's dedup signatures omitted from warming for this
// run only (an improved seed is near-identical to its predecessor BY CONSTRUCTION).
//
// TKT-0022 cl.1: a batch's collected non-`E_DUP` rejections split into two reporting/abort lanes via
// `../../src/corpus/import-report.ts` — `E_QUALITY` joins `E_DUP`'s own established non-aborting
// `alreadyPresent` lane rather than blocking the whole run, because the rubric itself frames a below-bar
// score as a NORMAL, anticipated admission outcome ("Below-bar on admission → reject `E_QUALITY`",
// `a2ui-corpus.md`); every other rejection code still hard-aborts (nothing written, even for candidates
// that themselves passed) exactly as before — this is a realized-tool decision, not an ADR-0060/0068 edit.
//
// GH #335 defect 1 — the unjudged-run disposition guard, NARROWED not closed: an `E_QUALITY` reject at
// ADMISSION time is never written (`admit.ts` stage 10 — the LLD §6 asymmetry: "a candidate can be
// refused entry" leaves no trace in the store or the dedup index), so a plain run with no `--verdicts`
// had nothing to remember a prior rejection by and silently re-admitted it, reporting a clean
// "0 quality-rejected" result. The durable home for that outcome already existed —
// `admission-coverage.test.ts`'s `DISPOSITION_ALLOWLIST` — it was just siloed inside a test file this
// script never read. Moved to `../../src/corpus/disposition-allowlist.ts` (a pure, zero-dep module both
// files import) and consulted by `dispositionGuard` below: an UNJUDGED run whose candidate name carries
// a RECORDED disposition and was never actually admitted HALTS loudly before `admit()` even runs,
// nothing written. A `--verdicts` run needs no such guard — `createVerdictJudge` already fails closed on
// every not-yet-admitted candidate absent from the verdicts file (ADR-0068 clause 2), disposition-
// allowlisted or not — so this change touches ONLY the previously-unguarded unjudged path and does not
// alter ADR-0068's judge/verdict/quarantine contract in any way.
//
// STILL OPEN (review finding, not yet closed): this only protects a name ALREADY in the allowlist. A
// judged run that rejects a NEW candidate Y tomorrow prints Y in the quality-rejected lane and exits 0
// with Y recorded nowhere durable; the next unjudged run silently admits it — defect 1, verbatim, for
// any name that hasn't been hand-transcribed yet. Worse, `admission-coverage.test.ts`'s own
// `seedsMissingAdmission` gate only reds while Y is BOTH un-admitted and un-allowlisted — the moment the
// unjudged run admits Y, that gate goes green again, so nothing catches the miss after the fact either.
// The quality-rejected report below (search "GH #335 — the paste-ready" further down) removes the
// hand-transcription STEP by emitting a ready-to-paste `DISPOSITION_ALLOWLIST` entry, but a human still
// has to actually paste it before the next unjudged run — closing this for real needs a machine-enforced
// link between a judged rejection and the next run's dedup/guard state, which is bigger than this fix and
// not something to invent inline (ADR territory — filed for the host to route, not solved here).
//
// GH #335 defect 2 — an unrecognized flag used to be silently ignored and the tool proceeded to a real
// mutating run (`import-seeds.ts --help` wrote to the corpus, discovered live). `parseArgs` now returns
// a discriminated `ParsedArgs`: any unrecognized argument is a hard error (non-zero exit, nothing read
// past arg-parsing, nothing written); `--help`/`-h` prints real usage and exits before any fs work.
// `--dry-run` runs the full pipeline (dedup, judge, quality gate) and reports exactly what a real run
// would do, without the final `saveStore()` — a safe way to preview any invocation, including one that
// would otherwise be a typo away from mutating the corpus.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadStore, saveStore } from './fs-store.ts'
import { createDedupIndex, minHashSignature } from '../../src/corpus/dedup.ts'
import type { DedupIndex } from '../../src/corpus/dedup.ts'
import { canonicalize } from '../../src/corpus/canonical.ts'
import { admit } from '../../src/corpus/admit.ts'
import type { AdmitDeps, AdmitResult } from '../../src/corpus/admit.ts'
import type { CorpusStore } from '../../src/corpus/store.ts'
import { createVerdictJudge, parseVerdictsFile, UnjudgedCandidateError } from '../../src/corpus/judge.ts'
import { classifyRejections, shouldAbort } from '../../src/corpus/import-report.ts'
import type { SeedRejection } from '../../src/corpus/import-report.ts'
import { DISPOSITION_ALLOWLIST } from '../../src/corpus/disposition-allowlist.ts'
import { loadCatalog } from '../../src/catalog/catalog.ts'
import type { Catalog } from '../../src/catalog/catalog.ts'
import type { ExampleSeed } from '../../src/examples/types.ts'
import { canvasButtonSeed } from '../../src/examples/canvas-button.ts'
import { listDisplaySeed, listPeopleSeed, listFormSeed, listNestedSeed } from '../../src/examples/dynamic-lists.ts'
import { generativeFormSeed } from '../../src/examples/generative-form.ts'
import {
  patternSettingsSeed,
  patternConfirmSeed,
  patternWizardSeed,
  patternDashboardSeed,
  patternScheduleSeed,
} from '../../src/examples/patterns.ts'
import {
  bookingReservationSeed,
  rentalFilterPanelSeed,
  documentRowToolbarSeed,
  statsGridDashboardSeed,
  reportCardDashboardSeed,
  opsReportSeed,
  deploymentReportSeed,
  agentTaskStatusSeed,
  brandPaletteSeed,
  colorPickerFormSeed,
} from '../../src/examples/catalog-coverage.ts'
import { kpiPanelLifecycleSeed } from '../../src/examples/message-lifecycle.ts'
import { feedbackFormSeed, elevationScaleSeed, triviaRoundResumeSeed } from '../../src/examples/corpus-growth.ts'
import { allSeeds } from '../../src/examples/index.ts'

declare const process: { cwd(): string; argv: string[]; exit(code?: number): never }
declare const console: { log(...args: unknown[]): void; error(...args: unknown[]): void }

// The estate's rubric home — `a2ui-corpus.md` carries the explicit `version:` marker every verdicts
// file's `rubricVersion` MUST cite (ADR-0068 clause 1, SPEC-R3). Duplicated in `rescore.ts` rather than
// factored out — each Node shell independently owns "where the rubric doc lives", the same split
// `CORPUS_DATA_DIR` draws between `store.ts` and `fs-store.ts` (ADR-0062).
const RUBRIC_PATH = '.claude/docs/rubrics/a2ui-corpus.md'

function readRubricVersion(repoRoot: string): string {
  let text: string
  try {
    text = readFileSync(join(repoRoot, RUBRIC_PATH), 'utf8') as string
  } catch {
    console.error(`import-seeds: could not read ${RUBRIC_PATH} — the rubric document must exist and carry a "version:" marker.`)
    process.exit(1)
  }
  const match = text.match(/^version:\s*(\S+)\s*$/m)
  if (!match) {
    console.error(`import-seeds: ${RUBRIC_PATH} carries no "version:" marker (ADR-0068 clause 1) — cannot validate the verdicts file.`)
    process.exit(1)
  }
  return match[1]!
}

const HELP_TEXT = `import-seeds — the ADR-0055 seed-import script (corpus LLD-C14)

Maps every seed on the example shelf (src/examples/) onto a candidate CorpusRecord and runs it
through admit() — the corpus's single write path.

Usage:
  node --experimental-strip-types packages/agent-ui/a2ui/tools/corpus/import-seeds.ts [options]

Options:
  --verdicts <path>   Wire a critic-authored VerdictsFile (ADR-0068) in as the tier-2 judge. With a
                       judge wired, every not-yet-admitted candidate must be judged, or the run
                       reports + halts with nothing written.
  --replace <name>    The sanctioned re-admission of a quarantined record's improved seed
                       (ADR-0068 clause 5c). Requires --verdicts.
  --dry-run           Run the full pipeline (dedup, judge, quality gate) and report exactly what a
                       real run would do, without writing the store.
  --help, -h          Print this help and exit. Reads and writes nothing.

An unrecognized argument is a hard error: non-zero exit, nothing written (GH #335).`

export type ParsedArgs =
  | { kind: 'help' }
  | { kind: 'error'; message: string }
  | { kind: 'run'; verdictsPath?: string; replaceName?: string; dryRun: boolean }

/** GH #335 defect 2: an unrecognized argument used to be silently dropped and the tool proceeded to a
 * real mutating run — `import-seeds.ts --help` wrote to the corpus. Every argument is now accounted
 * for: known flags are consumed, anything else is `{ kind: 'error' }` (the caller hard-stops before any
 * fs work), and `--help`/`-h` short-circuits to `{ kind: 'help' }` before either. */
export function parseArgs(argv: string[]): ParsedArgs {
  let verdictsPath: string | undefined
  let replaceName: string | undefined
  let dryRun = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === '--help' || arg === '-h') return { kind: 'help' }
    if (arg === '--verdicts') {
      const value = argv[++i]
      if (value === undefined) return { kind: 'error', message: '--verdicts requires a <path> argument' }
      verdictsPath = value
      continue
    }
    if (arg === '--replace') {
      const value = argv[++i]
      if (value === undefined) return { kind: 'error', message: '--replace requires a <name> argument' }
      replaceName = value
      continue
    }
    if (arg === '--dry-run') {
      dryRun = true
      continue
    }
    return { kind: 'error', message: `unrecognized argument "${arg}"` }
  }
  return { kind: 'run', verdictsPath, replaceName, dryRun }
}

// `ExampleSeed` carries no "which file declared me" field (that's a static-authoring fact, not
// runtime data) — so the ADR-0055 `origin: 'src/examples/<module>.ts'` mapping is transcribed here,
// grouped exactly as `src/examples/index.ts` groups its own re-exports. `checkGrouping` below proves
// this transcription hasn't drifted from the shelf's actual `allSeeds` list.
const SEEDS_BY_MODULE: ReadonlyArray<{ module: string; seeds: readonly ExampleSeed[] }> = [
  { module: 'canvas-button.ts', seeds: [canvasButtonSeed] },
  { module: 'dynamic-lists.ts', seeds: [listDisplaySeed, listPeopleSeed, listFormSeed, listNestedSeed] },
  { module: 'generative-form.ts', seeds: [generativeFormSeed] },
  {
    module: 'patterns.ts',
    seeds: [patternSettingsSeed, patternConfirmSeed, patternWizardSeed, patternDashboardSeed, patternScheduleSeed],
  },
  {
    module: 'catalog-coverage.ts',
    seeds: [
      bookingReservationSeed,
      rentalFilterPanelSeed,
      documentRowToolbarSeed,
      statsGridDashboardSeed,
      reportCardDashboardSeed,
      opsReportSeed,
      deploymentReportSeed,
      agentTaskStatusSeed,
      brandPaletteSeed,
      colorPickerFormSeed,
    ],
  },
  { module: 'message-lifecycle.ts', seeds: [kpiPanelLifecycleSeed] },
  {
    module: 'corpus-growth.ts',
    seeds: [feedbackFormSeed, elevationScaleSeed, triviaRoundResumeSeed],
  },
]

/** Fail loudly (not silently) if the shelf's seed count/membership ever drifts from this script's
 * hand-transcribed per-file grouping — e.g. a new seed added to `index.ts` without updating this file. */
function checkGrouping(): void {
  const grouped = SEEDS_BY_MODULE.flatMap((g) => g.seeds)
  const groupedNames = new Set(grouped.map((s) => s.name))
  const shelfNames = new Set(allSeeds.map((s) => s.name))
  const sameSize = grouped.length === allSeeds.length
  const sameMembers = groupedNames.size === shelfNames.size && [...groupedNames].every((n) => shelfNames.has(n))
  if (!sameSize || !sameMembers) {
    console.error(
      `import-seeds: SEEDS_BY_MODULE (${grouped.length}: ${[...groupedNames].join(', ')}) has drifted from ` +
        `src/examples/index.ts's allSeeds (${allSeeds.length}: ${[...shelfNames].join(', ')}). ` +
        'Update the per-file grouping in this script before importing.',
    )
    process.exit(1)
  }
}

/** ADR-0055's seed→candidate mapping (LLD §3): the first four `ExampleSeed` fields map onto
 * `CorpusRecord` verbatim; `messages` becomes `a2uiOutput`; `protocolVersion`/`catalogId` become the
 * `meta` pins; `surfaceId` is dropped (it lives inside every message already). `meta.status` is left
 * for `admit()` to set — it always recomputes and overwrites it (never trust a caller-supplied value). */
function seedToCandidate(seed: ExampleSeed, moduleFile: string): unknown {
  return {
    name: seed.name,
    description: seed.description,
    promptText: seed.promptText,
    a2uiOutput: seed.messages,
    meta: {
      facet: 'exemplar',
      protocolVersion: seed.protocolVersion,
      catalogId: seed.catalogId,
      provenance: { source: 'authored', origin: `src/examples/${moduleFile}` },
    },
  }
}

/**
 * Warm a fresh `DedupIndex` with every record ALREADY in the loaded store. `admit()`'s dedup stage
 * only ever sees what THIS run adds via its own write stage — a bare `createDedupIndex()` starts
 * blank, so without this, a second script invocation would find no collisions and silently re-admit
 * (upsert) every seed instead of correctly rejecting them as `E_DUP`. Recomputes each existing
 * record's MinHash signature via the EXACT recipe `admit.ts` itself uses
 * (`` `${promptText} ${canonical.serialized}` ``) so a warmed signature is bit-for-bit what `admit()`
 * would have produced — the signature isn't persisted on the record, only `canonicalHash` is.
 *
 * Enumerates WITH `includeQuarantined: true` (ADR-0068 clause 5a, the M1 fix): a quarantined record's
 * signatures must be warmed too, or a plain re-import of an identical seed would find no collision and
 * silently re-admit it unjudged, erasing the quarantine. `excludeName` (the `--replace <name>` case,
 * clause 5c) omits ONE record's own signatures from warming — the record being replaced is
 * near-identical to its predecessor BY CONSTRUCTION, so warming it would falsely self-collide.
 */
async function warmDedupIndex(store: CorpusStore, dedupIndex: DedupIndex, excludeName?: string): Promise<void> {
  for (const rec of store.all({ includeQuarantined: true })) {
    if (rec.name === excludeName) continue
    if (rec.meta.canonicalHash !== undefined) dedupIndex.addExact(rec.name, rec.meta.canonicalHash)
    if (rec.a2uiOutput !== undefined) {
      const canonical = await canonicalize(rec.a2uiOutput)
      dedupIndex.addSignature(rec.name, minHashSignature(`${rec.promptText} ${canonical.serialized}`))
    }
  }
}

/**
 * GH #335 defect 1: an unjudged run (`verdictsPath` absent) must never silently re-admit a candidate
 * whose name carries a recorded prior `E_QUALITY` rejection (`DISPOSITION_ALLOWLIST` —
 * `../../src/corpus/disposition-allowlist.ts`). Admission-time `E_QUALITY` rejects are never written
 * to the store (`admit.ts` stage 10 — LLD §6's asymmetry: "a candidate can be refused entry" leaves no
 * trace in the shard or the dedup index), so without this guard nothing remembers the refusal and a
 * plain re-run silently reverses it.
 *
 * Applies ONLY when: (a) no judge is wired — a `--verdicts` run already fails closed on every
 * not-yet-admitted candidate absent from the verdicts file via `createVerdictJudge`'s throw (ADR-0068
 * clause 2), disposition-allowlisted or not, so it needs no separate guard here; (b) the candidate has
 * never actually been admitted (`alreadyAdmitted`) — an idempotent re-run of a record that WAS admitted
 * is untouched, exactly as before (the ordinary `E_DUP` path handles it).
 *
 * Returns the halt message to print (the caller reports it and exits non-zero, nothing written), or
 * `undefined` when the run may proceed normally.
 */
export function dispositionGuard(seedName: string, verdictsPath: string | undefined, alreadyAdmitted: boolean): string | undefined {
  if (verdictsPath !== undefined || alreadyAdmitted) return undefined
  const disposition = DISPOSITION_ALLOWLIST.get(seedName)
  if (disposition === undefined) return undefined
  return (
    `import-seeds: HALTED — "${seedName}" carries a recorded prior quality rejection (${disposition}). ` +
    'An unjudged run cannot silently re-admit a dispositioned candidate; re-run with --verdicts to have ' +
    'it judged fresh. Nothing was written.'
  )
}

interface ImportReport {
  admitted: string[]
  alreadyPresent: string[]
  /** Every non-`E_DUP` rejection collected this run — classified into the abort/non-abort lanes
   *  AFTER the loop completes (TKT-0022 cl.1, `../../src/corpus/import-report.ts`). */
  rejections: SeedRejection[]
  /** `--dry-run` only (GH #335 review item 3): names `dispositionGuard` would have HALTED a real run on
   *  — reported as a warning line instead, so a dry run finishes and still tells the truth about what a
   *  real run would do (nothing admitted, nothing written, for exactly these names). */
  dispositionWarnings: string[]
}

/** The critic-authored metadata a `--verdicts` run's judge carries (ADR-0068's `VerdictsFile`) — kept
 * around past the parse step ONLY so the quality-rejected report (GH #335 review item 2) can emit a
 * paste-ready `DISPOSITION_ALLOWLIST` entry citing the real rubric version/judge/date this run used,
 * instead of a human re-typing them from the run's console output. */
export interface VerdictMeta {
  rubricVersion: string
  judgedBy: string
  date: string
}

/**
 * GH #335 review item 2's "cheap half": a `DISPOSITION_ALLOWLIST` entry the run already has every fact
 * for, formatted exactly as a `Map` literal entry so it can be pasted straight into
 * `src/corpus/disposition-allowlist.ts`. This does NOT close the class the disposition guard only
 * narrows (see the defect-1 header comment) — it removes the hand-transcription step, nothing more; a
 * human still has to actually paste it before the next unjudged run.
 */
export function dispositionAllowlistSnippet(q: SeedRejection, meta: VerdictMeta): string {
  const dims = q.failingDimensions !== undefined && q.failingDimensions.length > 0 ? q.failingDimensions.join(', ') : '(none reported)'
  const reason =
    `judged E_QUALITY ${meta.date} (VerdictsFile, rubric a2ui-corpus ${meta.rubricVersion} — ${meta.judgedBy}). ` +
    `${q.message}. Failing dimensions: ${dims}. Record this before the next unjudged run (GH #335) — an ` +
    'unjudged run will otherwise silently re-admit it.'
  return `  ['${q.name}', ${JSON.stringify(reason)}],`
}

/** The `--replace <name>` sanctioned exit's audit trail (ADR-0068 clause 5c): the prior record's
 * status + canonicalHash, captured BEFORE admission overwrites it — `status` on the NEW record is
 * always recomputed honestly by `admit()` itself (valid/repaired from heal's real `changed` fact),
 * never copied from here. */
interface ReplacedInfo {
  name: string
  priorStatus: string
  priorCanonicalHash?: string
}

/**
 * Load the agent-ui default catalog WITHOUT importing `catalog/default/index.ts` (which does a bare
 * `import catalogDoc from './catalog.json'` — fine under the bundler/Vitest module resolution the rest
 * of the package uses, but Node's native ESM loader rejects an attribute-less JSON import outright:
 * `ERR_IMPORT_ATTRIBUTE_MISSING`, hit running this script under `--experimental-strip-types`). This
 * script is Node-side by definition (ADR-0062), so it reads the same `catalog.json` via `fs` and feeds
 * it through the SAME exported `loadCatalog()` — byte-identical to `defaultCatalog`, just assembled
 * without an ES-module JSON import in the way.
 */
function loadDefaultCatalog(repoRoot: string): Catalog {
  const path = join(repoRoot, 'packages/agent-ui/a2ui/src/catalog/default/catalog.json')
  const doc: unknown = JSON.parse(readFileSync(path, 'utf8') as string)
  return loadCatalog(doc)
}

async function main(): Promise<void> {
  // Argument parsing happens BEFORE any other work (GH #335 defect 2) — `--help` and an unrecognized
  // argument both exit here, before `checkGrouping()`/`loadStore()`/anything that touches the fs.
  const parsed = parseArgs(process.argv.slice(2))
  if (parsed.kind === 'help') {
    console.log(HELP_TEXT)
    return
  }
  if (parsed.kind === 'error') {
    console.error(`import-seeds: ${parsed.message}. Nothing was written.\n`)
    console.error(HELP_TEXT)
    process.exit(1)
  }

  checkGrouping()

  const { verdictsPath, replaceName, dryRun } = parsed
  if (replaceName !== undefined && verdictsPath === undefined) {
    console.error('import-seeds: --replace requires --verdicts — a quarantine exit must be judged (ADR-0068 clause 5c). Nothing was written.')
    process.exit(1)
  }
  const repoRoot = process.cwd()
  const store = loadStore(repoRoot)
  const dedupIndex = createDedupIndex()
  await warmDedupIndex(store, dedupIndex, replaceName)

  const deps: AdmitDeps = { catalog: loadDefaultCatalog(repoRoot), store, dedupIndex }

  // Kept past the parse step ONLY to feed the paste-ready disposition-allowlist snippet at report time
  // (GH #335 review item 2) — the pipeline itself only ever needs `deps.judge`.
  let verdictMeta: VerdictMeta | undefined

  if (verdictsPath !== undefined) {
    const rubricVersion = readRubricVersion(repoRoot)
    const verdictsText = readFileSync(verdictsPath, 'utf8') as string
    const parsedVerdicts = parseVerdictsFile(verdictsText, rubricVersion)
    if (!parsedVerdicts.ok) {
      console.error(`import-seeds: the verdicts file is malformed (${parsedVerdicts.issues.length} issue(s)):`)
      for (const issue of parsedVerdicts.issues) console.error(`  - ${issue.path || '(root)'}: ${issue.message}`)
      console.error('Nothing was written.')
      process.exit(1)
    }
    deps.judge = createVerdictJudge(parsedVerdicts.file)
    verdictMeta = { rubricVersion, judgedBy: parsedVerdicts.file.judgedBy, date: parsedVerdicts.file.date }
  }

  const report: ImportReport = { admitted: [], alreadyPresent: [], rejections: [], dispositionWarnings: [] }
  let replaced: ReplacedInfo | undefined

  for (const group of SEEDS_BY_MODULE) {
    for (const seed of group.seeds) {
      // Captured BEFORE admit() runs — the true prior state, since a name is only ever processed once
      // per run. `store.get()` sees every status (unlike `store.all()`), so this also sees quarantined.
      const existing = store.get(seed.name)
      if (seed.name === replaceName && existing !== undefined) {
        replaced = { name: seed.name, priorStatus: existing.meta.status, priorCanonicalHash: existing.meta.canonicalHash }
      }

      const haltMessage = dispositionGuard(seed.name, verdictsPath, existing !== undefined)
      if (haltMessage !== undefined) {
        // GH #335 review item 3: `--dry-run` writes nothing by construction — the disposition guard's
        // whole purpose — so it must never hard-exit here. Report what a REAL run would do (HALT, admit
        // nothing) as a warning line and move on to the next seed, so the dry run actually finishes.
        if (dryRun) {
          report.dispositionWarnings.push(seed.name)
          console.log(`import-seeds (--dry-run): a real run would HALT here — ${haltMessage}`)
          continue
        }
        console.error(haltMessage)
        process.exit(1)
      }

      const candidate = seedToCandidate(seed, group.module)
      let result: AdmitResult
      try {
        result = await admit(candidate, deps)
      } catch (e) {
        if (e instanceof UnjudgedCandidateError) {
          console.error(`import-seeds: HALTED — ${e.message} (seed "${seed.name}"). Nothing was written.`)
          process.exit(1)
        }
        throw e
      }

      if (result.ok && seed.name !== replaceName && existing !== undefined && existing.meta.status === 'quarantined') {
        // The candidate cleared dedup (its content differs enough from the quarantined predecessor
        // that neither exact nor near dedup caught it) and `admit()` just wrote over it IN MEMORY.
        // Routine imports can never overwrite a quarantined line (ADR-0068 clause 5b) — the sanctioned
        // exit is the explicit, judged `--replace <name>` re-admission. Nothing reaches disk until
        // `saveStore()` below; halting here (before that call) leaves the on-disk shard untouched —
        // this in-memory store is simply discarded with the process.
        console.error(
          `import-seeds: HALTED — "${seed.name}" matches a QUARANTINED record in the store. Routine ` +
            `imports never overwrite a quarantined line; use "--replace ${seed.name}" for the ` +
            'sanctioned, judged re-admission (ADR-0068 clause 5b). Nothing was written.',
        )
        process.exit(1)
      }

      if (result.ok) {
        report.admitted.push(seed.name)
        continue
      }

      if (result.code === 'E_DUP') {
        // `collidesWith` is the typed contract (SPEC §5.2's `AdmitResult` sketch, now realized in
        // `admit.ts`) — populated on both E_DUP flavors (exact + near) with the colliding record's
        // name. The `?? 'unknown'` below is a pure display-string fallback, not a parsing workaround.
        const collidingName = result.collidesWith
        if (collidingName === seed.name) {
          report.alreadyPresent.push(seed.name) // idempotent re-run: matches its OWN prior record
          continue
        }
        // A near/exact duplicate between two DISTINCT seeds — halt for a human ruling (never
        // silent-skip). Nothing is saved: the data dir is left exactly as it was before this run.
        console.error(
          `import-seeds: HALTED — "${seed.name}" collides with a DIFFERENT record ` +
            `("${collidingName ?? 'unknown'}"): ${result.message}\n` +
            'This needs a human ruling (revise/merge one seed, or confirm it is intentional) before ' +
            'the import can proceed. No further seeds were processed; nothing was written.',
        )
        process.exit(1)
      }

      report.rejections.push({
        name: seed.name,
        code: result.code,
        message: result.message,
        paths: result.paths,
        failingDimensions: result.failingDimensions,
      })
    }
  }

  // TKT-0022 cl.1: E_QUALITY joins E_DUP's own non-aborting lane — only a genuine hard-error code
  // (E_SCHEMA/E_CATALOG/E_IDGRAPH/E_POINTER/E_PIN/E_LEAK) still blocks the whole run.
  const { qualityRejected, hardErrors } = classifyRejections(report.rejections)

  if (shouldAbort({ qualityRejected, hardErrors })) {
    console.error(`import-seeds: ${hardErrors.length} seed(s) failed admission for a non-duplicate, non-quality reason:`)
    for (const e of hardErrors) {
      console.error(`  - ${e.name}: ${e.code} — ${e.message}${e.paths ? ` [${e.paths.join(', ')}]` : ''}`)
    }
    console.error('Nothing was written.')
    process.exit(1)
  }

  if (!dryRun) saveStore(repoRoot, store)

  // Three reporting lanes, clearly distinguished with counts (TKT-0022 cl.1): written / already-present
  // (idempotent E_DUP re-run) / quality-rejected (judged below-bar this run, never written). `--dry-run`
  // runs the identical pipeline above and reports the identical counts, just never reaches `saveStore`.
  const prefix = dryRun ? 'import-seeds (--dry-run, nothing written): ' : 'import-seeds: '
  console.log(
    `${prefix}${report.admitted.length} admitted, ${report.alreadyPresent.length} already present ` +
      `(E_DUP, idempotent), ${qualityRejected.length} quality-rejected (E_QUALITY, not written).`,
  )
  if (report.admitted.length > 0) console.log(`  admitted: ${report.admitted.join(', ')}`)
  if (report.alreadyPresent.length > 0) console.log(`  already present: ${report.alreadyPresent.join(', ')}`)
  if (qualityRejected.length > 0) {
    for (const q of qualityRejected) {
      console.log(`  quality-rejected: "${q.name}" — ${q.message}${q.failingDimensions ? ` [failing: ${q.failingDimensions.join(', ')}]` : ''}`)
    }
    // GH #335 — the paste-ready disposition-allowlist entry: this does NOT close the "narrowed, not
    // closed" gap the defect-1 header comment names (a human still has to actually paste these before the
    // next unjudged run) — it only removes the hand-transcription step that makes forgetting the default.
    if (verdictMeta !== undefined) {
      console.log(
        '  record these in src/corpus/disposition-allowlist.ts before the next unjudged run, or it will ' +
          'silently re-admit them (GH #335) — paste-ready entries:',
      )
      for (const q of qualityRejected) console.log(dispositionAllowlistSnippet(q, verdictMeta))
    }
  }
  if (report.dispositionWarnings.length > 0) {
    console.log(`  would HALT on a real run (--dry-run only, disposition-allowlisted): ${report.dispositionWarnings.join(', ')}`)
  }
  if (replaced !== undefined) {
    console.log(`  replaced: "${replaced.name}" (prior status: ${replaced.priorStatus}, prior canonicalHash: ${replaced.priorCanonicalHash ?? 'none'})`)
  }
}

// ── CLI entry — only runs when this file is executed directly (`node --experimental-strip-types
// tools/corpus/import-seeds.ts`), never when a test imports `parseArgs`/`dispositionGuard` from it
// (the `scripts/build-dogfood-assets.mjs` CLI-entry-guard precedent: checked against `process.argv[1]`'s
// basename, not `import.meta.url`, since a jsdom-environment vitest import hands this module no real
// `file://` URL — that file's own comment names the identical gap). Without this guard, a test file
// merely IMPORTING this module for `parseArgs`/`dispositionGuard` would trigger a real, unguarded
// `main()` run against the real corpus on disk — the exact stray-mutation shape GH #335 is about. ──
if (process.argv[1]?.endsWith('import-seeds.ts')) {
  main().catch((e: unknown) => {
    console.error('import-seeds: unexpected failure', e)
    process.exit(1)
  })
} else {
  // GH #335 review item 4: a guard that does nothing and exits 0 is the wrong shape — invoked through a
  // symlink named anything other than `import-seeds.ts` (a real, if unusual, way to reach this file),
  // the CLI-entry check above silently fails and the process exits 0 having done nothing at all,
  // including printing `--help`. One line, loudly, so that's never mistaken for success.
  console.error(`import-seeds: loaded as "${process.argv[1] ?? '(unknown)'}" — not invoked as import-seeds.ts, so main() did not run. Invoke this file directly.`)
}
