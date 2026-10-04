// repair-shard.test.ts: the GH #1742 acceptance legs for the committed `repair` shard
// (`corpus/repair/v1_0/agent-ui.jsonl`, ADR-0231 cl.3). `corpus-data.test.ts` already holds every
// committed line to `checkTier1` + the identity hash; this file pins the facts that make a repair record a
// CORRECTION a producer can learn from rather than a second exemplar:
//
// 1. the shard is real (at least five lines, every seed on the repair shelf present);
// 2. the stored `validatorErrors` cover at least three distinct codes across the shard, every one of them a
//    code the shared validator can reach (SCHEMA, CATALOG, IDGRAPH, POINTER, DEPTH_EXCEEDED, CONTAINMENT);
// 3. per line, the shared validator's finalize-mode verdict on `invalidInput` set-equals the stored
//    `validatorErrors` (the recomputation the standing gate re-runs), and the corrected `a2uiOutput`
//    validates clean;
// 4. the recomputation bites: a stored error set with one pair dropped, or one extra pair added, rejects
//    E_SCHEMA at `validatorErrors`.
//
// Test-only `node:fs` (the `corpus-data.test.ts` precedent): reads the committed shard text directly.

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { validateA2ui } from './validate.ts'
import { checkTier1 } from './admit.ts'
import type { CorpusRecord } from './record.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { a2uiBasicCatalog } from '../catalog/a2ui-basic/index.ts'
import type { Catalog } from '../catalog/catalog.ts'
import type { SeedCatalogId } from '../examples/types.ts'
import { allRepairSeeds } from '../examples/index.ts'

declare const process: { cwd(): string }

const SHARD = `${process.cwd()}/packages/agent-ui/a2ui/corpus/repair/v1_0/agent-ui.jsonl`

function shardRecords(): CorpusRecord[] {
  if (!existsSync(SHARD)) return []
  return (readFileSync(SHARD, 'utf8') as string)
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as CorpusRecord)
}

const RECORDS = shardRecords()

// The `corpus-data.test.ts` resolver: each record is checked against ITS OWN catalog, never a hardcoded one.
const CATALOGS: Readonly<Record<SeedCatalogId, Catalog>> = { 'agent-ui': defaultCatalog, 'a2ui-basic': a2uiBasicCatalog }
function catalogFor(catalogId: string): Catalog {
  if (!Object.hasOwn(CATALOGS, catalogId)) {
    throw new Error(`unregistered catalogId "${catalogId}" (registered: ${Object.keys(CATALOGS).join(', ')})`)
  }
  return CATALOGS[catalogId as SeedCatalogId]
}

/** The codes the shared validator can emit: a stored pair outside this set is an unreachable breakage. */
const REACHABLE_CODES: ReadonlySet<string> = new Set(['SCHEMA', 'CATALOG', 'IDGRAPH', 'POINTER', 'DEPTH_EXCEEDED', 'CONTAINMENT'])

/** A failure list as a sorted `code@path` key set, the order-free equality the admission check uses. */
function pairKeys(failures: readonly { code: string; path: string }[]): string[] {
  return [...new Set(failures.map((f) => `${f.code}@${f.path}`))].sort()
}

describe('repair shard (GH #1742): the committed correction pairs', () => {
  it('holds at least five lines, one per seed on the repair shelf', () => {
    expect(RECORDS.length).toBeGreaterThanOrEqual(5)
    const names = RECORDS.map((r) => r.name)
    for (const seed of allRepairSeeds) expect(names).toContain(seed.name)
  })

  it('the stored validatorErrors cover at least three distinct codes, all of them reachable', () => {
    const codes = new Set(RECORDS.flatMap((r) => (r.validatorErrors ?? []).map((f) => f.code)))
    expect(codes.size).toBeGreaterThanOrEqual(3)
    for (const code of codes) expect(REACHABLE_CODES).toContain(code)
  })

  for (const rec of RECORDS) {
    describe(rec.name, () => {
      const catalog = catalogFor(rec.meta.catalogId)

      it('the recomputed finalize-mode verdict on invalidInput set-equals the stored validatorErrors', () => {
        const recomputed = validateA2ui(rec.invalidInput ?? [], catalog, undefined, { atFinalize: true })
        expect(recomputed.valid).toBe(false)
        expect(pairKeys(recomputed.failures)).toEqual(pairKeys(rec.validatorErrors ?? []))
      })

      it('the corrected a2uiOutput validates clean, and the whole record passes tier-1', () => {
        expect(validateA2ui(rec.a2uiOutput ?? [], catalog, undefined, { atFinalize: true })).toEqual({
          valid: true,
          failures: [],
        })
        expect(checkTier1(rec, catalog)).toBeNull()
      })

      it('a stored error set that drops a pair, or adds one, rejects E_SCHEMA at validatorErrors', () => {
        const stored = rec.validatorErrors ?? []
        const dropped: CorpusRecord = { ...rec, validatorErrors: stored.slice(1).length > 0 ? stored.slice(1) : [{ code: 'SCHEMA', path: 'nowhere' }] }
        const added: CorpusRecord = { ...rec, validatorErrors: [...stored, { code: 'SCHEMA', path: 'nowhere' }] }
        for (const mutated of [dropped, added]) {
          expect(checkTier1(mutated, catalog)).toMatchObject({ ok: false, code: 'E_SCHEMA', paths: ['validatorErrors'] })
        }
      })
    })
  }
})
