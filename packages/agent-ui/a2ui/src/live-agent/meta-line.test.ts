// meta-line.test.ts — LLD-C3/C8 · ADR-0088 §1: the reserved meta-line envelope + its guard, in
// isolation from `produce()`. Proves the discriminator (no `version` key) against real
// `A2uiServerMessage` shapes, so it stays provably disjoint from the protocol it rides beside.

import { describe, it, expect } from 'vitest'
import { readMetaLine, isMetaLine } from '../agent/meta-line.ts'
import type { A2uiServerMessage } from '../protocol.ts'

const realServerMessage: A2uiServerMessage = {
  version: 'v1.0',
  createSurface: { surfaceId: 'main', catalogId: 'agent-ui' },
}

describe('readMetaLine / isMetaLine (ADR-0088 §1)', () => {
  it('reads a note-only meta-line', () => {
    const line = '{"a2uiMeta":{"note":"hi there"}}'
    expect(isMetaLine(line)).toBe(true)
    expect(readMetaLine(line)).toEqual({ a2uiMeta: { note: 'hi there', trace: undefined } })
  })

  it('reads a meta-line carrying a trace', () => {
    const trace = {
      turnIndex: 0,
      query: { intent: 'a button', k: 3 },
      exemplarIds: ['ex-1'],
      rounds: 1,
      healed: 0,
      failureCodes: [],
      model: 'claude-sonnet-5',
    }
    const line = JSON.stringify({ a2uiMeta: { note: 'ok', trace } })
    const parsed = readMetaLine(line)
    expect(parsed?.a2uiMeta.note).toBe('ok')
    expect(parsed?.a2uiMeta.trace).toEqual(trace)
  })

  // The load-bearing negative control (ADR-0088 §1): a REAL A2uiServerMessage — carrying "version" — is
  // provably NOT a meta-line, by the exact discriminator `dispatch.ts`'s version gate relies on.
  it('is provably NOT a meta-line for a real A2uiServerMessage (has "version")', () => {
    const line = JSON.stringify(realServerMessage)
    expect(isMetaLine(line)).toBe(false)
    expect(readMetaLine(line)).toBeUndefined()
  })

  it('rejects malformed input without throwing', () => {
    expect(readMetaLine('not json')).toBeUndefined()
    expect(readMetaLine('[]')).toBeUndefined()
    expect(readMetaLine('null')).toBeUndefined()
    expect(readMetaLine('{"a2uiMeta":"not-an-object"}')).toBeUndefined()
    expect(readMetaLine('{"someOtherKey":true}')).toBeUndefined()
    expect(readMetaLine('{"a2uiMeta":{"note":42}}')).toBeUndefined() // wrong note type
    expect(isMetaLine('not json')).toBe(false)
  })

  it('a line carrying BOTH "a2uiMeta" and "version" is rejected — version wins the discriminator', () => {
    // Never a real shape any caller emits, but the guard must stay unambiguous under adversarial input.
    const line = '{"version":"v1.0","a2uiMeta":{"note":"nope"}}'
    expect(isMetaLine(line)).toBe(false)
  })
})

// ── ADR-0097 §1: the additive `ask` field ───────────────────────────────────────────────────────────────
describe('readMetaLine — the ask field (ADR-0097 §1)', () => {
  it('round-trips {note, ask:{surfaceId}}', () => {
    const line = '{"a2uiMeta":{"note":"Which size?","ask":{"surfaceId":"ask-1"}}}'
    const parsed = readMetaLine(line)
    expect(parsed).toEqual({ a2uiMeta: { note: 'Which size?', ask: { surfaceId: 'ask-1' }, trace: undefined } })
  })

  it('a malformed ask (non-object) yields the envelope WITHOUT ask — note/trace still parse', () => {
    const line = '{"a2uiMeta":{"note":"hi","ask":"not-an-object"}}'
    const parsed = readMetaLine(line)
    expect(parsed).toBeDefined()
    expect(parsed!.a2uiMeta.note).toBe('hi')
    expect(parsed!.a2uiMeta.ask).toBeUndefined()
  })

  it('a malformed ask (missing surfaceId) yields the envelope WITHOUT ask', () => {
    const line = '{"a2uiMeta":{"note":"hi","ask":{}}}'
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.ask).toBeUndefined()
  })

  it('a malformed ask (non-string surfaceId) yields the envelope WITHOUT ask', () => {
    const line = '{"a2uiMeta":{"note":"hi","ask":{"surfaceId":42}}}'
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.ask).toBeUndefined()
  })

  it('an array "ask" is rejected the same way (never a Record cast on an array)', () => {
    const line = '{"a2uiMeta":{"note":"hi","ask":["ask-1"]}}'
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.ask).toBeUndefined()
  })

  it('a note-only line (no ask at all) still parses with ask undefined — zero blast radius', () => {
    const line = '{"a2uiMeta":{"note":"hi"}}'
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.ask).toBeUndefined()
  })

  it('the version discriminator still wins even when ask is present (adversarial input)', () => {
    const line = '{"version":"v1.0","a2uiMeta":{"note":"nope","ask":{"surfaceId":"ask-1"}}}'
    expect(isMetaLine(line)).toBe(false)
  })
})

// ── ADR-0146 §F1: the additive `progress` kind ──────────────────────────────────────────────────────────
describe('readMetaLine — the progress kind (ADR-0146 F1)', () => {
  it('round-trips a bare {stage} progress line', () => {
    const line = '{"a2uiMeta":{"progress":{"stage":"reasoning"}}}'
    const parsed = readMetaLine(line)
    expect(isMetaLine(line)).toBe(true)
    expect(parsed?.a2uiMeta.progress).toEqual({ stage: 'reasoning' })
  })

  it('round-trips a progress line carrying round + detail', () => {
    const line = '{"a2uiMeta":{"progress":{"stage":"retry","round":2,"detail":"CATALOG at root.mode"}}}'
    const parsed = readMetaLine(line)
    expect(parsed?.a2uiMeta.progress).toEqual({ stage: 'retry', round: 2, detail: 'CATALOG at root.mode' })
  })

  it('accepts every closed stage member and no other', () => {
    for (const stage of ['sent', 'started', 'reasoning', 'content', 'validating', 'retry', 'done']) {
      expect(readMetaLine(`{"a2uiMeta":{"progress":{"stage":"${stage}"}}}`)?.a2uiMeta.progress?.stage).toBe(stage)
    }
    // a stage OUTSIDE the closed union drops the progress field (never the whole envelope) — note stands
    const line = '{"a2uiMeta":{"note":"hi","progress":{"stage":"thinking-hard"}}}'
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.note).toBe('hi')
    expect(parsed!.a2uiMeta.progress).toBeUndefined()
  })

  it('a malformed progress (non-object / array / missing stage) drops only itself — note/ask still parse', () => {
    expect(readMetaLine('{"a2uiMeta":{"note":"hi","progress":"nope"}}')!.a2uiMeta.progress).toBeUndefined()
    expect(readMetaLine('{"a2uiMeta":{"note":"hi","progress":["sent"]}}')!.a2uiMeta.progress).toBeUndefined()
    expect(readMetaLine('{"a2uiMeta":{"note":"hi","progress":{}}}')!.a2uiMeta.progress).toBeUndefined()
    const both = readMetaLine('{"a2uiMeta":{"note":"hi","ask":{"surfaceId":"ask-1"},"progress":42}}')
    expect(both!.a2uiMeta.note).toBe('hi')
    expect(both!.a2uiMeta.ask).toEqual({ surfaceId: 'ask-1' })
    expect(both!.a2uiMeta.progress).toBeUndefined()
  })

  it('drops a non-number round / non-string detail without dropping the valid stage', () => {
    const line = '{"a2uiMeta":{"progress":{"stage":"retry","round":"two","detail":99}}}'
    expect(readMetaLine(line)?.a2uiMeta.progress).toEqual({ stage: 'retry' }) // round/detail rejected, stage kept
  })

  it('the version discriminator still wins even when progress is present (a leaked line fault-isolates)', () => {
    const line = '{"version":"v1.0","a2uiMeta":{"progress":{"stage":"done"}}}'
    expect(isMetaLine(line)).toBe(false) // provably an A2uiServerMessage shape ⇒ dispatch() → VERSION_UNSUPPORTED
  })
})
