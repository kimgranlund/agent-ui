// integrations.ts — GH #49: the dev-proxy's INTEGRATION registry (node-side, site-internal — the
// ADR-0137 shell law: everything key/proxy/registry-shaped stays in tools/agent/, the portable core in
// src/agent/ carries only the ToolDef/ExecuteTool seam). Execution happens HERE, in the proxy's node
// process, because produce() runs here — a browser-held executor cannot cross the HTTP boundary — and
// node-side fetch also sidesteps CORS entirely.
//
// v1 is deliberately KEYLESS: Open-Meteo (weather — no key, no auth), Wikipedia's public REST search,
// and Frankfurter (ECB FX rates). Hotel booking/PMS integrations are GH #49's named DIRECTION, not this
// registry's scope.
//
// TRUST NOTE (PR #59 review): this registry widens the dev proxy's existing unauthenticated
// localhost-only assumption — the POST route can now drive real outbound third-party fetches, not just
// the LLM call. Outbound volume is bounded (the adapter's MAX_TOOL_ROUNDS × MAX_CALLS_PER_ROUND ceiling
// + the per-response size cap below), every integration URL is host-pinned with encodeURIComponent'd
// values only, and the whole path exists ONLY in `vite dev`. Do NOT run the dev server with `--host`
// (LAN-exposed) on an untrusted network — the pre-existing key-spend caveat now also covers tool fan-out. Every `execute` returns compact TEXT for the model (never raw response dumps) and
// throws on upstream failure — the adapter converts a rejection into an `is_error` tool_result the model
// can react to (the ExecuteTool contract), so a downed API degrades the answer, never the turn.

import type { ToolDef } from '../../src/agent/agent-transport.ts'

export interface Integration {
  /** Stable id — ALSO the tool's wire `name` AND the entry LABEL the admin's Integrations pack uses
   *  (the whole enablement chain keys on this one string). */
  id: string
  label: string
  description: string
  tool: ToolDef
  execute(input: Record<string, unknown>): Promise<string>
}

const FETCH_TIMEOUT_MS = 10_000
/** PR #59 review — a defensive body-size backstop: the three v1 endpoints are small-payload APIs, but
 *  nothing should let an anomalous/tampered response buffer unbounded into the proxy's memory
 *  (compounding with the adapter's per-round fan-out). 256 KB is ~100× any real response here. */
const MAX_RESPONSE_BYTES = 256_000

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`upstream ${res.status} from ${new URL(url).host}`)
  const text = await res.text()
  if (text.length > MAX_RESPONSE_BYTES) throw new Error(`upstream response too large from ${new URL(url).host}`)
  return JSON.parse(text)
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

export const INTEGRATIONS: Integration[] = [
  {
    id: 'weather',
    label: 'Weather (Open-Meteo)',
    description: 'Current conditions + short forecast for a named place. Keyless.',
    tool: {
      name: 'weather',
      description: 'Get current weather and a short forecast for a city or place name.',
      input_schema: {
        type: 'object',
        properties: { place: { type: 'string', description: 'City or place name, e.g. "Helsinki"' } },
        required: ['place'],
      },
    },
    async execute(input) {
      const place = str(input.place).trim()
      if (place.length === 0) throw new Error('weather: `place` is required')
      const geo = (await getJson(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=en&format=json`,
      )) as { results?: Array<{ name: string; country?: string; latitude: number; longitude: number }> }
      const hit = geo.results?.[0]
      if (!hit) throw new Error(`weather: no place matched "${place}"`)
      const wx = (await getJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}` +
          `&current=temperature_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=3&timezone=auto`,
      )) as {
        current?: { temperature_2m?: number; apparent_temperature?: number; precipitation?: number; wind_speed_10m?: number }
        daily?: { time?: string[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[] }
      }
      const c = wx.current ?? {}
      const days = (wx.daily?.time ?? [])
        .map((d, i) => `${d}: ${wx.daily?.temperature_2m_min?.[i]}–${wx.daily?.temperature_2m_max?.[i]}°C, precip ${wx.daily?.precipitation_probability_max?.[i]}%`)
        .join('; ')
      return (
        `Weather for ${hit.name}${hit.country ? `, ${hit.country}` : ''}: now ${c.temperature_2m}°C ` +
        `(feels ${c.apparent_temperature}°C), wind ${c.wind_speed_10m} km/h, precipitation ${c.precipitation} mm. ` +
        `Next days — ${days}.`
      )
    },
  },
  {
    id: 'wikipedia-search',
    label: 'Wikipedia search',
    description: 'Search Wikipedia and return the top results with one-line summaries. Keyless.',
    tool: {
      name: 'wikipedia-search',
      description: 'Search Wikipedia for a topic; returns top result titles with short descriptions and extracts.',
      input_schema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'The search query' } },
        required: ['query'],
      },
    },
    async execute(input) {
      const query = str(input.query).trim()
      if (query.length === 0) throw new Error('wikipedia-search: `query` is required')
      const data = (await getJson(
        `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=4`,
      )) as { pages?: Array<{ title?: string; description?: string; excerpt?: string }> }
      const pages = data.pages ?? []
      if (pages.length === 0) return `No Wikipedia results for "${query}".`
      return pages
        .map((p) => `${p.title}${p.description ? ` — ${p.description}` : ''}${p.excerpt ? ` (${p.excerpt.replace(/<[^>]+>/g, '')})` : ''}`)
        .join('\n')
    },
  },
  {
    id: 'currency',
    label: 'Currency rates (Frankfurter)',
    description: 'Convert an amount between currencies at the latest ECB reference rates. Keyless.',
    tool: {
      name: 'currency',
      description: 'Convert an amount from one currency to another using latest ECB reference rates.',
      input_schema: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'The amount to convert' },
          from: { type: 'string', description: 'ISO 4217 code, e.g. "EUR"' },
          to: { type: 'string', description: 'ISO 4217 code, e.g. "USD"' },
        },
        required: ['amount', 'from', 'to'],
      },
    },
    async execute(input) {
      const amount = typeof input.amount === 'number' && Number.isFinite(input.amount) ? input.amount : NaN
      const from = str(input.from).toUpperCase()
      const to = str(input.to).toUpperCase()
      if (!Number.isFinite(amount) || !/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
        throw new Error('currency: needs numeric `amount` + 3-letter `from`/`to` codes')
      }
      const data = (await getJson(
        `https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`,
      )) as { rates?: Record<string, number>; date?: string }
      const rate = data.rates?.[to]
      if (typeof rate !== 'number') throw new Error(`currency: no rate ${from}→${to}`)
      return `${amount} ${from} = ${(amount * rate).toFixed(2)} ${to} (rate ${rate}, ECB reference ${data.date ?? 'latest'}).`
    },
  },
]

/** Validate + resolve the browser-supplied enablement list: strings only, intersected with the registry
 *  (unknown ids silently dropped — the browser forwards raw entry labels; only registry matches count),
 *  capped defensively. Anything malformed ⇒ empty (tools off), never a throw. */
export function resolveIntegrations(ids: unknown): Integration[] {
  if (!Array.isArray(ids)) return []
  const wanted = new Set(ids.filter((v): v is string => typeof v === 'string').slice(0, 16))
  return INTEGRATIONS.filter((integration) => wanted.has(integration.id))
}
