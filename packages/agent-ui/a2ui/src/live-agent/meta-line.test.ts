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

// ── ADR-0198 cl.1: the additive `flowEnd` field ─────────────────────────────────────────────────────────
// The FOURTH MODEL-authored arm (ask → plan → personaPatch → flowEnd), mirroring the sibling suites:
// literal-true acceptance, everything else drops ONLY itself, per-field independence, disjointness.
describe('readMetaLine — the flowEnd field (ADR-0198 cl.1)', () => {
  it('round-trips {note, flowEnd: true} — the closing turn shape', () => {
    const line = JSON.stringify({
      a2uiMeta: { note: "You're all set — we'll see you today at 2pm.", flowEnd: true },
    })
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.note).toBe("You're all set — we'll see you today at 2pm.")
    expect(parsed!.a2uiMeta.flowEnd).toBe(true)
  })

  it('a note-only line (no flowEnd at all) parses with flowEnd undefined — the safe-degrade law (negative control)', () => {
    const parsed = readMetaLine('{"a2uiMeta":{"note":"and next, which time works?"}}')
    expect(parsed).toBeDefined()
    expect(parsed!.a2uiMeta.flowEnd).toBeUndefined()
  })

  it('flowEnd: false drops ONLY itself — never coerced to a completion', () => {
    const parsed = readMetaLine('{"a2uiMeta":{"note":"hi","flowEnd":false}}')
    expect(parsed!.a2uiMeta.note).toBe('hi')
    expect(parsed!.a2uiMeta.flowEnd).toBeUndefined()
  })

  it.each([['a string "true"', '"true"'], ['the number 1', '1'], ['an object', '{}'], ['an array', '[true]'], ['null', 'null']])(
    'a malformed flowEnd (%s) drops only itself, never the whole envelope',
    (_label, raw) => {
      const parsed = readMetaLine(`{"a2uiMeta":{"note":"hi","flowEnd":${raw}}}`)
      expect(parsed).toBeDefined()
      expect(parsed!.a2uiMeta.note).toBe('hi')
      expect(parsed!.a2uiMeta.flowEnd).toBeUndefined()
    },
  )

  it('a well-formed flowEnd survives beside a MALFORMED ask on the same line (per-field independence)', () => {
    const parsed = readMetaLine('{"a2uiMeta":{"note":"done","ask":"broken","flowEnd":true}}')
    expect(parsed!.a2uiMeta.ask).toBeUndefined()
    expect(parsed!.a2uiMeta.flowEnd).toBe(true)
  })

  it('flowEnd rides alongside every sibling field without disturbing them', () => {
    const line = JSON.stringify({
      a2uiMeta: { note: 'wrap', plan: { steps: [{ id: 's1', description: 'd' }] }, flowEnd: true },
    })
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.plan).toEqual({ steps: [{ id: 's1', description: 'd' }] })
    expect(parsed!.a2uiMeta.flowEnd).toBe(true)
  })

  it('the envelope stays disjoint from A2uiServerMessage — a `version` key still refuses the whole line', () => {
    expect(readMetaLine('{"version":"v1.0","a2uiMeta":{"flowEnd":true}}')).toBeUndefined()
  })
})

// ── GH #1196 / ADR-0203 clause 4: the additive `team` field ─────────────────────────────────────────
// The FIFTH MODEL-authored arm (ask → plan → personaPatch → flowEnd → team). Validates as a WHOLE the
// same way `plan`/`personaPatch` do: any malformed member drops the entire arm, never a partial roster.
describe('readMetaLine — the team field (GH #1196 / ADR-0203 clause 4)', () => {
  it('round-trips {note, team:{label, members}} alongside note/ask/plan/personaPatch/trace', () => {
    const line = JSON.stringify({
      a2uiMeta: {
        note: 'Here is the roster I have in mind.',
        team: {
          label: 'Hotel Concierge Team',
          tagline: 'Guest-facing hospitality crew',
          members: [
            { name: 'Amenities', role: 'Amenities specialist', routingDescription: 'Use for questions about pool, gym, spa hours.' },
            { name: 'Food & Drink', role: 'Dining concierge', routingDescription: 'Use for restaurant bookings and room service.' },
          ],
        },
      },
    })
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.note).toBe('Here is the roster I have in mind.')
    expect(parsed!.a2uiMeta.team).toEqual({
      label: 'Hotel Concierge Team',
      tagline: 'Guest-facing hospitality crew',
      members: [
        { name: 'Amenities', role: 'Amenities specialist', routingDescription: 'Use for questions about pool, gym, spa hours.' },
        { name: 'Food & Drink', role: 'Dining concierge', routingDescription: 'Use for restaurant bookings and room service.' },
      ],
    })
  })

  it('round-trips a team with no tagline (optional field absent)', () => {
    const line = JSON.stringify({
      a2uiMeta: { note: 'hi', team: { label: 'Support Team', members: [{ name: 'Tier 1', role: 'Front line', routingDescription: 'First contact.' }] } },
    })
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.team).toEqual({ label: 'Support Team', members: [{ name: 'Tier 1', role: 'Front line', routingDescription: 'First contact.' }] })
    expect(parsed!.a2uiMeta.team!.tagline).toBeUndefined()
  })

  it('a team with an empty members array round-trips (structurally valid, if degenerate)', () => {
    const line = '{"a2uiMeta":{"note":"hi","team":{"label":"Solo Team","members":[]}}}'
    expect(readMetaLine(line)!.a2uiMeta.team).toEqual({ label: 'Solo Team', members: [] })
  })

  it('a malformed team (non-object) drops ONLY itself — note/ask/plan/personaPatch still parse', () => {
    const line = JSON.stringify({
      a2uiMeta: {
        note: 'hi',
        ask: { surfaceId: 'ask-1' },
        plan: { steps: [{ id: 's', description: 'd' }] },
        personaPatch: { values: { name: 'X' } },
        team: 'not-an-object',
      },
    })
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.note).toBe('hi')
    expect(parsed!.a2uiMeta.ask).toEqual({ surfaceId: 'ask-1' })
    expect(parsed!.a2uiMeta.plan).toEqual({ steps: [{ id: 's', description: 'd' }] })
    expect(parsed!.a2uiMeta.personaPatch).toEqual({ values: { name: 'X' } })
    expect(parsed!.a2uiMeta.team).toBeUndefined()
  })

  it('an array team is rejected the same way (never a Record cast on an array)', () => {
    expect(readMetaLine('{"a2uiMeta":{"note":"hi","team":["Solo Team"]}}')!.a2uiMeta.team).toBeUndefined()
  })

  it('a team missing label drops the whole arm', () => {
    const line = '{"a2uiMeta":{"note":"hi","team":{"members":[{"name":"A","role":"R","routingDescription":"D"}]}}}'
    expect(readMetaLine(line)!.a2uiMeta.team).toBeUndefined()
  })

  it('a team with a non-string label drops the whole arm', () => {
    const line = '{"a2uiMeta":{"note":"hi","team":{"label":42,"members":[]}}}'
    expect(readMetaLine(line)!.a2uiMeta.team).toBeUndefined()
  })

  it('a team with a non-string tagline drops the whole arm', () => {
    const line = '{"a2uiMeta":{"note":"hi","team":{"label":"X","tagline":42,"members":[]}}}'
    expect(readMetaLine(line)!.a2uiMeta.team).toBeUndefined()
  })

  it('a team missing members drops the whole arm', () => {
    expect(readMetaLine('{"a2uiMeta":{"note":"hi","team":{"label":"X"}}}')!.a2uiMeta.team).toBeUndefined()
  })

  it('a team with a non-array members drops the whole arm', () => {
    expect(readMetaLine('{"a2uiMeta":{"note":"hi","team":{"label":"X","members":"nope"}}}')!.a2uiMeta.team).toBeUndefined()
  })

  it('a team with one member missing name/role/routingDescription drops the WHOLE arm — not a partial roster', () => {
    const line = '{"a2uiMeta":{"note":"hi","team":{"label":"X","members":[{"name":"A","role":"R","routingDescription":"D"},{"name":"B"}]}}}'
    expect(readMetaLine(line)!.a2uiMeta.team).toBeUndefined()
  })

  it('a team with a non-string member field drops the whole arm', () => {
    const line = '{"a2uiMeta":{"note":"hi","team":{"label":"X","members":[{"name":"A","role":42,"routingDescription":"D"}]}}}'
    expect(readMetaLine(line)!.a2uiMeta.team).toBeUndefined()
  })

  it('a note-only line (no team at all) still parses with team undefined — zero blast radius', () => {
    expect(readMetaLine('{"a2uiMeta":{"note":"hi"}}')!.a2uiMeta.team).toBeUndefined()
  })

  it('a well-formed team survives beside a MALFORMED plan on the same line (per-field independence)', () => {
    const line = '{"a2uiMeta":{"note":"hi","plan":"broken","team":{"label":"X","members":[]}}}'
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.plan).toBeUndefined()
    expect(parsed!.a2uiMeta.team).toEqual({ label: 'X', members: [] })
  })

  it('the envelope stays disjoint from A2uiServerMessage — a `version` key still refuses the whole line', () => {
    expect(readMetaLine('{"version":"v1.0","a2uiMeta":{"team":{"label":"X","members":[]}}}')).toBeUndefined()
  })
})

// ── GH #1259 / ADR-0206 clause 2: the additive `target` field ───────────────────────────────────────
// The SIXTH MODEL-authored arm (ask → plan → personaPatch → flowEnd → team → target). Validates as a
// WHOLE the same way `team`/`plan`/`personaPatch` do: a non-object arm, or a missing/non-string/EMPTY
// `surfaceId`, drops the entire arm — a malformed routing fact is worse than no routing fact (a
// wrong-but-present target would breathe the WRONG card with full apparent authority).
describe('readMetaLine — the target field (GH #1259 / ADR-0206 clause 2)', () => {
  it('round-trips {note, target:{surfaceId}} on the leading meta-line', () => {
    const line = JSON.stringify({
      a2uiMeta: {
        note: 'Updating your weather card with tomorrow.',
        target: { surfaceId: 'weather-1' },
      },
    })
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.note).toBe('Updating your weather card with tomorrow.')
    expect(parsed!.a2uiMeta.target).toEqual({ surfaceId: 'weather-1' })
  })

  it('a malformed target (non-object) drops ONLY itself — note/ask/plan/personaPatch/team still parse', () => {
    const line = JSON.stringify({
      a2uiMeta: {
        note: 'hi',
        ask: { surfaceId: 'ask-1' },
        plan: { steps: [{ id: 's', description: 'd' }] },
        personaPatch: { values: { name: 'X' } },
        team: { label: 'X', members: [] },
        target: 'weather-1',
      },
    })
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.note).toBe('hi')
    expect(parsed!.a2uiMeta.ask).toEqual({ surfaceId: 'ask-1' })
    expect(parsed!.a2uiMeta.plan).toEqual({ steps: [{ id: 's', description: 'd' }] })
    expect(parsed!.a2uiMeta.personaPatch).toEqual({ values: { name: 'X' } })
    expect(parsed!.a2uiMeta.team).toEqual({ label: 'X', members: [] })
    expect(parsed!.a2uiMeta.target).toBeUndefined()
  })

  it('an array target is rejected the same way (never a Record cast on an array)', () => {
    expect(readMetaLine('{"a2uiMeta":{"note":"hi","target":["weather-1"]}}')!.a2uiMeta.target).toBeUndefined()
  })

  it('a target missing surfaceId drops the whole arm', () => {
    expect(readMetaLine('{"a2uiMeta":{"note":"hi","target":{}}}')!.a2uiMeta.target).toBeUndefined()
  })

  it('a target with a non-string surfaceId drops the whole arm', () => {
    expect(readMetaLine('{"a2uiMeta":{"note":"hi","target":{"surfaceId":42}}}')!.a2uiMeta.target).toBeUndefined()
  })

  it('a target with an EMPTY surfaceId drops the whole arm — never a garbage id passed through hopefully', () => {
    expect(readMetaLine('{"a2uiMeta":{"note":"hi","target":{"surfaceId":""}}}')!.a2uiMeta.target).toBeUndefined()
  })

  it('a null target drops the whole arm', () => {
    expect(readMetaLine('{"a2uiMeta":{"note":"hi","target":null}}')!.a2uiMeta.target).toBeUndefined()
  })

  it('a note-only line (no target at all) still parses with target undefined — zero blast radius', () => {
    expect(readMetaLine('{"a2uiMeta":{"note":"hi"}}')!.a2uiMeta.target).toBeUndefined()
  })

  it('a well-formed target survives beside a MALFORMED team on the same line (per-field independence)', () => {
    const line = '{"a2uiMeta":{"note":"hi","team":"broken","target":{"surfaceId":"weather-1"}}}'
    const parsed = readMetaLine(line)
    expect(parsed!.a2uiMeta.team).toBeUndefined()
    expect(parsed!.a2uiMeta.target).toEqual({ surfaceId: 'weather-1' })
  })

  it('extra unknown keys inside the target arm are dropped — only surfaceId survives', () => {
    expect(readMetaLine('{"a2uiMeta":{"target":{"surfaceId":"w1","reason":"future"}}}')!.a2uiMeta.target).toEqual({ surfaceId: 'w1' })
  })

  it('the envelope stays disjoint from A2uiServerMessage — a `version` key still refuses the whole line (target form)', () => {
    expect(readMetaLine('{"version":"v1.0","a2uiMeta":{"target":{"surfaceId":"w1"}}}')).toBeUndefined()
  })
})
