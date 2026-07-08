// transcript.ts — LLD-C3/C8: the match transcript schema + validator (SPEC-R12, R2). Pure, zero-dep.
// JSONL: line 1 is the `TranscriptHeader`; every following line is one `TranscriptEvent`
// (`wire` | `context` | `game`). Wire events carry the REAL `A2aMessage` the runner sent over the
// SPEC-R8 loopback channel (reuse, not reinvention) — `wireMessage`/`readWireData` are the one place that
// wraps/unwraps the arena's own closed payload (a `BoardMessage` or `MoveMessage`, LLD-C2) inside a data
// part.
import type { A2aMessage } from '../protocol/types.ts'
import type { A2aFailure } from '../protocol/validate.ts'
import type { Mark } from './board.ts'
import type { EndReason } from './referee.ts'

export type Party = 'referee' | Mark

export interface TranscriptHeader {
  matchId: string
  protocolVersion: string
  seats: Record<Mark, { provider: string; model: string }>
  date: string
  scripted: boolean
}

export interface WireEvent {
  wire: { from: Party; to: Party; message: A2aMessage }
}

export type ContextRole = 'system' | 'user' | 'assistant'
export interface ContextEvent {
  context: { seat: Mark; entry: { role: ContextRole; content: string } }
}

export type GameEventBody =
  | { kind: 'move'; seat: Mark; move: number }
  | { kind: 'feedback'; seat: Mark; code: 'ILLEGAL' | 'MALFORMED'; detail: string; retriesLeft: number }
  | { kind: 'end'; reason: EndReason }

export interface GameEvent {
  game: GameEventBody
}

export type TranscriptEvent = WireEvent | ContextEvent | GameEvent

/** One committed match, already parsed: the header plus its ordered events (JSONL line order). */
export interface Transcript {
  header: TranscriptHeader
  events: TranscriptEvent[]
}

// --- wire wrap/unwrap (the ONE place that builds/reads the arena's data-part payload) ---

/** Build the A2aMessage that carries one arena payload (`BoardMessage` from the referee, `MoveMessage`
 * from a seat) over the SPEC-R8 loopback channel. `role` is a fixed convention (referee-authored =
 * 'agent', seat-authored = 'user') — it carries no other meaning here. `seq` is the CALLER's own
 * per-match counter (never module-level mutable state — SPEC-N3 byte-stability requires `messageId` to
 * be a pure function of within-match order, not a process-lifetime global that drifts run to run). */
export function wireMessage(from: Party, seq: number, body: unknown, opts: { contextId?: string } = {}): A2aMessage {
  return {
    kind: 'message',
    role: from === 'referee' ? 'agent' : 'user',
    parts: [{ kind: 'data', data: body as Record<string, unknown> }],
    messageId: `arena-${seq}`,
    contextId: opts.contextId,
  }
}

/** Read the arena payload back out of a transmitted `A2aMessage` — `undefined` if the message doesn't
 * carry the expected single data part (a defect, never silently coerced). */
export function readWireData(message: A2aMessage): unknown {
  const part = message.parts[0]
  return part !== undefined && part.kind === 'data' ? part.data : undefined
}

// --- (de)serialization ---

export function parseTranscriptLines(lines: string[]): Transcript | undefined {
  if (lines.length === 0) return undefined
  try {
    const header = JSON.parse(lines[0]!) as TranscriptHeader
    const events = lines.slice(1).map((l) => JSON.parse(l) as TranscriptEvent)
    return { header, events }
  } catch {
    return undefined
  }
}

export function serializeTranscript(t: Transcript): string {
  return [JSON.stringify(t.header), ...t.events.map((e) => JSON.stringify(e))].join('\n') + '\n'
}

// --- validation (SPEC-R12/R2) ---

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function push(failures: A2aFailure[], path: string, detail: string): void {
  failures.push({ code: 'A2A_SCHEMA', path, detail })
}

function validateHeader(header: unknown, failures: A2aFailure[], protocolVersion: string): void {
  if (!isObject(header)) {
    push(failures, '/0', 'header must be an object')
    return
  }
  if (typeof header.matchId !== 'string') push(failures, '/0/matchId', 'matchId must be a string')
  if (header.protocolVersion !== protocolVersion) {
    failures.push({
      code: 'A2A_PIN',
      path: '/0/protocolVersion',
      detail: `unsupported protocolVersion "${String(header.protocolVersion)}" (expected "${protocolVersion}")`,
    })
  }
  const seats = header.seats
  if (!isObject(seats) || !isObject(seats.X) || !isObject(seats.O)) {
    push(failures, '/0/seats', 'seats must carry both X and O entries')
  }
  if (typeof header.date !== 'string') push(failures, '/0/date', 'date must be a string')
  if (typeof header.scripted !== 'boolean') push(failures, '/0/scripted', 'scripted must be a boolean')
}

function validateEventShape(event: unknown, path: string, failures: A2aFailure[]): void {
  if (!isObject(event)) return push(failures, path, 'event must be an object')
  const keys = ['wire', 'context', 'game'].filter((k) => k in event)
  if (keys.length !== 1) {
    return push(failures, path, `event must carry exactly one of wire|context|game (got: ${keys.join(',') || 'none'})`)
  }
  if ('wire' in event) {
    const w = event.wire as Record<string, unknown>
    if (!isObject(w) || typeof w.from !== 'string' || typeof w.to !== 'string' || !isObject(w.message)) {
      push(failures, `${path}/wire`, 'wire event must be {from, to, message}')
    }
  } else if ('context' in event) {
    const c = event.context as Record<string, unknown>
    if (!isObject(c) || (c.seat !== 'X' && c.seat !== 'O') || !isObject(c.entry)) {
      push(failures, `${path}/context`, 'context event must be {seat: X|O, entry}')
    }
  } else if ('game' in event) {
    const g = event.game as Record<string, unknown>
    if (!isObject(g) || (g.kind !== 'move' && g.kind !== 'feedback' && g.kind !== 'end')) {
      push(failures, `${path}/game`, 'game event kind must be move|feedback|end')
    }
  }
}

/** "A `game` apply must follow the wire move it names" (LLD §5): every `{game:{kind:'move',...}}` event
 * must have an EARLIER `{wire:{from:seat,to:'referee',...}}` event carrying that same move number. */
function validateOrdering(events: TranscriptEvent[], failures: A2aFailure[]): void {
  for (let i = 0; i < events.length; i++) {
    const event = events[i]!
    if (!('game' in event)) continue
    const game = event.game
    if (game.kind !== 'move') continue
    const seat = game.seat
    const moveCell = game.move
    const found = events.slice(0, i).some((prior) => {
      if (!('wire' in prior)) return false
      if (prior.wire.from !== seat || prior.wire.to !== 'referee') return false
      const data = readWireData(prior.wire.message) as { move?: unknown } | undefined
      return isObject(data) && data.move === moveCell
    })
    if (!found) push(failures, `/${i + 1}`, `game move by ${seat} at cell ${moveCell} has no prior matching wire move`)
  }
}

/** Total, batch (SPEC-R12/R2, mirrors validateA2a's posture) — never throws. Checks the header's shape +
 * pin, every event's shape, and move-apply ordering. */
export function validateTranscript(lines: string[], opts: { protocolVersion: string }): A2aFailure[] {
  const failures: A2aFailure[] = []
  try {
    if (lines.length === 0) {
      push(failures, '/', 'empty transcript')
      return failures
    }
    let header: unknown
    try {
      header = JSON.parse(lines[0]!)
    } catch (e) {
      failures.push({ code: 'A2A_SCHEMA', path: '/0', detail: `parse error: ${String(e)}`, parse: true })
      return failures
    }
    validateHeader(header, failures, opts.protocolVersion)

    const events: unknown[] = []
    for (let i = 1; i < lines.length; i++) {
      try {
        events.push(JSON.parse(lines[i]!))
      } catch (e) {
        failures.push({ code: 'A2A_SCHEMA', path: `/${i}`, detail: `parse error: ${String(e)}`, parse: true })
        return failures
      }
    }
    for (let i = 0; i < events.length; i++) validateEventShape(events[i], `/${i + 1}`, failures)
    if (failures.length === 0) validateOrdering(events as TranscriptEvent[], failures)
    return failures
  } catch (e) {
    return [{ code: 'A2A_SCHEMA', path: '/', detail: `unexpected validator exception: ${String(e)}` }]
  }
}
