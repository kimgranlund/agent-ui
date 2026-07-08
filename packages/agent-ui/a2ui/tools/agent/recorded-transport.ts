// recorded-transport.ts — LLD-C2 / SPEC-R2: the deterministic BACKBONE. Replays a committed transcript
// with NO network and NO key — the default the built static site runs and the ONLY thing CI exercises.
// Implements the same `AgentTransport` seam the live overlay does, so the page is identical either way
// (SPEC-R1 AC2): each `turn()` yields the NEXT recorded turn's A2UI JSONL lines, in order.
//
// ADR-0088 §1 (slice 6): when a recorded turn carries a `note`, it is streamed FIRST as the same reserved
// meta-line the live producer emits (`{"a2uiMeta":{"note":"…"}}`) — ahead of the turn's A2UI JSONL — so
// the two transports' stream shapes stay identical (SPEC-R5/N4). A turn with no `note` yields exactly the
// same bare A2UI lines as before slice 6 — zero behavior change for a note-less turn.
//
// ADR-0097 §1 (LLD-C2 repair): a recorded turn MAY additionally carry `ask` (the SAME feed-ask routing
// declaration `produce()` composes). When present, it is folded onto the SAME meta-line as `note` —
// `{"a2uiMeta":{"note":"…","ask":{"surfaceId":"…"}}}` — the identical envelope shape the live path emits
// (SPEC-R5/N4 parity, "the two transports' stream shapes stay identical"). A turn with no `ask` streams
// byte-identically to before this addition. The SHIPPED `recordedTranscript` carries no `ask` turn
// (ADR-0089's scripted-turn fork stands, untouched by this ADR).

import type { AgentTransport, TurnInput } from './agent-transport.ts'
import type { A2uiMetaEnvelope } from './meta-line.ts'
import { recordedTranscript } from './transcript.ts'
import type { RecordedTranscript, RecordedTurn } from './transcript.ts'

/** Compose a turn's leading meta-line — `note` alone (the pre-ADR-0097 shape) or `{note, ask}` when the
 * turn also carries an ask declaration. `undefined` when the turn carries neither (no meta-line at all —
 * the pre-slice-6 behavior for a note-less, ask-less turn). */
function formatTurnMetaLine(t: RecordedTurn): string | undefined {
  if (t.note === undefined) return undefined
  const envelope: A2uiMetaEnvelope = { a2uiMeta: { note: t.note, ask: t.ask } }
  return JSON.stringify(envelope)
}

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
      const meta = formatTurnMetaLine(t)
      if (meta !== undefined) yield meta
      for (const line of t.lines) yield line
    },
  }
}
