// record.test.ts — S1 checkpoint (LLD-C1): totality over malformed inputs, exact code+path fixtures per
// E_SCHEMA/E_PIN/E_CITE (the three codes this module owns — E_REPLAY belongs to admit.ts, S3).
import { describe, expect, it } from 'vitest'
import { validateCorpusRecord } from './record.ts'
import type { A2aCorpusRecord } from './record.ts'

const PIN = '0.3.0'

function validRecord(): A2aCorpusRecord {
  return {
    name: 'a-record',
    description: 'a one-line summary',
    body: 'teaching prose',
    citations: [{ kind: 'hv', row: 'HV-4' }],
    wire: [{ kind: 'message', artifact: { kind: 'message', role: 'user', parts: [{ kind: 'text', text: 'hi' }], messageId: 'm1' } }],
    meta: {
      facet: 'concept',
      protocolVersion: PIN,
      provenance: { source: 'authored', origin: 'test-fixture' },
      status: 'valid',
    },
  }
}

describe('validateCorpusRecord — totality (LLD-C1)', () => {
  it('never throws on wildly malformed input', () => {
    for (const bad of [null, undefined, 42, 'a string', [], () => {}, Symbol('x')]) {
      expect(() => validateCorpusRecord(bad, { protocolVersion: PIN })).not.toThrow()
    }
  })

  it('a non-object candidate yields exactly one E_SCHEMA at the root', () => {
    expect(validateCorpusRecord(null, { protocolVersion: PIN })).toEqual([
      { code: 'E_SCHEMA', path: '', detail: expect.any(String) },
    ])
  })

  it('the valid fixture passes clean', () => {
    expect(validateCorpusRecord(validRecord(), { protocolVersion: PIN })).toEqual([])
  })

  it('an unknown top-level key is E_SCHEMA at that key', () => {
    const rec = { ...validRecord(), extra: 'nope' }
    const failures = validateCorpusRecord(rec, { protocolVersion: PIN })
    expect(failures).toContainEqual({ code: 'E_SCHEMA', path: 'extra', detail: expect.any(String) })
  })

  it('an unknown meta key is E_SCHEMA at meta.<key>', () => {
    const rec = { ...validRecord(), meta: { ...validRecord().meta, extra: 'nope' } }
    const failures = validateCorpusRecord(rec, { protocolVersion: PIN })
    expect(failures).toContainEqual({ code: 'E_SCHEMA', path: 'meta.extra', detail: expect.any(String) })
  })
})

describe('E_SCHEMA — container shape (LLD-C1)', () => {
  it('missing name/description/body each fail E_SCHEMA at their own path', () => {
    const rec = validRecord() as unknown as Record<string, unknown>
    delete rec.name
    delete rec.description
    delete rec.body
    const failures = validateCorpusRecord(rec, { protocolVersion: PIN })
    expect(failures).toContainEqual({ code: 'E_SCHEMA', path: 'name', detail: expect.any(String) })
    expect(failures).toContainEqual({ code: 'E_SCHEMA', path: 'description', detail: expect.any(String) })
    expect(failures).toContainEqual({ code: 'E_SCHEMA', path: 'body', detail: expect.any(String) })
  })

  it('a bad facet vocab fails E_SCHEMA at meta.facet', () => {
    const rec = { ...validRecord(), meta: { ...validRecord().meta, facet: 'nonsense' } }
    const failures = validateCorpusRecord(rec, { protocolVersion: PIN })
    expect(failures).toContainEqual({ code: 'E_SCHEMA', path: 'meta.facet', detail: expect.any(String) })
  })

  it('a bad status vocab fails E_SCHEMA at meta.status', () => {
    const rec = { ...validRecord(), meta: { ...validRecord().meta, status: 'nonsense' } }
    const failures = validateCorpusRecord(rec, { protocolVersion: PIN })
    expect(failures).toContainEqual({ code: 'E_SCHEMA', path: 'meta.status', detail: expect.any(String) })
  })

  it('a bad provenance.source vocab fails E_SCHEMA at meta.provenance.source', () => {
    const rec = { ...validRecord(), meta: { ...validRecord().meta, provenance: { source: 'nonsense', origin: 'x' } } }
    const failures = validateCorpusRecord(rec, { protocolVersion: PIN })
    expect(failures).toContainEqual({ code: 'E_SCHEMA', path: 'meta.provenance.source', detail: expect.any(String) })
  })

  it('an empty provenance.origin fails E_SCHEMA at meta.provenance.origin', () => {
    const rec = { ...validRecord(), meta: { ...validRecord().meta, provenance: { source: 'authored', origin: '' } } }
    const failures = validateCorpusRecord(rec, { protocolVersion: PIN })
    expect(failures).toContainEqual({ code: 'E_SCHEMA', path: 'meta.provenance.origin', detail: expect.any(String) })
  })

  it('an empty wire array fails E_SCHEMA at wire', () => {
    const rec = { ...validRecord(), wire: [] }
    const failures = validateCorpusRecord(rec, { protocolVersion: PIN })
    expect(failures).toContainEqual({ code: 'E_SCHEMA', path: 'wire', detail: expect.any(String) })
  })

  it('an unknown wire kind fails E_SCHEMA at wire[i].kind', () => {
    const rec = { ...validRecord(), wire: [{ kind: 'bogus', artifact: {} }] }
    const failures = validateCorpusRecord(rec, { protocolVersion: PIN })
    expect(failures).toContainEqual({ code: 'E_SCHEMA', path: 'wire[0].kind', detail: expect.any(String) })
  })

  it('an inline wire entry with no artifact fails E_SCHEMA at wire[i].artifact', () => {
    const rec = { ...validRecord(), wire: [{ kind: 'message' }] }
    const failures = validateCorpusRecord(rec, { protocolVersion: PIN })
    expect(failures).toContainEqual({ code: 'E_SCHEMA', path: 'wire[0].artifact', detail: expect.any(String) })
  })

  it('a transcript wire entry with a bad expect vocab fails E_SCHEMA at wire[i].expect', () => {
    const rec = { ...validRecord(), wire: [{ kind: 'transcript', path: 'matches/x.jsonl', expect: 'sorta' }] }
    const failures = validateCorpusRecord(rec, { protocolVersion: PIN })
    expect(failures).toContainEqual({ code: 'E_SCHEMA', path: 'wire[0].expect', detail: expect.any(String) })
  })

  it('a transcript wire entry with no path fails E_SCHEMA at wire[i].path', () => {
    const rec = { ...validRecord(), wire: [{ kind: 'transcript', expect: 'clean' }] }
    const failures = validateCorpusRecord(rec, { protocolVersion: PIN })
    expect(failures).toContainEqual({ code: 'E_SCHEMA', path: 'wire[0].path', detail: expect.any(String) })
  })

  it('a passing sibling: a transcript wire entry with a valid path+expect passes clean', () => {
    const rec = { ...validRecord(), wire: [{ kind: 'transcript', path: 'matches/x.jsonl', expect: 'clean' }] }
    expect(validateCorpusRecord(rec, { protocolVersion: PIN })).toEqual([])
  })
})

describe('E_PIN — pin presence + match (LLD-C1)', () => {
  it('a missing protocolVersion fails E_PIN at meta.protocolVersion', () => {
    const rec = validRecord() as unknown as Record<string, unknown>
    const meta = rec.meta as Record<string, unknown>
    delete meta.protocolVersion
    const failures = validateCorpusRecord(rec, { protocolVersion: PIN })
    expect(failures).toContainEqual({ code: 'E_PIN', path: 'meta.protocolVersion', detail: expect.any(String) })
  })

  it('an empty protocolVersion fails E_PIN at meta.protocolVersion', () => {
    const rec = { ...validRecord(), meta: { ...validRecord().meta, protocolVersion: '' } }
    const failures = validateCorpusRecord(rec, { protocolVersion: PIN })
    expect(failures).toContainEqual({ code: 'E_PIN', path: 'meta.protocolVersion', detail: expect.any(String) })
  })

  it('a mismatched protocolVersion fails E_PIN at meta.protocolVersion — never E_SCHEMA', () => {
    const rec = { ...validRecord(), meta: { ...validRecord().meta, protocolVersion: '9.9.9' } }
    const failures = validateCorpusRecord(rec, { protocolVersion: PIN })
    expect(failures).toEqual([{ code: 'E_PIN', path: 'meta.protocolVersion', detail: expect.any(String) }])
  })

  it('a passing sibling: the matching pin passes clean', () => {
    expect(validateCorpusRecord(validRecord(), { protocolVersion: PIN })).toEqual([])
  })
})

describe('E_CITE — the shape/emptiness arm (LLD-C1)', () => {
  it('a missing citations array fails E_CITE at citations', () => {
    const rec = validRecord() as unknown as Record<string, unknown>
    delete rec.citations
    const failures = validateCorpusRecord(rec, { protocolVersion: PIN })
    expect(failures).toEqual([{ code: 'E_CITE', path: 'citations', detail: expect.any(String) }])
  })

  it('an empty citations array fails E_CITE at citations', () => {
    const rec = { ...validRecord(), citations: [] }
    const failures = validateCorpusRecord(rec, { protocolVersion: PIN })
    expect(failures).toEqual([{ code: 'E_CITE', path: 'citations', detail: expect.any(String) }])
  })

  it('a malformed hv citation (empty row) fails E_CITE at citations[i]', () => {
    const rec = { ...validRecord(), citations: [{ kind: 'hv', row: '' }] }
    const failures = validateCorpusRecord(rec, { protocolVersion: PIN })
    expect(failures).toContainEqual({ code: 'E_CITE', path: 'citations[0]', detail: expect.any(String) })
  })

  it('a malformed repo citation (empty path) fails E_CITE at citations[i]', () => {
    const rec = { ...validRecord(), citations: [{ kind: 'repo', path: '' }] }
    const failures = validateCorpusRecord(rec, { protocolVersion: PIN })
    expect(failures).toContainEqual({ code: 'E_CITE', path: 'citations[0]', detail: expect.any(String) })
  })

  it('an unknown citation kind fails E_CITE at citations[i]', () => {
    const rec = { ...validRecord(), citations: [{ kind: 'nonsense' }] }
    const failures = validateCorpusRecord(rec, { protocolVersion: PIN })
    expect(failures).toContainEqual({ code: 'E_CITE', path: 'citations[0]', detail: expect.any(String) })
  })

  it('a passing sibling: a well-formed repo citation passes clean', () => {
    const rec = { ...validRecord(), citations: [{ kind: 'repo', path: 'packages/agent-ui/a2a/src/index.ts' }] }
    expect(validateCorpusRecord(rec, { protocolVersion: PIN })).toEqual([])
  })
})
