// transcript.test.ts — LLD-C3 checkpoint: header shape + pin, per-event shape, move-apply ordering,
// round-trip (de)serialization — total/batch, never throws.
import { describe, expect, it } from 'vitest'
import { PROTOCOL_VERSION } from '../protocol/types.ts'
import {
  parseTranscriptLines,
  readWireData,
  serializeTranscript,
  validateTranscript,
  wireMessage,
  type Transcript,
} from './transcript.ts'
import type { BoardMessage, MoveMessage } from './referee.ts'

const HEADER = {
  matchId: 'm1',
  protocolVersion: PROTOCOL_VERSION,
  seats: { X: { provider: 'scripted', model: 'scripted' }, O: { provider: 'scripted', model: 'scripted' } },
  date: '2026-07-08T00:00:00.000Z',
  scripted: true,
}

const OPENING: BoardMessage = {
  board: Array(9).fill(null),
  yourMark: 'X',
  lastOpponentMove: null,
  legalMoves: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  status: 'your-turn',
}
const MOVE: MoveMessage = { move: 0 }

function goodLines(): string[] {
  const t: Transcript = {
    header: HEADER,
    events: [
      { wire: { from: 'referee', to: 'X', message: wireMessage('referee', 1, OPENING) } },
      { context: { seat: 'X', entry: { role: 'system', content: 'you are X' } } },
      { context: { seat: 'X', entry: { role: 'user', content: JSON.stringify(OPENING) } } },
      { wire: { from: 'X', to: 'referee', message: wireMessage('X', 2, MOVE) } },
      { context: { seat: 'X', entry: { role: 'assistant', content: JSON.stringify(MOVE) } } },
      { game: { kind: 'move', seat: 'X', move: 0 } },
    ],
  }
  return serializeTranscript(t).split('\n').filter((l) => l.length > 0)
}

describe('transcript (LLD-C3) — wire wrap/unwrap', () => {
  it('wireMessage wraps a body as a single data part; readWireData reads it back byte-identically', () => {
    const msg = wireMessage('referee', 1, OPENING)
    expect(msg.kind).toBe('message')
    expect(msg.role).toBe('agent')
    expect(readWireData(msg)).toEqual(OPENING)
  })

  it('a seat-authored message has role "user"', () => {
    expect(wireMessage('X', 1, MOVE).role).toBe('user')
  })
})

describe('transcript (LLD-C3) — parse/serialize round-trip', () => {
  it('serializeTranscript -> parseTranscriptLines round-trips', () => {
    const lines = goodLines()
    const parsed = parseTranscriptLines(lines)
    expect(parsed).toBeDefined()
    expect(parsed!.header).toEqual(HEADER)
    expect(parsed!.events).toHaveLength(6)
  })

  it('parseTranscriptLines returns undefined (never throws) on unparseable input', () => {
    expect(() => parseTranscriptLines(['{not json'])).not.toThrow()
    expect(parseTranscriptLines(['{not json'])).toBeUndefined()
  })
})

describe('validateTranscript (LLD-C3, SPEC-R12/R2) — total, batch', () => {
  it('a well-formed transcript validates clean', () => {
    expect(validateTranscript(goodLines(), { protocolVersion: PROTOCOL_VERSION })).toEqual([])
  })

  it('an empty transcript fails A2A_SCHEMA', () => {
    expect(validateTranscript([], { protocolVersion: PROTOCOL_VERSION })).toEqual([
      { code: 'A2A_SCHEMA', path: '/', detail: expect.any(String) },
    ])
  })

  it('a pin mismatch fails A2A_PIN, never throws', () => {
    const badHeader = { ...HEADER, protocolVersion: '9.9.9' }
    const lines = [JSON.stringify(badHeader)]
    const failures = validateTranscript(lines, { protocolVersion: PROTOCOL_VERSION })
    expect(failures.some((f) => f.code === 'A2A_PIN')).toBe(true)
  })

  it('non-JSON input never throws and is coded A2A_SCHEMA with the parse flag', () => {
    expect(() => validateTranscript(['{not json'], { protocolVersion: PROTOCOL_VERSION })).not.toThrow()
    const failures = validateTranscript(['{not json'], { protocolVersion: PROTOCOL_VERSION })
    expect(failures).toEqual([{ code: 'A2A_SCHEMA', path: '/0', detail: expect.any(String), parse: true }])
  })

  it('a malformed event (no wire|context|game key) fails A2A_SCHEMA at its line', () => {
    const lines = [JSON.stringify(HEADER), JSON.stringify({ bogus: true })]
    const failures = validateTranscript(lines, { protocolVersion: PROTOCOL_VERSION })
    expect(failures).toEqual([{ code: 'A2A_SCHEMA', path: '/1', detail: expect.any(String) }])
  })

  it('a game move event with no prior matching wire move fails ordering', () => {
    const lines = [JSON.stringify(HEADER), JSON.stringify({ game: { kind: 'move', seat: 'X', move: 0 } })]
    const failures = validateTranscript(lines, { protocolVersion: PROTOCOL_VERSION })
    expect(failures).toEqual([{ code: 'A2A_SCHEMA', path: '/1', detail: expect.stringContaining('no prior matching wire move') }])
  })
})
