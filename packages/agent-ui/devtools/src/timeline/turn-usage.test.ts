import { describe, it, expect } from 'vitest'
import type { AgentTransport, TurnInput } from '@agent-ui/a2ui/agent/agent-transport'
import type { TokenUsage, TurnTrace } from '@agent-ui/a2ui/agent/meta-line'
import { recordTurn } from './events.ts'
import type { DevtoolsEvent } from './events.ts'
import { scriptTransport } from '../transports/replay.ts'
import { parseCapture, serializeCapture, CaptureParseError, DEVTOOLS_CAPTURE_KIND, DEVTOOLS_CAPTURE_VERSION } from '../capture/format.ts'
import type { DevtoolsCapture } from '../capture/format.ts'

// GH #1809 / #1797: turn-end carries the turn's provider-billed TokenUsage, latched from the meta-line trace.

const input: TurnInput = { kind: 'intent', text: 'count me', session: { turns: [] } }
const fixedNow = () => '2026-10-05T00:00:00.000Z'
const clock = () => 1000

async function record(transport: AgentTransport): Promise<DevtoolsEvent[]> {
  const out: DevtoolsEvent[] = []
  for await (const e of recordTurn(transport, input, { backend: 'replay', now: fixedNow, clock })) out.push(e)
  return out
}

const usage: TokenUsage = { inputTokens: 1200, outputTokens: 340, cacheReadInputTokens: 800 }
const trace = (u?: TokenUsage): TurnTrace => ({
  turnIndex: 0,
  query: { intent: 'count me', k: 3 },
  exemplarIds: [],
  rounds: 1,
  healed: 0,
  failureCodes: [],
  model: 'm',
  ...(u !== undefined ? { usage: u } : {}),
})
const metaLine = (u?: TokenUsage) => JSON.stringify({ a2uiMeta: { trace: trace(u) } })
const a2uiLine = '{"version":"v0.9","createSurface":{"surfaceId":"s1"}}'

function captureOf(timeline: unknown[]): string {
  return JSON.stringify({
    kind: DEVTOOLS_CAPTURE_KIND,
    version: DEVTOOLS_CAPTURE_VERSION,
    createdAt: fixedNow(),
    backend: 'replay',
    session: { turns: [] },
    timeline,
  })
}
const start = { seq: 0, at: fixedNow(), kind: 'turn-start', input, backend: 'replay' }
const line = { seq: 1, at: fixedNow(), kind: 'line', line: a2uiLine }
const end = { seq: 2, at: fixedNow(), kind: 'turn-end', status: 'ok', lines: 1, ms: 0 }

describe('turn-end usage (GH #1809)', () => {
  it('(a) a meta-line trace carrying usage lands on turn-end.usage', async () => {
    const events = await record(scriptTransport([[metaLine(usage), a2uiLine]]))
    const turnEnd = events.at(-1)!
    expect(turnEnd.kind).toBe('turn-end')
    expect((turnEnd as { usage?: TokenUsage }).usage).toEqual(usage)
  })

  it('(b) no trace usage leaves no usage key on turn-end', async () => {
    const events = await record(scriptTransport([[metaLine(), a2uiLine]]))
    const turnEnd = events.at(-1)!
    expect(turnEnd.kind).toBe('turn-end')
    expect('usage' in turnEnd).toBe(false)
  })

  it('(c) a capture whose turn-end carries usage round-trips equal', async () => {
    const timeline = await record(scriptTransport([[metaLine(usage), a2uiLine]]))
    const capture: DevtoolsCapture = {
      kind: DEVTOOLS_CAPTURE_KIND,
      version: DEVTOOLS_CAPTURE_VERSION,
      createdAt: fixedNow(),
      backend: 'replay',
      session: { turns: [] },
      timeline,
    }
    expect(parseCapture(serializeCapture(capture))).toStrictEqual(capture)
  })

  it('(d) a v1 capture whose turn-end lacks usage parses', () => {
    const parsed = parseCapture(captureOf([start, line, end]))
    expect('usage' in parsed.timeline[2]!).toBe(false)
  })

  it('(e) a malformed usage throws CaptureParseError naming timeline[2].usage', () => {
    const text = captureOf([start, line, { ...end, usage: { inputTokens: '12', outputTokens: 3 } }])
    let caught: unknown
    try {
      parseCapture(text)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(CaptureParseError)
    expect((caught as CaptureParseError).field).toBe('timeline[2].usage')
  })
})
