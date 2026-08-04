// fetch-json.ts — LLD-C3: the SHARED outbound fetch helper every v1 manifest executes through, lifted
// verbatim out of the retired `integrations.ts` (same timeout, same combine-signal logic, same size cap,
// same JSON parse). `registry.ts`'s TRUST NOTE names "the shared fetch helper's per-response size cap" —
// this is that helper, and `MAX_RESPONSE_BYTES` below is that cap.

const FETCH_TIMEOUT_MS = 10_000
/** PR #59 review — a defensive body-size backstop: the three v1 endpoints are small-payload APIs, but
 *  nothing should let an anomalous/tampered response buffer unbounded into the proxy's memory
 *  (compounding with the adapter's per-round fan-out). 256 KB is ~100× any real response here. */
const MAX_RESPONSE_BYTES = 256_000

export async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  // The turn's abort signal (PR #59 review) combines with the per-fetch timeout — whichever fires first.
  const combined = signal ? AbortSignal.any([AbortSignal.timeout(FETCH_TIMEOUT_MS), signal]) : AbortSignal.timeout(FETCH_TIMEOUT_MS)
  const res = await fetch(url, { signal: combined })
  if (!res.ok) throw new Error(`upstream ${res.status} from ${new URL(url).host}`)
  const text = await res.text()
  if (text.length > MAX_RESPONSE_BYTES) throw new Error(`upstream response too large from ${new URL(url).host}`)
  return JSON.parse(text)
}
