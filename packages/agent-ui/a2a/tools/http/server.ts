// server.ts — the thin `node:http` shell (LLD-C8, ~20 lines): POST `/a2a` -> `handleRpc`; GET the
// well-known path -> the served card. This is the ONLY file in the package that touches a real socket
// (exercised by the manual dev smoke, `smoke.ts` — never by a standing test, SPEC-N2/N3).
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RpcCore } from './core.ts'
import { serveAgentCard, wellKnownAgentCardPath } from '../wellknown.ts'
import type { A2aAgentCard } from '../../src/protocol/types.ts'

export interface ServeA2a {
  listen(port?: number): Promise<number>
  close(): Promise<void>
}

/** Refuses to start (throws) if `card` is invalid — fail-fast (LLD-C9). */
export function serveA2a(core: RpcCore, card: A2aAgentCard): ServeA2a {
  const served = serveAgentCard(card)
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'GET' && req.url === wellKnownAgentCardPath) {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(served.body)
      return
    }
    if (req.method === 'POST' && req.url === '/a2a') {
      let data = ''
      req.on('data', (chunk: unknown) => (data += String(chunk)))
      req.on('end', () => {
        void core.handleRpc(data).then((out: string) => {
          res.statusCode = 200
          res.setHeader('content-type', 'application/json')
          res.end(out)
        })
      })
      return
    }
    res.statusCode = 404
    res.end()
  })
  return {
    listen: (port = 0) =>
      new Promise((resolve, reject) => {
        server.listen(port, () => {
          const addr = server.address()
          // address() is string|AddressInfo|null; a TCP listen always yields AddressInfo — anything
          // else means the socket never bound (fail loud, this shell is fail-fast by contract).
          if (addr === null || typeof addr === 'string') reject(new Error('a2a http shell: no TCP address after listen'))
          else resolve(addr.port)
        })
      }),
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}
