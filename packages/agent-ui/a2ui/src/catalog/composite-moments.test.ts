// composite-moments.test.ts: T-0208's data-driven composite-moment checks: each row fires on its hand-built
// surface and stays quiet on the composite, the negative controls stay quiet, the catalog gate keeps each row
// where its types live, and every row's moment is one of its composite's selection intents.

import { describe, expect, it } from 'vitest'
import { COMPOSITE_MOMENTS, compositeMomentChecks } from './composite-moments.ts'
import { gateChecksOnCatalog, runSemanticChecks } from './semantic-check.ts'
import type { SurfaceView } from './semantic-check.ts'
import type { A2uiComponent } from '../protocol.ts'
import { loadCatalog } from './catalog.ts'
import { composeCatalog, loadCatalogFragment } from './compose.ts'
import { validateCatalogConformance } from './conformance.ts'
import defaultCatalogRaw from './default/catalog.json'
import basicCatalogRaw from './a2ui-basic/catalog.json'
import conciergeFragmentRaw from './personas/concierge/catalog.json'
import defaultSelection from './default/selection.json'
import conciergeSelection from './personas/concierge/selection.json'

const view = (components: A2uiComponent[], surfaceId = 's1'): SurfaceView => ({
  surfaceId,
  components: new Map(components.map((c) => [c.id, c])),
  dataModel: undefined,
})
const codes = (components: A2uiComponent[]): string[] => runSemanticChecks(compositeMomentChecks, { surfaces: [view(components)] }).findings.map((f) => f.code)

const HAND_BUILT: Record<string, A2uiComponent[]> = {
  BookingForm: [
    { id: 'root', component: 'Card', children: ['t', 'date', 'party', 'go'] },
    { id: 't', component: 'Text', text: 'Reserve a table' },
    { id: 'date', component: 'Calendar', label: 'Date' },
    { id: 'party', component: 'Slider', label: 'Guests' },
    { id: 'go', component: 'Button', label: 'Book' },
  ],
  BookingConfirmation: [
    { id: 'root', component: 'Card', children: ['t', 'when'] },
    { id: 't', component: 'Text', text: 'Your table is confirmed', variant: 'h4' },
    { id: 'when', component: 'Text', text: 'Friday at 8pm' },
  ],
  BoardGrid: [
    { id: 'root', component: 'Grid', children: ['c1', 'c2', 'c3'] },
    { id: 'c1', component: 'Button', label: 'A1' },
    { id: 'c2', component: 'Button', label: 'A2' },
    { id: 'c3', component: 'Button', label: 'A3' },
  ],
  GameHud: [
    { id: 'root', component: 'Column', children: ['score', 'board'] },
    { id: 'score', component: 'Text', text: 'Shots remaining: 12' },
    { id: 'board', component: 'BoardGrid', rows: 3, cols: 3, cells: { path: '/cells' }, actionName: 'fire' },
  ],
  ResultCard: [
    { id: 'root', component: 'Column', children: ['hud', 'board', 'over'] },
    { id: 'hud', component: 'GameHud', title: 'Battleship', status: 'Done' },
    { id: 'board', component: 'BoardGrid', rows: 3, cols: 3, cells: { path: '/cells' }, actionName: 'fire' },
    { id: 'over', component: 'Text', text: 'Game over, you won' },
  ],
  ProductCard: [
    { id: 'root', component: 'Table', label: 'Spa treatments', columns: [{ key: 'treatment', label: 'Treatment' }, { key: 'price', label: 'Price' }], rows: [] },
  ],
}

const COMPOSED: Record<string, A2uiComponent[]> = {
  BookingForm: [{ id: 'root', component: 'BookingForm', title: 'Reserve a table', fields: [] }],
  BookingConfirmation: [{ id: 'root', component: 'BookingConfirmation', title: 'Booking confirmed', rows: [] }],
  BoardGrid: [{ id: 'root', component: 'BoardGrid', rows: 3, cols: 3, cells: { path: '/cells' }, actionName: 'mark' }],
  GameHud: [
    { id: 'root', component: 'Column', children: ['hud', 'board'] },
    { id: 'hud', component: 'GameHud', title: 'Battleship', status: 'Shots remaining: 12' },
    { id: 'board', component: 'BoardGrid', rows: 3, cols: 3, cells: { path: '/cells' }, actionName: 'fire' },
  ],
  ResultCard: [
    { id: 'root', component: 'Column', children: ['board', 'res'] },
    { id: 'board', component: 'BoardGrid', rows: 3, cols: 3, cells: { path: '/cells' }, actionName: 'fire' },
    { id: 'res', component: 'ResultCard', outcome: 'win', title: 'You won', summary: 'Game over' },
  ],
  ProductCard: [
    { id: 'root', component: 'Grid', children: { path: '/treatments', componentId: 'tile' } },
    { id: 'tile', component: 'ProductCard', title: { path: 'name' }, price: { path: 'price' }, actionLabel: 'Book' },
  ],
}

const codeOf = (composite: string): string => `${composite.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()}_MISSING`

describe('composite moment checks (T-0208)', () => {
  for (const { composite } of COMPOSITE_MOMENTS) {
    it(`${composite}: the hand-built surface yields ${codeOf(composite)} alone and the composite surface yields none`, () => {
      expect(codes(HAND_BUILT[composite]!)).toEqual([codeOf(composite)])
      expect(codes(COMPOSED[composite]!)).toEqual([])
    })
  }

  it('the finding names the surface, the strays, the moment and the repair', () => {
    const [f] = runSemanticChecks(compositeMomentChecks, { surfaces: [view(HAND_BUILT['BoardGrid']!, 'board-1')] }).findings
    expect(f!.path).toBe('board-1:root')
    expect(f!.message).toContain('root (a Grid)')
    expect(f!.message).toContain('a board of cells to target or mark')
    expect(f!.message).toContain('Make it ONE BoardGrid')
  })

  it('T-0262: the BookingConfirmation repair asks for literal rows of {label, path} in the Card\'s place, not inside it', () => {
    const [f] = runSemanticChecks(compositeMomentChecks, { surfaces: [view(HAND_BUILT['BookingConfirmation']!, 'ask-2')] }).findings
    expect(f!.message).toContain('rows as a literal array of {label, path}')
    expect(f!.message).toContain('never bind rows itself')
    expect(f!.message).toContain('in place of the hand-built Card, never inside one')
    expect(f!.message).toContain('a root Card needs the surface re-created')
    expect(f!.message).not.toContain('rows bound to')
  })

  it('T-0262: the shape the repair asks for passes the concierge catalog, and a bound rows fails it', () => {
    const concierge = composeCatalog(loadCatalog(defaultCatalogRaw), loadCatalogFragment(conciergeFragmentRaw), 'concierge')
    const asked: A2uiComponent = { id: 'root', component: 'BookingConfirmation', title: 'Spa booking confirmed', data: { path: '/booking' }, rows: [{ label: 'Date', path: 'date' }] }
    expect(validateCatalogConformance(asked, concierge)).toEqual([])
    expect(validateCatalogConformance({ ...asked, rows: { path: '/booking/rows' } }, concierge)).toEqual([{ code: 'CATALOG', path: 'root.rows' }])
  })

  it('T-0262: the recorded Opus repair (a BookingConfirmation inside the old Card) yields BOOKING_CONFIRMATION_WRAPPED', () => {
    const recorded: A2uiComponent[] = [
      { id: 'root', component: 'Card', elevation: '1', children: ['body'] },
      { id: 'body', component: 'CardContent', children: ['confirmation'] },
      { id: 'confirmation', component: 'BookingConfirmation', title: 'Spa booking confirmed', data: { path: '/booking' }, rows: [] },
    ]
    expect(codes(recorded)).toEqual(['BOOKING_CONFIRMATION_WRAPPED'])
    const [f] = runSemanticChecks(compositeMomentChecks, { surfaces: [view(recorded, 'ask-2')] }).findings
    expect(f!.path).toBe('ask-2:root')
    expect(f!.message).toContain('wraps its BookingConfirmation in root (a Card)')
    expect(codes([{ id: 'root', component: 'Column', children: ['confirmation'] }, recorded[2]!])).toEqual([])
  })

  it('the recorded Lexicographer guess field yields BOARD_GRID_MISSING', () => {
    expect(
      codes([
        { id: 'root', component: 'Card', children: ['title', 'guess_field', 'go'] },
        { id: 'title', component: 'Text', text: 'Six guesses. Five letters each.' },
        { id: 'guess_field', component: 'TextField', label: 'Your guess (five lowercase letters)', name: 'guess', value: { path: '/draft/guess' } },
        { id: 'go', component: 'Button', label: 'Submit guess' },
      ]),
    ).toEqual(['BOARD_GRID_MISSING'])
  })

  // T-0266: the recorded Sonnet read-back (long-concierge-booking, turn 1, ask-2) answers a fully specified spa
  // booking with a DescriptionList and a confirm Button; Kim's ruling makes that a pre-filled BookingForm.
  const READ_BACK: A2uiComponent[] = [
    { id: 'root', component: 'Column', gap: 'md', children: ['card'] },
    { id: 'card', component: 'Card', elevation: '1', children: ['hd', 'ct', 'ft'] },
    { id: 'hd', component: 'CardHeader', children: ['hdt'] },
    { id: 'hdt', component: 'Text', text: 'Spa booking summary', variant: 'h4' },
    { id: 'ct', component: 'CardContent', children: ['receipt'] },
    {
      id: 'receipt',
      component: 'DescriptionList',
      rows: [
        { label: 'Treatment', value: 'Massage, 60 minutes' },
        { label: 'Date', value: 'Thursday 19 November 2026' },
        { label: 'Time', value: '15:00' },
        { label: 'Guests', value: '1' },
        { label: 'Name', value: 'Alex Moreau' },
      ],
    },
    { id: 'ft', component: 'CardFooter', children: ['confirm'] },
    { id: 'confirm', component: 'Button', label: 'Confirm booking', variant: 'solid', action: { action: 'confirm_booking' } },
  ]

  it('the recorded booking read-back yields BOOKING_FORM_MISSING alone, naming the list and the confirm Button', () => {
    expect(codes(READ_BACK)).toEqual(['BOOKING_FORM_MISSING'])
    const [f] = runSemanticChecks(compositeMomentChecks, { surfaces: [view(READ_BACK, 'ask-2')] }).findings
    expect(f!.path).toBe('ask-2:receipt')
    expect(f!.message).toContain('confirm (a Button)')
    expect(f!.message).toContain('pre-filled')
  })

  // T-0331: round 9 :84 (regress-concierge-facilities-then-tour-haiku-1, ask-1, forced round 3) ships this read-back:
  // a "Book now" Button whose action is `confirm_booking` with `submit`. The old label cue (`confirm`) let it through.
  const R9_84: A2uiComponent[] = [
    { id: 'root', component: 'Card', children: ['hdr', 'content', 'footer'] },
    { id: 'hdr', component: 'CardHeader', children: ['title'] },
    { id: 'title', component: 'Text', text: 'Book your boat tour', variant: 'h4' },
    { id: 'content', component: 'CardContent', children: ['summary'] },
    {
      id: 'summary',
      component: 'DescriptionList',
      rows: [
        { label: 'Tour', value: 'Half-day coastal boat tour' },
        { label: 'Date', value: 'Saturday 21 November 2026' },
        { label: 'Guests', value: '2' },
        { label: 'Name', value: 'Alex Moreau' },
      ],
    },
    { id: 'footer', component: 'CardFooter', children: ['bookBtn'] },
    {
      id: 'bookBtn',
      component: 'Button',
      label: 'Book now',
      variant: 'solid',
      action: { action: 'confirm_booking', context: { booking: { path: '/booking' } }, submit: true },
    },
  ]
  const withButton = (base: A2uiComponent[], id: string, patch: Partial<A2uiComponent>): A2uiComponent[] =>
    base.map((c) => (c.id === id ? { ...c, ...patch } : c))

  it('the :84 round 3 read-back ("Book now", confirm_booking) yields BOOKING_FORM_MISSING', () => {
    expect(codes(R9_84)).toEqual(['BOOKING_FORM_MISSING'])
  })

  it('a submit Button or an action starting with confirm is the read-back confirm, whatever its label or style', () => {
    const action = (a: Record<string, unknown>) => withButton(R9_84, 'bookBtn', { label: 'Go', action: a })
    expect(codes(action({ action: 'confirm_boat_tour', submit: true }))).toEqual(['BOOKING_FORM_MISSING'])
    expect(codes(action({ action: 'send_it', submit: true }))).toEqual(['BOOKING_FORM_MISSING'])
    expect(codes(action({ action: 'confirm_boat_tour' }))).toEqual(['BOOKING_FORM_MISSING'])
    for (const name of ['confirm', 'confirmBooking', 'confirm-booking', 'Confirm_Booking']) {
      expect(codes(action({ action: name }))).toEqual(['BOOKING_FORM_MISSING'])
    }
    expect(codes(action({ action: 'book_boat_tour' }))).toEqual([])
  })

  it('reads a bound label and a child Text label (the label fallback)', () => {
    const noAction = { action: { action: 'go' } }
    const bound = withButton(R9_84, 'bookBtn', { label: { path: '/ui/cta' }, ...noAction })
    const dataModel = { ui: { cta: 'Confirm booking' } }
    expect(runSemanticChecks(compositeMomentChecks, { surfaces: [{ ...view(bound), dataModel }] }).findings.map((f) => f.code)).toEqual(['BOOKING_FORM_MISSING'])
    const child = [...withButton(R9_84, 'bookBtn', { label: undefined, child: 'cta', ...noAction }), { id: 'cta', component: 'Text', text: 'Confirm booking' }]
    expect(codes(child)).toEqual(['BOOKING_FORM_MISSING'])
  })

  it('the r5 ask-3 read-back (confirm_boat_tour, "Book now") yields BOOKING_FORM_MISSING', () => {
    expect(
      codes([
        { id: 'root', component: 'Card', children: ['head', 'body', 'foot'] },
        { id: 'head', component: 'CardHeader', children: ['title'] },
        { id: 'title', component: 'Text', variant: 'h4', text: 'Half-day coastal boat tour' },
        { id: 'body', component: 'CardContent', children: ['list'] },
        {
          id: 'list',
          component: 'DescriptionList',
          rows: [
            { label: 'Tour', value: 'Half-day coastal boat tour' },
            { label: 'Name', value: 'Alex Moreau' },
            { label: 'Departure', value: 'To be confirmed by the front desk' },
          ],
        },
        { id: 'foot', component: 'CardFooter', child: 'btn' },
        { id: 'btn', component: 'Button', label: 'Book now', variant: 'solid', action: { action: 'confirm_boat_tour', submit: true, context: { booking: { path: '/booking' } } } },
      ]),
    ).toEqual(['BOOKING_FORM_MISSING'])
  })

  // The r8 routing-long-session-opus-1 `dining-info` card: an info list with an intent-starting CTA.
  const DINING_INFO: A2uiComponent[] = [
    { id: 'root', component: 'Card', children: ['hdr', 'content', 'footer'] },
    { id: 'hdr', component: 'CardHeader', children: ['title'] },
    { id: 'title', component: 'Text', text: 'Dining at the Grand Meridian', variant: 'h4' },
    { id: 'content', component: 'CardContent', children: ['list'] },
    {
      id: 'list',
      component: 'DescriptionList',
      rows: [
        { label: 'Vela', value: 'Fine-dining restaurant' },
        { label: 'The Quay Bar', value: 'Casual bar for drinks and lighter meals' },
      ],
    },
    { id: 'footer', component: 'CardFooter', children: ['reserve'] },
    { id: 'reserve', component: 'Button', label: 'Reserve a table', variant: 'solid', action: { action: 'start_intent', context: { intent: 'reserve_table' } } },
  ]

  it('negative control: the r8 dining-info card (a "Reserve a table" start_intent CTA, no submit) yields none', () => {
    expect(codes(DINING_INFO)).toEqual([])
  })

  it('negative control: "Book now" and "Reserve a table" CTAs with no submit yield none', () => {
    for (const label of ['Book now', 'Reserve a table', 'Reserve']) {
      expect(codes(withButton(DINING_INFO, 'reserve', { label }))).toEqual([])
      expect(codes(withButton(DINING_INFO, 'reserve', { label, action: { action: 'start_intent', context: { intent: 'book' } } }))).toEqual([])
    }
  })

  it('a read-back titled "Booking confirmation" with a confirm_booking submit still yields BOOKING_FORM_MISSING, alone', () => {
    // T-0333: the noun "confirmation" is no settled state, and a live read-back confirm is never settled.
    expect(codes(withButton(R9_84, 'title', { text: 'Booking confirmation' }))).toEqual(['BOOKING_FORM_MISSING'])
  })

  it('negative control: a "Book now" info card whose action is book_listing yields none', () => {
    expect(codes(withButton(DINING_INFO, 'reserve', { label: 'Book now', action: { action: 'book_listing', context: { id: 'villa' } } }))).toEqual([])
  })

  it('negative control: a hand-built confirmation with a "Reserve another table" Button yields only BOOKING_CONFIRMATION_MISSING', () => {
    const settled: A2uiComponent[] = [
      { id: 'root', component: 'Card', children: ['t', 'rows', 'again'] },
      { id: 't', component: 'Text', text: 'Your table is confirmed', variant: 'h4' },
      { id: 'rows', component: 'DescriptionList', rows: [{ label: 'Restaurant', value: 'Vela' }, { label: 'Time', value: '19:30' }] },
      { id: 'again', component: 'Button', label: 'Reserve another table', action: { action: 'book_another_table' } },
    ]
    expect(codes(settled)).toEqual(['BOOKING_CONFIRMATION_MISSING'])
  })

  it('negative control: a booking-worded DescriptionList with no confirm Button yields none', () => {
    // An info CTA: it starts an intent and submits nothing, so it is no read-back confirm (T-0331: by action, not label).
    const info = READ_BACK.map((c) =>
      c.id === 'confirm' ? { ...c, label: 'Book a treatment', action: { action: 'start_intent', context: { intent: 'book_treatment' } } } : c,
    )
    expect(codes(info)).toEqual([])
    expect(codes(READ_BACK.filter((c) => c.id !== 'confirm'))).toEqual([])
  })

  it('negative control: a confirm Button and a DescriptionList beside one booking input yield none', () => {
    expect(codes([...READ_BACK, { id: 'note', component: 'TextField', label: 'Notes for the spa' }])).toEqual([])
  })

  it('negative control: a pre-filled BookingForm with a confirm child yields none', () => {
    expect(
      codes([
        { id: 'root', component: 'BookingForm', title: 'Spa booking', fields: [{ kind: 'text', path: 'name', label: 'Name' }], value: { path: '/draft' }, child: 'go' },
        { id: 'go', component: 'Button', label: 'Confirm booking', action: { action: 'confirm_booking', submit: true } },
      ]),
    ).toEqual([])
  })

  it('negative control: a croupier CardTable betting surface yields none', () => {
    expect(
      codes([
        { id: 'root', component: 'CardTable', phase: 'betting', bet: { path: '/bet' }, bankroll: { path: '/bankroll' }, betAction: 'deal', title: 'Blackjack' },
      ]),
    ).toEqual([])
  })

  it('negative control: a CardTable three-button grid betting strip yields no BOARD_GRID_MISSING', () => {
    expect(
      codes([
        { id: 'root', component: 'Column', children: ['table', 'bets'] },
        { id: 'table', component: 'CardTable', phase: 'betting', bet: { path: '/bet' }, bankroll: { path: '/bankroll' }, betAction: 'deal', title: 'Blackjack' },
        { id: 'bets', component: 'Grid', children: ['b1', 'b2', 'b3'] },
        { id: 'b1', component: 'Button', label: 'Bet 5' },
        { id: 'b2', component: 'Button', label: 'Bet 10' },
        { id: 'b3', component: 'Button', label: 'Bet 25' },
      ]),
    ).not.toContain('BOARD_GRID_MISSING')
  })

  it('negative control: a Mentalist number-guess TextField yields none', () => {
    expect(
      codes([
        { id: 'root', component: 'Card', children: ['t', 'guess', 'go'] },
        { id: 't', component: 'Text', text: 'I am thinking of a number from 1 to 100' },
        { id: 'guess', component: 'TextField', label: 'Your guess', name: 'guess', value: { path: '/guess' } },
        { id: 'go', component: 'Button', label: 'Guess' },
      ]),
    ).toEqual([])
  })

  it('negative control: ResultCard words with no BoardGrid yield none', () => {
    expect(codes([{ id: 't', component: 'Text', text: 'Game over, you won. Play again?' }])).toEqual([])
  })

  it('negative control: a GameHud-word Text with no BoardGrid yields none', () => {
    expect(codes([{ id: 't', component: 'Text', text: 'Score: 3, attempts remaining: 2' }])).toEqual([])
  })

  // T-0358: the smoke round 2026-10-18-smoke (Haiku 5.5) hand-built the score strip of three board-less game personas
  // whose skills name ONE GameHud (guess-hud, deal-sheet, quest-log). Each is GAME_HUD_MISSING with no BoardGrid.
  const BOARDLESS: Record<string, A2uiComponent[]> = {
    mentalist: [
      { id: 'root', component: 'Card', children: ['hd', 'ct'] },
      { id: 'hd', component: 'CardHeader', children: ['title', 'spent_badge'] },
      { id: 'title', component: 'Text', text: 'Twenty Questions', variant: 'h4' },
      { id: 'spent_badge', component: 'Badge', label: { path: '/hud/spentLabel' } },
      { id: 'ct', component: 'CardContent', children: ['progress', 'conf'] },
      { id: 'progress', component: 'Progress', value: { path: '/hud/spent' }, max: 20, label: 'Questions spent' },
      { id: 'conf', component: 'Stat', label: 'Confidence', value: { path: '/hud/confidence' } },
    ],
    negotiator: [
      { id: 'root', component: 'Card', children: ['hd', 'sheet'] },
      { id: 'hd', component: 'CardHeader', children: ['badge'] },
      { id: 'badge', component: 'Badge', label: 'Asking 240 silver' },
      { id: 'sheet', component: 'DescriptionList', rows: [{ label: 'Item', value: 'Brass lantern' }, { label: 'Asking price', value: '240 silver' }, { label: "Merchant's mood", value: 'Curious' }] },
    ],
    'dungeon-master': [
      { id: 'root', component: 'Card', children: ['strip'] },
      { id: 'strip', component: 'Row', children: ['hp', 'gold'] },
      { id: 'hp', component: 'Badge', label: 'HP 12/12' },
      { id: 'gold', component: 'Badge', label: 'Gold 0' },
    ],
  }

  for (const [persona, components] of Object.entries(BOARDLESS)) {
    it(`T-0358: the recorded ${persona} score strip with no BoardGrid yields GAME_HUD_MISSING, and with a GameHud none`, () => {
      expect(codes(components)).toEqual(['GAME_HUD_MISSING'])
      expect(codes([...components, { id: 'hud', component: 'GameHud', title: 'Game' }])).toEqual([])
    })
  }

  it('T-0358: the board-less finding names the hand-built stat components', () => {
    const [f] = runSemanticChecks(compositeMomentChecks, { surfaces: [view(BOARDLESS['dungeon-master']!, 'quest-log')] }).findings
    expect(f!.path).toBe('quest-log:hp')
    expect(f!.message).toContain('hp (a Badge), gold (a Badge)')
    expect(f!.message).toContain('Make it ONE GameHud with its title, status and stats (and progress when the game counts turns), beside the BoardGrid when the game has one')
  })

  it('T-0358 negative control: one game-stat Badge, a KPI strip and inventory Badges yield none', () => {
    expect(codes([{ id: 'gold', component: 'Badge', label: 'Gold 0' }])).toEqual([])
    expect(
      codes([
        { id: 'root', component: 'Row', children: ['a', 'b', 'c'] },
        { id: 'a', component: 'Stat', label: 'Revenue', value: '$12k' },
        { id: 'b', component: 'Stat', label: 'Conversion', value: '3.1%' },
        { id: 'c', component: 'Progress', label: 'Quota', value: 40, max: 100 },
      ]),
    ).toEqual([])
    expect(
      codes([
        { id: 'inv', component: 'Row', children: ['i1', 'i2'] },
        { id: 'i1', component: 'Badge', label: 'Torch' },
        { id: 'i2', component: 'Badge', label: 'Dagger' },
      ]),
    ).toEqual([])
  })

  // T-0279: the recorded Haiku answer to "What spa services can I book during my stay?" (round 2026-10-15-r4-fixes,
  // long-concierge-spa-services-haiku-1, turn 1): a priced Table where Kim's ruling asks for one ProductCard each.
  const SPA_TABLE: A2uiComponent[] = [
    {
      id: 'root',
      component: 'Table',
      label: 'Grand Meridian spa treatments',
      columns: [
        { key: 'treatment', label: 'Treatment' },
        { key: 'duration', label: 'Duration' },
        { key: 'price', label: 'Price' },
      ],
      rows: [
        { treatment: 'Swedish massage', duration: '60 min', price: '€120' },
        { treatment: 'Deep-tissue massage', duration: '60 min', price: '€135' },
      ],
    },
  ]

  it('T-0279: the recorded spa services Table yields PRODUCT_CARD_MISSING alone, asking for a ProductCard per item', () => {
    expect(codes(SPA_TABLE)).toEqual(['PRODUCT_CARD_MISSING'])
    const [f] = runSemanticChecks(compositeMomentChecks, { surfaces: [view(SPA_TABLE, 'spa-menu')] }).findings
    expect(f!.path).toBe('spa-menu:root')
    expect(f!.message).toContain('root (a Table)')
    expect(f!.message).toContain('Make it ONE ProductCard per item')
  })

  it('T-0279: the same list in a Column beside an intro Text still fires; a ProductCard Grid beside it does not', () => {
    const inColumn: A2uiComponent[] = [
      { id: 'col', component: 'Column', children: ['intro', 'root'] },
      { id: 'intro', component: 'Text', text: 'Our spa is open daily.' },
      ...SPA_TABLE,
    ]
    expect(codes(inColumn)).toEqual(['PRODUCT_CARD_MISSING'])
    expect(codes([...inColumn, ...COMPOSED['ProductCard']!.map((c) => ({ ...c, id: `p-${c.id}` }))])).toEqual([])
  })

  it('negative control: a hours Table with no price column yields none', () => {
    expect(
      codes([{ id: 'root', component: 'Table', label: 'Spa and pool hours', columns: [{ key: 'facility', label: 'Facility' }, { key: 'hours', label: 'Hours' }], rows: [] }]),
    ).toEqual([])
  })

  it('negative control: a priced Table with no buy or book words yields none', () => {
    expect(
      codes([{ id: 'root', component: 'Table', label: 'Quarterly revenue', columns: [{ key: 'region', label: 'Region' }, { key: 'price', label: 'Average price' }], rows: [] }]),
    ).toEqual([])
  })

  it('negative control: a priced booking Table beside a BookingForm or a CardTable yields no PRODUCT_CARD_MISSING', () => {
    const form: A2uiComponent = { id: 'form', component: 'BookingForm', title: 'Book a treatment', fields: [] }
    expect(codes([...SPA_TABLE, form])).not.toContain('PRODUCT_CARD_MISSING')
    const table: A2uiComponent = { id: 'tbl', component: 'CardTable', phase: 'betting', title: 'Blackjack' }
    expect(codes([...SPA_TABLE, table])).not.toContain('PRODUCT_CARD_MISSING')
  })

  it('the catalog gate keeps the booking rows only on agent-ui--concierge, the games and ProductCard rows on agent-ui, and none on a2ui-basic', () => {
    const base = loadCatalog(defaultCatalogRaw)
    const concierge = composeCatalog(base, loadCatalogFragment(conciergeFragmentRaw), 'concierge')
    const basic = loadCatalog(basicCatalogRaw)
    const ids = (catalog: { components: Readonly<Record<string, unknown>> }) => gateChecksOnCatalog(compositeMomentChecks, catalog).map((c) => c.id)
    const games = ['composite-moment-board-grid', 'composite-moment-game-hud', 'composite-moment-result-card', 'composite-moment-product-card']
    expect(ids(base)).toEqual(games)
    expect(concierge.catalogId).toBe('agent-ui--concierge')
    expect(ids(concierge)).toEqual(['composite-moment-booking-form', 'composite-moment-booking-confirmation', ...games])
    expect(ids(basic)).toEqual([])
  })

  it("every row's moment is one of its composite's selection intents", () => {
    const types = { ...defaultSelection.types, ...conciergeSelection.types } as Record<string, { intents: string[] }>
    for (const m of COMPOSITE_MOMENTS) expect(types[m.composite]?.intents, m.composite).toContain(m.moment)
  })

  it('every check id and code follows the naming', () => {
    expect(compositeMomentChecks.map((c) => c.id)).toEqual([
      'composite-moment-booking-form',
      'composite-moment-booking-confirmation',
      'composite-moment-board-grid',
      'composite-moment-game-hud',
      'composite-moment-result-card',
      'composite-moment-product-card',
    ])
    expect(COMPOSITE_MOMENTS.map((m) => codeOf(m.composite))).toEqual(['BOOKING_FORM_MISSING', 'BOOKING_CONFIRMATION_MISSING', 'BOARD_GRID_MISSING', 'GAME_HUD_MISSING', 'RESULT_CARD_MISSING', 'PRODUCT_CARD_MISSING'])
    for (const [i, m] of COMPOSITE_MOMENTS.entries()) expect(compositeMomentChecks[i]!.requires).toEqual([m.composite, ...(m.requires ?? [])])
  })
})

// T-0313 (Kim 2026-10-16, P1 as revised): a composite moment has one matcher. The row that detects a hand-built surface
// also carries the turn words that ask for it, which the Concierge SURFACE_MISSING check reads (it held its own regexes).
describe('the rows carry the ask cue of each Concierge composite moment (T-0313)', () => {
  const asked = () => COMPOSITE_MOMENTS.filter((m) => m.ask !== undefined).sort((a, b) => a.ask!.rank - b.ask!.rank)

  it('the ask cue rows, in precedence order, are the confirm, the services list and the booking', () => {
    expect(asked().map((m) => [m.ask!.moment, m.composite])).toEqual([
      ['confirm', 'BookingConfirmation'],
      ['services', 'ProductCard'],
      ['booking', 'BookingForm'],
    ])
  })

  it.each([
    ['BookingConfirmation', 'Those details are right, please confirm the booking.'],
    ['BookingConfirmation', 'Confirm it, the details are right.'],
    ['ProductCard', 'What spa services can I book during my stay?'],
    ['BookingForm', "I'd like a table at Vela on Friday 20 November 2026 at 20:00 for two, name Alex Moreau."],
  ])('the %s ask cue matches "%s"', (composite, turn) => {
    expect(asked().find((m) => m.ask!.cue.test(turn))?.composite).toBe(composite)
  })
})


// T-0322 D (live round 8 :90, Haiku 5.5, regress-concierge-facilities-then-tour turn 4): "What services could I add for
// the rest of my stay?" shipped one Card holding a DescriptionList of priced treatments and passed, since the row's
// priced-Table cue (T-0279) reads Tables only. Turn 0 of the same run, the facility hours, is the negative control.
describe('a services ask answered with priced rows in another type (T-0322)', () => {
  const SERVICES_ASK = 'What services could I add for the rest of my stay?'
  const card = (title: string, rows: { label: string; value: string }[]): A2uiComponent[] => [
    { id: 'root', component: 'Card', children: ['header', 'content'] },
    { id: 'header', component: 'CardHeader', children: ['title'] },
    { id: 'title', component: 'Text', text: title, variant: 'h4' },
    { id: 'content', component: 'CardContent', children: ['list'] },
    { id: 'list', component: 'DescriptionList', rows },
  ]
  const SPA_LIST = card('Spa treatments', [
    { label: 'Swedish massage', value: '60 min, €120' },
    { label: 'Deep-tissue massage', value: '60 min, €135' },
    { label: 'Hot-stone massage', value: '90 min, €170' },
    { label: 'Sea-salt and lemon body scrub', value: '45 min, €95' },
    { label: 'Hydrating facial', value: '50 min, €110' },
    { label: 'Couples massage', value: '60 min, €230 for two' },
  ])
  const HOURS_LIST = card('Pool, gym and spa hours', [
    { label: 'Pool (25m, heated)', value: '06:00 to 22:00' },
    { label: 'Gym', value: '06:00 to 22:00' },
    { label: 'Spa', value: '09:00 to 20:00. Book treatments at least a day ahead in season.' },
  ])
  const run = (components: A2uiComponent[], intent?: string) =>
    runSemanticChecks(compositeMomentChecks, { surfaces: [view(components, 'spa-treatments')], ...(intent !== undefined ? { intent } : {}) }).findings

  it('the recorded priced DescriptionList on the services ask is PRODUCT_CARD_MISSING', () => {
    const findings = run(SPA_LIST, SERVICES_ASK)
    expect(findings.map((f) => [f.code, f.path])).toEqual([['PRODUCT_CARD_MISSING', 'spa-treatments:list']])
    expect(findings[0]!.message).toContain('list (a DescriptionList)')
    expect(findings[0]!.message).toContain('Make it ONE ProductCard per item')
  })

  it('priced rows in a List fire on the services ask too', () => {
    const list: A2uiComponent[] = [
      { id: 'root', component: 'List', children: ['a', 'b'] },
      { id: 'a', component: 'Text', text: 'Swedish massage, 60 min, €120' },
      { id: 'b', component: 'Text', text: 'Hydrating facial, 50 min, €110' },
    ]
    expect(run(list, SERVICES_ASK).map((f) => [f.code, f.path])).toEqual([['PRODUCT_CARD_MISSING', 'spa-treatments:root']])
  })

  it('negative controls: the facility hours list, the priced list on another ask or with no ask, and a ProductCard Grid yield none', () => {
    expect(run(HOURS_LIST, 'What are the opening hours of the pool, gym and spa? Check the property-knowledge-base.')).toEqual([])
    expect(run(HOURS_LIST, SERVICES_ASK)).toEqual([])
    expect(run(SPA_LIST, 'Is late check-out possible?')).toEqual([])
    expect(run(SPA_LIST)).toEqual([])
    expect(run([...SPA_LIST, ...COMPOSED['ProductCard']!.map((c) => ({ ...c, id: `p-${c.id}` }))], SERVICES_ASK)).toEqual([])
  })
})

// T-0333 (live round 9 cluster G): BOOKING_CONFIRMATION_MISSING read every Text, so a caption that says "confirmed" or "booked"
// fired it (:491 Opus, :257 Sonnet). The row now reads settled words only from status signals: a Badge, a Card or CardHeader
// title, a heading Text (h1 to h5). The BookingForm row stands aside for a settled surface, and this row for a live read-back confirm.
describe('BOOKING_CONFIRMATION_MISSING reads settled-status signals, not captions (T-0333)', () => {
  const findings = (components: A2uiComponent[], intent?: string) =>
    runSemanticChecks(compositeMomentChecks, { surfaces: [view(components, 'ask-1')], ...(intent !== undefined ? { intent } : {}) }).findings.map((f) => f.code)

  // Round 9 :491 (routing-long-session-opus-1, round 1): "Which restaurants and bars does the hotel have?"
  const R9_491: A2uiComponent[] = [
    { id: 'root', component: 'Card', children: ['hdr', 'content'] },
    { id: 'hdr', component: 'CardHeader', children: ['title'] },
    { id: 'title', component: 'Text', text: 'Dining at the Grand Meridian', variant: 'h4' },
    { id: 'content', component: 'CardContent', children: ['list', 'note'] },
    { id: 'list', component: 'DescriptionList', rows: [{ label: 'Vela', value: 'Fine-dining restaurant' }, { label: 'Quay Bar', value: 'Casual dining and drinks' }] },
    { id: 'note', component: 'Text', text: 'Opening hours can be confirmed with the front desk.', variant: 'caption' },
  ]
  // Round 9 :257 (regress-concierge-facilities-then-tour-sonnet-1, round 3): "What services could I add for the rest of my stay?"
  const R9_257: A2uiComponent[] = [
    { id: 'root', component: 'Card', elevation: '1', children: ['hdr', 'content'] },
    { id: 'hdr', component: 'CardHeader', children: ['title'] },
    { id: 'title', component: 'Text', text: 'Add to your stay', variant: 'h4' },
    { id: 'content', component: 'CardContent', children: ['col'] },
    { id: 'col', component: 'Column', gap: 'md', children: ['tourList', 'note'] },
    { id: 'tourList', component: 'DescriptionList', rows: [{ label: 'Old Town walking tour', value: 'Daily at 10:00 from the lobby' }, { label: 'Harbor cruise', value: 'Daily at 17:00' }] },
    { id: 'note', component: 'Text', variant: 'caption', text: 'Spa treatments should be booked at least a day ahead in season.' },
  ]
  // Round 9 :85 (regress-concierge-facilities-then-tour-haiku-1, round 1): "Confirm it, the details are right." settled the
  // open read-back (still holding its "Book now" confirm_booking Button) with a "Booked" Badge in its footer.
  const R9_85: A2uiComponent[] = [
    { id: 'root', component: 'Card', children: ['hdr', 'content', 'footer'] },
    { id: 'hdr', component: 'CardHeader', children: ['title'] },
    { id: 'title', component: 'Text', text: 'Book your boat tour', variant: 'h4' },
    { id: 'content', component: 'CardContent', children: ['summary'] },
    { id: 'summary', component: 'DescriptionList', rows: [{ label: 'Tour', value: 'Half-day coastal boat tour' }, { label: 'Guests', value: '2' }] },
    { id: 'footer', component: 'CardFooter', children: ['settled'] },
    { id: 'settled', component: 'Badge', label: 'Booked', intent: 'success' },
    { id: 'bookBtn', component: 'Button', label: 'Book now', variant: 'solid', action: { action: 'confirm_booking', context: { booking: { path: '/booking' } }, submit: true } },
  ]

  it(':491 and :257 give no finding, with or without a turn', () => {
    expect(findings(R9_491)).toEqual([])
    expect(findings(R9_257)).toEqual([])
    expect(findings(R9_491, 'Which restaurants and bars does the hotel have?')).toEqual([])
    expect(findings(R9_257, 'What services could I add for the rest of my stay?')).toEqual([])
  })

  it(':85 (a "Booked" Badge beside the live "Book now" confirm_booking Button) yields exactly BOOKING_FORM_MISSING', () => {
    // A live read-back confirm is not settled: the BookingForm row fires and the confirmation row stands aside.
    expect(findings(R9_85, 'Confirm it, the details are right.')).toEqual(['BOOKING_FORM_MISSING'])
    expect(findings(R9_85)).toEqual(['BOOKING_FORM_MISSING'])
  })

  it('the same Badge with the Button gone is a settled hand-built confirmation: exactly BOOKING_CONFIRMATION_MISSING', () => {
    expect(findings(R9_85.filter((c) => c.id !== 'bookBtn'), 'Confirm it, the details are right.')).toEqual(['BOOKING_CONFIRMATION_MISSING'])
  })

  it('a "Book a massage" ask answered with a hand-built Booked card still fires', () => {
    const fake: A2uiComponent[] = [
      { id: 'root', component: 'Card', children: ['badge', 'rows'] },
      { id: 'badge', component: 'Badge', label: 'Booked', intent: 'success' },
      { id: 'rows', component: 'DescriptionList', rows: [{ label: 'Treatment', value: 'Massage, 60 min' }, { label: 'Time', value: 'Thursday 15:00' }] },
    ]
    expect(findings(fake, 'Book a 60-minute massage on Thursday at 15:00')).toEqual(['BOOKING_CONFIRMATION_MISSING'])
    expect(findings(fake)).toEqual(['BOOKING_CONFIRMATION_MISSING'])
  })

  it('a dining list whose caption says "hours can be confirmed" on a "please confirm the table" turn gives nothing', () => {
    expect(findings(R9_491, 'Yes, please confirm the table.')).toEqual([])
  })

  it('a Card title or a heading Text reads as a settled signal; a caption or body Text does not', () => {
    const rows: A2uiComponent = { id: 'rows', component: 'DescriptionList', rows: [{ label: 'Time', value: '19:30' }] }
    expect(findings([{ id: 'root', component: 'Card', title: 'Table confirmed', children: ['rows'] }, rows])).toEqual(['BOOKING_CONFIRMATION_MISSING'])
    for (const variant of ['caption', 'body']) {
      expect(findings([{ id: 'root', component: 'Column', children: ['t', 'rows'] }, { id: 't', component: 'Text', text: 'Table confirmed', variant }, rows])).toEqual([])
    }
  })

  it('"confirmation" is no settled word; "confirmed" in a heading is', () => {
    const rows: A2uiComponent = { id: 'rows', component: 'DescriptionList', rows: [{ label: 'Time', value: '19:30' }] }
    const col = (text: string): A2uiComponent[] => [{ id: 'root', component: 'Column', children: ['t', 'rows'] }, { id: 't', component: 'Text', text, variant: 'h4' }, rows]
    expect(findings(col('Booking confirmation'))).toEqual([])
    expect(findings(col('Table confirmed'))).toEqual(['BOOKING_CONFIRMATION_MISSING'])
  })

  it('the BookingForm row still fires on an unsettled read-back (no Badge)', () => {
    const unsettled = R9_85.filter((c) => c.id !== 'settled').map((c) => (c.id === 'footer' ? { ...c, children: ['bookBtn'] } : c))
    expect(findings(unsettled)).toEqual(['BOOKING_FORM_MISSING'])
  })
})
