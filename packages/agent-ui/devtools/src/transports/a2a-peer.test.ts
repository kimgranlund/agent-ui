import { describe, it, expect } from 'vitest'
import type { AgentTransport, TurnInput } from '@agent-ui/a2ui/agent/agent-transport'
import { createLoopbackPair, A2aChannelClosedError } from '@agent-ui/a2a'
import type { A2aMessage } from '@agent-ui/a2a'
import { peerTransport } from './a2a-peer.ts'

// n2c's accept row (SPEC-R5): a scripted peer on the far loopback end round-trips one turn's lines in
// order (AC1); channel close() mid-turn ends the iterable without a hang, microtask-only (AC2);
// A2aChannelClosedError surfaces as a thrown turn failure, never a silent stop (AC2).

const input: TurnInput = { kind: 'intent', text: 'peer, draw me a board', session: { turns: [] } }

async function collect(transport: AgentTransport): Promise<string[]> {
  const out: string[] = []
  for await (const line of transport.turn(input)) out.push(line)
  return out
}

describe('peerTransport over a loopback pair (SPEC-R5)', () => {
  // SPEC-R2 AC1's type-level half: the factory's return type IS AgentTransport.
  const [typeEnd] = createLoopbackPair()
  const _seam: AgentTransport = peerTransport(typeEnd)
  void _seam

  it('round-trips one turn\'s lines in order — multi-part and newline-joined parts both (AC1)', async () => {
    const [ours, theirs] = createLoopbackPair()
    const seen: A2aMessage[] = []
    // The scripted peer: answers each inbound message with ONE agent reply of ordered text parts.
    void (async () => {
      for await (const msg of theirs.receive()) {
        seen.push(msg)
        await theirs.send({
          kind: 'message',
          role: 'agent',
          parts: [
            { kind: 'text', text: '{"version":"v0.9","one":1}\n{"version":"v0.9","two":2}' },
            { kind: 'text', text: '{"version":"v0.9","three":3}' },
          ],
          messageId: 'peer-reply-1',
        })
      }
    })()

    const lines = await collect(peerTransport(ours))
    expect(lines).toEqual(['{"version":"v0.9","one":1}', '{"version":"v0.9","two":2}', '{"version":"v0.9","three":3}'])

    // The outbound framing (pinned in a2a-peer.ts): ONE user message, ONE data part, the TurnInput
    // verbatim, a deterministic counter-derived messageId — zero randomness.
    expect(seen).toHaveLength(1)
    const sent = seen[0]!
    expect(sent.kind).toBe('message')
    expect(sent.role).toBe('user')
    expect(sent.messageId).toBe('devtools-turn-1')
    expect(sent.parts).toEqual([{ kind: 'data', data: { turnInput: input } }])
  })

  it('messageIds advance deterministically across turns on one transport', async () => {
    const [ours, theirs] = createLoopbackPair()
    const ids: string[] = []
    void (async () => {
      for await (const msg of theirs.receive()) {
        ids.push(msg.messageId)
        await theirs.send({ kind: 'message', role: 'agent', parts: [{ kind: 'text', text: 'l' }], messageId: `r${ids.length}` })
      }
    })()
    const transport = peerTransport(ours)
    await collect(transport)
    await collect(transport)
    expect(ids).toEqual(['devtools-turn-1', 'devtools-turn-2'])
  })

  it('close() mid-turn ends the iterable cleanly — no hang, no lines, microtask-only (AC2)', async () => {
    const [ours, theirs] = createLoopbackPair()
    // The peer receives the turn but NEVER answers; our own endpoint closes while the turn awaits.
    void (async () => {
      for await (const _msg of theirs.receive()) {
        ours.close() // drain our receive → the transport's for-await completes with no reply
      }
    })()
    const lines = await collect(peerTransport(ours))
    expect(lines).toEqual([])
  })

  it('a send into a closed channel surfaces A2aChannelClosedError as a thrown turn failure (AC2)', async () => {
    const [ours] = createLoopbackPair()
    ours.close()
    await expect(collect(peerTransport(ours))).rejects.toThrow(A2aChannelClosedError)
  })

  it('non-agent frames are skipped — the reply is the first AGENT message', async () => {
    const [ours, theirs] = createLoopbackPair()
    void (async () => {
      for await (const _msg of theirs.receive()) {
        // an echo of a user-role frame first (not a reply), then the real agent reply
        await theirs.send({ kind: 'message', role: 'user', parts: [{ kind: 'text', text: 'echo' }], messageId: 'e1' })
        await theirs.send({ kind: 'message', role: 'agent', parts: [{ kind: 'text', text: 'real' }], messageId: 'a1' })
      }
    })()
    const lines = await collect(peerTransport(ours))
    expect(lines).toEqual(['real'])
  })
})
