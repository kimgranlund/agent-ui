import { describe, it, expect } from 'vitest'
import type { AgentTransport, TurnInput } from '@agent-ui/a2ui/agent/agent-transport'
import { formatErrorLine } from '@agent-ui/a2ui/agent/meta-line'
import { recordTurn, serializeDevtoolsEvent } from './events.ts'
import type { DevtoolsEvent } from './events.ts'
import { scriptTransport } from '../transports/replay.ts'

// n3a's accept row (SPEC-R7): seq contiguous from 0; turn-start first, turn-end last, exactly once
// each; an a2uiMeta line lands as kind `meta` (parsed) AND is absent from `line` events; a transport
// throw yields `error` then turn-end{status:'error'}; every event JSON.parses from its own serialized
// NDJSON line.

const input: TurnInput = { kind: 'intent', text: 'record me', session: { turns: [] } }

// Deterministic envelope sources — the injectable seams RecordTurnOptions declares.
const fixedNow = () => '2026-08-17T00:00:00.000Z'
const tickingClock = (() => {
  let t = 1000
  return () => (t += 10)
})()

async function record(transport: AgentTransport): Promise<DevtoolsEvent[]> {
  const out: DevtoolsEvent[] = []
  for await (const e of recordTurn(transport, input, { backend: 'replay', now: fixedNow, clock: tickingClock })) out.push(e)
  return out
}

const metaLine = JSON.stringify({ a2uiMeta: { note: 'thinking out loud', progress: { stage: 'content' } } })
const a2uiLine1 = '{"version":"v0.9","createSurface":{"surfaceId":"s1"}}'
const a2uiLine2 = '{"version":"v0.9","updateComponents":{"surfaceId":"s1"}}'

describe('recordTurn (SPEC-R7)', () => {
  it('brackets exactly once, seq contiguous from 0, at from the injected source (AC1)', async () => {
    const events = await record(scriptTransport([[metaLine, a2uiLine1, a2uiLine2]]))
    expect(events.map((e) => e.kind)).toEqual(['turn-start', 'meta', 'line', 'line', 'turn-end'])
    expect(events.map((e) => e.seq)).toEqual([0, 1, 2, 3, 4])
    expect(events.every((e) => e.at === fixedNow())).toBe(true)
    const starts = events.filter((e) => e.kind === 'turn-start')
    const ends = events.filter((e) => e.kind === 'turn-end')
    expect(starts).toHaveLength(1)
    expect(ends).toHaveLength(1)
    expect(events[0]).toMatchObject({ kind: 'turn-start', input, backend: 'replay' })
    expect(events.at(-1)).toMatchObject({ kind: 'turn-end', status: 'ok', lines: 2 })
  })

  it('an a2uiMeta line lands as PARSED meta and is absent from line events (AC2)', async () => {
    const events = await record(scriptTransport([[metaLine, a2uiLine1]]))
    const metas = events.filter((e): e is Extract<DevtoolsEvent, { kind: 'meta' }> => e.kind === 'meta')
    const rawLines = events.filter((e): e is Extract<DevtoolsEvent, { kind: 'line' }> => e.kind === 'line')
    expect(metas).toHaveLength(1)
    expect(metas[0]).toMatchObject({ meta: { note: 'thinking out loud', progress: { stage: 'content' } } })
    expect(rawLines.map((e) => e.line)).toEqual([a2uiLine1]) // the meta line never leaks into `line`
    // the compacted meta payload carries NO undefined-valued members (the JSON round-trip law)
    expect(Object.values(metas[0]!.meta).some((v) => v === undefined)).toBe(false)
    expect(Object.keys(metas[0]!.meta).sort()).toEqual(['note', 'progress'])
  })

  it('a transport throw yields error then turn-end{status:"error"} (AC2)', async () => {
    const failing: AgentTransport = {
      async *turn(): AsyncIterable<string> {
        yield a2uiLine1
        throw new Error('upstream fault')
      },
    }
    const events = await record(failing)
    expect(events.map((e) => e.kind)).toEqual(['turn-start', 'line', 'error', 'turn-end'])
    expect(events[2]).toMatchObject({ kind: 'error', message: 'upstream fault' })
    expect(events.at(-1)).toMatchObject({ kind: 'turn-end', status: 'error', lines: 1 })
    expect(events.map((e) => e.seq)).toEqual([0, 1, 2, 3])
  })

  it('a stream that completes behind a terminal a2uiMeta.error ends turn-end{status:"halt"} (the GH #144 idiom)', async () => {
    const events = await record(scriptTransport([[a2uiLine1, formatErrorLine('round bound exhausted')]]))
    expect(events.map((e) => e.kind)).toEqual(['turn-start', 'line', 'meta', 'turn-end'])
    expect(events.at(-1)).toMatchObject({ kind: 'turn-end', status: 'halt', lines: 1 })
  })

  it('every event round-trips its own serialized NDJSON line structurally equal (AC1)', async () => {
    const events = await record(scriptTransport([[metaLine, a2uiLine1, formatErrorLine('halt')]]))
    for (const event of events) {
      const wire = serializeDevtoolsEvent(event)
      expect(wire.includes('\n')).toBe(false) // one JSON object per line
      expect(JSON.parse(wire)).toStrictEqual(event)
    }
  })

  it('turn-end.ms comes from the injected clock (deterministic timing seam)', async () => {
    let t = 0
    const steppingClock = () => {
      t += 25
      return t
    }
    const out: DevtoolsEvent[] = []
    for await (const e of recordTurn(scriptTransport([[a2uiLine1]]), input, { backend: 'replay', now: fixedNow, clock: steppingClock })) {
      out.push(e)
    }
    const end = out.at(-1)!
    expect(end.kind).toBe('turn-end')
    if (end.kind === 'turn-end') expect(end.ms).toBe(steppingClock() - 25 - 25) // start=25, end=50 → ms=25
  })
})
