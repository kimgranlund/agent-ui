// corpus-data.test.ts — the standing corpus-data gate (corpus LLD-C15, SPEC-R1/R8; the "package-side
// corpus probe" NEXT item 4 books). Re-validates EVERY committed exemplar shard on every `npm test`:
// every line parses, `validateRecord` returns [], its `a2uiOutput` passes the shared tier-1 validator
// against the catalog its OWN `meta.catalogId` names, and the stored `meta.canonicalHash` matches a FRESH
// recomputation from the record's own `a2uiOutput` - so a hand-edited, stale, or corrupted shard fails
// LOUDLY, never silently. Only `tools/corpus/import-seeds.ts`/`rescore.ts` write these files (LLD §2
// invariant iv); this gate is read-only.
//
// MULTI-SHARD (GH #1737, ADR-0169 follow-up, Kim's ruling 2026-10-03: separate shelf). A shard is
// `corpus/exemplar/v1_0/<catalogId>.jsonl` (`computeShardPath`, already catalog-aware), so the gate walks
// EVERY `*.jsonl` there rather than one hardwired file, and resolves the catalog per record from
// `meta.catalogId` through `CATALOGS` (the in-package mirror of `tools/catalog-files.ts`'s id registry,
// bundler-safe JSON imports). It fails loudly on (i) a shard whose file name is no registered catalog id,
// (ii) a record whose `meta.catalogId` is unregistered, and (iii) a record in the WRONG shard (the file
// name must equal the record's catalogId). BOTH `agent-ui.jsonl` and `a2ui-basic.jsonl` are
// REQUIRED and non-empty (the Basic shard was first admitted by GH #1732), and every record in the Basic
// shard is held to the same standard against `a2uiBasicCatalog`. `name` stays unique ACROSS shards (LLD §2
// invariant i, the corpus-wide join key).
//
// The gate is ALSO proven to BITE with planted in-memory records (the
// quarantine-legs precedent below): every predicate the standing loop runs (`catalogFor`, `shardProblem`,
// `shardInventoryProblems`, `tier1Verdict`, `hashProblem`, `duplicateRecordNames`) is a NAMED FUNCTION the
// planted legs drive too, so a vacuous or always-true predicate cannot hide behind an empty Basic shard.
//
// AMENDED (ADR-0068 clause 6, the B1 gate fix): `status:"quarantined"` lines are LEGAL in a shard -
// parse + `validateRecord` + the facet assertion run for EVERY line; the tier-1 + hash-recomputation
// legs run for NON-quarantined lines only (a quarantined record may legitimately no longer validate,
// SPEC-R13 — that is what quarantine records). The old "never quarantined" assertion cited LLD §2
// invariant ii, which is actually FACET-only (a shard holds one facet); consumption-exclusion belongs
// to `store.ts#all()`, not this gate.
//
// Test-only use of `node:fs` (never ships — the `store.test.ts` self-grep precedent; the pure core
// under `src/corpus/` stays node-free, SPEC-N5/ADR-0062).

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { validateRecord } from './record.ts'
import type { CorpusRecord } from './record.ts'
import { validateA2ui } from './validate.ts'
import { canonicalize } from './canonical.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { a2uiBasicCatalog } from '../catalog/a2ui-basic/index.ts'
import type { Catalog } from '../catalog/catalog.ts'
import type { SeedCatalogId } from '../examples/types.ts'
import { canvasButtonSeed } from '../examples/canvas-button.ts'
import { plantedBasicSeed, stampCatalogId } from '../catalog/a2ui-basic/planted.ts'

declare const process: { cwd(): string }

const SHARD_DIR = `${process.cwd()}/packages/agent-ui/a2ui/corpus/exemplar/v1_0`
const SHARD_EXT = '.jsonl'

/** Every catalog a committed shard may be stamped with, keyed by `meta.catalogId` (= the shard stem). */
const CATALOGS: Readonly<Record<SeedCatalogId, Catalog>> = {
  'agent-ui': defaultCatalog,
  'a2ui-basic': a2uiBasicCatalog,
}
const REGISTERED_IDS = Object.keys(CATALOGS)

/** The shards that MUST exist and be non-empty (the Basic shard since GH #1732 admitted its first records). */
const REQUIRED_SHARDS: readonly string[] = [`agent-ui${SHARD_EXT}`, `a2ui-basic${SHARD_EXT}`]

/** The catalog for a record's `meta.catalogId`. THROWS on an unregistered id, naming the registered ones
 *  (a loud failure, never a silent fall-back to the default catalog). */
function catalogFor(catalogId: string): Catalog {
  if (!Object.hasOwn(CATALOGS, catalogId)) {
    throw new Error(`unregistered catalogId "${catalogId}" (registered: ${REGISTERED_IDS.join(', ')})`)
  }
  return CATALOGS[catalogId as SeedCatalogId]
}

/** The shard file name minus its extension: the catalog id the shard claims to hold. */
const shardStem = (file: string): string => file.slice(0, -SHARD_EXT.length)

/** Why a record does not belong in `shardFile`: the file name must equal the record's `meta.catalogId`
 *  (`computeShardPath` writes `<catalogId>.jsonl`, so any other pairing is a mis-filed or hand-moved
 *  record). `undefined` = it belongs. */
function shardProblem(shardFile: string, rec: CorpusRecord): string | undefined {
  const stem = shardStem(shardFile)
  return stem === rec.meta.catalogId ? undefined : `${rec.name}: record is stamped catalogId "${rec.meta.catalogId}" but sits in ${shardFile}`
}

/** Problems with the SET of shard files: a required shard missing, or a shard whose stem is no
 *  registered catalog id. */
function shardInventoryProblems(files: readonly string[]): string[] {
  const problems: string[] = []
  for (const required of REQUIRED_SHARDS) {
    if (!files.includes(required)) problems.push(`required shard ${required} is missing`)
  }
  for (const file of files) {
    if (!Object.hasOwn(CATALOGS, shardStem(file))) {
      problems.push(`shard ${file} names no registered catalog (registered: ${REGISTERED_IDS.join(', ')})`)
    }
  }
  return problems
}

/** Tier-1 for one record, against the catalog ITS OWN `meta.catalogId` names, at admission's OWN
 *  granularity.
 *
 *  ADR-0187 / GH #829 - `{atFinalize: true}` is `admit.ts` stage 5's granularity. This gate exists to
 *  prove the committed shard is what admission would accept TODAY; judging it default-lenient while
 *  admission judges at finalize would leave a record admissible-by-this-gate yet rejected by the real
 *  pipeline - the parity gap SPEC-N1 exists to close. It is also this slice's permanent re-admission
 *  sweep: one assertion per committed record, every `npm test`. Throws (via `catalogFor`) on an
 *  unregistered catalog id. */
function tier1Verdict(rec: CorpusRecord): ReturnType<typeof validateA2ui> {
  if (rec.a2uiOutput === undefined) throw new Error(`${rec.name}: exemplar record has no a2uiOutput`)
  return validateA2ui(rec.a2uiOutput, catalogFor(rec.meta.catalogId), undefined, { atFinalize: true })
}

/** The stored canonical hash must match a FRESH recomputation from the record's own a2uiOutput - catches
 *  a hand-edited a2uiOutput whose meta.canonicalHash was left stale (LLD-C3, SPEC-R6/N6). */
async function hashProblem(rec: CorpusRecord): Promise<string | undefined> {
  if (rec.a2uiOutput === undefined) throw new Error(`${rec.name}: exemplar record has no a2uiOutput`)
  const recomputed = await canonicalize(rec.a2uiOutput)
  return rec.meta.canonicalHash === recomputed.hash ? undefined : `${rec.name}: stored hash ${rec.meta.canonicalHash} != recomputed ${recomputed.hash}`
}

/** Record names that appear more than once across the given records (LLD §2 invariant i, corpus-wide). */
function duplicateRecordNames(recs: readonly CorpusRecord[]): string[] {
  const seen = new Map<string, number>()
  for (const r of recs) seen.set(r.name, (seen.get(r.name) ?? 0) + 1)
  return [...seen].filter(([, n]) => n > 1).map(([name]) => name).sort()
}

interface ShardLine {
  shard: string
  lineNo: number
  rec: CorpusRecord
}

const shardFiles = (readdirSync(SHARD_DIR) as string[]).filter((f) => f.endsWith(SHARD_EXT)).sort()
const shardLines: ShardLine[] = shardFiles.flatMap((shard) => {
  const text = readFileSync(`${SHARD_DIR}/${shard}`, 'utf8') as string
  return text
    .split('\n')
    .map((line, i) => ({ line, lineNo: i + 1 }))
    .filter(({ line }) => line.trim() !== '')
    .map(({ line, lineNo }) => ({ shard, lineNo, rec: JSON.parse(line) as CorpusRecord }))
})
const records = shardLines.map((l) => l.rec)

describe('corpus-data - every committed exemplar shard is self-consistent (LLD-C15, GH #1737 multi-shard)', () => {
  it('the shard inventory is sound: agent-ui.jsonl and a2ui-basic.jsonl present, every shard file names a registered catalog', () => {
    expect(shardInventoryProblems(shardFiles)).toEqual([])
  })

  it('every required shard is non-empty (the seed import actually ran and was committed)', () => {
    for (const shard of REQUIRED_SHARDS) {
      expect(shardLines.filter((l) => l.shard === shard).length, shard).toBeGreaterThan(0)
    }
  })

  it('a2ui-basic.jsonl holds at least the GH #1732 floor of 3 records, every one stamped a2ui-basic (judged by the per-line legs below)', () => {
    const basic = shardLines.filter((l) => l.shard === 'a2ui-basic.jsonl')
    expect(basic.length).toBeGreaterThanOrEqual(3)
    for (const l of basic) expect(l.rec.meta.catalogId, `${l.shard}:${l.lineNo}`).toBe('a2ui-basic')
  })

  it('every record name is unique across ALL shards (LLD §2 invariant i, the join key across sub-corpora)', () => {
    expect(duplicateRecordNames(records)).toEqual([])
  })

  it('every record sits in the shard its own catalogId names (no mis-filed record)', () => {
    expect(shardLines.map((l) => shardProblem(l.shard, l.rec)).filter((p) => p !== undefined)).toEqual([])
  })

  it('every record in these shards is facet:"exemplar" (LLD §2 invariant ii is FACET-only - quarantined lines are LEGAL here, ADR-0068 cl.6)', () => {
    for (const rec of records) {
      expect(rec.meta.facet, rec.name).toBe('exemplar')
    }
  })

  for (const { shard, lineNo, rec } of shardLines) {
    const quarantined = rec.meta.status === 'quarantined'
    const where = `${shard} line ${lineNo}${quarantined ? ' (quarantined)' : ''}`

    it(`${where} parses + validates + facet holds + catalog is registered`, () => {
      // Schema/field + pin re-check (LLD-C2) — legal for EVERY line, quarantined or not (ADR-0068
      // cl.6): a hand-edited status flip is still caught by validateRecord's status enum.
      expect(validateRecord(rec), rec.name).toEqual([])
      expect(rec.meta.facet, rec.name).toBe('exemplar')
      expect(() => catalogFor(rec.meta.catalogId), rec.name).not.toThrow()
    })

    // Tier-1 + hash-recomputation run for NON-quarantined lines only — a quarantined record may
    // legitimately no longer validate against the current catalog (that is what quarantine records,
    // SPEC-R13/ADR-0068 cl.6); re-asserting it here would make the standing gate fight the very state
    // it exists to tolerate.
    if (!quarantined) {
      it(`${where} tier-1 passes against its own catalog + its hash matches recomputation`, async () => {
        const verdict = tier1Verdict(rec)
        expect(verdict.valid, `${rec.name} tier-1 failures: ${JSON.stringify(verdict.failures)}`).toBe(true)
        expect(await hashProblem(rec)).toBeUndefined()
      })
    }
  }
})

// ── GH #1737: the gate BITES on the Basic dialect - planted in-memory records, never a real shard ────────
//
// The standing loop above judges only the committed shard records; these legs plant genuine AND
// wrong-dialect records and run the SAME predicates the standing loop runs. Directional pairs (a Basic record passes
// Basic AND fails default; an agent-ui record stamped Basic fails Basic) are what make a no-op predicate
// impossible: a gate that always returned valid, or always used `defaultCatalog`, fails one half.
describe('GH #1737 - the multi-shard gate bites (planted in-memory records)', () => {
  const recordOf = (
    name: string,
    catalogId: string,
    a2uiOutput: CorpusRecord['a2uiOutput'],
    extra: Partial<CorpusRecord['meta']> = {},
  ): CorpusRecord => ({
    name,
    description: 'a planted record (no real shard mutation)',
    promptText: 'planted prompt',
    a2uiOutput,
    meta: {
      facet: 'exemplar',
      protocolVersion: 'v1.0',
      catalogId,
      provenance: { source: 'authored', origin: 'test-fixture' },
      status: 'valid',
      ...extra,
    },
  })

  const basicRecord = recordOf('planted-basic-record', 'a2ui-basic', [...plantedBasicSeed('product-card').messages])
  // An agent-ui dialect payload CLAIMING the Basic catalog: both createSurface and meta are stamped Basic
  // so validateRecord's pin leg (E_PIN) is satisfied and ONLY the catalog leg can catch the dialect lie.
  const misStamped = recordOf('planted-misstamped-record', 'a2ui-basic', stampCatalogId(canvasButtonSeed.messages, 'a2ui-basic'))
  const agentUiRecord = recordOf('planted-agent-ui-record', 'agent-ui', [...canvasButtonSeed.messages])

  it('a Basic-dialect record stamped a2ui-basic is schema-clean, passes tier-1 against a2uiBasicCatalog, AND fails tier-1 against defaultCatalog', () => {
    expect(validateRecord(basicRecord)).toEqual([])
    expect(tier1Verdict(basicRecord)).toEqual({ valid: true, failures: [] })

    const againstDefault = validateA2ui(basicRecord.a2uiOutput, defaultCatalog, undefined, { atFinalize: true })
    expect(againstDefault.valid).toBe(false)
    expect(againstDefault.failures.length).toBeGreaterThan(0)
    expect(againstDefault.failures.every((f) => f.code === 'CATALOG')).toBe(true)
  })

  it('an agent-ui-dialect record stamped a2ui-basic is schema-clean (pins agree) but FAILS tier-1 against a2uiBasicCatalog', () => {
    expect(validateRecord(misStamped)).toEqual([])
    const verdict = tier1Verdict(misStamped)
    expect(verdict.valid).toBe(false)
    expect(verdict.failures.length).toBeGreaterThan(0)
  })

  it('the control: the SAME agent-ui payload stamped agent-ui passes tier-1 (so the failure above is the dialect, not the payload)', () => {
    expect(validateRecord(agentUiRecord)).toEqual([])
    expect(tier1Verdict(agentUiRecord)).toEqual({ valid: true, failures: [] })
  })

  it('a record in the WRONG shard is reported, and in its own shard is not', () => {
    expect(shardProblem('agent-ui.jsonl', basicRecord)).toMatch(/stamped catalogId "a2ui-basic" but sits in agent-ui\.jsonl/)
    expect(shardProblem('a2ui-basic.jsonl', agentUiRecord)).toMatch(/stamped catalogId "agent-ui" but sits in a2ui-basic\.jsonl/)
    expect(shardProblem('a2ui-basic.jsonl', basicRecord)).toBeUndefined()
    expect(shardProblem('agent-ui.jsonl', agentUiRecord)).toBeUndefined()
  })

  it('an UNREGISTERED catalogId fails loudly: catalogFor throws naming the registered ids, and tier-1 for such a record throws, never falling back to the default catalog', () => {
    expect(() => catalogFor('made-up')).toThrow(/unregistered catalogId "made-up" \(registered: agent-ui, a2ui-basic\)/)
    expect(() => catalogFor('toString')).toThrow(/unregistered/) // an Object.prototype key is not a catalog
    const stray = recordOf('planted-unregistered', 'made-up', agentUiRecord.a2uiOutput)
    expect(() => tier1Verdict(stray)).toThrow(/unregistered catalogId "made-up"/)
  })

  it('the shard inventory: agent-ui.jsonl and a2ui-basic.jsonl both required, an unregistered shard stem reported', () => {
    expect(shardInventoryProblems(['agent-ui.jsonl', 'a2ui-basic.jsonl'])).toEqual([])
    expect(shardInventoryProblems(['agent-ui.jsonl'])).toEqual(['required shard a2ui-basic.jsonl is missing'])
    expect(shardInventoryProblems(['a2ui-basic.jsonl'])).toEqual(['required shard agent-ui.jsonl is missing'])
    expect(shardInventoryProblems([])).toEqual(['required shard agent-ui.jsonl is missing', 'required shard a2ui-basic.jsonl is missing'])
    const stray = shardInventoryProblems(['agent-ui.jsonl', 'a2ui-basic.jsonl', 'mystery.jsonl'])
    expect(stray).toHaveLength(1)
    expect(stray[0]).toMatch(/shard mystery\.jsonl names no registered catalog/)
  })

  it('the stored-hash leg bites: a record with a stale canonicalHash is reported, a fresh one is not', async () => {
    const fresh = (await canonicalize(basicRecord.a2uiOutput!)).hash
    expect(await hashProblem({ ...basicRecord, meta: { ...basicRecord.meta, canonicalHash: fresh } })).toBeUndefined()
    expect(await hashProblem({ ...basicRecord, meta: { ...basicRecord.meta, canonicalHash: 'sha256:stale' } })).toMatch(/stored hash sha256:stale != recomputed/)
  })

  it('duplicateRecordNames bites across shards: the same name in a Basic record and an agent-ui record is reported, distinct names are not', () => {
    const clash = recordOf(agentUiRecord.name, 'a2ui-basic', basicRecord.a2uiOutput)
    expect(duplicateRecordNames([agentUiRecord, clash])).toEqual([agentUiRecord.name])
    expect(duplicateRecordNames([agentUiRecord, basicRecord])).toEqual([])
  })
})

describe('quarantine legs (ADR-0068 cl.6, the B1 gate amendment) — planted fixtures, never the real shard', () => {
  it('a planted quarantined record with a valid schema passes validateRecord + facet — and genuinely fails tier-1, proving the skip above is load-bearing, not a no-op exemption', () => {
    const quarantined: CorpusRecord = {
      name: 'planted-quarantined-ok',
      description: 'a planted below-bar record kept for audit (no real shard mutation)',
      promptText: 'build something',
      // an unknown component type -> tier-1 rejects E_CATALOG: this fixture is a GENUINE quarantine candidate.
      a2uiOutput: [
        { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } },
        { version: 'v1.0', updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'NotReal' }] } },
      ],
      meta: {
        facet: 'exemplar',
        protocolVersion: 'v1.0',
        catalogId: 'agent-ui',
        provenance: { source: 'authored', origin: 'test-fixture' },
        status: 'quarantined',
      },
    }
    expect(validateRecord(quarantined)).toEqual([])
    expect(quarantined.meta.facet).toBe('exemplar')

    const verdict = validateA2ui(quarantined.a2uiOutput, defaultCatalog)
    expect(verdict.valid).toBe(false)
  })

  it('a planted quarantined record with a genuine schema defect still FAILS the gate (no blanket exemption)', () => {
    const quarantinedButBroken = {
      // missing `description` entirely — E_SCHEMA, ADR-0063's unconditional requirement
      name: 'planted-quarantined-broken',
      promptText: 'build something',
      a2uiOutput: [{ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } }],
      meta: {
        facet: 'exemplar',
        protocolVersion: 'v1.0',
        catalogId: 'agent-ui',
        provenance: { source: 'authored', origin: 'test-fixture' },
        status: 'quarantined',
      },
    }
    const failures = validateRecord(quarantinedButBroken)
    expect(failures.length).toBeGreaterThan(0)
    expect(failures.some((f) => f.path === 'description')).toBe(true)
  })
})
