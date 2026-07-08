// seat.ts — LLD-C5: the seat seam. One isolated player: `respond` maps a received `BoardMessage` to a
// reply (a legal move, a malformed reply, or a hard abort); `pullContext` drains every context entry the
// seat has recorded since the last pull (system prompt once, then one user+assistant pair per turn) — the
// runner (LLD-C7) calls this right after each `respond()` and appends the drained entries as `context`
// transcript events, in real chronological order. The referee (never the seat) owns retries/legality.
import type { BoardMessage, ForfeitCause, MoveMessage } from '../../src/arena/referee.ts'

export type ContextRole = 'system' | 'user' | 'assistant'
export interface ContextEntry {
  role: ContextRole
  content: string
}

export type SeatReply =
  | { kind: 'move'; move: MoveMessage }
  | { kind: 'malformed'; detail: string }
  | { kind: 'abort'; cause: Extract<ForfeitCause, 'provider-error' | 'aborted'>; detail: string }

export interface Seat {
  respond(input: BoardMessage): Promise<SeatReply>
  pullContext(): ContextEntry[]
}
