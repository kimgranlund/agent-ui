// smoke.ts — MANUAL dev smoke for the HTTP transport (LLD-C8). NOT run by any standing gate (SPEC-N2/
// N3: no standing test performs network I/O) — this is the one place that exercises a REAL socket.
// Run by hand from the repo root:
//
//   node --experimental-strip-types packages/agent-ui/a2a/tools/http/smoke.ts
//
// It starts a real `node:http` server serving the referee card + a trivial echo `message/send` handler,
// then makes a real `fetch` GET (well-known) and a real client `httpChannel` round trip, printing PASS/
// FAIL. This file is import-reachable from `transport-invariance.test.ts`'s module graph (types only),
// so it rides `npm run check` and cannot rot silently even though it is never executed by `npm test`.
import { createRpcCore, type RpcHandlers } from './core.ts'
import { serveA2a } from './server.ts'
import { httpChannel } from './channel.ts'
import { discoverAgent, wellKnownAgentCardPath } from '../wellknown.ts'
import refereeCardRaw from '../../src/protocol/fixtures/card.referee.json?raw'
import type { A2aAgentCard, A2aMessage } from '../../src/protocol/types.ts'

declare const process: { exitCode?: number }

export async function main(): Promise<void> {
  const card = JSON.parse(refereeCardRaw) as A2aAgentCard
  const handlers: RpcHandlers = {
    'message/send': (params) => params.message, // trivial echo
    'tasks/get': ({ id }) => ({ kind: 'task', id, contextId: 'ctx-smoke', status: { state: 'working' } }),
    'tasks/cancel': ({ id }) => ({ kind: 'task', id, contextId: 'ctx-smoke', status: { state: 'canceled' } }),
  }
  const core = createRpcCore(handlers)
  const server = serveA2a(core, card)
  const port = await server.listen(0)
  const baseUrl = `http://127.0.0.1:${port}`

  try {
    const discovered = await discoverAgent(baseUrl)
    console.log(discovered.ok ? `PASS well-known GET ${wellKnownAgentCardPath}` : `FAIL well-known GET: ${JSON.stringify(discovered.failures)}`)

    const chan = httpChannel(`${baseUrl}/a2a`)
    const outbound: A2aMessage = { kind: 'message', role: 'user', parts: [{ kind: 'text', text: 'e5' }], messageId: 'smoke-1' }
    await chan.send(outbound)
    const iter = chan.receive()[Symbol.asyncIterator]()
    const { value } = await iter.next()
    console.log(value?.messageId === outbound.messageId ? 'PASS message/send echo round trip' : 'FAIL message/send echo round trip')
    chan.close()
  } finally {
    await server.close()
  }
}

main().catch((e) => {
  console.error('SMOKE FAILED', e)
  process.exitCode = 1
})
