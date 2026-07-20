// dev-proxy-plugin.ts — LLD-C6 / SPEC-R9/R11/R12/N2: the DEV-ONLY Vite middleware proxy. It is the TRUST
// BOUNDARY (ADR-0073 clause 5): the browser never holds a key. This plugin holds each provider's key
// SERVER-side (`process.env[<envKey>]`), VALIDATES the client's `{provider, model}` PAIR against the
// committed providers.json allowlist (`resolvePair`), runs the `produce()` loop with the matched adapter +
// retrieval over the judged shard, and streams the VALIDATED A2UI JSONL back. `apply: 'serve'` means it
// attaches ONLY under `vite dev` — `vite build` never runs it, so the static build carries no proxy, no
// key path (SPEC-R3/N2). `/status` answers a boolean + count; a key value is NEVER sent to the browser.
//
// Paths resolve from `process.cwd()` (the repo root `vite` runs from), NOT `import.meta.url` — Vite bundles
// this config-graph module with esbuild into a temp file, so `import.meta.url` would point at the temp dir.
//
// ADR-0090 §4/LLD-C6: the body also carries `mode` (a `GenUiMode`) — validated by enum MEMBERSHIP (a closed
// 3-value set, not a registry lookup) and defaulted, never forwarded raw, exactly as `model` is validated by
// `resolvePair` above — but a bad `mode` degrades the DISPOSITION, never the request (no 400).

import { readFileSync } from 'node:fs'
import { loadEnv } from 'vite'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { produce } from '../../src/agent/produce.ts'
import type { ProduceDeps } from '../../src/agent/produce.ts'
import { resolvePair, validateProvidersConfig } from './providers-config.ts'
import type { ProvidersConfig } from './providers-config.ts'
import { providerFor } from './providers/index.ts'
import { retrieve } from '../../src/corpus/retrieve.ts'
import type { CorpusRecord } from '../../src/corpus/record.ts'
import { loadCatalog } from '../../src/catalog/catalog.ts'
import type { TurnInput, Effort } from '../../src/agent/agent-transport.ts'
import { resolveIntegrations } from './integrations.ts'
// GH #108 — the PAIR-allowlist validation spine now lives in chat-validation.ts (zero vite/node deps, so
// the Cloudflare Worker port can import it directly too, which it couldn't do from THIS file — importing
// anything from here would drag `loadEnv`/`vite` into the Workers bundle). Re-exported unchanged so this
// file's own tests (validate-mode.test.ts, chat-route.test.ts) needed no changes for the extraction.
import { validateMode, isChatBody, resolveChatDispatch } from './chat-validation.ts'
import type { ChatDispatch } from './chat-validation.ts'
export { validateMode, isChatBody, resolveChatDispatch }
export type { ChatDispatch }

declare const process: { cwd(): string; env: Record<string, string | undefined> }

const ROOT = process.cwd()
const CONFIG_PATH = `${ROOT}/packages/agent-ui/a2ui/tools/agent/providers.json`
const CATALOG_PATH = `${ROOT}/packages/agent-ui/a2ui/src/catalog/default/catalog.json`
const SHARD_PATH = `${ROOT}/packages/agent-ui/a2ui/corpus/exemplar/v1_0/agent-ui.jsonl`

const MOUNT = '/__a2ui/agent'
const MAX_BODY = 1 << 20 // 1 MiB — a dev-only intent/turn body is tiny; cap it so a runaway request can't grow unbounded
// GH #144 — the user-facing fallback note when produce() halts or faults mid-stream (never leaks the
// internal error message — ProduceHalt's own text names round bounds/failure codes, an implementation
// detail, not something to show a user). Shared verbatim with worker/index.ts's production twin.
const FAILURE_NOTE = "I couldn't put together a valid response for that — could you try rephrasing, or try again?"

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

export function a2uiDevProxyPlugin(): Plugin {
  // The provider keys live in the repo-root `.env` (gitignored). Vite does NOT load `.env` into
  // `process.env` — non-`VITE_` vars are kept out of BOTH `process.env` and `import.meta.env` — so
  // `process.env[envKey]` alone would always miss a `.env`-only key (the "no live API key found"
  // degrade). We load the env SERVER-side with Vite's `loadEnv` (prefix '' ⇒ all vars, incl. the
  // non-prefixed keys; `process.env` shell exports still win). This runs in Node under `vite dev`
  // ONLY (`apply: 'serve'`) and the value never leaves the proxy — the browser gets a boolean, not a
  // key (SPEC-N2 / ADR-0073 clause 5, the trust boundary). `envDir` is the repo root (`process.cwd()`),
  // NOT Vite's `root: 'site'`, so the root `.env` is the one read.
  let env: Record<string, string | undefined> = process.env

  return {
    name: 'a2ui-live-agent-proxy',
    apply: 'serve', // dev only — never attaches under `vite build` (SPEC-R3/N2)
    config(_config, { mode }) {
      env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }
    },
    configureServer(server) {
      // The catalog + judged shard are STATIC build inputs — load once at server start (readFileSync — the
      // tools/harness precedent; Node's ESM loader rejects an attribute-less JSON import).
      const catalog = loadCatalog(JSON.parse(readFileSync(CATALOG_PATH, 'utf8')))
      const shard: CorpusRecord[] = (readFileSync(SHARD_PATH, 'utf8') as string)
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .map((l) => JSON.parse(l) as CorpusRecord)

      // providers.json is the switcher-synced, user-editable registry (env-var NAMES + model ids, NO
      // secrets). Re-read + validate it PER REQUEST so an edit (e.g. a new model row) takes effect WITHOUT
      // a dev-server restart: the in-chat switcher is HMR-reloaded from the same file, so the proxy's
      // PAIR-allowlist MUST reload too — otherwise the two drift and the menu offers a model the proxy
      // rejects with a 400 (exactly the Haiku-4.5 symptom). Small file; reparsing per request is cheap.
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
            const config = loadConfig() // fresh per request — stays in lockstep with the HMR'd switcher
            // GET /status — which implemented providers have a key configured? (a boolean + count; no key)
            if (req.method === 'GET' && url.startsWith('/status')) {
              const available = Object.values(config.providers).filter(
                (e) => e.implemented && typeof env[e.envKey] === 'string' && env[e.envKey] !== '',
              ).length
              sendJson(res, 200, { available: available > 0, providers: available })
              return
            }

            // POST /chat — ALM-C6 (TKT-0052/ADR-0136): a SECOND branch on the same mount, one level BELOW
            // produce(). It rides the SAME trust boundary (providers.json PAIR-allowlist + server-side key)
            // but calls `provider.stream({model, system, messages})` directly with the CALLER's own system
            // prompt (agent-admin's composed prompt + capability projection) and buffers the raw prose
            // fragments into ONE JSON `{text}` — never a produce() A2UI-JSONL heal/validate loop (§0: the
            // agent-admin turn is prose, which produce() would reject as invalid A2UI). MUST precede the
            // generic POST branch below, which otherwise claims every POST regardless of sub-path.
            if (req.method === 'POST' && url.startsWith('/chat')) {
              const body = JSON.parse(await readBody(req)) as {
                system?: unknown
                model?: unknown
                messages?: unknown
                effort?: unknown
              }
              if (!isChatBody(body)) {
                sendJson(res, 400, { error: 'bad-request' }) // a malformed body is a deterministic failure — never let it fall through to provider.stream()
                return
              }
              const { system, model, messages, effort } = body
              const dispatch = resolveChatDispatch(config, env, model)
              if (!dispatch.ok) {
                sendJson(res, dispatch.status, { error: dispatch.error }) // 400 unknown/rejected pair · 503 no key
                return
              }
              // The SECOND, independent line of defense (SPEC-R11 AC4): even an allowlisted provider degrades
              // here if its adapter module isn't wired — never an unhandled crash.
              const providerDispatch = providerFor(dispatch.provider, { apiKey: dispatch.apiKey, endpoint: dispatch.endpoint })
              if (!providerDispatch.ok) {
                sendJson(res, 503, { error: providerDispatch.reason })
                return
              }
              let text = ''
              for await (const fragment of providerDispatch.provider.stream({ model, system, messages, effort: effort as Effort | undefined })) {
                text += fragment // buffered server-side — single-shot (LLD Q3); one full reply, no mid-stream truncation
              }
              sendJson(res, 200, { text })
              return
            }

            // POST — run one turn and stream validated A2UI JSONL back.
            if (req.method === 'POST') {
              const { input, provider, model, mode, personaSystem, integrations } = JSON.parse(await readBody(req)) as {
                input: TurnInput
                provider: string
                model: string
                mode?: unknown
                personaSystem?: unknown
                integrations?: unknown
              }
              const pair = resolvePair(config, provider, model) // SPEC-R12 PAIR-allowlist — the trust boundary
              if (!pair.ok) {
                sendJson(res, 400, { error: pair.reason }) // degrade: the client falls back to the backbone
                return
              }
              const apiKey = env[pair.envKey]
              if (apiKey === undefined || apiKey === '') {
                sendJson(res, 503, { error: 'no-key' })
                return
              }
              // Endpoint comes from the MATCHED registry row (providers.json), not a client value — one
              // source of truth for the request URL (SPEC-R11).
              const dispatch = providerFor(provider, { apiKey, endpoint: pair.entry.endpoint }) // defensive dispatch (SPEC-R11 AC4)
              if (!dispatch.ok) {
                sendJson(res, 503, { error: dispatch.reason })
                return
              }
              res.statusCode = 200
              res.setHeader('content-type', 'application/x-ndjson')
              const deps: ProduceDeps = {
                provider: dispatch.provider,
                retrieve: (q) => retrieve(shard, q),
                catalog,
              }
              // produce() yields ONLY a fully validated payload's lines (SPEC-R5) — stream them line by line.
              // `model` is the allowlist-VALIDATED value (resolvePair) passed as the AUTHORITATIVE opts.model:
              // it overrides any client-supplied input.model, so a crafted body cannot escape the PAIR check (SPEC-R12).
              // `mode` is the membership-VALIDATED GenUiMode (ADR-0090 §4) — an unrecognized/absent value comes
              // back `undefined`, which `produce()`/`buildSystemPrompt` already treat as the default disposition.
              // ADR-0138 cl.3 — the optional persona section: string, length-capped (16 KB — a runaway
              // guard; the composed admin persona is ~1-2 KB), forwarded verbatim; anything else ⇒ absent.
              const persona = typeof personaSystem === 'string' && personaSystem.length <= 16_384 ? personaSystem : undefined
              // GH #49 — the browser forwards ENABLED tool-entry labels; only registry matches survive
              // (resolveIntegrations validates + intersects, malformed ⇒ empty). Execution stays HERE in
              // the proxy's node process (the ADR-0137 shell law; produce's ExecuteTool cannot cross HTTP).
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
              // ADR-0146 F1 — opt IN to the live-turn progress channel: produce() interleaves
              // {"a2uiMeta":{"progress":…}} meta-lines that flush through the SAME per-line res.write below
              // (NO structural proxy change — a progress line is an ordinary NDJSON line; the browser's
              // readMetaLine filter routes it to handle.progress). progressDetail stays the 'stages' default,
              // so no raw thinking text crosses the wire (F3).
              for await (const line of produce(input, deps, { maxRounds: 3, model, mode: validateMode(mode), personaSystem: persona, progress: true, ...toolOpts })) {
                res.write(line + '\n')
              }
              res.end()
              return
            }

            res.statusCode = 404
            res.end()
          } catch (err) {
            // produce() halted, a bad body, or an upstream fault — report without leaking a key.
            const message = err instanceof Error ? err.message : 'proxy error'
            if (!res.headersSent) sendJson(res, 500, { error: message })
            else if (!res.destroyed) {
              // GH #144 — headers are already committed (200/ndjson), so there's no HTTP-level error
              // path left; silently ending here left the client with a fully empty
              // `{"response":{"lines":[]}}` and no rendered explanation. Mirrors worker/index.ts's
              // production fix: a note-only meta-line, the SAME wire shape a model's own note-only
              // turn already uses (ADR-0088 §1) — every existing consumer renders it like a real reply.
              // `res.destroyed` (the connection is already gone — the client disconnected) is the one
              // case that stays silent; there's no one left to read it.
              res.write(JSON.stringify({ a2uiMeta: { note: FAILURE_NOTE } }) + '\n')
              res.end()
            } else res.end()
          }
        })()
      })
    },
  }
}
