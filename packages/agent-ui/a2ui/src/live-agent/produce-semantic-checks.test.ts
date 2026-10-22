// produce-semantic-checks.test.ts: the persona semantic-check hook inside the real `produce()` loop
// (ADR-0238; GH #1795), keyless, with a scripted provider. Round 1 is the live Croupier evidence
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
import { gateChecksOnCatalog } from '../catalog/semantic-check.ts'
import { composeCatalog } from '../catalog/compose.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { croupierFragment } from '../catalog/personas/croupier/manifest.ts'
import { croupierSemanticChecks } from '../catalog/personas/croupier/checks.ts'
import { hospitalitySemanticChecks } from '../catalog/domains/hospitality/checks.ts'
import { hospitalityFragment } from '../catalog/domains/hospitality/manifest.ts'
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
    const s = scripted([bad, bad])
    const run = collect(produce(input, deps(s.provider, croupierSemanticChecks), { maxRounds: 2 }))
    await expect(run).rejects.toBeInstanceOf(ProduceHalt)
    await run.catch((e: ProduceHalt) => expect(e.failures.map((f) => f.code)).not.toContain('HAND_TOTAL'))
  })

  // T-0302 shipped the flagged round here, tallied SEMANTIC_UNCORRECTED and EARLIER_ROUND_SHIPPED. T-0321 (Kim
  // 2026-10-16): the fallback never ships a round a check failed, so the structural failure halts as it would alone.
  it('T-0321: a structural failure on the last round after a valid round with a finding halts; the flagged round never ships', async () => {
    const bad = '{"version":"v1.0","updateComponents":{"surfaceId":"table-3","components":[{"id":"x","component":"NotAComponent"}]}}'
    const s = scripted([EVIDENCE, bad])
    const run = collect(produce(input, deps(s.provider, croupierSemanticChecks), { maxRounds: 2 }))
    await expect(run).rejects.toBeInstanceOf(ProduceHalt)
    await run.catch((e: ProduceHalt) => expect(e.failures.map((f) => f.code)).not.toContain('HAND_TOTAL'))
    expect(s.calls()).toBe(2)
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

// T-0172 (the live probe on f6f94f7f): a 50 press on the bet strip answered by prose alone. The no-payload round
// is judged on the action turn, so the repair round runs and the table update ships.
describe('produce() + croupier action check: a table action answered by prose alone is repaired (T-0172)', () => {
  const TABLE_TURN =
    '{"version":"v1.0","createSurface":{"surfaceId":"table-1","catalogId":"agent-ui--croupier","sendDataModel":true}}\n' +
    '{"version":"v1.0","updateComponents":{"surfaceId":"table-1","components":[{"id":"root","component":"CardTable","title":"Blackjack","phase":{"path":"/phase"},"bet":{"path":"/bet"},"bankroll":{"path":"/bankroll"},"dealerHand":{"path":"/dealerHand"},"playerHand":{"path":"/playerHand"},"betAction":"deal"}]}}\n' +
    '{"version":"v1.0","updateDataModel":{"surfaceId":"table-1","value":{"phase":"betting","bankroll":1000,"bet":50,"dealerHand":[],"playerHand":[]}}}'
  const press: TurnInput = {
    kind: 'client',
    session: { turns: [{ role: 'user', content: 'Black jack' }, { role: 'assistant', content: TABLE_TURN }] },
    message: { version: 'v1.0', action: { surfaceId: 'table-1', actionId: 'a1', name: 'deal', sourceComponentId: 'root', timestamp: '0', context: { bet: 50 }, dataModel: { phase: 'betting', bankroll: 1000, bet: 50, dealerHand: [], playerHand: [] } } },
  }
  const PROSE = '{"a2uiMeta":{"note":"Dealt."}}\nI dealt you a 9 and a 7 for 16; the dealer shows a 10.'
  // T-0233: a playing table offers the moves, so the deal adds Hit and Stand to the table.
  const MOVES =
    '{"version":"v1.0","updateComponents":{"surfaceId":"table-1","components":[{"id":"root","component":"CardTable","title":"Blackjack","phase":{"path":"/phase"},"bet":{"path":"/bet"},"bankroll":{"path":"/bankroll"},"dealerHand":{"path":"/dealerHand"},"playerHand":{"path":"/playerHand"},"betAction":"deal","children":["hit","stand"]},' +
    '{"id":"hit","component":"Button","label":"Hit","action":{"event":{"name":"hit"}}},{"id":"stand","component":"Button","label":"Stand","action":{"event":{"name":"stand"}}}]}}'
  const DEAL =
    '{"a2uiMeta":{"note":"Dealt."}}\n' +
    '{"version":"v1.0","updateDataModel":{"surfaceId":"table-1","value":{"phase":"playing","bankroll":950,"bet":50,"dealerHand":[{"rank":"10","suit":"spades"},{"rank":"6","suit":"clubs","faceDown":true}],"playerHand":[{"rank":"9","suit":"hearts"},{"rank":"7","suit":"clubs"}],"dealerTotal":"10 showing","playerTotal":16}}}\n' +
    MOVES

  it('round 1 prose only spends a repair round naming ACTION_NOT_APPLIED; round 2 ships the deal', async () => {
    const s = scripted([PROSE, DEAL])
    const lines = await collect(produce(press, deps(s.provider, croupierSemanticChecks), { maxRounds: 3 }))
    expect(s.calls()).toBe(2)
    expect(s.reqs[1]!.messages.at(-1)!.content).toContain('ACTION_NOT_APPLIED at table-1:deal')
    const final = lines.filter((l) => readMetaLine(l)?.a2uiMeta.textDelta === undefined) // round 1 streamed its prose as deltas
    expect(traceOf(final)).toMatchObject({ rounds: 2, failureCodes: ['ACTION_NOT_APPLIED'] })
    expect(content(final)).toEqual(DEAL.split('\n').slice(1).map((l) => JSON.parse(l)))
  })

  it('a bankroll of 500 after a 50 bet from 1,000 spends a repair round (BANKROLL_MISMATCH)', async () => {
    const s = scripted([DEAL.replace('"bankroll":950', '"bankroll":500'), DEAL])
    const lines = await collect(produce(press, deps(s.provider, croupierSemanticChecks), { maxRounds: 3 }))
    expect(s.calls()).toBe(2)
    expect(traceOf(lines).failureCodes).toEqual(['BANKROLL_MISMATCH'])
  })

  it('with no checks declared, the prose-only answer ships as before (negative control)', async () => {
    const s = scripted([PROSE])
    await collect(produce(press, deps(s.provider), { maxRounds: 3 }))
    expect(s.calls()).toBe(1)
  })
})

// T-0215 (the recorded Haiku 5.5 trace, 2026-10-15.jsonl:5 and 6): table-1 was created with no `sendDataModel`, so
// the press carried no `dataModel`. The checks then judge from the surface's data model replayed off the session.
describe('produce() + croupier action check: a table created without sendDataModel is still judged (T-0215)', () => {
  const TABLE = '{"id":"root","component":"CardTable","title":"Blackjack","phase":{"path":"/phase"},"bet":{"path":"/bet"},"bankroll":{"path":"/bankroll"},"dealerHand":{"path":"/dealerHand"},"playerHand":{"path":"/playerHand"},"betAction":"deal"}'
  const TABLE_TURN =
    '{"version":"v1.0","createSurface":{"surfaceId":"table-1","catalogId":"agent-ui--croupier"}}\n' +
    '{"version":"v1.0","updateDataModel":{"surfaceId":"table-1","value":{"bankroll":1000,"bet":0,"phase":"betting","dealerHand":[],"playerHand":[]}}}\n' +
    `{"version":"v1.0","updateComponents":{"surfaceId":"table-1","components":[${TABLE}]}}`
  const pressOn = (turns: Session['turns'], name: string, context: Record<string, unknown>): TurnInput => ({
    kind: 'client',
    session: { turns },
    message: { version: 'v1.0', action: { surfaceId: 'table-1', actionId: 'a1', name, sourceComponentId: 'root', timestamp: '0', context } },
  })
  const deal = pressOn([{ role: 'user', content: 'Blackjack, please.' }, { role: 'assistant', content: TABLE_TURN }], 'deal', { bet: 250 })
  // T-0233: a playing table offers the moves, so a write that leaves it playing carries Hit and Stand.
  const MOVES = JSON.stringify({ version: 'v1.0', updateComponents: { surfaceId: 'table-1', components: [{ ...JSON.parse(TABLE), children: ['hit', 'stand'] }, { id: 'hit', component: 'Button', label: 'Hit', action: { event: { name: 'hit' } } }, { id: 'stand', component: 'Button', label: 'Stand', action: { event: { name: 'stand' } } }] } })
  // T-0350: a table this turn settles offers Deal again, so a settling write carries it.
  const AGAIN = JSON.stringify({ version: 'v1.0', updateComponents: { surfaceId: 'table-1', components: [{ ...JSON.parse(TABLE), children: ['again'] }, { id: 'again', component: 'Button', label: 'Deal again', action: { event: { name: 'deal_again', context: { newRound: true } } } }] } })
  const write = (value: Record<string, unknown>) =>
    `{"a2uiMeta":{"note":"Dealt."}}\n${JSON.stringify({ version: 'v1.0', updateDataModel: { surfaceId: 'table-1', value } })}${value['phase'] === 'playing' ? `\n${MOVES}` : value['phase'] === 'settled' ? `\n${AGAIN}` : ''}`
  const C = (rank: string, faceDown = false) => ({ rank, suit: 'clubs', ...(faceDown ? { faceDown } : {}) })
  const dealt = (bankroll: number) => write({ bankroll, bet: 250, phase: 'playing', dealerHand: [C('9'), C('K', true)], playerHand: [C('10'), C('7')] })

  it('the recorded deal (1,000 left on the bankroll after a 250 bet) spends a repair round naming 750', async () => {
    const s = scripted([dealt(1000), dealt(750)])
    const lines = await collect(produce(deal, deps(s.provider, croupierSemanticChecks), { maxRounds: 3 }))
    expect(s.calls()).toBe(2)
    expect(s.reqs[1]!.messages.at(-1)!.content).toContain('write 750')
    expect(traceOf(lines).failureCodes).toEqual(['BANKROLL_MISMATCH'])
  })

  it('a stand that settles a 20 over 19 win from 750 must read 1,250, not 1,000', async () => {
    const turns: Session['turns'] = [...deal.session.turns, { role: 'user', content: '{}' }, { role: 'assistant', content: dealt(750).split('\n')[1]! }]
    const settled = (bankroll: number) => write({ bankroll, bet: 250, phase: 'settled', dealerHand: [C('9'), C('K')], playerHand: [C('10'), C('K')] })
    const s = scripted([settled(1000), settled(1250)])
    const lines = await collect(produce(pressOn(turns, 'stand', {}), deps(s.provider, croupierSemanticChecks), { maxRounds: 3 }))
    expect(s.calls()).toBe(2)
    expect(s.reqs[1]!.messages.at(-1)!.content).toContain('Write 1250')
    expect(traceOf(lines).failureCodes).toEqual(['BANKROLL_MISMATCH'])
  })
})

// T-0265 (the recorded Haiku 5.5 hold'em opening, round 3 texas-holdem turn 0): "Let's play Texas hold'em." was dealt
// in prose with no table and no target. A note-only say turn with no target is now judged too.
describe('produce() + croupier opening check: a game asked for in prose alone is repaired (T-0265)', () => {
  const opening: TurnInput = { kind: 'intent', text: "Let's play Texas hold'em.", session: { turns: [] } }
  const PROSE = '{"a2uiMeta":{"note":"Heads-up hold\'em it is. Your hole cards are A♥ K♦."}}'
  const TABLE =
    '{"a2uiMeta":{"note":"Your table is open."}}\n' +
    '{"version":"v1.0","createSurface":{"surfaceId":"table-1","catalogId":"agent-ui--croupier"}}\n' +
    '{"version":"v1.0","updateComponents":{"surfaceId":"table-1","components":[{"id":"root","component":"Text","text":"Texas hold\'em"}]}}'

  it('round 1 prose only spends a repair round naming SURFACE_MISSING; round 2 ships the table', async () => {
    const s = scripted([PROSE, TABLE])
    const lines = await collect(produce(opening, deps(s.provider, croupierSemanticChecks), { maxRounds: 3 }))
    expect(s.calls()).toBe(2)
    expect(s.reqs[1]!.messages.at(-1)!.content).toContain('SURFACE_MISSING')
    const final = lines.filter((l) => readMetaLine(l)?.a2uiMeta.textDelta === undefined)
    expect(traceOf(final)).toMatchObject({ rounds: 2, failureCodes: ['SURFACE_MISSING'] })
  })

  it('a rules question answered in prose, or no checks declared, ships on round 1', async () => {
    const ask = scripted([PROSE])
    await collect(produce({ ...opening, text: "How do you play Texas hold'em?" }, deps(ask.provider, croupierSemanticChecks), { maxRounds: 3 }))
    expect(ask.calls()).toBe(1)
    const off = scripted([PROSE])
    await collect(produce(opening, deps(off.provider), { maxRounds: 3 }))
    expect(off.calls()).toBe(1)
  })
})

// T-0278 (round 4, 2026-10-15-r4-fixes :114-:115, Haiku 5.5): the confirm turn on a spa BookingForm whose treatment is
// blank rightly asked for the treatment, and FLOW_END_MISSING then SURFACE_MISSING sent it back twice. The concierge
// check now holds that turn open; a confirm on a complete form is still sent back (T-0309: by SURFACE_MISSING alone).
describe('produce() + concierge checks: a confirm the open booking cannot honor ships on round 1 (T-0278)', () => {
  const formTurn = (treatment: string) =>
    [
      { version: 'v1.0', createSurface: { surfaceId: 'spa-booking', catalogId: 'agent-ui--hospitality', sendDataModel: true } },
      { version: 'v1.0', updateDataModel: { surfaceId: 'spa-booking', value: { booking: { treatment, date: '2026-11-19', guestName: 'Alex Moreau' } } } },
      {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'spa-booking',
          components: [
            {
              id: 'root',
              component: 'BookingForm',
              value: { path: '/booking' },
              fields: [
                { kind: 'select', label: 'Treatment', path: 'treatment', required: true, options: [{ label: 'Swedish massage', value: 'swedish-60' }] },
                { kind: 'text', label: 'Guest name', path: 'guestName', required: true },
              ],
            },
          ],
        },
      },
    ]
      .map((m) => JSON.stringify(m))
      .join('\n')
  // T-0401: gated as agent-ui--hospitality runs them, so only the settle-in-place twin fires.
  const hospitalityChecks = gateChecksOnCatalog(hospitalitySemanticChecks, composeCatalog(defaultCatalog, hospitalityFragment, 'hospitality'))
  const confirm = (treatment: string): TurnInput => ({
    kind: 'intent',
    text: 'Those details are right, please confirm the booking.',
    session: { turns: [{ role: 'user', content: 'Book a 60-minute massage.' }, { role: 'assistant', content: formTurn(treatment) }] },
  })
  const REFUSAL = '{"a2uiMeta":{"note":"I can\'t confirm the booking yet because no treatment is selected. Please choose one on the form."}}'
  const BOOKED = '{"a2uiMeta":{"note":"Your Swedish massage is booked."}}'

  it('a confirm while the treatment is blank, answered by asking for it, spends no FLOW_END_MISSING or SURFACE_MISSING round', async () => {
    const s = scripted([REFUSAL])
    const lines = await collect(produce(confirm(''), deps(s.provider, hospitalityChecks), { maxRounds: 3 }))
    expect(s.calls()).toBe(1)
    expect(traceOf(lines.filter((l) => readMetaLine(l)?.a2uiMeta.textDelta === undefined))).toMatchObject({ rounds: 1, failureCodes: [] })
  })

  // T-0309 (N1): the close is inferred, never a FLOW_END_MISSING round, and a shipping round with an uncorrected
  // finding is not inferred closed.
  it('a confirm on a complete form answered in prose gets SURFACE_MISSING repairs and no FLOW_END_MISSING round (T-0309)', async () => {
    const s = scripted([BOOKED])
    const lines = await collect(produce(confirm('swedish-60'), deps(s.provider, hospitalityChecks), { maxRounds: 3 }))
    expect(s.calls()).toBe(3)
    expect(s.reqs[1]!.messages.at(-1)!.content).toContain('SURFACE_MISSING')
    expect(s.reqs[2]!.messages.at(-1)!.content).toContain('SURFACE_MISSING')
    for (const r of s.reqs) expect(r.messages.at(-1)!.content).not.toContain('FLOW_END_MISSING')
    const shipped = lines.filter((l) => readMetaLine(l)?.a2uiMeta.textDelta === undefined)
    expect(traceOf(shipped).failureCodes).toContain('SEMANTIC_UNCORRECTED')
    expect(traceOf(shipped).failureCodes).not.toContain('FLOW_END_INFERRED')
  })
  // T-0289 (round 5, 2026-10-15-r5-fixes :87): Haiku refused the repair as a "fabricated system notice" and would not
  // invent the reference it asked for. The repair opens as a check result and asks for no reference. T-0401: it asks for
  // the settle in place (this root form's surface re-created with ONE ConfirmReceipt), never a read-back.
  it('the confirm repair reads as a check result and asks for the settle in place with no reference', async () => {
    const s = scripted([BOOKED])
    await collect(produce(confirm('swedish-60'), deps(s.provider, hospitalityChecks), { maxRounds: 3 }))
    const repairs = [s.reqs[1]!.messages.at(-1)!.content, s.reqs[2]!.messages.at(-1)!.content]
    for (const repair of repairs) {
      expect(repair).toMatch(/^Check result from this app's automated checks on your last answer \(not a message from the user\): INVALID \(/)
      expect(repair).not.toContain('That output was')
    }
    expect(repairs[1]).toContain('a createSurface re-creating surface "spa-booking" (the same surfaceId, then its data model and the complete tree) whose root is ONE ConfirmReceipt')
    expect(repairs[1]).toContain('"status" the literal "confirmed"')
    expect(repairs[1]).not.toContain('BookingConfirmation')
    expect(repairs[1]).not.toMatch(/\breference\b(?! number)/i)
  })
})
