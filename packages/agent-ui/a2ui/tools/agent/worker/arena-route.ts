// arena-route.ts (T-0430): the production Worker's `/__a2a/arena` mount, the Fetch-API twin of the Vite
// dev adapter `a2a/tools/arena/dev-proxy-plugin.ts`. Both are thin shells over the SAME platform-neutral
// core (`a2a/tools/arena/live-match.ts`): the wire contract is the dev one unchanged (`GET /status`, `POST`
// `{seats:{X,O}}` answering NDJSON transcript lines, JSON `{error}` before headers), so the page's
// `site/lib/arena-live-transport.ts` reads either host the same way. Every dependency is injected (the
// route-guards.ts / env-projection.ts precedent): index.ts statically imports Wrangler-only modules and can
// never load under vitest, so this file must not.
//
// Gate order on POST, each before any spend:
//  1. same-origin (403), before anything else (GH #101: a CORS-safelisted POST skips preflight);
//  2. the per-visitor rate limiter, keyed by `cf-connecting-ip` (429 with `retry-after: 60`), before the
//     body is read. FAIL CLOSED: with no limiter bound the route never runs a match (503), and `/status`
//     reports `available:false` so the page never offers one;
//  3. a 64 KiB capped body read (413);
//  4. the core's seat validation: shape (400), pair + arena model allowlist (400), key (503).
// After the 200 is committed, a fault only closes the stream: nothing else is written into a body shaped
// like a transcript (a foreign line would read as "malformed"; a stream without `game end` is SPEC-R17's
// discard case).
//
// Cancel (LLD-C4): one AbortController per match, fed by `request.signal`, by the response body's reader
// going away (`writer.closed` rejects the moment the readable side is cancelled, so a visitor who leaves
// during an in-flight model call aborts it at once, not on the next write), and by a failed write. The core
// threads that signal into `runMatch` and each model seat, so the in-flight paid call cancels.
import type { ProvidersConfig } from '../providers-config.ts'
import type { providerFor, validateProviderKeyCached } from '../providers/index.ts'
import { ARENA_LIVE_MODELS, parseArenaRequest, resolveArenaSeat, startLiveMatch } from '../../../../a2a/tools/arena/live-match.ts'
import type { ArenaCaps } from '../../../../a2a/tools/arena/live-match.ts'
import { isSameOriginRequest, readBodyCapped } from './route-guards.ts'

/** The Workers Rate Limiting binding's call shape (`env.ARENA_RATE_LIMITER`, wrangler.jsonc). */
export interface ArenaLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>
}

/** The bound limiter, or `undefined` when the env carries none (the route then fails closed). Duck-typed:
 * a binding is an object with a `limit` function. Read from the RAW env, never the string-only projection. */
export function arenaLimiterFrom(env: Record<string, unknown>): ArenaLimiter | undefined {
  const candidate = env['ARENA_RATE_LIMITER']
  if (candidate === null || typeof candidate !== 'object') return undefined
  return typeof (candidate as { limit?: unknown }).limit === 'function' ? (candidate as ArenaLimiter) : undefined
}

export interface ArenaRouteDeps {
  config: ProvidersConfig
  env: Record<string, string | undefined>
  workspaceId?: string
  limiter: ArenaLimiter | undefined
  allowedOrigin: string
  providerFor: typeof providerFor
  validateKey: typeof validateProviderKeyCached
  caps?: ArenaCaps
}

const MAX_BODY = 1 << 16 // 64 KiB: a {seats:{X,O}} body is tiny
const RATE_WINDOW_S = 60 // wrangler.jsonc's `simple.period`

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

/** `GET /status`: available only when the limiter is bound AND a provider serving the arena models holds a
 * key that authenticates. The limiter is checked FIRST, so an unbound Worker never makes the upstream key
 * round-trip at all. */
async function handleStatus(deps: ArenaRouteDeps): Promise<Response> {
  if (deps.limiter === undefined) return json(200, { available: false, providers: 0 })
  const ids = Object.entries(deps.config.providers).filter(
    ([, entry]) => entry.implemented && entry.models.some((m) => ARENA_LIVE_MODELS.includes(m.id)),
  )
  const checks = await Promise.all(
    ids.map(async ([id, entry]) => {
      const key = deps.env[entry.envKey]
      if (typeof key !== 'string' || key === '') return false
      return deps.validateKey(id, key, entry.endpoint, deps.workspaceId)
    }),
  )
  const available = checks.filter(Boolean).length
  return json(200, { available: available > 0, providers: available })
}

async function handleMatch(request: Request, deps: ArenaRouteDeps): Promise<Response> {
  if (!isSameOriginRequest(request, deps.allowedOrigin)) return json(403, { error: 'forbidden-origin' })
  if (deps.limiter === undefined) return json(503, { error: 'live arena unavailable' })
  const visitor = request.headers.get('cf-connecting-ip') ?? 'unknown'
  const { success } = await deps.limiter.limit({ key: visitor })
  if (!success) return json(429, { error: 'rate-limited' }, { 'retry-after': String(RATE_WINDOW_S) })

  let body: unknown
  try {
    body = JSON.parse(await readBodyCapped(request, MAX_BODY)) as unknown
  } catch (err) {
    const tooLarge = err instanceof Error && err.message === 'request body too large'
    return tooLarge ? json(413, { error: 'request body too large' }) : json(400, { error: 'bad-request' })
  }
  const parsed = parseArenaRequest(body)
  if (!parsed.ok) return json(parsed.status, { error: parsed.error })
  const seatDeps = { providerFor: deps.providerFor, ...(deps.workspaceId !== undefined ? { workspaceId: deps.workspaceId } : {}) }
  const seatX = resolveArenaSeat(deps.config, deps.env, parsed.seats.X, 'X', seatDeps)
  if (!seatX.ok) return json(seatX.status, { error: seatX.error })
  const seatO = resolveArenaSeat(deps.config, deps.env, parsed.seats.O, 'O', seatDeps)
  if (!seatO.ok) return json(seatO.status, { error: seatO.error })

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()
  const controller = new AbortController()
  const abort = (): void => controller.abort()
  if (request.signal.aborted) abort()
  request.signal.addEventListener('abort', abort)
  writer.closed.then(undefined, abort)

  // One chain serializes the synchronous `write` calls the core makes; the first rejected write aborts the
  // match and every later rejection is swallowed (GH #107: nothing awaits a detached rejection).
  let chain: Promise<void> = Promise.resolve()
  const write = (line: string): void => {
    chain = chain
      .then(() => (controller.signal.aborted ? undefined : writer.write(encoder.encode(line))))
      .catch(abort)
  }

  void (async () => {
    try {
      await startLiveMatch({
        seats: { X: { provider: seatX.provider, selection: parsed.seats.X }, O: { provider: seatO.provider, selection: parsed.seats.O } },
        write,
        signal: controller.signal,
        ...(deps.caps !== undefined ? { caps: deps.caps } : {}),
      })
    } catch (err) {
      // Server-only (`wrangler tail`): an abort is the visitor leaving or the deadline; anything else is a
      // fault. Either way the stream just ends without `game end`, which the page discards.
      if (!controller.signal.aborted) console.error('arena match failed:', err)
    } finally {
      await chain
      request.signal.removeEventListener('abort', abort)
      try {
        await writer.close()
      } catch {
        // the readable side is already cancelled or errored: nothing left to close (GH #107)
      }
    }
  })()

  return new Response(readable, { status: 200, headers: { 'content-type': 'application/x-ndjson' } })
}

/** Serve one request under `/__a2a/arena`; `sub` is the path below the mount (`/` or `/status`). */
export async function handleArenaRequest(request: Request, sub: string, deps: ArenaRouteDeps): Promise<Response> {
  if (request.method === 'GET' && sub.startsWith('/status')) return handleStatus(deps)
  if (request.method === 'POST') return handleMatch(request, deps)
  return new Response(null, { status: 404 })
}
