// meta-line.test.ts — LLD-C3/C8 · ADR-0088 §1: the reserved meta-line envelope + its guard, in
// isolation from `produce()`. Proves the discriminator (no `version` key) against real
// `A2uiServerMessage` shapes, so it stays provably disjoint from the protocol it rides beside.

import { describe, it, expect } from 'vitest'
import { readMetaLine, isMetaLine, formatErrorLine } from '../agent/meta-line.ts'
import { dispatch } from '../renderer/dispatch.ts'
import type { A2uiServerMessage } from '../protocol.ts'
import type { DispatchHandlers } from '../renderer/dispatch.ts'

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

// ── ADR-0146 F1: the additive `progress` field (the live-turn lifecycle kind) ─────────────────────────────
describe('readMetaLine — the progress field (ADR-0146 F1)', () => {
  it('round-trips a bare progress line {progress:{stage}}', () => {
    const line = '{"a2uiMeta":{"progress":{"stage":"reasoning"}}}'
    const parsed = readMetaLine(line)
    expect(parsed).toBeDefined()
    expect(parsed!.a2uiMeta.progress).toEqual({ stage: 'reasoning' })
    expect(parsed!.a2uiMeta.note).toBeUndefined()
  })

  it('round-trips a retry progress carrying the round ordinal', () => {
    const line = '{"a2uiMeta":{"progress":{"stage":"retry","round":2}}}'
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.progress).toEqual({ stage: 'retry', round: 2 })
  })

  it('round-trips a progress carrying optional detail text (progressDetail:full)', () => {
    const line = '{"a2uiMeta":{"progress":{"stage":"reasoning","detail":"weighing the layout options"}}}'
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.progress).toEqual({ stage: 'reasoning', detail: 'weighing the layout options' })
  })

  it('every closed-vocabulary stage round-trips', () => {
    for (const stage of ['sent', 'started', 'reasoning', 'content', 'validating', 'retry', 'done']) {
      const parsed = readMetaLine(`{"a2uiMeta":{"progress":{"stage":"${stage}"}}}`)
      expect(parsed!.a2uiMeta.progress?.stage, stage).toBe(stage)
    }
  })

  it('an OUT-OF-VOCABULARY stage drops only progress — the honesty-law guard (F2)', () => {
    const line = '{"a2uiMeta":{"note":"hi","progress":{"stage":"almost-done"}}}'
    const parsed = readMetaLine(line)
    expect(parsed).toBeDefined()
    expect(parsed!.a2uiMeta.note, 'note still parses').toBe('hi')
    expect(parsed!.a2uiMeta.progress, 'the fabricated stage never survives the parse').toBeUndefined()
  })

  it('a malformed progress (non-object / array / non-number round / non-string detail) drops only itself', () => {
    expect(readMetaLine('{"a2uiMeta":{"note":"a","progress":"nope"}}')!.a2uiMeta.progress).toBeUndefined()
    expect(readMetaLine('{"a2uiMeta":{"note":"a","progress":["reasoning"]}}')!.a2uiMeta.progress).toBeUndefined()
    expect(readMetaLine('{"a2uiMeta":{"note":"a","progress":{"stage":"retry","round":"2"}}}')!.a2uiMeta.progress).toBeUndefined()
    expect(readMetaLine('{"a2uiMeta":{"note":"a","progress":{"stage":"reasoning","detail":42}}}')!.a2uiMeta.progress).toBeUndefined()
    // …and in every case the note is untouched (the whole envelope never drops)
    expect(readMetaLine('{"a2uiMeta":{"note":"a","progress":"nope"}}')!.a2uiMeta.note).toBe('a')
  })

  it('the version discriminator still wins even when progress is present (adversarial input)', () => {
    const line = '{"version":"v1.0","a2uiMeta":{"progress":{"stage":"reasoning"}}}'
    expect(isMetaLine(line)).toBe(false)
  })

  it('fault isolation: a progress line reaching dispatch() UNFILTERED routes to VERSION_UNSUPPORTED, returned not thrown (the ADR-0088 defense, extended)', () => {
    // A leaked progress line is a plain object with NO `version` key — so dispatch()'s version gate
    // catches it and RETURNS the error, never throwing, never reaching a handler (ADR-0088 defense-in-depth).
    const leaked = JSON.parse('{"a2uiMeta":{"progress":{"stage":"reasoning"}}}') as A2uiServerMessage
    const noopHandlers: DispatchHandlers = {
      createSurface: () => {},
      updateComponents: () => {},
      updateDataModel: () => {},
      deleteSurface: () => {},
      actionResponse: () => {},
      callFunction: () => {},
    }
    let err: ReturnType<typeof dispatch>
    expect(() => {
      err = dispatch(leaked, noopHandlers)
    }).not.toThrow()
    expect(err!).toEqual({ code: 'VERSION_UNSUPPORTED', message: expect.stringContaining('unsupported protocol version') })
  })
})

// ── GH #144: the additive `error` field (a transport-composed terminal failure signal) ─────────────────────
describe('readMetaLine / formatErrorLine — the error field (GH #144)', () => {
  it('formatErrorLine round-trips through readMetaLine', () => {
    const line = formatErrorLine('produce: no valid surface within the round bound (SCHEMA)')
    const parsed = readMetaLine(line)
    expect(parsed).toBeDefined()
    expect(parsed!.a2uiMeta.error).toBe('produce: no valid surface within the round bound (SCHEMA)')
  })

  it('an error line carries no note/ask/trace/progress', () => {
    const parsed = readMetaLine(formatErrorLine('boom'))
    expect(parsed!.a2uiMeta.note).toBeUndefined()
    expect(parsed!.a2uiMeta.ask).toBeUndefined()
    expect(parsed!.a2uiMeta.trace).toBeUndefined()
    expect(parsed!.a2uiMeta.progress).toBeUndefined()
  })

  it('a malformed error (non-string) drops only itself — the envelope still parses', () => {
    const line = '{"a2uiMeta":{"note":"hi","error":42}}'
    const parsed = readMetaLine(line)
    expect(parsed).toBeDefined()
    expect(parsed!.a2uiMeta.note).toBe('hi')
    expect(parsed!.a2uiMeta.error).toBeUndefined()
  })

  it('a note-only line (no error at all) still parses with error undefined — zero blast radius', () => {
    const parsed = readMetaLine('{"a2uiMeta":{"note":"hi"}}')
    expect(parsed!.a2uiMeta.error).toBeUndefined()
  })

  it('the version discriminator still wins even when error is present (adversarial input)', () => {
    const line = '{"version":"v1.0","a2uiMeta":{"error":"nope"}}'
    expect(isMetaLine(line)).toBe(false)
  })

  it('fault isolation: an error line reaching dispatch() UNFILTERED routes to VERSION_UNSUPPORTED, returned not thrown (the ADR-0088 defense, extended)', () => {
    // A leaked error line is a plain object with NO `version` key — so dispatch()'s version gate catches
    // it and RETURNS the error, never throwing, never reaching a handler (ADR-0088 defense-in-depth).
    const leaked = JSON.parse(formatErrorLine('boom')) as A2uiServerMessage
    const noopHandlers: DispatchHandlers = {
      createSurface: () => {},
      updateComponents: () => {},
      updateDataModel: () => {},
      deleteSurface: () => {},
      actionResponse: () => {},
      callFunction: () => {},
    }
    let err: ReturnType<typeof dispatch>
    expect(() => {
      err = dispatch(leaked, noopHandlers)
    }).not.toThrow()
    expect(err!).toEqual({ code: 'VERSION_UNSUPPORTED', message: expect.stringContaining('unsupported protocol version') })
  })
})
