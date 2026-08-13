// generate-suites.ts — GH #616: derives packages/agent-ui/a2ui/conformance/suites/*.yaml from the
// canonical `fixtures.jsonl`, following the upstream a2ui-project/a2ui `agent_sdks/conformance/
// suites/*.yaml` row convention (fetched 2026-08-13 — validator.yaml / catalog.yaml / parser.yaml: each
// row carries name / description / catalog (version + schema refs) / action / payload / an
// expected-outcome field). `fixtures.jsonl` stays THE canonical source — this repo's own silent-
// divergence class (GH #406: two hand-maintained enumerations of one truth) is exactly what a
// hand-edited suites/*.yaml would become; every file this module produces is BYTE-DERIVED, never
// hand-edited — the co-located `suites-driftwire.test.ts` proves it.
//
// Zero new deps (SPEC-N5): YAML emission is hand-rolled string building, not a YAML library. Every
// scalar/collection VALUE (not the outer `- name:`/`  key:` structure) is emitted via `JSON.stringify` —
// valid because a YAML 1.1/1.2 parser accepts JSON flow syntax as a value verbatim (a double-quoted
// YAML scalar is a strict superset of a JSON string literal, and a YAML flow mapping/sequence IS JSON
// syntax). That sidesteps hand-rolling block-style string-quoting/escaping rules for the fixtures'
// arbitrary nested payload/verdict JSON (unicode glyphs, RFC-6901 `~` escapes, `${…}` interpolation
// strings) while staying byte-deterministic. Only the row STRUCTURE (`- `, `key:`, indentation, the
// blank line between rows) is hand-rolled YAML.
//
// Two DELIBERATE shape mismatches vs. the fetched upstream rows (named here, not forced — see the pack
// README "Upstream suites/*.yaml port" section and UPSTREAM-PROPOSAL.md):
//   1. Outcome field — upstream's `expect_error: {category, message}` (or a bare string) names a SINGLE
//      first-raised exception. This repo's validator returns a full `ValidationVerdict`: a SET of
//      `{code, path}` failures, order-independent (ADR-0024). Approximating that into a singular field
//      would be lossy, so every row here carries `expect_verdict`, the shared `ValidationVerdict` shape
//      verbatim (renderer/validate.ts) — a new field name, not upstream's, on purpose.
//   2. `catalog.yaml`'s action vocabulary — upstream's catalog.yaml suite exercises catalog-SCHEMA
//      transforms (`prune` / `render` / `load` / `remove_strict_validation` / `verify_cuttable_keys`).
//      This repo's validator has no analog: it only checks whether a payload's components are members
//      of a catalog's declared set, never transforms the catalog document itself. Every row below
//      (both suites) uses `action: "validate"` — `catalog.yaml` here groups catalog-DOCUMENT-scoped
//      validate cases (the CATALOG allowlist code + every catalog-interop known-good payload), not a
//      different action.

import type { Fixture } from './run.ts'

/**
 * One generated suite file's name → the ORDERED list of fixture names it carries. The split follows
 * upstream's own validator/catalog file-granularity CONCERN boundary, not a `catalogId` split:
 * `validator.yaml` = protocol-pipeline mechanics that hold regardless of which catalog is targeted
 * (PARSE / SCHEMA / VERSION_UNSUPPORTED / POINTER / IDGRAPH); `catalog.yaml` = catalog-document-scoped
 * concerns (the CATALOG membership-allowlist code, plus every catalog-interop known-good payload).
 * Recorded in full, with rationale, in the pack README's mapping table.
 */
export const SUITE_MEMBERSHIP: Record<string, readonly string[]> = {
  'validator.yaml': [
    'parse-failure',
    'bad-envelope',
    'missing-surfaceId',
    'unsupported-version',
    'bad-pointer-binding',
    'bad-pointer-datamodel',
    'missing-root',
    'duplicate-root',
    'dangling-child',
    'cycle',
    // ADR-0187 / GH #829 — the finalize-granularity pair. Both are protocol-pipeline (IDGRAPH) mechanics
    // that hold regardless of catalog, so `validator.yaml` is their home by the same concern boundary the
    // rest of this list follows. They sit AFTER `cycle`, keeping the id-graph members contiguous.
    'abandoned-surface-at-finalize',
    'abandoned-surface-mid-stream',
  ],
  'catalog.yaml': [
    'valid-button',
    'valid-list',
    'unknown-component',
    'upstream-interactive-button',
    'upstream-simple-login-form',
    'upstream-product-card',
    'containment-stray-region',
    'valid-structured-card-mark-free',
    'valid-structured-container',
  ],
}

/**
 * `manifest.json`'s own `catalogId` → catalog-document map, re-expressed relative to `suites/` (one
 * directory DEEPER than `manifest.json` itself, at `conformance/` — its `../src/...` paths need one
 * more `../` from here). Kept local rather than re-reading `manifest.json` at generation time: the two
 * files' relative-path bases differ by construction, so no single string could serve both without a
 * runtime rebase — this map is the one place that fact is recorded for the `suites/` output.
 */
const CATALOG_SCHEMA_PATHS: Record<string, string> = {
  'agent-ui': '../../src/catalog/default/catalog.json',
  'a2ui-basic': '../../src/catalog/a2ui-basic/catalog.json',
}

const HEADER = [
  '# GENERATED — DO NOT EDIT BY HAND.',
  '# Source of truth: packages/agent-ui/a2ui/conformance/fixtures.jsonl.',
  '# Regenerate: node --experimental-strip-types packages/agent-ui/a2ui/tools/conformance/generate-suites.ts',
  '#',
  '# Ported to the upstream a2ui-project/a2ui `agent_sdks/conformance/suites/*.yaml` row convention',
  '# (GH #616). See ../README.md ("Upstream suites/*.yaml port") for the field-by-field mapping and the',
  '# two named shape mismatches (expect_verdict vs. expect_error; no prune/render/load action analog).',
  '#',
  '# Upstream submission formatting (Apache license headers, etc.) is applied at contribution time —',
  '# never carried in this repo\'s own generated copy. See UPSTREAM-PROPOSAL.md for the draft issue text.',
].join('\n')

/** One fixture, rendered as one upstream-shaped YAML list row (name/description/catalog/action/payload/
 *  expect_verdict [+ at_finalize]). Every value position is `JSON.stringify`-emitted — see the module
 *  header.
 *
 *  ADR-0187 / GH #829 — `at_finalize` is emitted ONLY for a fixture that carries `atFinalize: true`.
 *  Conditional, not unconditional, for two reasons: (1) every pre-existing row stays BYTE-identical, so
 *  the drift gate's diff shows exactly the two new rows and nothing else; (2) the field is a MODE input to
 *  the validator, not an expectation, and a suite consumer that ignores it would silently mis-run the
 *  negative fixture — its presence on exactly the rows that need it is the honest signal. Snake_case
 *  matches the surrounding row convention (`expect_verdict`, `catalog_schema`), not the TS field name. */
const emitRow = (f: Fixture): string => {
  const schema = CATALOG_SCHEMA_PATHS[f.catalogId]
  if (schema === undefined) {
    throw new Error(`generate-suites: fixture "${f.name}" names an unrecognized catalogId "${f.catalogId}"`)
  }
  return [
    `- name: ${JSON.stringify(f.name)}`,
    `  description: ${JSON.stringify(f.description)}`,
    `  catalog:`,
    `    version: ${JSON.stringify('v1.0')}`,
    `    catalogId: ${JSON.stringify(f.catalogId)}`,
    `    catalog_schema: ${JSON.stringify(schema)}`,
    `  action: ${JSON.stringify('validate')}`,
    `  payload: ${JSON.stringify(f.payload)}`,
    ...(f.atFinalize === true ? [`  at_finalize: ${JSON.stringify(true)}`] : []),
    `  expect_verdict: ${JSON.stringify(f.expectedVerdict)}`,
  ].join('\n')
}

/**
 * Pure — builds every suite file's full YAML text from the real fixture set. TOTAL for a
 * fixtures/membership pair that agrees: throws only on a genuine generation-time defect (a membership
 * entry names a fixture that doesn't exist, a fixture claimed by more than one suite, or a fixture
 * claimed by none) — never a silently wrong or partial artifact.
 */
export function buildSuites(fixtures: readonly Fixture[]): Record<string, string> {
  const byName = new Map(fixtures.map((f) => [f.name, f]))
  const claimed = new Set<string>()
  const out: Record<string, string> = {}

  for (const [suiteFile, names] of Object.entries(SUITE_MEMBERSHIP)) {
    const rows: string[] = []
    for (const name of names) {
      const f = byName.get(name)
      if (f === undefined) {
        throw new Error(`generate-suites: ${suiteFile} names fixture "${name}", which is not in fixtures.jsonl`)
      }
      if (claimed.has(name)) {
        throw new Error(`generate-suites: fixture "${name}" is claimed by more than one suite`)
      }
      claimed.add(name)
      rows.push(emitRow(f))
    }
    out[suiteFile] = `${HEADER}\n\n${rows.join('\n\n')}\n`
  }

  const unclaimed = fixtures.filter((f) => !claimed.has(f.name)).map((f) => f.name)
  if (unclaimed.length > 0) {
    throw new Error(`generate-suites: fixture(s) not claimed by any suite in SUITE_MEMBERSHIP: ${unclaimed.join(', ')}`)
  }

  return out
}

// ── CLI entry — guarded exactly like this directory's own run.ts main(): only fires when this file is
// executed directly, never when a test imports `buildSuites`/`SUITE_MEMBERSHIP` from it. ──
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFixtures } from './run.ts'

declare const process: { argv: string[] }
declare const console: { log(...args: unknown[]): void; error(...args: unknown[]): void }

function main(): void {
  const HERE = dirname(fileURLToPath(import.meta.url))
  const SUITES_DIR = join(HERE, '../../conformance/suites')
  const fixtures = readFixtures()
  const suites = buildSuites(fixtures)
  for (const [file, text] of Object.entries(suites)) {
    writeFileSync(join(SUITES_DIR, file), text)
    console.log(`generate-suites: wrote ${text.length} bytes to conformance/suites/${file}`)
  }
}

if (process.argv[1]?.endsWith('generate-suites.ts')) {
  main()
} else {
  console.error(
    `generate-suites.ts: loaded as "${process.argv[1] ?? '(unknown)'}" — not invoked as generate-suites.ts, so generation did not run. Invoke this file directly.`,
  )
}
