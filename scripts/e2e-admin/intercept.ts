// scripts/e2e-admin/intercept.ts: the network edge every admin flow runs behind.
//
// The keyless guarantee lives here. Every request that leaves the vite origin is aborted, and every
// same-origin `/__a2ui/` request is answered by this route and never continued to vite, so the dev proxy
// never sees a request even when `.env` holds a key. The page's three model URLs and the DEV-only
// integrations GET are answered from the scenario; the wire log records what crossed the edge.
//
// The handler is written over a narrow structural route type so the selftest can drive it with fakes and
// no browser; a Playwright `BrowserContext` satisfies `RoutableContext` as-is.

import { DEFAULT_STATUS, type AdminScenario, type ScriptedTurn } from './scenario.ts'

export interface RequestLike {
  url(): string
  method(): string
  postData(): string | null
}

export interface FulfillLike {
  status?: number
  contentType?: string
  body?: string
}

export interface RouteLike {
  request(): RequestLike
  fulfill(options: FulfillLike): Promise<void>
  abort(errorCode?: string): Promise<void>
  continue(): Promise<void>
}

export interface RoutableContext {
  route(url: string, handler: (route: RouteLike) => unknown): Promise<unknown>
}

export type WireEndpoint = 'status' | 'integrations' | 'produce' | 'chat' | 'other-a2ui' | 'external'
export type WireOutcome = 'fulfilled' | 'aborted' | 'unmatched' | 'exhausted'

export interface WireEntry {
  seq: number
  at: number
  endpoint: WireEndpoint
  method: string
  url: string
  /** The parsed JSON request body, when the request carried one. */
  request?: unknown
  outcome: WireOutcome
  turnIndex?: number
}

export interface WireLog {
  readonly entries: WireEntry[]
  /** One flag per scenario turn: true once a request consumed it. */
  readonly consumed: boolean[]
  /** Settles once the route is installed on the context. */
  readonly ready: Promise<unknown>
}

/** Indexes of scripted turns no request consumed. */
export function unconsumedTurns(wire: WireLog): number[] {
  return wire.consumed.flatMap((done, i) => (done ? [] : [i]))
}

const A2UI_PREFIX = '/__a2ui/'

/** Name the endpoint a request addresses. `undefined` means a same-origin non-`/__a2ui/` request, which
 *  goes to vite untouched. */
export function classifyRequest(origin: string, method: string, rawUrl: string): WireEndpoint | undefined {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return 'external'
  }
  if (url.origin !== origin) return 'external'
  if (!url.pathname.startsWith(A2UI_PREFIX)) return undefined
  if (method === 'GET' && url.pathname === '/__a2ui/agent/status') return 'status'
  if (method === 'GET' && url.pathname === '/__a2ui/agent/integrations') return 'integrations'
  if (method === 'POST' && url.pathname === '/__a2ui/agent') return 'produce'
  if (method === 'POST' && url.pathname === '/__a2ui/agent/chat') return 'chat'
  return 'other-a2ui'
}

/** Parse a request body as JSON; `undefined` when absent or not JSON. */
export function parseBody(request: RequestLike): unknown {
  const text = request.postData()
  if (text === null || text === '') return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/** The text a `match.textIncludes` searches: the intent text on produce, the last message on chat. */
function requestText(endpoint: 'produce' | 'chat', body: unknown): string {
  const b = (body ?? {}) as { input?: { kind?: unknown; text?: unknown }; messages?: { content?: unknown }[] }
  if (endpoint === 'produce') return b.input?.kind === 'intent' && typeof b.input.text === 'string' ? b.input.text : ''
  const last = Array.isArray(b.messages) ? b.messages.at(-1) : undefined
  return typeof last?.content === 'string' ? last.content : ''
}

/** Whether a request satisfies a scripted turn's `match` (absent `match` matches everything). */
export function matchesTurn(turn: ScriptedTurn, body: unknown): boolean {
  const match = turn.match
  if (match === undefined) return true
  const b = (body ?? {}) as { builderMission?: unknown; input?: { kind?: unknown } }
  if (match.mission !== undefined && b.builderMission !== match.mission) return false
  if (match.inputKind !== undefined && b.input?.kind !== match.inputKind) return false
  if (match.textIncludes !== undefined && !requestText(turn.endpoint, body).includes(match.textIncludes)) return false
  return true
}

const json = (status: number, value: unknown): FulfillLike => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(value),
})

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export interface InterceptState {
  scenario: AdminScenario
  origin: string
  wire: { entries: WireEntry[]; consumed: boolean[] }
  seq: number
}

export function createInterceptState(scenario: AdminScenario, origin: string): InterceptState {
  return { scenario, origin, wire: { entries: [], consumed: scenario.turns.map(() => false) }, seq: 0 }
}

/** Answer one intercepted request from the scenario. Never calls `continue()` for a `/__a2ui/` path or
 *  for a request off the vite origin. */
export async function handleRoute(state: InterceptState, route: RouteLike): Promise<void> {
  const request = route.request()
  const method = request.method()
  const url = request.url()
  const endpoint = classifyRequest(state.origin, method, url)
  if (endpoint === undefined) {
    await route.continue()
    return
  }
  const body = parseBody(request)
  const log = (outcome: WireOutcome, turnIndex?: number): void => {
    state.seq += 1
    state.wire.entries.push({
      seq: state.seq,
      at: Date.now(),
      endpoint,
      method,
      url,
      ...(body !== undefined ? { request: body } : {}),
      outcome,
      ...(turnIndex !== undefined ? { turnIndex } : {}),
    })
  }
  switch (endpoint) {
    case 'external':
      log('aborted')
      await route.abort()
      return
    case 'status':
      log('fulfilled')
      await route.fulfill(json(200, state.scenario.status ?? DEFAULT_STATUS))
      return
    case 'integrations':
      // 404 keeps the page on its static packs (the degrade in `fetchLiveIntegrations`).
      log('fulfilled')
      await route.fulfill(json(404, { error: 'e2e-admin: no live integrations' }))
      return
    case 'other-a2ui':
      log('fulfilled')
      await route.fulfill(json(404, { error: `e2e-admin: no scripted answer for ${method} ${new URL(url).pathname}` }))
      return
    case 'produce':
    case 'chat': {
      const turns = state.scenario.turns
      const index = turns.findIndex((turn, i) => !state.wire.consumed[i] && turn.endpoint === endpoint)
      if (index === -1) {
        log('exhausted')
        await route.fulfill(json(500, { error: `e2e-admin: no scripted ${endpoint} turn left` }))
        return
      }
      const turn = turns[index]!
      if (!matchesTurn(turn, body)) {
        log('unmatched', index)
        await route.fulfill(json(500, { error: `e2e-admin: request did not match turns[${index}].match` }))
        return
      }
      // Consume before any delay, so concurrent requests take turns in arrival order.
      state.wire.consumed[index] = true
      const respond = turn.respond
      log('abort' in respond ? 'aborted' : 'fulfilled', index)
      if (turn.delayMs !== undefined && turn.delayMs > 0) await sleep(turn.delayMs)
      if ('abort' in respond) {
        await route.abort()
      } else if ('lines' in respond) {
        await route.fulfill({
          status: 200,
          contentType: 'application/x-ndjson',
          body: respond.lines.map((line) => `${line}\n`).join(''),
        })
      } else if ('text' in respond) {
        await route.fulfill(json(200, { text: respond.text }))
      } else {
        await route.fulfill(json(respond.status, { error: respond.error }))
      }
      return
    }
  }
}

/** Install the scenario's network edge on a browser context and return its wire log. */
export function installIntercept(context: RoutableContext, scenario: AdminScenario, origin: string): WireLog {
  const state = createInterceptState(scenario, origin)
  const ready = context.route('**/*', (route) => handleRoute(state, route))
  return { entries: state.wire.entries, consumed: state.wire.consumed, ready }
}
