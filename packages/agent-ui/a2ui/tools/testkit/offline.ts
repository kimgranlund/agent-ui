// offline.ts: the kit's keyless, offline tripwire (T-0011). `armOffline()` replaces `fetch` and deletes
// every env var whose name ends in the `_API_KEY` suffix; the returned disarm restores both. A kit run that
// touches the network or a provider key fails loudly instead of silently reaching a model (ADR-0073).
//
// Three environments, told apart by `location` and the user agent (Node 24 has a global `navigator`, so a
// navigator check alone would send plain Node down the page branch):
//   - plain Node: `typeof location === 'undefined'`. Every URL rejects.
//   - jsdom: a `location` (`http://localhost:3000`) but a user agent containing `jsdom`. Every URL rejects,
//     same-origin included: nothing real answers there.
//   - a real page (vitest browser mode): only an off-origin URL rejects; same-origin calls go to the saved
//     fetch, because the vitest browser client fetches its own origin.
// A rejection is an Error whose message starts `KIT_NETWORK`. `process` is reached through a `globalThis`
// cast, so this file type-checks under the root tsconfig (no Node types) and loads in a page.

export type OfflineEnvironment = 'node' | 'jsdom' | 'page'

const KEY_SUFFIX = '_API_KEY'

export function offlineEnvironment(): OfflineEnvironment {
  if (typeof location === 'undefined') return 'node'
  const ua = (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent ?? ''
  return ua.includes('jsdom') ? 'jsdom' : 'page'
}

function urlOf(input: unknown): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  if (typeof input === 'object' && input !== null && typeof (input as { url?: unknown }).url === 'string') return (input as { url: string }).url
  return String(input)
}

function envOf(): Record<string, string | undefined> | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
}

/** Arm the tripwire; call the returned function to restore `fetch` and every deleted key var. */
export function armOffline(): () => void {
  const env = offlineEnvironment()
  const saved = globalThis.fetch
  const tripped = (url: string): Promise<never> => {
    const err = Object.assign(new Error(`KIT_NETWORK: the A2UI test kit is offline; refused ${url}`), { code: 'KIT_NETWORK' })
    return Promise.reject(err)
  }
  const replacement = ((input: unknown, init?: unknown): Promise<Response> => {
    const url = urlOf(input)
    if (env === 'page') {
      let origin: string
      try {
        origin = new URL(url, location.href).origin
      } catch {
        return tripped(url)
      }
      if (origin === location.origin) return (saved as (i: unknown, n?: unknown) => Promise<Response>)(input, init)
    }
    return tripped(url)
  }) as typeof fetch
  globalThis.fetch = replacement

  const vars = envOf()
  const removed: [string, string | undefined][] = []
  if (vars !== undefined) {
    for (const name of Object.keys(vars)) {
      if (name.endsWith(KEY_SUFFIX)) {
        removed.push([name, vars[name]])
        delete vars[name]
      }
    }
  }

  let disarmed = false
  return () => {
    if (disarmed) return
    disarmed = true
    if (globalThis.fetch === replacement) globalThis.fetch = saved
    if (vars !== undefined) for (const [name, value] of removed) if (value !== undefined) vars[name] = value
  }
}
