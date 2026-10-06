// hands.fixture.ts: the Croupier hand-consistency fixtures (GH #1795, T-0016), shared by
// `checks.test.ts`, `templated-hand.test.ts` and `live-agent/produce-semantic-checks.test.ts`.
// Test support only: never re-exported from a barrel, never read by shipped code.
//
// `EVIDENCE_LINE` is the live Haiku payload VERBATIM (the dealer showed 6, 5, 3 = 14 while its own readout
// said "Dealer: 14, draws to 17", and no fourth card exists). It is an update-only line for `table-3`, so it
// validates only on top of the turn that created that table. `DEAL_TURN` is that prior turn, RECONSTRUCTED
// from the evidence's own ids and narration (dealer 6 up with a face-down 5, player 6 and 4), not captured:
// it delivers `root` and every id the evidence references but does not itself carry.

import type { A2uiOutput } from '../../../protocol.ts'

const CATALOG = 'agent-ui--croupier'

/** The prior turn that dealt round 3: the table, both zones, two cards each, the move buttons. */
export const DEAL_TURN: A2uiOutput = [
  { version: 'v1.0', createSurface: { surfaceId: 'table-3', catalogId: CATALOG } },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'table-3',
      components: [
        { id: 'root', component: 'Card', children: ['tableHeader', 'tableContent', 'tableFooter'] },
        { id: 'tableHeader', component: 'CardHeader', children: ['title', 'chips'] },
        { id: 'title', component: 'Text', variant: 'h4', text: 'Blackjack, round 3' },
        { id: 'chips', component: 'Stat', label: 'Chips', value: 1000, delta: 0, variant: 'tile' },
        { id: 'tableContent', component: 'CardContent', children: ['dealerColumn', 'playerColumn', 'messageZone'] },
        { id: 'dealerColumn', component: 'Column', gap: 'sm', align: 'stretch', children: ['dealerLabel', 'dealerCards', 'dealerTotal'] },
        { id: 'dealerLabel', component: 'Text', variant: 'h5', text: 'Dealer' },
        { id: 'dealerCards', component: 'Row', gap: 'md', justify: 'center', children: ['dealerCard1', 'dealerCard2'] },
        { id: 'dealerCard1', component: 'PlayingCard', rank: '6', suit: 'diamonds' },
        { id: 'dealerCard2', component: 'PlayingCard', rank: '5', suit: 'spades', faceDown: true },
        { id: 'dealerTotal', component: 'Text', variant: 'h4', text: 'Dealer shows 6' },
        { id: 'playerColumn', component: 'Column', gap: 'sm', align: 'stretch', children: ['playerLabel', 'playerCards', 'playerTotal'] },
        { id: 'playerLabel', component: 'Text', variant: 'h5', text: 'You' },
        { id: 'playerCards', component: 'Row', gap: 'md', justify: 'center', children: ['playerCard1', 'playerCard2'] },
        { id: 'playerCard1', component: 'PlayingCard', rank: '6', suit: 'hearts' },
        { id: 'playerCard2', component: 'PlayingCard', rank: '4', suit: 'clubs' },
        { id: 'playerTotal', component: 'Text', variant: 'h4', text: 'Total: 10' },
        { id: 'messageZone', component: 'Text', variant: 'body', text: 'Your move: hit, stand or double.' },
        { id: 'tableFooter', component: 'CardFooter', children: ['moves', 'actions'] },
        { id: 'moves', component: 'Row', gap: 'sm', justify: 'center', children: ['hitBtn', 'standBtn', 'doubleBtn'] },
        { id: 'hitBtn', component: 'Button', label: 'Hit', variant: 'solid', action: { action: 'hit' } },
        { id: 'standBtn', component: 'Button', label: 'Stand', variant: 'solid', action: { action: 'stand' } },
        { id: 'doubleBtn', component: 'Button', label: 'Double', variant: 'ghost', action: { action: 'double' } },
        { id: 'actions', component: 'Row', gap: 'sm', justify: 'center', children: [] },
      ],
    },
  },
]

/** The live evidence, byte for byte (`.sdlc/croupier-hand-consistency/evidence-dealer-17.jsonl`). */
export const EVIDENCE_LINE =
  '{"version":"v1.0","updateComponents":{"surfaceId":"table-3","components":[{"id":"chips","component":"Stat","label":"Chips","value":1100,"delta":100,"variant":"tile"},{"id":"playerCards","component":"Row","gap":"md","justify":"center","children":["playerCard1","playerCard2","playerCard3"]},{"id":"playerCard3","component":"PlayingCard","rank":"9","suit":"clubs"},{"id":"playerTotal","component":"Text","variant":"h4","text":"Total: 19"},{"id":"dealerCards","component":"Row","gap":"md","justify":"center","children":["dealerCard1","dealerCard2","dealerCard3"]},{"id":"dealerCard2","component":"PlayingCard","rank":"5","suit":"spades","faceDown":false},{"id":"dealerCard3","component":"PlayingCard","rank":"3","suit":"hearts"},{"id":"dealerTotal","component":"Text","variant":"h4","text":"Dealer: 14, draws to 17"},{"id":"dealerColumn","component":"Column","gap":"sm","align":"stretch","children":["dealerLabel","dealerCards","dealerTotal"]},{"id":"messageZone","component":"Text","variant":"body","text":"You double down and hit 19. Dealer shows 11, draws to 17. You win: 19 beats 17. +100 chips."},{"id":"hitBtn","component":"Button","label":"Hit","variant":"solid","disabled":true},{"id":"standBtn","component":"Button","label":"Stand","variant":"solid","disabled":true},{"id":"doubleBtn","component":"Button","label":"Double","variant":"ghost","disabled":true},{"id":"actions","component":"Row","gap":"sm","justify":"center","children":["dealAgainBtn"]},{"id":"dealAgainBtn","component":"Button","label":"Deal Again","variant":"solid","action":{"action":"deal","context":{"newRound":true}}}]}}'

/** The repair of the evidence: the dealer really draws a fourth card (a 3), so 6 + 5 + 3 + 3 = 17 matches
 *  every total the surface states. Same static shape, same ids, one card and two texts changed. */
export const CORRECTED_LINE = JSON.stringify({
  version: 'v1.0',
  updateComponents: {
    surfaceId: 'table-3',
    components: [
      { id: 'chips', component: 'Stat', label: 'Chips', value: 1100, delta: 100, variant: 'tile' },
      { id: 'playerCards', component: 'Row', gap: 'md', justify: 'center', children: ['playerCard1', 'playerCard2', 'playerCard3'] },
      { id: 'playerCard3', component: 'PlayingCard', rank: '9', suit: 'clubs' },
      { id: 'playerTotal', component: 'Text', variant: 'h4', text: 'Total: 19' },
      { id: 'dealerCards', component: 'Row', gap: 'md', justify: 'center', children: ['dealerCard1', 'dealerCard2', 'dealerCard3', 'dealerCard4'] },
      { id: 'dealerCard2', component: 'PlayingCard', rank: '5', suit: 'spades', faceDown: false },
      { id: 'dealerCard3', component: 'PlayingCard', rank: '3', suit: 'hearts' },
      { id: 'dealerCard4', component: 'PlayingCard', rank: '3', suit: 'clubs' },
      { id: 'dealerTotal', component: 'Text', variant: 'h4', text: 'Dealer: 17' },
      { id: 'messageZone', component: 'Text', variant: 'body', text: 'You double down and hit 19. Dealer draws to 17. You win: 19 beats 17. +100 chips.' },
      { id: 'hitBtn', component: 'Button', label: 'Hit', variant: 'solid', disabled: true },
      { id: 'standBtn', component: 'Button', label: 'Stand', variant: 'solid', disabled: true },
      { id: 'doubleBtn', component: 'Button', label: 'Double', variant: 'ghost', disabled: true },
      { id: 'actions', component: 'Row', gap: 'sm', justify: 'center', children: ['dealAgainBtn'] },
      { id: 'dealAgainBtn', component: 'Button', label: 'Deal Again', variant: 'solid', action: { action: 'deal', context: { newRound: true } } },
    ],
  },
})

/** The taught shape (`card-layout`/`game-table-chrome`): each hand is a list in the data model drawn by ONE
 *  templated Row, each total a bound value. Dealer 9 up with a face-down K (face-up total 9); player A + 7
 *  (soft 18). `dealerHand`/`playerHand` lengths are 2 and 2, so four cards render. */
export const DATA_DRIVEN_TURN: A2uiOutput = [
  { version: 'v1.0', createSurface: { surfaceId: 'table-4', catalogId: CATALOG } },
  {
    version: 'v1.0',
    updateDataModel: {
      surfaceId: 'table-4',
      value: {
        bankroll: 1100,
        dealerHand: [
          { rank: '9', suit: 'hearts' },
          { rank: 'K', suit: 'clubs', faceDown: true },
        ],
        playerHand: [
          { rank: 'A', suit: 'spades' },
          { rank: '7', suit: 'diamonds' },
        ],
        dealerTotal: 9,
        playerTotal: 18,
      },
    },
  },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'table-4',
      components: [
        { id: 'root', component: 'Card', children: ['header', 'content', 'footer'] },
        { id: 'header', component: 'CardHeader', children: ['title', 'chips'] },
        { id: 'title', component: 'Text', variant: 'h4', text: 'Blackjack, round 4' },
        { id: 'chips', component: 'Stat', label: 'Chips', value: { path: '/bankroll' }, variant: 'tile' },
        { id: 'content', component: 'CardContent', children: ['dealerZone', 'playerZone'] },
        { id: 'dealerZone', component: 'Column', gap: 'sm', children: ['dealerHead', 'dealerCards'] },
        { id: 'dealerHead', component: 'Row', justify: 'between', align: 'center', children: ['dealerName', 'dealerTotal'] },
        { id: 'dealerName', component: 'Text', variant: 'h5', text: 'Dealer' },
        { id: 'dealerTotal', component: 'Text', variant: 'h5', text: { path: '/dealerTotal' } },
        { id: 'dealerCards', component: 'Row', gap: 'sm', align: 'center', wrap: true, children: { path: '/dealerHand', componentId: 'dealerCard' } },
        { id: 'dealerCard', component: 'PlayingCard', rank: { path: 'rank' }, suit: { path: 'suit' }, faceDown: { path: 'faceDown' } },
        { id: 'playerZone', component: 'Column', gap: 'sm', children: ['playerHead', 'playerCards'] },
        { id: 'playerHead', component: 'Row', justify: 'between', align: 'center', children: ['playerName', 'playerTotal'] },
        { id: 'playerName', component: 'Text', variant: 'h5', text: 'You' },
        { id: 'playerTotal', component: 'Text', variant: 'h5', text: { path: '/playerTotal' } },
        { id: 'playerCards', component: 'Row', gap: 'sm', align: 'center', wrap: true, children: { path: '/playerHand', componentId: 'playerCard' } },
        { id: 'playerCard', component: 'PlayingCard', rank: { path: 'rank' }, suit: { path: 'suit' }, faceDown: { path: 'faceDown' } },
        { id: 'footer', component: 'CardFooter', children: ['hitBtn', 'standBtn'] },
        { id: 'hitBtn', component: 'Button', label: 'Hit', variant: 'solid', action: { action: 'hit' } },
        { id: 'standBtn', component: 'Button', label: 'Stand', variant: 'soft', action: { action: 'stand' } },
      ],
    },
  },
]

/** JSONL for a stored assistant turn (what `appendAssistantTurn` keeps: validated lines, no meta-line). */
export function toJsonl(output: A2uiOutput): string {
  return output.map((m) => JSON.stringify(m)).join('\n')
}
