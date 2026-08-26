// provider-dispatch.test.ts — LLD-C8 / SPEC-R11 AC4. The defensive dispatch (`providerFor`): an
// implemented provider yields a live adapter; an unimplemented (or un-wired) provider DEGRADES to a
// distinguishable signal rather than throwing — the proxy treats `{ ok: false }` exactly like the no-key
// path (backbone-only), never an unhandled crash. Deterministic, no network.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { providerFor, validateProviderKeyCached } from '../../tools/agent/providers/index.ts'

afterEach(() => vi.unstubAllGlobals())

describe('providerFor defensive dispatch (LLD-C10 / SPEC-R11 AC4)', () => {
  it('returns a live adapter for the implemented provider (anthropic)', () => {
    const r = providerFor('anthropic', { apiKey: 'test-key-not-a-secret' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(typeof r.provider.stream).toBe('function')
  })

  it('DEGRADES (never throws) for an allowlisted-but-unimplemented provider', () => {
    expect(providerFor('openai', { apiKey: 'x' })).toEqual({ ok: false, reason: 'unimplemented' })
    expect(providerFor('gemini', { apiKey: 'x' })).toEqual({ ok: false, reason: 'unimplemented' })
  })

  it('DEGRADES (never throws) for an unknown / un-wired provider id', () => {
    // The dispatch table can't tell "never heard of it" from "known but un-wired" (the registry-level
    // resolvePair owns that distinction upstream); both degrade — the point is it never crashes.
    expect(providerFor('does-not-exist', { apiKey: 'x' })).toEqual({ ok: false, reason: 'unimplemented' })
  })
})

describe('validateProviderKeyCached — ticket #1634\'s live /status check, memoized per (provider, key)', () => {
  it('a live 401 reports the key unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })))
    expect(await validateProviderKeyCached('anthropic', 'test-1634-bad')).toBe(false)
  })

  it('a live 200 reports the key available', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })))
    expect(await validateProviderKeyCached('anthropic', 'test-1634-good')).toBe(true)
  })

  it('memoizes within the TTL — a second call with the SAME (provider, key) never re-fetches', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const key = 'test-1634-memo'
    await validateProviderKeyCached('anthropic', key)
    await validateProviderKeyCached('anthropic', key)
    await validateProviderKeyCached('anthropic', key)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('a DIFFERENT key value is never served from another key\'s cache entry (a key edit is a natural cache miss)', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await validateProviderKeyCached('anthropic', 'test-1634-key-a')
    await validateProviderKeyCached('anthropic', 'test-1634-key-b')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('an un-wired provider (openai/gemini — no real adapter, same as providerFor above) falls back to true with NO live check', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await validateProviderKeyCached('openai', 'x')).toBe(true)
    expect(await validateProviderKeyCached('gemini', 'x')).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
