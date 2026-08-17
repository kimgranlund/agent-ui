// a2a-peer.ts — the A2A peer transport (ADR-0200 clause 3 / SPEC-R5; decomp n2c).
//
// Frames one `TurnInput` as an A2A message onto an `A2aChannel` peer and yields the peer's reply
// lines in order. The loopback pair (`createLoopbackPair`) makes it in-browser and CI capable; the
// arena's isolation posture is inherited wholesale — message-level boundary, no side channel, and the
// channel's own microtask-only mechanics (a2a SPEC-N3's zero-timers posture) mean `close()` mid-turn
// ends the turn cleanly on the microtask queue.
//
// The framing contract (pinned HERE, the SPEC-R4 body-pinning discipline applied to this leg):
//   → outbound: ONE `A2aMessage` per turn — `role:'user'`, a single DATA part `{turnInput}` carrying
//     the `TurnInput` verbatim (structured, lossless — the peer producer runs its own session logic
//     over the real seam type instead of re-parsing a stringified rendering), `messageId`
//     `devtools-turn-<n>` from a per-transport monotonic counter (zero randomness — the replay
//     determinism law reaches the wire).
//   → inbound: ONE reply `A2aMessage` per turn — `role:'agent'`, TEXT parts carrying the A2UI JSONL;
//     each part may carry one line or several newline-joined lines; parts and lines yield in order.
//     The request/response shape is the arena's move-per-message precedent; a streaming multi-message
//     reply is a future widening with its own record.
//   → concurrency: ONE in-flight turn per transport — `turn()` is not re-entered while a prior turn's
//     iterable is unfinished (the reply-matching rule above assumes the next `role:'agent'` message
//     answers THIS turn; interleaved turns on one channel are a future widening with its own record).

import type { AgentTransport, TurnInput } from '@agent-ui/a2ui/agent/agent-transport'
import type { A2aChannel, A2aMessage } from '@agent-ui/a2a'

/**
 * The A2A peer backend (SPEC-R5): one `AgentTransport` over an injected `A2aChannel`. A send into a
 * closed channel rejects with `A2aChannelClosedError` — surfaced as a THROWN turn failure, never a
 * silent stop (AC2); a channel closed mid-wait ends the turn's iterable cleanly (the drained
 * `receive()` simply completes).
 */
export function peerTransport(channel: A2aChannel): AgentTransport {
  let turnCount = 0
  return {
    async *turn(input: TurnInput): AsyncIterable<string> {
      turnCount += 1
      const message: A2aMessage = {
        kind: 'message',
        role: 'user',
        parts: [{ kind: 'data', data: { turnInput: input } }],
        messageId: `devtools-turn-${turnCount}`,
      }
      await channel.send(message) // A2aChannelClosedError propagates — a loud turn failure (AC2)
      for await (const reply of channel.receive()) {
        if (reply.kind !== 'message' || reply.role !== 'agent') continue // not this turn's reply
        for (const part of reply.parts) {
          if (part.kind !== 'text') continue
          for (const line of part.text.split('\n')) {
            if (line.length > 0) yield line
          }
        }
        return // ONE reply message per turn — the pinned request/response shape
      }
      // receive() completed without a reply: the channel closed mid-turn — end cleanly (AC2).
    },
  }
}
