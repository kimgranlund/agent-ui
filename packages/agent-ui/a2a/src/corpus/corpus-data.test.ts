// corpus-data.test.ts — the standing corpus-data gate (corpus LLD-C7, SPEC-R14 AC1). Re-validates the
// COMMITTED shards on every `npm test`: existence/floor counts, the join-key/facet invariants, per-line
// schema+pin+citation-shape (via the SAME `admitRecord` pipeline the import tool uses — no fork),
// per-line canonical-line-identity (byte-stability WITHOUT a hash, LLD §4), and — for every
// non-quarantined line — citation resolution + the full replay arm (again via `admitRecord`, reusing the
// REAL `validateA2a`/`validateTranscript`/`checkIsolation` the arena itself is gated on). Only
// `tools/corpus/import-seeds.ts` writes these files (LLD §3 single-writer invariant); this gate is
// read-only.
//
// The HV-ledger leg (LLD §4 hardening, the sanctioned-with-hardening review ruling): resolves `hv`
// citations by reading `.claude/docs/spec/a2a-foundations.spec.md` via the ONE exported path constant
// (`../../tools/corpus/ledger-path.ts`) the import tool ALSO imports — a SPEC move is then a one-line
// greppable fix, and the dependency is named in the failure message, never a bare ENOENT.
//
// Red-control legs (LLD §4 leg 6): planted fixtures (never the real shard) prove each leg above FIRES —
// a stale re-keyed line, a dangling HV cite, a dangling repo path, and a flipped transcript expectation.
//
// Test-only use of `node:fs` (never ships — the a2ui `corpus-data.test.ts` precedent; the pure core
// under `src/corpus/` stays node-free, SPEC-N1).

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { admitRecord } from './admit.ts'
import type { AdmitDeps } from './admit.ts'
import { admittedRecords, parseShard, serializeRecord, shardPath } from './shard.ts'
import type { A2aCitation, A2aCorpusRecord } from './record.ts'
import { PROTOCOL_VERSION } from '../protocol/types.ts'
import { LEDGER_PATH, isHvRowResolved } from '../../tools/corpus/ledger-path.ts'

declare const process: { cwd(): string }

const REPO_ROOT = process.cwd()
const CONCEPT_PATH = `${REPO_ROOT}/${shardPath('concept', PROTOCOL_VERSION)}`
const DEMO_PATH = `${REPO_ROOT}/${shardPath('demo', PROTOCOL_VERSION)}`

function readText(path: string): string {
  return readFileSync(path, 'utf8') as string
}

function nonBlankLines(text: string): string[] {
  return text.split('\n').filter((l) => l.trim() !== '')
}

const conceptText = readText(CONCEPT_PATH)
const demoText = readText(DEMO_PATH)
const conceptLines = nonBlankLines(conceptText)
const demoLines = nonBlankLines(demoText)

type LedgerRead = { ok: true; text: string } | { ok: false; message: string }

function readLedger(): LedgerRead {
  try {
    return { ok: true, text: readText(`${REPO_ROOT}/${LEDGER_PATH}`) }
  } catch (e) {
    return { ok: false, message: `HV-ledger resolution requires ${LEDGER_PATH} — did the SPEC move/rename? (${String(e)})` }
  }
}
const ledger = readLedger()

/** The REAL deps the standing gate re-validates against — identical resolution rules to
 * `tools/corpus/import-seeds.ts`, so a citation or replay defect that would fail admission at import
 * time fails HERE too, on every `npm test`, over the COMMITTED bytes. */
function realDeps(): AdmitDeps {
  return {
    protocolVersion: PROTOCOL_VERSION,
    resolveCitation: (c: A2aCitation) =>
      c.kind === 'repo' ? (existsSync(`${REPO_ROOT}/${c.path}`) as boolean) : ledger.ok && isHvRowResolved(ledger.text, c.row),
    loadTranscript: (path: string) => {
      const full = `${REPO_ROOT}/${path}`
      if (!(existsSync(full) as boolean)) return undefined
      try {
        return readText(full)
      } catch {
        return undefined
      }
    },
  }
}

describe('the HV-ledger dependency (LLD §4 hardening)', () => {
  it(`resolves at ${LEDGER_PATH} — a SPEC move must fail loudly naming this path, never a bare ENOENT`, () => {
    expect(ledger.ok, ledger.ok ? undefined : ledger.message).toBe(true)
  })
})

describe('corpus-data — shard floors + invariants (LLD-C7, SPEC-R14 AC1)', () => {
  it('both shards exist and are non-empty', () => {
    expect(conceptLines.length).toBeGreaterThan(0)
    expect(demoLines.length).toBeGreaterThan(0)
  })

  it('concept count >= 6 and demo count >= 1 (the PRD-G3 target floor as an executable predicate)', () => {
    expect(conceptLines.length).toBeGreaterThanOrEqual(6)
    expect(demoLines.length).toBeGreaterThanOrEqual(1)
  })

  it('every line in the concept shard parses with zero E_SCHEMA parse failures', () => {
    expect(parseShard(conceptText).failures).toEqual([])
  })

  it('every line in the demo shard parses with zero E_SCHEMA parse failures', () => {
    expect(parseShard(demoText).failures).toEqual([])
  })

  const conceptRecords = parseShard(conceptText).records
  const demoRecords = parseShard(demoText).records

  it('name is unique across BOTH shards (the join-key invariant)', () => {
    const names = [...conceptRecords, ...demoRecords].map((r) => r.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('every record in the concept shard is facet:"concept"; every record in the demo shard is facet:"demo"', () => {
    for (const rec of conceptRecords) expect(rec.meta.facet, rec.name).toBe('concept')
    for (const rec of demoRecords) expect(rec.meta.facet, rec.name).toBe('demo')
  })
})

describe.each([
  ['concept', CONCEPT_PATH] as const,
  ['demo', DEMO_PATH] as const,
])('corpus-data — %s shard, per-line legs (LLD-C7)', (facetLabel, path) => {
  const text = readText(path)
  const lines = nonBlankLines(text)

  for (const [i, line] of lines.entries()) {
    const rec = JSON.parse(line) as A2aCorpusRecord
    const quarantined = rec.meta.status === 'quarantined'
    const label = `${facetLabel} line ${i + 1} (${rec.name}${quarantined ? ', quarantined' : ''})`

    it(`${label}: the canonical-line identity holds (serializeRecord(JSON.parse(line)) === line)`, () => {
      expect(serializeRecord(rec), rec.name).toBe(line)
    })

    it(`${label}: admits through the SAME pipeline import-seeds.ts uses (schema/pin/cite-shape always; resolution+replay unless quarantined)`, () => {
      const result = admitRecord(rec, realDeps())
      expect(result.admitted, result.admitted ? undefined : JSON.stringify(result.failures)).toBe(true)
    })
  }
})

describe('corpus-data — the isolation-gate concept record keeps the arena\'s must-fail controls standing', () => {
  it('the isolation-gate record (#10) carries BOTH contaminated fixtures as expect:"contaminated" — re-proving the arena\'s negative controls still fail on every test run', () => {
    const conceptRecords = parseShard(conceptText).records
    const rec = conceptRecords.find((r) => r.name === 'isolation-gate')
    expect(rec).toBeDefined()
    const transcriptWires = rec!.wire.filter((w) => w.kind === 'transcript')
    expect(transcriptWires.length).toBeGreaterThanOrEqual(2)
    for (const w of transcriptWires) expect(w.expect, (w as { path: string }).path).toBe('contaminated')
    // admitRecord (above, per-line loop) already re-ran validateTranscript+checkIsolation over these
    // exact committed fixtures and asserted the record still admits — i.e. both fixtures still FAIL
    // isolation, matching their declared expectation, on every `npm test`.
  })
})

describe('consumption — admittedRecords excludes any quarantined line (none exist in the real shard today)', () => {
  it('every record in both committed shards is currently status:"valid"', () => {
    const all = [...parseShard(conceptText).records, ...parseShard(demoText).records]
    expect(admittedRecords(all).length).toBe(all.length)
  })
})

// ── red-control legs (LLD §4 leg 6) — PLANTED fixtures, never the real shard ─────────────────────────
// Each leg below proves the corresponding standing-gate check FIRES: a green run over any of these would
// be a suite failure, mirroring the arena's own negative-control doctrine applied to the corpus gate.

function plantedRecord(overrides: Partial<A2aCorpusRecord> = {}): A2aCorpusRecord {
  return {
    name: 'planted-record',
    description: 'd',
    body: 'b',
    citations: [{ kind: 'repo', path: 'packages/agent-ui/a2a/src/index.ts' }],
    wire: [{ kind: 'message', artifact: { kind: 'message', role: 'user', parts: [{ kind: 'text', text: 'hi' }], messageId: 'm1' } }],
    meta: { facet: 'concept', protocolVersion: PROTOCOL_VERSION, provenance: { source: 'authored', origin: 'test-fixture' }, status: 'valid' },
    ...overrides,
  }
}

describe('red-control legs (LLD §4 leg 6) — the gate proven to bite, in this same file', () => {
  it('a stale re-keyed line FAILS the canonical-line-identity leg', () => {
    const rec = plantedRecord()
    const canonicalLine = serializeRecord(rec)
    // Hand-mutate: re-key with an unsorted, whitespace-padded form — still valid JSON, NOT canonical.
    const staleLine = JSON.stringify(rec, null, 2)
    expect(staleLine).not.toBe(canonicalLine) // sanity: the mutation actually changed the bytes
    expect(serializeRecord(JSON.parse(staleLine) as A2aCorpusRecord)).not.toBe(staleLine)
  })

  it('a dangling HV cite FAILS admission with E_CITE (against the REAL ledger)', () => {
    const rec = plantedRecord({ citations: [{ kind: 'hv', row: 'HV-999-DOES-NOT-EXIST' }] })
    const result = admitRecord(rec, realDeps())
    expect(result.admitted).toBe(false)
    if (!result.admitted) expect(result.failures).toEqual([{ code: 'E_CITE', path: 'citations[0]', detail: expect.any(String) }])
  })

  it('a dangling repo path FAILS admission with E_CITE (against the REAL filesystem)', () => {
    const rec = plantedRecord({ citations: [{ kind: 'repo', path: 'packages/agent-ui/a2a/src/NOPE-DOES-NOT-EXIST.ts' }] })
    const result = admitRecord(rec, realDeps())
    expect(result.admitted).toBe(false)
    if (!result.admitted) expect(result.failures).toEqual([{ code: 'E_CITE', path: 'citations[0]', detail: expect.any(String) }])
  })

  it('a flipped transcript expectation FAILS admission with E_REPLAY — against a REAL committed fixture', () => {
    // scripted.match.jsonl is REALLY clean (SPEC-R12 AC1) — declaring "contaminated" is the mismatch.
    const rec = plantedRecord({
      citations: [{ kind: 'repo', path: 'packages/agent-ui/a2a/matches/scripted.match.jsonl' }],
      wire: [{ kind: 'transcript', path: 'packages/agent-ui/a2a/matches/scripted.match.jsonl', expect: 'contaminated' }],
    })
    const result = admitRecord(rec, realDeps())
    expect(result.admitted).toBe(false)
    if (!result.admitted) {
      expect(result.failures).toEqual([{ code: 'E_REPLAY', path: 'wire[0]', detail: expect.any(String) }])
      expect(result.failures[0]!.detail).toMatch(/stale negative control/)
    }
  })
})

describe('quarantine legs (LLD §3/§4) — planted fixtures, never the real shard', () => {
  it('a planted quarantined record with a genuinely dangling citation still ADMITS — resolution is skipped, proving the skip is load-bearing, not a no-op', () => {
    const rec = plantedRecord({
      citations: [{ kind: 'repo', path: 'packages/agent-ui/a2a/src/NOPE-DOES-NOT-EXIST.ts' }],
      meta: { facet: 'concept', protocolVersion: PROTOCOL_VERSION, provenance: { source: 'authored', origin: 'test-fixture' }, status: 'quarantined' },
    })
    const result = admitRecord(rec, realDeps())
    expect(result.admitted).toBe(true)
  })

  it('a planted quarantined record with a genuine schema defect still FAILS the gate (no blanket exemption)', () => {
    const rec = plantedRecord({ meta: { facet: 'concept', protocolVersion: PROTOCOL_VERSION, provenance: { source: 'authored', origin: 'test-fixture' }, status: 'quarantined' } }) as unknown as Record<string, unknown>
    delete rec.body // E_SCHEMA — quarantine never exempts container-shape checks
    const result = admitRecord(rec, realDeps())
    expect(result.admitted).toBe(false)
    if (!result.admitted) expect(result.failures.some((f) => f.path === 'body')).toBe(true)
  })
})
