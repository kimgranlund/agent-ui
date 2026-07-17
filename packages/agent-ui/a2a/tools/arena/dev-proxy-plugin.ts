// dev-proxy-plugin.ts — LLD-C10 / SPEC-R13: the DEV-ONLY Vite middleware proxy (mount `/__a2a/arena`). It
// is the TRUST BOUNDARY (ADR-0073 clause 5 posture, reused at dev scope per LLD §8): the browser never
// holds a key. This plugin holds each provider's key SERVER-side (`process.env[<envKey>]`, `.env` via
// Vite's `loadEnv`), validates BOTH seats' `{provider, model}` pairs against the SAME committed
// `providers.json` allowlist the a2ui live-agent proxy uses (`resolvePair` — a crafted body cannot escape
// it), runs a REAL match server-side through the existing `tools/arena/match.ts` runner + model seat
// (`tools/arena/seats/model.ts`), and streams the resulting transcript back as NDJSON. `apply: 'serve'`
// means it attaches ONLY under `vite dev` — `vite build` never runs it, so the static build carries no
// proxy, no key path, and this whole module is unreachable from the browser bundle (SPEC-R13/N2). `GET
// /status` answers a boolean + count; a key value is NEVER sent to the browser.
//
// GENUINELY STREAMING (review finding 4 closed): `match.ts` exposes `onEvent` (LLD §6, C10) — this proxy
// writes the header line up front, then taps `onEvent` to `res.write()` each transcript event line to the
// response AS the runner appends it, mid-match, not after `runMatch()` resolves. Each line is
// `JSON.stringify` of the exact object the runner produces — the same wire shape `serializeTranscript`
// builds for a committed fixture, just emitted one line at a time instead of joined-then-dumped. The
// page's live-match consumer (`site/lib/arena-live-transport.ts`, LLD-C3) now reads incrementally too, so
// this is a genuine end-to-end stream, not just a server-side latency fix. Paths resolve from
// `process.cwd()` (the repo root `vite` runs from) — the a2ui dev-proxy-plugin.ts precedent.
//
// LLD-C4 (SPEC-R17 AC3): the response's/request's `close` event (fired on a client-initiated abort, e.g.
// the page's Cancel control severing the fetch) drives an `AbortController` whose signal is threaded into
// `runMatch`. A `MatchAborted` thrown after headers are already sent (always true here — the header line
// is written before `runMatch` is even called) falls straight into the existing catch's `res.end()` arm
// below: no special-casing needed, the client already sees a truncated stream, which is exactly discard.
import { readFileSync } from 'node:fs'
import { loadEnv } from 'vite'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolvePair, validateProvidersConfig } from '../../../a2ui/tools/agent/providers-config.ts'
import type { ProvidersConfig } from '../../../a2ui/tools/agent/providers-config.ts'
import { providerFor } from '../../../a2ui/tools/agent/providers/index.ts'
import type { AgentProvider } from '../../../a2ui/src/agent/agent-transport.ts'
import { buildMatchHeader, runMatch } from './match.ts'
import type { MatchSeatConfig } from './match.ts'
import { createModelSeat } from './seats/model.ts'
import { deriveCanaryPair } from './canary.ts'
import type { Mark } from '../../src/arena/board.ts'

declare const process: { cwd(): string; env: Record<string, string | undefined> }

const ROOT = process.cwd()
// The a2ui provider registry is REUSED, not forked (LLD §8 dev-graph-only cross-package edge) — one
// allowlist + one set of adapters for both demo pages.
const CONFIG_PATH = `${ROOT}/packages/agent-ui/a2ui/tools/agent/providers.json`

const MOUNT = '/__a2a/arena'
const MAX_BODY = 1 << 16 // 64 KiB — a {seats:{X,O}} body is tiny; cap it so a runaway request can't grow unbounded

const RETRY_BOUND = 2 // mirrors run-flagship.ts / SPEC-R11 default
const PER_MOVE_TIMEOUT_MS = 30_000 // mirrors run-flagship.ts

interface ArenaSeatRequest {
  provider: string
  model: string
}
interface ArenaRequestBody {
  seats?: { X?: ArenaSeatRequest; O?: ArenaSeatRequest }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: unknown) => {
      data += String(chunk)
      if (data.length > MAX_BODY) reject(new Error('request body too large'))
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

/** Resolve + key-check + dispatch ONE seat's `{provider,model}` against the registry (SPEC-R13's
 * per-seat allowlist validation — "a crafted body cannot escape it"). `ok:false` carries the exact
 * HTTP status the caller should send (400 for a bad pair, 503 for no key / an undispatchable provider),
 * mirroring the a2ui proxy's own degrade posture (never a 500 for a client-input problem). */
type SeatResolution =
  | { ok: true; provider: AgentProvider }
  | { ok: false; status: 400 | 503; error: string }

function resolveSeat(config: ProvidersConfig, env: Record<string, string | undefined>, req: ArenaSeatRequest | undefined, mark: Mark): SeatResolution {
  if (req === undefined || typeof req.provider !== 'string' || typeof req.model !== 'string') {
    return { ok: false, status: 400, error: `seat ${mark}: missing {provider, model}` }
  }
  const pair = resolvePair(config, req.provider, req.model)
  if (!pair.ok) return { ok: false, status: 400, error: `seat ${mark}: ${pair.reason}` }
  const apiKey = env[pair.envKey]
  if (apiKey === undefined || apiKey === '') return { ok: false, status: 503, error: `seat ${mark}: no-key` }
  const dispatch = providerFor(req.provider, { apiKey, endpoint: pair.entry.endpoint })
  if (!dispatch.ok) return { ok: false, status: 503, error: `seat ${mark}: ${dispatch.reason}` }
  return { ok: true, provider: dispatch.provider }
}

export function a2aDevProxyPlugin(): Plugin {
  // Same `.env`-load posture as the a2ui proxy: Vite does NOT put non-`VITE_`-prefixed vars into
  // `process.env`, so we load the repo-root `.env` server-side with `loadEnv` (prefix '' ⇒ all vars).
  let env: Record<string, string | undefined> = process.env

  return {
    name: 'a2a-arena-dev-proxy',
    apply: 'serve', // dev only — never attaches under `vite build` (SPEC-R13/N2)
    config(_config, { mode }) {
      env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }
    },
    configureServer(server) {
      // Re-read + re-validate providers.json PER REQUEST (the a2ui proxy's own rationale: an edit takes
      // effect without a dev-server restart, and it stays in lockstep with anything else reading the file).
      const loadConfig = (): ProvidersConfig => {
        const cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as ProvidersConfig
        validateProvidersConfig(cfg)
        return cfg
      }
      loadConfig() // fail-fast at boot if providers.json is malformed

      server.middlewares.use(MOUNT, (req: IncomingMessage, res: ServerResponse) => {
        void (async () => {
          const url = req.url ?? '/'
          try {
            const config = loadConfig()

            // GET /status — is at least one registered, implemented provider's key configured? (boolean +
            // count; the key value never leaves the proxy.)
            if (req.method === 'GET' && url.startsWith('/status')) {
              const available = Object.values(config.providers).filter(
                (e) => e.implemented && typeof env[e.envKey] === 'string' && env[e.envKey] !== '',
              ).length
              sendJson(res, 200, { available: available > 0, providers: available })
              return
            }

            // POST — run one real match server-side and stream the transcript back.
            if (req.method === 'POST') {
              const body = JSON.parse(await readBody(req)) as ArenaRequestBody
              const seatX = resolveSeat(config, env, body.seats?.X, 'X')
              if (!seatX.ok) {
                sendJson(res, seatX.status, { error: seatX.error })
                return
              }
              const seatO = resolveSeat(config, env, body.seats?.O, 'O')
              if (!seatO.ok) {
                sendJson(res, seatO.status, { error: seatO.error })
                return
              }
              const matchId = `live-${Date.now()}`
              // deriveCanaryPair asserts X !== O at construction (review finding 3, LLD §7) — fail-fast, never silent.
              const { X: canaryX, O: canaryO } = deriveCanaryPair(matchId)
              const seats: Record<Mark, MatchSeatConfig> = {
                X: {
                  seat: createModelSeat({ mark: 'X', canary: canaryX, provider: seatX.provider, model: body.seats!.X!.model }),
                  provider: body.seats!.X!.provider,
                  model: body.seats!.X!.model,
                },
                O: {
                  seat: createModelSeat({ mark: 'O', canary: canaryO, provider: seatO.provider, model: body.seats!.O!.model }),
                  provider: body.seats!.O!.provider,
                  model: body.seats!.O!.model,
                },
              }

              // Pin `date` up front so the header line we write NOW (before the match even starts moving)
              // is byte-identical to the one `runMatch` independently derives for its own returned
              // `MatchResult.header` — `buildMatchHeader` is the ONE construction both call, so passing the
              // SAME matchId/seats/scripted/date can never drift into two hand-maintained shapes (review
              // fix — the header-desync class; `runMatch` only defaults `date` to `Date.now()` when the
              // caller omits it, so pinning it here keeps the two calls in lockstep without awaiting the
              // match first).
              const date = new Date().toISOString()
              const header = buildMatchHeader({ matchId, seats, scripted: false, date })

              res.statusCode = 200
              res.setHeader('content-type', 'application/x-ndjson')
              // Header line first, THEN one res.write() PER transcript event AS `onEvent` fires (LLD §6 /
              // C10, review finding 4 closed) — genuinely incremental, not the whole transcript awaited
              // then dumped line-by-line.
              res.write(JSON.stringify(header) + '\n')

              // LLD-C4: wire a client-disconnect (Cancel) to the runner's abort seam. `close` fires on
              // EITHER endpoint for a premature disconnect; it also fires on the normal path once `res.end()`
              // completes, but by then `runMatch` has already returned and nobody is listening — an abort
              // after the fact is a harmless no-op.
              const abortController = new AbortController()
              const onClientClose = (): void => abortController.abort()
              res.on('close', onClientClose)
              req.on('close', onClientClose)
              try {
                await runMatch({
                  matchId,
                  scripted: false,
                  date,
                  retryBound: RETRY_BOUND,
                  perMoveTimeoutMs: PER_MOVE_TIMEOUT_MS,
                  seats,
                  signal: abortController.signal,
                  onEvent: (event) => {
                    res.write(JSON.stringify(event) + '\n')
                  },
                })
                res.end()
              } finally {
                res.off('close', onClientClose)
                req.off('close', onClientClose)
              }
              return
            }

            res.statusCode = 404
            res.end()
          } catch (err) {
            // A hard-failed match (provider error/abort that escaped the referee's forfeit path, a bad
            // body, or an unexpected fault) — report without leaking a key.
            const message = err instanceof Error ? err.message : 'proxy error'
            if (!res.headersSent) sendJson(res, 500, { error: message })
            else res.end()
          }
        })()
      })
    },
  }
}
