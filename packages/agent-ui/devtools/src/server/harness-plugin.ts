// harness-plugin.ts — the `/__devtools` HTTP orchestration seam (ADR-0200 clause 4 / SPEC-R6; decomp n3b).
//
// The dev-proxy-plugin geometry, deliberately: `apply: 'serve'` (dev only — `vite build` never runs it,
// no production mount, SPEC-N3), one connect middleware on one mount, `readBody` capped, JSON errors
// via `sendJson`, and the GH #144 headers-already-committed discipline — a mid-stream transport failure
// is reported IN-BAND (`recordTurn` emits `error` then `turn-end{status:'error'}`) because by then the
// 200/x-ndjson headers are on the wire.
//
// The wire is `DevtoolsEvent` NDJSON — the seam serializes exactly `recordTurn`'s timeline, one
// vocabulary, no second shape (SPEC-R7). A seam timeline carries NO `render` events: browser truth is
// only ever produced by a real page (SPEC-R9 — absence, never fabrication).
//
// The LIVE backend reaches the EXISTING `/__a2ui/agent` mount over HTTP (`proxyTransport`) — no key,
// no provider adapter, no `produce()` import in this package, ever (SPEC-N3; ADR-0073 clause 5).
// Capture storage is dev-lifetime simple — an in-memory Map holding the RAW posted text so the
// POST→GET round-trip is byte-equal (SPEC-R6 AC3; durable storage is deliberately NOT this package's,
// SPEC-N5).

import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { once } from 'node:events'
import type { TurnInput } from '@agent-ui/a2ui/agent/agent-transport'
import { scriptTransport, replayTransport } from '../transports/replay.ts'
import { proxyTransport } from '../transports/proxy.ts'
import { peerTransport } from '../transports/a2a-peer.ts'
import { listBackends, DEFAULT_PROXY_MOUNT, BACKEND_IDS } from '../transports/backends.ts'
import type { BackendId } from '../transports/backends.ts'
import { recordTurn, serializeDevtoolsEvent } from '../timeline/events.ts'
import type { RecordTurnOptions } from '../timeline/events.ts'
import type { DevtoolsCapture } from '../capture/format.ts'
import { DEVTOOLS_CAPTURE_KIND, DEVTOOLS_CAPTURE_VERSION } from '../capture/format.ts'
import { createLoopbackPair } from '@agent-ui/a2a'
import type { A2aChannel } from '@agent-ui/a2a'
import type { AgentTransport } from '@agent-ui/a2ui/agent/agent-transport'

export const DEVTOOLS_MOUNT = '/__devtools'
/** 8 MiB — a capture carries whole event timelines; still a hard cap so a runaway dev request can't
 *  grow unbounded (the dev-proxy MAX_BODY posture, sized for this seam's larger bodies). Exported so
 *  the route suite can build a provably-oversize body against the REAL limit, never a copied number. */
export const MAX_BODY = 8 << 20

/** An oversize body is the CLIENT's defect (S1–S3 code-checker L3): a typed rejection the handler maps
 *  to 413 `{error}` + `req.destroy()` — never the generic 500 catch. */
class BodyTooLargeError extends Error {
  constructor() {
    super(`request body exceeds ${MAX_BODY} bytes`)
    this.name = 'BodyTooLargeError'
  }
}

/** The injected fetch the seam threads to BOTH the live transport and the /status probe — ONE
 *  structural signature satisfying `ProxyFetch` and `StatusProbeFetch` alike (an intersection type
 *  would demand each stub satisfy both signatures separately); the real `fetch` satisfies it. */
export type HarnessFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean
  status: number
  body?: ReadableStream<Uint8Array> | null
  text(): Promise<string>
  json(): Promise<unknown>
}>

export interface DevtoolsHarnessOptions {
  /** The dev-proxy mount the live backend targets over HTTP. Default: same-origin via the incoming
   *  request's own Host header (`http://<host>/__a2ui/agent`) — the origin the client already reached. */
  proxyUrl?: string
  /** Injected fetch (live turns + availability probes); defaults to `globalThis.fetch`. */
  fetch?: HarnessFetch
  /** Deterministic-envelope seams, threaded to `recordTurn` (test-only in practice). */
  now?: RecordTurnOptions['now']
  clock?: RecordTurnOptions['clock']
}

/** The pinned `POST /turn` body (SPEC-R6): `backend` + the `TurnInput`, plus per-backend opts —
 *  replay: `timelines` (inline canned line arrays) or `capture` (a whole `DevtoolsCapture`);
 *  a2a: `peerLines` (the scripted loopback peer's one-reply lines);
 *  proxy: the `{provider, model}` pair forwarded into the pinned dev-proxy body. */
export interface TurnRequestBody {
  backend: BackendId
  input: TurnInput
  timelines?: string[][]
  capture?: DevtoolsCapture
  peerLines?: string[]
  provider?: string
  model?: string
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: unknown) => {
      data += String(chunk)
      if (data.length > MAX_BODY) reject(new BodyTooLargeError()) // L3 — the handler maps this to 413 + destroy
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

const isBackendId = (v: unknown): v is BackendId => typeof v === 'string' && (BACKEND_IDS as readonly string[]).includes(v)

/** Shallow capture-shape guard for `POST /captures` — full typed parsing (`parseCapture`, SPEC-R10 AC3)
 *  is slice S6's; the seam only refuses what is provably not a capture. */
function looksLikeCapture(v: unknown): v is DevtoolsCapture {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as { kind?: unknown }).kind === DEVTOOLS_CAPTURE_KIND &&
    (v as { version?: unknown }).version === DEVTOOLS_CAPTURE_VERSION &&
    Array.isArray((v as { timeline?: unknown }).timeline)
  )
}

/** Build the requested backend's transport for ONE seam turn. Returns a string error (→ 400) when the
 *  body names an unknown backend or a replay turn arrives with no source. */
function transportFor(
  body: TurnRequestBody,
  proxyUrl: string,
  fetchImpl: HarnessFetch | undefined,
): AgentTransport | string {
  if (body.backend === 'replay') {
    if (body.timelines !== undefined) return scriptTransport(body.timelines)
    if (body.capture !== undefined) return replayTransport(body.capture)
    return 'replay-source-missing: a replay turn needs `timelines` or `capture`'
  }
  if (body.backend === 'proxy') {
    return proxyTransport({
      url: proxyUrl,
      ...(fetchImpl !== undefined ? { fetch: fetchImpl } : {}),
      ...(body.provider !== undefined ? { provider: body.provider } : {}),
      ...(body.model !== undefined ? { model: body.model } : {}),
    })
  }
  // a2a: a loopback pair with a scripted peer answering ONE agent reply per inbound message —
  // the seam's headless a2a leg (a REAL peer agent binds `peerTransport(channel)` directly).
  return seamPeerTransport(body.peerLines ?? [])
}

/**
 * The seam's scripted a2a leg (S1–S3 code-checker L1): ONE loopback pair per request, and BOTH channel
 * ends close when the turn ends — complete, failed, or abandoned mid-stream — so the detached scripted
 * peer loop's `receive()` completes and the loop exits instead of leaking one parked async loop per
 * `/turn` request. The pair is injectable so the route suite can assert both ends really closed
 * (`send()` after the turn rejects `A2aChannelClosedError`). Exported for that suite; the seam itself
 * constructs it only inside `transportFor`.
 */
export function seamPeerTransport(
  peerLines: readonly string[],
  pair: [ours: A2aChannel, theirs: A2aChannel] = createLoopbackPair(),
): AgentTransport {
  const [ours, theirs] = pair
  void (async () => {
    try {
      for await (const _msg of theirs.receive()) {
        await theirs.send({
          kind: 'message',
          role: 'agent',
          parts: peerLines.map((text) => ({ kind: 'text' as const, text })),
          messageId: 'seam-peer-reply',
        })
      }
    } catch {
      // The turn ended and closed both ends while a reply was mid-send: a post-close send is moot —
      // swallowed here so the detached loop can never surface an unhandled rejection (L1).
    }
  })()
  const inner = peerTransport(ours)
  return {
    async *turn(input: TurnInput): AsyncIterable<string> {
      try {
        yield* inner.turn(input)
      } finally {
        ours.close()
        theirs.close()
      }
    },
  }
}

/**
 * The connect handler behind the plugin — exported separately so the route suite drives it with
 * fabricated req/res (the dev-proxy test idiom; the SAME function `configureServer` mounts).
 * Routes (SPEC-R6): `GET /status` · `POST /turn` · `GET /captures` · `POST /captures` ·
 * `GET /captures/:id`. Errors: unknown backend / malformed body → 400 `{error}`, never a crash.
 */
export function createDevtoolsMiddleware(opts?: DevtoolsHarnessOptions): (req: IncomingMessage, res: ServerResponse) => void {
  const captures = new Map<string, { raw: string; capture: DevtoolsCapture }>()
  let captureCount = 0

  return (req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      const url = req.url ?? '/'
      const proxyUrl = opts?.proxyUrl ?? `http://${req.headers.host ?? 'localhost'}${DEFAULT_PROXY_MOUNT}`
      try {
        // GET /status — the backend availability rows (SPEC-R6): one source with the page's switcher.
        if (req.method === 'GET' && url.startsWith('/status')) {
          const probeOpts = { url: proxyUrl, ...(opts?.fetch !== undefined ? { fetch: opts.fetch } : {}) }
          const rows = await Promise.all(
            listBackends({ proxy: probeOpts }).map(async (b) => ({ id: b.id, label: b.label, available: await b.available() })),
          )
          sendJson(res, 200, { backends: rows })
          return
        }

        // POST /turn — run one turn and stream the DevtoolsEvent timeline as NDJSON (SPEC-R6 AC1/AC2).
        if (req.method === 'POST' && url.startsWith('/turn')) {
          let body: TurnRequestBody
          try {
            body = JSON.parse(await readBody(req)) as TurnRequestBody
          } catch {
            sendJson(res, 400, { error: 'malformed-body: not JSON' })
            return
          }
          if (typeof body !== 'object' || body === null || !isBackendId((body as { backend?: unknown }).backend)) {
            sendJson(res, 400, { error: 'unknown-backend' })
            return
          }
          if (typeof body.input !== 'object' || body.input === null) {
            sendJson(res, 400, { error: 'malformed-body: missing input' })
            return
          }
          const transport = transportFor(body, proxyUrl, opts?.fetch)
          if (typeof transport === 'string') {
            sendJson(res, 400, { error: transport })
            return
          }
          res.statusCode = 200
          res.setHeader('content-type', 'application/x-ndjson')
          // recordTurn owns the GH #144 discipline: a transport failure past this point is an in-band
          // `error` + `turn-end{status:'error'}` — the headers are already committed.
          const recordOpts: RecordTurnOptions = {
            backend: body.backend,
            ...(opts?.now !== undefined ? { now: opts.now } : {}),
            ...(opts?.clock !== undefined ? { clock: opts.clock } : {}),
          }
          for await (const event of recordTurn(transport, body.input, recordOpts)) {
            if (res.destroyed) break // the client disconnected — no one left to read
            // L2 (S1–S3 code-checker): honor backpressure — a false `write()` parks the recorder until
            // the socket drains. Raced against 'close' so a client that disconnects mid-wait (which
            // never emits 'drain') can't strand the turn; the next iteration's `destroyed` check exits.
            if (!res.write(serializeDevtoolsEvent(event) + '\n')) {
              await Promise.race([once(res, 'drain'), once(res, 'close')])
            }
          }
          res.end()
          return
        }

        // GET /captures/:id — one capture, byte-equal to what was posted (SPEC-R6 AC3).
        if (req.method === 'GET' && url.startsWith('/captures/')) {
          const id = url.slice('/captures/'.length).split('?')[0] ?? ''
          const entry = captures.get(id)
          if (entry === undefined) {
            sendJson(res, 404, { error: `unknown-capture: ${id}` })
            return
          }
          res.statusCode = 200
          res.setHeader('content-type', 'application/json')
          res.end(entry.raw)
          return
        }

        // GET /captures — the capture index.
        if (req.method === 'GET' && url.startsWith('/captures')) {
          const rows = [...captures.entries()].map(([id, { capture }]) => ({
            id,
            createdAt: capture.createdAt,
            backend: capture.backend,
            events: capture.timeline.length,
          }))
          sendJson(res, 200, { captures: rows })
          return
        }

        // POST /captures — persist one capture (dev-lifetime, in-memory; raw text kept for AC3).
        if (req.method === 'POST' && url.startsWith('/captures')) {
          const raw = await readBody(req)
          let parsed: unknown
          try {
            parsed = JSON.parse(raw)
          } catch {
            sendJson(res, 400, { error: 'malformed-body: not JSON' })
            return
          }
          if (!looksLikeCapture(parsed)) {
            sendJson(res, 400, { error: 'malformed-capture: not an agent-ui-devtools-capture v1' })
            return
          }
          captureCount += 1
          const id = `cap-${captureCount}`
          captures.set(id, { raw, capture: parsed })
          sendJson(res, 200, { id })
          return
        }

        res.statusCode = 404
        res.end()
      } catch (err) {
        // L3: an oversize body is the client's defect — a 413 `{error}` envelope, then destroy the
        // request so the seam stops consuming the rest of the runaway stream (never the generic 500).
        if (err instanceof BodyTooLargeError) {
          if (!res.headersSent) sendJson(res, 413, { error: 'request-body-too-large' })
          else res.end()
          req.destroy()
          return
        }
        // Pre-stream failures only — the /turn stream's own failures are recordTurn's, in-band.
        const message = err instanceof Error ? err.message : 'devtools seam error'
        if (!res.headersSent) sendJson(res, 500, { error: message })
        else res.end()
      }
    })()
  }
}

/**
 * The Vite plugin (SPEC-R6): mounts the middleware at `/__devtools` under `vite dev` ONLY —
 * `apply: 'serve'` means `vite build` never attaches it; the seam has NO production mount (SPEC-N3;
 * a Worker twin is a future record if ever earned, ADR-0200 Non-goals).
 */
export function devtoolsHarnessPlugin(opts?: DevtoolsHarnessOptions): Plugin {
  return {
    name: 'agent-ui-devtools-harness',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(DEVTOOLS_MOUNT, createDevtoolsMiddleware(opts))
    },
  }
}
