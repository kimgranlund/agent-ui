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
import { providerForModel, resolvePair, validateProvidersConfig } from '../providers-config.ts'
import type { ProvidersConfig } from '../providers-config.ts'
import { providerFor } from '../providers/index.ts'
import { retrieve } from '../../../src/corpus/retrieve.ts'
import type { CorpusRecord } from '../../../src/corpus/record.ts'
import { loadCatalog } from '../../../src/catalog/catalog.ts'
import type { Catalog } from '../../../src/catalog/catalog.ts'
import type { TurnInput, Turn, Effort } from '../../../src/agent/agent-transport.ts'
import { GEN_UI_MODES } from '../../../src/agent/gen-ui-mode.ts'
import type { GenUiMode } from '../../../src/agent/gen-ui-mode.ts'
import { resolveIntegrations } from '../integrations.ts'

import providersConfigRaw from '../providers.json'
import catalogRaw from '../../../src/catalog/default/catalog.json'
import corpusShardRaw from '../../../corpus/exemplar/v1_0/agent-ui.jsonl'

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  ANTHROPIC_API_KEY?: string
  OPENAI_API_KEY?: string
  GEMINI_API_KEY?: string
}

const MOUNT = '/__a2ui/agent'
const MAX_BODY = 1 << 20 // 1 MiB — matches dev-proxy-plugin.ts's cap

// GH #101 (review finding): dev-proxy-plugin.ts never needed a CSRF guard — it's a Vite dev middleware,
// reachable only from localhost. Ported unmodified to the public internet, the POST routes had none: a
// state-changing request with `content-type: text/plain` (a CORS-safelisted type) skips the browser's
// preflight entirely, so ANY page a visitor merely loads could silently trigger a real, billed LLM call
// under this Worker's key. `Origin`/`Referer` are both browser-controlled — unspoofable by page JS, unlike
// a body field — so checking either against the one legitimate origin blocks every drive-by/cross-site
// trigger while leaving the site's own same-origin fetches (which always send one or the other) untouched.
const ALLOWED_ORIGIN = 'https://ui.nonoun.io'

function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (origin !== null) return origin === ALLOWED_ORIGIN
  const referer = request.headers.get('referer')
  if (referer !== null) return referer === ALLOWED_ORIGIN || referer.startsWith(`${ALLOWED_ORIGIN}/`)
  return false // a browser fetch() always sends at least one — neither present means it isn't one
}

const config = providersConfigRaw as ProvidersConfig
validateProvidersConfig(config) // fail fast at cold start, same as loadConfig()'s boot check in dev

const catalog: Catalog = loadCatalog(catalogRaw)
const shard: CorpusRecord[] = corpusShardRaw
  .split('\n')
  .filter((l) => l.trim().length > 0)
  .map((l) => JSON.parse(l) as CorpusRecord)

function envVars(env: Env): Record<string, string | undefined> {
  return { ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY, OPENAI_API_KEY: env.OPENAI_API_KEY, GEMINI_API_KEY: env.GEMINI_API_KEY }
}

function validateMode(mode: unknown): GenUiMode | undefined {
  return typeof mode === 'string' && (GEN_UI_MODES as readonly string[]).includes(mode) ? (mode as GenUiMode) : undefined
}

const EFFORT_VALUES = ['low', 'medium', 'high', 'xhigh'] as const

function isChatBody(body: {
  system?: unknown
  model?: unknown
  messages?: unknown
  effort?: unknown
}): body is { system: string; model: string; messages: Turn[]; effort?: Effort } {
  return (
    typeof body.system === 'string' &&
    typeof body.model === 'string' &&
    Array.isArray(body.messages) &&
    (body.effort === undefined || (EFFORT_VALUES as readonly unknown[]).includes(body.effort))
  )
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

async function readBody(request: Request): Promise<string> {
  const contentLength = request.headers.get('content-length')
  if (contentLength !== null && Number(contentLength) > MAX_BODY) throw new Error('request body too large')
  const text = await request.text()
  if (text.length > MAX_BODY) throw new Error('request body too large')
  return text
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

  const providerId = providerForModel(config, model)
  if (providerId === undefined) return json(400, { error: 'unknown-model' })
  const pair = resolvePair(config, providerId, model)
  if (!pair.ok) return json(400, { error: pair.reason })
  const apiKey = envVars(env)[pair.envKey]
  if (apiKey === undefined || apiKey === '') return json(503, { error: 'no-key' })

  const dispatch = providerFor(providerId, { apiKey, endpoint: pair.entry.endpoint })
  if (!dispatch.ok) return json(503, { error: dispatch.reason })

  let text = ''
  for await (const fragment of dispatch.provider.stream({ model, system, messages, effort: effort as Effort | undefined })) {
    text += fragment
  }
  return json(200, { text })
}

async function handleProduce(request: Request, env: Env): Promise<Response> {
  const { input, provider, model, mode, personaSystem, integrations } = JSON.parse(await readBody(request)) as {
    input: TurnInput
    provider: string
    model: string
    mode?: unknown
    personaSystem?: unknown
    integrations?: unknown
  }

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
      for await (const line of produce(input, deps, {
        maxRounds: 3,
        model,
        mode: validateMode(mode),
        personaSystem: persona,
        progress: true,
        ...toolOpts,
      })) {
        await writer.write(encoder.encode(line + '\n'))
      }
    } catch {
      // ProduceHalt or an upstream fault mid-stream — headers are already committed (200/ndjson), so
      // just stop, matching dev-proxy-plugin.ts's `res.end()` on a post-headersSent error.
    } finally {
      await writer.close()
    }
  })()

  return new Response(readable, { status: 200, headers: { 'content-type': 'application/x-ndjson' } })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith(MOUNT)) return env.ASSETS.fetch(request)

    const sub = url.pathname.slice(MOUNT.length) || '/'
    try {
      if (request.method === 'GET' && sub.startsWith('/status')) return await handleStatus(env)
      // Both POST routes dispatch a real, billed LLM call — gate BEFORE any body is read (GH #101).
      if (request.method === 'POST' && !isSameOriginRequest(request)) return json(403, { error: 'forbidden-origin' })
      if (request.method === 'POST' && sub.startsWith('/chat')) return await handleChat(request, env)
      if (request.method === 'POST') return await handleProduce(request, env)
      return new Response(null, { status: 404 })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'proxy error'
      return json(500, { error: message })
    }
  },
}
