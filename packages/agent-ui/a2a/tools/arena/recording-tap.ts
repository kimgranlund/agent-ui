// recording-tap.ts — LLD-C6 §2: wraps an `AgentProvider` so recording happens AT THE ADAPTER BOUNDARY —
// the tap observes the EXACT request handed to `stream()` and the EXACT response text accumulated from
// what it yields, never a value reconstructed from the seat's own session object afterward. This is the
// mechanism that discharges the §2 "byte-complete recording" invariant: a model seat built on top of a
// TAPPED provider records precisely what left the process and precisely what came back — nothing else
// can diverge from it because nothing else is what's recorded.
//
// Completeness note (review finding 2): this tap forwards `req` to `provider.stream(req)` UNCHANGED and
// snapshots `req.messages` only AFTER that call resolves — so a below-seam mutation to ANY message in the
// array (historical or current-turn, in place or by replacement) is captured here, not just the last one.
// The seat (`../seats/model.ts`) is what compares the FULL captured array against its own accumulated
// turns — this module's job stops at observing faithfully, byte-for-byte, whatever the wrapped provider
// actually did to the request it was handed.
import type { AgentProvider, Turn } from '../../../a2ui/tools/agent/agent-transport.ts'

export interface RecordedCall {
  request: { model: string; system: string; messages: Turn[] }
  response: string
}

/** Wrap `provider` so every call is captured via `onCall` the moment its stream completes — the
 * WRAPPED provider is otherwise behaviorally identical (same fragments, same order) to the original. */
export function withRecordingTap(provider: AgentProvider, onCall: (call: RecordedCall) => void): AgentProvider {
  return {
    async *stream(req) {
      let response = ''
      for await (const frag of provider.stream(req)) {
        response += frag
        yield frag
      }
      // `messages` is snapshotted (a SHALLOW copy) at capture time: `req.messages` is the caller's own
      // live turn-history array, which the caller typically mutates again right after this call returns
      // (appending the reply) — a live reference here would let a LATER read of `RecordedCall` silently
      // observe that future mutation instead of what THIS request actually carried.
      onCall({ request: { model: req.model, system: req.system, messages: req.messages.slice() }, response })
    },
  }
}
