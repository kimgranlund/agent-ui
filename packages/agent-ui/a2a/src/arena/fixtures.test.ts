// fixtures.test.ts — LLD-C9 checkpoint: the standing gate re-runs `validateTranscript` +
// `checkIsolation` over every committed fixture at test time (LLD §7 "stale/hand-edited committed
// fixture"). `scripted.match.jsonl` must be clean; `contaminated-control.match.jsonl` (the in-transcript
// negative control, SPEC-R10 AC1) MUST fail the gate — a green run over it is a suite failure (LLD §7
// "contaminated fixture passes the gate").
import { describe, expect, it } from 'vitest'
import { parseTranscriptLines, validateTranscript } from './transcript.ts'
import { checkIsolation } from './isolation.ts'
import { PROTOCOL_VERSION } from '../protocol/types.ts'

import scriptedRaw from '../../matches/scripted.match.jsonl?raw'
import contaminatedRaw from '../../matches/contaminated-control.match.jsonl?raw'
import flagshipRaw from '../../matches/flagship.match.jsonl?raw'

function linesOf(raw: string): string[] {
  return raw.split('\n').filter((l) => l.length > 0)
}

describe('scripted.match.jsonl (LLD-C9, the CI backbone)', () => {
  const lines = linesOf(scriptedRaw)

  it('validates clean against the transcript schema (SPEC-R12 AC1)', () => {
    expect(validateTranscript(lines, { protocolVersion: PROTOCOL_VERSION })).toEqual([])
  })

  it('passes the isolation gate clean (SPEC-R10 AC1) — non-vacuity: this MUST be silent', () => {
    const transcript = parseTranscriptLines(lines)
    expect(transcript).toBeDefined()
    expect(checkIsolation(transcript!)).toEqual([])
  })

  it('ends in a win for X (the authored script)', () => {
    const transcript = parseTranscriptLines(lines)!
    const end = transcript.events.find((e) => 'game' in e && e.game.kind === 'end')
    expect(end).toEqual({ game: { kind: 'end', reason: { kind: 'win', winner: 'X' } } })
  })
})

describe('flagship.match.jsonl (LLD-C9, a REAL recorded model-vs-model match — SPEC-R12)', () => {
  const lines = linesOf(flagshipRaw)

  it('validates clean against the transcript schema', () => {
    expect(validateTranscript(lines, { protocolVersion: PROTOCOL_VERSION })).toEqual([])
  })

  it('passes the isolation gate clean — the real flagship proof (SPEC-R10 AC1)', () => {
    const transcript = parseTranscriptLines(lines)
    expect(transcript).toBeDefined()
    expect(checkIsolation(transcript!)).toEqual([])
  })

  it('carries real model provenance (not "scripted") and completes the game', () => {
    const transcript = parseTranscriptLines(lines)!
    expect(transcript.header.scripted).toBe(false)
    expect(transcript.header.seats.X.provider).toBe('anthropic')
    expect(transcript.header.seats.O.provider).toBe('anthropic')
    const end = transcript.events.find((e) => 'game' in e && e.game.kind === 'end')
    expect(end).toBeDefined()
  })
})

describe('contaminated-control.match.jsonl (LLD-C9, in-transcript negative control)', () => {
  const lines = linesOf(contaminatedRaw)

  it('still validates against the transcript SCHEMA (the leak is a semantic contamination, not a shape defect)', () => {
    // The injected "note" key is schema-valid JSON — the schema validator has nothing to say about it;
    // catching it is exactly and only the isolation gate's job (checked below).
    expect(validateTranscript(lines, { protocolVersion: PROTOCOL_VERSION })).toEqual([])
  })

  it('FAILS the isolation gate — non-zero, naming both the extra key and the leaked canary (SPEC-R10 AC1)', () => {
    const transcript = parseTranscriptLines(lines)
    expect(transcript).toBeDefined()
    const failures = checkIsolation(transcript!)
    expect(failures.length).toBeGreaterThan(0)
    expect(failures.some((f) => f.check === 'closed-schema' && f.detail.includes('note'))).toBe(true)
    expect(failures.some((f) => f.check === 'canary')).toBe(true)
  })
})
