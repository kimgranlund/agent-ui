// anthropic-key-validation.test.ts — ticket #1634's live key check (`validateAnthropicKey`,
// tools/agent/providers/anthropic.ts): a 401/403 is the only definitive "bad key" signal; every other
// outcome (200, an unexpected status, a network fault reaching the check itself) fails OPEN. Fetch is
// stubbed PER-TEST with an afterEach unstub — the `anthropic-tool-loop.test.ts` precedent — so this file
// never makes a real network call.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { validateAnthropicKey } from '../agent/providers/anthropic.ts'

afterEach(() => vi.unstubAllGlobals())

describe('validateAnthropicKey — the /status live-authentication check (ticket #1634)', () => {
  it('a 401 (invalid key) reports false', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })))
    expect(await validateAnthropicKey('bad-key')).toBe(false)
  })

  it('a 403 (revoked/forbidden key) reports false', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 403 })))
    expect(await validateAnthropicKey('revoked-key')).toBe(false)
  })

  it('a 200 (working key) reports true', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })))
    expect(await validateAnthropicKey('good-key')).toBe(true)
  })

  it('an unrelated upstream fault (e.g. 500) fails OPEN — not evidence the key itself is bad', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })))
    expect(await validateAnthropicKey('good-key')).toBe(true)
  })

  it('a network error reaching the check itself fails OPEN', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    expect(await validateAnthropicKey('good-key')).toBe(true)
  })

  it('derives the models URL from the registry endpoint (never a second hardcoded origin)', async () => {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL) => {
        calls.push(String(url))
        return new Response(null, { status: 200 })
      }),
    )
    await validateAnthropicKey('key', 'https://proxy.example.com/v1/messages')
    expect(calls).toEqual(['https://proxy.example.com/v1/models'])
  })

  it('sends the key as x-api-key, never a bearer token or query param', async () => {
    let headers: HeadersInit | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        headers = init?.headers
        return new Response(null, { status: 200 })
      }),
    )
    await validateAnthropicKey('sk-test-value')
    expect(new Headers(headers).get('x-api-key')).toBe('sk-test-value')
  })
})
