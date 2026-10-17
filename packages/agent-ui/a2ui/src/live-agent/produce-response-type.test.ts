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
import type { SemanticCheck } from '../catalog/semantic-check.ts'

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
const objects = (jsonl: string): Record<string, unknown>[] => jsonl.split('\n').map((l) => JSON.parse(l) as Record<string, unknown>)
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

  it('T-0194: a tool round with no text ships the tool `reply` as the note; text in the channel wins over it', async () => {
    const silent = scripted([{ text: '', call: [{ name: 'render_surface', input: { reply: ' Pull up a chair. ', jsonl: VALID } }] }])
    const lines = await run(NEUTRAL, silent.provider)
    expect(finalMeta(lines).note).toBe('Pull up a chair.')
    expect(contentOf(lines)).toHaveLength(VALID.split('\n').length)

    const spoken = scripted([{ text: 'Here is your card.', call: [{ name: 'render_surface', input: { reply: 'Ignored.', jsonl: VALID } }] }])
    expect(finalMeta(await run(NEUTRAL, spoken.provider)).note).toBe('Here is your card.')

    const bare = scripted([{ text: '', call: [surface(VALID)] }])
    expect((await run(NEUTRAL, bare.provider)).map(metaOf).some((m) => m?.note !== undefined)).toBe(false)
  })

  it('T-0213: a meta-line written as the tool `reply` is read as one (note and ask), never shipped as JSON prose', async () => {
    const reply = '{"a2uiMeta":{"note":"Seven-card stud it is. Set your stake below.","ask":{"surfaceId":"ask-1"}}}'
    const { provider } = scripted([{ text: '', call: [{ name: 'render_surface', input: { reply, jsonl: ASK_VALID } }] }])
    const meta = finalMeta(await run(NEUTRAL, provider))
    expect(meta.note).toBe('Seven-card stud it is. Set your stake below.')
    expect(meta.ask).toEqual({ surfaceId: 'ask-1' })
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

  it('the user turn names the open surfaces of the session; the tool description stays stable (T-0206)', async () => {
    const session = appendAssistantTurn(appendUserTurn({ turns: [] }, 'a submit button'), VALID)
    const { provider, reqs } = scripted([{ text: 'Sure.' }])
    await run(intentOf('add a caption', session), provider)
    const req = reqs()[0]!
    expect(req.messages.at(-1)!.content).toBe('add a caption\n\n[Open surfaces: main.]')
    const tool = req.tools!.find((t) => t.name === 'render_surface')!
    expect(tool.description).not.toContain('Open surfaces')
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
    expect(lastUserMessage(reqs()[1]!)).toContain('Call render_surface again with the COMPLETE corrected `messages`')
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
    expect(feedback).toContain('Call render_surface again with the COMPLETE corrected `messages`; keep your reply text addressed to the user.')
    // T-0217: the user never saw the rejected round, so the repaired reply carries no correction note or id.
    expect(feedback).toContain('The user never saw the rejected surface: write the reply as your first, with no correction note and no surface id.')
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

// T-0172: the Croupier and Concierge traces of 2026-10-14, keyless. Each case is red on the pre-T-0172 loop.
describe('T-0172: structured render_surface, prose routing, surface loss', () => {

  it('render_surface `messages` (an array of message objects) is the payload: no hand-escaped JSONL string, no PARSE round', async () => {
    const { provider, calls } = scripted([{ text: 'Here it is.', call: [{ name: 'render_surface', input: { messages: objects(VALID) } }] }])
    const lines = await run(NEUTRAL, provider)
    expect(calls()).toBe(1)
    expect(contentOf(lines)).toEqual(VALID.split('\n'))
    expect(finalMeta(lines).note).toBe('Here it is.')
  })

  it('a PARSE on a render_surface round reminds the model `messages` is an array of objects, not the JSONL line rules', async () => {
    const { provider, reqs } = scripted([
      { text: 'One moment.', call: [{ name: 'render_surface', input: { jsonl: '{"version":"v1.0","createSurface":{"surfaceId":"main"' } }] },
      { text: 'One moment.', call: [{ name: 'render_surface', input: { messages: objects(VALID) } }] },
    ])
    await run(NEUTRAL, provider)
    const feedback = lastUserMessage(reqs()[1]!)
    expect(feedback).toMatch(/`messages` is an ARRAY of A2UI message objects/)
    expect(feedback).not.toMatch(/SINGLE line/)
  })

  it('A2UI lines written into the prose (Haiku 5.5) route as the payload: never a textDelta, never in the note', async () => {
    const prose = `Blackjack it is.\n\n${ASK_VALID}\n`
    const { provider, calls } = scripted([{ text: ['{"a2uiMeta":{"note":"x","ask":{"surfaceId":"ask-1"}}}\n', 'Blackjack it is.\n\n', `${ASK_VALID}\n`] }])
    const lines = await run(NEUTRAL, provider)
    expect(calls()).toBe(1)
    expect(contentOf(lines)).toEqual(ASK_VALID.split('\n'))
    const meta = finalMeta(lines)
    expect(meta.note).toBe('Blackjack it is.')
    expect(meta.ask).toEqual({ surfaceId: 'ask-1' })
    expect(meta.trace?.failureCodes).toEqual(['TEXT_JSONL_ROUTED'])
    expect(deltasOf(lines).join('')).not.toContain('"version"')
    expect(prose).toContain('"version"') // the control: the lines were in the prose
  })

  it('fenced A2UI lines in the prose route too, and the empty fence leaves the reply', async () => {
    const { provider } = scripted([{ text: `Here you go.\n\`\`\`json\n${VALID}\n\`\`\`\n` }])
    const lines = await run(NEUTRAL, provider)
    expect(contentOf(lines)).toEqual(VALID.split('\n'))
    expect(finalMeta(lines).note).toBe('Here you go.')
  })

  it('a routed payload that fails is repaired with the render_surface wording, and degrades to its prose at the bound', async () => {
    const { provider, reqs } = scripted([{ text: `Sure.\n${INVALID}` }])
    const lines = await run(NEUTRAL, provider)
    expect(lastUserMessage(reqs()[1]!)).toContain('Call render_surface again')
    expect(contentOf(lines)).toEqual([])
    expect(finalMeta(lines).note).toBe('Sure.')
    expect(finalMeta(lines).trace?.failureCodes).toContain('SURFACE_DEGRADED')
  })

  // The Concierge turn after "hello": round 1 sent a new ask-1 beside a failing change to the open greet-1;
  // round 2 fixed greet-1 and dropped ask-1, and the turn "passed" with the requested form lost.
  const greetSession: Session = {
    turns: [
      { role: 'user', content: 'hello' },
      {
        role: 'assistant',
        content:
          '{"version":"v1.0","createSurface":{"surfaceId":"greet-1","catalogId":"agent-ui"}}\n' +
          '{"version":"v1.0","updateComponents":{"surfaceId":"greet-1","components":[{"id":"root","component":"Column","children":["prompt"]},{"id":"prompt","component":"Text","text":"Hi"}]}}',
      },
    ],
  }
  const BAD_GREET = '{"version":"v1.0","updateComponents":{"surfaceId":"greet-1","components":[{"id":"prompt","component":"NotARealComponent"}]}}'
  const GOOD_GREET = '{"version":"v1.0","updateComponents":{"surfaceId":"greet-1","components":[{"id":"prompt","component":"Text","text":"Below."}]}}'

  it('a repair round that fixes one surface and drops a new one the failures never named is SURFACE_DROPPED, and the next round ships both', async () => {
    const { provider, reqs, calls } = scripted([
      { text: 'Booking.', call: [surface(`${BAD_GREET}\n${ASK_VALID}`)] },
      { text: 'Booking.', call: [surface(GOOD_GREET)] },
      { text: 'Booking.', call: [surface(`${GOOD_GREET}\n${ASK_VALID}`)] },
    ])
    const lines = await run(intentOf('book a table', greetSession), provider)
    expect(calls()).toBe(3)
    expect(lastUserMessage(reqs()[1]!)).toMatch(/Keep `ask-1` exactly as you sent it/)
    expect(lastUserMessage(reqs()[2]!)).toMatch(/SURFACE_DROPPED at ask-1/)
    expect(contentOf(lines)).toEqual([GOOD_GREET, ...ASK_VALID.split('\n')])
  })

  it('a surface still dropped on the last round halts with SURFACE_DROPPED, never a passed turn', async () => {
    const { provider } = scripted([
      { text: 'Booking.', call: [surface(`${BAD_GREET}\n${ASK_VALID}`)] },
      { text: 'Booking.', call: [surface(GOOD_GREET)] },
    ])
    await expect(run(intentOf('book a table', greetSession), provider, { maxRounds: 2 })).rejects.toThrow(/SURFACE_DROPPED at ask-1/)
  })

  // T-0317 (Kim's L1 ruling, 2026-10-16): a surface that existed in the turn is kept or explicitly deleted, so the
  // T-0172 allowance to drop a surface the failures name is gone (only a bare createSurface, never a surface, may go).
  const ASK2_VALID = ASK_VALID.replace(/ask-1/g, 'ask-2')
  const ASK2_INVALID = INVALID.replace(/main/g, 'ask-2')
  const ASK2_DELETE = '{"version":"v1.0","deleteSurface":{"surfaceId":"ask-2"}}'
  /** A root listing a child no component defines: IDGRAPH `root->gone`, a path naming no surface. */
  const brokenAsk = (sid: string): string =>
    `{"version":"v1.0","createSurface":{"surfaceId":"${sid}","catalogId":"agent-ui"}}\n` +
    `{"version":"v1.0","updateComponents":{"surfaceId":"${sid}","components":[{"id":"root","component":"Column","children":["gone"]}]}}`

  it('T-0317: a surface the failures name and a later round drops is sent back as SURFACE_DROPPED, and the next round ships both', async () => {
    const { provider, reqs, calls } = scripted([
      { text: 'Booking.', call: [surface(`${GOOD_GREET}\n${ASK2_INVALID}`)] },
      { text: 'Booking.', call: [surface(GOOD_GREET)] },
      { text: 'Booking.', call: [surface(`${GOOD_GREET}\n${ASK2_VALID}`)] },
    ])
    const lines = await run(intentOf('book a table', greetSession), provider)
    expect(calls()).toBe(3)
    expect(lastUserMessage(reqs()[2]!)).toMatch(/SURFACE_DROPPED at ask-2/)
    expect(contentOf(lines)).toEqual([GOOD_GREET, ...ASK2_VALID.split('\n')])
  })

  it('T-0317: a failure-named surface the repair explicitly deletes is kept by the invariant, so the round ships', async () => {
    const { provider, calls } = scripted([
      { text: 'Booking.', call: [surface(`${GOOD_GREET}\n${ASK2_INVALID}`)] },
      { text: 'Booking.', call: [surface(`${GOOD_GREET}\n${ASK2_DELETE}`)] },
    ])
    const lines = await run(intentOf('book a table', greetSession), provider)
    expect(calls()).toBe(2)
    expect(contentOf(lines)).toEqual([GOOD_GREET, ASK2_DELETE])
  })

  it('T-0317: an id-graph path is pinned to the surface whose component lists the child, so the repair keeps the valid one', async () => {
    const { provider, reqs, calls } = scripted([
      { text: 'Booking.', call: [surface(`${brokenAsk('ask-1')}\n${ASK2_VALID}`)] },
      { text: 'Booking.', call: [surface(ASK_VALID)] },
      { text: 'Booking.', call: [surface(`${ASK_VALID}\n${ASK2_VALID}`)] },
    ])
    const lines = await run(intentOf('book a table'), provider)
    expect(calls()).toBe(3)
    expect(lastUserMessage(reqs()[1]!)).toMatch(/Keep `ask-2` exactly as you sent it/)
    expect(lastUserMessage(reqs()[1]!)).not.toMatch(/Keep `ask-1`/)
    expect(lastUserMessage(reqs()[2]!)).toMatch(/SURFACE_DROPPED at ask-2/)
    expect(contentOf(lines)).toEqual([...ASK_VALID.split('\n'), ...ASK2_VALID.split('\n')])
  })

  it('T-0317: a round sent back only for SURFACE_DROPPED still has its own valid surface named in the keep hint', async () => {
    const { provider, reqs, calls } = scripted([
      { text: 'Booking.', call: [surface(`${ASK_VALID}\n${brokenAsk('ask-2')}`)] },
      { text: 'Booking.', call: [surface(ASK2_VALID)] },
      { text: 'Booking.', call: [surface(`${ASK_VALID}\n${ASK2_VALID}`)] },
    ])
    const lines = await run(intentOf('book a table'), provider)
    expect(calls()).toBe(3)
    expect(lastUserMessage(reqs()[1]!)).toMatch(/Keep `ask-1` exactly as you sent it/)
    expect(lastUserMessage(reqs()[2]!)).toMatch(/SURFACE_DROPPED at ask-1/)
    expect(lastUserMessage(reqs()[2]!)).toMatch(/Keep `ask-2` exactly as you sent it/)
    expect(contentOf(lines)).toEqual([...ASK_VALID.split('\n'), ...ASK2_VALID.split('\n')])
  })

  // T-0328 (Kim 2026-10-17, amends T-0317): a surface rebuilt under a new id within the turn is not a drop; only one that
  // would have shipped counts (round 9 :1, cluster A). A surface is protected once some round built it with no failure
  // naming it alone; each id a round builds for the first time retires one surface every building round flagged.
  // Narration, FEED_SCOPE and unattributable paths flag nothing.
  const ASK1_INVALID = INVALID.replace(/main/g, 'ask-1')
  /** A valid Column surface. */
  const column = (sid: string): string =>
    `{"version":"v1.0","createSurface":{"surfaceId":"${sid}","catalogId":"agent-ui"}}\n` +
    `{"version":"v1.0","updateComponents":{"surfaceId":"${sid}","components":[{"id":"root","component":"Column","children":["t"]},{"id":"t","component":"Text","text":"Hi"}]}}`
  /** A Row surface whose child is an unknown type: CATALOG at `g`, a path that names this surface alone. */
  const badRow = (sid: string): string =>
    `{"version":"v1.0","createSurface":{"surfaceId":"${sid}","catalogId":"agent-ui"}}\n` +
    `{"version":"v1.0","updateComponents":{"surfaceId":"${sid}","components":[{"id":"root","component":"Row","children":["g"]},{"id":"g","component":"NotARealComponent"}]}}`
  const halted = (p: Promise<unknown>): Promise<unknown> =>
    p.then(
      () => undefined,
      (e: unknown) => e,
    )

  it('T-0328: a flagged surface that never shipped, rebuilt under a new id in the same turn, is not SURFACE_DROPPED', async () => {
    const { provider, calls } = scripted([
      { text: 'Booking.', call: [surface(brokenAsk('ask-1'))] },
      { text: 'Booking.', call: [surface(column('ask-2'))] },
    ])
    const lines = await run(intentOf('book a table'), provider, { maxRounds: 2 })
    expect(calls()).toBe(2)
    expect(contentOf(lines)).toEqual(column('ask-2').split('\n'))
    expect(finalMeta(lines).trace?.failureCodes).not.toContain('SURFACE_DROPPED')
  })

  it('T-0328: a rename that needs a second repair round ships', async () => {
    const { provider, calls } = scripted([
      { text: 'Booking.', call: [surface(brokenAsk('ask-1'))] },
      { text: 'Booking.', call: [surface(brokenAsk('table-1'))] },
      { text: 'Booking.', call: [surface(column('table-1'))] },
    ])
    const lines = await run(intentOf('book a table'), provider)
    expect(calls()).toBe(3)
    expect(contentOf(lines)).toEqual(column('table-1').split('\n'))
  })

  it('T-0328: a surface that would have shipped and disappears is still SURFACE_DROPPED beside a flagged one', async () => {
    const { provider } = scripted([
      { text: 'Booking.', call: [surface(`${ASK_VALID}\n${brokenAsk('ask-2')}`)] },
      { text: 'Booking.', call: [surface(column('ask-3'))] },
    ])
    const err = await halted(run(intentOf('book a table'), provider, { maxRounds: 2 }))
    expect(err).toBeInstanceOf(ProduceHalt)
    expect((err as ProduceHalt).failures).toEqual([{ code: 'SURFACE_DROPPED', path: 'ask-1' }])
  })

  it('T-0328: one new id retires one flagged surface, the earliest built, so a flagged sibling is still SURFACE_DROPPED', async () => {
    const { provider } = scripted([
      { text: 'Booking.', call: [surface(`${badRow('greet-1')}\n${brokenAsk('ask-1')}`)] },
      { text: 'Booking.', call: [surface(column('ask-2'))] },
    ])
    const err = await halted(run(intentOf('book a table'), provider, { maxRounds: 2 }))
    expect(err).toBeInstanceOf(ProduceHalt)
    expect((err as ProduceHalt).failures).toEqual([{ code: 'SURFACE_DROPPED', path: 'ask-1' }])
  })

  it('T-0328: a round that builds no new id still drops a flagged surface', async () => {
    const { provider } = scripted([
      { text: 'Booking.', call: [surface(`${brokenAsk('ask-1')}\n${column('ask-2')}`)] },
      { text: 'Booking.', call: [surface(column('ask-2'))] },
    ])
    const err = await halted(run(intentOf('book a table'), provider, { maxRounds: 2 }))
    expect(err).toBeInstanceOf(ProduceHalt)
    expect((err as ProduceHalt).failures).toEqual([{ code: 'SURFACE_DROPPED', path: 'ask-1' }])
  })

  it('T-0328: a chained rename (CATALOG on ask-1, a finding on ask-2) ships the clean ask-3', async () => {
    const flag: SemanticCheck = {
      id: 'flag',
      check: ({ surfaces }) => surfaces.flatMap((v) => [...v.components.values()].filter((c) => c['text'] === 'flagged').map((c) => ({ code: 'FLAGGED', path: `${v.surfaceId}:${c.id}`, message: 'Drop the word.' }))),
    }
    const flagged = column('ask-2').replace('"text":"Hi"', '"text":"flagged"')
    const { provider, calls } = scripted([
      { text: 'Booking.', call: [surface(ASK1_INVALID)] },
      { text: 'Booking.', call: [surface(flagged)] },
      { text: 'Booking.', call: [surface(column('ask-3'))] },
    ])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog, semanticChecks: [flag] }
    const lines: string[] = []
    for await (const line of produce(intentOf('book a table'), deps, { maxRounds: 3 })) lines.push(line)
    expect(calls()).toBe(3)
    expect(contentOf(lines)).toEqual(column('ask-3').split('\n'))
  })

  it('T-0328: a CONTAINMENT failure flags its surface, so a rename ships', async () => {
    const stray =
      '{"version":"v1.0","createSurface":{"surfaceId":"ask-1","catalogId":"agent-ui"}}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"ask-1","components":[{"id":"root","component":"Column","children":["stray-header"]},{"id":"stray-header","component":"CardHeader","children":["title"]},{"id":"title","component":"Text","text":"Hi"}]}}'
    const { provider, reqs, calls } = scripted([
      { text: 'Booking.', call: [surface(stray)] },
      { text: 'Booking.', call: [surface(column('ask-2'))] },
    ])
    const lines = await run(intentOf('book a table'), provider, { maxRounds: 2 })
    expect(lastUserMessage(reqs()[1]!)).toMatch(/CONTAINMENT/)
    expect(calls()).toBe(2)
    expect(contentOf(lines)).toEqual(column('ask-2').split('\n'))
  })

  it('T-0328: a flagged ask-1, then a Row on ask-2, then a fixed ask-1 never halts', async () => {
    const { provider } = scripted([
      { text: 'Booking.', call: [surface(brokenAsk('ask-1'))] },
      { text: 'Booking.', call: [surface(column('ask-2').replace('"Column"', '"Row"'))] },
      { text: 'Booking.', call: [surface(column('ask-1'))] },
    ])
    const lines = await run(intentOf('book a table'), provider)
    expect(finalMeta(lines).trace?.failureCodes).not.toContain('SURFACE_DROPPED')
    expect(contentOf(lines).length).toBeGreaterThan(0)
  })

  it('T-0328: an unattributable genui failure beside ask-1 flags nothing, so dropping ask-1 is still SURFACE_DROPPED', async () => {
    const malformed = '{"genui":{"surfaceId":"x"}}' // missing html: GENUI_ENVELOPE, no surface path
    const { provider, reqs } = scripted([
      { text: `{"a2uiMeta":{"note":"Booking."}}\n${malformed}\n${ASK_VALID}\n${brokenAsk('ask-3')}` },
      { text: `{"a2uiMeta":{"note":"Booking."}}\n${ASK_VALID.replace(/ask-1/g, 'ask-2')}` },
    ])
    const err = await halted(run(intentOf('book a table'), provider, { maxRounds: 2 }))
    expect(lastUserMessage(reqs()[1]!)).toMatch(/GENUI_ENVELOPE/)
    expect(err).toBeInstanceOf(ProduceHalt)
    expect((err as ProduceHalt).failures).toContainEqual({ code: 'SURFACE_DROPPED', path: 'ask-1' })
  })

  it('T-0332: a narrated ask-1 is held, not rebuilt: the narration repair asks for the reply alone and ships ask-1', async () => {
    const { provider, reqs } = scripted([
      { text: 'The form is on ask-1.', call: [surface(ASK_VALID)] },
      { text: 'Booking.', call: [surface(ASK2_VALID)] },
    ])
    const lines = await run(intentOf('book a table'), provider)
    expect(lastUserMessage(reqs()[1]!)).toMatch(/NARRATED_MECHANICS/)
    expect(toolNames(reqs()[1]!)).toBeUndefined()
    expect(contentOf(lines)).toEqual(ASK_VALID.split('\n'))
  })

  it('T-0328: a flagged surface answered in prose is still SURFACE_DROPPED (nothing rebuilt it)', async () => {
    const { provider } = scripted([{ text: 'Booking.', call: [surface(ASK1_INVALID)] }, { text: 'Booking.' }])
    await expect(run(intentOf('book a table'), provider, { maxRounds: 2 })).rejects.toThrow(/SURFACE_DROPPED at ask-1/)
  })
})

// T-0229: Haiku 5.5's text shape (trace 2026-10-15.jsonl:42): the prose, then a meta-line, then wire lines. The
// meta-line is peeled wherever it sits, and an A2UI line that does not parse goes to the repair round, never the reply.
describe('T-0229: the text shape with a trailing meta-line', () => {
  const PROSE = 'You check, and the dealer checks behind you. Stand pat to keep all five.'
  const META = '{"a2uiMeta":{"note":"You check, the dealer checks.","target":{"surfaceId":"main"}}}'
  const BROKEN = '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"x","component":"Text","children":["again"]},"again":null}}'

  it('prose, a meta-line, then wire lines ships the prose as the reply and applies the meta-line target', async () => {
    const { provider, calls } = scripted([{ text: [`${PROSE}\n\n`, `${META}\n`, `${VALID}\n`] }])
    const lines = await run(NEUTRAL, provider)
    expect(calls()).toBe(1)
    expect(contentOf(lines)).toEqual(VALID.split('\n'))
    const meta = finalMeta(lines)
    expect(meta.note).toBe(PROSE)
    expect(meta.target).toEqual({ surfaceId: 'main' })
    expect(deltasOf(lines).join('')).toBe(`${PROSE}\n\n`)
  })

  it('prose then a meta-line with no wire line keeps its declarations and shows only the prose', async () => {
    const { provider } = scripted([{ text: `${PROSE}\n\n{"a2uiMeta":{"note":"No secret.","flowEnd":true}}` }])
    const lines = await run(NEUTRAL, provider)
    expect(contentOf(lines)).toEqual([])
    const meta = finalMeta(lines)
    expect(meta.note).toBe(PROSE)
    expect(meta.flowEnd).toBe(true)
    expect(deltasOf(lines).join('')).not.toContain('a2uiMeta')
  })

  it('an A2UI line that does not parse goes to the repair round and never reaches the reply', async () => {
    const { provider, reqs } = scripted([{ text: `Sure.\n${VALID}\n${BROKEN}\n` }, { text: `Sure.\n${VALID}\n` }])
    const lines = await run(NEUTRAL, provider)
    expect(reqs()).toHaveLength(2)
    expect(lastUserMessage(reqs()[1]!)).toContain('Call render_surface again')
    expect(contentOf(lines)).toEqual(VALID.split('\n'))
    expect(finalMeta(lines).note).toBe('Sure.')
    expect(deltasOf(lines).join('')).not.toContain('"version"')
  })
})

const ASK = 'Send `messages` as an array of A2UI message objects, one object per entry, not as a string or JSONL text.'

describe('T-0304: a render_surface `messages` sent as one JSON string', () => {

  it('a string that parses as an array ships the surface in one round, tallied MESSAGES_STRING_DECODED', async () => {
    const { provider, calls } = scripted([{ text: 'Here it is.', call: [{ name: 'render_surface', input: { reply: 'Here it is.', messages: JSON.stringify(objects(VALID)) } }] }])
    const lines = await run(NEUTRAL, provider)
    expect(calls()).toBe(1)
    expect(contentOf(lines)).toEqual(VALID.split('\n'))
    expect(finalMeta(lines).trace?.failureCodes).toEqual(['MESSAGES_STRING_DECODED'])
  })

  it('a string one `}` short where the next message begins is PARSE, and the repair names where it broke', async () => {
    const short = JSON.stringify(objects(VALID)).replace('"}},{"version"', '"},{"version"')
    expect(short).not.toBe(JSON.stringify(objects(VALID)))
    const { provider, calls, reqs } = scripted([
      { text: 'Here it is.', call: [{ name: 'render_surface', input: { reply: 'Here it is.', messages: short } }] },
      { text: 'Here it is.', call: [{ name: 'render_surface', input: { reply: 'Here it is.', messages: objects(VALID) } }] },
    ])
    const lines = await run(NEUTRAL, provider)
    expect(calls()).toBe(2)
    expect(lastUserMessage(reqs()[1]!)).toContain(
      `${ASK} Your \`messages\` was not valid JSON: a closing } is missing in message 1 (its createSurface), so it is still open where message 2 begins.`,
    )
    expect(contentOf(lines)).toEqual(VALID.split('\n'))
    expect(finalMeta(lines).trace?.failureCodes).toEqual(['PARSE'])
  })

  it('a string that does not parse is still PARSE; the repair asks for the array, then quotes the text at the break', async () => {
    const broken = JSON.stringify(objects(VALID)).slice(0, -2)
    const { provider, calls, reqs } = scripted([
      { text: 'One moment.', call: [{ name: 'render_surface', input: { reply: 'One moment.', messages: broken } }] },
      { text: 'One moment.', call: [{ name: 'render_surface', input: { reply: 'One moment.', messages: objects(VALID) } }] },
    ])
    const lines = await run(NEUTRAL, provider)
    expect(calls()).toBe(2)
    expect(lastUserMessage(reqs()[1]!)).toMatch(/not as a string or JSONL text\. Your `messages` was not valid JSON at character \d+ \(message \d+\), here: `[^`]*`\. /)
    expect(contentOf(lines)).toEqual(VALID.split('\n'))
    expect(finalMeta(lines).trace?.failureCodes).toEqual(['PARSE'])
  })
})

describe('T-0344: a PARSE repair on a string `messages` asks for an array first', () => {
  // Round 10 :193 round 1 (Sonnet 5.5), verbatim: one `}` short where message 2 begins; rounds 2 and 3 resent a string.
  const R10_193 =
    '[{"version":"v1.0","updateDataModel":{"surfaceId":"table-1","value":{"bankroll":940,"pot":0,"street":"Showdown","stats":[{"label":"Pot","value":0},{"label":"Net this hand","value":-60},{"label":"Street","value":"Showdown"}],"dealerHand":[{"rank":"A","suit":"spades","faceDown":false},{"rank":"K","suit":"clubs","faceDown":false}],"playerHand":[{"rank":"J","suit":"hearts","faceDown":false},{"rank":"10","suit":"hearts","faceDown":false}],"board":[{"rank":"Q","suit":"hearts","faceDown":false},{"rank":"9","suit":"diamonds","faceDown":false},{"rank":"3","suit":"hearts","faceDown":false},{"rank":"2","suit":"clubs","faceDown":false},{"rank":"7","suit":"diamonds","faceDown":false}],"result":"Dealer wins the 120 pot with ace-high (A K Q 9 7) over your queen-high (Q J 10 9 7). You lose 60 chips this hand. Bankroll: 940."}},{"version":"v1.0","updateComponents":{"surfaceId":"table-1","components":[{"id":"streetBadge","component":"Badge","label":"Showdown","intent":"danger"},{"id":"hud","component":"GameHud","title":"Heads-up vs dealer","status":"Dealer wins","statusIntent":"danger","stats":{"path":"/stats"}},{"id":"actions","component":"Row","gap":"sm","justify":"end","children":["dealBtn"]},{"id":"dealBtn","component":"Button","label":"Deal again","variant":"solid","action":{"action":"deal_again","context":{"newRound":true}}}]}]'
  const NOTE = 'Your `messages` was not valid JSON: a closing } is missing in message 1 (its updateDataModel), so it is still open where message 2 begins.'
  const AGAIN = 'You sent a string again; send `messages` as an array of A2UI message objects, one object per entry, not as a string or JSONL text.'
  const stringCall = (messages: string): Round => ({ text: 'Showdown.', call: [{ name: 'render_surface', input: { reply: 'Showdown.', target: 'table-1', messages } }] })
  const arrayCall: Round = { text: 'Showdown.', call: [{ name: 'render_surface', input: { reply: 'Showdown.', messages: objects(VALID) } }] }

  it('round 2 asks for an array of objects before it names where the string broke; round 3 says the string came again', async () => {
    const { provider, calls, reqs } = scripted([stringCall(R10_193), stringCall(R10_193), arrayCall])
    const lines = await run(NEUTRAL, provider)
    expect(calls()).toBe(3)
    const round2 = lastUserMessage(reqs()[1]!)
    expect(round2).toContain(`${ASK} ${NOTE}`)
    expect(round2).not.toContain('a string again')
    expect(round2).not.toMatch(/Reminder: `messages` is an ARRAY/)
    expect(lastUserMessage(reqs()[2]!)).toContain(`${AGAIN} ${NOTE}`)
    expect(contentOf(lines)).toEqual(VALID.split('\n'))
    expect(finalMeta(lines).trace?.failureCodes).toEqual(['PARSE'])
  })

  it('a string that parses to something other than an array (one object, a double-encoded array) gets the ask with no note', async () => {
    for (const messages of [JSON.stringify(objects(VALID)[0]), JSON.stringify(JSON.stringify(objects(VALID)))]) {
      const { provider, calls, reqs } = scripted([stringCall(messages), arrayCall])
      const lines = await run(NEUTRAL, provider)
      expect(calls()).toBe(2)
      const repair = lastUserMessage(reqs()[1]!)
      expect(repair).toContain(ASK)
      expect(repair).not.toContain('was not valid JSON')
      expect(repair).not.toMatch(/Reminder: `messages` is an ARRAY/)
      expect(contentOf(lines)).toEqual(VALID.split('\n'))
    }
  })

  it('a string JSON.parse gives no position for gets the ask and the generic note', async () => {
    const { provider, reqs } = scripted([stringCall(''), arrayCall])
    await run(NEUTRAL, provider)
    expect(lastUserMessage(reqs()[1]!)).toContain(`${ASK} Your \`messages\` was not valid JSON.`)
  })

  it('an array round keeps the old reminder (the control)', async () => {
    const { provider, reqs } = scripted([{ text: 'Hi.', call: [{ name: 'render_surface', input: { reply: 'Hi.', messages: ['{"version":"v1.0",'] } }] }, arrayCall])
    await run(NEUTRAL, provider)
    expect(lastUserMessage(reqs()[1]!)).toMatch(/Reminder: `messages` is an ARRAY of A2UI message objects/)
    expect(lastUserMessage(reqs()[1]!)).not.toContain(ASK)
  })
})

describe('T-0305: an update to a surface no message created', () => {
  // A complete tree for `main` with no createSurface: valid to the shared validator (its implicit open), never rendered.
  const ORPHAN_MAIN = '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Button","label":"Hi","action":{"action":"submit"}}]}}'
  const call = (jsonl: string): Round => ({ text: 'Here it is.', call: [{ name: 'render_surface', input: { reply: 'Here it is.', messages: objects(jsonl) } }] })

  it('a first round that updates an uncreated surface fails SURFACE_NOT_CREATED and the repair asks for createSurface', async () => {
    const { provider, calls, reqs } = scripted([call(ORPHAN_MAIN), call(VALID)])
    const lines = await run(NEUTRAL, provider)
    expect(calls()).toBe(2)
    expect(lastUserMessage(reqs()[1]!)).toMatch(/SURFACE_NOT_CREATED at main/)
    expect(lastUserMessage(reqs()[1]!)).toMatch(/createSurface/)
    expect(contentOf(lines)).toEqual(VALID.split('\n'))
    expect(finalMeta(lines).trace?.failureCodes).toEqual(['SURFACE_NOT_CREATED'])
  })

  it('a repair round that updates the surface the failed round created, with no createSurface, fails the same way', async () => {
    const { provider, calls, reqs } = scripted([call(INVALID), call(ORPHAN_MAIN), call(VALID)])
    const lines = await run(NEUTRAL, provider)
    expect(calls()).toBe(3)
    expect(lastUserMessage(reqs()[2]!)).toMatch(/SURFACE_NOT_CREATED at main/)
    expect(contentOf(lines)).toEqual(VALID.split('\n'))
    expect(finalMeta(lines).trace?.failureCodes).toEqual(['SURFACE_NOT_CREATED'])
  })

  it('an update to a surface an earlier turn created ships in one round (the control)', async () => {
    let session: Session = appendUserTurn({ turns: [] }, 'a submit button')
    session = appendAssistantTurn(session, VALID)
    const { provider, calls } = scripted([call(ORPHAN_MAIN.replace('"label":"Hi"', '"label":"Again"'))])
    const lines = await run(intentOf('change the label', session), provider)
    expect(calls()).toBe(1)
    expect(contentOf(lines)).toHaveLength(1)
  })
})
