// import-seeds.ts — the single writer (corpus LLD-C5, SPEC-R14). Wires REAL deps (`AdmitDeps`) around
// the pure `admitRecord` pipeline and runs it over every seed (`seeds.ts`, LLD-C4): all-or-nothing — any
// failure prints EVERY CorpusFailure across every seed and exits non-zero, writing NOTHING. Re-running
// on unchanged seeds is byte-idempotent (the pipeline is a pure function of `(candidate, deps)`, and
// `deps` here is itself deterministic — no dedup/hash state to warm, unlike the a2ui precedent).
//
// Run via Node type-stripping from the repo root:
//   node --experimental-strip-types packages/agent-ui/a2a/tools/corpus/import-seeds.ts
//
// (`erasableSyntaxOnly` in the repo tsconfig guarantees this source strips cleanly.)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { admitRecord } from '../../src/corpus/admit.ts'
import type { AdmitDeps, AdmitResult } from '../../src/corpus/admit.ts'
import { serializeShard, shardPath } from '../../src/corpus/shard.ts'
import type { A2aCitation, A2aCorpusRecord, A2aFacet } from '../../src/corpus/record.ts'
import { PROTOCOL_VERSION } from '../../src/protocol/types.ts'
import { LEDGER_PATH, isHvRowResolved } from './ledger-path.ts'
import { conceptSeeds, demoSeeds } from './seeds.ts'

declare const process: { cwd(): string; exit(code?: number): never }
declare const console: { log(...args: unknown[]): void; error(...args: unknown[]): void }

/** `resolveCitation`: hv -> read the SPEC §2 ledger once and check the row's resolution marker; repo ->
 * `existsSync`. The ledger read happens ONCE up front (`main`) — a missing/unreadable SPEC file fails
 * loudly NAMING the dependency (the review's hardening requirement), never a bare ENOENT. */
function makeResolveCitation(repoRoot: string, ledgerText: string): (c: A2aCitation) => boolean {
  return (c) => (c.kind === 'repo' ? existsSync(join(repoRoot, c.path)) : isHvRowResolved(ledgerText, c.row))
}

function loadTranscript(repoRoot: string, path: string): string | undefined {
  const full = join(repoRoot, path)
  if (!existsSync(full)) return undefined
  try {
    return readFileSync(full, 'utf8') as string
  } catch {
    return undefined
  }
}

function readLedgerOrExit(repoRoot: string): string {
  const full = join(repoRoot, LEDGER_PATH)
  if (!existsSync(full)) {
    console.error(`import-seeds: HV-ledger resolution requires ${LEDGER_PATH} — did the SPEC move/rename? Nothing was written.`)
    process.exit(1)
  }
  try {
    return readFileSync(full, 'utf8') as string
  } catch {
    console.error(`import-seeds: HV-ledger resolution requires ${LEDGER_PATH} — did the SPEC move/rename? Nothing was written.`)
    process.exit(1)
  }
}

function writeShard(repoRoot: string, facet: A2aFacet, records: A2aCorpusRecord[]): void {
  const path = shardPath(facet, PROTOCOL_VERSION)
  const full = join(repoRoot, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, serializeShard(records))
}

function main(): void {
  const repoRoot = process.cwd()
  const ledgerText = readLedgerOrExit(repoRoot)

  const deps: AdmitDeps = {
    protocolVersion: PROTOCOL_VERSION,
    resolveCitation: makeResolveCitation(repoRoot, ledgerText),
    loadTranscript: (path) => loadTranscript(repoRoot, path),
  }

  const seeds: unknown[] = [...conceptSeeds, ...demoSeeds]
  const admitted: A2aCorpusRecord[] = []
  const errors: Array<{ name: string; result: Extract<AdmitResult, { admitted: false }> }> = []

  for (const seed of seeds) {
    const result = admitRecord(seed, deps)
    const name = (seed as { name?: string }).name ?? '(unnamed)'
    if (result.admitted) {
      admitted.push(result.record)
    } else {
      errors.push({ name, result })
    }
  }

  if (errors.length > 0) {
    console.error(`import-seeds: ${errors.length} seed(s) failed admission. Nothing was written.`)
    for (const e of errors) {
      console.error(`  - ${e.name}: ${JSON.stringify(e.result.failures)}`)
    }
    process.exit(1)
  }

  const concepts = admitted.filter((r) => r.meta.facet === 'concept')
  const demos = admitted.filter((r) => r.meta.facet === 'demo')

  writeShard(repoRoot, 'concept', concepts)
  writeShard(repoRoot, 'demo', demos)

  console.log(`import-seeds: ${admitted.length} admitted (${concepts.length} concept, ${demos.length} demo), 0 errors.`)
}

main()
