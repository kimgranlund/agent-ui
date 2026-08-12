// admin-live-runner.test.ts — ALM-C7 (TKT-0052/ADR-0136): createAdminAgentTurn's fetch-boundary legs.
// `fetch` is stubbed (no real network, no key) — the feed-live-transport.test.ts stub-fetch precedent.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAdminAgentTurn, createAdminSurfaceTurn, fetchLiveIntegrations, fetchLiveServices } from './admin-live-runner.ts'
import type { AdminTurnRequest, AdminSurfaceTurnRequest, AdminSurfaceTurnEvent } from '@agent-ui/app/agent-admin-schema'
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

  // ADR-0168 cl.5 / SPEC-R19 AC2 (GH #402) — the prose arm's enablement reaches the `/chat` POST body,
  // the same additive-optional-field discipline `effort` already proves on this exact call.
  it('forwards the enabled tool ids into the /chat POST body', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ text: 'ok' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const turn = createAdminAgentTurn()
    await turn({ ...REQUEST, integrations: ['weather', 'currency'] })
    const init = (fetchSpy.mock.calls[0] as unknown[])[1] as { body: string }
    const body = JSON.parse(init.body) as Record<string, unknown>
    expect(body['integrations']).toEqual(['weather', 'currency'])
  })

  it('omits the key entirely when the request carries no integrations (byte-identical to the pre-amendment body)', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ text: 'ok' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const turn = createAdminAgentTurn()
    await turn(REQUEST)
    const init = (fetchSpy.mock.calls[0] as unknown[])[1] as { body: string }
    const body = JSON.parse(init.body) as Record<string, unknown>
    expect('integrations' in body).toBe(false)
    // The WHOLE body, not just the absent key: `effort` is undefined here too, so this is exactly the
    // shape the route saw before SPEC-R19 existed.
    expect(Object.keys(body).sort()).toEqual(['messages', 'model', 'system'])
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

// genui-surface.spec.md SPEC-R1/R10/R11 (B2) — the runner threads `req.genui` into the POST body and maps
// a genui wire line into a `{kind:'genui'}` event; never a live model dependency (the stub-fetch precedent).
describe('createAdminSurfaceTurn — genui-surface B2', () => {
  it('threads req.genui verbatim into the POST body', async () => {
    const fetchSpy = vi.fn(
      async () => new Response(streamOfLines([]), { status: 200, headers: { 'content-type': 'application/x-ndjson' } }),
    )
    vi.stubGlobal('fetch', fetchSpy)
    const runner = createAdminSurfaceTurn()
    const req: AdminSurfaceTurnRequest = { ...SURFACE_REQUEST, genui: { enabled: true, sourceBody: 'exemplar body' } }
    for await (const _event of runner(req)) {
      /* drain */
    }
    const init = (fetchSpy.mock.calls[0] as unknown[])[1] as { body: string }
    const body = JSON.parse(init.body) as Record<string, unknown>
    expect(body.genui).toEqual({ enabled: true, sourceBody: 'exemplar body' })
  })

  it('a genui wire line maps to a {kind:"genui", surfaceId, html} event — never ingested as A2UI content (kind:"line")', async () => {
    const lines = [
      '{"a2uiMeta":{"note":"here you go"}}',
      '{"genui":{"surfaceId":"q3-revenue","html":"<p>chart</p>"}}',
      '{"version":"v1.0","createSurface":{"surfaceId":"s1","catalogId":"agent-ui"}}',
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(streamOfLines(lines), { status: 200, headers: { 'content-type': 'application/x-ndjson' } })),
    )
    const runner = createAdminSurfaceTurn()
    const events: Array<{ kind: string; surfaceId?: string; html?: string }> = []
    for await (const event of runner(SURFACE_REQUEST)) events.push(event)
    expect(events.map((e) => e.kind)).toEqual(['note', 'genui', 'line'])
    expect(events[1]).toEqual({ kind: 'genui', surfaceId: 'q3-revenue', html: '<p>chart</p>' })
  })

  // genui-surface.spec.md SPEC-R8 AC2 — the REAL crash site an independent review caught live:
  // admin-live-runner.ts's OWN `nextTurn(session, req.turn.message as ...)` (line ~96) and
  // `frameClientMessage(req.turn.message as ...)` (line ~174) — a `kind:'client'` turn whose `message` is
  // a genuiAction (never an A2uiClientMessage) previously threw INSIDE this exact runner, before the
  // fetch even fires. This drives the REAL runner (not a stub that stops at the transport boundary) with
  // a genuine `{kind:'client', message:{genuiAction:...}}` request — the fix's regression proof.
  it('a genuiAction client turn ({kind:"client", message:{genuiAction}}) never throws inside the runner, and the POST body carries the framed text', async () => {
    const fetchSpy = vi.fn(
      async () => new Response(streamOfLines(['{"a2uiMeta":{"note":"thanks for the rating"}}']), { status: 200, headers: { 'content-type': 'application/x-ndjson' } }),
    )
    vi.stubGlobal('fetch', fetchSpy)
    const runner = createAdminSurfaceTurn()
    const genuiActionReq: AdminSurfaceTurnRequest = {
      ...SURFACE_REQUEST,
      turn: { kind: 'client', message: { genuiAction: { surfaceId: 'widget', name: 'rate', payload: { stars: 5 } } } },
    }
    const events: string[] = []
    // No try/catch, no `expect(fn).not.toThrow()` wrapper (which never actually awaits an async callback's
    // rejection — a real footgun this test avoids): if the runner throws, this `for await` rejects the
    // enclosing test function directly, failing the test with the real error — the honest reproduction of
    // the crash the review caught (a silently-swallowed assertion here would defeat the whole regression
    // test's purpose).
    for await (const event of runner(genuiActionReq)) events.push(event.kind)
    expect(events).toEqual(['note'])
    const init = (fetchSpy.mock.calls[0] as unknown[])[1] as { body: string }
    const body = JSON.parse(init.body) as { input: { kind: string; message: unknown } }
    // The runner framed the REAL TurnInput (produce()'s own `input`, carrying the raw message unframed —
    // frameClientMessage runs SERVER-side inside produce()'s queryOf); this proves the runner itself never
    // threw building that request, the client-side half of the crash.
    expect(body.input.kind).toBe('client')
    expect(body.input.message).toEqual({ genuiAction: { surfaceId: 'widget', name: 'rate', payload: { stars: 5 } } })
  })
})

// The Effort picker's wiring for SURFACE (GenUI/A2UI) turns: `AdminSurfaceTurnRequest.effort` reaches the
// `PRODUCE_ENDPOINT` POST body, mirroring the plain-chat arm's already-correct `AdminTurnRequest.effort`
// (createAdminAgentTurn, above) and `live-proxy-transport.ts`'s SAME additive-optional-field precedent
// (`sel.effort`) — absent ⇒ no `effort` key at all, present ⇒ threaded verbatim.
describe('createAdminSurfaceTurn — effort threading (the Effort picker reaching structured/surface turns)', () => {
  it('omits `effort` from the POST body when the request carries none (byte-identical to before this field existed)', async () => {
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
    expect('effort' in body).toBe(false)
  })

  it('threads a real `effort` value from the request into the actual POST body (not just the type)', async () => {
    const fetchSpy = vi.fn(
      async () => new Response(streamOfLines([]), { status: 200, headers: { 'content-type': 'application/x-ndjson' } }),
    )
    vi.stubGlobal('fetch', fetchSpy)
    const runner = createAdminSurfaceTurn()
    const req: AdminSurfaceTurnRequest = { ...SURFACE_REQUEST, effort: 'high' }
    for await (const _event of runner(req)) {
      /* drain */
    }
    const init = (fetchSpy.mock.calls[0] as unknown[])[1] as { body: string }
    const body = JSON.parse(init.body) as Record<string, unknown>
    expect(body.effort).toBe('high')
    expect(body.model).toBe('claude-sonnet-5')
  })
})

// ── GH #567 S6 (LLD-C6/SPEC-R28, Kim's F1 ruling) — fetchLiveIntegrations' fetch-boundary legs ──────────

describe('fetchLiveIntegrations', () => {
  it('resolves the served trios on a well-shaped 200', async () => {
    const served = [
      { id: 'weather', label: 'Weather (Open-Meteo)', description: 'Current conditions. Keyless.' },
      { id: 'mcp:acme:lookup', label: 'Acme: lookup', description: 'A discovered MCP tool.' },
    ]
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      expect(url).toBe('/__a2ui/agent/integrations')
      return new Response(JSON.stringify({ integrations: served }), { status: 200 })
    }))
    await expect(fetchLiveIntegrations()).resolves.toEqual(served)
  })

  it('degrades to undefined on a non-2xx response (no proxy / production build)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })))
    await expect(fetchLiveIntegrations()).resolves.toBeUndefined()
  })

  it('degrades to undefined on a network failure — never a thrown turn', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    await expect(fetchLiveIntegrations()).resolves.toBeUndefined()
  })

  it('degrades to undefined on a malformed body (non-array, or a row missing a trio field)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ integrations: 'not-an-array' }), { status: 200 })))
    await expect(fetchLiveIntegrations()).resolves.toBeUndefined()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ integrations: [{ id: 'x', label: 'X' }] }), { status: 200 })))
    await expect(fetchLiveIntegrations()).resolves.toBeUndefined()
  })

  it('an empty roster\'s response (the hand-authored-only trios) resolves as a normal, non-empty array — never mistaken for "unavailable"', async () => {
    const handAuthored = [
      { id: 'weather', label: 'Weather (Open-Meteo)', description: 'Current conditions. Keyless.' },
      { id: 'wikipedia-search', label: 'Wikipedia search', description: 'Search Wikipedia and return the top results with one-line summaries. Keyless.' },
      { id: 'currency', label: 'Currency rates (Frankfurter)', description: 'Convert an amount between currencies at the latest ECB reference rates. Keyless.' },
    ]
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ integrations: handAuthored }), { status: 200 })))
    await expect(fetchLiveIntegrations()).resolves.toEqual(handAuthored)
  })
})

// ── GH #783 S4 (LLD-C6/SPEC-R4/R5, ADR-0185) — fetchLiveServices' fetch-boundary legs ────────────────────
// The sibling of fetchLiveIntegrations above, reading the SECOND, additive `services` array off the SAME
// `GET /integrations` body (S2). Same degrade-to-`undefined` law, one extra rung: a body with NO `services`
// key at all (a pre-S2 proxy) degrades too, so an old proxy + new page is safe.
describe('fetchLiveServices', () => {
  it('resolves the served service rows (body.services) on a well-shaped 200', async () => {
    const services = [
      { id: 'mcp:calc:*', label: 'Calc server', description: '2 tools discovered at boot' },
      { id: 'mcp:notes:*', label: 'Notes server', description: '1 tool discovered at boot' },
    ]
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      expect(url).toBe('/__a2ui/agent/integrations')
      return new Response(JSON.stringify({ integrations: [], services }), { status: 200 })
    }))
    await expect(fetchLiveServices()).resolves.toEqual(services)
  })

  it('an empty roster\'s response (services: []) resolves as an empty array, NOT undefined — "no live servers" is not "unavailable" (SPEC-R4 AC2)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ integrations: [], services: [] }), { status: 200 })))
    await expect(fetchLiveServices()).resolves.toEqual([])
  })

  it('degrades to undefined on a non-2xx response (no proxy / production build)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })))
    await expect(fetchLiveServices()).resolves.toBeUndefined()
  })

  it('degrades to undefined on a network failure — never a thrown turn', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    await expect(fetchLiveServices()).resolves.toBeUndefined()
  })

  it('degrades to undefined on a body with NO services key (a pre-S2 proxy) — old proxy + new page is safe', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ integrations: [] }), { status: 200 })))
    await expect(fetchLiveServices()).resolves.toBeUndefined()
  })

  it('degrades to undefined on a malformed services array (non-array, or a row missing a trio field)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ services: 'not-an-array' }), { status: 200 })))
    await expect(fetchLiveServices()).resolves.toBeUndefined()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ services: [{ id: 'mcp:calc:*', label: 'Calc' }] }), { status: 200 })))
    await expect(fetchLiveServices()).resolves.toBeUndefined()
  })
})

// ADR-0178 cl.2/cl.5 / SPEC-R29/R30 (LLD `agent-authoring-flow.lld.md` §4, LLD-C4) — the runner's S3
// widening: the personaPatch peel, the conditional `authoring` POST key, and one producer Session PER
// CONTEXT. Same stub-fetch discipline as every block above; no live model anywhere.
describe('createAdminSurfaceTurn — the guided-authoring widening (LLD-C4)', () => {
  const PATCH = { values: { name: 'Concierge' }, entries: { 'entries:skill': [{ label: 'Book a table' }] } }

  it('peels a declared personaPatch into its own typed event, alongside the note on the same meta-line', async () => {
    const lines = [JSON.stringify({ a2uiMeta: { note: 'Noted.', personaPatch: PATCH } })]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(streamOfLines(lines), { status: 200, headers: { 'content-type': 'application/x-ndjson' } })),
    )
    const runner = createAdminSurfaceTurn()
    const events: AdminSurfaceTurnEvent[] = []
    for await (const event of runner(SURFACE_REQUEST)) events.push(event)
    expect(events.map((e) => e.kind)).toEqual(['note', 'patch'])
    expect(events.find((e) => e.kind === 'patch')).toEqual({ kind: 'patch', patch: PATCH })
  })

  it('the peel is GATE-BLIND: a request carrying no `authoring` flag still yields the patch event', async () => {
    // The load-bearing half of the runner/component division: enforcement lives in ONE place (the
    // component's conjunctive consumption condition), so this layer must not quietly add a second.
    const lines = [JSON.stringify({ a2uiMeta: { personaPatch: PATCH } })]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(streamOfLines(lines), { status: 200, headers: { 'content-type': 'application/x-ndjson' } })),
    )
    const runner = createAdminSurfaceTurn()
    const kinds: string[] = []
    for await (const event of runner({ ...SURFACE_REQUEST, authoring: undefined })) kinds.push(event.kind)
    expect(kinds).toEqual(['patch'])
  })

  it('threads `authoring` onto the POST body when set, and omits the key entirely when absent', async () => {
    const bodyOf = async (req: AdminSurfaceTurnRequest): Promise<Record<string, unknown>> => {
      const fetchSpy = vi.fn(
        async () => new Response(streamOfLines([]), { status: 200, headers: { 'content-type': 'application/x-ndjson' } }),
      )
      vi.stubGlobal('fetch', fetchSpy)
      for await (const _event of createAdminSurfaceTurn()(req)) {
        /* drain */
      }
      const init = (fetchSpy.mock.calls[0] as unknown[])[1] as { body: string }
      return JSON.parse(init.body) as Record<string, unknown>
    }
    expect((await bodyOf({ ...SURFACE_REQUEST, authoring: true })).authoring).toBe(true)
    expect((await bodyOf({ ...SURFACE_REQUEST, authoring: false })).authoring).toBe(false)
    // byte-compat: a turn that never mentions authoring builds the SAME body it did before S3
    expect('authoring' in (await bodyOf(SURFACE_REQUEST))).toBe(false)
  })

  it('keeps ONE session per context — two `session` values build disjoint histories', async () => {
    // Without this, the Builder interview would be replayed to the draft as the draft's own memory.
    const bodies: Record<string, unknown>[] = []
    const fetchSpy = vi.fn(async (_url: unknown, init: unknown) => {
      bodies.push(JSON.parse((init as { body: string }).body) as Record<string, unknown>)
      return new Response(streamOfLines(['{"version":"v1.0","createSurface":{"surfaceId":"s1","catalogId":"agent-ui"}}']), {
        status: 200,
        headers: { 'content-type': 'application/x-ndjson' },
      })
    })
    vi.stubGlobal('fetch', fetchSpy)
    const runner = createAdminSurfaceTurn()
    const run = async (text: string, session: 'authoring' | 'test'): Promise<void> => {
      for await (const _event of runner({ ...SURFACE_REQUEST, session, turn: { kind: 'intent', text } })) {
        /* drain */
      }
    }
    await run('authoring one', 'authoring')
    await run('test one', 'test')
    await run('authoring two', 'authoring')

    const turnsOf = (body: Record<string, unknown>): unknown[] => ((body.input as { session?: { turns?: unknown[] } }).session?.turns ?? [])
    expect(turnsOf(bodies[0]!)).toEqual([]) // both contexts start empty
    expect(turnsOf(bodies[1]!)).toEqual([])
    // the third turn sees ONLY the authoring context's own prior exchange — never the test chat's
    const third = JSON.stringify(turnsOf(bodies[2]!))
    expect(third).toContain('authoring one')
    expect(third).not.toContain('test one')
  })

  it('ADR-0182: peels a declared plan into its own typed event, alongside the note on the same meta-line', async () => {
    const PLAN = { steps: [{ id: 'model', description: 'Choose a model' }] }
    const lines = [JSON.stringify({ a2uiMeta: { note: 'Next: pick a model.', plan: PLAN } })]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(streamOfLines(lines), { status: 200, headers: { 'content-type': 'application/x-ndjson' } })),
    )
    const runner = createAdminSurfaceTurn()
    const events: AdminSurfaceTurnEvent[] = []
    for await (const event of runner(SURFACE_REQUEST)) events.push(event)
    expect(events.map((e) => e.kind)).toEqual(['note', 'plan'])
    expect(events.find((e) => e.kind === 'plan')).toEqual({ kind: 'plan', plan: PLAN })
  })

  it('ADR-0182 cl.1: derives `builderMission` from `session` — true only for the authoring context, sent unconditionally (never omitted)', async () => {
    const bodyOf = async (session: 'authoring' | 'test' | undefined): Promise<Record<string, unknown>> => {
      const fetchSpy = vi.fn(
        async () => new Response(streamOfLines([]), { status: 200, headers: { 'content-type': 'application/x-ndjson' } }),
      )
      vi.stubGlobal('fetch', fetchSpy)
      for await (const _event of createAdminSurfaceTurn()({ ...SURFACE_REQUEST, session })) {
        /* drain */
      }
      const init = (fetchSpy.mock.calls[0] as unknown[])[1] as { body: string }
      return JSON.parse(init.body) as Record<string, unknown>
    }
    expect((await bodyOf('authoring')).builderMission).toBe(true)
    expect((await bodyOf('test')).builderMission).toBe(false)
    // absent `session` defaults to the 'test' slot (the existing law above) — same false derivation
    expect((await bodyOf(undefined)).builderMission).toBe(false)
  })

  it('defaults an absent `session` to the ONE history every pre-authoring caller already had', async () => {
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init: unknown) => {
        bodies.push(JSON.parse((init as { body: string }).body) as Record<string, unknown>)
        return new Response(streamOfLines(['{"version":"v1.0","createSurface":{"surfaceId":"s1","catalogId":"agent-ui"}}']), {
          status: 200,
          headers: { 'content-type': 'application/x-ndjson' },
        })
      }),
    )
    const runner = createAdminSurfaceTurn()
    for await (const _e of runner({ ...SURFACE_REQUEST, turn: { kind: 'intent', text: 'first' } })) {
      /* drain */
    }
    for await (const _e of runner({ ...SURFACE_REQUEST, session: 'test', turn: { kind: 'intent', text: 'second' } })) {
      /* drain */
    }
    // absent and explicit-'test' are the SAME slot — the second turn replays the first
    expect(JSON.stringify((bodies[1]!.input as { session?: unknown }).session)).toContain('first')
  })
})
