// run.ts — SPEC-R5 conformance-suite runner (a2ui-ecosystem-alignment.spec.md SPEC-R5, GH #476).
//
// Runs `../../conformance/fixtures.jsonl` — the implementation-agnostic, payload-in/verdict-out A2UI
// spec-conformance suite (upstream issue #2150: no such suite exists upstream) — against THIS repo's
// shared validator (`validateA2ui`, renderer LLD-C11 / SPEC-N6). Every fixture's `payload` is checked
// against the catalog its `catalogId` names (`../../conformance/manifest.json`'s `catalogs` map); the
// resulting `ValidationVerdict` is compared to the fixture's own `expectedVerdict` — `valid` must
// match and `failures` must match as a SET of `{code, path}` pairs (order-independent: a different
// validator may walk a component tree in a different order than this repo's ADR-0024 positional walk).
//
// ADR-0187 / GH #829: a fixture MAY additionally carry `atFinalize: true` (see the `Fixture` interface),
// asserting its payload is COMPLETE. The runner itself stays DEFAULT — see that field's doc comment for
// why a blanket flip is wrong (it would destroy two committed fixtures' single-failure isolation).
//
//   node --experimental-strip-types packages/agent-ui/a2ui/tools/conformance/run.ts
//   # exit 0 → {ok:true, fixtureCount}          every fixture's actual verdict matches expectedVerdict
//   # exit 1 → {ok:false, failed:[{name,expected,actual}]}   printed to stderr
//
// The fixture files themselves (`../../conformance/fixtures.jsonl` + `manifest.json`) are PURE JSON
// DATA — zero imports, zero repo-internal references — so ANY OTHER A2UI validator (this repo's
// included) can run the exact same suite: read `manifest.json` for the catalog map, read
// `fixtures.jsonl` line by line, run each `payload` through the validator-under-test, and diff the
// result against `expectedVerdict`. This script is ONLY the repo-side leg that runs the suite against
// OUR validator — the portable format contract lives entirely in the data files, not here.
//
// Catalog loading mirrors `tools/harness/validate-payload.ts`'s `loadDefaultCatalog`: Node's native
// ESM loader rejects an attribute-less JSON import (`ERR_IMPORT_ATTRIBUTE_MISSING` under
// `--experimental-strip-types`), so every catalog named by the manifest is read via `fs` and fed
// through the exported `loadCatalog()` — byte-identical to importing the catalog module directly.
//
// Zero new deps (SPEC-N5). Plain `.ts`, run via Node type-stripping (`erasableSyntaxOnly` guarantees
// it strips cleanly, ADR-0062).

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateA2ui } from '../../src/renderer/validate.ts'
import { loadCatalog } from '../../src/catalog/catalog.ts'
import type { Catalog } from '../../src/catalog/catalog.ts'
import type { Failure } from '../../src/protocol.ts'
import type { ValidationVerdict } from '../../src/renderer/validate.ts'

declare const process: { argv: string[]; exit(code?: number): never }
declare const console: { log(...args: unknown[]): void; error(...args: unknown[]): void }

const HERE = dirname(fileURLToPath(import.meta.url))
const SUITE_DIR = join(HERE, '../../conformance')

interface Manifest {
  catalogs: Record<string, string>
}

export interface Fixture {
  name: string
  description: string
  catalogId: string
  payload: unknown
  expectedVerdict: ValidationVerdict
  /**
   * ADR-0187 / GH #829 — OPTIONAL per-fixture finalize assertion, forwarded to `validateA2ui`'s options
   * bag. ABSENT (the overwhelming majority) = default-lenient, byte-identical to before this field
   * existed; `true` = "this payload is COMPLETE", which additionally fails a surface created with an
   * empty component set (`IDGRAPH sid:root-missing`).
   *
   * The RUNNER deliberately does NOT flip globally (ADR-0187 §4 / LLD §4): two committed fixtures
   * (`unsupported-version`, `bad-pointer-datamodel`) carry createSurface-only sids ON PURPOSE, to isolate
   * exactly ONE failure each — a blanket flip would add a second, unrelated failure to both and destroy
   * that isolation (the reverted mechanical fix proved it, GH #829 Findings 2). Per-fixture opt-in keeps
   * isolation AND covers the finalize arm, which the `abandoned-surface-*` pair below does.
   *
   * Portability: the field is additive and optional, so a third-party validator running this suite can
   * ignore it entirely and still match every pre-existing fixture — the pack README documents it.
   */
  atFinalize?: boolean
}

export interface Result {
  name: string
  pass: boolean
  actual: ValidationVerdict
  expected: ValidationVerdict
}

function readCatalog(manifestDir: string, relativePath: string): Catalog {
  const doc: unknown = JSON.parse(readFileSync(join(manifestDir, relativePath), 'utf8') as string)
  return loadCatalog(doc)
}

function readManifest(): Manifest {
  return JSON.parse(readFileSync(join(SUITE_DIR, 'manifest.json'), 'utf8') as string) as Manifest
}

export function readFixtures(): Fixture[] {
  const text = readFileSync(join(SUITE_DIR, 'fixtures.jsonl'), 'utf8') as string
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Fixture)
}

/** Order-independent equality on a `Failure[]` set — see the module header's verdict-matching note. */
function failuresMatch(actual: readonly Failure[], expected: readonly Failure[]): boolean {
  if (actual.length !== expected.length) return false
  const key = (f: Failure): string => `${f.code} ${f.path}`
  const a = [...actual].map(key).sort()
  const e = [...expected].map(key).sort()
  return a.every((v, i) => v === e[i])
}

/**
 * Pure — runs every fixture against `catalogs` and returns one result per fixture. An unrecognized
 * `catalogId` fails CLOSED (never throws): a manifest/fixture mismatch is a suite defect, not a
 * validator verdict, and must never be silently skipped or crash the run.
 * Exported so the co-located test (`run.test.ts`) can exercise the matching logic directly, without a
 * subprocess, in addition to the real-CLI exit-code proof.
 */
export function runSuite(fixtures: readonly Fixture[], catalogs: ReadonlyMap<string, Catalog>): Result[] {
  return fixtures.map((f) => {
    const catalog = catalogs.get(f.catalogId)
    if (catalog === undefined) {
      return { name: f.name, pass: false, actual: { valid: false, failures: [] }, expected: f.expectedVerdict }
    }
    // ADR-0187 — the fixture's own `atFinalize` is forwarded; absent, the third argument is `undefined`
    // and the options bag carries `atFinalize: false`, which the validator treats as the default mode.
    const actual = validateA2ui(f.payload, catalog, undefined, { atFinalize: f.atFinalize === true })
    const pass = actual.valid === f.expectedVerdict.valid && failuresMatch(actual.failures, f.expectedVerdict.failures)
    return { name: f.name, pass, actual, expected: f.expectedVerdict }
  })
}

function main(): void {
  const manifest = readManifest()
  const fixtures = readFixtures()
  const catalogs = new Map<string, Catalog>(
    Object.entries(manifest.catalogs).map(([id, relPath]) => [id, readCatalog(SUITE_DIR, relPath)]),
  )

  const results = runSuite(fixtures, catalogs)
  const failed = results.filter((r) => !r.pass)

  if (failed.length === 0) {
    console.log(JSON.stringify({ ok: true, fixtureCount: results.length }, null, 2))
    return
  }

  console.error(
    JSON.stringify(
      { ok: false, failed: failed.map((r) => ({ name: r.name, expected: r.expected, actual: r.actual })) },
      null,
      2,
    ),
  )
  process.exit(1)
}

// ── CLI entry — only runs when this file is executed directly (`node --experimental-strip-types
// tools/conformance/run.ts`), never when a test imports `runSuite`/`readFixtures` from it (the
// `tools/corpus/import-seeds.ts` CLI-entry-guard precedent — checked against `process.argv[1]`'s
// basename, since a jsdom-environment vitest import hands this module no real `file://` URL). ──
if (process.argv[1]?.endsWith('run.ts')) {
  main()
} else {
  console.error(`run.ts: loaded as "${process.argv[1] ?? '(unknown)'}" — not invoked as run.ts, so main() did not run. Invoke this file directly.`)
}
