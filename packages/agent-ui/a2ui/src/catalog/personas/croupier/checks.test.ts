// checks.test.ts: the croupier hand check (ADR-0238, proposed; GH #1795), driven through the generic hook's
// own view builder (`semanticSurfaceViews`) so every case judges the MERGED graph the renderer would hold.
// Red-then-green: the live evidence passes structural validation on top of its deal turn and still fails
// here with one clear dealer finding; its repair and the taught data-driven shape pass.

import { describe, it, expect } from 'vitest'
import { croupierHandConsistency, croupierSemanticChecks } from './checks.ts'
import { croupierManifest } from './manifest.ts'
import { CORRECTED_LINE, DATA_DRIVEN_TURN, DEAL_TURN, EVIDENCE_LINE, toJsonl } from './hands.fixture.ts'
import { semanticSurfaceViews } from '../../semantic-check.ts'
import type { SemanticFinding } from '../../semantic-check.ts'
import type { Session } from '../../../agent/agent-transport.ts'
import type { A2uiOutput, A2uiServerMessage } from '../../../protocol.ts'
import { validateA2ui } from '../../../renderer/validate.ts'
import type { SurfaceSeed } from '../../../renderer/validate.ts'
import { composeCatalog } from '../../compose.ts'
import { defaultCatalog } from '../../default/index.ts'
import { croupierFragment } from './manifest.ts'

const catalog = composeCatalog(defaultCatalog, croupierFragment, 'croupier')
const dealSession: Session = {
  turns: [
    { role: 'user', content: 'Deal round 3' },
    { role: 'assistant', content: toJsonl(DEAL_TURN) },
  ],
}
const parse = (line: string): A2uiOutput => [JSON.parse(line) as A2uiServerMessage]

function judge(session: Session, output: A2uiOutput): readonly SemanticFinding[] {
  return croupierHandConsistency.check({ surfaces: semanticSurfaceViews(session, output) })
}

/** The deal turn as a validator seed (the shape `produce()`'s own session seeding builds). */
function dealSeed(): Map<string, SurfaceSeed> {
  const comps = DEAL_TURN.flatMap((m) => ('updateComponents' in m ? m.updateComponents.components : []))
  return new Map([['table-3', { components: comps, rootDelivered: true }]])
}

/** A data-driven turn with one edit applied to its data model (`value` replaced wholesale). */
function dataDriven(edit: (value: Record<string, unknown>) => void, components?: (list: A2uiOutput) => void): A2uiOutput {
  const out = JSON.parse(JSON.stringify(DATA_DRIVEN_TURN)) as A2uiOutput
  const data = out[1] as { updateDataModel: { value: Record<string, unknown> } }
  edit(data.updateDataModel.value)
  components?.(out)
  return out
}

function componentsOf(out: A2uiOutput): Record<string, unknown>[] {
  return (out[2] as { updateComponents: { components: Record<string, unknown>[] } }).updateComponents.components
}

describe('croupier hand check: the GH #1795 evidence (red) and its repair (green)', () => {
  it('precondition: the evidence passes structural validation on top of its deal turn', () => {
    expect(validateA2ui(parse(EVIDENCE_LINE), catalog, dealSeed(), { atFinalize: true })).toEqual({ valid: true, failures: [] })
    expect(validateA2ui(parse(CORRECTED_LINE), catalog, dealSeed(), { atFinalize: true })).toEqual({ valid: true, failures: [] })
  })

  it('fails the evidence with exactly one finding: the dealer readout states 17 over cards that total 14', () => {
    const findings = judge(dealSession, parse(EVIDENCE_LINE))
    expect(findings).toHaveLength(1)
    const f = findings[0]!
    expect(f.code).toBe('HAND_TOTAL')
    expect(f.path).toBe('table-3:dealerTotal')
    expect(f.message).toContain('dealerTotal ("Dealer: 14, draws to 17") states 17')
    expect(f.message).toContain("the dealer's cards in dealerCards (6, 5, 3) total 14")
    expect(f.message).toContain('deal the card into the hand first')
  })

  it('passes the repaired payload (a fourth dealer card, every stated total 17)', () => {
    expect(judge(dealSession, parse(CORRECTED_LINE))).toEqual([])
  })

  it('passes the deal turn itself: a face-down hole card may be left out of the stated total', () => {
    expect(judge({ turns: [] }, DEAL_TURN)).toEqual([])
  })

  it('judges the merged graph: without the deal turn the dealer hand is two cards (5, 3), so 14 is wrong too', () => {
    const findings = judge({ turns: [] }, parse(EVIDENCE_LINE))
    // dealerCard1 and the player's first two cards are unknown standalone; the check reads what renders.
    expect(findings.map((f) => f.path)).toContain('table-3:dealerTotal')
  })
})

describe('croupier hand check: the taught data-driven shape', () => {
  it('passes: templated hands, bound totals, a soft ace (A + 7 = 18) and a face-down card (dealer shows 9)', () => {
    expect(judge({ turns: [] }, DATA_DRIVEN_TURN)).toEqual([])
  })

  it('accepts the soft and the hard ace total, and the hole card counted or not', () => {
    for (const [p, n] of [['playerTotal', 8], ['playerTotal', 18], ['dealerTotal', 9], ['dealerTotal', 19]] as const) {
      expect(judge({ turns: [] }, dataDriven((v) => (v[p] = n))), `${p} = ${n}`).toEqual([])
    }
  })

  it('HAND_TOTAL on a bound total that no reading of the listed cards gives', () => {
    const findings = judge({ turns: [] }, dataDriven((v) => (v['playerTotal'] = 17)))
    expect(findings).toEqual([
      {
        code: 'HAND_TOTAL',
        path: 'table-4:/playerTotal',
        message: expect.stringContaining("states 17, but the player's cards in playerCards (A, 7) total 8 or 18") as unknown as string,
      },
    ])
  })

  it('HAND_TOTAL counts face values right: J/Q/K are 10, two aces are 2 or 12', () => {
    const ok = dataDriven((v) => {
      v['playerHand'] = [{ rank: 'A', suit: 'spades' }, { rank: 'A', suit: 'hearts' }, { rank: 'Q', suit: 'clubs' }]
      v['playerTotal'] = 12
    })
    expect(judge({ turns: [] }, ok)).toEqual([])
    const bust = dataDriven((v) => {
      v['playerHand'] = [{ rank: 'K', suit: 'spades' }, { rank: 'J', suit: 'hearts' }, { rank: '5', suit: 'clubs' }]
      v['playerTotal'] = 25
    })
    expect(judge({ turns: [] }, bust)).toEqual([])
    const wrong = dataDriven((v) => {
      v['playerHand'] = [{ rank: 'K', suit: 'spades' }, { rank: 'J', suit: 'hearts' }, { rank: '5', suit: 'clubs' }]
      v['playerTotal'] = 15
    })
    expect(judge({ turns: [] }, wrong).map((f) => f.code)).toEqual(['HAND_TOTAL'])
  })

  it('HAND_COUNT when a static Row shows fewer cards than the list holds', () => {
    const out = dataDriven(
      () => {},
      (o) => {
        const comps = componentsOf(o)
        const row = comps.find((c) => c['id'] === 'dealerCards')!
        row['children'] = ['dealerCardA']
        comps.push({ id: 'dealerCardA', component: 'PlayingCard', rank: '9', suit: 'hearts' })
      },
    )
    const findings = judge({ turns: [] }, out)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ code: 'HAND_COUNT', path: 'table-4:dealerCards' })
    expect(findings[0]!.message).toContain('dealerCards renders 1 card but /dealerHand lists 2')
  })

  it('HAND_COUNT when the Row is templated over a path the data model does not hold (renders none)', () => {
    const out = dataDriven(
      () => {},
      (o) => {
        const row = componentsOf(o).find((c) => c['id'] === 'playerCards')!
        row['children'] = { path: '/player/cards', componentId: 'playerCard' }
      },
    )
    // Both are true: the Row shows no cards, and the bound 18 is not the total of the (zero) cards shown.
    expect(judge({ turns: [] }, out)).toMatchObject([
      { code: 'HAND_COUNT', path: 'table-4:playerCards' },
      { code: 'HAND_TOTAL', path: 'table-4:/playerTotal' },
    ])
  })

  it('judges the merged data model: a later turn appends a card by pointer and must restate the total', () => {
    const session: Session = { turns: [{ role: 'assistant', content: toJsonl(DATA_DRIVEN_TURN) }] }
    const draw = (total: number): A2uiOutput => [
      { version: 'v1.0', updateDataModel: { surfaceId: 'table-4', path: '/playerHand/2', value: { rank: '3', suit: 'clubs' } } },
      { version: 'v1.0', updateDataModel: { surfaceId: 'table-4', path: '/playerTotal', value: total } },
    ]
    expect(judge(session, draw(21))).toEqual([]) // A + 7 + 3: soft 21
    expect(judge(session, draw(11))).toEqual([]) // hard 11
    expect(judge(session, draw(18)).map((f) => f.code)).toEqual(['HAND_TOTAL']) // the stale total
  })
})

describe('croupier hand check: what it never judges', () => {
  it('a surface this round does not touch (a finished round left as history)', () => {
    const session: Session = { turns: [{ role: 'assistant', content: toJsonl(DEAL_TURN) + '\n' + EVIDENCE_LINE }] }
    const other: A2uiOutput = [
      { version: 'v1.0', createSurface: { surfaceId: 'table-5', catalogId: 'agent-ui--croupier' } },
      { version: 'v1.0', updateComponents: { surfaceId: 'table-5', components: [{ id: 'root', component: 'Text', text: 'Next round' }] } },
    ]
    expect(judge(session, other)).toEqual([])
  })

  it('narration, unrelated figures, and hands it cannot attribute or resolve', () => {
    const out: A2uiOutput = [
      { version: 'v1.0', createSurface: { surfaceId: 'poker', catalogId: 'agent-ui--croupier' } },
      {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'poker',
          components: [
            { id: 'root', component: 'Column', children: ['board', 'pot', 'result', 'mystery'] },
            { id: 'board', component: 'Row', children: ['b1'] }, // names no participant
            { id: 'b1', component: 'PlayingCard', rank: 'K', suit: 'spades' },
            { id: 'pot', component: 'Stat', label: 'Pot', value: 340 },
            { id: 'result', component: 'Text', text: 'Dealer shows 11, draws to 17. You win 19 to 17.' },
            { id: 'mystery', component: 'Row', children: ['m1'] },
            { id: 'm1', component: 'PlayingCard', rank: { path: '/rank' }, suit: 'hearts' },
          ],
        },
      },
    ]
    expect(judge({ turns: [] }, out)).toEqual([])
  })
})

describe('croupier manifest declares the check (ADR-0238 wiring)', () => {
  it('croupierManifest.semanticChecks is the one hand check', () => {
    expect(croupierManifest.semanticChecks).toBe(croupierSemanticChecks)
    expect(croupierSemanticChecks.map((c) => c.id)).toEqual(['croupier-hand-consistency'])
  })
})
