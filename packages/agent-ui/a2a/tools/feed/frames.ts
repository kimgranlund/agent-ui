// frames.ts — LLD-C6 (SPEC-R18 AC1): the part-frame protocol. One turn = one stream: a header frame
// declaring the part COUNT up front, then one frame per part, in order. The header's `parts` count is the
// completion invariant — reassembly completeness is decidable from the frames themselves, never inferred
// from stream end alone (a truncated stream is mechanically distinguishable from a short complete turn).
//
// This module is BOTH the proxy's emitter (`framesOf`) and the browser's ONLY reassembler
// (`createFrameAssembler`) — the `buildMatchHeader` one-construction lesson (arena LLD), applied at the
// seam where it was first learned: never two hand-maintained shapes of one wire protocol.
//
// Pure, zero-dep, browser-safe (SPEC-N1/N2 split note, LLD §3): type-only import from `@agent-ui/a2a`'s
// `src` barrel, no Node builtins, no I/O.
//
// Scope: the ONLY producer is `wrapServerTurn` (the a2ui bridge module), which never sets
// `referenceTaskIds`/`extensions`/`metadata` on the messages it builds — so the header carries exactly the
// fields the LLD's own wire sketch declares (`messageId`/`contextId?`/`taskId?`/`role`/`parts`) and no
// more. A message carrying those extra fields would NOT round-trip through this protocol; that is a
// deliberate scope limit (a generic full-A2aMessage frame protocol is not what SPEC-R18 asks for), not an
// oversight.
import type { A2aMessage, A2aPart } from '@agent-ui/a2a'

interface TurnHeaderBody {
  messageId: string
  contextId?: string
  taskId?: string
  role: 'user' | 'agent'
  parts: number
}

interface TurnHeaderFrame {
  turn: TurnHeaderBody
}

interface PartFrame {
  part: A2aPart
}

/** Derive the ordered frame lines for ONE built `A2aMessage` — a header frame (declaring `parts.length`
 *  up front) followed by one `{part}` frame per `msg.parts`, in order. Deriving from the already-built
 *  message (never re-deriving `parts.length` piecemeal as parts stream out) is what keeps this the ONE
 *  construction: the count declared in line 1 can never drift from the frames that follow it. */
export function framesOf(msg: A2aMessage): string[] {
  const header: TurnHeaderFrame = {
    turn: {
      messageId: msg.messageId,
      ...(msg.contextId !== undefined ? { contextId: msg.contextId } : {}),
      ...(msg.taskId !== undefined ? { taskId: msg.taskId } : {}),
      role: msg.role,
      parts: msg.parts.length,
    },
  }
  const lines = [JSON.stringify(header)]
  for (const part of msg.parts) {
    const frame: PartFrame = { part }
    lines.push(JSON.stringify(frame))
  }
  return lines
}

export interface FrameAssembler {
  /** Feed ONE raw frame line. Returns the part it carried (for progressive paint) or a typed fault —
   *  never a throw. Fail-closed: once a fault has been returned, every subsequent `push` also faults
   *  (mirrors the arena replay accumulator's own posture — a faulted stream accepts nothing further). */
  push(line: string): { ok: true; part?: A2aPart } | { ok: false; reason: string }
  /** Reassemble the completed message. `ok:false` when no header was ever received, the assembler already
   *  faulted, or the received part count does not EXACTLY match the header's declared count — fewer
   *  (truncation) or more (overrun) are both refused; the count invariant is checked HERE; `push` itself
   *  stays permissive about accumulating parts so completeness is always decidable from the frames
   *  themselves, not from timing. */
  complete(): { ok: true; message: A2aMessage } | { ok: false; reason: string }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isValidHeaderBody(v: unknown): v is TurnHeaderBody {
  if (!isObject(v)) return false
  if (typeof v.messageId !== 'string') return false
  if (v.role !== 'user' && v.role !== 'agent') return false
  if (typeof v.parts !== 'number' || !Number.isInteger(v.parts) || v.parts < 0) return false
  if (v.contextId !== undefined && typeof v.contextId !== 'string') return false
  if (v.taskId !== undefined && typeof v.taskId !== 'string') return false
  return true
}

export function createFrameAssembler(): FrameAssembler {
  let header: TurnHeaderBody | undefined
  let parts: A2aPart[] = []
  let faulted = false

  function fault(reason: string): { ok: false; reason: string } {
    faulted = true
    return { ok: false, reason }
  }

  return {
    push(line) {
      if (faulted) return fault('assembler already faulted — no further frames accepted')

      let parsed: unknown
      try {
        parsed = JSON.parse(line)
      } catch (e) {
        return fault(`malformed frame JSON: ${String(e)}`)
      }
      if (!isObject(parsed)) return fault('frame must be a JSON object')

      if ('turn' in parsed) {
        if (header !== undefined) return fault('duplicate turn header')
        const body = (parsed as { turn: unknown }).turn
        if (!isValidHeaderBody(body)) return fault('malformed turn header')
        header = body
        return { ok: true }
      }
      if ('part' in parsed) {
        if (header === undefined) return fault('part frame received before the turn header')
        const part = (parsed as { part: unknown }).part
        parts.push(part as A2aPart) // count-mismatch (over/under) is decided at complete(), never here
        return { ok: true, part: part as A2aPart }
      }
      return fault(`foreign frame kind (expected "turn" or "part"): ${Object.keys(parsed).join(',')}`)
    },
    complete() {
      if (faulted) return { ok: false, reason: 'assembler already faulted — cannot complete' }
      if (header === undefined) return { ok: false, reason: 'complete() called before any turn header' }
      if (parts.length !== header.parts) {
        faulted = true // fail-closed — a caller that (incorrectly) pushes more after a bad complete() faults too
        return { ok: false, reason: `expected ${header.parts} part(s), received ${parts.length}` }
      }
      const message: A2aMessage = {
        kind: 'message',
        role: header.role,
        messageId: header.messageId,
        ...(header.taskId !== undefined ? { taskId: header.taskId } : {}),
        ...(header.contextId !== undefined ? { contextId: header.contextId } : {}),
        parts,
      }
      return { ok: true, message }
    },
  }
}
