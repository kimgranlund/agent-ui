// dev-proxy-plugin.ts — LLD-C8 / SPEC-R18 AC3: the DEV-ONLY Vite middleware proxy (mount `/__a2a/feed`,
// arena symmetry — ADR-0116 fork F7). It is the TRUST BOUNDARY (ADR-0073 clause 5 posture): the browser
// never holds a key. This plugin receives the client's WHOLE ordered A2A message log, validates the
// `{provider,model}` pair against the SAME `providers.json` allowlist the arena/a2ui proxies use
// (`resolvePair`), derives the produce() session from the log (`sessionFromFeed` — the stateless-proxy
// posture, fork F4: the log IS the session), and — ONLY if that derivation succeeds — runs the a2ui
// `produce()` loop (the a2ui deps: catalog + judged shard + adapter, the `/__a2ui/agent` construction
// verbatim) to build ONE `wrapServerTurn` message, streamed to the browser as part-frames (`frames.ts`,
// LLD-C6). `apply: 'serve'` means it attaches ONLY under `vite dev` — `vite build` never runs it, so the
// static build carries no proxy, no key path (SPEC-R18/N2). `GET /status` answers a boolean + count; a key
// value is NEVER sent to the browser.
//
// Ordering (LLD-C8, SPEC-R18 AC3 "no provider call occurs"): resolvePair (a cheap registry check, no key
// read) runs FIRST; `sessionFromFeed` runs SECOND and is rejected with its own coded 400 before any
// env/key lookup or provider dispatch. Only after BOTH pass does this plugin touch `process.env` or call a
// model.
//
// ONE CONSTRUCTION, buffered (LLD-C8's corrected fact, doc-review): `produce()`'s whole turn (every
// envelope + the peeled meta-line note) is drained into memory BEFORE anything is written to `res` — no
// header, no frame. A `ProduceHalt` therefore always surfaces as a plain 500 response, NEVER a truncated
// frame stream; a truncated frame stream can only arise from a genuine transport fault (a proxy crash, a
// dropped connection, a client abort) AFTER this plugin has already started writing — which the browser's
// `FrameAssembler` part-count check catches (fail-closed, `frames.ts`).
import { readFileSync } from 'node:fs'
import { loadEnv } from 'vite'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolvePair, validateProvidersConfig } from '../../../a2ui/tools/agent/providers-config.ts'
import type { ProvidersConfig } from '../../../a2ui/tools/agent/providers-config.ts'
import { providerFor } from '../../../a2ui/tools/agent/providers/index.ts'
import type { AgentProvider } from '../../../a2ui/src/agent/agent-transport.ts'
import { produce } from '../../../a2ui/src/agent/produce.ts'
import type { ProduceDeps } from '../../../a2ui/src/agent/produce.ts'
import { readMetaLine } from '../../../a2ui/src/agent/meta-line.ts'
import { retrieve } from '../../../a2ui/src/corpus/retrieve.ts'
import type { CorpusRecord } from '../../../a2ui/src/corpus/record.ts'
import { loadCatalog } from '../../../a2ui/src/catalog/catalog.ts'
import type { A2uiServerMessage } from '../../../a2ui/src/protocol.ts'
import { wrapServerTurn } from '../../../a2ui/tools/pipeline/transports/a2a.ts'
import { sessionFromFeed } from './feed-session.ts'
import { framesOf } from './frames.ts'

declare const process: { cwd(): string; env: Record<string, string | undefined> }

const ROOT = process.cwd()
// The SAME a2ui provider registry + catalog + judged shard the `/__a2ui/agent` proxy reads — reused, not
// forked (LLD §0/§8's ratified `tools/feed/* -> a2ui tools` dev-graph edge, the arena proxy's own precedent).
const CONFIG_PATH = `${ROOT}/packages/agent-ui/a2ui/tools/agent/providers.json`
const CATALOG_PATH = `${ROOT}/packages/agent-ui/a2ui/src/catalog/default/catalog.json`
const SHARD_PATH = `${ROOT}/packages/agent-ui/a2ui/corpus/exemplar/v1_0/agent-ui.jsonl`

const MOUNT = '/__a2a/feed'
const MAX_BODY = 1 << 20 // 1 MiB — mirrors the a2ui proxy: a growing conversational log + artifacts is not tiny
const PROTOCOL_VERSION = '0.3.0'

interface FeedRequestBody {
  feed?: string[]
  provider?: string
  model?: string
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

export interface FeedDevProxyPluginOptions {
  /** LLD-C8 testability seam: inject a stub `AgentProvider` directly, bypassing `process.env`/key
   *  resolution and the `providers/index.ts` dispatch table entirely, so the offline legs (LLD-C12) run
   *  the FULL POST path — resolvePair, sessionFromFeed, `produce()`, frame + write — with no live model
   *  (the a2ui proxy precedent: gate-covering loop mechanics with no live model). The `{provider,model}`
   *  pair is STILL checked against `providers.json` even when this is set (a caller can't use the test
   *  seam to smuggle an unregistered pair past the allowlist). Production callers omit this entirely. */
  provider?: AgentProvider
}

export function a2aFeedDevProxyPlugin(opts: FeedDevProxyPluginOptions = {}): Plugin {
  let env: Record<string, string | undefined> = process.env

  return {
    name: 'a2a-feed-dev-proxy',
    apply: 'serve', // dev only — never attaches under `vite build` (SPEC-R18/N2)
    config(_config, { mode }) {
      env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }
    },
    configureServer(server) {
      const catalog = loadCatalog(JSON.parse(readFileSync(CATALOG_PATH, 'utf8')))
      const shard: CorpusRecord[] = readFileSync(SHARD_PATH, 'utf8')
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .map((l) => JSON.parse(l) as CorpusRecord)

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

            // GET /status — is at least one registered, implemented provider's key configured?
            if (req.method === 'GET' && url.startsWith('/status')) {
              const available = Object.values(config.providers).filter(
                (e) => e.implemented && typeof env[e.envKey] === 'string' && env[e.envKey] !== '',
              ).length
              sendJson(res, 200, { available: available > 0, providers: available })
              return
            }

            // POST — derive the session from the posted log, run one produce() turn, stream it back as
            // part-frames.
            if (req.method === 'POST') {
              const body = JSON.parse(await readBody(req)) as FeedRequestBody
              if (typeof body.provider !== 'string' || typeof body.model !== 'string' || !Array.isArray(body.feed)) {
                sendJson(res, 400, { error: 'missing {feed[], provider, model}' })
                return
              }

              // 1. the PAIR-allowlist (cheap, no key read) — a crafted body cannot escape it.
              const pair = resolvePair(config, body.provider, body.model)
              if (!pair.ok) {
                sendJson(res, 400, { error: pair.reason })
                return
              }

              // 2. derive the session from the log BEFORE any provider dispatch (SPEC-R18 AC3: a
              // caps-less tail, a non-user tail, or a schema-invalid line is rejected here — coded 400,
              // never reaching step 3).
              const sessionResult = sessionFromFeed(body.feed, { protocolVersion: PROTOCOL_VERSION })
              if (!sessionResult.ok) {
                sendJson(res, sessionResult.status, { error: sessionResult.error })
                return
              }

              // 3. provider dispatch — the LLD-C12 test seam bypasses env/key entirely; production reads
              // the key server-side exactly like the arena/a2ui proxies.
              let dispatchProvider: AgentProvider
              if (opts.provider !== undefined) {
                dispatchProvider = opts.provider
              } else {
                const apiKey = env[pair.envKey]
                if (apiKey === undefined || apiKey === '') {
                  sendJson(res, 503, { error: 'no-key' })
                  return
                }
                const dispatch = providerFor(body.provider, { apiKey, endpoint: pair.entry.endpoint })
                if (!dispatch.ok) {
                  sendJson(res, 503, { error: dispatch.reason })
                  return
                }
                dispatchProvider = dispatch.provider
              }

              const deps: ProduceDeps = {
                provider: dispatchProvider,
                retrieve: (q) => retrieve(shard, q),
                catalog,
              }

              // 4. ONE construction — drain produce() FULLY before writing anything (a ProduceHalt thrown
              // here always surfaces as a plain 500 via the catch block below; headers are never sent yet).
              let note: string | undefined
              const envelopes: A2uiServerMessage[] = []
              for await (const line of produce(sessionResult.input, deps, { maxRounds: 3, model: body.model })) {
                const meta = readMetaLine(line)
                if (meta) {
                  note = meta.a2uiMeta.note
                  continue
                }
                envelopes.push(JSON.parse(line) as A2uiServerMessage)
              }

              // `live-a<n>`: the ordinal is this conversation's own count of PRIOR agent turns + 1 — the
              // stateless proxy re-derives it from the log every time, never a server-held counter.
              const turnOrdinal = sessionResult.session.turns.filter((t) => t.role === 'assistant').length + 1
              const message = wrapServerTurn(envelopes, {
                messageId: `live-a${turnOrdinal}`,
                ...(sessionResult.contextId !== undefined ? { contextId: sessionResult.contextId } : {}),
                ...(note !== undefined ? { prose: note } : {}),
              })

              res.statusCode = 200
              res.setHeader('content-type', 'application/x-ndjson')
              for (const line of framesOf(message)) res.write(line + '\n')
              res.end()
              return
            }

            res.statusCode = 404
            res.end()
          } catch (err) {
            // produce() halted (ProduceHalt), a bad body, or an unexpected fault — report without leaking
            // a key. Reached ONLY before any frame is written (see the ONE-CONSTRUCTION note above), so
            // `res.headersSent` is always false here for a generation failure.
            const message = err instanceof Error ? err.message : 'proxy error'
            if (!res.headersSent) sendJson(res, 500, { error: message })
            else res.end()
          }
        })()
      })
    },
  }
}
