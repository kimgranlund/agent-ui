// recorded-transport.ts — LLD-C2 / SPEC-R2: the deterministic BACKBONE. Replays a committed transcript
// with NO network and NO key — the default the built static site runs and the ONLY thing CI exercises.
// Implements the same `AgentTransport` seam the live overlay does, so the page is identical either way
// (SPEC-R1 AC2): each `turn()` yields the NEXT recorded turn's A2UI JSONL lines, in order.

import type { AgentTransport, TurnInput } from './agent-transport.ts'
import { recordedTranscript } from './transcript.ts'
import type { RecordedTranscript } from './transcript.ts'

/**
 * Build a recorded-transcript transport. The `input` is ignored (it is a recording, not a live agent) —
 * the transport simply advances through the committed turns. When the transcript is exhausted, further
 * `turn()` calls yield nothing (the demo caps turns anyway). Deterministic and repeatable: pass a fresh
 * transcript, or call the factory again, to replay from the start.
 */
export function createRecordedTransport(transcript: RecordedTranscript = recordedTranscript): AgentTransport {
  let index = 0
  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- input is intentionally ignored (a recording)
    async *turn(_input: TurnInput): AsyncIterable<string> {
      const t = transcript.turns[index]
      if (t === undefined) return
      index += 1
      for (const line of t.lines) yield line
    },
  }
}
