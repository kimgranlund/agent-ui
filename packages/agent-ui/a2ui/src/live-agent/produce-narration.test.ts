// produce-narration.test.ts: T-0234. An ordinary turn's reply talks about the game or the booking, never about the
// surfaces: a reply that names a surface id of the session ("I've built it now as table-2", Opus 5.5,
// 2026-10-15.jsonl:260) or opens a correction of an earlier turn ("I need to correct my last turn", Haiku 5.5, :44)
// gets NARRATED_MECHANICS and one repair round. A second narrated reply ships tallied (NARRATION_UNCORRECTED), never
// a halt. Keyless, scripted provider, no persona checks: the finding is the producer's own.
// T-0332: when narration is a round's only failure the round's surfaces are held fixed in code and the repair asks for the
// reply alone (no tool, no A2UI line), so it cannot open a surface (round 9 :182 dealt a table-3 to "Hit me again.").

import { describe, it, expect } from 'vitest'
import { produce } from '../agent/produce.ts'
import type { AgentProvider, Session, TurnInput } from '../agent/agent-transport.ts'
import { readMetaLine } from '../agent/meta-line.ts'
import { composeCatalog } from '../catalog/compose.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { croupierFragment } from '../catalog/personas/croupier/manifest.ts'
import { croupierSemanticChecks } from '../catalog/personas/croupier/checks.ts'
import { DEAL_TURN, toJsonl } from '../catalog/personas/croupier/hands.fixture.ts'

const catalog = composeCatalog(defaultCatalog, croupierFragment, 'croupier')
const session: Session = { turns: [{ role: 'user', content: 'Deal round 3' }, { role: 'assistant', content: toJsonl(DEAL_TURN) }] }
const input: TurnInput = { kind: 'intent', text: 'Check, or call if there is a bet.', session }

function scripted(outputs: string[]): { provider: AgentProvider; calls: () => number; reqs: string[] } {
  let n = 0
  const reqs: string[] = []
  const provider: AgentProvider = {
    async *stream(req) {
      reqs.push(req.messages.at(-1)!.content)
      const out = outputs[Math.min(n, outputs.length - 1)]!
      n += 1
      yield out
    },
  }
  return { provider, calls: () => n, reqs }
}

async function run(outputs: string[]): Promise<{ calls: number; reqs: string[]; rounds: number; codes: string[]; note: string | undefined }> {
  const s = scripted(outputs)
  const lines: string[] = []
  for await (const line of produce(input, { provider: s.provider, retrieve: () => [], catalog }, { maxRounds: 3 })) lines.push(line)
  const meta = lines.map((l) => readMetaLine(l)?.a2uiMeta).find((m) => m?.trace !== undefined)
  return { calls: s.calls(), reqs: s.reqs, rounds: meta?.trace?.rounds ?? 0, codes: [...(meta?.trace?.failureCodes ?? [])], note: meta?.note }
}

const note = (text: string): string => JSON.stringify({ a2uiMeta: { note: text } })
const CLEAN = note('I check behind. The turn is the K of diamonds; you act first: check, or bet up to the pot.')
const UPDATE = '{"version":"v1.0","updateComponents":{"surfaceId":"table-3","components":[{"id":"messageZone","component":"Text","variant":"body","text":"Dealer stands on 17."}]}}'

describe('produce(): a reply that narrates the surfaces is sent back once (T-0234, NARRATED_MECHANICS)', () => {
  it('a reply naming a surface id of the session spends one repair round naming the fragment', async () => {
    const r = await run([note('Last turn I never built its table, so I have built it now as table-3.'), CLEAN])
    expect(r.calls).toBe(2)
    expect(r.reqs[1]).toContain('NARRATED_MECHANICS')
    expect(r.reqs[1]).toContain('table-3')
    expect(r.rounds).toBe(2)
    expect(r.codes).toEqual(['NARRATED_MECHANICS'])
    expect(r.note).toMatch(/^I check behind/)
  })

  it('a capitalized surface id at the start of a sentence is sent back too (T-0297, "Table-3 is dealt.")', async () => {
    const r = await run([`${note('Table-3 is dealt. You have 10 and 5 for 15 against the dealer\'s 9.')}\n${UPDATE}`, `${CLEAN}\n${UPDATE}`])
    expect(r.calls).toBe(2)
    expect(r.reqs[1]).toContain('NARRATED_MECHANICS')
    expect(r.codes).toEqual(['NARRATED_MECHANICS'])
    expect(r.note).toMatch(/^I check behind/)
  })

  it('a reply that opens a correction of an earlier turn is sent back, with a payload too', async () => {
    for (const said of ['I need to correct my last turn: I described the draw but never updated your cards.', 'I made a mistake last turn.', 'I win with a pair of queens, Q of hearts... correction: Q of diamonds.']) {
      const r = await run([`${note(said)}\n${UPDATE}`, `${CLEAN}\n${UPDATE}`])
      expect(r.codes, said).toEqual(['NARRATED_MECHANICS'])
      expect(r.calls, said).toBe(2)
    }
  })

  it('a second narrated reply ships tallied, never a halt; a clean reply ships on round 1', async () => {
    const twice = await run([note('I also need to correct my opening.')])
    expect(twice.calls).toBe(2)
    expect(twice.codes).toEqual(['NARRATED_MECHANICS', 'NARRATION_UNCORRECTED'])
    const clean = await run([CLEAN])
    expect(clean.calls).toBe(1)
    expect(clean.codes).toEqual([])
  })
})

// T-0332 (round 9 :182, Sonnet 5.5): "Hit me again." after a bust. Round 1 rightly said nothing was left to hit but named the
// settled table, and the full repair round dealt a new table-3. A narration-only repair now keeps round 1's surfaces.
type Req = Parameters<AgentProvider['stream']>[0]
interface Round {
  text?: string
  call?: Record<string, unknown>
}

function scriptedRounds(rounds: Round[]): { provider: AgentProvider; reqs: Req[] } {
  const reqs: Req[] = []
  const provider: AgentProvider = {
    async *stream(req) {
      reqs.push(req)
      const round = rounds[Math.min(reqs.length - 1, rounds.length - 1)]!
      if (round.text !== undefined) yield round.text
      if (round.call !== undefined) await req.executeTool?.('render_surface', round.call, req.signal)
    },
  }
  return { provider, reqs }
}

async function runRounds(rounds: Round[], maxRounds = 3): Promise<{ reqs: Req[]; trace: { rounds: number; failureCodes: string[] }; note: string | undefined; wire: string[] }> {
  const s = scriptedRounds(rounds)
  const lines: string[] = []
  for await (const line of produce(input, { provider: s.provider, retrieve: () => [], catalog }, { maxRounds })) lines.push(line)
  const meta = lines.map((l) => readMetaLine(l)?.a2uiMeta).find((m) => m?.trace !== undefined)
  return { reqs: s.reqs, trace: { rounds: meta?.trace?.rounds ?? 0, failureCodes: [...(meta?.trace?.failureCodes ?? [])] }, note: meta?.note, wire: lines.filter((l) => readMetaLine(l) === undefined) }
}

const lastUser = (req: Req): string => [...req.messages].reverse().find((m) => m.role === 'user')!.content
const NARRATED = note('There is no hand to hit; the round on table-3 is settled.')
const UPDATE_OBJ = JSON.parse(UPDATE) as Record<string, unknown>
const NETNOOP = [
  '{"version":"v1.0","createSurface":{"surfaceId":"tmp-1","catalogId":"agent-ui--croupier"}}',
  '{"version":"v1.0","updateComponents":{"surfaceId":"tmp-1","components":[{"id":"root","component":"Text","variant":"body","text":"x"}]}}',
  '{"version":"v1.0","deleteSurface":{"surfaceId":"tmp-1"}}',
].join('\n')

describe('produce(): a narration-only repair holds the surfaces and asks for the reply alone (T-0332)', () => {
  it('a note-only narrated reply with no payload is repaired with no tool and no surface: a payload the repair sends anyway is ignored', async () => {
    const r = await runRounds([{ text: NARRATED }, { text: `${CLEAN}\n${UPDATE}` }])
    expect(r.reqs).toHaveLength(2)
    expect(r.reqs[1]!.tools).toBeUndefined()
    expect(r.reqs[1]!.executeTool).toBeUndefined()
    expect(lastUser(r.reqs[1]!)).toContain('NARRATED_MECHANICS at table-3')
    expect(lastUser(r.reqs[1]!)).toContain('send no A2UI lines')
    expect(lastUser(r.reqs[1]!)).not.toContain('Re-emit')
    expect(lastUser(r.reqs[1]!)).not.toContain('render_surface')
    expect(r.wire).toEqual([])
    expect(r.trace).toMatchObject({ rounds: 2, failureCodes: ['NARRATED_MECHANICS'] })
    expect(r.note).toMatch(/^I check behind/)
  })

  it('a note-only narrated reply on a click turn that also fails ACTION_NOT_APPLIED keeps the full repair round', async () => {
    const tableTurn = [
      '{"version":"v1.0","createSurface":{"surfaceId":"table-1","catalogId":"agent-ui--croupier","sendDataModel":true}}',
      '{"version":"v1.0","updateComponents":{"surfaceId":"table-1","components":[{"id":"root","component":"CardTable","title":"Blackjack","phase":{"path":"/phase"},"bet":{"path":"/bet"},"bankroll":{"path":"/bankroll"},"dealerHand":{"path":"/dealerHand"},"playerHand":{"path":"/playerHand"},"betAction":"deal"}]}}',
      '{"version":"v1.0","updateDataModel":{"surfaceId":"table-1","value":{"phase":"betting","bankroll":1000,"bet":50,"dealerHand":[],"playerHand":[]}}}',
    ].join('\n')
    const press: TurnInput = {
      kind: 'client',
      session: { turns: [{ role: 'user', content: 'Black jack' }, { role: 'assistant', content: tableTurn }] },
      message: { version: 'v1.0', action: { surfaceId: 'table-1', actionId: 'a1', name: 'deal', sourceComponentId: 'root', timestamp: '0', context: { bet: 50 }, dataModel: { phase: 'betting', bankroll: 1000, bet: 50, dealerHand: [], playerHand: [] } } },
    }
    const dealt =
      '{"version":"v1.0","updateDataModel":{"surfaceId":"table-1","value":{"phase":"playing","bankroll":950,"bet":50,"dealerHand":[{"rank":"10","suit":"spades"},{"rank":"6","suit":"clubs","faceDown":true}],"playerHand":[{"rank":"9","suit":"hearts"},{"rank":"7","suit":"clubs"}],"dealerTotal":"10 showing","playerTotal":16}}}'
    const moves =
      '{"version":"v1.0","updateComponents":{"surfaceId":"table-1","components":[{"id":"root","component":"CardTable","title":"Blackjack","phase":{"path":"/phase"},"bet":{"path":"/bet"},"bankroll":{"path":"/bankroll"},"dealerHand":{"path":"/dealerHand"},"playerHand":{"path":"/playerHand"},"betAction":"deal","children":["hit","stand"]},' +
      '{"id":"hit","component":"Button","label":"Hit","action":{"event":{"name":"hit"}}},{"id":"stand","component":"Button","label":"Stand","action":{"event":{"name":"stand"}}}]}}'
    const rounds: Round[] = [{ text: note('I dealt you a 9 and a 7 on table-1.') }, { text: `${note('You have 16 against the dealer 10. Hit or stand?')}\n${dealt}\n${moves}` }]
    const s = scriptedRounds(rounds)
    const lines: string[] = []
    for await (const line of produce(press, { provider: s.provider, retrieve: () => [], catalog, semanticChecks: croupierSemanticChecks }, { maxRounds: 3 })) lines.push(line)
    expect(s.reqs).toHaveLength(2)
    expect(s.reqs[1]!.tools?.map((t) => t.name)).toContain('render_surface')
    expect(lastUser(s.reqs[1]!)).toContain('ACTION_NOT_APPLIED')
    expect(lastUser(s.reqs[1]!)).not.toContain('send no A2UI lines')
    expect(lines.filter((l) => readMetaLine(l) === undefined)).toContain(dealt)
  })

  it('a valid text-mode payload ships as round 1 sent it, with the reworded reply', async () => {
    const r = await runRounds([{ text: `${NARRATED}\n${UPDATE}` }, { text: `${CLEAN}\n{"version":"v1.0","updateComponents":{"surfaceId":"table-3","components":[{"id":"messageZone","component":"Text","variant":"body","text":"Other."}]}}` }])
    expect(r.reqs).toHaveLength(2)
    expect(r.reqs[1]!.tools).toBeUndefined()
    expect(r.wire).toEqual([UPDATE])
    expect(r.trace).toMatchObject({ rounds: 2, failureCodes: ['NARRATED_MECHANICS'] })
    expect(r.note).toMatch(/^I check behind/)
  })

  it('a valid render_surface payload ships as round 1 sent it, and the repair round offers no tool', async () => {
    const r = await runRounds([
      { text: 'The round on table-3 is settled.', call: { reply: 'The round on table-3 is settled.', target: 'table-3', messages: [UPDATE_OBJ] } },
      { text: 'The round is settled. You act first.', call: { reply: 'x', messages: [{ version: 'v1.0', deleteSurface: { surfaceId: 'table-3' } }] } },
    ])
    expect(r.reqs).toHaveLength(2)
    expect(r.reqs[0]!.tools?.map((t) => t.name)).toContain('render_surface')
    expect(r.reqs[1]!.tools).toBeUndefined()
    expect(lastUser(r.reqs[1]!)).not.toContain('Call render_surface again')
    expect(r.wire).toEqual([UPDATE])
    expect(r.trace).toMatchObject({ rounds: 2, failureCodes: ['NARRATED_MECHANICS'] })
    expect(r.note).toBe('The round is settled. You act first.')
  })

  it('a repair that still narrates ships round 1 surfaces with the new reply, tallied', async () => {
    const r = await runRounds([{ text: `${NARRATED}\n${UPDATE}` }, { text: note('Table-3 is settled.') }, { text: CLEAN }])
    expect(r.reqs).toHaveLength(2)
    expect(r.wire).toEqual([UPDATE])
    expect(r.trace.failureCodes).toEqual(['NARRATED_MECHANICS', 'NARRATION_UNCORRECTED'])
    expect(r.note).toBe('Table-3 is settled.')
  })

  it('a repair that writes no reply ships the original reply tallied', async () => {
    const r = await runRounds([{ text: `${NARRATED}\n${UPDATE}` }, { text: '' }])
    expect(r.wire).toEqual([UPDATE])
    expect(r.trace.failureCodes).toEqual(['NARRATED_MECHANICS', 'NARRATION_UNCORRECTED'])
  })

  it('a narrated round that also has another failure keeps the full repair round (a net-no-op group)', async () => {
    const r = await runRounds([{ text: `${NARRATED}\n${NETNOOP}` }, { text: `${CLEAN}\n${UPDATE}` }])
    expect(r.reqs).toHaveLength(2)
    expect(lastUser(r.reqs[1]!)).toContain('NARRATED_MECHANICS')
    expect(lastUser(r.reqs[1]!)).toContain('Re-emit the COMPLETE')
    expect(r.wire).toEqual([UPDATE])
  })
})

// T-0428 (overnight 2026-10-23, the croupier rename): a say turn answered in note-only prose that claims a change on an open
// surface ("Done: table-3 is now titled...") with no call has a surface update to make, so it keeps the full repair round
// (render_surface offered) and the update lands. Prose that claims no change keeps the reply-only repair above (:182).
describe('produce(): a note-only narrated reply that claims a change keeps the full repair (T-0428)', () => {
  const rename: TurnInput = { kind: 'intent', text: "Rename the table to Kim's table and show my chips as euros.", session }
  const RENAMED = {
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'table-3',
      components: [
        { id: 'title', component: 'Text', variant: 'h4', text: "Kim's table" },
        { id: 'chips', component: 'Stat', label: 'Chips (EUR)', value: 1000, delta: 0, variant: 'tile' },
      ],
    },
  }

  it('the repair round offers render_surface and the scripted update for table-3 lands', async () => {
    const said = "Done: table-3 is now titled Kim's table and your chips show as euros."
    const s = scriptedRounds([{ text: note(said) }, { text: "Your table is Kim's table and your chips show as euros.", call: { reply: "Your table is Kim's table and your chips show as euros.", target: 'table-3', messages: [RENAMED] } }])
    const lines: string[] = []
    for await (const line of produce(rename, { provider: s.provider, retrieve: () => [], catalog, semanticChecks: croupierSemanticChecks }, { maxRounds: 3 })) lines.push(line)
    expect(s.reqs).toHaveLength(2)
    expect(s.reqs[1]!.tools?.map((t) => t.name)).toContain('render_surface')
    expect(lastUser(s.reqs[1]!)).toContain('NARRATED_MECHANICS')
    expect(lastUser(s.reqs[1]!)).not.toContain('send no A2UI lines')
    expect(lines.filter((l) => readMetaLine(l) === undefined)).toEqual([JSON.stringify(RENAMED)])
  })

  it('a say reply that names a surface and claims no change still gets the reply-only repair (:182)', async () => {
    const s = scriptedRounds([{ text: NARRATED }, { text: `${CLEAN}\n${UPDATE}` }])
    const lines: string[] = []
    for await (const line of produce(input, { provider: s.provider, retrieve: () => [], catalog, semanticChecks: croupierSemanticChecks }, { maxRounds: 3 })) lines.push(line)
    expect(s.reqs).toHaveLength(2)
    expect(s.reqs[1]!.tools).toBeUndefined()
    expect(lastUser(s.reqs[1]!)).toContain('send no A2UI lines')
    expect(lines.filter((l) => readMetaLine(l) === undefined)).toEqual([])
  })
})

// T-0442 (round 2026-10-24-t0440-sweep, pick-mentalist-answer-deck-haiku-1, the keyless replay in
// scripts/e2e-admin/probe/replays/mentalist-haiku-note-claim.test.mjs): a note-only reply whose ask names a surface that
// neither the answer nor the session creates ("Answer Yes, No, or Sort of below", ask-1, no call) keeps the full repair
// (SURFACE_CLAIMED, render_surface offered and forced), and the last round refuses it: an earlier valid round ships, else a
// halt. An ask on a surface the session already holds claims nothing new.
describe('produce(): a note-only reply whose ask names a surface it never creates keeps the full repair (T-0442)', () => {
  const ASKED = JSON.stringify({ a2uiMeta: { note: 'Hit or stand? Pick one below.', ask: { surfaceId: 'ask-9' } } })
  const ASK_SURFACE = [
    { version: 'v1.0', createSurface: { surfaceId: 'ask-9', catalogId: 'agent-ui--croupier' } },
    { version: 'v1.0', updateComponents: { surfaceId: 'ask-9', components: [{ id: 'root', component: 'Text', variant: 'body', text: 'Hit or stand?' }] } },
  ]

  it('the repair round offers and forces render_surface, and the scripted ask surface lands', async () => {
    const r = await runRounds([{ text: ASKED }, { text: ASKED, call: { reply: 'Hit or stand? Pick one below.', messages: ASK_SURFACE } }])
    expect(r.reqs).toHaveLength(2)
    expect(r.reqs[1]!.tools?.map((t) => t.name)).toContain('render_surface')
    expect(r.reqs[1]!.toolChoice).toEqual({ name: 'render_surface' })
    expect(lastUser(r.reqs[1]!)).toContain('SURFACE_CLAIMED at ask-9')
    expect(lastUser(r.reqs[1]!)).not.toContain('send no A2UI lines')
    expect(r.wire).toEqual(ASK_SURFACE.map((m) => JSON.stringify(m)))
    expect(r.trace).toMatchObject({ rounds: 2, failureCodes: ['SURFACE_CLAIMED'] })
  })

  it('the last round refuses a note-only reply that still claims it: a halt when no earlier round is valid', async () => {
    await expect(runRounds([{ text: ASKED }], 2)).rejects.toMatchObject({ name: 'ProduceHalt', failures: [{ code: 'SURFACE_CLAIMED', path: 'ask-9' }] })
  })

  it('the last round refuses it in favour of an earlier valid round, which ships', async () => {
    const r = await runRounds([{ text: `${CLEAN}\n${UPDATE}\n${NETNOOP}` }, { text: ASKED }], 2)
    expect(r.reqs).toHaveLength(2)
    expect(r.wire).toEqual([UPDATE])
    expect(r.trace).toMatchObject({ rounds: 2, failureCodes: ['SURFACE_CLAIMED', 'NET_NOOP_STRIPPED', 'EARLIER_ROUND_SHIPPED'] })
  })

  it('an ask on a surface the session already holds claims nothing new: it ships on round 1 as before', async () => {
    const r = await runRounds([{ text: JSON.stringify({ a2uiMeta: { note: 'Check, or bet up to the pot.', ask: { surfaceId: 'table-3' } } }) }])
    expect(r.reqs).toHaveLength(1)
    expect(r.trace.failureCodes).toEqual([])
  })
})
