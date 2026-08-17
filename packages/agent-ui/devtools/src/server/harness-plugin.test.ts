import { describe, it, expect } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { TurnInput } from '@agent-ui/a2ui/agent'
import { createDevtoolsMiddleware, devtoolsHarnessPlugin, seamPeerTransport, DEVTOOLS_MOUNT, MAX_BODY } from './harness-plugin.ts'
import type { DevtoolsHarnessOptions, HarnessFetch } from './harness-plugin.ts'
import type { DevtoolsEvent } from '../timeline/events.ts'
import type { DevtoolsCapture } from '../capture/format.ts'
import { createLoopbackPair, A2aChannelClosedError } from '@agent-ui/a2a'
import type { A2aMessage } from '@agent-ui/a2a'

// n3b's accept row (SPEC-R6): fabricated req/res (the dev-proxy route-test idiom) — POST /turn on the
// replay backend streams a full turn-start→turn-end NDJSON timeline with content-type
// application/x-ndjson (AC1); unknown backend → 400 {error}; malformed body → 400, never a crash (AC2);
// a mid-stream transport failure writes `error` then turn-end{status:'error'} in-band (AC2 / GH #144);
// capture POST→GET round-trips byte-equal (AC3). The no-tools/agent-import grep gate is layering.test.ts's.

const input: TurnInput = { kind: 'intent', text: 'seam turn', session: { turns: [] } }

// ── fabricated req/res ────────────────────────────────────────────────────────────────────────────────
class FakeReq {
  headers: Record<string, string> = { host: 'localhost:5173' }
  method: string
  url: string
  destroyed = false // L3: the handler destroys an oversize request — observable here
  private body: string | undefined
  private dataCb: ((chunk: unknown) => void) | undefined
  constructor(method: string, url: string, body?: string) {
    this.method = method
    this.url = url
    this.body = body
  }
  on(event: string, cb: (arg?: unknown) => void): this {
    if (event === 'data') this.dataCb = cb
    if (event === 'end') {
      queueMicrotask(() => {
        if (this.body !== undefined && this.dataCb !== undefined) this.dataCb(this.body)
        cb()
      })
    }
    return this
  }
  destroy(): void {
    this.destroyed = true
  }
  asReq(): IncomingMessage {
    return this as unknown as IncomingMessage
  }
}

class FakeRes {
  statusCode = 200
  destroyed = false
  writeReturns = true // L2: flip false to simulate a full socket buffer (write() reports backpressure)
  onWrite: (() => void) | undefined // L2: test hook, runs after each write (e.g. schedule a drain)
  private headers: Record<string, string> = {}
  private chunks: string[] = []
  private endedResolvers: (() => void)[] = []
  private ended = false
  private sent = false
  // Minimal EventEmitter surface — exactly what node:events `once(res, 'drain'|'close')` needs (it
  // attaches via `.once(name, fn)` plus an 'error' listener it clears with `.removeListener`).
  private listeners = new Map<string, ((...args: unknown[]) => void)[]>()
  on(name: string, fn: (...args: unknown[]) => void): this {
    const arr = this.listeners.get(name) ?? []
    arr.push(fn)
    this.listeners.set(name, arr)
    return this
  }
  once(name: string, fn: (...args: unknown[]) => void): this {
    const wrapped = (...args: unknown[]): void => {
      this.removeListener(name, wrapped)
      fn(...args)
    }
    return this.on(name, wrapped)
  }
  removeListener(name: string, fn: (...args: unknown[]) => void): this {
    const arr = this.listeners.get(name) ?? []
    const i = arr.indexOf(fn)
    if (i !== -1) arr.splice(i, 1)
    return this
  }
  emit(name: string): void {
    for (const fn of [...(this.listeners.get(name) ?? [])]) fn()
  }
  get headersSent(): boolean {
    return this.sent
  }
  setHeader(name: string, value: unknown): this {
    this.headers[name.toLowerCase()] = String(value)
    return this
  }
  header(name: string): string | undefined {
    return this.headers[name.toLowerCase()]
  }
  write(chunk: unknown): boolean {
    this.sent = true
    this.chunks.push(String(chunk))
    this.onWrite?.()
    return this.writeReturns
  }
  end(chunk?: unknown): void {
    if (chunk !== undefined) this.chunks.push(String(chunk))
    this.sent = true
    this.ended = true
    for (const resolve of this.endedResolvers.splice(0)) resolve()
  }
  whenEnded(): Promise<void> {
    return this.ended ? Promise.resolve() : new Promise((resolve) => this.endedResolvers.push(resolve))
  }
  body(): string {
    return this.chunks.join('')
  }
  json(): unknown {
    return JSON.parse(this.body())
  }
  events(): DevtoolsEvent[] {
    return this.body()
      .split('\n')
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l) as DevtoolsEvent)
  }
  asRes(): ServerResponse {
    return this as unknown as ServerResponse
  }
}

const fixedNow = () => '2026-08-17T00:00:00.000Z'
const fixedClock = () => 0

async function drive(
  opts: DevtoolsHarnessOptions | undefined,
  method: string,
  url: string,
  body?: unknown,
  middleware?: ReturnType<typeof createDevtoolsMiddleware>,
): Promise<FakeRes> {
  const mw = middleware ?? createDevtoolsMiddleware({ now: fixedNow, clock: fixedClock, ...opts })
  const res = new FakeRes()
  mw(new FakeReq(method, url, body === undefined ? undefined : JSON.stringify(body)).asReq(), res.asRes())
  await res.whenEnded()
  return res
}

// ── routes ────────────────────────────────────────────────────────────────────────────────────────────
describe('POST /turn (SPEC-R6 AC1/AC2)', () => {
  it('replay backend streams a complete turn-start→turn-end NDJSON timeline', async () => {
    const res = await drive(undefined, 'POST', '/turn', {
      backend: 'replay',
      input,
      timelines: [['{"version":"v0.9","createSurface":{"surfaceId":"s1"}}', '{"version":"v0.9","updateComponents":{"surfaceId":"s1"}}']],
    })
    expect(res.statusCode).toBe(200)
    expect(res.header('content-type')).toBe('application/x-ndjson')
    const events = res.events()
    expect(events.map((e) => e.kind)).toEqual(['turn-start', 'line', 'line', 'turn-end'])
    expect(events.map((e) => e.seq)).toEqual([0, 1, 2, 3])
    expect(events[0]).toMatchObject({ kind: 'turn-start', backend: 'replay' })
    expect(events.at(-1)).toMatchObject({ kind: 'turn-end', status: 'ok', lines: 2 })
    // a headless seam timeline carries ZERO render events (SPEC-R9 AC2 — absence, never fabrication)
    expect(events.some((e) => e.kind === 'render')).toBe(false)
  })

  it('a2a backend round-trips the scripted loopback peer lines', async () => {
    const res = await drive(undefined, 'POST', '/turn', { backend: 'a2a', input, peerLines: ['p1', 'p2'] })
    const events = res.events()
    expect(events.map((e) => e.kind)).toEqual(['turn-start', 'line', 'line', 'turn-end'])
    const lines = events.filter((e): e is Extract<DevtoolsEvent, { kind: 'line' }> => e.kind === 'line')
    expect(lines.map((e) => e.line)).toEqual(['p1', 'p2'])
  })

  it('unknown backend id → 400 {error} (AC2)', async () => {
    const res = await drive(undefined, 'POST', '/turn', { backend: 'carrier-pigeon', input })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'unknown-backend' })
  })

  it('malformed JSON body → 400, never a crash (AC2)', async () => {
    const mw = createDevtoolsMiddleware({ now: fixedNow, clock: fixedClock })
    const res = new FakeRes()
    mw(new FakeReq('POST', '/turn', 'this is not json').asReq(), res.asRes())
    await res.whenEnded()
    expect(res.statusCode).toBe(400)
    expect((res.json() as { error: string }).error).toMatch(/malformed-body/)
  })

  it('a replay turn without timelines/capture → 400 naming the missing source', async () => {
    const res = await drive(undefined, 'POST', '/turn', { backend: 'replay', input })
    expect(res.statusCode).toBe(400)
    expect((res.json() as { error: string }).error).toMatch(/replay-source-missing/)
  })

  it('a mid-stream transport failure writes `error` then turn-end{status:"error"} in-band (AC2 / GH #144)', async () => {
    const rejectingFetch: HarnessFetch = () => Promise.reject(new Error('ECONNREFUSED'))
    const res = await drive({ fetch: rejectingFetch }, 'POST', '/turn', { backend: 'proxy', input, provider: 'anthropic', model: 'claude-x' })
    expect(res.statusCode).toBe(200) // headers committed before the failure — the in-band discipline
    const events = res.events()
    expect(events.map((e) => e.kind)).toEqual(['turn-start', 'error', 'turn-end'])
    expect(events[1]).toMatchObject({ kind: 'error', message: 'ECONNREFUSED' })
    expect(events.at(-1)).toMatchObject({ kind: 'turn-end', status: 'error' })
  })

  it("the proxy's own {error} rejection text rides the in-band error event", async () => {
    const proxy400: HarnessFetch = () =>
      Promise.resolve({
        ok: false,
        status: 400,
        body: null,
        text: () => Promise.resolve('{"error":"unknown-pair"}'),
        json: () => Promise.resolve({}),
      })
    const res = await drive({ fetch: proxy400 }, 'POST', '/turn', { backend: 'proxy', input })
    const events = res.events()
    expect(events[1]).toMatchObject({ kind: 'error', message: 'unknown-pair' })
  })
})

describe('GET /status (SPEC-R6)', () => {
  it('serves the three backend rows; the proxy row maps the mount probe through', async () => {
    const probing: HarnessFetch = (url) => {
      expect(url).toBe('http://localhost:5173/__a2ui/agent/status') // same-origin default via Host
      return Promise.resolve({
        ok: true,
        status: 200,
        body: null,
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({ available: true, providers: 1 }),
      })
    }
    const res = await drive({ fetch: probing }, 'GET', '/status')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      backends: [
        { id: 'replay', label: 'Replay (canned timeline)', available: true },
        { id: 'proxy', label: 'Live (dev proxy)', available: true },
        { id: 'a2a', label: 'A2A peer (loopback)', available: true },
      ],
    })
  })

  it('a probe rejection reads as proxy available:false — never a throw (SPEC-R2 AC2 through the seam)', async () => {
    const rejecting: HarnessFetch = () => Promise.reject(new Error('down'))
    const res = await drive({ fetch: rejecting }, 'GET', '/status')
    const body = res.json() as { backends: Array<{ id: string; available: boolean }> }
    expect(body.backends.find((b) => b.id === 'proxy')?.available).toBe(false)
    expect(body.backends.find((b) => b.id === 'replay')?.available).toBe(true)
  })
})

describe('captures (SPEC-R6 AC3)', () => {
  const capture: DevtoolsCapture = {
    kind: 'agent-ui-devtools-capture',
    version: 1,
    createdAt: '2026-08-17T00:00:00.000Z',
    backend: 'replay',
    session: { turns: [] },
    timeline: [
      { seq: 0, at: 't', kind: 'turn-start', input, backend: 'replay' },
      { seq: 1, at: 't', kind: 'line', line: '{"a":1}' },
      { seq: 2, at: 't', kind: 'turn-end', status: 'ok', lines: 1, ms: 1 },
    ],
  }

  it('POST then GET round-trips byte-equal; the index lists the row', async () => {
    const mw = createDevtoolsMiddleware({ now: fixedNow, clock: fixedClock })
    const raw = JSON.stringify(capture)

    const posted = new FakeRes()
    mw(new FakeReq('POST', '/captures', raw).asReq(), posted.asRes())
    await posted.whenEnded()
    expect(posted.statusCode).toBe(200)
    expect(posted.json()).toEqual({ id: 'cap-1' })

    const got = await drive(undefined, 'GET', '/captures/cap-1', undefined, mw)
    expect(got.statusCode).toBe(200)
    expect(got.header('content-type')).toBe('application/json')
    expect(got.body()).toBe(raw) // BYTE-equal — the raw posted text, not a re-serialization

    const index = await drive(undefined, 'GET', '/captures', undefined, mw)
    expect(index.json()).toEqual({
      captures: [{ id: 'cap-1', createdAt: capture.createdAt, backend: 'replay', events: 3 }],
    })
  })

  it('a posted capture replays through POST /turn {backend:"replay", capture} (the seam round-trip)', async () => {
    const res = await drive(undefined, 'POST', '/turn', { backend: 'replay', input, capture })
    const events = res.events()
    const lines = events.filter((e): e is Extract<DevtoolsEvent, { kind: 'line' }> => e.kind === 'line')
    expect(lines.map((e) => e.line)).toEqual(['{"a":1}'])
    expect(events.at(-1)).toMatchObject({ kind: 'turn-end', status: 'ok', lines: 1 })
  })

  it('a malformed capture → 400; an unknown id → 404 — never a crash', async () => {
    const bad = await drive(undefined, 'POST', '/captures', { kind: 'something-else' })
    expect(bad.statusCode).toBe(400)
    const missing = await drive(undefined, 'GET', '/captures/cap-99')
    expect(missing.statusCode).toBe(404)
  })
})

describe('S1–S3 code-checker Lows (L1 peer-loop lifetime · L2 backpressure · L3 oversize body)', () => {
  const probe: A2aMessage = { kind: 'message', role: 'user', parts: [{ kind: 'text', text: 'post-close probe' }], messageId: 'probe' }
  const sendVia = (ch: { send(m: A2aMessage): Promise<void> }): Promise<void> => Promise.resolve().then(() => ch.send(probe))

  it('L1: the a2a leg closes BOTH channel ends when the turn completes — the scripted peer loop exits, never a per-request leak', async () => {
    const pair = createLoopbackPair()
    const transport = seamPeerTransport(['l1', 'l2'], pair)
    const lines: string[] = []
    for await (const line of transport.turn(input)) lines.push(line)
    expect(lines).toEqual(['l1', 'l2'])
    await expect(sendVia(pair[0])).rejects.toBeInstanceOf(A2aChannelClosedError)
    await expect(sendVia(pair[1])).rejects.toBeInstanceOf(A2aChannelClosedError)
  })

  it('L1: an abandoned mid-stream turn still closes both ends (the finally discipline holds on early return)', async () => {
    const pair = createLoopbackPair()
    const transport = seamPeerTransport(['l1', 'l2'], pair)
    const iterator = transport.turn(input)[Symbol.asyncIterator]()
    expect(await iterator.next()).toEqual({ value: 'l1', done: false })
    await iterator.return?.(undefined)
    await expect(sendVia(pair[0])).rejects.toBeInstanceOf(A2aChannelClosedError)
    await expect(sendVia(pair[1])).rejects.toBeInstanceOf(A2aChannelClosedError)
  })

  it('L2: a false write() parks the recorder until drain — every event still arrives, in order', async () => {
    const res = new FakeRes()
    res.writeReturns = false // every write reports a full buffer
    // Release each parked wait on the microtask queue. Scheduled from write() itself, which returns
    // BEFORE the middleware attaches its drain listener in the same synchronous task — so the
    // queued microtask always fires after the listener exists.
    res.onWrite = () => queueMicrotask(() => res.emit('drain'))
    const mw = createDevtoolsMiddleware({ now: fixedNow, clock: fixedClock })
    mw(new FakeReq('POST', '/turn', JSON.stringify({ backend: 'replay', input, timelines: [['{"a":1}', '{"b":2}']] })).asReq(), res.asRes())
    await res.whenEnded()
    expect(res.events().map((e) => e.kind)).toEqual(['turn-start', 'line', 'line', 'turn-end'])
  })

  it('L2: without a drain the stream genuinely parks (the wait is real); a client close releases it and the turn exits', async () => {
    const res = new FakeRes()
    res.writeReturns = false
    const mw = createDevtoolsMiddleware({ now: fixedNow, clock: fixedClock })
    mw(new FakeReq('POST', '/turn', JSON.stringify({ backend: 'replay', input, timelines: [['{"a":1}']] })).asReq(), res.asRes())
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(res.events().map((e) => e.kind)).toEqual(['turn-start']) // parked after the first unflushed write
    res.destroyed = true
    res.emit('close') // the disconnect arm of the race — unblocks; the next iteration sees destroyed and exits
    await res.whenEnded()
    expect(res.events().map((e) => e.kind)).toEqual(['turn-start']) // nothing more written to a dead client
  })

  it('L3: an oversize body → 413 {error} + req.destroy() — never the generic 500 catch', async () => {
    const req = new FakeReq('POST', '/captures', 'x'.repeat(MAX_BODY + 1))
    const res = new FakeRes()
    createDevtoolsMiddleware({ now: fixedNow, clock: fixedClock })(req.asReq(), res.asRes())
    await res.whenEnded()
    expect(res.statusCode).toBe(413)
    expect(res.json()).toEqual({ error: 'request-body-too-large' })
    expect(req.destroyed).toBe(true)
  })
})

describe('the plugin shell (SPEC-R6 / SPEC-N3)', () => {
  it('is dev-only (apply: "serve") and mounts at /__devtools', () => {
    const plugin = devtoolsHarnessPlugin()
    expect(plugin.name).toBe('agent-ui-devtools-harness')
    expect(plugin.apply).toBe('serve')
    let mounted = ''
    const server = { middlewares: { use: (path: string) => (mounted = path) } }
    const hook = plugin.configureServer
    const fn = typeof hook === 'function' ? hook : hook?.handler
    ;(fn as unknown as (s: unknown) => void)(server)
    expect(mounted).toBe(DEVTOOLS_MOUNT)
  })

  it('unknown routes → 404', async () => {
    const res = await drive(undefined, 'GET', '/nope')
    expect(res.statusCode).toBe(404)
  })
})
