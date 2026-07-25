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

interface CapturedReq {
  messages: { role: string; content: string }[]
}

function stubProvider(outputs: string[]): { provider: AgentProvider; calls: () => number; reqs: () => CapturedReq[] } {
  let n = 0
  const captured: CapturedReq[] = []
  const provider: AgentProvider = {
    async *stream(req) {
      captured.push({ messages: req.messages.map((m) => ({ role: m.role, content: m.content })) })
      const out = outputs[Math.min(n, outputs.length - 1)]!
      n += 1
      yield out
    },
  }
  return { provider, calls: () => n, reqs: () => captured }
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

  // Renamed from an earlier draft titled "feeds back ONE bounded round" — an independent review caught
  // that THIS scenario ships on round 1 (A2UI is already valid there), so nothing here ever exercises a
  // retry/feedback round at all. That behavior is its own, separate, STRENGTHENED test below. This one
  // covers what it actually demonstrates: a genui failure on an otherwise-successful round is dropped
  // from the wire AND its code still lands on the trace (SPEC-N4's "every drop path is observable").
  it('a malformed genui candidate on an OTHERWISE-SUCCESSFUL round is dropped silently, but its code lands on the trace (SPEC-N4)', async () => {
    const malformed = '{"genui":{"surfaceId":"","html":"<p>bad</p>"}}' // empty surfaceId — structurally invalid
    const raw = `{"a2uiMeta":{"note":"here"}}\n${malformed}\n${VALID_A2UI}`
    const { provider, calls } = stubProvider([raw])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)
    expect(calls()).toBe(1) // ships on round 1 — never manufactures an extra round purely for genui
    expect(lines.some((l) => isGenuiLine(l))).toBe(false) // never shipped — it was structurally invalid
    const a2uiLines = lines.filter((l) => readMetaLine(l) === undefined)
    expect(validateA2ui(a2uiLines.map((l) => JSON.parse(l)), defaultCatalog).valid).toBe(true)
    const meta = lines.find((l) => readMetaLine(l)?.a2uiMeta.trace !== undefined)
    expect(readMetaLine(meta!)!.a2uiMeta.trace!.failureCodes).toContain('GENUI_ENVELOPE')
  })

  it('a genui structural failure hitching a ride on an A2UI retry: the retry PROMPT actually carries the code, exhaustion never causes a ProduceHalt, and the shipped trace records it (SPEC-N4)', async () => {
    const malformed = '{"genui":{"surfaceId":"x"}}' // missing html — structurally invalid
    // Round 1: BOTH genui and A2UI are invalid — this round retries anyway (for the A2UI reason), and the
    // genui failure code rides the SAME feedback message (the "ONE bounded round" this test actually proves).
    const round1 = `{"a2uiMeta":{"note":"here"}}\n${malformed}\n${INVALID_A2UI}`
    // Round 2: A2UI is corrected; genui is STILL malformed but must not block shipping.
    const round2 = `{"a2uiMeta":{"note":"fixed"}}\n${malformed}\n${VALID_A2UI}`
    const { provider, calls, reqs } = stubProvider([round1, round2])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)
    expect(calls()).toBe(2)
    expect(lines.some((l) => isGenuiLine(l))).toBe(false)
    const a2uiLines = lines.filter((l) => readMetaLine(l) === undefined)
    expect(validateA2ui(a2uiLines.map((l) => JSON.parse(l)), defaultCatalog).valid).toBe(true)
    // The round-2 REQUEST actually carries round 1's fed-back GENUI_ENVELOPE code in its correction
    // prompt (messagesFor's "That output was INVALID (...)" wording) — the discriminating proof this
    // test's title promises, not merely "it shipped eventually".
    const round2Request = reqs()[1]!
    const correctionMessage = round2Request.messages[round2Request.messages.length - 1]!
    expect(correctionMessage.content).toContain('GENUI_ENVELOPE')
    // The shipped trace records the code too (SPEC-N4) — round 1's fed-back failure AND round 2's own
    // still-malformed genui both name the SAME code, so a single toContain check covers either origin.
    const meta = lines.find((l) => readMetaLine(l)?.a2uiMeta.trace !== undefined)
    expect(readMetaLine(meta!)!.a2uiMeta.trace!.failureCodes).toContain('GENUI_ENVELOPE')
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

  it('a genui candidate NEVER reaches the shared validator/healer — a malformed one does not cost a PARSE round on its own, and SPEC-N4 still records it on the trace', async () => {
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
    const parsed = readMetaLine(lines[0]!)
    expect(parsed?.a2uiMeta.note).toBe('nothing else this turn')
    // SPEC-N4 — the drop is silent on the WIRE (no genui line, no extra round) but not on the TRACE: the
    // note-only clean-success path must still record the dropped genui failure code.
    expect(parsed?.a2uiMeta.trace?.failureCodes).toContain('GENUI_ENVELOPE')
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

// genui-surface.spec.md SPEC-R8 AC2 — the FULL server-side crash site an independent review caught live:
// produce()'s OWN `queryOf`/`userContent` call `frameClientMessage(input.message)` at the TOP of every
// round (agent-transport.ts/session.ts, BEFORE any provider call) — a genuiAction TurnInput reaching this
// path with no `genuiAction` arm in `frameClientMessage` threw `TypeError: Cannot use 'in' operator to
// search for 'functionCallId' in undefined`, crashing every real turn (the dev proxy AND the Worker both
// call produce() with exactly this shape). This drives a REAL genuiAction TurnInput through the REAL
// produce() (not a stub boundary that stops short of frameClientMessage) — a regression test for the fix.
describe("produce() with a genuiAction TurnInput (genui-surface SPEC-R8 AC2) — the REAL crash site, fixed", () => {
  it('a genuiAction client turn never throws, and the model request carries surfaceId/name/payload VERBATIM', async () => {
    const genuiMessage = { genuiAction: { surfaceId: 'q3-revenue', name: 'rate', payload: { stars: 5 } } }
    // Capture the ACTUAL request `produce()` sends the provider — the real proof `queryOf`/`userContent`
    // (which call `frameClientMessage` internally, the exact crash site) completed successfully and the
    // framed text reached the model, not a separate/parallel frameClientMessage call this test invents.
    const captured: { messages: { role: string; content: string }[] }[] = []
    const provider: AgentProvider = {
      async *stream(req) {
        captured.push({ messages: req.messages.map((m) => ({ role: m.role, content: m.content })) })
        yield VALID_A2UI
      },
    }
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const genuiActionInput: TurnInput = { kind: 'client', message: genuiMessage, session: { turns: [] } }
    const lines: string[] = []
    // No `expect(fn).not.toThrow()` wrapper (a footgun on an async callback — it never actually awaits the
    // rejection, so it passes trivially either way): if `produce()` throws, this `for await` rejects the
    // enclosing `it`'s own promise directly, failing the test with the real error.
    for await (const line of produce(genuiActionInput, deps, { maxRounds: 3 })) lines.push(line)
    const userTurn = captured[0]!.messages.find((m) => m.role === 'user')!
    expect(userTurn.content).toContain('q3-revenue')
    expect(userTurn.content).toContain('rate')
    expect(userTurn.content).toContain(JSON.stringify({ stars: 5 }))
    const a2uiLines = lines.filter((l) => readMetaLine(l) === undefined && !isGenuiLine(l))
    expect(validateA2ui(a2uiLines.map((l) => JSON.parse(l)), defaultCatalog).valid).toBe(true)
  })

  it('a genuiAction turn with NO payload never throws either', async () => {
    const { provider } = stubProvider([VALID_A2UI])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const input: TurnInput = { kind: 'client', message: { genuiAction: { surfaceId: 'widget', name: 'ping' } }, session: { turns: [] } }
    for await (const _line of produce(input, deps, { maxRounds: 3 })) {
      /* drain — a throw here fails the test directly */
    }
  })
})
