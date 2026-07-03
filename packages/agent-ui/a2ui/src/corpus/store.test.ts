import { describe, it, expect } from 'vitest'
// Read our OWN source text as a zero-dep trip-wire (SPEC-N5 / ADR-0062 acceptance: "no module under
// src/corpus/ imports node:*"). Test-only use of `node:fs` is fine — it never ships (same pattern as
// `controls/barrels.test.ts`'s package.json/CSS-barrel text probes).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
import { createStore } from './store.ts'
import type { ShardText } from './store.ts'
import type { CorpusRecord } from './record.ts'

declare const process: { cwd(): string }

// store.test.ts — the pure store core (corpus LLD-C1, SPEC-R1/R3/R9, ADR-0062).

function mkRecord(name: string, metaOverrides: Partial<CorpusRecord['meta']> = {}): CorpusRecord {
  return {
    name,
    description: `a sample record named ${name}`,
    promptText: 'build me a button',
    a2uiOutput: [{ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } }],
    meta: {
      facet: 'exemplar',
      protocolVersion: 'v1.0',
      catalogId: 'agent-ui',
      provenance: { source: 'authored', origin: 'test-fixture' },
      status: 'valid',
      ...metaOverrides,
    },
  }
}

describe('createStore — the pure store core (LLD-C1)', () => {
  describe('shardPath — facet + protocolVersion + catalogId → the repo-relative path (ADR-0062)', () => {
    it("maps a v1.0 exemplar record's pin dir 'v1.0' → 'v1_0'", () => {
      const store = createStore()
      const rec = mkRecord('a', { facet: 'exemplar', protocolVersion: 'v1.0', catalogId: 'agent-ui' })
      expect(store.shardPath(rec)).toBe('packages/agent-ui/a2ui/corpus/exemplar/v1_0/agent-ui.jsonl')
    })

    it("maps a v0.9.1 eval record's pin dir 'v0.9.1' → 'v0_9_1' with the .jsonl.enc extension", () => {
      const store = createStore()
      const rec = mkRecord('b', { facet: 'eval', protocolVersion: 'v0.9.1', catalogId: 'demo' })
      expect(store.shardPath(rec)).toBe('packages/agent-ui/a2ui/corpus/eval/v0_9_1/demo.jsonl.enc')
    })
  })

  describe('parse-time facet/shard invariant (ii)', () => {
    it('a facet/shard mismatch is rejected at parse', () => {
      const evalRecordUnderExemplarShard: ShardText = {
        path: 'packages/agent-ui/a2ui/corpus/exemplar/v1_0/agent-ui.jsonl',
        text: `${JSON.stringify(mkRecord('mismatched', { facet: 'eval' }))}\n`,
      }
      expect(() => createStore([evalRecordUnderExemplarShard])).toThrow(/facet\/shard mismatch/)
    })

    it('a shard whose path implies no facet (e.g. index.json) is not parsed as a record shard', () => {
      const notAShard: ShardText = {
        path: 'packages/agent-ui/a2ui/corpus/index.json',
        text: `${JSON.stringify(mkRecord('should-not-appear'))}\n`,
      }
      const store = createStore([notAShard])
      expect(store.get('should-not-appear')).toBeUndefined()
      expect(store.all()).toEqual([])
    })
  })

  describe('byte-stable JSONL round-trip', () => {
    it('createStore(serialize()) reproduces the identical ShardText[] (one record per line, stable key order)', () => {
      const store = createStore()
      store.put(mkRecord('b-record', { canonicalHash: 'hash-b' }))
      store.put(mkRecord('a-record', { canonicalHash: 'hash-a' }))
      store.put(mkRecord('eval-record', { facet: 'eval', protocolVersion: 'v0.9.1', catalogId: 'demo' }))

      const first = store.serialize()
      const rebuilt = createStore(first)
      const second = rebuilt.serialize()

      expect(second).toEqual(first)
    })

    it('each shard is one JSON object per line with no trailing insignificant content', () => {
      const store = createStore()
      store.put(mkRecord('one'))
      store.put(mkRecord('two'))
      const shards = store.serialize()
      const exemplarShard = shards.find((s) => s.path.endsWith('agent-ui.jsonl'))
      expect(exemplarShard).toBeDefined()
      const lines = exemplarShard!.text.split('\n').filter((l) => l !== '')
      expect(lines).toHaveLength(2)
      for (const line of lines) expect(() => JSON.parse(line)).not.toThrow()
    })

    it('re-serializing the SAME store twice yields byte-identical text (pure function of content)', () => {
      const store = createStore()
      store.put(mkRecord('x'))
      expect(store.serialize()).toEqual(store.serialize())
    })
  })

  describe('index.json — derived and regenerable (never the source of truth)', () => {
    it('serialize() emits an index.json shaped {byCanonicalHash, byCatalogId, counts}', () => {
      const store = createStore()
      store.put(mkRecord('a', { canonicalHash: 'hash-a', catalogId: 'agent-ui', status: 'valid' }))
      store.put(mkRecord('b', { canonicalHash: 'hash-b', catalogId: 'agent-ui', status: 'repaired' }))

      const shards = store.serialize()
      const indexShard = shards.find((s) => s.path === 'packages/agent-ui/a2ui/corpus/index.json')
      expect(indexShard).toBeDefined()

      const index = JSON.parse(indexShard!.text)
      expect(index.byCanonicalHash).toEqual({ 'hash-a': 'a', 'hash-b': 'b' })
      expect(index.byCatalogId).toEqual({ 'agent-ui': ['a', 'b'] })
      expect(index.counts.total).toBe(2)
      expect(index.counts.byFacet).toEqual({ exemplar: 2, eval: 0 })
      expect(index.counts.byStatus).toEqual({ valid: 1, repaired: 1, quarantined: 0 })
    })

    it('a record with no canonicalHash yet is simply absent from byCanonicalHash (not a null/undefined entry)', () => {
      const store = createStore()
      store.put(mkRecord('no-hash-yet'))
      const index = JSON.parse(store.serialize().find((s) => s.path.endsWith('index.json'))!.text)
      expect(index.byCanonicalHash).toEqual({})
    })

    it('is regenerated fresh, never passed through — a bogus index.json handed in is ignored and overwritten', () => {
      const bogusIndex: ShardText = {
        path: 'packages/agent-ui/a2ui/corpus/index.json',
        text: JSON.stringify({ byCanonicalHash: { garbage: 'in' }, byCatalogId: {}, counts: { total: 999 } }),
      }
      const realShard: ShardText = {
        path: 'packages/agent-ui/a2ui/corpus/exemplar/v1_0/agent-ui.jsonl',
        text: `${JSON.stringify(mkRecord('real', { canonicalHash: 'real-hash' }))}\n`,
      }
      const store = createStore([bogusIndex, realShard])
      const index = JSON.parse(store.serialize().find((s) => s.path.endsWith('index.json'))!.text)
      expect(index.counts.total).toBe(1)
      expect(index.byCanonicalHash).toEqual({ 'real-hash': 'real' })
    })
  })

  describe('all() — the consumption surface excludes status:"quarantined"; get() does not (LLD §2)', () => {
    it('all() omits quarantined records; get() still returns them (a raw accessor)', () => {
      const store = createStore()
      store.put(mkRecord('kept', { status: 'valid' }))
      store.put(mkRecord('healed', { status: 'repaired' }))
      store.put(mkRecord('hidden', { status: 'quarantined' }))

      expect(store.all().map((r) => r.name).sort()).toEqual(['healed', 'kept'])
      expect(store.get('hidden')).toBeDefined()
      expect(store.get('hidden')!.meta.status).toBe('quarantined')
    })

    it('all(filter) scopes by facet/catalogId/protocolVersion, composed with the quarantine exclusion', () => {
      const store = createStore()
      store.put(mkRecord('exemplar-agent-ui', { facet: 'exemplar', catalogId: 'agent-ui' }))
      store.put(mkRecord('exemplar-demo', { facet: 'exemplar', catalogId: 'demo' }))
      store.put(mkRecord('eval-agent-ui', { facet: 'eval', catalogId: 'agent-ui' }))
      store.put(mkRecord('quarantined-agent-ui', { facet: 'exemplar', catalogId: 'agent-ui', status: 'quarantined' }))

      expect(store.all({ catalogId: 'agent-ui' }).map((r) => r.name).sort()).toEqual(['eval-agent-ui', 'exemplar-agent-ui'])
      expect(store.all({ facet: 'eval' }).map((r) => r.name)).toEqual(['eval-agent-ui'])
      expect(store.all({ facet: 'exemplar', catalogId: 'agent-ui' }).map((r) => r.name)).toEqual(['exemplar-agent-ui'])
    })

    it('an empty store returns [] from all() and undefined from get()', () => {
      const store = createStore()
      expect(store.all()).toEqual([])
      expect(store.get('nothing')).toBeUndefined()
    })
  })

  describe('all({includeQuarantined}) — the storage-integrity read (ADR-0068 cl.5a)', () => {
    it('default (or explicit false) excludes quarantined — byte-identical to the pre-existing behavior', () => {
      const store = createStore()
      store.put(mkRecord('kept', { status: 'valid' }))
      store.put(mkRecord('hidden', { status: 'quarantined' }))

      const noArg = store.all()
      const explicitFalse = store.all({ includeQuarantined: false })
      expect(noArg.map((r) => r.name)).toEqual(['kept'])
      expect(explicitFalse).toEqual(noArg)
    })

    it('includeQuarantined:true includes them, composed with the other filters', () => {
      const store = createStore()
      store.put(mkRecord('kept', { status: 'valid', facet: 'exemplar', catalogId: 'agent-ui' }))
      store.put(mkRecord('hidden', { status: 'quarantined', facet: 'exemplar', catalogId: 'agent-ui' }))
      store.put(mkRecord('other-catalog-hidden', { status: 'quarantined', facet: 'exemplar', catalogId: 'demo' }))

      expect(
        store
          .all({ includeQuarantined: true })
          .map((r) => r.name)
          .sort(),
      ).toEqual(['hidden', 'kept', 'other-catalog-hidden'])
      expect(
        store
          .all({ includeQuarantined: true, catalogId: 'agent-ui' })
          .map((r) => r.name)
          .sort(),
      ).toEqual(['hidden', 'kept'])
    })
  })

  describe('put() — the single in-memory write, upserts by name', () => {
    it('a second put() with the same name overwrites the first', () => {
      const store = createStore()
      store.put(mkRecord('same-name', { status: 'valid' }))
      store.put(mkRecord('same-name', { status: 'repaired' }))
      expect(store.all()).toHaveLength(1)
      expect(store.get('same-name')!.meta.status).toBe('repaired')
    })
  })

  it('zero node:* imports under this module (SPEC-N5 / ADR-0062)', () => {
    const source = readFileSync(`${process.cwd()}/packages/agent-ui/a2ui/src/corpus/store.ts`, 'utf8') as string
    expect(source).not.toMatch(/from ['"]node:/)
    expect(source).not.toMatch(/require\(['"]node:/)
  })
})
