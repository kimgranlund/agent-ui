// produce-semantic-checks.test.ts: the persona semantic-check hook inside the real `produce()` loop
// (ADR-0238, proposed; GH #1795), keyless, with a scripted provider. Round 1 is the live Croupier evidence
// (structurally valid on top of its deal turn, self-contradicting), round 2 its repair: with the croupier
// checks declared, exactly one repair round runs, the finding's sentence reaches the model, and only the
// repaired payload streams (`trace.rounds === 2`). The negative control is today's behavior: with no checks
// the evidence ships on round 1. At the round bound a finding never halts; the valid payload ships tallied.
// A persona that declares no checks streams byte-identically.

import { describe, it, expect } from 'vitest'
import { produce, ProduceHalt } from '../agent/produce.ts'
import type { ProduceDeps } from '../agent/produce.ts'
import type { AgentProvider, Session, TurnInput } from '../agent/agent-transport.ts'
import { readMetaLine } from '../agent/meta-line.ts'
import type { SemanticCheck } from '../catalog/semantic-check.ts'
import { composeCatalog } from '../catalog/compose.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { croupierFragment } from '../catalog/personas/croupier/manifest.ts'
import { croupierSemanticChecks } from '../catalog/personas/croupier/checks.ts'
import { CORRECTED_LINE, DEAL_TURN, EVIDENCE_LINE, toJsonl } from '../catalog/personas/croupier/hands.fixture.ts'

const catalog = composeCatalog(defaultCatalog, croupierFragment, 'croupier')
const session: Session = {
  turns: [
    { role: 'user', content: 'Deal round 3' },
    { role: 'assistant', content: toJsonl(DEAL_TURN) },
  ],
}
const input: TurnInput = { kind: 'intent', text: 'Double down', session }
const NOTE = '{"a2uiMeta":{"note":"You double down."}}'
const EVIDENCE = `${NOTE}\n${EVIDENCE_LINE}`
const CORRECTED = `${NOTE}\n${CORRECTED_LINE}`

interface Captured {
  system: string
  messages: { role: string; content: string }[]
}

function scripted(outputs: string[]): { provider: AgentProvider; calls: () => number; reqs: Captured[] } {
  let n = 0
  const reqs: Captured[] = []
  const provider: AgentProvider = {
    async *stream(req) {
      reqs.push({ system: req.system, messages: req.messages.map((m) => ({ role: m.role, content: m.content })) })
      const out = outputs[Math.min(n, outputs.length - 1)]!
      n += 1
      yield out
    },
  }
  return { provider, calls: () => n, reqs }
}

function deps(provider: AgentProvider, semanticChecks?: readonly SemanticCheck[]): ProduceDeps {
  return { provider, retrieve: () => [], catalog, ...(semanticChecks !== undefined ? { semanticChecks } : {}) }
}

async function collect(stream: AsyncIterable<string>): Promise<string[]> {
  const lines: string[] = []
  for await (const line of stream) lines.push(line)
  return lines
}

const traceOf = (lines: string[]) => readMetaLine(lines[0]!)!.a2uiMeta.trace!
const content = (lines: string[]) => lines.slice(1).map((l) => JSON.parse(l) as unknown)

describe('produce() + croupier semantic checks: the GH #1795 evidence is repaired in one round', () => {
  it('negative control (today): with no checks the self-contradicting evidence ships on round 1', async () => {
    const s = scripted([EVIDENCE, CORRECTED])
    const lines = await collect(produce(input, deps(s.provider), { maxRounds: 3 }))
    expect(s.calls()).toBe(1)
    expect(traceOf(lines)).toMatchObject({ rounds: 1, failureCodes: [] })
    expect(content(lines)).toEqual([JSON.parse(EVIDENCE_LINE)])
  })

  it('with the croupier checks: exactly one repair round, and the stream is the corrected payload (trace.rounds 2)', async () => {
    const s = scripted([EVIDENCE, CORRECTED])
    const lines = await collect(produce(input, deps(s.provider, croupierSemanticChecks), { maxRounds: 3 }))
    expect(s.calls()).toBe(2)
    expect(traceOf(lines)).toMatchObject({ rounds: 2, failureCodes: ['HAND_TOTAL'] })
    expect(readMetaLine(lines[0]!)!.a2uiMeta.note).toBe('You double down.')
    expect(content(lines)).toEqual([JSON.parse(CORRECTED_LINE)])
  })

  it('the repair round carries the invalid attempt and the finding sentence, not just a code and a path', async () => {
    const s = scripted([EVIDENCE, CORRECTED])
    await collect(produce(input, deps(s.provider, croupierSemanticChecks), { maxRounds: 3 }))
    const round2 = s.reqs[1]!.messages
    expect(round2.at(-2)).toEqual({ role: 'assistant', content: EVIDENCE })
    const feedback = round2.at(-1)!.content
    expect(feedback).toContain('HAND_TOTAL at table-3:dealerTotal: dealerTotal ("Dealer: 14, draws to 17") states 17')
    expect(feedback).toContain("the dealer's cards in dealerCards (6, 5, 3) total 14")
    expect(feedback).toContain('contradictions inside your content, not schema errors')
    // The system prompt is built once per turn: the hook never changes it.
    expect(s.reqs[1]!.system).toBe(s.reqs[0]!.system)
  })

  it('at the round bound a finding never halts: the valid payload ships with SEMANTIC_UNCORRECTED tallied', async () => {
    const two = scripted([EVIDENCE])
    const lines = await collect(produce(input, deps(two.provider, croupierSemanticChecks), { maxRounds: 2 }))
    expect(two.calls()).toBe(2)
    expect(traceOf(lines)).toMatchObject({ rounds: 2, failureCodes: ['HAND_TOTAL', 'SEMANTIC_UNCORRECTED'] })
    expect(content(lines)).toEqual([JSON.parse(EVIDENCE_LINE)])

    const one = scripted([EVIDENCE])
    const single = await collect(produce(input, deps(one.provider, croupierSemanticChecks), { maxRounds: 1 }))
    expect(one.calls()).toBe(1)
    expect(traceOf(single)).toMatchObject({ rounds: 1, failureCodes: ['SEMANTIC_UNCORRECTED'] })
  })

  it('a structural failure still halts as before; a semantic finding is never what a ProduceHalt carries', async () => {
    const bad = '{"version":"v1.0","updateComponents":{"surfaceId":"table-3","components":[{"id":"x","component":"NotAComponent"}]}}'
    const s = scripted([EVIDENCE, bad])
    const run = collect(produce(input, deps(s.provider, croupierSemanticChecks), { maxRounds: 2 }))
    await expect(run).rejects.toBeInstanceOf(ProduceHalt)
    await run.catch((e: ProduceHalt) => expect(e.failures.map((f) => f.code)).not.toContain('HAND_TOTAL'))
  })

  it('a throwing check is fail-open: the round ships and SEMANTIC_CHECK_ERROR is tallied', async () => {
    const broken: SemanticCheck = {
      id: 'broken',
      check: () => {
        throw new Error('bug')
      },
    }
    const s = scripted([EVIDENCE])
    const lines = await collect(produce(input, deps(s.provider, [broken]), { maxRounds: 3 }))
    expect(s.calls()).toBe(1)
    expect(traceOf(lines)).toMatchObject({ rounds: 1, failureCodes: ['SEMANTIC_CHECK_ERROR'] })
  })
})

describe('produce() with no declared checks is byte-identical (ADR-0238 default off)', () => {
  const VALID =
    '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
    '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Button","label":"Hi","action":{"action":"submit"}}]}}'
  const passing: SemanticCheck = { id: 'passes', check: () => [] }

  for (const [label, turn, outputs] of [
    ['a fresh surface', { kind: 'intent', text: 'a button', session: { turns: [] } } as TurnInput, [`${NOTE}\n${VALID}`]],
    ['the croupier evidence turn', input, [EVIDENCE, CORRECTED]],
  ] as const) {
    it(`${label}: absent, empty, and an always-passing check stream the same lines and send the same requests`, async () => {
      const runs = await Promise.all(
        [undefined, [], [passing]].map(async (checks) => {
          const s = scripted([...outputs])
          const lines = await collect(produce(turn, deps(s.provider, checks), { maxRounds: 3, progress: true }))
          return { lines, reqs: s.reqs }
        }),
      )
      expect(runs[1]).toEqual(runs[0])
      expect(runs[2]).toEqual(runs[0])
    })
  }
})
