// checks.test.ts: the croupier hand check (ADR-0238; GH #1795), driven through the generic hook's
// own view builder (`semanticSurfaceViews`) so every case judges the MERGED graph the renderer would hold.
// Red-then-green: the live evidence passes structural validation on top of its deal turn and still fails
// here with one clear dealer finding; its repair and the taught data-driven shape pass.

import { describe, it, expect } from 'vitest'
import { croupierActionApplied, croupierBetControls, croupierHandConsistency, croupierSemanticChecks } from './checks.ts'
import { croupierManifest } from './manifest.ts'
import { CORRECTED_LINE, DATA_DRIVEN_TURN, DEAL_TURN, EVIDENCE_LINE, NATURAL_REPAIRED_TURN, NATURAL_TURN, toJsonl } from './hands.fixture.ts'
import { semanticSurfaceViews, sessionSurfaceViews } from '../../semantic-check.ts'
import type { SemanticFinding } from '../../semantic-check.ts'
import type { Session } from '../../../agent/agent-transport.ts'
import type { A2uiOutput, A2uiServerMessage } from '../../../protocol.ts'
import { validateA2ui } from '../../../renderer/validate.ts'
import type { SurfaceSeed } from '../../../renderer/validate.ts'
import { composeCatalog } from '../../compose.ts'
import { defaultCatalog } from '../../default/index.ts'
import { croupierFragment } from './manifest.ts'
import {
  personaCroupierCardTableBettingSeed,
  personaCroupierCardTableSeed,
  personaCroupierCardTableSettledSeed,
} from '../../../examples/persona-exemplars.ts'

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

  // T-0276: live round 4 (2026-10-15-r4-fixes :46, Haiku 5.5) sent a hold'em opening with hole cards A K back twice as
  // a blackjack natural, and the third round settled it at 3:2. A natural is a blackjack-family rule only.
  it("skips a hold'em, Omaha or stud opening holding A K, and still fails the blackjack natural", () => {
    for (const game of ["Texas hold'em, heads-up", 'Omaha, round 1', 'Seven-card stud, round 1']) {
      const opening = natural((_, get) => {
        get('title')['text'] = game
        get('playerTotal')['text'] = 'You: A K'
        get('messageZone')['text'] = 'Pre-flop: check, bet or fold.'
      })
      expect(judge({ turns: [] }, opening).filter((f) => f.code === 'NATURAL_ACTIONS'), game).toEqual([])
    }
    expect(judge({ turns: [] }, NATURAL_TURN).map((f) => f.code)).toEqual(['NATURAL_ACTIONS'])
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

describe('croupier hand check: the CardTable arm (ADR-0243)', () => {
  type Comp = Record<string, unknown>
  /** A copy of the agent-ui CardTable seed with `edit` applied to its CardTable root and data model. */
  function table(edit: (root: Comp, data: Record<string, unknown>) => void = () => {}): A2uiOutput {
    const out = JSON.parse(JSON.stringify(personaCroupierCardTableSeed.messages)) as A2uiOutput
    const root = tableComponents(out).find((c) => c['id'] === 'root')!
    edit(root, (out[2] as { updateDataModel: { value: Record<string, unknown> } }).updateDataModel.value)
    return out
  }
  const tableComponents = (out: A2uiOutput): Comp[] =>
    (out[1] as { updateComponents: { components: Comp[] } }).updateComponents.components

  it('CardTable: the bound seed table passes, structurally and semantically', () => {
    expect(validateA2ui(table(), catalog, undefined, { atFinalize: true })).toEqual({ valid: true, failures: [] })
    expect(judge({ turns: [] }, table())).toEqual([])
  })

  it('CardTable: HAND_BINDING for a literal hand list', () => {
    const literal = table((root) => {
      root['playerHand'] = [{ rank: 'K', suit: 'hearts' }, { rank: '7', suit: 'spades' }]
    })
    const findings = judge({ turns: [] }, literal)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ code: 'HAND_BINDING', path: 'card-table:root' })
    expect(findings[0]!.message).toContain('root gives playerHand a literal list')
    expect(findings[0]!.message).toContain('at /playerHand')
    expect(findings[0]!.message).toContain('"playerHand":{"path":"/playerHand"} so a draw appends to the list')
  })

  it('CardTable: HAND_BINDING for a pointer other than /dealerHand', () => {
    const elsewhere = table((root, data) => {
      root['dealerHand'] = { path: '/dealerCards' }
      data['dealerCards'] = data['dealerHand']
      delete data['dealerHand']
    })
    const findings = judge({ turns: [] }, elsewhere)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ code: 'HAND_BINDING', path: 'card-table:root' })
    expect(findings[0]!.message).toContain('root gives dealerHand {"path":"/dealerCards"}')
    expect(findings[0]!.message).toContain('"dealerHand":{"path":"/dealerHand"}')
  })

  it('CardTable: HAND_COUNT on a literal hand shorter than the listed one tells the model to bind the list', () => {
    const short = table((root) => {
      root['playerHand'] = [{ rank: 'K', suit: 'hearts' }]
      root['playerTotal'] = 10
    })
    const findings = judge({ turns: [] }, short)
    expect(findings.map((f) => f.code)).toEqual(['HAND_BINDING', 'HAND_COUNT', 'HAND_TOTAL'])
    expect(findings[1]!.message).toContain('root renders 1 card but /playerHand lists 2')
    expect(findings[1]!.message).toContain('bind root\'s "playerHand":{"path":"/playerHand"}')
  })

  it('CardTable: HAND_TOTAL on a literal CardTable total', () => {
    const findings = judge({ turns: [] }, table((root) => (root['playerTotal'] = 'Total 19')))
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ code: 'HAND_TOTAL', path: 'card-table:root.playerTotal' })
    expect(findings[0]!.message).toContain('root.playerTotal ("Total 19") states 19')
    expect(findings[0]!.message).toContain("the player's cards in root (K, 7) total 17")
  })

  it('CardTable: HAND_TOTAL on a bound /playerTotal that disagrees with the hand', () => {
    const findings = judge({ turns: [] }, table((_, data) => (data['playerTotal'] = 18)))
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ code: 'HAND_TOTAL', path: 'card-table:/playerTotal' })
    expect(findings[0]!.message).toContain("states 18, but the player's cards in root (K, 7) total 17")
  })

  it('CardTable: NATURAL_ACTIONS for a natural that still has a Hit Button child', () => {
    const natural = table((_, data) => {
      data['playerHand'] = [{ rank: 'A', suit: 'spades' }, { rank: 'K', suit: 'hearts' }]
      data['playerTotal'] = 21
    })
    const findings = judge({ turns: [] }, natural)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ code: 'NATURAL_ACTIONS', path: 'card-table:hitBtn' })
    expect(findings[0]!.message).toContain("The player's cards in root (A, K) are a natural blackjack")
    expect(findings[0]!.message).toContain('hitBtn (hit), standBtn (stand), doubleBtn (double)')
    expect(findings[0]!.message).toContain('a face-down card in root')
  })
})

describe('croupier hand check: the CardTable arm in every phase (ADR-0243 Amendment 3)', () => {
  type Comp = Record<string, unknown>
  /** A copy of a phase seed with `edit` applied to its CardTable root and data model. */
  function phased(seed: typeof personaCroupierCardTableSeed, edit: (root: Comp, data: Record<string, unknown>) => void = () => {}): A2uiOutput {
    const out = JSON.parse(JSON.stringify(seed.messages)) as A2uiOutput
    const root = (out[1] as { updateComponents: { components: Comp[] } }).updateComponents.components.find((c) => c['id'] === 'root')!
    edit(root, (out[2] as { updateDataModel: { value: Record<string, unknown> } }).updateDataModel.value)
    return out
  }

  it('betting and settled: the bound seed tables pass, structurally and semantically', () => {
    for (const seed of [personaCroupierCardTableBettingSeed, personaCroupierCardTableSettledSeed]) {
      expect(validateA2ui(phased(seed), catalog, undefined, { atFinalize: true }), seed.name).toEqual({ valid: true, failures: [] })
      expect(judge({ turns: [] }, phased(seed)), seed.name).toEqual([])
    }
  })

  it('betting: HAND_BINDING still fires on a literal empty hand', () => {
    const findings = judge({ turns: [] }, phased(personaCroupierCardTableBettingSeed, (root) => (root['dealerHand'] = [])))
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ code: 'HAND_BINDING', path: 'card-table:root' })
    expect(findings[0]!.message).toContain('root gives dealerHand a literal list')
  })

  it('settled: HAND_BINDING and HAND_COUNT on a literal hand shorter than the list, HAND_TOTAL on a wrong bound total', () => {
    const short = phased(personaCroupierCardTableSettledSeed, (root) => {
      root['playerHand'] = [{ rank: 'K', suit: 'hearts' }, { rank: '7', suit: 'spades' }]
    })
    expect(judge({ turns: [] }, short).map((f) => f.code)).toEqual(['HAND_BINDING', 'HAND_COUNT', 'HAND_TOTAL'])
    const wrong = phased(personaCroupierCardTableSettledSeed, (_, data) => (data['dealerTotal'] = 17))
    const findings = judge({ turns: [] }, wrong)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ code: 'HAND_TOTAL', path: 'card-table:/dealerTotal' })
    expect(findings[0]!.message).toContain("the dealer's cards in root (9, 4, 5) total 18")
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
  it('croupierManifest.semanticChecks is the hand, bet-controls and action checks (T-0172) the deck check (T-0218) and the rules check (T-0219)', () => {
    expect(croupierManifest.semanticChecks).toBe(croupierSemanticChecks)
    expect(croupierSemanticChecks.map((c) => c.id)).toEqual(['croupier-hand-consistency', 'croupier-bet-controls', 'croupier-action-applied', 'croupier-deck', 'croupier-rules'])
  })
})

// T-0172: the Sonnet 5 Blackjack trace of 2026-10-14, round 1, put a Slider on /bet beside the CardTable; Kim's ruling
// makes the table's own bet strip the whole bet phase.
describe('croupier bet controls: the CardTable owns the bet phase (T-0172)', () => {
  const table = (extra: Record<string, unknown> = {}) => ({
    id: 'root', component: 'CardTable', title: 'Blackjack', phase: { path: '/phase' }, bet: { path: '/bet' }, bankroll: { path: '/bankroll' }, betAction: 'deal', ...extra,
  })
  const payload = (components: Record<string, unknown>[], phase = 'betting'): A2uiOutput => [
    { version: 'v1.0', createSurface: { surfaceId: 'table-1', catalogId: 'agent-ui--croupier' } },
    { version: 'v1.0', updateDataModel: { surfaceId: 'table-1', value: { bankroll: 1000, bet: 50, phase } } },
    { version: 'v1.0', updateComponents: { surfaceId: 'table-1', components } },
  ] as A2uiOutput
  const run = (output: A2uiOutput) => croupierBetControls.check({ surfaces: semanticSurfaceViews({ turns: [] }, output) })
  const deal = { id: 'deal_btn', component: 'Button', label: 'Deal', action: { action: 'deal' } }

  it('passes the betting table alone: its strip and betAction are the whole bet phase', () => {
    expect(run(payload([table()]))).toEqual([])
  })

  it('flags the traced Slider on /bet and an extra Deal Button child, each naming the fix', () => {
    const findings = run(payload([
      table({ children: ['bet_slider', 'deal_btn'] }),
      { id: 'bet_slider', component: 'Slider', label: 'Bet amount', value: { path: '/bet' }, min: 10, max: 500, step: 10 },
      deal,
    ]))
    expect(findings.map((f) => [f.code, f.path])).toEqual([
      ['BET_CONTROL_DUPLICATE', 'table-1:bet_slider'],
      ['BET_CONTROL_DUPLICATE', 'table-1:deal_btn'],
    ])
    expect(findings[0]!.message).toMatch(/Remove bet_slider/)
  })

  it('flags an unbound TextField on the surface while betting, and a betting table with no betAction', () => {
    const noAction = table({ children: ['stake'] })
    delete (noAction as Record<string, unknown>)['betAction']
    const findings = run(payload([noAction, { id: 'stake', component: 'TextField', label: 'Bet', type: 'number' }]))
    expect(findings.map((f) => f.path)).toEqual(['table-1:root', 'table-1:stake'])
    expect(findings[0]!.message).toMatch(/"betAction":"deal"/)
  })

  it('outside betting, the Hit, Stand and Double Buttons are the table\'s children and pass', () => {
    const hit = { id: 'hit_btn', component: 'Button', label: 'Hit', action: { action: 'hit' } }
    expect(run(payload([table({ children: ['hit_btn'] }), hit], 'playing'))).toEqual([])
  })
})

// T-0233 (the recorded Haiku 5.5 repair round, 2026-10-15.jsonl:2): the bet answer resent the CardTable in phase playing
// with `children: []`, so the player had no Hit or Stand. A playing table offers the player's moves.
describe('croupier bet controls: a playing table offers the moves (T-0233)', () => {
  const C = (rank: string, faceDown = false) => ({ rank, suit: 'hearts', ...(faceDown ? { faceDown } : {}) })
  const table = (children: string[]) => ({ id: 'root', component: 'CardTable', phase: { path: '/phase' }, bet: { path: '/bet' }, bankroll: { path: '/bankroll' }, dealerHand: { path: '/dealerHand' }, playerHand: { path: '/playerHand' }, betAction: 'deal', children })
  const payload = (components: Record<string, unknown>[], value: Record<string, unknown>): A2uiOutput => [
    { version: 'v1.0', createSurface: { surfaceId: 'table-1', catalogId: 'agent-ui--croupier' } },
    { version: 'v1.0', updateDataModel: { surfaceId: 'table-1', value: { bankroll: 900, bet: 100, dealerHand: [C('10'), C('6', true)], ...value } } },
    { version: 'v1.0', updateComponents: { surfaceId: 'table-1', components } },
  ] as A2uiOutput
  const run = (output: A2uiOutput) => croupierBetControls.check({ surfaces: semanticSurfaceViews({ turns: [] }, output) })
  const button = (id: string, label: string) => ({ id, component: 'Button', label, action: { action: id } })

  it('the recorded repair (phase playing, children []) is MOVES_MISSING', () => {
    const findings = run(payload([table([])], { phase: 'playing', playerHand: [C('9'), C('7')] }))
    expect(findings.map((f) => [f.code, f.path])).toEqual([['MOVES_MISSING', 'table-1:root']])
    expect(findings[0]!.message).toMatch(/Hit and Stand/)
  })

  it('Hit and Stand, or pontoon\'s Twist and Stick, in the table or beside it, pass', () => {
    expect(run(payload([table(['hit', 'stand']), button('hit', 'Hit'), button('stand', 'Stand')], { phase: 'playing', playerHand: [C('9'), C('7')] }))).toEqual([])
    expect(run(payload([table(['twist', 'stick']), button('twist', 'Twist'), button('stick', 'Stick')], { phase: 'playing', playerHand: [C('9'), C('7')] }))).toEqual([])
    const beside = [{ id: 'col', component: 'Column', children: ['root', 'moves'] }, table([]), { id: 'moves', component: 'Row', children: ['hit'] }, button('hit', 'Hit')]
    expect(run(payload(beside, { phase: 'playing', playerHand: [C('9'), C('7')] }))).toEqual([])
  })

  it('a settled, betting, natural or bust table has no moves to offer and passes', () => {
    expect(run(payload([table([])], { phase: 'settled', playerHand: [C('9'), C('7')] }))).toEqual([])
    expect(run(payload([table([])], { phase: 'betting', playerHand: [], dealerHand: [] }))).toEqual([])
    expect(run(payload([table([])], { phase: 'playing', playerHand: [C('A'), C('K')] }))).toEqual([])
    expect(run(payload([table([])], { phase: 'playing', playerHand: [C('K'), C('8'), C('5')] }))).toEqual([])
  })
})

// T-0172: the live Haiku 5.5 probe built the bet step as a Card with a Slider and a Deal Button, no CardTable.
describe('croupier bet controls: a bet step with no CardTable (T-0172 live probe)', () => {
  const surface = (components: Record<string, unknown>[]): A2uiOutput => [
    { version: 'v1.0', createSurface: { surfaceId: 'ask-1', catalogId: 'agent-ui--croupier', sendDataModel: true } },
    { version: 'v1.0', updateDataModel: { surfaceId: 'ask-1', value: { bankroll: 1000, bet: 50 } } },
    { version: 'v1.0', updateComponents: { surfaceId: 'ask-1', components } },
  ] as A2uiOutput
  const run = (output: A2uiOutput) => croupierBetControls.check({ surfaces: semanticSurfaceViews({ turns: [] }, output) })

  it('flags the probe\'s Card with a Bet amount Slider and a Deal Button, naming the CardTable repair', () => {
    const findings = run(surface([
      { id: 'root', component: 'Card', children: ['hdr', 'body', 'footer'] },
      { id: 'hdr', component: 'CardHeader', children: ['title'] },
      { id: 'title', component: 'Text', text: 'Blackjack: place your bet', variant: 'h4' },
      { id: 'body', component: 'CardContent', children: ['bet_slider'] },
      { id: 'bet_slider', component: 'Slider', name: 'bet', label: 'Bet amount', value: { path: '/bet' }, min: 10, max: 500, step: 10 },
      { id: 'footer', component: 'CardFooter', children: ['deal_btn'] },
      { id: 'deal_btn', component: 'Button', label: 'Deal', variant: 'solid', action: { action: 'place_bet', context: { bet: { path: '/bet' } } } },
    ]))
    expect(findings.map((f) => [f.code, f.path])).toEqual([['BET_TABLE_MISSING', 'ask-1:bet_slider']])
    expect(findings[0]!.message).toMatch(/ONE CardTable, phase "betting"/)
    expect(findings[0]!.message).toMatch(/bet_slider \(a Slider\), deal_btn \(a Button\)/)
  })

  // T-0212 (the recorded Haiku 5.5 seven-card stud opening, 2026-10-15.jsonl:49): a poker bet step keeps its Card.
  const betCard = (title: string): A2uiOutput => surface([
    { id: 'root', component: 'Card', elevation: '1', children: ['hdr', 'content', 'foot'] },
    { id: 'hdr', component: 'CardHeader', children: ['title'] },
    { id: 'title', component: 'Text', text: title, variant: 'h4' },
    { id: 'content', component: 'CardContent', children: ['bet_slider'] },
    { id: 'bet_slider', component: 'Slider', value: 25, min: 5, max: 1000, step: 5, name: 'bet', label: 'Bet amount', layout: 'standard' },
    { id: 'foot', component: 'CardFooter', children: ['btn_bet'] },
    { id: 'btn_bet', component: 'Button', label: 'Deal', variant: 'solid', action: { action: 'place_bet' } },
  ])

  it('T-0212: a bet step that names a game other than blackjack keeps its Card (the recorded stud opening, hold\'em, Omaha, five-card draw)', () => {
    for (const title of ['Seven-card stud · Place your bet', "Texas Hold'em: your buy-in", 'Omaha · Place your bet', 'Five-card draw: ante up', 'Poker night']) {
      expect(run(betCard(title)), title).toEqual([])
    }
  })

  it('T-0212: a blackjack-family bet step, or one that names no game, is still sent back to be a CardTable', () => {
    for (const title of ['Blackjack · Place your bet', 'Spanish 21: place your bet', 'Pontoon', 'Place your bet']) {
      expect(run(betCard(title)).map((f) => f.code), title).toEqual(['BET_TABLE_MISSING'])
    }
  })

  it('passes a surface with no bet control (a rules card), and the CardTable betting table', () => {
    expect(run(surface([{ id: 'root', component: 'Text', text: 'Blackjack pays 3:2.' }]))).toEqual([])
    expect(run(surface([{ id: 'root', component: 'CardTable', phase: 'betting', bet: { path: '/bet' }, betAction: 'deal' }]))).toEqual([])
  })
})

// T-0172: the live probe on f6f94f7f. Haiku 5.5 answered a 50 press with prose and no update; Sonnet 5.5 dealt and
// wrote a bankroll of 500 from 1,000.
describe('croupier action check: a table action moves the table and a deal takes the bet (T-0172 live probe)', () => {
  const action = { name: 'deal', surfaceId: 'table-1', context: { bet: 50 }, dataModel: { bankroll: 1000, bet: 50, phase: 'betting' } }
  const table = { id: 'root', component: 'CardTable', title: 'Blackjack', phase: { path: '/phase' }, bet: { path: '/bet' }, bankroll: { path: '/bankroll' }, dealerHand: { path: '/dealerHand' }, playerHand: { path: '/playerHand' }, betAction: 'deal' }
  const dealt = (bankroll: number, phase = 'playing'): A2uiOutput => [
    { version: 'v1.0', createSurface: { surfaceId: 'table-1', catalogId: 'agent-ui--croupier' } },
    { version: 'v1.0', updateComponents: { surfaceId: 'table-1', components: [table] } },
    { version: 'v1.0', updateDataModel: { surfaceId: 'table-1', value: { bankroll, bet: 50, phase, dealerHand: [{ rank: '10', suit: 'spades' }, { rank: '6', suit: 'clubs', faceDown: true }], playerHand: [{ rank: '9', suit: 'hearts' }, { rank: '7', suit: 'clubs' }] } } },
  ] as A2uiOutput
  const run = (output: A2uiOutput, a: { name: string; surfaceId: string; context: Record<string, unknown>; dataModel: unknown } = action) =>
    croupierActionApplied.check({ surfaces: semanticSurfaceViews({ turns: [] }, output), action: a })

  it('a deal answered with no update to the table is ACTION_NOT_APPLIED (the Haiku prose-only turn)', () => {
    const findings = croupierActionApplied.check({ surfaces: [], action })
    expect(findings.map((f) => [f.code, f.path])).toEqual([['ACTION_NOT_APPLIED', 'table-1:deal']])
    expect(findings[0]!.message).toMatch(/updateDataModel for table-1/)
  })

  it('a deal that leaves the table in betting is ACTION_NOT_APPLIED', () => {
    expect(run(dealt(950, 'betting')).map((f) => f.code)).toEqual(['ACTION_NOT_APPLIED'])
  })

  it('a deal that writes 500 from 1,000 after a 50 bet is BANKROLL_MISMATCH naming 950 (the Sonnet turn); 950 passes', () => {
    const findings = run(dealt(500))
    expect(findings.map((f) => [f.code, f.path])).toEqual([['BANKROLL_MISMATCH', 'table-1:/bankroll']])
    expect(findings[0]!.message).toMatch(/write 950/)
    expect(run(dealt(950))).toEqual([])
  })

  it('T-0216: the table owns the debit, so a deal is held to the context\'s bankrollAfterBet, with or without a click-time data model', () => {
    const owned = { ...action, context: { bet: 50, bankrollAfterBet: 950 } }
    expect(run(dealt(1000), owned).map((f) => f.code)).toEqual(['BANKROLL_MISMATCH'])
    expect(run(dealt(1000), owned)[0]!.message).toMatch(/write 950/)
    expect(run(dealt(1000), { ...owned, dataModel: undefined }).map((f) => f.code)).toEqual(['BANKROLL_MISMATCH'])
    expect(run(dealt(950), { ...owned, dataModel: undefined })).toEqual([])
  })

  it('a move other than a table action, or Deal again on a new table, passes', () => {
    expect(croupierActionApplied.check({ surfaces: [], action: { ...action, name: 'show_rules' } })).toEqual([])
    const next = dealt(950).map((m) => JSON.parse(JSON.stringify(m).replace(/table-1/g, 'table-2'))) as A2uiOutput
    expect(croupierActionApplied.check({ surfaces: semanticSurfaceViews({ turns: [] }, next), action: { ...action, name: 'hit' } })).toEqual([])
  })
})

// T-0172 (the live probe on afc073a3): Sonnet 5.5 hit to 21 against the dealer's 17 and settled. The settle check pays
// out from the click-time bankroll by the result the hands show.
describe('croupier action check: settlement pays out from the click-time bankroll (T-0172)', () => {
  const table = { id: 'root', component: 'CardTable', phase: { path: '/phase' }, bet: { path: '/bet' }, bankroll: { path: '/bankroll' }, dealerHand: { path: '/dealerHand' }, playerHand: { path: '/playerHand' }, betAction: 'deal' }
  const C = (rank: string, suit = 'clubs') => ({ rank, suit })
  const settle = (bankroll: number, playerHand: unknown[], dealerHand: unknown[], bet = 0): A2uiOutput => [
    { version: 'v1.0', createSurface: { surfaceId: 'table-1', catalogId: 'agent-ui--croupier' } },
    { version: 'v1.0', updateComponents: { surfaceId: 'table-1', components: [table] } },
    { version: 'v1.0', updateDataModel: { surfaceId: 'table-1', value: { bankroll, bet, phase: 'settled', playerHand, dealerHand } } },
  ] as A2uiOutput
  const run = (output: A2uiOutput, name: string, dataModel: Record<string, unknown>, context: Record<string, unknown> = {}) =>
    croupierActionApplied.check({ surfaces: semanticSurfaceViews({ turns: [] }, output), action: { name, surfaceId: 'table-1', context, dataModel } })
  const playing = (bankroll: number, bet = 50) => ({ bankroll, bet, phase: 'playing' })
  const win = [C('9'), C('8'), C('4')]
  const dealer17 = [C('K'), C('7')]

  it('the traced Sonnet settle (450 to 550 on a 21 over 17 win) passes; from 950 it must read 1,050', () => {
    expect(run(settle(550, win, dealer17), 'hit', playing(450))).toEqual([])
    const findings = run(settle(550, win, dealer17), 'hit', playing(950))
    expect(findings.map((f) => f.code)).toEqual(['BANKROLL_MISMATCH'])
    expect(findings[0]!.message).toMatch(/a win \(21 over 17\) on a stake of 50, so the bankroll goes from 950 to 1050/)
  })

  it('a push pays the stake back, a loss pays nothing, a bust pays nothing', () => {
    expect(run(settle(1000, [C('K'), C('7')], dealer17), 'stand', playing(950))).toEqual([])
    expect(run(settle(950, [C('K'), C('6')], dealer17), 'stand', playing(950))).toEqual([])
    expect(run(settle(950, [C('K'), C('6'), C('9')], dealer17), 'hit', playing(950))).toEqual([])
    expect(run(settle(1100, [C('K'), C('6')], dealer17), 'stand', playing(950)).map((f) => f.code)).toEqual(['BANKROLL_MISMATCH'])
  })

  it('a natural settled on the deal takes the bet and pays 2.5x in one step (1,000 to 1,075 on 50)', () => {
    expect(run(settle(1075, [C('A'), C('K')], [C('9'), C('7')]), 'deal', { bankroll: 1000, bet: 50, phase: 'betting' }, { bet: 50 })).toEqual([])
    expect(run(settle(1025, [C('A'), C('K')], [C('9'), C('7')]), 'deal', { bankroll: 1000, bet: 50, phase: 'betting' }, { bet: 50 }).map((f) => f.code)).toEqual(['BANKROLL_MISMATCH'])
  })

  it('a double takes one more stake and pays on twice the bet (950 to 1,100 on a doubled 50 win)', () => {
    expect(run(settle(1100, [C('6'), C('5'), C('K')], dealer17, 100), 'double', playing(950))).toEqual([])
  })
})


// T-0211 (the recorded Haiku 5.5 trace, 2026-10-15.jsonl:4): Deal again ({action: deal, context: {newRound: true}})
// was answered with table-2 already dealt at the old 100 stake. Kim's ruling (T-0172): the next round opens in the
// betting phase, so the player picks a stake on the table's own strip.
describe('croupier action check: Deal again opens the next round in betting (T-0211)', () => {
  const table = { id: 'root', component: 'CardTable', title: 'Blackjack', phase: { path: '/phase' }, bet: { path: '/bet' }, bankroll: { path: '/bankroll' }, dealerHand: { path: '/dealerHand' }, playerHand: { path: '/playerHand' }, betAction: 'deal' }
  const C = (rank: string, faceDown = false) => ({ rank, suit: 'clubs', ...(faceDown ? { faceDown } : {}) })
  const settled = { bankroll: 900, bet: 0, phase: 'settled', dealerHand: [C('K'), C('9')], playerHand: [C('9'), C('7')] }
  const again = { name: 'deal', surfaceId: 'table-1', context: { newRound: true }, dataModel: settled }
  const next = (sid: string, value: Record<string, unknown>): A2uiOutput => [
    { version: 'v1.0', createSurface: { surfaceId: sid, catalogId: 'agent-ui--croupier' } },
    { version: 'v1.0', updateComponents: { surfaceId: sid, components: [table] } },
    { version: 'v1.0', updateDataModel: { surfaceId: sid, value } },
  ] as A2uiOutput
  const run = (output: A2uiOutput, a: { name: string; surfaceId: string; context: Record<string, unknown>; dataModel: unknown } = again) =>
    croupierActionApplied.check({ surfaces: semanticSurfaceViews({ turns: [] }, output), action: a })
  const betting = { bankroll: 900, bet: 0, phase: 'betting', dealerHand: [], playerHand: [] }

  it('the recorded answer (table-2 dealt, phase playing, at the old 100 bet) is NEW_ROUND_NOT_BETTING naming the strip', () => {
    const findings = run(next('table-2', { bankroll: 900, bet: 100, phase: 'playing', dealerHand: [C('7'), C('5', true)], playerHand: [C('K'), C('8')] }))
    expect(findings.map((f) => [f.code, f.path])).toEqual([['NEW_ROUND_NOT_BETTING', 'table-2:root']])
    expect(findings[0]!.message).toMatch(/phase "betting"/)
    expect(findings[0]!.message).toMatch(/bet strip/)
  })

  it('a betting table with empty hands and the settled bankroll passes, as a fresh surface or the same one reset', () => {
    expect(run(next('table-2', betting))).toEqual([])
    expect(run(next('table-1', betting))).toEqual([])
    expect(run(next('table-2', betting), { ...again, name: 'dealAgain', context: {} })).toEqual([])
    expect(run([...next('table-1', settled), ...next('table-2', betting)])).toEqual([]) // the old table touched as history
  })

  it('a betting table that keeps the old cards, or opens on a bankroll other than the settled one, is sent back', () => {
    expect(run(next('table-2', { ...betting, playerHand: [C('K'), C('8')] })).map((f) => f.code)).toEqual(['NEW_ROUND_NOT_BETTING'])
    const drift = run(next('table-2', { ...betting, bankroll: 1000 }))
    expect(drift.map((f) => f.code)).toEqual(['BANKROLL_MISMATCH'])
    expect(drift[0]!.message).toMatch(/900/)
  })

  it('Deal again answered with no table at all is ACTION_NOT_APPLIED', () => {
    expect(croupierActionApplied.check({ surfaces: [], action: again }).map((f) => f.code)).toEqual(['ACTION_NOT_APPLIED'])
  })

  it('a poker Deal again answered by a new Card surface (no CardTable) passes', () => {
    const omaha = [
      { version: 'v1.0', createSurface: { surfaceId: 'table-2', catalogId: 'agent-ui--croupier' } },
      { version: 'v1.0', updateDataModel: { surfaceId: 'table-2', value: { dealerHand: [C('Q', true), C('7', true)], playerHand: [C('A'), C('K')] } } },
      { version: 'v1.0', updateComponents: { surfaceId: 'table-2', components: [
        { id: 'root', component: 'Card', children: ['title', 'drow'] },
        { id: 'title', component: 'Text', text: 'Omaha · Hand 2' },
        { id: 'drow', component: 'Row', children: { path: '/dealerHand', componentId: 'dcard' } },
        { id: 'dcard', component: 'PlayingCard', rank: { path: 'rank' }, suit: { path: 'suit' }, faceDown: { path: 'faceDown' } },
      ] } },
    ] as A2uiOutput
    expect(run(omaha)).toEqual([])
  })
})

// T-0232 (the recorded Sonnet 5.5 trace, 2026-10-15.jsonl:104): "Let's play blackjack." opened table-1 already dealt at
// a 50 stake the model picked. A say turn's first table opens in betting, unless the user's words name the stake.
describe('croupier action check: a game opens in betting unless the user names a stake (T-0232)', () => {
  const table = { id: 'root', component: 'CardTable', title: 'Blackjack', phase: { path: '/phase' }, bet: { path: '/bet' }, bankroll: { path: '/bankroll' }, dealerHand: { path: '/dealerHand' }, playerHand: { path: '/playerHand' }, betAction: 'deal' }
  const C = (rank: string, faceDown = false) => ({ rank, suit: 'clubs', ...(faceDown ? { faceDown } : {}) })
  const open = (value: Record<string, unknown>, sid = 'table-1'): A2uiOutput => [
    { version: 'v1.0', createSurface: { surfaceId: sid, catalogId: 'agent-ui--croupier' } },
    { version: 'v1.0', updateComponents: { surfaceId: sid, components: [table] } },
    { version: 'v1.0', updateDataModel: { surfaceId: sid, value } },
  ] as A2uiOutput
  const dealt = { bankroll: 950, bet: 50, phase: 'playing', dealerHand: [C('10'), C('6', true)], playerHand: [C('9'), C('5')] }
  const betting = { bankroll: 1000, bet: 0, phase: 'betting', dealerHand: [], playerHand: [] }
  const say = (output: A2uiOutput, intent: string, session: Session = { turns: [] }) => croupierActionApplied.check({ surfaces: semanticSurfaceViews(session, output), intent })

  it('the recorded opening (dealt at a stake the user never named) is NEW_ROUND_NOT_BETTING', () => {
    const findings = say(open(dealt), "Let's play blackjack.")
    expect(findings.map((f) => [f.code, f.path])).toEqual([['NEW_ROUND_NOT_BETTING', 'table-1:root']])
    expect(findings[0]!.message).toMatch(/phase "betting"/)
    expect(say(open(dealt), "Let's play pontoon, or 21.").map((f) => f.code)).toEqual(['NEW_ROUND_NOT_BETTING']) // a game name is no stake
  })

  it('a typed stake deals legally, and a betting opening passes', () => {
    expect(say(open(dealt), 'Deal me in for 50.')).toEqual([])
    expect(say(open(betting), "Let's play blackjack.")).toEqual([])
  })

  it('a table the session already holds, or a turn with no user words, is not an opening', () => {
    const session: Session = { turns: [{ role: 'user', content: 'Deal me in for 50.' }, { role: 'assistant', content: open(dealt).map((m) => JSON.stringify(m)).join('\n') }] }
    const update = [{ version: 'v1.0', updateDataModel: { surfaceId: 'table-1', value: { ...dealt, playerHand: [C('9'), C('5'), C('2')] } } }] as A2uiOutput
    expect(say(update, 'Hit me.', session)).toEqual([])
    expect(croupierActionApplied.check({ surfaces: semanticSurfaceViews({ turns: [] }, open(dealt)) })).toEqual([])
  })
})

// T-0214 (the recorded Haiku 5.5 five-card draw, 2026-10-15.jsonl:48): "Bet 50." was answered with the meta-line
// targeting table-1 and a showdown narrated in prose ("bankroll is now 1,050"), and no update to table-1.
describe('croupier action check: a typed move at an open table updates it (T-0214)', () => {
  const card = { id: 'root', component: 'Card', children: ['title'] }
  const update = (sid: string): A2uiOutput => [{ version: 'v1.0', updateComponents: { surfaceId: sid, components: [card, { id: 'title', component: 'Text', text: 'Showdown' }] } }] as A2uiOutput
  const typed = (surfaces: A2uiOutput, intent: string, target?: string) =>
    croupierActionApplied.check({ surfaces: semanticSurfaceViews({ turns: [] }, surfaces), intent, ...(target !== undefined ? { target } : {}) })

  it('the recorded prose-only answer to "Bet 50." targeting table-1 is ACTION_NOT_APPLIED', () => {
    const findings = typed([], 'Bet 50.', 'table-1')
    expect(findings.map((f) => [f.code, f.path])).toEqual([['ACTION_NOT_APPLIED', 'table-1:bet']])
    expect(findings[0]!.message).toMatch(/updateDataModel for table-1/)
    expect(typed(update('table-2'), 'Hit me.', 'table-1').map((f) => f.code)).toEqual(['ACTION_NOT_APPLIED']) // another surface is not the table
  })

  it('an update to the targeted table, a turn with no move word, or no target passes', () => {
    expect(typed(update('table-1'), 'Bet 50.', 'table-1')).toEqual([])
    expect(typed([], 'What beats a flush?', 'table-1')).toEqual([])
    expect(typed([], 'Bet 50.')).toEqual([])
  })
})

// T-0286 (the recorded Haiku 5.5 Omaha river, round 4 :55): "Check, or call if there is a bet." was answered with the
// showdown in prose, no target and no surface, while table-1 still offered Check and Bet.
describe('croupier action check: a move typed with no target updates the open table offering it (T-0286)', () => {
  const table = (sid: string, buttons: readonly [string, string][]): string =>
    JSON.stringify({ version: 'v1.0', updateComponents: { surfaceId: sid, components: [
      { id: 'root', component: 'Card', children: buttons.map(([id]) => id) },
      ...buttons.map(([id, action]) => ({ id, component: 'Button', label: action.replace('_', ' '), action: { action } })),
    ] } })
  const session = (...lines: string[]) => sessionSurfaceViews({ turns: [{ role: 'assistant', content: lines.join('\n') }] })
  const live = session(table('table-1', [['checkBtn', 'check'], ['betBtn', 'bet']]))
  const typed = (intent: string, open: ReturnType<typeof session>, out: A2uiOutput = []) =>
    croupierActionApplied.check({ surfaces: semanticSurfaceViews({ turns: [] }, out), intent, open })

  it('the recorded prose-only river check with no target is ACTION_NOT_APPLIED on table-1', () => {
    const findings = typed('Check, or call if there is a bet.', live)
    expect(findings.map((f) => [f.code, f.path])).toEqual([['ACTION_NOT_APPLIED', 'table-1:check']])
    expect(findings[0]!.message).toMatch(/updateDataModel for table-1/)
    const two = session(table('table-1', [['checkBtn', 'check']]), table('table-2', [['callBtn', 'call'], ['foldBtn', 'fold']]))
    expect(typed('Check, or call if there is a bet.', two).map((f) => f.path)).toEqual(['table-2:check']) // the latest table offering it
  })

  it('a settled table offering only Deal again, a question, an answer that sends a surface, or no open table passes', () => {
    expect(typed('Check, or call if there is a bet.', session(table('stud-1', [['dealAgainBtn', 'deal_again']])))).toEqual([])
    expect(typed('Should I check?', live)).toEqual([])
    const sent: A2uiOutput = [{ version: 'v1.0', updateDataModel: { surfaceId: 'table-1', path: '/status', value: 'River' } }] as A2uiOutput
    expect(typed('Check, or call if there is a bet.', live, sent)).toEqual([])
    expect(typed('Check, or call if there is a bet.', [])).toEqual([])
  })
})

// T-0218 (the recorded Omaha turns, 2026-10-15.jsonl:105 and :37 to :41): Sonnet 5.5 dealt the dealer four identical
// face-down 2 of clubs, Haiku 5.5 four aces of spades it swapped mid-hand. A poker deal is one deck: every card is
// distinct, and a face-down card is a committed card that turns up as itself.
describe('croupier deck check: a poker deal is one committed deck (T-0218)', () => {
  const DECK_CODES = ['CARD_DUPLICATE', 'HOLE_CARD_CHANGED']
  const C = (rank: string, suit: string, faceDown = false) => ({ rank, suit, faceDown })
  const omaha = (sid: string, value: Record<string, unknown>, title = 'Omaha · Pre-flop'): A2uiOutput => [
    { version: 'v1.0', createSurface: { surfaceId: sid, catalogId: 'agent-ui--croupier' } },
    { version: 'v1.0', updateDataModel: { surfaceId: sid, value } },
    { version: 'v1.0', updateComponents: { surfaceId: sid, components: [
      { id: 'root', component: 'Column', children: ['hud', 'drow', 'prow'] },
      { id: 'hud', component: 'GameHud', title, status: 'Your turn' },
      { id: 'drow', component: 'Row', children: { path: '/dealerHand', componentId: 'dcard' } },
      { id: 'dcard', component: 'PlayingCard', rank: { path: 'rank' }, suit: { path: 'suit' }, faceDown: { path: 'faceDown' } },
      { id: 'prow', component: 'Row', children: { path: '/playerHand', componentId: 'pcard' } },
      { id: 'pcard', component: 'PlayingCard', rank: { path: 'rank' }, suit: { path: 'suit' }, faceDown: { path: 'faceDown' } },
    ] } },
  ] as A2uiOutput
  const deck = (output: A2uiOutput, action?: { name: string; surfaceId: string; context: Record<string, unknown>; dataModel: unknown }) =>
    croupierSemanticChecks
      .flatMap((c) => c.check({ surfaces: semanticSurfaceViews({ turns: [] }, output), ...(action !== undefined ? { action } : {}) }))
      .filter((f) => DECK_CODES.includes(f.code))
  const player = [C('A', 'spades'), C('K', 'spades'), C('9', 'hearts'), C('8', 'hearts')]
  const hole = [C('Q', 'diamonds', true), C('7', 'clubs', true), C('7', 'hearts', true), C('2', 'spades', true)]

  it('the recorded Sonnet deal (four face-down 2 of clubs) is CARD_DUPLICATE naming the placeholder', () => {
    const f = deck(omaha('table-1', { dealerHand: [0, 1, 2, 3].map(() => C('2', 'clubs', true)), playerHand: player }))
    expect(f.map((x) => [x.code, x.path])).toEqual([['CARD_DUPLICATE', 'table-1:/dealerHand']])
    expect(f[0]!.message).toMatch(/2 of clubs/)
    expect(f[0]!.message).toMatch(/real/)
  })

  it('a duplicate across hands is caught too (the Haiku aces of spades), and a distinct deal passes', () => {
    expect(deck(omaha('table-1', { dealerHand: [C('A', 'spades', true), C('3', 'clubs', true)], playerHand: player })).map((x) => x.code)).toEqual(['CARD_DUPLICATE'])
    expect(deck(omaha('table-1', { dealerHand: hole, playerHand: player }))).toEqual([])
  })

  it('a hole card that turns up as another card, or is swapped while face down, is HOLE_CARD_CHANGED', () => {
    const before = { dealerHand: hole, playerHand: player }
    const action = { name: 'omaha_action', surfaceId: 'table-1', context: { move: 'call' }, dataModel: before }
    const revealed = hole.map((c) => ({ ...c, faceDown: false }))
    expect(deck(omaha('table-1', { dealerHand: revealed, playerHand: player }), action)).toEqual([])
    const swapped = [{ ...revealed[0]!, rank: 'A' }, ...revealed.slice(1)]
    const f = deck(omaha('table-1', { dealerHand: swapped, playerHand: player }), action)
    expect(f.map((x) => [x.code, x.path])).toEqual([['HOLE_CARD_CHANGED', 'table-1:/dealerHand/0']])
    expect(f[0]!.message).toMatch(/Q of diamonds/)
    const hidden = [{ ...hole[0]!, rank: 'A' }, ...hole.slice(1)]
    expect(deck(omaha('table-1', { dealerHand: hidden, playerHand: player }), action).map((x) => x.code)).toEqual(['HOLE_CARD_CHANGED'])
  })

  it('never judged: a blackjack table (a shoe of decks), a draw game\'s redraw, a new round, another surface', () => {
    expect(deck(omaha('table-1', { dealerHand: [C('K', 'clubs'), C('K', 'clubs')], playerHand: [] }, 'Blackjack'))).toEqual([])
    const before = { dealerHand: hole, playerHand: player }
    const redraw = [C('J', 'clubs', true), ...hole.slice(1)]
    const action = { name: 'draw', surfaceId: 'table-1', context: {}, dataModel: before }
    expect(deck(omaha('table-1', { dealerHand: redraw, playerHand: player }, 'Five-card draw'), action)).toEqual([])
    expect(deck(omaha('table-1', { dealerHand: redraw, playerHand: player }), { ...action, context: { newRound: true } })).toEqual([])
    expect(deck(omaha('table-2', { dealerHand: redraw, playerHand: player }), action)).toEqual([])
  })
})

// T-0219 (the recorded Spanish 21 Haiku 5.5 turn, 2026-10-15.jsonl:20, and the Pontoon Sonnet 5.5 buy, :90): a result
// line that says 18 beats a soft 20, or calls a surrender a comparison, and a bought card dealt face up.
describe('croupier rules check: the result line and a buy agree with the cards and the rules (T-0219)', () => {
  const RULE_CODES = ['RESULT_CONTRADICTS_CARDS', 'BUY_CARD_FACE_UP']
  const C = (rank: string, suit: string, faceDown = false) => ({ rank, suit, ...(faceDown ? { faceDown } : {}) })
  const table = (title: string, extra: Record<string, unknown> = {}) => ({ id: 'root', component: 'CardTable', title, phase: { path: '/phase' }, status: { path: '/status' }, bankroll: { path: '/bankroll' }, bet: { path: '/bet' }, dealerHand: { path: '/dealerHand' }, playerHand: { path: '/playerHand' }, betAction: 'deal', ...extra })
  const surface = (title: string, value: Record<string, unknown>, extra: Record<string, unknown> = {}): A2uiOutput => [
    { version: 'v1.0', createSurface: { surfaceId: 'table-2', catalogId: 'agent-ui--croupier' } },
    { version: 'v1.0', updateDataModel: { surfaceId: 'table-2', value } },
    { version: 'v1.0', updateComponents: { surfaceId: 'table-2', components: [table(title, extra)] } },
  ] as A2uiOutput
  const rules = (output: A2uiOutput, action?: { name: string; surfaceId: string; context: Record<string, unknown>; dataModel: unknown }) =>
    croupierSemanticChecks
      .flatMap((c) => c.check({ surfaces: semanticSurfaceViews({ turns: [] }, output), ...(action !== undefined ? { action } : {}) }))
      .filter((f) => RULE_CODES.includes(f.code))
  const settled = (status: string, extra: Record<string, unknown> = {}) =>
    surface('Spanish 21', { bankroll: 850, bet: 0, phase: 'settled', status, dealerHand: [C('8', 'spades'), C('Q', 'hearts')], playerHand: [C('A', 'hearts'), C('9', 'clubs')] }, extra)

  it('the recorded surrender line ("Dealer 18 beats your soft 20") is RESULT_CONTRADICTS_CARDS naming both faults', () => {
    const f = rules(settled('You surrender. Dealer 18 beats your soft 20. You lose 50.'))
    expect(f.map((x) => [x.code, x.path])).toEqual([['RESULT_CONTRADICTS_CARDS', 'table-2:root.status']])
    expect(f[0]!.message).toMatch(/18 does not beat 20/)
    expect(f[0]!.message).toMatch(/surrender/)
    expect(rules(settled('You surrender: half your 100 back, bankroll 850.'))).toEqual([])
  })

  it('true comparisons pass, in every recorded wording; a bust never wins and a lower total never beats a higher one', () => {
    for (const ok of ["You win: 19 (10, 5, 4) beats the dealer's 18. +200 chips.", "Player wins with 19 (10, 5, 4) over the dealer's 18 (8, 7, 3).", 'Dealer wins: 18 (9, 5, 4) beats your 16.', 'Your 20 beats the dealer\'s 24, a bust.', 'Your 16 loses to the dealer\'s 18.']) {
      expect(rules(settled(ok)), ok).toEqual([])
    }
    for (const bad of ['Your 16 beats the dealer\'s 18.', "Your 23 beats the dealer's 19.", 'Dealer wins with 17 over your 20.', 'Your 20 loses to the dealer\'s 18.']) {
      expect(rules(settled(bad)).map((x) => x.code), bad).toEqual(['RESULT_CONTRADICTS_CARDS'])
    }
    expect(rules(settled('Settled.', { result: 'Your 16 beats the dealer\'s 18.' })).map((x) => x.path)).toEqual(['table-2:root.result'])
  })

  it('a Pontoon buy deals the bought card face down; a twist deals face up', () => {
    const before = { bankroll: 800, bet: 100, phase: 'playing', dealerHand: [C('8', 'spades', true), C('7', 'diamonds', true)], playerHand: [C('10', 'hearts'), C('5', 'clubs')] }
    const after = (third: Record<string, unknown>) => surface('Pontoon', { ...before, bankroll: 700, bet: 200, playerHand: [...before.playerHand, third] })
    const press = (name: string) => ({ name, surfaceId: 'table-2', context: {}, dataModel: before })
    const f = rules(after(C('4', 'diamonds')), press('buy'))
    expect(f.map((x) => [x.code, x.path])).toEqual([['BUY_CARD_FACE_UP', 'table-2:/playerHand/2']])
    expect(f[0]!.message).toMatch(/face down/)
    expect(rules(after(C('4', 'diamonds', true)), press('buy'))).toEqual([])
    expect(rules(after(C('4', 'diamonds')), press('twist'))).toEqual([])
  })
})

// T-0265 (the recorded Haiku 5.5 openings, round 3 texas-holdem and five-card-draw turn 0): the game was dealt in
// prose with no table, no target and no surface.
describe('croupier action check: a game asked for opens a surface (T-0265)', () => {
  const said = (intent: string, surfaces: A2uiOutput = [], target?: string) =>
    croupierActionApplied.check({ surfaces: semanticSurfaceViews({ turns: [] }, surfaces), intent, ...(target !== undefined ? { target } : {}) })
  const table: A2uiOutput = [
    { version: 'v1.0', createSurface: { surfaceId: 'table-1', catalogId: 'agent-ui--croupier' } },
    { version: 'v1.0', updateComponents: { surfaceId: 'table-1', components: [{ id: 'root', component: 'Text', text: 'Five-card draw' }] } },
  ] as A2uiOutput

  it("the recorded prose-only openings are SURFACE_MISSING", () => {
    const findings = said("Let's play Texas hold'em.")
    expect(findings.map((f) => [f.code, f.path])).toEqual([['SURFACE_MISSING', "opening:hold'em"]])
    expect(findings[0]!.message).toMatch(/createSurface/)
    expect(said("Let's play five-card draw.").map((f) => f.code)).toEqual(['SURFACE_MISSING'])
    expect(said('Deal me in for a hand of blackjack').map((f) => f.code)).toEqual(['SURFACE_MISSING'])
  })

  it('a turn that opens a surface, a question, a turn with no game named, or a targeted turn passes', () => {
    expect(said("Let's play five-card draw.", table)).toEqual([])
    expect(said("How do you play Texas hold'em?")).toEqual([])
    expect(said("Let's play.")).toEqual([])
    expect(said('Check, or call if there is a bet.')).toEqual([])
    expect(said("Let's play another hand of blackjack.", [], 'table-1')).toEqual([])
  })
})
