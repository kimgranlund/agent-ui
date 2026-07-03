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

interface CliArgs {
  verdictsPath?: string
  replaceName?: string
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--verdicts') args.verdictsPath = argv[++i]
    else if (argv[i] === '--replace') args.replaceName = argv[++i]
  }
  return args
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

interface ImportReport {
  admitted: string[]
  alreadyPresent: string[]
  errors: Array<{ name: string; code: string; message: string; paths?: string[] }>
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
  checkGrouping()

  const { verdictsPath, replaceName } = parseArgs(process.argv.slice(2))
  if (replaceName !== undefined && verdictsPath === undefined) {
    console.error('import-seeds: --replace requires --verdicts — a quarantine exit must be judged (ADR-0068 clause 5c). Nothing was written.')
    process.exit(1)
  }
  const repoRoot = process.cwd()
  const store = loadStore(repoRoot)
  const dedupIndex = createDedupIndex()
  await warmDedupIndex(store, dedupIndex, replaceName)

  const deps: AdmitDeps = { catalog: loadDefaultCatalog(repoRoot), store, dedupIndex }

  if (verdictsPath !== undefined) {
    const rubricVersion = readRubricVersion(repoRoot)
    const verdictsText = readFileSync(verdictsPath, 'utf8') as string
    const parsed = parseVerdictsFile(verdictsText, rubricVersion)
    if (!parsed.ok) {
      console.error(`import-seeds: the verdicts file is malformed (${parsed.issues.length} issue(s)):`)
      for (const issue of parsed.issues) console.error(`  - ${issue.path || '(root)'}: ${issue.message}`)
      console.error('Nothing was written.')
      process.exit(1)
    }
    deps.judge = createVerdictJudge(parsed.file)
  }

  const report: ImportReport = { admitted: [], alreadyPresent: [], errors: [] }
  let replaced: ReplacedInfo | undefined

  for (const group of SEEDS_BY_MODULE) {
    for (const seed of group.seeds) {
      // Captured BEFORE admit() runs — the true prior state, since a name is only ever processed once
      // per run. `store.get()` sees every status (unlike `store.all()`), so this also sees quarantined.
      const existing = store.get(seed.name)
      if (seed.name === replaceName && existing !== undefined) {
        replaced = { name: seed.name, priorStatus: existing.meta.status, priorCanonicalHash: existing.meta.canonicalHash }
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

      report.errors.push({ name: seed.name, code: result.code, message: result.message, paths: result.paths })
    }
  }

  if (report.errors.length > 0) {
    console.error(`import-seeds: ${report.errors.length} seed(s) failed admission for a non-duplicate reason:`)
    for (const e of report.errors) {
      console.error(`  - ${e.name}: ${e.code} — ${e.message}${e.paths ? ` [${e.paths.join(', ')}]` : ''}`)
    }
    console.error('Nothing was written.')
    process.exit(1)
  }

  saveStore(repoRoot, store)

  console.log(
    `import-seeds: ${report.admitted.length} admitted, ${report.alreadyPresent.length} already present ` +
      `(E_DUP, idempotent), 0 errors.`,
  )
  if (report.admitted.length > 0) console.log(`  admitted: ${report.admitted.join(', ')}`)
  if (report.alreadyPresent.length > 0) console.log(`  already present: ${report.alreadyPresent.join(', ')}`)
  if (replaced !== undefined) {
    console.log(`  replaced: "${replaced.name}" (prior status: ${replaced.priorStatus}, prior canonicalHash: ${replaced.priorCanonicalHash ?? 'none'})`)
  }
}

main().catch((e: unknown) => {
  console.error('import-seeds: unexpected failure', e)
  process.exit(1)
})
