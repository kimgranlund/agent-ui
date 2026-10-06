// replay.ts — the scripted/replay transport (ADR-0200 clause 3 / SPEC-R3; decomp n2a).
//
// The deterministic backbone: canned JSON timelines in, byte-identical playback out — zero I/O, zero
// timers, zero randomness (the CI backbone and the fixture source). Both factories return the
// UNCHANGED ADR-0137 `AgentTransport` seam, so swapping this for the proxy or the a2a peer is a
// one-construction-site edit (SPEC-R2 AC1).
//
// "Deterministic playback incl. timing" means: playback order and content are fully determined by the
// input, and NO wall-clock coupling exists — lines yield on the microtask queue alone (the same
// zero-timers posture as `createRecordedTransport`, the a2ui recorded backbone this mirrors).

import type { AgentTransport, TurnInput } from '@agent-ui/a2ui/agent/agent-transport'
import { formatErrorLine } from '@agent-ui/a2ui/agent/meta-line'
import type { DevtoolsCapture } from '../capture/format.ts'

/** The recorded-transcript-exhausted message (SPEC-R3 AC2): a `turn()` call past the last scripted
 *  turn yields exactly ONE terminal `a2uiMeta.error` line carrying this text — never a hang, never a
 *  throw (the GH #144 in-band-failure idiom, reused). */
export const TRANSCRIPT_EXHAUSTED_MESSAGE =
  'recorded transcript exhausted — no scripted turn remains for this call'

/**
 * A deterministic `AgentTransport` over inline canned line arrays: `turn()` call N yields
 * `timelines[N]`'s lines, in order; call N+1 past the end yields the single terminal exhausted
 * meta-line (SPEC-R3 AC2). The `input` is ignored — it is a recording, not a live agent (the
 * `createRecordedTransport` posture).
 */
export function scriptTransport(timelines: ReadonlyArray<readonly string[]>): AgentTransport {
  let index = 0
  return {
    async *turn(_input: TurnInput): AsyncIterable<string> {
      const lines = timelines[index]
      if (lines === undefined) {
        yield formatErrorLine(TRANSCRIPT_EXHAUSTED_MESSAGE)
        return
      }
      index += 1
      for (const line of lines) yield line
    },
  }
}

/**
 * Extract a capture's per-turn wire lines (SPEC-R3, ADR-0239): one `string[]` per recorded turn,
 * bracketed by the timeline's `turn-start`/`turn-end` events, in `seq` order. The wire is two event
 * kinds: a `line` event replays its payload verbatim, and a `meta` event replays as the NDJSON
 * meta-line `{"a2uiMeta": <meta>}`, interleaved with the `line` events exactly where `recordTurn` saw it.
 * `recordTurn` kept only the parsed payload of a meta-line, so the replayed meta-line is equivalent
 * under `readMetaLine` (the same arms and values), not necessarily byte-identical to the original wire
 * line (key order follows `readMetaLine`; an arm member `readMetaLine` normalizes stays normalized).
 * The whole payload is re-emitted, never a hand-kept arm list, so the replay tracks the producer's
 * closed `a2uiMeta` vocabulary (`a2ui/agent/meta-line`) as it grows. `render`/`client` events are
 * observations ABOUT the wire (browser truth, injected input), never the wire, and never replay. A
 * trailing unterminated bracket (a capture cut mid-turn) still contributes its lines: liberal in what
 * it accepts, deterministic in what it yields. A capture with no `meta` events yields exactly its
 * `line` payloads, as before.
 */
export function capturedLineTimelines(capture: DevtoolsCapture): string[][] {
  const turns: string[][] = []
  let current: string[] | undefined
  for (const event of capture.timeline) {
    if (event.kind === 'turn-start') current = []
    else if (event.kind === 'line') (current ??= []).push(event.line)
    else if (event.kind === 'meta') (current ??= []).push(JSON.stringify({ a2uiMeta: event.meta }))
    else if (event.kind === 'turn-end' && current !== undefined) {
      turns.push(current)
      current = undefined
    }
  }
  if (current !== undefined) turns.push(current)
  return turns
}

/**
 * Replay a persisted capture (SPEC-R3): `turn()` call N yields capture turn N's wire lines (its `line`
 * payloads verbatim plus its `meta` events as meta-lines, in capture order), byte-identical run over
 * run (AC1). Exhaustion behaves exactly as `scriptTransport`'s (AC2).
 */
export function replayTransport(capture: DevtoolsCapture): AgentTransport {
  return scriptTransport(capturedLineTimelines(capture))
}
