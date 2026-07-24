// admin-live-runner.test.ts — ALM-C7 (TKT-0052/ADR-0136): createAdminAgentTurn's fetch-boundary legs.
// `fetch` is stubbed (no real network, no key) — the feed-live-transport.test.ts stub-fetch precedent.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAdminAgentTurn, createAdminSurfaceTurn } from './admin-live-runner.ts'
import type { AdminTurnRequest, AdminSurfaceTurnRequest } from '@agent-ui/app/agent-admin-schema'
import { formatErrorLine } from '../../packages/agent-ui/a2ui/src/agent/meta-line.ts'

const REQUEST: AdminTurnRequest = { text: 'hi', system: 'be helpful', model: 'claude-sonnet-5', history: [] }

const SURFACE_REQUEST: AdminSurfaceTurnRequest = {
  turn: { kind: 'intent', text: "Let's begin the game." },
  personaSystem: 'You are The Admiral.',
  model: 'claude-sonnet-5',
}

function streamOfLines(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < lines.length) {
        controller.enqueue(encoder.encode(lines[i] + '\n'))
        i += 1
      } else {
        controller.close()
      }
    },
  })
}

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

// GH #144: the SURFACE-turn runner's fetch-boundary legs — a 200/ndjson response whose stream carries a
// transport-composed `error` meta-line (worker/index.ts / dev-proxy-plugin.ts, after produce() halts or
// faults mid-loop with headers already committed) must surface as a THROWN, visible failure — never a
// generator that completes normally with an empty line list (the reported "HTTP 200, lines: [], nothing
// shown" symptom).
describe('createAdminSurfaceTurn', () => {
  it('yields validated wire lines and the peeled note on a well-shaped stream', async () => {
    const lines = [
      '{"a2uiMeta":{"note":"Firing up the fleet."}}',
      '{"version":"v1.0","createSurface":{"surfaceId":"s1","catalogId":"agent-ui"}}',
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(streamOfLines(lines), { status: 200, headers: { 'content-type': 'application/x-ndjson' } })),
    )
    const runner = createAdminSurfaceTurn()
    const events: string[] = []
    for await (const event of runner(SURFACE_REQUEST)) events.push(event.kind)
    expect(events).toEqual(['note', 'line'])
  })

  it("requests the per-step raw-source attachment: the POST body carries progressDetail:'source' (GH #240/ADR-0159 wave B — the admin developer surface's standing opt-in)", async () => {
    const fetchSpy = vi.fn(
      async () => new Response(streamOfLines([]), { status: 200, headers: { 'content-type': 'application/x-ndjson' } }),
    )
    vi.stubGlobal('fetch', fetchSpy)
    const runner = createAdminSurfaceTurn()
    for await (const _event of runner(SURFACE_REQUEST)) {
      /* drain */
    }
    const init = (fetchSpy.mock.calls[0] as unknown[])[1] as { body: string }
    const body = JSON.parse(init.body) as Record<string, unknown>
    expect(body.progressDetail, "the server-validated 'source' rung — never 'full' (CoT stays server-owned)").toBe('source')
  })

  it("a progress event's source attachment rides the progress event to the consumer (byte compare through the meta filter)", async () => {
    const raw = '{"version":"v1.0","createSurface":{"surfaceId":"s1","catalogId":"agent-ui"}}'
    const lines = [
      JSON.stringify({ a2uiMeta: { progress: { stage: 'validating', source: raw } } }),
      raw,
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(streamOfLines(lines), { status: 200, headers: { 'content-type': 'application/x-ndjson' } })),
    )
    const runner = createAdminSurfaceTurn()
    const progress: unknown[] = []
    for await (const event of runner(SURFACE_REQUEST)) {
      if (event.kind === 'progress') progress.push(event.progress)
    }
    expect(progress).toEqual([{ stage: 'validating', source: raw }])
  })

  it('throws a visible error when the stream carries a transport-composed error meta-line (GH #144 — was a silent empty success)', async () => {
    const lines = [
      '{"a2uiMeta":{"progress":{"stage":"retry","round":3}}}',
      formatErrorLine('produce: no valid surface within the round bound (SCHEMA)'),
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(streamOfLines(lines), { status: 200, headers: { 'content-type': 'application/x-ndjson' } })),
    )
    const runner = createAdminSurfaceTurn()
    await expect(
      (async () => {
        for await (const _event of runner(SURFACE_REQUEST)) {
          /* drain */
        }
      })(),
    ).rejects.toThrow(/produce: no valid surface within the round bound \(SCHEMA\)/)
  })

  it('a non-2xx response throws (never yields a partial)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'no-key' }), { status: 503 })))
    const runner = createAdminSurfaceTurn()
    await expect(
      (async () => {
        for await (const _event of runner(SURFACE_REQUEST)) {
          /* drain */
        }
      })(),
    ).rejects.toThrow(/503/)
  })
})
