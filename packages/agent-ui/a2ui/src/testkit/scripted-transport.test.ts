// scripted-transport.test.ts: the kit's scripted AgentTransport (tools/testkit/scripted-transport.ts, T-0011).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { armOffline } from '../../tools/testkit/offline.ts'
import { createScriptedTransport } from '../../tools/testkit/scripted-transport.ts'
import { parseScenarioDoc, ScenarioError } from '../../tools/testkit/scenario.ts'
import type { TurnInput } from '../agent/agent-transport.ts'
import { readMetaLine } from '../agent/meta-line.ts'

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

const kitRaw = import.meta.glob('../../tools/testkit/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const session = { turns: [] }
const intent = (text: string): TurnInput => ({ kind: 'intent', text, session })
const click = (name: string): TurnInput => ({
  kind: 'client',
  session,
  message: { version: 'v1.0', action: { surfaceId: 's', actionId: 'a', name, sourceComponentId: 'b', timestamp: 't', context: {} } },
})

async function pull(t: { turn(i: TurnInput): AsyncIterable<string> }, input: TurnInput): Promise<string[]> {
  const out: string[] = []
  for await (const line of t.turn(input)) out.push(line)
  return out
}

const scenario = parseScenarioDoc({
  kind: 'agent-ui-a2ui-scenario',
  version: 1,
  name: 'replay',
  catalogId: 'agent-ui',
  intent: 'start',
  turns: [
    { respond: { lines: ['L0a', 'L0b'] } },
    { match: { actionName: 'go' }, respond: { lines: ['L1'] } },
    { intent: 'oops', respond: { error: 'upstream down' } },
  ],
})

describe('createScriptedTransport', () => {
  it('replays the turns in order, an error arm as one terminal error meta-line', async () => {
    const t = createScriptedTransport(scenario)
    expect(await pull(t, intent('start'))).toEqual(['L0a', 'L0b'])
    expect(await pull(t, click('go'))).toEqual(['L1'])
    const err = await pull(t, intent('oops'))
    expect(err).toHaveLength(1)
    expect(readMetaLine(err[0]!)?.a2uiMeta.error).toBe('upstream down')
    expect(t.log).toEqual([])
    expect(t.pulled).toBe(3)
  })

  it('an unmatched input yields an error line and SCRIPT_UNMATCHED', async () => {
    const t = createScriptedTransport(scenario)
    await pull(t, intent('start'))
    const lines = await pull(t, click('stop'))
    expect(readMetaLine(lines[0]!)?.a2uiMeta.error).toContain('SCRIPT_UNMATCHED')
    expect(t.log.map((f) => `${f.layer}:${f.code}`)).toEqual(['integration:SCRIPT_UNMATCHED'])
  })

  it('a pull past the last turn yields SCRIPT_EXHAUSTED', async () => {
    const t = createScriptedTransport(scenario)
    for (const input of [intent('start'), click('go'), intent('oops'), intent('again')]) await pull(t, input)
    expect(t.log.map((f) => f.code)).toEqual(['SCRIPT_EXHAUSTED'])
  })

  it('a rounds turn without a produceTurn is a ScenarioError; with one, its findings land in log', async () => {
    const rounds = parseScenarioDoc({
      kind: 'agent-ui-a2ui-scenario', version: 1, name: 'r', catalogId: 'agent-ui', intent: 'x',
      turns: [{ respond: { rounds: ['raw'] } }],
    })
    await expect(pull(createScriptedTransport(rounds), intent('x'))).rejects.toBeInstanceOf(ScenarioError)
    const t = createScriptedTransport(rounds, {
      produceTurn: async (_input, turn, i) => ({ lines: [`produced ${i} ${turn.respond.rounds.length}`], findings: [{ layer: 'producer', code: 'PRODUCE_HALT' }] }),
    })
    expect(await pull(t, intent('x'))).toEqual(['produced 0 1'])
    expect(t.log.map((f) => f.code)).toEqual(['PRODUCE_HALT'])
  })

  it("scripted-transport.ts's import closure holds no produce.ts, producer-leg.ts or system-prompt.ts", () => {
    const seen = new Set<string>()
    const walk = (file: string): void => {
      if (seen.has(file)) return
      seen.add(file)
      const src = kitRaw[file]
      if (src === undefined) return // outside the kit dir: checked by name below
      for (const m of src.matchAll(/from\s+'(\.\/[^']+)'/g)) walk(`../../tools/testkit/${m[1]!.slice(2)}`)
      for (const m of src.matchAll(/from\s+'([^']+)'/g)) {
        expect(m[1], `${file} imports ${m[1]}`).not.toMatch(/(^|\/)(produce|producer-leg|system-prompt)\.ts$/)
      }
    }
    walk('../../tools/testkit/scripted-transport.ts')
    expect(seen.size).toBeGreaterThan(2)
  })
})
