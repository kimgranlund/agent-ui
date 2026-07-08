// admit.test.ts — S3 checkpoint (LLD-C3, SPEC-R14 AC1): the admission matrix. A firing fixture AND a
// passing sibling per code in {E_SCHEMA, E_PIN, E_CITE, E_REPLAY}, incl. both expectation-mismatch
// directions for a transcript reference.
import { describe, expect, it } from 'vitest'
import { admitRecord } from './admit.ts'
import type { AdmitDeps } from './admit.ts'
import type { A2aCorpusRecord } from './record.ts'

const PIN = '0.3.0'

function validRecord(): A2aCorpusRecord {
  return {
    name: 'a-record',
    description: 'd',
    body: 'b',
    citations: [{ kind: 'hv', row: 'HV-4' }],
    wire: [{ kind: 'message', artifact: { kind: 'message', role: 'user', parts: [{ kind: 'text', text: 'hi' }], messageId: 'm1' } }],
    meta: { facet: 'concept', protocolVersion: PIN, provenance: { source: 'authored', origin: 'test' }, status: 'valid' },
  }
}

function fakeDeps(overrides: Partial<AdmitDeps> = {}): AdmitDeps {
  return {
    protocolVersion: PIN,
    resolveCitation: () => true,
    loadTranscript: () => undefined,
    ...overrides,
  }
}

// A minimal, valid, EVENT-FREE transcript (no wire/context/game lines) — passes schema + is trivially
// clean under checkIsolation (every check operates over `t.events`, which is empty here).
const CLEAN_TRANSCRIPT = `${JSON.stringify({
  matchId: 'm1',
  protocolVersion: PIN,
  seats: { X: { provider: 'scripted', model: 'scripted' }, O: { provider: 'scripted', model: 'scripted' } },
  date: '2026-07-08T00:00:00.000Z',
  scripted: true,
})}\n`

// The SAME header + one referee->X wire event carrying an extra ("foo") key outside the closed
// BoardMessage key set — fires checkIsolation's closed-schema check deterministically.
const CONTAMINATED_TRANSCRIPT = `${CLEAN_TRANSCRIPT}${JSON.stringify({
  wire: {
    from: 'referee',
    to: 'X',
    message: { kind: 'message', role: 'agent', parts: [{ kind: 'data', data: { foo: 'bar' } }], messageId: 'arena-1' },
  },
})}\n`

describe('admit.ts admission matrix (LLD-C3, SPEC-R14 AC1)', () => {
  it('the fully-valid fixture is admitted', () => {
    const result = admitRecord(validRecord(), fakeDeps())
    expect(result.admitted).toBe(true)
  })

  describe('E_SCHEMA', () => {
    it('firing: a malformed candidate (missing body) is rejected with E_SCHEMA', () => {
      const rec = validRecord() as unknown as Record<string, unknown>
      delete rec.body
      const result = admitRecord(rec, fakeDeps())
      expect(result.admitted).toBe(false)
      if (!result.admitted) expect(result.failures.every((f) => f.code === 'E_SCHEMA')).toBe(true)
    })

    it('passing sibling: the valid fixture has no E_SCHEMA failures', () => {
      const result = admitRecord(validRecord(), fakeDeps())
      expect(result.admitted).toBe(true)
    })
  })

  describe('E_PIN', () => {
    it('firing: a protocolVersion mismatch is rejected with E_PIN', () => {
      const rec = { ...validRecord(), meta: { ...validRecord().meta, protocolVersion: '9.9.9' } }
      const result = admitRecord(rec, fakeDeps())
      expect(result.admitted).toBe(false)
      if (!result.admitted) expect(result.failures).toEqual([{ code: 'E_PIN', path: 'meta.protocolVersion', detail: expect.any(String) }])
    })

    it('passing sibling: a matching pin admits', () => {
      const result = admitRecord(validRecord(), fakeDeps())
      expect(result.admitted).toBe(true)
    })
  })

  describe('E_CITE', () => {
    it('firing: a dangling citation (resolveCitation returns false) is rejected with E_CITE', () => {
      const result = admitRecord(validRecord(), fakeDeps({ resolveCitation: () => false }))
      expect(result.admitted).toBe(false)
      if (!result.admitted) expect(result.failures).toEqual([{ code: 'E_CITE', path: 'citations[0]', detail: expect.any(String) }])
    })

    it('passing sibling: a resolving citation admits', () => {
      const result = admitRecord(validRecord(), fakeDeps({ resolveCitation: () => true }))
      expect(result.admitted).toBe(true)
    })

    it('a quarantined record SKIPS citation resolution entirely (LLD §3/§4)', () => {
      const rec = { ...validRecord(), meta: { ...validRecord().meta, status: 'quarantined' as const } }
      const result = admitRecord(rec, fakeDeps({ resolveCitation: () => false }))
      expect(result.admitted).toBe(true)
    })
  })

  describe('E_REPLAY — inline artifact', () => {
    it('firing: an inline artifact failing the shared validator is rejected with E_REPLAY', () => {
      const rec = {
        ...validRecord(),
        wire: [{ kind: 'message' as const, artifact: { kind: 'message', role: 'user', parts: [{ kind: 'text', text: 'hi' }] /* no messageId */ } }],
      }
      const result = admitRecord(rec, fakeDeps())
      expect(result.admitted).toBe(false)
      if (!result.admitted) expect(result.failures).toEqual([{ code: 'E_REPLAY', path: 'wire[0]', detail: expect.any(String) }])
    })

    it('passing sibling: a valid inline artifact admits', () => {
      const result = admitRecord(validRecord(), fakeDeps())
      expect(result.admitted).toBe(true)
    })

    it('a quarantined record SKIPS replay entirely (LLD §3/§4)', () => {
      const rec = {
        ...validRecord(),
        meta: { ...validRecord().meta, status: 'quarantined' as const },
        wire: [{ kind: 'message' as const, artifact: { kind: 'message', role: 'user', parts: [{ kind: 'text', text: 'hi' }] } }],
      }
      const result = admitRecord(rec, fakeDeps())
      expect(result.admitted).toBe(true)
    })
  })

  describe('E_REPLAY — transcript reference', () => {
    function transcriptRecord(path: string, expect_: 'clean' | 'contaminated'): A2aCorpusRecord {
      return { ...validRecord(), wire: [{ kind: 'transcript', path, expect: expect_ }] }
    }

    it('firing: an unreadable transcript path is rejected with E_REPLAY', () => {
      const result = admitRecord(transcriptRecord('matches/missing.jsonl', 'clean'), fakeDeps({ loadTranscript: () => undefined }))
      expect(result.admitted).toBe(false)
      if (!result.admitted) expect(result.failures).toEqual([{ code: 'E_REPLAY', path: 'wire[0]', detail: expect.any(String) }])
    })

    it('firing direction 1: expect:"clean" but the transcript actually fails isolation', () => {
      const result = admitRecord(
        transcriptRecord('matches/contaminated.jsonl', 'clean'),
        fakeDeps({ loadTranscript: () => CONTAMINATED_TRANSCRIPT }),
      )
      expect(result.admitted).toBe(false)
      if (!result.admitted) {
        expect(result.failures).toEqual([{ code: 'E_REPLAY', path: 'wire[0]', detail: expect.any(String) }])
        expect(result.failures[0]!.detail).toMatch(/expected a clean isolation verdict/)
      }
    })

    it('firing direction 2 (the stale negative control): expect:"contaminated" but the transcript actually passes clean', () => {
      const result = admitRecord(
        transcriptRecord('matches/scripted.jsonl', 'contaminated'),
        fakeDeps({ loadTranscript: () => CLEAN_TRANSCRIPT }),
      )
      expect(result.admitted).toBe(false)
      if (!result.admitted) {
        expect(result.failures).toEqual([{ code: 'E_REPLAY', path: 'wire[0]', detail: expect.any(String) }])
        expect(result.failures[0]!.detail).toMatch(/stale negative control/)
      }
    })

    it('firing: the transcript fails schema validation (bad pin) with E_REPLAY', () => {
      const badPinTranscript = `${JSON.stringify({
        matchId: 'm1',
        protocolVersion: '9.9.9',
        seats: { X: { provider: 'scripted', model: 'scripted' }, O: { provider: 'scripted', model: 'scripted' } },
        date: '2026-07-08T00:00:00.000Z',
        scripted: true,
      })}\n`
      const result = admitRecord(transcriptRecord('matches/badpin.jsonl', 'clean'), fakeDeps({ loadTranscript: () => badPinTranscript }))
      expect(result.admitted).toBe(false)
      if (!result.admitted) expect(result.failures).toEqual([{ code: 'E_REPLAY', path: 'wire[0]', detail: expect.any(String) }])
    })

    it('passing sibling: expect:"clean" matches an actually-clean transcript', () => {
      const result = admitRecord(transcriptRecord('matches/scripted.jsonl', 'clean'), fakeDeps({ loadTranscript: () => CLEAN_TRANSCRIPT }))
      expect(result.admitted).toBe(true)
    })

    it('passing sibling: expect:"contaminated" matches an actually-contaminated transcript', () => {
      const result = admitRecord(
        transcriptRecord('matches/contaminated.jsonl', 'contaminated'),
        fakeDeps({ loadTranscript: () => CONTAMINATED_TRANSCRIPT }),
      )
      expect(result.admitted).toBe(true)
    })
  })
})
