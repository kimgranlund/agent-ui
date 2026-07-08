// shard.test.ts — S2 checkpoint (LLD-C2): canonical serialize two-run identity, total parse, quarantine
// exclusion.
import { describe, expect, it } from 'vitest'
import { admittedRecords, parseShard, serializeRecord, serializeShard, shardPath } from './shard.ts'
import type { A2aCorpusRecord } from './record.ts'

function rec(name: string, status: 'valid' | 'quarantined' = 'valid'): A2aCorpusRecord {
  return {
    name,
    description: 'd',
    body: 'b',
    citations: [{ kind: 'repo', path: 'packages/agent-ui/a2a/src/index.ts' }],
    wire: [{ kind: 'message', artifact: { kind: 'message', role: 'user', parts: [{ kind: 'text', text: 'hi' }], messageId: 'm1' } }],
    meta: { facet: 'concept', protocolVersion: '0.3.0', provenance: { source: 'authored', origin: 'test' }, status },
  }
}

describe('shardPath (LLD-C2/§4)', () => {
  it('computes the file-safe pin dir', () => {
    expect(shardPath('concept', '0.3.0')).toBe('packages/agent-ui/a2a/corpus/concept/v0_3_0/a2a.jsonl')
    expect(shardPath('demo', '0.3.0')).toBe('packages/agent-ui/a2a/corpus/demo/v0_3_0/a2a.jsonl')
  })
})

describe('parseShard — total (LLD-C2)', () => {
  it('parses well-formed lines and skips blank lines', () => {
    const text = `${JSON.stringify(rec('a'))}\n\n${JSON.stringify(rec('b'))}\n`
    const { records, failures } = parseShard(text)
    expect(failures).toEqual([])
    expect(records.map((r) => r.name)).toEqual(['a', 'b'])
  })

  it('an empty shard text parses to zero records, zero failures', () => {
    expect(parseShard('')).toEqual({ records: [], failures: [] })
  })

  it('never throws on a malformed line — reports a line-indexed E_SCHEMA failure instead', () => {
    const text = `${JSON.stringify(rec('a'))}\nnot json at all\n${JSON.stringify(rec('b'))}\n`
    let result: ReturnType<typeof parseShard> | undefined
    expect(() => {
      result = parseShard(text)
    }).not.toThrow()
    expect(result!.failures).toEqual([{ code: 'E_SCHEMA', path: 'line 2', detail: expect.any(String) }])
    expect(result!.records.map((r) => r.name)).toEqual(['a', 'b'])
  })
})

describe('serializeRecord / serializeShard — canonical, two-run identity (LLD-C2/§4)', () => {
  it('recursively sorts keys regardless of input key order', () => {
    const a = rec('a')
    const shuffled = { meta: a.meta, wire: a.wire, name: a.name, citations: a.citations, description: a.description, body: a.body }
    expect(serializeRecord(shuffled as unknown as A2aCorpusRecord)).toBe(serializeRecord(a))
  })

  it('serializeRecord(JSON.parse(line)) === line — the byte-stability identity the standing gate checks', () => {
    const line = serializeRecord(rec('a'))
    const roundTripped = serializeRecord(JSON.parse(line) as A2aCorpusRecord)
    expect(roundTripped).toBe(line)
  })

  it('two runs over the SAME records produce byte-identical shard text', () => {
    const records = [rec('a'), rec('b'), rec('c')]
    expect(serializeShard(records)).toBe(serializeShard([...records]))
  })

  it('serializeShard preserves GIVEN order (authoring order), one line per record, trailing newline', () => {
    const text = serializeShard([rec('b'), rec('a')])
    const lines = text.split('\n').filter((l) => l.length > 0)
    expect(lines.map((l) => (JSON.parse(l) as A2aCorpusRecord).name)).toEqual(['b', 'a'])
    expect(text.endsWith('\n')).toBe(true)
  })

  it('an empty record list serializes to an empty string', () => {
    expect(serializeShard([])).toBe('')
  })

  it('parseShard(serializeShard(records)) round-trips the same names in the same order', () => {
    const records = [rec('x'), rec('y')]
    const { records: parsed, failures } = parseShard(serializeShard(records))
    expect(failures).toEqual([])
    expect(parsed.map((r) => r.name)).toEqual(['x', 'y'])
  })
})

describe('admittedRecords — the consumption filter (LLD-C2)', () => {
  it('excludes status:"quarantined", keeps "valid"', () => {
    const records = [rec('a', 'valid'), rec('b', 'quarantined'), rec('c', 'valid')]
    expect(admittedRecords(records).map((r) => r.name)).toEqual(['a', 'c'])
  })

  it('an all-quarantined set admits nothing', () => {
    expect(admittedRecords([rec('a', 'quarantined')])).toEqual([])
  })
})
