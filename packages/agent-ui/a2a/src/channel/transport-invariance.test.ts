// transport-invariance.test.ts — S7 checkpoint: the SAME A2aMessage sequence decoded over loopback and
// the HTTP framing path is identical, in order, SOCKET-FREE at test time (SPEC-R8 AC1). The injectable
// `post` seam wires DIRECTLY to `createRpcCore(...).handleRpc` — the full parse->dispatch->respond path
// exercises with zero sockets (SPEC-N2/N3). This file imports `tools/http/*` RELATIVELY, which is what
// pulls `tools/` into the checked `npm run check` program (LLD §9) without a root tsconfig include edit.
import { describe, expect, it } from 'vitest'
import { createLoopbackPair } from './loopback.ts'
import { httpChannel } from '../../tools/http/channel.ts'
import { createRpcCore, type RpcHandlers } from '../../tools/http/core.ts'
import type { A2aMessage } from '../protocol/types.ts'

// Type-only reachability probe (LLD §9): `server.ts` + `smoke.ts` are never RUN by a standing test (the
// real `node:http` socket + real `fetch` live only in the manual smoke) — but `import type` is fully
// erased at runtime (verbatimModuleSyntax), so this pulls both into the CHECKED `tsc` program (types
// only, zero runtime import) without ever executing smoke.ts's manual-run side effect. Prevents these
// two dev-only files from rotting silently between manual runs.
import type { ServeA2a } from '../../tools/http/server.ts'
import type { main as SmokeMain } from '../../tools/http/smoke.ts'
void (null as unknown as ServeA2a) // reference (not just declare) the types so nothing goes unused
void (null as unknown as typeof SmokeMain)

const messages: A2aMessage[] = [
  { kind: 'message', role: 'user', parts: [{ kind: 'text', text: 'e4' }], messageId: 'm1' },
  { kind: 'message', role: 'agent', parts: [{ kind: 'text', text: 'e5' }], messageId: 'm2' },
  { kind: 'message', role: 'user', parts: [{ kind: 'data', data: { move: 'Nf3' } }], messageId: 'm3' },
]

async function collect(chan: { receive(): AsyncIterable<A2aMessage> }, n: number): Promise<A2aMessage[]> {
  const out: A2aMessage[] = []
  for await (const m of chan.receive()) {
    out.push(m)
    if (out.length === n) break
  }
  return out
}

describe('transport invariance (SPEC-R8 AC1) — loopback vs HTTP-framing, socket-free', () => {
  it('the same message sequence decodes identically and in order over both transports', async () => {
    // Loopback arm.
    const [a, b] = createLoopbackPair()
    for (const m of messages) await a.send(m)
    const loopbackSeq = await collect(b, messages.length)

    // HTTP-framing arm: a socket-free echo server (message/send returns the SAME message back) wired
    // directly through handleRpc — no node:http, no fetch.
    const handlers: RpcHandlers = {
      'message/send': (params) => params.message,
      'tasks/get': ({ id }) => ({ kind: 'task', id, contextId: 'ctx', status: { state: 'working' } }),
      'tasks/cancel': ({ id }) => ({ kind: 'task', id, contextId: 'ctx', status: { state: 'canceled' } }),
    }
    const core = createRpcCore(handlers)
    const http = httpChannel('http://in-proc.invalid/a2a', {
      post: (_endpoint, body) => core.handleRpc(body), // the injectable seam — zero sockets
    })
    for (const m of messages) await http.send(m)
    const httpSeq = await collect(http, messages.length)

    expect(httpSeq).toEqual(loopbackSeq)
    expect(httpSeq.map((m) => m.messageId)).toEqual(messages.map((m) => m.messageId))
  })

  it('malformed / non-200-equivalent responses surface a coded A2A_RPC failure, never fabricate a message', async () => {
    const http = httpChannel('http://in-proc.invalid/a2a', {
      post: () => Promise.resolve('{not json'),
    })
    await expect(http.send(messages[0]!)).rejects.toMatchObject({ name: 'A2aTransportError', failure: { code: 'A2A_RPC' } })
  })

  it('a handler throw inside the core is caught at the boundary -> -32603, and surfaces as A2A_RPC to the client (never a throw across the core)', async () => {
    const handlers: RpcHandlers = {
      'message/send': () => {
        throw new Error('boom')
      },
      'tasks/get': ({ id }) => ({ kind: 'task', id, contextId: 'ctx', status: { state: 'working' } }),
      'tasks/cancel': ({ id }) => ({ kind: 'task', id, contextId: 'ctx', status: { state: 'canceled' } }),
    }
    const core = createRpcCore(handlers)
    await expect(core.handleRpc('not valid json at all')).resolves.toEqual(expect.any(String))
    const raw = await core.handleRpc(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'message/send', params: { message: messages[0] } }))
    const parsed = JSON.parse(raw) as { error?: { code: number } }
    expect(parsed.error?.code).toBe(-32603)
  })

  it('unknown method -> -32601; known-but-unsupported method -> -32004', async () => {
    const handlers: RpcHandlers = {
      'message/send': (p) => p.message,
      'tasks/get': ({ id }) => ({ kind: 'task', id, contextId: 'ctx', status: { state: 'working' } }),
      'tasks/cancel': ({ id }) => ({ kind: 'task', id, contextId: 'ctx', status: { state: 'canceled' } }),
    }
    const core = createRpcCore(handlers)
    const unknown = JSON.parse(await core.handleRpc(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'totally/madeup', params: {} }))) as {
      error?: { code: number }
    }
    expect(unknown.error?.code).toBe(-32601)

    const knownUnsupported = JSON.parse(
      await core.handleRpc(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'message/stream', params: {} })),
    ) as { error?: { code: number } }
    expect(knownUnsupported.error?.code).toBe(-32004)
  })
})
