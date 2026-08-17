import { describe, it, expect } from 'vitest'
import type { AgentTransport, TurnInput } from '@agent-ui/a2ui/agent/agent-transport'
import { readMetaLine } from '@agent-ui/a2ui/agent/meta-line'
import { scriptTransport, replayTransport, capturedLineTimelines, TRANSCRIPT_EXHAUSTED_MESSAGE } from './replay.ts'
import type { DevtoolsCapture } from '../capture/format.ts'

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
    { seq: 2, at: 't', kind: 'meta', meta: { note: 'observed, never replayed' } },
    { seq: 3, at: 't', kind: 'line', line: '{"version":"v0.9","updateComponents":{"surfaceId":"s1"}}' },
    { seq: 4, at: 't', kind: 'turn-end', status: 'ok', lines: 2, ms: 5 },
    { seq: 5, at: 't', kind: 'turn-start', input, backend: 'replay' },
    { seq: 6, at: 't', kind: 'line', line: '{"version":"v0.9","updateDataModel":{"surfaceId":"s1"}}' },
    { seq: 7, at: 't', kind: 'turn-end', status: 'ok', lines: 1, ms: 3 },
  ],
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
  it('extracts per-turn line payloads bracketed by turn-start/turn-end — meta events never replay', () => {
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
