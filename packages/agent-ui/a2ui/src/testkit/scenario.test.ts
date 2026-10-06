// scenario.test.ts: the kit's scenario format (tools/testkit/scenario.ts): the strict parser's closed field
// set, the arm rules, the free-form slots, line normalization, and the recorded-backbone bridge (T-0011).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { armOffline } from '../../tools/testkit/offline.ts'
import { parseScenario, ScenarioError, toRecordedTranscript, matchesInput } from '../../tools/testkit/scenario.ts'
import { createRecordedTransport } from '../agent/recorded-transport.ts'
import type { TurnInput } from '../agent/agent-transport.ts'

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

const CS = { version: 'v1.0', createSurface: { surfaceId: 's', catalogId: 'agent-ui' } }
const UC = { version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Text', text: 'hi' }] } }

/** A scenario exercising every field, both act arms and all three respond arms. */
function full(): Record<string, unknown> {
  return {
    kind: 'agent-ui-a2ui-scenario',
    version: 1,
    name: 'full',
    description: 'every field',
    catalogId: 'agent-ui',
    intent: 'show a greeting',
    expectRed: { layer: 'renderer', code: 'TREE_MISMATCH' },
    turns: [
      {
        match: { inputKind: 'intent', textIncludes: 'greeting' },
        respond: { lines: [CS, JSON.stringify(UC)] },
        atFinalize: true,
        expect: {
          heal: { ok: true, repairs: ['version-fill'] },
          verdict: { valid: true, failures: [] },
          tree: [{ surfaceId: 's', select: 'ui-text', count: 1, textIncludes: 'hi', attrs: { hidden: null, role: 'note' } }],
          bindings: { allow: ['/x'] },
          clientMessages: [{ action: { name: 'go', anything: { nested: true } } }],
          dataModel: [{ surfaceId: 's', path: '/a', equals: { free: ['form'] } }],
        },
        act: { click: { surfaceId: 's', select: 'ui-button', nth: 0 } },
      },
      {
        intent: 'next',
        match: { inputKind: 'client', actionName: 'go' },
        respond: {
          rounds: ['x', { tool: 'lookup', input: { any: 'key' }, then: 'y' }],
          maxRounds: 2,
          tools: [{ name: 'lookup', description: 'd', input_schema: { type: 'object', anyKey: 1 }, reply: { throw: 'boom' } }],
        },
        expect: { produce: { outcome: 'eventual', rounds: 2, failureCodes: ['PARSE'] }, tools: [{ tool: 'lookup', input: { free: 1 } }] },
        act: { setValue: { surfaceId: 's', select: 'ui-text-field', prop: 'value', event: 'change', value: { any: 'thing' } } },
      },
      { intent: 'fail', respond: { error: 'upstream down' } },
    ],
  }
}

function expectPathError(doc: unknown, path: string): void {
  let caught: unknown
  try {
    parseScenario(JSON.stringify(doc))
  } catch (err) {
    caught = err
  }
  expect(caught, `expected a ScenarioError at ${path}`).toBeInstanceOf(ScenarioError)
  expect((caught as ScenarioError).path).toBe(path)
}

/** Deep-clone `full()` and apply `edit` to the clone. */
function edited(edit: (d: any) => void): unknown {
  const d = structuredClone(full())
  edit(d)
  return d
}

describe('parseScenario: the closed field set', () => {
  it('a scenario using every field, both act arms and all three respond arms parses', () => {
    const s = parseScenario(JSON.stringify(full()))
    expect(s.turns).toHaveLength(3)
    expect(s.turns[0]!.act).toEqual({ click: { surfaceId: 's', select: 'ui-button', nth: 0 } })
    expect(s.turns[1]!.act).toEqual({ setValue: { surfaceId: 's', select: 'ui-text-field', prop: 'value', event: 'change', value: { any: 'thing' } } })
    expect(s.expectRed).toEqual({ layer: 'renderer', code: 'TREE_MISMATCH' })
  })

  it('an unknown top-level, turn, match, respond or act field raises ScenarioError at its path', () => {
    expectPathError(edited((d) => (d.foo = 1)), '$.foo')
    expectPathError(edited((d) => (d.turns[0].foo = 1)), '$.turns[0].foo')
    expectPathError(edited((d) => (d.turns[0].match.foo = 1)), '$.turns[0].match.foo')
    expectPathError(edited((d) => (d.turns[0].respond.foo = 1)), '$.turns[0].respond.foo')
    expectPathError(edited((d) => (d.turns[0].act.click.foo = 1)), '$.turns[0].act.click.foo')
    expectPathError(edited((d) => (d.turns[1].respond.rounds[1].foo = 1)), '$.turns[1].respond.rounds[1].foo')
    expectPathError(edited((d) => (d.turns[1].respond.tools[0].foo = 1)), '$.turns[1].respond.tools[0].foo')
    expectPathError(edited((d) => (d.expectRed.foo = 1)), '$.expectRed.foo')
  })

  it('an unknown field inside each of the eight TurnExpect sub-objects raises at its path', () => {
    expectPathError(edited((d) => (d.turns[0].expect.heal.foo = 1)), '$.turns[0].expect.heal.foo')
    expectPathError(edited((d) => (d.turns[0].expect.verdict.foo = 1)), '$.turns[0].expect.verdict.foo')
    expectPathError(edited((d) => d.turns[0].expect.verdict.failures.push({ code: 'X', path: '', foo: 1 })), '$.turns[0].expect.verdict.failures[0].foo')
    expectPathError(edited((d) => (d.turns[1].expect.produce.foo = 1)), '$.turns[1].expect.produce.foo')
    expectPathError(edited((d) => (d.turns[0].expect.tree[0].foo = 1)), '$.turns[0].expect.tree[0].foo')
    expectPathError(edited((d) => (d.turns[0].expect.bindings.foo = 1)), '$.turns[0].expect.bindings.foo')
    expectPathError(edited((d) => (d.turns[0].expect.clientMessages[0] = 'not an object')), '$.turns[0].expect.clientMessages[0]')
    expectPathError(edited((d) => (d.turns[0].expect.dataModel[0].foo = 1)), '$.turns[0].expect.dataModel[0].foo')
    expectPathError(edited((d) => (d.turns[1].expect.tools[0].foo = 1)), '$.turns[1].expect.tools[0].foo')
    expectPathError(edited((d) => (d.turns[0].expect.foo = 1)), '$.turns[0].expect.foo')
  })

  it('free-form slots accept any keys: lines objects, equals, value, both inputs, input_schema, clientMessages', () => {
    const s = parseScenario(JSON.stringify(full()))
    const t0 = s.turns[0]!
    expect(t0.expect!.clientMessages![0]).toEqual({ action: { name: 'go', anything: { nested: true } } })
    expect(t0.expect!.dataModel![0]!.equals).toEqual({ free: ['form'] })
    const t1 = s.turns[1]!
    expect((t1.respond as { rounds: unknown[] }).rounds[1]).toEqual({ tool: 'lookup', input: { any: 'key' }, then: 'y' })
    expect((t1.respond as { tools: { input_schema: unknown }[] }).tools[0]!.input_schema).toEqual({ type: 'object', anyKey: 1 })
    expect(t1.expect!.tools![0]!.input).toEqual({ free: 1 })
  })
})

describe('parseScenario: the arm rules', () => {
  it('a kind or version mismatch raises', () => {
    expectPathError(edited((d) => (d.kind = 'other')), '$.kind')
    expectPathError(edited((d) => (d.version = 2)), '$.version')
  })

  it('a respond without exactly one of lines, rounds or error raises', () => {
    expectPathError(edited((d) => (d.turns[0].respond = {})), '$.turns[0].respond')
    expectPathError(edited((d) => (d.turns[0].respond = { lines: [], error: 'x' })), '$.turns[0].respond')
  })

  it('expect.produce, expect.tools or respond.tools on a non-rounds turn raises', () => {
    expectPathError(edited((d) => (d.turns[0].expect.produce = { outcome: 'halt' })), '$.turns[0].expect.produce')
    expectPathError(edited((d) => (d.turns[0].expect.tools = [])), '$.turns[0].expect.tools')
    expectPathError(edited((d) => (d.turns[0].respond.tools = [])), '$.turns[0].respond.tools')
  })

  it('expect.heal or expect.verdict on an error turn raises', () => {
    expectPathError(edited((d) => (d.turns[2].expect = { heal: { ok: true } })), '$.turns[2].expect.heal')
    expectPathError(edited((d) => (d.turns[2].expect = { verdict: { valid: true, failures: [] } })), '$.turns[2].expect.verdict')
  })

  it('an act without exactly one of click or setValue raises', () => {
    expectPathError(edited((d) => (d.turns[0].act = {})), '$.turns[0].act')
    expectPathError(edited((d) => (d.turns[0].act = { click: { surfaceId: 's', select: 'x' }, setValue: {} })), '$.turns[0].act')
  })

  it('turns[0].intent raises', () => {
    expectPathError(edited((d) => (d.turns[0].intent = 'no')), '$.turns[0].intent')
  })

  it('an expectRed.layer outside LAYERS raises', () => {
    expectPathError(edited((d) => (d.expectRed.layer = 'network')), '$.expectRed.layer')
  })

  it('listing single-object-envelope in heal.repairs raises (the kit drops it from every union)', () => {
    expectPathError(edited((d) => (d.turns[0].expect.heal.repairs = ['single-object-envelope'])), '$.turns[0].expect.heal.repairs[0]')
  })

  it('a non-JSON document raises at $', () => {
    expect(() => parseScenario('{nope')).toThrow(ScenarioError)
  })
})

describe('normalization and the recorded backbone', () => {
  it('an object line normalizes to one JSON string', () => {
    const s = parseScenario(JSON.stringify(full()))
    const lines = (s.turns[0]!.respond as { lines: string[] }).lines
    expect(lines[0]).toBe(JSON.stringify(CS))
    expect(lines[1]).toBe(JSON.stringify(UC))
    expect(lines.every((l) => !l.includes('\n'))).toBe(true)
  })

  it('toRecordedTranscript replays byte-identical lines through createRecordedTransport', async () => {
    const doc = edited((d) => (d.turns = [d.turns[0], { intent: 'two', respond: { lines: ['{"version":"v1.0","deleteSurface":{"surfaceId":"s"}}'] } }]))
    const s = parseScenario(JSON.stringify(doc))
    const transport = createRecordedTransport(toRecordedTranscript(s))
    const input: TurnInput = { kind: 'intent', text: s.intent, session: { turns: [] } }
    const pulled: string[][] = []
    for (let i = 0; i < 2; i++) {
      const lines: string[] = []
      for await (const line of transport.turn(input)) lines.push(line)
      pulled.push(lines)
    }
    expect(pulled).toEqual(s.turns.map((t) => (t.respond as { lines: string[] }).lines))
  })

  it('toRecordedTranscript refuses a rounds turn (it has no recording)', () => {
    const s = parseScenario(JSON.stringify(full()))
    expect(() => toRecordedTranscript(s)).toThrow(ScenarioError)
  })
})

describe('matchesInput', () => {
  const session = { turns: [] }
  const intent: TurnInput = { kind: 'intent', text: 'show a greeting', session }
  const click: TurnInput = {
    kind: 'client',
    session,
    message: { version: 'v1.0', action: { surfaceId: 's', actionId: 'a', name: 'go', sourceComponentId: 'b', timestamp: 't', context: {} } },
  }
  it('absent accepts anything; each key narrows', () => {
    expect(matchesInput(undefined, intent)).toBe(true)
    expect(matchesInput({ inputKind: 'client' }, intent)).toBe(false)
    expect(matchesInput({ textIncludes: 'greet' }, intent)).toBe(true)
    expect(matchesInput({ textIncludes: 'greet' }, click)).toBe(false)
    expect(matchesInput({ actionName: 'go' }, click)).toBe(true)
    expect(matchesInput({ actionName: 'stop' }, click)).toBe(false)
    expect(matchesInput({ actionName: 'go' }, intent)).toBe(false)
  })
})
