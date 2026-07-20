// worker/index.ts — the PRODUCTION twin of `../dev-proxy-plugin.ts`, ported from a Vite dev-only Node
// middleware to a Cloudflare Worker `fetch` handler. Same trust boundary (the browser never holds a
// provider key — the key lives in a Workers Secret, injected as `env.ANTHROPIC_API_KEY` and never sent to
// the client), same three routes, same wire shapes (`GET /status`, `POST /chat`, `POST /` — mounted at
// `/__a2ui/agent`, matching `live-proxy-transport.ts`/`admin-live-runner.ts`'s hardcoded endpoint), same
// `resolvePair`/`providerForModel`/`providerFor` PAIR-allowlist chain (SPEC-R12) reused verbatim.
//
// `process-shim.ts` MUST be the first import — see its own header for why the ordering is load-bearing.
import './process-shim.ts'

import { produce } from '../../../src/agent/produce.ts'
import type { ProduceDeps } from '../../../src/agent/produce.ts'
import { formatErrorLine } from '../../../src/agent/meta-line.ts'
import { resolvePair, validateProvidersConfig } from '../providers-config.ts'
import type { ProvidersConfig } from '../providers-config.ts'
import { providerFor } from '../providers/index.ts'
import { retrieve } from '../../../src/corpus/retrieve.ts'
import type { CorpusRecord } from '../../../src/corpus/record.ts'
import { loadCatalog } from '../../../src/catalog/catalog.ts'
import type { Catalog } from '../../../src/catalog/catalog.ts'
import type { TurnInput, Effort } from '../../../src/agent/agent-transport.ts'
import { resolveIntegrations } from '../integrations.ts'
import { isSameOriginRequest, isMountedPath, isValidTurnInput } from './route-guards.ts'
// GH #108 (review finding): validateMode/isChatBody/EFFORT_VALUES/resolveChatDispatch used to be
// hand-duplicated here, byte-for-byte, from dev-proxy-plugin.ts's already-exported versions — this
// security-adjacent PAIR-allowlist logic could silently fork between dev and prod with nothing to catch
// it. Both transports now import the SAME zero-dep module (see its header for why that couldn't be
// dev-proxy-plugin.ts directly).
import { validateMode, isChatBody, resolveChatDispatch } from '../chat-validation.ts'

import providersConfigRaw from '../providers.json'
import catalogRaw from '../../../src/catalog/default/catalog.json'
import corpusShardRaw from '../../../corpus/exemplar/v1_0/agent-ui.jsonl'

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  [key: string]: unknown
}

const MOUNT = '/__a2ui/agent'
const MAX_BODY = 1 << 20 // 1 MiB — matches dev-proxy-plugin.ts's cap

// GH #101 (review finding): dev-proxy-plugin.ts never needed a CSRF guard — it's a Vite dev middleware,
// reachable only from localhost. Ported unmodified to the public internet, the POST routes had none: a
// state-changing request with `content-type: text/plain` (a CORS-safelisted type) skips the browser's
// preflight entirely, so ANY page a visitor merely loads could silently trigger a real, billed LLM call
// under this Worker's key. `Origin`/`Referer` are both browser-controlled — unspoofable by page JS, unlike
// a body field — so checking either against the one legitimate origin (route-guards.ts's
// isSameOriginRequest) blocks every drive-by/cross-site trigger while leaving the site's own same-origin
// fetches (which always send one or the other) untouched.
const ALLOWED_ORIGIN = 'https://ui.nonoun.io'

const config = providersConfigRaw as ProvidersConfig
validateProvidersConfig(config) // fail fast at cold start, same as loadConfig()'s boot check in dev

const catalog: Catalog = loadCatalog(catalogRaw)
const shard: CorpusRecord[] = corpusShardRaw
  .split('\n')
  .filter((l) => l.trim().length > 0)
  .map((l) => JSON.parse(l) as CorpusRecord)

// GH #115 (review finding): this used to hardcode {ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY} as
// fixed object keys — a second, silently-drifting copy of the secret-name allowlist that only happened to
// match providers.json's current entries. Root cause: dev-proxy-plugin.ts reads secrets dynamically off
// the full environment by whatever name providers.json names (`env[e.envKey]`); the Worker's env binding
// is a plain object at runtime too, so it can do the exact same dynamic lookup — providers.json (already
// loaded + validated into `config` above) is the single source of truth for which keys exist, in both
// environments. Adding a provider needs no matching edit here anymore.
function envVars(env: Env): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {}
  for (const entry of Object.values(config.providers)) {
    const value = env[entry.envKey]
    if (typeof value === 'string') result[entry.envKey] = value
  }
  return result
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

// GH #111 (review finding): a Content-Length pre-check plus a post-hoc length check AFTER
// `request.text()` had already fully buffered the body isn't an enforcement of MAX_BODY, it's a check
// that runs too late — a request with no Content-Length (chunked transfer) or a garbled one (`Number(bad)`
// is NaN, `NaN > MAX_BODY` is false) skips straight past both guards to a full buffer. Root cause: the cap
// needs to be enforced WHILE reading, not after — dev-proxy-plugin.ts's Node reader does exactly this
// (`req.on('data', ...)`, rejecting the instant the running total crosses MAX_BODY). This reads the
// Workers `ReadableStream` the same way: chunk by chunk, aborting before any chunk pushes the total over.
async function readBody(request: Request): Promise<string> {
  const contentLength = request.headers.get('content-length')
  if (contentLength !== null && Number(contentLength) > MAX_BODY) throw new Error('request body too large')
  if (request.body === null) return ''

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BODY) throw new Error('request body too large')
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(merged)
}

async function handleStatus(env: Env): Promise<Response> {
  const env2 = envVars(env)
  const available = Object.values(config.providers).filter(
    (e) => e.implemented && typeof env2[e.envKey] === 'string' && env2[e.envKey] !== '',
  ).length
  return json(200, { available: available > 0, providers: available })
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  const body = JSON.parse(await readBody(request)) as { system?: unknown; model?: unknown; messages?: unknown; effort?: unknown }
  if (!isChatBody(body)) return json(400, { error: 'bad-request' })
  const { system, model, messages, effort } = body

  const chatDispatch = resolveChatDispatch(config, envVars(env), model)
  if (!chatDispatch.ok) return json(chatDispatch.status, { error: chatDispatch.error })

  const dispatch = providerFor(chatDispatch.provider, { apiKey: chatDispatch.apiKey, endpoint: chatDispatch.endpoint })
  if (!dispatch.ok) return json(503, { error: dispatch.reason })

  let text = ''
  // GH #106 (review finding): request.signal was never forwarded, so a client disconnect never cancelled
  // the in-flight, paid upstream call — it ran to completion regardless. Threading it through is the whole
  // fix; the seam already existed end-to-end (AgentProvider.stream() accepts `signal`).
  for await (const fragment of dispatch.provider.stream({
    model,
    system,
    messages,
    effort: effort as Effort | undefined,
    signal: request.signal,
  })) {
    text += fragment
  }
  return json(200, { text })
}

// GH #103 (review finding): produce()'s only statements capable of throwing BEFORE its first `yield` are
// `queryOf`/`userContent` reading `input.kind` and `input.session.turns` — everything else in the round
// loop (buildSystemPrompt, the provider call) runs strictly after the first progress yield, so a failure
// there always lands at least one byte on the wire. That means validating exactly this shape up front
// (route-guards.ts's isValidTurnInput) closes the "silent empty 200" gap completely, not just for the
// reported trigger — `handleProduce` commits `status:200` before the stream even starts (Workers has no
// lazy-headersSent equivalent), so this must run BEFORE the Response is constructed, not inside the
// detached write-loop's catch.
async function handleProduce(request: Request, env: Env): Promise<Response> {
  const { input, provider, model, mode, personaSystem, integrations } = JSON.parse(await readBody(request)) as {
    input: unknown
    provider: string
    model: string
    mode?: unknown
    personaSystem?: unknown
    integrations?: unknown
  }
  if (!isValidTurnInput(input)) return json(400, { error: 'bad-request' })
  const validInput = input as TurnInput

  const pair = resolvePair(config, provider, model)
  if (!pair.ok) return json(400, { error: pair.reason })
  const apiKey = envVars(env)[pair.envKey]
  if (apiKey === undefined || apiKey === '') return json(503, { error: 'no-key' })

  const dispatch = providerFor(provider, { apiKey, endpoint: pair.entry.endpoint })
  if (!dispatch.ok) return json(503, { error: dispatch.reason })

  const persona = typeof personaSystem === 'string' && personaSystem.length <= 16_384 ? personaSystem : undefined
  const active = resolveIntegrations(integrations)
  const toolOpts =
    active.length > 0
      ? {
          tools: active.map((integration) => integration.tool),
          executeTool: async (name: string, toolInput: Record<string, unknown>, signal?: AbortSignal): Promise<string> => {
            const match = active.find((integration) => integration.tool.name === name)
            if (!match) throw new Error(`unknown tool ${name}`)
            return match.execute(toolInput, signal)
          },
        }
      : {}

  const deps: ProduceDeps = { provider: dispatch.provider, retrieve: (q) => retrieve(shard, q), catalog }

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()
  void (async () => {
    try {
      for await (const line of produce(validInput, deps, {
        maxRounds: 3,
        model,
        mode: validateMode(mode),
        personaSystem: persona,
        progress: true,
        signal: request.signal, // GH #106 — cancel the paid upstream call if the client disconnects
        ...toolOpts,
      })) {
        await writer.write(encoder.encode(line + '\n'))
      }
    } catch (err) {
      // GH #144: ProduceHalt (the round bound exhausted, e.g. a persona's opening turn needing more
      // self-correct rounds than the cap) or an upstream fault mid-stream — headers are already committed
      // (200/ndjson), so the status can't change, but the failure must still reach the client SOMEHOW: a
      // stream that just stops with zero content lines reads as a silent, empty "success" (the client's
      // `for await` loop over `AdminSurfaceTurnEvent`s completes normally, `wireLines` stays `[]`, and the
      // turn finalizes as if nothing were wrong — exactly the reported "HTTP 200, `lines: []`, nothing
      // rendered, no error shown"). Writing ONE terminal `error` meta-line (`formatErrorLine`, GH #144)
      // before closing gives `admin-live-runner.ts` something to throw on, routing into the SAME visible
      // fail() path a non-2xx response already uses. `request.signal.aborted` means the CLIENT is the one
      // that's gone (a disconnect, not a produce() failure) — this write is then a no-op at best, and the
      // outer try/catch below already swallows a failed write, so no extra guard is needed.
      const message = err instanceof Error ? err.message : 'produce error'
      try {
        await writer.write(encoder.encode(formatErrorLine(message) + '\n'))
      } catch {
        // the writer/stream is already broken (e.g. a genuine client disconnect) — nothing left to signal
      }
    } finally {
      // GH #107 (review finding): closing a writer whose paired stream already errored (the common case on
      // a client disconnect — write() above throws first, caught above) itself rejects per WHATWG streams
      // semantics. That rejection had nothing awaiting this detached IIFE to catch it, so it surfaced as an
      // unhandled promise rejection on every ordinary "user navigated away mid-stream" event. The close is
      // best-effort cleanup either way — a second failure here changes nothing observable, so swallow it.
      try {
        await writer.close()
      } catch {
        // stream already errored/closed — nothing left to clean up
      }
    }
  })()

  return new Response(readable, { status: 200, headers: { 'content-type': 'application/x-ndjson' } })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    // GH #109 (review finding): a bare `startsWith(MOUNT)` has no path-segment boundary, so
    // `/__a2ui/agentXYZ` was wrongly claimed as "under the mount" (matching Connect's `.use(mount, ...)`
    // semantics, which this replaces, requires an exact match or a `/`-bounded prefix).
    if (!isMountedPath(url.pathname, MOUNT)) return env.ASSETS.fetch(request)

    const sub = url.pathname.slice(MOUNT.length) || '/'
    try {
      if (request.method === 'GET' && sub.startsWith('/status')) return await handleStatus(env)
      // Both POST routes dispatch a real, billed LLM call — gate BEFORE any body is read (GH #101).
      if (request.method === 'POST' && !isSameOriginRequest(request, ALLOWED_ORIGIN)) return json(403, { error: 'forbidden-origin' })
      if (request.method === 'POST' && sub.startsWith('/chat')) return await handleChat(request, env)
      if (request.method === 'POST') return await handleProduce(request, env)
      return new Response(null, { status: 404 })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'proxy error'
      return json(500, { error: message })
    }
  },
}
