// import-seeds.ts — the ADR-0055 seed-import script (corpus LLD-C14).
//
// Maps every ExampleSeed on the shelf (`src/examples/`) onto a candidate `CorpusRecord` per ADR-0055's
// pre-alignment (LLD §3 "Seed pre-alignment") and runs it through `admit()` — the corpus's SINGLE
// write path (LLD §2 invariant iv; ADR-0055 clause 2, "the single write path holds"). Run via Node
// type-stripping from the repo root:
//
//   node --experimental-strip-types packages/agent-ui/a2ui/tools/corpus/import-seeds.ts
//
// (`erasableSyntaxOnly` in the repo tsconfig guarantees this source strips cleanly — ADR-0062.)
// Idempotent: a re-run's candidates collide (exact canonical hash) with their own prior record and are
// reported as already-present, not written again. A near/exact duplicate between two DISTINCT seeds
// HALTS the run for a human ruling (LLD §5/§8 "seed near-dup at import" — never silent-skip). Collision
// identity is read directly off `AdmitResult.collidesWith` (SPEC §5.2's typed contract, realized).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadStore, saveStore } from './fs-store.ts'
import { createDedupIndex, minHashSignature } from '../../src/corpus/dedup.ts'
import type { DedupIndex } from '../../src/corpus/dedup.ts'
import { canonicalize } from '../../src/corpus/canonical.ts'
import { admit } from '../../src/corpus/admit.ts'
import type { AdmitDeps } from '../../src/corpus/admit.ts'
import type { CorpusStore } from '../../src/corpus/store.ts'
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

declare const process: { cwd(): string; exit(code?: number): never }
declare const console: { log(...args: unknown[]): void; error(...args: unknown[]): void }

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
 */
async function warmDedupIndex(store: CorpusStore, dedupIndex: DedupIndex): Promise<void> {
  for (const rec of store.all()) {
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

  const repoRoot = process.cwd()
  const store = loadStore(repoRoot)
  const dedupIndex = createDedupIndex()
  await warmDedupIndex(store, dedupIndex)

  const deps: AdmitDeps = { catalog: loadDefaultCatalog(repoRoot), store, dedupIndex }
  const report: ImportReport = { admitted: [], alreadyPresent: [], errors: [] }

  for (const group of SEEDS_BY_MODULE) {
    for (const seed of group.seeds) {
      const candidate = seedToCandidate(seed, group.module)
      const result = await admit(candidate, deps)

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
}

main().catch((e: unknown) => {
  console.error('import-seeds: unexpected failure', e)
  process.exit(1)
})
