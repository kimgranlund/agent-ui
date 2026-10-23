// dev-proxy-plugin.ts (LLD-C10, SPEC-R13): the Vite dev adapter for the arena's live mount
// (`/__a2a/arena`). Since T-0430 the match itself runs in the platform-neutral core `./live-match.ts`, the
// SAME code the production Worker route (`a2ui/tools/agent/worker/arena-route.ts`) runs: body parsing, the
// per-seat pair allowlist (the committed `providers.json` the a2ui proxy reads, narrowed to the arena seat
// models), key resolution, the per-seat budget and the header-first streaming. This file is only the Node
// shell: it holds each provider's key SERVER-side (`process.env[<envKey>]`, `.env` via Vite's `loadEnv`),
// reads the body, and writes each line the core hands it to the response as the runner appends it. It is
// the dev TRUST BOUNDARY (ADR-0073 clause 5 posture): the browser never holds a key, and `GET /status`
// answers a boolean + count, never a key value. `apply: 'serve'`: it attaches ONLY under `vite dev`. The
// dev proxy has no rate limiter (localhost only); the Worker binds one.
//
// LLD-C4 (SPEC-R17 AC3): the response's/request's `close` event (fired on a client-initiated abort, e.g.
// the page's Cancel control severing the fetch) aborts the match signal, which the core threads into
// `runMatch` AND each model seat, so the in-flight provider call cancels too. A `MatchAborted` after
// headers falls into the catch's `res.end()` arm: the client sees a truncated stream, which is discard.
// Paths resolve from `process.cwd()` (the repo root `vite` runs from), the a2ui dev-proxy-plugin.ts
// precedent.
import { readFileSync } from 'node:fs'
import { loadEnv } from 'vite'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { validateProvidersConfig } from '../../../a2ui/tools/agent/providers-config.ts'
import type { ProvidersConfig } from '../../../a2ui/tools/agent/providers-config.ts'
import { providerFor } from '../../../a2ui/tools/agent/providers/index.ts'
import { ANTHROPIC_WORKSPACE_ENV } from '../../../a2ui/src/agent/providers/anthropic.ts'
import { parseArenaRequest, resolveArenaSeat, startLiveMatch } from './live-match.ts'

declare const process: { cwd(): string; env: Record<string, string | undefined> }

const ROOT = process.cwd()
// The a2ui provider registry is REUSED, not forked (LLD §8 dev-graph-only cross-package edge): one
// allowlist + one set of adapters for both demo pages.
const CONFIG_PATH = `${ROOT}/packages/agent-ui/a2ui/tools/agent/providers.json`

const MOUNT = '/__a2a/arena'
const MAX_BODY = 1 << 16 // 64 KiB: a {seats:{X,O}} body is tiny; cap it so a runaway request can't grow unbounded

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

export function a2aDevProxyPlugin(): Plugin {
  // Same `.env`-load posture as the a2ui proxy: Vite does NOT put non-`VITE_`-prefixed vars into
  // `process.env`, so we load the repo-root `.env` server-side with `loadEnv` (prefix '' ⇒ all vars).
  let env: Record<string, string | undefined> = process.env

  return {
    name: 'a2a-arena-dev-proxy',
    apply: 'serve', // dev only: never attaches under `vite build`; production runs the Worker route
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

            // GET /status: is at least one registered, implemented provider's key configured? (boolean +
            // count; the key value never leaves the proxy.)
            if (req.method === 'GET' && url.startsWith('/status')) {
              const available = Object.values(config.providers).filter(
                (e) => e.implemented && typeof env[e.envKey] === 'string' && env[e.envKey] !== '',
              ).length
              sendJson(res, 200, { available: available > 0, providers: available })
              return
            }

            // POST: run one real match server-side through the shared core and stream the transcript back.
            if (req.method === 'POST') {
              const parsed = parseArenaRequest(JSON.parse(await readBody(req)) as unknown)
              if (!parsed.ok) {
                sendJson(res, parsed.status, { error: parsed.error })
                return
              }
              const deps = { providerFor, workspaceId: env[ANTHROPIC_WORKSPACE_ENV] }
              const seatX = resolveArenaSeat(config, env, parsed.seats.X, 'X', deps)
              if (!seatX.ok) {
                sendJson(res, seatX.status, { error: seatX.error })
                return
              }
              const seatO = resolveArenaSeat(config, env, parsed.seats.O, 'O', deps)
              if (!seatO.ok) {
                sendJson(res, seatO.status, { error: seatO.error })
                return
              }

              res.statusCode = 200
              res.setHeader('content-type', 'application/x-ndjson')
              // LLD-C4: a client disconnect (Cancel) aborts the match. `close` also fires on the normal path
              // once `res.end()` completes, but by then the match has returned: a late abort is a no-op.
              const abortController = new AbortController()
              const onClientClose = (): void => abortController.abort()
              res.on('close', onClientClose)
              req.on('close', onClientClose)
              try {
                await startLiveMatch({
                  seats: { X: { provider: seatX.provider, selection: parsed.seats.X }, O: { provider: seatO.provider, selection: parsed.seats.O } },
                  write: (line) => {
                    res.write(line)
                  },
                  signal: abortController.signal,
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
