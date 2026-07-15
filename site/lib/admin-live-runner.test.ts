// admin-live-runner.test.ts — ALM-C7 (TKT-0052/ADR-0136): createAdminAgentTurn's fetch-boundary legs.
// `fetch` is stubbed (no real network, no key) — the feed-live-transport.test.ts stub-fetch precedent.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAdminAgentTurn } from './admin-live-runner.ts'
import type { AdminTurnRequest } from '@agent-ui/app/agent-admin-schema'

const REQUEST: AdminTurnRequest = { text: 'hi', system: 'be helpful', model: 'claude-sonnet-5', history: [] }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createAdminAgentTurn', () => {
  it('returns the reply text on a well-shaped 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ text: 'hello there' }), { status: 200 })))
    const turn = createAdminAgentTurn()
    await expect(turn(REQUEST)).resolves.toBe('hello there')
  })

  it('throws the proxy\'s {error} detail on a non-2xx response (never a silent empty reply)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'no-key' }), { status: 503 })))
    const turn = createAdminAgentTurn()
    await expect(turn(REQUEST)).rejects.toThrow(/no-key/)
  })

  it('throws on a 200 body whose text field is missing or non-string (TKT-0052 review LOW-3 — never a silent empty success)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })))
    const turn = createAdminAgentTurn()
    await expect(turn(REQUEST)).rejects.toThrow(/malformed response body/)
  })
})
