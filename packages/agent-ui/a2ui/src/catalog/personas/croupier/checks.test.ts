// checks.test.ts: the croupier hand check (ADR-0238; GH #1795), driven through the generic hook's
// own view builder (`semanticSurfaceViews`) so every case judges the MERGED graph the renderer would hold.
// Red-then-green: the live evidence passes structural validation on top of its deal turn and still fails
// here with one clear dealer finding; its repair and the taught data-driven shape pass.

import { describe, it, expect } from 'vitest'
import { croupierHandConsistency, croupierSemanticChecks } from './checks.ts'
import { croupierManifest } from './manifest.ts'
import { CORRECTED_LINE, DATA_DRIVEN_TURN, DEAL_TURN, EVIDENCE_LINE, NATURAL_REPAIRED_TURN, NATURAL_TURN, toJsonl } from './hands.fixture.ts'
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
    // The reconstructed deal turn is itself a turn the loop would have shipped (a seed is otherwise trusted).
    expect(validateA2ui(DEAL_TURN, catalog, undefined, { atFinalize: true })).toEqual({ valid: true, failures: [] })
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

describe('croupier hand check: a natural blackjack ends the round (T-0020, NATURAL_ACTIONS)', () => {
  type Comp = Record<string, unknown>
  /** A copy of the screenshot turn with `edit` applied to its component list (`get` finds one by id). */
  function natural(edit: (comps: Comp[], get: (id: string) => Comp) => void): A2uiOutput {
    const out = JSON.parse(JSON.stringify(NATURAL_TURN)) as A2uiOutput
    const comps = (out[1] as { updateComponents: { components: Comp[] } }).updateComponents.components
    edit(comps, (id) => comps.find((c) => c['id'] === id)!)
    return out
  }
  /** The dealer shows its hole card: face up, and the readout restated as the full two-card total. */
  const revealHole = (_: Comp[], get: (id: string) => Comp): void => {
    delete get('dealerCard2')['faceDown']
    get('dealerTotal')['text'] = 'Dealer: 16'
  }
  const remove = (comps: Comp[], ...ids: string[]): void => {
    for (const id of ids) comps.splice(comps.findIndex((c) => c['id'] === id), 1)
  }

  it('precondition: the screenshot turn and its repair both pass structural validation', () => {
    expect(validateA2ui(NATURAL_TURN, catalog, undefined, { atFinalize: true })).toEqual({ valid: true, failures: [] })
    expect(validateA2ui(NATURAL_REPAIRED_TURN, catalog, undefined, { atFinalize: true })).toEqual({ valid: true, failures: [] })
  })

  it('fails the screenshot with one finding naming the move buttons and the face-down hole card', () => {
    const findings = judge({ turns: [] }, NATURAL_TURN)
    expect(findings).toHaveLength(1)
    const f = findings[0]!
    expect(f.code).toBe('NATURAL_ACTIONS')
    expect(f.path).toBe('table-6:hitBtn')
    expect(f.message).toContain("The player's cards in playerCards (A, K) are a natural blackjack")
    expect(f.message).toContain('hitBtn (hit), standBtn (stand), doubleBtn (double)')
    expect(f.message).toContain('a face-down card in dealerCards')
    expect(f.message).toContain('leave only the Deal again Button')
  })

  it('passes the repair: hole card face up, result stated, Deal again only', () => {
    expect(judge({ turns: [] }, NATURAL_REPAIRED_TURN)).toEqual([])
  })

  it('judges either fault alone: buttons with a face-up hole card, or a face-down hole card with no buttons', () => {
    const buttonsOnly = judge({ turns: [] }, natural(revealHole))
    expect(buttonsOnly).toHaveLength(1)
    expect(buttonsOnly[0]).toMatchObject({ code: 'NATURAL_ACTIONS', path: 'table-6:hitBtn' })
    expect(buttonsOnly[0]!.message).not.toContain('face-down')
    const holeOnly = judge(
      { turns: [] },
      natural((comps, get) => {
        get('moves')['children'] = []
        remove(comps, 'hitBtn', 'standBtn', 'doubleBtn')
      }),
    )
    expect(holeOnly).toHaveLength(1)
    expect(holeOnly[0]).toMatchObject({ code: 'NATURAL_ACTIONS', path: 'table-6:dealerCards' })
    expect(holeOnly[0]!.message).not.toContain('still has')
  })

  it('matches a move by id or by label in any case, and ignores other buttons', () => {
    const renamed = natural((comps, get) => {
      revealHole(comps, get)
      get('hitBtn')['label'] = 'Take a card' // the id still says hit
      const stand = get('standBtn')
      stand['id'] = 'btn-2'
      stand['label'] = 'STAND' // the label says stand
      get('moves')['children'] = ['hitBtn', 'btn-2']
      remove(comps, 'doubleBtn')
    })
    const findings = judge({ turns: [] }, renamed)
    expect(findings).toHaveLength(1)
    expect(findings[0]!.message).toContain('hitBtn (hit), btn-2 (stand)')
    const dealOnly = natural((comps, get) => {
      revealHole(comps, get)
      const deal = get('hitBtn')
      deal['id'] = 'dealAgain'
      deal['label'] = 'Deal again'
      const other = get('standBtn')
      other['id'] = 'standingsBtn'
      other['label'] = 'Standings'
      get('moves')['children'] = ['dealAgain', 'standingsBtn']
      remove(comps, 'doubleBtn')
    })
    expect(judge({ turns: [] }, dealOnly)).toEqual([])
  })

  it('stays green for a 21 reached with three cards, a two-card 20, and a soft 17, each with all three moves', () => {
    const threeCard21 = natural((comps, get) => {
      revealHole(comps, get)
      get('playerCards')['children'] = ['playerCard1', 'playerCard2', 'playerCard3']
      get('playerCard2')['rank'] = '5' // A + 5 + 5
      comps.push({ id: 'playerCard3', component: 'PlayingCard', rank: '5', suit: 'clubs' })
    })
    const twoCard20 = natural((comps, get) => {
      revealHole(comps, get)
      get('playerCard1')['rank'] = 'Q' // Q + K
      get('playerTotal')['text'] = 'Total: 20'
    })
    const soft17 = natural((comps, get) => {
      revealHole(comps, get)
      get('playerCard2')['rank'] = '6' // A + 6
      get('playerTotal')['text'] = 'Total: 17'
    })
    for (const [name, out] of [['three-card 21', threeCard21], ['two-card 20', twoCard20], ['soft 17', soft17]] as const) {
      expect(judge({ turns: [] }, out), name).toEqual([])
    }
    // The hole card stays face down in these too: only a natural must reveal it.
    const faceDownSoft17 = natural((_, get) => {
      get('playerCard2')['rank'] = '6'
      get('playerTotal')['text'] = 'Total: 17'
    })
    expect(judge({ turns: [] }, faceDownSoft17)).toEqual([])
  })

  it('judges a data-driven hand list, for every ten-value card, and never two aces or an ace and a nine', () => {
    const withDouble = (o: A2uiOutput): void => {
      componentsOf(o).push({ id: 'doubleBtn', component: 'Button', label: 'Double', variant: 'ghost', action: { action: 'double' } })
    }
    const deal = (rank: string, total: number): A2uiOutput =>
      dataDriven((v) => {
        v['playerHand'] = [{ rank: 'A', suit: 'spades' }, { rank, suit: 'hearts' }]
        v['playerTotal'] = total
      }, withDouble)
    for (const face of ['10', 'J', 'Q', 'K']) expect(judge({ turns: [] }, deal(face, 21)).map((f) => f.code), face).toEqual(['NATURAL_ACTIONS'])
    expect(judge({ turns: [] }, deal('A', 12))).toEqual([])
    expect(judge({ turns: [] }, deal('9', 20))).toEqual([])
  })

  it('is indeterminate, never a finding, when a hand cannot be resolved', () => {
    const unknownPlayerRank = natural((_, get) => (get('playerCard2')['rank'] = { path: '/missing' }))
    expect(judge({ turns: [] }, unknownPlayerRank)).toEqual([])
    // An unresolvable dealer card: the buttons still fault, the hole card is not judged.
    const unknownDealerRank = natural((_, get) => {
      get('dealerCard1')['rank'] = { path: '/missing' }
      get('dealerTotal')['text'] = 'Dealer: 9'
    })
    const findings = judge({ turns: [] }, unknownDealerRank)
    expect(findings).toHaveLength(1)
    expect(findings[0]!.message).toContain('hitBtn (hit)')
    expect(findings[0]!.message).not.toContain('face-down')
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
