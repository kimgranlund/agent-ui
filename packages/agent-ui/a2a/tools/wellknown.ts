// wellknown.ts — agent-card serving + discovery (LLD-C9, SPEC-R5). `wellKnownAgentCardPath` is the
// v0.3.0-renamed path (HV-7 — NOT `agent.json`). `serveAgentCard` validates at startup and REFUSES to
// serve an invalid card (fail-fast — a lying card is worse than no card, LLD §8). `discoverAgent` fetches
// + validates a peer's card via an injectable `get` seam (kept socket-free in tests, same seam as the
// HTTP transport's `post`); a card with failures is never returned as usable.
import { decodeA2a } from '../src/protocol/codec.ts'
import { validateA2a, type A2aFailure } from '../src/protocol/validate.ts'
import { PROTOCOL_VERSION, type A2aAgentCard } from '../src/protocol/types.ts'

export const wellKnownAgentCardPath = '/.well-known/agent-card.json'

export interface ServedCard {
  body: string
}

/** Validate `card` and prepare it for serving. Throws (fail-fast, startup-time only — this is the ONE
 * deliberate exception to the "never throw" posture the wire-judging modules hold) if the card is
 * invalid: a lying card is worse than no card. */
export function serveAgentCard(card: A2aAgentCard): ServedCard {
  const failures = validateA2a(card, { protocolVersion: PROTOCOL_VERSION, expect: 'card' })
  if (failures.length > 0) {
    throw new Error(`serveAgentCard: refusing to serve an invalid card — ${JSON.stringify(failures)}`)
  }
  return { body: JSON.stringify(card) }
}

export interface HttpGetResponse {
  status: number
  text(): Promise<string>
}

export type Getter = (url: string) => Promise<HttpGetResponse>

export type DiscoverResult = { ok: true; card: A2aAgentCard } | { ok: false; failures: A2aFailure[] }

/** Fetch `${baseUrl}${wellKnownAgentCardPath}` and validate it. Never throws: network failure, a
 * non-200 status, and an invalid card body all become `{ok: false, failures}` — the card is never
 * returned as usable in any of those cases. */
export async function discoverAgent(baseUrl: string, opts: { get?: Getter } = {}): Promise<DiscoverResult> {
  const get = opts.get ?? defaultGet
  const url = `${baseUrl}${wellKnownAgentCardPath}`
  let res: HttpGetResponse
  try {
    res = await get(url)
  } catch (e) {
    return { ok: false, failures: [{ code: 'A2A_CARD', path: '/', detail: `fetch failed: ${String(e)}` }] }
  }
  if (res.status !== 200) {
    return { ok: false, failures: [{ code: 'A2A_CARD', path: '/', detail: `unexpected HTTP status ${res.status}` }] }
  }
  const text = await res.text()
  const decoded = decodeA2a<A2aAgentCard>(text, { protocolVersion: PROTOCOL_VERSION, expect: 'card' })
  if (!decoded.ok) return { ok: false, failures: decoded.failures }
  return { ok: true, card: decoded.value }
}

function defaultGet(url: string): Promise<HttpGetResponse> {
  return fetch(url)
}
