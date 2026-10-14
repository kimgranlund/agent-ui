// anthropic-workspace-header.test.ts — T-0192: an org-level Anthropic key answers 400 unless the request carries
// `anthropic-workspace-id`. The adapter sends the header when a workspace id is configured and omits it
// otherwise, on both the streaming call and the live key check. Fetch is stubbed per test; no network.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { anthropicHeaders, anthropicProvider, validateAnthropicKey } from '../agent/providers/anthropic.ts'
import { projectEnv } from '../../tools/agent/worker/env-projection.ts'
import { resolveChatDispatch } from '../../tools/agent/chat-validation.ts'
import { validateProviderKeyCached } from '../../tools/agent/providers/index.ts'
import providersConfigRaw from '../../tools/agent/providers.json'
import type { ProvidersConfig } from '../../tools/agent/providers-config.ts'

afterEach(() => vi.unstubAllGlobals())

const WS = 'wrkspc_test'

function sse(): Response {
  const body = 'event: message_stop\ndata: {"type":"message_stop"}\n\n'
  // jsdom's Blob has no .stream(); construct the ReadableStream directly (the anthropic-retry.test.ts precedent).
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body))
      controller.close()
    },
  })
  return new Response(stream, { status: 200 })
}

async function streamHeaders(workspaceId: string | undefined): Promise<Headers> {
  const fetchMock = vi.fn(async (_url: unknown, _init?: RequestInit) => sse())
  vi.stubGlobal('fetch', fetchMock)
  const provider = anthropicProvider({ apiKey: 'k', ...(workspaceId !== undefined ? { workspaceId } : {}) })
  const out = provider.stream({ system: 's', messages: [{ role: 'user', content: 'hi' }], model: 'claude-haiku-5-5' })
  for await (const _ of out as AsyncIterable<string>) void _
  return new Headers(fetchMock.mock.calls[0]?.[1]?.headers)
}

describe('anthropic-workspace-id header (T-0192)', () => {
  it('anthropicHeaders adds the header only for a non-empty id', () => {
    expect(anthropicHeaders('k', WS)['anthropic-workspace-id']).toBe(WS)
    expect('anthropic-workspace-id' in anthropicHeaders('k')).toBe(false)
    expect('anthropic-workspace-id' in anthropicHeaders('k', '')).toBe(false)
  })

  it('the streaming request carries the header when configured', async () => {
    const h = await streamHeaders(WS)
    expect(h.get('anthropic-workspace-id')).toBe(WS)
    expect(h.get('x-api-key')).toBe('k')
  })

  it('the streaming request omits the header when not configured', async () => {
    const h = await streamHeaders(undefined)
    expect(h.has('anthropic-workspace-id')).toBe(false)
  })

  it('the live key check carries the header when configured and omits it when not', async () => {
    const fetchMock = vi.fn(async (_url: unknown, _init?: RequestInit) => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await validateAnthropicKey('k', undefined, WS)
    await validateAnthropicKey('k')
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('anthropic-workspace-id')).toBe(WS)
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).has('anthropic-workspace-id')).toBe(false)
  })

  it('the cached key check does not reuse a verdict across workspace ids', async () => {
    const fetchMock = vi.fn(async (_url: unknown, _init?: RequestInit) => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await validateProviderKeyCached('anthropic', 'cache-key', undefined, 'ws-a')
    await validateProviderKeyCached('anthropic', 'cache-key', undefined, 'ws-b')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('resolveChatDispatch hands the env workspace id to the dispatch, absent when unset', () => {
    const config = providersConfigRaw as ProvidersConfig
    const model = 'claude-haiku-5-5'
    const withWs = resolveChatDispatch(config, { ANTHROPIC_API_KEY: 'k', ANTHROPIC_WORKSPACE_ID: WS }, model)
    const without = resolveChatDispatch(config, { ANTHROPIC_API_KEY: 'k' }, model)
    expect(withWs.ok && withWs.workspaceId).toBe(WS)
    expect(without.ok && 'workspaceId' in without).toBe(false)
  })

  it('the Worker env projection carries ANTHROPIC_WORKSPACE_ID through when it is a string', () => {
    const providers = Object.values((providersConfigRaw as ProvidersConfig).providers)
    expect(projectEnv({ ANTHROPIC_WORKSPACE_ID: WS }, providers, [])).toEqual({ ANTHROPIC_WORKSPACE_ID: WS })
    expect(projectEnv({}, providers, [])).toEqual({})
  })
})
