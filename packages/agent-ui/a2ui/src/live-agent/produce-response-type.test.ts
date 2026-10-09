// produce-response-type.test.ts: SPEC RTS-R1, R3, R5, R6, R8, R9, R12 (response type selection) through the real
// produce() loop with stub providers in the produce-loop.test.ts shape. A stub round may yield text fragments and
// then call a tool through the executor the request carries, the way an adapter's terminal round does: so the
// capture of `render_surface`, the text channel as the reply, the `textDelta` arm, the user override, the
// degrade at the bound, the escalation seam and the stored history are each asserted on the wire produce()
// yields and on the requests the stub receives. The legacy shape stays covered, unedited, by produce-loop.

import { describe, it, expect, vi } from 'vitest'
import { produce, ProduceHalt } from '../agent/produce.ts'
import type { ProduceDeps, ProduceOptions } from '../agent/produce.ts'
import type { AgentProvider, ExecuteTool, Session, ToolDef, TurnInput } from '../agent/agent-transport.ts'
import { readMetaLine } from '../agent/meta-line.ts'
import type { A2uiMetaEnvelope } from '../agent/meta-line.ts'
import { appendAssistantTurn, appendUserTurn } from '../agent/session.ts'
import { defaultCatalog } from '../catalog/default/index.ts'

const VALID =
  '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
  '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Button","label":"Hi","action":{"action":"submit"}}]}}'
// An unknown component: CATALOG-invalid, independent of root or surface semantics.
const INVALID =
  '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
  '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"NotARealComponent"}]}}'
// A fresh feed ask surface hosting only a feed-scope type.
const ASK_VALID =
  '{"version":"v1.0","createSurface":{"surfaceId":"ask-1","catalogId":"agent-ui","sendDataModel":true}}\n' +
  '{"version":"v1.0","updateComponents":{"surfaceId":"ask-1","components":[{"id":"root","component":"Button","label":"Go","action":{"action":"submit"}}]}}'
// An update-only follow-up to `main`: valid only against the seeded graph of an earlier turn.
const UPDATE_MAIN = '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"extra","component":"Text","text":"More"}]}}'

type StreamReq = Parameters<AgentProvider['stream']>[0]

/** One scripted round: text fragments yielded first, then tool calls made through the request's executor. */
interface Round {
  text?: string | string[]
  call?: { name: string; input: Record<string, unknown> }[]
}

function scripted(rounds: Round[]): { provider: AgentProvider; calls: () => number; reqs: () => StreamReq[]; results: () => string[] } {
  let n = 0
  const reqs: StreamReq[] = []
  const results: string[] = []
  const provider: AgentProvider = {
    async *stream(req) {
      reqs.push(req)
      const round = rounds[Math.min(n, rounds.length - 1)]!
      n += 1
      const frags = round.text === undefined ? [] : Array.isArray(round.text) ? round.text : [round.text]
      for (const frag of frags) yield frag
      for (const c of round.call ?? []) if (req.executeTool !== undefined) results.push(await req.executeTool(c.name, c.input, req.signal))
    },
  }
  return { provider, calls: () => n, reqs: () => reqs, results: () => results }
}

const surface = (jsonl: string): { name: string; input: Record<string, unknown> } => ({ name: 'render_surface', input: { jsonl } })
const intentOf = (text: string, session: Session = { turns: [] }): TurnInput => ({ kind: 'intent', text, session })
const NEUTRAL = intentOf('a submit button')

async function run(input: TurnInput, provider: AgentProvider, opts: Partial<ProduceOptions> = {}): Promise<string[]> {
  const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
  const lines: string[] = []
  for await (const line of produce(input, deps, { maxRounds: 3, ...opts })) lines.push(line)
  return lines
}

const metaOf = (line: string): A2uiMetaEnvelope['a2uiMeta'] | undefined => readMetaLine(line)?.a2uiMeta
const deltasOf = (lines: string[]): string[] => lines.map((l) => metaOf(l)?.textDelta).filter((d): d is string => d !== undefined)
const contentOf = (lines: string[]): string[] => lines.filter((l) => readMetaLine(l) === undefined)
/** The single outgoing meta-line, the one carrying the runtime trace. */
function finalMeta(lines: string[]): A2uiMetaEnvelope['a2uiMeta'] {
  const traced = lines.map(metaOf).filter((m) => m?.trace !== undefined)
  expect(traced).toHaveLength(1)
  return traced[0]!
}
const toolNames = (req: StreamReq): string[] | undefined => req.tools?.map((t) => t.name)
const lastUserMessage = (req: StreamReq): string => [...req.messages].reverse().find((m) => m.role === 'user')!.content

const CALC: ToolDef = { name: 'calc_add', description: 'add two numbers', input_schema: { type: 'object', properties: {} } }

describe('render_surface tool round', () => {
  it('RTS-R1: offers render_surface as a terminal tool after the integration tools, behind its own executor, with no toolChoice', async () => {
    const callerExec: ExecuteTool = async () => '3'
    const { provider, reqs } = scripted([{ text: 'Done.' }])
    await run(NEUTRAL, provider, { tools: [CALC], executeTool: callerExec })
    const req = reqs()[0]!
    expect(toolNames(req)).toEqual(['calc_add', 'render_surface'])
    expect(req.terminalTools).toEqual(['render_surface'])
    expect('toolChoice' in req).toBe(false)
    expect(req.executeTool).not.toBe(callerExec)

    const plain = scripted([{ text: 'Done.' }])
    await run(NEUTRAL, plain.provider)
    expect(toolNames(plain.reqs()[0]!)).toEqual(['render_surface'])
    expect(plain.reqs()[0]!.executeTool).toBeTypeOf('function')
  })

  it('RTS-R3 AC1: a tool round ships the reply as the note on the meta-line first, then the validated payload lines', async () => {
    const { provider } = scripted([{ text: 'Here is your card.', call: [surface(VALID)] }])
    const lines = await run(NEUTRAL, provider)
    const wire = lines.filter((l) => metaOf(l)?.textDelta === undefined)
    expect(metaOf(wire[0]!)?.note).toBe('Here is your card.')
    expect(metaOf(wire[0]!)?.trace).toMatchObject({ rounds: 1, failureCodes: [] })
    expect(wire.slice(1)).toEqual(VALID.split('\n').map((l) => JSON.stringify(JSON.parse(l))))
  })

  it('RTS-R1 AC2: the executor is reached exactly once, answers received, and nothing is fed back within the turn', async () => {
    const { provider, calls, results } = scripted([{ text: 'Here is your card.', call: [surface(VALID)] }])
    await run(NEUTRAL, provider)
    expect(results()).toEqual(['received'])
    expect(calls()).toBe(1)
  })

  it('delegates every other tool name to the caller executor, with the turn signal', async () => {
    const callerExec = vi.fn<ExecuteTool>(async () => '3')
    const { provider, results } = scripted([{ text: 'Sum shown.', call: [{ name: 'calc_add', input: { a: 1, b: 2 } }, surface(VALID)] }])
    const lines = await run(NEUTRAL, provider, { tools: [CALC], executeTool: callerExec })
    expect(results()).toEqual(['3', 'received'])
    expect(callerExec).toHaveBeenCalledTimes(1)
    expect(callerExec.mock.calls[0]![0]).toBe('calc_add')
    expect(callerExec.mock.calls[0]![1]).toEqual({ a: 1, b: 2 })
    expect(callerExec.mock.calls[0]![2]).toBeInstanceOf(AbortSignal)
    expect(contentOf(lines)).toHaveLength(2)
  })

  it('RTS-R3 AC2: a text-only round ships a note-only turn with rounds 1 and never halts', async () => {
    const { provider, calls } = scripted([{ text: '  The capital of Finland is Helsinki.\n' }])
    const lines = await run(NEUTRAL, provider)
    expect(calls()).toBe(1)
    expect(contentOf(lines)).toEqual([])
    const meta = finalMeta(lines)
    expect(meta.note).toBe('The capital of Finland is Helsinki.')
    expect(meta.trace).toMatchObject({ rounds: 1, failureCodes: [] })
  })

  it('a meta-line note with no text after it is the note, as before', async () => {
    const { provider } = scripted([{ text: '{"a2uiMeta":{"note":"Nothing to show."}}' }])
    const meta = finalMeta(await run(NEUTRAL, provider))
    expect(meta.note).toBe('Nothing to show.')
  })

  it('RTS-R3 AC3: an ask on the text channel meta-line rides the tool payload under the same ask-integrity rule', async () => {
    const { provider } = scripted([{ text: '{"a2uiMeta":{"ask":{"surfaceId":"ask-1"}}}\nPick one below.', call: [surface(ASK_VALID)] }])
    const lines = await run(NEUTRAL, provider)
    const meta = finalMeta(lines)
    expect(meta.ask).toEqual({ surfaceId: 'ask-1' })
    expect(meta.note).toBe('Pick one below.')
    expect(contentOf(lines).map((l) => JSON.parse(l) as Record<string, unknown>).some((m) => 'createSurface' in m)).toBe(true)

    // The same ask over a payload that never creates ask-1 is dropped, exactly as for a legacy payload.
    const miss = scripted([{ text: '{"a2uiMeta":{"ask":{"surfaceId":"ask-1"}}}\nPick one below.', call: [surface(VALID)] }])
    const missLines = await run(NEUTRAL, miss.provider)
    expect(finalMeta(missLines).ask).toBeUndefined()
    expect(contentOf(missLines)).toHaveLength(2)
  })

  it('TEXT_JSONL_IGNORED: wire lines in the text channel are dropped from the reply and the tool payload wins', async () => {
    const { provider } = scripted([{ text: `Here you go.\n${INVALID}`, call: [surface(VALID)] }])
    const lines = await run(NEUTRAL, provider)
    const meta = finalMeta(lines)
    expect(meta.note).toBe('Here you go.')
    expect(meta.trace?.failureCodes).toEqual(['TEXT_JSONL_IGNORED'])
    expect(contentOf(lines).join('\n')).toContain('"component":"Button"')
    expect(contentOf(lines).join('\n')).not.toContain('NotARealComponent')
  })

  it('the tool description names the open surfaces of the session', async () => {
    const session = appendAssistantTurn(appendUserTurn({ turns: [] }, 'a submit button'), VALID)
    const { provider, reqs } = scripted([{ text: 'Sure.' }])
    await run(intentOf('add a caption', session), provider)
    const tool = reqs()[0]!.tools!.find((t) => t.name === 'render_surface')!
    expect(tool.description).toContain('Open surfaces: main.')
  })

  it("the tool's target states the meta-line target arm when the text declared none", async () => {
    const { provider } = scripted([{ text: 'Updated.', call: [{ name: 'render_surface', input: { jsonl: VALID, target: 'main' } }] }])
    expect(finalMeta(await run(NEUTRAL, provider)).target).toEqual({ surfaceId: 'main' })
    const plain = scripted([{ text: 'Updated.', call: [surface(VALID)] }])
    expect(finalMeta(await run(NEUTRAL, plain.provider)).target).toBeUndefined()
  })

  it('a render_surface call with no payload is a failed payload, repaired with the tool-aware wording', async () => {
    const { provider, calls, reqs } = scripted([
      { text: 'Here.', call: [{ name: 'render_surface', input: { jsonl: '' } }] },
      { text: 'Here.', call: [surface(VALID)] },
    ])
    const lines = await run(NEUTRAL, provider)
    expect(calls()).toBe(2)
    expect(lastUserMessage(reqs()[1]!)).toMatch(/PARSE/)
    expect(lastUserMessage(reqs()[1]!)).toContain('Call render_surface again with the COMPLETE corrected JSONL')
    expect(contentOf(lines)).toHaveLength(2)
  })

  it('RTS-R4: a legacy-shape text channel (plain, fenced, or healed) runs the pre-change path with no delta', async () => {
    for (const text of [`{"a2uiMeta":{"note":"hi"}}\n${VALID}`, '```json\n' + VALID + '\n```', VALID.replace('"agent-ui"}}', '"agent-ui"},}')]) {
      const { provider, calls } = scripted([{ text }])
      const lines = await run(NEUTRAL, provider)
      expect(calls()).toBe(1)
      expect(deltasOf(lines)).toEqual([])
      expect(contentOf(lines)).toHaveLength(2)
    }
  })
})

describe('textDelta', () => {
  it('RTS-R5 AC1: three fragments yield three textDelta lines, then the meta-line whose note is their concatenation trimmed, then the content', async () => {
    const frags = ['Here ', 'is your ', 'card. ']
    const { provider } = scripted([{ text: frags, call: [surface(VALID)] }])
    const lines = await run(NEUTRAL, provider)
    expect(lines.slice(0, 3).map((l) => metaOf(l)?.textDelta)).toEqual(frags)
    expect(deltasOf(lines)).toHaveLength(3)
    expect(metaOf(lines[3]!)?.note).toBe(frags.join('').trim())
    expect(lines.slice(4)).toEqual(contentOf(lines))
    expect(contentOf(lines)).toHaveLength(2)
  })

  it('RTS-R5 AC2: with an integration tool active no textDelta line is yielded and the note ships whole', async () => {
    const { provider } = scripted([{ text: ['Here ', 'is your ', 'card.'], call: [surface(VALID)] }])
    const lines = await run(NEUTRAL, provider, { tools: [CALC], executeTool: async () => '3' })
    expect(deltasOf(lines)).toEqual([])
    expect(finalMeta(lines).note).toBe('Here is your card.')
  })

  it('peels a leading meta-line first: the deltas carry only the reply text', async () => {
    const plan = '{"a2uiMeta":{"plan":{"steps":[{"id":"s1","description":"answer"}]}}}'
    const { provider } = scripted([{ text: [plan.slice(0, 20), `${plan.slice(20)}\nPick `, 'one.'] }])
    const lines = await run(NEUTRAL, provider)
    expect(deltasOf(lines)).toEqual(['Pick ', 'one.'])
    const meta = finalMeta(lines)
    expect(meta.note).toBe('Pick one.')
    expect(meta.plan).toEqual({ steps: [{ id: 's1', description: 'answer' }] })
  })

  it('holds a reply that opens with { until its first line is known not to be a wire line', async () => {
    const { provider } = scripted([{ text: ['{curly}', ' braces\nare fine.'] }])
    const lines = await run(NEUTRAL, provider)
    expect(deltasOf(lines)).toEqual(['{curly} braces\nare fine.'])
    expect(finalMeta(lines).note).toBe('{curly} braces\nare fine.')
  })

  it('a legacy-shape round streams no textDelta line', async () => {
    const { provider } = scripted([{ text: [VALID.slice(0, 30), VALID.slice(30)] }])
    const lines = await run(NEUTRAL, provider)
    expect(deltasOf(lines)).toEqual([])
    expect(contentOf(lines)).toHaveLength(2)
  })

  it('with progress on, deltas follow the content stage and precede the meta-line and every content line', async () => {
    const { provider } = scripted([{ text: ['Here ', 'it is.'], call: [surface(VALID)] }])
    const lines = await run(NEUTRAL, provider, { progress: true })
    const firstDelta = lines.findIndex((l) => metaOf(l)?.textDelta !== undefined)
    const lastDelta = lines.map((l) => metaOf(l)?.textDelta !== undefined).lastIndexOf(true)
    const contentStage = lines.findIndex((l) => metaOf(l)?.progress?.stage === 'content')
    const metaLine = lines.findIndex((l) => metaOf(l)?.trace !== undefined)
    const firstContent = lines.findIndex((l) => readMetaLine(l) === undefined)
    expect(contentStage).toBeGreaterThan(-1)
    expect(firstDelta).toBeGreaterThan(contentStage)
    expect(lastDelta).toBeLessThan(metaLine)
    expect(metaLine).toBeLessThan(firstContent)
  })

  it('a repair round streams no further delta: the reply already streamed once', async () => {
    const { provider, calls } = scripted([
      { text: 'Here.', call: [surface(INVALID)] },
      { text: 'Here.', call: [surface(VALID)] },
    ])
    const lines = await run(NEUTRAL, provider)
    expect(calls()).toBe(2)
    expect(deltasOf(lines)).toEqual(['Here.'])
  })
})

describe('user override', () => {
  it('RTS-R6 AC1: a text-lexicon intent offers no render_surface, whatever prefers says', async () => {
    const { provider, reqs } = scripted([{ text: 'It is a container.' }])
    await run(intentOf('just tell me what a card is'), provider, { prefers: 'surface' })
    const req = reqs()[0]!
    expect(req.tools).toBeUndefined()
    expect(req.executeTool).toBeUndefined()
    expect('terminalTools' in req).toBe(false)
    expect('toolChoice' in req).toBe(false)
  })

  it('RTS-R6: responsePreference text has the same effect as the text lexicon', async () => {
    const { provider, reqs } = scripted([{ text: 'Plain.' }])
    await run(NEUTRAL, provider, { responsePreference: 'text' })
    expect(reqs()[0]!.tools).toBeUndefined()
  })

  it('RTS-R6 AC2: a surface-lexicon intent forces the tool; a text-only reply spends one SURFACE_REQUESTED round, then ships text tallied', async () => {
    const { provider, calls, reqs } = scripted([{ text: 'Plans: A and B.' }])
    const lines = await run(intentOf('show me the plans as a table'), provider)
    expect(calls()).toBe(2)
    expect(reqs()[0]!.toolChoice).toEqual({ name: 'render_surface' })
    expect(reqs()[1]!.toolChoice).toEqual({ name: 'render_surface' })
    expect(lastUserMessage(reqs()[1]!)).toMatch(/SURFACE_REQUESTED/)
    expect(lastUserMessage(reqs()[1]!)).toMatch(/render_surface/)
    expect(contentOf(lines)).toEqual([])
    const meta = finalMeta(lines)
    expect(meta.note).toBe('Plans: A and B.')
    expect(meta.trace?.failureCodes).toEqual(['SURFACE_REQUESTED', 'SURFACE_REQUESTED_UNMET'])
  })

  it('a surface override answered on the correction round ships the surface', async () => {
    const { provider, calls } = scripted([{ text: 'Plans: A and B.' }, { text: 'Here they are.', call: [surface(VALID)] }])
    const lines = await run(intentOf('show me the plans as a table'), provider)
    expect(calls()).toBe(2)
    expect(contentOf(lines)).toHaveLength(2)
    expect(finalMeta(lines).trace?.failureCodes).toEqual(['SURFACE_REQUESTED'])
  })

  it('a surface override with no round left ships text tallied, with no correction round', async () => {
    const { provider, calls } = scripted([{ text: 'Plans: A and B.' }])
    const lines = await run(intentOf('show me the plans as a table'), provider, { maxRounds: 1 })
    expect(calls()).toBe(1)
    expect(finalMeta(lines).trace?.failureCodes).toEqual(['SURFACE_REQUESTED_UNMET'])
  })

  it('a legacy payload on a surface override ships unchanged, with no correction round', async () => {
    const { provider, calls } = scripted([{ text: VALID }])
    const lines = await run(intentOf('show me a button'), provider)
    expect(calls()).toBe(1)
    expect(contentOf(lines)).toHaveLength(2)
  })

  it('RTS-R6: responsePreference surface forces the tool; auto means none', async () => {
    const forced = scripted([{ text: 'Card.', call: [surface(VALID)] }])
    await run(NEUTRAL, forced.provider, { responsePreference: 'surface' })
    expect(forced.reqs()[0]!.toolChoice).toEqual({ name: 'render_surface' })

    const auto = scripted([{ text: 'Card.', call: [surface(VALID)] }])
    await run(NEUTRAL, auto.provider, { responsePreference: 'auto' })
    expect(toolNames(auto.reqs()[0]!)).toEqual(['render_surface'])
    expect('toolChoice' in auto.reqs()[0]!).toBe(false)
  })

  it("the intent's own words beat responsePreference as the latest instruction", async () => {
    const text = scripted([{ text: 'Plain.' }])
    await run(intentOf('just tell me the weather'), text.provider, { responsePreference: 'surface' })
    expect(text.reqs()[0]!.tools).toBeUndefined()

    const shown = scripted([{ text: 'Table.', call: [surface(VALID)] }])
    await run(intentOf('show me the weather as a table'), shown.provider, { responsePreference: 'text' })
    expect(shown.reqs()[0]!.toolChoice).toEqual({ name: 'render_surface' })
  })

  it('RTS-R7: prefers is advisory only and never changes the tool offer or toolChoice', async () => {
    for (const prefers of ['text', 'surface'] as const) {
      const { provider, reqs } = scripted([{ text: 'Ok.' }])
      await run(NEUTRAL, provider, { prefers })
      expect(toolNames(reqs()[0]!)).toEqual(['render_surface'])
      expect('toolChoice' in reqs()[0]!).toBe(false)
    }
  })

  it('a render_surface call on a text-override turn is never captured; the same stub with no override ships the surface', async () => {
    const callerExec = vi.fn<ExecuteTool>(async () => 'caller')
    const round: Round = { text: 'Sure.', call: [surface(VALID)] }
    const overridden = scripted([round])
    const lines = await run(intentOf('just tell me, no card'), overridden.provider, { tools: [CALC], executeTool: callerExec })
    expect(overridden.reqs()[0]!.executeTool).toBe(callerExec)
    expect(overridden.results()).toEqual(['caller'])
    expect(contentOf(lines)).toEqual([])
    expect(finalMeta(lines).note).toBe('Sure.')

    // Negative control: no override phrase, the same stub, and the surface ships.
    const control = scripted([round])
    const controlLines = await run(intentOf('a submit button, please'), control.provider, { tools: [CALC], executeTool: callerExec })
    expect(control.results()).toEqual(['received'])
    expect(contentOf(controlLines)).toHaveLength(2)
  })
})

describe('degrade at the bound', () => {
  it('RTS-R8 AC1: three invalid tool payloads with reply text ship note-only, failureCodes ending in SURFACE_DEGRADED', async () => {
    const { provider, calls } = scripted([{ text: 'Here is the plan.', call: [surface(INVALID)] }])
    const lines = await run(NEUTRAL, provider)
    expect(calls()).toBe(3)
    expect(contentOf(lines)).toEqual([])
    const meta = finalMeta(lines)
    expect(meta.note).toBe('Here is the plan.')
    expect(meta.trace?.rounds).toBe(3)
    expect(meta.trace?.failureCodes.at(-1)).toBe('SURFACE_DEGRADED')
    expect(meta.trace?.failureCodes).toContain('CATALOG')
  })

  it('RTS-R8: the repair feedback on a capture round names render_surface and shows the model its reply and payload', async () => {
    const { provider, reqs } = scripted([{ text: 'Here is the plan.', call: [surface(INVALID)] }])
    await run(NEUTRAL, provider)
    const req = reqs()[1]!
    const feedback = lastUserMessage(req)
    expect(feedback).toMatch(/CATALOG/)
    expect(feedback).toContain('Call render_surface again with the COMPLETE corrected JSONL; keep your reply text addressed to the user.')
    expect(feedback).not.toContain('Re-emit the COMPLETE corrected A2UI JSONL')
    const attempt = req.messages.at(-2)!
    expect(attempt.role).toBe('assistant')
    expect(attempt.content).toBe(`Here is the plan.\n${INVALID}`)
  })

  it('progress done precedes the degraded meta-line', async () => {
    const { provider } = scripted([{ text: 'Here is the plan.', call: [surface(INVALID)] }])
    const lines = await run(NEUTRAL, provider, { progress: true })
    const stages = lines.map((l) => metaOf(l)?.progress?.stage).filter((s) => s !== undefined)
    expect(stages.at(-1)).toBe('done')
    expect(metaOf(lines.at(-1)!)?.trace?.failureCodes.at(-1)).toBe('SURFACE_DEGRADED')
  })

  it('an invalid tool payload with no reply text halts as before', async () => {
    const { provider } = scripted([{ call: [surface(INVALID)] }])
    await expect(run(NEUTRAL, provider)).rejects.toBeInstanceOf(ProduceHalt)
  })

  it('RTS-R8 AC2: three invalid legacy rounds still halt, repaired with the legacy wording', async () => {
    const { provider, calls, reqs } = scripted([{ text: `{"a2uiMeta":{"note":"Here is the plan."}}\n${INVALID}` }])
    await expect(run(NEUTRAL, provider)).rejects.toBeInstanceOf(ProduceHalt)
    expect(calls()).toBe(3)
    expect(lastUserMessage(reqs()[1]!)).toContain('Re-emit the COMPLETE corrected A2UI JSONL')
  })
})

describe('escalation seam', () => {
  it('RTS-R9 AC1: a policy returning effort high on round 2 is observed on the second request only', async () => {
    const policy = vi.fn((ctx: { round: number; failures: readonly { code: string; path: string }[] }) => (ctx.round === 2 ? { effort: 'high' as const } : undefined))
    const { provider, reqs } = scripted([
      { text: 'One.', call: [surface(INVALID)] },
      { text: 'Two.', call: [surface(INVALID)] },
      { text: 'Three.', call: [surface(VALID)] },
    ])
    await run(NEUTRAL, provider, { onRepairRound: policy })
    expect(reqs().map((r) => r.effort)).toEqual([undefined, 'high', undefined])
    expect(policy).toHaveBeenCalledTimes(2)
    expect(policy.mock.calls[0]![0].round).toBe(2)
    expect(policy.mock.calls[0]![0].failures.map((f) => f.code)).toContain('CATALOG')
  })

  it("a returned model replaces that round's model, and the trace records the shipped round's model", async () => {
    const { provider, reqs } = scripted([
      { text: 'One.', call: [surface(INVALID)] },
      { text: 'Two.', call: [surface(VALID)] },
    ])
    const lines = await run(NEUTRAL, provider, { model: 'claude-haiku-5-5', onRepairRound: () => ({ model: 'claude-opus-5-5' }) })
    expect(reqs().map((r) => r.model)).toEqual(['claude-haiku-5-5', 'claude-opus-5-5'])
    expect(finalMeta(lines).trace?.model).toBe('claude-opus-5-5')
  })

  it('is never consulted on a first-try round, and absent leaves effort and model as given', async () => {
    const policy = vi.fn(() => ({ effort: 'high' as const }))
    const { provider } = scripted([{ text: 'Ok.', call: [surface(VALID)] }])
    await run(NEUTRAL, provider, { onRepairRound: policy })
    expect(policy).not.toHaveBeenCalled()

    const absent = scripted([{ text: 'One.', call: [surface(INVALID)] }, { text: 'Two.', call: [surface(VALID)] }])
    const lines = await run(NEUTRAL, absent.provider, { model: 'claude-haiku-5-5', effort: 'low' })
    expect(absent.reqs().map((r) => [r.model, r.effort])).toEqual([
      ['claude-haiku-5-5', 'low'],
      ['claude-haiku-5-5', 'low'],
    ])
    expect(finalMeta(lines).trace?.model).toBe('claude-haiku-5-5')
  })
})

describe('two-turn history', () => {
  /** Turn 1: a tool round, stored by a host the RTS-R12 way (the reply, then the shipped lines). */
  async function firstTurn(): Promise<Session> {
    const { provider } = scripted([{ text: 'Here is your card.', call: [surface(VALID)] }])
    const lines = await run(NEUTRAL, provider)
    const note = finalMeta(lines).note
    return appendAssistantTurn(appendUserTurn({ turns: [] }, 'a submit button'), contentOf(lines).join('\n'), note)
  }

  it('RTS-R12: appendAssistantTurn stores <note>\\n<jsonl>, the note alone, or the lines alone', () => {
    const content = (jsonl: string, note?: string): string => appendAssistantTurn({ turns: [] }, jsonl, note).turns[0]!.content
    expect(content('L', 'Hi.')).toBe('Hi.\nL')
    expect(content('L')).toBe('L')
    expect(content('', 'Hi.')).toBe('Hi.')
    expect(content('L', '  ')).toBe('L')
  })

  it("RTS-R12 AC1: a first turn stored as <note>\\n<jsonl> seeds the second turn's update, with no false failure", async () => {
    const session = await firstTurn()
    expect(session.turns[1]!.content.startsWith('Here is your card.\n')).toBe(true)

    const { provider, calls } = scripted([{ text: 'Added a line.', call: [surface(UPDATE_MAIN)] }])
    const lines = await run(intentOf('add a line of text', session), provider)
    expect(calls()).toBe(1)
    expect(finalMeta(lines).trace?.failureCodes).toEqual([])
    expect(contentOf(lines)).toEqual([UPDATE_MAIN])

    // Negative control: without the stored turn the same update has no seeded root and is repaired.
    const unseeded = scripted([{ text: 'Added a line.', call: [surface(UPDATE_MAIN)] }, { text: 'Added a line.', call: [surface(VALID)] }])
    await run(intentOf('add a line of text'), unseeded.provider)
    expect(unseeded.calls()).toBe(2)
  })

  it('ask integrity reads the stored turn: a fresh ask passes, an ask naming the surface turn 1 created is dropped', async () => {
    const session = await firstTurn()
    const fresh = scripted([{ text: '{"a2uiMeta":{"ask":{"surfaceId":"ask-1"}}}\nPick one.', call: [surface(ASK_VALID)] }])
    expect(finalMeta(await run(intentOf('ask me to confirm', session), fresh.provider)).ask).toEqual({ surfaceId: 'ask-1' })

    const reused = scripted([{ text: '{"a2uiMeta":{"ask":{"surfaceId":"main"}}}\nPick one.', call: [surface(VALID)] }])
    expect(finalMeta(await run(intentOf('ask me to confirm', session), reused.provider)).ask).toBeUndefined()
  })
})

describe('a2ui disabled', () => {
  it('RTS-R1 AC1: a2uiEnabled false offers no tool and the request keeps exactly its pre-RTS keys', async () => {
    const { provider, reqs } = scripted([{ text: 'Plain.' }])
    await run(NEUTRAL, provider, { a2uiEnabled: false })
    const req = reqs()[0]!
    expect(Object.keys(req)).toEqual(['model', 'system', 'messages', 'effort', 'onEvent', 'tools', 'executeTool', 'signal'])
    expect(req.tools).toBeUndefined()
    expect(req.executeTool).toBeUndefined()
  })

  it('relays the caller tool pair unchanged, by identity', async () => {
    const tools = [CALC]
    const callerExec: ExecuteTool = async () => '3'
    const { provider, reqs } = scripted([{ text: 'Plain.' }])
    await run(NEUTRAL, provider, { a2uiEnabled: false, tools, executeTool: callerExec })
    const req = reqs()[0]!
    expect(req.tools).toBe(tools)
    expect(req.executeTool).toBe(callerExec)
    expect('terminalTools' in req).toBe(false)
    expect('toolChoice' in req).toBe(false)
  })

  it('a render_surface call on a disabled turn ships no surface', async () => {
    const callerExec = vi.fn<ExecuteTool>(async () => 'caller')
    const { provider } = scripted([{ text: 'Plain.', call: [surface(VALID)] }])
    const lines = await run(NEUTRAL, provider, { a2uiEnabled: false, tools: [CALC], executeTool: callerExec })
    expect(callerExec).toHaveBeenCalledTimes(1)
    expect(contentOf(lines)).toEqual([])
  })
})
