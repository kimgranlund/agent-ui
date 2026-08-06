// run.test.ts — SPEC-R5 conformance-suite runner coverage (a2ui-ecosystem-alignment.spec.md SPEC-R5,
// GH #476).
//
// Two tiers (the `tools/corpus/import-seeds.test.ts` pattern): pure-logic assertions on the exported
// `runSuite` verdict-matching helper (no fs, no subprocess) — including two NEGATIVE controls (a
// mismatched expectedVerdict, an unrecognized catalogId) proving the matcher actually discriminates —
// plus one REAL-subprocess run proving the CLI's own exit code, which is the literal AC1 acceptance:
// "run against this repo's validator it passes BY EXIT CODE".
//
// Importing `run.ts` directly is SAFE: its CLI entry is guarded (`process.argv[1]?.endsWith('run.ts')`),
// matching `tools/corpus/import-seeds.ts`'s own guard — vitest's own argv[1] never matches, so `main()`
// never fires on import (only the loud non-fatal else-branch log, same as that precedent).

import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { runSuite, readFixtures } from './run.ts'
import type { Fixture } from './run.ts'
import { loadCatalog } from '../../src/catalog/catalog.ts'
import type { Catalog } from '../../src/catalog/catalog.ts'
import defaultCatalogDoc from '../../src/catalog/default/catalog.json'
import basicCatalogDoc from '../../src/catalog/a2ui-basic/catalog.json'

const RUN_SCRIPT = fileURLToPath(new URL('./run.ts', import.meta.url))

const catalogs = new Map<string, Catalog>([
  ['agent-ui', loadCatalog(defaultCatalogDoc)],
  ['a2ui-basic', loadCatalog(basicCatalogDoc)],
])

const fixture = (over: Partial<Fixture>): Fixture => ({
  name: 'f',
  description: '',
  catalogId: 'agent-ui',
  payload: 'not json',
  expectedVerdict: { valid: false, failures: [{ code: 'PARSE', path: '' }] },
  ...over,
})

describe('runSuite — pure verdict-matching logic', () => {
  it('a fixture whose actual verdict matches expectedVerdict PASSES', () => {
    const [result] = runSuite([fixture({})], catalogs)
    expect(result.pass).toBe(true)
    expect(result.actual).toEqual({ valid: false, failures: [{ code: 'PARSE', path: '' }] })
  })

  it('a mismatched expectedVerdict FAILS (negative control)', () => {
    const [result] = runSuite([fixture({ expectedVerdict: { valid: true, failures: [] } })], catalogs)
    expect(result.pass).toBe(false)
  })

  it('an unrecognized catalogId fails CLOSED, never throws (negative control)', () => {
    const [result] = runSuite([fixture({ catalogId: 'nonexistent', expectedVerdict: { valid: true, failures: [] } })], catalogs)
    expect(result.pass).toBe(false)
    expect(result.actual).toEqual({ valid: false, failures: [] })
  })

  it('failures compare as a SET — order-independent (the module header\'s stated semantics)', () => {
    const payload = [
      { version: 'v1.0', createSurface: { surfaceId: 's', catalogId: 'agent-ui' } },
      {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's',
          components: [
            { id: 'a', component: 'Nope' },
            { id: 'b', component: 'AlsoNope' },
          ],
        },
      },
    ]
    const [result] = runSuite(
      [
        fixture({
          name: 'reordered',
          payload,
          expectedVerdict: {
            valid: false,
            // Deliberately NOT in the actual computation order (CATALOG:a, CATALOG:b, then IDGRAPH) —
            // proves the matcher compares a SET, not a sequence.
            failures: [
              { code: 'IDGRAPH', path: 's:root-missing' },
              { code: 'CATALOG', path: 'b' },
              { code: 'CATALOG', path: 'a' },
            ],
          },
        }),
      ],
      catalogs,
    )
    expect(result.pass).toBe(true)
  })
})

describe('the committed suite — every fixtures.jsonl line is a well-formed Fixture', () => {
  it('parses to 16 lines, each carrying the required fields', () => {
    const fixtures = readFixtures()
    expect(fixtures.length).toBe(16)
    for (const f of fixtures) {
      expect(typeof f.name).toBe('string')
      expect(typeof f.catalogId).toBe('string')
      expect(f.payload).not.toBeUndefined()
      expect(typeof f.expectedVerdict.valid).toBe('boolean')
      expect(Array.isArray(f.expectedVerdict.failures)).toBe(true)
    }
  })
})

describe("the real CLI — SPEC-R5 AC1, run against this repo's validator, exit code", () => {
  it('exits 0 — every committed fixture\'s actual verdict matches its expectedVerdict', () => {
    const result = spawnSync('node', ['--experimental-strip-types', RUN_SCRIPT], { encoding: 'utf8' })
    expect(result.status, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, fixtureCount: 16 })
  })
})
