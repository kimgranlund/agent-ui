import { describe, it, expect } from 'vitest'
import type { AgentTransport, TurnInput } from '@agent-ui/a2ui/agent/agent-transport'
import { readMetaLine } from '@agent-ui/a2ui/agent/meta-line'
import { scriptTransport, replayTransport, capturedLineTimelines, TRANSCRIPT_EXHAUSTED_MESSAGE } from './replay.ts'
import type { DevtoolsCapture } from '../capture/format.ts'
import { recordTurn } from '../timeline/events.ts'
import type { DevtoolsEvent, DevtoolsMeta } from '../timeline/events.ts'

// n2a's accept row (SPEC-R3): deterministic byte-identical playback; N turns serve N calls, call N+1
// yields ONE terminal a2uiMeta.error line (the recorded-transcript-exhausted idiom); zero I/O, zero timers.

const input: TurnInput = { kind: 'intent', text: 'hello', session: { turns: [] } }

async function collect(transport: AgentTransport): Promise<string[]> {
  const out: string[] = []
  for await (const line of transport.turn(input)) out.push(line)
  return out
}

const capture: DevtoolsCapture = {
  kind: 'agent-ui-devtools-capture',
  version: 1,
  createdAt: '2026-08-17T00:00:00.000Z',
  backend: 'replay',
  session: { turns: [] },
  timeline: [
    { seq: 0, at: 't', kind: 'turn-start', input, backend: 'replay' },
    { seq: 1, at: 't', kind: 'line', line: '{"version":"v0.9","createSurface":{"surfaceId":"s1"}}' },
    { seq: 2, at: 't', kind: 'line', line: '{"version":"v0.9","updateComponents":{"surfaceId":"s1"}}' },
    { seq: 3, at: 't', kind: 'turn-end', status: 'ok', lines: 2, ms: 5 },
    { seq: 4, at: 't', kind: 'turn-start', input, backend: 'replay' },
    { seq: 5, at: 't', kind: 'line', line: '{"version":"v0.9","updateDataModel":{"surfaceId":"s1"}}' },
    { seq: 6, at: 't', kind: 'turn-end', status: 'ok', lines: 1, ms: 3 },
  ],
}

// One `meta` payload per member of the closed `a2uiMeta` arm vocabulary (meta-line.ts). The mapped type
// makes the list exhaustive at compile time: a new arm added to `A2uiMetaEnvelope` reds `tsc` here until
// a fixture lands, so the replay law below can never silently lag the producer's vocabulary.
const ARM_FIXTURES: { [K in keyof DevtoolsMeta]-?: DevtoolsMeta } = {
  note: { note: 'I will plan this in two steps.' },
  ask: { ask: { surfaceId: 'ask-1' } },
  plan: { plan: { steps: [{ id: 's1', description: 'draw the card' }, { id: 's2', description: 'wire the button' }] } },
  personaPatch: { personaPatch: { values: { tone: 'warm' }, entries: { facts: [{ text: 'likes tea' }] } } },
  flowEnd: { flowEnd: true },
  team: { team: { label: 'Support', tagline: 'two seats', members: [{ name: 'Ada', role: 'triage', routingDescription: 'first contact' }] } },
  target: { target: { surfaceId: 's1' } },
  trace: {
    trace: {
      turnIndex: 0,
      query: { intent: 'hello', k: 2 },
      exemplarIds: ['e1'],
      rounds: 1,
      healed: 0,
      failureCodes: [],
      model: 'test-model',
      usage: { inputTokens: 10, outputTokens: 4 },
    },
  },
  progress: { progress: { stage: 'retry', round: 2, detail: 'schema error' } },
  error: { error: 'upstream fault' },
}
const ARMS = Object.keys(ARM_FIXTURES) as (keyof DevtoolsMeta)[]
const metaWire = (meta: DevtoolsMeta): string => JSON.stringify({ a2uiMeta: meta })
const CREATE = '{"version":"v0.9","createSurface":{"surfaceId":"s1"}}'
const UPDATE = '{"version":"v0.9","updateComponents":{"surfaceId":"s1"}}'

/** A one-turn capture whose timeline interleaves `line` events with one `meta` event per arm. */
function metaCapture(): DevtoolsCapture {
  const body: Array<{ line: string } | { meta: DevtoolsMeta }> = [
    { meta: ARM_FIXTURES.note },
    { line: CREATE },
    ...ARMS.slice(1).map((arm) => ({ meta: ARM_FIXTURES[arm] })),
    { line: UPDATE },
  ]
  const timeline: DevtoolsEvent[] = [
    { seq: 0, at: 't', kind: 'turn-start', input, backend: 'replay' },
    ...body.map((b, i): DevtoolsEvent => ({ seq: i + 1, at: 't', ...('meta' in b ? { kind: 'meta' as const, meta: b.meta } : { kind: 'line' as const, line: b.line }) })),
    { seq: body.length + 1, at: 't', kind: 'turn-end', status: 'halt', lines: 2, ms: 1 },
  ]
  return { kind: 'agent-ui-devtools-capture', version: 1, createdAt: 't', backend: 'replay', session: { turns: [] }, timeline }
}

describe('scriptTransport (SPEC-R3)', () => {
  // SPEC-R2 AC1's type-level half: the factory's return type IS AgentTransport.
  const _seam: AgentTransport = scriptTransport([])
  void _seam

  it('turn() call N yields timelines[N] in order; two runs are byte-identical (AC1)', async () => {
    const timelines = [['a1', 'a2'], ['b1']]
    const first = scriptTransport(timelines)
    const second = scriptTransport(timelines)
    const run = async (t: AgentTransport) => [await collect(t), await collect(t)]
    const [f1, f2] = await run(first)
    const [s1, s2] = await run(second)
    expect(f1).toEqual(['a1', 'a2'])
    expect(f2).toEqual(['b1'])
    expect(s1).toEqual(f1)
    expect(s2).toEqual(f2)
  })

  it('call N+1 past the last scripted turn yields ONE terminal a2uiMeta.error line (AC2)', async () => {
    const transport = scriptTransport([['only']])
    await collect(transport) // consume turn 1
    const exhausted = await collect(transport)
    expect(exhausted).toHaveLength(1)
    const meta = readMetaLine(exhausted[0]!)
    expect(meta?.a2uiMeta.error).toBe(TRANSCRIPT_EXHAUSTED_MESSAGE)
    // and it stays terminal on every later call — never a hang, never a throw
    const again = await collect(transport)
    expect(again).toEqual(exhausted)
  })
})

describe('replayTransport over a DevtoolsCapture (SPEC-R3 / SPEC-R10 AC1 groundwork)', () => {
  it('extracts per-turn line payloads bracketed by turn-start/turn-end (a capture with no meta events is line-only)', () => {
    expect(capturedLineTimelines(capture)).toEqual([
      ['{"version":"v0.9","createSurface":{"surfaceId":"s1"}}', '{"version":"v0.9","updateComponents":{"surfaceId":"s1"}}'],
      ['{"version":"v0.9","updateDataModel":{"surfaceId":"s1"}}'],
    ])
  })

  it('a trailing unterminated turn still contributes its lines', () => {
    const cut: DevtoolsCapture = {
      ...capture,
      timeline: [
        { seq: 0, at: 't', kind: 'turn-start', input, backend: 'replay' },
        { seq: 1, at: 't', kind: 'line', line: 'x1' },
      ],
    }
    expect(capturedLineTimelines(cut)).toEqual([['x1']])
  })

  it('two runs over the same capture yield byte-identical line sequences (AC1)', async () => {
    const runAll = async () => {
      const t = replayTransport(capture)
      return [await collect(t), await collect(t)]
    }
    const a = await runAll()
    const b = await runAll()
    expect(a).toEqual(b)
    expect(a[0]).toHaveLength(2)
    expect(a[1]).toHaveLength(1)
  })

  it('call N+1 past the last recorded turn yields the exhausted meta-line (AC2)', async () => {
    const t = replayTransport(capture)
    await collect(t)
    await collect(t)
    const exhausted = await collect(t)
    expect(exhausted).toHaveLength(1)
    expect(readMetaLine(exhausted[0]!)?.a2uiMeta.error).toBe(TRANSCRIPT_EXHAUSTED_MESSAGE)
  })
})

describe('meta replay (SPEC-R3 AC3 / SPEC-R10 AC4, ADR-0239): `meta` events replay as the same NDJSON meta-lines, in order', () => {
  const expectedWire = (): string[] => {
    const wires = ARMS.map((arm) => metaWire(ARM_FIXTURES[arm]))
    return [wires[0]!, CREATE, ...wires.slice(1), UPDATE]
  }

  it('anti-vacuous: the fixture really carries every arm of the closed vocabulary, one per meta event', () => {
    expect(ARMS).toEqual(['note', 'ask', 'plan', 'personaPatch', 'flowEnd', 'team', 'target', 'trace', 'progress', 'error'])
    for (const arm of ARMS) expect(Object.keys(ARM_FIXTURES[arm])).toEqual([arm])
    expect(metaCapture().timeline.filter((e) => e.kind === 'meta')).toHaveLength(ARMS.length)
  })

  it('every arm replays as an a2uiMeta line, interleaved with line events in the capture order', () => {
    expect(capturedLineTimelines(metaCapture())).toEqual([expectedWire()])
  })

  it('every replayed meta-line is accepted by readMetaLine and parses back to its event payload', () => {
    const [lines] = capturedLineTimelines(metaCapture())
    const metaLines = lines!.filter((l) => readMetaLine(l) !== undefined)
    expect(metaLines).toHaveLength(ARMS.length)
    ARMS.forEach((arm, i) => {
      expect(readMetaLine(metaLines[i]!)?.a2uiMeta[arm]).toStrictEqual(ARM_FIXTURES[arm][arm])
    })
  })

  it('replayTransport yields them through the seam, byte-identical run over run (AC1)', async () => {
    const run = async () => {
      const t = replayTransport(metaCapture())
      return collect(t)
    }
    const a = await run()
    expect(a).toEqual(expectedWire())
    expect(await run()).toEqual(a)
  })

  it('a capture with no meta events replays exactly its line payloads (the line-only law is unchanged)', () => {
    const lineOnly = capturedLineTimelines(capture)
    const filtered = capture.timeline.filter((e) => e.kind === 'line').map((e) => (e as { line: string }).line)
    expect(lineOnly.flat()).toEqual(filtered)
    const withoutMeta: DevtoolsCapture = { ...metaCapture(), timeline: metaCapture().timeline.filter((e) => e.kind !== 'meta') }
    expect(capturedLineTimelines(withoutMeta)).toEqual([[CREATE, UPDATE]])
  })

  it('a trailing unterminated turn still replays its meta events', () => {
    const cut: DevtoolsCapture = {
      ...capture,
      timeline: [
        { seq: 0, at: 't', kind: 'turn-start', input, backend: 'replay' },
        { seq: 1, at: 't', kind: 'meta', meta: { note: 'cut off' } },
        { seq: 2, at: 't', kind: 'line', line: 'x1' },
      ],
    }
    expect(capturedLineTimelines(cut)).toEqual([[metaWire({ note: 'cut off' }), 'x1']])
  })

  it('an empty meta payload (every arm malformed on the wire) still replays as a meta-line', () => {
    const emptied: DevtoolsCapture = {
      ...capture,
      timeline: [
        { seq: 0, at: 't', kind: 'turn-start', input, backend: 'replay' },
        { seq: 1, at: 't', kind: 'meta', meta: {} },
        { seq: 2, at: 't', kind: 'turn-end', status: 'ok', lines: 0, ms: 0 },
      ],
    }
    const [lines] = capturedLineTimelines(emptied)
    expect(lines).toEqual(['{"a2uiMeta":{}}'])
    expect(readMetaLine(lines![0]!)).toBeDefined()
  })

  it('round trip: recordTurn -> capturedLineTimelines -> recordTurn is lossless for every arm (kinds, order, payloads, status, usage)', async () => {
    const turnA = [
      // Non-canonical key order and an extra key on `ask` on purpose: the replayed BYTES may differ from
      // this wire line, the PARSED payload (the capture's own record) must not.
      '{"a2uiMeta":{"progress":{"stage":"content"},"ask":{"surfaceId":"ask-1","extra":1},"note":"hi"}}',
      metaWire(ARM_FIXTURES.plan),
      CREATE,
      metaWire(ARM_FIXTURES.personaPatch),
      metaWire(ARM_FIXTURES.flowEnd),
      metaWire(ARM_FIXTURES.team),
      metaWire(ARM_FIXTURES.target),
      UPDATE,
      metaWire(ARM_FIXTURES.trace),
      metaWire(ARM_FIXTURES.error),
    ]
    const turnB = [CREATE, metaWire(ARM_FIXTURES.note)]
    const opts = { backend: 'replay', now: () => 't', clock: () => 0 }
    // seq restarts per turn (recordTurn's own law), so the concatenation IS a multi-turn timeline.
    const recordAll = async (transport: AgentTransport, turns: number): Promise<DevtoolsEvent[]> => {
      const out: DevtoolsEvent[] = []
      for (let i = 0; i < turns; i++) for await (const e of recordTurn(transport, input, opts)) out.push(e)
      return out
    }

    const recorded = await recordAll(scriptTransport([turnA, turnB]), 2)
    const replayed = await recordAll(replayTransport({ ...capture, timeline: recorded }), 2)

    expect(replayed).toStrictEqual(recorded)
    // not vacuous: every arm is on the recorded side, and the halt status + usage latch survived the trip
    const armsSeen = new Set(recorded.flatMap((e) => (e.kind === 'meta' ? Object.keys(e.meta) : [])))
    expect([...armsSeen].sort()).toEqual([...ARMS].sort())
    expect(replayed.filter((e) => e.kind === 'turn-end')).toMatchObject([
      { status: 'halt', lines: 2, usage: { inputTokens: 10, outputTokens: 4 } },
      { status: 'ok', lines: 1 },
    ])
    // the line events are byte-identical to the wire lines, in order
    expect(replayed.filter((e) => e.kind === 'line').map((e) => (e as { line: string }).line)).toEqual([CREATE, UPDATE, CREATE])
  })
})
