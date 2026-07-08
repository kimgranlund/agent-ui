// loopback.test.ts — S6 checkpoint: ordered-delivery interleave, close semantics (drain-then-end,
// send-after-close rejects typed), zero timers/network (SPEC-R8 loopback arm, N5).
import { describe, expect, it } from 'vitest'
import { A2aChannelClosedError, createLoopbackPair } from './loopback.ts'
import type { A2aMessage } from '../protocol/types.ts'

const msg = (id: string): A2aMessage => ({ kind: 'message', role: 'user', parts: [{ kind: 'text', text: id }], messageId: id })

async function collect(chan: { receive(): AsyncIterable<A2aMessage> }, n: number): Promise<A2aMessage[]> {
  const out: A2aMessage[] = []
  for await (const m of chan.receive()) {
    out.push(m)
    if (out.length === n) break
  }
  return out
}

describe('createLoopbackPair (LLD-C7) — ordered delivery', () => {
  it('delivers messages sent on one endpoint to the other, in order', async () => {
    const [a, b] = createLoopbackPair()
    await a.send(msg('1'))
    await a.send(msg('2'))
    await a.send(msg('3'))
    const received = await collect(b, 3)
    expect(received.map((m) => m.messageId)).toEqual(['1', '2', '3'])
  })

  it('interleaved sends from both directions preserve per-direction order', async () => {
    const [a, b] = createLoopbackPair()
    const bReceived: string[] = []
    const aReceived: string[] = []
    const bDone = (async () => {
      for await (const m of b.receive()) {
        bReceived.push(m.messageId)
        if (bReceived.length === 3) break
      }
    })()
    const aDone = (async () => {
      for await (const m of a.receive()) {
        aReceived.push(m.messageId)
        if (aReceived.length === 3) break
      }
    })()
    await a.send(msg('a1'))
    await b.send(msg('b1'))
    await a.send(msg('a2'))
    await b.send(msg('b2'))
    await a.send(msg('a3'))
    await b.send(msg('b3'))
    await bDone
    await aDone
    expect(bReceived).toEqual(['a1', 'a2', 'a3'])
    expect(aReceived).toEqual(['b1', 'b2', 'b3'])
  })

  it('a receive() parked BEFORE the matching send() still gets it, in order', async () => {
    const [a, b] = createLoopbackPair()
    const pending = collect(b, 2)
    await a.send(msg('x'))
    await a.send(msg('y'))
    expect((await pending).map((m) => m.messageId)).toEqual(['x', 'y'])
  })
})

describe('close() semantics (SPEC §6 — behavioral, drain-and-end)', () => {
  it('send after close rejects with a typed A2aChannelClosedError', async () => {
    const [a] = createLoopbackPair()
    a.close()
    await expect(a.send(msg('late'))).rejects.toBeInstanceOf(A2aChannelClosedError)
  })

  it('receive after close: buffered messages drain in order, then the iterator completes (no loss)', async () => {
    const [a, b] = createLoopbackPair()
    await a.send(msg('1'))
    await a.send(msg('2'))
    b.close() // close the RECEIVING side after messages are already buffered
    const out: A2aMessage[] = []
    for await (const m of b.receive()) out.push(m)
    expect(out.map((m) => m.messageId)).toEqual(['1', '2'])
  })

  it('a receive() parked with nothing buffered completes (done) immediately on close — no hang', async () => {
    const [, b] = createLoopbackPair()
    const iter = b.receive()[Symbol.asyncIterator]()
    const pending = iter.next()
    b.close()
    const result = await pending
    expect(result.done).toBe(true)
  })

  it("closing one endpoint's receive side does not force-close the peer's OWN state (the peer can still close cleanly independently); but the peer's send now targets a closed inbox and must reject, never silently drop (review fix, symmetry with own-close)", async () => {
    const [a, b] = createLoopbackPair()
    a.close() // closes A's OWN inbox (fed by B's sends)
    // b's send targets a's now-closed inbox — the straggler must reject loudly, never succeed-and-drop
    await expect(b.send(msg('would-be-dropped'))).rejects.toBeInstanceOf(A2aChannelClosedError)
    // b's own state is untouched by a's close — b can still close cleanly on its own terms
    expect(() => b.close()).not.toThrow()
  })

  it('a send into an ALREADY-CLOSED peer inbox rejects (the straggler), never silently drops', async () => {
    const [a, b] = createLoopbackPair()
    b.close() // b's own inbox (fed by a's send) is now closed
    await expect(a.send(msg('straggler'))).rejects.toBeInstanceOf(A2aChannelClosedError)
  })
})
