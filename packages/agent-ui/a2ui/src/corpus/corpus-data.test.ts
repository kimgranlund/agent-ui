// corpus-data.test.ts — the standing corpus-data gate (corpus LLD-C15, SPEC-R1/R8; the "package-side
// corpus probe" NEXT item 4 books). Re-validates the COMMITTED shard on every `npm test`: every line
// parses, `validateRecord` returns [], its `a2uiOutput` passes the shared tier-1 validator against the
// default catalog, and the stored `meta.canonicalHash` matches a FRESH recomputation from the record's
// own `a2uiOutput` — so a hand-edited, stale, or corrupted shard fails LOUDLY, never silently. Only
// `tools/corpus/import-seeds.ts`/`rescore.ts` write this file (LLD §2 invariant iv); this gate is
// read-only.
//
// AMENDED (ADR-0068 clause 6, the B1 gate fix): `status:"quarantined"` lines are LEGAL in this shard —
// parse + `validateRecord` + the facet assertion run for EVERY line; the tier-1 + hash-recomputation
// legs run for NON-quarantined lines only (a quarantined record may legitimately no longer validate,
// SPEC-R13 — that is what quarantine records). The old "never quarantined" assertion cited LLD §2
// invariant ii, which is actually FACET-only (a shard holds one facet); consumption-exclusion belongs
// to `store.ts#all()`, not this gate.
//
// Test-only use of `node:fs` (never ships — the `store.test.ts` self-grep precedent; the pure core
// under `src/corpus/` stays node-free, SPEC-N5/ADR-0062).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { validateRecord } from './record.ts'
import type { CorpusRecord } from './record.ts'
import { validateA2ui } from './validate.ts'
import { canonicalize } from './canonical.ts'
import { defaultCatalog } from '../catalog/default/index.ts'

declare const process: { cwd(): string }

const SHARD_PATH = `${process.cwd()}/packages/agent-ui/a2ui/corpus/exemplar/v1_0/agent-ui.jsonl`

function readShardLines(): string[] {
  const text = readFileSync(SHARD_PATH, 'utf8') as string
  return text.split('\n').filter((line) => line.trim() !== '')
}

const lines = readShardLines()
const records = lines.map((line) => JSON.parse(line) as CorpusRecord)

describe('corpus-data — the committed exemplar shard is self-consistent (LLD-C15)', () => {
  it('the shard is non-empty (the seed import actually ran and was committed)', () => {
    expect(lines.length).toBeGreaterThan(0)
  })

  it('every record name is unique (LLD §2 invariant i, the join key across sub-corpora)', () => {
    const names = records.map((r) => r.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('every record in THIS shard is facet:"exemplar" (LLD §2 invariant ii is FACET-only — quarantined lines are LEGAL here, ADR-0068 cl.6)', () => {
    for (const rec of records) {
      expect(rec.meta.facet, rec.name).toBe('exemplar')
    }
  })

  for (const [i, line] of lines.entries()) {
    const rec = JSON.parse(line) as CorpusRecord
    const quarantined = rec.meta.status === 'quarantined'

    it(`line ${i + 1}${quarantined ? ' (quarantined)' : ''} parses + validates + facet holds`, () => {
      // Schema/field + pin re-check (LLD-C2) — legal for EVERY line, quarantined or not (ADR-0068
      // cl.6): a hand-edited status flip is still caught by validateRecord's status enum.
      expect(validateRecord(rec), rec.name).toEqual([])
      expect(rec.meta.facet, rec.name).toBe('exemplar')
    })

    // Tier-1 + hash-recomputation run for NON-quarantined lines only — a quarantined record may
    // legitimately no longer validate against the current catalog (that is what quarantine records,
    // SPEC-R13/ADR-0068 cl.6); re-asserting it here would make the standing gate fight the very state
    // it exists to tolerate.
    if (!quarantined) {
      it(`line ${i + 1} tier-1 passes + its hash matches recomputation`, async () => {
        if (rec.a2uiOutput === undefined) throw new Error(`${rec.name}: exemplar record has no a2uiOutput`)

        // Tier-1 (LLD-C6, the SAME shared validator admission itself used — parity, SPEC-N1).
        const verdict = validateA2ui(rec.a2uiOutput, defaultCatalog)
        expect(verdict.valid, `${rec.name} tier-1 failures: ${JSON.stringify(verdict.failures)}`).toBe(true)

        // The stored canonical hash must match a FRESH recomputation from the record's own a2uiOutput —
        // catches a hand-edited a2uiOutput whose meta.canonicalHash was left stale (LLD-C3, SPEC-R6/N6).
        const recomputed = await canonicalize(rec.a2uiOutput)
        expect(rec.meta.canonicalHash, rec.name).toBe(recomputed.hash)
      })
    }
  }
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
