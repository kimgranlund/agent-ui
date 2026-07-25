// live-proxy-transport.test.ts — the fetch-boundary POST-body shape for `createLiveProxyTransport`
// (SPEC-R12/LLD-C7). `fetch` is stubbed (no real network, no key) — the `admin-live-runner.test.ts`
// stub-fetch precedent. Proves `SelectionRef.effort` (the reasoning-effort dial, the SAME additive
// precedent `mode` already set on this seam) actually reaches the wire, not just the type — a WIDER
// selection object that structurally has `.effort` type-checks against `SelectionRef.get()`'s return
// regardless of whether the body construction reads it, so a type-only check can't catch a silent drop.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLiveProxyTransport } from './live-proxy-transport.ts'
import type { SelectionRef } from './live-proxy-transport.ts'
import type { TurnInput } from './agent-runtime.ts'

const INPUT: TurnInput = { kind: 'intent', text: 'hi', session: { turns: [] }, provider: 'anthropic', model: 'claude-sonnet-5' }

function emptyNdjsonResponse(): Response {
  return new Response(new ReadableStream<Uint8Array>({ start: (c) => c.close() }), {
    status: 200,
    headers: { 'content-type': 'application/x-ndjson' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createLiveProxyTransport — POST body shape', () => {
  it('omits `effort` from the POST body when the selection carries none (byte-identical to before this field existed)', async () => {
    const fetchSpy = vi.fn(async () => emptyNdjsonResponse())
    vi.stubGlobal('fetch', fetchSpy)
    const selection: SelectionRef = { get: () => ({ provider: 'anthropic', model: 'claude-sonnet-5', mode: 'specific' }) }
    const transport = createLiveProxyTransport(selection)
    for await (const _line of transport.turn(INPUT)) {
      /* drain */
    }
    const init = (fetchSpy.mock.calls[0] as unknown[])[1] as { body: string }
    const body = JSON.parse(init.body) as Record<string, unknown>
    expect('effort' in body).toBe(false)
  })

  it('threads a real `effort` value from the selection into the actual POST body (not just the type)', async () => {
    const fetchSpy = vi.fn(async () => emptyNdjsonResponse())
    vi.stubGlobal('fetch', fetchSpy)
    const selection: SelectionRef = { get: () => ({ provider: 'anthropic', model: 'claude-sonnet-5', mode: 'specific', effort: 'high' }) }
    const transport = createLiveProxyTransport(selection)
    for await (const _line of transport.turn(INPUT)) {
      /* drain */
    }
    const init = (fetchSpy.mock.calls[0] as unknown[])[1] as { body: string }
    const body = JSON.parse(init.body) as Record<string, unknown>
    expect(body.effort).toBe('high')
    expect(body.provider).toBe('anthropic')
    expect(body.model).toBe('claude-sonnet-5')
    expect(body.mode).toBe('specific')
  })
})
