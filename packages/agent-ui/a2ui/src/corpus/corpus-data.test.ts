// corpus-data.test.ts — the standing corpus-data gate (corpus LLD-C15, SPEC-R1/R8; the "package-side
// corpus probe" NEXT item 4 books). Re-validates the COMMITTED shard on every `npm test`: every line
// parses, `validateRecord` returns [], its `a2uiOutput` passes the shared tier-1 validator against the
// default catalog, and the stored `meta.canonicalHash` matches a FRESH recomputation from the record's
// own `a2uiOutput` — so a hand-edited, stale, or corrupted shard fails LOUDLY, never silently. Only
// `tools/corpus/import-seeds.ts` writes this file (LLD §2 invariant iv); this gate is read-only.
//
// Test-only use of `node:fs` (never ships — the `store.test.ts` self-grep precedent; the pure core
// under `src/corpus/` stays node-free, SPEC-N5/ADR-0062).

import { describe, it, expect } from 'vitest'
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
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

  it('every record in THIS shard is facet:"exemplar" and never quarantined (LLD §2 invariant ii)', () => {
    for (const rec of records) {
      expect(rec.meta.facet, rec.name).toBe('exemplar')
      expect(rec.meta.status, rec.name).not.toBe('quarantined')
    }
  })

  for (const [i, line] of lines.entries()) {
    it(`line ${i + 1} parses + validates + tier-1 passes + its hash matches recomputation`, async () => {
      const rec = JSON.parse(line) as CorpusRecord

      // Schema/field + pin re-check (LLD-C2) — a hand-edit could otherwise silently break the record.
      expect(validateRecord(rec), rec.name).toEqual([])

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
})
