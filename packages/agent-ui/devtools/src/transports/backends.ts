// backends.ts — the backend descriptor rows (ADR-0200 clause 3 / SPEC-R2; decomp n2d).
//
// One `{id, label, available()}` row per backend — what the harness page's switcher AND the seam's
// `GET /status` both render (one source, two surfaces). Swapping the backend a consumer constructs
// is a one-construction-site edit (SPEC-R2 AC1) — every factory in this folder returns the same
// unchanged `AgentTransport`.

/** The closed backend id vocabulary (SPEC-R2). */
export const BACKEND_IDS = ['replay', 'proxy', 'a2a'] as const
export type BackendId = (typeof BACKEND_IDS)[number]

/** One switcher/status row (SPEC-R2): `available()` NEVER throws — a probe failure reads as `false`. */
export interface BackendDescriptor {
  id: BackendId
  label: string
  available(): Promise<boolean>
}

/** The structural slice of `fetch` the proxy probe calls — the real `fetch` satisfies it. */
export type StatusProbeFetch = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>

export interface ListBackendsOptions {
  proxy?: {
    /** The dev-proxy mount to probe (default `'/__a2ui/agent'` — the existing ADR-0073 mount). */
    url?: string
    /** Injected fetch for the probe (jsdom-testable); defaults to `globalThis.fetch`, bound lazily. */
    fetch?: StatusProbeFetch
  }
}

/** The default dev-proxy mount (the a2ui `dev-proxy-plugin.ts` MOUNT constant, cited not imported —
 *  the coupling stays HTTP-only, SPEC-R4 AC3). */
export const DEFAULT_PROXY_MOUNT = '/__a2ui/agent'

/**
 * Probe the dev-proxy mount's `GET /status` and map its `{available}` boolean through (SPEC-R2 AC2).
 * ANY failure — a rejected fetch, a non-2xx, malformed JSON, a missing field — resolves `false`,
 * never throws: availability is a rendering fact, not a control-flow signal.
 */
export async function probeProxyAvailable(opts?: ListBackendsOptions['proxy']): Promise<boolean> {
  try {
    const doFetch = opts?.fetch ?? (globalThis.fetch as unknown as StatusProbeFetch)
    const res = await doFetch(`${opts?.url ?? DEFAULT_PROXY_MOUNT}/status`)
    if (!res.ok) return false
    const body = (await res.json()) as { available?: unknown }
    return body !== null && typeof body === 'object' && body.available === true
  } catch {
    return false
  }
}

/**
 * The descriptor shelf (SPEC-R2): `replay`/`a2a` are available unconditionally (in-proc, zero
 * network); `proxy` maps the mount's own `/status` through.
 */
export function listBackends(opts?: ListBackendsOptions): BackendDescriptor[] {
  return [
    { id: 'replay', label: 'Replay (canned timeline)', available: () => Promise.resolve(true) },
    { id: 'proxy', label: 'Live (dev proxy)', available: () => probeProxyAvailable(opts?.proxy) },
    { id: 'a2a', label: 'A2A peer (loopback)', available: () => Promise.resolve(true) },
  ]
}
