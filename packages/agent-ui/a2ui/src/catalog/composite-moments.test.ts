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
    { id: 't', component: 'Text', text: 'Your table is confirmed' },
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

  it('negative control: a booking-worded DescriptionList with no confirm Button yields none', () => {
    const info = READ_BACK.map((c) => (c.id === 'confirm' ? { ...c, label: 'Book a treatment' } : c))
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

  it('the catalog gate keeps the booking rows only on agent-ui--concierge, the games rows on agent-ui, and none on a2ui-basic', () => {
    const base = loadCatalog(defaultCatalogRaw)
    const concierge = composeCatalog(base, loadCatalogFragment(conciergeFragmentRaw), 'concierge')
    const basic = loadCatalog(basicCatalogRaw)
    const ids = (catalog: { components: Readonly<Record<string, unknown>> }) => gateChecksOnCatalog(compositeMomentChecks, catalog).map((c) => c.id)
    const games = ['composite-moment-board-grid', 'composite-moment-game-hud', 'composite-moment-result-card']
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
    ])
    expect(COMPOSITE_MOMENTS.map((m) => codeOf(m.composite))).toEqual(['BOOKING_FORM_MISSING', 'BOOKING_CONFIRMATION_MISSING', 'BOARD_GRID_MISSING', 'GAME_HUD_MISSING', 'RESULT_CARD_MISSING'])
    for (const [i, m] of COMPOSITE_MOMENTS.entries()) expect(compositeMomentChecks[i]!.requires).toEqual([m.composite, ...(m.requires ?? [])])
  })
})
