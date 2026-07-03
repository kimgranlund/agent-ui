import { describe, it, expect } from 'vitest'
import { parseVerdictsFile, createVerdictJudge, UnjudgedCandidateError } from './judge.ts'
import type { VerdictsFile } from './judge.ts'
import type { CorpusRecord } from './record.ts'

// judge.test.ts — the corpus-quality judge adapter (corpus LLD-C8, ADR-0060/0068). Pure: no fs, no
// scoring logic of its own — every case here proves the DETERMINISTIC PLUMBING, never judgment.

const RUBRIC_VERSION = '2026-07-03'

function mkFile(overrides: Partial<VerdictsFile> = {}): VerdictsFile {
  return {
    rubric: 'a2ui-corpus',
    rubricVersion: RUBRIC_VERSION,
    judgedBy: 'a2ui-reviewer',
    date: '2026-07-03',
    verdicts: { 'sample-a': { qualityScore: 5, passed: true } },
    ...overrides,
  }
}

function mkRecord(name: string): CorpusRecord {
  return {
    name,
    description: 'x',
    promptText: 'x',
    a2uiOutput: [{ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } }],
    meta: {
      facet: 'exemplar',
      protocolVersion: 'v1.0',
      catalogId: 'agent-ui',
      provenance: { source: 'authored', origin: 'test-fixture' },
      status: 'valid',
    },
  }
}

describe('parseVerdictsFile — the ADR-0068 shape (SPEC §5.3)', () => {
  it('a valid file round-trips', () => {
    const file = mkFile()
    const result = parseVerdictsFile(JSON.stringify(file), RUBRIC_VERSION)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.file).toEqual(file)
  })

  it('rejects invalid JSON', () => {
    const result = parseVerdictsFile('{not json', RUBRIC_VERSION)
    expect(result.ok).toBe(false)
  })

  it('rejects a non-object document (e.g. a bare array)', () => {
    const result = parseVerdictsFile('[1,2,3]', RUBRIC_VERSION)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.length).toBeGreaterThan(0)
  })

  it('rejects a missing `rubric` field', () => {
    const doc = mkFile() as unknown as Record<string, unknown>
    delete doc.rubric
    const result = parseVerdictsFile(JSON.stringify(doc), RUBRIC_VERSION)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.some((i) => i.path === 'rubric')).toBe(true)
  })

  it('rejects a rubricVersion that disagrees with the caller-supplied expected version', () => {
    const file = mkFile({ rubricVersion: 'stale-version' })
    const result = parseVerdictsFile(JSON.stringify(file), RUBRIC_VERSION)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.some((i) => i.path === 'rubricVersion')).toBe(true)
  })

  it('rejects a missing judgedBy/date', () => {
    const doc = mkFile() as unknown as Record<string, unknown>
    delete doc.judgedBy
    delete doc.date
    const result = parseVerdictsFile(JSON.stringify(doc), RUBRIC_VERSION)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.some((i) => i.path === 'judgedBy')).toBe(true)
    expect(result.issues.some((i) => i.path === 'date')).toBe(true)
  })

  it('rejects an unknown top-level key', () => {
    const doc = { ...mkFile(), extraneous: true }
    const result = parseVerdictsFile(JSON.stringify(doc), RUBRIC_VERSION)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.some((i) => i.path === 'extraneous')).toBe(true)
  })

  it('rejects a non-numeric qualityScore in a per-name verdict', () => {
    const file = mkFile({ verdicts: { x: { qualityScore: 'high' as unknown as number, passed: true } } })
    const result = parseVerdictsFile(JSON.stringify(file), RUBRIC_VERSION)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.some((i) => i.path === 'verdicts.x.qualityScore')).toBe(true)
  })

  it('rejects a non-boolean passed in a per-name verdict', () => {
    const file = mkFile({ verdicts: { x: { qualityScore: 5, passed: 'yes' as unknown as boolean } } })
    const result = parseVerdictsFile(JSON.stringify(file), RUBRIC_VERSION)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.some((i) => i.path === 'verdicts.x.passed')).toBe(true)
  })

  it('rejects an unknown key inside a per-name verdict', () => {
    const doc = {
      ...mkFile(),
      verdicts: { x: { qualityScore: 5, passed: true, bogus: 1 } },
    }
    const result = parseVerdictsFile(JSON.stringify(doc), RUBRIC_VERSION)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.some((i) => i.path === 'verdicts.x.bogus')).toBe(true)
  })

  it('batches every issue rather than short-circuiting at the first (mirrors validateRecord)', () => {
    const doc = { rubric: 'wrong', rubricVersion: 'stale', judgedBy: '', date: '', verdicts: {} }
    const result = parseVerdictsFile(JSON.stringify(doc), RUBRIC_VERSION)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.length).toBeGreaterThanOrEqual(4)
  })

  it('preserves failingDimensions when present, omits it when absent', () => {
    const file = mkFile({
      verdicts: {
        a: { qualityScore: 2, passed: false, failingDimensions: ['clarity'] },
        b: { qualityScore: 5, passed: true },
      },
    })
    const result = parseVerdictsFile(JSON.stringify(file), RUBRIC_VERSION)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.file.verdicts.a!.failingDimensions).toEqual(['clarity'])
    expect(result.file.verdicts.b!.failingDimensions).toBeUndefined()
  })
})

describe('createVerdictJudge — the ADR-0060 seam realization (deterministic name-lookup, never scoring)', () => {
  it('scores a known name by direct lookup', () => {
    const file = mkFile({ verdicts: { 'sample-a': { qualityScore: 4.5, passed: true } } })
    const judge = createVerdictJudge(file)
    const verdict = judge.score(mkRecord('sample-a'))
    expect(verdict).toEqual({ qualityScore: 4.5, passed: true })
  })

  it('a name ABSENT from the file throws UnjudgedCandidateError (fail-closed)', () => {
    const judge = createVerdictJudge(mkFile({ verdicts: {} }))
    expect(() => judge.score(mkRecord('never-judged'))).toThrow(UnjudgedCandidateError)
  })

  it('the thrown error names the unjudged record', () => {
    const judge = createVerdictJudge(mkFile({ verdicts: {} }))
    let caught: unknown
    try {
      judge.score(mkRecord('mystery-record'))
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(UnjudgedCandidateError)
    expect((caught as UnjudgedCandidateError).recordName).toBe('mystery-record')
  })
})
