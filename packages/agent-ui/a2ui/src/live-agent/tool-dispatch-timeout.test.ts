// @vitest-environment node
// tool-dispatch-timeout.test.ts: GH #1797 gap (b). The shared dispatch arms a per-call deadline
// (TOOL_CALL_TIMEOUT_MS) around every executor, so a tool that never settles cannot hang a turn. Driven by
// fake timers against the REAL constant; every executor is a local stub, no network, no live model.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildToolDispatch, TOOL_CALL_TIMEOUT_MS } from '../../tools/agent/integrations/tool-dispatch.ts'
import type { ExecuteContext, IntegrationManifest } from '../../tools/agent/integrations/registry.ts'

/** A minimal manifest whose executor is supplied by the test. */
function stubManifest(id: string, execute: IntegrationManifest['execute']): IntegrationManifest {
  return {
    id,
    version: '1.0.0',
    label: `Label ${id}`,
    description: `Test manifest ${id}.`,
    tool: {
      name: id,
      description: 'A test tool.',
      input_schema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] },
    },
    auth: 'none',
    execute,
  }
}

/** An executor that rejects with `reason(ctx)` once `ctx.signal` aborts, and otherwise never settles. */
function cooperative(reason: (ctx: ExecuteContext) => unknown, seen?: ExecuteContext[]): IntegrationManifest['execute'] {
  return (_input, ctx) => {
    seen?.push(ctx)
    return new Promise<string>((_resolve, reject) => {
      ctx.signal?.addEventListener('abort', () => reject(reason(ctx)), { once: true })
    })
  }
}

describe('buildToolDispatch: the per-call deadline (GH #1797 gap b)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects a non-cooperative executor at the deadline with a named Error', async () => {
    const m = stubManifest('hang-forever', () => new Promise<string>(() => {}))
    const { executeTool } = buildToolDispatch([m], {})
    let outcome: unknown
    const p = executeTool('hang-forever', { q: 'x' })
    void p.then(
      (v) => {
        outcome = v
      },
      (e: unknown) => {
        outcome = e
      },
    )

    await vi.advanceTimersByTimeAsync(TOOL_CALL_TIMEOUT_MS - 1)
    expect(outcome).toBeUndefined()

    await vi.advanceTimersByTimeAsync(1)
    expect(outcome).toBeInstanceOf(Error)
    expect((outcome as Error).message).toContain('hang-forever')
    expect((outcome as Error).message).toContain('tool call timed out after 30000 ms')
  })

  it('aborts ctx.signal at the deadline for a cooperative executor', async () => {
    const seen: ExecuteContext[] = []
    const m = stubManifest(
      'coop-deadline',
      cooperative((ctx) => ctx.signal?.reason, seen),
    )
    const { executeTool } = buildToolDispatch([m], {})
    let outcome: unknown
    void executeTool('coop-deadline', { q: 'x' }).then(
      (v) => {
        outcome = v
      },
      (e: unknown) => {
        outcome = e
      },
    )

    await vi.advanceTimersByTimeAsync(TOOL_CALL_TIMEOUT_MS)
    const signal = seen[0].signal
    expect(signal?.aborted).toBe(true)
    expect(signal?.reason).toBeInstanceOf(Error)
    expect((signal?.reason as Error).message).toContain('coop-deadline: tool call timed out after 30000 ms')
    expect(outcome).toBeInstanceOf(Error)
    expect((outcome as Error).message).toContain('tool call timed out after 30000 ms')
  })

  it('clears the deadline timer when a fast executor settles', async () => {
    const m = stubManifest('fast', async () => 'fast result')
    const { executeTool } = buildToolDispatch([m], {})
    await expect(executeTool('fast', { q: 'x' })).resolves.toBe('fast result')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not relabel an outer-signal abort as a timeout', async () => {
    const turn = new AbortController()
    const m = stubManifest(
      'turn-abort',
      cooperative(() => new Error('aborted by turn')),
    )
    const { executeTool } = buildToolDispatch([m], {}, turn.signal)
    let outcome: unknown
    void executeTool('turn-abort', { q: 'x' }).then(
      (v) => {
        outcome = v
      },
      (e: unknown) => {
        outcome = e
      },
    )

    await vi.advanceTimersByTimeAsync(TOOL_CALL_TIMEOUT_MS / 2)
    turn.abort()
    await vi.advanceTimersByTimeAsync(0)
    expect(outcome).toBeInstanceOf(Error)
    expect((outcome as Error).message).toBe('aborted by turn')
    expect((outcome as Error).message).not.toContain('timed out')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('still returns {} for zero active manifests', () => {
    expect(buildToolDispatch([], {})).toEqual({})
  })
})
