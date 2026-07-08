// scripted.ts — LLD-C5: a seat driven by a fixed, pre-authored script — one step consumed per
// `respond()` call, in order. Deterministic + offline (SPEC-N3): the CI scripted-vs-scripted match (the
// byte-stable backbone, SPEC-R12 AC1) runs entirely on this, no network, no model.
import type { ContextEntry, Seat, SeatReply } from '../seat.ts'
import type { BoardMessage } from '../../../src/arena/referee.ts'
import type { Mark } from '../../../src/arena/board.ts'

export type ScriptedStep =
  | { move: number; note?: string }
  | { malformed: string }
  | { abort: 'provider-error' | 'aborted'; detail: string }

export function createScriptedSeat(mark: Mark, canary: string, script: ScriptedStep[]): Seat {
  let i = 0
  const pending: ContextEntry[] = [{ role: 'system', content: `You are ${mark} in a scripted match. Canary: ${canary}` }]

  return {
    async respond(input: BoardMessage): Promise<SeatReply> {
      pending.push({ role: 'user', content: JSON.stringify(input) })
      const step = script[i]
      i += 1
      if (step === undefined) {
        throw new Error('createScriptedSeat: script exhausted — the referee asked for more replies than were scripted')
      }
      if ('malformed' in step) {
        pending.push({ role: 'assistant', content: `[malformed] ${step.malformed}` })
        return { kind: 'malformed', detail: step.malformed }
      }
      if ('abort' in step) {
        pending.push({ role: 'assistant', content: `[abort:${step.abort}] ${step.detail}` })
        return { kind: 'abort', cause: step.abort, detail: step.detail }
      }
      const move = step.note === undefined ? { move: step.move } : { move: step.move, note: step.note }
      pending.push({ role: 'assistant', content: JSON.stringify(move) })
      return { kind: 'move', move }
    },
    pullContext(): ContextEntry[] {
      return pending.splice(0, pending.length)
    },
  }
}

/** A convenience seat that always plays the board's FIRST legal move — enough to grind out a full match
 * (win/draw) without hand-authoring every cell; used by the fixture generator + longer runner tests. */
export function createFirstLegalMoveSeat(mark: Mark, canary: string): Seat {
  const pending: ContextEntry[] = [{ role: 'system', content: `You are ${mark}, playing first-legal-move. Canary: ${canary}` }]
  return {
    async respond(input: BoardMessage): Promise<SeatReply> {
      pending.push({ role: 'user', content: JSON.stringify(input) })
      const cell = input.legalMoves[0]
      if (cell === undefined) throw new Error('createFirstLegalMoveSeat: no legal moves left')
      const move = { move: cell }
      pending.push({ role: 'assistant', content: JSON.stringify(move) })
      return { kind: 'move', move }
    },
    pullContext(): ContextEntry[] {
      return pending.splice(0, pending.length)
    },
  }
}
