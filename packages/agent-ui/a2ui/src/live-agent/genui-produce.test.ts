// genui-produce.test.ts — genui-surface.spec.md SPEC-R1 AC2/AC3, SPEC-R2 AC3: `produce()`'s peel-before-
// heal/validate for the reserved genui wire kind. Deterministic, no live model (the `produce-loop.test.ts`
// stub-provider precedent).

import { describe, it, expect } from 'vitest'
import { produce, ProduceHalt } from '../agent/produce.ts'
import type { ProduceDeps } from '../agent/produce.ts'
import type { AgentProvider, TurnInput } from '../agent/agent-transport.ts'
import { readMetaLine } from '../agent/meta-line.ts'
import { readGenuiLine, isGenuiLine } from '../agent/genui-line.ts'
import { validateA2ui } from '../renderer/validate.ts'
import { defaultCatalog } from '../catalog/default/index.ts'

function stubProvider(outputs: string[]): { provider: AgentProvider; calls: () => number } {
  let n = 0
  const provider: AgentProvider = {
    async *stream() {
      const out = outputs[Math.min(n, outputs.length - 1)]!
      n += 1
      yield out
    },
  }
  return { provider, calls: () => n }
}

const intent: TurnInput = { kind: 'intent', text: 'show me a chart', session: { turns: [] } }
const GENUI_LINE = '{"genui":{"surfaceId":"q3","html":"<p>chart</p>"}}'
const VALID_A2UI =
  '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
  '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Button","label":"Hi","action":{"action":"submit"}}]}}'
const INVALID_A2UI =
  '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
  '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"NotARealComponent"}]}}'

describe('produce() genui peel — the ONE reserved-kind peel, before heal/validate (SPEC-R1 AC2)', () => {
  it('peels a meta-line + genui line + valid A2UI lines: the genui line ships intact, A2UI validates exactly as before', async () => {
    const raw = `{"a2uiMeta":{"note":"here you go"}}\n${GENUI_LINE}\n${VALID_A2UI}`
    const { provider } = stubProvider([raw])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    const genui = lines.find((l) => isGenuiLine(l))
    expect(genui).toBe(GENUI_LINE) // ships INTACT — the model's own line, byte-for-byte
    expect(readGenuiLine(genui!)).toEqual({ genui: { surfaceId: 'q3', html: '<p>chart</p>' } })

    const meta = lines.find((l) => readMetaLine(l)?.a2uiMeta.note !== undefined)
    expect(readMetaLine(meta!)!.a2uiMeta.note).toBe('here you go')

    const a2uiLines = lines.filter((l) => !isGenuiLine(l) && readMetaLine(l) === undefined)
    expect(a2uiLines).toHaveLength(2)
    expect(validateA2ui(a2uiLines.map((l) => JSON.parse(l)), defaultCatalog).valid).toBe(true)
  })

  it('a genui-only turn (zero A2UI lines) is a CLEAN success — never a ProduceHalt', async () => {
    const raw = `{"a2uiMeta":{"note":"just a chart this time"}}\n${GENUI_LINE}`
    const { provider } = stubProvider([raw])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)
    expect(lines.some((l) => isGenuiLine(l))).toBe(true)
    expect(lines).toHaveLength(2) // the meta-line + the genui line, nothing else
  })

  it('a malformed genui candidate feeds back ONE bounded round; on exhaustion it is DROPPED while the note/A2UI lines ship (never a ProduceHalt)', async () => {
    const malformed = '{"genui":{"surfaceId":"","html":"<p>bad</p>"}}' // empty surfaceId — structurally invalid
    const round1 = `{"a2uiMeta":{"note":"here"}}\n${malformed}\n${VALID_A2UI}`
    // The model does NOT correct the genui envelope on round 2 either (it just resends the same valid A2UI) —
    // exhaustion of the genui-specific budget must still ship the (valid) A2UI content, never ProduceHalt.
    const round2 = `{"a2uiMeta":{"note":"here again"}}\n${malformed}\n${VALID_A2UI}`
    const { provider } = stubProvider([round1, round2])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    // Round 1 already ships (A2UI is valid there) — genui is silently dropped on an otherwise-successful
    // round, per the "never manufacture an extra round purely for genui" law.
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)
    expect(lines.some((l) => isGenuiLine(l))).toBe(false) // never shipped — it was structurally invalid
    const a2uiLines = lines.filter((l) => readMetaLine(l) === undefined)
    expect(validateA2ui(a2uiLines.map((l) => JSON.parse(l)), defaultCatalog).valid).toBe(true)
  })

  it('a genui structural failure hitching a ride on an A2UI retry never causes a ProduceHalt on its own', async () => {
    const malformed = '{"genui":{"surfaceId":"x"}}' // missing html — structurally invalid
    // Round 1: BOTH genui and A2UI are invalid — this round retries anyway (for the A2UI reason), and the
    // genui failure code rides the SAME feedback message.
    const round1 = `{"a2uiMeta":{"note":"here"}}\n${malformed}\n${INVALID_A2UI}`
    // Round 2: A2UI is corrected; genui is STILL malformed but must not block shipping.
    const round2 = `{"a2uiMeta":{"note":"fixed"}}\n${malformed}\n${VALID_A2UI}`
    const { provider, calls } = stubProvider([round1, round2])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)
    expect(calls()).toBe(2)
    expect(lines.some((l) => isGenuiLine(l))).toBe(false)
    const a2uiLines = lines.filter((l) => readMetaLine(l) === undefined)
    expect(validateA2ui(a2uiLines.map((l) => JSON.parse(l)), defaultCatalog).valid).toBe(true)
  })

  it('two genui lines in one raw turn: only the FIRST ships, GENUI_MULTIPLICITY lands on the trace', async () => {
    const secondGenui = '{"genui":{"surfaceId":"q4","html":"<p>second</p>"}}'
    const raw = `{"a2uiMeta":{"note":"two charts, only one counts"}}\n${GENUI_LINE}\n${secondGenui}\n${VALID_A2UI}`
    const { provider } = stubProvider([raw])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    const genuiLines = lines.filter((l) => isGenuiLine(l))
    expect(genuiLines).toEqual([GENUI_LINE]) // only the first ships
    const meta = lines.find((l) => readMetaLine(l)?.a2uiMeta.trace !== undefined)
    expect(readMetaLine(meta!)!.a2uiMeta.trace!.failureCodes).toContain('GENUI_MULTIPLICITY')
  })

  it('an over-cap genui html is rejected whole and never rendered/shipped (SPEC-R2 AC3)', async () => {
    const overCapHtml = 'a'.repeat(524_288 + 1)
    const oversize = JSON.stringify({ genui: { surfaceId: 'q5', html: overCapHtml } })
    const raw = `{"a2uiMeta":{"note":"oversize chart"}}\n${oversize}\n${VALID_A2UI}`
    const { provider } = stubProvider([raw])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)
    expect(lines.some((l) => isGenuiLine(l))).toBe(false) // dropped, never truncated-and-shipped
    const a2uiLines = lines.filter((l) => readMetaLine(l) === undefined)
    expect(validateA2ui(a2uiLines.map((l) => JSON.parse(l)), defaultCatalog).valid).toBe(true)
  })

  it('a genui candidate NEVER reaches the shared validator/healer — a malformed one does not cost a PARSE round on its own', async () => {
    // Zero A2UI content, only a malformed genui candidate + a note: this must ship as a clean note-only
    // success (genui silently dropped), never a PARSE-triggered retry loop (which would eventually halt).
    const malformed = '{"genui":"not-an-object"}'
    const raw = `{"a2uiMeta":{"note":"nothing else this turn"}}\n${malformed}`
    const { provider, calls } = stubProvider([raw])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)
    expect(calls()).toBe(1) // shipped on the FIRST round — never retried
    expect(lines.some((l) => isGenuiLine(l))).toBe(false)
    expect(readMetaLine(lines[0]!)?.a2uiMeta.note).toBe('nothing else this turn')
  })

  it('a genui envelope fed directly to dispatch() routes to VERSION_UNSUPPORTED, returned not thrown (SPEC-R1 AC3, defense-in-depth)', async () => {
    const { dispatch } = await import('../renderer/dispatch.ts')
    const genuiEnvelope = JSON.parse(GENUI_LINE) as unknown as import('../protocol.ts').A2uiServerMessage
    const result = dispatch(genuiEnvelope, {
      createSurface: () => {},
      updateComponents: () => {},
      updateDataModel: () => {},
      deleteSurface: () => {},
      callFunction: () => {},
    } as unknown as import('../renderer/dispatch.ts').DispatchHandlers)
    expect(result).toBeDefined()
    expect(result?.code).toBe('VERSION_UNSUPPORTED')
  })
})

describe('ProduceHalt still fires on a genuinely invalid A2UI payload — genui never masks a real halt', () => {
  it('genui absent entirely: an always-invalid A2UI provider still halts (unaffected by this feature)', async () => {
    const { provider } = stubProvider([INVALID_A2UI])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    await expect(async () => {
      for await (const _line of produce(intent, deps, { maxRounds: 2 })) {
        /* drain */
      }
    }).rejects.toThrow(ProduceHalt)
  })
})
