// T-0586: the table round 20 :116 (pick-croupier-game-deck-haiku-1, the passing sample) opened for the blackjack pick,
// shared by the two round 20 cluster G replays' recovery legs.
export const TABLE_1 = [
  { version: 'v1.0', createSurface: { surfaceId: 'table-1', catalogId: 'agent-ui--croupier', sendDataModel: true } },
  { version: 'v1.0', updateDataModel: { surfaceId: 'table-1', value: { bankroll: 1000, bet: 0, dealerHand: [], playerHand: [], dealerTotal: '', playerTotal: '', status: 'Place your bet', phase: 'betting' } } },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'table-1',
      components: [
        { id: 'root', component: 'CardTable', title: 'Blackjack', bankroll: { path: '/bankroll' }, bet: { path: '/bet' }, dealerHand: { path: '/dealerHand' }, playerHand: { path: '/playerHand' }, dealerTotal: { path: '/dealerTotal' }, playerTotal: { path: '/playerTotal' }, status: { path: '/status' }, statusIntent: 'info', phase: { path: '/phase' }, betAction: 'deal' },
      ],
    },
  },
]
