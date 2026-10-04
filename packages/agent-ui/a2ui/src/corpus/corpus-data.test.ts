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
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { validateRecord } from './record.ts'
import type { CorpusRecord, ModelVisibleFacet } from './record.ts'
import { validateA2ui } from './validate.ts'
import { canonicalize } from './canonical.ts'
import { admit, checkTier1, recordIdentity } from './admit.ts'
import { createStore } from './store.ts'
import { createDedupIndex } from './dedup.ts'
import { parseVerdictsFile } from './judge.ts'
import { multiTurnRecord, repairRecord, MISSING_TITLE_ERRORS } from './facets.fixture.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { a2uiBasicCatalog } from '../catalog/a2ui-basic/index.ts'
import type { Catalog } from '../catalog/catalog.ts'
import type { SeedCatalogId } from '../examples/types.ts'
import { canvasButtonSeed } from '../examples/canvas-button.ts'
import { basicExemplarSeeds } from '../examples/basic-exemplars.ts'
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

/** The stored canonical hash must match a FRESH recomputation from the record's own streams - catches
 *  a hand-edited a2uiOutput whose meta.canonicalHash was left stale (LLD-C3, SPEC-R6/N6). The
 *  recomputation is admission's own facet identity (`recordIdentity`, ADR-0231): for an exemplar that is
 *  `canonicalize(a2uiOutput)`, byte-identical to before. */
async function hashProblem(rec: CorpusRecord): Promise<string | undefined> {
  if (rec.a2uiOutput === undefined) throw new Error(`${rec.name}: exemplar record has no a2uiOutput`)
  const recomputed = await recordIdentity(rec)
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

  it('a2ui-basic.jsonl holds exactly the GH #1732 exemplar family, every one stamped a2ui-basic (judged by the per-line legs below)', () => {
    const basic = shardLines.filter((l) => l.shard === 'a2ui-basic.jsonl')
    expect(basic).toHaveLength(basicExemplarSeeds.length)
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

// ── ADR-0231 (Acceptance 8): the per-facet legs for the multi-turn and repair shard directories ────────
//
// `corpus/multi-turn/v1_0/` and `corpus/repair/v1_0/` hold `<catalogId>.jsonl` shards exactly as
// `exemplar/v1_0/` does (`computeShardPath`). Both directories are TOLERATED absent: the curation slices
// (GH #1741/#1742) make them real. Every committed line is held to admission's own facet dispatch: the
// shape branch (`validateRecord`), the facet and shard pairing, and for a non-quarantined line
// `checkTier1` (the multi-turn session seed and action grounding; the repair recomputation equality,
// so a validator change that moves a stored verdict reds this gate) plus the identity hash
// (`recordIdentity`). Each directory's leg is also run against a FIXTURE shard built here through
// `admit()` and `store.serialize()`, so the leg is proven to pass a real line and to bite on a tampered
// one before any committed shard exists. Record names stay unique across every facet directory
// (LLD §2 invariant i).

const CORPUS_DIR = `${process.cwd()}/packages/agent-ui/a2ui/corpus`
const NEW_FACETS = ['multi-turn', 'repair'] as const satisfies readonly ModelVisibleFacet[]

/** One shard file's non-blank lines, parsed. */
function parseShardLines(shard: string, text: string): ShardLine[] {
  return text
    .split('\n')
    .map((line, i) => ({ line, lineNo: i + 1 }))
    .filter(({ line }) => line.trim() !== '')
    .map(({ line, lineNo }) => ({ shard, lineNo, rec: JSON.parse(line) as CorpusRecord }))
}

/** Every committed line under `corpus/<facet>/v1_0/`; an absent directory is an empty shelf. */
function facetShardLines(facet: ModelVisibleFacet): { files: string[]; lines: ShardLine[] } {
  const dir = `${CORPUS_DIR}/${facet}/v1_0`
  if (!existsSync(dir)) return { files: [], lines: [] }
  const files = (readdirSync(dir) as string[]).filter((f) => f.endsWith(SHARD_EXT)).sort()
  return { files, lines: files.flatMap((shard) => parseShardLines(shard, readFileSync(`${dir}/${shard}`, 'utf8') as string)) }
}

/** Shard files under a facet directory whose stem names no registered catalog. No shard is required. */
function facetInventoryProblems(files: readonly string[]): string[] {
  return files
    .filter((file) => !Object.hasOwn(CATALOGS, shardStem(file)))
    .map((file) => `shard ${file} names no registered catalog (registered: ${REGISTERED_IDS.join(', ')})`)
}

/** Everything wrong with one line of a facet shard; `[]` = it is what admission would accept today. */
async function facetLineProblems(facet: ModelVisibleFacet, line: ShardLine): Promise<string[]> {
  const { rec } = line
  const where = `${line.shard}:${line.lineNo} ${rec.name}`
  const schema = validateRecord(rec)
  if (schema.length > 0) return [`${where}: validateRecord ${JSON.stringify(schema)}`]
  const problems: string[] = []
  if (rec.meta.facet !== facet) problems.push(`${where}: facet "${rec.meta.facet}" sits in the ${facet} directory`)
  const misfiled = shardProblem(line.shard, rec)
  if (misfiled !== undefined) problems.push(misfiled)
  if (!Object.hasOwn(CATALOGS, rec.meta.catalogId)) return [...problems, `${where}: unregistered catalogId "${rec.meta.catalogId}"`]
  if (rec.meta.status === 'quarantined') return problems
  const tier1 = checkTier1(rec, catalogFor(rec.meta.catalogId))
  if (tier1 !== null) problems.push(`${where}: ${tier1.code} ${tier1.message} ${JSON.stringify(tier1.paths ?? [])}`)
  const stale = await hashProblem(rec)
  if (stale !== undefined) problems.push(stale)
  return problems
}

/** A fixture shard for `facet`, built the way the importer builds one: admit, then serialize. */
async function fixtureShard(facet: ModelVisibleFacet): Promise<ShardLine[]> {
  const deps = { catalog: defaultCatalog, store: createStore(), dedupIndex: createDedupIndex() }
  const candidate = facet === 'multi-turn' ? multiTurnRecord() : repairRecord()
  const admitted = await admit(candidate, deps)
  if (!admitted.ok) throw new Error(`fixture ${candidate.name} did not admit: ${admitted.code} ${admitted.message}`)
  const shard = deps.store.serialize().find((s) => s.path.endsWith(`/${facet}/v1_0/agent-ui${SHARD_EXT}`))
  if (shard === undefined) throw new Error(`no ${facet} shard serialized`)
  return parseShardLines('agent-ui.jsonl', shard.text)
}

const facetShelves = NEW_FACETS.map((facet) => ({ facet, ...facetShardLines(facet) }))

describe('corpus-data - every record name is unique across all facet directories (LLD §2 invariant i)', () => {
  it('no name repeats across exemplar, multi-turn and repair', () => {
    expect(duplicateRecordNames([...records, ...facetShelves.flatMap((s) => s.lines.map((l) => l.rec))])).toEqual([])
  })
})

for (const { facet, files, lines } of facetShelves) {
  describe(`corpus-data - the ${facet} shard directory (ADR-0231, tolerated absent)`, () => {
    it('every shard file names a registered catalog', () => {
      expect(facetInventoryProblems(files)).toEqual([])
    })

    for (const line of lines) {
      it(`${line.shard} line ${line.lineNo}${line.rec.meta.status === 'quarantined' ? ' (quarantined)' : ''} is what admission accepts`, async () => {
        expect(await facetLineProblems(facet, line)).toEqual([])
      })
    }

    it('the leg passes a fixture shard built through admit() + serialize()', async () => {
      const fixture = await fixtureShard(facet)
      expect(fixture).toHaveLength(1)
      expect(await facetLineProblems(facet, fixture[0]!)).toEqual([])
    })

    it('the leg bites: a stale hash, a mis-shelved facet and a mis-filed catalog are each reported', async () => {
      const [line] = await fixtureShard(facet)
      const rec = line!.rec
      const stale = { ...line!, rec: { ...rec, meta: { ...rec.meta, canonicalHash: 'stale' } } }
      expect(await facetLineProblems(facet, stale)).toEqual([expect.stringMatching(/stored hash stale != recomputed/)])
      const other = facet === 'multi-turn' ? 'repair' : 'multi-turn'
      expect(await facetLineProblems(other, line!)).toEqual([expect.stringMatching(new RegExp(`sits in the ${other} directory`))])
      expect(await facetLineProblems(facet, { ...line!, shard: 'a2ui-basic.jsonl' })).toEqual([
        expect.stringMatching(/stamped catalogId "agent-ui" but sits in a2ui-basic\.jsonl/),
      ])
    })
  })
}

describe('corpus-data - the facet legs bite on facet-specific defects (ADR-0231 cl.2/cl.3)', () => {
  // Both edits below also move the record's identity (the action and the error set are identity
  // members), so the stale stored hash is reported alongside the facet-specific defect.
  it('multi-turn: an ungrounded action is reported (E_IDGRAPH)', async () => {
    const [line] = await fixtureShard('multi-turn')
    const rec = line!.rec
    const action = rec.clientInput![0]!
    const ungrounded = { ...rec, clientInput: [{ ...action, action: { ...action.action, sourceComponentId: 'nowhere' } }] }
    expect(await facetLineProblems('multi-turn', { ...line!, rec: ungrounded })).toEqual([
      expect.stringMatching(/^agent-ui\.jsonl:1 .*E_IDGRAPH/),
      expect.stringMatching(/stored hash .* != recomputed/),
    ])
  })

  it('repair: stored validatorErrors that no longer equal the recomputed verdict are reported (E_SCHEMA)', async () => {
    const [line] = await fixtureShard('repair')
    const drifted = { ...line!.rec, validatorErrors: MISSING_TITLE_ERRORS }
    expect(await facetLineProblems('repair', { ...line!, rec: drifted })).toEqual([
      expect.stringMatching(/E_SCHEMA validatorErrors do not equal the recomputed verdict/),
      expect.stringMatching(/stored hash .* != recomputed/),
    ])
  })

  it('a quarantined line skips tier-1 and the hash, never the shape branch', async () => {
    const [line] = await fixtureShard('repair')
    const rec = line!.rec
    const quarantined = { ...rec, validatorErrors: MISSING_TITLE_ERRORS, meta: { ...rec.meta, status: 'quarantined' as const, canonicalHash: 'stale' } }
    expect(await facetLineProblems('repair', { ...line!, rec: quarantined })).toEqual([])
    const broken = { ...quarantined, validatorErrors: [] }
    expect(await facetLineProblems('repair', { ...line!, rec: broken })).toEqual([expect.stringMatching(/validateRecord/)])
  })
})

// ── ADR-0231 cl.5 / Acceptance 6: rubric 1.3 is a runtime bump. The live `version:` marker reads 1.3, a
// new VerdictsFile still citing 1.2 is rejected against it, and every archived VerdictsFile still parses
// under the version it was judged against (the qualified re-author sentence: 1.3 moves no dimension that
// applies to an exemplar, so no archived exemplar verdict is re-authored). ──
const RUBRIC_PATH = `${process.cwd()}/.claude/docs/rubrics/a2ui-corpus.md`
const VERDICTS_DIR = `${CORPUS_DIR}/verdicts`

// 1.4 (GH #1769) is a clarification bump on the same terms: the live marker moves, the 1.3 files stay history.
describe('rubric a2ui-corpus live marker (ADR-0231 cl.5, GH #1769)', () => {
  const rubricText = readFileSync(RUBRIC_PATH, 'utf8')
  const live = /^version:\s*(\S+)\s*$/m.exec(rubricText)?.[1]
  // The versions an archived file may cite: every `N.N = ...` entry of the rubric's own version-history
  // block (the header, before the first `## ` section) plus the live marker. Read from the rubric, never a
  // closed list here, so a file judged under the live version (or under any version a later bump keeps in
  // its history) stays valid without editing this test.
  const header = rubricText.slice(0, rubricText.indexOf('\n## '))
  const knownVersions = new Set([...header.matchAll(/(\d+\.\d+) = /g)].map((m) => m[1]!))
  if (live !== undefined) knownVersions.add(live)
  const verdictsFile = (rubricVersion: string): string =>
    JSON.stringify({ rubric: 'a2ui-corpus', rubricVersion, judgedBy: 'a2ui-review-agent', date: '2026-10-04', verdicts: {} })
  /** The archived-file predicate: cites a version the rubric knows and parses under it. */
  const archivedFileProblems = (file: string, text: string): string[] => {
    const cited = (JSON.parse(text) as { rubricVersion: string }).rubricVersion
    if (!knownVersions.has(cited)) return [`${file}: cites unknown rubric version ${cited}`]
    const parsed = parseVerdictsFile(text, cited)
    return parsed.ok ? [] : [`${file}: ${JSON.stringify(parsed)}`]
  }

  it('the live marker reads 1.4 (the GH #1769 clarification bump)', () => {
    expect(live).toBe('1.4')
  })

  it('the known-version set is read from the rubric history: 1.0 through the live 1.4', () => {
    expect([...knownVersions].sort()).toEqual(['1.0', '1.1', '1.2', '1.3', '1.4'])
  })

  it('an archived file judged under the live version passes; one citing an unknown version is named', () => {
    expect(archivedFileProblems('live.json', verdictsFile(live!))).toEqual([])
    expect(archivedFileProblems('bogus.json', verdictsFile('9.9'))).toEqual(['bogus.json: cites unknown rubric version 9.9'])
  })

  it('parseVerdictsFile accepts a new file citing 1.4 and rejects one still citing 1.3 at rubricVersion', () => {
    expect(parseVerdictsFile(verdictsFile('1.4'), live!).ok).toBe(true)
    const stale = parseVerdictsFile(verdictsFile('1.3'), live!)
    expect(stale.ok).toBe(false)
    if (stale.ok) return
    expect(stale.issues.map((i) => i.path)).toEqual(['rubricVersion'])
  })

  it('every archived VerdictsFile still parses under the version it cites (history, never re-authored)', () => {
    const files = readdirSync(VERDICTS_DIR).filter((f) => f.endsWith('.json'))
    expect(files.length).toBeGreaterThan(0)
    const problems = files.flatMap((file) => archivedFileProblems(file, readFileSync(`${VERDICTS_DIR}/${file}`, 'utf8')))
    expect(problems).toEqual([])
  })
})
