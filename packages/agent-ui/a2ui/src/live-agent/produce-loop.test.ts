// produce-loop.test.ts — LLD-C8 / SPEC-R4 AC1, SPEC-R5, SPEC-R12. The runtime loop's mechanics, gate-covered
// with a STUB AgentProvider (no live model): a first-invalid-then-valid provider proves self-correction (the
// validator's failures are fed back — the stub RECORDS each round's request so we assert the feedback
// reaches the model, not just that a second call happened) and validate-then-stream (only the validated
// payload's lines are ever emitted); an always-invalid provider proves halt-and-report emits NOTHING
// invalid; and a crafted `input.model` proves the trust boundary (opts.model WINS — SPEC-R12).

import { describe, it, expect } from 'vitest'
import { produce, ProduceHalt } from '../../tools/agent/produce.ts'
import type { ProduceDeps } from '../../tools/agent/produce.ts'
import type { AgentProvider, TurnInput } from '../../tools/agent/agent-transport.ts'
import { validateA2ui } from '../renderer/validate.ts'
import { defaultCatalog } from '../catalog/default/index.ts'

// An UNKNOWN component ⇒ CATALOG-invalid (unambiguous, independent of root/surface semantics).
const INVALID =
  '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
  '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"NotARealComponent"}]}}'
// A valid surface: a Button root whose click round-trips a submit action (the canvas-button shape).
const VALID =
  '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
  '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Button","label":"Hi","action":{"action":"submit"}}]}}'

interface CapturedReq {
  model: string
  messages: { role: string; content: string }[]
}

function stubProvider(outputs: string[]): { provider: AgentProvider; calls: () => number; reqs: () => CapturedReq[] } {
  let n = 0
  const captured: CapturedReq[] = []
  const provider: AgentProvider = {
    async *stream(req) {
      captured.push({ model: req.model, messages: req.messages.map((m) => ({ role: m.role, content: m.content })) })
      const out = outputs[Math.min(n, outputs.length - 1)]!
      n += 1
      yield out
    },
  }
  return { provider, calls: () => n, reqs: () => captured }
}

const intent: TurnInput = { kind: 'intent', text: 'a submit button', session: { turns: [] } }

describe('produce() runtime loop (LLD-C3 / SPEC-R4/R5)', () => {
  it('self-corrects: feeds the validator failure back, then streams ONLY the validated payload', async () => {
    const { provider, calls, reqs } = stubProvider([INVALID, VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    expect(calls()).toBe(2) // one invalid round, then the corrected one
    expect(lines).toHaveLength(2) // only the VALID payload's two messages streamed
    expect(lines.join('\n')).not.toContain('NotARealComponent') // no invalid partial ever painted (SPEC-R5)
    expect(validateA2ui(lines.map((l) => JSON.parse(l)), defaultCatalog).valid).toBe(true)

    // The self-correct round MUST carry the feedback (SPEC-R4): the prior INVALID raw as an assistant
    // turn, then a user turn telling the model it was invalid. A regression that dropped the feedback loop
    // (re-sent the bare intent) would still produce 2 calls — so assert the round-2 messages, not just the count.
    const round2 = reqs()[1]!.messages
    expect(round2.some((m) => m.role === 'assistant' && m.content.includes('NotARealComponent'))).toBe(true)
    expect(round2.some((m) => m.role === 'user' && /INVALID/i.test(m.content))).toBe(true)
    expect(round2.length).toBeGreaterThan(reqs()[0]!.messages.length) // round 2 has strictly more turns than round 1
  })

  it('the authoritative opts.model WINS over a client-supplied input.model (SPEC-R12 trust boundary)', async () => {
    // A crafted request sets input.model to something OFF the allowlist; the proxy passes the VALIDATED
    // model as opts.model. The provider must receive the validated model, never the crafted one.
    const crafted: TurnInput = { kind: 'intent', text: 'a submit button', session: { turns: [] }, model: 'ATTACKER-off-allowlist' }
    const { provider, reqs } = stubProvider([VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(crafted, deps, { maxRounds: 3, model: 'claude-sonnet-5' })) lines.push(line)

    expect(reqs()[0]!.model).toBe('claude-sonnet-5') // validated model reached the API
    expect(reqs().every((r) => r.model !== 'ATTACKER-off-allowlist')).toBe(true) // crafted value never did
  })

  it('halts-and-reports at the bound when generation never validates (emits nothing invalid)', async () => {
    const { provider, calls } = stubProvider([INVALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    let halted: unknown
    try {
      for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)
    } catch (e) {
      halted = e
    }
    expect(halted).toBeInstanceOf(ProduceHalt)
    expect((halted as ProduceHalt).failures.length).toBeGreaterThan(0)
    expect(lines).toHaveLength(0) // NOTHING invalid was emitted
    expect(calls()).toBe(3) // exhausted the round bound
  })
})
