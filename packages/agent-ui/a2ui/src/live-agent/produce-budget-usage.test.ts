// produce-budget-usage.test.ts: ADR-0234 (proposed). `produce()` attaches the per-turn prompt budget
// report (`TurnTrace.prompt`) and the provider-billed token usage summed over the turn (`TurnTrace.usage`),
// and the opt-in `promptBudget: {mode: 'halt'}` stops an over-budget prompt before any provider call.
// Stub providers only (no live model). Every stub output leads with a note meta-line, because the trace
// ships only on a meta-line with a note or ask.

import { describe, it, expect } from 'vitest'
import { produce, ProduceHalt } from '../agent/produce.ts'
import type { ProduceDeps, ProduceOptions } from '../agent/produce.ts'
import type { AgentProvider, ProviderEvent, TurnInput } from '../agent/agent-transport.ts'
import { readMetaLine } from '../agent/meta-line.ts'
import type { TokenUsage, TurnTrace } from '../agent/meta-line.ts'
import { promptBudgetFor } from '../agent/prompt-budget.ts'
import { defaultCatalog } from '../catalog/default/index.ts'

const NOTE = '{"a2uiMeta":{"note":"here you go"}}\n'
// An UNKNOWN component: CATALOG-invalid, so the loop self-corrects.
const INVALID =
  NOTE +
  '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
  '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"NotARealComponent"}]}}'
const VALID =
  NOTE +
  '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
  '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Button","label":"Hi","action":{"action":"submit"}}]}}'

const intent: TurnInput = { kind: 'intent', text: 'a submit button', session: { turns: [] } }

/** One stream call per entry of `rounds`: emits that round's usage events, then yields its output. */
function usageStub(rounds: { out: string; usage?: TokenUsage[] }[]): {
  provider: AgentProvider
  calls: () => number
  systems: () => string[]
} {
  let n = 0
  const systems: string[] = []
  const provider: AgentProvider = {
    async *stream(req) {
      systems.push(req.system)
      const r = rounds[Math.min(n, rounds.length - 1)]!
      n += 1
      req.onEvent?.({ kind: 'message_start' })
      yield r.out
      for (const u of r.usage ?? []) req.onEvent?.({ kind: 'usage', usage: u } satisfies ProviderEvent)
      req.onEvent?.({ kind: 'done' })
    },
  }
  return { provider, calls: () => n, systems: () => systems }
}

async function run(provider: AgentProvider, opts: Partial<ProduceOptions> = {}): Promise<string[]> {
  const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
  const lines: string[] = []
  for await (const line of produce(intent, deps, { maxRounds: 3, ...opts })) lines.push(line)
  return lines
}

function traceOf(lines: string[]): TurnTrace {
  const trace = lines.map((l) => readMetaLine(l)?.a2uiMeta.trace).find((t) => t !== undefined)
  expect(trace).toBeDefined()
  return trace!
}

describe('produce() token usage on the trace (ADR-0234)', () => {
  it('(a) one usage event per stream call over three rounds (invalid, invalid, valid) sums into trace.usage', async () => {
    const { provider, calls } = usageStub([
      { out: INVALID, usage: [{ inputTokens: 100, outputTokens: 10 }] },
      { out: INVALID, usage: [{ inputTokens: 200, outputTokens: 20, cacheReadInputTokens: 50 }] },
      { out: VALID, usage: [{ inputTokens: 300, outputTokens: 30 }] },
    ])
    const trace = traceOf(await run(provider))
    expect(calls()).toBe(3)
    expect(trace.rounds).toBe(3)
    // The cache field appears on the sum because one event carried it; the creation field never did.
    expect(trace.usage).toEqual({ inputTokens: 600, outputTokens: 60, cacheReadInputTokens: 50 })
    expect(trace.usage).not.toHaveProperty('cacheCreationInputTokens')
  })

  it('(b) two usage events inside one stream call (an adapter tool loop) are both summed', async () => {
    const { provider, calls } = usageStub([
      {
        out: VALID,
        usage: [
          { inputTokens: 1000, outputTokens: 40, cacheCreationInputTokens: 500 },
          { inputTokens: 1100, outputTokens: 60, cacheCreationInputTokens: 0, cacheReadInputTokens: 500 },
        ],
      },
    ])
    const trace = traceOf(await run(provider))
    expect(calls()).toBe(1)
    expect(trace.usage).toEqual({
      inputTokens: 2100,
      outputTokens: 100,
      cacheCreationInputTokens: 500,
      cacheReadInputTokens: 500,
    })
  })

  it('(c) no usage events gives no usage key', async () => {
    const { provider } = usageStub([{ out: VALID }])
    const trace = traceOf(await run(provider))
    expect(trace).not.toHaveProperty('usage')
  })
})

describe('produce() prompt budget report and halt switch (ADR-0234)', () => {
  it('(d) trace.prompt totals the system prompt the provider received, at the declared default limit', async () => {
    const { provider, systems } = usageStub([{ out: VALID }])
    const trace = traceOf(await run(provider))
    expect(trace.prompt).toBeDefined()
    expect(trace.prompt!.total).toBe(systems()[0]!.length)
    expect(trace.prompt!.limit).toBe(promptBudgetFor(defaultCatalog.catalogId))
    expect(trace.prompt!.over).toBe(false)
  })

  it("(e) {mode: 'report', limit: 1} reports over: true and sends a byte-identical system prompt", async () => {
    const plain = usageStub([{ out: VALID }])
    await run(plain.provider)
    const reported = usageStub([{ out: VALID }])
    const trace = traceOf(await run(reported.provider, { promptBudget: { mode: 'report', limit: 1 } }))
    expect(trace.prompt!.over).toBe(true)
    expect(trace.prompt!.limit).toBe(1)
    expect(reported.systems()[0]).toBe(plain.systems()[0])
  })

  it("(f) {mode: 'halt', limit: 1} throws ProduceHalt PROMPT_OVER_BUDGET before any provider call", async () => {
    const { provider, calls } = usageStub([{ out: VALID }])
    const lines: string[] = []
    let halted: unknown
    try {
      const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
      const opts: ProduceOptions = { maxRounds: 3, progress: true, promptBudget: { mode: 'halt', limit: 1 } }
      for await (const l of produce(intent, deps, opts)) lines.push(l)
    } catch (e) {
      halted = e
    }
    expect(halted).toBeInstanceOf(ProduceHalt)
    expect((halted as ProduceHalt).failures).toEqual([{ code: 'PROMPT_OVER_BUDGET', path: '' }])
    expect(calls()).toBe(0)
    expect(lines).toEqual([])
  })

  it('halt mode under the limit runs normally (the switch bites only when over)', async () => {
    const { provider, calls } = usageStub([{ out: VALID }])
    const trace = traceOf(await run(provider, { promptBudget: { mode: 'halt' } }))
    expect(calls()).toBe(1)
    expect(trace.prompt!.over).toBe(false)
  })

  it('(g) progress off with a usage-emitting stub yields no progress meta-lines', async () => {
    const { provider } = usageStub([{ out: VALID, usage: [{ inputTokens: 5, outputTokens: 1 }] }])
    const lines = await run(provider)
    expect(lines.filter((l) => readMetaLine(l)?.a2uiMeta.progress !== undefined)).toEqual([])
    // The note meta-line plus the two validated A2UI lines, nothing else.
    expect(lines).toHaveLength(3)
    expect(traceOf(lines).usage).toEqual({ inputTokens: 5, outputTokens: 1 })
  })
})
