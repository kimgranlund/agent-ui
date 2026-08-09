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

  // ── GH #240/ADR-0159 wave B: the additive `source` field (the per-step raw-source attachment) ──
  it('round-trips a progress carrying a raw-source attachment (progressDetail:source)', () => {
    const raw = '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}'
    const line = JSON.stringify({ a2uiMeta: { progress: { stage: 'validating', source: raw } } })
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.progress).toEqual({ stage: 'validating', source: raw })
    expect(parsed!.a2uiMeta.progress!.source, 'the attachment survives byte-for-byte').toBe(raw)
  })

  it('a malformed source (non-string) drops the progress — the same posture as round/detail', () => {
    const line = '{"a2uiMeta":{"note":"a","progress":{"stage":"validating","source":42}}}'
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.progress).toBeUndefined()
    expect(parsed!.a2uiMeta.note, 'the envelope itself never drops').toBe('a')
  })

  it('a source-less progress parses with source undefined — zero blast radius on every pre-#240 line', () => {
    const parsed = readMetaLine('{"a2uiMeta":{"progress":{"stage":"validating"}}}')
    expect(parsed!.a2uiMeta.progress).toEqual({ stage: 'validating' })
    expect(parsed!.a2uiMeta.progress!.source).toBeUndefined()
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

// ── ADR-0174 cl.2 / SPEC-R20: the additive `plan` field ─────────────────────────────────────────────────
describe('readMetaLine — the plan field (ADR-0174 cl.2 / SPEC-R20 AC1)', () => {
  it('round-trips {note, plan:{steps:[{id,description}]}} alongside note/trace/ask/progress/error', () => {
    const line = JSON.stringify({
      a2uiMeta: {
        note: 'Here is my plan.',
        ask: { surfaceId: 'ask-1' },
        plan: { steps: [{ id: 'step-1', description: 'Gather requirements' }, { id: 'step-2', description: 'Build the surface' }] },
      },
    })
    const parsed = readMetaLine(line)
    expect(parsed).toEqual({
      a2uiMeta: {
        note: 'Here is my plan.',
        ask: { surfaceId: 'ask-1' },
        plan: { steps: [{ id: 'step-1', description: 'Gather requirements' }, { id: 'step-2', description: 'Build the surface' }] },
        trace: undefined,
      },
    })
  })

  it('a malformed plan (non-object) yields the envelope WITHOUT plan — note/ask/trace still parse', () => {
    const line = '{"a2uiMeta":{"note":"hi","ask":{"surfaceId":"ask-1"},"plan":"not-an-object"}}'
    const parsed = readMetaLine(line)
    expect(parsed).toBeDefined()
    expect(parsed!.a2uiMeta.note).toBe('hi')
    expect(parsed!.a2uiMeta.ask).toEqual({ surfaceId: 'ask-1' })
    expect(parsed!.a2uiMeta.plan).toBeUndefined()
  })

  it('a malformed plan (missing steps) yields the envelope WITHOUT plan', () => {
    const line = '{"a2uiMeta":{"note":"hi","plan":{}}}'
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.note).toBe('hi')
    expect(parsed!.a2uiMeta.plan).toBeUndefined()
  })

  it('a malformed plan (non-array steps) yields the envelope WITHOUT plan', () => {
    const line = '{"a2uiMeta":{"note":"hi","plan":{"steps":"nope"}}}'
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.plan).toBeUndefined()
  })

  it('a malformed plan (a step missing a string id) yields the envelope WITHOUT plan', () => {
    const line = '{"a2uiMeta":{"note":"hi","plan":{"steps":[{"description":"no id"}]}}}'
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.plan).toBeUndefined()
  })

  it('a malformed plan (a step missing a string description) yields the envelope WITHOUT plan', () => {
    const line = '{"a2uiMeta":{"note":"hi","plan":{"steps":[{"id":"step-1"}]}}}'
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.plan).toBeUndefined()
  })

  it('a malformed plan (a step with non-string id/description) yields the envelope WITHOUT plan', () => {
    const line = '{"a2uiMeta":{"note":"hi","plan":{"steps":[{"id":42,"description":"nope"}]}}}'
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.plan).toBeUndefined()
  })

  it('an array "plan" is rejected the same way (never a Record cast on an array)', () => {
    const line = '{"a2uiMeta":{"note":"hi","plan":["step-1"]}}'
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.plan).toBeUndefined()
  })

  it('a note-only line (no plan at all) still parses with plan undefined — zero blast radius', () => {
    const line = '{"a2uiMeta":{"note":"hi"}}'
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.plan).toBeUndefined()
  })

  it('a plan with an empty steps array round-trips (a degenerate but structurally valid plan)', () => {
    const line = '{"a2uiMeta":{"note":"hi","plan":{"steps":[]}}}'
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.plan).toEqual({ steps: [] })
  })

  it('the version discriminator still wins even when plan is present (adversarial input)', () => {
    const line = '{"version":"v1.0","a2uiMeta":{"note":"nope","plan":{"steps":[{"id":"s","description":"d"}]}}}'
    expect(isMetaLine(line)).toBe(false)
  })

  it('a malformed plan never blocks a well-formed ask on the SAME line — each field is independent', () => {
    const line = '{"a2uiMeta":{"note":"hi","ask":{"surfaceId":"ask-1"},"plan":{"steps":"nope"}}}'
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.ask).toEqual({ surfaceId: 'ask-1' })
    expect(parsed!.a2uiMeta.plan).toBeUndefined()
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

// ── ADR-0178 cl.1 / SPEC-R29: the additive `personaPatch` field ─────────────────────────────────────────
// The arm validates as a WHOLE (a malformed member drops the entire arm, not just that member) — one
// simple rule, chosen because a half-parsed patch is the one shape a host apply loop must never be handed.
// Envelope-level independence is unchanged: a dropped `personaPatch` never costs note/ask/plan/trace.
describe('readMetaLine — the personaPatch field (ADR-0178 cl.1 / SPEC-R29 AC1)', () => {
  it('round-trips {note, personaPatch:{values}} alongside note/ask/plan/trace/progress/error', () => {
    const line = JSON.stringify({
      a2uiMeta: {
        note: 'Got it — a support agent, warm tone.',
        ask: { surfaceId: 'ask-1' },
        plan: { steps: [{ id: 'step-1', description: 'Gather requirements' }] },
        personaPatch: { values: { name: 'Support Buddy', temperature: 0.4, surfaceMarkdown: true } },
      },
    })
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.note).toBe('Got it — a support agent, warm tone.')
    expect(parsed!.a2uiMeta.ask).toEqual({ surfaceId: 'ask-1' })
    expect(parsed!.a2uiMeta.plan).toEqual({ steps: [{ id: 'step-1', description: 'Gather requirements' }] })
    expect(parsed!.a2uiMeta.personaPatch).toEqual({ values: { name: 'Support Buddy', temperature: 0.4, surfaceMarkdown: true } })
  })

  it('round-trips {note, personaPatch:{entries}} — list contributions, values absent', () => {
    const line = JSON.stringify({
      a2uiMeta: {
        note: 'Added one instruction.',
        personaPatch: { entries: { promptSectionEntries: [{ id: 'a', title: 'Tone', body: 'Be warm.' }] } },
      },
    })
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.personaPatch).toEqual({ entries: { promptSectionEntries: [{ id: 'a', title: 'Tone', body: 'Be warm.' }] } })
    expect(parsed!.a2uiMeta.personaPatch!.values).toBeUndefined()
  })

  it('round-trips BOTH members on one patch', () => {
    const line = JSON.stringify({
      a2uiMeta: { note: 'hi', personaPatch: { values: { name: 'X' }, entries: { toolEntries: [] } } },
    })
    expect(readMetaLine(line)!.a2uiMeta.personaPatch).toEqual({ values: { name: 'X' }, entries: { toolEntries: [] } })
  })

  it('member values stay OPAQUE — nested objects/arrays/nulls survive verbatim (the wire layer knows no persona key)', () => {
    const value = { nested: { deep: [1, 'two', null, { three: true }] } }
    const line = JSON.stringify({ a2uiMeta: { note: 'hi', personaPatch: { values: { anything: value } } } })
    expect(readMetaLine(line)!.a2uiMeta.personaPatch!.values!.anything).toEqual(value)
  })

  it('a malformed personaPatch (non-object) drops ONLY itself — note/ask/plan/trace still parse', () => {
    const line = JSON.stringify({
      a2uiMeta: {
        note: 'hi',
        ask: { surfaceId: 'ask-1' },
        plan: { steps: [{ id: 's', description: 'd' }] },
        personaPatch: 'not-an-object',
      },
    })
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.note).toBe('hi')
    expect(parsed!.a2uiMeta.ask).toEqual({ surfaceId: 'ask-1' })
    expect(parsed!.a2uiMeta.plan).toEqual({ steps: [{ id: 's', description: 'd' }] })
    expect(parsed!.a2uiMeta.personaPatch).toBeUndefined()
  })

  it('an array personaPatch is rejected the same way (never a Record cast on an array)', () => {
    expect(readMetaLine('{"a2uiMeta":{"note":"hi","personaPatch":["name"]}}')!.a2uiMeta.personaPatch).toBeUndefined()
  })

  it('a personaPatch with NEITHER member drops — an empty arm is not a patch', () => {
    expect(readMetaLine('{"a2uiMeta":{"note":"hi","personaPatch":{}}}')!.a2uiMeta.personaPatch).toBeUndefined()
  })

  it('a personaPatch with only unrecognized members drops — same rule, no partial acceptance', () => {
    expect(readMetaLine('{"a2uiMeta":{"note":"hi","personaPatch":{"whatever":{"a":1}}}}')!.a2uiMeta.personaPatch).toBeUndefined()
  })

  it('a non-object `values` drops the WHOLE arm, not just that member', () => {
    const line = '{"a2uiMeta":{"note":"hi","personaPatch":{"values":"nope","entries":{"toolEntries":[]}}}}'
    expect(readMetaLine(line)!.a2uiMeta.personaPatch).toBeUndefined()
  })

  it('an array `values` drops the whole arm', () => {
    expect(readMetaLine('{"a2uiMeta":{"note":"hi","personaPatch":{"values":["name"]}}}')!.a2uiMeta.personaPatch).toBeUndefined()
  })

  it('a non-object `entries` drops the whole arm', () => {
    const line = '{"a2uiMeta":{"note":"hi","personaPatch":{"values":{"name":"X"},"entries":"nope"}}}'
    expect(readMetaLine(line)!.a2uiMeta.personaPatch).toBeUndefined()
  })

  it('an `entries` member that is not an array drops the whole arm', () => {
    const line = '{"a2uiMeta":{"note":"hi","personaPatch":{"entries":{"toolEntries":{"not":"a list"}}}}}'
    expect(readMetaLine(line)!.a2uiMeta.personaPatch).toBeUndefined()
  })

  it('a note-only line (no personaPatch at all) still parses with personaPatch undefined — zero blast radius', () => {
    expect(readMetaLine('{"a2uiMeta":{"note":"hi"}}')!.a2uiMeta.personaPatch).toBeUndefined()
  })

  it('a well-formed personaPatch survives beside a MALFORMED plan on the same line (per-field independence)', () => {
    const line = '{"a2uiMeta":{"note":"hi","plan":"broken","personaPatch":{"values":{"name":"X"}}}}'
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.plan).toBeUndefined()
    expect(parsed!.a2uiMeta.personaPatch).toEqual({ values: { name: 'X' } })
  })

  it('the envelope stays disjoint from A2uiServerMessage — a `version` key still refuses the whole line', () => {
    expect(readMetaLine('{"version":"v1.0","a2uiMeta":{"personaPatch":{"values":{"name":"X"}}}}')).toBeUndefined()
  })
})
