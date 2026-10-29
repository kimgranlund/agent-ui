// dev-proxy-origin.test.ts: T-0553, the dev proxy's POST branches (`/chat` and produce) answer 403 to a
// request whose browser-sent Origin or Referer names another host, before the body is read. Each denial
// has an allowed twin that reaches the branch's own body validation (a 400), so the gate is proven live.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { a2uiDevProxyPlugin, isCrossOriginDevRequest } from '../../tools/agent/dev-proxy-plugin.ts'

type Middleware = (req: unknown, res: unknown) => void
let handler: Middleware
let dir: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'dev-proxy-origin-'))
  const plugin = a2uiDevProxyPlugin({ traces: { dir } })
  const server = { middlewares: { use: (_mount: string, fn: Middleware) => (handler = fn) } }
  ;(plugin.configureServer as unknown as (s: unknown) => void)(server)
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

/** POST one body at a mount-relative url; resolve with the status and whether the body was ever read. */
async function post(url: string, body: unknown, headers?: Record<string, string>): Promise<{ status: number; bodyRead: boolean }> {
  const listeners: Record<string, Array<(arg?: unknown) => void>> = {}
  let bodyRead = false
  const req = {
    method: 'POST',
    url,
    ...(headers !== undefined ? { headers } : {}),
    on(event: string, cb: (arg?: unknown) => void) {
      ;(listeners[event] ??= []).push(cb)
      if (event === 'end') {
        bodyRead = true
        queueMicrotask(() => {
          for (const fn of listeners['data'] ?? []) fn(JSON.stringify(body))
          for (const fn of listeners['end'] ?? []) fn()
        })
      }
    },
  }
  let settle: () => void = () => {}
  const done = new Promise<void>((r) => (settle = r))
  const res = {
    statusCode: 0,
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    setHeader: () => {},
    on: () => {},
    write: () => true,
    end: () => {
      res.writableEnded = true
      settle()
    },
  }
  handler(req, res)
  await done
  return { status: res.statusCode, bodyRead }
}

const HOST = 'localhost:5173'
const SAME = { host: HOST, origin: `http://${HOST}` }
const PRODUCE_BODY = { provider: 'none', model: 'none', input: { kind: 'intent', session: { turns: [] } } }

describe('isCrossOriginDevRequest', () => {
  it('a matching Origin, a matching Referer, or neither header is not cross-origin', () => {
    expect(isCrossOriginDevRequest({ host: HOST, origin: `http://${HOST}` })).toBe(false)
    expect(isCrossOriginDevRequest({ host: HOST, referer: `http://${HOST}/a2ui-live.html` })).toBe(false)
    expect(isCrossOriginDevRequest({ host: HOST })).toBe(false)
    expect(isCrossOriginDevRequest(undefined)).toBe(false)
  })

  it('another host in Origin or Referer, an opaque Origin, or an unparseable one is cross-origin', () => {
    expect(isCrossOriginDevRequest({ host: HOST, origin: 'https://other.example' })).toBe(true)
    expect(isCrossOriginDevRequest({ host: HOST, origin: 'http://localhost:5174' })).toBe(true)
    expect(isCrossOriginDevRequest({ host: HOST, origin: 'null' })).toBe(true)
    expect(isCrossOriginDevRequest({ host: HOST, referer: 'https://other.example/page' })).toBe(true)
    expect(isCrossOriginDevRequest({ host: HOST, origin: 'not a url' })).toBe(true)
    expect(isCrossOriginDevRequest({ origin: `http://${HOST}` })).toBe(true)
  })
})

describe('the POST branches reject a cross-origin request before reading the body', () => {
  it('/chat: another origin gets 403; the same origin reaches body validation', async () => {
    const denied = await post('/chat', {}, { host: HOST, origin: 'https://other.example' })
    expect(denied).toEqual({ status: 403, bodyRead: false })
    const allowed = await post('/chat', {}, SAME)
    expect(allowed).toEqual({ status: 400, bodyRead: true })
  })

  it('produce: another origin gets 403; the same origin reaches the pair check', async () => {
    const denied = await post('/', PRODUCE_BODY, { host: HOST, referer: 'https://other.example/page' })
    expect(denied).toEqual({ status: 403, bodyRead: false })
    const allowed = await post('/', PRODUCE_BODY, SAME)
    expect(allowed).toEqual({ status: 400, bodyRead: true })
  })

  it('a request with no browser origin headers (a Node tool) still reaches the branch', async () => {
    expect(await post('/chat', {})).toEqual({ status: 400, bodyRead: true })
  })
})
