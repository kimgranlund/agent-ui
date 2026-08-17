import { describe, it, expect } from 'vitest'
import type { TurnInput } from '@agent-ui/a2ui/agent/agent-transport'
import { parseCapture, serializeCapture, CaptureParseError, DEVTOOLS_CAPTURE_KIND, DEVTOOLS_CAPTURE_VERSION } from './format.ts'
import type { DevtoolsCapture } from './format.ts'
import { recordTurn } from '../timeline/events.ts'
import type { DevtoolsEvent } from '../timeline/events.ts'
import { scriptTransport, replayTransport } from '../transports/replay.ts'

// n6's accept row (SPEC-R10): the round-trip law — a capture recorded off a real transport, serialized,
// re-parsed, and replayed through `replayTransport` yields a BYTE-identical `line` sequence (AC1);
// malformed capture JSON throws a typed `CaptureParseError` NAMING the offending field (AC3). The
// debug-bundle additive proof (AC2) lives with the bundle's own suite (agent-admin-debug-export.test.ts).

const input: TurnInput = { kind: 'intent', text: 'capture me', session: { turns: [] } }
const fixedNow = () => '2026-08-17T00:00:00.000Z'
const fixedClock = () => 0

const TURN_LINES = [
  ['{"version":"v1.0","createSurface":{"surfaceId":"s1","catalogId":"agent-ui"}}', '{"version":"v1.0","updateComponents":{"surfaceId":"s1","components":[]}}'],
  ['{"version":"v1.0","updateComponents":{"surfaceId":"s1","components":[]}}'],
]

async function recordCapture(): Promise<DevtoolsCapture> {
  const transport = scriptTransport(TURN_LINES)
  const timeline: DevtoolsEvent[] = []
  for (const _turn of TURN_LINES) {
    for await (const event of recordTurn(transport, input, { backend: 'replay', now: fixedNow, clock: fixedClock })) {
      timeline.push(event)
    }
  }
  return {
    kind: DEVTOOLS_CAPTURE_KIND,
    version: DEVTOOLS_CAPTURE_VERSION,
    createdAt: fixedNow(),
    backend: 'replay',
    session: { turns: [] },
    timeline,
  }
}

async function replayedLines(capture: DevtoolsCapture): Promise<string[][]> {
  const transport = replayTransport(capture)
  const out: string[][] = []
  for (const _turn of TURN_LINES) {
    const lines: string[] = []
    for await (const line of transport.turn(input)) lines.push(line)
    out.push(lines)
  }
  return out
}

describe('round-trip (SPEC-R10 AC1) — export → parseCapture → replayTransport is byte-identical on the line sequence', () => {
  it('a recorded capture serialized + re-parsed replays every turn byte-identical', async () => {
    const capture = await recordCapture()
    const reparsed = parseCapture(serializeCapture(capture))
    expect(reparsed).toStrictEqual(capture) // the parse is lossless on the whole shape
    expect(await replayedLines(reparsed)).toEqual(TURN_LINES.map((t) => [...t]))
    // determinism: a second replay over the same parsed capture is byte-identical again
    expect(await replayedLines(reparsed)).toEqual(await replayedLines(capture))
  })

  it('serializeCapture output is stable text ending in one newline (the bundle prettyJson posture)', async () => {
    const capture = await recordCapture()
    const text = serializeCapture(capture)
    expect(text.endsWith('}\n')).toBe(true)
    expect(serializeCapture(capture)).toBe(text) // same capture, same bytes
  })
})

describe('parseCapture failures (SPEC-R10 AC3) — a typed error NAMING the offending field', () => {
  const valid = (): Record<string, unknown> => ({
    kind: DEVTOOLS_CAPTURE_KIND,
    version: DEVTOOLS_CAPTURE_VERSION,
    createdAt: '2026-08-17T00:00:00.000Z',
    backend: 'replay',
    session: { turns: [] },
    timeline: [
      { seq: 0, at: 't', kind: 'turn-start', input, backend: 'replay' },
      { seq: 1, at: 't', kind: 'line', line: '{"a":1}' },
      { seq: 2, at: 't', kind: 'turn-end', status: 'ok', lines: 1, ms: 0 },
    ],
  })

  const failField = (mutate: (c: Record<string, unknown>) => void): string => {
    const c = valid()
    mutate(c)
    try {
      parseCapture(JSON.stringify(c))
    } catch (err) {
      expect(err).toBeInstanceOf(CaptureParseError)
      return (err as CaptureParseError).field
    }
    throw new Error('parseCapture unexpectedly accepted the mutated capture')
  }

  it('the valid baseline parses (anti-vacuous)', () => {
    expect(parseCapture(JSON.stringify(valid())).timeline).toHaveLength(3)
  })

  it('non-JSON → (root)', () => {
    expect(() => parseCapture('not json')).toThrowError(CaptureParseError)
    try {
      parseCapture('not json')
    } catch (err) {
      expect((err as CaptureParseError).field).toBe('(root)')
    }
  })

  it('each malformed member is named precisely', () => {
    expect(failField((c) => (c.kind = 'something-else'))).toBe('kind')
    expect(failField((c) => (c.version = 2))).toBe('version')
    expect(failField((c) => delete c.createdAt)).toBe('createdAt')
    expect(failField((c) => (c.backend = 'carrier-pigeon'))).toBe('backend')
    expect(failField((c) => (c.session = null))).toBe('session')
    expect(failField((c) => (c.session = {}))).toBe('session.turns')
    expect(failField((c) => (c.timeline = {}))).toBe('timeline')
    expect(failField((c) => ((c.timeline as unknown[])[1] = { seq: 1, at: 't', kind: 'line' }))).toBe('timeline[1].line')
    expect(failField((c) => ((c.timeline as unknown[])[1] = { seq: 1, at: 't', kind: 'flavor' }))).toBe('timeline[1].kind')
    expect(failField((c) => ((c.timeline as unknown[])[2] = { seq: 2, at: 't', kind: 'turn-end', status: 'meh', lines: 1, ms: 0 }))).toBe(
      'timeline[2].status',
    )
    expect(failField((c) => ((c.timeline as unknown[])[0] = { seq: 'x', at: 't', kind: 'turn-start', input, backend: 'replay' }))).toBe(
      'timeline[0].seq',
    )
    expect(failField((c) => ((c.timeline as unknown[])[0] = { seq: 0, at: 't', kind: 'render', surfaceId: 's1' }))).toBe('timeline[0].ok')
  })

  it('the error message carries the field AND what was expected (one-look diagnosis)', () => {
    try {
      parseCapture(JSON.stringify({ ...valid(), backend: 'nope' }))
    } catch (err) {
      const e = err as CaptureParseError
      expect(e.message).toContain('backend')
      expect(e.message).toContain('replay | proxy | a2a')
    }
  })
})
