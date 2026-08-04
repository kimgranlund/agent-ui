// tool-dispatch.test.ts — LLD-C4's gate (SPEC-R17 AC2 / SPEC-R18 AC1): the ONE dispatch builder both hosts
// call. Deterministic — no key, no network, no live model: every executor here is a local stub that RECORDS
// what it was handed, so "did the validator stop this before integration code saw it" and "did the signal
// actually arrive" are read off recorded calls rather than inferred.
//
// Nothing in this file registers a manifest. `buildToolDispatch` takes an already-resolved plain list (the
// browser-list validation is `resolveIntegrations`' job, gated in registry.test.ts), so these fixtures never
// touch the module-global registry and can never collide with another test file's ids.
import { describe, it, expect } from 'vitest'
import { buildToolDispatch } from './tool-dispatch.ts'
import type { ExecuteContext, IntegrationManifest } from './registry.ts'

const NO_ENV: Record<string, string | undefined> = {}

type RecordedCall = { input: Record<string, unknown>; ctx: ExecuteContext }

/** A manifest whose executor records instead of running. `q` is a REQUIRED string and `n` an optional
 *  integer, so one fixture covers both validator failure modes (missing required + wrong type). */
function stubManifest(
  id: string,
  overrides: Partial<IntegrationManifest> = {},
): IntegrationManifest & { calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  return {
    id,
    version: '1.0.0',
    label: `Label ${id}`,
    description: `Test manifest ${id}.`,
    tool: {
      name: id,
      description: 'A test tool.',
      input_schema: {
        type: 'object',
        properties: { q: { type: 'string' }, n: { type: 'integer' } },
        required: ['q'],
      },
    },
    auth: 'none',
    execute: async (input, ctx) => {
      calls.push({ input, ctx })
      return `ran ${id}`
    },
    calls,
    ...overrides,
  }
}

describe('buildToolDispatch — the empty case (the byte-identical-request posture)', () => {
  it('returns a bare {} for zero active manifests — no tools, no executeTool', () => {
    const built = buildToolDispatch([], NO_ENV)
    expect(built).toEqual({})
    expect(Object.keys(built)).toEqual([])
    // The load-bearing detail: both hosts SPREAD this into produce()'s options, so the keys must be ABSENT
    // (an explicit `tools: undefined` would still reach the adapter as a declared-but-empty tool surface).
    expect('tools' in built).toBe(false)
    expect('executeTool' in built).toBe(false)
  })

  it('still returns {} when a turn signal is supplied but nothing is enabled', () => {
    expect(buildToolDispatch([], NO_ENV, new AbortController().signal)).toEqual({})
  })
})

describe('buildToolDispatch — the declared tool surface (SPEC-R16)', () => {
  it('maps each active manifest to its own ToolDef, 1:1 and in order', () => {
    const a = stubManifest('map-a')
    const b = stubManifest('map-b')
    const built = buildToolDispatch([a, b], NO_ENV)
    expect(built.tools).toHaveLength(2)
    expect(built.tools[0]).toBe(a.tool)
    expect(built.tools[1]).toBe(b.tool)
    expect(typeof built.executeTool).toBe('function')
  })

  it('declares ONLY the ToolDef to the model — no version, label, or envKey crosses the wire', () => {
    const keyed = stubManifest('map-keyed', { auth: 'serverKey', envKey: 'FAKE_DISPATCH_KEY' })
    const built = buildToolDispatch([keyed], { FAKE_DISPATCH_KEY: 'not-a-real-key' })
    const declared = JSON.stringify(built.tools)
    expect(declared).not.toContain('Label map-keyed') // the human label (ADR-0168 cl.2)
    expect(declared).not.toContain('1.0.0') // the manifest version (ADR-0168 cl.1: never sent to the model)
    expect(declared).not.toContain('FAKE_DISPATCH_KEY') // the env-var NAME
    expect(declared).not.toContain('not-a-real-key') // and least of all its value
  })
})

describe('buildToolDispatch — executeTool routing', () => {
  it('routes on the WIRE name (tool.name), not the registry id', async () => {
    const m = stubManifest('route-id', { tool: { name: 'route_wire_name', description: 'x', input_schema: { type: 'object' } } })
    const { executeTool } = buildToolDispatch([m], NO_ENV)
    await expect(executeTool('route_wire_name', {})).resolves.toBe('ran route-id')
    await expect(executeTool('route-id', {})).rejects.toThrow('unknown tool route-id')
  })

  it('throws `unknown tool X` for a name no active manifest declares', async () => {
    const { executeTool } = buildToolDispatch([stubManifest('known')], NO_ENV)
    await expect(executeTool('nope', { q: 'x' })).rejects.toThrow('unknown tool nope')
  })

  it('hands a valid input straight through to the executor', async () => {
    const m = stubManifest('valid-call')
    const { executeTool } = buildToolDispatch([m], NO_ENV)
    await expect(executeTool('valid-call', { q: 'helsinki', n: 3 })).resolves.toBe('ran valid-call')
    expect(m.calls).toHaveLength(1)
    expect(m.calls[0].input).toEqual({ q: 'helsinki', n: 3 })
    // The ExecuteContext is always a real object with both seam fields present, even when both are empty —
    // an executor may read either without a shape check.
    expect('signal' in m.calls[0].ctx).toBe(true)
    expect('apiKey' in m.calls[0].ctx).toBe(true)
    expect(m.calls[0].ctx.signal).toBeUndefined()
  })
})

describe('buildToolDispatch — dispatch-time input validation (SPEC-R17 AC2)', () => {
  it('rejects a missing required field BEFORE the executor runs, naming the tool and the field', async () => {
    const m = stubManifest('bad-missing')
    const { executeTool } = buildToolDispatch([m], NO_ENV)
    const error = await executeTool('bad-missing', { n: 3 }).then(
      () => undefined,
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(Error)
    expect(String(error)).toContain('bad-missing') // the TOOL
    expect(String(error)).toContain('`q` is required') // the FAILING FIELD
    expect(m.calls).toEqual([]) // integration code never saw the malformed input
  })

  it('rejects a wrong-typed field and names every failing field in one message', async () => {
    const m = stubManifest('bad-typed')
    const { executeTool } = buildToolDispatch([m], NO_ENV)
    const error = await executeTool('bad-typed', { n: 'three' }).then(
      () => undefined,
      (e: unknown) => e,
    )
    expect(String(error)).toContain('bad-typed')
    expect(String(error)).toContain('`q` is required')
    expect(String(error)).toContain('`n` must be an integer')
    expect(m.calls).toEqual([])
  })

  it('permits undeclared extra properties (JSON Schema default; ADR-0168 cl.3)', async () => {
    const m = stubManifest('extra-props')
    const { executeTool } = buildToolDispatch([m], NO_ENV)
    await expect(executeTool('extra-props', { q: 'x', unexpected: true })).resolves.toBe('ran extra-props')
    expect(m.calls[0].input).toEqual({ q: 'x', unexpected: true })
  })
})

describe('buildToolDispatch — abort propagation', () => {
  it('threads the builder-level turn signal to ctx.signal', async () => {
    const turn = new AbortController()
    const m = stubManifest('sig-turn')
    const { executeTool } = buildToolDispatch([m], NO_ENV, turn.signal)
    await executeTool('sig-turn', { q: 'x' })
    expect(m.calls[0].ctx.signal).toBe(turn.signal)
  })

  it('hands the executor the LIVE signal, not a copy — aborting the turn flips ctx.signal.aborted', async () => {
    const turn = new AbortController()
    const m = stubManifest('sig-live')
    const { executeTool } = buildToolDispatch([m], NO_ENV, turn.signal)
    await executeTool('sig-live', { q: 'x' })
    const { ctx } = m.calls[0]
    expect(ctx.signal?.aborted).toBe(false)
    turn.abort()
    expect(ctx.signal?.aborted).toBe(true) // the same AbortSignal object the host owns
  })

  it('an executor reading ctx.signal at call time sees an already-aborted turn', async () => {
    const turn = new AbortController()
    turn.abort()
    let seenAborted: boolean | undefined
    const m = stubManifest('sig-read', {
      execute: async (_input, ctx) => {
        seenAborted = ctx.signal?.aborted
        return 'ok'
      },
    })
    const { executeTool } = buildToolDispatch([m], NO_ENV, turn.signal)
    await executeTool('sig-read', { q: 'x' })
    expect(seenAborted).toBe(true)
  })

  it("prefers the adapter's per-call signal over the builder-level one, which is the fallback", async () => {
    const turn = new AbortController()
    const perCall = new AbortController()
    const m = stubManifest('sig-priority')
    const { executeTool } = buildToolDispatch([m], NO_ENV, turn.signal)

    await executeTool('sig-priority', { q: 'x' }, perCall.signal)
    expect(m.calls[0].ctx.signal).toBe(perCall.signal)

    await executeTool('sig-priority', { q: 'x' }) // no per-call signal ⇒ the turn signal carries
    expect(m.calls[1].ctx.signal).toBe(turn.signal)
  })

  it('carries the per-call signal even when the builder was given none (the dev-proxy route today)', async () => {
    const perCall = new AbortController()
    const m = stubManifest('sig-percall-only')
    const { executeTool } = buildToolDispatch([m], NO_ENV)
    await executeTool('sig-percall-only', { q: 'x' }, perCall.signal)
    expect(m.calls[0].ctx.signal).toBe(perCall.signal)
  })
})

describe('buildToolDispatch — the keyed seam (SPEC-R18)', () => {
  it('resolves a serverKey manifest’s env var to ctx.apiKey at dispatch time', async () => {
    const m = stubManifest('key-provisioned', { auth: 'serverKey', envKey: 'FAKE_DISPATCH_KEY' })
    const { executeTool } = buildToolDispatch([m], { FAKE_DISPATCH_KEY: 'not-a-real-key' })
    await executeTool('key-provisioned', { q: 'x' })
    expect(m.calls[0].ctx.apiKey).toBe('not-a-real-key')
  })

  it('never hands a key to a keyless manifest sharing the same env', async () => {
    const keyless = stubManifest('key-none')
    const { executeTool } = buildToolDispatch([keyless], { FAKE_DISPATCH_KEY: 'not-a-real-key' })
    await executeTool('key-none', { q: 'x' })
    expect(keyless.calls[0].ctx.apiKey).toBeUndefined()
  })

  it('leaves ctx.apiKey undefined for a keyed manifest whose var is unset (resolveIntegrations excludes it first)', async () => {
    const m = stubManifest('key-unset', { auth: 'serverKey', envKey: 'FAKE_MISSING_KEY' })
    const { executeTool } = buildToolDispatch([m], NO_ENV)
    await executeTool('key-unset', { q: 'x' })
    expect(m.calls[0].ctx.apiKey).toBeUndefined()
  })
})
