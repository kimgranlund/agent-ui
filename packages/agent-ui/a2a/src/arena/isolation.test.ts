// isolation.test.ts — LLD-C4 checkpoint (SPEC-R10 AC1): each of the 4 checks fires on a hand-built
// contaminated transcript and stays silent on a clean one (non-vacuity at the unit level; the fixture-
// level negative controls live in fixtures.test.ts, LLD-C9).
import { describe, expect, it } from 'vitest'
import { checkIsolation } from './isolation.ts'
import { wireMessage, type Transcript, type TranscriptEvent } from './transcript.ts'
import type { BoardMessage, MoveMessage } from './referee.ts'

const HEADER = {
  matchId: 'm1',
  protocolVersion: '0.3.0',
  seats: { X: { provider: 'scripted', model: 'scripted' }, O: { provider: 'scripted', model: 'scripted' } },
  date: '2026-07-08T00:00:00.000Z',
  scripted: true,
}

function boardMsg(over: Partial<BoardMessage> = {}): BoardMessage {
  return { board: Array(9).fill(null), yourMark: 'X', lastOpponentMove: null, legalMoves: [0, 1, 2, 3, 4, 5, 6, 7, 8], status: 'your-turn', ...over }
}

const CANARY_X = 'A2A-ISOLATION-CANARY-X-deadbeef00'
const CANARY_O = 'A2A-ISOLATION-CANARY-O-cafebabe00'

/** A clean, minimal one-move-each transcript (no leaks) — the isolation gate's positive control. */
function cleanTranscript(): Transcript {
  const xOpening = boardMsg({ yourMark: 'X' })
  const oOpening = boardMsg({ yourMark: 'O', lastOpponentMove: 0, legalMoves: [1, 2, 3, 4, 5, 6, 7, 8], board: ['X', null, null, null, null, null, null, null, null] })
  const xMove: MoveMessage = { move: 0 }
  const events: TranscriptEvent[] = [
    { context: { seat: 'X', entry: { role: 'system', content: `you are X. ${CANARY_X}` } } },
    { context: { seat: 'O', entry: { role: 'system', content: `you are O. ${CANARY_O}` } } },
    { wire: { from: 'referee', to: 'X', message: wireMessage('referee', 1, xOpening) } },
    { context: { seat: 'X', entry: { role: 'user', content: JSON.stringify(xOpening) } } },
    { context: { seat: 'X', entry: { role: 'assistant', content: JSON.stringify(xMove) } } },
    { wire: { from: 'X', to: 'referee', message: wireMessage('X', 2, xMove) } },
    { game: { kind: 'move', seat: 'X', move: 0 } },
    { wire: { from: 'referee', to: 'O', message: wireMessage('referee', 3, oOpening) } },
    { context: { seat: 'O', entry: { role: 'user', content: JSON.stringify(oOpening) } } },
  ]
  return { header: HEADER, events }
}

describe('checkIsolation (LLD-C4) — positive control', () => {
  it('a clean transcript passes all 4 checks (non-vacuity: this MUST be silent)', () => {
    expect(checkIsolation(cleanTranscript())).toEqual([])
  })
})

describe('checkIsolation (LLD-C4) — check 1: canary absence', () => {
  it('fires when X\'s canary appears in O\'s recorded context', () => {
    const t = cleanTranscript()
    t.events.push({ context: { seat: 'O', entry: { role: 'assistant', content: `leaked: ${CANARY_X}` } } })
    const failures = checkIsolation(t)
    expect(failures.some((f) => f.check === 'canary' && f.detail.includes(CANARY_X))).toBe(true)
  })

  it('fires when X\'s canary appears in a wire message addressed to O', () => {
    const t = cleanTranscript()
    const leaky = boardMsg({ yourMark: 'O', feedback: { code: 'ILLEGAL', detail: CANARY_X, retriesLeft: 1 } })
    t.events.push({ wire: { from: 'referee', to: 'O', message: wireMessage('referee', 100, leaky) } })
    expect(checkIsolation(t).some((f) => f.check === 'canary')).toBe(true)
  })
})

describe('checkIsolation (LLD-C4) — check 2: wire origin', () => {
  it('fires on a seat->seat wire entry (non-referee origin addressed to a seat)', () => {
    const t = cleanTranscript()
    t.events.push({ wire: { from: 'X', to: 'O', message: wireMessage('X', 101, { move: 5 }) } })
    const failures = checkIsolation(t)
    expect(failures).toContainEqual({ check: 'wire-origin', detail: 'message addressed to O has non-referee origin "X"' })
  })
})

describe('checkIsolation (LLD-C4) — check 3: closed schema', () => {
  it('fires when a referee->seat body carries an extra key (e.g. a leaked "note")', () => {
    const t = cleanTranscript()
    const withNote = { ...boardMsg({ yourMark: 'O' }), note: 'spectator commentary that should never ride this wire' }
    t.events.push({ wire: { from: 'referee', to: 'O', message: wireMessage('referee', 102, withNote) } })
    const failures = checkIsolation(t)
    expect(failures.some((f) => f.check === 'closed-schema' && f.detail.includes('note'))).toBe(true)
  })

  // Review finding 1 (negative controls, nested-field leak class): a top-level-only key check never looks
  // INSIDE an allowed field — these two must now FAIL where the pre-fix gate would have been silent.
  it('fires when a NESTED feedback object carries an extra key (a leak hiding behind an allowed top-level field)', () => {
    const t = cleanTranscript()
    const leaky = {
      ...boardMsg({ yourMark: 'O' }),
      feedback: { code: 'ILLEGAL' as const, detail: 'cell 4 is occupied or out of range', retriesLeft: 1, spectatorNote: 'leaked opponent context' },
    }
    t.events.push({ wire: { from: 'referee', to: 'O', message: wireMessage('referee', 103, leaky) } })
    const failures = checkIsolation(t)
    expect(failures.some((f) => f.check === 'closed-schema' && f.detail.includes('extra feedback key') && f.detail.includes('spectatorNote'))).toBe(true)
  })

  it('fires when an ILLEGAL feedback.detail deviates from the referee\'s pinned template (a hand-edited leak carrying no canary)', () => {
    const t = cleanTranscript()
    const leaky = boardMsg({ yourMark: 'O', feedback: { code: 'ILLEGAL', detail: 'opponent is about to play the center next turn', retriesLeft: 1 } })
    t.events.push({ wire: { from: 'referee', to: 'O', message: wireMessage('referee', 104, leaky) } })
    const failures = checkIsolation(t)
    expect(failures.some((f) => f.check === 'closed-schema' && f.detail.includes('non-pinned ILLEGAL feedback.detail'))).toBe(true)
  })

  // Review follow-up (Low, JS number-stringification grammar): a model reply `{"move": 1e21}` passes
  // `parseMoveReply`'s `Number.isInteger` check, and `referee.ts` emits `cell ${String(1e21)} is occupied
  // or out of range` — i.e. `cell 1e+21 is occupied or out of range`. This IS the referee's pinned form
  // and must PASS clean, not spuriously fail as "non-pinned".
  it('does NOT fire on an ILLEGAL feedback.detail using JS exponential notation (e.g. "cell 1e+21 is occupied or out of range")', () => {
    const t = cleanTranscript()
    const clean = boardMsg({ yourMark: 'O', feedback: { code: 'ILLEGAL', detail: 'cell 1e+21 is occupied or out of range', retriesLeft: 1 } })
    t.events.push({ wire: { from: 'referee', to: 'O', message: wireMessage('referee', 105, clean) } })
    const failures = checkIsolation(t)
    expect(failures.some((f) => f.check === 'closed-schema' && f.detail.includes('non-pinned ILLEGAL feedback.detail'))).toBe(false)
  })
})

describe('checkIsolation (LLD-C4) — check 4: context provenance', () => {
  it('fires on a "user" entry with no matching referee BoardMessage (a fabricated/foreign framing)', () => {
    const t = cleanTranscript()
    t.events.push({ context: { seat: 'O', entry: { role: 'user', content: 'not a real BoardMessage frame' } } })
    const failures = checkIsolation(t)
    expect(failures.some((f) => f.check === 'provenance')).toBe(true)
  })

  it('fires on a "system" entry not at position 0 (a hidden preamble injected mid-history)', () => {
    const t = cleanTranscript()
    t.events.push({ context: { seat: 'O', entry: { role: 'system', content: 'a second, hidden system preamble' } } })
    const failures = checkIsolation(t)
    expect(failures.some((f) => f.check === 'provenance' && f.detail.includes('NOT at position 0'))).toBe(true)
  })
})
