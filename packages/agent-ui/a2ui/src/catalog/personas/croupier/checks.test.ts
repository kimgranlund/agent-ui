// checks.test.ts: the croupier hand check (ADR-0238; GH #1795), driven through the generic hook's
// own view builder (`semanticSurfaceViews`) so every case judges the MERGED graph the renderer would hold.
// Red-then-green: the live evidence passes structural validation on top of its deal turn and still fails
// here with one clear dealer finding; its repair and the taught data-driven shape pass.

import { describe, it, expect } from 'vitest'
import { croupierActionApplied, croupierBetControls, croupierHandConsistency, croupierSemanticChecks } from './checks.ts'
import { croupierManifest } from './manifest.ts'
import { CORRECTED_LINE, DATA_DRIVEN_TURN, DEAL_TURN, EVIDENCE_LINE, NATURAL_REPAIRED_TURN, NATURAL_TURN, toJsonl } from './hands.fixture.ts'
import { semanticSurfaceViews, sessionSurfaceViews } from '../../semantic-check.ts'
import type { SemanticAction, SemanticFinding } from '../../semantic-check.ts'
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
  personaBasicCroupierCardTableSettledSeed,
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

  it('CardTable: NATURAL_ACTIONS on a pontoon names 2:1, the dealer winning the tie, and Twist, Stick or Buy (T-0334)', () => {
    const natural = (title: string) =>
      table((root, data) => {
        root['title'] = title
        data['playerHand'] = [{ rank: 'A', suit: 'spades' }, { rank: 'K', suit: 'hearts' }]
        data['playerTotal'] = 21
      })
    const pontoon = judge({ turns: [] }, natural('Pontoon'))[0]!
    expect(pontoon.code).toBe('NATURAL_ACTIONS')
    expect(pontoon.message).toContain('are a pontoon, which ends')
    expect(pontoon.message).toContain('the player wins 2:1 unless the dealer also has a pontoon, then the dealer wins the tie')
    expect(pontoon.message).toContain('with no Twist, Stick or Buy')
    expect(pontoon.message).not.toMatch(/push|3:2|Hit, Stand/)
    // A buy is a move only as a card move, and only in pontoon: "Buy chips" never counts.
    const withBuys = natural('Pontoon')
    tableComponents(withBuys).push(
      { id: 'buyBtn', component: 'Button', label: 'Buy a card', action: { event: { name: 'buy' } } },
      { id: 'chipsBtn', component: 'Button', label: 'Buy chips', action: { event: { name: 'buy_chips' } } },
    )
    const listed = judge({ turns: [] }, withBuys)[0]!.message
    expect(listed).toContain('buyBtn (buy)')
    expect(listed).not.toContain('chipsBtn')
    const blackjackBuys = natural('Blackjack')
    tableComponents(blackjackBuys).push({ id: 'buyBtn', component: 'Button', label: 'Buy a card', action: { event: { name: 'buy' } } })
    expect(judge({ turns: [] }, blackjackBuys)[0]!.message).not.toContain('buyBtn')
    const blackjack = judge({ turns: [] }, natural('Blackjack'))[0]!
    expect(blackjack.message).toContain('the player wins 3:2 unless the dealer also has a natural blackjack, then a push')
    expect(blackjack.message).toContain('with no Hit, Stand or Double')
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

  it('T-0334: Buy and Buy a card are moves in pontoon only; Buy chips and Buy in are moves nowhere', () => {
    const hand = { phase: 'playing', playerHand: [C('9'), C('7')] }
    const on = (title: string, ...buttons: [string, string][]) =>
      run(payload([{ ...table([]), title }, ...buttons.map(([id, label]) => button(id, label))], hand)).map((f) => f.code)
    expect(on('Pontoon', ['buy', 'Buy'])).toEqual([])
    expect(on('Pontoon', ['b2', 'Buy a card'])).toEqual([])
    expect(on('Pontoon', ['buy_card', 'Get one'])).toEqual([])
    expect(on('Pontoon', ['c1', 'Buy chips'], ['c2', 'Buy in'])).toEqual(['MOVES_MISSING'])
    expect(on('Blackjack', ['buy', 'Buy'])).toEqual(['MOVES_MISSING'])
    expect(on('Blackjack', ['c1', 'Buy chips'])).toEqual(['MOVES_MISSING'])
  })

  it('a settled, betting, natural or bust table has no moves to offer and passes', () => {
    // T-0350: a table this payload settles still offers Deal again.
    expect(run(payload([table(['again']), { ...button('again', 'Deal again'), action: { action: 'deal', context: { newRound: true } } }], { phase: 'settled', playerHand: [C('9'), C('7')] }))).toEqual([])
    expect(run(payload([table([])], { phase: 'betting', playerHand: [], dealerHand: [] }))).toEqual([])
    expect(run(payload([table([])], { phase: 'playing', playerHand: [C('A'), C('K')] }))).toEqual([])
    expect(run(payload([table([])], { phase: 'playing', playerHand: [C('K'), C('8'), C('5')] }))).toEqual([])
  })
})

// T-0350: round 10 :101 (regress-croupier-pontoon-haiku-1). Round 1 settled a pontoon on table-2 with dealAgainBtn2;
// the round-2 repair sent only updateDataModel, so the bare CardTable (no bet strip once settled) shipped with no way on.
describe('croupier bet controls: a table this turn settles offers Deal again (T-0350)', () => {
  const C = (rank: string, suit = 'hearts') => ({ rank, suit })
  const binds = { dealerHand: { path: '/dealerHand' }, playerHand: { path: '/playerHand' }, dealerTotal: { path: '/dealerTotal' }, playerTotal: { path: '/playerTotal' }, bankroll: { path: '/bankroll' }, bet: { path: '/bet' }, phase: { path: '/phase' }, status: { path: '/status' } }
  const table = (children?: string[], title = 'Pontoon') => ({ id: 'root', component: 'CardTable', title, ...binds, betAction: 'deal', ...(children ? { children } : {}) })
  const betting = () => ({ bankroll: 1100, bet: 0, dealerHand: [], dealerTotal: '', playerHand: [], playerTotal: 0, phase: 'betting', status: 'Place your stake to deal' })
  const settledData = { bankroll: 1300, bet: 0, dealerHand: [C('7'), C('9', 'clubs')], dealerTotal: 16, playerHand: [C('A', 'spades'), C('Q', 'diamonds')], playerTotal: 21, phase: 'settled', status: "Pontoon! Your A and Q beat the dealer's 16. You win 200, bankroll 1,300." }
  const open = (sid: string, components: Record<string, unknown>[], value: Record<string, unknown>): A2uiOutput => [
    { version: 'v1.0', createSurface: { surfaceId: sid, catalogId: 'agent-ui--croupier', sendDataModel: true } },
    { version: 'v1.0', updateDataModel: { surfaceId: sid, value } },
    { version: 'v1.0', updateComponents: { surfaceId: sid, components } },
  ] as A2uiOutput
  const data = (sid: string, value: Record<string, unknown>) => ({ version: 'v1.0', updateDataModel: { surfaceId: sid, value } })
  const comps = (sid: string, components: Record<string, unknown>[]) => ({ version: 'v1.0', updateComponents: { surfaceId: sid, components } })
  const again = (id: string, action: Record<string, unknown> = { action: 'deal', context: { newRound: true } }) => ({ id, component: 'Button', label: 'Deal again', variant: 'solid', action })
  const session = (...turns: A2uiOutput[]): Session => ({ turns: turns.flatMap((t) => [{ role: 'user', content: 'go' }, { role: 'assistant', content: toJsonl(t) }]) })
  const run = (sess: Session, output: readonly unknown[]) =>
    croupierBetControls.check({ surfaces: semanticSurfaceViews(sess, output as A2uiOutput) }).filter((f) => f.code === 'DEAL_AGAIN_MISSING').map((f) => [f.code, f.path])
  // The :100 turn: table-2 opens in betting, a bare CardTable root whose bet strip deals.
  const turn100 = session(open('table-2', [table()], betting()))

  it('the :101 shipped round 2 (only updateDataModel, phase settled) is DEAL_AGAIN_MISSING', () => {
    const findings = croupierBetControls.check({ surfaces: semanticSurfaceViews(turn100, [data('table-2', settledData)] as A2uiOutput) })
    expect(findings.map((f) => [f.code, f.path])).toEqual([['DEAL_AGAIN_MISSING', 'table-2:root']])
    expect(findings[0]!.message).toMatch(/no Deal again Button/)
    expect(findings[0]!.message).toMatch(/"newRound":true/)
  })

  it('the repair names the rejected answer only on a round after one was rejected', () => {
    const message = (round?: number) =>
      croupierBetControls.check({ surfaces: semanticSurfaceViews(turn100, [data('table-2', settledData)] as A2uiOutput), ...(round !== undefined ? { round } : {}) })[0]!.message
    expect(message(1)).toMatch(/an answer the checks rejected never reached the player/)
    expect(message(0)).not.toMatch(/rejected/)
    expect(message()).not.toMatch(/rejected/)
  })

  it('the repair asks for the settled data model with the components: a components-only repair is BET_CONTROL_DUPLICATE, the full one passes every check', () => {
    expect(croupierBetControls.check({ surfaces: semanticSurfaceViews(turn100, [data('table-2', settledData)] as A2uiOutput) })[0]!.message).toMatch(/updateDataModel \(phase "settled" and the bankroll\)/)
    const all = (output: unknown[]) => croupierSemanticChecks.flatMap((c) => c.check({ surfaces: semanticSurfaceViews(turn100, output as A2uiOutput) })).map((f) => f.code)
    const button = comps('table-2', [table(['dealAgainBtn2']), again('dealAgainBtn2')])
    expect(all([button])).toContain('BET_CONTROL_DUPLICATE')
    expect(all([data('table-2', settledData), button])).toEqual([])
  })

  it('the :101 round 1 shape (dealAgainBtn2 a child of the table) passes', () => {
    expect(run(turn100, [data('table-2', settledData), comps('table-2', [table(['dealAgainBtn2']), again('dealAgainBtn2')])])).toEqual([])
  })

  it('a table settled in a turn before this one is not judged again, literal or bound, with or without a prior data model', () => {
    const settledBare = session(open('table-2', [table()], betting()), [data('table-2', settledData)] as A2uiOutput)
    expect(run(settledBare, [data('table-2', { ...settledData, status: 'Bankroll 1,300.' })])).toEqual([])
    const literal = { ...table([]), phase: 'settled' }
    const noData = session([{ version: 'v1.0', createSurface: { surfaceId: 'table-2', catalogId: 'agent-ui--croupier' } }, comps('table-2', [literal])] as A2uiOutput)
    expect(run(noData, [comps('table-2', [literal])])).toEqual([])
  })

  it('a table that turns from a bound phase to a literal settled this turn is judged', () => {
    expect(run(turn100, [comps('table-2', [{ ...table([]), phase: 'settled' }])])).toEqual([['DEAL_AGAIN_MISSING', 'table-2:root']])
  })

  it('the r10 :38 shape: table-2 settles with its Deal again beside the prior-settled table-1 resent with children []', () => {
    const prior = session(open('table-1', [table([])], settledData))
    const out = [...open('table-2', [table(['again2']), again('again2')], settledData), comps('table-1', [table([])])]
    expect(run(prior, out)).toEqual([])
  })

  it('the r9 :190 shape: table-1 resent settled and bare beside table-3 playing is handed on', () => {
    // table-1's earlier turn played (no new-round Button anywhere), so only the handed-on rule can pass it.
    const prior = session(open('table-1', [table(['hit']), { id: 'hit', component: 'Button', label: 'Hit', action: { action: 'hit' } }], { ...settledData, phase: 'playing' }))
    const playing = { ...settledData, phase: 'playing', playerHand: [C('9'), C('7')], dealerHand: [C('10'), { ...C('6'), faceDown: true }] }
    const handedOn = [data('table-1', settledData), comps('table-1', [table([])]), ...open('table-3', [table(['hit3']), { id: 'hit3', component: 'Button', label: 'Hit', action: { action: 'hit' } }], playing)]
    expect(run(prior, handedOn)).toEqual([])
    expect(run(prior, [data('table-1', settledData), comps('table-1', [table([])])])).toEqual([['DEAL_AGAIN_MISSING', 'table-1:root']])
  })

  it('a Deal again answer that closes table-1 and opens table-2 in betting passes', () => {
    const prior = session(open('table-1', [table(['hit']), { id: 'hit', component: 'Button', label: 'Hit', action: { action: 'hit' } }], { ...settledData, phase: 'playing' }))
    expect(run(prior, [data('table-1', settledData), comps('table-1', [table([])]), ...open('table-2', [table()], betting())])).toEqual([])
  })

  it('a table beside it whose phase is unbound or absent, or a poker table, has not opened the next round', () => {
    const settle = [data('table-2', settledData)]
    const { phase: _phase, ...noPhase } = table()
    expect(run(turn100, [...settle, ...open('table-3', [{ ...noPhase, title: 'Pontoon' }], betting())])).toEqual([['DEAL_AGAIN_MISSING', 'table-2:root']])
    expect(run(turn100, [...settle, ...open('table-3', [{ ...table(), phase: { path: '/nowhere' } }], betting())])).toEqual([['DEAL_AGAIN_MISSING', 'table-2:root']])
    expect(run(turn100, [...settle, ...open('table-3', [table(undefined, "Texas hold'em")], { ...betting(), phase: 'playing' })])).toEqual([['DEAL_AGAIN_MISSING', 'table-2:root']])
    expect(run(turn100, [...settle, ...open('table-3', [{ ...table(), phase: 'betting' }], {})])).toEqual([])
  })

  it('a Deal again orphaned off the root does not count; one on another surface this turn touches does', () => {
    expect(run(turn100, [data('table-2', settledData), comps('table-2', [table(), again('stray')])])).toEqual([['DEAL_AGAIN_MISSING', 'table-2:root']])
    const elsewhere = [data('table-2', settledData), ...open('next-1', [{ id: 'root', component: 'Column', children: ['go'] }, again('go')], {})]
    expect(run(turn100, elsewhere)).toEqual([])
  })

  it('the settled seeds (action dealAgain; a2ui-basic event deal_again with a Text child label) pass', () => {
    expect(run({ turns: [] }, personaCroupierCardTableSettledSeed.messages)).toEqual([])
    expect(run({ turns: [] }, personaBasicCroupierCardTableSettledSeed.messages)).toEqual([])
  })

  it('a forward is a press the next turn treats as a new round: a newRound context or a new-round action name, never a label alone', () => {
    const settle = (button: Record<string, unknown>) => run(turn100, [data('table-2', settledData), comps('table-2', [table(['b']), { id: 'b', component: 'Button', ...button }])])
    expect(settle({ label: 'Go', action: { action: 'new_round' } })).toEqual([])
    expect(settle({ label: 'Go', action: { event: { name: 'go', context: { newRound: true } } } })).toEqual([])
    expect(settle({ label: 'Next hand', action: { action: 'go' } })).toEqual([['DEAL_AGAIN_MISSING', 'table-2:root']])
    expect(settle({ label: 'History', action: { action: 'history' } })).toEqual([['DEAL_AGAIN_MISSING', 'table-2:root']])
  })

  it('a surface that names a poker game is never judged', () => {
    const poker = session(open('table-2', [table(undefined, "Texas hold'em")], betting()))
    expect(run(poker, [data('table-2', settledData)])).toEqual([])
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

  it('T-0212: a bet step that names a game other than blackjack keeps its Card (the recorded stud opening, Omaha, five-card draw)', () => {
    for (const title of ['Seven-card stud · Place your bet', 'Omaha · Place your bet', 'Five-card draw: ante up', 'Poker night', 'Roulette: place your bet']) {
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

// T-0357 (round 10 :81, Haiku 5.5, "Let's play Texas hold'em."): round 0 asked for the stake on an ask-1 Card with a
// bet Slider and a Deal Button and shipped, since BET_TABLE_MISSING skips poker. Hold'em deals the hands at once.
describe('croupier bet controls: a hold\'em opening that asks for the stake (T-0357)', () => {
  const stakeAsk = (title = "Texas hold'em: place your stake", extra: Record<string, unknown>[] = []): A2uiOutput => [
    { version: 'v1.0', createSurface: { surfaceId: 'ask-1', catalogId: 'agent-ui--croupier', sendDataModel: true } },
    { version: 'v1.0', updateDataModel: { surfaceId: 'ask-1', value: { bankroll: 1000, bet: 50 } } },
    { version: 'v1.0', updateComponents: { surfaceId: 'ask-1', components: [
      { id: 'root', component: 'Card', children: ['hdr', 'body', 'foot'] },
      { id: 'hdr', component: 'CardHeader', children: ['title'] },
      { id: 'title', component: 'Text', text: title, variant: 'h4' },
      { id: 'body', component: 'CardContent', children: ['stake', ...extra.map((c) => c['id'] as string)] },
      { id: 'stake', component: 'Slider', value: { path: '/bet' }, min: 10, max: 500, step: 10, name: 'bet', label: 'Bet amount', layout: 'standard' },
      { id: 'foot', component: 'CardFooter', children: ['deal'] },
      { id: 'deal', component: 'Button', label: 'Deal me in', variant: 'solid', action: { action: 'deal_hand' } },
      ...extra,
    ] } },
  ] as A2uiOutput
  const run = (output: A2uiOutput) => croupierBetControls.check({ surfaces: semanticSurfaceViews({ turns: [] }, output) })

  it('the recorded :81 round 0 payload is POKER_DEAL_MISSING, asking to deal on the Card frame', () => {
    const findings = run(stakeAsk())
    expect(findings.map((f) => [f.code, f.path])).toEqual([['POKER_DEAL_MISSING', 'ask-1:stake']])
    expect(findings[0]!.message).toMatch(/stake \(a Slider\) and deal \(a Button\), and no hand is dealt/)
    expect(findings[0]!.message).toMatch(/one Card with the dealt PlayingCard hands/)
    expect(findings[0]!.message).not.toMatch(/CardTable/)
  })

  it('a dealt hold\'em hand, a settled hold\'em Card with only Deal again, and a hold\'em rules card pass', () => {
    expect(run(stakeAsk("Texas hold'em", [
      { id: 'hole', component: 'Row', children: { path: '/playerHand', componentId: 'holeCard' } },
      { id: 'holeCard', component: 'PlayingCard', rank: { path: 'rank' }, suit: { path: 'suit' } },
    ]))).toEqual([])
    const settled: A2uiOutput = [
      { version: 'v1.0', createSurface: { surfaceId: 'table-1', catalogId: 'agent-ui--croupier' } },
      { version: 'v1.0', updateComponents: { surfaceId: 'table-1', components: [
        { id: 'root', component: 'Card', children: ['title', 'again'] },
        { id: 'title', component: 'Text', text: "Texas hold'em: you win the pot, bankroll 1,100", variant: 'h4' },
        { id: 'again', component: 'Button', label: 'Deal again', action: { action: 'deal', context: { newRound: true } } },
      ] } },
    ] as A2uiOutput
    expect(run(settled)).toEqual([])
    expect(run([
      { version: 'v1.0', createSurface: { surfaceId: 'rules', catalogId: 'agent-ui--croupier' } },
      { version: 'v1.0', updateComponents: { surfaceId: 'rules', components: [{ id: 'root', component: 'Text', text: "Texas hold'em: two hole cards, then the flop, turn and river." }] } },
    ] as A2uiOutput)).toEqual([])
  })

  it('every spelling of hold\'em fires, and the removed T-0212 "Texas Hold\'em: your buy-in" bet step is a stake ask', () => {
    for (const title of ["Texas hold'em", 'Texas Holdem', 'Hold-em: place your stake', 'Hold em', 'Texas hold’em']) {
      expect(run(stakeAsk(title)).map((f) => f.code), title).toEqual(['POKER_DEAL_MISSING'])
    }
    expect(run(stakeAsk("Texas Hold'em: your buy-in")).map((f) => [f.code, f.path])).toEqual([['POKER_DEAL_MISSING', 'ask-1:stake']])
    const buyIn = stakeAsk("Texas Hold'em")
    const ask = buyIn[2] as { updateComponents: { components: Record<string, unknown>[] } }
    ask.updateComponents.components = ask.updateComponents.components.map((c) => (c['id'] === 'stake' ? { id: 'stake', component: 'TextField', label: 'Buy-in' } : c))
    expect(run(buyIn).map((f) => f.code)).toEqual(['POKER_DEAL_MISSING'])
  })

  it('a settled hold\'em Card with a next-stake Slider and a Deal again forward passes', () => {
    const settled: A2uiOutput = [
      { version: 'v1.0', createSurface: { surfaceId: 'table-1', catalogId: 'agent-ui--croupier', sendDataModel: true } },
      { version: 'v1.0', updateDataModel: { surfaceId: 'table-1', value: { bankroll: 1100, bet: 50 } } },
      { version: 'v1.0', updateComponents: { surfaceId: 'table-1', components: [
        { id: 'root', component: 'Card', children: ['title', 'stake', 'again'] },
        { id: 'title', component: 'Text', text: "Texas hold'em: you win the pot", variant: 'h4' },
        { id: 'stake', component: 'Slider', value: { path: '/bet' }, min: 10, max: 500, name: 'bet', label: 'Next stake' },
        { id: 'again', component: 'Button', label: 'Deal again', action: { action: 'deal', context: { newRound: true } } },
      ] } },
    ] as A2uiOutput
    expect(run(settled)).toEqual([])
    const byPhase = structuredClone(settled) as typeof settled
    const comps = (byPhase[2] as { updateComponents: { components: Record<string, unknown>[] } }).updateComponents.components
    comps[3] = { id: 'again', component: 'Button', label: 'Next hand', action: { action: 'next' } }
    ;(byPhase[1] as { updateDataModel: { value: Record<string, unknown> } }).updateDataModel.value['phase'] = 'settled'
    expect(run(byPhase)).toEqual([])
  })

  it('a game picker and stud prose that mention hold\'em are not judged', () => {
    expect(run(stakeAsk("Pick a game: Texas hold'em, Omaha or seven-card stud"))).toEqual([])
    expect(run(stakeAsk("Seven-card stud: ante up. No blinds, unlike hold'em."))).toEqual([])
    expect(run(stakeAsk("Omaha: like hold'em, but four hole cards"))).toEqual([])
  })

  it('a turn whose other surface carries the dealt hand leaves a separate controls surface alone', () => {
    const hand: A2uiOutput = [
      { version: 'v1.0', createSurface: { surfaceId: 'hand-1', catalogId: 'agent-ui--croupier', sendDataModel: true } },
      { version: 'v1.0', updateDataModel: { surfaceId: 'hand-1', value: { playerHand: [{ rank: 'A', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }] } } },
      { version: 'v1.0', updateComponents: { surfaceId: 'hand-1', components: [
        { id: 'root', component: 'Row', children: { path: '/playerHand', componentId: 'card' } },
        { id: 'card', component: 'PlayingCard', rank: { path: 'rank' }, suit: { path: 'suit' } },
      ] } },
    ] as A2uiOutput
    expect(run([...hand, ...stakeAsk("Texas hold'em: your bet")])).toEqual([])
  })

  it('an orphan bet Slider, off screen, does not fire', () => {
    const output = stakeAsk("Texas hold'em")
    const ask = output[2] as { updateComponents: { components: Record<string, unknown>[] } }
    ask.updateComponents.components = ask.updateComponents.components.map((c) => (c['id'] === 'body' ? { ...c, children: [] } : c))
    expect(run(output)).toEqual([])
  })

  it('a hold\'em stake ask on a blackjack-family surface stays BET_TABLE_MISSING alone', () => {
    expect(run(stakeAsk("Blackjack or hold'em: place your stake")).map((f) => f.code)).toEqual(['BET_TABLE_MISSING'])
  })
})

// T-0368 (round 11 :222 round 2, Haiku 5.5, "Let's play Texas hold'em."): after a SURFACE_MISSING repair the table
// shipped stake-first, its PlayingCards only templates over empty hands, no game named on screen and a Deal Button
// whose context says newRound. A template over an empty hand is not a dealt card.
describe('croupier bet controls: a hold\'em table whose hands are empty templates (T-0368)', () => {
  const card = (rank: string, suit: string) => ({ rank, suit, faceDown: false })
  const table = (playerHand: unknown[] = []): A2uiOutput => [
    { version: 'v1.0', createSurface: { surfaceId: 'holdem-table-1', catalogId: 'agent-ui--croupier', sendDataModel: true } },
    { version: 'v1.0', updateDataModel: { surfaceId: 'holdem-table-1', value: { bankroll: 1000, bet: 0, pot: 0, dealerHand: [], playerHand, communityCards: [], status: 'Place your bet to start the hand', bet_amount: 50 } } },
    { version: 'v1.0', updateComponents: { surfaceId: 'holdem-table-1', components: [
      { id: 'root', component: 'Card', children: ['content', 'footer'] },
      { id: 'content', component: 'CardContent', children: ['header', 'board', 'hand'] },
      { id: 'header', component: 'Row', justify: 'between', children: ['bankrollText', 'potText'] },
      { id: 'bankrollText', component: 'Text', variant: 'label', text: { path: '/bankroll' } },
      { id: 'potText', component: 'Text', variant: 'label', text: { path: '/pot' } },
      { id: 'board', component: 'Row', gap: 'sm', wrap: true, children: { path: '/communityCards', componentId: 'communityCard' } },
      { id: 'communityCard', component: 'PlayingCard', rank: { path: 'rank' }, suit: { path: 'suit' }, faceDown: { path: 'faceDown' } },
      { id: 'hand', component: 'Row', gap: 'sm', wrap: true, children: { path: '/playerHand', componentId: 'playerCard' } },
      { id: 'playerCard', component: 'PlayingCard', rank: { path: 'rank' }, suit: { path: 'suit' }, faceDown: { path: 'faceDown' } },
      { id: 'footer', component: 'CardFooter', children: ['statusText', 'actions'] },
      { id: 'statusText', component: 'Text', variant: 'body', text: { path: '/status' } },
      { id: 'actions', component: 'Row', gap: 'md', justify: 'end', children: ['dealBtn'] },
      { id: 'dealBtn', component: 'Button', label: 'Deal', variant: 'solid', action: { action: 'deal', context: { newRound: true } } },
    ] } },
  ] as A2uiOutput
  const run = (output: A2uiOutput, intent?: string, session: Session = { turns: [] }) =>
    croupierBetControls.check({ surfaces: semanticSurfaceViews(session, output), ...(intent !== undefined ? { intent } : {}) })
  const HOLDEM_ASK = "Let's play Texas hold'em."
  const edit = (output: A2uiOutput, data: Record<string, unknown>, comps: Record<string, unknown>[] = []): A2uiOutput => {
    const out = structuredClone(output) as A2uiOutput
    const dm = (out[1] as { updateDataModel: { value: Record<string, unknown> } }).updateDataModel
    dm.value = { ...dm.value, ...data }
    const uc = (out[2] as { updateComponents: { components: Record<string, unknown>[] } }).updateComponents
    uc.components = [...uc.components.map((c) => comps.find((n) => n['id'] === c['id']) ?? c), ...comps.filter((n) => !uc.components.some((c) => c['id'] === n['id']))]
    return out
  }
  const stake = { id: 'stake', component: 'Slider', value: { path: '/bet' }, min: 10, max: 500, name: 'bet', label: 'Bet amount' }
  const withStake = (output: A2uiOutput) => edit(output, {}, [{ id: 'actions', component: 'Row', children: ['stake', 'dealBtn'] }, stake])

  it('the recorded :222 round 2 payload is POKER_DEAL_MISSING on its Deal Button, worded as a deal with no stake ask', () => {
    const findings = run(table(), HOLDEM_ASK)
    expect(findings.map((f) => [f.code, f.path])).toEqual([['POKER_DEAL_MISSING', 'holdem-table-1:dealBtn']])
    expect(findings[0]!.message).toMatch(/opens hold'em with empty hands and only dealBtn \(a Button\) to deal them, so no hand is dealt/)
    expect(findings[0]!.message).toMatch(/dealt in this answer, not behind a Deal press/)
    expect(findings[0]!.message).not.toMatch(/stake/)
    // With a bet Slider beside it the same table asks for the stake, and says so.
    const asked = run(withStake(table()), HOLDEM_ASK)
    expect(asked.map((f) => [f.code, f.path])).toEqual([['POKER_DEAL_MISSING', 'holdem-table-1:stake']])
    expect(asked[0]!.message).toMatch(/asks for a hold'em stake with stake \(a Slider\) and dealBtn \(a Button\), and no hand is dealt/)
    expect(asked[0]!.message).toMatch(/so drop those controls/)
  })

  it('a hand that holds cards, a stud turn, or a lowball or 2-7 turn passes', () => {
    expect(run(table([card('A', 'hearts'), card('K', 'clubs')]), HOLDEM_ASK)).toEqual([])
    for (const intent of ["Let's play seven-card stud.", "Let's play lowball, not hold'em.", "Let's play deuce-to-seven, not hold'em.", "Let's play 2-7 draw, not hold'em."])
      expect(run(table(), intent), intent).toEqual([])
  })

  it('hands cleared after a fold or the showdown, beside a newRound Deal again, stay quiet with no /phase key', () => {
    const folded = edit(table(), { status: 'You folded. The dealer wins the pot of 40.' }, [{ id: 'dealBtn', component: 'Button', label: 'Deal again', action: { action: 'deal', context: { newRound: true } } }])
    expect(run(folded, HOLDEM_ASK)).toEqual([])
    expect(run(folded)).toEqual([])
    const showdown = edit(table(), { status: 'Showdown: your pair of kings takes it' })
    expect(run(showdown, HOLDEM_ASK)).toEqual([])
    const titled = edit(table(), {}, [{ id: 'content', component: 'CardContent', children: ['result', 'header', 'board', 'hand'] }, { id: 'result', component: 'Text', text: 'You won 80 chips' }])
    expect(run(titled, HOLDEM_ASK)).toEqual([])
  })

  it('a table this session dealt a hand on before stays quiet when its hands are cleared', () => {
    const before = table([card('A', 'hearts'), card('K', 'clubs')])
    const session: Session = { turns: [{ role: 'user', content: HOLDEM_ASK }, { role: 'assistant', content: toJsonl(before) }] }
    const cleared = table().slice(1) as A2uiOutput
    expect(run(cleared, 'Deal again', session)).toEqual([])
    expect(run(cleared, HOLDEM_ASK, session)).toEqual([])
    expect(run(cleared, HOLDEM_ASK).map((f) => f.code)).toEqual(['POKER_DEAL_MISSING'])
  })

  it('hold\'em comes from the user\'s words only when they ask to play it', () => {
    expect(run(withStake(table()), "is hold'em harder than this?").map((f) => f.code)).toEqual(['BET_TABLE_MISSING'])
    expect(run(withStake(table()), "How do you play hold'em?").map((f) => f.code)).toEqual(['BET_TABLE_MISSING'])
  })

  it('a blackjack ask that mentions hold\'em still falls to the T-0172 blackjack arm', () => {
    const unnamed: A2uiOutput = [
      { version: 'v1.0', createSurface: { surfaceId: 'bet-1', catalogId: 'agent-ui--croupier' } },
      { version: 'v1.0', updateComponents: { surfaceId: 'bet-1', components: [
        { id: 'root', component: 'Card', children: ['stake', 'deal'] },
        { id: 'stake', component: 'Slider', value: { path: '/bet' }, min: 10, max: 500, name: 'bet', label: 'Bet amount' },
        { id: 'deal', component: 'Button', label: 'Deal', action: { action: 'deal' } },
      ] } },
    ] as A2uiOutput
    expect(run(unnamed, "Let's play blackjack, not hold'em.").map((f) => [f.code, f.path])).toEqual([['BET_TABLE_MISSING', 'bet-1:stake']])
  })

  it('the blackjack arm judges a Card of empty templates too, and never a CardTable', () => {
    expect(run(withStake(table())).map((f) => [f.code, f.path])).toEqual([['BET_TABLE_MISSING', 'holdem-table-1:dealBtn']])
    expect(run(withStake(table()), "Let's play blackjack.").map((f) => f.code)).toEqual(['BET_TABLE_MISSING'])
    const cardTable: A2uiOutput = [
      { version: 'v1.0', createSurface: { surfaceId: 'table-1', catalogId: 'agent-ui--croupier' } },
      { version: 'v1.0', updateDataModel: { surfaceId: 'table-1', value: { bankroll: 1000, bet: 50, phase: 'betting', dealerHand: [], playerHand: [] } } },
      { version: 'v1.0', updateComponents: { surfaceId: 'table-1', components: [
        { id: 'root', component: 'CardTable', phase: { path: '/phase' }, bet: { path: '/bet' }, bankroll: { path: '/bankroll' }, dealerHand: { path: '/dealerHand' }, playerHand: { path: '/playerHand' }, betAction: 'deal' },
      ] } },
    ] as A2uiOutput
    expect(run(cardTable, "Let's play blackjack.")).toEqual([])
  })

  it('an orphan PlayingCard template over an empty hand is off screen and counts as dealt', () => {
    const orphan = edit(table(), {}, [{ id: 'ghost', component: 'Row', children: { path: '/dealerHand', componentId: 'ghostCard' } }, { id: 'ghostCard', component: 'PlayingCard', rank: { path: 'rank' }, suit: { path: 'suit' } }])
    expect(run(orphan, HOLDEM_ASK)).toEqual([])
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

  // T-0334 (live round 9 :27): the table's own title picks the game; a pontoon natural pays 2:1, the banker wins every
  // tie, and a buy adds a stake equal to the bet. Words elsewhere on the surface never pick the game.
  describe('T-0334: pontoon rules, decided by the CardTable title', () => {
    const titled = (title: unknown, bankroll: number, player: unknown[], dealer: unknown[], extra: Record<string, unknown>[] = [], value: Record<string, unknown> = {}): A2uiOutput => {
      const out = settle(bankroll, player, dealer)
      ;(out[1] as { updateComponents: { components: Record<string, unknown>[] } }).updateComponents.components = [{ ...table, title }, ...extra]
      Object.assign((out[2] as { updateDataModel: { value: Record<string, unknown> } }).updateDataModel.value, value)
      return out
    }
    const deal = (output: A2uiOutput) => run(output, 'deal', { bankroll: 1000, bet: 50, phase: 'betting' }, { bet: 50 })
    const nat = [C('A'), C('K')]
    const hard = [C('9'), C('7')]
    const codes = (fs: readonly { code: string }[]) => fs.map((f) => f.code)

    it('a pontoon natural pays 2:1 (1,000 to 1,100 on 50); blackjack and Spanish 21 stay at 3:2', () => {
      expect(deal(titled('Pontoon', 1100, nat, hard))).toEqual([])
      const wrong = deal(titled('Pontoon', 1075, nat, hard))
      expect(codes(wrong)).toEqual(['BANKROLL_MISMATCH'])
      expect(wrong[0]!.message).toMatch(/a pontoon \(2:1\) on a stake of 50, so the bankroll goes from 1000 to 1100/)
      expect(deal(titled('Blackjack', 1075, nat, hard))).toEqual([])
      expect(deal(titled('Spanish 21', 1075, nat, hard))).toEqual([])
      expect(codes(deal(titled('Blackjack', 1100, nat, hard)))).toEqual(['BANKROLL_MISMATCH'])
    })

    it('a title bound to the data model decides the game too', () => {
      const bound = (bankroll: number, game: string) => titled({ path: '/game' }, bankroll, nat, hard, [], { game })
      expect(deal(bound(1100, 'Pontoon'))).toEqual([])
      expect(codes(deal(bound(1075, 'Pontoon')))).toEqual(['BANKROLL_MISMATCH'])
      expect(deal(bound(1075, 'Blackjack'))).toEqual([])
    })

    it('an untitled table under a Pontoon heading is a pontoon table; a heading elsewhere is not enough', () => {
      const heading = (text: string, variant = 'h1') => ({ id: 'head', component: 'Text', variant, text })
      const untitled = (bankroll: number, extra: Record<string, unknown>[]) => {
        const out = titled(undefined, bankroll, nat, hard, extra)
        delete (out[1] as { updateComponents: { components: Record<string, unknown>[] } }).updateComponents.components[0]!['title']
        return out
      }
      expect(deal(untitled(1100, [heading('Pontoon')]))).toEqual([])
      expect(deal(untitled(1075, [heading('Blackjack'), { id: 'p', component: 'Text', variant: 'body', text: 'pontoon' }]))).toEqual([])
      expect(deal(untitled(1075, [{ id: 'p', component: 'Text', variant: 'body', text: 'Pontoon' }]))).toEqual([])
    })

    it('BUY_CARD_FACE_UP still fires for an untitled table under a Pontoon heading', () => {
      const out = titled(undefined, 700, [C('10'), C('5'), C('4')], dealer17, [{ id: 'head', component: 'Text', variant: 'h2', text: 'Pontoon' }], { phase: 'playing' })
      delete (out[1] as { updateComponents: { components: Record<string, unknown>[] } }).updateComponents.components[0]!['title']
      const act = { name: 'buy', surfaceId: 'table-1', context: {}, dataModel: { bankroll: 800, bet: 100, phase: 'playing', playerHand: [C('10'), C('5')] } }
      const f = croupierSemanticChecks.flatMap((c) => c.check({ surfaces: semanticSurfaceViews({ turns: [] }, out), action: act }))
      expect(codes(f.filter((x) => x.code === 'BUY_CARD_FACE_UP'))).toEqual(['BUY_CARD_FACE_UP'])
    })

    it('words that mention pontoon do not make a blackjack table a pontoon table', () => {
      const note = { id: 'note', component: 'Text', text: 'Pontoon, twenty-one and Spanish 21 are all on the menu.' }
      expect(deal(titled('Blackjack (they call it pontoon in the UK)', 1075, nat, hard))).toEqual([])
      expect(deal(titled('Blackjack', 1075, nat, hard, [note]))).toEqual([])
      expect(codes(deal(titled('Blackjack', 1100, nat, hard, [note])))).toEqual(['BANKROLL_MISMATCH'])
      expect(deal(titled('Pontoon (British blackjack)', 1100, nat, hard))).toEqual([])
    })

    it('the banker wins ties in pontoon: a pontoon against a pontoon and a 19-19 tie lose the stake', () => {
      expect(deal(titled('Pontoon', 950, nat, [C('A', 'hearts'), C('Q')]))).toEqual([])
      expect(codes(deal(titled('Pontoon', 1000, nat, [C('A', 'hearts'), C('Q')])))).toEqual(['BANKROLL_MISMATCH'])
      expect(deal(titled('Blackjack', 1000, nat, [C('A', 'hearts'), C('Q')]))).toEqual([])
      const tie = [C('K'), C('9')]
      expect(run(titled('Pontoon', 950, tie, tie), 'stand', playing(950))).toEqual([])
      const wrong = run(titled('Pontoon', 1000, tie, tie), 'stand', playing(950))
      expect(codes(wrong)).toEqual(['BANKROLL_MISMATCH'])
      expect(wrong[0]!.message).toMatch(/the dealer wins the tie at 19/)
      expect(run(titled('Blackjack', 1000, tie, tie), 'stand', playing(950))).toEqual([])
    })

    it('a second buy adds the original stake, not the bet the first buy raised (900 to 1,150 on 50, bought twice)', () => {
      const bought = (n: number) => Array.from({ length: n }, () => ({ rank: '2', suit: 'clubs', faceDown: true }))
      const twice = { bankroll: 900, bet: 100, phase: 'playing', playerHand: [C('5'), C('4'), ...bought(1)] }
      expect(run(titled('Pontoon', 1150, win, dealer17), 'buy', twice)).toEqual([])
      const wrong = run(titled('Pontoon', 1200, win, dealer17), 'buy', twice)
      expect(codes(wrong)).toEqual(['BANKROLL_MISMATCH'])
      expect(wrong[0]!.message).toMatch(/stake of 150, so the bankroll goes from 900 to 1150 \(50 taken out now, 300 paid back\)/)
    })

    it('a five-card trick pays 2:1 and beats a higher dealer hand, but not a banker pontoon; blackjack has no trick', () => {
      const trick = [C('2'), C('3'), C('4'), C('5'), C('4')] // 18 on five cards
      const dealer20 = [C('K'), C('Q')]
      expect(run(titled('Pontoon', 1100, trick, dealer20), 'twist', playing(950))).toEqual([])
      const flat = run(titled('Pontoon', 950, trick, dealer20), 'twist', playing(950))
      expect(flat[0]!.message).toMatch(/a five-card trick \(2:1\) on a stake of 50/)
      expect(run(titled('Pontoon', 950, trick, [C('A', 'hearts'), C('K')]), 'twist', playing(950))).toEqual([])
      expect(run(titled('Pontoon', 950, [C('9'), C('8')], [C('2'), C('3'), C('4'), C('5'), C('4')]), 'stick', playing(950))).toEqual([])
      expect(run(titled('Blackjack', 950, trick, dealer20), 'hit', playing(950))).toEqual([])
    })

    it('a pontoon buy adds a stake equal to the bet (950 to 1,100 on a bought 50 win); a hit does not', () => {
      expect(run(titled('Pontoon', 1100, win, dealer17), 'buy', playing(950))).toEqual([])
      expect(codes(run(titled('Pontoon', 1050, win, dealer17), 'buy', playing(950)))).toEqual(['BANKROLL_MISMATCH'])
      expect(run(titled('Pontoon', 1050, win, dealer17), 'twist', playing(950))).toEqual([])
      expect(run(titled('Blackjack', 1100, win, dealer17), 'buy', playing(950))).toEqual([]) // buy is no blackjack move
    })
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

// T-0324 (live round 8 :9, Haiku 5.5, regress-croupier-blackjack-rounds turn 8): the 25 deal on table-3 dealt A and 9
// against 7 and a hole K, wrote "Natural blackjack!" and phase settled with only Deal again. A two-card 20 is no
// natural, so the round goes on; BANKROLL_MISMATCH's repair ("settles as a win (20 over 17)") then endorsed the settle.
describe('croupier action check: a deal that settles needs a two-card 21 (T-0324)', () => {
  const OPENED = [
    {"version": "v1.0", "createSurface": {"surfaceId": "table-3", "catalogId": "agent-ui--croupier", "sendDataModel": true}},
    {"version": "v1.0", "updateDataModel": {"surfaceId": "table-3", "value": {"bankroll": 950, "bet": 0, "dealerHand": [], "playerHand": [], "dealerTotal": "", "playerTotal": "", "status": "Place your bet", "result": ""}}},
    {"version": "v1.0", "updateComponents": {"surfaceId": "table-3", "components": [{"id": "root", "component": "CardTable", "title": "Blackjack", "phase": "betting", "betAction": "deal", "bankroll": {"path": "/bankroll"}, "bet": {"path": "/bet"}, "dealerHand": {"path": "/dealerHand"}, "playerHand": {"path": "/playerHand"}, "dealerTotal": {"path": "/dealerTotal"}, "playerTotal": {"path": "/playerTotal"}, "status": {"path": "/status"}, "statusIntent": "info", "children": []}]}},
  ] as A2uiOutput
  const DEALT = [
    {"version": "v1.0", "updateDataModel": {"surfaceId": "table-3", "value": {"bankroll": 925, "bet": 25, "dealerHand": [{"rank": "7", "suit": "diamonds"}, {"faceDown": true, "rank": "K", "suit": "clubs"}], "playerHand": [{"rank": "A", "suit": "hearts"}, {"rank": "9", "suit": "spades"}], "dealerTotal": "showing 7", "playerTotal": "Blackjack", "status": "Natural blackjack! Dealer checks for 21.", "result": ""}}},
    {"version": "v1.0", "updateComponents": {"surfaceId": "table-3", "components": [{"id": "root", "component": "CardTable", "title": "Blackjack", "phase": "settled", "bankroll": {"path": "/bankroll"}, "bet": {"path": "/bet"}, "dealerHand": {"path": "/dealerHand"}, "playerHand": {"path": "/playerHand"}, "dealerTotal": {"path": "/dealerTotal"}, "playerTotal": {"path": "/playerTotal"}, "status": {"path": "/status"}, "statusIntent": "success", "result": {"path": "/result"}, "children": ["dealAgainBtn"]}, {"id": "dealAgainBtn", "component": "Button", "label": "Deal again", "variant": "solid", "action": {"action": "deal", "context": {"newRound": true}}}]}},
  ] as A2uiOutput
  const session = { turns: [{ role: 'user', content: 'Deal again' }, { role: 'assistant', content: toJsonl(OPENED) }] }
  const action = { name: 'deal', surfaceId: 'table-3', context: { bet: 25, bankrollAfterBet: 925 }, dataModel: { bankroll: 950, bet: 25, dealerHand: [], playerHand: [], dealerTotal: '', playerTotal: '', status: 'Place your bet', result: '' } }
  const run = (output: A2uiOutput) => croupierActionApplied.check({ surfaces: semanticSurfaceViews(session, output), action })
  const withHands = (playerHand: unknown[], dealerHand: unknown[], bankroll: number): A2uiOutput =>
    DEALT.map((m) => ('updateDataModel' in m ? { ...m, updateDataModel: { ...m.updateDataModel, value: { ...(m.updateDataModel.value as object), playerHand, dealerHand, bankroll } } } : m)) as A2uiOutput

  it('the recorded A and 9 settled on the deal is SETTLED_WITHOUT_NATURAL alone, asking for phase playing with Hit and Stand', () => {
    const findings = run(DEALT)
    expect(findings.map((f) => [f.code, f.path])).toEqual([['SETTLED_WITHOUT_NATURAL', 'table-3:root']])
    expect(findings[0]!.message).toMatch(/A, 9 \(20\) is not a natural/)
    expect(findings[0]!.message).toMatch(/phase "playing" with Hit and Stand/)
    expect(findings[0]!.message).not.toMatch(/settles as a win/)
  })

  it('a real natural settled on the deal is still judged by its payout: either hand two-card 21 passes this check', () => {
    const ace = { rank: 'A', suit: 'hearts' }
    const king = { rank: 'K', suit: 'spades' }
    const seven = { rank: '7', suit: 'diamonds' }
    expect(run(withHands([ace, king], [seven, { rank: '9', suit: 'clubs' }], 987.5))).toEqual([])
    expect(run(withHands([ace, king], [seven, { rank: '9', suit: 'clubs' }], 925)).map((f) => f.code)).toEqual(['BANKROLL_MISMATCH'])
    expect(run(withHands([{ rank: '9', suit: 'spades' }, seven], [ace, king], 925))).toEqual([])
  })
})

// T-0323 (round 8 cluster E, Kim's ruling): poker stays on a Card frame, and the CardTable's blackjack strip rules
// never judge a surface that names another game. The recorded Haiku 5.5 five-card draw (2026-10-16.jsonl:61 round 2)
// opened a dealt CardTable in phase betting with Check, Bet and Fold; BET_CONTROL_DUPLICATE stripped the moves. Its
// deal again (:65 round 1) opened dealt in betting too, and NEW_ROUND_NOT_BETTING sent it back to a stake pick.
describe('croupier checks: a poker table is never judged by the blackjack strip rules (T-0323)', () => {
  const S = (rank: string, suit: string, faceDown = false) => ({ rank, suit, ...(faceDown ? { faceDown } : {}) })
  const pokerTable = (sid: string, value: Record<string, unknown>, children?: string[], extra: Record<string, unknown>[] = []): A2uiOutput => [
    { version: 'v1.0', createSurface: { surfaceId: sid, catalogId: 'agent-ui--croupier' } },
    { version: 'v1.0', updateDataModel: { surfaceId: sid, value } },
    { version: 'v1.0', updateComponents: { surfaceId: sid, components: [
      { id: 'root', component: 'CardTable', title: 'Five-card draw', phase: 'betting', ...(children === undefined ? { betAction: 'deal' } : {}), bankroll: { path: '/bankroll' }, bet: { path: '/pot' }, dealerHand: { path: '/dealerHand' }, playerHand: { path: '/playerHand' }, status: { path: '/status' }, statusIntent: 'info', ...(children === undefined ? {} : { children }) },
      ...extra,
    ] } },
  ] as A2uiOutput
  // :61 round 2, as recorded.
  const round2 = pokerTable(
    'table-1',
    {
      bankroll: 990, pot: 20, status: 'Your bet: check, bet 20, or fold',
      playerHand: [S('7', 'hearts'), S('7', 'clubs'), S('2', 'spades'), S('9', 'diamonds'), S('J', 'hearts')],
      dealerHand: [S('K', 'spades', true), S('4', 'diamonds', true), S('8', 'clubs', true), S('3', 'hearts', true), S('Q', 'clubs', true)],
    },
    ['checkBtn', 'betBtn', 'foldBtn'],
    [
      { id: 'checkBtn', component: 'Button', label: 'Check', variant: 'soft', action: { action: 'check' } },
      { id: 'betBtn', component: 'Button', label: 'Bet 20', variant: 'solid', action: { action: 'bet', context: { amount: 20 } } },
      { id: 'foldBtn', component: 'Button', label: 'Fold', variant: 'ghost', action: { action: 'fold' } },
    ],
  )
  // :65 round 1, as recorded: dealt in betting with "betAction":"deal" and no children.
  const dealAgain = pokerTable('table-2', {
    bankroll: 1060, pot: 20, status: 'Place your bet to deal',
    playerHand: [S('Q', 'diamonds'), S('5', 'spades'), S('5', 'hearts'), S('10', 'clubs'), S('2', 'diamonds')],
    dealerHand: [S('A', 'clubs', true), S('9', 'hearts', true), S('6', 'spades', true), S('J', 'diamonds', true), S('4', 'clubs', true)],
  })
  const again = { name: 'deal_again', surfaceId: 'table-1', context: { newRound: true }, dataModel: { bankroll: 1060 } }
  const all = (input: Parameters<typeof croupierBetControls.check>[0]) => croupierSemanticChecks.flatMap((c) => c.check(input))

  it('the :61 round 2 table is one DEALT_IN_BETTING that keeps its three moves, never BET_CONTROL_DUPLICATE', () => {
    const findings = all({ surfaces: semanticSurfaceViews({ turns: [] }, round2), intent: "Let's play five-card draw." })
    expect(findings.map((f) => [f.code, f.path])).toEqual([['DEALT_IN_BETTING', 'table-1:root']])
    expect(findings[0]!.message).toMatch(/phase "playing"/)
    expect(findings[0]!.message).toMatch(/keep checkBtn, betBtn and foldBtn/)
  })

  it('the :65 round 1 deal again is one DEALT_IN_BETTING asking for the moves, never NEW_ROUND_NOT_BETTING', () => {
    const findings = all({ surfaces: semanticSurfaceViews({ turns: [] }, dealAgain), action: again })
    // T-0371: the hand also opens on the settled 1060 with the blinds in a 20 pot, the chip drift it names.
    expect(findings.map((f) => [f.code, f.path])).toEqual([['DEALT_IN_BETTING', 'table-2:root'], ['POKER_CHIPS_MISMATCH', 'table-2:/bankroll']])
    expect(findings[0]!.message).toMatch(/Check, Bet and Fold/)
    // T-0371: the repaired bankroll (the settled 1060 less a 10 blind) is not a blackjack BANKROLL_MISMATCH.
    const posted = JSON.parse(JSON.stringify(dealAgain).replace('"bankroll":1060', '"bankroll":1050')) as A2uiOutput
    expect(all({ surfaces: semanticSurfaceViews({ turns: [] }, posted), action: again }).map((f) => f.code)).toEqual(['DEALT_IN_BETTING'])
  })

  it('the same poker table in phase playing passes, and a blackjack table keeps the strip rules', () => {
    const playing = JSON.parse(JSON.stringify(round2).replace('"phase":"betting"', '"phase":"playing"')) as A2uiOutput
    expect(all({ surfaces: semanticSurfaceViews({ turns: [] }, playing) })).toEqual([])
    const blackjack = JSON.parse(JSON.stringify(round2).replace('Five-card draw', 'Blackjack')) as A2uiOutput
    expect(croupierBetControls.check({ surfaces: semanticSurfaceViews({ turns: [] }, blackjack) }).map((f) => [f.code, f.path])).toEqual([
      ['BET_CONTROL_DUPLICATE', 'table-1:root'],
      ['BET_CONTROL_DUPLICATE', 'table-1:checkBtn'],
      ['BET_CONTROL_DUPLICATE', 'table-1:betBtn'],
      ['BET_CONTROL_DUPLICATE', 'table-1:foldBtn'],
    ])
  })

  it('the repair texts that open a table name the Card frame for poker', () => {
    const none = croupierActionApplied.check({ surfaces: [], action: again })
    expect(none.map((f) => f.code)).toEqual(['ACTION_NOT_APPLIED'])
    expect(none[0]!.message).toMatch(/one CardTable in phase "betting"/)
    expect(none[0]!.message).toMatch(/for poker, one Card with the dealt PlayingCard hands/)
    const poker = croupierActionApplied.check({ surfaces: [], intent: "Let's play five-card draw." })
    expect(poker[0]!.message).toMatch(/one Card with the dealt PlayingCard hands and its Check, Bet and Fold Buttons, never a CardTable/)
    const blackjack = croupierActionApplied.check({ surfaces: [], intent: 'Deal me in for a hand of blackjack' })
    expect(blackjack[0]!.message).toMatch(/one CardTable in phase "betting"/)
    expect(blackjack[0]!.message).not.toMatch(/poker/)
  })
})

describe('croupier rules check: a poker showdown settles in the turn it is reached (T-0346)', () => {
  const C = (rank: string, suit: string, faceDown = false) => ({ rank, suit, ...(faceDown ? { faceDown } : {}) })
  const hand = [C('A', 'hearts'), C('K', 'diamonds'), C('J', 'clubs'), C('9', 'spades')]
  const board = [C('10', 'hearts'), C('5', 'spades'), C('2', 'diamonds'), C('7', 'clubs'), C('Q', 'spades')]
  // The :104 deal turn of round 10 (regress-croupier-omaha-haiku-1): a Card, not a CardTable.
  const deal: A2uiOutput = [
    { version: 'v1.0', createSurface: { surfaceId: 'table-1', catalogId: 'agent-ui--croupier', sendDataModel: true } },
    { version: 'v1.0', updateDataModel: { surfaceId: 'table-1', value: { bankroll: 990, pot: 20, playerHand: hand, board: [] } } },
    { version: 'v1.0', updateComponents: { surfaceId: 'table-1', components: [
      { id: 'root', component: 'Card', children: ['hdr', 'body', 'foot'] },
      { id: 'hdr', component: 'CardHeader', children: ['title', 'phase'] },
      { id: 'title', component: 'Text', text: 'Omaha', variant: 'h4' },
      { id: 'phase', component: 'Badge', label: 'Pre-flop', intent: 'info' },
      { id: 'body', component: 'CardContent', children: ['hand', 'board', 'status'] },
      { id: 'hand', component: 'Row', children: { path: '/playerHand', componentId: 'holeCard' } },
      { id: 'holeCard', component: 'PlayingCard', rank: { path: 'rank' }, suit: { path: 'suit' } },
      { id: 'board', component: 'Row', children: { path: '/board', componentId: 'boardCard' } },
      { id: 'boardCard', component: 'PlayingCard', rank: { path: 'rank' }, suit: { path: 'suit' } },
      { id: 'status', component: 'Text', text: 'No board cards yet. Your move before the flop.', variant: 'body' },
      { id: 'foot', component: 'CardFooter', children: ['actRow'] },
      { id: 'actRow', component: 'Row', children: ['checkBtn', 'betBtn', 'foldBtn'] },
      { id: 'checkBtn', component: 'Button', label: 'Check', variant: 'solid', action: { action: 'check' } },
      { id: 'betBtn', component: 'Button', label: 'Bet 20', variant: 'soft', action: { action: 'bet', context: { amount: 20 } } },
      { id: 'foldBtn', component: 'Button', label: 'Fold', variant: 'ghost', action: { action: 'fold' } },
    ] } },
  ] as A2uiOutput
  const street = (label: string, status: string, data: Record<string, unknown>, button: Record<string, unknown>): A2uiOutput => [
    { version: 'v1.0', updateDataModel: { surfaceId: 'table-1', value: { bankroll: 950, pot: 60, playerHand: hand, board, ...data } } },
    { version: 'v1.0', updateComponents: { surfaceId: 'table-1', components: [
      { id: 'phase', component: 'Badge', label, intent: 'info' },
      { id: 'status', component: 'Text', text: status, variant: 'body' },
      { id: 'betBtn', component: 'Button', variant: 'soft', ...button },
    ] } },
  ] as A2uiOutput
  const session: Session = { turns: [{ role: 'user', content: 'Let\'s play Omaha.' }, { role: 'assistant', content: toJsonl(deal) }] }
  const SHOWDOWN_CODES = ['SHOWDOWN_UNSETTLED']
  const judge = (sess: Session, output: A2uiOutput) =>
    croupierSemanticChecks
      .flatMap((c) => c.check({ surfaces: semanticSurfaceViews(sess, output), intent: 'Check, or call if there is a bet.' }))
      .filter((f) => SHOWDOWN_CODES.includes(f.code))
  const showdown = (output: A2uiOutput) => judge(session, output)
  // :108 round 2, as recorded: phase Showdown, the opponent's hand never dealt, a button to deal it.
  const recorded = street('Showdown', "River checked through. Showdown: your best hand is A-K-Q-10-7, high card. Pot 60. Deal the opponent's hand to settle.", {}, {
    label: "Deal opponent's hand", action: { action: 'deal_opponent' },
  })
  const up = [C('K', 'hearts'), C('K', 'clubs'), C('8', 'spades'), C('3', 'diamonds')]
  const result = 'Showdown: the opponent shows K-K-8-3 and a pair of kings beats your ace high. You lose 40, bankroll 950.'

  it('the :108 round 2 showdown (opponent hand never dealt, no result) is one SHOWDOWN_UNSETTLED asking for the reveal and the result', () => {
    const f = showdown(recorded)
    expect(f.map((x) => [x.code, x.path])).toEqual([['SHOWDOWN_UNSETTLED', 'table-1:phase']])
    expect(f[0]!.message).toMatch(/opponent's hand is still hidden/)
    expect(f[0]!.message).toMatch(/this turn/)
  })

  it('a showdown whose opponent cards are all face down, or that states no result, is unsettled', () => {
    const down = up.map((c) => ({ ...c, faceDown: true }))
    expect(showdown(street('Showdown', result, { opponentHand: down }, { label: 'Deal again', action: { action: 'deal_again' } })).map((x) => x.code)).toEqual(['SHOWDOWN_UNSETTLED'])
    const silent = showdown(street('Showdown', 'Showdown: the opponent turns over K-K-8-3.', { opponentHand: up }, { label: 'Deal again', action: { action: 'deal_again' } }))
    expect(silent[0]!.message).toMatch(/no result is stated/)
  })

  it('a settled showdown gives none whatever its Button says', () => {
    for (const label of ['Deal again', 'Deal hand', 'Show hand']) {
      expect(showdown(street('Showdown', result, { opponentHand: up }, { label, action: { action: label.toLowerCase().replace(' ', '_') } }))).toEqual([])
    }
  })

  it('a bound phase Badge and a CardTable at the showdown are judged the same way', () => {
    const bound: A2uiOutput = [
      { version: 'v1.0', updateDataModel: { surfaceId: 'table-1', value: { bankroll: 950, pot: 60, playerHand: hand, board, phaseLabel: 'Showdown' } } },
      { version: 'v1.0', updateComponents: { surfaceId: 'table-1', components: [{ id: 'phase', component: 'Badge', label: { path: '/phaseLabel' } }] } },
    ] as A2uiOutput
    expect(showdown(bound).map((x) => x.path)).toEqual(['table-1:phase'])
    const table = (value: Record<string, unknown>): A2uiOutput => [
      { version: 'v1.0', createSurface: { surfaceId: 'table-2', catalogId: 'agent-ui--croupier' } },
      { version: 'v1.0', updateDataModel: { surfaceId: 'table-2', value } },
      { version: 'v1.0', updateComponents: { surfaceId: 'table-2', components: [
        { id: 'root', component: 'CardTable', title: 'Omaha', phase: 'playing', status: { path: '/status' }, bankroll: { path: '/bankroll' }, bet: { path: '/pot' }, dealerHand: { path: '/dealerHand' }, playerHand: { path: '/playerHand' } },
      ] } },
    ] as A2uiOutput
    const down = up.map((c) => ({ ...c, faceDown: true }))
    expect(judge({ turns: [] }, table({ bankroll: 950, pot: 60, status: 'Showdown: deal the opponent hand.', playerHand: hand, dealerHand: down })).map((x) => x.path)).toEqual(['table-2:root'])
    expect(judge({ turns: [] }, table({ bankroll: 950, pot: 60, status: result, playerHand: hand, dealerHand: up }))).toEqual([])
  })

  it('a Pre-showdown street, an earlier street and a table that names no poker game are not judged', () => {
    expect(showdown(street('Pre-showdown', 'Pre-showdown: one more bet.', {}, { label: 'Bet 20', action: { action: 'bet' } }))).toEqual([])
    expect(showdown(street('River', 'River: Q♠. Your move.', {}, { label: 'Check', action: { action: 'check' } }))).toEqual([])
    const unnamed: Session = { turns: [{ role: 'assistant', content: toJsonl(deal).replace('"Omaha"', '"Table"') }] }
    expect(judge(unnamed, recorded)).toEqual([])
  })
})

// T-0371 (round 11, regress-croupier-omaha-haiku-2, traces :139 to :146): the replies price one Omaha hand as a 30 loss
// and the next as a 10 loss on the same 960. The data models below are the recorded ones (the shipped round of each
// turn); the components are trimmed to the GameHud that names the game and the status line.
describe('croupier rules check: a poker table keeps its chips in step with the pot (T-0371)', () => {
  const C = (rank: string, suit: string, faceDown = false) => ({ rank, suit, ...(faceDown ? { faceDown } : {}) })
  const hud = (status: string) => [
    { id: 'root', component: 'Card', children: ['hud', 'status'] },
    { id: 'hud', component: 'GameHud', title: "Omaha hold'em", status, stats: { path: '/hudStats' } },
    { id: 'status', component: 'Text', text: status, variant: 'body' },
  ]
  const stats = (bankroll: number, pot: number) => [{ label: 'Bankroll', value: bankroll }, { label: 'Pot', value: pot }, { label: 'Blinds', value: '5 / 10' }]
  const data = (sid: string, value: Record<string, unknown>) => ({ version: 'v1.0', updateDataModel: { surfaceId: sid, value } })
  const opening = (sid: string, bankroll: number, value: Record<string, unknown>): A2uiOutput => [
    { version: 'v1.0', createSurface: { surfaceId: sid, catalogId: 'agent-ui--croupier', sendDataModel: true } },
    data(sid, { bankroll, pot: 20, hudStats: stats(bankroll, 20), board: [], ...value }),
    { version: 'v1.0', updateComponents: { surfaceId: sid, components: hud('Pre-flop') } },
  ] as A2uiOutput
  const hand1 = { playerHand: [C('A', 'hearts'), C('K', 'diamonds'), C('9', 'spades'), C('7', 'clubs')], dealerHand: [C('2', 'hearts', true), C('5', 'diamonds', true), C('J', 'clubs', true), C('4', 'spades', true)] }
  const flop = [C('Q', 'spades'), C('8', 'hearts'), C('3', 'diamonds')]
  const river = [...flop, C('2', 'clubs'), C('6', 'hearts')]
  const hand2 = { playerHand: [C('K', 'spades'), C('Q', 'hearts'), C('6', 'clubs'), C('4', 'diamonds')], dealerHand: [C('A', 'clubs', true), C('10', 'hearts', true), C('7', 'diamonds'), C('3', 'spades', true)] }
  const hand3 = { playerHand: [C('J', 'spades'), C('9', 'hearts'), C('8', 'clubs'), C('2', 'diamonds')], dealerHand: [C('K', 'clubs', true), C('5', 'hearts', true), C('A', 'diamonds'), C('7', 'spades', true)] }
  // `bankrolls` are what each turn writes: as recorded, or as a conserving table writes them.
  const recorded = { bet: 990, settle: 960, hand2: 960, hand3: 960 }
  const conserved = { bet: 970, settle: 970, hand2: 960, hand3: 950 }
  const turns = (b: typeof recorded) => {
    const t139 = opening('table-1', 990, hand1)
    const t140 = [data('table-1', { bankroll: 990, pot: 20, hudStats: stats(990, 20), ...hand1, board: flop })] as A2uiOutput
    const t141 = [data('table-1', { bankroll: b.bet, pot: 60, hudStats: stats(b.bet, 60), ...hand1, board: [...flop, C('2', 'clubs')] })] as A2uiOutput
    const t142 = [data('table-1', { bankroll: b.bet, pot: 60, hudStats: stats(b.bet, 60), board: river })] as A2uiOutput
    const shown = { ...hand1, dealerHand: hand1.dealerHand.map(({ rank, suit }) => C(rank, suit)) }
    const t143 = [
      data('table-1', { bankroll: b.settle, pot: 0, hudStats: stats(b.settle, 0), ...shown, board: river }),
      { version: 'v1.0', updateComponents: { surfaceId: 'table-1', components: hud('Dealer wins') } },
    ] as A2uiOutput
    const t144 = opening('table-2', b.hand2, hand2)
    const t145 = [
      { version: 'v1.0', updateDataModel: { surfaceId: 'table-2', path: '/pot', value: 0 } },
      { version: 'v1.0', updateDataModel: { surfaceId: 'table-2', path: '/hudStats', value: stats(b.hand2, 0) } },
    ] as A2uiOutput
    const t146 = opening('table-3', b.hand3, hand3)
    return { t139, t140, t141, t142, t143, t144, t145, t146, shown }
  }
  const session = (...exchanges: [string, A2uiOutput][]): Session => ({
    turns: exchanges.flatMap(([say, out]) => [{ role: 'user', content: say }, { role: 'assistant', content: toJsonl(out) }]),
  })
  const chips = (sess: Session, output: A2uiOutput, at: { intent?: string; action?: SemanticAction }) =>
    croupierSemanticChecks
      .flatMap((c) => c.check({ surfaces: semanticSurfaceViews(sess, output), ...at }))
      .filter((f) => f.code === 'POKER_CHIPS_MISMATCH')
  const dealAgain = (surfaceId: string, dataModel: Record<string, unknown>): SemanticAction => ({ name: 'deal_again', surfaceId, context: { newRound: true }, dataModel })
  const CHECK = 'Check, or call if there is a bet.'

  /** Every turn of the sequence judged as `produce()` judges it, each finding as `<trace line> <path>`. */
  function sequence(b: typeof recorded): { fired: string[]; messages: string[] } {
    const t = turns(b)
    const s139 = session(["Let's play Omaha.", t.t139])
    const s141 = session(["Let's play Omaha.", t.t139], [CHECK, t.t140])
    const s143 = session(["Let's play Omaha.", t.t139], [CHECK, t.t140], ['Bet the pot.', t.t141], [CHECK, t.t142])
    const s145 = session(['deal_again', t.t144])
    const judged: [string, SemanticFinding[]][] = [
      [':140', chips(s139, t.t140, { intent: CHECK })],
      [':141', chips(s141, t.t141, { intent: 'Bet the pot.' })],
      [':143', chips(s143, t.t143, { intent: CHECK })],
      [':144', chips({ turns: [] }, t.t144, { action: dealAgain('table-1', { bankroll: b.settle, pot: 0, ...t.shown, board: river }) })],
      [':145', chips(s145, t.t145, { intent: 'Fold.' })],
      [':146', chips({ turns: [] }, t.t146, { action: dealAgain('table-2', { bankroll: b.hand2, pot: 0, ...hand2, board: [] }) })],
    ]
    return { fired: judged.flatMap(([line, fs]) => fs.map((f) => `${line} ${f.path}`)), messages: judged.flatMap(([, fs]) => fs.map((f) => f.message)) }
  }

  it('the recorded sequence fires on the bet that left the bankroll and on both new hands that never took the blind', () => {
    const { fired, messages } = sequence(recorded)
    expect(fired).toEqual([':141 table-1:/bankroll', ':144 table-2:/bankroll', ':146 table-3:/bankroll'])
    expect(messages[0]).toMatch(/grows the pot from 20 to 60, and the bankroll still reads 990/)
    expect(messages[0]).toMatch(/lower it by the player's own chips this turn, never the opponent's/)
    expect(messages[0]).not.toMatch(/write \d/) // a typed "Bet the pot." with a dealer call is never priced exactly
    expect(messages[1]).toMatch(/settled with a bankroll of 960, and table-2 opens with 20 in the pot but the bankroll at 960/)
  })

  it('a hand whose chips conserve gives none', () => {
    expect(sequence(conserved).fired).toEqual([])
  })

  // A street of table-2 (conserved hand 2, 960 behind a 20 pot); `extra` merges into the data model.
  const t2 = (value: Record<string, unknown>, comps?: Record<string, unknown>[]): A2uiOutput => [
    data('table-2', { ...hand2, board: flop, ...value }),
    ...(comps === undefined ? [] : [{ version: 'v1.0', updateComponents: { surfaceId: 'table-2', components: comps } }]),
  ] as A2uiOutput
  const s2 = () => session(['deal_again', turns(conserved).t144])

  it('a turn that settles the hand is not judged for its move: a river call won, a run-out at the showdown, a bet the opponent folds to', () => {
    expect(chips(s2(), t2({ bankroll: 1060, pot: 120 }), { intent: 'Call.' })).toEqual([])
    expect(chips(s2(), t2({ bankroll: 960, pot: 120, phase: 'showdown' }), { intent: 'Call.' })).toEqual([])
    expect(chips(s2(), t2({ bankroll: 960, pot: 120 }, [{ id: 'status', component: 'Text', text: 'All in, run it out: the dealer wins with two pair.' }]), { intent: 'Call.' })).toEqual([])
    expect(chips(s2(), t2({ bankroll: 1000, pot: 0 }), { intent: 'Bet 20.' })).toEqual([])
  })

  it('a typed turn with two moves or a condition is not judged; one typed bet with its number is priced', () => {
    expect(chips(s2(), t2({ bankroll: 960, pot: 60 }), { intent: "Call, or check if there's no bet." })).toEqual([])
    expect(chips(s2(), t2({ bankroll: 960, pot: 60 }), { intent: 'Bet 20.' }).map((f) => f.message)).toEqual([expect.stringMatching(/write 940, and keep/)])
  })

  it('a press is priced only when its chips are certain: a bet amount, a raise increment; a raise amount is a raise-to', () => {
    const press = (name: string, context: Record<string, unknown>): SemanticAction => ({ name, surfaceId: 'table-2', context, dataModel: { bankroll: 960, pot: 20 } })
    const grown = t2({ bankroll: 960, pot: 80 })
    expect(chips(s2(), grown, { action: press('bet', { amount: 20 }) }).map((f) => f.message)).toEqual([expect.stringMatching(/write 940/)])
    expect(chips(s2(), grown, { action: press('raise', { raiseBy: 30 }) }).map((f) => f.message)).toEqual([expect.stringMatching(/write 930/)])
    const to = chips(s2(), grown, { action: press('raise', { amount: 30 }) })
    expect(to.map((f) => f.message)).toEqual([expect.stringMatching(/never the opponent's/)])
    expect(to[0]!.message).not.toMatch(/write \d/)
  })

  it('a fold that raises the bankroll fires; one that lowers it (an earlier bet left undebited) does not', () => {
    expect(chips(s2(), t2({ bankroll: 980, pot: 0 }), { intent: 'Fold.' }).map((f) => f.message)).toEqual([expect.stringMatching(/rises from 960 to 980.*write 960/)])
    expect(chips(s2(), t2({ bankroll: 950, pot: 0 }), { intent: 'Fold.' })).toEqual([])
  })

  it('a new hand fires only where the player posted: heads-up blinds, a named player blind; not an opponent-only blind, a stud bring-in, a recap, a bust', () => {
    const again = (dataModel: Record<string, unknown>): SemanticAction => dealAgain('table-1', dataModel)
    const fresh = (value: Record<string, unknown>, title = "Omaha hold'em"): A2uiOutput => {
      const out = opening('table-4', 960, value)
      ;((out[2] as { updateComponents: { components: Record<string, unknown>[] } }).updateComponents.components[1]!)['title'] = title
      return out
    }
    const threeHanded = { ...hand2, dealerHand: undefined, seat2Hand: hand2.dealerHand, seat3Hand: hand3.dealerHand }
    const judge = (out: A2uiOutput, settled = 960) => chips({ turns: [] }, out, { action: again({ bankroll: settled, pot: 0 }) }).map((f) => f.path)
    expect(judge(fresh(hand2))).toEqual(['table-4:/bankroll'])
    expect(judge(fresh(threeHanded))).toEqual([])
    expect(judge(fresh({ ...threeHanded, playerBlind: 10 }))).toEqual(['table-4:/bankroll'])
    expect(judge(fresh(hand2, 'Seven-card stud'))).toEqual([]) // the opponent's bring-in
    expect(judge(fresh({ playerHand: [], dealerHand: [] }))).toEqual([]) // a recap, no dealt hand
    expect(judge(fresh(hand2), 0)).toEqual([]) // busted
    // The pressed table reset in place with an updateDataModel alone.
    const sess = session(['deal_again', turns(recorded).t144])
    const reset = [data('table-2', { bankroll: 960, pot: 20, ...hand3, board: [] })] as A2uiOutput
    expect(chips(sess, reset, { action: dealAgain('table-2', { bankroll: 960, pot: 0, ...hand2, board: [] }) }).map((f) => f.path)).toEqual(['table-2:/bankroll'])
  })

  it('reads the CardTable bindings and numeric strings, and skips a count it cannot read', () => {
    const table = (bankroll: unknown): A2uiOutput => [
      data('table-2', { stack: { chips: bankroll }, potTotal: '$60', ...hand2, board: flop }),
      { version: 'v1.0', updateComponents: { surfaceId: 'table-2', components: [
        { id: 'root', component: 'CardTable', title: "Omaha hold'em", bankroll: { path: '/stack/chips' }, bet: { path: '/potTotal' }, dealerHand: { path: '/dealerHand' }, playerHand: { path: '/playerHand' } },
      ] } },
    ] as A2uiOutput
    const bound = session(["Let's play Omaha.", [
      { version: 'v1.0', createSurface: { surfaceId: 'table-2', catalogId: 'agent-ui--croupier' } },
      ...table('960').map((m) => JSON.parse(JSON.stringify(m).replace('"$60"', '"20"'))),
    ] as A2uiOutput])
    expect(chips(bound, table('960'), { intent: 'Bet 20.' }).map((f) => f.path)).toEqual(['table-2:/stack/chips'])
    expect(chips(bound, table('lots'), { intent: 'Bet 20.' })).toEqual([])
  })

  it('the blackjack carry-over BANKROLL_MISMATCH skips a poker table and keeps baccarat and a table that only says poker', () => {
    const next = (title: string, status: string, bankroll: number, pot?: number): A2uiOutput => [
      { version: 'v1.0', createSurface: { surfaceId: 'table-9', catalogId: 'agent-ui--croupier' } },
      data('table-9', { bankroll, ...(pot === undefined ? {} : { pot }), dealerHand: [], playerHand: [] }),
      { version: 'v1.0', updateComponents: { surfaceId: 'table-9', components: [
        { id: 'root', component: 'CardTable', title, status, phase: 'betting', betAction: 'deal', bankroll: { path: '/bankroll' }, bet: { path: pot === undefined ? '/bet' : '/pot' }, dealerHand: { path: '/dealerHand' }, playerHand: { path: '/playerHand' } },
      ] } },
    ] as A2uiOutput
    const carry = (out: A2uiOutput) =>
      croupierActionApplied.check({ surfaces: semanticSurfaceViews({ turns: [] }, out), action: dealAgain('table-1', { bankroll: 960 }) }).filter((f) => f.code === 'BANKROLL_MISMATCH').length
    expect(carry(next("Texas hold'em", '21 big blinds behind', 950, 15))).toBe(0)
    expect(carry(next('Baccarat', 'Place your bet', 950))).toBe(1)
    expect(carry(next('Blackjack (no poker here)', 'Place your bet', 950))).toBe(1)
  })

  it('a table that names no poker game is not judged', () => {
    const t = turns(recorded)
    const plain = (out: A2uiOutput) => JSON.parse(JSON.stringify(out).replaceAll("Omaha hold'em", 'Table')) as A2uiOutput
    const s = session(["Let's play.", plain(t.t139)], [CHECK, plain(t.t140)])
    expect(chips(s, plain(t.t141), { intent: 'Bet the pot.' })).toEqual([])
  })
})
